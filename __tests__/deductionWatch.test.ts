/**
 * Rate Watch — deduction rates. @ai2/tax-plugins, embracingearth.space
 *
 * A deduction rate the authority has not published yet is stored as a
 * `null, verified: false` row, and the lookup refuses to quote a number for
 * it. That is safe but silent: nothing tells a human the ATO has since
 * published. These tests pin the three things the watch reports — a current
 * income year with no verified row, a stale citation, an upcoming row — using
 * fixtures for the edge cases (so the assertions do not rot when real rows are
 * appended) and fixed dates against the shipped data.
 *
 * Kept in its own file rather than rateWatch.test.ts so it composes with the
 * schedule watch (PR #47) without touching the same lines.
 */
import {
  analyzeDeductionRates,
  hasActionableDeductionFindings,
  shippedDeductionSeries,
  type DeductionSeries,
  type DeductionWatchFindings,
} from '../src/rateWatch';

const fixture = (rows: DeductionSeries['rows']): DeductionSeries[] => [
  {
    series: 'ZZ.fixture',
    countryCode: 'ZZ',
    label: 'Fixture rate',
    file: 'src/fixture.ts',
    incomeYearOf: (ymd) => (ymd.slice(5) >= '07-01' ? `${ymd.slice(0, 4)}-next` : `${Number(ymd.slice(0, 4)) - 1}-next`),
    format: (v) => `${Math.round(v * 100)}c`,
    rows,
  },
];

const published = { verified: true, sourceUrl: 'https://example.gov/rate', readOn: '2026-09-27' };

describe('analyzeDeductionRates — the current income year', () => {
  it('flags a current row with no verified rate', () => {
    const f = analyzeDeductionRates(
      '2026-09-27',
      {},
      fixture([
        { effectiveFrom: '2026-07-01', value: null, verified: false, sourceUrl: 'https://example.gov/rate', readOn: '2026-09-27' },
        { effectiveFrom: '2024-07-01', value: 0.7, ...published },
      ]),
    );
    expect(f.unverifiedCurrent).toEqual([
      expect.objectContaining({ series: 'ZZ.fixture', effectiveFrom: '2026-07-01', incomeYear: '2026-next', reason: expect.stringMatching(/no verified rate/) }),
    ]);
    expect(hasActionableDeductionFindings(f)).toBe(true);
  });

  it('is quiet the day before the unpublished row starts, and flags it on the day', () => {
    const rows: DeductionSeries['rows'] = [
      { effectiveFrom: '2026-07-01', value: null, verified: false },
      { effectiveFrom: '2024-07-01', value: 0.7, ...published },
    ];
    expect(analyzeDeductionRates('2026-06-30', {}, fixture(rows)).unverifiedCurrent).toEqual([]);
    expect(analyzeDeductionRates('2026-07-01', {}, fixture(rows)).unverifiedCurrent).toHaveLength(1);
  });

  it('treats a number marked unverified as unverified — the number does not rescue it', () => {
    const f = analyzeDeductionRates('2026-09-27', {}, fixture([{ effectiveFrom: '2026-07-01', value: 0.75, verified: false }]));
    expect(f.unverifiedCurrent).toHaveLength(1);
  });

  it('flags a verified row that cannot be staleness-checked', () => {
    const noDate = analyzeDeductionRates('2026-09-27', {}, fixture([{ effectiveFrom: '2026-07-01', value: 0.7, verified: true, sourceUrl: 'https://example.gov/rate' }]));
    expect(noDate.unverifiedCurrent[0].reason).toMatch(/no read date/);
    const noUrl = analyzeDeductionRates('2026-09-27', {}, fixture([{ effectiveFrom: '2026-07-01', value: 0.7, verified: true, readOn: '2026-09-27' }]));
    expect(noUrl.unverifiedCurrent[0].reason).toMatch(/no authority url/);
  });

  it('flags a series with no row covering today at all', () => {
    const f = analyzeDeductionRates('2026-09-27', {}, fixture([{ effectiveFrom: '2030-07-01', value: 0.7, ...published }]));
    expect(f.unverifiedCurrent[0].reason).toMatch(/no row covers today/);
  });

  it('derives the current row from the dates, not the literal order', () => {
    const f = analyzeDeductionRates(
      '2026-09-27',
      {},
      fixture([
        { effectiveFrom: '2024-07-01', value: 0.7, ...published },
        { effectiveFrom: '2026-07-01', value: null, verified: false },
      ]),
    );
    expect(f.unverifiedCurrent.map((u) => u.effectiveFrom)).toEqual(['2026-07-01']);
  });
});

