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

  it('would fail on 1 April 2027 for every IN row (tax year 2027-28), and not yet for GB or AU', () => {
    const due = orgRulesPastReview('2027-04-01');
    expect(new Set(due.map((i) => i.country))).toEqual(new Set(['IN']));
    expect(due.length).toBe(orgRulesInventory().filter((i) => i.country === 'IN').length);
    expect(due.map((i) => i.series)).toEqual(expect.arrayContaining(['ORG.IN.source.inEightyFivePercent', 'ORG.IN.gst.registrationOver']));
  });

  it('would fail on 6 April 2027 for every GB row, and not yet for AU', () => {
    const due = orgRulesPastReview('2027-04-06');
    expect(due.length).toBeGreaterThan(0);
    expect(new Set(due.map((i) => i.country))).toEqual(new Set(['GB', 'IN']));
    expect(due.map((i) => i.series)).toEqual(expect.arrayContaining(['ORG.GB.source.giftAidRate', 'ORG.GB.cc.receiptsAndPaymentsUpTo@2026-09-30']));
  });

  it('would fail on 1 July 2027 for AU too', () => {
    const due = orgRulesPastReview('2027-07-01').map((i) => i.series);
    expect(due).toEqual(expect.arrayContaining(['ORG.AU.source.mutuality', 'ORG.AU.acnc.smallUnder']));
    expect(due.length).toBe(orgRulesInventory().length);
  });
});
