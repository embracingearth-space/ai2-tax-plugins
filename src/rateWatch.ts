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
 */
import { RATE_LEDGER, activeNationalRows, toYmd, INCOME_TAX_SCHEMES, RETIREMENT_SCHEMES, STUDENT_LOAN_SCHEMES } from './data';
import type { RateLedgerRow } from './data';

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
  recentlyActivated: Array<{ countryCode: string; standardRate: number; effectiveFrom: string }>;
  upcomingChanges: Array<{ countryCode: string; standardRate: number; effectiveFrom: string }>;
  coverageGaps: Array<{ countryCode: string; taxType: string; stateProvince: string | null; endedOn: string }>;
  reviewChecklist: Array<{ countryCode: string; countryName: string; standardRate: number; authority: string; url: string }>;
}

const DAY_MS = 86_400_000;

/** Whole days from `from` to `to` (both YYYY-MM-DD), using UTC midnight. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS);
}

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

  // current national rows: verification + staleness + review checklist
  for (const r of activeNationalRows(today)) {
    if (!r.source.verified) {
      findings.unverified.push({
        countryCode: r.countryCode,
        countryName: r.countryName,
        reason: r.source.url ? 'not verified against authority' : 'no authority url',
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
      findings.recentlyActivated.push({ countryCode: r.countryCode, standardRate: r.standardRate, effectiveFrom: r.effectiveFrom });
    }
    findings.reviewChecklist.push({
      countryCode: r.countryCode,
      countryName: r.countryName,
      standardRate: r.standardRate,
      authority: r.source.authority,
      url: r.source.url,
    });
  }

  // future-dated rows (announced changes not yet in force)
  for (const r of RATE_LEDGER) {
    if (r.effectiveFrom > today) {
      findings.upcomingChanges.push({ countryCode: r.countryCode, standardRate: r.standardRate, effectiveFrom: r.effectiveFrom });
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
// ANNUAL SCHEDULES — income tax, retirement contributions, student loans
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
// is "the newest set on file is more than a year old", so that is what
// `rollovers` detects. It keys off the NEWEST set, not the active one: a
// future-dated set (AU legislates years ahead) means the coming year is already
// covered and there is nothing to flag.
//
// Same contract as above: pure, deterministic, and it never changes a figure.
// ─────────────────────────────────────────────────────────────────────────────

export type ScheduleDataset = 'incomeTax' | 'retirement' | 'studentLoan';

export interface ScheduleWatchOptions extends RateWatchOptions {
  /**
   * Days past a full year before a missing successor set is flagged. Default 30:
   * authorities publish late (the IRS in the autumn, the ATO near 1 July), and a
   * flag on day 366 that nobody can act on yet trains people to ignore it.
   */
  rolloverGraceDays?: number;
}

/** The slice of a dataset this analysis needs — lets tests pass fixtures. */
export interface ScheduleSeries {
  dataset: ScheduleDataset;
  countryCode: string;
  sets: Array<{ effectiveFrom: string; taxYearLabel: string }>;
  /** Omitted for datasets that carry a source URL but no dated citation yet. */
  citation?: { citationDate: string; verified: boolean };
}

export interface ScheduleWatchFindings {
  asOf: string;
  unverified: Array<{ dataset: ScheduleDataset; countryCode: string }>;
  staleCitations: Array<{ dataset: ScheduleDataset; countryCode: string; citationDate: string; ageDays: number }>;
  rollovers: Array<{ dataset: ScheduleDataset; countryCode: string; latestLabel: string; latestEffectiveFrom: string; ageDays: number }>;
  recentlyActivated: Array<{ dataset: ScheduleDataset; countryCode: string; taxYearLabel: string; effectiveFrom: string }>;
  upcoming: Array<{ dataset: ScheduleDataset; countryCode: string; taxYearLabel: string; effectiveFrom: string }>;
  /** Datasets with no dated citation — reported so the gap is visible, not silent. */
  undated: Array<{ dataset: ScheduleDataset; countryCode: string }>;
}

/** Every annual schedule the engine ships, in the shape analyzeSchedules() reads. */
export function shippedSchedules(): ScheduleSeries[] {
  const out: ScheduleSeries[] = [];
  for (const s of Object.values(INCOME_TAX_SCHEMES)) {
    out.push({ dataset: 'incomeTax', countryCode: s.code, sets: s.sets, citation: { citationDate: s.citationDate, verified: s.verified } });
  }
  for (const s of Object.values(RETIREMENT_SCHEMES)) out.push({ dataset: 'retirement', countryCode: s.countryCode, sets: s.schemes });
  for (const s of Object.values(STUDENT_LOAN_SCHEMES)) out.push({ dataset: 'studentLoan', countryCode: s.countryCode, sets: s.schemes });
  return out;
}

export function analyzeSchedules(
  asOf?: string | Date,
  opts: ScheduleWatchOptions = {},
  series: ScheduleSeries[] = shippedSchedules(),
): ScheduleWatchFindings {
  const today = toYmd(asOf ?? new Date());
  const staleAfterDays = opts.staleAfterDays ?? 365;
  const activatedWithinDays = opts.activatedWithinDays ?? 45;
  const rolloverAfterDays = 365 + (opts.rolloverGraceDays ?? 30);

  const f: ScheduleWatchFindings = { asOf: today, unverified: [], staleCitations: [], rollovers: [], recentlyActivated: [], upcoming: [], undated: [] };

  for (const s of series) {
    const id = { dataset: s.dataset, countryCode: s.countryCode };

    if (!s.citation) f.undated.push(id);
    else if (!s.citation.verified) f.unverified.push(id);
    else {
      const ageDays = daysBetween(s.citation.citationDate, today);
      if (ageDays > staleAfterDays) f.staleCitations.push({ ...id, citationDate: s.citation.citationDate, ageDays });
    }

    if (!s.sets.length) continue;
    const newest = s.sets.reduce((a, b) => (a.effectiveFrom >= b.effectiveFrom ? a : b));
    const newestAge = daysBetween(newest.effectiveFrom, today);
    if (newestAge > rolloverAfterDays) {
      f.rollovers.push({ ...id, latestLabel: newest.taxYearLabel, latestEffectiveFrom: newest.effectiveFrom, ageDays: newestAge });
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
  return f.unverified.length > 0 || f.staleCitations.length > 0 || f.rollovers.length > 0 || f.recentlyActivated.length > 0;
}
