/**
 * Australia Business Activity Statement (BAS) Plugin - ai2fin.com
 * Full scope: GST (G1-G11, 1A, 1B) + PAYG Withholding (W1-W5)
 *   + PAYG Instalments (T1-T9) + FBT (F1-F4) + Summary (8A, 8B, 9)
 * Authority: Australian Taxation Office (ATO)
 * Reference: https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/activity-statements
 * ARCHITECTURE: ATO rounds all dollar amounts DOWN to whole dollars (no cents).
 *   Financial year: 1 Jul - 30 Jun. Default quarterly filing.
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

/**
 * ATO rounding: truncate to whole dollar (towards zero).
 * ATO explicitly states: "Round down to whole dollars. Do not show cents."
 */
function roundATO(value: number): number {
  return Math.trunc(value);
}

/** Check if user explicitly provided a value (not empty/null/undefined) */
function hasUserValue(v: unknown): boolean {
  return v !== '' && v !== undefined && v !== null;
}

const australiaPlugin: TaxFilingPlugin = {
  countryCode: 'AU',
  displayName: 'Business Activity Statement (BAS)',
  shortName: 'BAS',
  authority: {
    name: 'ATO',
    fullName: 'Australian Taxation Office',
    portalUrl: 'https://www.ato.gov.au',
    helpUrl:
      'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/activity-statements',
  },
  taxFamily: 'GST',
  isFullPlugin: true,

  getFormSchema() {
    const sections: FormSection[] = [
      {
        id: 'gst',
        title: 'GST — Goods and Services Tax',
        description:
          'Report GST on sales and purchases for the period. Amounts include GST unless stated.',
        fields: [
          {
            id: 'G1',
            label: 'Total sales (including any GST)',
            officialLabel: 'G1',
            type: 'currency',
            editable: true,
            required: true,
            autoPopulateFrom: 'income_total',
            helpText: 'Total gross income including GST, GST-free and export sales',
          },
          {
            id: 'G2',
            label: 'Export sales',
            officialLabel: 'G2',
            type: 'currency',
            editable: true,
            required: false,
            autoPopulateFrom: 'income_export',
            helpText: 'GST-free export sales of goods and services',
          },
          {
            id: 'G3',
            label: 'Other GST-free sales',
            officialLabel: 'G3',
            type: 'currency',
            editable: true,
            required: false,
            autoPopulateFrom: 'income_gst_free',
            helpText: 'GST-free supplies (food, health, education, etc.)',
          },
          {
            id: 'G4',
            label: 'Input-taxed sales',
            officialLabel: 'G4',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Input-taxed supplies (financial supplies, residential rent). No GST collected and no input tax credits on related purchases.',
          },
          {
            id: 'G10',
            label: 'Capital purchases (including GST)',
            officialLabel: 'G10',
            type: 'currency',
            editable: true,
            required: false,
            autoPopulateFrom: 'expenses_capital',
            helpText: 'Assets / capital items purchased including GST',
          },
          {
            id: 'G11',
            label: 'Non-capital purchases (including GST)',
            officialLabel: 'G11',
            type: 'currency',
            editable: true,
            required: false,
            autoPopulateFrom: 'expenses_non_capital',
            helpText: 'All other purchases for your business including GST',
          },
          {
            id: '1A',
            label: 'GST on sales',
            officialLabel: '1A',
            type: 'currency',
            calculated: true,
            editable: true,
            required: true,
            helpText:
              'GST collected on taxable sales. Calculated as (G1 − G2 − G3) ÷ 11. Override if using calculation worksheet.',
          },
          {
            id: '1B',
            label: 'GST on purchases',
            officialLabel: '1B',
            type: 'currency',
            calculated: true,
            editable: true,
            required: true,
            helpText: 'GST credits on business purchases. Calculated as (G10 + G11) ÷ 11.',
          },
        ],
      },
      {
        id: 'payg_withholding',
        title: 'PAYG Tax Withheld',
        description: 'Amounts you withheld from payments to employees, directors and contractors.',
        fields: [
          {
            id: 'W1',
            label: 'Total salary, wages and other payments',
            officialLabel: 'W1',
            type: 'currency',
            editable: true,
            required: false,
            autoPopulateFrom: 'payroll_gross',
            helpText: 'Gross wages, salary, directors fees, allowances paid this period',
          },
          {
            id: 'W2',
            label: 'Amounts withheld from salary, wages and other payments',
            officialLabel: 'W2',
            type: 'currency',
            editable: true,
            required: false,
            autoPopulateFrom: 'payroll_withheld',
            helpText: 'Tax withheld from W1 payments',
          },
          {
            id: 'W3',
            label: 'Amounts withheld from investment distributions (no TFN quoted)',
            officialLabel: 'W3',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Tax withheld from distributions where TFN not provided',
          },
          {
            id: 'W4',
            label: 'Amounts withheld from invoices (no ABN quoted)',
            officialLabel: 'W4',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Tax withheld from supplier invoices without ABN',
          },
          {
            id: 'W5',
            label: 'Total amounts withheld',
            officialLabel: 'W5',
            type: 'currency',
            calculated: true,
            editable: false,
            required: false,
            helpText: 'Sum of W2 + W3 + W4',
          },
        ],
      },
      {
        id: 'payg_instalments',
        title: 'PAYG Income Tax Instalment',
        description:
          'Pay-as-you-go income tax instalments. Choose instalment amount (T7) or instalment rate method (T1-T2).',
        collapsed: true,
        fields: [
          {
            id: 'T1',
            label: 'Instalment income',
            officialLabel: 'T1',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Business and investment income for the period (rate method)',
          },
          {
            id: 'T2',
            label: 'Instalment rate',
            officialLabel: 'T2',
            type: 'percentage',
            editable: true,
            required: false,
            helpText: 'ATO-notified instalment rate. Enter as decimal e.g. 0.08 for 8%',
          },
          {
            id: 'T3',
            label: 'Instalment amount (rate method)',
            officialLabel: 'T3',
            type: 'currency',
            calculated: true,
            editable: false,
            required: false,
            helpText: 'T1 × T2',
          },
          {
            id: 'T7',
            label: 'Instalment amount (amount method)',
            officialLabel: 'T7',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'ATO-notified instalment amount. Use this OR the rate method, not both.',
          },
          {
            id: 'T8',
            label: 'Variation to instalment amount',
            officialLabel: 'T8',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Estimated amount if varying your instalment',
          },
          {
            id: 'T9',
            label: 'Estimated tax for the year',
            officialLabel: 'T9',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Required if varying — your estimated tax for the full year',
          },
        ],
      },
      {
        id: 'fbt',
        title: 'Fringe Benefits Tax (FBT)',
        description: 'Only complete if you have FBT obligations for the FBT year (1 Apr - 31 Mar).',
        collapsed: true,
        fields: [
          {
            id: 'F1',
            label: 'FBT instalment',
            officialLabel: 'F1',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'ATO-notified FBT instalment amount',
          },
          {
            id: 'F2',
            label: 'Estimated total FBT',
            officialLabel: 'F2',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Your estimated FBT payable for the FBT year (if varying)',
          },
          {
            id: 'F3',
            label: 'Varied FBT instalment',
            officialLabel: 'F3',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Varied quarterly FBT instalment',
          },
          {
            id: 'F4',
            label: 'FBT annual return amount',
            officialLabel: 'F4',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Total FBT payable on your annual FBT return',
          },
        ],
      },
      {
        id: 'summary',
        title: 'Summary',
        description: 'Your total GST and PAYG obligations for this period.',
        fields: [
          {
            id: '8A',
            label: 'PAYG instalment (from T3, T7, or T8)',
            officialLabel: '8A',
            type: 'currency',
            calculated: true,
            editable: false,
            required: false,
            helpText: 'Your income tax instalment amount for the period',
          },
          {
            id: '8B',
            label: 'FBT instalment (from F1 or F3)',
            officialLabel: '8B',
            type: 'currency',
            calculated: true,
            editable: false,
            required: false,
            helpText: 'Your FBT instalment for the period',
          },
          {
            id: '9',
            label: 'Amount payable or refundable',
            officialLabel: '9',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
            helpText: '1A − 1B + W5 + 8A + 8B. Positive = you owe. Negative = refund.',
          },
        ],
      },
    ];
    return sections;
  },

  getFilingPeriods() {
    return { monthly: true, quarterly: true, annual: true, defaultFrequency: 'quarterly' };
  },

  getFinancialYearBounds(year: number) {
    // Australian FY: 1 July year to 30 June year+1
    return { start: new Date(year, 6, 1), end: new Date(year + 1, 5, 30) };
  },

  getTerminology() {
    return {
      taxName: 'GST',
      taxAbbrev: 'GST',
      salesLabel: 'Sales',
      purchasesLabel: 'Purchases',
      outputTaxLabel: 'GST on sales',
      inputTaxLabel: 'GST on purchases',
    };
  },

  calculateFields(inputs: FieldValues): CalculatedFields {
    const G1 = Number(inputs.G1) || 0;
    const G2 = Number(inputs.G2) || 0;
    const G3 = Number(inputs.G3) || 0;
    const G4 = Number(inputs.G4) || 0;
    const G10 = Number(inputs.G10) || 0;
    const G11 = Number(inputs.G11) || 0;

    // ATO: taxable sales = total - export - GST-free - input-taxed
    const taxableSales = G1 - G2 - G3 - G4;
    // ATO simplified calculation: GST = taxable sales / 11 (GST-inclusive ÷ 11)
    const oneA_calc = roundATO(taxableSales / 11);
    const oneB_calc = roundATO((G10 + G11) / 11);

    // Allow user override of 1A/1B (e.g., calculation worksheet result)
    const oneA = hasUserValue(inputs['1A'])
      ? roundATO(Number(inputs['1A']) || 0)
      : oneA_calc;
    const oneB = hasUserValue(inputs['1B'])
      ? roundATO(Number(inputs['1B']) || 0)
      : oneB_calc;

    // PAYG Withholding
    const W2 = Number(inputs.W2) || 0;
    const W3 = Number(inputs.W3) || 0;
    const W4 = Number(inputs.W4) || 0;
    const W5 = roundATO(W2 + W3 + W4);

    // PAYG Instalments: use T8 (variation) > T7 (amount method) > T3 (rate method)
    // ATO allows $0 variations — check if field was provided, not just > 0
    const T1 = Number(inputs.T1) || 0;
    const T2 = Number(inputs.T2) || 0;
    const T3 = roundATO(T1 * T2);
    const T7 = Number(inputs.T7) || 0;
    const T8 = Number(inputs.T8) || 0;
    const eightA = hasUserValue(inputs.T8)
      ? roundATO(T8)
      : hasUserValue(inputs.T7)
        ? roundATO(T7)
        : T3;

    // FBT: use F3 (varied) if present, else F1 (standard instalment)
    const F1 = Number(inputs.F1) || 0;
    const F3 = Number(inputs.F3) || 0;
    const eightB = hasUserValue(inputs.F3) ? roundATO(F3) : roundATO(F1);

    // Label 9: Net amount payable / refundable — ai2fin.com
    const netAmount = roundATO(oneA - oneB + W5 + eightA + eightB);

    return {
      '1A': oneA_calc,
      '1B': oneB_calc,
      W5,
      T3,
      '8A': eightA,
      '8B': eightB,
      '9': netAmount,
    };
  },

  getAutoPopulateMapping(): AggregationMapping[] {
    return [
      { fieldId: 'G1', aggregateKey: 'income_total' },
      { fieldId: 'G2', aggregateKey: 'income_export' },
      { fieldId: 'G3', aggregateKey: 'income_gst_free' },
      { fieldId: 'G10', aggregateKey: 'expenses_capital' },
      { fieldId: 'G11', aggregateKey: 'expenses_non_capital' },
      { fieldId: 'W1', aggregateKey: 'payroll_gross' },
      { fieldId: 'W2', aggregateKey: 'payroll_withheld' },
    ];
  },

  getRoundingRules(): RoundingConfig {
    return { method: 'down', decimals: 0, wholeOnly: true, noNegatives: false };
  },

  validateForm(values: FieldValues): ValidationResult[] {
    const results: ValidationResult[] = [];

    if (Number(values.G1) < 0) {
      results.push({ fieldId: 'G1', message: 'Total sales cannot be negative', severity: 'error' });
    }
    const G1 = Number(values.G1) || 0;
    const G2 = Number(values.G2) || 0;
    const G3 = Number(values.G3) || 0;
    if (G2 + G3 > G1 && G1 > 0) {
      results.push({
        fieldId: 'G2',
        message: 'Export + GST-free sales exceed total sales (G1). Please check.',
        severity: 'warning',
      });
    }
    if (Number(values.W1) > 0 && Number(values.W2) === 0) {
      results.push({
        fieldId: 'W2',
        message: 'You reported wages (W1) but no tax withheld (W2). Is this correct?',
        severity: 'warning',
      });
    }
    // PAYG Instalment: can't use both methods
    if (Number(values.T7) > 0 && Number(values.T1) > 0) {
      results.push({
        fieldId: 'T7',
        message: 'Use either amount method (T7) or rate method (T1/T2), not both',
        severity: 'warning',
      });
    }
    // Variation requires estimated tax
    if (Number(values.T8) > 0 && !Number(values.T9)) {
      results.push({
        fieldId: 'T9',
        message: 'T9 (estimated tax for year) is required when varying instalment (T8)',
        severity: 'error',
      });
    }

    return results;
  },

  getFieldHelp(fieldId: string) {
    const help: Record<string, string> = {
      G1: 'Include all gross sales including GST, GST-free and export. From your income accounts.',
      G2: 'Export sales are GST-free. Include goods and services exported overseas.',
      G3: 'Other GST-free supplies — input-taxed sales, food, health, education, etc.',
      G10: 'Capital items (assets) you purchased for business use. Include GST component.',
      G11: 'All other business purchases (supplies, services, rent). Include GST component.',
      '1A': 'GST collected on your taxable sales. Normally (G1 − G2 − G3) ÷ 11. Use calculation worksheet for precise figure.',
      '1B': 'GST credits on your purchases. Normally (G10 + G11) ÷ 11.',
      W1: 'Gross salary and wages paid including allowances, bonuses, directors fees.',
      W2: 'Tax withheld from W1 payments. From your payroll system.',
      '9': 'Your net amount for this BAS period. Positive means you owe the ATO. Negative means a refund.',
    };
    return help[fieldId] ?? null;
  },

  getSupportedExportFormats(): ExportFormat[] {
    return [
      { id: 'pdf', label: 'PDF Summary', mimeType: 'application/pdf', fileExtension: 'pdf' },
      { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
      { id: 'json', label: 'JSON (data)', mimeType: 'application/json', fileExtension: 'json' },
    ];
  },

  async generateExport(values: FieldValues, format: string): Promise<ExportOutput> {
    // ai2fin.com — MVP: JSON export with all values
    // TODO: PDF generation via server-side endpoint, SBR XML for ATO portal
    const content = JSON.stringify(values, null, 2);
    return {
      data: content,
      filename: `BAS-AU-${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/json',
    };
  },

  getPortalSubmissionInfo() {
    return {
      portalUrl: 'https://my.gov.au',
      submissionMethod: 'manual_upload' as const,
      apiReady: false,
    };
  },

  hasSubJurisdictions() {
    return false;
  },

  supportsCustomFields() {
    return false;
  },
};

export default australiaPlugin;
