/**
 * The home rules must not go stale silently — ai2fin.com
 *
 * THIS TEST USES TODAY'S DATE ON PURPOSE. When it fails, a home figure or rule
 * is past its `reviewBy` date: nobody has re-read its source since. Do NOT
 * move the date without reading the source. Follow the README, "Keeping the
 * home rules up to date": re-read the page, update the figure (or add the new
 * year's row), set `readOn` to today and `reviewBy` to the next review.
 */
import { homeRateInventory, homeRatesPastReview, homeFiguresPastReview, HOME_RATE_SERIES } from '../src/decisions/homeRatesFreshness';
import { analyzeDeductionRates, hasActionableDeductionFindings, shippedDeductionSeries } from '../src/rateWatch';
import { workFromHomeFixedRate, workFromHomeFixedRateOrEstimate } from '../src/countries/australiaDeductions';
import { AU_HOME_SPACE_FIGURES } from '../src/decisions/homeSpaceRates';
import { AU_HOME_PROPERTY_RULES } from '../src/decisions/homePropertyRules';
import { toYmd } from '../src/data/rateLedger';

// The local calendar day, the convention the freshness API uses for a Date
// (see toYmd) — toISOString() would still read 30 June at 00:30 on 1 July in Sydney.
const today = toYmd(new Date());

describe('freshness gate — fails the build once a home figure is past its review date', () => {
  it(`no home figure or rule is past its reviewBy date today (${today})`, () => {
    const stale = homeRatesPastReview(today).map((i) => `${i.series} (review due ${i.reviewBy ?? 'never set'}; re-read ${i.sourceUrl ?? 'the source'}; edit ${i.file})`);
    expect(stale).toEqual([]);
  });

  it('Rate Watch agrees: no watched home row is past its reviewBy today', () => {
    const f = analyzeDeductionRates(today);
    expect((f.pastReviewBy ?? []).map((r) => `${r.series} ${r.incomeYear} (due ${r.reviewBy})`)).toEqual([]);
  });
});

describe('the gate itself (fixed dates)', () => {
  it('every in-force home item has a review date and a source', () => {
    for (const i of homeRateInventory('2026-09-28')) {
      expect({ series: i.series, reviewBy: i.reviewBy }).toEqual({ series: i.series, reviewBy: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
      expect({ series: i.series, sourceUrl: i.sourceUrl }).toEqual({ series: i.series, sourceUrl: expect.stringMatching(/^https:\/\//) });
    }
  });

  it('covers every watched home series, the AU home-space figures and every AU rule', () => {
    const series = homeRateInventory('2026-09-28').map((i) => i.series);
    // Rate Watch and the freshness gate watch the same home series.
    const watched = shippedDeductionSeries().filter((x) => x.countryCode !== 'AU' || x.series === 'AU.workFromHomeFixedRate').map((x) => x.series);
    expect(HOME_RATE_SERIES.map((x) => x.series).sort()).toEqual([...watched].sort());
    for (const s of watched) expect(series).toContain(s);
    for (const k of Object.keys(AU_HOME_SPACE_FIGURES)) expect(series).toContain(`AU.homeSpace.${k}`);
    for (const k of Object.keys(AU_HOME_PROPERTY_RULES)) expect(series).toContain(`AU.rule.${k}`);
  });

  it('would fail on 1 January 2027: the check for the NZ 2027 income year figures is due', () => {
    const due = homeRatesPastReview('2027-01-01').map((i) => i.series);
    expect(due).toEqual(expect.arrayContaining(['NZ.homeOfficeSquareMetreRate', 'NZ.boarderStandardCost']));
    expect(due).not.toContain('GB.cgtBasicRate');
  });

  it('would fail on 16 February 2027 if nobody has checked the US 2027 figures', () => {
    const due = homeRatesPastReview('2027-02-16').map((i) => i.series);
    expect(due).toEqual(expect.arrayContaining(['US.homeOfficeSimplifiedMethod', 'US.unrecaptured1250MaxRate', 'US.homeOfficeRecoveryYears']));
  });

  it('would fail on 1 July 2027 for the AU 2027 figures and rules', () => {
    const due = homeFiguresPastReview('2027-07-01').map((i) => i.series);
    expect(due).toEqual(expect.arrayContaining(['AU.homeSpace.cpiAssumption', 'AU.homeSpace.minimumTaxRate', 'AU.rule.cgtFrom1July2027']));
  });

  it('Rate Watch reports a row past review as actionable', () => {
    const f = analyzeDeductionRates('2027-02-16');
    expect((f.pastReviewBy ?? []).map((r) => r.series)).toEqual(expect.arrayContaining(['US.homeOfficeSimplifiedMethod']));
    expect(hasActionableDeductionFindings(f)).toBe(true);
  });
});

describe('an unpublished year is an estimate, labelled as one', () => {
  it('2026-27 WFH fixed rate: not published, so the 2025-26 rate is offered as an estimate only', () => {
    expect(workFromHomeFixedRate('2026-27').rate).toBeNull(); // the return lookup never applies it
    const e = workFromHomeFixedRateOrEstimate('2026-27');
    expect(e).toMatchObject({ rate: 0.7, estimate: true, incomeYear: '2026-27', rateIncomeYear: '2025-26' });
    expect(e!.note).toBe('The 2026–27 rate is not published yet. The 2025–26 rate (70c an hour) is used as an estimate only — or use actual costs.');
  });
  it('a published year is not an estimate', () => {
    expect(workFromHomeFixedRateOrEstimate('2025-26')).toMatchObject({ rate: 0.7, estimate: false });
  });
});
