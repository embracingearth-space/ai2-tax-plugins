/**
 * coverage() — what this engine actually covers, per capability, with the
 * provenance behind each claim. @ai2/tax-plugins — embracingearth.space
 *
 * WHY THIS EXISTS. The app, the website and every MCP each used to say which
 * countries "have" GST/VAT, income tax, company tax or CGT, from their own
 * hand-kept lists — and those lists drifted from the data and from each other.
 * This is the one answer they read instead.
 *
 * DERIVED, NEVER LISTED. Every entry is computed from the registry that holds
 * the figures: RATE_LEDGER (via activeNationalRows), INCOME_TAX_SCHEMES,
 * COMPANY_TAX_RATES, FI_CAPITAL_INCOME_YEARS and the AU/GB CGT provenance,
 * STUDENT_LOAN_SCHEMES and RETIREMENT_SCHEMES. There is no second list here to
 * forget to update; __tests__/coverage pins the counts to the registries so
 * the manifest cannot claim more than the data holds.
 *
 * `verified` IS A CLAIM ABOUT TODAY. It is TRUE only when the data has a dated
 * citation, says it was confirmed against an official page, AND — for an annual
 * schedule — a set actually covers the tax year `asOf` falls in. A country
 * whose newest income-tax year has run out stays listed (the engine still
 * answers for it) but is reported unverified, because the engine is then
 * serving last year's figures. A consumer that only wants claims it may
 * present as fact filters on `verified`.
 *
 * WHICH DAY. A `YYYY-MM-DD` string is taken as that calendar day everywhere.
 * A `Date` (or no argument, meaning now) is an INSTANT, and for the yearly
 * schedules it is read in each country's own time zone, the same way
 * calcIncomeTax picks its year (localToday(scheme.timeZone)). So at
 * 2026-12-31T22:30Z Finland (already 1 January in Helsinki) is reported
 * against 2027 while the United States is still in 2026, and the manifest
 * never disagrees with the figure the engine would actually serve. Rates that
 * are not yearly (GST/VAT rows, company tax) use the caller's calendar day,
 * the convention of resolveRateRow and getCompanyTaxRate. `asOf` in the
 * result is that caller's day.
 */
import {
  activeNationalRows,
  toYmd,
  INCOME_TAX_SCHEMES,
  COMPANY_TAX_RATES,
  FI_CAPITAL_INCOME_YEARS,
  STUDENT_LOAN_SCHEMES,
  RETIREMENT_SCHEMES,
  incomeTaxSetProvenance,
} from './data';
import { addOneYear } from './data/effectiveDating';
import { AU_CGT_PROVENANCE } from './countries/australiaIncomeTax';
import {
  GB_CGT_ANNUAL_EXEMPT_ROWS,
  GB_CGT_BASIC_RATE_ROWS,
  GB_CGT_HIGHER_RATE_ROWS,
  HOME_RATE_URLS,
  type HomeRateRow,
} from './decisions/homeRuleRates';

export const COVERAGE_CAPABILITIES = ['gstVat', 'incomeTax', 'companyTax', 'cgt', 'studentLoan', 'retirement'] as const;
export type CoverageCapability = (typeof COVERAGE_CAPABILITIES)[number];

export interface CoverageEntry {
  /** ISO 3166-1 alpha-2 country code. */
  code: string;
  /** See the module header: confirmed against an official page, and current on `asOf`. */
  verified: boolean;
  /** YYYY-MM-DD the figures were last read against `sourceUrl`; null when the data records none. */
  citationDate: string | null;
  /** The official page the figures were read on; null when the data records none. */
  sourceUrl: string | null;
  /** For an annual schedule, the tax year serving `asOf`; null when no set covers it. */
  taxYear?: string | null;
  /** What is and is not covered, where the capability is partial (federal only, a rule not a calculator). */
  scope?: string;
  /**
   * Income tax only: the sub-national jurisdictions a caller can add with
   * calcIncomeTax's `options.region` (Canadian provinces and territories, US
   * states and DC, Scotland), each judged like a country — verified only when
   * confirmed on the official page AND its year matches the national year in
   * force on `asOf`.
   */
  regions?: CoverageRegionEntry[];
}

export interface CoverageRegionEntry {
  /** Region code as options.region takes it, e.g. 'ON', 'CA', 'SCT'. */
  code: string;
  name: string;
  verified: boolean;
  citationDate: string | null;
  sourceUrl: string | null;
  /** The regional year serving `asOf`; null when none covers it. */
  taxYear: string | null;
}

