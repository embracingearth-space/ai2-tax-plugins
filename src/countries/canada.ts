/**
 * Canada GST/HST Return (GST34) - ai2fin.com
 * Canada Revenue Agency - Lines 101-115
 * Reference: https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4022/general-information-gst-hst-registrants.html
 * ARCHITECTURE: Federal GST = 5%. HST varies by province (13-15%).
 *   Financial year: Jan-Dec (or business chosen year-end). Default quarterly.
 *   Provincial variations: ON=13%, NB/NL/NS=15%, PE=15%, QC uses QST (separate).
 */

import { toCsv } from '../exportUtils';
import type { DepreciationRules } from '../depreciation';
import CA_DEPRECIATION_RULES from './canadaDepreciation';

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
  SubJurisdiction,
  TaxTreatmentDefinition,
} from '../types';

const PROVINCES: SubJurisdiction[] = [
  { code: 'AB', name: 'Alberta', rate: 0.05 },
  { code: 'BC', name: 'British Columbia', rate: 0.05 },
  { code: 'MB', name: 'Manitoba', rate: 0.05 },
  { code: 'NB', name: 'New Brunswick', rate: 0.15 },
  { code: 'NL', name: 'Newfoundland and Labrador', rate: 0.15 },
  { code: 'NS', name: 'Nova Scotia', rate: 0.15 },
  { code: 'NT', name: 'Northwest Territories', rate: 0.05 },
  { code: 'NU', name: 'Nunavut', rate: 0.05 },
  { code: 'ON', name: 'Ontario', rate: 0.13 },
  { code: 'PE', name: 'Prince Edward Island', rate: 0.15 },
  { code: 'QC', name: 'Quebec', rate: 0.05 },
  { code: 'SK', name: 'Saskatchewan', rate: 0.05 },
  { code: 'YT', name: 'Yukon', rate: 0.05 },
];

