/**
 * Australia Individual Tax Return (ITR) - ai2fin.com
 * Australian Taxation Office (ATO)
 * Reference: https://www.ato.gov.au/individuals-and-families/your-tax-return
 * ARCHITECTURE: Compound-key plugin 'AU-IT' alongside 'AU' (BAS).
 *   Brackets: 0% ($0-$18,200), then $18,201-$45,000 / 30% ($45,001-$135,000) /
 *   37% ($135,001-$190,000) / 45% ($190,001+). Medicare levy: 2%, reduced for
 *   low incomes in the years whose thresholds are recorded below.
 *   First-bracket rate is FY-dependent (legislated cuts): 16% to FY2025-26,
 *   15% from FY2026-27 (1 Jul 2026), 14% from FY2027-28 (1 Jul 2027).
 *   The year is the return's (`income_year`), not today's, when it is given.
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
  type AuIncomeYear,
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

// ─── The return's income year ───────────────────────────────────────────────
//
// getFormSchema() is told the return's year, but calculateFields() only sees
// field values, so the year travels as the `income_year` field. Without it the
// form fell back to today's year: a 2025-26 return done after 1 July 2026 got
// the 15% first bracket instead of 16%. Blank still means today's year. An
// unreadable value also falls back, so the form still calculates, and
// validateForm reports it as an error.

/** The first year this return models: the brackets above start in 2024-25. */
const AU_IT_FIRST_MODELLED_YEAR = 2024;

function returnIncomeYear(v: FieldValues): { year: AuIncomeYear; unreadable?: string } {
  const raw = v.income_year;
  const today = auIncomeYear(new Date());
  if (raw === undefined || raw === null || raw === '') return { year: today };
  try {
    return { year: auIncomeYear(String(raw)) };
  } catch {
    return { year: today, unreadable: String(raw) };
  }
}

// Grouped by hand, not toLocaleString: the output must not depend on the host's ICU build.
const grouped = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ─── Offsets and the Medicare levy ──────────────────────────────────────────
//
// Twin of the AU scheme in src/data/incomeTax.ts (the world take-home engine):
// same LITO schedule, same year-keyed Medicare low-income table. That file is a
// separate estimator and is deliberately not imported here; change both.
//
// ONE DIFFERENCE, ON PURPOSE: the world engine lets LITO spill over onto the
// Medicare levy. The ATO says otherwise (myTax 2026 Tax estimate, read via
// search 2026-10-11): non-refundable offsets such as LITO reduce only the tax on
// taxable income, and "Any excess offset is not refundable and not offset
// against other liabilities" (the foreign income tax offset is the exception).
// So LITO and the small business offset reduce income tax to nil and stop; the
// levy is added after. Franking credits are refundable — the ATO refunds what
// is left once tax and the Medicare levy are met — so they come off last and
// can take the total below nil.

/**
 * LITO (ATO low income tax offset page): $700 up to $37,500; less 5c per $1 to
 * $45,000 (→ $325); less 1.5c per $1 to $66,667 (→ $0). Not indexed.
 */
function auLowIncomeTaxOffset(taxable: number): number {
  let lito = 0;
  if (taxable <= 37500) lito = 700;
  else if (taxable <= 45000) lito = Math.round(700 - (taxable - 37500) * 0.05);
  else if (taxable <= 66667) lito = Math.round(325 - (taxable - 45000) * 0.015);
  return Math.max(0, lito);
}

/**
 * Medicare levy low-income thresholds (single, not entitled to SAPTO), keyed by
 * income year. Medicare Levy Act 1986 s 7: nil up to the lower threshold, then
 * the levy "shall not exceed 10% of the amount of the excess" until the full 2%
 * takes over at the upper threshold. Indexed annually, so a year with no entry
 * keeps the flat 2% — borrowing another year's thresholds would invent a figure.
 * 2025-26 and 2026-27 are the world engine's rows (2026-27 carried forward per
 * the Act until amended). 2024-25 ($27,222 / $34,027) is from the ATO's M1
 * Medicare levy reduction or exemption 2025 instructions, read 2026-10-11; the
 * world engine's table does not have it yet. Family and SAPTO thresholds are
 * not modelled.
 */
