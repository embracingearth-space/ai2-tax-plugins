/**
 * New Zealand depreciation tests — @ai2/tax-plugins
 * ai2fin.com
 *
 * The numeric cases are Inland Revenue's OWN worked example from "Work out
 * diminishing value depreciation": a $10,000 espresso machine at 30% DV. If one
 * of these fails, the plugin disagrees with IRD — do not "fix" the test.
 *
 * The months block is the rule that makes NZ a different regime from AU: a
 * part year is whole months ÷ 12, never a day fraction, and the engine refuses
 * a fraction of a month. The concession blocks are honesty tests: the low
 * value threshold and Investment Boost are effective-dated and carry their
 * `verified` state, and a date before 22 May 2025 gets no boost — null and
 * unverified, not 0% dressed as a fact.
 */

import {
  australiaPlugin,
  newZealandPlugin,
  getDepreciationRules,
  computeDeclineInValue,
  AU_DEPRECIATION_RULES,
  GENERIC_DEPRECIATION_RULES,
  NZ_DEPRECIATION_RULES,
  NZ_RATE_CATEGORIES,
  NZ_LOW_VALUE_ASSET_ROWS,
  NZ_INVESTMENT_BOOST_ROWS,
  NZ_POOLING_RULES,
  nzRateFor,
  nzWholeMonthsUsed,
  nzLowValueThreshold,
  nzInvestmentBoost,
  nzInvestmentBoostSplit,
  sortNewestFirst,
  resolveEffectiveDated,
  type DepreciationRules,
} from '../src';

const nz = NZ_DEPRECIATION_RULES;
const FULL_YEAR = { partYear: { kind: 'months', monthsUsed: 12 } } as const;

// ─── Wiring ─────────────────────────────────────────────────────────────────

describe('NZ depreciation — wiring and regime', () => {
  it('the New Zealand plugin hands back its own rules', () => {
    expect(getDepreciationRules(newZealandPlugin)).toBe(nz);
    expect(nz.countryCode).toBe('NZ');
  });

  it('is a rate-per-asset regime apportioned by whole months', () => {
    expect(nz.regime).toBe('rate_per_asset');
    expect(nz.partYear).toBe('months_whole');
    expect(nz.defaultMethod).toBe('diminishing_value');
    expect(nz.methods).toEqual(['prime_cost', 'diminishing_value', 'immediate_writeoff']);
    expect(nz.methods).not.toContain('pool');
  });

  it('every rules object declares its regime and vocabulary', () => {
    const all: DepreciationRules[] = [
      getDepreciationRules(australiaPlugin),
      nz,
      GENERIC_DEPRECIATION_RULES,
    ];
    expect(all.map((r) => r.regime)).toEqual(['effective_life', 'rate_per_asset', 'generic']);
    for (const r of all) {
      const e = r.explainer();
      expect(e.vocabulary.writtenDown).toBeTruthy();
      expect(e.vocabulary.decline).toBeTruthy();
      expect(e.howItWorks.length).toBeGreaterThanOrEqual(3);
      expect(typeof r.firstYearConcessions(new Date(2026, 0, 1))).toBe('object');
      expect(Array.isArray(r.extraAssetFields())).toBe(true);
    }
    expect(AU_DEPRECIATION_RULES.regime).toBe('effective_life');
  });

  it('AU and GENERIC explainers link only where they can', () => {
    const au = AU_DEPRECIATION_RULES.explainer();
    expect(au.readMore.map((r) => r.url)).toEqual([
      expect.stringContaining('ato.gov.au'),
      expect.stringContaining('ato.gov.au'),
    ]);
    expect(au.vocabulary.writtenDown).toBe('Adjustable value');
    expect(au.vocabulary.decline).toBe('Decline in value');

    const generic = GENERIC_DEPRECIATION_RULES.explainer();
    expect(generic.readMore).toEqual([]);
    expect(generic.whenItApplies).toMatch(/no country-specific/i);
    expect(GENERIC_DEPRECIATION_RULES.firstYearConcessions(new Date())).toEqual([]);
  });
});

// ─── IRD worked example ─────────────────────────────────────────────────────

