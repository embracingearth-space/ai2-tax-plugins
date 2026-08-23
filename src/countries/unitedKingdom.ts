/**
 * UK VAT Return Plugin (Making Tax Digital) - ai2fin.com
 * 9 boxes per HMRC MTD specification.
 * Reference: https://www.gov.uk/guidance/how-to-fill-in-and-submit-your-vat-return-vat-notice-70012
 * ARCHITECTURE: Boxes 1-5 = VAT amounts (pennies, 2dp). Boxes 6-9 = net values (whole pounds).
 *   UK tax year: 6 April to 5 April. VAT periods: monthly/quarterly/annual.
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
  TaxTreatmentDefinition,
} from '../types';
import type { DepreciationRules } from '../depreciation';
import UK_DEPRECIATION_RULES from './unitedKingdomDepreciation';

const ukPlugin: TaxFilingPlugin = {
  countryCode: 'GB',
  displayName: 'VAT Return (Making Tax Digital)',
  shortName: 'VAT Return',
  authority: {
    name: 'HMRC',
    fullName: "His Majesty's Revenue and Customs",
    portalUrl: 'https://www.gov.uk/vat-returns',
    helpUrl:
      'https://www.gov.uk/guidance/how-to-fill-in-and-submit-your-vat-return-vat-notice-70012',
  },
  taxFamily: 'VAT',
  isFullPlugin: true,

  getFormSchema() {
    return [
      {
        id: 'vat_output',
        title: 'VAT Due (Output Tax)',
        description: 'VAT you charged on sales and other outputs during this period.',
        fields: [
          {
            id: 'box1',
            label: 'VAT due on sales and other outputs',
            officialLabel: 'Box 1',
            type: 'currency',
            editable: true,
            required: true,
            autoPopulateFrom: 'output_vat',
            helpText: 'VAT charged on all taxable goods and services you sold',
          },
          {
            id: 'box2',
            label: 'VAT due in the period on acquisitions of goods made in Northern Ireland from EU Member States',
            officialLabel: 'Box 2',
            type: 'currency',
            editable: true,
            required: false,
            helpText:
              'Only for businesses in Northern Ireland: VAT due on goods acquired from EU Member States under the Northern Ireland Protocol. Great Britain businesses enter 0.',
          },
          {
            id: 'box3',
            label: 'Total VAT due (Box 1 + Box 2)',
            officialLabel: 'Box 3',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
            helpText: 'Automatic sum of Box 1 and Box 2',
          },
        ],
      },
      {
        id: 'vat_input',
        title: 'VAT Reclaimed (Input Tax)',
        description: 'VAT you can reclaim on purchases and other inputs.',
        fields: [
          {
            id: 'box4',
            label: 'VAT reclaimed on purchases and other inputs',
            officialLabel: 'Box 4',
            type: 'currency',
            editable: true,
            required: true,
            autoPopulateFrom: 'input_vat',
            helpText: 'Total VAT on purchases you can reclaim (including reverse charge)',
          },
        ],
      },
      {
        id: 'vat_net',
        title: 'Net VAT',
        fields: [
          {
            id: 'box5',
            label: 'Net VAT to pay HMRC or reclaim (Box 3 − Box 4)',
            officialLabel: 'Box 5',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
            helpText: 'Positive = pay HMRC. Negative = reclaim from HMRC.',
          },
        ],
      },
      {
        id: 'vat_values',
        title: 'Net Values (excluding VAT)',
        description: 'These are net figures in whole pounds (no pence).',
        fields: [
          {
            id: 'box6',
            label: 'Total value of sales and all other outputs excluding VAT',
            officialLabel: 'Box 6',
            type: 'currency',
            editable: true,
            required: true,
            helpText: 'Total turnover excluding VAT — all sales, zero-rated, exempt',
          },
          {
            id: 'box7',
            label: 'Total value of purchases and all other inputs excluding VAT',
            officialLabel: 'Box 7',
            type: 'currency',
            editable: true,
            required: true,
            helpText: 'Total purchases and expenses excluding VAT',
          },
          {
            id: 'box8',
            label: 'Total value of dispatches of goods and related costs (excluding VAT) from Northern Ireland to EU Member States',
            officialLabel: 'Box 8',
            type: 'currency',
            editable: true,
            required: false,
            helpText:
              'Only for businesses in Northern Ireland: value of goods (not services) and related costs dispatched to EU Member States, excluding VAT. Great Britain businesses enter 0.',
          },
          {
            id: 'box9',
            label: 'Total value of acquisitions of goods and related costs (excluding VAT) made in Northern Ireland from EU Member States',
            officialLabel: 'Box 9',
            type: 'currency',
            editable: true,
            required: false,
            helpText:
              'Only for businesses in Northern Ireland: value of goods (not services) and related costs acquired from EU Member States, excluding VAT. Great Britain businesses enter 0.',
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
    // UK tax year: 6 April to 5 April
    start: new Date(y, 3, 6),
    end: new Date(y + 1, 3, 5),
  }),

  getTerminology: () => ({
    taxName: 'VAT',
    taxAbbrev: 'VAT',
    salesLabel: 'Outputs',
    purchasesLabel: 'Inputs',
    outputTaxLabel: 'Output VAT',
    inputTaxLabel: 'Input VAT',
  }),

  calculateFields(v: FieldValues) {
    const b1 = Number(v.box1) || 0;
    const b2 = Number(v.box2) || 0;
    const b4 = Number(v.box4) || 0;
    const box3 = Math.round((b1 + b2) * 100) / 100;
    const box5 = Math.round((box3 - b4) * 100) / 100;
    return { box3, box5 };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'box1', aggregateKey: 'output_vat' },
    { fieldId: 'box4', aggregateKey: 'input_vat' },
    { fieldId: 'box6', aggregateKey: 'income_net' },
    { fieldId: 'box7', aggregateKey: 'expenses_net' },
  ],

  getRoundingRules: (): RoundingConfig => ({
    method: 'nearest',
    decimals: 2,
    wholeOnly: false,
    noNegatives: false, // VAT can be negative (reclaim)
  }),

  validateForm(v: FieldValues): ValidationResult[] {
    const results: ValidationResult[] = [];
    if (Number(v.box6) === 0 && Number(v.box1) > 0) {
      results.push({
        fieldId: 'box6',
        message: 'Box 6 (total sales excl. VAT) is zero but you declared output VAT. Please check.',
        severity: 'warning',
      });
    }
    if (Number(v.box7) === 0 && Number(v.box4) > 0) {
      results.push({
        fieldId: 'box7',
        message: 'Box 7 (total purchases excl. VAT) is zero but you claimed input VAT. Please check.',
        severity: 'warning',
      });
    }
    // HMRC: boxes 1, 2, 4, 6, 7, 8, 9 must be non-negative
    for (const boxId of ['box1', 'box2', 'box4', 'box6', 'box7', 'box8', 'box9']) {
      if ((Number(v[boxId]) || 0) < 0) {
        results.push({
          fieldId: boxId,
          message: `${boxId.replace('box', 'Box ')} cannot be negative.`,
          severity: 'error',
        });
      }
    }
    // HMRC MTD: boxes 6-9 must be whole pounds
    for (const boxId of ['box6', 'box7', 'box8', 'box9']) {
      const val = Number(v[boxId]) || 0;
      if (val !== Math.round(val)) {
        results.push({
          fieldId: boxId,
          message: `${boxId.replace('box', 'Box ')} must be in whole pounds (no pence). Will be rounded on export.`,
          severity: 'warning',
        });
      }
    }
    // Cross-check: NI-to-EU dispatches cannot exceed total sales
    if ((Number(v.box8) || 0) > (Number(v.box6) || 0)) {
      results.push({
        fieldId: 'box8',
        message: 'Box 8 (goods dispatched from Northern Ireland to EU Member States) cannot exceed Box 6 (total sales excl. VAT).',
        severity: 'warning',
      });
    }
    return results;
  },

  getFieldHelp(fieldId: string) {
    const help: Record<string, string> = {
      box1: 'VAT on sales: total output tax on all taxable supplies at standard, reduced and zero rate.',
      box4: 'VAT on purchases: total input tax reclaimable. Include imports, reverse charge amounts.',
      box5: 'Positive = amount you owe HMRC. Negative = HMRC owes you a repayment.',
      box6: 'This is the net value of everything you sold — turnover excluding VAT.',
      box7: 'This is the net value of everything you bought — purchases excluding VAT.',
      box2: 'Northern Ireland businesses only: VAT due on goods acquired from EU Member States. Otherwise 0.',
      box8: 'Northern Ireland businesses only: goods and related costs dispatched to EU Member States, excluding VAT. Otherwise 0.',
      box9: 'Northern Ireland businesses only: goods and related costs acquired from EU Member States, excluding VAT. Otherwise 0.',
    };
    return help[fieldId] ?? null;
  },

  // 'pdf' removed 2026-08: generateExport below has no PDF branch, so it fell
  // through to the plain JSON return — "PDF Summary" downloaded a .json file
  // with a .json MIME type. Re-add it once a PDF branch actually exists.
  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'MTD JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],

  async generateExport(v, format) {
    // ai2fin.com — MTD API-ready JSON structure
    // HMRC MTD requires: boxes 1-5 = 2dp, boxes 6-9 = whole pounds (integers)
    const mtdPayload = {
      periodKey: 'A001',
      vatDueSales: Math.round((Number(v.box1) || 0) * 100) / 100,
      vatDueAcquisitions: Math.round((Number(v.box2) || 0) * 100) / 100,
      totalVatDue: Math.round((Number(v.box3) || 0) * 100) / 100,
      vatReclaimedCurrPeriod: Math.round((Number(v.box4) || 0) * 100) / 100,
      netVatDue: Math.round(Math.abs(Number(v.box5) || 0) * 100) / 100,
      totalValueSalesExVAT: Math.round(Number(v.box6) || 0),
      totalValuePurchasesExVAT: Math.round(Number(v.box7) || 0),
      totalValueGoodsSuppliedExVAT: Math.round(Number(v.box8) || 0),
      totalAcquisitionsExVAT: Math.round(Number(v.box9) || 0),
      finalised: true,
    };

    if (format === 'csv') {
      const header = Object.keys(mtdPayload).join(',');
      const row = Object.values(mtdPayload).join(',');
      return {
        data: `${header}\n${row}`,
        filename: `VAT-Return-GB-${new Date().toISOString().slice(0, 10)}.csv`,
        mimeType: 'text/csv',
      };
    }

    const content = JSON.stringify(mtdPayload, null, 2);
    return {
      data: content,
      filename: `VAT-Return-GB-${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/json',
    };
  },

  getPortalSubmissionInfo: () => ({
    portalUrl: 'https://www.tax.service.gov.uk/vat-through-software/vat-overview',
    submissionMethod: 'api' as const,
    apiReady: true,
  }),

  hasSubJurisdictions: () => false,
  supportsCustomFields: () => false,

  /** GB treatment catalogue in HMRC vocabulary, mapped to VAT100 boxes. */
  getTaxTreatments(): TaxTreatmentDefinition[] {
    const ref = 'https://www.gov.uk/guidance/how-to-fill-in-and-submit-your-vat-return-vat-notice-70012';
    return [
      {
        code: 'SALE_STANDARD',
        label: 'Standard rate (20%)',
        side: 'sale',
        rate: 0.2,
        taxApplies: true,
        creditable: true,
        boxes: ['Box 1', 'Box 6'],
        help: 'Sales at the 20% standard rate. VAT due at box 1; net value at box 6.',
        authorityRef: ref,
        defaultFor: ['sales', 'services_income'],
      },
      {
        code: 'SALE_REDUCED',
        label: 'Reduced rate (5%)',
        side: 'sale',
        rate: 0.05,
        taxApplies: true,
        creditable: true,
        boxes: ['Box 1', 'Box 6'],
        help: 'Sales at the 5% reduced rate (domestic fuel and power, certain energy-saving materials). VAT at box 1; net value at box 6.',
        authorityRef: ref,
      },
      {
        code: 'SALE_ZERO_RATED',
        label: 'Zero rated (0%)',
        side: 'sale',
        rate: 0,
        taxApplies: false,
        creditable: true,
        boxes: ['Box 6'],
        help: 'Zero-rated sales (most food, books, children\'s clothing, exports). Net value at box 6; input VAT remains recoverable.',
        authorityRef: ref,
        defaultFor: ['export_sales'],
      },
      {
        code: 'SALE_INPUT_TAXED',
        label: 'Exempt',
        side: 'sale',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: ['Box 6'],
        help: 'Exempt supplies (finance and insurance, most property letting, education, health). Net value at box 6; related input VAT is not recoverable (partial exemption).',
        authorityRef: ref,
        defaultFor: ['interest_income', 'residential_rent'],
      },
      {
        code: 'PURCHASE_STANDARD',
        label: 'Standard rate purchase (20%)',
        side: 'purchase',
        rate: 0.2,
        taxApplies: true,
        creditable: true,
        boxes: ['Box 4', 'Box 7'],
        help: 'Purchases with 20% VAT. Input VAT reclaimed at box 4; net value at box 7.',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_CAPITAL',
        label: 'Capital purchase (20%)',
        side: 'purchase',
        rate: 0.2,
        taxApplies: true,
        creditable: true,
        boxes: ['Box 4', 'Box 7'],
        help: 'Capital assets bought with VAT. Input VAT at box 4; net value at box 7.',
        authorityRef: ref,
        defaultFor: ['equipment', 'vehicles'],
      },
      {
        code: 'PURCHASE_REDUCED',
        label: 'Reduced rate purchase (5%)',
        side: 'purchase',
        rate: 0.05,
        taxApplies: true,
        creditable: true,
        boxes: ['Box 4', 'Box 7'],
        help: 'Purchases at the 5% reduced rate. Input VAT at box 4; net value at box 7.',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_NO_TAX',
        label: 'Zero rated / exempt purchase',
        side: 'purchase',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: ['Box 7'],
        help: 'Purchases with no VAT in the price (zero-rated goods, exempt services such as insurance and bank charges, unregistered suppliers). Net value at box 7 only.',
        authorityRef: ref,
        defaultFor: ['bank_fees', 'insurance_stamp_duty'],
      },
      {
        code: 'PURCHASE_CAPITAL_NO_TAX',
        label: 'Capital purchase with no VAT',
        side: 'purchase',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: ['Box 7'],
        help: 'Capital assets bought with no VAT in the price. Net value at box 7 only.',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_INPUT_TAXED',
        label: 'Purchase for exempt supplies (partial exemption)',
        side: 'purchase',
        rate: 0.2,
        taxApplies: true,
        creditable: false,
        boxes: ['Box 7'],
        help: 'Purchases used to make exempt supplies; the input VAT is not recoverable unless within the de minimis limit. Net value at box 7.',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_PRIVATE',
        label: 'Private use / blocked input tax',
        side: 'purchase',
        rate: 0.2,
        taxApplies: true,
        creditable: false,
        boxes: ['Box 7'],
        help: 'Private-use portion and blocked items (business entertainment, most cars). No box 4 claim; net value at box 7.',
        authorityRef: ref,
        defaultFor: ['entertainment', 'fines_penalties'],
      },
      {
        code: 'PURCHASE_REVERSE_CHARGE',
        label: 'Reverse charge services',
        side: 'purchase',
        rate: 0.2,
        taxApplies: true,
        creditable: true,
        boxes: ['Box 1', 'Box 4', 'Box 6', 'Box 7'],
        help: 'Services bought from overseas suppliers (and domestic reverse charge): account for the VAT at box 1 and reclaim at box 4; the net value goes in both box 6 and box 7.',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_IMPORT',
        label: 'Imported goods (postponed VAT accounting)',
        side: 'purchase',
        rate: 0.2,
        taxApplies: true,
        creditable: true,
        boxes: ['Box 1', 'Box 4', 'Box 7'],
        help: 'Goods imported using postponed VAT accounting: import VAT at box 1 and reclaimed at box 4; net value at box 7.',
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
        help: 'Outside the scope of VAT; not on the VAT return.',
        defaultFor: ['wages', 'salaries'],
      },
      {
        code: 'WITHHOLDING',
        label: 'PAYE / NIC withheld',
        side: 'payroll',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: [],
        help: 'Reported through PAYE Real Time Information, not the VAT return.',
        defaultFor: ['payg_withholding'],
      },
      {
        code: 'OUT_OF_SCOPE',
        label: 'Outside the scope of VAT',
        side: 'excluded',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: [],
        help: 'Transfers, loan principal, drawings, dividends, tax payments, depreciation, MOT tests, statutory fees. Not on the VAT return.',
        defaultFor: ['transfers', 'loan_principal', 'owner_drawings', 'dividends', 'tax_payments', 'government_fees'],
      },
    ];
  },

  /** HMRC's pooled capital allowances regime — see ./unitedKingdomDepreciation. */
  getDepreciationRules(): DepreciationRules {
    return UK_DEPRECIATION_RULES;
  },
};

export default ukPlugin;