const AU_IT_MEDICARE_LOW_INCOME: Record<string, { lower: number; upper: number }> = {
  '2026-27': { lower: 28011, upper: 35013 },
  '2025-26': { lower: 28011, upper: 35013 },
  '2024-25': { lower: 27222, upper: 34027 },
};

function auMedicareLevy(taxable: number, incomeYearLabel: string): number {
  const full = taxable * 0.02;
  const band = AU_IT_MEDICARE_LOW_INCOME[incomeYearLabel];
  if (!band) return Math.round(full);
  if (taxable <= band.lower) return 0;
  // Capped at the ordinary 2%: the ATO rounds the thresholds independently, so
  // the two lines cross a few cents before the upper threshold.
  return Math.round(Math.min(full, (taxable - band.lower) * 0.10));
}

function auMedicareHelpText(incomeYearLabel: string): string {
  const band = AU_IT_MEDICARE_LOW_INCOME[incomeYearLabel];
  if (!band) {
    return (
      `2% of taxable income. The low-income thresholds for ${incomeYearLabel} are not recorded here, so the flat 2% ` +
      `is used — on a low income the ATO may charge less. Offsets such as LITO do not reduce it.`
    );
  }
  return (
    `2% of taxable income. For ${incomeYearLabel} it is nil up to $${grouped(band.lower)}, then 10c per $1 above ` +
    `that until the full 2% applies (by $${grouped(band.upper)}). Single thresholds without the seniors and ` +
    `pensioners offset; family thresholds are not applied. Offsets such as LITO do not reduce it.`
  );
}

/**
 * Small business income tax offset (ATO SBITO page): 16% of the income tax on
 * net small business income, capped at $1,000, for aggregated turnover under
 * $5 million. The share of tax is basic income tax liability × net small
 * business income ÷ taxable income, and is the whole liability when that
 * income is at least the taxable income. A business loss counts as nil.
 */
