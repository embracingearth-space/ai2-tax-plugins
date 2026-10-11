/**
 * US Income Tax — Schedule C / 1040-ES (Sole Proprietor) - ai2fin.com
 * Internal Revenue Service (IRS)
 * Reference: https://www.irs.gov/forms-pubs/about-schedule-c-form-1040
 * ARCHITECTURE: Compound-key plugin 'US-IT' alongside 'US' (Form 941 payroll).
 *   Tax brackets (single): 10/12/22/24/32/35/37% — year-selected (2025 / 2026
 *   per Rev. Proc. 2025-32 + OBBBA).
 *   W-2 wages: ordinary income with no SE tax; Social Security wages use up the
 *   wage base before SE earnings do (Schedule SE lines 8a-10).
 *   Self-employment tax: 15.3% (12.4% SS up to wage base + 2.9% Medicare) on
 *   92.35% of net profit, nothing if that is under $400 (Schedule SE line 4c).
 *   Additional Medicare Tax: 0.9% of Medicare wages + SE earnings over $200,000
 *   (Form 8959). Its own line: not SE tax, not in the half-SE deduction
 *   (IRC 164(f) excludes 1401(b)(2)).
 *   QBI deduction (IRC 199A, Form 8995): 20% of net profit less half SE tax,
 *   capped at 20% of taxable income before it. See calcQbiDeduction for what
 *   is not modelled above the threshold.
 *   Quarterly estimated payments: Apr 15, Jun 15, Sep 15, Jan 15.
 *   Standard deduction (single): $15,750 (2025, OBBBA), $16,100 (2026).
 *   Year: every figure uses currentTaxYear() (the calendar year today) — the
 *   form has no return-year input, so the help text quotes that same year.
 */

import { toCsv } from '../exportUtils';

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
  SubJurisdiction,
} from '../types';

const SS_RATE = 0.124;
const MEDICARE_RATE = 0.029;
const SE_EARNINGS_FACTOR = 0.9235;
const SE_TAX_FLOOR = 400; // Schedule SE line 4c: under $400 of SE earnings, no SE tax
// Form 8959: single / HoH / QSS threshold. Statutory, not indexed for inflation.
const ADDITIONAL_MEDICARE_RATE = 0.009;
const ADDITIONAL_MEDICARE_THRESHOLD_SINGLE = 200000;
const QBI_RATE = 0.20;

// Year-indexed parameters. 2025 std deduction is the OBBBA-amended $15,750
// (not the originally-announced $15,000). 2026 per Rev. Proc. 2025-32.
const SS_WAGE_BASE: Record<number, number> = { 2025: 176100, 2026: 184500 };
const STD_DEDUCTION_SINGLE_BY_YEAR: Record<number, number> = { 2025: 15750, 2026: 16100 };
// 199A(e)(2) threshold and (b)(3)(B) phase-in range, "all other returns":
// 2025 per Rev. Proc. 2024-40 s.3.27; 2026 per Rev. Proc. 2025-32 s.4.26
// (OBBBA widened the range from $50,000 to $75,000).
const QBI_THRESHOLD_SINGLE: Record<number, number> = { 2025: 197300, 2026: 201750 };
const QBI_PHASE_IN_RANGE_SINGLE: Record<number, number> = { 2025: 50000, 2026: 75000 };
// 199A(i) (OBBBA s.70105): $400 minimum deduction with at least $1,000 of QBI
// from businesses the taxpayer materially participates in, from 2026.
const QBI_MINIMUM_DEDUCTION: Record<number, number> = { 2025: 0, 2026: 400 };
const QBI_MINIMUM_ACTIVE_QBI = 1000;
// Business standard mileage rate (irs.gov/tax-professionals/standard-mileage-rates):
// 2025 IR-2024-312; 2026 IR-2025-128 to 30 Jun, IR-2026-29 from 1 Jul.
const MILEAGE_HELP_BY_YEAR: Record<number, string> = {
  2025: '70¢/mile (2025)',
  2026: '72.5¢/mile Jan 1–Jun 30 and 76¢/mile Jul 1–Dec 31 (2026)',
};

