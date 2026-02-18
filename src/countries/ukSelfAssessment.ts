/**
 * UK Self-Assessment / Making Tax Digital for Income Tax (MTD-IT) - ai2fin.com
 * HM Revenue & Customs (HMRC)
 * Reference: https://developer.service.hmrc.gov.uk/guides/income-tax-mtd-end-to-end-service-guide/
 * ARCHITECTURE: MTD for Income Tax launches April 2026 for income >£50,000.
 *   Quarterly digital updates + annual final declaration via compatible software.
 *   Tax bands 2025-26: 0% (£0-£12,570), 20% basic (£12,571-£50,270),
 *   40% higher (£50,271-£125,140), 45% additional (£125,141+).
 *   Scottish rates differ. Class 2 & 4 NICs for self-employed.
 *   This is a compound-key plugin: registered as 'GB-SA' alongside 'GB' (VAT Return).
 */

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
} from '../types';

const PA = 12570;
const BASIC_LIMIT = 50270;
const HIGHER_LIMIT = 125140;

function calcIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  let remaining = taxableIncome;

  // Personal allowance taper: reduces by £1 for every £2 over £100,000
  let personalAllowance = PA;
  if (taxableIncome > 100000) {
    personalAllowance = Math.max(0, PA - Math.floor((taxableIncome - 100000) / 2));
  }
  remaining = Math.max(0, taxableIncome - personalAllowance);

  const basicBand = Math.min(remaining, BASIC_LIMIT - personalAllowance);
  tax += basicBand * 0.20;
  remaining -= basicBand;

  const higherBand = Math.min(remaining, HIGHER_LIMIT - BASIC_LIMIT);
  tax += higherBand * 0.40;
  remaining -= higherBand;

  if (remaining > 0) tax += remaining * 0.45;

  return Math.round(tax * 100) / 100;
}

function calcClass4NICs(profit: number): number {
  // 2025-26 rates: 6% on £12,570-£50,270, 2% above £50,270
  if (profit <= PA) return 0;
  let nics = 0;
  const lower = Math.min(profit, BASIC_LIMIT) - PA;
  nics += lower * 0.06;
  if (profit > BASIC_LIMIT) {
    nics += (profit - BASIC_LIMIT) * 0.02;
  }
  return Math.round(nics * 100) / 100;
}

