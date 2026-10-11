/**
 * Canada Income Tax — T1 General (Individuals / Sole Proprietors) - ai2fin.com
 * Canada Revenue Agency (CRA)
 * Reference: https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return.html
 * ARCHITECTURE: Compound-key plugin 'CA-IT' alongside 'CA' (GST/HST Return).
 *   FEDERAL ONLY — provincial/territorial income tax is additional and is not
 *   computed here. Year-selected federal parameters (brackets, basic personal
 *   amount and its reduction above the 29% bracket, CPP limits, RRSP dollar
 *   limit) live in ../data/canadaFederal.ts with their CRA sources, shared with
 *   the take-home scheme in ../data/incomeTax.ts so the two cannot quote
 *   different brackets.
 *   CPP follows Schedule 8 (base, first additional and CPP2), for employment
 *   and self-employment together; EI, the Canada employment amount, medical
 *   expenses and the disability amount are credited at the lowest rate.
 *   NO RETURN-YEAR INPUT: every figure is for the current calendar year, so a
 *   2025 return prepared after 1 January 2026 is computed with 2026 amounts.
 *   Not modelled: CPP/EI overpayment refunds (lines 44800/45000), Schedule 8
 *   part-year months, QPP/Quebec, EI on self-employment, the refundable medical
 *   expense supplement, donations above 75% of net income / carry-forward.
 *   FY: Jan-Dec. Filing deadline: Apr 30 (Jun 15 for self-employed, but payment Apr 30).
 *   Quarterly instalment payments if tax >$3,000 net.
 */

import { toCsv } from '../exportUtils';
import { canadaBasicPersonalAmount, canadaFederalYear, type CanadaFederalYear } from '../data/canadaFederal';

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
  SubJurisdiction,
} from '../types';

function currentTaxYear(now = new Date()): number {
  return now.getFullYear();
}

const paramsForYear = canadaFederalYear;

const cents = (n: number): number => Math.round(n * 100) / 100;

/**
 * Year amounts this return needs that ../data/canadaFederal.ts does not carry
 * yet. LOCAL UNTIL MOVED INTO THAT SHARED TABLE — keyed by its taxYear so the
 * two always resolve the same year (a regression test fails if a shared year
 * has no entry here). Read on the CRA pages below on 2026-10-11, all under
 * https://www.canada.ca/en/revenue-agency/services/tax/ :
 *   YAMPE: businesses/topics/payroll/calculating-deductions/making-deductions/second-additional-cpp-contribution-rates-maximums.html
 *   EI: businesses/topics/payroll/payroll-deductions-contributions/employment-insurance-ei/ei-premium-rates-maximums.html
 *   Canada employment amount, medical threshold, disability amount (2026 with
 *   2025 alongside): individuals/frequently-asked-questions-individuals/adjustment-personal-income-tax-benefit-amounts.html
 */
interface CaReturnYearExtras {
  /** Year's additional maximum pensionable earnings — the CPP2 ceiling. */
  yampe: number;
  /** EI maximum insurable earnings and employee rate, outside Quebec. */
  eiMaxInsurable: number;
  eiRate: number;
  /** Line 31260 maximum. */
  canadaEmploymentAmount: number;
  /** Line 33099: expenses above the lesser of 3% of net income and this. */
  medicalThreshold: number;
  /** Line 31600, before the under-18 supplement. */
  disabilityAmount: number;
}

export const CA_IT_RETURN_EXTRAS: Readonly<Record<string, CaReturnYearExtras>> = Object.freeze({
  // CPP2: YAMPE $85,000. EI: $68,900 at 1.63% (max $1,123.07). Indexation
  // page: Canada employment amount $1,501, medical 3% ceiling $2,890,
  // disability amount $10,341.
  '2026': Object.freeze({ yampe: 85000, eiMaxInsurable: 68900, eiRate: 0.0163, canadaEmploymentAmount: 1501, medicalThreshold: 2890, disabilityAmount: 10341 }),
  // CPP2: YAMPE $81,200 (Schedule 8 2025 line D). EI: $65,700 at 1.64% (max
  // $1,077.48). $1,471 / $2,834 / $10,138.
  '2025': Object.freeze({ yampe: 81200, eiMaxInsurable: 65700, eiRate: 0.0164, canadaEmploymentAmount: 1471, medicalThreshold: 2834, disabilityAmount: 10138 }),
});

