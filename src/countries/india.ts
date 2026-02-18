/**
 * India GSTR-3B Plugin (Monthly Summary Return) - ai2fin.com
 * GST Network (GSTN) - India's Goods and Services Tax
 * Reference: https://www.gst.gov.in/help/helpmodule/return
 * ARCHITECTURE: India GST has 3 components: IGST (inter-state), CGST + SGST (intra-state).
 *   Standard rate: 18% (9% CGST + 9% SGST, or 18% IGST for inter-state).
 *   Financial year: 1 April to 31 March. Monthly filing mandatory above turnover threshold.
 *   28 states + 8 UTs as sub-jurisdictions.
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
  SubJurisdiction,
} from '../types';

// All 28 states + 8 Union Territories with state codes
const INDIAN_STATES: SubJurisdiction[] = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman & Diu' },
  { code: '26', name: 'Dadra & Nagar Haveli' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
];

const inPlugin: TaxFilingPlugin = {
  countryCode: 'IN',
  displayName: 'GSTR-3B (Monthly Summary Return)',
  shortName: 'GSTR-3B',
  authority: {
    name: 'GSTN',
    fullName: 'Goods and Services Tax Network',
    portalUrl: 'https://www.gst.gov.in',
    helpUrl: 'https://www.gst.gov.in/help/helpmodule/return',
  },
  taxFamily: 'GST',
  isFullPlugin: true,

  getFormSchema() {
    return [
      {
        id: 'outward',
        title: '3.1 — Outward Supplies and Inward Supplies (Reverse Charge)',
        description: 'Details of taxable supplies and tax collected.',
        fields: [
          {
            id: 'outward_taxable',
            label: 'Outward taxable supplies (other than zero rated, nil rated and exempted)',
            officialLabel: '3.1(a)',
            type: 'currency',
            editable: true,
            required: true,
            helpText: 'Total value of taxable outward supplies (net of debit/credit notes)',
          },
          {
            id: 'outward_zero_rated',
            label: 'Outward supplies — zero rated',
            officialLabel: '3.1(b)',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Exports, supplies to SEZ',
          },
          {
            id: 'outward_nil_exempt',
            label: 'Other outward supplies — nil rated, exempted',
            officialLabel: '3.1(c)',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: 'inward_reverse_charge',
            label: 'Inward supplies — reverse charge',
            officialLabel: '3.1(d)',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Purchases from unregistered dealers where you pay GST via reverse charge',
          },
          {
            id: 'non_gst_supplies',
            label: 'Non-GST outward supplies',
            officialLabel: '3.1(e)',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Alcohol for human consumption, petroleum (5 items)',
          },
        ],
      },
      {
        id: 'tax_payable',
        title: '3.1 — Tax Details',
        description: 'Split your tax liability across IGST, CGST, SGST, and Cess.',
        fields: [
          {
            id: 'igst',
            label: 'Integrated GST (IGST)',
            officialLabel: 'IGST',
            type: 'currency',
            editable: true,
            required: true,
            helpText: 'IGST on inter-state supplies and imports',
          },
          {
            id: 'cgst',
            label: 'Central GST (CGST)',
            officialLabel: 'CGST',
            type: 'currency',
            editable: true,
            required: true,
            helpText: 'CGST on intra-state supplies (usually = SGST)',
          },
          {
            id: 'sgst',
            label: 'State GST (SGST/UTGST)',
            officialLabel: 'SGST',
            type: 'currency',
            editable: true,
            required: true,
            helpText: 'SGST on intra-state supplies (usually = CGST)',
          },
          {
            id: 'cess',
            label: 'Cess',
            officialLabel: 'Cess',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Compensation cess (luxury goods, tobacco, motor vehicles)',
          },
        ],
      },
      {
        id: 'itc',
        title: '4 — Eligible Input Tax Credit (ITC)',
        description: 'ITC available for set-off against output tax.',
        fields: [
          {
            id: 'itc_igst',
            label: 'ITC — IGST',
            officialLabel: 'ITC IGST',
            type: 'currency',
            editable: true,
            required: true,
            autoPopulateFrom: 'itc_igst',
          },
          {
            id: 'itc_cgst',
            label: 'ITC — CGST',
            officialLabel: 'ITC CGST',
            type: 'currency',
            editable: true,
            required: true,
            autoPopulateFrom: 'itc_cgst',
          },
          {
            id: 'itc_sgst',
            label: 'ITC — SGST/UTGST',
            officialLabel: 'ITC SGST',
            type: 'currency',
            editable: true,
            required: true,
            autoPopulateFrom: 'itc_sgst',
          },
          {
            id: 'itc_cess',
            label: 'ITC — Cess',
            officialLabel: 'ITC Cess',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: 'itc_reversed',
            label: 'ITC reversed (ineligible / rule 42-43)',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'ITC to be reversed: personal use, exempt supplies, blocked credits',
          },
          {
            id: 'net_itc',
            label: 'Net ITC available',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
            helpText: 'Total ITC minus reversed ITC',
          },
        ],
      },
      {
        id: 'interest_late',
        title: '5 — Interest and Late Fee',
        collapsed: true,
        fields: [
          {
            id: 'interest',
            label: 'Interest payable',
            type: 'currency',
            editable: true,
            required: false,
            helpText: '18% p.a. on late payment of tax',
          },
          {
            id: 'late_fee',
            label: 'Late fee',
            type: 'currency',
            editable: true,
            required: false,
            helpText: 'Rs 50/day (Rs 25 CGST + Rs 25 SGST) for late filing',
          },
        ],
      },
      {
        id: 'summary',
        title: 'Tax Payable Summary',
        fields: [
          {
            id: 'net_tax',
            label: 'Net tax payable (after ITC set-off)',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
            helpText:
              'Total tax liability minus net ITC. Positive = pay. Negative = carry forward.',
          },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({
    monthly: true,
    quarterly: true, // QRMP scheme for small taxpayers
    annual: false,
    defaultFrequency: 'monthly',
  }),

  getFinancialYearBounds: (y) => ({
    // India: 1 April to 31 March
    start: new Date(y, 3, 1),
    end: new Date(y + 1, 2, 31),
  }),

  getTerminology: () => ({
    taxName: 'GST',
    taxAbbrev: 'GST',
    salesLabel: 'Outward supplies',
    purchasesLabel: 'Inward supplies',
    outputTaxLabel: 'Output GST',
    inputTaxLabel: 'Input Tax Credit (ITC)',
  }),

  calculateFields(v: FieldValues) {
    const igst = Number(v.igst) || 0;
    const cgst = Number(v.cgst) || 0;
    const sgst = Number(v.sgst) || 0;
    const cess = Number(v.cess) || 0;
    const totalTax = igst + cgst + sgst + cess;

    const itc_igst = Number(v.itc_igst) || 0;
    const itc_cgst = Number(v.itc_cgst) || 0;
    const itc_sgst = Number(v.itc_sgst) || 0;
    const itc_cess = Number(v.itc_cess) || 0;
    const itc_reversed = Number(v.itc_reversed) || 0;
    const net_itc =
      Math.round((itc_igst + itc_cgst + itc_sgst + itc_cess - itc_reversed) * 100) / 100;

    const interest = Number(v.interest) || 0;
    const late_fee = Number(v.late_fee) || 0;

    const net_tax = Math.round((totalTax - net_itc + interest + late_fee) * 100) / 100;

    return { net_itc, net_tax };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'outward_taxable', aggregateKey: 'income_taxable' },
    { fieldId: 'itc_igst', aggregateKey: 'itc_igst' },
    { fieldId: 'itc_cgst', aggregateKey: 'itc_cgst' },
    { fieldId: 'itc_sgst', aggregateKey: 'itc_sgst' },
  ],

  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

  validateForm(v: FieldValues): ValidationResult[] {
    const results: ValidationResult[] = [];
    const cgst = Number(v.cgst) || 0;
    const sgst = Number(v.sgst) || 0;
    if (cgst > 0 && sgst === 0) {
      results.push({
        fieldId: 'sgst',
        message:
          'CGST is set but SGST is zero — for intra-state supplies, CGST and SGST should be equal',
        severity: 'warning',
      });
    }
    if (sgst > 0 && cgst === 0) {
      results.push({
        fieldId: 'cgst',
        message:
          'SGST is set but CGST is zero — for intra-state supplies, CGST and SGST should be equal',
        severity: 'warning',
      });
    }
    if (cgst > 0 && sgst > 0 && Math.abs(cgst - sgst) > 1) {
      results.push({
        fieldId: 'cgst',
        message: 'CGST and SGST should be equal for intra-state supplies',
        severity: 'warning',
      });
    }
    return results;
  },

  getFieldHelp: (fieldId) => {
    const help: Record<string, string> = {
      igst: 'IGST applies to inter-state supplies and imports. Rate = CGST + SGST combined.',
      cgst: 'Central GST on intra-state supplies. Usually equal to SGST.',
      sgst: 'State GST on intra-state supplies. Usually equal to CGST.',
      net_itc: 'Total ITC available after reversals. Set off against output tax liability.',
      net_tax: 'Net liability after ITC set-off. Pay via electronic cash ledger on GST portal.',
    };
    return help[fieldId] ?? null;
  },

  getSupportedExportFormats: (): ExportFormat[] => [
    {
      id: 'json',
      label: 'JSON (GSTN format)',
      mimeType: 'application/json',
      fileExtension: 'json',
    },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],

  async generateExport(v) {
    return {
      data: JSON.stringify(v, null, 2),
      filename: `GSTR3B-IN-${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/json',
    };
  },

  getPortalSubmissionInfo: () => ({
    portalUrl: 'https://gst.gov.in',
    submissionMethod: 'manual_upload' as const,
    apiReady: false,
  }),

  hasSubJurisdictions: () => true,
  getSubJurisdictions: () => INDIAN_STATES,
  supportsCustomFields: () => false,
};

export default inPlugin;