const caPlugin: TaxFilingPlugin = {
  countryCode: 'CA',
  displayName: 'GST/HST Return (GST34)',
  shortName: 'GST/HST Return',
  authority: {
    name: 'CRA',
    fullName: 'Canada Revenue Agency',
    portalUrl: 'https://www.canada.ca/en/revenue-agency.html',
    helpUrl:
      'https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4022/general-information-gst-hst-registrants.html',
  },
  taxFamily: 'GST',
  isFullPlugin: true,

  getFormSchema(opts) {
    return [
      {
        id: 'sales',
        title: 'Sales and Revenue',
        description: 'Report your total revenue and GST/HST collected.',
        fields: [
          {
            id: 'line101',
            label: 'Total sales and other revenue (excl. GST/HST)',
            officialLabel: 'Line 101',
            type: 'currency',
            editable: true,
            required: true,
            helpText: 'Total revenue from taxable and zero-rated supplies excluding GST/HST',
          },
          {
            id: 'line103',
            label: 'GST/HST collected or collectible',
            officialLabel: 'Line 103',
            type: 'currency',
            editable: true,
            required: true,
            autoPopulateFrom: 'output_tax',
            helpText: 'Total GST/HST you charged on taxable sales',
          },
          {
            id: 'line104',
            label: 'Adjustments to be added to the net tax',
            officialLabel: 'Line 104',
            type: 'currency',
            editable: true,
            required: false,
            helpText:
              'Amounts that increase your net tax for the period (e.g. GST/HST on bad debts recovered, ITCs you must repay or recapture)',
          },
          {
            id: 'line105',
            label: 'Total GST/HST and adjustments (103 + 104)',
            officialLabel: 'Line 105',
            type: 'currency',
            calculated: true,
            dependsOn: ['line103', 'line104'],
            editable: false,
            required: true,
          },
        ],
      },
      {
        id: 'itc',
        title: 'Input Tax Credits (ITCs)',
        description: 'Claim back GST/HST paid on business purchases.',
        fields: [
          {
            id: 'line106',
            label: 'Input tax credits (ITCs)',
            officialLabel: 'Line 106',
            type: 'currency',
            editable: true,
            required: true,
            autoPopulateFrom: 'input_tax',
            helpText: 'GST/HST paid on eligible business purchases and expenses',
          },
          {
            id: 'line107',
            label: 'Adjustments to be deducted when determining the net tax',
            officialLabel: 'Line 107',
            type: 'currency',
            editable: true,
            required: false,
            helpText:
              'Amounts that reduce your net tax for the period (e.g. GST/HST on bad debts written off, rebates paid or credited to customers). These are ADDED to your ITCs at line 108.',
          },
          {
            id: 'line108',
            label: 'Total ITCs and adjustments (106 + 107)',
            officialLabel: 'Line 108',
            type: 'currency',
            calculated: true,
            dependsOn: ['line106', 'line107'],
            editable: false,
            required: true,
          },
        ],
      },
      {
        id: 'summary',
        title: 'Net Tax Calculation',
        fields: [
          {
            id: 'line109',
            label: 'Net tax (Line 105 − Line 108)',
            officialLabel: 'Line 109',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
            helpText: 'Positive = remit to CRA. Negative = refund from CRA.',
          },
          {
            id: 'line110',
            label: 'Instalments and net tax already remitted',
            officialLabel: 'Line 110',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Instalment payments already made for this period',
          },
          {
            id: 'line111',
            label: 'Rebates claimed',
            officialLabel: 'Line 111',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: 'line112',
            label: 'Total other credits (110 + 111)',
            officialLabel: 'Line 112',
            type: 'currency',
            calculated: true,
            editable: false,
            required: false,
          },
          {
            id: 'line113',
            label: 'Balance (Line 109 − Line 112)',
            officialLabel: 'Line 113',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
            helpText: 'Positive = amount owing. Negative = refund claimed.',
          },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({
    monthly: true,
    quarterly: true,
    annual: true,
    defaultFrequency: 'quarterly',
  }),

  getFinancialYearBounds: (y) => ({
    start: new Date(y, 0, 1),
    end: new Date(y, 11, 31),
  }),

  getTerminology: () => ({
    taxName: 'GST/HST',
    taxAbbrev: 'GST',
    salesLabel: 'Revenue',
    purchasesLabel: 'Purchases',
    outputTaxLabel: 'GST/HST collected',
    inputTaxLabel: 'Input tax credits',
  }),

  calculateFields(v: FieldValues) {
    const l103 = Number(v.line103) || 0;
    const l104 = Number(v.line104) || 0;
    const l106 = Number(v.line106) || 0;
    const l107 = Number(v.line107) || 0;
    const l110 = Number(v.line110) || 0;
    const l111 = Number(v.line111) || 0;

    const line105 = Math.round((l103 + l104) * 100) / 100;
    // GST34: line 107 adjustments are DEDUCTED from net tax, i.e. ADDED to ITCs.
    const line108 = Math.round((l106 + l107) * 100) / 100;
    const line109 = Math.round((line105 - line108) * 100) / 100;
    const line112 = Math.round((l110 + l111) * 100) / 100;
    const line113 = Math.round((line109 - line112) * 100) / 100;

    return { line105, line108, line109, line112, line113 };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'line101', aggregateKey: 'income_net' },
    { fieldId: 'line103', aggregateKey: 'output_tax' },
    { fieldId: 'line106', aggregateKey: 'input_tax' },
  ],

  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

  validateForm(v: FieldValues): ValidationResult[] {
    const results: ValidationResult[] = [];
    if (Number(v.line103) < 0) {
      results.push({
        fieldId: 'line103',
        message: 'GST/HST collected cannot be negative',
        severity: 'error',
      });
    }
    if (Number(v.line106) < 0) {
      results.push({ fieldId: 'line106', message: 'ITCs cannot be negative', severity: 'error' });
    }
    return results;
  },

  getFieldHelp: (fieldId) => {
    const help: Record<string, string> = {
      line101: 'Total revenue from taxable supplies. Exclude GST/HST charged.',
      line103: 'GST/HST you charged customers. From sales journal or accounting system.',
      line104: 'Adjustments that increase net tax: bad debts recovered, ITCs to repay or recapture.',
      line106: 'GST/HST paid on eligible business purchases. Keep receipts for audit.',
      line107: 'Adjustments that reduce net tax (added to your ITCs): bad debts written off, rebates paid to customers.',
      line109: 'Positive = you owe CRA. Negative = CRA owes you a refund.',
    };
    return help[fieldId] ?? null;
  },

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],

  async generateExport(v: FieldValues, format: string): Promise<ExportOutput> {
    if (format === 'csv') return toCsv(v, `GST-HST-CA-${new Date().toISOString().slice(0, 10)}`);
    return {
      data: JSON.stringify(v, null, 2),
      filename: `GST-HST-CA-${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/json',
    };
  },

  getPortalSubmissionInfo: () => ({
    portalUrl:
      'https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/gst-hst-netfile.html',
    submissionMethod: 'manual_upload' as const,
    apiReady: false,
  }),

  hasSubJurisdictions: () => true,
  getSubJurisdictions: () => PROVINCES,
  supportsCustomFields: () => false,

  /**
   * CA treatment catalogue mapped to GST34 lines. `rate: null` because the
   * rate depends on the province of supply (5% GST or 13-15% HST).
   */
  getTaxTreatments(): TaxTreatmentDefinition[] {
    const ref =
      'https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4022/general-information-gst-hst-registrants.html';
    return [
      {
        code: 'SALE_STANDARD',
        label: 'Taxable supplies (GST 5% / HST by province)',
        side: 'sale',
        rate: null,
        taxApplies: true,
        creditable: true,
        boxes: ['Line 101', 'Line 103'],
        help: 'Sales taxed at 5% GST or the HST rate of the province of supply. Revenue at line 101 (excluding tax); the tax collected at line 103.',
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
        boxes: ['Line 101'],
        help: 'Exports, basic groceries, prescription drugs and other zero-rated supplies. Included in line 101; ITCs on related purchases are claimable.',
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
        boxes: ['Line 101'],
        help: 'Exempt supplies (most financial services, long-term residential rent, certain health and education). Included in line 101; no ITCs on related purchases.',
        authorityRef: ref,
        defaultFor: ['interest_income', 'residential_rent'],
      },
      {
        code: 'PURCHASE_STANDARD',
        label: 'Purchases with GST/HST (ITC)',
        side: 'purchase',
        rate: null,
        taxApplies: true,
        creditable: true,
        boxes: ['Line 106'],
        help: 'Business purchases with GST/HST in the price; the tax paid is claimed as an input tax credit at line 106.',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_CAPITAL',
        label: 'Capital property with GST/HST (ITC)',
        side: 'purchase',
        rate: null,
        taxApplies: true,
        creditable: true,
        boxes: ['Line 106'],
        help: 'Capital property used primarily in commercial activities; GST/HST paid is claimed at line 106.',
        authorityRef: ref,
        defaultFor: ['equipment', 'vehicles'],
      },
      {
        code: 'PURCHASE_NO_TAX',
        label: 'Purchases with no GST/HST',
        side: 'purchase',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: [],
        help: 'Purchases with no GST/HST in the price (zero-rated or exempt goods and services, small suppliers, bank charges, insurance). No ITC.',
        authorityRef: ref,
        defaultFor: ['bank_fees', 'government_fees'],
      },
      {
        code: 'PURCHASE_INPUT_TAXED',
        label: 'Purchases for making exempt supplies',
        side: 'purchase',
        rate: null,
        taxApplies: true,
        creditable: false,
        boxes: [],
        help: 'GST/HST paid on purchases used to make exempt supplies is not claimable as an ITC.',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_PRIVATE',
        label: 'Personal use / non-deductible',
        side: 'purchase',
        rate: null,
        taxApplies: true,
        creditable: false,
        boxes: [],
        help: 'Personal-use portion and restricted expenses (e.g. 50% of meals and entertainment, club memberships). No ITC for this portion.',
        authorityRef: ref,
        defaultFor: ['entertainment', 'fines_penalties'],
      },
      {
        code: 'PURCHASE_REVERSE_CHARGE',
        label: 'Imported taxable supplies (self-assessed)',
        side: 'purchase',
        rate: null,
        taxApplies: true,
        creditable: true,
        boxes: [],
        help: 'Services and intangibles imported for use in exempt activities are self-assessed at line 405 of the GST34; fully commercial use generally needs no self-assessment.',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_IMPORT',
        label: 'Imported goods (GST paid at the border)',
        side: 'purchase',
        rate: null,
        taxApplies: true,
        creditable: true,
        boxes: ['Line 106'],
        help: 'GST paid to the CBSA on commercial imports is claimable as an ITC at line 106.',
        authorityRef: ref,
      },
      {
        code: 'WAGES',
        label: 'Salaries and wages',
        side: 'payroll',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: [],
        help: 'Salaries and wages are not subject to GST/HST and are not reported on the GST34.',
        defaultFor: ['wages', 'salaries'],
      },
      {
        code: 'WITHHOLDING',
        label: 'Payroll source deductions',
        side: 'payroll',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: [],
        help: 'Income tax, CPP and EI withheld are remitted on the payroll remittance (PD7A), not the GST34.',
        defaultFor: ['payg_withholding'],
      },
      {
        code: 'OUT_OF_SCOPE',
        label: 'Not a supply',
        side: 'excluded',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: [],
        help: 'Transfers, loan principal, owner draws, dividends, tax payments, depreciation. Not reported.',
        defaultFor: ['transfers', 'loan_principal', 'owner_drawings', 'dividends', 'tax_payments'],
      },
    ];
  },

  /** The CRA's class-based capital cost allowance regime — see ./canadaDepreciation. */
  getDepreciationRules(): DepreciationRules {
    return CA_DEPRECIATION_RULES;
  },
};

export default caPlugin;
