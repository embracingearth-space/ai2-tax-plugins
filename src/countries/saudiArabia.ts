/**
 * Saudi Arabia VAT Return - ai2fin.com
 * Zakat, Tax and Customs Authority (ZATCA / هيئة الزكاة والضريبة والجمارك)
 * Reference: https://zatca.gov.sa
 * ARCHITECTURE: 15% rate (from Jul 2020, was 5%). FY: Jan-Dec.
 *   Monthly filing for revenue >SAR 40M, quarterly for <SAR 40M.
 *   E-invoicing (Fatoora / فاتورة) Phase 2 mandatory — real-time clearance.
 *   Zakat (Islamic wealth tax) is separate — not covered here.
 */

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
} from '../types';

const SA_RATE = 0.15;

const saPlugin: TaxFilingPlugin = {
  countryCode: 'SA',
  displayName: 'VAT Return (إقرار ضريبة القيمة المضافة)',
  shortName: 'VAT Return',
  authority: {
    name: 'ZATCA',
    fullName: 'Zakat, Tax and Customs Authority (هيئة الزكاة والضريبة والجمارك)',
    portalUrl: 'https://zatca.gov.sa',
    helpUrl: 'https://zatca.gov.sa/en/eServices/Pages/eServices_009.aspx',
  },
  taxFamily: 'VAT',
  isFullPlugin: true,

  getFormSchema(): FormSection[] {
    return [
      {
        id: 'sales',
        title: 'Sales Subject to VAT (المبيعات الخاضعة)',
        fields: [
          { id: 'standard_sales', label: 'Standard rated domestic sales (15%)', officialLabel: 'Box 1', type: 'currency', editable: true, required: true, autoPopulateFrom: 'income_standard', helpText: 'Sales of goods/services within KSA at 15%' },
          { id: 'private_sales_to_gcc', label: 'Sales to registered customers in GCC', officialLabel: 'Box 2', type: 'currency', editable: true, required: false },
          { id: 'zero_rated_domestic', label: 'Zero-rated domestic sales', officialLabel: 'Box 3', type: 'currency', editable: true, required: false, helpText: 'Medicines, medical equipment, qualifying metals' },
          { id: 'exports', label: 'Exports', officialLabel: 'Box 4', type: 'currency', editable: true, required: false },
          { id: 'exempt_sales', label: 'Exempt sales', officialLabel: 'Box 5', type: 'currency', editable: true, required: false, helpText: 'Financial services, residential rent, life insurance' },
          { id: 'total_sales', label: 'Total sales', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'output_vat', label: 'Total output VAT', officialLabel: 'Box 6', type: 'currency', calculated: true, editable: true, required: true },
        ],
      },
      {
        id: 'purchases',
        title: 'Purchases Subject to VAT (المشتريات الخاضعة)',
        fields: [
          { id: 'standard_purchases', label: 'Standard rated domestic purchases', officialLabel: 'Box 7', type: 'currency', editable: true, required: true, autoPopulateFrom: 'expenses_standard' },
          { id: 'imports_subject_vat', label: 'Imports subject to VAT (paid at customs)', officialLabel: 'Box 8', type: 'currency', editable: true, required: false },
          { id: 'imports_reverse_charge', label: 'Imports subject to VAT (reverse charge)', officialLabel: 'Box 9', type: 'currency', editable: true, required: false },
          { id: 'zero_rated_purchases', label: 'Zero-rated purchases', officialLabel: 'Box 10', type: 'currency', editable: true, required: false },
          { id: 'exempt_purchases', label: 'Exempt purchases', officialLabel: 'Box 11', type: 'currency', editable: true, required: false },
          { id: 'total_purchases', label: 'Total purchases', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'input_vat', label: 'Total input VAT recoverable', officialLabel: 'Box 12', type: 'currency', calculated: true, editable: true, required: true, autoPopulateFrom: 'input_tax' },
        ],
      },
      {
        id: 'corrections',
        title: 'Corrections from Previous Periods',
        collapsed: true,
        fields: [
          { id: 'correction_output', label: 'Output VAT correction', officialLabel: 'Box 13', type: 'currency', editable: true, required: false },
          { id: 'correction_input', label: 'Input VAT correction', officialLabel: 'Box 14', type: 'currency', editable: true, required: false },
        ],
      },
      {
        id: 'summary',
        title: 'Net VAT (صافي ضريبة القيمة المضافة)',
        fields: [
          { id: 'net_vat', label: 'Net VAT due', officialLabel: 'Box 15', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({ monthly: true, quarterly: true, annual: false, defaultFrequency: 'quarterly' }),
  getFinancialYearBounds: (y) => ({ start: new Date(y, 0, 1), end: new Date(y, 11, 31) }),

  getTerminology: () => ({
    taxName: 'VAT (ضريبة القيمة المضافة)', taxAbbrev: 'VAT',
    salesLabel: 'Sales', purchasesLabel: 'Purchases',
    outputTaxLabel: 'Output VAT', inputTaxLabel: 'Input VAT',
  }),

  calculateFields(v: FieldValues): CalculatedFields {
    const std = Number(v.standard_sales) || 0;
    const gcc = Number(v.private_sales_to_gcc) || 0;
    const zrDom = Number(v.zero_rated_domestic) || 0;
    const exp = Number(v.exports) || 0;
    const exempt = Number(v.exempt_sales) || 0;
    const total_sales = std + gcc + zrDom + exp + exempt;

    const output_vat_calc = Math.round((std + gcc) * SA_RATE * 100) / 100;
    const output_vat = (v.output_vat !== '' && v.output_vat !== undefined && v.output_vat !== null)
      ? Math.round(Number(v.output_vat) * 100) / 100 : output_vat_calc;

    const stdP = Number(v.standard_purchases) || 0;
    const impVat = Number(v.imports_subject_vat) || 0;
    const impRC = Number(v.imports_reverse_charge) || 0;
    const zrP = Number(v.zero_rated_purchases) || 0;
    const exP = Number(v.exempt_purchases) || 0;
    const total_purchases = stdP + impVat + impRC + zrP + exP;

    const input_vat_calc = Math.round((stdP + impVat + impRC) * SA_RATE * 100) / 100;
    const input_vat = (v.input_vat !== '' && v.input_vat !== undefined && v.input_vat !== null)
      ? Math.round(Number(v.input_vat) * 100) / 100 : input_vat_calc;

    const corrOut = Number(v.correction_output) || 0;
    const corrIn = Number(v.correction_input) || 0;
    const net_vat = Math.round(((output_vat + corrOut) - (input_vat + corrIn)) * 100) / 100;

    return { total_sales, output_vat: output_vat_calc, total_purchases, input_vat: input_vat_calc, net_vat };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'standard_sales', aggregateKey: 'income_standard' },
    { fieldId: 'standard_purchases', aggregateKey: 'expenses_standard' },
    { fieldId: 'input_vat', aggregateKey: 'input_tax' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    if (Number(v.standard_sales) < 0) r.push({ fieldId: 'standard_sales', message: 'Sales cannot be negative', severity: 'error' });
    return r;
  },
  getFieldHelp: () => null,

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v) {
    return { data: JSON.stringify(v, null, 2), filename: `VAT-SA-${new Date().toISOString().slice(0, 10)}.json`, mimeType: 'application/json' };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://zatca.gov.sa', submissionMethod: 'manual_upload' as const, apiReady: true }),
  hasSubJurisdictions: () => false,
  supportsCustomFields: () => false,
};

export default saPlugin;
