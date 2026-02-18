/**
 * USA Tax Filing Plugin: Form 941 + State Sales Tax - ai2fin.com
 * IRS Form 941: Employer's Quarterly Federal Tax Return
 * Reference: https://www.irs.gov/forms-pubs/about-form-941
 * ARCHITECTURE: Hybrid tax family — federal payroll tax (941) + optional state sales tax.
 *   Social Security: 6.2% employer + 6.2% employee = 12.4% total
 *   Medicare: 1.45% employer + 1.45% employee = 2.9% total
 *   Additional Medicare: 0.9% on wages > $200K (employee only)
 *   Financial year: Jan-Dec. Quarterly filing (Q1-Q4).
 *   50 states + DC as sub-jurisdictions with varying sales tax rates.
 */

import type {
  TaxFilingPlugin,
  FormSection,
  FieldValues,
  CalculatedFields,
  AggregationMapping,
  ValidationResult,
  RoundingConfig,
  ExportFormat,
  ExportOutput,
  SubJurisdiction,
} from '../types';

const SS_RATE = 0.124; // Combined employer + employee
const MEDICARE_RATE = 0.029; // Combined
const SS_WAGE_BASE_2026 = 176100; // Estimated 2026 SS wage base - ai2fin.com

const US_STATES: SubJurisdiction[] = [
  { code: 'AL', name: 'Alabama', rate: 0.04 },
  { code: 'AK', name: 'Alaska', rate: 0 },
  { code: 'AZ', name: 'Arizona', rate: 0.056 },
  { code: 'AR', name: 'Arkansas', rate: 0.065 },
  { code: 'CA', name: 'California', rate: 0.0725 },
  { code: 'CO', name: 'Colorado', rate: 0.029 },
  { code: 'CT', name: 'Connecticut', rate: 0.0635 },
  { code: 'DE', name: 'Delaware', rate: 0 },
  { code: 'FL', name: 'Florida', rate: 0.06 },
  { code: 'GA', name: 'Georgia', rate: 0.04 },
  { code: 'HI', name: 'Hawaii', rate: 0.04 },
  { code: 'ID', name: 'Idaho', rate: 0.06 },
  { code: 'IL', name: 'Illinois', rate: 0.0625 },
  { code: 'IN', name: 'Indiana', rate: 0.07 },
  { code: 'IA', name: 'Iowa', rate: 0.06 },
  { code: 'KS', name: 'Kansas', rate: 0.065 },
  { code: 'KY', name: 'Kentucky', rate: 0.06 },
  { code: 'LA', name: 'Louisiana', rate: 0.0445 },
  { code: 'ME', name: 'Maine', rate: 0.055 },
  { code: 'MD', name: 'Maryland', rate: 0.06 },
  { code: 'MA', name: 'Massachusetts', rate: 0.0625 },
  { code: 'MI', name: 'Michigan', rate: 0.06 },
  { code: 'MN', name: 'Minnesota', rate: 0.06875 },
  { code: 'MS', name: 'Mississippi', rate: 0.07 },
  { code: 'MO', name: 'Missouri', rate: 0.04225 },
  { code: 'MT', name: 'Montana', rate: 0 },
  { code: 'NE', name: 'Nebraska', rate: 0.055 },
  { code: 'NV', name: 'Nevada', rate: 0.0685 },
  { code: 'NH', name: 'New Hampshire', rate: 0 },
  { code: 'NJ', name: 'New Jersey', rate: 0.06625 },
  { code: 'NM', name: 'New Mexico', rate: 0.05125 },
  { code: 'NY', name: 'New York', rate: 0.04 },
  { code: 'NC', name: 'North Carolina', rate: 0.0475 },
  { code: 'ND', name: 'North Dakota', rate: 0.05 },
  { code: 'OH', name: 'Ohio', rate: 0.0575 },
  { code: 'OK', name: 'Oklahoma', rate: 0.045 },
  { code: 'OR', name: 'Oregon', rate: 0 },
  { code: 'PA', name: 'Pennsylvania', rate: 0.06 },
  { code: 'RI', name: 'Rhode Island', rate: 0.07 },
  { code: 'SC', name: 'South Carolina', rate: 0.06 },
  { code: 'SD', name: 'South Dakota', rate: 0.042 },
  { code: 'TN', name: 'Tennessee', rate: 0.07 },
  { code: 'TX', name: 'Texas', rate: 0.0625 },
  { code: 'UT', name: 'Utah', rate: 0.0485 },
  { code: 'VT', name: 'Vermont', rate: 0.06 },
  { code: 'VA', name: 'Virginia', rate: 0.053 },
  { code: 'WA', name: 'Washington', rate: 0.065 },
  { code: 'WV', name: 'West Virginia', rate: 0.06 },
  { code: 'WI', name: 'Wisconsin', rate: 0.05 },
  { code: 'WY', name: 'Wyoming', rate: 0.04 },
  { code: 'DC', name: 'District of Columbia', rate: 0.06 },
];

