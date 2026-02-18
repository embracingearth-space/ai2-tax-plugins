/**
 * Thailand VAT Return (Form PP30 / ภ.พ.30) - ai2fin.com
 * Revenue Department (กรมสรรพากร)
 * Reference: https://www.rd.go.th
 * ARCHITECTURE: 7% effective rate (legally 10% with temporary reduction). FY: Jan-Dec.
 *   Monthly filing by 15th of following month. E-filing via rd.go.th.
 *   VAT-registered: mandatory for turnover >THB 1.8M/year.
 */

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
} from '../types';

const TH_RATE = 0.07;

const thPlugin: TaxFilingPlugin = {
  countryCode: 'TH',
  displayName: 'VAT Return (Form PP30 / ภ.พ.30)',
  shortName: 'PP30',
  authority: {
    name: 'Revenue Department',
    fullName: 'Revenue Department (กรมสรรพากร)',
    portalUrl: 'https://rdserver.rd.go.th',
    helpUrl: 'https://www.rd.go.th/english/',
  },
  taxFamily: 'VAT',
  isFullPlugin: true,

  getFormSchema(): FormSection[] {
    return [
      {
        id: 'output',
        title: 'Output Tax (ภาษีขาย)',
        fields: [
          { id: 'taxable_sales', label: 'Total taxable sales (ยอดขาย)', type: 'currency', editable: true, required: true, autoPopulateFrom: 'income_taxable', helpText: 'Total value of taxable sales excl. VAT' },
          { id: 'zero_rated_sales', label: 'Zero-rated sales (exports)', type: 'currency', editable: true, required: false },
          { id: 'exempt_sales', label: 'Exempt sales', type: 'currency', editable: true, required: false, helpText: 'Unprocessed agricultural, healthcare, education, domestic transport' },
          { id: 'output_vat', label: 'Output VAT (7%)', type: 'currency', calculated: true, editable: true, required: true },
        ],
      },
      {
        id: 'input',
        title: 'Input Tax (ภาษีซื้อ)',
        fields: [
          { id: 'taxable_purchases', label: 'Total taxable purchases', type: 'currency', editable: true, required: true, autoPopulateFrom: 'expenses_taxable' },
          { id: 'input_vat', label: 'Input VAT claimable', type: 'currency', calculated: true, editable: true, required: true, autoPopulateFrom: 'input_tax', helpText: 'VAT on business purchases with valid tax invoices' },
          { id: 'input_vat_denied', label: 'Non-deductible input VAT', type: 'currency', editable: true, required: false, helpText: 'Entertainment, personal use, passenger vehicles (not for business)' },
        ],
      },
      {
        id: 'summary',
        title: 'Net VAT (ภาษีสุทธิ)',
        fields: [
          { id: 'net_vat', label: 'Net VAT payable / refundable', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'prior_credit', label: 'VAT credit brought forward', type: 'currency', editable: true, required: false },
          { id: 'balance_due', label: 'Balance due / refundable', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({ monthly: true, quarterly: false, annual: false, defaultFrequency: 'monthly' }),
  getFinancialYearBounds: (y) => ({ start: new Date(y, 0, 1), end: new Date(y, 11, 31) }),

  getTerminology: () => ({
    taxName: 'VAT (ภาษีมูลค่าเพิ่ม)', taxAbbrev: 'VAT',
    salesLabel: 'Sales (ยอดขาย)', purchasesLabel: 'Purchases (ยอดซื้อ)',
    outputTaxLabel: 'Output VAT (ภาษีขาย)', inputTaxLabel: 'Input VAT (ภาษีซื้อ)',
  }),

  calculateFields(v: FieldValues): CalculatedFields {
    const taxSales = Number(v.taxable_sales) || 0;
    const taxPurch = Number(v.taxable_purchases) || 0;
    const denied = Number(v.input_vat_denied) || 0;
    const priorCredit = Number(v.prior_credit) || 0;

    const output_vat_calc = Math.round(taxSales * TH_RATE * 100) / 100;
    const output_vat = (v.output_vat !== '' && v.output_vat !== undefined && v.output_vat !== null)
      ? Math.round(Number(v.output_vat) * 100) / 100 : output_vat_calc;

    const input_vat_calc = Math.round(taxPurch * TH_RATE * 100) / 100;
    const input_vat = (v.input_vat !== '' && v.input_vat !== undefined && v.input_vat !== null)
      ? Math.round(Number(v.input_vat) * 100) / 100 : input_vat_calc;

    const net_vat = Math.round((output_vat - (input_vat - denied)) * 100) / 100;
    const balance_due = Math.round((net_vat - priorCredit) * 100) / 100;

    return { output_vat: output_vat_calc, input_vat: input_vat_calc, net_vat, balance_due };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'taxable_sales', aggregateKey: 'income_taxable' },
    { fieldId: 'taxable_purchases', aggregateKey: 'expenses_taxable' },
    { fieldId: 'input_vat', aggregateKey: 'input_tax' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    if (Number(v.taxable_sales) < 0) r.push({ fieldId: 'taxable_sales', message: 'Sales cannot be negative', severity: 'error' });
    return r;
  },
  getFieldHelp: () => null,

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v) {
    return { data: JSON.stringify(v, null, 2), filename: `PP30-TH-${new Date().toISOString().slice(0, 10)}.json`, mimeType: 'application/json' };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://rdserver.rd.go.th', submissionMethod: 'manual_upload' as const, apiReady: false }),
  hasSubJurisdictions: () => false,
  supportsCustomFields: () => false,
};

export default thPlugin;
