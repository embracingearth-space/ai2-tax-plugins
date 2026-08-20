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

/**
 * The header of src/data/rateLedger.ts states five figures about this ledger,
 * and rows and countries are easy to conflate there — the paragraph previously
 * described "the 9 countries ... and the other 72", mixing a country count with
 * a row count so the two halves did not even refer to the same population.
 *
 * Lower bounds cannot catch that: they stay green while a rate change lands as
 * one more floor-anchored row, which is the direction the ledger actually drifts
 * in. These are exact ON PURPOSE. When the ledger legitimately grows, this test
 * fails and the doc comment gets updated in the same commit — which is the whole
 * point of pinning them.
 */
describe('the documented row and country counts are exact', () => {
  const dated = RATE_LEDGER.filter((r) => r.effectiveFrom !== RATE_FLOOR);
  const countries = new Set(RATE_LEDGER.map((r) => r.countryCode));
  const datedCountries = new Set(dated.map((r) => r.countryCode));

  it('has 102 rows, 71 of them floor-anchored', () => {
    expect(RATE_LEDGER.length).toBe(102);
    expect(RATE_LEDGER.length - dated.length).toBe(71);
    expect(dated.length).toBe(31);
  });

  it('covers 88 countries: 26 with a real date, 62 floor-only', () => {
    expect(countries.size).toBe(88);
    expect(datedCountries.size).toBe(26);
    expect([...countries].filter((c) => !datedCountries.has(c))).toHaveLength(62);
  });

  /** One rate SERIES: a country's rows for one stateProvince and one taxType. */
  const seriesKey = (r: (typeof RATE_LEDGER)[number]) =>
    `${r.countryCode}|${r.stateProvince ?? ''}|${r.taxType}`;

  const series = (() => {
    const m = new Map<string, typeof RATE_LEDGER>();
    for (const r of RATE_LEDGER) m.set(seriesKey(r), [...(m.get(seriesKey(r)) ?? []), r] as typeof RATE_LEDGER);
    return m;
  })();

  it('records an actual transition for exactly 9 countries', () => {
    // A transition needs two rows in the SAME series. Grouping by country alone
    // wrongly counted Canada for having two rows that are actually parallel
    // series — national GST and Ontario HST. Canada IS in this list now, but on
    // its own merit: its federal GST series runs 7% -> 6% -> 5%.
    const withTransition = [...series.entries()]
      .filter(([, rows]) => rows.length > 1)
      .map(([k]) => k.split('|')[0]);
    expect([...new Set(withTransition)].sort()).toEqual(['CA', 'EC', 'EE', 'FI', 'GH', 'IL', 'KZ', 'RO', 'RU']);

    // The distinction still holds where it matters: Ontario HST is its own
    // series with a single row, and does not make Canada a transition country
    // by itself.
    const ontario = RATE_LEDGER.filter((r) => r.countryCode === 'CA' && r.stateProvince === 'ON');
    expect(ontario).toHaveLength(1);
    expect(new Set(RATE_LEDGER.filter((r) => r.countryCode === 'CA').map(seriesKey)).size).toBe(2);
  });

  it('starts each series when its tax actually started, not at the floor', () => {
    // A series may legitimately begin late, and a continuity check cannot see a
    // series that begins too EARLY — which is how Ontario HST came to claim 13%
    // back to 2000. HST began 1 July 2010, replacing GST + Ontario RST.
    expect(resolveRateRow('CA', '2010-06-30', { stateProvince: 'ON' })).toBeUndefined();
    expect(resolveRateRow('CA', '2010-07-01', { stateProvince: 'ON' })?.standardRate).toBe(0.13);

    // Federal GST across its three eras. Before this, every pre-2008 date
    // answered 5%.
    expect(getStandardRateAsOf('CA', '2005-01-01')).toBe(0.07);
    expect(getStandardRateAsOf('CA', '2006-06-30')).toBe(0.07);
    expect(getStandardRateAsOf('CA', '2006-07-01')).toBe(0.06);
    expect(getStandardRateAsOf('CA', '2007-12-31')).toBe(0.06);
    expect(getStandardRateAsOf('CA', '2008-01-01')).toBe(0.05);
    expect(getStandardRateAsOf('CA', '2026-01-01')).toBe(0.05);
  });

  it('has no coverage gaps at all - every date resolves to exactly one row', () => {
    // Within a series the rows must tile: each effectiveTo is the next
    // effectiveFrom. Anywhere they do not, some date resolves to NO row and
    // getStandardRateAsOf reports 0, indistinguishable from a country that
    // genuinely levies nothing.
    //
    // This used to fail, silently, for Ghana: its 12.5% row ended 2023-01-01
    // and its 15% row did not start until 2026-01-01, so three years answered
    // "no VAT". The missing Act 1087 row closes it. Asserted as EMPTY rather
    // than as a known-exceptions list, so the next hole is a failure and not an
    // entry someone appends to.
    const gaps: string[] = [];
    for (const [key, rows] of series) {
      const sorted = [...rows].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].effectiveTo !== sorted[i + 1].effectiveFrom) {
          gaps.push(key + ' ' + sorted[i].effectiveTo + ' -> ' + sorted[i + 1].effectiveFrom);
        }
      }
    }
    expect(gaps).toEqual([]);
  });

  it('answers the two windows that were previously wrong', () => {
    // Ghana 2023-2025: no row applied, so the answer was 0 - "Ghana had no VAT".
    // Act 1087 raised it to 15% effective 1 January 2023.
    expect(getStandardRateAsOf('GH', '2022-06-01')).toBe(0.125);
    expect(getStandardRateAsOf('GH', '2024-06-01')).toBe(0.15);
    expect(getStandardRateAsOf('GH', '2026-06-01')).toBe(0.15);

    // Ecuador 12-31 March 2024: a twenty-day 13% band, set by the Ley Organica
    // para Enfrentar el Conflicto Armado Interno and superseded by Decreto
    // Ejecutivo 198 at 15% from 1 April. The 12% row used to run straight
    // through it, answering 12% where the law said 13%. A window this narrow is
    // exactly what a transaction-dated lookup exists to get right.
    expect(getStandardRateAsOf('EC', '2024-03-01')).toBe(0.12);
    expect(getStandardRateAsOf('EC', '2024-03-20')).toBe(0.13);
    expect(getStandardRateAsOf('EC', '2024-04-15')).toBe(0.15);
  });

  it('names an authority and a source URL on EVERY row', () => {
    // The point of an as-of lookup is that someone can check the answer. A row
    // that resolves without naming where its number came from cannot be checked,
    // and all nine historical rows were in that state until 2026-08-20.
    for (const r of RATE_LEDGER) {
      expect(r.source.authority.trim().length).toBeGreaterThan(0);
      expect(r.source.url).toMatch(/^https:[/][/]/); // https only — a plaintext citation can be altered in transit
      expect((r.source.note ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps `verified` a stricter claim than `has a citation`', () => {
    // verified means the cited page was read and agreed - not merely that a URL
    // is present. Israel is the one closed row that falls short: every gov.il
    // rate page returns HTTP 403 to automated fetches, so it is sourced to the
    // Knesset record of the order and left unverified rather than rounded up.
    const unverifiedClosed = RATE_LEDGER.filter((r) => r.effectiveTo && !r.source.verified);
    expect(unverifiedClosed.map((r) => r.countryCode)).toEqual(['IL']);
    for (const r of unverifiedClosed) {
      expect(r.source.authority.trim().length).toBeGreaterThan(0); // still cited
      expect(r.source.note ?? '').toMatch(/403|COULD NOT VERIFY|PARTIAL CITATION/i); // and says why
    }
  });
});