describe('NZ depreciation — IRD worked example, diminishing value', () => {
  it('$10,000 espresso machine at 30% DV claims $3,000 and carries an adjusted tax value of $7,000', () => {
    const y1 = nz.declineInValue({
      method: 'diminishing_value',
      cost: 10000,
      openingAdjustableValue: 10000,
      annualRate: 0.3,
      ...FULL_YEAR,
    });
    expect(y1.declineInValue).toBe(3000);
    expect(y1.closingAdjustableValue).toBe(7000);
    expect(y1.rate).toBe(0.3);
  });

  it('year two is adjusted tax value × rate, not cost × rate', () => {
    const y2 = nz.declineInValue({
      method: 'diminishing_value',
      cost: 10000,
      openingAdjustableValue: 7000,
      annualRate: 0.3,
      ...FULL_YEAR,
    });
    expect(y2.declineInValue).toBe(2100);
    expect(y2.closingAdjustableValue).toBe(4900);
  });

  it('bought 20 May in an April year → 11 months → $2,750', () => {
    const months = nzWholeMonthsUsed(new Date(2025, 4, 20), new Date(2026, 2, 31));
    expect(months).toBe(11);
    const y1 = nz.declineInValue({
      method: 'diminishing_value',
      cost: 10000,
      openingAdjustableValue: 10000,
      annualRate: 0.3,
      partYear: { kind: 'months', monthsUsed: months },
    });
    expect(y1.declineInValue).toBe(2750);
    expect(y1.closingAdjustableValue).toBe(7250);
  });

  it('straight line is cost × SL rate every year, from cost not adjusted tax value', () => {
    const y1 = nz.declineInValue({
      method: 'prime_cost',
      cost: 10000,
      openingAdjustableValue: 10000,
      annualRate: 0.21,
      ...FULL_YEAR,
    });
    const y2 = nz.declineInValue({
      method: 'prime_cost',
      cost: 10000,
      openingAdjustableValue: y1.closingAdjustableValue,
      annualRate: 0.21,
      ...FULL_YEAR,
    });
    expect(y1.declineInValue).toBe(2100);
    expect(y2.declineInValue).toBe(2100);
    expect(y2.closingAdjustableValue).toBe(5800);
  });

  it('the published rate is applied as-is — no 200% multiplier, no life', () => {
    const r = nz.declineInValue({
      method: 'diminishing_value',
      cost: 1000,
      openingAdjustableValue: 1000,
      annualRate: 0.5,
      effectiveLifeYears: 4, // present but must be ignored
      heldBefore10May2006: true, // an ATO concept; must be ignored
      ...FULL_YEAR,
    });
    expect(r.rate).toBe(0.5);
    expect(r.declineInValue).toBe(500);
  });
});

// ─── Whole months ───────────────────────────────────────────────────────────