const NEWEST_EXTRAS_YEAR = Object.keys(CA_IT_RETURN_EXTRAS).sort().reverse()[0]!;

function extrasFor(p: CanadaFederalYear): CaReturnYearExtras {
  // A shared year with no entry here falls back to the newest one — the same
  // stale-but-not-broken fallback canadaFederalYear() has; the test catches it.
  return CA_IT_RETURN_EXTRAS[p.taxYear] ?? CA_IT_RETURN_EXTRAS[NEWEST_EXTRAS_YEAR]!;
}

/**
 * Statutory CPP rates (CPP Act; not indexed). Each side pays base 4.95% plus
 * first additional 1% (= the shared 5.95% employeeRate) up to the YMPE, and
 * CPP2 4% between the YMPE and the YAMPE; the self-employed pay both sides.
 * Tax treatment (CRA, "The Canada Pension Plan enhancement", 2023-05): the
 * employee base share earns the lowest-rate credit (line 30800, or 31000 for
 * the employee-equivalent half on self-employment); the employer-equivalent
 * base half, all first additional and all CPP2 are deductions (22200 / 22215).
 */
const CPP_BASE_RATE = 0.0495;
const CPP_FIRST_ADDITIONAL_RATE = 0.01;
const CPP2_RATE = 0.04;
const MEDICAL_NET_INCOME_RATE = 0.03;

const isBlank = (raw: FieldValues[string] | undefined): boolean => raw === undefined || raw === null || raw === '';

/** A user-entered T4 amount, or undefined when the field is blank or unusable. */
function overrideOf(v: FieldValues, id: string): number | undefined {
  const raw = v[id];
  if (isBlank(raw)) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? cents(n) : undefined;
}

interface CppResult {
  /** Required employee base + first additional (box 16 if nothing was entered). */
  requiredEmployee: number;
  requiredEmployee2: number;
  /** Box 16 / 16A used — the T4 override when entered. */
  cppEmployee: number;
  cpp2Employee: number;
  /** Line 30800 and line 22215. */
  baseEmployment: number;
  enhancedEmployment: number;
  /** Self-employment: base + first additional (Sch. 8 lines 43 + 44) and CPP2 (line 45). */
  seBaseFirst: number;
  seCpp2: number;
  /** Line 31000 and line 22200. */
  baseSelfEmployed: number;
  deductionSelfEmployed: number;
}

/**
 * Schedule 8 (5000-S8, 2025 edition) for 12 contributory months and no
 * elections. Part 3 is employment; Part 5 works out self-employment
 * contributions on what is left of the YMPE / YAMPE after the T4 amounts and
 * reduces to Part 4 when there is no employment. Contributions credited or
 * deducted are capped at the required amounts (an overpayment is refunded on
 * line 44800, which is not computed here), and the form's cross-component
 * shuffles for a short-paid component are not modelled.
 */
