/**
 * Philippines VAT Return (BIR Form 2550M/Q) - ai2fin.com
 * Bureau of Internal Revenue (BIR)
 * Reference: https://www.bir.gov.ph
 * ARCHITECTURE: 12% standard rate. FY: Jan-Dec.
 *   Monthly (2550M) + Quarterly (2550Q) filing.
 *   E-filing via eFPS (Electronic Filing and Payment System) for large taxpayers.
 *   Withholding VAT (creditable) common on government transactions.
 */

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
} from '../types';

const PH_RATE = 0.12;

const phPlugin: TaxFilingPlugin = {
  countryCode: 'PH',
  displayName: 'VAT Return (BIR Form 2550M/Q)',
  shortName: 'Form 2550',
  authority: {
    name: 'BIR',
    fullName: 'Bureau of Internal Revenue',
    portalUrl: 'https://efps.bir.gov.ph',
    helpUrl: 'https://www.bir.gov.ph/index.php/tax-information/value-added-tax.html',
  },
  taxFamily: 'VAT',
  isFullPlugin: true,

  getFormSchema(): FormSection[] {
    return [
      {
        id: 'output',
        title: 'Output VAT',
        description: 'VAT on sales and receipts.',
        fields: [
          { id: 'vatable_sales', label: 'Vatable sales/receipts', type: 'currency', editable: true, required: true, autoPopulateFrom: 'income_taxable', helpText: 'Sales of goods/services subject to 12% VAT (net of VAT)' },
          { id: 'zero_rated_sales', label: 'Zero-rated sales', type: 'currency', editable: true, required: false, helpText: 'Export sales, BOI-registered, PEZA, ecozones' },
          { id: 'exempt_sales', label: 'VAT-exempt sales', type: 'currency', editable: true, required: false, helpText: 'Agricultural, educational, senior citizen/PWD discounts' },
          { id: 'output_vat', label: 'Output VAT (12%)', type: 'currency', calculated: true, editable: true, required: true },
        ],
      },
      {
        id: 'input',
        title: 'Input VAT',
        fields: [
          { id: 'domestic_purchases_goods', label: 'Domestic purchases of goods', type: 'currency', editable: true, required: true, autoPopulateFrom: 'expenses_goods' },
          { id: 'domestic_purchases_services', label: 'Domestic purchases of services', type: 'currency', editable: true, required: false, autoPopulateFrom: 'expenses_services' },
          { id: 'importation_goods', label: 'Importation of goods', type: 'currency', editable: true, required: false },
          { id: 'domestic_purchases_capital', label: 'Purchases of capital goods', type: 'currency', editable: true, required: false, autoPopulateFrom: 'expenses_capital', helpText: 'Capital goods >PHP 1M may be amortized over 60 months' },
          { id: 'input_vat', label: 'Total input VAT', type: 'currency', calculated: true, editable: true, required: true, autoPopulateFrom: 'input_tax' },
        ],
      },
      {
        id: 'deductions',
        title: 'Deductions from Input VAT',
        collapsed: true,
        fields: [
          { id: 'input_vat_allocable_exempt', label: 'Input VAT allocable to exempt sales', type: 'currency', editable: true, required: false },
          { id: 'vat_withheld', label: 'VAT withheld (creditable)', type: 'currency', editable: true, required: false, helpText: 'VAT withheld by government agencies' },
          { id: 'prior_excess_credits', label: 'Excess input VAT from prior period', type: 'currency', editable: true, required: false },
        ],
      },
      {
        id: 'summary',
        title: 'Tax Due',
        fields: [
          { id: 'net_vat', label: 'Net VAT payable / excess credits', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'surcharge', label: 'Surcharge (25%)', type: 'currency', editable: true, required: false },
          { id: 'interest', label: 'Interest', type: 'currency', editable: true, required: false },
          { id: 'compromise', label: 'Compromise penalty', type: 'currency', editable: true, required: false },
          { id: 'total_due', label: 'Total amount due', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({ monthly: true, quarterly: true, annual: false, defaultFrequency: 'monthly' }),
  getFinancialYearBounds: (y) => ({ start: new Date(y, 0, 1), end: new Date(y, 11, 31) }),

  getTerminology: () => ({
    taxName: 'VAT', taxAbbrev: 'VAT',
    salesLabel: 'Vatable sales', purchasesLabel: 'Vatable purchases',
    outputTaxLabel: 'Output VAT', inputTaxLabel: 'Input VAT',
  }),

  calculateFields(v: FieldValues): CalculatedFields {
    const vatableSales = Number(v.vatable_sales) || 0;
    const dGoods = Number(v.domestic_purchases_goods) || 0;
    const dServices = Number(v.domestic_purchases_services) || 0;
    const imports = Number(v.importation_goods) || 0;
    const capital = Number(v.domestic_purchases_capital) || 0;
    const allocExempt = Number(v.input_vat_allocable_exempt) || 0;
    const withheld = Number(v.vat_withheld) || 0;
    const priorExcess = Number(v.prior_excess_credits) || 0;

    const output_vat_calc = Math.round(vatableSales * PH_RATE * 100) / 100;
    const output_vat = (v.output_vat !== '' && v.output_vat !== undefined && v.output_vat !== null)
      ? Math.round(Number(v.output_vat) * 100) / 100 : output_vat_calc;

    const input_vat_calc = Math.round((dGoods + dServices + imports + capital) * PH_RATE * 100) / 100;
    const input_vat = (v.input_vat !== '' && v.input_vat !== undefined && v.input_vat !== null)
      ? Math.round(Number(v.input_vat) * 100) / 100 : input_vat_calc;

    const deductible_input = input_vat - allocExempt + priorExcess;
    const net_vat = Math.round((output_vat - deductible_input - withheld) * 100) / 100;

    const surcharge = Number(v.surcharge) || 0;
    const interest = Number(v.interest) || 0;
    const compromise = Number(v.compromise) || 0;
    const total_due = Math.round((Math.max(0, net_vat) + surcharge + interest + compromise) * 100) / 100;

    return { output_vat: output_vat_calc, input_vat: input_vat_calc, net_vat, total_due };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'vatable_sales', aggregateKey: 'income_taxable' },
    { fieldId: 'domestic_purchases_goods', aggregateKey: 'expenses_goods' },
    { fieldId: 'domestic_purchases_services', aggregateKey: 'expenses_services' },
    { fieldId: 'input_vat', aggregateKey: 'input_tax' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    if (Number(v.vatable_sales) < 0) r.push({ fieldId: 'vatable_sales', message: 'Sales cannot be negative', severity: 'error' });
    return r;
  },
  getFieldHelp: () => null,

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v) {
    return { data: JSON.stringify(v, null, 2), filename: `BIR2550-PH-${new Date().toISOString().slice(0, 10)}.json`, mimeType: 'application/json' };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://efps.bir.gov.ph', submissionMethod: 'manual_upload' as const, apiReady: false }),
  hasSubJurisdictions: () => false,
  supportsCustomFields: () => false,
};

export default phPlugin;
