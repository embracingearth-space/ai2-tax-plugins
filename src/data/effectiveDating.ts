/**
 * Effective-Dated Scheme Resolution — @ai2/tax-plugins
 * embracingearth.space
 *
 * WHY THIS EXISTS: companyTax.ts, studentLoan.ts and superannuation.ts each
 * hold an array of yearly schemes ordered newest-first, and each resolves
 * either an explicit tax-year label or the newest scheme whose window has
 * started as of a date. That resolution logic was duplicated verbatim in all
 * three (a fourth copy lands with every new effective-dated dataset) — one
 * copy here means a bug fix or a new selection rule (e.g. supporting a
 * lookahead window) lands once, not three times in lockstep.
 */

/** The one field every effective-dated scheme array shares. */
export interface EffectiveDated {
  effectiveFrom: string;
}

/**
 * Resolve the applicable scheme from a newest-first array.
 *
 * @param schemes  Ordered newest-first, each with an `effectiveFrom` ISO date.
 * @param opts.taxYear  Explicit label to match via `labelOf`. When given and no
 *   scheme matches, returns undefined — callers must NOT fall back to the
 *   newest scheme silently; an unmatched explicit year is a caller error
 *   (wrong year requested), not "use the latest and hope nobody notices".
 * @param opts.asOf  Date selecting by window when no explicit taxYear is given
 *   (defaults to now). Falls back to the oldest defined scheme if every
 *   `effectiveFrom` is still in the future relative to `asOf`.
 * @param labelOf  Extracts the year-label from a scheme (e.g. `taxYearLabel`).
 *   Omit for datasets with no explicit-year lookup (e.g. company tax rates,
 *   which only resolve by date).
 */
export function resolveEffectiveDated<T extends EffectiveDated>(
  schemes: T[],
  opts: { asOf?: Date; taxYear?: string },
  labelOf?: (scheme: T) => string,
): T | undefined {
  if (opts.taxYear) {
    return labelOf ? schemes.find((s) => labelOf(s) === opts.taxYear) : undefined;
  }
  const asOfTime = (opts.asOf ?? new Date()).getTime();
  return (
    schemes.find((s) => new Date(s.effectiveFrom).getTime() <= asOfTime) ??
    schemes[schemes.length - 1]
  );
}
