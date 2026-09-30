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
    // The same $100,000 growth runs over the combined window (from the EARLIER first use, 2021-07-01, to the
    // sale). The letting tab run on its own, fed the same $100,000, measures it over the letting's 912 days
    // only, so it gets the full share (0.20) of growth: 100,000 * 0.20 * 0.5 discount * 0.32 = $3,200.
    // Attributed out of the combined figure, its 912 days are ~62% of the 1,461-day window — smaller. This is
    // why the two calculators run separately overstate the letting's CGT here.
    expect(r.cgt.letPart.wholeAtTodaysRules).toBeLessThan(r.cgt.sumOfSeparate.wholeAtTodaysRules - r.cgt.businessPart.wholeAtTodaysRules);
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

describe('review fixes (PR #61)', () => {
  const staggered: HomeMixedUseInput = {
    ...sameStart,
    business: { sharePct: 35, start: '2021-07-01' },
    letting: { sharePct: 20, start: '2023-01-01', weeklyRent: 300, homeCostsPerYear: 15_000 },
  };

  it('letting starting after the business: the verdict base measures the letting on the growth over ITS OWN days, not the whole expectedGrowth', () => {
    const r = homeMixedUseComparison(staggered);
    if (!r.supported) throw new Error('AU');
    // expectedGrowth (100,000) runs from the first income use, 2021-07-01, over 1,461 days. With no business use,
    // the letting would be measured from 2023-01-01 on the growth over its own 912 days: 100,000 * 912/1461 * 0.20
    // * 0.5 * 0.32 = 1,997.54 — not the whole 100,000 * 0.20 * 0.16 = 3,200.
    expect(r.cgt.lettingAlone.wholeAtTodaysRules).toBeCloseTo((100_000 * 912 * 0.2 * 0.16) / 1461, 1);
    // So the extra CGT a place of business adds is the business's own 35% over all 1,461 days: 5,600.
    expect(r.placeOfBusiness.weighed.cgt).toBeCloseTo(100_000 * 0.35 * 0.16, 0);
    // Running the two tabs side by side (each fed the same 100,000) still gives 5,600 + 3,200.
    expect(r.cgt.sumOfSeparate.wholeAtTodaysRules).toBeCloseTo(5600 + 3200, 1);
  });

  it('letting starting after the business, valuations given: the letting-alone base uses the value growth per day, not all of it over the letting\'s days', () => {
    const r = homeMixedUseComparison({
      ...staggered,
      letting: { ...staggered.letting, start: '2025-07-01' },
      saleDate: '2029-06-30',
      homeValueAtFirstUse: 800_000,
      valueAt30June2027: 900_000,
    });
    if (!r.supported) throw new Error('AU');
    // 100,000 of value growth over 2021-07-01..2027-06-30 (2,191 days); the letting's 730 of them at 20%.
    expect(r.cgt.lettingAlone.counted).toBeCloseTo((100_000 * 730 * 0.2 * 0.16) / 2191, 1);
  });

  it('maxCombinedSharePct is the largest share on any one day, not every span that touches the letting', () => {
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
    expect(r.maxCombinedSharePct).toBe(55);
  });

  it('validation: overlapping business periods are refused, as homeSpaceComparison refuses them', () => {
    const problems = validateHomeMixedUse({
      ...sameStart,
      business: {
        usePeriods: [
          { start: '2021-07-01', end: '2023-06-30', sharePct: 40 },
          { start: '2022-07-01', end: '2025-06-30', sharePct: 40 },
        ],
      },
    });
    expect(problems.map((p) => p.field)).toContain('business.usePeriods');
  });

  it('validation: an empty usePeriods list is refused', () => {
    expect(validateHomeMixedUse({ ...sameStart, business: { usePeriods: [] } }).map((p) => p.field)).toContain('business.usePeriods');
  });

  it('validation: business.end after the sale is refused (it would add deduction years past the sale)', () => {
    const problems = validateHomeMixedUse({ ...sameStart, business: { sharePct: 35, start: '2021-07-01', end: '2027-06-30' } });
    expect(problems.map((p) => p.field)).toEqual(['business.end']);
  });

  it('validation: exclusivePct + sharedPct ÷ sharedBy over 100% is refused even with no overlapping business use', () => {
    const problems = validateHomeMixedUse({
      ...sameStart,
      business: { sharePct: 0, start: '2021-07-01' },
      letting: { exclusivePct: 80, sharedPct: 60, sharedBy: 1, start: '2021-07-01', weeklyRent: 300, homeCostsPerYear: 15_000 },
    });
    expect(problems.map((p) => p.field)).toEqual(['letting.exclusivePct']);
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
