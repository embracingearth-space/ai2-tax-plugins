/**
 * UK Self-Assessment / Making Tax Digital for Income Tax (MTD-IT) - ai2fin.com
 * HM Revenue & Customs (HMRC)
 * Reference: https://developer.service.hmrc.gov.uk/guides/income-tax-mtd-end-to-end-service-guide/
 * ARCHITECTURE: MTD for Income Tax launches April 2026 for income >£50,000.
 *   Quarterly digital updates + annual final declaration via compatible software.
 *   Bands are TAXABLE income (after the personal allowance), 2025-26 and 2026-27:
 *   20% basic to £37,700, 40% higher to £125,140, 45% additional above.
 *   Income is taxed in the statutory order: non-savings, then savings, then
 *   dividends on top, the nil-rate amounts (starting rate for savings, personal
 *   savings allowance, dividend allowance) still using up band.
 *   Scottish taxpayers: Scottish rates and bands on non-savings income only.
 *   Class 4 NICs only — Class 2 has been treated as paid (not charged) since 2024-25.
 *   This is a compound-key plugin: registered as 'GB-SA' alongside 'GB' (VAT Return).
 */

import { toCsv } from '../exportUtils';
import { resolveEffectiveDated } from '../data/effectiveDating';
import { localToday } from '../data/incomeTax';
import { progressive, type Band } from '../data/incomeTaxMath';
import { GB_SCOTLAND } from '../data/incomeTaxRegions/scotland';

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
} from '../types';

// Frozen across 2025-26 and 2026-27 (https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past).
const PA = 12570;
const PA_TAPER_FROM = 100000;
const BASIC_RATE_LIMIT = 37700;   // taxable income
const HIGHER_RATE_LIMIT = 125140; // taxable income
const STARTING_RATE_FOR_SAVINGS = 5000;
// Personal savings allowance by the highest band reached (https://www.gov.uk/apply-tax-free-interest-on-savings/how-much-is-tax-free).
const PSA_BASIC = 1000;
const PSA_HIGHER = 500;
const DIVIDEND_ALLOWANCE = 500;
const MAIN_RATES = { basic: 0.20, higher: 0.40, additional: 0.45 };
// Savings rates equal the main rates until 2027-28 (22/42/47 from 6 April 2027 — not modelled).
const SAVINGS_RATES = MAIN_RATES;
// Class 4 profits limits (https://www.gov.uk/self-employed-national-insurance-rates).
const LOWER_PROFITS_LIMIT = 12570;
const UPPER_PROFITS_LIMIT = 50270;
// Gift Aid is entered as the amount given; the charity reclaims basic-rate tax on top (£100 → £125).
const GIFT_AID_GROSS_UP = 100 / 80;

/**
 * What differs between the modelled tax years. Newest first; append the next
 * year when HMRC publishes it. calculateFields() is given only form values, so
 * the year comes from the optional `tax_year` field and, when that is blank,
 * is the current UK tax year (6 April, Europe/London).
 */
interface GbSaYear {
  effectiveFrom: string;
  label: string;
  // https://www.gov.uk/tax-on-dividends — 2026-27 rises to 10.75% / 35.75% (Budget 2025).
  dividendRates: { ordinary: number; upper: number; additional: number };
  // Class 2 is treated as paid at or above this; below it is voluntary.
  smallProfitsThreshold: number;
  class2VoluntaryWeekly: number;
}

const GB_SA_YEARS: GbSaYear[] = [
  {
    effectiveFrom: '2026-04-06', label: '2026-27',
    dividendRates: { ordinary: 0.1075, upper: 0.3575, additional: 0.3935 },
    smallProfitsThreshold: 7105, class2VoluntaryWeekly: 3.65,
  },
  {
    effectiveFrom: '2025-04-06', label: '2025-26',
    dividendRates: { ordinary: 0.0875, upper: 0.3375, additional: 0.3935 },
    smallProfitsThreshold: 6845, class2VoluntaryWeekly: 3.50,
  },
];