describe('NZ depreciation — a part year is whole months, part-months count as whole months', () => {
  const yearEnd = new Date(2026, 2, 31); // 31 March 2026

  it('the 1st and the 31st of the same month both count that month', () => {
    expect(nzWholeMonthsUsed(new Date(2025, 4, 1), yearEnd)).toBe(11);
    expect(nzWholeMonthsUsed(new Date(2025, 4, 31), yearEnd)).toBe(11);
  });

  it('bought on the first day of the income year is 12; bought in its last month is 1', () => {
    expect(nzWholeMonthsUsed(new Date(2025, 3, 1), yearEnd)).toBe(12);
    expect(nzWholeMonthsUsed(new Date(2026, 2, 1), yearEnd)).toBe(1);
    expect(nzWholeMonthsUsed('2026-03-31', '2026-03-31')).toBe(1);
  });

  it('clamps: an acquisition after the year end is 0, an earlier year is 12', () => {
    expect(nzWholeMonthsUsed(new Date(2026, 3, 1), yearEnd)).toBe(0);
    expect(nzWholeMonthsUsed(new Date(2020, 0, 1), yearEnd)).toBe(12);
  });

  it('the engine refuses a fraction of a month, or more than twelve', () => {
    const base = { method: 'diminishing_value', cost: 1000, openingAdjustableValue: 1000, annualRate: 0.3 } as const;
    expect(() =>
      computeDeclineInValue({ ...base, partYear: { kind: 'months', monthsUsed: 10.5 } }),
    ).toThrow(/whole number/);
    expect(() =>
      computeDeclineInValue({ ...base, partYear: { kind: 'months', monthsUsed: 13 } }),
    ).toThrow(/whole number/);
    expect(
      computeDeclineInValue({ ...base, partYear: { kind: 'months', monthsUsed: 0 } }).declineInValue,
    ).toBe(0);
  });

  it('the NZ rules refuse a days-based input rather than computing an ATO number', () => {
    expect(() =>
      nz.declineInValue({
        method: 'diminishing_value',
        cost: 1000,
        openingAdjustableValue: 1000,
        annualRate: 0.3,
        daysHeld: 365,
        daysInYear: 365,
      }),
    ).toThrow(/whole months/i);
  });

  it('the NZ rules refuse a missing rate rather than deriving one from a life', () => {
    expect(() =>
      nz.declineInValue({
        method: 'diminishing_value',
        cost: 1000,
        openingAdjustableValue: 1000,
        effectiveLifeYears: 4,
        ...FULL_YEAR,
      }),
    ).toThrow(/annualRate/);
  });

  it('the engine refuses a rate given as a percentage', () => {
    expect(() =>
      computeDeclineInValue({
        method: 'diminishing_value',
        cost: 1000,
        openingAdjustableValue: 1000,
        annualRate: 30,
        ...FULL_YEAR,
      }),
    ).toThrow(/fraction/);
  });

  it('the days form still works for everyone else, with the explicit partYear too', () => {
    const viaFields = computeDeclineInValue({
      method: 'prime_cost',
      cost: 2000,
      openingAdjustableValue: 2000,
      effectiveLifeYears: 10,
      daysHeld: 122,
      daysInYear: 365,
    });
    const viaPartYear = computeDeclineInValue({
      method: 'prime_cost',
      cost: 2000,
      openingAdjustableValue: 2000,
      effectiveLifeYears: 10,
      partYear: { kind: 'days', daysHeld: 122, daysInYear: 365 },
    });
    expect(viaFields.declineInValue).toBe(66.85);
    expect(viaPartYear.declineInValue).toBe(66.85);
  });

  it('a low value asset is written off in full with no month apportionment', () => {
    const r = nz.declineInValue({
      method: 'immediate_writeoff',
      cost: 800,
      openingAdjustableValue: 800,
      partYear: { kind: 'months', monthsUsed: 1 },
    });
    expect(r.declineInValue).toBe(800);
    expect(r.closingAdjustableValue).toBe(0);
  });
});

// ─── Low value asset threshold ──────────────────────────────────────────────

describe('NZ low value asset threshold — effective-dated, all three rows verified', () => {
  it('$1,000 from 17 March 2021', () => {
    const t = nzLowValueThreshold(new Date(2026, 0, 15));
    expect(t).toMatchObject({ limit: 1000, verified: true });
    expect(nzLowValueThreshold('2021-03-17').limit).toBe(1000);
  });

  it('$5,000 inside the temporary window, 17 March 2020 to 16 March 2021', () => {
    expect(nzLowValueThreshold('2020-03-17')).toMatchObject({ limit: 5000, verified: true });
    expect(nzLowValueThreshold(new Date(2020, 8, 1))).toMatchObject({ limit: 5000, verified: true });
    expect(nzLowValueThreshold('2021-03-16')).toMatchObject({ limit: 5000, verified: true });
  });

  it('$500 up to 16 March 2020', () => {
    expect(nzLowValueThreshold('2020-03-16')).toMatchObject({ limit: 500, verified: true });
    expect(nzLowValueThreshold('2015-01-01')).toMatchObject({ limit: 500, verified: true });
  });

  it('the rules expose it as both lowValueThreshold and instantAssetWriteOff', () => {
    const d = new Date(2025, 5, 1);
    expect(nz.lowValueThreshold(d)).toEqual(nz.instantAssetWriteOff(d));
  });

  it('order is derived, not trusted: a shuffled copy resolves identically', () => {
    const shuffled = [...NZ_LOW_VALUE_ASSET_ROWS].reverse();
    const ordered = sortNewestFirst(shuffled);
    expect(ordered[0].effectiveFrom).toBe('2021-03-17');
    expect(resolveEffectiveDated(ordered, '2020-06-01').limit).toBe(5000);
  });
});

// ─── Investment Boost ───────────────────────────────────────────────────────

