/**
 * Tax treatment catalogue — @ai2/tax-plugins
 * ai2fin.com
 *
 * A "treatment" is the per-transaction tax classification a host app stores on a
 * category, transaction, expense or bill (one CanonicalTreatmentCode). Country
 * plugins translate a code into their own vocabulary and say which official
 * boxes it feeds (`getTaxTreatments()`); plugins without a catalogue fall back
 * to the jurisdiction-neutral GENERIC_TREATMENTS below.
 *
 * Contract (shared with ai2-core-app, v1):
 *   Sales:    SALE_STANDARD, SALE_REDUCED, SALE_ZERO_RATED, SALE_EXEMPT, SALE_INPUT_TAXED
 *   Purchase: PURCHASE_STANDARD, PURCHASE_CAPITAL, PURCHASE_REDUCED, PURCHASE_NO_TAX,
 *             PURCHASE_CAPITAL_NO_TAX, PURCHASE_INPUT_TAXED, PURCHASE_PRIVATE,
 *             PURCHASE_REVERSE_CHARGE, PURCHASE_IMPORT
 *   Other:    WAGES, WITHHOLDING, OUT_OF_SCOPE
 *
 * `rate: null` means "the jurisdiction's standard rate at the transaction date"
 * and is deliberately left unresolved here — resolve it with resolveTreatmentRate()
 * against the effective-dated ledger (getStandardRateAsOf) so a mid-period rate
 * change is applied from its effective date rather than retroactively.
 */

import type { CanonicalTreatmentCode, TaxFilingPlugin, TaxTreatmentDefinition } from './types';

/** Every canonical code, in contract order. Used by validation and tests. */
export const CANONICAL_TREATMENT_CODES: readonly CanonicalTreatmentCode[] = [
  'SALE_STANDARD',
  'SALE_REDUCED',
  'SALE_ZERO_RATED',
  'SALE_EXEMPT',
  'SALE_INPUT_TAXED',
  'PURCHASE_STANDARD',
  'PURCHASE_CAPITAL',
  'PURCHASE_REDUCED',
  'PURCHASE_NO_TAX',
  'PURCHASE_CAPITAL_NO_TAX',
  'PURCHASE_INPUT_TAXED',
  'PURCHASE_PRIVATE',
  'PURCHASE_REVERSE_CHARGE',
  'PURCHASE_IMPORT',
  'WAGES',
  'WITHHOLDING',
  'OUT_OF_SCOPE',
] as const;

export function isCanonicalTreatmentCode(code: unknown): code is CanonicalTreatmentCode {
  return typeof code === 'string' && (CANONICAL_TREATMENT_CODES as readonly string[]).includes(code);
}

/**
 * Jurisdiction-neutral catalogue. Labels avoid any one authority's vocabulary;
 * `boxes` is empty because there is no official form to point at — a plugin
 * that knows its form overrides this via getTaxTreatments().
 */
