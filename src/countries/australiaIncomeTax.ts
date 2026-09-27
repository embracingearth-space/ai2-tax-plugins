/**
 * Australia Individual Tax Return (ITR) - ai2fin.com
 * Australian Taxation Office (ATO)
 * Reference: https://www.ato.gov.au/individuals-and-families/your-tax-return
 * ARCHITECTURE: Compound-key plugin 'AU-IT' alongside 'AU' (BAS).
 *   Brackets: 0% ($0-$18,200), then $18,201-$45,000 / 30% ($45,001-$135,000) /
 *   37% ($135,001-$190,000) / 45% ($190,001+). Medicare levy: 2%.
 *   First-bracket rate is FY-dependent (legislated cuts): 16% to FY2025-26,
 *   15% from FY2026-27 (1 Jul 2026), 14% from FY2027-28 (1 Jul 2027).
 *   FY: Jul 1 - Jun 30. Annual filing by Oct 31 (self) or May (via agent).
 */

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
} from '../types';
import { getStudentLoanRepayment } from '../data/studentLoan';
import { toCsv } from '../exportUtils';
import {
  AU_CENTS_PER_KM_MAX_BUSINESS_KM,
  AU_WFH_REVISED_METHOD_FROM,
  auIncomeYear,
  centsPerKmRate,
  workFromHomeFixedRate,
  type AuDeductionRate,
  type AuIncomeYearInput,
} from './australiaDeductions';

const TAX_FREE = 18200;

