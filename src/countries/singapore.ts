/**
 * Singapore GST Return (Form GST F5) - ai2fin.com
 * Inland Revenue Authority of Singapore (IRAS)
 * Reference: https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/filing-gst/completing-gst-returns
 * ARCHITECTURE: 16 boxes. GST rate: 9% (from 1 Jan 2024).
 *   Financial year: Jan-Dec (or company chosen). Default quarterly filing.
 *   All amounts in SGD, 2 decimal places.
 */

import { toCsv } from '../exportUtils';
import { SG_DEPRECIATION_RULES } from './singaporeDepreciation';
import type { DepreciationRules } from '../depreciation';

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

const SG_RATE = 0.09;

const sgPlugin: TaxFilingPlugin = {
  countryCode: 'SG',
  displayName: 'GST Return (Form GST F5)',
  shortName: 'GST F5',
  authority: {
    name: 'IRAS',
    fullName: 'Inland Revenue Authority of Singapore',
    portalUrl: 'https://www.iras.gov.sg',
    helpUrl:
      'https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/filing-gst/completing-gst-returns',
  },
  taxFamily: 'GST',
  isFullPlugin: true,

  getFormSchema() {
    return [
      {
        id: 'supplies',
        title: 'Supplies',
        description: 'Report all your supplies (sales/revenue) for the accounting period.',
        fields: [
          {
            id: 'box1',
            label: 'Total value of standard-rated supplies',
            officialLabel: 'Box 1',
            type: 'currency',
            editable: true,
            required: true,
            // NET figure — the host emits `income_standard` gross, so the
            // *_excl_tax aggregate is the only one that matches this box.
            autoPopulateFrom: 'income_standard_excl_tax',
            helpText: 'Revenue from taxable supplies at 9% GST (excluding GST amount)',
          },
          {
            id: 'box2',
            label: 'Total value of zero-rated supplies',
            officialLabel: 'Box 2',
            type: 'currency',
            editable: true,
            required: false,
            autoPopulateFrom: 'income_zero_rated',
            helpText: 'International services, exports',
          },
          {
            id: 'box3',
            label: 'Total value of exempt supplies',
            officialLabel: 'Box 3',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Financial services, residential property sale/rent',
          },
          {
            id: 'box4',
            label: 'Total value of all supplies (1 + 2 + 3)',
            officialLabel: 'Box 4',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
          },
        ],
      },
      {
        id: 'purchases',
        title: 'Purchases',
        fields: [
          {
            id: 'box5',
            label: 'Total value of taxable purchases',
            officialLabel: 'Box 5',
            type: 'currency',
            editable: true,
            required: true,
            // GST-exclusive value of standard-rated + zero-rated purchases and
            // imports; excludes exempt, out-of-scope and non-registered suppliers.
            autoPopulateFrom: 'expenses_taxable_excl_tax',
            helpText:
              'GST-exclusive value of your standard-rated and zero-rated purchases and imports. Exclude exempt purchases, purchases from non-GST-registered suppliers and wages.',
          },
        ],
      },
      {
        id: 'gst_amounts',
        title: 'GST Amounts',
        description: 'GST you collected and GST you can claim back.',
        fields: [
          {
            id: 'box6',
            label: 'Output tax due (GST on your standard-rated supplies)',
            officialLabel: 'Box 6',
            type: 'currency',
            calculated: true,
            editable: true,
            required: true,
            helpText: 'Box 1 × 9%. Override if you have manual adjustments.',
          },
          {
            id: 'box7',
            label: 'Less: Input tax and refunds claimed',
            officialLabel: 'Box 7',
            type: 'currency',
            editable: true,
            required: true,
            autoPopulateFrom: 'input_tax',
            helpText: 'GST on your business purchases + any tourist refund scheme claims',
          },
          {
            id: 'box8',
            label: 'Net GST to pay IRAS or claim from IRAS',
            officialLabel: 'Box 8',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
            helpText: 'Box 6 − Box 7. Positive = pay IRAS. Negative = claim refund.',
          },
        ],
      },
      {
        id: 'imports',
        title: 'Revenue & Import GST (for reporting)',
        description: 'For statistical reporting. Does not affect your tax payable.',
        collapsed: true,
        fields: [
          {
            id: 'box9',
            label: 'Total value of goods imported under MES / schemes',
            officialLabel: 'Box 9',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Imports under Major Exporter Scheme, AISS, etc.',
          },
          {
            id: 'box10',
            label: 'GST on imports under MES / schemes',
            officialLabel: 'Box 10',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: 'box11',
            label: 'Total value of goods imported via normal customs',
            officialLabel: 'Box 11',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: 'box12',
            label: 'GST on imports via normal customs',
            officialLabel: 'Box 12',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: 'box13',
            label: 'Revenue for the accounting period',
            officialLabel: 'Box 13',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Per income statement/P&L. Include only business revenue.',
          },
        ],
      },
      {
        id: 'reverse_charge',
        title: 'Reverse Charge & Other Adjustments',
        collapsed: true,
        fields: [
          {
            id: 'box14',
            label: 'Did you import services subject to reverse charge?',
            officialLabel: 'Box 14',
            type: 'boolean',
            editable: true,
            required: false,
          },
          {
            id: 'box15',
            label: 'Value of imported services subject to GST',
            officialLabel: 'Box 15',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Services imported from overseas subject to reverse charge',
          },
          {
            id: 'box16',
            label: 'GST on imported services (reverse charge)',
            officialLabel: 'Box 16',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Box 15 × 9%',
          },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({
    monthly: true,
    quarterly: true,
    annual: false,
    defaultFrequency: 'quarterly',
  }),

  getFinancialYearBounds: (y) => ({
    start: new Date(y, 0, 1),
    end: new Date(y, 11, 31),
  }),

  getTerminology: () => ({
    taxName: 'GST',
    taxAbbrev: 'GST',
    salesLabel: 'Supplies',
    purchasesLabel: 'Purchases',
    outputTaxLabel: 'Output tax',
    inputTaxLabel: 'Input tax',
  }),

  calculateFields(v: FieldValues) {
    const b1 = Number(v.box1) || 0;
    const b2 = Number(v.box2) || 0;
    const b3 = Number(v.box3) || 0;
    const b7 = Number(v.box7) || 0;

    const box4 = Math.round((b1 + b2 + b3) * 100) / 100;
    const box6_calc = Math.round(b1 * SG_RATE * 100) / 100;

    // Allow override of output tax
    const box6 =
      v.box6 !== '' && v.box6 !== undefined && v.box6 !== null
        ? Math.round(Number(v.box6) * 100) / 100
        : box6_calc;

    const box8 = Math.round((box6 - b7) * 100) / 100;

    // Return the override-aware box6 (not box6_calc): box8 is computed from the
    // override, so returning the pre-override figure discarded the user's manual
    // output-tax adjustment (bad-debt relief, etc.) on save. embracingearth.space
    return { box4, box6, box8 };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    // *_excl_tax keys are NET aggregates (boxes 1 and 5 exclude GST).
    { fieldId: 'box1', aggregateKey: 'income_standard_excl_tax' },
    { fieldId: 'box2', aggregateKey: 'income_zero_rated' },
    { fieldId: 'box5', aggregateKey: 'expenses_taxable_excl_tax' },
    { fieldId: 'box7', aggregateKey: 'input_tax' },
    { fieldId: 'box13', aggregateKey: 'revenue_total' },
  ],

  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

  validateForm(v: FieldValues): ValidationResult[] {
    const results: ValidationResult[] = [];
    if (Number(v.box1) < 0) {
      results.push({
        fieldId: 'box1',
        message: 'Standard-rated supplies cannot be negative',
        severity: 'error',
      });
    }
    if (Number(v.box7) < 0) {
      results.push({ fieldId: 'box7', message: 'Input tax cannot be negative', severity: 'error' });
    }
    return results;
  },

  getFieldHelp: (fieldId) => {
    const help: Record<string, string> = {
      box1: 'Revenue from goods/services sold at 9% GST. Exclude GST amount — report net value only.',
      box6: 'Output tax = Box 1 × 9%. Override if you have manual adjustments (bad debt relief, etc).',
      box7: 'Input tax on business purchases. Only claim GST on purchases used for taxable supplies.',
      box8: 'Positive = amount you owe IRAS. Negative = IRAS owes you a refund.',
    };
    return help[fieldId] ?? null;
  },

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],

  async generateExport(v: FieldValues, format: string): Promise<ExportOutput> {
    if (format === 'csv') return toCsv(v, `GST-F5-SG-${new Date().toISOString().slice(0, 10)}`);
    return {
      data: JSON.stringify(v, null, 2),
      filename: `GST-F5-SG-${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/json',
    };
  },

  getPortalSubmissionInfo: () => ({
    portalUrl: 'https://mytax.iras.gov.sg',
    submissionMethod: 'manual_upload' as const,
    apiReady: false,
  }),

  hasSubJurisdictions: () => false,
  supportsCustomFields: () => false,

  /** SG treatment catalogue in IRAS vocabulary, mapped to GST F5 boxes. */
  getTaxTreatments(): TaxTreatmentDefinition[] {
    const ref =
      'https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/filing-gst/completing-gst-returns';
    return [
      {
        code: 'SALE_STANDARD',
        label: 'Standard-rated supplies (9%)',
        side: 'sale',
        rate: SG_RATE,
        taxApplies: true,
        creditable: true,
        boxes: ['Box 1', 'Box 6'],
        help: 'Local supplies of goods and services at 9% GST. Net value in Box 1; the output tax in Box 6.',
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
        boxes: ['Box 2'],
        help: 'Exports of goods and international services (0% GST). Value in Box 2; input tax remains claimable.',
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
        boxes: ['Box 3'],
        help: 'Financial services, sale and lease of residential property, investment precious metals. Value in Box 3; related input tax is not claimable.',
        authorityRef: ref,
        defaultFor: ['interest_income', 'residential_rent'],
      },
      {
        code: 'PURCHASE_STANDARD',
        label: 'Taxable purchases (9%)',
        side: 'purchase',
        rate: SG_RATE,
        taxApplies: true,
        creditable: true,
        boxes: ['Box 5', 'Box 7'],
        help: 'Purchases with 9% GST supported by a tax invoice. Net value in Box 5; the input tax claimed in Box 7.',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_CAPITAL',
        label: 'Capital purchases (9%)',
        side: 'purchase',
        rate: SG_RATE,
        taxApplies: true,
        creditable: true,
        boxes: ['Box 5', 'Box 7'],
        help: 'Fixed assets bought with 9% GST. Net value in Box 5; input tax in Box 7.',
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
        help: 'Exempt purchases (bank charges, insurance) and purchases from non-GST-registered suppliers are not reported. Zero-rated purchases (e.g. international services) are the exception and belong in Box 5.',
        authorityRef: ref,
        defaultFor: ['bank_fees', 'government_fees'],
      },
      {
        code: 'PURCHASE_INPUT_TAXED',
        label: 'Purchases for making exempt supplies',
        side: 'purchase',
        rate: SG_RATE,
        taxApplies: true,
        creditable: false,
        boxes: ['Box 5'],
        help: 'Purchases attributable to exempt supplies; input tax is not claimable (subject to the De Minimis Rule).',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_PRIVATE',
        label: 'Disallowed / private',
        side: 'purchase',
        rate: SG_RATE,
        taxApplies: true,
        creditable: false,
        boxes: ['Box 5'],
        help: 'Disallowed input tax (Regulations 26 and 27: private cars, club subscriptions, medical and family benefits) and private-use portions. No Box 7 claim.',
        authorityRef: ref,
        defaultFor: ['entertainment', 'fines_penalties'],
      },
      {
        code: 'PURCHASE_REVERSE_CHARGE',
        label: 'Imported services (reverse charge)',
        side: 'purchase',
        rate: SG_RATE,
        taxApplies: true,
        creditable: true,
        boxes: ['Box 14', 'Box 15', 'Box 16'],
        help: 'Imported services subject to reverse charge: tick Box 14, value in Box 15, GST in Box 16 (accounted as output tax and claimed as input tax where allowed).',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_IMPORT',
        label: 'Imported goods',
        side: 'purchase',
        rate: SG_RATE,
        taxApplies: true,
        creditable: true,
        boxes: ['Box 5', 'Box 7', 'Box 11', 'Box 12'],
        help: 'Goods imported with GST paid to Singapore Customs: value in Box 5 and Box 11, GST claimed in Box 7 and shown in Box 12 (Boxes 9-10 for MES / import schemes).',
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
        help: 'Not a supply; not reported on the GST F5.',
        defaultFor: ['wages', 'salaries'],
      },
      {
        code: 'WITHHOLDING',
        label: 'CPF / withholding',
        side: 'payroll',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: [],
        help: 'CPF contributions and withholding tax are reported separately, not on the GST F5.',
        defaultFor: ['payg_withholding'],
      },
      {
        code: 'OUT_OF_SCOPE',
        label: 'Out-of-scope supplies',
        side: 'excluded',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: [],
        help: 'Third-country sales, transfers, loan principal, drawings, dividends, tax payments. Not reported.',
        defaultFor: ['transfers', 'loan_principal', 'owner_drawings', 'dividends', 'tax_payments'],
      },
    ];
  },

  /** IRAS's write-off elective capital allowances — see ./singaporeDepreciation. */
  getDepreciationRules(): DepreciationRules {
    return SG_DEPRECIATION_RULES;
  },
};

export default sgPlugin;
