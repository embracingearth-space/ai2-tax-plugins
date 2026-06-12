/**
 * Canada Income Tax — T1 General (Individuals / Sole Proprietors) - ai2fin.com
 * Canada Revenue Agency (CRA)
 * Reference: https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return.html
 * ARCHITECTURE: Compound-key plugin 'CA-IT' alongside 'CA' (GST/HST Return).
 *   Federal brackets year-selected: 2026 = 14/20.5/26/29/33% (lowest rate cut
 *   from 15% -> 14.5% blended 2025 -> 14% from 2026; thresholds indexed 2.0%).
 *   BPA: $16,129 (2025) / $16,452 (2026), credited at the lowest rate.
 *   CPP: 5.95% on $3,500 up to YMPE $71,300 (2025) / $74,600 (2026).
 *   (CPP2 second-ceiling contributions not modelled yet.)
 *   FY: Jan-Dec. Filing deadline: Apr 30 (Jun 15 for self-employed, but payment Apr 30).
 *   Quarterly instalment payments if tax >$3,000 net.
 */

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
  SubJurisdiction,
} from '../types';

const CPP_RATE = 0.0595;
const CPP_EXEMPTION = 3500;

function currentTaxYear(now = new Date()): number {
  return now.getFullYear();
}

// 2025: lowest rate is the CRA blended 14.5% (15% Jan-Jun, 14% Jul-Dec);
// thresholds per CRA 2025 indexation. 2026: 14% full-year, thresholds
// indexed 2.0%, YMPE $74,600, BPA $16,452.
const YEAR_PARAMS = {
  2025: {
    brackets: [
      [0, 57375, 0.145], [57375, 114750, 0.205], [114750, 177882, 0.26],
      [177882, 253414, 0.29], [253414, Infinity, 0.33],
    ] as const,
    bpa: 16129, lowestRate: 0.145, cppMaxEarnings: 71300,
  },
  2026: {
    brackets: [
      [0, 58523, 0.14], [58523, 117045, 0.205], [117045, 181440, 0.26],
      [181440, 258482, 0.29], [258482, Infinity, 0.33],
    ] as const,
    bpa: 16452, lowestRate: 0.14, cppMaxEarnings: 74600,
  },
};

function paramsForYear(year: number) {
  return year >= 2026 ? YEAR_PARAMS[2026] : YEAR_PARAMS[2025];
}

function calcFederalTax(taxable: number, year = currentTaxYear()): number {
  const p = paramsForYear(year);
  let tax = 0;
  for (const [lower, upper, rate] of p.brackets) {
    if (taxable > lower) tax += Math.min(taxable - lower, upper - lower) * rate;
  }
  // Basic personal amount credit (non-refundable, at the lowest rate)
  tax -= p.bpa * p.lowestRate;
  return Math.max(0, Math.round(tax * 100) / 100);
}

function calcCPP(selfEmploymentIncome: number, year = currentTaxYear()): number {
  const p = paramsForYear(year);
  const pensionableEarnings = Math.min(Math.max(0, selfEmploymentIncome - CPP_EXEMPTION), p.cppMaxEarnings - CPP_EXEMPTION);
  // Self-employed pay both employee + employer portions
  return Math.round(pensionableEarnings * CPP_RATE * 2 * 100) / 100;
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
          { id: 'capital_gains', label: 'Taxable capital gains', officialLabel: 'Line 12700', type: 'currency', editable: true, required: false, helpText: '50% inclusion rate (changing to 2/3 for gains >$250K from Jun 2024)' },
          { id: 'other_income', label: 'Other income', officialLabel: 'Line 13000', type: 'currency', editable: true, required: false },
          { id: 'total_income', label: 'Total income', officialLabel: 'Line 15000', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'deductions',
        title: 'Deductions (Net Income)',
        fields: [
          { id: 'rrsp_deduction', label: 'RRSP deduction', officialLabel: 'Line 20800', type: 'currency', editable: true, required: false, helpText: '18% of prior year earned income, max $31,560 (2025)' },
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
          { id: 'charitable_donations', label: 'Charitable donations', officialLabel: 'Line 34900', type: 'currency', editable: true, required: false, helpText: '15% on first $200, 29-33% on excess' },
          { id: 'disability_amount', label: 'Disability amount', type: 'currency', editable: true, required: false },
        ],
      },
      {
        id: 'tax_calc',
        title: 'Tax Calculation',
        fields: [
          { id: 'taxable_income', label: 'Taxable income', officialLabel: 'Line 26000', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'federal_tax', label: 'Federal tax', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'cpp_contributions', label: 'CPP contributions on SE income', type: 'currency', calculated: true, editable: false, required: false, helpText: 'Self-employed pay both portions: 11.9% on $3,500-$71,300' },
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
      donationCredit = Math.min(donations, 200) * 0.15 + Math.max(0, donations - 200) * 0.29;
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
    if (rrsp > 31560) r.push({ fieldId: 'rrsp_deduction', message: '2025 RRSP deduction limit is $31,560', severity: 'warning' });
    return r;
  },
  getFieldHelp: () => null,

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v) {
    return { data: JSON.stringify(v, null, 2), filename: `T1-CA-${new Date().toISOString().slice(0, 10)}.json`, mimeType: 'application/json' };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-individuals/netfile.html', submissionMethod: 'manual_upload' as const, apiReady: false }),
  hasSubJurisdictions: () => true,
  getSubJurisdictions: () => CA_PROVINCES,
  supportsCustomFields: () => false,
};

export default caItPlugin;