const BRACKETS_2025 = [
  [0, 11925, 0.10], [11925, 48475, 0.12], [48475, 103350, 0.22],
  [103350, 197300, 0.24], [197300, 250525, 0.32], [250525, 626350, 0.35],
  [626350, Infinity, 0.37],
] as const;

const BRACKETS_2026 = [
  [0, 12400, 0.10], [12400, 50400, 0.12], [50400, 105700, 0.22],
  [105700, 201775, 0.24], [201775, 256225, 0.32], [256225, 640600, 0.35],
  [640600, Infinity, 0.37],
] as const;

function currentTaxYear(now = new Date()): number {
  return now.getFullYear();
}

function paramsForYear(year: number) {
  const y = year >= 2026 ? 2026 : 2025;
  return {
    year: y,
    brackets: y === 2026 ? BRACKETS_2026 : BRACKETS_2025,
    ssWageBase: SS_WAGE_BASE[y],
    stdDeduction: STD_DEDUCTION_SINGLE_BY_YEAR[y],
    qbiThreshold: QBI_THRESHOLD_SINGLE[y],
    qbiPhaseInRange: QBI_PHASE_IN_RANGE_SINGLE[y],
    qbiMinimum: QBI_MINIMUM_DEDUCTION[y],
    mileageHelp: MILEAGE_HELP_BY_YEAR[y],
  };
}

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
const round2 = (n: number) => Math.round(n * 100) / 100;
const isBlank = (x: unknown) => x === '' || x === undefined || x === null;

function calcFederalTax(taxable: number, year = currentTaxYear()): number {
  let tax = 0;
  for (const [lower, upper, rate] of paramsForYear(year).brackets) {
    if (taxable > lower) {
      tax += Math.min(taxable - lower, upper - lower) * rate;
    }
  }
  return Math.round(tax * 100) / 100;
}

/**
 * Schedule SE Part I. `ssWages` is line 8a (W-2 boxes 3 + 7): it uses up the
 * Social Security wage base first, so only the rest (line 9) is open to the
 * 12.4%. `seEarnings` is line 6 — zero when line 4c is under $400.
 * Additional Medicare Tax is NOT here: line 12 is lines 10 + 11 only.
 */
function calcSelfEmploymentTax(netProfit: number, ssWages = 0, year = currentTaxYear()): { seTax: number; deduction: number; seEarnings: number } {
  const earnings = netProfit * SE_EARNINGS_FACTOR; // line 4a: 92.35% of net SE earnings
  if (earnings < SE_TAX_FLOOR) return { seTax: 0, deduction: 0, seEarnings: 0 };
  const wageBaseLeft = Math.max(0, paramsForYear(year).ssWageBase - Math.max(0, ssWages)); // line 9
  const ssSE = Math.min(earnings, wageBaseLeft) * SS_RATE; // line 10
  const medicareSE = earnings * MEDICARE_RATE; // line 11
  const seTax = Math.round((ssSE + medicareSE) * 100) / 100;
  const deduction = Math.round(seTax / 2 * 100) / 100; // Deductible half of SE tax (line 13)
  return { seTax, deduction, seEarnings: earnings };
}

/**
 * Form 8959, single. Part I: Medicare wages over the threshold. Part II: SE
 * earnings over the threshold less those wages (not below zero). A SE loss is
 * ignored. Not SE tax, so never halved into the deduction.
 */
function calcAdditionalMedicareTax(medicareWages: number, seEarnings: number): number {
  const wages = Math.max(0, medicareWages);
  const onWages = Math.max(0, wages - ADDITIONAL_MEDICARE_THRESHOLD_SINGLE);
  const thresholdLeft = Math.max(0, ADDITIONAL_MEDICARE_THRESHOLD_SINGLE - wages);
  const onSE = Math.max(0, Math.max(0, seEarnings) - thresholdLeft);
  return round2((onWages + onSE) * ADDITIONAL_MEDICARE_RATE);
}