describe('analyzeDeductionRates — stale citations', () => {
  const rows = [{ effectiveFrom: '2024-07-01', value: 0.7, verified: true, sourceUrl: 'https://example.gov/rate', readOn: '2025-08-01' }];

  it('flags a citation older than 365 days, and not a day sooner', () => {
    expect(analyzeDeductionRates('2026-08-01', {}, fixture(rows)).staleCitations).toEqual([]);
    expect(analyzeDeductionRates('2026-08-02', {}, fixture(rows)).staleCitations).toEqual([
      expect.objectContaining({ series: 'ZZ.fixture', readOn: '2025-08-01', ageDays: 366, sourceUrl: 'https://example.gov/rate' }),
    ]);
  });

  it('honours a custom threshold', () => {
    expect(analyzeDeductionRates('2025-09-01', { staleAfterDays: 30 }, fixture(rows)).staleCitations).toHaveLength(1);
  });

  it('judges only the row in force — an old citation on a past row is not re-litigated', () => {
    const f = analyzeDeductionRates(
      '2026-09-27',
      {},
      fixture([
        { effectiveFrom: '2026-07-01', value: 0.75, ...published },
        { effectiveFrom: '2020-07-01', value: 0.52, verified: true, sourceUrl: 'https://example.gov/old', readOn: '2021-01-01' },
      ]),
    );
    expect(f.staleCitations).toEqual([]);
    expect(hasActionableDeductionFindings(f)).toBe(false);
  });
});

describe('analyzeDeductionRates — upcoming rows', () => {
  it('lists future rows as FYI, with the value only when it is verified', () => {
    const f = analyzeDeductionRates(
      '2026-09-27',
      {},
      fixture([
        { effectiveFrom: '2028-07-01', value: 0.95, ...published },
        { effectiveFrom: '2027-07-01', value: null, verified: false },
        { effectiveFrom: '2026-07-01', value: 0.91, ...published },
      ]),
    );
    expect(f.upcoming.map((u) => [u.effectiveFrom, u.value, u.verified])).toEqual([
      ['2027-07-01', null, false],
      ['2028-07-01', '95c', true],
    ]);
    expect(hasActionableDeductionFindings(f)).toBe(false);
  });
});

describe('hasActionableDeductionFindings', () => {
  const empty: DeductionWatchFindings = { asOf: '2026-09-27', unverifiedCurrent: [], staleCitations: [], upcoming: [] };
  const id = { series: 'ZZ.x', countryCode: 'ZZ', label: 'x', incomeYear: '2026-27', file: 'f' };

  it('is false for upcoming rows alone', () => {
    expect(hasActionableDeductionFindings({ ...empty, upcoming: [{ ...id, effectiveFrom: '2027-07-01', value: null, verified: false }] })).toBe(false);
  });

  it('is true for an unverified current row or a stale citation', () => {
    expect(hasActionableDeductionFindings({ ...empty, unverifiedCurrent: [{ ...id, effectiveFrom: '2026-07-01', reason: 'r' }] })).toBe(true);
    expect(hasActionableDeductionFindings({ ...empty, staleCitations: [{ ...id, readOn: '2025-01-01', ageDays: 400, sourceUrl: 'u' }] })).toBe(true);
  });
});

describe('analyzeDeductionRates — the shipped data', () => {
  // The AU series; the home-rule series (GB, US, NZ) have their own suite in homeRules.test.ts.
  const au = () => shippedDeductionSeries().filter((s) => s.countryCode === 'AU');

  it('watches the AU fixed rate, cents per km and the instant asset write-off, then the home-rule figures', () => {
    expect(shippedDeductionSeries().map((s) => s.series)).toEqual([
      'AU.workFromHomeFixedRate',
      'AU.centsPerKm',
      'AU.instantAssetWriteOff',
      'GB.rentARoom',
      'US.homeOfficeSimplifiedMethod',
      'NZ.homeOfficeSquareMetreRate',
      'NZ.boarderStandardCost',
    ]);
  });

  it('as of 27 September 2026: flags the 2026-27 fixed rate, and nothing else as current', () => {
    const f = analyzeDeductionRates('2026-09-27', {}, au());
    expect(f.unverifiedCurrent.map((u) => `${u.series}:${u.incomeYear}`)).toEqual(['AU.workFromHomeFixedRate:2026-27']);
    expect(f.staleCitations).toEqual([]);
    expect(f.upcoming.map((u) => `${u.series}:${u.incomeYear}:${u.value}`)).toEqual(['AU.centsPerKm:2027-28:null']);
  });

  it('on 30 June 2026 the fixed rate is still verified (2025-26), so nothing is flagged', () => {
    expect(analyzeDeductionRates('2026-06-30', {}, au()).unverifiedCurrent).toEqual([]);
  });

  it('WILL flag every citation read on 27 September 2026 as stale a year and a day later', () => {
    const f = analyzeDeductionRates('2027-09-28', {}, au());
    // 2027-28: cents per km has no rate yet, so it is unverified rather than stale.
    expect(f.unverifiedCurrent.map((u) => u.series).sort()).toEqual(['AU.centsPerKm', 'AU.workFromHomeFixedRate']);
    expect(f.staleCitations.map((s) => s.series)).toEqual(['AU.instantAssetWriteOff']);
  });
});