export interface CoverageCount {
  /** Countries listed under the capability. */
  countries: number;
  /** Of those, how many are `verified`. */
  verified: number;
}

export type CoverageManifest = { asOf: string; counts: Record<CoverageCapability, CoverageCount> } & Record<CoverageCapability, CoverageEntry[]>;

type Dated = { effectiveFrom: string; taxYearLabel: string };

/** The set covering `ymd` in a newest-first-or-not annual series, or undefined. */
function annualSetFor<T extends Dated>(sets: readonly T[], ymd: string): T | undefined {
  const inForce = [...sets].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)).find((s) => s.effectiveFrom <= ymd);
  // A set covers one year from its start; past that the year is uncovered,
  // even though the resolver would go on answering with this set.
  return inForce && ymd < addOneYear(inForce.effectiveFrom) ? inForce : undefined;
}

const byCode = (a: CoverageEntry, b: CoverageEntry) => a.code.localeCompare(b.code);

/** What the caller asked for: a calendar-day string, or an instant. */
type AsOf = string | Date;

/** The calendar day `asOf` falls on in `timeZone`. A day string is already a day. */
function dayIn(timeZone: string, asOf: AsOf): string {
  if (typeof asOf === 'string') return asOf.slice(0, 10);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(asOf);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Time zones of the yearly schedules that do not carry one themselves. */
const TZ = { FI: 'Europe/Helsinki', GB: 'Europe/London', AU: 'Australia/Sydney' } as const;

function gstVat(ymd: string): CoverageEntry[] {
  return activeNationalRows(ymd)
    .map((r) => ({
      code: r.countryCode,
      verified: r.source.verified && Boolean(r.source.url) && Boolean(r.source.citationDate),
      citationDate: r.source.citationDate || null,
      sourceUrl: r.source.url || null,
      scope: r.taxType === 'NONE' ? 'No national consumption tax (confirmed absence).' : r.taxType,
    }))
    .sort(byCode);
}

function incomeTax(asOf: AsOf): CoverageEntry[] {
  return Object.values(INCOME_TAX_SCHEMES)
    .map((s) => {
      const day = dayIn(s.timeZone, asOf);
      const set = annualSetFor(s.sets, day);
      // Judge the set actually in force: its own provenance first, the scheme's otherwise.
      const prov = set ? incomeTaxSetProvenance(s, set) : null;
      const regions = s.regions
        ? Object.values(s.regions)
            .map((r) => {
              const rs = annualSetFor(r.sets, day);
              return {
                code: r.code,
                name: r.name,
                verified: Boolean(rs && rs.verified && set && rs.taxYearLabel === set.taxYearLabel),
                citationDate: rs?.citationDate ?? null,
                sourceUrl: rs?.source ?? null,
                taxYear: rs?.taxYearLabel ?? null,
              };
            })
            .sort((a, b) => a.code.localeCompare(b.code))
        : undefined;
      return {
        code: s.code,
        verified: Boolean(prov?.verified),
        citationDate: prov?.citationDate ?? s.citationDate,
        sourceUrl: prov?.source ?? s.source,
        taxYear: set?.taxYearLabel ?? null,
        ...(s.region ? { scope: s.region } : {}),
        ...(regions ? { regions } : {}),
      };
    })
    .sort(byCode);
}

function companyTax(ymd: string): CoverageEntry[] {
  return Object.values(COMPANY_TAX_RATES)
    .map((c) => {
      // Not annual: the newest set already started is in force, however old.
      const set = [...c.rates].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)).find((r) => r.effectiveFrom <= ymd);
      return {
        code: c.countryCode,
        verified: Boolean(set?.verified),
        citationDate: set?.citationDate ?? null,
        sourceUrl: set?.source ?? null,
        scope: 'Headline rate only (indicative).',
      };
    })
    .sort(byCode);
}

/** The GB row in force on `ymd` — HomeRateRow series run newest-first with a floor row. */
function gbRow(rows: readonly HomeRateRow[], ymd: string): HomeRateRow | undefined {
  return [...rows].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)).find((r) => r.effectiveFrom <= ymd);
}