/**
 * QBI deduction (IRC 199A) for one Schedule C business, single filer.
 * `qbi` is net profit less the deductible half of SE tax; the form has no
 * self-employed health insurance, retirement contribution or capital gain
 * lines, so those adjustments (and the net-capital-gain reduction of the cap)
 * are not modelled, nor is a prior-year QBI loss carryforward.
 *
 * At or under the threshold the deduction is exact: 20% of QBI, capped at 20%
 * of taxable income before it. Above it the law limits the deduction by the
 * W-2 wages the business pays, the UBIA of its qualified property, and
 * whether it is a specified service trade or business (SSTB) — none of which
 * this form collects. CONSERVATIVE TREATMENT: it is computed as an SSTB with
 * no W-2 wages and no qualified property, the lowest deduction the law allows
 * (Form 8995-A Schedule A + Part III): 20% x QBI x (1 - r)^2 inside the
 * phase-in range, r = (taxable income - threshold) / range, and nil above it.
 * Any wages, property or non-SSTB status can only raise it, so the estimate
 * never understates tax; validateForm warns whenever this applies.
 *
 * From 2026 the $400 minimum (199A(i)) applies only when the filer says they
 * materially participate (Schedule C line G) and active QBI is >= $1,000 —
 * under the conservative treatment, active QBI is the applicable percentage.
 */
function calcQbiDeduction(qbi: number, taxableBeforeQbi: number, materiallyParticipated: boolean, year = currentTaxYear()): number {
  if (qbi <= 0) return 0;
  const p = paramsForYear(year);
  const over = Math.max(0, taxableBeforeQbi - p.qbiThreshold);
  const applicable = Math.max(0, 1 - over / p.qbiPhaseInRange); // 1 at/below threshold, 0 past the range
  const qbiComponent = QBI_RATE * qbi * applicable * applicable;
  let deduction = Math.min(qbiComponent, QBI_RATE * Math.max(0, taxableBeforeQbi));
  if (materiallyParticipated && qbi * applicable >= QBI_MINIMUM_ACTIVE_QBI) {
    deduction = Math.max(deduction, p.qbiMinimum);
  }
  return round2(deduction);
}