const usPlugin: TaxFilingPlugin = {
  countryCode: 'US',
  displayName: "Form 941 — Employer's Quarterly Federal Tax Return",
  shortName: 'Form 941',
  authority: {
    name: 'IRS',
    fullName: 'Internal Revenue Service',
    portalUrl: 'https://www.irs.gov',
    helpUrl: 'https://www.irs.gov/instructions/i941',
  },
  taxFamily: 'HYBRID',
  isFullPlugin: true,

  getFormSchema(opts) {
    const sections: FormSection[] = [
      {
        id: 'part1',
        title: 'Part 1 — Wages, Tips, and Federal Tax',
        description: 'Answer these questions for this quarter.',
        fields: [
          {
            id: 'line1',
            label: 'Number of employees who received wages this quarter',
            officialLabel: 'Line 1',
            type: 'integer',
            editable: true,
            required: true,
            helpText: 'Count of employees (full + part-time) paid this quarter',
          },
          {
            id: 'line2',
            label: 'Wages, tips, and other compensation',
            officialLabel: 'Line 2',
            type: 'currency',
            editable: true,
            required: true,
            autoPopulateFrom: 'payroll_wages',
            helpText: 'Total gross wages and compensation paid',
          },
          {
            id: 'line3',
            label: 'Federal income tax withheld',
            officialLabel: 'Line 3',
            type: 'currency',
            editable: true,
            required: true,
            autoPopulateFrom: 'payroll_federal_withheld',
            helpText: 'Federal income tax you withheld from employee wages',
          },
        ],
      },
      {
        id: 'social_security',
        title: 'Social Security and Medicare',
        fields: [
          {
            id: 'line5a_wages',
            label: 'Taxable Social Security wages',
            officialLabel: 'Line 5a – wages',
            type: 'currency',
            editable: true,
            required: true,
            helpText: 'Wages subject to Social Security tax (up to wage base)',
          },
          {
            id: 'line5a_tax',
            label: 'Social Security tax (12.4%)',
            officialLabel: 'Line 5a – tax',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
          },
          {
            id: 'line5c_wages',
            label: 'Taxable Medicare wages',
            officialLabel: 'Line 5c – wages',
            type: 'currency',
            editable: true,
            required: true,
            helpText: 'All wages subject to Medicare tax (no cap)',
          },
          {
            id: 'line5c_tax',
            label: 'Medicare tax (2.9%)',
            officialLabel: 'Line 5c – tax',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
          },
          {
            id: 'line5d_wages',
            label: 'Taxable wages for Additional Medicare (over $200K)',
            officialLabel: 'Line 5d – wages',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Employee wages over $200K subject to 0.9% additional Medicare',
          },
          {
            id: 'line5d_tax',
            label: 'Additional Medicare tax (0.9%)',
            officialLabel: 'Line 5d – tax',
            type: 'currency',
            calculated: true,
            editable: false,
            required: false,
          },
          {
            id: 'line5b_wages',
            label: 'Taxable Social Security tips',
            officialLabel: 'Line 5b – wages',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Tips subject to Social Security tax (restaurant/hospitality)',
          },
          {
            id: 'line5b_tax',
            label: 'Social Security tax on tips (12.4%)',
            officialLabel: 'Line 5b – tax',
            type: 'currency',
            calculated: true,
            editable: false,
            required: false,
          },
          {
            id: 'line5e',
            label: 'Total Social Security and Medicare taxes (5a + 5b + 5c + 5d)',
            officialLabel: 'Line 5e',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
          },
        ],
      },
      {
        id: 'adjustments',
        title: 'Adjustments and Credits',
        collapsed: true,
        fields: [
          {
            id: 'line7',
            label: "Current quarter's adjustment for fractions of cents",
            officialLabel: 'Line 7',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: 'line8',
            label: "Current quarter's adjustment for sick pay",
            officialLabel: 'Line 8',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: 'line9',
            label: "Current quarter's adjustment for tips",
            officialLabel: 'Line 9',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: 'line11a',
            label: 'Qualified small business payroll tax credit',
            officialLabel: 'Line 11a',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: 'line11b',
            label: 'Nonrefundable portion of credit',
            officialLabel: 'Line 11b',
            type: 'currency',
            editable: true,
            required: false,
          },
        ],
      },
      {
        id: 'totals',
        title: 'Total Taxes',
        fields: [
          {
            id: 'line6',
            label: 'Total taxes before adjustments (Line 3 + 5e)',
            officialLabel: 'Line 6',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
          },
          {
            id: 'line10',
            label: 'Total taxes after adjustments (Line 6 + 7 + 8 + 9)',
            officialLabel: 'Line 10',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
          },
          {
            id: 'line12',
            label: 'Total taxes after adjustments and credits',
            officialLabel: 'Line 12',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
            helpText: 'Line 10 + adjustments (7+8+9) − credits (11b)',
          },
          {
            id: 'line13',
            label: 'Total deposits for this quarter',
            officialLabel: 'Line 13',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Federal tax deposits already made via EFTPS',
          },
          {
            id: 'line14',
            label: 'Balance due (Line 12 − Line 13)',
            officialLabel: 'Line 14',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
            helpText: 'Positive = amount you owe. Negative = overpayment.',
          },
        ],
      },
      {
        id: 'state_sales',
        title: 'State Sales Tax Summary (optional)',
        description: 'If your business collects state sales tax, summarize here.',
        collapsed: true,
        fields: [
          {
            id: 'state_code',
            label: 'State',
            type: 'select',
            editable: true,
            required: false,
            selectOptions: US_STATES.map((s) => ({
              value: s.code,
              label: `${s.name} (${(s.rate! * 100).toFixed(2)}%)`,
            })),
          },
          {
            id: 'state_taxable_sales',
            label: 'Taxable sales for the period',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: 'state_tax_collected',
            label: 'Sales tax collected',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: 'state_tax_due',
            label: 'Sales tax due to state',
            type: 'currency',
            calculated: true,
            editable: false,
            required: false,
          },
        ],
      },
    ];
    return sections;
  },

  getFilingPeriods: () => ({
    monthly: false,
    quarterly: true,
    annual: false,
    defaultFrequency: 'quarterly',
  }),

  getFinancialYearBounds: (y) => ({
    start: new Date(y, 0, 1),
    end: new Date(y, 11, 31),
  }),

  getTerminology: () => ({
    taxName: 'Payroll Tax',
    taxAbbrev: '941',
    salesLabel: 'Wages',
    purchasesLabel: 'Withholding',
    outputTaxLabel: 'Employment taxes',
    inputTaxLabel: 'Deposits',
  }),

  calculateFields(v: FieldValues) {
    const l2 = Number(v.line2) || 0;
    const l3 = Number(v.line3) || 0;
    const l5a_wages = Number(v.line5a_wages) || Math.min(l2, SS_WAGE_BASE_2026);
    const l5b_wages = Number(v.line5b_wages) || 0;
    const l5c_wages = Number(v.line5c_wages) || l2;
    const l5d_wages = Number(v.line5d_wages) || 0;

    const r2 = (n: number) => Math.round(n * 100) / 100;

    const line5a_tax = r2(l5a_wages * SS_RATE);
    const line5b_tax = r2(l5b_wages * SS_RATE);
    const line5c_tax = r2(l5c_wages * MEDICARE_RATE);
    const line5d_tax = r2(l5d_wages * 0.009);
    const line5e = r2(line5a_tax + line5b_tax + line5c_tax + line5d_tax);

    // IRS Line 6: total taxes before adjustments = Line 3 + Line 5e
    const line6 = r2(l3 + line5e);

    const l7 = Number(v.line7) || 0;
    const l8 = Number(v.line8) || 0;
    const l9 = Number(v.line9) || 0;
    // IRS Line 10: total taxes after adjustments = Line 6 + 7 + 8 + 9
    const line10 = r2(line6 + l7 + l8 + l9);

    const l11b = Number(v.line11b) || 0;
    // IRS Line 12: total after credits = Line 10 - 11b
    const line12 = r2(line10 - l11b);

    const l13 = Number(v.line13) || 0;
    // IRS Line 14: balance due = Line 12 - 13
    const line14 = r2(line12 - l13);

    // State sales tax calculation — ai2fin.com
    const stateCode = String(v.state_code || '');
    const stateSales = Number(v.state_taxable_sales) || 0;
    const stateRate = US_STATES.find((s) => s.code === stateCode)?.rate ?? 0;
    const state_tax_due = r2(stateSales * stateRate);

    return {
      line5a_tax,
      line5b_tax,
      line5c_tax,
      line5d_tax,
      line5e,
      line6,
      line10,
      line12,
      line14,
      state_tax_due,
    };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'line2', aggregateKey: 'payroll_wages' },
    { fieldId: 'line3', aggregateKey: 'payroll_federal_withheld' },
    { fieldId: 'line5a_wages', aggregateKey: 'payroll_ss_wages' },
    { fieldId: 'line5c_wages', aggregateKey: 'payroll_medicare_wages' },
  ],

  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

  validateForm(v: FieldValues): ValidationResult[] {
    const results: ValidationResult[] = [];
    if (Number(v.line1) > 0 && Number(v.line2) === 0) {
      results.push({
        fieldId: 'line2',
        message: 'You have employees but no wages reported',
        severity: 'warning',
      });
    }
    const ssWages = Number(v.line5a_wages) || 0;
    if (ssWages > SS_WAGE_BASE_2026) {
      results.push({
        fieldId: 'line5a_wages',
        message: `Social Security wages exceed the ${new Date().getFullYear()} wage base of $${SS_WAGE_BASE_2026.toLocaleString()}`,
        severity: 'warning',
      });
    }
    return results;
  },

  getFieldHelp: (fieldId) => {
    const help: Record<string, string> = {
      line2: 'Total gross wages, tips, and other compensation paid to all employees this quarter.',
      line3: 'Federal income tax you withheld from employee paychecks. From your payroll records.',
      line5a_tax:
        'Social Security tax: 12.4% (6.2% employer + 6.2% employee) on wages up to wage base.',
      line5c_tax: 'Medicare tax: 2.9% (1.45% employer + 1.45% employee) on all wages. No cap.',
      line12: 'Your total federal employment tax liability for the quarter.',
      line14:
        'Positive = you owe the IRS. Negative = overpayment (apply to next quarter or request refund).',
    };
    return help[fieldId] ?? null;
  },

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],

  async generateExport(v) {
    return {
      data: JSON.stringify(v, null, 2),
      filename: `Form941-US-${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/json',
    };
  },

  getPortalSubmissionInfo: () => ({
    portalUrl: 'https://www.eftps.gov',
    submissionMethod: 'manual_upload' as const,
    apiReady: false,
  }),

  hasSubJurisdictions: () => true,
  getSubJurisdictions: () => US_STATES,
  supportsCustomFields: () => false,
};

export default usPlugin;
