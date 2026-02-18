/**
 * UAE VAT Return (Form 201) - ai2fin.com
 * Federal Tax Authority (FTA)
 * Reference: https://tax.gov.ae / https://www.cleartax.com/ae/vat-return-form-201
 * ARCHITECTURE: 5% standard rate (from Jan 2018). FY: Jan-Dec.
 *   Quarterly filing (standard), monthly for large businesses (>AED 150M revenue).
 *   No corporate income tax until Jun 2023 (9% now, but this plugin is VAT only).
 *   Designated zones (free zones) may qualify for 0% on goods.
 */

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
} from '../types';

const AE_RATE = 0.05;

const aePlugin: TaxFilingPlugin = {
  countryCode: 'AE',
  displayName: 'VAT Return (Form 201)',
  shortName: 'VAT 201',
  authority: {
    name: 'FTA',
    fullName: 'Federal Tax Authority',
    portalUrl: 'https://tax.gov.ae',
    helpUrl: 'https://u.ae/en/information-and-services/finance-and-investment/taxation/vat',
  },
  taxFamily: 'VAT',
  isFullPlugin: true,

  getFormSchema(): FormSection[] {
    return [
      {
        id: 'sales',
        title: 'VAT on Sales and All Other Outputs',
        fields: [
          { id: 'standard_rated_supplies', label: 'Standard rated supplies in Abu Dhabi', officialLabel: '1a', type: 'currency', editable: true, required: false, helpText: 'Supplies made in Abu Dhabi at 5%' },
          { id: 'standard_rated_dubai', label: 'Standard rated supplies in Dubai', officialLabel: '1b', type: 'currency', editable: true, required: false },
          { id: 'standard_rated_sharjah', label: 'Standard rated supplies in Sharjah', officialLabel: '1c', type: 'currency', editable: true, required: false },
          { id: 'standard_rated_other', label: 'Standard rated supplies in other Emirates', officialLabel: '1d', type: 'currency', editable: true, required: false },
          { id: 'total_standard_supplies', label: 'Total standard rated supplies', type: 'currency', calculated: true, editable: false, required: true, autoPopulateFrom: 'income_standard' },
          { id: 'tax_refund_supplies', label: 'Tax refunds provided to tourists', officialLabel: '2', type: 'currency', editable: true, required: false },
          { id: 'zero_rated_supplies', label: 'Zero-rated supplies', officialLabel: '3', type: 'currency', editable: true, required: false, helpText: 'Exports, international transport, first supply of residential property, certain education/health' },
          { id: 'exempt_supplies', label: 'Exempt supplies', officialLabel: '4', type: 'currency', editable: true, required: false, helpText: 'Financial services, bare land, local passenger transport, residential property (subsequent)' },
          { id: 'reverse_charge_received', label: 'Goods/services subject to reverse charge (received)', officialLabel: '5', type: 'currency', editable: true, required: false },
          { id: 'output_vat', label: 'Total output VAT due', officialLabel: '6', type: 'currency', calculated: true, editable: true, required: true },
        ],
      },
      {
        id: 'purchases',
        title: 'VAT on Expenses and All Other Inputs',
        fields: [
          { id: 'standard_rated_expenses', label: 'Standard rated expenses', officialLabel: '9', type: 'currency', editable: true, required: true, autoPopulateFrom: 'expenses_standard', helpText: 'Business expenses at 5%' },
          { id: 'reverse_charge_paid', label: 'Supplies subject to reverse charge (paid)', officialLabel: '10', type: 'currency', editable: true, required: false },
          { id: 'input_vat', label: 'Total input VAT recoverable', officialLabel: '11', type: 'currency', calculated: true, editable: true, required: true, autoPopulateFrom: 'input_tax' },
        ],
      },
      {
        id: 'summary',
        title: 'Net VAT Due',
        fields: [
          { id: 'net_vat', label: 'Net VAT due (payable if positive, refundable if negative)', officialLabel: '12', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'penalties', label: 'Penalties (if any)', type: 'currency', editable: true, required: false },
          { id: 'total_payable', label: 'Total amount payable to FTA', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({ monthly: true, quarterly: true, annual: false, defaultFrequency: 'quarterly' }),
  getFinancialYearBounds: (y) => ({ start: new Date(y, 0, 1), end: new Date(y, 11, 31) }),

  getTerminology: () => ({
    taxName: 'VAT', taxAbbrev: 'VAT',
    salesLabel: 'Outputs', purchasesLabel: 'Inputs',
    outputTaxLabel: 'Output VAT', inputTaxLabel: 'Input VAT',
  }),

  calculateFields(v: FieldValues): CalculatedFields {
    const ad = Number(v.standard_rated_supplies) || 0;
    const dub = Number(v.standard_rated_dubai) || 0;
    const sha = Number(v.standard_rated_sharjah) || 0;
    const oth = Number(v.standard_rated_other) || 0;
    const total_standard_supplies = ad + dub + sha + oth;

    const reverseIn = Number(v.reverse_charge_received) || 0;
    const output_vat_calc = Math.round((total_standard_supplies + reverseIn) * AE_RATE * 100) / 100;
    const output_vat = (v.output_vat !== '' && v.output_vat !== undefined && v.output_vat !== null)
      ? Math.round(Number(v.output_vat) * 100) / 100 : output_vat_calc;

    const stdExp = Number(v.standard_rated_expenses) || 0;
    const reversePaid = Number(v.reverse_charge_paid) || 0;
    const input_vat_calc = Math.round((stdExp + reversePaid) * AE_RATE * 100) / 100;
    const input_vat = (v.input_vat !== '' && v.input_vat !== undefined && v.input_vat !== null)
      ? Math.round(Number(v.input_vat) * 100) / 100 : input_vat_calc;

    const net_vat = Math.round((output_vat - input_vat) * 100) / 100;
    const penalties = Number(v.penalties) || 0;
    const total_payable = Math.round((net_vat + penalties) * 100) / 100;

    return { total_standard_supplies, output_vat: output_vat_calc, input_vat: input_vat_calc, net_vat, total_payable };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'total_standard_supplies', aggregateKey: 'income_standard' },
    { fieldId: 'standard_rated_expenses', aggregateKey: 'expenses_standard' },
    { fieldId: 'input_vat', aggregateKey: 'input_tax' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    const totalStd = (Number(v.standard_rated_supplies) || 0) + (Number(v.standard_rated_dubai) || 0) +
      (Number(v.standard_rated_sharjah) || 0) + (Number(v.standard_rated_other) || 0);
    if (totalStd < 0) r.push({ fieldId: 'standard_rated_supplies', message: 'Total supplies cannot be negative', severity: 'error' });
    return r;
  },
  getFieldHelp: () => null,

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v) {
    return { data: JSON.stringify(v, null, 2), filename: `VAT201-AE-${new Date().toISOString().slice(0, 10)}.json`, mimeType: 'application/json' };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://tax.gov.ae', submissionMethod: 'manual_upload' as const, apiReady: false }),
  hasSubJurisdictions: () => true,
  getSubJurisdictions: () => [
    { code: 'AUH', name: 'Abu Dhabi' }, { code: 'DXB', name: 'Dubai' }, { code: 'SHJ', name: 'Sharjah' },
    { code: 'AJM', name: 'Ajman' }, { code: 'UAQ', name: 'Umm Al Quwain' }, { code: 'RAK', name: 'Ras Al Khaimah' },
    { code: 'FUJ', name: 'Fujairah' },
  ],
  supportsCustomFields: () => false,
};

export default aePlugin;
