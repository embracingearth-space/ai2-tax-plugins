/**
 * India Income Tax Return (ITR-4 Sugam / ITR-1 Sahaj) - ai2fin.com
 * Income Tax Department / Central Board of Direct Taxes (CBDT)
 * Reference: https://www.incometax.gov.in
 * ARCHITECTURE: Compound-key plugin 'IN-IT' alongside 'IN' (GSTR-3B).
 *   Two regimes — slabs current for FY2025-26 AND FY2026-27 (Budget 2026
 *   made no changes):
 *   OLD: 0% (₹0-2.5L), 5% (₹2.5-5L), 20% (₹5-10L), 30% (₹10L+) with
 *     deductions (80C, 80D, HRA, etc.); §87A rebate ₹12,500 if ≤₹5L.
 *   NEW (default): 0% (₹0-4L), 5% (₹4-8L), 10% (₹8-12L), 15% (₹12-16L),
 *     20% (₹16-20L), 25% (₹20-24L), 30% (₹24L+).
 *     §87A rebate ₹60,000 => zero tax up to ₹12L taxable (+ marginal relief).
 *   STANDARD DEDUCTION IS A SALARY DEDUCTION, NOT A PERSONAL ALLOWANCE:
 *     ₹75,000 (new) / ₹50,000 (old), taken from salary or pension income only
 *     and never more than that income (s.16(ia) of the 1961 Act, s.19 of the
 *     Income-tax Act 2025). A freelancer or business owner with no salary gets
 *     none — giving it to them understated their tax by up to ₹75,000 of income.
 *   PRESUMPTIVE INCOME (s.58 of the Income-tax Act 2025, formerly 44AD/44ADA):
 *     business — 6% of turnover received by banking/digital modes + 8% of the
 *     rest, turnover up to ₹2Cr (₹3Cr when cash is ≤5%); profession — 50% of
 *     gross receipts, up to ₹50L (₹75L when cash is ≤5%).
 *   SURCHARGE on total income above ₹50L/₹1Cr/₹2Cr/₹5Cr at 10/15/25/25% (new)
 *     or 10/15/25/37% (old), with marginal relief at each threshold.
 *   NOT MODELLED: special-rate income (equity capital gains, lottery) is taxed
 *     here at slab rates; the field help says so.
 *   FY: Apr 1 - Mar 31. Filing deadline: Jul 31 (non-audit), Oct 31 (audit).
 *   Advance tax: quarterly (Jun 15, Sep 15, Dec 15, Mar 15).
 */

import { toCsv } from '../exportUtils';

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
  SubJurisdiction,
} from '../types';

function calcOldRegime(taxable: number): number {
  if (taxable <= 250000) return 0;
  let tax = 0;
  if (taxable > 250000) { tax += Math.min(taxable - 250000, 250000) * 0.05; }
  if (taxable > 500000) { tax += Math.min(taxable - 500000, 500000) * 0.20; }
  if (taxable > 1000000) { tax += (taxable - 1000000) * 0.30; }
  // Section 87A (old regime): rebate up to ₹12,500 if taxable ≤ ₹5L
  if (taxable <= 500000) { tax = Math.max(0, tax - 12500); }
  return Math.round(tax);
}

function calcNewRegime(taxable: number): number {
  if (taxable <= 400000) return 0;
  let tax = 0;
  const slabs = [
    [400000, 800000, 0.05], [800000, 1200000, 0.10], [1200000, 1600000, 0.15],
    [1600000, 2000000, 0.20], [2000000, 2400000, 0.25], [2400000, Infinity, 0.30],
  ] as const;
  for (const [lower, upper, rate] of slabs) {
    if (taxable > lower) {
      tax += Math.min(taxable - lower, upper - lower) * rate;
    }
  }
  if (taxable <= 1200000) {
    // Section 87A: rebate up to ₹60,000 => zero tax for taxable ≤ ₹12L
    tax = Math.max(0, tax - 60000);
  } else {
    // Marginal relief just above ₹12L: tax capped at the excess over ₹12L
    tax = Math.min(tax, taxable - 1200000);
  }
  return Math.round(tax);
}

/** Standard deduction cap by regime — applied to salary/pension income only. */
const STANDARD_DEDUCTION = { new: 75000, old: 50000 } as const;

/** Deemed-profit rates under the presumptive scheme (s.58, Income-tax Act 2025). */
const PRESUMPTIVE_RATE = { digitalTurnover: 0.06, otherTurnover: 0.08, professionalReceipts: 0.5 } as const;