/** The whole return, shared by calculateFields and validateForm. */
function computeReturn(v: FieldValues) {
  const year = currentTaxYear();
  const p = paramsForYear(year);

  const grossReceipts = Number(v.gross_receipts) || 0;
  const returns = Number(v.returns_allowances) || 0;
  const cogs = Number(v.cost_of_goods_sold) || 0;
  const gross_income = grossReceipts - returns - cogs;

  const expenseFields = ['advertising', 'car_truck', 'contract_labor', 'insurance', 'interest_mortgage',
    'interest_other', 'office_expense', 'rent_lease', 'supplies', 'utilities', 'other_expenses'];
  const total_expenses = expenseFields.reduce((sum, f) => sum + (Number(v[f]) || 0), 0);

  // Simplified method: $5 x up to 300 sqft, but never more than the business's
  // profit before it (Schedule C line 29) — it can't create a loss and the
  // excess is not carried over. Exact when all the business's income is
  // earned from the home; otherwise the true limit is lower (Schedule C
  // instructions, Simplified Method Worksheet line 1).
  const homeOfficeLimit = Math.max(0, gross_income - total_expenses);
  // Clamped to 0–300 sq ft: a negative area must not create income.
  const homeOfficeSqft = Math.min(Math.max(0, Number(v.home_office_sqft) || 0), 300);
  const home_office_calc = Math.min(homeOfficeSqft * 5, homeOfficeLimit);
  // An override must be a usable number; '1,500' or '-' is treated as blank
  // rather than turning every figure on the return into NaN.
  const homeOfficeOverridden = !isBlank(v.home_office_deduction) && Number.isFinite(Number(v.home_office_deduction));
  const home_office_deduction = homeOfficeOverridden ? Number(v.home_office_deduction) : home_office_calc;

  const net_profit_loss = gross_income - total_expenses - home_office_deduction;

  // W-2 wages: box 1 is income; boxes 3+7 and box 5 default to box 1 if blank.
  const wages = Number(v.wages) || 0;
  const ssWages = isBlank(v.wages_ss) ? wages : Number(v.wages_ss) || 0;
  const medicareWages = isBlank(v.wages_medicare) ? wages : Number(v.wages_medicare) || 0;

  const { seTax, deduction: seDeduction, seEarnings } = calcSelfEmploymentTax(Math.max(0, net_profit_loss), ssWages, year);
  const additional_medicare_tax = calcAdditionalMedicareTax(medicareWages, seEarnings);

  const adjusted_gross_income = wages + net_profit_loss - seDeduction;
  const standard_deduction = p.stdDeduction;
  const taxableBeforeQbi = Math.max(0, adjusted_gross_income - standard_deduction);
  const qbi = net_profit_loss - seDeduction;
  const materiallyParticipated = v.materially_participated === true || v.materially_participated === 'true';
  const qbi_deduction = calcQbiDeduction(qbi, taxableBeforeQbi, materiallyParticipated, year);
  const taxable_income = Math.max(0, taxableBeforeQbi - qbi_deduction);
  const federal_tax = calcFederalTax(taxable_income, year);
  const total_tax = Math.round((federal_tax + seTax + additional_medicare_tax) * 100) / 100;

  const estimated = Number(v.estimated_payments) || 0;
  const withholding = Number(v.withholding) || 0;
  const balance_due = Math.round((total_tax - estimated - withholding) * 100) / 100;
  // Form 1040-ES: estimated payments are generally required only when the tax
  // still owed AFTER withholding is $1,000 or more — so wages that already have
  // tax withheld are not asked for again.
  const owedAfterWithholding = Math.max(0, total_tax - withholding);
  const quarterly_estimated = owedAfterWithholding < 1000 ? 0 : Math.round(owedAfterWithholding / 4 * 100) / 100;

  return {
    p, homeOfficeLimit, homeOfficeOverridden, qbi, taxableBeforeQbi,
    fields: {
      gross_income, total_expenses, home_office_deduction,
      net_profit_loss, adjusted_gross_income, standard_deduction, qbi_deduction, taxable_income,
      federal_tax, self_employment_tax: seTax, additional_medicare_tax, total_tax, balance_due, quarterly_estimated,
    },
  };
}

