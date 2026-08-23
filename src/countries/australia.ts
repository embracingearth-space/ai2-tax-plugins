/**
 * Australia Business Activity Statement (BAS) Plugin - ai2fin.com
 * Full scope: GST calculation worksheet (G1-G20, 1A, 1B) + PAYG Withholding (W1-W5)
 *   + PAYG Instalments (T1-T9) + FBT (F1-F4) + Summary (4, 5A, 6A, 8A, 8B, 9)
 * Authority: Australian Taxation Office (ATO)
 * Reference: https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/business-activity-statements-bas
 * Worksheet: "Completing your BAS for GST" — step 2 (sales) and step 4 (purchases):
 *   G5 = G2+G3+G4; G6 = G1−G5; G8 = G6+G7; G9 = G8÷11 → 1A
 *   G12 = G10+G11; G16 = G13+G14+G15; G17 = G12−G16; G19 = G17+G18; G20 = G19÷11 → 1B
 * Summary: 4 = W5; 8A = 1A+1C+1E+4+5A+6A+7; 8B = 1B+1D+1F+1G+5B+6B+7D; 9 = 8A−8B
 * ARCHITECTURE: ATO rounds all dollar amounts DOWN to whole dollars (no cents).
 *   Financial year: 1 Jul - 30 Jun. Default quarterly filing.
 *   1A/1B use the ACCOUNTS METHOD (GST recorded per transaction) when supplied,
 *   and fall back to the worksheet figures G9/G20 otherwise. Both are returned
 *   (1A_worksheet / 1B_worksheet) so the UI can cross-check the two methods.
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

const AU_GST_RATE = 0.1;

const ATO_WORKSHEET_BASE =
  'https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/in-detail/managing-gst-in-your-business/reporting-paying-and-activity-statements/completing-your-bas-for-gst/complete-your-bas';
const ATO_WORKSHEET_SALES = `${ATO_WORKSHEET_BASE}/step-2-calculating-sales-using-the-calculation-worksheet`;
const ATO_WORKSHEET_PURCHASES = `${ATO_WORKSHEET_BASE}/step-4-calculating-purchases-using-the-calculation-worksheet`;
// BAS landing page (liveness-checked by scripts/authority-urls) — used for the
// PAYG withholding labels until a verified label-specific page is added.
const ATO_BAS_HELP =
  'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/business-activity-statements-bas';

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

function num(v: unknown): number {
  return Number(v) || 0;
}

/**
 * GST calculation worksheet figures (whole dollars). Shared by calculateFields
 * and validateForm so the accounts-method cross-check uses the same arithmetic.
 */
function worksheet(inputs: FieldValues) {
  const G1 = num(inputs.G1);
  const G2 = num(inputs.G2);
  const G3 = num(inputs.G3);
  const G4 = num(inputs.G4);
  const G7 = num(inputs.G7);
  const G10 = num(inputs.G10);
  const G11 = num(inputs.G11);
  const G13 = num(inputs.G13);
  const G14 = num(inputs.G14);
  const G15 = num(inputs.G15);
  const G18 = num(inputs.G18);

  // Step 2 — sales
  const G5 = roundATO(G2 + G3 + G4);
  const G6 = roundATO(G1 - G5);
  const G8 = roundATO(G6 + G7);
  const G9 = roundATO(G8 / 11);
  // Step 4 — purchases
  const G12 = roundATO(G10 + G11);
  const G16 = roundATO(G13 + G14 + G15);
  const G17 = roundATO(G12 - G16);
  const G19 = roundATO(G17 + G18);
  const G20 = roundATO(G19 / 11);

  return { G5, G6, G8, G9, G12, G16, G17, G19, G20 };
}

/** Accounts-method vs worksheet tolerance: the larger of $1 and 2%. */
function exceedsCrossCheckTolerance(accounts: number, worksheetFigure: number): boolean {
  const tolerance = Math.max(1, 0.02 * Math.max(Math.abs(accounts), Math.abs(worksheetFigure)));
  return Math.abs(accounts - worksheetFigure) > tolerance;
}

