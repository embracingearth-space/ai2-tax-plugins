/**
 * Rate Watch — scheduled health checks over the rate ledger. embracingearth.space
 *
 * Pure analysis (no network, no I/O) so it is deterministic and unit-testable. A
 * scheduled GitHub Action runs this and opens a human-review issue when it finds
 * anything worth a person's eyes. It NEVER changes a rate — detection prompts a
 * human; the human edits the ledger. Tax rates are a liability artifact, so nothing
 * here auto-publishes.
 *
 * What it surfaces:
 *  - unverified current rows (missing authority citation)
 *  - stale citations (a verified rate not re-checked for a long time)
 *  - scheduled rows that just activated (confirm downstream picked them up)
 *  - upcoming (future-dated) changes (FYI / ensure they will seed)
 *  - coverage gaps (a series that ended in the past with no successor → no live rate)
 *  - a per-country authority checklist (for the quarterly manual eyeball)
 *  - per-unit deduction rates (analyzeDeductionRates, below): a current
 *    income year with no verified row, stale citations, upcoming rows
 */
import { RATE_LEDGER, activeNationalRows, isRateIndicative, toYmd, INCOME_TAX_SCHEMES, RETIREMENT_SCHEMES, STUDENT_LOAN_SCHEMES, COMPANY_TAX_RATES, FI_CAPITAL_INCOME_YEARS } from './data';
import type { RateLedgerRow } from './data';
import { addOneYear } from './data/effectiveDating';
import { CAPITAL_GAINS_RULES } from './data/capitalGains';

import { AU_CENTS_PER_KM_ROWS, AU_WFH_FIXED_RATE_ROWS, auIncomeYear, formatAuCents } from './countries/australiaDeductions';
import { AU_INSTANT_ASSET_WRITE_OFF_ROWS } from './countries/australiaDepreciation';
import {
  GB_CGT_ANNUAL_EXEMPT_ROWS,
  GB_CGT_BASIC_RATE_ROWS,
  GB_CGT_HIGHER_RATE_ROWS,
  US_HOME_OFFICE_RECOVERY_YEARS_ROWS,
  US_UNRECAPTURED_1250_MAX_RATE_ROWS,
  GB_RENT_A_ROOM_ROWS,
  NZ_BOARDER_STANDARD_COST_ROWS,
  NZ_SQUARE_METRE_RATE_ROWS,
  US_SIMPLIFIED_METHOD_ROWS,
  gbTaxYear,
  nzIncomeYear,
  usTaxYear,
  type HomeRateRow,
} from './decisions/homeRuleRates';

export interface RateWatchOptions {
  /** A verified citation older than this many days is flagged stale. Default 365. */
  staleAfterDays?: number;
  /** A row whose effectiveFrom landed within this many days is "recently activated". Default 45. */
  activatedWithinDays?: number;
}

export interface RateWatchFindings {
  asOf: string;
  unverified: Array<{ countryCode: string; countryName: string; reason: string }>;
  staleCitations: Array<{ countryCode: string; citationDate: string; ageDays: number }>;
  /** `indicative: true` marks a rate that must not be presented as fact (`isRateIndicative`). */
  recentlyActivated: Array<{ countryCode: string; standardRate: number; effectiveFrom: string; indicative?: true }>;
  upcomingChanges: Array<{ countryCode: string; standardRate: number; effectiveFrom: string; indicative?: true }>;
  coverageGaps: Array<{ countryCode: string; taxType: string; stateProvince: string | null; endedOn: string }>;
  reviewChecklist: Array<{ countryCode: string; countryName: string; standardRate: number; authority: string; url: string; indicative?: true }>;
}

const DAY_MS = 86_400_000;

/** Whole days from `from` to `to` (both YYYY-MM-DD), using UTC midnight. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS);
}

/** `{ indicative: true }` for a rate that must not be read as fact, else nothing. */
const indicativeMark = (r: RateLedgerRow): { indicative?: true } => (isRateIndicative(r) ? { indicative: true } : {});

