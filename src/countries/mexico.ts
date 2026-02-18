/**
 * Mexico IVA Declaration (Declaración de IVA) - ai2fin.com
 * Servicio de Administración Tributaria (SAT)
 * Reference: https://www.sat.gob.mx
 * ARCHITECTURE: 16% standard IVA rate. 0% on food, medicine, exports.
 *   FY: Jan-Dec. Monthly filing by 17th of following month.
 *   CFDI e-invoicing mandatory for all. DIOT informational return also monthly.
 */

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
} from '../types';

const MX_RATE = 0.16;

const mxPlugin: TaxFilingPlugin = {
  countryCode: 'MX',
  displayName: 'IVA Declaration (Declaración de IVA)',
  shortName: 'IVA',
  authority: {
    name: 'SAT',
    fullName: 'Servicio de Administración Tributaria',
    portalUrl: 'https://www.sat.gob.mx',
    helpUrl: 'https://www.sat.gob.mx/consulta/61977/conoce-el-impuesto-al-valor-agregado-(iva)',
  },
  taxFamily: 'VAT',
  isFullPlugin: true,

  getFormSchema(): FormSection[] {
    return [
      {
        id: 'sales',
        title: 'IVA Causado (Output IVA)',
        fields: [
          { id: 'sales_16', label: 'Sales at 16%', type: 'currency', editable: true, required: true, autoPopulateFrom: 'income_standard', helpText: 'Most goods and services' },
          { id: 'sales_0', label: 'Sales at 0%', type: 'currency', editable: true, required: false, helpText: 'Food, medicine, agricultural, exports' },
          { id: 'sales_exempt', label: 'Exempt sales', type: 'currency', editable: true, required: false, helpText: 'Housing rent, medical, education, cultural events' },
          { id: 'iva_causado', label: 'IVA caused (trasladado)', type: 'currency', calculated: true, editable: true, required: true },
        ],
      },
      {
        id: 'purchases',
        title: 'IVA Acreditable (Input IVA)',
        fields: [
          { id: 'purchases_16', label: 'Purchases at 16%', type: 'currency', editable: true, required: true, autoPopulateFrom: 'expenses_standard' },
          { id: 'purchases_0', label: 'Purchases at 0%', type: 'currency', editable: true, required: false },
          { id: 'imports', label: 'Imports (IVA paid at customs)', type: 'currency', editable: true, required: false },
          { id: 'iva_acreditable', label: 'IVA creditable (acreditable)', type: 'currency', calculated: true, editable: true, required: true, autoPopulateFrom: 'input_tax' },
        ],
      },
      {
        id: 'retention',
        title: 'IVA Retenido (Withheld IVA)',
        collapsed: true,
        fields: [
          { id: 'iva_retenido_received', label: 'IVA withheld to you (by clients)', type: 'currency', editable: true, required: false, helpText: 'Moral persons withhold 2/3 of IVA on certain services' },
          { id: 'iva_retenido_paid', label: 'IVA you withheld (from suppliers)', type: 'currency', editable: true, required: false },
        ],
      },
      {
        id: 'summary',
        title: 'IVA a Pagar / Favor (Net IVA)',
        fields: [
          { id: 'net_iva', label: 'Net IVA payable / in favor', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'prior_balance_favor', label: 'Prior period IVA in favor (saldo a favor)', type: 'currency', editable: true, required: false },
          { id: 'balance_due', label: 'Total IVA to pay', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({ monthly: true, quarterly: false, annual: false, defaultFrequency: 'monthly' }),
  getFinancialYearBounds: (y) => ({ start: new Date(y, 0, 1), end: new Date(y, 11, 31) }),

  getTerminology: () => ({
    taxName: 'IVA (Impuesto al Valor Agregado)', taxAbbrev: 'IVA',
    salesLabel: 'Ventas', purchasesLabel: 'Compras',
    outputTaxLabel: 'IVA trasladado', inputTaxLabel: 'IVA acreditable',
  }),

  calculateFields(v: FieldValues): CalculatedFields {
    const s16 = Number(v.sales_16) || 0;
    const p16 = Number(v.purchases_16) || 0;
    const imp = Number(v.imports) || 0;
    const retReceived = Number(v.iva_retenido_received) || 0;
    const prior = Number(v.prior_balance_favor) || 0;

    const iva_causado_calc = Math.round(s16 * MX_RATE * 100) / 100;
    const iva_causado = (v.iva_causado !== '' && v.iva_causado !== undefined && v.iva_causado !== null)
      ? Math.round(Number(v.iva_causado) * 100) / 100 : iva_causado_calc;

    const iva_acreditable_calc = Math.round((p16 + imp) * MX_RATE * 100) / 100;
    const iva_acreditable = (v.iva_acreditable !== '' && v.iva_acreditable !== undefined && v.iva_acreditable !== null)
      ? Math.round(Number(v.iva_acreditable) * 100) / 100 : iva_acreditable_calc;

    const net_iva = Math.round((iva_causado - iva_acreditable - retReceived) * 100) / 100;
    const balance_due = Math.round(Math.max(0, net_iva - prior) * 100) / 100;

    return { iva_causado: iva_causado_calc, iva_acreditable: iva_acreditable_calc, net_iva, balance_due };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'sales_16', aggregateKey: 'income_standard' },
    { fieldId: 'purchases_16', aggregateKey: 'expenses_standard' },
    { fieldId: 'iva_acreditable', aggregateKey: 'input_tax' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    if (Number(v.sales_16) < 0) r.push({ fieldId: 'sales_16', message: 'Sales cannot be negative', severity: 'error' });
    return r;
  },
  getFieldHelp: () => null,

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v) {
    return { data: JSON.stringify(v, null, 2), filename: `IVA-MX-${new Date().toISOString().slice(0, 10)}.json`, mimeType: 'application/json' };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://www.sat.gob.mx', submissionMethod: 'manual_upload' as const, apiReady: false }),
  hasSubJurisdictions: () => false,
  supportsCustomFields: () => false,
};

export default mxPlugin;
