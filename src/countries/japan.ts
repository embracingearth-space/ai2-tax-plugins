/**
 * Japan Consumption Tax Return (消費税及び地方消費税の確定申告書) - ai2fin.com
 * National Tax Agency (NTA / 国税庁)
 * Reference: https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/index.htm
 * ARCHITECTURE: Japan Consumption Tax = national 7.8% + local 2.2% = 10% standard.
 *   Reduced rate: 6.24% national + 1.76% local = 8% (food, beverages, newspapers).
 *   FY: flexible for corps (most use Apr-Mar), individuals = Jan-Dec.
 *   Filing: Annual (with interim payments for larger taxpayers — semi-annual or quarterly).
 *   Invoice System (インボイス制度) mandatory from Oct 2023.
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
} from '../types';

const STANDARD_RATE = 0.10;
const REDUCED_RATE = 0.08;
const NATIONAL_STANDARD = 0.078;
const LOCAL_STANDARD = 0.022;
const NATIONAL_REDUCED = 0.0624;
const LOCAL_REDUCED = 0.0176;

const jpPlugin: TaxFilingPlugin = {
  countryCode: 'JP',
  displayName: 'Consumption Tax Return (消費税申告書)',
  shortName: '消費税',
  authority: {
    name: 'NTA',
    fullName: 'National Tax Agency (国税庁)',
    portalUrl: 'https://www.e-tax.nta.go.jp',
    helpUrl: 'https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/index.htm',
  },
  taxFamily: 'CONSUMPTION_TAX',
  isFullPlugin: true,

  getFormSchema(): FormSection[] {
    return [
      {
        id: 'sales',
        title: 'Taxable Sales (課税売上)',
        description: 'Report taxable sales at standard and reduced rates.',
        fields: [
          { id: 'sales_standard', label: 'Standard-rated sales (10%)', officialLabel: '課税標準額(10%)', type: 'currency', editable: true, required: true, autoPopulateFrom: 'income_standard', helpText: 'Sales of goods/services at 10% (excl. tax)' },
          { id: 'sales_reduced', label: 'Reduced-rated sales (8%)', officialLabel: '課税標準額(8%)', type: 'currency', editable: true, required: false, helpText: 'Food, beverages (excl. dining out), newspapers (2x/week+)' },
          { id: 'sales_exempt', label: 'Exempt sales', officialLabel: '免税売上高', type: 'currency', editable: true, required: false, helpText: 'Exports, international transport, etc.' },
          { id: 'sales_non_taxable', label: 'Non-taxable sales', type: 'currency', editable: true, required: false, helpText: 'Land sales, financial transactions, medical services' },
        ],
      },
      {
        id: 'output_tax',
        title: 'Output Tax (売上に係る消費税額)',
        fields: [
          { id: 'output_national_standard', label: 'National tax on standard-rated sales (7.8%)', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'output_national_reduced', label: 'National tax on reduced-rated sales (6.24%)', type: 'currency', calculated: true, editable: false, required: false },
          { id: 'output_national_total', label: 'Total national consumption tax', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'input_tax',
        title: 'Input Tax Credit (仕入税額控除)',
        description: 'Consumption tax paid on purchases. Requires qualified invoices from Oct 2023.',
        fields: [
          { id: 'purchases_standard', label: 'Purchases at standard rate (10%)', type: 'currency', editable: true, required: true, autoPopulateFrom: 'expenses_standard', helpText: 'Business purchases incl. tax at 10%' },
          { id: 'purchases_reduced', label: 'Purchases at reduced rate (8%)', type: 'currency', editable: true, required: false, helpText: 'Food/beverage purchases incl. tax at 8%' },
          { id: 'input_national_total', label: 'Total input tax credit (national)', type: 'currency', calculated: true, editable: true, required: true, helpText: 'Override if using proportional allocation method' },
        ],
      },
      {
        id: 'summary',
        title: 'Tax Payable Summary (納付税額)',
        fields: [
          { id: 'net_national', label: 'Net national consumption tax', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'local_tax', label: 'Local consumption tax (地方消費税)', type: 'currency', calculated: true, editable: false, required: true, helpText: 'Calculated as national tax × 22/78' },
          { id: 'total_payable', label: 'Total tax payable', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'interim_paid', label: 'Interim payments already made (中間納付税額)', type: 'currency', editable: true, required: false },
          { id: 'balance_due', label: 'Balance due / refundable', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({ monthly: false, quarterly: true, annual: true, defaultFrequency: 'annual' }),
  getFinancialYearBounds: (y) => ({ start: new Date(y, 3, 1), end: new Date(y + 1, 2, 31) }),

  getTerminology: () => ({
    taxName: 'Consumption Tax',
    taxAbbrev: '消費税',
    salesLabel: 'Taxable sales',
    purchasesLabel: 'Taxable purchases',
    outputTaxLabel: 'Output consumption tax',
    inputTaxLabel: 'Input tax credit',
  }),

  calculateFields(v: FieldValues): CalculatedFields {
    const salesStd = Number(v.sales_standard) || 0;
    const salesRed = Number(v.sales_reduced) || 0;
    const purchStd = Number(v.purchases_standard) || 0;
    const purchRed = Number(v.purchases_reduced) || 0;

    const output_national_standard = Math.floor(salesStd * NATIONAL_STANDARD);
    const output_national_reduced = Math.floor(salesRed * NATIONAL_REDUCED);
    const output_national_total = output_national_standard + output_national_reduced;

    const inputStdNational = Math.floor((purchStd * NATIONAL_STANDARD) / (1 + STANDARD_RATE));
    const inputRedNational = Math.floor((purchRed * NATIONAL_REDUCED) / (1 + REDUCED_RATE));
    const input_national_calc = inputStdNational + inputRedNational;

    const input_national_total =
      v.input_national_total !== '' && v.input_national_total !== undefined && v.input_national_total !== null
        ? Math.floor(Number(v.input_national_total))
        : input_national_calc;

    const net_national = Math.max(0, output_national_total - input_national_total);
    // Local tax = national tax × 22/78
    const local_tax = Math.floor(net_national * 22 / 78);
    const total_payable = net_national + local_tax;
    const interim = Number(v.interim_paid) || 0;
    const balance_due = total_payable - interim;

    return {
      output_national_standard, output_national_reduced, output_national_total,
      input_national_total: input_national_calc, net_national, local_tax,
      total_payable, balance_due,
    };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'sales_standard', aggregateKey: 'income_standard' },
    { fieldId: 'purchases_standard', aggregateKey: 'expenses_standard' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'truncate', decimals: 0, wholeOnly: true }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    if (Number(v.sales_standard) < 0) r.push({ fieldId: 'sales_standard', message: 'Sales cannot be negative', severity: 'error' });
    if (Number(v.sales_reduced) < 0) r.push({ fieldId: 'sales_reduced', message: 'Reduced-rate sales cannot be negative', severity: 'error' });
    return r;
  },

  getFieldHelp: (id) => {
    const h: Record<string, string> = {
      sales_standard: 'Report net sales value (excl. consumption tax). Standard rate = 10% since Oct 2019.',
      sales_reduced: 'Reduced rate 8% applies to: food & beverages (excl. dining out/alcohol), newspapers delivered 2+/week.',
      local_tax: 'Local consumption tax is automatically calculated as national tax × 22/78.',
    };
    return h[id] ?? null;
  },

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV (e-Tax format)', mimeType: 'text/csv', fileExtension: 'csv' },
  ],

  async generateExport(v) {
    return { data: JSON.stringify(v, null, 2), filename: `ConsumptionTax-JP-${new Date().toISOString().slice(0, 10)}.json`, mimeType: 'application/json' };
  },

  getPortalSubmissionInfo: () => ({ portalUrl: 'https://www.e-tax.nta.go.jp', submissionMethod: 'manual_upload' as const, apiReady: false }),
  hasSubJurisdictions: () => false,
  supportsCustomFields: () => false,
};

export default jpPlugin;