/** Surcharge thresholds on total income, highest first. */
const SURCHARGE_THRESHOLDS = [50000000, 20000000, 10000000, 5000000] as const;

function surchargeRate(taxable: number, regime: 'new' | 'old'): number {
  if (taxable > 50000000) return regime === 'old' ? 0.37 : 0.25;
  if (taxable > 20000000) return 0.25;
  if (taxable > 10000000) return 0.15;
  if (taxable > 5000000) return 0.10;
  return 0;
}

/**
 * Surcharge with marginal relief: crossing a threshold may not cost more in
 * tax + surcharge than the income above that threshold. Without it, ₹1 over
 * ₹50L would add ~₹1.3L of surcharge.
 */
function surchargeWithRelief(taxable: number, regime: 'new' | 'old', slabTax: (n: number) => number): number {
  const rate = surchargeRate(taxable, regime);
  if (rate === 0) return 0;
  const tax = slabTax(taxable);
  const threshold = SURCHARGE_THRESHOLDS.find((t) => taxable > t) as number;
  const totalAtThreshold = slabTax(threshold) * (1 + surchargeRate(threshold, regime));
  const reliefCap = totalAtThreshold + (taxable - threshold) - tax;
  return Math.max(0, Math.min(tax * rate, reliefCap));
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
          { id: 'salary_income', label: 'Income from salary or pension', type: 'currency', editable: true, required: false, helpText: 'Gross salary or pension as per Form 16. The standard deduction comes off this income only.' },
          { id: 'business_income', label: 'Income from business/profession (actual profit)', type: 'currency', editable: true, required: false, autoPopulateFrom: 'income_business', helpText: 'Profit worked out from your books. If you use presumptive taxation, enter your receipts in the presumptive fields below instead — or enter your declared profit here if it is higher than the presumptive figure, and leave those fields empty. No standard deduction applies to this income.' },
          { id: 'presumptive_turnover_digital', label: 'Presumptive business turnover received digitally (6%)', type: 'currency', editable: true, required: false, helpText: 'Turnover of an eligible business received by account-payee cheque or draft, bank transfer, UPI or another electronic mode during the year or by the return due date. 6% is deemed profit (s.58 of the Income-tax Act 2025, formerly 44AD).' },
          { id: 'presumptive_turnover', label: 'Presumptive business turnover received in cash or other modes (8%)', type: 'currency', editable: true, required: false, helpText: 'The rest of the presumptive business turnover, including cash. 8% is deemed profit (s.58, formerly 44AD).' },
          { id: 'professional_receipts', label: 'Presumptive gross receipts from a profession (50%)', type: 'currency', editable: true, required: false, helpText: 'Gross receipts of a specified profession (e.g. legal, medical, engineering, architecture, accountancy, technical consultancy, interior decoration, information technology) before expenses, platform fees and TDS. 50% is deemed profit (s.58, formerly 44ADA).' },
          { id: 'presumptive_income', label: 'Deemed presumptive profit', type: 'currency', calculated: true, editable: false, required: false },
          { id: 'house_property_income', label: 'Income from house property', type: 'currency', editable: true, required: false, helpText: 'Rental income minus 30% standard deduction, minus home loan interest' },
          { id: 'capital_gains', label: 'Capital gains', type: 'currency', editable: true, required: false, helpText: 'Taxed here at your slab rates. Special rates for listed equity and equity-fund gains are not modelled — check those separately.' },
          { id: 'other_sources', label: 'Income from other sources', type: 'currency', editable: true, required: false, helpText: 'Interest, dividends, etc. Lottery and similar winnings are taxed at a flat 30% and are not modelled here.' },
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
          { id: 'standard_deduction', label: 'Standard deduction', type: 'currency', calculated: true, editable: false, required: true, helpText: 'Salary or pension only: ₹75,000 (new regime) or ₹50,000 (old regime), never more than the salary itself. Business, professional and other income get no standard deduction.' },
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
    const regime: 'new' | 'old' = String(v.tax_regime || 'new') === 'old' ? 'old' : 'new';
    const salary = Number(v.salary_income) || 0;
    const business = Number(v.business_income) || 0;
    const house = Number(v.house_property_income) || 0;
    const capGains = Number(v.capital_gains) || 0;
    const otherSrc = Number(v.other_sources) || 0;

    // Presumptive (s.58): 6% of digitally received business turnover, 8% of
    // the rest, 50% of a profession's gross receipts.
    const digitalTurnover = Number(v.presumptive_turnover_digital) || 0;
    const otherTurnover = Number(v.presumptive_turnover) || 0;
    const professionalReceipts = Number(v.professional_receipts) || 0;
    const presumptive_income = Math.round(
      digitalTurnover * PRESUMPTIVE_RATE.digitalTurnover
      + otherTurnover * PRESUMPTIVE_RATE.otherTurnover
      + professionalReceipts * PRESUMPTIVE_RATE.professionalReceipts,
    );
    const totalBusiness = business + presumptive_income;

    const gross_total_income = salary + totalBusiness + house + capGains + otherSrc;

    // Standard deduction: from salary/pension only, never more than it.
    const standard_deduction = Math.min(Math.max(0, salary), STANDARD_DEDUCTION[regime]);

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

    const slabTax = regime === 'new' ? calcNewRegime : calcOldRegime;
    const tax_on_income = slabTax(taxable_income);

    // Surcharge (new regime tops out at 25%, old at 37%) with marginal relief.
    const surcharge = Math.round(surchargeWithRelief(taxable_income, regime, slabTax));

    const cess = Math.round((tax_on_income + surcharge) * 0.04);
    const total_tax = tax_on_income + surcharge + cess;

    const tds = Number(v.tds) || 0;
    const advanceTax = Number(v.advance_tax) || 0;
    const selfAssess = Number(v.self_assessment_tax) || 0;
    const balance_due = total_tax - tds - advanceTax - selfAssess;

    return {
      presumptive_income, gross_total_income, standard_deduction, total_deductions, taxable_income,
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
    // Presumptive business turnover: ₹2Cr, raised to ₹3Cr when cash (the
    // non-digital part) is no more than 5% of it.
    const digital = Number(v.presumptive_turnover_digital) || 0;
    const other = Number(v.presumptive_turnover) || 0;
    const turnover = digital + other;
    const turnoverLimit = turnover > 0 && other <= turnover * 0.05 ? 30000000 : 20000000;
    if (turnover > turnoverLimit) {
      r.push({
        fieldId: other > 0 ? 'presumptive_turnover' : 'presumptive_turnover_digital',
        message: turnoverLimit === 30000000
          ? 'Presumptive business turnover is above ₹3 crore — the presumptive scheme (s.58, formerly 44AD) is not available'
          : 'Presumptive business turnover is above ₹2 crore — the limit rises to ₹3 crore only when cash receipts are 5% or less',
        severity: 'warning',
      });
    }
    // Profession: ₹50L, raised to ₹75L when cash is ≤5% — the form does not
    // split a profession's receipts by mode, so above ₹50L it can only ask.
    const professional = Number(v.professional_receipts) || 0;
    if (professional > 7500000) {
      r.push({ fieldId: 'professional_receipts', message: 'Professional receipts are above ₹75 lakh — the presumptive scheme (s.58, formerly 44ADA) is not available', severity: 'warning' });
    } else if (professional > 5000000) {
      r.push({ fieldId: 'professional_receipts', message: 'Above ₹50 lakh the presumptive scheme for professions applies only when cash receipts are 5% or less of gross receipts', severity: 'info' });
    }
    return r;
  },
  getFieldHelp: (id) => {
    const h: Record<string, string> = {
      tax_regime: 'New regime (default from AY 2024-25) has lower rates but no deductions. Old regime allows 80C, 80D, HRA etc.',
      presumptive_turnover_digital: 'Under the presumptive scheme (s.58 of the Income-tax Act 2025, formerly 44AD), 6% of turnover received through banking or digital modes is deemed profit. Turnover limit ₹2 crore, or ₹3 crore when cash receipts are 5% or less.',
      presumptive_turnover: 'Under the presumptive scheme (s.58, formerly 44AD), 8% of turnover received in cash or other non-digital modes is deemed profit.',
      professional_receipts: 'Under the presumptive scheme for professions (s.58, formerly 44ADA), 50% of gross receipts is deemed profit. Limit ₹50 lakh, or ₹75 lakh when cash receipts are 5% or less.',
      standard_deduction: 'The standard deduction is a deduction from salary or pension income. Freelance, business and professional income does not get it.',
    };
    return h[id] ?? null;
  },

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v: FieldValues, format: string): Promise<ExportOutput> {
    if (format === 'csv') return toCsv(v, `ITR-IN-${new Date().toISOString().slice(0, 10)}`);
    return {
      data: JSON.stringify(v, null, 2),
      filename: `ITR-IN-${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/json',
    };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://www.incometax.gov.in', submissionMethod: 'manual_upload' as const, apiReady: false }),
  hasSubJurisdictions: () => true,
  getSubJurisdictions: () => INDIAN_STATES,
  supportsCustomFields: () => false,
};

export default inItPlugin;