describe('NZ Investment Boost — 20% up front for NEW assets from 22 May 2025', () => {
  it('on and after 22 May 2025 it is 20%, verified', () => {
    expect(nzInvestmentBoost('2025-05-22')).toMatchObject({ percent: 20, verified: true });
    expect(nzInvestmentBoost(new Date(2026, 7, 23))).toMatchObject({ percent: 20, verified: true });
  });

  it('before 22 May 2025 it is null and unverified — not 0%', () => {
    const before = nzInvestmentBoost('2025-05-21');
    expect(before.percent).toBeNull();
    expect(before.verified).toBe(false);
    expect(before.note).toMatch(/22 May 2025/);
  });

  it('a $10,000 new asset expenses $2,000 and depreciates $8,000 × rate', () => {
    const split = nzInvestmentBoostSplit({ cost: 10000, acquiredOn: '2025-06-01', isNewAsset: true });
    expect(split).toMatchObject({ applied: true, expensedNow: 2000, depreciableCost: 8000 });
    const y1 = nz.declineInValue({
      method: 'diminishing_value',
      cost: split.depreciableCost,
      openingAdjustableValue: split.depreciableCost,
      annualRate: 0.3,
      ...FULL_YEAR,
    });
    expect(y1.declineInValue).toBe(2400);
    expect(split.expensedNow + y1.declineInValue).toBe(4400);
  });

  it('a used asset gets nothing up front and depreciates the full cost', () => {
    const split = nzInvestmentBoostSplit({ cost: 10000, acquiredOn: '2025-06-01', isNewAsset: false });
    expect(split).toMatchObject({ applied: false, expensedNow: 0, depreciableCost: 10000 });
  });

  it('an unanswered "is it new?" is NOT new', () => {
    expect(nzInvestmentBoostSplit({ cost: 10000, acquiredOn: '2025-06-01', isNewAsset: null }).applied).toBe(false);
    expect(nzInvestmentBoostSplit({ cost: 10000, acquiredOn: '2025-06-01', isNewAsset: undefined }).applied).toBe(false);
  });

  it('a new asset bought before 22 May 2025 gets nothing', () => {
    const split = nzInvestmentBoostSplit({ cost: 10000, acquiredOn: '2025-05-21', isNewAsset: true });
    expect(split).toMatchObject({ applied: false, expensedNow: 0, depreciableCost: 10000, verified: false });
  });

  it('the register is told to collect isNewAsset, and the concession names it', () => {
    const fields = nz.extraAssetFields();
    expect(fields.map((f) => f.key)).toEqual(['isNewAsset']);
    expect(fields[0].type).toBe('boolean');
    const boost = nz.firstYearConcessions('2026-01-01').find((c) => c.key === 'investment_boost');
    expect(boost).toMatchObject({ kind: 'upfront_percent', percent: 20, verified: true, requiresField: 'isNewAsset' });
  });

  it('firstYearConcessions carries both concessions with their verified state', () => {
    const after = nz.firstYearConcessions('2026-01-01');
    expect(after.map((c) => [c.key, c.limit, c.percent, c.verified])).toEqual([
      ['low_value_asset', 1000, null, true],
      ['investment_boost', null, 20, true],
    ]);
    const before = nz.firstYearConcessions('2020-06-01');
    expect(before.map((c) => [c.key, c.limit, c.percent, c.verified])).toEqual([
      ['low_value_asset', 5000, null, true],
      ['investment_boost', null, null, false],
    ]);
  });

  it('the boost rows resolve regardless of literal order', () => {
    const ordered = sortNewestFirst([...NZ_INVESTMENT_BOOST_ROWS].reverse());
    expect(resolveEffectiveDated(ordered, '2025-05-22').percent).toBe(20);
    expect(resolveEffectiveDated(ordered, '2025-05-21').percent).toBeNull();
  });
});

// ─── Rates — IR265 ──────────────────────────────────────────────────────────

