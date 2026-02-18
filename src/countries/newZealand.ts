/**
 * New Zealand GST Return (GST-101A) - ai2fin.com
 * NZ Inland Revenue Department - 15% GST
 * Reference: https://www.ird.govt.nz/gst/filing-and-paying-gst-and-provisional-tax
 * ARCHITECTURE: NZ rounds to nearest dollar (whole). Financial year: 1 Apr - 31 Mar.
 *   Filing: 2-monthly (default), monthly (voluntary), 6-monthly (small).
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

const NZ_GST_RATE = 0.15;

function roundNZ(value: number): number {
  return Math.round(value);
}

const nzPlugin: TaxFilingPlugin = {
  countryCode: 'NZ',
  displayName: 'GST Return (GST-101A)',
  shortName: 'GST Return',
  authority: {
    name: 'IRD',
    fullName: 'Inland Revenue Department',
    portalUrl: 'https://www.ird.govt.nz',
    helpUrl:
      'https://www.ird.govt.nz/gst/filing-and-paying-gst-and-provisional-tax/filing-gst-returns',
  },
  taxFamily: 'GST',
  isFullPlugin: true,

  getFormSchema() {
    return [
      {
        id: 'sales',
        title: 'Sales and Income',
        description: 'Amounts should include GST where applicable.',
        fields: [
          {
            id: 'box5',
            label: 'Total sales and income for the period',
            officialLabel: 'Box 5',
            type: 'currency',
            editable: true,
            required: true,
            autoPopulateFrom: 'income_total',
            helpText:
              'All income including taxable, zero-rated, and exempt supplies (GST inclusive)',
          },
          {
            id: 'box6',
            label: 'Zero-rated supplies',
            officialLabel: 'Box 6',
            type: 'currency',
            editable: true,
            required: false,
            autoPopulateFrom: 'income_zero_rated',
            helpText: 'Exports and other zero-rated supplies',
          },
          {
            id: 'box7',
            label: 'Subtract Box 6 from Box 5',
            officialLabel: 'Box 7',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
          },
          {
            id: 'box8',
            label: 'Adjustments from your calculation sheet',
            officialLabel: 'Box 8',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'GST adjustments (change of use, bad debts written off)',
          },
          {
            id: 'box9',
            label: 'Total GST collected on sales',
            officialLabel: 'Box 9',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
            helpText: 'GST on taxable sales: Box 7 × 3 ÷ 23 + Box 8',
          },
        ],
      },
      {
        id: 'purchases',
        title: 'Purchases and Expenses',
        fields: [
          {
            id: 'box11',
            label: 'Total purchases and expenses (incl. GST)',
            officialLabel: 'Box 11',
            type: 'currency',
            editable: true,
            required: true,
            autoPopulateFrom: 'expenses_total',
            helpText: 'All business purchases and expenses including GST',
          },
          {
            id: 'box12',
            label: 'Purchases and expenses not subject to GST',
            officialLabel: 'Box 12',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Exempt purchases, wages, private expenses',
          },
          {
            id: 'box13',
            label: 'Subtract Box 12 from Box 11',
            officialLabel: 'Box 13',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
          },
          {
            id: 'box14',
            label: 'Adjustments from your calculation sheet',
            officialLabel: 'Box 14',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'GST adjustments (change of use, bad debts recovered)',
          },
          {
            id: 'box15',
            label: 'Total GST credit on purchases',
            officialLabel: 'Box 15',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
            helpText: 'GST credits: Box 13 × 3 ÷ 23 + Box 14',
          },
        ],
      },
      {
        id: 'summary',
        title: 'GST to Pay or Refund',
        fields: [
          {
            id: 'box16',
            label: 'Difference between GST collected (Box 9) and GST credit (Box 15)',
            officialLabel: 'Box 16',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
            helpText: 'Positive = GST to pay IRD. Negative = refund from IRD.',
          },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({
    monthly: true,
    quarterly: false, // NZ uses 2-monthly, not quarterly, but we map to quarterly for simplicity
    annual: false,
    defaultFrequency: 'quarterly', // Represents 2-monthly in NZ context
  }),

  getFinancialYearBounds: (y) => ({
    // NZ: 1 April to 31 March
    start: new Date(y, 3, 1),
    end: new Date(y + 1, 2, 31),
  }),

  getTerminology: () => ({
    taxName: 'GST',
    taxAbbrev: 'GST',
    salesLabel: 'Sales and income',
    purchasesLabel: 'Purchases and expenses',
    outputTaxLabel: 'GST on sales',
    inputTaxLabel: 'GST on purchases',
  }),

  calculateFields(v: FieldValues) {
    const b5 = Number(v.box5) || 0;
    const b6 = Number(v.box6) || 0;
    const b8 = Number(v.box8) || 0;
    const b11 = Number(v.box11) || 0;
    const b12 = Number(v.box12) || 0;
    const b14 = Number(v.box14) || 0;

    const box7 = b5 - b6;
    // NZ GST calculation: amount × 3 ÷ 23 (extracts 15% from GST-inclusive)
    const box9 = roundNZ((box7 * 3) / 23 + b8);
    const box13 = b11 - b12;
    const box15 = roundNZ((box13 * 3) / 23 + b14);
    const box16 = box9 - box15;

    return { box7, box9, box13, box15, box16 };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'box5', aggregateKey: 'income_total' },
    { fieldId: 'box6', aggregateKey: 'income_zero_rated' },
    { fieldId: 'box11', aggregateKey: 'expenses_total' },
    { fieldId: 'box12', aggregateKey: 'expenses_exempt' },
  ],

  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 0, wholeOnly: true }),

  validateForm(v: FieldValues): ValidationResult[] {
    const results: ValidationResult[] = [];
    if (Number(v.box5) < 0) {
      results.push({
        fieldId: 'box5',
        message: 'Total sales cannot be negative',
        severity: 'error',
      });
    }
    if (Number(v.box6) > Number(v.box5)) {
      results.push({
        fieldId: 'box6',
        message: 'Zero-rated supplies exceed total sales',
        severity: 'warning',
      });
    }
    return results;
  },

  getFieldHelp: (fieldId) => {
    const help: Record<string, string> = {
      box5: 'All income from your taxable activity — sales, fees, commissions, rents. Include GST.',
      box9: 'GST collected: uses the NZ tax fraction 3/23 to extract 15% GST from inclusive amounts.',
      box16: 'Positive = pay IRD. Negative = IRD owes you a refund.',
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
      filename: `GST-NZ-${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/json',
    };
  },

  getPortalSubmissionInfo: () => ({
    portalUrl: 'https://myir.ird.govt.nz',
    submissionMethod: 'manual_upload' as const,
    apiReady: false,
  }),

  hasSubJurisdictions: () => false,
  supportsCustomFields: () => false,
};

export default nzPlugin;