const UK_REGIONS = [
  { code: 'ENG', name: 'England' }, { code: 'WAL', name: 'Wales' },
  { code: 'SCT', name: 'Scotland' }, { code: 'NIR', name: 'Northern Ireland' },
];

/** The UK tax year (6 April – 5 April) a YYYY-MM-DD day falls in, as '2026-27'. */
function ukTaxYearLabelOn(ymd: string): string {
  const y = Number(ymd.slice(0, 4));
  const start = ymd.slice(5, 10) >= '04-06' ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/**
 * The year a return is for: a label ('2025-26', '2025/26', '2025-2026'), a day
 * inside it, or blank for the current tax year. `modelled` is false when that
 * year is not in GB_SA_YEARS and the nearest modelled year's rates are used.
 */
function resolveTaxYear(input?: unknown): { requested: string; year: GbSaYear; modelled: boolean } {
  let requested: string;
  const raw = input instanceof Date ? input.toISOString().slice(0, 10) : String(input ?? '').trim();
  const label = /^(\d{4})\s*[-/]\s*(\d{2}|\d{4})$/.exec(raw);
  if (label) requested = `${label[1]}-${label[2]!.slice(-2)}`;
  else if (/^\d{4}-\d{2}-\d{2}/.test(raw)) requested = ukTaxYearLabelOn(raw);
  else requested = ukTaxYearLabelOn(localToday('Europe/London'));
  const exact = GB_SA_YEARS.find((y) => y.label === requested);
  if (exact) return { requested, year: exact, modelled: true };
  const asOf = new Date(`${requested.slice(0, 4)}-04-06T00:00:00Z`);
  return { requested, year: resolveEffectiveDated(GB_SA_YEARS, { asOf })!, modelled: false };
}

function isScottishTaxpayer(v: FieldValues): boolean {
  return String(v.taxpayer_region ?? '').trim().toUpperCase().replace(/^GB-/, '') === 'SCT';
}

/** The Scottish set for a tax year — that year's, else the latest earlier one. */
function scottishSetFor(year: GbSaYear) {
  return resolveEffectiveDated(GB_SCOTLAND.sets, { taxYear: year.label }, (s) => s.taxYearLabel)
    ?? resolveEffectiveDated(GB_SCOTLAND.sets, { asOf: new Date(`${year.effectiveFrom}T00:00:00Z`) })!;
}

/** Tax on `amount` of income stacked on top of `from` already counted against the bands. */
function stacked(from: number, amount: number, bands: readonly Band[]): number {
  return amount > 0 ? progressive(from + amount, bands) - progressive(from, bands) : 0;
}

/** Set `amount` against the components in order; returns what is left of each. */
function setAgainst(amount: number, components: number[]): number[] {
  let left = amount;
  return components.map((c) => {
    const used = Math.min(c, left);
    left -= used;
    return c - used;
  });
}

interface IncomeTaxInputs {
  nonSavings: number;  // after loss relief, before the personal allowance
  savings: number;
  dividends: number;
  /** Gross relief-at-source pension contributions + gross Gift Aid. */
  bandExtension: number;
  year: GbSaYear;
  scottish: boolean;
}

function calcIncomeTax(p: IncomeTaxInputs): { tax: number; personalAllowance: number; adjustedNetIncome: number } {
  const ext = p.bandExtension;
  // Adjusted net income (for the taper) is net income less the gross pension
  // contributions and Gift Aid; the allowance falls £1 for every £2 above £100,000.
  const adjustedNetIncome = Math.max(0, p.nonSavings + p.savings + p.dividends - ext);
  const personalAllowance = adjustedNetIncome > PA_TAPER_FROM
    ? Math.max(0, PA - Math.floor((adjustedNetIncome - PA_TAPER_FROM) / 2)) : PA;
  // Allowance set against non-savings, then savings, then dividends (the usual
  // order; HMRC applies whichever order is most favourable, which matches it in
  // ordinary cases).
  const [ns, sv, dv] = setAgainst(personalAllowance, [p.nonSavings, p.savings, p.dividends]) as [number, number, number];

  // Basic-rate relief on relief-at-source pensions and Gift Aid is given at
  // source; higher/additional relief comes from extending BOTH the basic and the
  // higher rate limits by the gross amount (PTM056120; FA 2004 s192(4), ITA 2007 s414).
  const basicLimit = BASIC_RATE_LIMIT + ext;
  const higherLimit = HIGHER_RATE_LIMIT + ext;
  const ukBands = (r: { basic: number; higher: number; additional: number }): Band[] => [
    { upTo: basicLimit, rate: r.basic }, { upTo: higherLimit, rate: r.higher }, { upTo: null, rate: r.additional },
  ];

  // 1. Non-savings income. Scottish taxpayers use the Scottish bands; every
  // Scottish limit from the basic rate limit up is extended, the starter limit is not.
  const nonSavingsBands: Band[] = p.scottish
    ? scottishSetFor(p.year).bands.map((b, i) => ({ upTo: b.upTo === null || i === 0 ? b.upTo : b.upTo + ext, rate: b.rate }))
    : ukBands(MAIN_RATES);
  let tax = stacked(0, ns, nonSavingsBands);

  // 2. Savings on top, always at UK bands. The starting rate covers what of the
  // first £5,000 of taxable income non-savings income has not used; the PSA is
  // set by the highest UK band the total reaches. Both still use up band.
  const totalTaxable = ns + sv + dv;
  const psa = totalTaxable > higherLimit ? 0 : totalTaxable > basicLimit ? PSA_HIGHER : PSA_BASIC;
  const savingsNil = Math.min(sv, Math.max(0, STARTING_RATE_FOR_SAVINGS - ns) + psa);
  tax += stacked(ns + savingsNil, sv - savingsNil, ukBands(SAVINGS_RATES));

  // 3. Dividends on top of everything, UK bands; the allowance uses up band too.
  const dividendNil = Math.min(dv, DIVIDEND_ALLOWANCE);
  const d = p.year.dividendRates;
  tax += stacked(ns + sv + dividendNil, dv - dividendNil, ukBands({ basic: d.ordinary, higher: d.upper, additional: d.additional }));

  return { tax: Math.round(tax * 100) / 100, personalAllowance, adjustedNetIncome };
}

function calcClass4NICs(profit: number): number {
  // 6% on £12,570-£50,270, 2% above £50,270 (2025-26 and 2026-27)
  if (profit <= LOWER_PROFITS_LIMIT) return 0;
  let nics = 0;
  const lower = Math.min(profit, UPPER_PROFITS_LIMIT) - LOWER_PROFITS_LIMIT;
  nics += lower * 0.06;
  if (profit > UPPER_PROFITS_LIMIT) {
    nics += (profit - UPPER_PROFITS_LIMIT) * 0.02;
  }
  return Math.round(nics * 100) / 100;
}

const pct = (r: number) => `${Math.round(r * 10000) / 100}%`;

const gbSaPlugin: TaxFilingPlugin = {
  countryCode: 'GB-SA',
  displayName: 'Self-Assessment (MTD for Income Tax)',
  shortName: 'Self-Assessment',
  authority: {
    name: 'HMRC',
    fullName: 'HM Revenue & Customs',
    portalUrl: 'https://www.gov.uk/self-assessment-tax-returns',
    helpUrl: 'https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax',
  },
  taxFamily: 'INCOME_TAX',
  isFullPlugin: true,

  /** Help text quotes `opts.incomeYear` (else the current tax year); the calculation reads `tax_year`. */
  getFormSchema(opts?: { incomeYear?: string | Date }): FormSection[] {
    const { year } = resolveTaxYear(opts?.incomeYear);
    const d = year.dividendRates;
    return [
      {
        id: 'return_details',
        title: 'Tax Year & Residence',
        fields: [
          { id: 'tax_year', label: 'Tax year', type: 'select', editable: true, required: false, helpText: 'The tax year this return is for (6 April to 5 April). Leave blank for the current tax year. Dividend rates and Scottish bands differ between years.', selectOptions: GB_SA_YEARS.map((y) => ({ value: y.label, label: y.label })) },
          { id: 'taxpayer_region', label: 'Where your main home is', type: 'select', editable: true, required: false, helpText: 'Scottish taxpayers pay Scottish rates on earnings, profits, rental and other non-savings income; savings and dividend rates, the personal allowance and National Insurance stay UK-wide. Wales, England and Northern Ireland use the same rates.', selectOptions: UK_REGIONS.map((r) => ({ value: r.code, label: r.name })) },
        ],
      },
      {
        id: 'self_employment',
        title: 'Self-Employment Income',
        description: 'Trading income from your business (sole trader / partnership).',
        fields: [
          { id: 'turnover', label: 'Business turnover', type: 'currency', editable: true, required: true, autoPopulateFrom: 'income_total', helpText: 'Total sales/revenue from self-employment' },
          { id: 'allowable_expenses', label: 'Allowable business expenses', type: 'currency', editable: true, required: true, autoPopulateFrom: 'expenses_deductible', helpText: 'Running costs: office, travel, stock, professional fees' },
          { id: 'capital_allowances', label: 'Capital allowances (AIA / WDA)', type: 'currency', editable: true, required: false, autoPopulateFrom: 'expenses_capital', helpText: 'Annual Investment Allowance (£1M), Writing Down Allowance' },
          { id: 'net_profit', label: 'Net taxable profit', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'other_income',
        title: 'Other Income',
        collapsed: true,
        fields: [
          { id: 'employment_income', label: 'Employment income (PAYE)', type: 'currency', editable: true, required: false, helpText: 'If also employed — tax already deducted via PAYE' },
          { id: 'property_income', label: 'Property income (rental)', type: 'currency', editable: true, required: false, helpText: 'Rental profits after allowable deductions' },
          { id: 'savings_interest', label: 'Savings interest', type: 'currency', editable: true, required: false, helpText: 'Bank/building society interest. Up to £5,000 at 0% (starting rate, reduced £1 for £1 by other income above the personal allowance), then the personal savings allowance: £1,000 basic rate, £500 higher rate, £0 additional rate' },
          { id: 'dividends', label: 'Dividends', type: 'currency', editable: true, required: false, helpText: `${year.label}: £${DIVIDEND_ALLOWANCE} tax-free allowance, then ${pct(d.ordinary)} / ${pct(d.upper)} / ${pct(d.additional)} (basic / higher / additional rate), taxed on top of your other income` },
          { id: 'other_income', label: 'Other taxable income', type: 'currency', editable: true, required: false },
        ],
      },
      {
        id: 'deductions',
        title: 'Tax Reliefs & Deductions',
        fields: [
          { id: 'pension_contributions', label: 'Pension contributions (gross)', type: 'currency', editable: true, required: false, helpText: 'Relief-at-source personal pension contributions, gross (what you paid plus the 20% your provider claims). Basic-rate relief is given at source, so this does not reduce your income: it extends your basic and higher rate bands and reduces adjusted net income for the personal allowance taper. Not for workplace contributions taken from pay before tax.' },
          { id: 'gift_aid', label: 'Gift Aid donations (amount you gave)', type: 'currency', editable: true, required: false, helpText: 'What you actually donated. The charity claims 25p per £1 on top; your basic and higher rate bands are extended by the grossed-up amount (× 1.25), and it reduces adjusted net income.' },
          { id: 'loss_relief', label: 'Trading loss relief', type: 'currency', editable: true, required: false },
        ],
      },
      {
        id: 'tax_calc',
        title: 'Tax Calculation',
        fields: [
          { id: 'total_income', label: 'Total income', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'taxable_income', label: 'Taxable income (after deductions)', type: 'currency', calculated: true, editable: false, required: true, helpText: 'Total income less trading loss relief, before the personal allowance. Pension contributions and Gift Aid extend your bands instead of reducing this.' },
          { id: 'adjusted_net_income', label: 'Adjusted net income', type: 'currency', calculated: true, editable: false, required: false, helpText: 'Taxable income less gross pension contributions and grossed-up Gift Aid — the figure the personal allowance taper uses.' },
          { id: 'personal_allowance', label: 'Personal allowance', type: 'currency', calculated: true, editable: false, required: false, helpText: '£12,570, reduced by £1 for every £2 of adjusted net income above £100,000.' },
          { id: 'income_tax', label: 'Income tax liability', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'class4_nics', label: 'Class 4 NICs', type: 'currency', calculated: true, editable: false, required: true, helpText: '6% on £12,570-£50,270, 2% above' },
          { id: 'class2_nics', label: 'Class 2 NICs', type: 'currency', calculated: true, editable: false, required: false, helpText: `Not charged: Class 2 is treated as paid on profits of £${year.smallProfitsThreshold.toLocaleString('en-GB')} or more (${year.label}). Below that it is voluntary (£${year.class2VoluntaryWeekly.toFixed(2)} a week) and not included here.` },
          { id: 'student_loan', label: 'Student loan repayment', type: 'currency', editable: true, required: false },
        ],
      },
      {
        id: 'payments',
        title: 'Payments & Balance',
        fields: [
          { id: 'tax_already_paid', label: 'Tax already paid (PAYE, payments on account)', type: 'currency', editable: true, required: false },
          { id: 'total_tax_due', label: 'Total tax + NICs due', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'balance_due', label: 'Balance due / refundable', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({ monthly: false, quarterly: true, annual: true, defaultFrequency: 'annual' }),
  getFinancialYearBounds: (y) => ({ start: new Date(y, 3, 6), end: new Date(y + 1, 3, 5) }),

  getTerminology: () => ({
    taxName: 'Income Tax', taxAbbrev: 'IT',
    salesLabel: 'Turnover', purchasesLabel: 'Expenses',
    outputTaxLabel: 'Tax liability', inputTaxLabel: 'Tax reliefs',
  }),

  calculateFields(v: FieldValues): CalculatedFields {
    const turnover = Number(v.turnover) || 0;
    const expenses = Number(v.allowable_expenses) || 0;
    const capAllow = Number(v.capital_allowances) || 0;
    const net_profit = Math.max(0, turnover - expenses - capAllow);

    const employment = Number(v.employment_income) || 0;
    const property = Number(v.property_income) || 0;
    const savings = Number(v.savings_interest) || 0;
    const dividends = Number(v.dividends) || 0;
    const other = Number(v.other_income) || 0;

    const total_income = net_profit + employment + property + savings + dividends + other;

    const pension = Number(v.pension_contributions) || 0;
    const giftAid = Number(v.gift_aid) || 0;
    const lossRelief = Number(v.loss_relief) || 0;

    // Loss relief reduces net income (non-savings first). Pension contributions
    // and Gift Aid do NOT: they extend the bands and reduce adjusted net income.
    const taxable_income = Math.max(0, total_income - lossRelief);
    const [nonSavings, savingsLeft, dividendsLeft] = setAgainst(lossRelief, [
      Math.max(0, net_profit + employment + property + other), Math.max(0, savings), Math.max(0, dividends),
    ]) as [number, number, number];
    const { tax: income_tax, personalAllowance: personal_allowance, adjustedNetIncome: adjusted_net_income } = calcIncomeTax({
      nonSavings, savings: savingsLeft, dividends: dividendsLeft,
      bandExtension: Math.max(0, pension) + Math.max(0, giftAid) * GIFT_AID_GROSS_UP,
      year: resolveTaxYear(v.tax_year).year,
      scottish: isScottishTaxpayer(v),
    });
    const class4_nics = calcClass4NICs(net_profit);
    // Class 2 is no longer charged (from 2024-25): treated as paid at profits of
    // the small profits threshold or more, voluntary below it. The form has no
    // opt-in for voluntary Class 2, so it is 0 and kept only for saved returns.
    const class2_nics = 0;

    const studentLoan = Number(v.student_loan) || 0;
    const total_tax_due = Math.round((income_tax + class4_nics + class2_nics + studentLoan) * 100) / 100;
    const alreadyPaid = Number(v.tax_already_paid) || 0;
    const balance_due = Math.round((total_tax_due - alreadyPaid) * 100) / 100;

    return {
      net_profit, total_income, taxable_income, adjusted_net_income, personal_allowance,
      income_tax, class4_nics, class2_nics, total_tax_due, balance_due,
    };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'turnover', aggregateKey: 'income_total' },
    { fieldId: 'allowable_expenses', aggregateKey: 'expenses_deductible' },
    { fieldId: 'capital_allowances', aggregateKey: 'expenses_capital' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    if (Number(v.turnover) < 0) r.push({ fieldId: 'turnover', message: 'Turnover cannot be negative', severity: 'error' });
    const expenses = Number(v.allowable_expenses) || 0;
    const turnover = Number(v.turnover) || 0;
    if (expenses > turnover * 1.5) r.push({ fieldId: 'allowable_expenses', message: 'Expenses significantly exceed turnover — verify', severity: 'warning' });
    const { requested, year, modelled } = resolveTaxYear(v.tax_year);
    if (!modelled) r.push({ fieldId: 'tax_year', message: `Rates for ${requested} are not modelled yet — calculated with ${year.label} rates. Check dividend rates (and Scottish bands) for ${requested} on GOV.UK.`, severity: 'warning' });
    if (isScottishTaxpayer(v)) {
      const sct = scottishSetFor(year);
      if (sct.taxYearLabel !== year.label || !sct.verified) r.push({ fieldId: 'taxpayer_region', message: `Scottish bands for ${year.label} are not confirmed here — calculated with the ${sct.taxYearLabel} Scottish bands.`, severity: 'warning' });
    }
    return r;
  },

  getFieldHelp: (id) => {
    const h: Record<string, string> = {
      turnover: 'Total business sales for the tax year. Report gross amount before expenses.',
      net_profit: 'Turnover minus allowable expenses and capital allowances. This is your taxable profit.',
      income_tax: 'Non-savings income is taxed first, then savings, then dividends on top, each using up the bands. Personal allowance tapers £1 for every £2 of adjusted net income above £100K. Scottish taxpayers pay Scottish rates on non-savings income only.',
      class4_nics: 'National Insurance for self-employed: 6% on profits between £12,570-£50,270, 2% above.',
      class2_nics: 'Class 2 is no longer charged: treated as paid at or above the small profits threshold, voluntary below it.',
    };
    return h[id] ?? null;
  },

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v: FieldValues, format: string): Promise<ExportOutput> {
    if (format === 'csv') return toCsv(v, `SelfAssessment-GB-${new Date().toISOString().slice(0, 10)}`);
    return {
      data: JSON.stringify(v, null, 2),
      filename: `SelfAssessment-GB-${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/json',
    };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://www.gov.uk/self-assessment-tax-returns', submissionMethod: 'api' as const, apiReady: true }),
  hasSubJurisdictions: () => true,
  // calculateFields() reads the region from the `taxpayer_region` field; only SCT changes the rates.
  getSubJurisdictions: () => UK_REGIONS.map((r) => ({ ...r })),
  supportsCustomFields: () => false,
};

export default gbSaPlugin;
