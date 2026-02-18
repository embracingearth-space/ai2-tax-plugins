/**
 * China VAT Return (增值税纳税申报表) - ai2fin.com
 * State Taxation Administration (STA / 国家税务总局)
 * Reference: https://etax.chinatax.gov.cn
 * ARCHITECTURE: Three tiers — 13% (manufacturing, goods), 9% (transport, construction, agriculture),
 *   6% (services, intangibles). Small-scale taxpayers: 3% (1% temporarily).
 *   FY: Jan-Dec. Monthly filing for general taxpayers, quarterly for small-scale.
 *   Golden Tax System (金税工程) and Fapiao e-invoicing mandatory.
 */

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
} from '../types';

const cnPlugin: TaxFilingPlugin = {
  countryCode: 'CN',
  displayName: 'VAT Return (增值税纳税申报表)',
  shortName: 'VAT Return',
  authority: {
    name: 'STA',
    fullName: 'State Taxation Administration (国家税务总局)',
    portalUrl: 'https://etax.chinatax.gov.cn',
    helpUrl: 'https://www.chinatax.gov.cn',
  },
  taxFamily: 'VAT',
  isFullPlugin: true,

  getFormSchema(): FormSection[] {
    return [
      {
        id: 'output',
        title: 'Output VAT (销项税额)',
        description: 'VAT charged on sales at applicable rates.',
        fields: [
          { id: 'sales_13', label: 'Sales at 13% (goods, manufacturing)', officialLabel: '13%税率销售额', type: 'currency', editable: true, required: true, autoPopulateFrom: 'income_standard', helpText: 'Tangible goods, manufacturing, processing' },
          { id: 'sales_9', label: 'Sales at 9% (transport, construction)', officialLabel: '9%税率销售额', type: 'currency', editable: true, required: false, helpText: 'Transport, postal, construction, real estate, agriculture' },
          { id: 'sales_6', label: 'Sales at 6% (services)', officialLabel: '6%税率销售额', type: 'currency', editable: true, required: false, helpText: 'Financial, IT, consulting, R&D, lifestyle services' },
          { id: 'sales_exempt', label: 'Exempt / zero-rated sales', type: 'currency', editable: true, required: false, helpText: 'Exports (with refund), agricultural self-produced goods' },
          { id: 'output_vat_total', label: 'Total output VAT', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'input',
        title: 'Input VAT (进项税额)',
        description: 'VAT paid on purchases eligible for credit. Requires valid fapiao.',
        fields: [
          { id: 'input_vat_invoiced', label: 'Input VAT (from special VAT invoices)', type: 'currency', editable: true, required: true, autoPopulateFrom: 'input_tax', helpText: 'VAT shown on authenticated special VAT fapiao' },
          { id: 'input_vat_customs', label: 'Input VAT (customs import)', type: 'currency', editable: true, required: false, helpText: 'VAT paid on imported goods per customs payment certificate' },
          { id: 'input_vat_transport', label: 'Input VAT (transport/toll invoices)', type: 'currency', editable: true, required: false },
          { id: 'input_vat_transferred_out', label: 'Input VAT transferred out (进项税额转出)', type: 'currency', editable: true, required: false, helpText: 'Non-deductible items: collective welfare, personal consumption, abnormal loss' },
          { id: 'net_input_vat', label: 'Net deductible input VAT', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'summary',
        title: 'Tax Payable (应纳税额)',
        fields: [
          { id: 'tax_payable', label: 'VAT payable this period', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'prior_period_credit', label: 'Prior period ending credit (上期留抵税额)', type: 'currency', editable: true, required: false, helpText: 'Excess input VAT carried forward from prior period' },
          { id: 'net_payable', label: 'Net VAT payable / credit carried forward', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({ monthly: true, quarterly: true, annual: false, defaultFrequency: 'monthly' }),
  getFinancialYearBounds: (y) => ({ start: new Date(y, 0, 1), end: new Date(y, 11, 31) }),

  getTerminology: () => ({
    taxName: 'VAT (增值税)', taxAbbrev: '增值税',
    salesLabel: 'Sales (销售额)', purchasesLabel: 'Purchases (购进)',
    outputTaxLabel: 'Output VAT (销项税额)', inputTaxLabel: 'Input VAT (进项税额)',
  }),

  calculateFields(v: FieldValues): CalculatedFields {
    const s13 = Number(v.sales_13) || 0;
    const s9 = Number(v.sales_9) || 0;
    const s6 = Number(v.sales_6) || 0;

    const output_vat_total = Math.round((s13 * 0.13 + s9 * 0.09 + s6 * 0.06) * 100) / 100;

    const inputInv = Number(v.input_vat_invoiced) || 0;
    const inputCust = Number(v.input_vat_customs) || 0;
    const inputTrans = Number(v.input_vat_transport) || 0;
    const transferredOut = Number(v.input_vat_transferred_out) || 0;
    const net_input_vat = Math.round((inputInv + inputCust + inputTrans - transferredOut) * 100) / 100;

    const tax_payable = Math.round((output_vat_total - net_input_vat) * 100) / 100;
    const priorCredit = Number(v.prior_period_credit) || 0;
    const net_payable = Math.round((tax_payable - priorCredit) * 100) / 100;

    return { output_vat_total, net_input_vat, tax_payable, net_payable };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'sales_13', aggregateKey: 'income_standard' },
    { fieldId: 'input_vat_invoiced', aggregateKey: 'input_tax' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    if (Number(v.sales_13) < 0) r.push({ fieldId: 'sales_13', message: 'Sales cannot be negative', severity: 'error' });
    const transferred = Number(v.input_vat_transferred_out) || 0;
    const totalInput = (Number(v.input_vat_invoiced) || 0) + (Number(v.input_vat_customs) || 0) + (Number(v.input_vat_transport) || 0);
    if (transferred > totalInput) r.push({ fieldId: 'input_vat_transferred_out', message: 'Transferred-out amount exceeds total input VAT', severity: 'error' });
    return r;
  },

  getFieldHelp: (id) => {
    const h: Record<string, string> = {
      sales_13: 'Standard rate for tangible goods since Apr 2019 (was 16%). Includes manufacturing, processing, repair.',
      input_vat_transferred_out: 'Must transfer out input VAT for: collective welfare, personal consumption, simple-method items, abnormal losses.',
    };
    return h[id] ?? null;
  },

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v) {
    return { data: JSON.stringify(v, null, 2), filename: `VAT-CN-${new Date().toISOString().slice(0, 10)}.json`, mimeType: 'application/json' };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://etax.chinatax.gov.cn', submissionMethod: 'manual_upload' as const, apiReady: false }),
  hasSubJurisdictions: () => true,
  getSubJurisdictions: () => [
    { code: 'BJ', name: 'Beijing' }, { code: 'SH', name: 'Shanghai' }, { code: 'GD', name: 'Guangdong' },
    { code: 'JS', name: 'Jiangsu' }, { code: 'ZJ', name: 'Zhejiang' }, { code: 'SD', name: 'Shandong' },
    { code: 'HN', name: 'Henan' }, { code: 'SC', name: 'Sichuan' }, { code: 'HB', name: 'Hubei' },
    { code: 'FJ', name: 'Fujian' }, { code: 'HUN', name: 'Hunan' }, { code: 'AH', name: 'Anhui' },
    { code: 'HEB', name: 'Hebei' }, { code: 'LN', name: 'Liaoning' }, { code: 'CQ', name: 'Chongqing' },
    { code: 'SX', name: 'Shaanxi' }, { code: 'JX', name: 'Jiangxi' }, { code: 'YN', name: 'Yunnan' },
    { code: 'GX', name: 'Guangxi' }, { code: 'SN', name: 'Shanxi' }, { code: 'NM', name: 'Inner Mongolia' },
    { code: 'GZ', name: 'Guizhou' }, { code: 'XJ', name: 'Xinjiang' }, { code: 'TJ', name: 'Tianjin' },
    { code: 'JL', name: 'Jilin' }, { code: 'HL', name: 'Heilongjiang' }, { code: 'GS', name: 'Gansu' },
    { code: 'HI', name: 'Hainan' }, { code: 'NX', name: 'Ningxia' }, { code: 'QH', name: 'Qinghai' },
    { code: 'XZ', name: 'Tibet' },
  ],
  supportsCustomFields: () => false,
};

export default cnPlugin;