const gbSaPlugin: TaxFilingPlugin = {
  countryCode: 'GB-SA',
  displayName: 'Self-Assessment (MTD for Income Tax)',
  shortName: 'Self-Assessment',
  authority: {
    name: 'HMRC',
    fullName: 'HM Revenue & Customs',
    portalUrl: 'https://www.gov.uk/self-assessment-tax-returns',
    helpUrl: 'https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax',
  },
  taxFamily: 'INCOME_TAX',
  isFullPlugin: true,

  getFormSchema(): FormSection[] {
    return [
      {
        id: 'self_employment',
        title: 'Self-Employment Income',
        description: 'Trading income from your business (sole trader / partnership).',
        fields: [
          { id: 'turnover', label: 'Business turnover', type: 'currency', editable: true, required: true, autoPopulateFrom: 'income_total', helpText: 'Total sales/revenue from self-employment' },
          { id: 'allowable_expenses', label: 'Allowable business expenses', type: 'currency', editable: true, required: true, autoPopulateFrom: 'expenses_deductible', helpText: 'Running costs: office, travel, stock, professional fees' },
          { id: 'capital_allowances', label: 'Capital allowances (AIA / WDA)', type: 'currency', editable: true, required: false, autoPopulateFrom: 'expenses_capital', helpText: 'Annual Investment Allowance (£1M), Writing Down Allowance' },
          { id: 'net_profit', label: 'Net taxable profit', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'other_income',
        title: 'Other Income',
        collapsed: true,
        fields: [
          { id: 'employment_income', label: 'Employment income (PAYE)', type: 'currency', editable: true, required: false, helpText: 'If also employed — tax already deducted via PAYE' },
          { id: 'property_income', label: 'Property income (rental)', type: 'currency', editable: true, required: false, helpText: 'Rental profits after allowable deductions' },
          { id: 'savings_interest', label: 'Savings interest', type: 'currency', editable: true, required: false, helpText: 'Bank/building society interest (£1K PSA for basic rate)' },
          { id: 'dividends', label: 'Dividends', type: 'currency', editable: true, required: false, helpText: '£1,000 tax-free allowance, then 8.75%/33.75%/39.35%' },
          { id: 'other_income', label: 'Other taxable income', type: 'currency', editable: true, required: false },
        ],
      },
      {
        id: 'deductions',
        title: 'Tax Reliefs & Deductions',
        fields: [
          { id: 'pension_contributions', label: 'Pension contributions (gross)', type: 'currency', editable: true, required: false, helpText: 'Personal pension contributions — extends basic rate band' },
          { id: 'gift_aid', label: 'Gift Aid donations', type: 'currency', editable: true, required: false, helpText: 'Charity donations — extends basic rate band' },
          { id: 'loss_relief', label: 'Trading loss relief', type: 'currency', editable: true, required: false },
        ],
      },
      {
        id: 'tax_calc',
        title: 'Tax Calculation',
        fields: [
          { id: 'total_income', label: 'Total income', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'taxable_income', label: 'Taxable income (after deductions)', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'income_tax', label: 'Income tax liability', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'class4_nics', label: 'Class 4 NICs', type: 'currency', calculated: true, editable: false, required: true, helpText: '6% on £12,570-£50,270, 2% above' },
          { id: 'class2_nics', label: 'Class 2 NICs', type: 'currency', calculated: true, editable: false, required: false, helpText: '£3.45/week if profit > £12,570' },
          { id: 'student_loan', label: 'Student loan repayment', type: 'currency', editable: true, required: false },
        ],
      },
      {
        id: 'payments',
        title: 'Payments & Balance',
        fields: [
          { id: 'tax_already_paid', label: 'Tax already paid (PAYE, payments on account)', type: 'currency', editable: true, required: false },
          { id: 'total_tax_due', label: 'Total tax + NICs due', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'balance_due', label: 'Balance due / refundable', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({ monthly: false, quarterly: true, annual: true, defaultFrequency: 'annual' }),
  getFinancialYearBounds: (y) => ({ start: new Date(y, 3, 6), end: new Date(y + 1, 3, 5) }),

  getTerminology: () => ({
    taxName: 'Income Tax', taxAbbrev: 'IT',
    salesLabel: 'Turnover', purchasesLabel: 'Expenses',
    outputTaxLabel: 'Tax liability', inputTaxLabel: 'Tax reliefs',
  }),

  calculateFields(v: FieldValues): CalculatedFields {
    const turnover = Number(v.turnover) || 0;
    const expenses = Number(v.allowable_expenses) || 0;
    const capAllow = Number(v.capital_allowances) || 0;
    const net_profit = Math.max(0, turnover - expenses - capAllow);

    const employment = Number(v.employment_income) || 0;
    const property = Number(v.property_income) || 0;
    const savings = Number(v.savings_interest) || 0;
    const dividends = Number(v.dividends) || 0;
    const other = Number(v.other_income) || 0;

    const total_income = net_profit + employment + property + savings + dividends + other;

    const pension = Number(v.pension_contributions) || 0;
    const giftAid = Number(v.gift_aid) || 0;
    const lossRelief = Number(v.loss_relief) || 0;

    const taxable_income = Math.max(0, total_income - pension - giftAid - lossRelief);
    const income_tax = calcIncomeTax(taxable_income);
    const class4_nics = calcClass4NICs(net_profit);
    // Class 2: £3.45/week × 52 = £179.40 if profit > small profits threshold
    const class2_nics = net_profit > PA ? Math.round(3.45 * 52 * 100) / 100 : 0;

    const studentLoan = Number(v.student_loan) || 0;
    const total_tax_due = Math.round((income_tax + class4_nics + class2_nics + studentLoan) * 100) / 100;
    const alreadyPaid = Number(v.tax_already_paid) || 0;
    const balance_due = Math.round((total_tax_due - alreadyPaid) * 100) / 100;

    return { net_profit, total_income, taxable_income, income_tax, class4_nics, class2_nics, total_tax_due, balance_due };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'turnover', aggregateKey: 'income_total' },
    { fieldId: 'allowable_expenses', aggregateKey: 'expenses_deductible' },
    { fieldId: 'capital_allowances', aggregateKey: 'expenses_capital' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    if (Number(v.turnover) < 0) r.push({ fieldId: 'turnover', message: 'Turnover cannot be negative', severity: 'error' });
    const expenses = Number(v.allowable_expenses) || 0;
    const turnover = Number(v.turnover) || 0;
    if (expenses > turnover * 1.5) r.push({ fieldId: 'allowable_expenses', message: 'Expenses significantly exceed turnover — verify', severity: 'warning' });
    return r;
  },

  getFieldHelp: (id) => {
    const h: Record<string, string> = {
      turnover: 'Total business sales for the tax year. Report gross amount before expenses.',
      net_profit: 'Turnover minus allowable expenses and capital allowances. This is your taxable profit.',
      income_tax: 'Calculated using 2025-26 tax bands. Personal allowance tapers above £100K.',
      class4_nics: 'National Insurance for self-employed: 6% on profits between £12,570-£50,270, 2% above.',
    };
    return h[id] ?? null;
  },

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON (MTD API format)', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v) {
    return { data: JSON.stringify(v, null, 2), filename: `SelfAssessment-GB-${new Date().toISOString().slice(0, 10)}.json`, mimeType: 'application/json' };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://www.gov.uk/self-assessment-tax-returns', submissionMethod: 'api' as const, apiReady: true }),
  hasSubJurisdictions: () => true,
  getSubJurisdictions: () => [
    { code: 'ENG', name: 'England' }, { code: 'WAL', name: 'Wales' },
    { code: 'SCT', name: 'Scotland' }, { code: 'NIR', name: 'Northern Ireland' },
  ],
  supportsCustomFields: () => false,
};

export default gbSaPlugin;
