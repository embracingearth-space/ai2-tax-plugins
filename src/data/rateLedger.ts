/**
 * Effective-dated tax-rate ledger — TYPES + RESOLVER. embracingearth.space
 *
 * This is the SINGLE SOURCE OF TRUTH for consumption-tax (VAT/GST/sales-tax) rates.
 * The row DATA lives in ./rateLedger.data (RATE_LEDGER); this module owns the types
 * and the date-aware resolution logic. Every consumer (the flat COUNTRY_TAX_RATES
 * view, the core-app DB seed, the client fallback) DERIVES from here so they cannot
 * drift.
 *
 * Effective-dating: a rate is valid over the half-open interval
 * [effectiveFrom, effectiveTo). A change is NEVER an in-place edit — the prior row
 * gets effectiveTo set and a NEW dated row is appended. Announced future changes are
 * added ahead of time (future effectiveFrom) and activate automatically by date.
 * This is what lets the app resolve the rate that applied DURING a transaction's tax
 * period (before/after a change) and keep historical filings correct.
 */
import { RATE_LEDGER } from './rateLedger.data';

export type TaxFamily = 'GST' | 'VAT' | 'SALES_TAX' | 'HYBRID' | 'NONE';

/** Provenance for a rate row — the audit trail behind a tax number. */
export interface RateSource {
  /** Official authority / dataset the rate was verified against. */
  authority: string;
  /** Official URL (https). Empty string when not yet backfilled. */
  url: string;
  /** YYYY-MM-DD the rate was last verified against `url`. */
  citationDate: string;
  /** True only when verified against an https authority source. */
  verified: boolean;
  /** Free-text context (recent reforms, sectoral caveats, etc.). */
  note?: string;
}

/** One effective-dated rate row. Columns mirror the core-app CountryTaxRate table. */
export interface RateLedgerRow {
  countryCode: string;
  countryName: string;
  /** DB vocabulary: GST | VAT | HST | SST | SALES_TAX | CONSUMPTION_TAX | ICMS | IVA | NONE | … */
  taxType: string;
  /** Local short name, e.g. 'GST', 'TVA', 'ALV', 'НДС'. */
  taxName: string;
  /** Coarse family, used by the flat reference view. */
  taxFamily: TaxFamily;
  /** Human label for the flat reference view. */
  localName: string;
  standardRate: number;
  reducedRate: number | null;
  zeroRate: number;
  /** Sub-national jurisdiction (US state / CA province), or null for the national row. */
  stateProvince: string | null;
  combinedRate: number | null;
  description: string;
  /** YYYY-MM-DD, inclusive. */
  effectiveFrom: string;
  /** YYYY-MM-DD, exclusive; null = still in force. */
  effectiveTo: string | null;
  source: RateSource;
}

export { RATE_LEDGER };

/** Earliest coverage date — rows with no known prior change start here. */
export const RATE_FLOOR = '2000-01-01';

/**
 * Normalize a date input to a YYYY-MM-DD calendar day.
 * A Date is read in UTC so comparison never drifts a day at the timezone boundary.
 */
export function toYmd(d: string | Date): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export interface ResolveOptions {
  /** Resolve a sub-national row (e.g. 'ON'); defaults to the national row. */
  stateProvince?: string | null;
  /** Disambiguate when a country has more than one taxType. */
  taxType?: string;
}

/**
 * Resolve the rate row in force for `countryCode` on `asOf` (YYYY-MM-DD string or
 * Date; defaults to today). Resolution is purely by the date window
 * [effectiveFrom, effectiveTo) — never "the latest row". Returns the national row
 * unless `opts.stateProvince` is given. Undefined if no row covers the date.
 */
export function resolveRateRow(
  countryCode: string,
  asOf?: string | Date,
  opts: ResolveOptions = {},
): RateLedgerRow | undefined {
  const cc = countryCode.toUpperCase();
  const ymd = toYmd(asOf ?? new Date());
  const state = opts.stateProvince ?? null;
  let best: RateLedgerRow | undefined;
  for (const r of RATE_LEDGER) {
    if (r.countryCode !== cc) continue;
    if ((r.stateProvince ?? null) !== state) continue;
    if (opts.taxType && r.taxType !== opts.taxType) continue;
    if (r.effectiveFrom > ymd) continue;
    if (r.effectiveTo != null && ymd >= r.effectiveTo) continue;
    if (!best || r.effectiveFrom > best.effectiveFrom) best = r;
  }
  return best;
}

/** Standard rate for a country on a date (0 if unknown). Date-aware. */
export function getStandardRateAsOf(countryCode: string, asOf?: string | Date): number {
  return resolveRateRow(countryCode, asOf)?.standardRate ?? 0;
}

/**
 * All national (stateProvince null) rows active on `asOf`, one per country.
 * Used to derive the flat, as-of-today reference table. Sub-national rows excluded.
 */
export function activeNationalRows(asOf?: string | Date): RateLedgerRow[] {
  const ymd = toYmd(asOf ?? new Date());
  const byCountry = new Map<string, RateLedgerRow>();
  for (const r of RATE_LEDGER) {
    if ((r.stateProvince ?? null) !== null) continue;
    if (r.effectiveFrom > ymd) continue;
    if (r.effectiveTo != null && ymd >= r.effectiveTo) continue;
    const existing = byCountry.get(r.countryCode);
    if (!existing || r.effectiveFrom > existing.effectiveFrom) byCountry.set(r.countryCode, r);
  }
  return [...byCountry.values()];
}
