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
 * period (before/after a change) and keep historical filings correct — FOR THE
 * PART OF HISTORY A ROW ACTUALLY DATES.
 *
 * THE CAVEAT THAT MATTERS: 71 of the 105 rows carry RATE_FLOOR (2000-01-01) as
 * their effectiveFrom, meaning "known true since at least this anchor," not
 * "became true on this date." Most are annotated in their own `note` as
 * long-standing or stable for decades, but the ledger records no actual change
 * history before that floor for those rows. This is a risk only from the floor
 * ONWARD, not before it: resolveRateRow rejects any date earlier than a row's
 * effectiveFrom, so a query dated before 2000-01-01 resolves to nothing, not
 * to the floor row. A transaction dated on or after the floor but before a
 * real (undated, unrecorded) later change will resolve to the FLOOR-anchored
 * rate, which may not be what was actually charged at that later time.
 *
 * Rows and countries are different counts and are easy to conflate, so each is
 * stated plainly. Of 88 countries, 26 carry at least one genuinely dated row and
 * 62 are floor-only. Separately, 9 countries record an actual TRANSITION - a
 * SERIES (one country + stateProvince + taxType) holding more than one row, so a
 * change is resolvable across it: CA, EC, EE, FI, GH, IL, KZ, RO, RU. Canada is
 * in that list for its federal GST series (7% -> 6% -> 5%), NOT for having two
 * rows: its GST and Ontario HST rows are parallel series and counting them as a
 * transition was the bug this distinction was drawn to fix. The open gap is the
 * 62 floor-only countries; backfilling real pre-2000 or pre-verification change
 * dates for them is a per-country research task, not something to synthesise.
 *
 * NO SERIES HAS A HOLE. Within a series each effectiveTo is the next
 * effectiveFrom, so every date inside a series resolves to exactly one row. This
 * is asserted, because it did not used to hold and the failure was silent:
 * Ghana's rows ran 12.5% to 2023-01-01 and then 15% from 2026-01-01, and every
 * date in between resolved to NO row - which getStandardRateAsOf renders as 0,
 * indistinguishable from a country that genuinely levies nothing. The missing
 * Act 1087 row (15% from 1 January 2023) now closes it.
 *
 * Note the converse is NOT a hole and must not be "fixed" into one: a series may
 * legitimately START late, because the tax itself started late. Ontario HST
 * begins 1 July 2010 and nothing precedes it, since before that Ontario charged
 * federal GST plus a provincial RST this ledger does not model. That row used to
 * run from the floor and so claimed 13% HST for a decade in which the tax did
 * not exist - a worse error than a stale rate, and one a continuity check cannot
 * see, which is why the start dates are pinned separately.
 *
 * EVERY ROW NAMES AN AUTHORITY AND A URL, asserted. `verified` is a separate and
 * stricter claim - that the cited page was actually read and agreed.
 *
 * ISRAEL IS FIVE ROWS, NOT TWO, and finding the other three is why. The 2000
 * floor row originally carried 17% all the way to a 2025-01-01 rise, cited to
 * a Knesset record that only actually speaks to the 2025 change - reading
 * "17%" out of that citation and projecting it back to 2000 was itself an
 * overclaim, the same species of error as Ghana's missing row and Ecuador's
 * truncated window, just one layer further in: not a wrong RATE but a wrong
 * CONFIDENCE about how long the rate held. The ITA's own pages (read via a
 * real browser after automated fetches returned empty for two and 403'd for
 * the third) show a rise to 17% on 1 September 2012, a rise to 18% on
 * 2 June 2013, and a cut back to 17% on 1 October 2015 - three real, dated,
 * verified rows, now all present.
 *
 * That still leaves a genuine gap, narrower than before but not closed: the
 * 2000-2012-09-01 floor row is NOT verified, on purpose. The ITA's OWN 2005
 * page (already cited elsewhere in this ledger) records a 17%->16.5% cut on
 * 1 September 2005 with a further cut to 16% PLANNED for 2007; secondary
 * sources additionally describe a 15.5%<->16% round-trip around the 2009
 * financial crisis. None of those intervening boundaries are dated precisely
 * enough here to split out, so the floor row states its best-known rate
 * (16%, confirmed only as the rate immediately before the 2012 rise) rather
 * than a rate verified back to 2000. This is the one closed row this ledger
 * cannot currently mark verified honestly, and it is named explicitly in
 * __tests__/rateLedger rather than silently exempted, so a SECOND such gap
 * cannot appear unnoticed.
 *
 * These figures are asserted in __tests__/rateLedger. The assertions derive
 * their values from RATE_LEDGER and never read this comment, so they catch the
 * ledger changing under the paragraph - not the paragraph being edited to
 * disagree with itself. Change one, change both.
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
  // LOCAL calendar parts, never toISOString(). A Date built from local parts —
  // new Date(2023, 6, 1), the first day of an Australian income year — is
  // 2023-06-30T14:00Z in Sydney, and toISOString() would key it as 30 June.
  // That is the wrong side of every boundary this ledger exists to resolve:
  // the rate row that started on 1 July, the write-off limit that started on
  // 1 July, the financial year that started on 1 July. The caller's Date
  // means the day they see on their calendar; this reads that day back.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