export const GENERIC_TREATMENTS: readonly TaxTreatmentDefinition[] = [
  {
    code: 'SALE_STANDARD',
    label: 'Taxable sale',
    side: 'sale',
    rate: null,
    taxApplies: true,
    creditable: true,
    boxes: [],
    help: 'Sale taxed at the standard rate; tax is included in the price.',
    defaultFor: ['sales', 'services_income'],
  },
  {
    code: 'SALE_REDUCED',
    label: 'Reduced-rate sale',
    side: 'sale',
    rate: null,
    taxApplies: true,
    creditable: true,
    boxes: [],
    help: 'Sale taxed at a reduced rate; tax is included in the price.',
  },
  {
    code: 'SALE_ZERO_RATED',
    label: 'Zero-rated / export sale',
    side: 'sale',
    rate: 0,
    taxApplies: false,
    creditable: true,
    boxes: [],
    help: 'No tax charged (exports and other zero-rated supplies); credits on related purchases are still claimable.',
    defaultFor: ['export_sales'],
  },
  {
    code: 'SALE_EXEMPT',
    label: 'Exempt sale (credits allowed)',
    side: 'sale',
    rate: 0,
    taxApplies: false,
    creditable: true,
    boxes: [],
    help: 'Domestic sale with no tax charged where credits on related purchases remain claimable.',
  },
  {
    code: 'SALE_INPUT_TAXED',
    label: 'Exempt sale (no credits)',
    side: 'sale',
    rate: 0,
    taxApplies: false,
    creditable: false,
    boxes: [],
    help: 'No tax charged and credits on related purchases are NOT claimable (financial supplies including interest, residential rent).',
    defaultFor: ['interest_income', 'residential_rent'],
  },
  {
    code: 'PURCHASE_STANDARD',
    label: 'Taxable purchase',
    side: 'purchase',
    rate: null,
    taxApplies: true,
    creditable: true,
    boxes: [],
    help: 'Non-capital purchase with tax in the price; the credit is claimable.',
  },
  {
    code: 'PURCHASE_CAPITAL',
    label: 'Capital purchase',
    side: 'purchase',
    rate: null,
    taxApplies: true,
    creditable: true,
    boxes: [],
    help: 'Capital (asset) purchase with tax in the price; the credit is claimable.',
    defaultFor: ['equipment', 'vehicles'],
  },
  {
    code: 'PURCHASE_REDUCED',
    label: 'Reduced-rate purchase',
    side: 'purchase',
    rate: null,
    taxApplies: true,
    creditable: true,
    boxes: [],
    help: 'Purchase taxed at a reduced rate; the credit is claimable.',
  },
  {
    code: 'PURCHASE_NO_TAX',
    label: 'Purchase with no tax',
    side: 'purchase',
    rate: 0,
    taxApplies: false,
    creditable: false,
    boxes: [],
    help: 'Purchase with no tax in the price (zero-rated or exempt goods, unregistered suppliers, government fees and charges, bank fees).',
    defaultFor: ['bank_fees', 'government_fees', 'insurance_stamp_duty'],
  },
  {
    code: 'PURCHASE_CAPITAL_NO_TAX',
    label: 'Capital purchase with no tax',
    side: 'purchase',
    rate: 0,
    taxApplies: false,
    creditable: false,
    boxes: [],
    help: 'Capital purchase with no tax in the price.',
  },
  {
    code: 'PURCHASE_INPUT_TAXED',
    label: 'Purchase for exempt (no-credit) sales',
    side: 'purchase',
    rate: null,
    taxApplies: true,
    creditable: false,
    boxes: [],
    help: 'Purchase that relates to making exempt / input-taxed sales; the credit is denied.',
  },
  {
    code: 'PURCHASE_PRIVATE',
    label: 'Private / non-deductible',
    side: 'purchase',
    rate: null,
    taxApplies: true,
    creditable: false,
    boxes: [],
    help: 'Private-use portion or non-income-tax-deductible purchase (entertainment, fines); no credit.',
    defaultFor: ['entertainment', 'fines_penalties'],
  },
  {
    code: 'PURCHASE_REVERSE_CHARGE',
    label: 'Reverse charge',
    side: 'purchase',
    rate: null,
    taxApplies: true,
    creditable: true,
    boxes: [],
    help: 'Imported services where you account for the tax yourself (reported as both output and input tax).',
  },
  {
    code: 'PURCHASE_IMPORT',
    label: 'Imported goods',
    side: 'purchase',
    rate: null,
    taxApplies: true,
    creditable: true,
    boxes: [],
    help: 'Goods imported with tax paid (or deferred) at the border; the credit is claimable.',
  },
  {
    code: 'WAGES',
    label: 'Wages',
    side: 'payroll',
    rate: 0,
    taxApplies: false,
    creditable: false,
    boxes: [],
    help: 'Gross salary and wages. Never a purchase for indirect tax.',
    defaultFor: ['wages', 'salaries'],
  },
  {
    code: 'WITHHOLDING',
    label: 'Tax withheld',
    side: 'payroll',
    rate: 0,
    taxApplies: false,
    creditable: false,
    boxes: [],
    help: 'Tax withheld from wages and other payments, remitted to the authority.',
    defaultFor: ['payg_withholding'],
  },
  {
    code: 'OUT_OF_SCOPE',
    label: 'Out of scope',
    side: 'excluded',
    rate: 0,
    taxApplies: false,
    creditable: false,
    boxes: [],
    help: 'Not a supply: transfers, loan principal, owner drawings and contributions, superannuation, dividends, tax payments, depreciation journals.',
    defaultFor: ['transfers', 'loan_principal', 'owner_drawings', 'superannuation', 'dividends', 'tax_payments'],
  },
];

/**
 * The treatment catalogue for a plugin: its own `getTaxTreatments()` when it
 * has one, otherwise GENERIC_TREATMENTS. `rate: null` entries are returned
 * as-is (standard rate at the transaction date — see resolveTreatmentRate).
 */
export function getTreatmentsForPlugin(plugin: TaxFilingPlugin): TaxTreatmentDefinition[] {
  const own = plugin.getTaxTreatments?.();
  return own && own.length > 0 ? own : [...GENERIC_TREATMENTS];
}

/** Look up one treatment by code in a plugin's catalogue (undefined when absent). */
export function getTreatmentDefinition(
  plugin: TaxFilingPlugin,
  code: CanonicalTreatmentCode,
): TaxTreatmentDefinition | undefined {
  return getTreatmentsForPlugin(plugin).find((t) => t.code === code);
}

/**
 * Resolve a treatment's rate: explicit rate when set, else the supplied
 * standard rate (the caller resolves that against the dated ledger).
 */
export function resolveTreatmentRate(treatment: TaxTreatmentDefinition, standardRate: number): number {
  return treatment.rate ?? standardRate;
}