const groupKey = (r: RateLedgerRow) => `${r.countryCode}|${r.taxType}|${r.stateProvince ?? ''}`;

/** Analyze the ledger as of a date and return everything worth a human's attention. */
export function analyzeLedger(asOf?: string | Date, opts: RateWatchOptions = {}): RateWatchFindings {
  const today = toYmd(asOf ?? new Date());
  const staleAfterDays = opts.staleAfterDays ?? 365;
  const activatedWithinDays = opts.activatedWithinDays ?? 45;

  const findings: RateWatchFindings = {
    asOf: today,
    unverified: [],
    staleCitations: [],
    recentlyActivated: [],
    upcomingChanges: [],
    coverageGaps: [],
    reviewChecklist: [],
  };

  // current national rows: verification + staleness + review checklist.
  // includeIndicative: a country whose rate is only indicative is hidden from
  // the flat view, which is exactly why it must still reach a human here.
  for (const r of activeNationalRows(today, { includeIndicative: true })) {
    if (!r.source.verified) {
      findings.unverified.push({
        countryCode: r.countryCode,
        countryName: r.countryName,
        reason: isRateIndicative(r)
          ? 'rate is indicative (placeholder, partial, low-confidence or conflicting) - not served as fact'
          : r.source.url ? 'not verified against authority' : 'no authority url',
      });
    } else {
      const ageDays = daysBetween(r.source.citationDate, today);
      if (ageDays > staleAfterDays) {
        findings.staleCitations.push({ countryCode: r.countryCode, citationDate: r.source.citationDate, ageDays });
      }
    }
    // Recently-activated detection runs for ALL current rows, verified or not — a
    // scheduled change that just took effect matters regardless of citation status.
    const age = daysBetween(r.effectiveFrom, today);
    if (age >= 0 && age <= activatedWithinDays && r.effectiveFrom !== '2000-01-01') {
      findings.recentlyActivated.push({ countryCode: r.countryCode, standardRate: r.standardRate, effectiveFrom: r.effectiveFrom, ...indicativeMark(r) });
    }
    findings.reviewChecklist.push({
      countryCode: r.countryCode,
      countryName: r.countryName,
      standardRate: r.standardRate,
      authority: r.source.authority,
      url: r.source.url,
      ...indicativeMark(r),
    });
  }

  // future-dated rows (announced changes not yet in force)
  for (const r of RATE_LEDGER) {
    if (r.effectiveFrom > today) {
      findings.upcomingChanges.push({ countryCode: r.countryCode, standardRate: r.standardRate, effectiveFrom: r.effectiveFrom, ...indicativeMark(r) });
    }
  }

  // coverage gaps: a series whose latest row already ended (effectiveTo in the past)
  const groups = new Map<string, RateLedgerRow[]>();
  for (const r of RATE_LEDGER) {
    const g = groupKey(r);
    const arr = groups.get(g) ?? [];
    arr.push(r);
    groups.set(g, arr);
  }
  for (const rows of groups.values()) {
    const latest = rows.reduce((a, b) => (a.effectiveFrom >= b.effectiveFrom ? a : b));
    if (latest.effectiveTo != null && latest.effectiveTo <= today) {
      findings.coverageGaps.push({
        countryCode: latest.countryCode,
        taxType: latest.taxType,
        stateProvince: latest.stateProvince,
        endedOn: latest.effectiveTo,
      });
    }
  }

  findings.reviewChecklist.sort((a, b) => a.countryCode.localeCompare(b.countryCode));
  findings.upcomingChanges.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEDUCTION RATES — per-unit and threshold figures a return quotes back
//
// The GST/VAT ledger fails loudly when neglected (a series ends → coverage gap).
// Deduction rates fail the other way: the rows are effective-dated by income
// year, a year with no published rate is a `null, verified: false` row, and the
// lookup correctly refuses to quote a number for it. That is safe but invisible
// — nobody learns the authority has since published. So this watches:
//
//  - the row in force today with no verified figure (the CURRENT income year
//    has no rate yet — someone should check whether it has been published)
//  - a verified current row whose citation is older than `staleAfterDays`
//  - rows that start in the future (FYI: announced, or a placeholder year)
//
// Same contract as analyzeLedger(): pure, deterministic, never changes a rate.
// Only the row in force is judged; history is not re-litigated every week.
// ─────────────────────────────────────────────────────────────────────────────

/** One effective-dated row in the shape this analysis reads. */
export interface DeductionWatchRow {
  effectiveFrom: string;
  value: number | null;
  verified: boolean;
  sourceUrl?: string | null;
  readOn?: string | null;
  /** YYYY-MM-DD by which a person must look at the row again. Past it, while the row is in force, it is flagged. */
  reviewBy?: string | null;
}

/** A watched series. Tests pass fixtures; production uses shippedDeductionSeries(). */
export interface DeductionSeries {
  /** Stable key, e.g. 'AU.workFromHomeFixedRate'. */
  series: string;
  countryCode: string;
  /** Human label for the report. */
  label: string;
  /** The file a human edits to act on a finding. */
  file: string;
  /** Income-year label for a YYYY-MM-DD day (the report names the year, not a date). */
  incomeYearOf: (ymd: string) => string;
  /** A value as the report prints it. */
  format: (value: number) => string;
  rows: DeductionWatchRow[];
}

type DeductionId = { series: string; countryCode: string; label: string; incomeYear: string; file: string };

export interface DeductionWatchFindings {
  asOf: string;
  /** The row in force has no verified figure, or cannot be staleness-checked. Actionable. */
  unverifiedCurrent: Array<DeductionId & { effectiveFrom: string; reason: string }>;
  /** The row in force is verified, but its citation is older than the threshold. Actionable. */
  staleCitations: Array<DeductionId & { readOn: string; ageDays: number; sourceUrl: string }>;
  /** Rows that start after asOf. FYI — `value` is null for a year with nothing published. */
  upcoming: Array<DeductionId & { effectiveFrom: string; value: string | null; verified: boolean }>;
  /** The row in force is past its `reviewBy` date: nobody has confirmed it since. Actionable; the freshness test fails too. */
  pastReviewBy?: Array<DeductionId & { effectiveFrom: string; reviewBy: string; daysPast: number; sourceUrl: string | null }>;
}

const auYear = (ymd: string) => auIncomeYear(ymd).label;
const aud = (n: number) => `$${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const AU_DEDUCTIONS_FILE = 'src/countries/australiaDeductions.ts';

/** Every deduction-rate series the package ships, in the shape analyzeDeductionRates() reads. */
export function shippedDeductionSeries(): DeductionSeries[] {
  return [
    {
      series: 'AU.workFromHomeFixedRate',
      countryCode: 'AU',
      label: 'Working from home fixed rate',
      file: AU_DEDUCTIONS_FILE,
      incomeYearOf: auYear,
      format: (v) => formatAuCents(v, 'per work hour'),
      rows: AU_WFH_FIXED_RATE_ROWS.map((r) => ({ effectiveFrom: r.effectiveFrom, value: r.rate, verified: r.verified, sourceUrl: r.sourceUrl, readOn: r.readOn, reviewBy: r.reviewBy ?? null })),
    },
    {
      series: 'AU.centsPerKm',
      countryCode: 'AU',
      label: 'Car expenses, cents per kilometre',
      file: AU_DEDUCTIONS_FILE,
      incomeYearOf: auYear,
      format: (v) => formatAuCents(v, 'per kilometre'),
      rows: AU_CENTS_PER_KM_ROWS.map((r) => ({ effectiveFrom: r.effectiveFrom, value: r.rate, verified: r.verified, sourceUrl: r.sourceUrl, readOn: r.readOn })),
    },
    {
      series: 'AU.instantAssetWriteOff',
      countryCode: 'AU',
      label: 'Instant asset write-off limit',
      file: 'src/countries/australiaDepreciation.ts',
      incomeYearOf: auYear,
      format: aud,
      rows: AU_INSTANT_ASSET_WRITE_OFF_ROWS.map((r) => ({ effectiveFrom: r.effectiveFrom, value: r.limit, verified: r.verified, sourceUrl: r.sourceUrl, readOn: r.readOn })),
    },
    // Home rules (src/decisions/homeRules.ts): the per-country figures a filer's answers turn into numbers.
    homeSeries('GB.rentARoom', 'GB', 'Rent a Room tax-free amount', gbTaxYear, (v) => `£${group(v)} a year`, GB_RENT_A_ROOM_ROWS),
    homeSeries('US.homeOfficeSimplifiedMethod', 'US', 'Home office simplified method', usTaxYear, (v) => `$${v} per sq ft`, US_SIMPLIFIED_METHOD_ROWS),
    homeSeries('NZ.homeOfficeSquareMetreRate', 'NZ', 'Home office square-metre rate', nzIncomeYear, (v) => `$${v.toFixed(2)} per m²`, NZ_SQUARE_METRE_RATE_ROWS),
    homeSeries('NZ.boarderStandardCost', 'NZ', 'Boarder standard cost', nzIncomeYear, (v) => `$${v} per boarder per week`, NZ_BOARDER_STANDARD_COST_ROWS),
    // The GB and US home-space comparisons (src/decisions/homeSpaceCountries.ts).
    homeSeries('GB.cgtBasicRate', 'GB', 'Capital Gains Tax rate, basic rate band', gbTaxYear, (v) => `${v}%`, GB_CGT_BASIC_RATE_ROWS),
    homeSeries('GB.cgtHigherRate', 'GB', 'Capital Gains Tax rate, above the basic rate band', gbTaxYear, (v) => `${v}%`, GB_CGT_HIGHER_RATE_ROWS),
    homeSeries('GB.cgtAnnualExempt', 'GB', 'Capital Gains Tax annual exempt amount', gbTaxYear, (v) => `£${group(v)}`, GB_CGT_ANNUAL_EXEMPT_ROWS),
    homeSeries('US.unrecaptured1250MaxRate', 'US', 'Unrecaptured section 1250 gain, maximum rate', usTaxYear, (v) => `${v}%`, US_UNRECAPTURED_1250_MAX_RATE_ROWS),
    homeSeries('US.homeOfficeRecoveryYears', 'US', 'Home office depreciation recovery period', usTaxYear, (v) => `${v} years`, US_HOME_OFFICE_RECOVERY_YEARS_ROWS),
  ];
}

const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function homeSeries(
  series: string,
  countryCode: string,
  label: string,
  incomeYearOf: (ymd: string) => string,
  format: (v: number) => string,
  rows: readonly HomeRateRow[],
): DeductionSeries {
  return {
    series,
    countryCode,
    label,
    file: 'src/decisions/homeRuleRates.ts',
    incomeYearOf,
    format,
    rows: rows.map((r) => ({ effectiveFrom: r.effectiveFrom, value: r.value, verified: r.verified, sourceUrl: r.sourceUrl, readOn: r.readOn, reviewBy: r.reviewBy })),
  };
}

export function analyzeDeductionRates(
  asOf?: string | Date,
  opts: Pick<RateWatchOptions, 'staleAfterDays'> = {},
  series: DeductionSeries[] = shippedDeductionSeries(),
): DeductionWatchFindings {
  const today = toYmd(asOf ?? new Date());
  const staleAfterDays = opts.staleAfterDays ?? 365;
  const f: DeductionWatchFindings = { asOf: today, unverifiedCurrent: [], staleCitations: [], upcoming: [], pastReviewBy: [] };

  for (const s of series) {
    const id: DeductionId = { series: s.series, countryCode: s.countryCode, label: s.label, incomeYear: s.incomeYearOf(today), file: s.file };
    // Order is derived, never trusted — the same rule the resolvers follow.
    const newestFirst = [...s.rows].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    const current = newestFirst.find((r) => r.effectiveFrom <= today);

    if (!current) {
      f.unverifiedCurrent.push({ ...id, effectiveFrom: today, reason: 'no row covers today' });
    } else if (!current.verified || current.value === null) {
      f.unverifiedCurrent.push({
        ...id,
        effectiveFrom: current.effectiveFrom,
        reason: 'no verified rate for the current income year — check whether the authority has published one',
      });
    } else if (!current.sourceUrl || !current.readOn) {
      f.unverifiedCurrent.push({
        ...id,
        effectiveFrom: current.effectiveFrom,
        reason: current.sourceUrl ? 'verified, but no read date to check staleness against' : 'verified, but no authority url',
      });
    } else {
      const ageDays = daysBetween(current.readOn, today);
      if (ageDays > staleAfterDays) {
        f.staleCitations.push({ ...id, readOn: current.readOn, ageDays, sourceUrl: current.sourceUrl });
      }
    }

    if (current?.reviewBy && current.reviewBy < today) {
      f.pastReviewBy!.push({ ...id, effectiveFrom: current.effectiveFrom, reviewBy: current.reviewBy, daysPast: daysBetween(current.reviewBy, today), sourceUrl: current.sourceUrl ?? null });
    }

    for (const r of newestFirst) {
      if (r.effectiveFrom > today) {
        const published = r.verified && r.value !== null;
        f.upcoming.push({
          ...id,
          incomeYear: s.incomeYearOf(r.effectiveFrom),
          effectiveFrom: r.effectiveFrom,
          value: published ? s.format(r.value as number) : null,
          verified: published,
        });
      }
    }
  }

  f.upcoming.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom) || a.series.localeCompare(b.series));
  return f;
}

/** True when a deduction-rate finding needs a human. `upcoming` is FYI. */
export function hasActionableDeductionFindings(f: DeductionWatchFindings): boolean {
  return f.unverifiedCurrent.length > 0 || f.staleCitations.length > 0 || (f.pastReviewBy?.length ?? 0) > 0;
}

/** True when the findings contain anything that needs a human (not just FYI/checklist). */
export function hasActionableFindings(f: RateWatchFindings): boolean {
  return (
    f.unverified.length > 0 ||
    f.staleCitations.length > 0 ||
    f.recentlyActivated.length > 0 ||
    f.coverageGaps.length > 0
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULES — income tax, retirement contributions, student loans, company
// tax, Finnish capital income
//
// analyzeLedger() above watches GST/VAT only. These datasets are the other half
// of what the app and the free Tax MCP compute from, and they had no freshness
// check at all.
//
// They also fail differently. A neglected GST row fails LOUDLY — its series ends
// and coverageGaps reports no live rate. A neglected annual schedule fails
// SILENTLY: the resolver returns the newest set whose effectiveFrom has passed,
// so on the first day of a new tax year it goes on serving last year's brackets
// indefinitely, with no error and nothing to catch. The only observable symptom
// is "today falls in a tax year no set on file covers", so that is what
// `rollovers` detects. It keys off the NEWEST set, not the active one: a
// future-dated set (AU legislates years ahead) means the coming year is already
// covered and there is nothing to flag.
//
// It used to be an AGE rule — flag once the newest set is more than 365 + 30
// days old. That is the coverage rule with a fixed 30-day grace, and it could
// not express a country whose year is enacted before it starts: Finland's 2026
// scale would have gone unflagged until 1 February 2027, a month of serving
// 2026's scale for 2027. Coverage with a per-series grace says both.
//
// Company tax is watched for provenance (unverified, stale, missing, just
// activated, upcoming) but never for rollover: a company rate holds until it is
// changed, so a set from 2021 still in force today is correct, not stale.
//
// Same contract as above: pure, deterministic, and it never changes a figure.
// ─────────────────────────────────────────────────────────────────────────────

export type ScheduleDataset = 'incomeTax' | 'retirement' | 'studentLoan' | 'companyTax' | 'capitalGains';

export interface ScheduleWatchOptions extends RateWatchOptions {
  /**
   * Default days after a tax year has started with no set covering it before
   * that is flagged. Default 30. A series can override it with its own
   * `rolloverGraceDays` (see YEAR_KNOWN_BEFORE_IT_STARTS); a series override
   * wins, because it is a property of how that authority publishes.
   */
  rolloverGraceDays?: number;
}

/** A dated citation: when the figures were read against the source, and whether they agreed. */
export interface ScheduleCitation {
  citationDate: string;
  verified: boolean;
}

/** The slice of a dataset this analysis needs — lets tests pass fixtures. */
export interface ScheduleSeries {
  dataset: ScheduleDataset;
  countryCode: string;
  /**
   * Each set may carry its OWN citation (company tax, Finnish capital income:
   * provenance is per set). The set in force on `asOf` is the one judged; a set
   * without one falls back to the series-level `citation`.
   */
  sets: Array<{ effectiveFrom: string; taxYearLabel: string; citation?: ScheduleCitation }>;
  /** Omitted for datasets that carry a source URL but no dated citation yet. */
  citation?: ScheduleCitation;
  /**
   * FALSE for a rate that holds until it is changed (company tax), rather than
   * one restated every tax year. Such a series never "rolls over": a 2021 set
   * still in force in 2026 is normal, not stale data. Default true.
   */
  annual?: boolean;
  /**
   * Days after an uncovered tax year starts before it is flagged, overriding
   * the analysis default. 0 for a schedule that is enacted or published before
   * its year begins, where a missing set on day one is already a gap.
   */
  rolloverGraceDays?: number;
  /** The file a human edits to append the next set (the report names it). */
  file?: string;
}

export interface ScheduleWatchFindings {
  asOf: string;
  unverified: Array<{ dataset: ScheduleDataset; countryCode: string }>;
  staleCitations: Array<{ dataset: ScheduleDataset; countryCode: string; citationDate: string; ageDays: number }>;
  /**
   * `asOf` falls in a tax year no set covers: the newest set's year ended on
   * `uncoveredFrom` and nothing follows it. `ageDays` is the newest set's age.
   */
  rollovers: Array<{ dataset: ScheduleDataset; countryCode: string; latestLabel: string; latestEffectiveFrom: string; ageDays: number; uncoveredFrom: string; file?: string }>;
  recentlyActivated: Array<{ dataset: ScheduleDataset; countryCode: string; taxYearLabel: string; effectiveFrom: string }>;
  upcoming: Array<{ dataset: ScheduleDataset; countryCode: string; taxYearLabel: string; effectiveFrom: string }>;
  /** Datasets with no dated citation — reported so the gap is visible, not silent. */
  undated: Array<{ dataset: ScheduleDataset; countryCode: string }>;
  /**
   * No set is in force on `asOf` at all (every set starts later, or there are
   * none). The resolvers fall back to the OLDEST set in that case, so the
   * answer is a figure from a window that does not include the date. Actionable.
   */
  missing: Array<{ dataset: ScheduleDataset; countryCode: string; file?: string }>;
}

/**
 * Countries whose annual schedule is fixed BEFORE its tax year starts, so a
 * year with no set is a gap from its first day — no grace.
 *
 *  - FI: the state income-tax scale is an Act passed for the coming calendar
 *    year (e.g. Laki vuoden 2026 tuloveroasteikosta 1140/2025), normally in
 *    December; capital income rates sit in the Income Tax Act itself.
 *  - CA: federal brackets and credits are indexed by formula (ITA s.117.1) and
 *    the CRA publishes the indexed amounts in November for the next year.
 *
 * Everyone else keeps the default grace. That is a choice about alert timing,
 * not about coverage: with a 30-day grace the coverage rule below fires within
 * a day of where the old age rule (newest set older than 365 + 30 days) did,
 * so nothing a team relies on moves. Moving a country here is one line.
 */
const YEAR_KNOWN_BEFORE_IT_STARTS: Readonly<Partial<Record<ScheduleDataset, readonly string[]>>> = {
  incomeTax: ['FI', 'CA'],
  capitalGains: ['FI'],
};

const graceFor = (dataset: ScheduleDataset, countryCode: string): number | undefined =>
  YEAR_KNOWN_BEFORE_IT_STARTS[dataset]?.includes(countryCode) ? 0 : undefined;

/** The file holding a country's income-tax years — FI and CA build their sets from their own data files. */
const INCOME_TAX_FILE: Readonly<Record<string, string>> = { FI: 'src/data/finland.ts', CA: 'src/data/canadaFederal.ts' };

/** Every schedule the engine ships, in the shape analyzeSchedules() reads. */
export function shippedSchedules(): ScheduleSeries[] {
  const out: ScheduleSeries[] = [];
  for (const s of Object.values(INCOME_TAX_SCHEMES)) {
    const grace = graceFor('incomeTax', s.code);
    out.push({
      dataset: 'incomeTax',
      countryCode: s.code,
      // A set with its own citation (every data-built country) is judged on it.
      sets: s.sets.map((set) => ({
        effectiveFrom: set.effectiveFrom,
        taxYearLabel: set.taxYearLabel,
        ...(set.citationDate && set.verified !== undefined ? { citation: { citationDate: set.citationDate, verified: set.verified } } : {}),
      })),
      citation: { citationDate: s.citationDate, verified: s.verified },
      rolloverGraceDays: grace,
      file: s.file ?? INCOME_TAX_FILE[s.code] ?? 'src/data/incomeTax.ts',
    });
    // Sub-national series (provinces, states, Scotland) are watched on their
    // own, as '<country>-<region>', with the country's grace: a province's
    // year is published when the federal one is.
    for (const r of Object.values(s.regions ?? {})) {
      out.push({
        dataset: 'incomeTax',
        countryCode: `${s.code}-${r.code}`,
        sets: r.sets.map((set) => ({ effectiveFrom: set.effectiveFrom, taxYearLabel: set.taxYearLabel, citation: { citationDate: set.citationDate, verified: set.verified } })),
        rolloverGraceDays: grace,
        file: r.file,
      });
    }
  }
  for (const s of Object.values(RETIREMENT_SCHEMES)) out.push({ dataset: 'retirement', countryCode: s.countryCode, sets: s.schemes, file: 'src/data/superannuation.ts' });
  for (const s of Object.values(STUDENT_LOAN_SCHEMES)) out.push({ dataset: 'studentLoan', countryCode: s.countryCode, sets: s.schemes, file: 'src/data/studentLoan.ts' });
  // Company tax: per-set provenance, and NOT annual — a rate holds until changed.
  for (const c of Object.values(COMPANY_TAX_RATES)) {
    out.push({
      dataset: 'companyTax',
      countryCode: c.countryCode,
      annual: false,
      sets: c.rates.map((r) => ({ effectiveFrom: r.effectiveFrom, taxYearLabel: `from ${r.effectiveFrom}`, citation: { citationDate: r.citationDate, verified: r.verified } })),
      file: 'src/data/companyTax.ts',
    });
  }
  // Finnish capital income (capital gains). The Finnish EARNED-income years are
  // already watched as incomeTax:FI — INCOME_TAX_SCHEMES.FI is built from
  // FI_EARNED_INCOME_YEARS — so they are not listed twice.
  out.push({
    dataset: 'capitalGains',
    countryCode: 'FI',
    sets: FI_CAPITAL_INCOME_YEARS.map((y) => ({ effectiveFrom: y.effectiveFrom, taxYearLabel: y.taxYear, citation: { citationDate: y.citationDate, verified: y.verified } })),
    rolloverGraceDays: graceFor('capitalGains', 'FI'),
    file: 'src/data/finland.ts',
  });
  // Capital gains for every other country (src/data/capitalGains). FI is the
  // series above; GB's rates and annual exempt amount are watched as deduction
  // series (GB.cgt*, below), so neither is listed twice. A CGT rule holds until
  // it changes (annual: false), except where a set carries one year's indexed
  // thresholds (US, DK). Per-set citations, so the set in force is the one judged.
  for (const c of Object.values(CAPITAL_GAINS_RULES)) {
    if (c.code === 'FI' || c.code === 'GB') continue;
    out.push({
      dataset: 'capitalGains',
      countryCode: c.code,
      annual: c.annual === true,
      sets: c.sets.map((s) => ({
        effectiveFrom: s.effectiveFrom,
        taxYearLabel: s.taxYearLabel ?? `from ${s.effectiveFrom}`,
        ...(s.citationDate ? { citation: { citationDate: s.citationDate, verified: s.verified } } : {}),
      })),
      file: c.code === 'AU' ? 'src/data/capitalGains.ts' : 'src/data/capitalGains.data.ts',
    });
  }
  return out;
}

// One definition of "a tax year's end", shared with coverage().
export { addOneYear };

const addDays = (ymd: string, days: number): string =>
  new Date(Date.parse(`${ymd.slice(0, 10)}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

export function analyzeSchedules(
  asOf?: string | Date,
  opts: ScheduleWatchOptions = {},
  series: ScheduleSeries[] = shippedSchedules(),
): ScheduleWatchFindings {
  const today = toYmd(asOf ?? new Date());
  const staleAfterDays = opts.staleAfterDays ?? 365;
  const activatedWithinDays = opts.activatedWithinDays ?? 45;

  const f: ScheduleWatchFindings = { asOf: today, unverified: [], staleCitations: [], rollovers: [], recentlyActivated: [], upcoming: [], undated: [], missing: [] };

  for (const s of series) {
    const id = { dataset: s.dataset, countryCode: s.countryCode };
    const file = s.file ? { file: s.file } : {};
    // Order is derived, never trusted — the same rule the resolvers follow.
    const newestFirst = [...s.sets].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    const inForce = newestFirst.find((set) => set.effectiveFrom <= today);

    if (!inForce) f.missing.push({ ...id, ...file });

    // Judge the citation of what is actually being served today.
    const citation = inForce?.citation ?? s.citation;
    if (!citation) f.undated.push(id);
    else if (!citation.verified) f.unverified.push(id);
    else {
      const ageDays = daysBetween(citation.citationDate, today);
      if (ageDays > staleAfterDays) f.staleCitations.push({ ...id, citationDate: citation.citationDate, ageDays });
    }

    const newest = newestFirst[0];
    if (!newest) continue;

    // ROLLOVER, by coverage: does any set cover the tax year `today` is in?
    // The newest set covers one year from its effectiveFrom; past that, today
    // sits in a year nothing covers and the resolver is silently serving the
    // previous year. The grace (per series, else the option, else 30 days) is
    // how long an authority is given to publish once that year has begun.
    if (s.annual !== false) {
      const uncoveredFrom = addOneYear(newest.effectiveFrom);
      const grace = s.rolloverGraceDays ?? opts.rolloverGraceDays ?? 30;
      if (today >= addDays(uncoveredFrom, grace)) {
        f.rollovers.push({
          ...id,
          latestLabel: newest.taxYearLabel,
          latestEffectiveFrom: newest.effectiveFrom,
          ageDays: daysBetween(newest.effectiveFrom, today),
          uncoveredFrom,
          ...file,
        });
      }
    }

    for (const set of s.sets) {
      const age = daysBetween(set.effectiveFrom, today);
      const row = { ...id, taxYearLabel: set.taxYearLabel, effectiveFrom: set.effectiveFrom };
      if (age < 0) f.upcoming.push(row);
      else if (age <= activatedWithinDays) f.recentlyActivated.push(row);
    }
  }

  f.upcoming.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  return f;
}

/** True when a schedule finding needs a human. `upcoming` and `undated` are FYI. */
export function hasActionableScheduleFindings(f: ScheduleWatchFindings): boolean {
  return (
    f.unverified.length > 0 ||
    f.staleCitations.length > 0 ||
    f.rollovers.length > 0 ||
    f.recentlyActivated.length > 0 ||
    (f.missing?.length ?? 0) > 0
  );
}
