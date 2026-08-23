/**
 * South Africa VAT201 Return - ai2fin.com
 * South African Revenue Service (SARS)
 * Reference: https://www.sars.gov.za/guide-to-completing-the-value-added-tax-vat201-return/
 * ARCHITECTURE: 15% standard rate (from Apr 2018). FY varies by vendor (commonly Mar-Feb).
 *   Category A: bimonthly (most vendors). Category B: monthly (turnover >R30M).
 *   Category C: 6-monthly (farming). Category D: annual (turnover <R1.5M).
 *   eFiling mandatory for most. PRN auto-generated.
 */

import { toCsv } from '../exportUtils';

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
  TaxTreatmentDefinition,
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

    // Return the override-aware output_vat/input_vat (not *_calc): total_output/total_input
    // are computed from the overrides, so returning the pre-override figures discarded the
    // user's manual VAT adjustments on save. embracingearth.space
    return { output_vat, total_output, input_vat, total_input, net_vat, total_payable };
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
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v: FieldValues, format: string): Promise<ExportOutput> {
    if (format === 'csv') return toCsv(v, `VAT201-ZA-${new Date().toISOString().slice(0, 10)}`);
    return {
      data: JSON.stringify(v, null, 2),
      filename: `VAT201-ZA-${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/json',
    };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://www.sarsefiling.co.za', submissionMethod: 'manual_upload' as const, apiReady: false }),
  hasSubJurisdictions: () => false,
  supportsCustomFields: () => false,

  /** ZA treatment catalogue in SARS vocabulary, mapped to VAT201 fields. */
  getTaxTreatments(): TaxTreatmentDefinition[] {
    const ref = 'https://www.sars.gov.za/guide-to-completing-the-value-added-tax-vat201-return/';
    return [
      {
        code: 'SALE_STANDARD',
        label: 'Standard-rated supplies (15%)',
        side: 'sale',
        rate: ZA_RATE,
        taxApplies: true,
        creditable: true,
        boxes: ['Field 1', 'Field 4'],
        help: 'Supplies with 15% VAT in the price. VAT-inclusive value in Field 1; output VAT (15/115) in Field 4.',
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
        boxes: ['Field 2'],
        help: 'Exports, basic foodstuffs, fuel levy goods and other zero-rated supplies. Value in Field 2; input VAT remains claimable.',
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
        boxes: ['Field 3'],
        help: 'Financial services (including interest), residential accommodation, public road and rail transport. Value in Field 3; no input VAT on related acquisitions.',
        authorityRef: ref,
        defaultFor: ['interest_income', 'residential_rent'],
      },
      {
        code: 'PURCHASE_STANDARD',
        label: 'Other goods and services (15%)',
        side: 'purchase',
        rate: ZA_RATE,
        taxApplies: true,
        creditable: true,
        boxes: ['Field 15', 'Field 17'],
        help: 'Operating purchases with 15% VAT supported by a valid tax invoice. VAT-inclusive value in Field 15; input VAT in Field 17.',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_CAPITAL',
        label: 'Capital goods and services (15%)',
        side: 'purchase',
        rate: ZA_RATE,
        taxApplies: true,
        creditable: true,
        boxes: ['Field 14', 'Field 17'],
        help: 'Capital goods acquired with 15% VAT. VAT-inclusive value in Field 14; input VAT in Field 17.',
        authorityRef: ref,
        defaultFor: ['equipment', 'vehicles'],
      },
      {
        code: 'PURCHASE_NO_TAX',
        label: 'Acquisitions without VAT',
        side: 'purchase',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: [],
        help: 'Purchases with no VAT in the price (exempt services such as bank interest, non-vendor suppliers, zero-rated goods). Not included in Fields 14/15.',
        authorityRef: ref,
        defaultFor: ['bank_fees', 'government_fees'],
      },
      {
        code: 'PURCHASE_INPUT_TAXED',
        label: 'Acquisitions for making exempt supplies',
        side: 'purchase',
        rate: ZA_RATE,
        taxApplies: true,
        creditable: false,
        boxes: [],
        help: 'VAT on acquisitions used for exempt supplies is not deductible (apportion mixed use).',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_PRIVATE',
        label: 'Denied input tax / private use',
        side: 'purchase',
        rate: ZA_RATE,
        taxApplies: true,
        creditable: false,
        boxes: [],
        help: 'Entertainment, passenger motor cars, club fees (section 17(2)) and private-use portions. No input VAT claim.',
        authorityRef: ref,
        defaultFor: ['entertainment', 'fines_penalties'],
      },
      {
        code: 'PURCHASE_REVERSE_CHARGE',
        label: 'Imported services',
        side: 'purchase',
        rate: ZA_RATE,
        taxApplies: true,
        creditable: true,
        boxes: [],
        help: 'VAT on imported services used for non-taxable purposes is declared on a VAT215, not the VAT201; fully taxable use needs no declaration.',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_IMPORT',
        label: 'Imported goods (customs VAT)',
        side: 'purchase',
        rate: ZA_RATE,
        taxApplies: true,
        creditable: true,
        boxes: ['Field 17'],
        help: 'VAT paid to SARS Customs on imported goods is claimed as input VAT (VAT201 Field 14A/15A, totalled into Field 17).',
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
        help: 'Not a supply; not on the VAT201.',
        defaultFor: ['wages', 'salaries'],
      },
      {
        code: 'WITHHOLDING',
        label: 'PAYE / UIF / SDL withheld',
        side: 'payroll',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: [],
        help: 'Declared on the EMP201, not the VAT201.',
        defaultFor: ['payg_withholding'],
      },
      {
        code: 'OUT_OF_SCOPE',
        label: 'Out of scope',
        side: 'excluded',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: [],
        help: 'Transfers, loan principal, drawings, dividends, tax payments, depreciation.',
        defaultFor: ['transfers', 'loan_principal', 'owner_drawings', 'dividends', 'tax_payments'],
      },
    ];
  },
};

export default zaPlugin;
