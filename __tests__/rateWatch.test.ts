/**
 * Rate Watch Tests — @ai2/tax-plugins
 * ai2fin.com
 *
 * The scheduled detector must never miss a coverage gap and must resolve
 * future/recent activations purely by date, so these lock down the analysis the
 * cron acts on. Dates are fixed (not "now") so the assertions are deterministic.
 */
import { analyzeLedger, hasActionableFindings, daysBetween } from '../src/rateWatch';
import type { RateWatchFindings } from '../src/rateWatch';

const empty: RateWatchFindings = {
  asOf: '2026-06-24',
  unverified: [],
  staleCitations: [],
  recentlyActivated: [],
  upcomingChanges: [],
  coverageGaps: [],
  reviewChecklist: [],
};

describe('daysBetween', () => {
  it('is positive when to > from and counts whole days', () => {
    expect(daysBetween('2026-06-24', '2026-06-25')).toBe(1);
    expect(daysBetween('2025-08-01', '2026-08-01')).toBe(365);
    expect(daysBetween('2026-06-24', '2026-06-24')).toBe(0);
  });

  it('is negative when to < from', () => {
    expect(daysBetween('2026-06-25', '2026-06-24')).toBe(-1);
  });
});

describe('analyzeLedger', () => {
  it('produces a full per-country review checklist with no coverage gaps today', () => {
    const f = analyzeLedger('2026-06-24');
    expect(f.reviewChecklist.length).toBeGreaterThanOrEqual(80);
    expect(f.coverageGaps).toHaveLength(0);
    for (const c of f.reviewChecklist) {
      expect(c.countryCode).toMatch(/^[A-Z]{2}$/);
      expect(typeof c.standardRate).toBe('number');
    }
  });

  it('lists announced future changes as upcoming before they take effect', () => {
    // As of mid-2025, the 2026-01-01 RU/KZ steps are future-dated.
    const f = analyzeLedger('2025-06-01');
    const upcoming = f.upcomingChanges.map((u) => u.countryCode);
    expect(upcoming).toContain('RU');
    expect(upcoming).toContain('KZ');
  });

  it('flags a scheduled change as recently activated just after it takes effect', () => {
    // 2026-01-15 is within 45 days of the 2026-01-01 RU/KZ activation.
    const f = analyzeLedger('2026-01-15');
    const recent = f.recentlyActivated.map((r) => r.countryCode);
    expect(recent).toContain('RU');
    expect(recent).toContain('KZ');
  });

  it('does not flag long-standing (floor-dated) rates as recently activated', () => {
    const f = analyzeLedger('2026-06-24');
    // AU has been 10% since 2000-01-01 (floor) — must not appear as "just activated"
    expect(f.recentlyActivated.map((r) => r.countryCode)).not.toContain('AU');
  });
});

