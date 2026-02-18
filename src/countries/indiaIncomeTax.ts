/**
 * India Income Tax Return (ITR-4 Sugam / ITR-1 Sahaj) - ai2fin.com
 * Income Tax Department / Central Board of Direct Taxes (CBDT)
 * Reference: https://www.incometax.gov.in
 * ARCHITECTURE: Compound-key plugin 'IN-IT' alongside 'IN' (GSTR-3B).
 *   Two regimes from AY 2024-25:
 *   OLD: 5% (₹3-6L), 20% (₹6-9L), 30% (₹9L+) with deductions (80C, 80D, HRA, etc.)
 *   NEW (default from AY 2024-25): 0% (₹0-3L), 5% (₹3-7L), 10% (₹7-10L),
 *     15% (₹10-12L), 20% (₹12-15L), 30% (₹15L+). Standard deduction ₹75,000.
 *   FY: Apr 1 - Mar 31. Filing deadline: Jul 31 (non-audit), Oct 31 (audit).
 *   Advance tax: quarterly (Jun 15, Sep 15, Dec 15, Mar 15).
 */

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
  SubJurisdiction,
} from '../types';

function calcOldRegime(taxable: number): number {
  if (taxable <= 300000) return 0;
  let tax = 0;
  let r = taxable;
  if (r > 300000) { tax += Math.min(r - 300000, 300000) * 0.05; }
  if (r > 600000) { tax += Math.min(r - 600000, 300000) * 0.20; }
  if (r > 900000) { tax += (r - 900000) * 0.30; }
  return Math.round(tax);
}

function calcNewRegime(taxable: number): number {
  if (taxable <= 300000) return 0;
  let tax = 0;
  const slabs = [
    [300000, 700000, 0.05], [700000, 1000000, 0.10], [1000000, 1200000, 0.15],
    [1200000, 1500000, 0.20], [1500000, Infinity, 0.30],
  ] as const;
  for (const [lower, upper, rate] of slabs) {
    if (taxable > lower) {
      tax += Math.min(taxable - lower, upper - lower) * rate;
    }
  }
  // Marginal relief for income ≤ ₹7L under section 87A (rebate ₹25,000)
  if (taxable <= 700000) { tax = Math.max(0, tax - 25000); }
  return Math.round(tax);
}

