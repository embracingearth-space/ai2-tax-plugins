/**
 * Australia Individual Tax Return (ITR) - ai2fin.com
 * Australian Taxation Office (ATO)
 * Reference: https://www.ato.gov.au/individuals-and-families/your-tax-return
 * ARCHITECTURE: Compound-key plugin 'AU-IT' alongside 'AU' (BAS).
 *   Brackets: 0% ($0-$18,200), then $18,201-$45,000 / 30% ($45,001-$135,000) /
 *   37% ($135,001-$190,000) / 45% ($190,001+). Medicare levy: 2%.
 *   First-bracket rate is FY-dependent (legislated cuts): 16% to FY2025-26,
 *   15% from FY2026-27 (1 Jul 2026), 14% from FY2027-28 (1 Jul 2027).
 *   FY: Jul 1 - Jun 30. Annual filing by Oct 31 (self) or May (via agent).
 */

import type {
  TaxFilingPlugin, FormSection, FieldValues, CalculatedFields,
  AggregationMapping, ValidationResult, RoundingConfig, ExportFormat, ExportOutput,
} from '../types';

const TAX_FREE = 18200;

// FY starts 1 July: months Jul-Dec belong to the FY starting that year.
function currentFyStartYear(now = new Date()): number {
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

// Legislated first-bracket cuts: 16% to FY2025-26, 15% FY2026-27, 14% FY2027-28+.
function firstBracketRate(fyStartYear: number): number {
  if (fyStartYear >= 2027) return 0.14;
  if (fyStartYear === 2026) return 0.15;
  return 0.16;
}

function calcAuTax(taxable: number, fyStartYear = currentFyStartYear()): number {
  if (taxable <= TAX_FREE) return 0;
  let tax = 0;
  if (taxable > TAX_FREE) tax += Math.min(taxable - TAX_FREE, 45000 - TAX_FREE) * firstBracketRate(fyStartYear);
  if (taxable > 45000) tax += Math.min(taxable - 45000, 135000 - 45000) * 0.30;
  if (taxable > 135000) tax += Math.min(taxable - 135000, 190000 - 135000) * 0.37;
  if (taxable > 190000) tax += (taxable - 190000) * 0.45;
  return Math.round(tax);
}

const auItPlugin: TaxFilingPlugin = {
  countryCode: 'AU-IT',
  displayName: 'Individual Tax Return (ITR)',
  shortName: 'ITR',
  authority: {
    name: 'ATO',
    fullName: 'Australian Taxation Office',
    portalUrl: 'https://www.ato.gov.au',
    helpUrl: 'https://www.ato.gov.au/individuals-and-families/your-tax-return',
  },
  taxFamily: 'INCOME_TAX',
  isFullPlugin: true,

  getFormSchema(): FormSection[] {
    return [
      {
        id: 'income',
        title: 'Income',
        fields: [
          { id: 'salary_wages', label: 'Salary and wages', type: 'currency', editable: true, required: false, helpText: 'As per payment summary / income statement from employer' },
          { id: 'business_income', label: 'Business income (sole trader)', type: 'currency', editable: true, required: false, autoPopulateFrom: 'income_business', helpText: 'Net profit from your sole trader business' },
          { id: 'interest', label: 'Interest income', type: 'currency', editable: true, required: false },
          { id: 'dividends', label: 'Dividends (unfranked)', type: 'currency', editable: true, required: false },
          { id: 'franked_dividends', label: 'Franked dividends (grossed up)', type: 'currency', editable: true, required: false, helpText: 'Include franking credits as income' },
          { id: 'franking_credits', label: 'Franking credits', type: 'currency', editable: true, required: false },
          { id: 'rental_income', label: 'Net rental income', type: 'currency', editable: true, required: false },
          { id: 'capital_gains', label: 'Net capital gains', type: 'currency', editable: true, required: false, helpText: 'After applying 50% CGT discount if held >12 months' },
          { id: 'other_income', label: 'Other income', type: 'currency', editable: true, required: false },
          { id: 'total_income', label: 'Total assessable income', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'deductions',
        title: 'Deductions',
        fields: [
          { id: 'work_related_car', label: 'Work-related car expenses', type: 'currency', editable: true, required: false, helpText: 'Cents per km (88c/km 2025-26, max 5,000 km) or logbook' },
          { id: 'work_related_travel', label: 'Work-related travel expenses', type: 'currency', editable: true, required: false },
          { id: 'work_related_clothing', label: 'Clothing, laundry, dry-cleaning', type: 'currency', editable: true, required: false },
          { id: 'work_from_home', label: 'Working from home expenses', type: 'currency', editable: true, required: false, helpText: 'Fixed rate: 67c/hour. Or actual cost method.' },
          { id: 'self_education', label: 'Self-education expenses', type: 'currency', editable: true, required: false },
          { id: 'donations', label: 'Gifts and donations', type: 'currency', editable: true, required: false },
          { id: 'tax_agent_fee', label: 'Cost of managing tax affairs', type: 'currency', editable: true, required: false },
          { id: 'income_protection', label: 'Income protection insurance', type: 'currency', editable: true, required: false },
          { id: 'other_deductions', label: 'Other deductions', type: 'currency', editable: true, required: false },
          { id: 'total_deductions', label: 'Total deductions', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'tax_calc',
        title: 'Tax Calculation',
        fields: [
          { id: 'taxable_income', label: 'Taxable income', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'income_tax', label: 'Tax on taxable income', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'medicare_levy', label: 'Medicare levy (2%)', type: 'currency', calculated: true, editable: false, required: true },
          { id: 'medicare_surcharge', label: 'Medicare levy surcharge', type: 'currency', editable: true, required: false, helpText: '1-1.5% if no private health insurance and income >$101,000 single (2025-26)' },
          { id: 'lito', label: 'Low Income Tax Offset (LITO)', type: 'currency', calculated: true, editable: false, required: false, helpText: 'Up to $700 for income ≤$45,000' },
          { id: 'franking_credit_offset', label: 'Franking credit tax offset', type: 'currency', calculated: true, editable: false, required: false },
          { id: 'total_tax', label: 'Total tax liability', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
      {
        id: 'payments',
        title: 'Tax Withheld & Refund',
        fields: [
          { id: 'tax_withheld', label: 'Tax withheld (PAYG from employer)', type: 'currency', editable: true, required: false },
          { id: 'payg_instalments', label: 'PAYG instalments paid', type: 'currency', editable: true, required: false },
          { id: 'balance_due', label: 'Tax payable / refund', type: 'currency', calculated: true, editable: false, required: true },
        ],
      },
    ];
  },

  getFilingPeriods: () => ({ monthly: false, quarterly: false, annual: true, defaultFrequency: 'annual' }),
  getFinancialYearBounds: (y) => ({ start: new Date(y, 6, 1), end: new Date(y + 1, 5, 30) }),

  getTerminology: () => ({
    taxName: 'Income Tax', taxAbbrev: 'IT',
    salesLabel: 'Income', purchasesLabel: 'Deductions',
    outputTaxLabel: 'Tax liability', inputTaxLabel: 'Tax withheld',
  }),

  calculateFields(v: FieldValues): CalculatedFields {
    const salary = Number(v.salary_wages) || 0;
    const business = Number(v.business_income) || 0;
    const interest = Number(v.interest) || 0;
    const dividends = Number(v.dividends) || 0;
    const frankedDiv = Number(v.franked_dividends) || 0;
    const frankingCredits = Number(v.franking_credits) || 0;
    const rental = Number(v.rental_income) || 0;
    const capGains = Number(v.capital_gains) || 0;
    const otherInc = Number(v.other_income) || 0;
    const total_income = salary + business + interest + dividends + frankedDiv + frankingCredits + rental + capGains + otherInc;

    const dedFields = ['work_related_car', 'work_related_travel', 'work_related_clothing', 'work_from_home',
      'self_education', 'donations', 'tax_agent_fee', 'income_protection', 'other_deductions'];
    const total_deductions = dedFields.reduce((s, f) => s + (Number(v[f]) || 0), 0);

    const taxable_income = Math.max(0, total_income - total_deductions);
    const income_tax = calcAuTax(taxable_income);
    const medicare_levy = Math.round(taxable_income * 0.02);
    const medicareSurcharge = Number(v.medicare_surcharge) || 0;

    // LITO: $700 if ≤$45,000, phases out $45,001-$66,667
    let lito = 0;
    if (taxable_income <= 45000) lito = 700;
    else if (taxable_income <= 66667) lito = Math.round(700 - (taxable_income - 45000) * 0.0323);
    lito = Math.max(0, lito);

    const franking_credit_offset = frankingCredits;
    const total_tax = Math.max(0, income_tax + medicare_levy + medicareSurcharge - lito - franking_credit_offset);

    const withheld = Number(v.tax_withheld) || 0;
    const instalments = Number(v.payg_instalments) || 0;
    const balance_due = total_tax - withheld - instalments;

    return { total_income, total_deductions, taxable_income, income_tax, medicare_levy, lito, franking_credit_offset, total_tax, balance_due };
  },

  getAutoPopulateMapping: (): AggregationMapping[] => [
    { fieldId: 'business_income', aggregateKey: 'income_business' },
  ],
  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 0, wholeOnly: true }),

  validateForm(v: FieldValues): ValidationResult[] {
    const r: ValidationResult[] = [];
    const fc = Number(v.franking_credits) || 0;
    const fd = Number(v.franked_dividends) || 0;
    if (fc > 0 && fd === 0) r.push({ fieldId: 'franked_dividends', message: 'Franking credits entered but no franked dividends — verify', severity: 'warning' });
    return r;
  },
  getFieldHelp: () => null,

  getSupportedExportFormats: (): ExportFormat[] => [
    { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],
  async generateExport(v) {
    return { data: JSON.stringify(v, null, 2), filename: `ITR-AU-${new Date().toISOString().slice(0, 10)}.json`, mimeType: 'application/json' };
  },
  getPortalSubmissionInfo: () => ({ portalUrl: 'https://my.gov.au', submissionMethod: 'manual_upload' as const, apiReady: false }),
  hasSubJurisdictions: () => true,
  getSubJurisdictions: () => [
    { code: 'NSW', name: 'New South Wales' }, { code: 'VIC', name: 'Victoria' }, { code: 'QLD', name: 'Queensland' },
    { code: 'SA', name: 'South Australia' }, { code: 'WA', name: 'Western Australia' }, { code: 'TAS', name: 'Tasmania' },
    { code: 'NT', name: 'Northern Territory' }, { code: 'ACT', name: 'Australian Capital Territory' },
  ],
  supportsCustomFields: () => false,
};

export default auItPlugin;
