/**
 * homeSpaceComparison / recommendHomeSpace — like with like — ai2fin.com
 *
 * The bug these lock out: four years of occupancy deductions were weighed
 * against CGT on the growth to 30 June 2027 only, so a place of business
 * looked better than a desk when it was not. The owner's two cases must come
 * out as a desk.
 */
import {
  homeSpaceComparison,
  recommendHomeSpace,
  validateHomeSpaceComparison,
  isAboutEven,
  type HomeSpaceComparison,
  type HomeSpaceComparisonInput,
} from '../src/decisions/homeSpaceComparison';
import { homeBusinessSpaceTradeoff, DecisionInputError } from '../src/decisions/homeProperty';
import { AU_HOME_SPACE_FIGURES } from '../src/decisions/homeSpaceRates';

const base: HomeSpaceComparisonInput = {
  businessSharePct: 35,
  occupancyCostsPerYear: 9600,
  marginalRatePct: 32,
  businessUseStart: '2025-07-01',
  saleDate: '2029-06-30',
  expectedGrowth: 100_000,
};

function cmp(over: Partial<HomeSpaceComparisonInput> = {}): HomeSpaceComparison {
  const r = homeSpaceComparison({ ...base, ...over });
  if (!r.supported) throw new Error('AU must be supported');
  return r;
}

describe("the owner's cases: the desk must win", () => {
  it('Case A — 35%, $9,600, 32%, 1 Jul 2025 to a 30 Jun 2029 sale, $100k growth: desk about $648 better to June 2027', () => {
    const c = cmp();
    expect(c.partial).toBe(true);
    expect(c.use.pre).toBe(2);
    expect(c.use.post).toBe(2);
    expect(c.deductions.pre).toBeCloseTo(2150.4, 2);
    expect(c.cgt.counted).toBeCloseTo((100_000 * 0.35 * 730) / 1461 * 0.5 * 0.32, 1); // $2,797.97
    expect(Math.round(c.cgt.counted)).toBe(2798);
    // The later period at today's rules: $2,150 of deductions against about $2,802 of CGT.
    expect(c.deductions.post).toBeCloseTo(2150.4, 2);
    expect(Math.round(c.cgt.laterAtTodaysRules)).toBe(2802);

    const v = recommendHomeSpace(c);
    expect(v.verdict).toBe('desk');
    expect(v.amount).toBe(648);
    expect(v.net).toBeLessThan(0);
    expect(v.tones).toEqual({ placeOfBusiness: 'worse', desk: 'better' });
    expect(v.weighed).toEqual({ scope: 'toJune2027', deductions: 2150, cgt: 2798 });
    expect(v.later).toEqual({ deductions: 2150, cgt: 2802, net: -652, basis: 'todaysRules' });
  });

  it('Case B — the same with 45% and 39%: desk about $1,015 better', () => {
    const c = cmp({ businessSharePct: 45, marginalRatePct: 39 });
    const v = recommendHomeSpace(c);
    expect(v.verdict).toBe('desk');
    expect(v.amount).toBe(1015);
    expect(v.tones.desk).toBe('better');
  });

  it('the old whole-period sum would have said a place of business — the new one does not', () => {
    const c = cmp();
    const oldNet = c.deductions.total - c.cgt.counted; // four years of deductions vs CGT to June 2027
    expect(oldNet).toBeGreaterThan(0);
    expect(recommendHomeSpace(c).verdict).toBe('desk');
  });
});

describe('agrees with homeBusinessSpaceTradeoff where both apply', () => {
  it('whole income years: the same CGT to 30 June 2027 and on the whole gain', () => {
    const c = cmp();
    const r = homeBusinessSpaceTradeoff({ ...base, incomeYear: '2025-26', years: 4, runningCostsPerYear: 0 } as never);
    if (!r.supported) throw new Error('AU');
    expect(c.cgt.counted).toBeCloseTo(r.cgt.preJuly2027.tax, 2);
    expect(c.cgt.wholeAtTodaysRules).toBeCloseTo(r.cgt.currentLaw.tax, 2);
    expect(c.deductions.total).toBeCloseTo(r.extraDeductions.taxValue, 2);
  });

  it('a sale before 1 July 2027: the ATO example (35% of $9,600, 4 years, 32%) — break-even $76,800', () => {
    const c = cmp({ businessUseStart: '2021-07-01', saleDate: '2025-06-30', expectedGrowth: 50_000 });
    expect(c.partial).toBe(false);
    expect(c.cgt.basis).toBe('whole gain — sale before 1 July 2027');
    expect(c.deductions.total).toBeCloseTo(4300.8, 2);
    expect(c.breakEvenGrowth).toBe(76_800);
    const v = recommendHomeSpace(c);
    expect(v.verdict).toBe('placeOfBusiness');
    expect(v.amount).toBe(1501);
    expect(v.weighed.scope).toBe('wholePeriod');
    expect(v.later).toBeNull();
  });
});

