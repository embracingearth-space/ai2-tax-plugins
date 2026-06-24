/**
 * Rate Ledger Tests — @ai2/tax-plugins
 * ai2fin.com
 *
 * The ledger is the single source of truth for consumption-tax rates and is the
 * audit-critical artifact, so these tests enforce both DATA INTEGRITY (no
 * overlapping/duplicate effective windows, sane ranges, provenance present) and
 * RESOLVER CORRECTNESS (rate resolved by date — the rate that applied during a
 * transaction's tax period, before/after a change).
 */
import {
  RATE_LEDGER,
  RATE_FLOOR,
  resolveRateRow,
  getStandardRateAsOf,
  activeNationalRows,
  COUNTRY_TAX_RATES,
} from '../src/data';
import type { RateLedgerRow } from '../src/data';

const groupKey = (r: RateLedgerRow) => `${r.countryCode}|${r.taxType}|${r.stateProvince ?? ''}`;

describe('Ledger data integrity', () => {
  it('has a substantial, multi-country ledger', () => {
    expect(RATE_LEDGER.length).toBeGreaterThanOrEqual(80);
    expect(new Set(RATE_LEDGER.map((r) => r.countryCode)).size).toBeGreaterThanOrEqual(80);
  });

  it('every standard/reduced rate is within a sane band [0, 0.40]', () => {
    for (const r of RATE_LEDGER) {
      expect(r.standardRate).toBeGreaterThanOrEqual(0);
      expect(r.standardRate).toBeLessThanOrEqual(0.4);
      if (r.reducedRate != null) {
        expect(r.reducedRate).toBeGreaterThanOrEqual(0);
        expect(r.reducedRate).toBeLessThanOrEqual(0.4);
      }
    }
  });

  it('effectiveFrom/effectiveTo are valid YYYY-MM-DD and from < to', () => {
    const ymd = /^\d{4}-\d{2}-\d{2}$/;
    for (const r of RATE_LEDGER) {
      expect(r.effectiveFrom).toMatch(ymd);
      expect(r.effectiveFrom >= RATE_FLOOR).toBe(true);
      if (r.effectiveTo != null) {
        expect(r.effectiveTo).toMatch(ymd);
        expect(r.effectiveFrom < r.effectiveTo).toBe(true);
      }
    }
  });

  it('has no duplicate (country, taxType, state, effectiveFrom) keys', () => {
    const seen = new Set<string>();
    for (const r of RATE_LEDGER) {
      const k = `${groupKey(r)}|${r.effectiveFrom}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });

  it('has no overlapping effective windows within a (country, taxType, state) series', () => {
    const groups = new Map<string, RateLedgerRow[]>();
    for (const r of RATE_LEDGER) {
      const g = groupKey(r);
      (groups.get(g) ?? groups.set(g, []).get(g)!).push(r);
    }
    for (const [g, rows] of groups) {
      const sorted = [...rows].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
      for (let i = 0; i < sorted.length - 1; i++) {
        const end = sorted[i].effectiveTo ?? '9999-12-31';
        // current window must close on or before the next window opens (no overlap)
        expect({ g, end, next: sorted[i + 1].effectiveFrom, ok: end <= sorted[i + 1].effectiveFrom }).toMatchObject({ ok: true });
      }
    }
  });

  it('every row carries a provenance source object', () => {
    for (const r of RATE_LEDGER) {
      expect(r.source).toBeDefined();
      expect(typeof r.source.citationDate).toBe('string');
      // a verified row must cite an https authority url
      if (r.source.verified) expect(r.source.url.startsWith('https://')).toBe(true);
    }
  });

  it('the majority of current national rows are verified against an authority', () => {
    const current = RATE_LEDGER.filter((r) => r.effectiveTo == null && r.stateProvince == null);
    const verified = current.filter((r) => r.source.verified);
    expect(verified.length / current.length).toBeGreaterThan(0.8);
  });
});

describe('Effective-dated resolution (tax period before/after a change)', () => {
  it('resolves the current standard rate as of today', () => {
    expect(resolveRateRow('AU', '2026-06-24')?.standardRate).toBe(0.1);
    expect(resolveRateRow('FI', '2026-06-24')?.standardRate).toBe(0.255);
    expect(resolveRateRow('RO', '2026-06-24')?.standardRate).toBe(0.21);
  });

  it('resolves the rate in force BEFORE and AFTER a change', () => {
    // Finland: 24% -> 25.5% on 2024-09-01
    expect(getStandardRateAsOf('FI', '2024-01-15')).toBe(0.24);
    expect(getStandardRateAsOf('FI', '2025-01-15')).toBe(0.255);
    // Romania: 19% -> 21% on 2025-08-01
    expect(getStandardRateAsOf('RO', '2025-03-01')).toBe(0.19);
    expect(getStandardRateAsOf('RO', '2025-09-01')).toBe(0.21);
  });

  it('handles a multi-step transition (Estonia 20 -> 22 -> 24)', () => {
    expect(getStandardRateAsOf('EE', '2023-06-01')).toBe(0.2);
    expect(getStandardRateAsOf('EE', '2024-06-01')).toBe(0.22);
    expect(getStandardRateAsOf('EE', '2025-08-01')).toBe(0.24);
  });

  it('treats effectiveFrom as inclusive and effectiveTo as exclusive', () => {
    expect(getStandardRateAsOf('RO', '2025-08-01')).toBe(0.21); // exact change day = new rate
    expect(getStandardRateAsOf('RO', '2025-07-31')).toBe(0.19); // day before = old rate
  });

  it('activates announced future changes automatically by date', () => {
    // Russia 20% -> 22% on 2026-01-01 (a row that was future-dated when authored)
    expect(getStandardRateAsOf('RU', '2025-12-31')).toBe(0.2);
    expect(getStandardRateAsOf('RU', '2026-01-01')).toBe(0.22);
  });

  it('resolves sub-national rows distinctly from the national row', () => {
    expect(resolveRateRow('CA', '2026-06-24')?.standardRate).toBe(0.05);
    expect(resolveRateRow('CA', '2026-06-24', { stateProvince: 'ON' })?.standardRate).toBe(0.13);
  });

  it('returns 0 for an unknown country', () => {
    expect(getStandardRateAsOf('XX', '2026-06-24')).toBe(0);
  });
});

describe('Flat view derivation', () => {
  it('every active national ledger row appears in COUNTRY_TAX_RATES', () => {
    for (const r of activeNationalRows('2026-06-24')) {
      expect(COUNTRY_TAX_RATES[r.countryCode]?.standardRate).toBe(r.standardRate);
    }
  });

  it('does not surface sub-national rows in the flat view', () => {
    // CA flat entry is the national 5%, not the 13% Ontario HST row
    expect(COUNTRY_TAX_RATES['CA'].standardRate).toBe(0.05);
  });
});