describe('NZ rates — IR265 March 2026, short and sourced', () => {
  it('coffee makers: 30% DV, 21% SL, IR265 p.20 HOTS', () => {
    const r = nzRateFor('coffee_maker');
    expect(r).toEqual({
      dv: 0.3,
      sl: 0.21,
      source: expect.stringContaining('p.20, "Hotels, motels, restaurants, cafes, taverns and takeaway bars (HOTS)": "Coffee makers"'),
    });
    expect(nz.effectiveLife('coffee_maker')).toBe(6.66);
  });

  it('a laptop is 50% DV / 40% SL, a car 30% DV / 21% SL, a desk 13% DV / 8.5% SL', () => {
    expect(nz.rateFor('computer_laptop')).toMatchObject({ dv: 0.5, sl: 0.4 });
    expect(nz.rateFor('motor_vehicle_car')).toMatchObject({ dv: 0.3, sl: 0.21 });
    expect(nz.rateFor('office_desk')).toMatchObject({ dv: 0.13, sl: 0.085 });
  });

  it('every row names IR265 March 2026, a page and a category heading, and has both rates', () => {
    expect(NZ_RATE_CATEGORIES.length).toBeGreaterThanOrEqual(1);
    expect(NZ_RATE_CATEGORIES.length).toBeLessThanOrEqual(25);
    for (const c of NZ_RATE_CATEGORIES) {
      expect(c.source).toMatch(/^IR265 General depreciation rates \(March 2026\), p\.\d+, ".+": ".+"$/);
      expect(c.dv).toBeGreaterThan(0);
      expect(c.dv).toBeLessThanOrEqual(1);
      expect(c.sl).toBeGreaterThan(0);
      expect(c.sl).toBeLessThanOrEqual(1);
      expect(c.years).toBeGreaterThan(0);
    }
    const keys = NZ_RATE_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('an asset not on the list is null, not a guess', () => {
    expect(nzRateFor('espresso_grinder')).toBeNull();
    expect(nz.effectiveLife('espresso_grinder')).toBeNull();
  });

  it('effectiveLifeCategories returns copies carrying the IR265 useful life', () => {
    const cats = nz.effectiveLifeCategories();
    expect(cats.length).toBe(NZ_RATE_CATEGORIES.length);
    expect(cats.find((c) => c.key === 'office_chair')?.years).toBe(12.5);
    expect(cats).not.toBe(NZ_RATE_CATEGORIES);
  });
});

// ─── Pooling and the explainer ──────────────────────────────────────────────

describe('NZ pooling — documented, not computed', () => {
  it('exposes the four conditions and refuses the pool method', () => {
    expect(NZ_POOLING_RULES.available).toBe(false);
    expect(NZ_POOLING_RULES.conditions).toHaveLength(4);
    expect(NZ_POOLING_RULES.note).toMatch(/lowest depreciation rate/);
    expect(() =>
      nz.declineInValue({ method: 'pool', cost: 1000, openingAdjustableValue: 1000, ...FULL_YEAR }),
    ).toThrow(/NZ_POOLING_RULES/);
  });
});

describe("NZ explainer — Fin's voice, IRD's words, IRD's links only", () => {
  const e = nz.explainer();
  const allText = [e.whatItIs, e.whenItApplies, ...e.howItWorks, ...e.readMore.map((r) => r.label)].join('\n');

  it('uses IRD vocabulary for the column labels', () => {
    expect(e.vocabulary.writtenDown).toBe('Adjusted tax value');
    expect(e.vocabulary.writtenDown).not.toMatch(/written down/i);
    expect(e.vocabulary.decline).toBe('Depreciation');
    expect(e.vocabulary.rateBasis).toBe('Estimated useful life');
  });

  it('speaks to "you" and never as "we"', () => {
    expect(allText).toMatch(/\byou\b/i);
    expect(allText).not.toMatch(/\b(we|us|our)\b/i);
    expect(allText).not.toMatch(/\bAI\b/);
  });

  it('names the IRD terms and the Australian number nowhere', () => {
    expect(allText).toMatch(/adjusted tax value/i);
    expect(allText).toMatch(/low value asset/i);
    expect(allText).toMatch(/Investment Boost/);
    expect(allText).not.toMatch(/20,000/);
    expect(allText).toMatch(/part-months as whole months/);
  });

  it('links only to ird.govt.nz, including the IR265 PDF', () => {
    expect(e.readMore.length).toBeGreaterThanOrEqual(3);
    for (const r of e.readMore) {
      expect(r.url).toMatch(/^https:\/\/www\.ird\.govt\.nz\//);
      expect(r.authority).toBe('Inland Revenue');
    }
    expect(e.readMore.some((r) => r.url.endsWith('ir265-march-2026.pdf'))).toBe(true);
  });

  it('returns a fresh copy each call', () => {
    const a = nz.explainer();
    a.howItWorks.push('tampered');
    expect(nz.explainer().howItWorks).not.toContain('tampered');
  });
});