// FY starts 1 July: months Jul-Dec belong to the FY starting that year.
// Exported so tests assert against this ground truth rather than re-deriving
// the same FY/rate-selection logic inline (which would make an assertion
// tautological — always passing because it mirrors the code under test).
export function currentFyStartYear(now = new Date()): number {
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

// Legislated first-bracket cuts: 16% to FY2025-26, 15% FY2026-27, 14% FY2027-28+.
export function firstBracketRate(fyStartYear: number): number {
  if (fyStartYear >= 2027) return 0.14;
  if (fyStartYear === 2026) return 0.15;
  return 0.16;
}

export function calcAuTax(taxable: number, fyStartYear = currentFyStartYear()): number {
  if (taxable <= TAX_FREE) return 0;
  let tax = 0;
  if (taxable > TAX_FREE) tax += Math.min(taxable - TAX_FREE, 45000 - TAX_FREE) * firstBracketRate(fyStartYear);
  if (taxable > 45000) tax += Math.min(taxable - 45000, 135000 - 45000) * 0.30;
  if (taxable > 135000) tax += Math.min(taxable - 135000, 190000 - 135000) * 0.37;
  if (taxable > 190000) tax += (taxable - 190000) * 0.45;
  return Math.round(tax);
}

// ─── Year-specific help text ────────────────────────────────────────────────
//
// The fixed rate and the cents-per-km rate change by income year, so the help
// text is BUILT from the effective-dated rows in ./australiaDeductions for the
// return's income year — never typed in. A hard-coded "67c/hour" went stale
// the day the ATO moved to 70c, and nothing failed. A year with no published
// rate says so and names the last published one without applying it.

/**
 * "no rate is published for 2026-27 yet (last published: 70c per work hour, for
 * 2025-26 — it does not carry over)." A year before the recorded rows has no
 * last-published rate and says it is not recorded instead.
 */
function unpublished(r: AuDeductionRate, unit: string): string {
  if (!r.lastPublished) return `the rate for ${r.incomeYear} is not recorded here — check it with the ATO.`;
  const last = `${Math.round(r.lastPublished.rate * 100)}c ${unit}, for ${r.lastPublished.incomeYear}`;
  return `no rate is published for ${r.incomeYear} yet (last published: ${last} — it does not carry over).`;
}

/** The work-from-home help text for an income year, built from AU_WFH_FIXED_RATE_ROWS. */
export function auWorkFromHomeHelpText(incomeYear: AuIncomeYearInput): string {
  const r = workFromHomeFixedRate(incomeYear);
  if (r.verified && r.rate !== null) {
    const covers =
      auIncomeYear(r.incomeYear).startYmd >= AU_WFH_REVISED_METHOD_FROM
        ? '(covers energy, internet, phone, stationery and computer consumables; claim depreciation of equipment and furniture separately)'
        : '(the earlier fixed rate method — check what it covers with the ATO)';
    return `Fixed rate: ${Math.round(r.rate * 100)}c per work hour for ${r.incomeYear} ${covers}. Or actual cost method.`;
  }
  return `Fixed rate: ${unpublished(r, 'per work hour')} Or actual cost method.`;
}

/** The car-expenses help text for an income year, built from AU_CENTS_PER_KM_ROWS. */
export function auCarExpensesHelpText(incomeYear: AuIncomeYearInput): string {
  const r = centsPerKmRate(incomeYear);
  // Grouped by hand, not toLocaleString: the output must not depend on the host's ICU build.
  const km = String(AU_CENTS_PER_KM_MAX_BUSINESS_KM).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cap = `max ${km} business km per car`;
  if (r.verified && r.rate !== null) {
    return `Cents per km (${Math.round(r.rate * 100)}c/km ${r.incomeYear}, ${cap}) or logbook`;
  }
  return `Cents per km: ${unpublished(r, 'per km')} ${cap[0].toUpperCase()}${cap.slice(1)}. Or logbook.`;
}

// ─── Capital gains: the discount has an end date ────────────────────────────
//
// The 50% CGT discount does NOT run on indefinitely. The Treasury Laws
// Amendment (Tax Reform No. 1) Act 2026 (No. 49, assented 26 June 2026) is
// law — the ATO: "These measures are now law" (page last updated 29 June
// 2026, read 27 September 2026). For CGT events from 1 July 2027 the discount
// applies only to the gain that accrued to 30 June 2027; the gain after it is
// worked out on a cost base indexed for inflation, with a 30% minimum tax
// (Division 119 ITAA 1997). Help text that says "50% discount if held 12
// months" with no date would be wrong for every 2027-28 return.

/** The first day CGT events fall under the indexation and minimum-tax rules. */
export const AU_CGT_INDEXATION_FROM = '2027-07-01';

export const AU_CGT_AUTHORITY_URLS = {
  cgtDiscount: 'https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/cgt-discount',
  taxReform2027:
    'https://www.ato.gov.au/about-ato/new-legislation/in-detail/individuals/tax-reform-boosting-home-ownership-reforming-negative-gearing-and-capital-gains-tax',
  taxReformAct: 'https://www.legislation.gov.au/C2026A00049/latest',
} as const;

/** The capital-gains help text for an income year. */
export function auCapitalGainsHelpText(incomeYear: AuIncomeYearInput): string {
  const year = auIncomeYear(incomeYear);
  if (year.startYmd < AU_CGT_INDEXATION_FROM) {
    // "you owned the asset for at least 12 months ... You exclude the day of acquisition and the day of the CGT event"
    return (
      `After applying the 50% CGT discount to gains on assets you owned for at least 12 months (not counting the day ` +
      `you acquired it or the day of the sale contract). ${year.label} is before the 1 July 2027 changes.`
    );
  }
  // Qualified, as the Act is (read 27 September 2026):
  // - a new residential dwelling (s 115-102) or affordable housing (s 115-125) keeps a discount of at least 50%
  //   (s 115-1, s 115-100(a));
  // - those gains are outside the minimum tax (s 119-5(2)(b)-(c)), and so is anyone who received a listed
  //   support payment in the year, such as the age pension (s 119-15).
  return (
    `For CGT events from 1 July 2027 the 50% discount generally applies only to the gain up to 30 June 2027, and ` +
    `the gain after it is worked out on a cost base indexed for inflation (Treasury Laws Amendment (Tax Reform No. 1) ` +
    `Act 2026). A qualifying new residential dwelling or affordable housing can still get a discount of at least 50%. ` +
    `A 30% minimum tax may apply to the later gain, except on those assets or if you received certain support ` +
    `payments such as the age pension. This return does not calculate the minimum tax.`
  );
}

const auItPlugin: TaxFilingPlugin = {
  countryCode: 'AU-IT',
  displayName: 'Individual Tax Return (ITR)',
  shortName: 'ITR',
  authority: {
    name: 'ATO',
    fullName: 'Australian Taxation Office',
    portalUrl: 'https://www.ato.gov.au',
    helpUrl: 'https://www.ato.gov.au/individuals-and-families/your-tax-return',
  },
  taxFamily: 'INCOME_TAX',
  isFullPlugin: true,

  /**
   * `opts.incomeYear` is the return's income year ('2025-26', or a day in it).
   * Omitted, it is the income year of today — the same default calcAuTax uses.
   */
  getFormSchema(opts?: { incomeYear?: string | Date }): FormSection[] {
    const year = auIncomeYear(opts?.incomeYear ?? new Date()).label;
    return [
      {
        id: 'income',
        title: 'Income',
        fields: [
          { id: 'salary_wages', label: 'Salary and wages', type: 'currency', editable: true, required: false, helpText: 'As per payment summary / income statement from employer' },
          { id: 'business_income', label: 'Business income (sole trader)', type: 'currency', editable: true, required: false, autoPopulateFrom: 'income_business', helpText: 'Net profit from your sole trader business' },
          { id: 'interest', label: 'Interest income', type: 'currency', editable: true, required: false },
          { id: 'dividends', label: 'Dividends (unfranked)', type: 'currency', editable: true, required: false },
          { id: 'franked_dividends', label: 'Franked dividends (grossed up)', type: 'currency', editable: true, required: false, helpText: 'Include franking credits as income' },
          { id: 'franking_credits', label: 'Franking credits', type: 'currency', editable: true, required: false },
          { id: 'rental_income', label: 'Net rental income', type: 'currency', editable: true, required: false },
          { id: 'capital_gains', label: 'Net capital gains', type: 'currency', editable: true, required: false, helpText: auCapitalGainsHelpText(year) },
          { id: 'other_income', label: 'Other income', type: 'currency', editable: true, required: false },
          { id: 'reportable_super', label: 'Reportable super contributions', type: 'currency', editable: true, required: false, helpText: 'Salary-sacrifice + personal deductible super. Not assessable income, but counts toward study/training loan repayment income.' },
          { id: 'reportable_fringe_benefits', label: 'Reportable fringe benefits', type: 'currency', editable: true, required: false, helpText: 'From your payment summary/income statement. Not assessable income, but counts toward study/training loan repayment income.' },
          { id: 'exempt_foreign_income', label: 'Exempt foreign employment income', type: 'currency', editable: true, required: false, helpText: 'Foreign income exempt from Australian tax. Not assessable income, but counts toward study/training loan repayment income.' },
          { id: 'total_income', label: 'Total assessable income', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'deductions',
        title: 'Deductions',
        fields: [
          { id: 'work_related_car', label: 'Work-related car expenses', type: 'currency', editable: true, required: false, helpText: auCarExpensesHelpText(year) },
          { id: 'work_related_travel', label: 'Work-related travel expenses', type: 'currency', editable: true, required: false },
          { id: 'work_related_clothing', label: 'Clothing, laundry, dry-cleaning', type: 'currency', editable: true, required: false },
          { id: 'work_from_home', label: 'Working from home expenses', type: 'currency', editable: true, required: false, helpText: auWorkFromHomeHelpText(year) },
          { id: 'self_education', label: 'Self-education expenses', type: 'currency', editable: true, required: false },
          { id: 'donations', label: 'Gifts and donations', type: 'currency', editable: true, required: false },
          { id: 'tax_agent_fee', label: 'Cost of managing tax affairs', type: 'currency', editable: true, required: false },
          { id: 'income_protection', label: 'Income protection insurance', type: 'currency', editable: true, required: false },
          { id: 'other_deductions', label: 'Other deductions', type: 'currency', editable: true, required: false },
          { id: 'total_deductions', label: 'Total deductions', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'tax_calc',
        title: 'Tax Calculation',
        fields: [
          { id: 'taxable_income', label: 'Taxable income', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'income_tax', label: 'Tax on taxable income', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'medicare_levy', label: 'Medicare levy (2%)', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'medicare_surcharge', label: 'Medicare levy surcharge', type: 'currency', editable: true, required: false, helpText: '1-1.5% if no private health insurance and income >$101,000 single (2025-26)' },
          { id: 'lito', label: 'Low Income Tax Offset (LITO)', type: 'currency', calculated: true, editable: false, required: false, helpText: 'Up to $700 for income ≤$45,000' },
          { id: 'franking_credit_offset', label: 'Franking credit tax offset', type: 'currency', calculated: true, editable: false, required: false },
          { id: 'has_study_loan', label: 'Has HELP / study or training loan', type: 'boolean', editable: true, required: false, helpText: 'Tick to include the compulsory annual repayment (HELP, VSL, SFSS, SSL, AASL).' },
          { id: 'study_loan_repayment', label: 'Compulsory study/training loan repayment', type: 'currency', calculated: true, editable: false, required: false, helpText: 'Marginal rates on repayment income above the ATO minimum threshold for the current year. Added to the amount payable, separate from income tax.' },
          { id: 'total_tax', label: 'Total tax liability', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'payments',
        title: 'Tax Withheld & Refund',
        fields: [
          { id: 'tax_withheld', label: 'Tax withheld (PAYG from employer)', type: 'currency', editable: true, required: false },
          { id: 'payg_instalments', label: 'PAYG instalments paid', type: 'currency', editable: true, required: false },
          { id: 'balance_due', label: 'Tax payable / refund', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({ monthly: false, quarterly: false, annual: true, defaultFrequency: 'annual' }),
  getFinancialYearBounds: (y) => ({ start: new Date(y, 6, 1), end: new Date(y + 1, 5, 30) }),

  getTerminology: () => ({
    taxName: 'Income Tax', taxAbbrev: 'IT',
    salesLabel: 'Income', purchasesLabel: 'Deductions',
    outputTaxLabel: 'Tax liability', inputTaxLabel: 'Tax withheld',
  }),

  calculateFields(v: FieldValues): CalculatedFields {
    const salary = Number(v.salary_wages) || 0;
    const business = Number(v.business_income) || 0;
    const interest = Number(v.interest) || 0;
    const dividends = Number(v.dividends) || 0;
    const frankedDiv = Number(v.franked_dividends) || 0;
    const frankingCredits = Number(v.franking_credits) || 0;
    const rental = Number(v.rental_income) || 0;
    const capGains = Number(v.capital_gains) || 0;
    const otherInc = Number(v.other_income) || 0;
    const total_income = salary + business + interest + dividends + frankedDiv + frankingCredits + rental + capGains + otherInc;

    const dedFields = ['work_related_car', 'work_related_travel', 'work_related_clothing', 'work_from_home',
      'self_education', 'donations', 'tax_agent_fee', 'income_protection', 'other_deductions'];
    const total_deductions = dedFields.reduce((s, f) => s + (Number(v[f]) || 0), 0);

    const taxable_income = Math.max(0, total_income - total_deductions);
    const income_tax = calcAuTax(taxable_income);
    const medicare_levy = Math.round(taxable_income * 0.02);
    const medicareSurcharge = Number(v.medicare_surcharge) || 0;

    // LITO: $700 if ≤$45,000, phases out $45,001-$66,667
    let lito = 0;
    if (taxable_income <= 45000) lito = 700;
    else if (taxable_income <= 66667) lito = Math.round(700 - (taxable_income - 45000) * 0.0323);
    lito = Math.max(0, lito);

    const franking_credit_offset = frankingCredits;
    const total_tax = Math.max(0, income_tax + medicare_levy + medicareSurcharge - lito - franking_credit_offset);

    // Compulsory study/training loan (HELP) repayment. Repayment income is a
    // BROADER base than taxable income — per the ATO it adds back: reportable
    // super contributions, reportable fringe benefits, total net investment
    // loss (incl. net rental losses), and exempt foreign income. Negative
    // gearing (a rental LOSS) already reduced taxable_income above, so the
    // loss amount is added back here — otherwise negative gearing would
    // silently reduce a HELP obligation the ATO rule exists to prevent.
    // Levied ALONGSIDE income tax on the notice of assessment, so it's
    // tracked separately and added into the bottom-line balance due, not
    // folded into total_tax. Rates come from the effective-dated ledger in
    // data/studentLoan.ts (marginal system from 2025-26). embracingearth.space
    const reportableSuper = Number(v.reportable_super) || 0;
    const reportableFringeBenefits = Number(v.reportable_fringe_benefits) || 0;
    const exemptForeignIncome = Number(v.exempt_foreign_income) || 0;
    const netInvestmentLoss = Math.max(0, -rental); // rental < 0 → a loss to add back
    const hasStudyLoan = v.has_study_loan === true || v.has_study_loan === 'true';
    const repaymentIncome =
      taxable_income + reportableSuper + reportableFringeBenefits + netInvestmentLoss + exemptForeignIncome;
    const study_loan_repayment = hasStudyLoan
      ? Math.round(getStudentLoanRepayment('AU', { repaymentIncome })?.repayment ?? 0)
      : 0;

    const withheld = Number(v.tax_withheld) || 0;
    const instalments = Number(v.payg_instalments) || 0;
    const balance_due = total_tax + study_loan_repayment - withheld - instalments;

    return { total_income, total_deductions, taxable_income, income_tax, medicare_levy, lito, franking_credit_offset, study_loan_repayment, total_tax, balance_due };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'business_income', aggregateKey: 'income_business' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 0, wholeOnly: true }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    const fc = Number(v.franking_credits) || 0;
    const fd = Number(v.franked_dividends) || 0;
    if (fc > 0 && fd === 0) r.push({ fieldId: 'franked_dividends', message: 'Franking credits entered but no franked dividends — verify', severity: 'warning' });
    return r;
  },
  getFieldHelp: () => null,

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v: FieldValues, format: string): Promise<ExportOutput> {
    if (format === 'csv') return toCsv(v, `ITR-AU-${new Date().toISOString().slice(0, 10)}`);
    return {
      data: JSON.stringify(v, null, 2),
      filename: `ITR-AU-${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/json',
    };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://my.gov.au', submissionMethod: 'manual_upload' as const, apiReady: false }),
  hasSubJurisdictions: () => true,
  getSubJurisdictions: () => [
    { code: 'NSW', name: 'New South Wales' }, { code: 'VIC', name: 'Victoria' }, { code: 'QLD', name: 'Queensland' },
    { code: 'SA', name: 'South Australia' }, { code: 'WA', name: 'Western Australia' }, { code: 'TAS', name: 'Tasmania' },
    { code: 'NT', name: 'Northern Territory' }, { code: 'ACT', name: 'Australian Capital Territory' },
  ],
  supportsCustomFields: () => false,
};

export default auItPlugin;
