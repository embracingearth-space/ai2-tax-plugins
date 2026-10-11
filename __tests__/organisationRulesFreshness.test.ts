/**
 * The organisation rules must not go stale silently — ai2fin.com
 *
 * THIS TEST USES TODAY'S DATE ON PURPOSE, like homeRatesFreshness. When it
 * fails, an organisation source or figure is past its `reviewBy` date: nobody
 * has re-read its page since. Do NOT move the date without reading the page.
 * Re-read it, fix the claim or the figure, set `readOn` to today and
 * `reviewBy` to the next review (src/decisions/organisationSources.ts). 2fin
 */
import { orgRulesInventory, orgRulesPastReview } from '../src/decisions/organisations';
import { toYmd } from '../src/data/rateLedger';

const today = toYmd(new Date());

describe('freshness gate — fails the build once an organisation rule is past its review date', () => {
  it(`no organisation source or figure is past its reviewBy date today (${today})`, () => {
    const stale = orgRulesPastReview(today).map((i) => `${i.series} (review due ${i.reviewBy}; re-read ${i.sourceUrl}; edit ${i.file})`);
    expect(stale).toEqual([]);
  });
});

describe('the gate itself (fixed dates)', () => {
  it('every item has a review date, a read date and an https source', () => {
    for (const i of orgRulesInventory()) {
      expect({ series: i.series, reviewBy: i.reviewBy, readOn: i.readOn }).toEqual({
        series: i.series,
        reviewBy: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        readOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      });
      expect(i.sourceUrl).toMatch(/^https:\/\//);
      expect(i.reviewBy > i.readOn).toBe(true);
    }
  });

  it('nothing is due on the day it was read', () => {
    expect(orgRulesPastReview('2026-10-11')).toEqual([]);
  });

  // Each country is re-read before its own next tax year: US (2027 filing season), IN (tax year 2027-28 from 1 April),
  // GB (6 April), AU (1 July). The day after its review date every one of its rows is due, and no row of a later country.
  const REVIEW_BY: Array<[string, string, string]> = [
    ['US', '2027-01-31', '2027-02-01'],
    ['CA', '2027-01-31', '2027-02-01'],
    ['IE', '2027-01-31', '2027-02-01'],
    ['IN', '2027-03-31', '2027-04-01'],
    ['NZ', '2027-03-31', '2027-04-01'],
    ['SG', '2027-03-31', '2027-04-01'],
    ['GB', '2027-04-05', '2027-04-06'],
    ['AU', '2027-06-30', '2027-07-01'],
  ];
  it.each(REVIEW_BY)('%s rows are due the day after %s, together with every earlier country', (country, reviewBy, dayAfter) => {
    const earlier = REVIEW_BY.filter(([, r]) => r <= reviewBy).map(([c]) => c);
    const due = orgRulesPastReview(dayAfter);
    expect(new Set(due.map((i) => i.country))).toEqual(new Set(earlier));
    expect(due.filter((i) => i.country === country).length).toBe(orgRulesInventory().filter((i) => i.country === country).length);
    expect(orgRulesPastReview(reviewBy).filter((i) => i.country === country)).toEqual([]);
  });

  it('every row of a country has that country\'s review date', () => {
    const byCountry = Object.fromEntries(REVIEW_BY.map(([c, r]) => [c, r]));
    for (const i of orgRulesInventory()) expect({ series: i.series, reviewBy: i.reviewBy }).toEqual({ series: i.series, reviewBy: byCountry[i.country] });
  });

  it('would fail on 6 April 2027 for every GB row, and not yet for AU', () => {
    const due = orgRulesPastReview('2027-04-06');
    expect(due.length).toBeGreaterThan(0);
    expect(due.some((i) => i.country === 'AU')).toBe(false);
    expect(due.map((i) => i.series)).toEqual(expect.arrayContaining(['ORG.GB.source.giftAidRate', 'ORG.GB.cc.receiptsAndPaymentsUpTo@2026-09-30', 'ORG.IN.source.inEightyFivePercent', 'ORG.US.irs.form990nGrossReceiptsUpTo']));
  });

  it('would fail on 1 July 2027 for AU too', () => {
    const due = orgRulesPastReview('2027-07-01').map((i) => i.series);
    expect(due).toEqual(expect.arrayContaining(['ORG.AU.source.mutuality', 'ORG.AU.acnc.smallUnder']));
    expect(due.length).toBe(orgRulesInventory().length);
  });
});