describe('hasActionableFindings', () => {
  it('is false when only informational (checklist/upcoming) content exists', () => {
    expect(hasActionableFindings({ ...empty, upcomingChanges: [{ countryCode: 'RU', standardRate: 0.22, effectiveFrom: '2027-01-01' }] })).toBe(false);
  });

  it('is true for a coverage gap', () => {
    expect(hasActionableFindings({ ...empty, coverageGaps: [{ countryCode: 'ZZ', taxType: 'VAT', stateProvince: null, endedOn: '2026-01-01' }] })).toBe(true);
  });

  it('is true for an unverified current row', () => {
    expect(hasActionableFindings({ ...empty, unverified: [{ countryCode: 'ZZ', countryName: 'Zedland', reason: 'no authority url' }] })).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Annual schedules. The failure these exist to catch is SILENT: a tax year rolls
// over, nobody appends the new set, and the resolver keeps serving last year's
// brackets with no error. Fixtures are used for the edge cases so the assertions
// do not rot when a real set is appended; the shipped data gets its own checks.
// ─────────────────────────────────────────────────────────────────────────────
import { analyzeSchedules, hasActionableScheduleFindings, shippedSchedules } from '../src/rateWatch';
import type { ScheduleSeries } from '../src/rateWatch';

const us = (sets: ScheduleSeries['sets'], citation = { citationDate: '2026-08-20', verified: true }): ScheduleSeries[] => [
  { dataset: 'incomeTax', countryCode: 'US', sets, citation },
];

describe('analyzeSchedules — rollover', () => {
  const only2026 = us([{ effectiveFrom: '2026-01-01', taxYearLabel: '2026' }]);

  it('stays quiet through the year the newest set covers', () => {
    expect(analyzeSchedules('2026-12-31', {}, only2026).rollovers).toEqual([]);
  });

  it('gives the authority a grace window to publish before flagging', () => {
    expect(analyzeSchedules('2027-01-15', {}, only2026).rollovers).toEqual([]);
  });

  it('flags a year that rolled over with no successor set', () => {
    const f = analyzeSchedules('2027-02-15', {}, only2026);
    expect(f.rollovers).toEqual([
      { dataset: 'incomeTax', countryCode: 'US', latestLabel: '2026', latestEffectiveFrom: '2026-01-01', ageDays: 410 },
    ]);
    expect(hasActionableScheduleFindings(f)).toBe(true);
  });

  it('keys off the NEWEST set — a future-dated set means the year is already covered', () => {
    const covered = us([
      { effectiveFrom: '2027-01-01', taxYearLabel: '2027' },
      { effectiveFrom: '2026-01-01', taxYearLabel: '2026' },
    ]);
    expect(analyzeSchedules('2027-02-15', {}, covered).rollovers).toEqual([]);
  });

  it('honours a custom grace window', () => {
    expect(analyzeSchedules('2027-01-15', { rolloverGraceDays: 0 }, only2026).rollovers).toHaveLength(1);
  });
});

describe('analyzeSchedules — citations and activations', () => {
  const sets = [{ effectiveFrom: '2026-07-01', taxYearLabel: '2026-27' }];

  it('flags a verified citation older than the threshold, and not a day sooner', () => {
    const s = us(sets, { citationDate: '2025-08-01', verified: true });
    expect(analyzeSchedules('2026-08-01', {}, s).staleCitations).toEqual([]);
    expect(analyzeSchedules('2026-08-02', {}, s).staleCitations).toEqual([
      { dataset: 'incomeTax', countryCode: 'US', citationDate: '2025-08-01', ageDays: 366 },
    ]);
  });

  it('reports an unverified schedule as unverified, never as stale', () => {
    const f = analyzeSchedules('2030-01-01', {}, us(sets, { citationDate: '2020-01-01', verified: false }));
    expect(f.unverified).toEqual([{ dataset: 'incomeTax', countryCode: 'US' }]);
    expect(f.staleCitations).toEqual([]);
  });

  it('separates a set that just activated from one still to come', () => {
    const s = us([
      { effectiveFrom: '2027-07-01', taxYearLabel: '2027-28' },
      { effectiveFrom: '2026-07-01', taxYearLabel: '2026-27' },
    ]);
    const f = analyzeSchedules('2026-07-10', {}, s);
    expect(f.recentlyActivated.map((r) => r.taxYearLabel)).toEqual(['2026-27']);
    expect(f.upcoming.map((r) => r.taxYearLabel)).toEqual(['2027-28']);
  });

  it('surfaces a dataset with no dated citation instead of passing it silently', () => {
    const f = analyzeSchedules('2026-09-20', {}, [{ dataset: 'retirement', countryCode: 'AU', sets }]);
    expect(f.undated).toEqual([{ dataset: 'retirement', countryCode: 'AU' }]);
    expect(hasActionableScheduleFindings(f)).toBe(false);
  });
});

describe('analyzeSchedules — the shipped data', () => {
  it('covers every income, retirement and student-loan scheme the engine exports', () => {
    const byDataset = (d: string) => shippedSchedules().filter((s) => s.dataset === d).map((s) => s.countryCode).sort();
    expect(byDataset('incomeTax')).toEqual(['AU', 'GB', 'IN', 'NZ', 'US']);
    expect(byDataset('retirement')).toEqual(['AU']);
    expect(byDataset('studentLoan')).toEqual(['AU']);
  });

  it('has no rollover gap and no unverified income schedule as of the 2026-09 audit', () => {
    const f = analyzeSchedules('2026-09-20');
    expect(f.rollovers).toEqual([]);
    expect(f.unverified).toEqual([]);
    expect(f.staleCitations).toEqual([]);
  });

  it('WILL flag the US in early 2027 unless the 2027 brackets are appended — the point of the check', () => {
    const f = analyzeSchedules('2027-03-01');
    expect(f.rollovers.map((r) => `${r.dataset}:${r.countryCode}`)).toContain('incomeTax:US');
  });
});
