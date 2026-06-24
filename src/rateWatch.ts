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
import { RATE_LEDGER, activeNationalRows, toYmd } from './data';
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