function calcCpp(
  employment: number,
  seEarnings: number,
  override: { cppEmployee?: number; cpp2Employee?: number },
  p: CanadaFederalYear,
  x: CaReturnYearExtras,
): CppResult {
  const { ympe, basicExemption, employeeRate } = p.cpp;
  // Part 3. Box 26 pensionable earnings are taken to be the employment income.
  const empPensionable = Math.max(0, employment);
  const empCapped = Math.min(empPensionable, x.yampe); // line 2
  const empCpp2Earnings = Math.max(0, empCapped - ympe); // line 4
  const empBaseEarnings = Math.max(0, Math.min(empCapped, ympe) - basicExemption); // line 7
  const reqBase = cents(empBaseEarnings * CPP_BASE_RATE); // line 11
  const reqFirst = cents(empBaseEarnings * CPP_FIRST_ADDITIONAL_RATE); // line 12
  const requiredEmployee = cents(reqBase + reqFirst); // line 13
  const requiredEmployee2 = cents(empCpp2Earnings * CPP2_RATE); // line 22
  const cppEmployee = override.cppEmployee ?? requiredEmployee; // line 8
  const cpp2Employee = override.cpp2Employee ?? requiredEmployee2; // line 21
  const paid = Math.min(cppEmployee, requiredEmployee);
  const paid2 = Math.min(cpp2Employee, requiredEmployee2);
  // Line 9 splits box 16 at 4.95 / 5.95 (the form prints it as 83.1933%).
  const paidBase = cents(paid * (CPP_BASE_RATE / employeeRate));
  const baseEmployment = Math.min(paidBase, reqBase);
  const enhancedEmployment = cents(Math.min(cents(paid - paidBase), reqFirst) + paid2);

  // Part 5. Earnings the T4 contributions already covered (line 20; the form's
  // 16.80672 is 1 / 5.95%), then whatever basic exemption employment left unused.
  const se = Math.max(0, seEarnings); // line 4 (a loss is never pensionable)
  const covered = cents(paid / employeeRate);
  let seBaseEarnings = Math.min(se, Math.max(0, ympe - basicExemption - covered)); // lines 19-22
  const unusedExemption = Math.max(0, basicExemption - empPensionable); // line 25
  if (unusedExemption > 0) {
    const beyondCeiling = Math.max(0, se - (ympe - basicExemption)); // line 28
    seBaseEarnings = Math.max(0, seBaseEarnings - Math.max(0, unusedExemption - beyondCeiling)); // lines 29-30
  }
  let seCpp2Earnings = 0; // line 42
  if (se + empCapped > ympe) {
    const cpp2Room = x.yampe - ympe - cents(paid2 / CPP2_RATE); // line 36
    seCpp2Earnings = Math.max(0, Math.min(cpp2Room, se - unusedExemption - seBaseEarnings)); // lines 37-42
  }
  const seBase = cents(seBaseEarnings * CPP_BASE_RATE * 2); // line 43, 9.9%
  const seFirst = cents(seBaseEarnings * CPP_FIRST_ADDITIONAL_RATE * 2); // line 44, 2%
  const seCpp2 = cents(seCpp2Earnings * CPP2_RATE * 2); // line 45, 8%
  const baseSelfEmployed = cents(seBase / 2); // line 31000: half the base
  // Line 22200: the other half of the base plus every enhanced dollar.
  const deductionSelfEmployed = cents(seBase - baseSelfEmployed + seFirst + seCpp2);

  return {
    requiredEmployee, requiredEmployee2, cppEmployee, cpp2Employee,
    baseEmployment, enhancedEmployment,
    seBaseFirst: cents(seBase + seFirst), seCpp2, baseSelfEmployed, deductionSelfEmployed,
  };
}

/**
 * Federal tax less the basic personal amount credit. The BPA is reduced on a
 * straight line above the start of the 29% bracket (CRA line 30000); before
 * 2026-10 this ignored the reduction and over-credited every filer with net
 * income above $177,882 (2025) / $181,440 (2026).
 */
function calcFederalTax(taxable: number, year = currentTaxYear()): number {
  const p = paramsForYear(year);
  let tax = 0;
  let lower = 0;
  for (const b of p.bands) {
    const upper = b.upTo ?? Infinity;
    if (taxable > lower) tax += (Math.min(taxable, upper) - lower) * b.rate;
    lower = upper;
  }
  // Basic personal amount credit (non-refundable, at the lowest rate). The CRA
  // reduces it by NET income; this return sets taxable_income = net_income, so
  // `taxable` is net income here. Keep it that way if line 26000 adjustments land.
  tax -= canadaBasicPersonalAmount(taxable, p) * p.lowestRate;
  return Math.max(0, Math.round(tax * 100) / 100);
}

const CA_PROVINCES: SubJurisdiction[] = [
  { code: 'ON', name: 'Ontario' }, { code: 'QC', name: 'Quebec' }, { code: 'BC', name: 'British Columbia' },
  { code: 'AB', name: 'Alberta' }, { code: 'MB', name: 'Manitoba' }, { code: 'SK', name: 'Saskatchewan' },
  { code: 'NS', name: 'Nova Scotia' }, { code: 'NB', name: 'New Brunswick' }, { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'PE', name: 'Prince Edward Island' }, { code: 'NT', name: 'Northwest Territories' },
  { code: 'YT', name: 'Yukon' }, { code: 'NU', name: 'Nunavut' },
];