function auSmallBusinessOffset(incomeTax: number, netSmallBusinessIncome: number, taxable: number): number {
  if (!(netSmallBusinessIncome > 0) || !(taxable > 0) || !(incomeTax > 0)) return 0;
  const share = Math.min(1, netSmallBusinessIncome / taxable);
  return Math.round(Math.min(1000, incomeTax * share * 0.16));
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
  const cap = `max ${grouped(AU_CENTS_PER_KM_MAX_BUSINESS_KM)} business km per car`;
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

/**
 * Provenance for the CGT rules above, as data rather than a comment, so
 * coverage() can report it. Re-read 2026-10-06: the ATO CGT discount page
 * (last updated 29 June 2026) — "you can reduce your capital gain by 50%" if
 * owned at least 12 months and an Australian resident — and the ATO reform page
 * ("These measures are now law ... apply from 1 July 2027"). What is covered is
 * the RULE (help text on the AU-IT return); the return takes net capital gains
 * as an input and does not calculate them or the 30% minimum tax.
 */
export const AU_CGT_PROVENANCE = {
  sourceUrl: AU_CGT_AUTHORITY_URLS.cgtDiscount,
  citationDate: '2026-10-06',
  verified: true,
  scope: 'The 50% CGT discount and its replacement by cost-base indexation from 1 July 2027, as AU-IT return guidance. Net capital gains are an input; the gain and the 30% minimum tax are not calculated.',
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
  //   support payment in the year, such as the age pension (s 119-15);
  // - indexation is conditional too: s 110-36(1A) requires Division 114 — the asset acquired at least 12 months
  //   before the CGT event (s 114-10(1)) — and does not extend to foreign or temporary residents (s 114-25).
  return (
    `For CGT events from 1 July 2027 the 50% discount generally applies only to the gain up to 30 June 2027. For the ` +
    `gain after it, the cost base may be indexed for inflation if you are an Australian resident and held the asset ` +
    `for at least 12 months (Treasury Laws Amendment (Tax Reform No. 1) Act 2026). A qualifying new residential dwelling or affordable housing can still get a discount of at least 50%. ` +
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
    const schemaYear = auIncomeYear(opts?.incomeYear ?? new Date());
    const year = schemaYear.label;
    const today = auIncomeYear(new Date());
    const lastOption = Math.max(2027, schemaYear.startYear, today.startYear);
    const yearOptions: { value: string; label: string }[] = [];
    for (let y = AU_IT_FIRST_MODELLED_YEAR; y <= lastOption; y++) {
      const label = auIncomeYear(`${y}-07-01`).label;
      yearOptions.push({ value: label, label });
    }
    return [
      {
        id: 'income',
        title: 'Income',
        fields: [
          { id: 'income_year', label: 'Income year', type: 'select', editable: true, required: false, selectOptions: yearOptions, helpText: `The income year this return is for. It sets the tax rates, LITO and Medicare levy thresholds. Left blank, the current income year (${today.label}) is used.` },
          { id: 'salary_wages', label: 'Salary and wages', type: 'currency', editable: true, required: false, helpText: 'As per payment summary / income statement from employer' },
          { id: 'business_income', label: 'Business income (sole trader)', type: 'currency', editable: true, required: false, autoPopulateFrom: 'income_business', helpText: 'Net profit from your sole trader business' },
          { id: 'small_business_turnover_under_5m', label: 'Business aggregated turnover under $5 million', type: 'boolean', editable: true, required: false, helpText: 'Needed for the small business income tax offset. Assumed yes when you have business income — untick it if your aggregated turnover is $5 million or more.' },
          { id: 'interest', label: 'Interest income', type: 'currency', editable: true, required: false },
          { id: 'dividends', label: 'Dividends (unfranked)', type: 'currency', editable: true, required: false },
          // ONE convention, matching the myTax labels: the cash "Franked amount"
          // here, the "Franking credit" in its own field. calculateFields adds
          // both to income (the gross-up). The old label asked for the grossed-up
          // figure while the code also added the credit, counting it twice.
          { id: 'franked_dividends', label: 'Franked dividends (franked amount)', type: 'currency', editable: true, required: false, helpText: 'The franked amount you received (myTax "Franked amount"), NOT grossed up. Enter the franking credit in its own field; it is added to your income for you.' },
          { id: 'franking_credits', label: 'Franking credits', type: 'currency', editable: true, required: false, helpText: 'The franking credit on those dividends (myTax "Franking credit"). Added to your income, then claimed back as a refundable tax offset.' },
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
          { id: 'medicare_levy', label: 'Medicare levy', type: 'currency', calculated: true, editable: false, required: true, helpText: auMedicareHelpText(year) },
          { id: 'medicare_surcharge', label: 'Medicare levy surcharge', type: 'currency', editable: true, required: false, helpText: '1-1.5% if no private health insurance and income >$101,000 single (2025-26)' },
          { id: 'lito', label: 'Low Income Tax Offset (LITO)', type: 'currency', calculated: true, editable: false, required: false, helpText: 'Up to $700: the full amount to $37,500, less 5c per $1 to $45,000 ($325), then 1.5c per $1 until nil at $66,667. Reduces income tax only, never below nil — not the Medicare levy.' },
          { id: 'small_business_offset', label: 'Small business income tax offset', type: 'currency', calculated: true, editable: false, required: false, helpText: '16% of the income tax on your net small business income (that income ÷ taxable income × tax on taxable income), up to $1,000. Needs aggregated turnover under $5 million. Reduces income tax only, never below nil.' },
          { id: 'franking_credit_offset', label: 'Franking credit tax offset', type: 'currency', calculated: true, editable: false, required: false, helpText: 'Refundable: whatever is left after your tax and Medicare levy is refunded.' },
          { id: 'has_study_loan', label: 'Has HELP / study or training loan', type: 'boolean', editable: true, required: false, helpText: 'Tick to include the compulsory annual repayment (HELP, VSL, SFSS, SSL, AASL).' },
          { id: 'study_loan_repayment', label: 'Compulsory study/training loan repayment', type: 'currency', calculated: true, editable: false, required: false, helpText: 'Marginal rates on repayment income above the ATO minimum threshold for the income year. Added to the amount payable, separate from income tax.' },
          { id: 'total_tax', label: 'Total tax liability', type: 'currency', calculated: true, editable: false, required: true, helpText: 'Income tax less LITO and the small business offset (not below nil), plus the Medicare levy and surcharge, less franking credits — never below nil. Franking credits beyond that are refunded (see the franking credit refund).' },
          { id: 'franking_credit_refund', label: 'Franking credit refund', type: 'currency', calculated: true, editable: false, required: false, helpText: 'Franking credits left after your tax and Medicare levy are covered. Refunded, and taken off the balance due.' },
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

    // Bands, LITO, Medicare thresholds and the study-loan scheme are all read
    // against the RETURN's year, never a mix of it and today's.
    const { year } = returnIncomeYear(v);
    const taxable_income = Math.max(0, total_income - total_deductions);
    const income_tax = calcAuTax(taxable_income, year.startYear);
    const medicare_levy = auMedicareLevy(taxable_income, year.label);
    const medicareSurcharge = Number(v.medicare_surcharge) || 0;

    const lito = auLowIncomeTaxOffset(taxable_income);

    // Small business income tax offset. Net small business income is the net
    // business profit: the deductions on this form (work-related, donations,
    // tax agent fees) are not business deductions and do not reduce it. The
    // turnover test is assumed met unless the box is explicitly unticked.
    const sbFlag = v.small_business_turnover_under_5m;
    const sbEligible = sbFlag === undefined || sbFlag === null || sbFlag === '' ? business > 0 : sbFlag === true || sbFlag === 'true';
    const small_business_offset = sbEligible ? auSmallBusinessOffset(income_tax, business, taxable_income) : 0;

    // Order, as the ATO's myTax estimate applies it: non-refundable offsets
    // reduce income tax to nil and no further; the Medicare levy and surcharge
    // are added after (LITO never reduces them); refundable franking credits
    // come off last — an excess is a refund, not lost. total_tax stays a
    // liability (never below nil, as consumers read it as tax owed); the
    // excess is its own franking_credit_refund and comes off balance_due.
    const tax_after_offsets = Math.max(0, income_tax - lito - small_business_offset);
    const franking_credit_offset = frankingCredits;
    const liability = tax_after_offsets + medicare_levy + medicareSurcharge;
    const total_tax = Math.max(0, liability - franking_credit_offset);
    const franking_credit_refund = Math.max(0, franking_credit_offset - liability);

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
    // Resolved as of 1 July of the return's year, so a 2025-26 return gets the
    // 2025-26 thresholds (a later year with no scheme yet carries the newest).
    // startYmd parses as UTC midnight, exactly as the ledger's effectiveFrom does.
    const study_loan_repayment = hasStudyLoan
      ? Math.round(getStudentLoanRepayment('AU', { repaymentIncome, asOf: new Date(year.startYmd) })?.repayment ?? 0)
      : 0;

    const withheld = Number(v.tax_withheld) || 0;
    const instalments = Number(v.payg_instalments) || 0;
    const balance_due = total_tax + study_loan_repayment - withheld - instalments - franking_credit_refund;

    return { total_income, total_deductions, taxable_income, income_tax, medicare_levy, lito, small_business_offset, franking_credit_offset, franking_credit_refund, study_loan_repayment, total_tax, balance_due };
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

    const { year, unreadable } = returnIncomeYear(v);
    if (unreadable !== undefined) {
      r.push({ fieldId: 'income_year', message: `"${unreadable}" is not an income year (use e.g. 2025-26) — the figures use ${year.label}.`, severity: 'error' });
    } else if (year.startYear < AU_IT_FIRST_MODELLED_YEAR) {
      r.push({ fieldId: 'income_year', message: `${year.label} is not modelled: the brackets used are the 2024-25 ones, which are wrong for ${year.label}.`, severity: 'error' });
    }
    const calc = auItPlugin.calculateFields(v);
    const taxable = Number(calc.taxable_income) || 0;
    if (!AU_IT_MEDICARE_LOW_INCOME[year.label] && Number(calc.medicare_levy) > 0) {
      const latest = Object.values(AU_IT_MEDICARE_LOW_INCOME).reduce((m, b) => Math.max(m, b.upper), 0);
      r.push({
        fieldId: 'medicare_levy',
        message: `The Medicare levy low-income thresholds for ${year.label} are not recorded here, so the flat 2% was used without the low-income reduction.`,
        severity: taxable <= latest ? 'warning' : 'info',
      });
    }
    const hasStudyLoan = v.has_study_loan === true || v.has_study_loan === 'true';
    if (hasStudyLoan && year.startYear < 2025) {
      r.push({ fieldId: 'study_loan_repayment', message: `Study loan repayments before 2025-26 used a different (whole-of-income) system that is not modelled; the 2025-26 rates were used.`, severity: 'warning' });
    }
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
