/**
 * South Africa VAT201 Return - ai2fin.com
 * South African Revenue Service (SARS)
 * Reference: https://www.sars.gov.za/guide-to-completing-the-value-added-tax-vat201-return/
 * ARCHITECTURE: 15% standard rate (from Apr 2018). FY varies by vendor (commonly Mar-Feb).
 *   Category A: bimonthly (most vendors). Category B: monthly (turnover >R30M).
 *   Category C: 6-monthly (farming). Category D: annual (turnover <R1.5M).
 *   eFiling mandatory for most. PRN auto-generated.
 */

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
} from '../types';

const ZA_RATE = 0.15;

const zaPlugin: TaxFilingPlugin = {
  countryCode: 'ZA',
  displayName: 'VAT201 Return',
  shortName: 'VAT201',
  authority: {
    name: 'SARS',
    fullName: 'South African Revenue Service',
    portalUrl: 'https://www.sarsefiling.co.za',
    helpUrl: 'https://www.sars.gov.za/guide-to-completing-the-value-added-tax-vat201-return/',
  },
  taxFamily: 'VAT',
  isFullPlugin: true,

  getFormSchema(): FormSection[] {
    return [
      {
        id: 'output',
        title: 'Output Tax (VAT Charged on Sales)',
        description: 'VAT collected on supplies made during the tax period.',
        fields: [
          { id: 'standard_supplies', label: 'Standard-rated supplies (15%)', officialLabel: 'Field 1', type: 'currency', editable: true, required: true, autoPopulateFrom: 'income_standard', helpText: 'Total value of standard-rated supplies incl. VAT' },
          { id: 'output_vat', label: 'Output VAT (15/115 of Field 1)', officialLabel: 'Field 4', type: 'currency', calculated: true, editable: true, required: true },
          { id: 'zero_rated_supplies', label: 'Zero-rated supplies', officialLabel: 'Field 2', type: 'currency', editable: true, required: false, helpText: 'Exports, basic foodstuffs (19 items), fuel levy goods' },
          { id: 'exempt_supplies', label: 'Exempt supplies', officialLabel: 'Field 3', type: 'currency', editable: true, required: false, helpText: 'Financial services, residential rent, public transport' },
          { id: 'change_in_use_output', label: 'Change in use — output', officialLabel: 'Field 18', type: 'currency', editable: true, required: false, helpText: 'Assets switched from taxable to non-taxable use' },
          { id: 'other_adjustments_output', label: 'Other adjustments (output)', type: 'currency', editable: true, required: false },
          { id: 'total_output', label: 'Total output tax', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'input',
        title: 'Input Tax (VAT Paid on Purchases)',
        fields: [
          { id: 'capital_goods', label: 'Capital goods and services', officialLabel: 'Field 14', type: 'currency', editable: true, required: false, autoPopulateFrom: 'expenses_capital', helpText: 'Fixed assets purchased for business use' },
          { id: 'other_goods', label: 'Other goods and services', officialLabel: 'Field 15', type: 'currency', editable: true, required: true, autoPopulateFrom: 'expenses_other', helpText: 'Operating expenses, stock, consumables' },
          { id: 'input_vat', label: 'Input VAT claimed', officialLabel: 'Field 17', type: 'currency', calculated: true, editable: true, required: true, autoPopulateFrom: 'input_tax' },
          { id: 'change_in_use_input', label: 'Change in use — input', officialLabel: 'Field 19', type: 'currency', editable: true, required: false },
          { id: 'other_adjustments_input', label: 'Other adjustments (input)', type: 'currency', editable: true, required: false },
          { id: 'total_input', label: 'Total input tax', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'summary',
        title: 'VAT Payable / Refundable',
        fields: [
          { id: 'net_vat', label: 'Net VAT (output − input)', officialLabel: 'Field 20', type: 'currency', calculated: true, editable: false, required: true, helpText: 'Positive = pay SARS. Negative = claim refund.' },
          { id: 'penalties', label: 'Penalties and interest', type: 'currency', editable: true, required: false },
          { id: 'total_payable', label: 'Total amount payable / refundable', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({ monthly: true, quarterly: false, annual: true, defaultFrequency: 'monthly' }),
  getFinancialYearBounds: (y) => ({ start: new Date(y, 2, 1), end: new Date(y + 1, 1, 28) }),

  getTerminology: () => ({
    taxName: 'VAT', taxAbbrev: 'VAT',
    salesLabel: 'Supplies', purchasesLabel: 'Acquisitions',
    outputTaxLabel: 'Output VAT', inputTaxLabel: 'Input VAT',
  }),

  calculateFields(v: FieldValues): CalculatedFields {
    const standardSupplies = Number(v.standard_supplies) || 0;
    const capitalGoods = Number(v.capital_goods) || 0;
    const otherGoods = Number(v.other_goods) || 0;
    const changeOutput = Number(v.change_in_use_output) || 0;
    const adjOutput = Number(v.other_adjustments_output) || 0;
    const changeInput = Number(v.change_in_use_input) || 0;
    const adjInput = Number(v.other_adjustments_input) || 0;
    const penalties = Number(v.penalties) || 0;

    // VAT is inclusive: output VAT = supplies × 15/115
    const output_vat_calc = Math.round(standardSupplies * ZA_RATE / (1 + ZA_RATE) * 100) / 100;
    const output_vat = (v.output_vat !== '' && v.output_vat !== undefined && v.output_vat !== null)
      ? Math.round(Number(v.output_vat) * 100) / 100 : output_vat_calc;
    const total_output = Math.round((output_vat + changeOutput + adjOutput) * 100) / 100;

    // Input VAT: 15/115 of purchases
    const input_vat_calc = Math.round((capitalGoods + otherGoods) * ZA_RATE / (1 + ZA_RATE) * 100) / 100;
    const input_vat = (v.input_vat !== '' && v.input_vat !== undefined && v.input_vat !== null)
      ? Math.round(Number(v.input_vat) * 100) / 100 : input_vat_calc;
    const total_input = Math.round((input_vat + changeInput + adjInput) * 100) / 100;

    const net_vat = Math.round((total_output - total_input) * 100) / 100;
    const total_payable = Math.round((net_vat + penalties) * 100) / 100;

    return { output_vat: output_vat_calc, total_output, input_vat: input_vat_calc, total_input, net_vat, total_payable };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'standard_supplies', aggregateKey: 'income_standard' },
    { fieldId: 'other_goods', aggregateKey: 'expenses_other' },
    { fieldId: 'capital_goods', aggregateKey: 'expenses_capital' },
    { fieldId: 'input_vat', aggregateKey: 'input_tax' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    if (Number(v.standard_supplies) < 0) r.push({ fieldId: 'standard_supplies', message: 'Supplies cannot be negative', severity: 'error' });
    return r;
  },
  getFieldHelp: () => null,

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV (SARS eFiling)', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v) {
    return { data: JSON.stringify(v, null, 2), filename: `VAT201-ZA-${new Date().toISOString().slice(0, 10)}.json`, mimeType: 'application/json' };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://www.sarsefiling.co.za', submissionMethod: 'manual_upload' as const, apiReady: false }),
  hasSubJurisdictions: () => false,
  supportsCustomFields: () => false,
};

export default zaPlugin;
