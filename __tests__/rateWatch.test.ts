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
import { listCapitalGainsCountries } from '../src';
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
      { dataset: 'incomeTax', countryCode: 'US', latestLabel: '2026', latestEffectiveFrom: '2026-01-01', ageDays: 410, uncoveredFrom: '2027-01-01' },
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
  it('covers every income, retirement, student-loan, company-tax and capital-gains schedule the engine exports', () => {
    const byDataset = (d: string) => shippedSchedules().filter((s) => s.dataset === d).map((s) => s.countryCode).sort();
    expect(byDataset('incomeTax')).toEqual(['AU', 'CA', 'FI', 'GB', 'IN', 'NZ', 'US']);
    expect(byDataset('companyTax')).toEqual(['AU', 'CA', 'FI', 'GB', 'IN', 'US']);
    // FI from its capital-income years; every other CGT country from src/data/capitalGains,
    // except GB, whose CGT rows are watched as deduction series (GB.cgt*).
    expect(byDataset('capitalGains')).toEqual(listCapitalGainsCountries().filter((c) => c !== 'GB'));
    expect(byDataset('capitalGains')).toHaveLength(70);
    expect(byDataset('retirement')).toEqual(['AU']);
    expect(byDataset('studentLoan')).toEqual(['AU']);
  });

  it('has no rollover gap and no unverified income schedule as of the 2026-09 audit', () => {
    // The researched CGT sets (2026-10-06) postdate this audit; they have their own test below.
    const audited = (x: { dataset: string; countryCode: string }) => x.dataset !== 'capitalGains' || x.countryCode === 'FI';
    const f = analyzeSchedules('2026-09-20');
    expect(f.rollovers.filter(audited)).toEqual([]);
    expect(f.unverified.filter(audited)).toEqual([]);
    expect(f.staleCitations.filter(audited)).toEqual([]);
  });

  it('WILL flag the US in early 2027 unless the 2027 brackets are appended — the point of the check', () => {
    const f = analyzeSchedules('2027-03-01');
    expect(f.rollovers.map((r) => `${r.dataset}:${r.countryCode}`)).toContain('incomeTax:US');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rollover by COVERAGE. The age rule ("newest set older than 365 + 30 days")
// could not see a year that is enacted before it starts: Finland's 2026 scale
// would have been served for all of January 2027 without a flag.
// ─────────────────────────────────────────────────────────────────────────────
describe('analyzeSchedules — rollover is by coverage, with a per-series grace', () => {
  it('flags Finland income tax on 1 January 2027 — the age rule alone would not', () => {
    const f = analyzeSchedules('2027-01-01');
    const fi = f.rollovers.find((r) => r.dataset === 'incomeTax' && r.countryCode === 'FI');
    expect(fi).toEqual({
      dataset: 'incomeTax',
      countryCode: 'FI',
      latestLabel: '2026',
      latestEffectiveFrom: '2026-01-01',
      ageDays: 365,
      uncoveredFrom: '2027-01-01',
      file: 'src/data/finland.ts',
    });
    // Why the old rule missed it: it fired only once the newest set was MORE
    // than 365 + 30 days old. On this date it is 365.
    expect(fi!.ageDays > 365 + 30).toBe(false);
    expect(hasActionableScheduleFindings(f)).toBe(true);
  });

  it('flags Finnish capital income and Canada income tax the same day, and nothing on the eve', () => {
    const on = analyzeSchedules('2027-01-01').rollovers.map((r) => `${r.dataset}:${r.countryCode}`);
    expect(on).toEqual(expect.arrayContaining(['capitalGains:FI', 'incomeTax:CA']));
    expect(analyzeSchedules('2026-12-31').rollovers).toEqual([]);
  });

  it('keeps the 30-day grace for everyone else (the US is not flagged on 1 January)', () => {
    expect(analyzeSchedules('2027-01-01').rollovers.map((r) => r.countryCode)).not.toContain('US');
    expect(analyzeSchedules('2027-01-31').rollovers.map((r) => `${r.dataset}:${r.countryCode}`)).toContain('incomeTax:US');
  });

  it('a series grace overrides the option, and the option overrides the default', () => {
    const fixture = (rolloverGraceDays?: number): ScheduleSeries[] => [
      { dataset: 'incomeTax', countryCode: 'ZZ', sets: [{ effectiveFrom: '2026-01-01', taxYearLabel: '2026' }], citation: { citationDate: '2026-08-20', verified: true }, rolloverGraceDays },
    ];
    expect(analyzeSchedules('2027-01-01', {}, fixture(0)).rollovers).toHaveLength(1);
    expect(analyzeSchedules('2027-01-01', { rolloverGraceDays: 90 }, fixture(0)).rollovers).toHaveLength(1);
    expect(analyzeSchedules('2027-01-01', { rolloverGraceDays: 0 }, fixture()).rollovers).toHaveLength(1);
    expect(analyzeSchedules('2027-01-01', {}, fixture()).rollovers).toHaveLength(0);
  });

  it('measures a year by the calendar, not 365 days (a leap year is covered to its last day)', () => {
    const leap: ScheduleSeries[] = [{ dataset: 'incomeTax', countryCode: 'ZZ', sets: [{ effectiveFrom: '2028-01-01', taxYearLabel: '2028' }], rolloverGraceDays: 0 }];
    expect(analyzeSchedules('2028-12-31', {}, leap).rollovers).toEqual([]);
    expect(analyzeSchedules('2029-01-01', {}, leap).rollovers).toHaveLength(1);
  });
});

describe('analyzeSchedules — company tax', () => {
  const company = (citation: { citationDate: string; verified: boolean } | undefined, effectiveFrom = '2021-07-01'): ScheduleSeries[] => [
    { dataset: 'companyTax', countryCode: 'ZZ', annual: false, sets: [{ effectiveFrom, taxYearLabel: `from ${effectiveFrom}`, citation }] },
  ];

  it('watches every company-tax country the engine ships', () => {
    const cc = shippedSchedules().filter((s) => s.dataset === 'companyTax').map((s) => s.countryCode).sort();
    expect(cc).toEqual(['AU', 'CA', 'FI', 'GB', 'IN', 'US']);
  });

  it('never rolls over — a rate holds until it is changed', () => {
    const f = analyzeSchedules('2035-01-01');
    expect(f.rollovers.filter((r) => r.dataset === 'companyTax')).toEqual([]);
    expect(analyzeSchedules('2035-01-01', {}, company({ citationDate: '2034-06-01', verified: true })).rollovers).toEqual([]);
  });

  it('flags a stale company citation', () => {
    const f = analyzeSchedules('2027-10-07', {}, company({ citationDate: '2026-10-06', verified: true }));
    expect(f.staleCitations).toEqual([{ dataset: 'companyTax', countryCode: 'ZZ', citationDate: '2026-10-06', ageDays: 366 }]);
    expect(hasActionableScheduleFindings(f)).toBe(true);
  });

  it('the shipped company sets go stale a year after the 2026-10-06 audit, and not before', () => {
    const stale = (d: string) => analyzeSchedules(d).staleCitations.filter((s) => s.dataset === 'companyTax').map((s) => s.countryCode).sort();
    expect(stale('2027-10-06')).toEqual([]);
    expect(stale('2027-10-07')).toEqual(['AU', 'CA', 'FI', 'GB', 'IN', 'US']);
  });

  it('flags an unverified company set, and judges the set IN FORCE, not the newest', () => {
    const sets: ScheduleSeries[] = [{
      dataset: 'companyTax', countryCode: 'ZZ', annual: false,
      sets: [
        { effectiveFrom: '2027-01-01', taxYearLabel: 'from 2027-01-01', citation: { citationDate: '2026-10-06', verified: false } },
        { effectiveFrom: '2014-01-01', taxYearLabel: 'from 2014-01-01', citation: { citationDate: '2026-10-06', verified: true } },
      ],
    }];
    expect(analyzeSchedules('2026-10-06', {}, sets).unverified).toEqual([]);
    expect(analyzeSchedules('2026-10-06', {}, sets).upcoming.map((u) => u.taxYearLabel)).toEqual(['from 2027-01-01']);
    expect(analyzeSchedules('2027-01-02', {}, sets).unverified).toEqual([{ dataset: 'companyTax', countryCode: 'ZZ' }]);
  });

  it('flags a country with no set in force — the resolver would silently fall back to the oldest', () => {
    const f = analyzeSchedules('2026-10-06', {}, company({ citationDate: '2026-10-06', verified: true }, '2027-01-01'));
    expect(f.missing).toEqual([{ dataset: 'companyTax', countryCode: 'ZZ' }]);
    expect(hasActionableScheduleFindings(f)).toBe(true);
  });

  it('flags a set with no citation at all as undated', () => {
    expect(analyzeSchedules('2026-10-06', {}, company(undefined)).undated).toEqual([{ dataset: 'companyTax', countryCode: 'ZZ' }]);
  });
});

describe('analyzeSchedules — the shipped data, 2026-10-06 audit', () => {
  it('is clean apart from the CGT rules the research could not verify: nothing missing, stale or rolled over', () => {
    const f = analyzeSchedules('2026-10-06');
    expect(f.missing).toEqual([]);
    // Each is a country whose CGT rule (or one asset class of it) rests on a page
    // that is not official or could not be fetched — a person should confirm it.
    expect(f.unverified).toEqual(
      ['BE', 'BG', 'CN', 'CY', 'GR', 'GT', 'HU', 'IL', 'IN', 'JM', 'LT', 'RO', 'RS'].map((countryCode) => ({ dataset: 'capitalGains', countryCode })),
    );
    expect(f.staleCitations).toEqual([]);
    expect(f.rollovers).toEqual([]);
  });

  it('flags the CGT sets that start later: AU on 1 July 2027, the Greek property set on 1 January 2027', () => {
    const up = analyzeSchedules('2026-10-06').upcoming.filter((u) => u.dataset === 'capitalGains').map((u) => `${u.countryCode}@${u.effectiveFrom}`);
    expect(up).toEqual(['GR@2027-01-01', 'AU@2027-07-01']);
  });

  it('rolls the yearly CGT thresholds over like any annual schedule (US, DK), and goes stale a year after the audit', () => {
    const roll = (d: string) => analyzeSchedules(d).rollovers.filter((r) => r.dataset === 'capitalGains').map((r) => r.countryCode).sort();
    expect(roll('2027-01-30')).toEqual(['FI']);
    expect(roll('2027-01-31')).toEqual(['DK', 'FI', 'US']);
    // FI carries its own (earlier) citation date, so it is left out here.
    const stale = (d: string) => analyzeSchedules(d).staleCitations.filter((s) => s.dataset === 'capitalGains' && s.countryCode !== 'FI').map((s) => s.countryCode);
    expect(stale('2027-10-06')).toEqual([]);
    expect(stale('2027-10-07')).toContain('AT');
  });

  it('watches Finnish capital income with its per-year citation', () => {
    const fi = shippedSchedules().find((s) => s.dataset === 'capitalGains' && s.countryCode === 'FI')!;
    expect(fi.rolloverGraceDays).toBe(0);
    expect(fi.sets.map((s) => s.taxYearLabel)).toEqual(['2026', '2025']);
    for (const s of fi.sets) expect(s.citation).toEqual({ citationDate: '2026-09-29', verified: true });
  });

  it('sends a person to the file that actually holds the next year', () => {
    const file = (d: string, c: string) => shippedSchedules().find((s) => s.dataset === d && s.countryCode === c)!.file;
    expect(file('incomeTax', 'FI')).toBe('src/data/finland.ts');
    expect(file('incomeTax', 'CA')).toBe('src/data/canadaFederal.ts');
    expect(file('incomeTax', 'US')).toBe('src/data/incomeTax.ts');
    expect(file('companyTax', 'GB')).toBe('src/data/companyTax.ts');
  });
});