describe('years of use are counted by day', () => {
  it('1 June to 15 July is about 0.12 of a year, not two years', () => {
    const c = cmp({ businessUseStart: '2025-06-01', businessUseEnd: '2025-07-15', saleDate: '2026-06-30' });
    expect(c.use.byYear.map((y) => y.label)).toEqual(['2024-25', '2025-26']);
    expect(c.use.total).toBeCloseTo(30 / 365 + 15 / 365, 3);
  });

  it('a mid-year start: 1 January 2026 is 181 of 365 days of 2025-26', () => {
    const c = cmp({ businessUseStart: '2026-01-01', saleDate: '2027-06-30' });
    expect(c.use.byYear[0]).toMatchObject({ label: '2025-26', days: 181 });
    expect(c.use.pre).toBeCloseTo(181 / 365 + 1, 4);
    expect(c.deductions.total).toBeCloseTo(9600 * 0.35 * (181 / 365 + 1) * 0.32, 1);
    expect(c.partial).toBe(false);
    expect(c.cgt.discountApplies).toBe(true);
  });

  it('several dated periods, each at its own share', () => {
    const c = cmp({
      businessSharePct: undefined,
      businessUseStart: undefined,
      usePeriods: [
        { start: '2025-07-01', end: '2026-06-30', sharePct: 20 },
        { start: '2026-07-01', end: '2027-06-30', sharePct: 40 },
      ],
      saleDate: '2027-06-30',
    });
    expect(c.deductionAmounts.total).toBeCloseTo(9600 * 0.2 + 9600 * 0.4, 2);
    // Non-exempt share: Σ share × days ÷ days from first use to sale.
    const frac = (0.2 * 365 + 0.4 * 365) / 730;
    expect(c.cgt.wholeAtTodaysRules).toBeCloseTo(100_000 * frac * 0.5 * 0.32, 2);
  });
});

describe('the later period and the states it can lead to', () => {
  it('pre-2027 favours a place of business, later growth favours a desk: "depends on growth after June 2027"', () => {
    // The values say little growth before July 2027 and a lot after.
    const c = cmp({ saleDate: '2031-06-30', expectedGrowth: 200_000, homeValueAtFirstUse: 800_000, valueAt30June2027: 810_000 });
    expect(c.cgt.basis).toBe('valuations supplied');
    expect(c.cgt.counted).toBeCloseTo(10_000 * 0.35 * 0.5 * 0.32, 2);
    const later = c.cgt.laterAtNewRules;
    expect(later).not.toBeNull();
    // September 2027 quarter to June 2031 quarter: 15 quarters at an assumed 2.5% a year.
    expect(later!.indexFactor).toBeCloseTo(1.025 ** (15 / 4), 4);
    expect(later!.cpi).toBe(AU_HOME_SPACE_FIGURES.cpiAssumption);
    expect(later!.gain).toBeCloseTo((1_000_000 - 810_000 * 1.025 ** (15 / 4)) * 0.35, 0);
    expect(later!.ratePct).toBe(32);
    const v = recommendHomeSpace(c);
    expect(v.verdict).toBe('dependsOnLater');
    expect(v.net).toBeGreaterThan(0);
    expect(v.later!.basis).toBe('newRulesEstimate');
    expect(v.later!.net).toBeLessThan(0);
    expect(v.tones).toEqual({ placeOfBusiness: 'neutral', desk: 'neutral' });
  });

  it('a low marginal rate is taxed at the 30% minimum in the estimate', () => {
    const c = cmp({ marginalRatePct: 19, saleDate: '2031-06-30', homeValueAtFirstUse: 800_000, valueAt30June2027: 850_000 });
    expect(c.cgt.laterAtNewRules!.ratePct).toBe(30);
  });

  it('use starting on or after 1 July 2027: "can\'t be weighed yet"', () => {
    const c = cmp({ businessUseStart: '2027-07-01', saleDate: '2030-06-30' });
    expect(c.notYet).toBe(true);
    expect(c.use.pre).toBe(0);
    const v = recommendHomeSpace(c);
    expect(v.verdict).toBe('notYet');
    expect(v.amount).toBe(0);
    expect(v.later).toMatchObject({ deductions: Math.round(c.deductions.total), basis: 'todaysRules' });
    // With the value at first use the later CGT is an estimate under the new rules, indexed from the first quarter.
    const e = cmp({ businessUseStart: '2027-07-01', saleDate: '2030-06-30', homeValueAtFirstUse: 900_000 });
    expect(e.cgt.laterAtNewRules!.indexFactor).toBeCloseTo(1.025 ** (11 / 4), 4);
    expect(recommendHomeSpace(e).later!.basis).toBe('newRulesEstimate');
  });

  it('a notYet state is never triggered by zero occupancy costs when use started before July 2027', () => {
    const c = cmp({ occupancyCostsPerYear: 0 });
    expect(c.notYet).toBe(false);
    expect(recommendHomeSpace(c).verdict).not.toBe('notYet');
  });

  it('about even on both sides: "even"', () => {
    // Growth at the break-even point: deductions and CGT match on each side of 30 June 2027.
    const c = cmp({ expectedGrowth: 76_800 });
    expect(recommendHomeSpace(c).verdict).toBe('even');
  });
});