/**
 * Capital gains lives in three places, each covering a different amount:
 *  - AU: the discount RULE (AU-IT help text); gains are an input, not computed.
 *  - FI: an actual calculator (finnishCapitalGainTax) over FI_CAPITAL_INCOME_YEARS.
 *  - GB: the individual rates and annual exempt amount (homeRuleRates), used by
 *    the home-space comparison; there is no general GB CGT calculation.
 * US_UNRECAPTURED_1250_MAX_RATE_ROWS is deliberately NOT counted: one maximum
 * rate for depreciation recapture on a home office is not CGT coverage.
 */
function cgt(asOf: AsOf): CoverageEntry[] {
  const out: CoverageEntry[] = [];

  out.push({
    code: 'AU',
    verified: AU_CGT_PROVENANCE.verified,
    citationDate: AU_CGT_PROVENANCE.citationDate,
    sourceUrl: AU_CGT_PROVENANCE.sourceUrl,
    scope: AU_CGT_PROVENANCE.scope,
  });

  const fi = annualSetFor(FI_CAPITAL_INCOME_YEARS.map((y) => ({ ...y, taxYearLabel: y.taxYear })), dayIn(TZ.FI, asOf));
  out.push({
    code: 'FI',
    verified: Boolean(fi?.verified),
    citationDate: fi?.citationDate ?? null,
    sourceUrl: fi?.sources[0]?.url ?? null,
    taxYear: fi?.taxYear ?? null,
    scope: 'Capital gains on disposals by a resident individual: 30%/34% capital income tax, deemed acquisition cost, small-disposals exemption.',
  });

  // GB counts only while every figure it relies on has a verified row in force.
  const gbDay = dayIn(TZ.GB, asOf);
  const gb = [GB_CGT_BASIC_RATE_ROWS, GB_CGT_HIGHER_RATE_ROWS, GB_CGT_ANNUAL_EXEMPT_ROWS].map((rows) => gbRow(rows, gbDay));
  const gbVerified = gb.every((r) => Boolean(r?.verified && r.value !== null && r.readOn));
  const gbReadOn = gb.map((r) => r?.readOn).filter((d): d is string => Boolean(d)).sort();
  out.push({
    code: 'GB',
    verified: gbVerified,
    citationDate: gbVerified ? gbReadOn[0]! : null,
    sourceUrl: HOME_RATE_URLS.gbCgtRates,
    scope: 'Individual CGT rates and annual exempt amount, as used by the home-space comparison. No general CGT calculation.',
  });

  return out.sort(byCode);
}

/**
 * Student loan and retirement schedules carry a source URL per year but no
 * dated citation or verified flag (the rate watch lists them as `undated`), so
 * they are reported unverified rather than promoted on the strength of a
 * comment.
 */
function undatedAnnual<T extends Dated & { source: string }>(info: Record<string, { countryCode: string; schemes: T[] }>, asOf: AsOf): CoverageEntry[] {
  return Object.values(info)
    .map((s) => {
      // Only AU ships these today; any other country falls back to the caller's day.
      const tz = (TZ as Record<string, string>)[s.countryCode];
      const set = annualSetFor(s.schemes, tz ? dayIn(tz, asOf) : toYmd(asOf));
      return { code: s.countryCode, verified: false, citationDate: null, sourceUrl: set?.source ?? null, taxYear: set?.taxYearLabel ?? null };
    })
    .sort(byCode);
}

/**
 * The coverage manifest as of a date (default today).
 *
 * @example
 *   const m = coverage();
 *   m.incomeTax.filter((e) => e.verified).map((e) => e.code); // what may be presented as fact
 *   m.counts.companyTax; // { countries: 6, verified: 6 }
 */
export function coverage(asOf?: string | Date): CoverageManifest {
  // One instant for the whole manifest, so no two capabilities straddle midnight.
  const at: AsOf = asOf ?? new Date();
  const ymd = toYmd(at);
  const lists: Record<CoverageCapability, CoverageEntry[]> = {
    gstVat: gstVat(ymd),
    incomeTax: incomeTax(at),
    companyTax: companyTax(ymd),
    cgt: cgt(at),
    studentLoan: undatedAnnual(STUDENT_LOAN_SCHEMES, at),
    retirement: undatedAnnual(RETIREMENT_SCHEMES, at),
  };
  const counts = Object.fromEntries(
    COVERAGE_CAPABILITIES.map((c) => [c, { countries: lists[c].length, verified: lists[c].filter((e) => e.verified).length }]),
  ) as Record<CoverageCapability, CoverageCount>;
  return { asOf: ymd, ...lists, counts };
}
