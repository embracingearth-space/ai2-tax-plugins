/**
 * Malaysia Sales & Services Tax Return (SST-02) - ai2fin.com
 * Royal Malaysian Customs Department (RMCD / JKDM)
 * Reference: https://mysst.customs.gov.my
 * ARCHITECTURE: SST replaced GST in Sep 2018. Two components:
 *   Sales Tax: 5% or 10% on manufactured/imported goods.
 *   Service Tax: 8% (was 6%, increased Mar 2024) on prescribed services.
 *   Bimonthly taxable periods. No input tax credit mechanism (unlike GST).
 */

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
  SubJurisdiction,
} from '../types';

const myPlugin: TaxFilingPlugin = {
  countryCode: 'MY',
  displayName: 'SST Return (SST-02)',
  shortName: 'SST-02',
  authority: {
    name: 'RMCD',
    fullName: 'Royal Malaysian Customs Department (Jabatan Kastam Diraja Malaysia)',
    portalUrl: 'https://mysst.customs.gov.my',
    helpUrl: 'https://mysst.customs.gov.my/SSTInfo',
  },
  taxFamily: 'SST',
  isFullPlugin: true,

  getFormSchema(): FormSection[] {
    return [
      {
        id: 'sales_tax',
        title: 'Sales Tax (Cukai Jualan)',
        description: 'Tax on manufacture/import of taxable goods.',
        fields: [
          { id: 'taxable_sales_10', label: 'Taxable sales at 10%', type: 'currency', editable: true, required: false, autoPopulateFrom: 'sales_goods_standard', helpText: 'Most manufactured goods' },
          { id: 'taxable_sales_5', label: 'Taxable sales at 5%', type: 'currency', editable: true, required: false, helpText: 'Selected food items, building materials, IT equipment' },
          { id: 'exempt_sales', label: 'Exempt sales', type: 'currency', editable: true, required: false, helpText: 'Essential food, live animals, agricultural produce, pharmaceutical' },
          { id: 'sales_tax_payable', label: 'Total sales tax payable', type: 'currency', calculated: true, editable: true, required: true },
        ],
      },
      {
        id: 'service_tax',
        title: 'Service Tax (Cukai Perkhidmatan)',
        description: 'Tax on prescribed taxable services at 8%.',
        fields: [
          { id: 'taxable_services', label: 'Taxable service revenue', type: 'currency', editable: true, required: false, autoPopulateFrom: 'income_services', helpText: 'IT, professional, accommodation, F&B, telecoms, etc.' },
          { id: 'exempt_services', label: 'Exempt services', type: 'currency', editable: true, required: false, helpText: 'Healthcare, education, financial (selected)' },
          { id: 'service_tax_payable', label: 'Service tax payable (8%)', type: 'currency', calculated: true, editable: true, required: true },
        ],
      },
      {
        id: 'summary',
        title: 'Total Tax Payable',
        fields: [
          { id: 'total_sst', label: 'Total SST payable', type: 'currency', calculated: true, editable: false, required: true, helpText: 'Sales tax + service tax. No input credit mechanism under SST.' },
          { id: 'penalty', label: 'Late payment penalty', type: 'currency', editable: true, required: false, helpText: '10% flat, 15% after 30 days, 25% after 60 days' },
          { id: 'total_due', label: 'Total amount due', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({ monthly: false, quarterly: false, annual: false, defaultFrequency: 'monthly' }),
  getFinancialYearBounds: (y) => ({ start: new Date(y, 0, 1), end: new Date(y, 11, 31) }),

  getTerminology: () => ({
    taxName: 'SST (Sales & Services Tax)', taxAbbrev: 'SST',
    salesLabel: 'Taxable turnover', purchasesLabel: 'N/A (no input credits)',
    outputTaxLabel: 'SST payable', inputTaxLabel: 'N/A',
  }),

  calculateFields(v: FieldValues): CalculatedFields {
    const s10 = Number(v.taxable_sales_10) || 0;
    const s5 = Number(v.taxable_sales_5) || 0;
    const services = Number(v.taxable_services) || 0;
    const penalty = Number(v.penalty) || 0;

    const sales_tax_calc = Math.round((s10 * 0.10 + s5 * 0.05) * 100) / 100;
    const sales_tax_payable = (v.sales_tax_payable !== '' && v.sales_tax_payable !== undefined && v.sales_tax_payable !== null)
      ? Math.round(Number(v.sales_tax_payable) * 100) / 100 : sales_tax_calc;

    const service_tax_calc = Math.round(services * 0.08 * 100) / 100;
    const service_tax_payable = (v.service_tax_payable !== '' && v.service_tax_payable !== undefined && v.service_tax_payable !== null)
      ? Math.round(Number(v.service_tax_payable) * 100) / 100 : service_tax_calc;

    const total_sst = Math.round((sales_tax_payable + service_tax_payable) * 100) / 100;
    const total_due = Math.round((total_sst + penalty) * 100) / 100;

    return { sales_tax_payable: sales_tax_calc, service_tax_payable: service_tax_calc, total_sst, total_due };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'taxable_sales_10', aggregateKey: 'sales_goods_standard' },
    { fieldId: 'taxable_services', aggregateKey: 'income_services' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    if (Number(v.taxable_sales_10) < 0) r.push({ fieldId: 'taxable_sales_10', message: 'Sales cannot be negative', severity: 'error' });
    if (Number(v.taxable_services) < 0) r.push({ fieldId: 'taxable_services', message: 'Service revenue cannot be negative', severity: 'error' });
    return r;
  },
  getFieldHelp: () => null,

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v) {
    return { data: JSON.stringify(v, null, 2), filename: `SST02-MY-${new Date().toISOString().slice(0, 10)}.json`, mimeType: 'application/json' };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://mysst.customs.gov.my', submissionMethod: 'manual_upload' as const, apiReady: false }),
  hasSubJurisdictions: () => true,
  getSubJurisdictions: (): SubJurisdiction[] => [
    { code: 'JHR', name: 'Johor' }, { code: 'KDH', name: 'Kedah' }, { code: 'KTN', name: 'Kelantan' },
    { code: 'MLK', name: 'Melaka' }, { code: 'NSN', name: 'Negeri Sembilan' }, { code: 'PHG', name: 'Pahang' },
    { code: 'PRK', name: 'Perak' }, { code: 'PLS', name: 'Perlis' }, { code: 'PNG', name: 'Penang' },
    { code: 'SBH', name: 'Sabah' }, { code: 'SWK', name: 'Sarawak' }, { code: 'SGR', name: 'Selangor' },
    { code: 'TRG', name: 'Terengganu' }, { code: 'KUL', name: 'Kuala Lumpur' }, { code: 'PJY', name: 'Putrajaya' },
    { code: 'LBN', name: 'Labuan' },
  ],
  supportsCustomFields: () => false,
};

export default myPlugin;