const US_STATES: SubJurisdiction[] = [
  { code: 'CA', name: 'California' }, { code: 'TX', name: 'Texas' }, { code: 'NY', name: 'New York' },
  { code: 'FL', name: 'Florida' }, { code: 'IL', name: 'Illinois' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'OH', name: 'Ohio' }, { code: 'GA', name: 'Georgia' }, { code: 'NC', name: 'North Carolina' },
  { code: 'MI', name: 'Michigan' }, { code: 'NJ', name: 'New Jersey' }, { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' }, { code: 'AZ', name: 'Arizona' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'TN', name: 'Tennessee' }, { code: 'IN', name: 'Indiana' }, { code: 'MO', name: 'Missouri' },
  { code: 'MD', name: 'Maryland' }, { code: 'WI', name: 'Wisconsin' }, { code: 'CO', name: 'Colorado' },
  { code: 'MN', name: 'Minnesota' }, { code: 'SC', name: 'South Carolina' }, { code: 'AL', name: 'Alabama' },
  { code: 'LA', name: 'Louisiana' }, { code: 'KY', name: 'Kentucky' }, { code: 'OR', name: 'Oregon' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'CT', name: 'Connecticut' }, { code: 'UT', name: 'Utah' },
  { code: 'NV', name: 'Nevada' }, { code: 'IA', name: 'Iowa' }, { code: 'AR', name: 'Arkansas' },
  { code: 'MS', name: 'Mississippi' }, { code: 'KS', name: 'Kansas' }, { code: 'NM', name: 'New Mexico' },
  { code: 'NE', name: 'Nebraska' }, { code: 'ID', name: 'Idaho' }, { code: 'WV', name: 'West Virginia' },
  { code: 'HI', name: 'Hawaii' }, { code: 'NH', name: 'New Hampshire' }, { code: 'ME', name: 'Maine' },
  { code: 'MT', name: 'Montana' }, { code: 'RI', name: 'Rhode Island' }, { code: 'DE', name: 'Delaware' },
  { code: 'SD', name: 'South Dakota' }, { code: 'ND', name: 'North Dakota' }, { code: 'AK', name: 'Alaska' },
  { code: 'VT', name: 'Vermont' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'District of Columbia' },
];

const usItPlugin: TaxFilingPlugin = {
  countryCode: 'US-IT',
  displayName: 'Income Tax — Schedule C (Sole Proprietor)',
  shortName: 'Schedule C',
  authority: {
    name: 'IRS',
    fullName: 'Internal Revenue Service',
    portalUrl: 'https://www.irs.gov',
    helpUrl: 'https://www.irs.gov/forms-pubs/about-schedule-c-form-1040',
  },
  taxFamily: 'INCOME_TAX',
  isFullPlugin: true,

  getFormSchema(): FormSection[] {
    // Help text quotes the same year's parameters calculateFields uses
    // (currentTaxYear(); there is no return-year input to follow instead).
    const p = paramsForYear(currentTaxYear());
    return [
      {
        id: 'business_income',
        title: 'Part I — Income (Schedule C)',
        fields: [
          { id: 'gross_receipts', label: 'Gross receipts or sales', officialLabel: 'Line 1', type: 'currency', editable: true, required: true, autoPopulateFrom: 'income_total', helpText: 'Business income only. Wages from an employer go under Wages (Form W-2).' },
          { id: 'returns_allowances', label: 'Returns and allowances', officialLabel: 'Line 2', type: 'currency', editable: true, required: false },
          { id: 'cost_of_goods_sold', label: 'Cost of goods sold', officialLabel: 'Line 4', type: 'currency', editable: true, required: false, autoPopulateFrom: 'expenses_cogs' },
          { id: 'gross_income', label: 'Gross income', officialLabel: 'Line 7', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'materially_participated', label: 'Did you materially participate in this business?', officialLabel: 'Line G', type: 'boolean', editable: true, required: false, helpText: `Needed for the ${usd(QBI_MINIMUM_DEDUCTION[2026])} minimum qualified business income deduction (2026 onward, with ${usd(QBI_MINIMUM_ACTIVE_QBI)}+ of QBI).` },
        ],
      },
      {
        id: 'expenses',
        title: 'Part II — Expenses (Schedule C)',
        fields: [
          { id: 'advertising', label: 'Advertising', officialLabel: 'Line 8', type: 'currency', editable: true, required: false },
          { id: 'car_truck', label: 'Car and truck expenses', officialLabel: 'Line 9', type: 'currency', editable: true, required: false, helpText: `Standard mileage rate: ${p.mileageHelp}` },
          { id: 'contract_labor', label: 'Contract labor', officialLabel: 'Line 11', type: 'currency', editable: true, required: false },
          { id: 'insurance', label: 'Insurance (other than health)', officialLabel: 'Line 15', type: 'currency', editable: true, required: false },
          { id: 'interest_mortgage', label: 'Interest — mortgage', officialLabel: 'Line 16a', type: 'currency', editable: true, required: false },
          { id: 'interest_other', label: 'Interest — other', officialLabel: 'Line 16b', type: 'currency', editable: true, required: false },
          { id: 'office_expense', label: 'Office expense', officialLabel: 'Line 18', type: 'currency', editable: true, required: false },
          { id: 'rent_lease', label: 'Rent or lease', officialLabel: 'Line 20', type: 'currency', editable: true, required: false },
          { id: 'supplies', label: 'Supplies', officialLabel: 'Line 22', type: 'currency', editable: true, required: false },
          { id: 'utilities', label: 'Utilities', officialLabel: 'Line 25', type: 'currency', editable: true, required: false },
          { id: 'other_expenses', label: 'Other expenses', officialLabel: 'Line 27', type: 'currency', editable: true, required: false },
          { id: 'total_expenses', label: 'Total expenses', officialLabel: 'Line 28', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'net_profit_loss', label: 'Net profit or (loss)', officialLabel: 'Line 31', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'home_office',
        title: 'Home Office Deduction (Form 8829)',
        collapsed: true,
        fields: [
          { id: 'home_office_sqft', label: 'Home office square footage', type: 'integer', editable: true, required: false, helpText: 'Simplified method: $5/sqft, max 300 sqft = $1,500, but no more than the business\'s profit before it (Schedule C line 29). The excess is not carried over.' },
          { id: 'home_office_deduction', label: 'Home office deduction', officialLabel: 'Line 30', type: 'currency', calculated: true, editable: true, required: false },
        ],
      },
      {
        id: 'employment_income',
        title: 'Wages (Form W-2)',
        fields: [
          { id: 'wages', label: 'Wages, salaries, tips (W-2 box 1)', officialLabel: 'Form 1040, line 1a', type: 'currency', editable: true, required: false, helpText: 'Taxed as ordinary income. No self-employment tax.' },
          { id: 'wages_ss', label: 'Social Security wages and tips (W-2 boxes 3 + 7)', officialLabel: 'Schedule SE, line 8a', type: 'currency', editable: true, required: false, helpText: `Blank = box 1. Uses up the ${usd(p.ssWageBase)} (${p.year}) Social Security wage base before self-employment earnings do.` },
          { id: 'wages_medicare', label: 'Medicare wages and tips (W-2 box 5)', officialLabel: 'Form 8959, line 1', type: 'currency', editable: true, required: false, helpText: `Blank = box 1. Counts toward the ${usd(ADDITIONAL_MEDICARE_THRESHOLD_SINGLE)} Additional Medicare Tax threshold.` },
        ],
      },
      {
        id: 'tax_calc',
        title: 'Tax Computation',
        fields: [
          { id: 'adjusted_gross_income', label: 'Adjusted Gross Income (AGI)', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'standard_deduction', label: 'Standard deduction', type: 'currency', calculated: true, editable: false, required: true, helpText: `${usd(p.stdDeduction)} single (${p.year}). This form uses the single filing status.` },
          {
            id: 'qbi_deduction', label: 'Qualified business income deduction', officialLabel: 'Form 8995', type: 'currency', calculated: true, editable: false, required: false,
            helpText: `20% of net profit less the deductible half of SE tax, capped at 20% of taxable income before this deduction. Above ${usd(p.qbiThreshold)} of taxable income (${p.year}) ` +
              'it depends on W-2 wages paid, qualified property and specified-service status, which this form doesn\'t collect, so the lowest amount the law allows is used. ' +
              'Not modelled: self-employed health insurance, retirement contributions, capital gains, QBI loss carryforwards.',
          },
          { id: 'taxable_income', label: 'Taxable income', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'federal_tax', label: 'Federal income tax', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'self_employment_tax', label: 'Self-employment tax (15.3%)', officialLabel: 'Schedule SE, line 12', type: 'currency', calculated: true, editable: false, required: true, helpText: `On 92.35% of net profit: 12.4% Social Security on up to ${usd(p.ssWageBase)} (${p.year}) less your Social Security wages, plus 2.9% Medicare. None if that 92.35% is under ${usd(SE_TAX_FLOOR)}.` },
          { id: 'additional_medicare_tax', label: 'Additional Medicare Tax (0.9%)', officialLabel: 'Form 8959', type: 'currency', calculated: true, editable: false, required: false, helpText: `0.9% of Medicare wages plus SE earnings over ${usd(ADDITIONAL_MEDICARE_THRESHOLD_SINGLE)} (single). Separate from SE tax and not part of its deductible half. Any your employer withheld counts as federal withholding.` },
          { id: 'total_tax', label: 'Total federal tax liability', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'payments',
        title: 'Payments & Estimated Tax',
        fields: [
          { id: 'estimated_payments', label: 'Estimated tax payments made', type: 'currency', editable: true, required: false },
          { id: 'withholding', label: 'Federal income tax withheld (W-2)', type: 'currency', editable: true, required: false },
          { id: 'balance_due', label: 'Balance due / overpayment', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'quarterly_estimated', label: 'Suggested quarterly estimated payment', type: 'currency', calculated: true, editable: false, required: false, helpText: '(Total tax − withholding) ÷ 4. Nil when less than $1,000 would be owed after withholding — estimated payments are generally not required then (Form 1040-ES).' },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({ monthly: false, quarterly: true, annual: true, defaultFrequency: 'annual' }),
  getFinancialYearBounds: (y) => ({ start: new Date(y, 0, 1), end: new Date(y, 11, 31) }),

  getTerminology: () => ({
    taxName: 'Income Tax', taxAbbrev: 'IT',
    salesLabel: 'Gross receipts', purchasesLabel: 'Business expenses',
    outputTaxLabel: 'Tax liability', inputTaxLabel: 'Tax payments',
  }),

  calculateFields(v: FieldValues): CalculatedFields {
    // home_office_deduction is editable: the user's override is returned (and
    // drives net profit), never the pre-override simplified-method figure.
    return computeReturn(v).fields;
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'gross_receipts', aggregateKey: 'income_total' },
    { fieldId: 'cost_of_goods_sold', aggregateKey: 'expenses_cogs' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    if (Number(v.gross_receipts) < 0) r.push({ fieldId: 'gross_receipts', message: 'Gross receipts cannot be negative', severity: 'error' });
    const c = computeReturn(v);
    if (c.homeOfficeOverridden && c.fields.home_office_deduction > c.homeOfficeLimit) {
      r.push({
        fieldId: 'home_office_deduction',
        message: `The home office deduction can't exceed the business's profit before it (${usd(round2(c.homeOfficeLimit))}, Schedule C line 29). ` +
          'Under the simplified method the excess is lost; under the regular method (Form 8829) it carries forward to next year.',
        severity: 'warning',
      });
    }
    if (c.qbi > 0 && c.taxableBeforeQbi > c.p.qbiThreshold) {
      r.push({
        fieldId: 'qbi_deduction',
        message: `Taxable income before the qualified business income deduction is over ${usd(c.p.qbiThreshold)} (${c.p.year}), so the deduction ` +
          'may be limited by the W-2 wages your business pays, its qualified property, and whether it is a specified service business. ' +
          'This form doesn\'t collect those, so it uses the lowest amount the law allows; yours may be higher — figure it on Form 8995-A.',
        severity: 'warning',
      });
    }
    return r;
  },
  getFieldHelp: () => null,

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v: FieldValues, format: string): Promise<ExportOutput> {
    if (format === 'csv') return toCsv(v, `ScheduleC-US-${new Date().toISOString().slice(0, 10)}`);
    return {
      data: JSON.stringify(v, null, 2),
      filename: `ScheduleC-US-${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/json',
    };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://www.irs.gov/filing/e-file-options', submissionMethod: 'manual_upload' as const, apiReady: false }),
  hasSubJurisdictions: () => true,
  getSubJurisdictions: () => US_STATES,
  supportsCustomFields: () => false,
};

export default usItPlugin;
