/**
 * Tax Rate Reference Data — @ai2/tax-plugins
 * embracingearth.space
 *
 * COUNTRY_TAX_RATES is a flat, "as of now" view DERIVED from the effective-dated
 * RATE_LEDGER — the single source of truth (see ./rateLedger). DO NOT hand-edit
 * rates here: change a rate in the ledger and this view follows automatically.
 *
 * The view is LIVE, not frozen at import: it is recomputed when the calendar day
 * rolls over, so a future-dated rate that becomes effective while a long-running
 * process is up (e.g. an announced increase activating at year-start) is reflected
 * without a restart. The back-compat API (getTaxRateInfo / getStandardTaxRate /
 * detectTaxFamily) and the CountryTaxRateInfo / TaxFamily types are unchanged.
 */
import { activeNationalRows, resolveRateRow, getStandardRateAsOf, toYmd } from './rateLedger';
import type { TaxFamily, RateLedgerRow } from './rateLedger';

export type { TaxFamily } from './rateLedger';

export interface CountryTaxRateInfo {
  countryCode: string;
  countryName: string;
  taxFamily: TaxFamily;
  standardRate: number;
  reducedRate?: number;
  localName?: string;
}

function toInfo(r: RateLedgerRow): CountryTaxRateInfo {
  const info: CountryTaxRateInfo = {
    countryCode: r.countryCode,
    countryName: r.countryName,
    taxFamily: r.taxFamily,
    standardRate: r.standardRate,
    localName: r.localName,
  };
  if (r.reducedRate != null) info.reducedRate = r.reducedRate;
  return info;
}

// Day-memoized live snapshot: recompute at most once per UTC day — i.e. exactly
// when a future-dated row could activate — so the flat view never goes stale in a
// long-running process, without rebuilding on every lookup.
let _cache: { day: string; map: Record<string, CountryTaxRateInfo> } | null = null;
function currentFlatMap(): Record<string, CountryTaxRateInfo> {
  const day = toYmd(new Date());
  if (!_cache || _cache.day !== day) {
    const map: Record<string, CountryTaxRateInfo> = {};
    for (const r of activeNationalRows(day)) map[r.countryCode] = toInfo(r);
    _cache = { day, map };
  }
  return _cache.map;
}

/**
 * Standard and reduced VAT/GST/sales-tax rates by country, as in force today.
 * A live view over RATE_LEDGER — reads, enumeration, and `in` reflect the current
 * day. To change a rate, edit the ledger, not this object.
 */
export const COUNTRY_TAX_RATES: Record<string, CountryTaxRateInfo> = new Proxy(
  {} as Record<string, CountryTaxRateInfo>,
  {
    get: (_t, prop: string | symbol) =>
      typeof prop === 'string' ? currentFlatMap()[prop] : undefined,
    has: (_t, prop: string | symbol) =>
      typeof prop === 'string' ? prop in currentFlatMap() : false,
    ownKeys: () => Reflect.ownKeys(currentFlatMap()),
    getOwnPropertyDescriptor: (_t, prop: string | symbol) => {
      if (typeof prop !== 'string') return undefined;
      const value = currentFlatMap()[prop];
      return value ? { value, enumerable: true, configurable: true } : undefined;
    },
  },
);

/**
 * Get tax rate info for a country, as in force on `asOf` (default: today).
 * Returns undefined if unknown. Resolved live from the ledger.
 */
export function getTaxRateInfo(countryCode: string, asOf?: string | Date): CountryTaxRateInfo | undefined {
  const row = resolveRateRow(countryCode, asOf ?? new Date());
  return row ? toInfo(row) : undefined;
}

/**
 * Get the standard tax rate for a country. Returns 0 if unknown.
 * Pass `asOf` (YYYY-MM-DD or Date) to resolve the rate in force on a past/future
 * date — e.g. the rate that applied during a transaction's tax period. Resolved
 * live, so it always reflects the date given (default: today).
 */
export function getStandardTaxRate(countryCode: string, asOf?: string | Date): number {
  if (asOf !== undefined) return getStandardRateAsOf(countryCode, asOf);
  // Default (today) path: O(1) lookup via the day-memoized view, not a full scan.
  return currentFlatMap()[countryCode.toUpperCase()]?.standardRate ?? 0;
}

/**
 * Detect tax family for a country code (as in force today).
 */
export function detectTaxFamily(countryCode: string): TaxFamily {
  return currentFlatMap()[countryCode.toUpperCase()]?.taxFamily ?? 'SALES_TAX';
}
