/**
 * homeMixedUseComparison — a home that is a place of business AND let at the
 * same time — ai2fin.com
 *
 * The check the owner asked for: the combined CGT is NOT simply the sum of
 * running the business calculator and the letting calculator separately.
 */
import {
  homeMixedUseComparison,
  validateHomeMixedUse,
  type HomeMixedUseInput,
} from '../src/decisions/homeMixedUse';
import { homeSpaceComparison } from '../src/decisions/homeSpaceComparison';
import { roomOrPartnerArrangement, DecisionInputError } from '../src/decisions/homeProperty';

const sameStart: HomeMixedUseInput = {
  business: { sharePct: 35, start: '2021-07-01' },
  letting: { sharePct: 20, start: '2021-07-01', weeklyRent: 300, homeCostsPerYear: 15_000 },
  saleDate: '2025-06-30',
  occupancyCostsPerYear: 9600,
  marginalRatePct: 32,
  expectedGrowth: 100_000,
};

describe('business 35% + let 20% = 55% non-exempt', () => {
  it('the combined CGT is on the 55% share, not two separate 35% and 20% calculations added together', () => {
    const r = homeMixedUseComparison(sameStart);
    if (!r.supported) throw new Error('AU must be supported');
    expect(r.maxCombinedSharePct).toBe(55);
    // Whole gain (sale before 1 July 2027): 100,000 * 0.55 * 0.5 (discount) * 0.32 = 8,800.
    expect(r.cgt.combined.wholeAtTodaysRules).toBeCloseTo(8800, 1);
  });

  it('same start date: the combined figure DOES equal the sum of the two separate calculators (linear in share)', () => {
    const r = homeMixedUseComparison(sameStart);
    if (!r.supported) throw new Error('AU');
    expect(r.cgt.combined.wholeAtTodaysRules).toBeCloseTo(r.cgt.sumOfSeparate.wholeAtTodaysRules, 1);
    expect(r.cgt.sumOfSeparate.wholeAtTodaysRules).toBeCloseTo(r.cgt.businessPart.wholeAtTodaysRules + r.cgt.letPart.wholeAtTodaysRules, 1);
  });

  it('different start dates: the combined figure is NOT the sum of the two separate calculators', () => {
    const staggered: HomeMixedUseInput = {
      ...sameStart,
      business: { sharePct: 35, start: '2021-07-01' },
      letting: { sharePct: 20, start: '2023-01-01', weeklyRent: 300, homeCostsPerYear: 15_000 },
    };
    const r = homeMixedUseComparison(staggered);
    if (!r.supported) throw new Error('AU');
    expect(r.firstIncomeUse).toBe('2021-07-01');
    expect(r.cgt.combined.wholeAtTodaysRules).not.toBeCloseTo(r.cgt.sumOfSeparate.wholeAtTodaysRules, 1);
    // The same $100,000 growth is spread over the combined window (from the EARLIER first use, 2021-07-01,
    // to the sale) rather than the letting's own shorter window (from 2023-01-01). Measured on its own,
    // the letting's 911 own-days are 100% of its own total days, so it gets the full share (0.20) of growth:
    // 100,000 * 0.20 * 0.5 discount * 0.32 = $3,200. Attributed out of the combined figure, its 911 days are
    // only ~62% of the combined 1,461-day window, so its slice is smaller — the business's earlier years
    // dilute it. This is why the two calculators run separately would overstate the letting's own CGT here.
    expect(r.cgt.letPart.wholeAtTodaysRules).toBeLessThan(r.cgt.lettingAlone.wholeAtTodaysRules);
  });

  it('occupancy deductions are on the business share only; rent and its costs on the let share only', () => {
    const r = homeMixedUseComparison(sameStart);
    if (!r.supported) throw new Error('AU');
    expect(r.businessDeductions.total).toBeCloseTo(9600 * 0.35 * 4 * 0.32, 1);
    expect(r.letting.rent).toBeCloseTo(300 * 52 * 4, 1);
    expect(r.letting.deductions).toBeCloseTo(15_000 * 0.2 * 4, 1);
  });

  it('validation refuses shares that exceed 100% together on an overlapping day', () => {
    const bad: HomeMixedUseInput = { ...sameStart, business: { sharePct: 60, start: '2021-07-01' }, letting: { ...sameStart.letting, sharePct: 50 } };
    const problems = validateHomeMixedUse(bad);
    expect(problems.map((p) => p.field)).toEqual(['letting.sharePct']);
    expect(() => homeMixedUseComparison(bad)).toThrow(DecisionInputError);
  });

  it('overlapping shares are fine when they do not exceed 100% together, and no overlap is always fine', () => {
    expect(validateHomeMixedUse(sameStart)).toEqual([]);
    const sequential: HomeMixedUseInput = {
      ...sameStart,
      business: { sharePct: 60, start: '2021-07-01', end: '2022-06-30' },
      letting: { ...sameStart.letting, sharePct: 50, start: '2022-07-01' },
    };
    expect(validateHomeMixedUse(sequential)).toEqual([]);
  });

  it('a sale on or after 1 July 2027: the combined figure is weighed to 30 June 2027, like homeSpaceComparison', () => {
    const r = homeMixedUseComparison({ ...sameStart, saleDate: '2029-06-30' });
    if (!r.supported) throw new Error('AU');
    expect(r.partial).toBe(true);
    expect(r.cgt.basis).toBe('even growth by day to 30 June 2027');
  });

  it('with the home\'s values given, the split uses them (valuations supplied)', () => {
    const r = homeMixedUseComparison({ ...sameStart, saleDate: '2029-06-30', homeValueAtFirstUse: 800_000, valueAt30June2027: 810_000 });
    if (!r.supported) throw new Error('AU');
    expect(r.cgt.basis).toBe('valuations supplied');
  });

  it('the place-of-business verdict is on the EXTRA CGT the business adds on top of the letting', () => {
    const r = homeMixedUseComparison(sameStart);
    if (!r.supported) throw new Error('AU');
    expect(r.placeOfBusiness.weighed.cgt).toBeCloseTo(r.cgt.combined.counted - r.cgt.lettingAlone.counted, 0);
  });

  it('letting alone with no business use matches roomOrPartnerArrangement (a lodger)', () => {
    const r = homeMixedUseComparison({ ...sameStart, business: { sharePct: 0, start: '2021-07-01' } });
    if (!r.supported) throw new Error('AU');
    const lodger = roomOrPartnerArrangement({
      kind: 'lodger',
      letSharePct: 20,
      weeklyRent: 300,
      homeCostsPerYear: 15_000,
      marginalRatePct: 32,
      years: 4,
      firstLetDate: '2021-07-01',
      saleDate: '2025-06-30',
      expectedGrowth: 100_000,
    });
    if (!lodger.supported || lodger.kind !== 'lodger') throw new Error('lodger');
    expect(r.cgt.combined.wholeAtTodaysRules).toBeCloseTo(lodger.cgt.tax, 0);
  });

  it('another country: unsupported, no numbers', () => {
    const r = homeMixedUseComparison({ ...sameStart, country: 'US' });
    expect(r.supported).toBe(false);
  });

  it('several dated business periods combine with the letting correctly', () => {
    const r = homeMixedUseComparison({
      ...sameStart,
      business: {
        usePeriods: [
          { start: '2021-07-01', end: '2022-06-30', sharePct: 20 },
          { start: '2022-07-01', end: '2025-06-30', sharePct: 35 },
        ],
      },
    });
    if (!r.supported) throw new Error('AU');
    expect(r.businessDeductions.total).toBeCloseTo(9600 * 0.2 * 1 * 0.32 + 9600 * 0.35 * 3 * 0.32, 0);
  });
});

describe('homeSpaceComparison alone still ignores the letting (unchanged behaviour)', () => {
  it('is not affected by this module existing', () => {
    const r = homeSpaceComparison({
      businessSharePct: 35,
      occupancyCostsPerYear: 9600,
      marginalRatePct: 32,
      businessUseStart: '2021-07-01',
      saleDate: '2025-06-30',
      expectedGrowth: 100_000,
    });
    if (!r.supported) throw new Error('AU');
    expect(r.cgt.wholeAtTodaysRules).toBeGreaterThan(0);
  });
});
