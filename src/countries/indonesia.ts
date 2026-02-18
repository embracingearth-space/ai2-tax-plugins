/**
 * Indonesia VAT Return (SPT Masa PPN / Form 1111) - ai2fin.com
 * Directorate General of Taxes (DJP / Direktorat Jenderal Pajak)
 * Reference: https://djponline.pajak.go.id
 * ARCHITECTURE: 11% standard rate (12% for luxury goods from Jan 2025). FY: Jan-Dec.
 *   Monthly filing by 20th of following month. e-Faktur mandatory for all PKP.
 *   "PKP" = Pengusaha Kena Pajak (VAT-registered entrepreneur), mandatory >IDR 4.8B/year.
 */

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
} from '../types';

const ID_RATE = 0.11;

const idPlugin: TaxFilingPlugin = {
  countryCode: 'ID',
  displayName: 'SPT Masa PPN (VAT Monthly Return)',
  shortName: 'SPT PPN',
  authority: {
    name: 'DJP',
    fullName: 'Direktorat Jenderal Pajak',
    portalUrl: 'https://djponline.pajak.go.id',
    helpUrl: 'https://www.pajak.go.id',
  },
  taxFamily: 'VAT',
  isFullPlugin: true,

  getFormSchema(): FormSection[] {
    return [
      {
        id: 'output',
        title: 'Output VAT (Pajak Keluaran)',
        fields: [
          { id: 'domestic_delivery', label: 'Domestic delivery of taxable goods/services (Penyerahan Dalam Negeri)', type: 'currency', editable: true, required: true, autoPopulateFrom: 'income_taxable', helpText: 'Sales of goods/services at 11% (excl. VAT)' },
          { id: 'export_goods', label: 'Export of taxable goods', type: 'currency', editable: true, required: false },
          { id: 'export_services', label: 'Export of taxable services', type: 'currency', editable: true, required: false },
          { id: 'exempt_delivery', label: 'Non-taxable / exempt delivery', type: 'currency', editable: true, required: false, helpText: 'Basic necessities, healthcare, education, financial services' },
          { id: 'output_vat', label: 'Output VAT (PPN Keluaran)', type: 'currency', calculated: true, editable: true, required: true },
        ],
      },
      {
        id: 'input',
        title: 'Input VAT (Pajak Masukan)',
        fields: [
          { id: 'domestic_acquisition', label: 'Domestic acquisition of goods/services', type: 'currency', editable: true, required: true, autoPopulateFrom: 'expenses_taxable', helpText: 'Business purchases with valid e-Faktur' },
          { id: 'import_goods', label: 'Import of taxable goods', type: 'currency', editable: true, required: false },
          { id: 'input_vat', label: 'Input VAT (PPN Masukan)', type: 'currency', calculated: true, editable: true, required: true, autoPopulateFrom: 'input_tax' },
          { id: 'input_vat_non_creditable', label: 'Non-creditable input VAT', type: 'currency', editable: true, required: false, helpText: 'Input VAT related to exempt deliveries, entertainment, company car for directors' },
        ],
      },
      {
        id: 'summary',
        title: 'VAT Payable (PPN yang harus dibayar)',
        fields: [
          { id: 'net_vat', label: 'VAT payable / overpaid', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'prior_overpayment', label: 'Overpayment from prior period (Lebih Bayar bulan lalu)', type: 'currency', editable: true, required: false },
          { id: 'balance_due', label: 'Balance due / to be refunded', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({ monthly: true, quarterly: false, annual: false, defaultFrequency: 'monthly' }),
  getFinancialYearBounds: (y) => ({ start: new Date(y, 0, 1), end: new Date(y, 11, 31) }),

  getTerminology: () => ({
    taxName: 'PPN (Pajak Pertambahan Nilai)', taxAbbrev: 'PPN',
    salesLabel: 'Penyerahan (Delivery)', purchasesLabel: 'Perolehan (Acquisition)',
    outputTaxLabel: 'Pajak Keluaran', inputTaxLabel: 'Pajak Masukan',
  }),

  calculateFields(v: FieldValues): CalculatedFields {
    const domestic = Number(v.domestic_delivery) || 0;
    const domAcq = Number(v.domestic_acquisition) || 0;
    const importG = Number(v.import_goods) || 0;
    const nonCred = Number(v.input_vat_non_creditable) || 0;
    const prior = Number(v.prior_overpayment) || 0;

    const output_vat_calc = Math.round(domestic * ID_RATE);
    const output_vat = (v.output_vat !== '' && v.output_vat !== undefined && v.output_vat !== null)
      ? Math.round(Number(v.output_vat)) : output_vat_calc;

    const input_vat_calc = Math.round((domAcq + importG) * ID_RATE);
    const input_vat = (v.input_vat !== '' && v.input_vat !== undefined && v.input_vat !== null)
      ? Math.round(Number(v.input_vat)) : input_vat_calc;

    const creditable_input = input_vat - nonCred;
    const net_vat = output_vat - creditable_input;
    const balance_due = net_vat - prior;

    return { output_vat: output_vat_calc, input_vat: input_vat_calc, net_vat, balance_due };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'domestic_delivery', aggregateKey: 'income_taxable' },
    { fieldId: 'domestic_acquisition', aggregateKey: 'expenses_taxable' },
    { fieldId: 'input_vat', aggregateKey: 'input_tax' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 0, wholeOnly: true }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    if (Number(v.domestic_delivery) < 0) r.push({ fieldId: 'domestic_delivery', message: 'Delivery value cannot be negative', severity: 'error' });
    return r;
  },
  getFieldHelp: () => null,

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV (e-Faktur format)', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v) {
    return { data: JSON.stringify(v, null, 2), filename: `SPT-PPN-ID-${new Date().toISOString().slice(0, 10)}.json`, mimeType: 'application/json' };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://djponline.pajak.go.id', submissionMethod: 'manual_upload' as const, apiReady: false }),
  hasSubJurisdictions: () => false,
  supportsCustomFields: () => false,
};

export default idPlugin;
