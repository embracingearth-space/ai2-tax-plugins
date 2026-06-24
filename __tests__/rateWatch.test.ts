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
