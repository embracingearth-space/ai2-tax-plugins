/**
 * Brazil Federal Tax Return (EFD-Contribuições — PIS/COFINS) - ai2fin.com
 * Receita Federal do Brasil (RFB)
 * Reference: https://www.gov.br/receitafederal
 * ARCHITECTURE: Brazil's indirect tax is complex — multiple layers:
 *   PIS: 1.65% non-cumulative (0.65% cumulative)
 *   COFINS: 7.6% non-cumulative (3% cumulative)
 *   ICMS: state-level VAT, rates vary (7-18%+ inter-state)
 *   IPI: federal excise on manufactured goods (varies)
 *   This plugin covers PIS/COFINS (federal). ICMS is state-level (sub-jurisdiction).
 *   FY: Jan-Dec. Monthly filing by 10th business day of 2nd month after period.
 *   Tax reform (IBS + CBS) replacing all by 2033, but current system still active 2026.
 */

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
  SubJurisdiction,
} from '../types';

const PIS_RATE = 0.0165;
const COFINS_RATE = 0.076;

const brPlugin: TaxFilingPlugin = {
  countryCode: 'BR',
  displayName: 'EFD-Contribuições (PIS/COFINS)',
  shortName: 'PIS/COFINS',
  authority: {
    name: 'RFB',
    fullName: 'Receita Federal do Brasil',
    portalUrl: 'https://www.gov.br/receitafederal',
    helpUrl: 'https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/declaracoes-e-demonstrativos/sped-sistema-publico-de-escrituracao-digital/escrituracao-fiscal-digital-efd-contribuicoes',
  },
  taxFamily: 'HYBRID',
  isFullPlugin: true,

  getFormSchema(): FormSection[] {
    return [
      {
        id: 'revenue',
        title: 'Receita Bruta (Gross Revenue)',
        fields: [
          { id: 'revenue_taxable', label: 'Taxable gross revenue', type: 'currency', editable: true, required: true, autoPopulateFrom: 'income_taxable', helpText: 'Total revenue subject to PIS/COFINS' },
          { id: 'revenue_non_cumulative', label: 'Non-cumulative regime revenue', type: 'currency', editable: true, required: false, helpText: 'Lucro Real companies — PIS 1.65% + COFINS 7.6%' },
          { id: 'revenue_cumulative', label: 'Cumulative regime revenue', type: 'currency', editable: true, required: false, helpText: 'Lucro Presumido companies — PIS 0.65% + COFINS 3%' },
          { id: 'revenue_exempt', label: 'Exempt / non-taxable revenue', type: 'currency', editable: true, required: false },
          { id: 'revenue_export', label: 'Export revenue (zero-rated)', type: 'currency', editable: true, required: false },
        ],
      },
      {
        id: 'output_contributions',
        title: 'Contribuições sobre Receita (Output Contributions)',
        fields: [
          { id: 'pis_output', label: 'PIS on revenue', type: 'currency', calculated: true, editable: true, required: true },
          { id: 'cofins_output', label: 'COFINS on revenue', type: 'currency', calculated: true, editable: true, required: true },
          { id: 'total_output', label: 'Total output contributions', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'input_credits',
        title: 'Créditos (Input Credits)',
        description: 'Credits on business costs and expenses (non-cumulative regime only).',
        fields: [
          { id: 'goods_purchased', label: 'Goods purchased for resale / inputs', type: 'currency', editable: true, required: false, autoPopulateFrom: 'expenses_goods', helpText: 'Cost of goods used in production or resale' },
          { id: 'services_purchased', label: 'Services used in operations', type: 'currency', editable: true, required: false, autoPopulateFrom: 'expenses_services' },
          { id: 'depreciation_credits', label: 'Depreciation of fixed assets', type: 'currency', editable: true, required: false },
          { id: 'energy_rent', label: 'Energy, rent, leasing costs', type: 'currency', editable: true, required: false },
          { id: 'pis_credits', label: 'PIS credits', type: 'currency', calculated: true, editable: true, required: false },
          { id: 'cofins_credits', label: 'COFINS credits', type: 'currency', calculated: true, editable: true, required: false },
          { id: 'total_credits', label: 'Total input credits', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'summary',
        title: 'Contribuições a Pagar (Net Payable)',
        fields: [
          { id: 'net_pis', label: 'Net PIS payable', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'net_cofins', label: 'Net COFINS payable', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'total_payable', label: 'Total contributions payable', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({ monthly: true, quarterly: false, annual: false, defaultFrequency: 'monthly' }),
  getFinancialYearBounds: (y) => ({ start: new Date(y, 0, 1), end: new Date(y, 11, 31) }),

  getTerminology: () => ({
    taxName: 'PIS/COFINS', taxAbbrev: 'PIS/COFINS',
    salesLabel: 'Receita (Revenue)', purchasesLabel: 'Custos/Despesas (Costs)',
    outputTaxLabel: 'Contribuições devidas', inputTaxLabel: 'Créditos',
  }),

  calculateFields(v: FieldValues): CalculatedFields {
    const revNC = Number(v.revenue_non_cumulative) || Number(v.revenue_taxable) || 0;
    const goodsP = Number(v.goods_purchased) || 0;
    const servP = Number(v.services_purchased) || 0;
    const deprec = Number(v.depreciation_credits) || 0;
    const energy = Number(v.energy_rent) || 0;
    const totalInputBase = goodsP + servP + deprec + energy;

    const pis_output_calc = Math.round(revNC * PIS_RATE * 100) / 100;
    const cofins_output_calc = Math.round(revNC * COFINS_RATE * 100) / 100;
    const total_output = Math.round((pis_output_calc + cofins_output_calc) * 100) / 100;

    const pis_credits_calc = Math.round(totalInputBase * PIS_RATE * 100) / 100;
    const cofins_credits_calc = Math.round(totalInputBase * COFINS_RATE * 100) / 100;
    const total_credits = Math.round((pis_credits_calc + cofins_credits_calc) * 100) / 100;

    const pis_output = (v.pis_output !== '' && v.pis_output !== undefined && v.pis_output !== null)
      ? Number(v.pis_output) : pis_output_calc;
    const cofins_output = (v.cofins_output !== '' && v.cofins_output !== undefined && v.cofins_output !== null)
      ? Number(v.cofins_output) : cofins_output_calc;
    const pis_credits = (v.pis_credits !== '' && v.pis_credits !== undefined && v.pis_credits !== null)
      ? Number(v.pis_credits) : pis_credits_calc;
    const cofins_credits = (v.cofins_credits !== '' && v.cofins_credits !== undefined && v.cofins_credits !== null)
      ? Number(v.cofins_credits) : cofins_credits_calc;

    const net_pis = Math.round(Math.max(0, pis_output - pis_credits) * 100) / 100;
    const net_cofins = Math.round(Math.max(0, cofins_output - cofins_credits) * 100) / 100;
    const total_payable = Math.round((net_pis + net_cofins) * 100) / 100;

    return {
      pis_output: pis_output_calc, cofins_output: cofins_output_calc, total_output,
      pis_credits: pis_credits_calc, cofins_credits: cofins_credits_calc, total_credits,
      net_pis, net_cofins, total_payable,
    };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'revenue_taxable', aggregateKey: 'income_taxable' },
    { fieldId: 'goods_purchased', aggregateKey: 'expenses_goods' },
    { fieldId: 'services_purchased', aggregateKey: 'expenses_services' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    if (Number(v.revenue_taxable) < 0) r.push({ fieldId: 'revenue_taxable', message: 'Revenue cannot be negative', severity: 'error' });
    const nc = Number(v.revenue_non_cumulative) || 0;
    const cum = Number(v.revenue_cumulative) || 0;
    if (nc > 0 && cum > 0) r.push({ fieldId: 'revenue_cumulative', message: 'Most companies are either cumulative OR non-cumulative — verify your regime', severity: 'warning' });
    return r;
  },
  getFieldHelp: () => null,

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v) {
    return { data: JSON.stringify(v, null, 2), filename: `EFD-PISCOFINS-BR-${new Date().toISOString().slice(0, 10)}.json`, mimeType: 'application/json' };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://www.gov.br/receitafederal', submissionMethod: 'manual_upload' as const, apiReady: false }),
  hasSubJurisdictions: () => true,
  getSubJurisdictions: (): SubJurisdiction[] => [
    { code: 'SP', name: 'São Paulo', rate: 0.18 }, { code: 'RJ', name: 'Rio de Janeiro', rate: 0.20 },
    { code: 'MG', name: 'Minas Gerais', rate: 0.18 }, { code: 'BA', name: 'Bahia', rate: 0.18 },
    { code: 'RS', name: 'Rio Grande do Sul', rate: 0.17 }, { code: 'PR', name: 'Paraná', rate: 0.19 },
    { code: 'SC', name: 'Santa Catarina', rate: 0.17 }, { code: 'PE', name: 'Pernambuco', rate: 0.18 },
    { code: 'CE', name: 'Ceará', rate: 0.18 }, { code: 'DF', name: 'Distrito Federal', rate: 0.18 },
    { code: 'GO', name: 'Goiás', rate: 0.17 }, { code: 'PA', name: 'Pará', rate: 0.17 },
    { code: 'AM', name: 'Amazonas', rate: 0.18 }, { code: 'ES', name: 'Espírito Santo', rate: 0.17 },
    { code: 'MT', name: 'Mato Grosso', rate: 0.17 }, { code: 'MS', name: 'Mato Grosso do Sul', rate: 0.17 },
    { code: 'MA', name: 'Maranhão', rate: 0.18 }, { code: 'PB', name: 'Paraíba', rate: 0.18 },
    { code: 'RN', name: 'Rio Grande do Norte', rate: 0.18 }, { code: 'AL', name: 'Alagoas', rate: 0.17 },
    { code: 'PI', name: 'Piauí', rate: 0.18 }, { code: 'SE', name: 'Sergipe', rate: 0.18 },
    { code: 'TO', name: 'Tocantins', rate: 0.18 }, { code: 'RO', name: 'Rondônia', rate: 0.17 },
    { code: 'AC', name: 'Acre', rate: 0.17 }, { code: 'AP', name: 'Amapá', rate: 0.18 },
    { code: 'RR', name: 'Roraima', rate: 0.17 },
  ],
  supportsCustomFields: () => false,
};

export default brPlugin;