const australiaPlugin: TaxFilingPlugin = {
  countryCode: 'AU',
  displayName: 'Business Activity Statement (BAS)',
  shortName: 'BAS',
  authority: {
    name: 'ATO',
    fullName: 'Australian Taxation Office',
    portalUrl: 'https://www.ato.gov.au',
    helpUrl: ATO_BAS_HELP,
  },
  taxFamily: 'GST',
  isFullPlugin: true,

  getFormSchema() {
    const sections: FormSection[] = [
      {
        id: 'gst_sales',
        title: 'GST — Sales (calculation worksheet)',
        description:
          'ATO calculation worksheet, step 2. Amounts include GST unless stated. G5–G9 are worked out for you.',
        fields: [
          {
            id: 'G1',
            label: 'Total sales (including any GST)',
            officialLabel: 'G1',
            type: 'currency',
            editable: true,
            required: true,
            autoPopulateFrom: 'income_total',
            helpText: 'Total gross sales including GST, GST-free, export and input-taxed sales',
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
            helpText:
              'GST-free supplies other than exports (basic food, most health and education). Input-taxed sales go at G4, not here.',
          },
          {
            id: 'G4',
            label: 'Input-taxed sales',
            officialLabel: 'G4',
            type: 'currency',
            editable: true,
            required: false,
            autoPopulateFrom: 'income_input_taxed',
            helpText:
              'Input-taxed supplies: financial supplies (including interest received) and residential rent. No GST is collected and no credits are claimable on related purchases.',
          },
          {
            id: 'G5',
            label: 'Total GST-free and input-taxed sales',
            officialLabel: 'G5',
            type: 'currency',
            calculated: true,
            dependsOn: ['G2', 'G3', 'G4'],
            editable: false,
            required: false,
            helpText: 'G2 + G3 + G4',
          },
          {
            id: 'G6',
            label: 'Total sales subject to GST',
            officialLabel: 'G6',
            type: 'currency',
            calculated: true,
            dependsOn: ['G1', 'G5'],
            editable: false,
            required: false,
            helpText: 'G1 − G5',
          },
          {
            id: 'G7',
            label: 'Adjustments (sales)',
            officialLabel: 'G7',
            type: 'currency',
            editable: true,
            required: false,
            helpText:
              'Increasing or decreasing adjustments to sales (e.g. bad debts recovered, cancelled sales). Enter the GST-inclusive amount; decreasing adjustments as a negative.',
          },
          {
            id: 'G8',
            label: 'Total sales subject to GST after adjustments',
            officialLabel: 'G8',
            type: 'currency',
            calculated: true,
            dependsOn: ['G6', 'G7'],
            editable: false,
            required: false,
            helpText: 'G6 + G7',
          },
          {
            id: 'G9',
            label: 'GST on sales (worksheet)',
            officialLabel: 'G9',
            type: 'currency',
            calculated: true,
            dependsOn: ['G8'],
            editable: false,
            required: false,
            helpText: 'G8 ÷ 11. This is the worksheet figure for 1A.',
          },
        ],
      },
      {
        id: 'gst_purchases',
        title: 'GST — Purchases (calculation worksheet)',
        description:
          'ATO calculation worksheet, step 4. Amounts include GST. G12, G16, G17, G19 and G20 are worked out for you.',
        fields: [
          {
            id: 'G10',
            label: 'Capital purchases (including GST)',
            officialLabel: 'G10',
            type: 'currency',
            editable: true,
            required: false,
            autoPopulateFrom: 'expenses_capital',
            helpText:
              'All capital items (assets) purchased, including GST — whether or not GST was in the price.',
          },
          {
            id: 'G11',
            label: 'Non-capital purchases (including GST)',
            officialLabel: 'G11',
            type: 'currency',
            editable: true,
            required: false,
            autoPopulateFrom: 'expenses_non_capital',
            helpText:
              'All other purchases for your business, including GST — whether or not GST was in the price.',
          },
          {
            id: 'G12',
            label: 'Total purchases',
            officialLabel: 'G12',
            type: 'currency',
            calculated: true,
            dependsOn: ['G10', 'G11'],
            editable: false,
            required: false,
            helpText: 'G10 + G11',
          },
          {
            id: 'G13',
            label: 'Purchases for making input-taxed sales',
            officialLabel: 'G13',
            type: 'currency',
            editable: true,
            required: false,
            autoPopulateFrom: 'expenses_input_taxed_related',
            helpText:
              'Purchases (already included in G10/G11) that relate to making input-taxed sales such as residential rent or financial supplies. No credit is claimable.',
          },
          {
            id: 'G14',
            label: 'Purchases without GST in the price',
            officialLabel: 'G14',
            type: 'currency',
            editable: true,
            required: false,
            autoPopulateFrom: 'expenses_no_tax',
            helpText:
              'Purchases (already included in G10/G11) with no GST in the price: GST-free goods and services, purchases from unregistered suppliers, overseas purchases not subject to reverse charge, government fees and charges, bank fees.',
          },
          {
            id: 'G15',
            label: 'Estimated purchases for private use or not income tax deductible',
            officialLabel: 'G15',
            type: 'currency',
            editable: true,
            required: false,
            autoPopulateFrom: 'expenses_private',
            helpText:
              'The private-use portion of purchases and purchases that are not deductible for income tax (entertainment, fines, penalties), already included in G10/G11.',
          },
          {
            id: 'G16',
            label: 'Total non-creditable purchases',
            officialLabel: 'G16',
            type: 'currency',
            calculated: true,
            dependsOn: ['G13', 'G14', 'G15'],
            editable: false,
            required: false,
            helpText: 'G13 + G14 + G15',
          },
          {
            id: 'G17',
            label: 'Total purchases subject to GST',
            officialLabel: 'G17',
            type: 'currency',
            calculated: true,
            dependsOn: ['G12', 'G16'],
            editable: false,
            required: false,
            helpText: 'G12 − G16',
          },
          {
            id: 'G18',
            label: 'Adjustments (purchases)',
            officialLabel: 'G18',
            type: 'currency',
            editable: true,
            required: false,
            helpText:
              'Increasing or decreasing adjustments to purchases (e.g. change in creditable use, bad debts written off). Enter the GST-inclusive amount; decreasing adjustments as a negative.',
          },
          {
            id: 'G19',
            label: 'Total purchases subject to GST after adjustments',
            officialLabel: 'G19',
            type: 'currency',
            calculated: true,
            dependsOn: ['G17', 'G18'],
            editable: false,
            required: false,
            helpText: 'G17 + G18',
          },
          {
            id: 'G20',
            label: 'GST on purchases (worksheet)',
            officialLabel: 'G20',
            type: 'currency',
            calculated: true,
            dependsOn: ['G19'],
            editable: false,
            required: false,
            helpText: 'G19 ÷ 11. This is the worksheet figure for 1B.',
          },
        ],
      },
      {
        id: 'gst_amounts',
        title: 'GST — Amounts for the BAS (1A, 1B)',
        description:
          'Accounts method: GST recorded on each transaction. If left blank, the worksheet figures G9 and G20 are used. Both are shown so you can cross-check.',
        fields: [
          {
            id: '1A',
            label: 'GST on sales',
            officialLabel: '1A',
            type: 'currency',
            calculated: true,
            dependsOn: ['G9'],
            editable: true,
            required: true,
            autoPopulateFrom: 'output_tax',
            helpText:
              'GST collected on taxable sales. Auto-filled from the GST recorded on your sales (accounts method); if blank, the worksheet figure G9 = G8 ÷ 11 is used.',
          },
          {
            id: '1A_worksheet',
            label: 'GST on sales — worksheet cross-check (G9)',
            type: 'currency',
            calculated: true,
            dependsOn: ['G9'],
            editable: false,
            required: false,
            helpText:
              'G9 from the calculation worksheet. Should be close to 1A; a large difference usually means sales are classified inconsistently between G1–G4 and the GST recorded per transaction.',
          },
          {
            id: '1B',
            label: 'GST on purchases',
            officialLabel: '1B',
            type: 'currency',
            calculated: true,
            dependsOn: ['G20'],
            editable: true,
            required: true,
            autoPopulateFrom: 'input_tax',
            helpText:
              'GST credits on business purchases. Auto-filled from the GST recorded on your purchases (accounts method); if blank, the worksheet figure G20 = G19 ÷ 11 is used.',
          },
          {
            id: '1B_worksheet',
            label: 'GST on purchases — worksheet cross-check (G20)',
            type: 'currency',
            calculated: true,
            dependsOn: ['G20'],
            editable: false,
            required: false,
            helpText:
              'G20 from the calculation worksheet. Should be close to 1B; a large difference usually means G13–G15 do not match the GST recorded per purchase.',
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
            dependsOn: ['W2', 'W3', 'W4'],
            editable: false,
            required: false,
            helpText: 'W2 + W3 + W4. Carried to label 4 in the summary.',
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
            dependsOn: ['T1', 'T2'],
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
        id: 'other_amounts',
        title: 'Other amounts (only if shown on your activity statement)',
        description:
          'Wine equalisation tax, luxury car tax, instalment-variation credits, deferred instalments and fuel tax credits. Leave blank if they do not apply to you.',
        collapsed: true,
        fields: [
          {
            id: '1C',
            label: 'Wine equalisation tax',
            officialLabel: '1C',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: '1D',
            label: 'Wine equalisation tax refundable',
            officialLabel: '1D',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: '1E',
            label: 'Luxury car tax',
            officialLabel: '1E',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: '1F',
            label: 'Luxury car tax refundable',
            officialLabel: '1F',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: '5B',
            label: 'Credit from PAYG income tax instalment variation',
            officialLabel: '5B',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Credit arising when you vary your PAYG instalment down',
          },
          {
            id: '6B',
            label: 'Credit from FBT instalment variation',
            officialLabel: '6B',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Credit arising when you vary your FBT instalment down',
          },
          {
            id: '7',
            label: 'Deferred company/fund instalment',
            officialLabel: '7',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: '7D',
            label: 'Fuel tax credit',
            officialLabel: '7D',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Only if you are registered for fuel tax credits',
          },
        ],
      },
      {
        id: 'summary',
        title: 'Summary',
        description: 'Amounts you owe the ATO, amounts the ATO owes you, and the net result.',
        fields: [
          {
            id: '4',
            label: 'PAYG tax withheld',
            officialLabel: '4',
            type: 'currency',
            calculated: true,
            dependsOn: ['W5'],
            editable: false,
            required: false,
            helpText: 'Equal to W5',
          },
          {
            id: '5A',
            label: 'PAYG income tax instalment',
            officialLabel: '5A',
            type: 'currency',
            calculated: true,
            dependsOn: ['T3', 'T7', 'T8'],
            editable: false,
            required: false,
            helpText: 'T8 if you varied, otherwise T7 (amount method) or T3 = T1 × T2 (rate method)',
          },
          {
            id: '6A',
            label: 'FBT instalment',
            officialLabel: '6A',
            type: 'currency',
            calculated: true,
            dependsOn: ['F1', 'F3'],
            editable: false,
            required: false,
            helpText: 'F3 if you varied, otherwise F1',
          },
          {
            id: '8A',
            label: 'Total amounts you owe the ATO',
            officialLabel: '8A',
            type: 'currency',
            calculated: true,
            dependsOn: ['1A', '1C', '1E', '4', '5A', '6A', '7'],
            editable: false,
            required: true,
            helpText: '1A + 1C + 1E + 4 + 5A + 6A + 7',
          },
          {
            id: '8B',
            label: 'Total amounts the ATO owes you',
            officialLabel: '8B',
            type: 'currency',
            calculated: true,
            dependsOn: ['1B', '1D', '1F', '5B', '6B', '7D'],
            editable: false,
            required: true,
            helpText: '1B + 1D + 1F + 5B + 6B + 7D',
          },
          {
            id: '9',
            label: 'Your payment or refund amount',
            officialLabel: '9',
            type: 'currency',
            calculated: true,
            dependsOn: ['8A', '8B'],
            editable: false,
            required: true,
            helpText: '8A − 8B. Positive = you owe the ATO. Negative = refund.',
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
    const ws = worksheet(inputs);

    // 1A / 1B: accounts method when the user or auto-fill supplied a figure
    // (override-aware — the client merges calculatedFields OVER user values on
    // save, so returning the pre-override figure would discard it), otherwise
    // the calculation-worksheet figures G9 / G20.
    const oneA = hasUserValue(inputs['1A']) ? roundATO(num(inputs['1A'])) : ws.G9;
    const oneB = hasUserValue(inputs['1B']) ? roundATO(num(inputs['1B'])) : ws.G20;

    // PAYG Withholding → label 4
    const W5 = roundATO(num(inputs.W2) + num(inputs.W3) + num(inputs.W4));
    const four = W5;

    // PAYG Instalments → 5A: T8 (variation) > T7 (amount method) > T3 (rate method)
    // ATO allows $0 variations — check if the field was provided, not just > 0
    const T3 = roundATO(num(inputs.T1) * num(inputs.T2));
    const fiveA = hasUserValue(inputs.T8)
      ? roundATO(num(inputs.T8))
      : hasUserValue(inputs.T7)
        ? roundATO(num(inputs.T7))
        : T3;

    // FBT → 6A: F3 (varied) if present, else F1 (standard instalment)
    const sixA = hasUserValue(inputs.F3) ? roundATO(num(inputs.F3)) : roundATO(num(inputs.F1));

    // Other labels (optional; 0 when not applicable).
    const oneC = roundATO(num(inputs['1C']));
    const oneD = roundATO(num(inputs['1D']));
    const oneE = roundATO(num(inputs['1E']));
    const oneF = roundATO(num(inputs['1F']));
    // 1G (credit for wholesale sales tax) is a superseded label that no longer
    // appears on the form; it is honoured if supplied, but not offered as a field.
    const oneG = roundATO(num(inputs['1G']));
    const fiveB = roundATO(num(inputs['5B']));
    const sixB = roundATO(num(inputs['6B']));
    const seven = roundATO(num(inputs['7']));
    const sevenD = roundATO(num(inputs['7D']));

    // Summary — ATO BAS: amounts you owe / amounts the ATO owes you / net.
    const eightA = roundATO(oneA + oneC + oneE + four + fiveA + sixA + seven);
    const eightB = roundATO(oneB + oneD + oneF + oneG + fiveB + sixB + sevenD);
    const nine = roundATO(eightA - eightB);

    return {
      ...ws,
      '1A': oneA,
      '1A_worksheet': ws.G9,
      '1B': oneB,
      '1B_worksheet': ws.G20,
      W5,
      T3,
      '4': four,
      '5A': fiveA,
      '6A': sixA,
      '8A': eightA,
      '8B': eightB,
      '9': nine,
    };
  },

  getAutoPopulateMapping(): AggregationMapping[] {
    return [
      { fieldId: 'G1', aggregateKey: 'income_total' },
      { fieldId: 'G2', aggregateKey: 'income_export' },
      { fieldId: 'G3', aggregateKey: 'income_gst_free' },
      { fieldId: 'G4', aggregateKey: 'income_input_taxed' },
      { fieldId: 'G10', aggregateKey: 'expenses_capital' },
      { fieldId: 'G11', aggregateKey: 'expenses_non_capital' },
      { fieldId: 'G13', aggregateKey: 'expenses_input_taxed_related' },
      { fieldId: 'G14', aggregateKey: 'expenses_no_tax' },
      { fieldId: 'G15', aggregateKey: 'expenses_private' },
      { fieldId: '1A', aggregateKey: 'output_tax' },
      { fieldId: '1B', aggregateKey: 'input_tax' },
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
    const G1 = num(values.G1);
    const G2 = num(values.G2);
    const G3 = num(values.G3);
    const G4 = num(values.G4);
    if (G2 + G3 + G4 > G1 && G1 > 0) {
      results.push({
        fieldId: 'G2',
        message:
          'Export (G2) + GST-free (G3) + input-taxed (G4) sales exceed total sales (G1). G1 must include them.',
        severity: 'warning',
      });
    }
    const G10 = num(values.G10);
    const G11 = num(values.G11);
    const G13 = num(values.G13);
    const G14 = num(values.G14);
    const G15 = num(values.G15);
    if (G13 + G14 + G15 > G10 + G11) {
      results.push({
        fieldId: 'G13',
        message:
          'G13 + G14 + G15 exceed total purchases (G10 + G11). These are subsets of G10/G11 and cannot be larger.',
        severity: 'error',
      });
    }

    // Accounts method vs calculation worksheet cross-check.
    const ws = worksheet(values);
    if (hasUserValue(values['1A'])) {
      const oneA = roundATO(num(values['1A']));
      if (exceedsCrossCheckTolerance(oneA, ws.G9)) {
        results.push({
          fieldId: '1A',
          message: `1A (${oneA}) differs from the calculation worksheet figure G9 (${ws.G9}). Check that G1–G4 match the GST recorded on your sales.`,
          severity: 'warning',
        });
      }
    }
    if (hasUserValue(values['1B'])) {
      const oneB = roundATO(num(values['1B']));
      if (exceedsCrossCheckTolerance(oneB, ws.G20)) {
        results.push({
          fieldId: '1B',
          message: `1B (${oneB}) differs from the calculation worksheet figure G20 (${ws.G20}). Check that G10–G15 match the GST recorded on your purchases.`,
          severity: 'warning',
        });
      }
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
      G1: 'Include all gross sales including GST, GST-free, export and input-taxed sales. From your income accounts.',
      G2: 'Export sales are GST-free. Include goods and services exported overseas.',
      G3: 'Other GST-free supplies — basic food, most health and education, and similar. Input-taxed sales (interest, residential rent) belong at G4.',
      G4: 'Input-taxed sales — financial supplies including interest received, and residential rent. No GST and no credits on related purchases.',
      G7: 'Adjustments to sales for the period (GST-inclusive). Decreasing adjustments are entered as a negative.',
      G10: 'Capital items (assets) you purchased for business use, including GST — whether or not GST was charged.',
      G11: 'All other business purchases (supplies, services, rent), including GST — whether or not GST was charged.',
      G13: 'The part of G10/G11 that relates to making input-taxed sales (residential rent, financial supplies). Bank fees on an ordinary business account are G14, not G13.',
      G14: 'The part of G10/G11 with no GST in the price: GST-free purchases, unregistered suppliers, overseas purchases, government fees and charges, bank fees.',
      G15: 'The private-use portion of purchases and non-income-tax-deductible purchases (entertainment, fines), already included in G10/G11.',
      G18: 'Adjustments to purchases for the period (GST-inclusive). Decreasing adjustments are entered as a negative.',
      '1A': 'GST on sales. Accounts method: the GST recorded on your sales. If blank, the worksheet figure G9 = G8 ÷ 11 is used. Compare with 1A_worksheet.',
      '1B': 'GST on purchases. Accounts method: the GST recorded on your purchases. If blank, the worksheet figure G20 = G19 ÷ 11 is used. Compare with 1B_worksheet.',
      W1: 'Gross salary and wages paid including allowances, bonuses, directors fees.',
      W2: 'Tax withheld from W1 payments. From your payroll system.',
      '5A': 'Your PAYG income tax instalment for the period: T8 if varied, otherwise T7 (amount method) or T1 × T2 (rate method).',
      '6A': 'Your FBT instalment for the period: F3 if varied, otherwise F1.',
      '8A': 'Total amounts you owe the ATO: 1A + 1C + 1E + 4 + 5A + 6A + 7.',
      '8B': 'Total amounts the ATO owes you: 1B + 1D + 1F + 5B + 6B + 7D.',
      '9': 'Your net amount for this BAS period (8A − 8B). Positive means you owe the ATO. Negative means a refund.',
    };
    return help[fieldId] ?? null;
  },

  getSupportedExportFormats(): ExportFormat[] {
    // 'pdf' removed 2026-08: generateExport never generated one — it returned
    // JSON regardless of what was clicked, so "PDF Summary" downloaded a
    // .json file with a .json MIME type. Re-add it once server-side PDF
    // generation actually exists (see the TODO on generateExport below).
    return [
      { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
      { id: 'json', label: 'JSON (data)', mimeType: 'application/json', fileExtension: 'json' },
    ];
  },

  async generateExport(values: FieldValues, format: string): Promise<ExportOutput> {
    // ai2fin.com — MVP: JSON + CSV. TODO: PDF generation via a server-side
    // endpoint, SBR XML for the ATO portal — see getSupportedExportFormats,
    // which no longer advertises 'pdf' until that lands.
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'csv') return toCsv(values, `BAS-AU-${stamp}`);
    return {
      data: JSON.stringify(values, null, 2),
      filename: `BAS-AU-${stamp}.json`,
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

  /**
   * AU treatment catalogue in the ATO / Xero vocabulary. `boxes` are the BAS
   * labels each treatment feeds on the calculation worksheet.
   */
  getTaxTreatments(): TaxTreatmentDefinition[] {
    return [
      {
        code: 'SALE_STANDARD',
        label: 'GST on Income',
        side: 'sale',
        rate: AU_GST_RATE,
        taxApplies: true,
        creditable: true,
        boxes: ['G1', '1A'],
        help: 'Taxable sales with 10% GST in the price. Reported at G1; the GST component is 1A.',
        authorityRef: ATO_WORKSHEET_SALES,
        defaultFor: ['sales', 'services_income'],
      },
      {
        code: 'SALE_ZERO_RATED',
        label: 'Export Sales (GST-free)',
        side: 'sale',
        rate: 0,
        taxApplies: false,
        creditable: true,
        boxes: ['G1', 'G2'],
        help: 'GST-free exports of goods and services. Included in G1 and reported at G2.',
        authorityRef: ATO_WORKSHEET_SALES,
        defaultFor: ['export_sales'],
      },
      {
        code: 'SALE_EXEMPT',
        label: 'GST-Free Income',
        side: 'sale',
        rate: 0,
        taxApplies: false,
        creditable: true,
        boxes: ['G1', 'G3'],
        help: 'Other GST-free sales (basic food, most health and education). Included in G1 and reported at G3.',
        authorityRef: ATO_WORKSHEET_SALES,
      },
      {
        code: 'SALE_INPUT_TAXED',
        label: 'Input Taxed Income',
        side: 'sale',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: ['G1', 'G4'],
        help: 'Input-taxed sales: financial supplies including interest received, residential rent. Included in G1 and reported at G4; no credits on related purchases.',
        authorityRef: ATO_WORKSHEET_SALES,
        defaultFor: ['interest_income', 'residential_rent'],
      },
      {
        code: 'PURCHASE_STANDARD',
        label: 'GST on Expenses',
        side: 'purchase',
        rate: AU_GST_RATE,
        taxApplies: true,
        creditable: true,
        boxes: ['G11', '1B'],
        help: 'Non-capital purchases with 10% GST in the price. Reported at G11; the GST credit is 1B.',
        authorityRef: ATO_WORKSHEET_PURCHASES,
      },
      {
        code: 'PURCHASE_CAPITAL',
        label: 'GST on Capital',
        side: 'purchase',
        rate: AU_GST_RATE,
        taxApplies: true,
        creditable: true,
        boxes: ['G10', '1B'],
        help: 'Capital purchases (assets) with 10% GST in the price. Reported at G10; the GST credit is 1B.',
        authorityRef: ATO_WORKSHEET_PURCHASES,
        defaultFor: ['equipment', 'vehicles'],
      },
      {
        code: 'PURCHASE_NO_TAX',
        label: 'GST-Free Expenses',
        side: 'purchase',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: ['G11', 'G14'],
        help: 'Non-capital purchases with no GST in the price: GST-free goods and services, unregistered suppliers, overseas purchases, government fees and charges, bank fees. Included in G11 and reported at G14.',
        authorityRef: ATO_WORKSHEET_PURCHASES,
        defaultFor: ['bank_fees', 'government_fees', 'insurance_stamp_duty'],
      },
      {
        code: 'PURCHASE_CAPITAL_NO_TAX',
        label: 'GST-Free Capital',
        side: 'purchase',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: ['G10', 'G14'],
        help: 'Capital purchases with no GST in the price. Included in G10 and reported at G14.',
        authorityRef: ATO_WORKSHEET_PURCHASES,
      },
      {
        code: 'PURCHASE_INPUT_TAXED',
        label: 'Input Taxed Expenses',
        side: 'purchase',
        rate: AU_GST_RATE,
        taxApplies: true,
        creditable: false,
        boxes: ['G11', 'G13'],
        help: 'Purchases that relate to making input-taxed sales (residential rent, financial supplies); bank fees on a normal business account are instead G14. Included in G11 and reported at G13; no credit.',
        authorityRef: ATO_WORKSHEET_PURCHASES,
      },
      {
        code: 'PURCHASE_PRIVATE',
        label: 'Private / Non-deductible',
        side: 'purchase',
        rate: AU_GST_RATE,
        taxApplies: true,
        creditable: false,
        boxes: ['G11', 'G15'],
        help: 'Private-use portion of purchases and purchases not deductible for income tax (entertainment, fines, penalties). Included in G11 and reported at G15; no credit.',
        authorityRef: ATO_WORKSHEET_PURCHASES,
        defaultFor: ['entertainment', 'fines_penalties'],
      },
      {
        code: 'PURCHASE_REVERSE_CHARGE',
        label: 'Reverse charge — imported services',
        side: 'purchase',
        rate: AU_GST_RATE,
        taxApplies: true,
        creditable: true,
        boxes: ['1A', '1B'],
        help: 'Division 84 reverse charge on imported services: you account for the GST at 1A and, where creditable, claim it at 1B.',
        authorityRef: ATO_WORKSHEET_SALES,
      },
      {
        code: 'PURCHASE_IMPORT',
        label: 'GST on Imports',
        side: 'purchase',
        rate: AU_GST_RATE,
        taxApplies: true,
        creditable: true,
        boxes: ['G11', '1B'],
        help: 'Goods imported with GST paid to customs (or deferred). The purchase is reported at G11 (G10 if capital) and the GST paid is claimed at 1B.',
        authorityRef: ATO_WORKSHEET_PURCHASES,
      },
      {
        code: 'WAGES',
        label: 'Wages & salaries',
        side: 'payroll',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: ['W1'],
        help: 'Gross salary, wages and other payments subject to PAYG withholding. Reported at W1; never a GST purchase.',
        authorityRef: ATO_BAS_HELP,
        defaultFor: ['wages', 'salaries'],
      },
      {
        code: 'WITHHOLDING',
        label: 'PAYG withheld',
        side: 'payroll',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: ['W2'],
        help: 'Tax withheld from salary, wages and other payments. Reported at W2 and carried to W5 / label 4.',
        authorityRef: ATO_BAS_HELP,
        defaultFor: ['payg_withholding'],
      },
      {
        code: 'OUT_OF_SCOPE',
        label: 'BAS Excluded',
        side: 'excluded',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: [],
        help: 'Not a supply: transfers, loan principal, owner drawings and contributions, superannuation, dividends, tax payments, depreciation. Not reported on the BAS.',
        defaultFor: ['transfers', 'loan_principal', 'owner_drawings', 'superannuation', 'dividends', 'tax_payments'],
      },
    ];
  },
};

export default australiaPlugin;
