/**
 * South Korea VAT Return (부가가치세 신고서) - ai2fin.com
 * National Tax Service (NTS / 국세청)
 * Reference: https://www.hometax.go.kr
 * ARCHITECTURE: Single rate 10%. FY Jan-Dec. Quarterly filing with preliminary in months 1,3.
 *   Two filing types: Regular (확정신고) Jan/Jul, Preliminary (예정신고) Apr/Oct.
 *   E-tax invoice (전자세금계산서) mandatory for corps + individuals above threshold.
 */

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
} from '../types';

const KR_RATE = 0.10;

const krPlugin: TaxFilingPlugin = {
  countryCode: 'KR',
  displayName: 'VAT Return (부가가치세 신고서)',
  shortName: 'VAT Return',
  authority: {
    name: 'NTS',
    fullName: 'National Tax Service (국세청)',
    portalUrl: 'https://www.hometax.go.kr',
    helpUrl: 'https://www.nts.go.kr/english/main.do',
  },
  taxFamily: 'VAT',
  isFullPlugin: true,

  getFormSchema(): FormSection[] {
    return [
      {
        id: 'sales',
        title: 'Sales (매출)',
        fields: [
          { id: 'taxable_sales', label: 'Taxable sales (과세 매출)', type: 'currency', editable: true, required: true, autoPopulateFrom: 'income_taxable', helpText: 'Total taxable sales excl. VAT' },
          { id: 'zero_rated_sales', label: 'Zero-rated sales (영세율 매출)', type: 'currency', editable: true, required: false, helpText: 'Exports, international services' },
          { id: 'exempt_sales', label: 'VAT-exempt sales (면세 매출)', type: 'currency', editable: true, required: false, helpText: 'Basic necessities, medical, education, financial services' },
          { id: 'output_vat', label: 'Output VAT (매출세액)', type: 'currency', calculated: true, editable: true, required: true, helpText: 'Taxable sales × 10%' },
        ],
      },
      {
        id: 'purchases',
        title: 'Purchases (매입)',
        fields: [
          { id: 'taxable_purchases', label: 'Taxable purchases (과세 매입)', type: 'currency', editable: true, required: true, autoPopulateFrom: 'expenses_taxable', helpText: 'Total business purchases with e-tax invoices' },
          { id: 'input_vat', label: 'Input VAT (매입세액)', type: 'currency', calculated: true, editable: true, required: true, autoPopulateFrom: 'input_tax', helpText: 'Taxable purchases × 10%' },
          { id: 'input_denied', label: 'Non-deductible input VAT (불공제 매입세액)', type: 'currency', editable: true, required: false, helpText: 'Entertainment, personal use, exempt-supply-related purchases' },
        ],
      },
      {
        id: 'adjustments',
        title: 'Adjustments (가감조정)',
        collapsed: true,
        fields: [
          { id: 'credit_card_sales', label: 'Credit card sales deduction', type: 'currency', editable: true, required: false, helpText: 'Tax credit for small businesses accepting credit cards (1.3%)' },
          { id: 'electronic_invoice_credit', label: 'E-tax invoice transmission credit', type: 'currency', editable: true, required: false, helpText: 'KRW 200 per invoice (individuals only, max KRW 1M/year)' },
          { id: 'other_adjustments', label: 'Other adjustments', type: 'currency', editable: true, required: false },
        ],
      },
      {
        id: 'summary',
        title: 'Tax Payable Summary (납부세액)',
        fields: [
          { id: 'net_vat', label: 'Net VAT payable / refundable', type: 'currency', calculated: true, editable: false, required: true, helpText: 'Output VAT − deductible input VAT − adjustments. Positive = pay. Negative = refund.' },
          { id: 'preliminary_paid', label: 'Preliminary tax paid (예정신고 납부세액)', type: 'currency', editable: true, required: false },
          { id: 'balance_due', label: 'Balance due', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({ monthly: false, quarterly: true, annual: false, defaultFrequency: 'quarterly' }),
  getFinancialYearBounds: (y) => ({ start: new Date(y, 0, 1), end: new Date(y, 11, 31) }),

  getTerminology: () => ({
    taxName: 'VAT', taxAbbrev: '부가세',
    salesLabel: 'Sales (매출)', purchasesLabel: 'Purchases (매입)',
    outputTaxLabel: 'Output VAT', inputTaxLabel: 'Input VAT',
  }),

  calculateFields(v: FieldValues): CalculatedFields {
    const taxableSales = Number(v.taxable_sales) || 0;
    const taxablePurch = Number(v.taxable_purchases) || 0;
    const inputDenied = Number(v.input_denied) || 0;
    const creditCard = Number(v.credit_card_sales) || 0;
    const eInvoiceCredit = Number(v.electronic_invoice_credit) || 0;
    const otherAdj = Number(v.other_adjustments) || 0;
    const prelimPaid = Number(v.preliminary_paid) || 0;

    const output_vat = Math.round(taxableSales * KR_RATE);
    const input_vat_calc = Math.round(taxablePurch * KR_RATE);
    const deductible_input = input_vat_calc - inputDenied;
    const adjustments = creditCard + eInvoiceCredit + otherAdj;

    const net_vat = output_vat - deductible_input - adjustments;
    const balance_due = net_vat - prelimPaid;

    return { output_vat, input_vat: input_vat_calc, net_vat, balance_due };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'taxable_sales', aggregateKey: 'income_taxable' },
    { fieldId: 'taxable_purchases', aggregateKey: 'expenses_taxable' },
    { fieldId: 'input_vat', aggregateKey: 'input_tax' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 0, wholeOnly: true }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    if (Number(v.taxable_sales) < 0) r.push({ fieldId: 'taxable_sales', message: 'Sales cannot be negative', severity: 'error' });
    const inputDenied = Number(v.input_denied) || 0;
    const inputVat = Number(v.input_vat) || (Number(v.taxable_purchases) || 0) * KR_RATE;
    if (inputDenied > inputVat) r.push({ fieldId: 'input_denied', message: 'Non-deductible amount exceeds total input VAT', severity: 'warning' });
    return r;
  },

  getFieldHelp: (id) => {
    const h: Record<string, string> = {
      taxable_sales: 'Report sales excl. VAT. Include all taxable supplies for the quarter.',
      input_denied: 'Certain inputs are non-deductible: entertainment >KRW 10K without receipt, personal-use purchases, exempt-supply-related inputs.',
    };
    return h[id] ?? null;
  },

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v) {
    return { data: JSON.stringify(v, null, 2), filename: `VAT-KR-${new Date().toISOString().slice(0, 10)}.json`, mimeType: 'application/json' };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://www.hometax.go.kr', submissionMethod: 'manual_upload' as const, apiReady: false }),
  hasSubJurisdictions: () => false,
  supportsCustomFields: () => false,
};

export default krPlugin;
