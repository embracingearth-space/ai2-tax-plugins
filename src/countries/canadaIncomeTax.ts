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
 *   (CPP2 second-ceiling contributions not modelled yet.)
 *   FY: Jan-Dec. Filing deadline: Apr 30 (Jun 15 for self-employed, but payment Apr 30).
 *   Quarterly instalment payments if tax >$3,000 net.
 */

import { toCsv } from '../exportUtils';
import { canadaBasicPersonalAmount, canadaFederalYear } from '../data/canadaFederal';

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
  SubJurisdiction,
} from '../types';

function currentTaxYear(now = new Date()): number {
  return now.getFullYear();
}

const paramsForYear = canadaFederalYear;

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
  // Basic personal amount credit (non-refundable, at the lowest rate)
  tax -= canadaBasicPersonalAmount(taxable, p) * p.lowestRate;
  return Math.max(0, Math.round(tax * 100) / 100);
}

function calcCPP(selfEmploymentIncome: number, year = currentTaxYear()): number {
  const p = paramsForYear(year);
  const { ympe, basicExemption, employeeRate } = p.cpp;
  const pensionableEarnings = Math.min(Math.max(0, selfEmploymentIncome - basicExemption), ympe - basicExemption);
  // Self-employed pay both employee + employer portions
  return Math.round(pensionableEarnings * employeeRate * 2 * 100) / 100;
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
    return [
      {
        id: 'income',
        title: 'Total Income',
        fields: [
          { id: 'employment_income', label: 'Employment income (T4)', officialLabel: 'Line 10100', type: 'currency', editable: true, required: false },
          { id: 'self_employment_gross', label: 'Self-employment gross income', officialLabel: 'Line 13500', type: 'currency', editable: true, required: false, autoPopulateFrom: 'income_total' },
          { id: 'self_employment_net', label: 'Self-employment net income', officialLabel: 'Line 13700', type: 'currency', editable: true, required: false },
          { id: 'interest_income', label: 'Interest and investment income', officialLabel: 'Line 12100', type: 'currency', editable: true, required: false },
          { id: 'dividend_income', label: 'Taxable dividends', officialLabel: 'Line 12000', type: 'currency', editable: true, required: false },
          { id: 'rental_income', label: 'Net rental income', officialLabel: 'Line 12600', type: 'currency', editable: true, required: false },
          { id: 'capital_gains', label: 'Taxable capital gains', officialLabel: 'Line 12700', type: 'currency', editable: true, required: false, helpText: '50% inclusion rate. The proposed increase to 2/3 was cancelled on 21 March 2025 and never took effect.' },
          { id: 'other_income', label: 'Other income', officialLabel: 'Line 13000', type: 'currency', editable: true, required: false },
          { id: 'total_income', label: 'Total income', officialLabel: 'Line 15000', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'deductions',
        title: 'Deductions (Net Income)',
        fields: [
          { id: 'rrsp_deduction', label: 'RRSP deduction', officialLabel: 'Line 20800', type: 'currency', editable: true, required: false, helpText: `18% of prior year earned income, up to the RRSP dollar limit ($${paramsForYear(currentTaxYear()).rrspDollarLimit.toLocaleString('en-CA')} for ${paramsForYear(currentTaxYear()).taxYear})` },
          { id: 'union_dues', label: 'Union / professional dues', officialLabel: 'Line 21200', type: 'currency', editable: true, required: false },
          { id: 'child_care', label: 'Child care expenses', officialLabel: 'Line 21400', type: 'currency', editable: true, required: false },
          { id: 'moving_expenses', label: 'Moving expenses', officialLabel: 'Line 21900', type: 'currency', editable: true, required: false },
          { id: 'business_investment_loss', label: 'Business investment loss', officialLabel: 'Line 21700', type: 'currency', editable: true, required: false },
          { id: 'other_deductions', label: 'Other deductions', type: 'currency', editable: true, required: false },
          { id: 'net_income', label: 'Net income', officialLabel: 'Line 23600', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'credits',
        title: 'Non-refundable Tax Credits',
        collapsed: true,
        fields: [
          { id: 'medical_expenses', label: 'Medical expenses', officialLabel: 'Line 33099', type: 'currency', editable: true, required: false },
          { id: 'charitable_donations', label: 'Charitable donations', officialLabel: 'Line 34900', type: 'currency', editable: true, required: false, helpText: 'Lowest federal rate (14.5% for 2025, 14% for 2026) on the first $200; 29% on the rest (33% on the part paid from income in the top bracket, not modelled here)' },
          { id: 'disability_amount', label: 'Disability amount', type: 'currency', editable: true, required: false },
        ],
      },
      {
        id: 'tax_calc',
        title: 'Tax Calculation',
        fields: [
          { id: 'taxable_income', label: 'Taxable income', officialLabel: 'Line 26000', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'federal_tax', label: 'Federal tax', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'cpp_contributions', label: 'CPP contributions on SE income', type: 'currency', calculated: true, editable: false, required: false, helpText: `Self-employed pay both portions: 11.9% on $3,500-$${paramsForYear(currentTaxYear()).cpp.ympe.toLocaleString('en-CA')} (${paramsForYear(currentTaxYear()).taxYear})` },
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
    const employment = Number(v.employment_income) || 0;
    const seNet = Number(v.self_employment_net) || 0;
    const interest = Number(v.interest_income) || 0;
    const dividends = Number(v.dividend_income) || 0;
    const rental = Number(v.rental_income) || 0;
    const capGains = Number(v.capital_gains) || 0;
    const other = Number(v.other_income) || 0;
    const total_income = employment + seNet + interest + dividends + rental + capGains + other;

    const dedFields = ['rrsp_deduction', 'union_dues', 'child_care', 'moving_expenses', 'business_investment_loss', 'other_deductions'];
    const totalDed = dedFields.reduce((s, f) => s + (Number(v[f]) || 0), 0);
    const net_income = Math.max(0, total_income - totalDed);
    const taxable_income = net_income;

    const federal_tax = calcFederalTax(taxable_income);
    const cpp_contributions = seNet > 0 ? calcCPP(seNet) : 0;
    const cppDeduction = Math.round(cpp_contributions / 2 * 100) / 100;

    // Donation credit
    const donations = Number(v.charitable_donations) || 0;
    let donationCredit = 0;
    if (donations > 0) {
      // The first $200 is credited at the LOWEST rate, which is 14.5% for 2025
      // and 14% for 2026 (Finance Canada: "Only the first $200 of an
      // individual's charitable donation claim is subject to the lowest income
      // tax rate"). This used the pre-2025 15% until 2026-10.
      donationCredit = Math.min(donations, 200) * paramsForYear(currentTaxYear()).lowestRate + Math.max(0, donations - 200) * 0.29;
    }

    const total_federal_payable = Math.max(0, Math.round((federal_tax + cpp_contributions - donationCredit) * 100) / 100);

    const deducted = Number(v.tax_deducted) || 0;
    const instalments = Number(v.instalments_paid) || 0;
    const balance_owing = Math.round((total_federal_payable - deducted - instalments) * 100) / 100;
    const quarterly_instalment = Math.round(total_federal_payable / 4 * 100) / 100;

    return { total_income, net_income, taxable_income, federal_tax, cpp_contributions, total_federal_payable, balance_owing, quarterly_instalment };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'self_employment_gross', aggregateKey: 'income_total' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    const rrsp = Number(v.rrsp_deduction) || 0;
    // $31,560 was quoted here as the 2025 limit; it is the 2024 one. The CRA's
    // dollar limit is $32,490 for 2025 and $33,810 for 2026.
    const p = paramsForYear(currentTaxYear());
    if (rrsp > p.rrspDollarLimit) {
      r.push({ fieldId: 'rrsp_deduction', message: `${p.taxYear} RRSP dollar limit is $${p.rrspDollarLimit.toLocaleString('en-CA')}`, severity: 'warning' });
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