const INDIAN_STATES: SubJurisdiction[] = [
  { code: '01', name: 'Jammu & Kashmir' }, { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' }, { code: '07', name: 'Delhi' },
  { code: '09', name: 'Uttar Pradesh' }, { code: '19', name: 'West Bengal' },
  { code: '21', name: 'Odisha' }, { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' }, { code: '24', name: 'Gujarat' },
  { code: '27', name: 'Maharashtra' }, { code: '29', name: 'Karnataka' },
  { code: '32', name: 'Kerala' }, { code: '33', name: 'Tamil Nadu' },
  { code: '36', name: 'Telangana' }, { code: '37', name: 'Andhra Pradesh' },
];

const inItPlugin: TaxFilingPlugin = {
  countryCode: 'IN-IT',
  displayName: 'Income Tax Return (ITR-1/ITR-4)',
  shortName: 'ITR',
  authority: {
    name: 'CBDT',
    fullName: 'Central Board of Direct Taxes',
    portalUrl: 'https://www.incometax.gov.in',
    helpUrl: 'https://www.incometax.gov.in/iec/foportal/help/all-topics/tax-payer/individual/how-to-file-tax-returns',
  },
  taxFamily: 'INCOME_TAX',
  isFullPlugin: true,

  getFormSchema(): FormSection[] {
    return [
      {
        id: 'regime',
        title: 'Tax Regime Selection',
        fields: [
          { id: 'tax_regime', label: 'Tax regime', type: 'select', editable: true, required: true, helpText: 'New regime is default from AY 2024-25. Old regime allows deductions under Ch VIA.', selectOptions: [{ value: 'new', label: 'New Regime (default)' }, { value: 'old', label: 'Old Regime' }] },
        ],
      },
      {
        id: 'income',
        title: 'Income Details',
        fields: [
          { id: 'salary_income', label: 'Income from salary', type: 'currency', editable: true, required: false, helpText: 'Gross salary as per Form 16' },
          { id: 'business_income', label: 'Income from business/profession', type: 'currency', editable: true, required: false, autoPopulateFrom: 'income_business', helpText: 'Profit from business (ITR-4: presumptive income u/s 44AD/44ADA)' },
          { id: 'presumptive_turnover', label: 'Turnover for presumptive taxation (44AD)', type: 'currency', editable: true, required: false, helpText: 'If turnover <₹3Cr, declare 6% (digital) / 8% (cash) as income' },
          { id: 'house_property_income', label: 'Income from house property', type: 'currency', editable: true, required: false, helpText: 'Rental income minus 30% standard deduction, minus home loan interest' },
          { id: 'capital_gains', label: 'Capital gains', type: 'currency', editable: true, required: false },
          { id: 'other_sources', label: 'Income from other sources', type: 'currency', editable: true, required: false, helpText: 'Interest, dividends, lottery, etc.' },
          { id: 'exempt_income', label: 'Exempt income (agriculture, etc.)', type: 'currency', editable: true, required: false },
          { id: 'gross_total_income', label: 'Gross total income', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'deductions_old',
        title: 'Deductions — Chapter VIA (Old Regime Only)',
        description: 'These deductions are only available under the old tax regime.',
        collapsed: true,
        fields: [
          { id: 'sec_80c', label: '80C — LIC, PPF, ELSS, tuition, EPF (max ₹1.5L)', type: 'currency', editable: true, required: false },
          { id: 'sec_80ccd1b', label: '80CCD(1B) — NPS additional (max ₹50K)', type: 'currency', editable: true, required: false },
          { id: 'sec_80d', label: '80D — Medical insurance (₹25K self + ₹50K parents)', type: 'currency', editable: true, required: false },
          { id: 'sec_80e', label: '80E — Education loan interest', type: 'currency', editable: true, required: false },
          { id: 'sec_80g', label: '80G — Donations', type: 'currency', editable: true, required: false },
          { id: 'hra_exemption', label: 'HRA exemption (u/s 10(13A))', type: 'currency', editable: true, required: false },
          { id: 'home_loan_interest', label: 'Home loan interest (Sec 24 — max ₹2L self-occupied)', type: 'currency', editable: true, required: false },
          { id: 'other_deductions', label: 'Other Chapter VIA deductions', type: 'currency', editable: true, required: false },
          { id: 'total_deductions', label: 'Total deductions', type: 'currency', calculated: true, editable: false, required: false },
        ],
      },
      {
        id: 'standard_deduction',
        title: 'Standard Deduction',
        fields: [
          { id: 'standard_deduction', label: 'Standard deduction', type: 'currency', calculated: true, editable: false, required: true, helpText: 'New regime: ₹75,000. Old regime: ₹50,000 (salaried only).' },
        ],
      },
      {
        id: 'tax_calculation',
        title: 'Tax Computation',
        fields: [
          { id: 'taxable_income', label: 'Total taxable income', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'tax_on_income', label: 'Tax on total income', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'surcharge', label: 'Surcharge (if income > ₹50L)', type: 'currency', calculated: true, editable: false, required: false },
          { id: 'cess', label: 'Health & Education Cess (4%)', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'total_tax', label: 'Total tax liability', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'payments',
        title: 'Tax Paid & Balance',
        fields: [
          { id: 'tds', label: 'TDS (Tax Deducted at Source)', type: 'currency', editable: true, required: false, helpText: 'As per Form 26AS / AIS' },
          { id: 'advance_tax', label: 'Advance tax paid', type: 'currency', editable: true, required: false },
          { id: 'self_assessment_tax', label: 'Self-assessment tax paid', type: 'currency', editable: true, required: false },
          { id: 'balance_due', label: 'Tax payable / refundable', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({ monthly: false, quarterly: true, annual: true, defaultFrequency: 'annual' }),
  getFinancialYearBounds: (y) => ({ start: new Date(y, 3, 1), end: new Date(y + 1, 2, 31) }),

  getTerminology: () => ({
    taxName: 'Income Tax', taxAbbrev: 'IT',
    salesLabel: 'Income', purchasesLabel: 'Deductions',
    outputTaxLabel: 'Tax liability', inputTaxLabel: 'Tax credits/TDS',
  }),

  calculateFields(v: FieldValues): CalculatedFields {
    const regime = String(v.tax_regime || 'new');
    const salary = Number(v.salary_income) || 0;
    const business = Number(v.business_income) || 0;
    const house = Number(v.house_property_income) || 0;
    const capGains = Number(v.capital_gains) || 0;
    const otherSrc = Number(v.other_sources) || 0;

    // Presumptive: 6% of digital turnover or 8% of cash turnover
    const presumptive = Number(v.presumptive_turnover) || 0;
    const presumptiveIncome = presumptive > 0 ? Math.round(presumptive * 0.08) : 0;
    const totalBusiness = business + presumptiveIncome;

    const gross_total_income = salary + totalBusiness + house + capGains + otherSrc;

    // Standard deduction
    const hasSalary = salary > 0;
    const standard_deduction = regime === 'new' ? 75000 : (hasSalary ? 50000 : 0);

    // Old regime deductions
    let total_deductions = 0;
    if (regime === 'old') {
      const s80c = Math.min(Number(v.sec_80c) || 0, 150000);
      const s80ccd = Math.min(Number(v.sec_80ccd1b) || 0, 50000);
      const s80d = Math.min(Number(v.sec_80d) || 0, 75000);
      const s80e = Number(v.sec_80e) || 0;
      const s80g = Number(v.sec_80g) || 0;
      const hra = Number(v.hra_exemption) || 0;
      const homeLoan = Math.min(Number(v.home_loan_interest) || 0, 200000);
      const otherDed = Number(v.other_deductions) || 0;
      total_deductions = s80c + s80ccd + s80d + s80e + s80g + hra + homeLoan + otherDed;
    }

    const taxable_income = Math.max(0, gross_total_income - standard_deduction - total_deductions);

    const tax_on_income = regime === 'new' ? calcNewRegime(taxable_income) : calcOldRegime(taxable_income);

    // Surcharge
    let surcharge = 0;
    if (taxable_income > 5000000 && taxable_income <= 10000000) surcharge = tax_on_income * 0.10;
    else if (taxable_income > 10000000 && taxable_income <= 20000000) surcharge = tax_on_income * 0.15;
    else if (taxable_income > 20000000 && taxable_income <= 50000000) surcharge = tax_on_income * 0.25;
    else if (taxable_income > 50000000) surcharge = tax_on_income * 0.25; // capped at 25% for new regime
    surcharge = Math.round(surcharge);

    const cess = Math.round((tax_on_income + surcharge) * 0.04);
    const total_tax = tax_on_income + surcharge + cess;

    const tds = Number(v.tds) || 0;
    const advanceTax = Number(v.advance_tax) || 0;
    const selfAssess = Number(v.self_assessment_tax) || 0;
    const balance_due = total_tax - tds - advanceTax - selfAssess;

    return {
      gross_total_income, standard_deduction, total_deductions, taxable_income,
      tax_on_income, surcharge, cess, total_tax, balance_due,
    };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'business_income', aggregateKey: 'income_business' },
    { fieldId: 'other_sources', aggregateKey: 'income_other' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 0, wholeOnly: true }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    const regime = String(v.tax_regime || 'new');
    if (regime === 'new') {
      const has80c = Number(v.sec_80c) || 0;
      if (has80c > 0) r.push({ fieldId: 'sec_80c', message: 'Chapter VIA deductions not available under New Regime', severity: 'warning' });
    }
    const presumptive = Number(v.presumptive_turnover) || 0;
    if (presumptive > 30000000) r.push({ fieldId: 'presumptive_turnover', message: 'Sec 44AD limit is ₹3 Crore for digital, ₹2 Crore for cash receipts', severity: 'warning' });
    return r;
  },
  getFieldHelp: (id) => {
    const h: Record<string, string> = {
      tax_regime: 'New regime (default from AY 2024-25) has lower rates but no deductions. Old regime allows 80C, 80D, HRA etc.',
      presumptive_turnover: 'Under Sec 44AD, small businesses with turnover <₹3Cr can declare 6% (digital) or 8% (cash) of turnover as profit.',
    };
    return h[id] ?? null;
  },

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON (ITD format)', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v) {
    return { data: JSON.stringify(v, null, 2), filename: `ITR-IN-${new Date().toISOString().slice(0, 10)}.json`, mimeType: 'application/json' };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://www.incometax.gov.in', submissionMethod: 'manual_upload' as const, apiReady: false }),
  hasSubJurisdictions: () => true,
  getSubJurisdictions: () => INDIAN_STATES,
  supportsCustomFields: () => false,
};

export default inItPlugin;
