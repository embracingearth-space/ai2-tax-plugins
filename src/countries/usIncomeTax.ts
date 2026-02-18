/**
 * US Income Tax — Schedule C / 1040-ES (Sole Proprietor) - ai2fin.com
 * Internal Revenue Service (IRS)
 * Reference: https://www.irs.gov/forms-pubs/about-schedule-c-form-1040
 * ARCHITECTURE: Compound-key plugin 'US-IT' alongside 'US' (Form 941 payroll).
 *   2025 tax brackets (single): 10/12/22/24/32/35/37%.
 *   Self-employment tax: 15.3% (12.4% SS up to $176,100 + 2.9% Medicare).
 *   Quarterly estimated payments: Apr 15, Jun 15, Sep 15, Jan 15.
 *   Standard deduction 2025: $15,000 single, $30,000 MFJ.
 */

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
  SubJurisdiction,
} from '../types';

const SS_RATE = 0.124;
const MEDICARE_RATE = 0.029;
const SS_WAGE_BASE_2025 = 176100;
const STD_DEDUCTION_SINGLE = 15000;

const BRACKETS_2025 = [
  [0, 11925, 0.10], [11925, 48475, 0.12], [48475, 103350, 0.22],
  [103350, 197300, 0.24], [197300, 250525, 0.32], [250525, 626350, 0.35],
  [626350, Infinity, 0.37],
] as const;

function calcFederalTax(taxable: number): number {
  let tax = 0;
  for (const [lower, upper, rate] of BRACKETS_2025) {
    if (taxable > lower) {
      tax += Math.min(taxable - lower, upper - lower) * rate;
    }
  }
  return Math.round(tax * 100) / 100;
}

function calcSelfEmploymentTax(netProfit: number): { seTax: number; deduction: number } {
  const seEarnings = netProfit * 0.9235; // 92.35% of net SE earnings
  const ssSE = Math.min(seEarnings, SS_WAGE_BASE_2025) * SS_RATE;
  const medicareSE = seEarnings * MEDICARE_RATE;
  const additionalMedicare = seEarnings > 200000 ? (seEarnings - 200000) * 0.009 : 0;
  const seTax = Math.round((ssSE + medicareSE + additionalMedicare) * 100) / 100;
  const deduction = Math.round(seTax / 2 * 100) / 100; // Deductible half of SE tax
  return { seTax, deduction };
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
    return [
      {
        id: 'business_income',
        title: 'Part I — Income (Schedule C)',
        fields: [
          { id: 'gross_receipts', label: 'Gross receipts or sales', officialLabel: 'Line 1', type: 'currency', editable: true, required: true, autoPopulateFrom: 'income_total' },
          { id: 'returns_allowances', label: 'Returns and allowances', officialLabel: 'Line 2', type: 'currency', editable: true, required: false },
          { id: 'cost_of_goods_sold', label: 'Cost of goods sold', officialLabel: 'Line 4', type: 'currency', editable: true, required: false, autoPopulateFrom: 'expenses_cogs' },
          { id: 'gross_income', label: 'Gross income', officialLabel: 'Line 7', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'expenses',
        title: 'Part II — Expenses (Schedule C)',
        fields: [
          { id: 'advertising', label: 'Advertising', officialLabel: 'Line 8', type: 'currency', editable: true, required: false },
          { id: 'car_truck', label: 'Car and truck expenses', officialLabel: 'Line 9', type: 'currency', editable: true, required: false, helpText: 'Standard mileage rate: 70¢/mile (2025)' },
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
          { id: 'home_office_sqft', label: 'Home office square footage', type: 'integer', editable: true, required: false, helpText: 'Simplified method: $5/sqft, max 300 sqft = $1,500' },
          { id: 'home_office_deduction', label: 'Home office deduction', type: 'currency', calculated: true, editable: true, required: false },
        ],
      },
      {
        id: 'tax_calc',
        title: 'Tax Computation',
        fields: [
          { id: 'adjusted_gross_income', label: 'Adjusted Gross Income (AGI)', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'standard_deduction', label: 'Standard deduction', type: 'currency', calculated: true, editable: false, required: true, helpText: '$15,000 single / $30,000 MFJ (2025)' },
          { id: 'taxable_income', label: 'Taxable income', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'federal_tax', label: 'Federal income tax', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'self_employment_tax', label: 'Self-employment tax (15.3%)', type: 'currency', calculated: true, editable: false, required: true, helpText: '12.4% Social Security (up to $176,100) + 2.9% Medicare' },
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
          { id: 'quarterly_estimated', label: 'Suggested quarterly estimated payment', type: 'currency', calculated: true, editable: false, required: false, helpText: 'Total tax ÷ 4 for equal quarterly payments' },
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
    const grossReceipts = Number(v.gross_receipts) || 0;
    const returns = Number(v.returns_allowances) || 0;
    const cogs = Number(v.cost_of_goods_sold) || 0;
    const gross_income = grossReceipts - returns - cogs;

    const expenseFields = ['advertising', 'car_truck', 'contract_labor', 'insurance', 'interest_mortgage',
      'interest_other', 'office_expense', 'rent_lease', 'supplies', 'utilities', 'other_expenses'];
    const total_expenses = expenseFields.reduce((sum, f) => sum + (Number(v[f]) || 0), 0);

    const homeOfficeSqft = Math.min(Number(v.home_office_sqft) || 0, 300);
    const home_office_calc = homeOfficeSqft * 5;
    const home_office_deduction = (v.home_office_deduction !== '' && v.home_office_deduction !== undefined && v.home_office_deduction !== null)
      ? Number(v.home_office_deduction) : home_office_calc;

    const net_profit_loss = gross_income - total_expenses - home_office_deduction;

    const { seTax, deduction: seDeduction } = calcSelfEmploymentTax(Math.max(0, net_profit_loss));
    const adjusted_gross_income = net_profit_loss - seDeduction;
    const standard_deduction = STD_DEDUCTION_SINGLE;
    const taxable_income = Math.max(0, adjusted_gross_income - standard_deduction);
    const federal_tax = calcFederalTax(taxable_income);
    const total_tax = Math.round((federal_tax + seTax) * 100) / 100;

    const estimated = Number(v.estimated_payments) || 0;
    const withholding = Number(v.withholding) || 0;
    const balance_due = Math.round((total_tax - estimated - withholding) * 100) / 100;
    const quarterly_estimated = Math.round(total_tax / 4 * 100) / 100;

    return {
      gross_income, total_expenses, home_office_deduction: home_office_calc,
      net_profit_loss, adjusted_gross_income, standard_deduction, taxable_income,
      federal_tax, self_employment_tax: seTax, total_tax, balance_due, quarterly_estimated,
    };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'gross_receipts', aggregateKey: 'income_total' },
    { fieldId: 'cost_of_goods_sold', aggregateKey: 'expenses_cogs' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    if (Number(v.gross_receipts) < 0) r.push({ fieldId: 'gross_receipts', message: 'Gross receipts cannot be negative', severity: 'error' });
    return r;
  },
  getFieldHelp: () => null,

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v) {
    return { data: JSON.stringify(v, null, 2), filename: `ScheduleC-US-${new Date().toISOString().slice(0, 10)}.json`, mimeType: 'application/json' };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://www.irs.gov/filing/e-file-options', submissionMethod: 'manual_upload' as const, apiReady: false }),
  hasSubJurisdictions: () => true,
  getSubJurisdictions: () => US_STATES,
  supportsCustomFields: () => false,
};

export default usItPlugin;