describe('renting and co-owners', () => {
  it('renting: no gain, so the occupancy deductions are all there is', () => {
    const c = cmp({ renting: true });
    expect(c.partial).toBe(false);
    expect(c.cgt.counted).toBe(0);
    expect(c.cgt.basis).toBe('renting — no gain');
    expect(c.breakEvenGrowth).toBeNull();
    expect(recommendHomeSpace(c).verdict).toBe('placeOfBusiness');
  });

  it('a co-owner who does not run the business: nothing either way, and the full exemption', () => {
    const c = cmp({ ownerRunsBusiness: false });
    expect(c.deductions.total).toBe(0);
    expect(c.cgt.wholeAtTodaysRules).toBe(0);
    expect(recommendHomeSpace(c).verdict).toBe('even');
    expect(c.notes.map((n) => n.rule)).toContain('coOwnerNotInBusiness');
  });
});

describe('input and country', () => {
  it('refuses impossible input with every problem listed', () => {
    const bad = { ...base, marginalRatePct: 120, saleDate: '2024-01-01' };
    expect(validateHomeSpaceComparison(bad).map((p) => p.field).sort()).toEqual(['marginalRatePct', 'saleDate']);
    expect(() => homeSpaceComparison(bad)).toThrow(DecisionInputError);
  });

  it('refuses overlapping periods and periods after the sale', () => {
    const p = validateHomeSpaceComparison({
      ...base,
      businessSharePct: undefined,
      businessUseStart: undefined,
      usePeriods: [
        { start: '2025-07-01', end: '2026-06-30', sharePct: 20 },
        { start: '2026-06-01', end: '2030-06-30', sharePct: 20 },
      ],
    });
    expect(p.map((x) => x.field)).toEqual(['usePeriods[1].end']);
    const o = validateHomeSpaceComparison({
      ...base,
      businessSharePct: undefined,
      businessUseStart: undefined,
      usePeriods: [
        { start: '2025-07-01', end: '2026-06-30', sharePct: 20 },
        { start: '2026-06-01', end: '2027-06-30', sharePct: 20 },
      ],
    });
    expect(o.map((x) => x.message).join()).toMatch(/overlap/);
  });

  it('another country: unsupported, with no numbers', () => {
    const r = homeSpaceComparison({ ...base, country: 'fr' });
    expect(r.supported).toBe(false);
    expect(r).not.toHaveProperty('deductions');
  });

  it('"about even" is within 5% of the larger side, or under 100', () => {
    expect(isAboutEven(214, 4300, 4100)).toBe(true);
    expect(isAboutEven(216, 4320, 4104)).toBe(false);
    expect(isAboutEven(99, 500, 401)).toBe(true);
    expect(isAboutEven(-101, 0, 101)).toBe(false);
  });

  it('the pre-2027 split without values is labelled an assumption, not the law', () => {
    const c = cmp();
    expect(c.cgt.basis).toBe('even growth by day to 30 June 2027');
    expect(c.assumptions.growth).toMatch(/assumed/);
    expect(c.notes.find((n) => n.rule === 'cgtFrom1July2027')!.text).toMatch(/draft apportioning method compounds daily/);
  });
});
