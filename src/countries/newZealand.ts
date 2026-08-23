/**
 * New Zealand GST Return (GST-101A) - ai2fin.com
 * NZ Inland Revenue Department - 15% GST
 * Reference: https://www.ird.govt.nz/gst/filing-and-paying-gst-and-refunds
 * Form (GST101A, 2023): Box 5 total sales and income (incl GST); Box 6 zero-rated;
 *   Box 7 = 5 − 6; Box 8 = 7 × 3 ÷ 23; Box 9 adjustments; Box 10 = 8 + 9;
 *   Box 11 purchases and expenses (incl GST); Box 12 = 11 × 3 ÷ 23; Box 13 credit
 *   adjustments; Box 14 = 12 + 13; Box 15 = 10 − 14 (positive = pay, negative = refund).
 * ARCHITECTURE: NZ rounds to nearest dollar (whole). Financial year: 1 Apr - 31 Mar.
 *   Filing: 2-monthly (default), monthly (voluntary), 6-monthly (small).
 */

import { toCsv } from '../exportUtils';

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
  TaxTreatmentDefinition,
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
      'https://www.ird.govt.nz/gst/filing-and-paying-gst-and-refunds',
  },
  taxFamily: 'GST',
  isFullPlugin: true,

  getFormSchema() {
    return [
      {
        id: 'sales',
        title: 'Sales and Income',
        description: 'Boxes 5–10 of the GST101A. Amounts include GST where applicable.',
        fields: [
          {
            id: 'box5',
            label: 'Total sales and income for the period (including GST)',
            officialLabel: 'Box 5',
            type: 'currency',
            editable: true,
            required: true,
            autoPopulateFrom: 'income_total',
            helpText:
              'All sales and income including GST and including any zero-rated supplies. Do not include exempt supplies.',
          },
          {
            id: 'box6',
            label: 'Zero-rated supplies included in Box 5',
            officialLabel: 'Box 6',
            type: 'currency',
            editable: true,
            required: false,
            autoPopulateFrom: 'income_zero_rated',
            helpText: 'Exports and other zero-rated supplies (e.g. going-concern sales, certain land transactions)',
          },
          {
            id: 'box7',
            label: 'Subtract Box 6 from Box 5',
            officialLabel: 'Box 7',
            type: 'currency',
            calculated: true,
            dependsOn: ['box5', 'box6'],
            editable: false,
            required: true,
          },
          {
            id: 'box8',
            label: 'Multiply Box 7 by three (3) and divide by twenty-three (23)',
            officialLabel: 'Box 8',
            type: 'currency',
            calculated: true,
            dependsOn: ['box7'],
            editable: false,
            required: true,
            helpText: 'GST on taxable sales: Box 7 × 3 ÷ 23 (extracts 15% GST from GST-inclusive amounts)',
          },
          {
            id: 'box9',
            label: 'Adjustments from your calculation sheet',
            officialLabel: 'Box 9',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Debit adjustments from the GST adjustments calculation sheet (IR372), e.g. private use of business assets, bad debts recovered',
          },
          {
            id: 'box10',
            label: 'Total GST collected on sales and income',
            officialLabel: 'Box 10',
            type: 'currency',
            calculated: true,
            dependsOn: ['box8', 'box9'],
            editable: false,
            required: true,
            helpText: 'Box 8 + Box 9',
          },
        ],
      },
      {
        id: 'purchases',
        title: 'Purchases and Expenses',
        description: 'Boxes 11–14 of the GST101A.',
        fields: [
          {
            id: 'box11',
            label: 'Total purchases and expenses (including GST) for which tax invoicing requirements have been met',
            officialLabel: 'Box 11',
            type: 'currency',
            editable: true,
            required: true,
            autoPopulateFrom: 'expenses_total',
            helpText:
              'Purchases and expenses with GST in the price for which you hold taxable supply information (tax invoices). Exclude wages, exempt purchases and purchases with no GST.',
          },
          {
            id: 'box12',
            label: 'Multiply Box 11 by three (3) and divide by twenty-three (23)',
            officialLabel: 'Box 12',
            type: 'currency',
            calculated: true,
            dependsOn: ['box11'],
            editable: false,
            required: true,
            helpText: 'GST credit on purchases: Box 11 × 3 ÷ 23',
          },
          {
            id: 'box13',
            label: 'Credit adjustments from your calculation sheet',
            officialLabel: 'Box 13',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Credit adjustments from the GST adjustments calculation sheet (IR372), e.g. bad debts written off, change of use',
          },
          {
            id: 'box14',
            label: 'Total GST credit for purchases and expenses',
            officialLabel: 'Box 14',
            type: 'currency',
            calculated: true,
            dependsOn: ['box12', 'box13'],
            editable: false,
            required: true,
            helpText: 'Box 12 + Box 13',
          },
        ],
      },
      {
        id: 'summary',
        title: 'GST to Pay or Refund',
        fields: [
          {
            id: 'box15',
            label: 'Difference between Box 10 and Box 14',
            officialLabel: 'Box 15',
            type: 'currency',
            calculated: true,
            dependsOn: ['box10', 'box14'],
            editable: false,
            required: true,
            helpText: 'Box 10 − Box 14. Positive = GST to pay. Negative = refund.',
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
    const b9 = Number(v.box9) || 0;
    const b11 = Number(v.box11) || 0;
    const b13 = Number(v.box13) || 0;

    // GST101A: Box 7 = 5 − 6; Box 8 = 7 × 3 ÷ 23; Box 10 = 8 + 9
    const box7 = b5 - b6;
    const box8 = roundNZ((box7 * 3) / 23);
    const box10 = roundNZ(box8 + b9);
    // Box 12 = 11 × 3 ÷ 23; Box 14 = 12 + 13
    const box12 = roundNZ((b11 * 3) / 23);
    const box14 = roundNZ(box12 + b13);
    // Box 15 = difference between Box 10 and Box 14 (positive = pay, negative = refund)
    const box15 = box10 - box14;

    return { box7, box8, box10, box12, box14, box15 };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'box5', aggregateKey: 'income_total' },
    { fieldId: 'box6', aggregateKey: 'income_zero_rated' },
    { fieldId: 'box11', aggregateKey: 'expenses_total' },
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
      box5: 'All income from your taxable activity — sales, fees, commissions, rents. Include GST. Include zero-rated supplies; exclude exempt supplies.',
      box6: 'Zero-rated supplies already included in Box 5 — exports, going-concern sales, certain land transactions.',
      box8: 'GST collected: uses the NZ tax fraction 3/23 to extract 15% GST from GST-inclusive amounts.',
      box9: 'Debit adjustments from the GST adjustments calculation sheet (IR372).',
      box11: 'Purchases and expenses with GST in the price for which you hold taxable supply information. Exclude wages, exempt and zero-rated purchases.',
      box13: 'Credit adjustments from the GST adjustments calculation sheet (IR372).',
      box15: 'Box 10 − Box 14. Positive = pay Inland Revenue. Negative = Inland Revenue owes you a refund.',
    };
    return help[fieldId] ?? null;
  },

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],

  async generateExport(v: FieldValues, format: string): Promise<ExportOutput> {
    if (format === 'csv') return toCsv(v, `GST-NZ-${new Date().toISOString().slice(0, 10)}`);
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

  /** NZ treatment catalogue in Inland Revenue vocabulary, mapped to GST101A boxes. */
  getTaxTreatments(): TaxTreatmentDefinition[] {
    const ref = 'https://www.ird.govt.nz/gst/filing-and-paying-gst-and-refunds';
    return [
      {
        code: 'SALE_STANDARD',
        label: 'Standard-rated supplies (15% GST)',
        side: 'sale',
        rate: NZ_GST_RATE,
        taxApplies: true,
        creditable: true,
        boxes: ['Box 5'],
        help: 'Sales and income with 15% GST in the price. Included in Box 5; the GST is extracted at Box 8.',
        authorityRef: ref,
        defaultFor: ['sales', 'services_income'],
      },
      {
        code: 'SALE_ZERO_RATED',
        label: 'Zero-rated supplies',
        side: 'sale',
        rate: 0,
        taxApplies: false,
        creditable: true,
        boxes: ['Box 5', 'Box 6'],
        help: 'Exports and other zero-rated supplies. Included in Box 5 and shown at Box 6.',
        authorityRef: ref,
        defaultFor: ['export_sales'],
      },
      {
        code: 'SALE_INPUT_TAXED',
        label: 'Exempt supplies',
        side: 'sale',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: [],
        help: 'Exempt supplies (financial services including interest, residential rent). Not included in Box 5; no GST credit on related purchases.',
        authorityRef: ref,
        defaultFor: ['interest_income', 'residential_rent'],
      },
      {
        code: 'PURCHASE_STANDARD',
        label: 'Purchases and expenses with GST',
        side: 'purchase',
        rate: NZ_GST_RATE,
        taxApplies: true,
        creditable: true,
        boxes: ['Box 11'],
        help: 'Purchases with 15% GST in the price for which you hold taxable supply information. Included in Box 11; the credit is extracted at Box 12.',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_CAPITAL',
        label: 'Capital purchases with GST',
        side: 'purchase',
        rate: NZ_GST_RATE,
        taxApplies: true,
        creditable: true,
        boxes: ['Box 11'],
        help: 'Assets purchased with 15% GST in the price. Included in Box 11 like any other purchase.',
        authorityRef: ref,
        defaultFor: ['equipment', 'vehicles'],
      },
      {
        code: 'PURCHASE_NO_TAX',
        label: 'Purchases with no GST',
        side: 'purchase',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: [],
        help: 'Purchases with no GST in the price (bank fees, interest, unregistered suppliers, overseas purchases). Not included in Box 11.',
        authorityRef: ref,
        defaultFor: ['bank_fees', 'government_fees'],
      },
      {
        code: 'PURCHASE_INPUT_TAXED',
        label: 'Purchases for making exempt supplies',
        side: 'purchase',
        rate: NZ_GST_RATE,
        taxApplies: true,
        creditable: false,
        boxes: [],
        help: 'Purchases that relate to exempt supplies; no GST credit, so not included in Box 11.',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_PRIVATE',
        label: 'Private / non-deductible',
        side: 'purchase',
        rate: NZ_GST_RATE,
        taxApplies: true,
        creditable: false,
        boxes: [],
        help: 'Private-use portion of purchases (adjusted via the calculation sheet at Box 9) and non-deductible entertainment; not claimable at Box 11.',
        authorityRef: ref,
        defaultFor: ['entertainment', 'fines_penalties'],
      },
      {
        code: 'PURCHASE_REVERSE_CHARGE',
        label: 'Imported services (reverse charge)',
        side: 'purchase',
        rate: NZ_GST_RATE,
        taxApplies: true,
        creditable: true,
        boxes: ['Box 5', 'Box 11'],
        help: 'Imported services subject to reverse charge: treat the value as a supply you made (Box 5) and, where creditable, a purchase (Box 11).',
        authorityRef: ref,
      },
      {
        code: 'WAGES',
        label: 'Wages and salaries',
        side: 'payroll',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: [],
        help: 'Salaries and wages are not a GST purchase and are excluded from Box 11.',
        defaultFor: ['wages', 'salaries'],
      },
      {
        code: 'WITHHOLDING',
        label: 'PAYE withheld',
        side: 'payroll',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: [],
        help: 'PAYE deducted from wages is reported through payday filing, not the GST return.',
        defaultFor: ['payg_withholding'],
      },
      {
        code: 'OUT_OF_SCOPE',
        label: 'Excluded from GST return',
        side: 'excluded',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: [],
        help: 'Not a supply: transfers, loan principal, drawings, dividends, tax payments, depreciation.',
        defaultFor: ['transfers', 'loan_principal', 'owner_drawings', 'dividends', 'tax_payments'],
      },
    ];
  },
};

export default nzPlugin;
