/**
 * Ghana VAT Filing Plugin — @ai2/tax-plugins
 * ai2fin.com
 *
 * AUTHORITY: Ghana Revenue Authority (GRA) — gra.gov.gh
 * RATE: 20% effective (15% VAT + 2.5% NHIL + 2.5% GETFund Levy, Act 1151)
 * FILING: Monthly (due by last working day of following month)
 * FY: January 1 – December 31
 *
 * Ghana's Value Added Tax Act, 2025 (Act 1151) took effect 1 January 2026.
 * It recoupled NHIL and GETFund into the VAT base (single 20% rate),
 * abolished the Flat Rate Scheme, and raised registration threshold to GH¢750,000.
 *
 * Reference: Value Added Tax Act 2025 (Act 1151)
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
  PortalInfo,
  TaxTerminology,
  FilingPeriodConfig,
} from '../types';

// Effective combined VAT rate under Act 1151 (15% VAT + 2.5% NHIL + 2.5% GETFund)
const VAT_RATE = 0.20;

/**
 * Round to two decimal places (GHS has pesewas).
 */
function roundGH(n: number): number {
  return Math.round(n * 100) / 100;
}

const ghanaPlugin: TaxFilingPlugin = {
  countryCode: 'GH',
  displayName: 'VAT Return (Ghana)',
  shortName: 'VAT Return',
  authority: {
    name: 'GRA',
    fullName: 'Ghana Revenue Authority',
    portalUrl: 'https://gra.gov.gh',
    helpUrl: 'https://gra.gov.gh/domestic-tax/tax-types/vat/',
  },
  taxFamily: 'VAT',
  isFullPlugin: true,

  getFormSchema(): FormSection[] {
    return [
      {
        id: 'output',
        title: 'Output Tax (Sales)',
        description: 'VAT charged on your taxable supplies of goods and services',
        fields: [
          {
            id: 'standard_rated_supplies',
            label: 'Standard-rated supplies (incl. VAT)',
            officialLabel: 'Box 1',
            helpText: 'Total value of all standard-rated supplies (goods and services) including VAT at 20%. This is the combined rate of 15% VAT + 2.5% NHIL + 2.5% GETFund under Act 1151.',
            type: 'currency',
            editable: true,
            required: true,
            autoPopulateFrom: 'income_taxable',
          },
          {
            id: 'zero_rated_supplies',
            label: 'Zero-rated supplies',
            officialLabel: 'Box 2',
            helpText: 'Exports and other supplies taxed at 0%. Includes goods exported out of Ghana and certain agricultural inputs.',
            type: 'currency',
            editable: true,
            required: false,
            autoPopulateFrom: 'income_export',
          },
          {
            id: 'exempt_supplies',
            label: 'Exempt supplies',
            officialLabel: 'Box 3',
            helpText: 'Supplies exempt from VAT: unprocessed foodstuffs, agricultural inputs, educational materials, health services, financial services.',
            type: 'currency',
            editable: true,
            required: false,
            autoPopulateFrom: 'income_exempt',
          },
          {
            id: 'total_supplies',
            label: 'Total supplies',
            officialLabel: 'Box 4',
            type: 'currency',
            calculated: true,
            calculationFormula: 'standard_rated_supplies + zero_rated_supplies + exempt_supplies',
            dependsOn: ['standard_rated_supplies', 'zero_rated_supplies', 'exempt_supplies'],
            editable: false,
            required: true,
          },
          {
            id: 'output_tax',
            label: 'Output tax (VAT on sales)',
            officialLabel: 'Box 5',
            helpText: 'VAT collected on standard-rated supplies: amount × 20/120.',
            type: 'currency',
            calculated: true,
            calculationFormula: 'standard_rated_supplies × 20/120',
            dependsOn: ['standard_rated_supplies'],
            editable: false,
            required: true,
          },
        ],
      },
      {
        id: 'input',
        title: 'Input Tax (Purchases)',
        description: 'VAT paid on business purchases that you can claim back',
        fields: [
          {
            id: 'taxable_purchases',
            label: 'Taxable purchases (incl. VAT)',
            officialLabel: 'Box 6',
            helpText: 'Total value of standard-rated purchases including VAT. Under Act 1151, input tax credits now include NHIL and GETFund components.',
            type: 'currency',
            editable: true,
            required: true,
            autoPopulateFrom: 'expenses_taxable',
          },
          {
            id: 'import_vat',
            label: 'VAT paid on imports (customs)',
            officialLabel: 'Box 7',
            helpText: 'VAT paid at the port/customs on imported goods. Obtain this from your customs declaration (SAD).',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: 'capital_goods_vat',
            label: 'VAT on capital goods',
            officialLabel: 'Box 8',
            helpText: 'VAT paid on purchases of capital assets (machinery, equipment, vehicles for business use).',
            type: 'currency',
            editable: true,
            required: false,
            autoPopulateFrom: 'expenses_capital',
          },
          {
            id: 'input_tax',
            label: 'Total input tax (VAT on purchases)',
            officialLabel: 'Box 9',
            helpText: 'Total VAT recoverable: (taxable purchases × 20/120) + import VAT + capital goods VAT.',
            type: 'currency',
            calculated: true,
            calculationFormula: '(taxable_purchases × 20/120) + import_vat + capital_goods_vat',
            dependsOn: ['taxable_purchases', 'import_vat', 'capital_goods_vat'],
            editable: true,
            required: true,
            autoPopulateFrom: 'expenses_tax_credits',
          },
        ],
      },
      {
        id: 'adjustments',
        title: 'Adjustments',
        fields: [
          {
            id: 'prior_credit',
            label: 'Credit brought forward from previous period',
            officialLabel: 'Box 10',
            helpText: 'If your previous return resulted in a net credit, enter that amount here.',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: 'other_adjustments',
            label: 'Other adjustments (+ or -)',
            officialLabel: 'Box 11',
            helpText: 'Bad debt relief, corrections from prior periods, or other adjustments.',
            type: 'currency',
            editable: true,
            required: false,
          },
        ],
      },
      {
        id: 'summary',
        title: 'Summary — Net VAT',
        fields: [
          {
            id: 'net_vat',
            label: 'Net VAT payable or (credit)',
            officialLabel: 'Box 12',
            helpText: 'Positive = VAT to pay to GRA. Negative = credit to carry forward or claim refund.',
            type: 'currency',
            calculated: true,
            calculationFormula: 'output_tax - input_tax - prior_credit + other_adjustments',
            dependsOn: ['output_tax', 'input_tax', 'prior_credit', 'other_adjustments'],
            editable: false,
            required: true,
          },
          {
            id: 'credit_carried_forward',
            label: 'Credit to carry forward',
            officialLabel: 'Box 13',
            helpText: 'If net VAT is negative, this amount carries to next period\'s Box 10.',
            type: 'currency',
            calculated: true,
            calculationFormula: 'abs(min(0, net_vat))',
            dependsOn: ['net_vat'],
            editable: false,
            required: false,
          },
        ],
      },
    ];
  },

  getFilingPeriods(): FilingPeriodConfig {
    return {
      monthly: true,
      quarterly: false,
      annual: false,
      defaultFrequency: 'monthly',
    };
  },

  getFinancialYearBounds(year: number) {
    return {
      start: new Date(year, 0, 1),  // January 1
      end: new Date(year, 11, 31),  // December 31
    };
  },

  getTerminology(): TaxTerminology {
    return {
      taxName: 'VAT',
      taxAbbrev: 'VAT',
      salesLabel: 'Supplies',
      purchasesLabel: 'Purchases',
      outputTaxLabel: 'Output Tax (VAT on sales)',
      inputTaxLabel: 'Input Tax (VAT on purchases)',
    };
  },

  calculateFields(v: FieldValues): CalculatedFields {
    const standardRated = Number(v.standard_rated_supplies) || 0;
    const zeroRated = Number(v.zero_rated_supplies) || 0;
    const exempt = Number(v.exempt_supplies) || 0;
    const taxablePurchases = Number(v.taxable_purchases) || 0;
    const importVat = Number(v.import_vat) || 0;
    const capitalGoodsVat = Number(v.capital_goods_vat) || 0;
    const priorCredit = Number(v.prior_credit) || 0;
    const otherAdj = Number(v.other_adjustments) || 0;

    const totalSupplies = standardRated + zeroRated + exempt;
    // Extract VAT from inclusive amount: amount × rate / (1 + rate) = amount × 20/120
    const outputTax = roundGH((standardRated * VAT_RATE) / (1 + VAT_RATE));

    // Input tax: extract from purchases + direct import/capital VAT
    const inputTaxCalc = roundGH((taxablePurchases * VAT_RATE) / (1 + VAT_RATE)) + importVat + capitalGoodsVat;
    // Allow manual override if user has edited the field — but never let a
    // non-numeric override inject NaN into net_vat / credit_carried_forward.
    const overrideRaw = (v.input_tax !== undefined && v.input_tax !== '' && v.input_tax !== null)
      ? Number(v.input_tax)
      : NaN;
    const inputTax = Number.isFinite(overrideRaw) ? overrideRaw : inputTaxCalc;

    const netVat = roundGH(outputTax - inputTax - priorCredit + otherAdj);
    const creditCarried = netVat < 0 ? Math.abs(netVat) : 0;

    return {
      total_supplies: roundGH(totalSupplies),
      output_tax: outputTax,
      input_tax: roundGH(inputTax),
      net_vat: netVat,
      credit_carried_forward: creditCarried,
    };
  },

  getAutoPopulateMapping(): AggregationMapping[] {
    return [
      { fieldId: 'standard_rated_supplies', aggregateKey: 'income_taxable' },
      { fieldId: 'zero_rated_supplies', aggregateKey: 'income_export' },
      { fieldId: 'exempt_supplies', aggregateKey: 'income_exempt' },
      { fieldId: 'taxable_purchases', aggregateKey: 'expenses_taxable' },
      { fieldId: 'capital_goods_vat', aggregateKey: 'expenses_capital' },
      { fieldId: 'input_tax', aggregateKey: 'expenses_tax_credits' },
    ];
  },

  getRoundingRules(): RoundingConfig {
    // GHS has pesewas (hundredths), round to 2 decimal places
    return { method: 'nearest', decimals: 2 };
  },

  validateForm(v: FieldValues): ValidationResult[] {
    const results: ValidationResult[] = [];
    if (Number(v.standard_rated_supplies) < 0) {
      results.push({ fieldId: 'standard_rated_supplies', message: 'Standard-rated supplies cannot be negative', severity: 'error' });
    }
    if (Number(v.taxable_purchases) < 0) {
      results.push({ fieldId: 'taxable_purchases', message: 'Taxable purchases cannot be negative', severity: 'error' });
    }
    if (Number(v.zero_rated_supplies) < 0) {
      results.push({ fieldId: 'zero_rated_supplies', message: 'Zero-rated supplies cannot be negative', severity: 'error' });
    }
    if (Number(v.exempt_supplies) < 0) {
      results.push({ fieldId: 'exempt_supplies', message: 'Exempt supplies cannot be negative', severity: 'error' });
    }
    if (Number(v.capital_goods_vat) < 0) {
      results.push({ fieldId: 'capital_goods_vat', message: 'Capital goods VAT cannot be negative', severity: 'error' });
    }
    if (Number(v.import_vat) < 0) {
      results.push({ fieldId: 'import_vat', message: 'Import VAT cannot be negative', severity: 'error' });
    }
    return results;
  },

  getFieldHelp(fieldId: string): string | null {
    const help: Record<string, string> = {
      standard_rated_supplies: 'All sales of goods and services subject to the standard 20% rate (15% VAT + 2.5% NHIL + 2.5% GETFund). Include the VAT in this figure (tax-inclusive).',
      zero_rated_supplies: 'Exports of goods, international transport services, and supplies to Free Zone enterprises. These are taxable at 0%.',
      exempt_supplies: 'Supplies exempt from VAT under Schedule 1 of Act 1151: unprocessed foodstuffs, medical supplies, educational materials, financial services, residential rent.',
      output_tax: 'VAT collected on your sales. Calculated automatically as standard-rated supplies × 20/120.',
      taxable_purchases: 'Purchases from VAT-registered suppliers where VAT was charged. Include VAT in this figure.',
      import_vat: 'VAT paid to Ghana Customs on imported goods. Use the amount from your customs entry (SAD form).',
      capital_goods_vat: 'VAT paid on capital equipment and fixed assets used in your business.',
      input_tax: 'Total reclaimable VAT. Under Act 1151, you can now claim input tax credits on the full 20% (including NHIL and GETFund components).',
      prior_credit: 'Excess credit from your previous VAT return. This is the Box 13 figure from your last return.',
      net_vat: 'Positive amount = VAT payable to GRA by last working day of the following month. Negative = credit carried forward.',
      credit_carried_forward: 'This amount will be entered in Box 10 of your next VAT return.',
    };
    return help[fieldId] ?? null;
  },

  getSupportedExportFormats(): ExportFormat[] {
    return [
      { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
      { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
    ];
  },

  async generateExport(values: FieldValues, format: string): Promise<ExportOutput> {
    const date = new Date().toISOString().slice(0, 10);
    if (format === 'csv') {
      // Quote fields containing CSV-special chars (comma, quote, newline) per RFC 4180.
      const esc = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
      const rows = Object.entries(values).map(([k, v]) => `${esc(k)},${esc(String(v ?? ''))}`);
      return {
        data: ['field,value', ...rows].join('\r\n'),
        filename: `VAT-GH-${date}.csv`,
        mimeType: 'text/csv',
      };
    }
    if (format === 'json') {
      return {
        data: JSON.stringify(values, null, 2),
        filename: `VAT-GH-${date}.json`,
        mimeType: 'application/json',
      };
    }
    throw new RangeError(`Unsupported export format "${format}" — supported: json, csv`);
  },

  getPortalSubmissionInfo(): PortalInfo {
    return {
      portalUrl: 'https://gra.gov.gh',
      submissionMethod: 'manual_upload',
      apiReady: false,
    };
  },

  hasSubJurisdictions() { return false; },
  supportsCustomFields() { return false; },
};

export default ghanaPlugin;