const caItPlugin: TaxFilingPlugin = {
  countryCode: 'CA-IT',
  displayName: 'T1 General Income Tax Return',
  shortName: 'T1',
  authority: {
    name: 'CRA',
    fullName: 'Canada Revenue Agency',
    portalUrl: 'https://www.canada.ca/en/revenue-agency.html',
    helpUrl: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return.html',
  },
  taxFamily: 'INCOME_TAX',
  isFullPlugin: true,

  getFormSchema(): FormSection[] {
    const p = paramsForYear(currentTaxYear());
    const x = extrasFor(p);
    const $ = (n: number) => `$${n.toLocaleString('en-CA')}`;
    return [
      {
        id: 'income',
        title: 'Total Income',
        fields: [
          { id: 'employment_income', label: 'Employment income (T4)', officialLabel: 'Line 10100', type: 'currency', editable: true, required: false },
          // 13499 / 13699 are the GROSS lines; 13500 / 13700 are NET (business /
          // professional). The gross was labelled 13500 and the net 13700 until
          // 2026-10, and the auto-filled gross was never read, so an auto-filled
          // return showed no self-employment income at all.
          { id: 'self_employment_gross', label: 'Self-employment gross income', officialLabel: 'Line 13499 / 13699', type: 'currency', editable: true, required: false, autoPopulateFrom: 'income_net', helpText: 'Gross business (13499) or professional (13699) income from Form T2125 — sales net of the GST/HST you collected' },
          { id: 'self_employment_expenses', label: 'Self-employment expenses', type: 'currency', editable: true, required: false, helpText: 'Total business or professional expenses from Form T2125' },
          { id: 'self_employment_net', label: 'Self-employment net income', officialLabel: 'Line 13500 / 13700', type: 'currency', editable: true, required: false, helpText: 'Net business (13500) or professional (13700) income or loss. Leave blank to use gross income less expenses.' },
          { id: 'interest_income', label: 'Interest and investment income', officialLabel: 'Line 12100', type: 'currency', editable: true, required: false },
          { id: 'dividend_income', label: 'Taxable dividends', officialLabel: 'Line 12000', type: 'currency', editable: true, required: false },
          { id: 'rental_income', label: 'Net rental income', officialLabel: 'Line 12600', type: 'currency', editable: true, required: false },
          { id: 'capital_gains', label: 'Taxable capital gains', officialLabel: 'Line 12700', type: 'currency', editable: true, required: false, helpText: '50% inclusion rate. The proposed increase to 2/3 was cancelled on 21 March 2025 and never took effect.' },
          { id: 'other_income', label: 'Other income', officialLabel: 'Line 13000', type: 'currency', editable: true, required: false },
          { id: 'total_income', label: 'Total income', officialLabel: 'Line 15000', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        // Calculated from employment income; editable so the T4 amounts can
        // replace them (calculateFields returns the override when one is set).
        id: 'payroll_contributions',
        title: 'CPP & EI through Employment (T4)',
        description: 'Worked out from your employment income. Enter the amounts on your T4 slips to use those instead.',
        collapsed: true,
        fields: [
          { id: 'cpp_employee', label: 'CPP contributions (base + first additional)', officialLabel: 'T4 box 16', type: 'currency', calculated: true, editable: true, required: false, helpText: `5.95% of earnings between ${$(p.cpp.basicExemption)} and ${$(p.cpp.ympe)} (${p.taxYear})` },
          { id: 'cpp2_employee', label: 'Second additional CPP contributions (CPP2)', officialLabel: 'T4 box 16A', type: 'currency', calculated: true, editable: true, required: false, helpText: `4% of earnings between ${$(p.cpp.ympe)} and ${$(x.yampe)} (${p.taxYear})` },
          { id: 'ei_premiums', label: 'EI premiums', officialLabel: 'T4 box 18', type: 'currency', calculated: true, editable: true, required: false, helpText: `${+(x.eiRate * 100).toFixed(2)}% of insurable earnings up to ${$(x.eiMaxInsurable)} (${p.taxYear}, outside Quebec)` },
        ],
      },
      {
        id: 'deductions',
        title: 'Deductions (Net Income)',
        fields: [
          { id: 'rrsp_deduction', label: 'RRSP deduction', officialLabel: 'Line 20800', type: 'currency', editable: true, required: false, helpText: `18% of prior year earned income, up to the RRSP dollar limit (${$(p.rrspDollarLimit)} for ${p.taxYear})` },
          { id: 'union_dues', label: 'Union / professional dues', officialLabel: 'Line 21200', type: 'currency', editable: true, required: false },
          { id: 'child_care', label: 'Child care expenses', officialLabel: 'Line 21400', type: 'currency', editable: true, required: false },
          { id: 'moving_expenses', label: 'Moving expenses', officialLabel: 'Line 21900', type: 'currency', editable: true, required: false },
          { id: 'business_investment_loss', label: 'Business investment loss', officialLabel: 'Line 21700', type: 'currency', editable: true, required: false },
          { id: 'cpp_deduction_self_employed', label: 'CPP deduction on self-employment earnings', officialLabel: 'Line 22200', type: 'currency', calculated: true, editable: false, required: false, helpText: 'The employer half of the base contributions, plus all first additional and CPP2 contributions' },
          { id: 'cpp_deduction_employment', label: 'Enhanced CPP deduction on employment income', officialLabel: 'Line 22215', type: 'currency', calculated: true, editable: false, required: false, helpText: 'First additional (1%) and CPP2 (4%) contributions through employment' },
          { id: 'other_deductions', label: 'Other deductions', type: 'currency', editable: true, required: false },
          { id: 'net_income', label: 'Net income', officialLabel: 'Line 23600', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'credits',
        title: 'Non-refundable Tax Credits',
        collapsed: true,
        fields: [
          { id: 'cpp_base_employment', label: 'Base CPP contributions through employment', officialLabel: 'Line 30800', type: 'currency', calculated: true, editable: false, required: false },
          { id: 'cpp_base_self_employed', label: 'Base CPP contributions on self-employment earnings', officialLabel: 'Line 31000', type: 'currency', calculated: true, editable: false, required: false },
          { id: 'canada_employment_amount', label: 'Canada employment amount', officialLabel: 'Line 31260', type: 'currency', calculated: true, editable: false, required: false, helpText: `Employment income up to ${$(x.canadaEmploymentAmount)} (${p.taxYear})` },
          { id: 'medical_expenses', label: 'Medical expenses', officialLabel: 'Line 33099', type: 'currency', editable: true, required: false, helpText: `Credited above the lesser of 3% of net income and ${$(x.medicalThreshold)} (${p.taxYear})` },
          { id: 'medical_expenses_allowable', label: 'Medical expenses above the threshold', type: 'currency', calculated: true, editable: false, required: false },
          { id: 'charitable_donations', label: 'Charitable donations', officialLabel: 'Line 34900', type: 'currency', editable: true, required: false, helpText: 'Lowest federal rate (14.5% for 2025, 14% for 2026) on the first $200; 29% on the rest (33% on the part paid from income in the top bracket, not modelled here)' },
          { id: 'disability_amount', label: 'Disability amount', officialLabel: 'Line 31600', type: 'currency', editable: true, required: false, helpText: `${$(x.disabilityAmount)} for ${p.taxYear} once the CRA has approved Form T2201 (more with the under-18 supplement)` },
          { id: 'non_refundable_credits', label: 'Credits besides the basic personal amount', type: 'currency', calculated: true, editable: false, required: false, helpText: 'CPP, EI, Canada employment, medical and disability amounts at the lowest rate, plus the donation credit' },
        ],
      },
      {
        id: 'tax_calc',
        title: 'Tax Calculation',
        fields: [
          { id: 'taxable_income', label: 'Taxable income', officialLabel: 'Line 26000', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'federal_tax', label: 'Federal tax after the basic personal amount', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'net_federal_tax', label: 'Net federal tax', officialLabel: 'Line 42000', type: 'currency', calculated: true, editable: false, required: true, helpText: 'Non-refundable credits reduce federal tax to nil at most — never the CPP payable' },
          { id: 'cpp_contributions', label: 'CPP contributions on self-employment earnings', type: 'currency', calculated: true, editable: false, required: false, helpText: `Base + first additional, both portions: 11.9% of earnings between ${$(p.cpp.basicExemption)} and ${$(p.cpp.ympe)} (${p.taxYear}), less what your T4s already covered` },
          { id: 'cpp2_contributions', label: 'CPP2 contributions on self-employment earnings', type: 'currency', calculated: true, editable: false, required: false, helpText: `Both portions: 8% of earnings between ${$(p.cpp.ympe)} and ${$(x.yampe)} (${p.taxYear}), less what your T4s already covered. Line 42100 is this plus the line above.` },
          { id: 'total_federal_payable', label: 'Total federal tax payable', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'payments',
        title: 'Tax Paid & Balance',
        fields: [
          { id: 'tax_deducted', label: 'Income tax deducted (T4)', type: 'currency', editable: true, required: false },
          { id: 'instalments_paid', label: 'Instalment payments', type: 'currency', editable: true, required: false },
          { id: 'balance_owing', label: 'Balance owing / refund', officialLabel: 'Line 48500', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'quarterly_instalment', label: 'Suggested quarterly instalment', type: 'currency', calculated: true, editable: false, required: false },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({ monthly: false, quarterly: true, annual: true, defaultFrequency: 'annual' }),
  getFinancialYearBounds: (y) => ({ start: new Date(y, 0, 1), end: new Date(y, 11, 31) }),

  getTerminology: () => ({
    taxName: 'Income Tax', taxAbbrev: 'IT',
    salesLabel: 'Income', purchasesLabel: 'Deductions',
    outputTaxLabel: 'Tax payable', inputTaxLabel: 'Tax credits',
  }),

  calculateFields(v: FieldValues): CalculatedFields {
    const p = paramsForYear(currentTaxYear());
    const x = extrasFor(p);
    const employment = Number(v.employment_income) || 0;
    // The T1 reads the NET line. When it is blank, net = gross less expenses
    // (Form T2125), so an auto-filled gross is no longer silently ignored.
    const seNet = isBlank(v.self_employment_net)
      ? (Number(v.self_employment_gross) || 0) - (Number(v.self_employment_expenses) || 0)
      : Number(v.self_employment_net) || 0;
    const interest = Number(v.interest_income) || 0;
    const dividends = Number(v.dividend_income) || 0;
    const rental = Number(v.rental_income) || 0;
    const capGains = Number(v.capital_gains) || 0;
    const other = Number(v.other_income) || 0;
    const total_income = employment + seNet + interest + dividends + rental + capGains + other;

    // Schedule 8. Before 2026-10 employees got no CPP at all, and the self-
    // employed paid 11.9% from a fresh $3,500 exemption up to the YMPE however
    // much their T4s had already covered, with no CPP2, no line 22200 deduction
    // and no line 31000 credit (the half it computed was never used).
    const cpp = calcCpp(employment, seNet, { cppEmployee: overrideOf(v, 'cpp_employee'), cpp2Employee: overrideOf(v, 'cpp2_employee') }, p, x);
    const eiRequired = cents(Math.min(Math.max(0, employment), x.eiMaxInsurable) * x.eiRate);
    const ei_premiums = overrideOf(v, 'ei_premiums') ?? eiRequired;

    const dedFields = ['rrsp_deduction', 'union_dues', 'child_care', 'moving_expenses', 'business_investment_loss', 'other_deductions'];
    const totalDed = dedFields.reduce((s, f) => s + (Number(v[f]) || 0), 0) + cpp.deductionSelfEmployed + cpp.enhancedEmployment;
    const net_income = Math.max(0, cents(total_income - totalDed));
    const taxable_income = net_income;

    const federal_tax = calcFederalTax(taxable_income);

    // Lowest-rate credits besides the BPA (already netted in federal_tax).
    // medical_expenses and disability_amount were collected and never read
    // until 2026-10. Medical: expenses above the lesser of 3% of net income and
    // the indexed dollar threshold. EI credit is capped at the premium required
    // on the employment income (any excess is the line 45000 refund).
    const canada_employment_amount = Math.min(Math.max(0, employment), x.canadaEmploymentAmount);
    const medical = Math.max(0, Number(v.medical_expenses) || 0);
    const medical_expenses_allowable = Math.max(0, cents(medical - Math.min(cents(net_income * MEDICAL_NET_INCOME_RATE), x.medicalThreshold)));
    const disability = Math.max(0, Number(v.disability_amount) || 0);
    const lowestRateAmounts = cpp.baseEmployment + cpp.baseSelfEmployed + Math.min(ei_premiums, eiRequired)
      + canada_employment_amount + medical_expenses_allowable + disability;

    // Donation credit
    const donations = Number(v.charitable_donations) || 0;
    let donationCredit = 0;
    if (donations > 0) {
      // The first $200 is credited at the LOWEST rate, which is 14.5% for 2025
      // and 14% for 2026 (Finance Canada: "Only the first $200 of an
      // individual's charitable donation claim is subject to the lowest income
      // tax rate"). This used the pre-2025 15% until 2026-10.
      donationCredit = Math.min(donations, 200) * p.lowestRate + Math.max(0, donations - 200) * 0.29;
    }
    const non_refundable_credits = cents(lowestRateAmounts * p.lowestRate + donationCredit);

    // Non-refundable credits bring federal tax to nil at most (line 42000).
    // CPP payable on self-employment (line 42100) is added after; until
    // 2026-10 the donation credit was netted against it instead.
    const net_federal_tax = Math.max(0, cents(federal_tax - non_refundable_credits));
    const cpp_contributions = cpp.seBaseFirst;
    const cpp2_contributions = cpp.seCpp2;
    const total_federal_payable = cents(net_federal_tax + cpp_contributions + cpp2_contributions);

    const deducted = Number(v.tax_deducted) || 0;
    const instalments = Number(v.instalments_paid) || 0;
    const balance_owing = Math.round((total_federal_payable - deducted - instalments) * 100) / 100;
    const quarterly_instalment = Math.round(total_federal_payable / 4 * 100) / 100;

    return {
      total_income,
      // Override-aware: these are editable (the T4 boxes), and the client
      // merges calculatedFields over the user's values on save.
      cpp_employee: cpp.cppEmployee, cpp2_employee: cpp.cpp2Employee, ei_premiums,
      cpp_deduction_self_employed: cpp.deductionSelfEmployed, cpp_deduction_employment: cpp.enhancedEmployment,
      net_income,
      cpp_base_employment: cpp.baseEmployment, cpp_base_self_employed: cpp.baseSelfEmployed,
      canada_employment_amount, medical_expenses_allowable, non_refundable_credits,
      taxable_income, federal_tax, net_federal_tax, cpp_contributions, cpp2_contributions,
      total_federal_payable, balance_owing, quarterly_instalment,
    };
  },

  // income_net, not income_total: T2125 line 3B takes the GST/HST collected
  // back out of gross sales, and income_total is tax-inclusive. No expenses
  // key: none the host emits is net of ITCs and excludes capital purchases.
  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'self_employment_gross', aggregateKey: 'income_net' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    const rrsp = Number(v.rrsp_deduction) || 0;
    // $31,560 was quoted here as the 2025 limit; it is the 2024 one. The CRA's
    // dollar limit is $32,490 for 2025 and $33,810 for 2026.
    const p = paramsForYear(currentTaxYear());
    const x = extrasFor(p);
    if (rrsp > p.rrspDollarLimit) {
      r.push({ fieldId: 'rrsp_deduction', message: `${p.taxYear} RRSP dollar limit is $${p.rrspDollarLimit.toLocaleString('en-CA')}`, severity: 'warning' });
    }
    if (isBlank(v.self_employment_net) && (Number(v.self_employment_gross) || 0) > 0 && isBlank(v.self_employment_expenses)) {
      r.push({ fieldId: 'self_employment_expenses', message: 'No expenses entered, so all of the gross self-employment income is being taxed as net income', severity: 'warning' });
    }
    if ((Number(v.disability_amount) || 0) > x.disabilityAmount) {
      r.push({ fieldId: 'disability_amount', message: `The ${p.taxYear} disability amount is $${x.disabilityAmount.toLocaleString('en-CA')}; more applies only with the under-18 supplement`, severity: 'warning' });
    }
    // An amount above what the employment income requires (two employers, say)
    // is refunded on line 44800 / 45000, which this return does not compute.
    const employment = Math.max(0, Number(v.employment_income) || 0);
    const required = calcCpp(employment, 0, {}, p, x);
    const excess: Array<[string, number, string]> = [
      ['cpp_employee', required.requiredEmployee, '44800'],
      ['cpp2_employee', required.requiredEmployee2, '44800'],
      ['ei_premiums', cents(Math.min(employment, x.eiMaxInsurable) * x.eiRate), '45000'],
    ];
    for (const [id, req, line] of excess) {
      const entered = overrideOf(v, id);
      if (entered !== undefined && entered > req + 0.005) {
        r.push({ fieldId: id, message: `More than this employment income requires ($${req.toFixed(2)}); the excess is refunded on line ${line}, which is not included here`, severity: 'info' });
      }
    }
    return r;
  },
  getFieldHelp: () => null,

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v: FieldValues, format: string): Promise<ExportOutput> {
    if (format === 'csv') return toCsv(v, `T1-CA-${new Date().toISOString().slice(0, 10)}`);
    return {
      data: JSON.stringify(v, null, 2),
      filename: `T1-CA-${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/json',
    };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://www.canada.ca/en/services/taxes/income-tax/personal-income-tax/how-file/tax-software.html', submissionMethod: 'manual_upload' as const, apiReady: false }),
  hasSubJurisdictions: () => true,
  getSubJurisdictions: () => CA_PROVINCES,
  supportsCustomFields: () => false,
};

export default caItPlugin;
