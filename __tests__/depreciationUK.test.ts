/**
 * United Kingdom capital allowances tests — @ai2/tax-plugins
 * ai2fin.com
 *
 * The UK is the first POOLED regime: the pool is the unit, not the asset.
 * The figures are gov.uk's own (read 2026-08-23/24): main pool 18% → 14% from
 * April 2026 with a hybrid rate across the change; special rate 6%; AIA
 * £1,000,000 pro-rated by period length; the 40% FYA from 1 January 2026 with
 * the other 60% written down NEXT period; cars by CO₂ and purchase date; the
 * small pools allowance at £1,000 pro-rated; and the cash-basis gate — a
 * sole trader on the cash basis claims on cars and nothing else.
 */

import {
  getDepreciationRules,
  getPluginForCountry,
  computePoolPeriod,
  UK_DEPRECIATION_RULES,
  UK_AIA_ROWS,
  UK_CAR_BAND_ROWS,
  ukWdaRate,
  ukAia,
  ukAiaOnDate,
  ukSmallPoolsAllowance,
  ukPeriodYearFraction,
  ukPoolFor,
  ukFirstYearAllowance,
  ukEligibility,
  ukCashBasisRestriction,
  type PooledAllowanceRules,
} from '../src';

const uk = UK_DEPRECIATION_RULES;
const IT = 'income_tax' as const;
const CT = 'corporation_tax' as const;

describe('UK capital allowances — wiring and regime', () => {
  it('the GB plugin hands back the pooled rules', () => {
    const rules = getDepreciationRules(getPluginForCountry('GB')) as PooledAllowanceRules;
    expect(rules).toBe(uk);
    expect(rules.countryCode).toBe('GB');
    expect(rules.regime).toBe('pooled_allowance');
    expect(rules.defaultMethod).toBe('pool');
    expect(rules.methods).toContain('pool');
    expect(rules.methods).not.toContain('diminishing_value');
  });

  it('refuses a per-asset method — the pool is the unit', () => {
    expect(() =>
      uk.declineInValue({ method: 'diminishing_value', cost: 1000, openingAdjustableValue: 1000, daysHeld: 365, daysInYear: 365 }),
    ).toThrow(/POOL/);
    expect(() => uk.declineInValue({ method: 'pool', cost: 1000, openingAdjustableValue: 1000 })).toThrow(/annualRate/);
    const out = uk.declineInValue({ method: 'pool', cost: 0, openingAdjustableValue: 10_000, annualRate: 0.18 });
    expect(out.declineInValue).toBe(1800);
    expect(out.closingAdjustableValue).toBe(8200);
  });
});

describe('UK writing-down allowance rates — 18% → 14%, hybrid across April 2026', () => {
  it('a calendar-2026 income-tax period is a hybrid: 95 days at 18%, 270 at 14%', () => {
    const r = ukWdaRate('main', { periodStart: '2026-01-01', periodEnd: '2026-12-31', taxpayer: IT });
    expect(r.hybrid).toEqual({ before: 0.18, after: 0.14, daysBefore: 95, daysAfter: 270 });
    expect(r.rate).toBeCloseTo((95 / 365) * 0.18 + (270 / 365) * 0.14, 10);
    expect(r.verified).toBe(true);
    expect(r.note).toMatch(/6 April 2026/);
  });

  it('a corporation-tax period starting 1 April 2026 is 14% flat', () => {
    const r = ukWdaRate('main', { periodStart: '2026-04-01', periodEnd: '2027-03-31', taxpayer: CT });
    expect(r.rate).toBe(0.14);
    expect(r.hybrid).toBeUndefined();
  });

  it('the CT and IT change dates differ: 1 April vs 6 April', () => {
    const ct = ukWdaRate('main', { periodStart: '2026-04-01', periodEnd: '2027-03-31', taxpayer: CT });
    const it = ukWdaRate('main', { periodStart: '2026-04-01', periodEnd: '2027-03-31', taxpayer: IT });
    expect(ct.hybrid).toBeUndefined();
    expect(it.hybrid?.daysBefore).toBe(5);
  });

  it('a 2025 period is 18% flat; the special rate pool is 6% always', () => {
    expect(ukWdaRate('main', { periodStart: '2025-01-01', periodEnd: '2025-12-31', taxpayer: IT }).rate).toBe(0.18);
    expect(ukWdaRate('special', { periodStart: '2026-01-01', periodEnd: '2026-12-31', taxpayer: IT }).rate).toBe(0.06);
    expect(() => ukWdaRate('single', { periodStart: '2026-01-01', periodEnd: '2026-12-31', taxpayer: IT })).toThrow(/single-asset/);
  });

  it('accepts Date objects by their local calendar day', () => {
    const r = uk.wdaRate('main', { periodStart: new Date(2026, 0, 1), periodEnd: new Date(2026, 11, 31), taxpayer: IT });
    expect(r.hybrid?.daysBefore).toBe(95);
  });
});

describe('UK annual investment allowance — £1,000,000, pro-rated by period', () => {
  it('a 12-month period gets the full £1,000,000', () => {
    const a = ukAia({ periodStart: '2026-01-01', periodEnd: '2026-12-31' });
    expect(a).toMatchObject({ limit: 1_000_000, annualLimit: 1_000_000, proRated: false, verified: true });
    expect(a.note).toMatch(/cars/);
  });

  it('9 months → 9/12 × £1,000,000 = £750,000', () => {
    const a = ukAia({ periodStart: '2026-04-01', periodEnd: '2026-12-31' });
    expect(a.limit).toBe(750_000);
    expect(a.proRated).toBe(true);
    expect(a.note).toMatch(/9 months/);
    expect(ukPeriodYearFraction({ periodStart: '2026-04-01', periodEnd: '2026-12-31' })).toMatchObject({ months: 9, fraction: 0.75 });
  });

  it('a period not on month boundaries is apportioned by days over 365', () => {
    const f = ukPeriodYearFraction({ periodStart: '2026-01-15', periodEnd: '2026-07-14' });
    expect(f.months).toBeNull();
    expect(f.days).toBe(181);
    expect(ukAia({ periodStart: '2026-01-15', periodEnd: '2026-07-14' }).limit).toBe(Math.round((181 / 365) * 1_000_000));
  });

  it('historical rows resolve by date and the floor is unverified', () => {
    expect(ukAia({ periodStart: '2017-01-01', periodEnd: '2017-12-31' })).toMatchObject({ limit: 200_000, verified: true });
    expect(ukAia({ periodStart: '2015-01-01', periodEnd: '2015-12-31' })).toMatchObject({ limit: 500_000, verified: true });
    expect(ukAia({ periodStart: '2010-01-01', periodEnd: '2010-12-31' })).toMatchObject({ limit: null, verified: false });
    expect(ukAiaOnDate('2019-01-01')).toMatchObject({ limit: 1_000_000, verified: true });
    expect(ukAiaOnDate('2018-12-31')).toMatchObject({ limit: 200_000, verified: true });
    expect(UK_AIA_ROWS.filter((r) => r.verified).length).toBe(3);
  });

  it('a period straddling a change in the limit is unverified, never a confident number', () => {
    const a = ukAia({ periodStart: '2018-07-01', periodEnd: '2019-06-30' });
    expect(a.verified).toBe(false);
    expect(a.note).toMatch(/transitional/);
  });
});

describe('UK small pools allowance — £1,000, pro-rated, not for single-asset pools', () => {
  it('is £1,000 for a 12-month period and £750 for 9 months', () => {
    expect(ukSmallPoolsAllowance({ periodStart: '2026-01-01', periodEnd: '2026-12-31' })).toMatchObject({ limit: 1000, verified: true, proRated: false });
    expect(ukSmallPoolsAllowance({ periodStart: '2026-04-01', periodEnd: '2026-12-31' })).toMatchObject({ limit: 750, verified: true, proRated: true });
  });

  it('a £900 main pool in a 12-month period is written off in full, WDA 0, closing 0', () => {
    const out = computePoolPeriod({ pool: 'main', openingWdv: 900, wdaRate: 0.18, aiaLimit: 1_000_000, smallPoolsLimit: 1000 });
    expect(out.smallPoolsAllowance).toBe(900);
    expect(out.wdaClaimed).toBe(0);
    expect(out.closingWdv).toBe(0);
    expect(out.totalAllowance).toBe(900);
  });

  it('the same £900 in a 9-month period exceeds the £750 limit, so WDA runs instead', () => {
    const limit = ukSmallPoolsAllowance({ periodStart: '2026-04-01', periodEnd: '2026-12-31' }).limit;
    const out = computePoolPeriod({ pool: 'main', openingWdv: 900, wdaRate: 0.14, aiaLimit: 750_000, smallPoolsLimit: limit });
    expect(out.smallPoolsAllowance).toBe(0);
    expect(out.wdaClaimed).toBe(126);
    expect(out.closingWdv).toBe(774);
  });

  it('never applies to a single-asset pool', () => {
    const out = computePoolPeriod({ pool: 'single', openingWdv: 900, wdaRate: 0.18, aiaLimit: 0, smallPoolsLimit: 1000 });
    expect(out.smallPoolsAllowance).toBe(0);
    expect(out.wdaClaimed).toBe(162);
  });
});

describe('UK first-year allowances', () => {
  it('a £10,000 new machine bought 15 Jan 2026 by a sole trader: 40% now, £6,000 into the pool for next period', () => {
    const fya = ukFirstYearAllowance({ cost: 10_000, isNew: true, taxpayerType: IT }, '2026-01-15');
    expect(fya).toMatchObject({ percent: 40, kind: 'fya_40', remainderToPool: 60, pool: 'main', verified: true });
    const out = computePoolPeriod({ pool: 'main', openingWdv: 0, additions: [{ cost: 10_000, fyaPercent: 40 }], wdaRate: 0.18, aiaLimit: 1_000_000 });
    expect(out.fyaClaimed).toBe(4000);
    expect(out.fyaRemainderToPool).toBe(6000);
    expect(out.wdaClaimed).toBe(0); // the 60% is written down NEXT period, not this one
    expect(out.closingWdv).toBe(6000);
    // Next period it is ordinary pool balance.
    const next = computePoolPeriod({ pool: 'main', openingWdv: out.closingWdv, wdaRate: 0.14, aiaLimit: 1_000_000 });
    expect(next.wdaClaimed).toBe(840);
  });

  it('the 40% FYA needs new and unused, main rate, not a car', () => {
    expect(ukFirstYearAllowance({ cost: 10_000, isNew: false, taxpayerType: IT }, '2026-01-15')).toBeNull();
    expect(ukFirstYearAllowance({ cost: 10_000, taxpayerType: IT }, '2026-01-15')).toBeNull();
    expect(ukFirstYearAllowance({ cost: 10_000, isNew: true, isSpecialRate: true, taxpayerType: IT }, '2026-01-15')).toBeNull();
    expect(ukFirstYearAllowance({ cost: 10_000, isNew: true, taxpayerType: IT }, '2025-12-31')).toBeNull();
  });

  it('a company gets full expensing (100%) from 1 April 2023, 50% on special rate plant', () => {
    expect(ukFirstYearAllowance({ cost: 10_000, isNew: true, taxpayerType: CT }, '2026-01-15')).toMatchObject({ percent: 100, kind: 'full_expensing', remainderToPool: 0, verified: true });
    expect(ukFirstYearAllowance({ cost: 10_000, isNew: true, isSpecialRate: true, taxpayerType: CT }, '2024-06-01')).toMatchObject({ percent: 50, kind: 'fya_50_special_rate', remainderToPool: 50, pool: 'special' });
    expect(ukFirstYearAllowance({ cost: 10_000, isNew: true, taxpayerType: CT }, '2022-06-01')).toMatchObject({ percent: 130, kind: 'super_deduction' });
    expect(ukFirstYearAllowance({ cost: 10_000, isNew: true, taxpayerType: IT }, '2022-06-01')).toBeNull();
  });

  it('with the taxpayer type unknown after April 2023 it says so rather than guessing', () => {
    const fya = ukFirstYearAllowance({ cost: 10_000, isNew: true }, '2026-01-15');
    expect(fya).toMatchObject({ percent: null, kind: null, verified: false });
    expect(fya?.note).toMatch(/taxpayer type/);
  });
});

describe('UK business cars — CO₂ and purchase date', () => {
  const car = (co2: number, isNew: boolean, date: string) => ({ cost: 30_000, isCar: true, co2GPerKm: co2, isNew, taxpayerType: IT });

  it('a £30,000 new 0 g/km car in 2026 gets the 100% FYA', () => {
    expect(ukFirstYearAllowance(car(0, true, '2026-03-01'), '2026-03-01')).toMatchObject({ percent: 100, kind: 'fya_100_zero_emission_car', verified: true });
    expect(ukPoolFor(car(0, true, '2026-03-01'), '2026-03-01').pool).toBe('main');
  });

  it('a used 0 g/km car gets no FYA and joins the main pool', () => {
    expect(ukFirstYearAllowance(car(0, false, '2026-03-01'), '2026-03-01')).toBeNull();
    expect(ukPoolFor(car(0, false, '2026-03-01'), '2026-03-01').pool).toBe('main');
  });

  it('45 g/km → main pool; 120 g/km → special rate pool (from April 2021)', () => {
    expect(ukPoolFor(car(45, true, '2026-03-01'), '2026-03-01')).toMatchObject({ pool: 'main', verified: true });
    expect(ukPoolFor(car(120, true, '2026-03-01'), '2026-03-01')).toMatchObject({ pool: 'special', verified: true });
    expect(ukFirstYearAllowance(car(45, true, '2026-03-01'), '2026-03-01')).toBeNull();
  });

  it('the SAME 120 g/km car bought in 2019 is main rate — the band moved', () => {
    expect(ukPoolFor(car(120, true, '2019-06-01'), '2019-06-01').pool).toBe('special');
    expect(ukPoolFor(car(110, true, '2019-06-01'), '2019-06-01').pool).toBe('main');
    expect(ukPoolFor(car(120, true, '2016-06-01'), '2016-06-01').pool).toBe('main');
    expect(ukPoolFor(car(75, true, '2016-06-01'), '2016-06-01').pool).toBe('main');
    expect(ukFirstYearAllowance(car(75, true, '2016-06-01'), '2016-06-01')).toMatchObject({ percent: 100 });
    expect(ukFirstYearAllowance(car(50, true, '2019-06-01'), '2019-06-01')).toMatchObject({ percent: 100 });
  });

  it('a car with no CO₂ figure cannot be routed and says so', () => {
    const p = ukPoolFor({ cost: 30_000, isCar: true }, '2026-03-01');
    expect(p.verified).toBe(false);
    expect(p.note).toMatch(/CO₂/);
  });

  it('before April 2015 the bands are not recorded', () => {
    expect(ukPoolFor(car(100, true, '2014-01-01'), '2014-01-01').verified).toBe(false);
    expect(UK_CAR_BAND_ROWS.every((r) => r.verified)).toBe(true);
  });

  it('the income-tax calendar starts a band on 6 April, not 1 April', () => {
    expect(ukPoolFor({ ...car(100, true, ''), taxpayerType: IT }, '2021-04-03').pool).toBe('main');
    expect(ukPoolFor({ ...car(100, true, ''), taxpayerType: CT }, '2021-04-03').pool).toBe('special');
  });
});

describe('UK cash basis — cars only', () => {
  it('a cash-basis sole trader laptop is not a capital allowances asset', () => {
    const e = ukEligibility({ cost: 1200, cashBasis: true, taxpayerType: IT });
    expect(e.eligible).toBe(false);
    expect(e.note).toMatch(/cash basis/);
    expect(e.note).toMatch(/business cars/);
    expect(ukFirstYearAllowance({ cost: 1200, cashBasis: true, isNew: true, taxpayerType: IT }, '2026-02-01')).toBeNull();
  });

  it('a cash-basis sole trader CAR still qualifies', () => {
    expect(ukEligibility({ cost: 30_000, cashBasis: true, isCar: true }).eligible).toBe(true);
    expect(uk.cashBasisRestriction()).toMatchObject({ carsOnly: true });
    expect(ukCashBasisRestriction().note).toMatch(/only claim capital allowances on business cars/);
  });

  it('traditional accounting is not restricted', () => {
    expect(ukEligibility({ cost: 1200, cashBasis: false }).eligible).toBe(true);
    expect(ukEligibility({ cost: 1200 }).eligible).toBe(true);
  });
});

describe('UK pool period arithmetic — HMRC order', () => {
  it('additions in, AIA against them, disposal out, WDA on the rest', () => {
    const out = computePoolPeriod({
      pool: 'main',
      openingWdv: 10_000,
      additions: [{ cost: 5_000 }],
      disposals: [{ proceeds: 3_000, originalCost: 8_000 }],
      wdaRate: 0.18,
      aiaLimit: 1_000_000,
      smallPoolsLimit: 1000,
    });
    expect(out).toMatchObject({
      additions: 5000,
      aiaClaimed: 5000,
      fyaClaimed: 0,
      disposals: 3000,
      balancingCharge: 0,
      wdaClaimed: 1260,
      closingWdv: 5740,
      totalAllowance: 6260,
    });
  });

  it('AIA cannot exceed the pro-rated limit; the excess gets WDA this period', () => {
    const out = computePoolPeriod({ pool: 'main', openingWdv: 0, additions: [{ cost: 800_000 }], wdaRate: 0.14, aiaLimit: 750_000 });
    expect(out.aiaClaimed).toBe(750_000);
    expect(out.wdaClaimed).toBe(7000);
    expect(out.closingWdv).toBe(43_000);
  });

  it('a car is not AIA-eligible and goes straight to the pool', () => {
    const out = computePoolPeriod({ pool: 'main', openingWdv: 0, additions: [{ cost: 30_000, aiaEligible: false }], wdaRate: 0.18, aiaLimit: 1_000_000 });
    expect(out.aiaClaimed).toBe(0);
    expect(out.wdaClaimed).toBe(5400);
  });

  it('disposal proceeds are capped at original cost and a surplus is a balancing charge', () => {
    const out = computePoolPeriod({ pool: 'main', openingWdv: 2_000, disposals: [{ proceeds: 5_000, originalCost: 4_000 }], wdaRate: 0.18, aiaLimit: 0 });
    expect(out.disposals).toBe(4000);
    expect(out.balancingCharge).toBe(2000);
    expect(out.wdaClaimed).toBe(0);
    expect(out.closingWdv).toBe(0);
  });

  it('a closing pool takes a balancing allowance on what is left', () => {
    const out = computePoolPeriod({ pool: 'single', openingWdv: 4_000, disposals: [{ proceeds: 1_000 }], wdaRate: 0.18, aiaLimit: 0, closing: true });
    expect(out.balancingAllowance).toBe(3000);
    expect(out.wdaClaimed).toBe(0);
    expect(out.closingWdv).toBe(0);
  });

  it('the super-deduction leaves nothing in the pool', () => {
    const out = computePoolPeriod({ pool: 'main', openingWdv: 0, additions: [{ cost: 1000, fyaPercent: 130 }], wdaRate: 0.18, aiaLimit: 0 });
    expect(out.fyaClaimed).toBe(1300);
    expect(out.fyaRemainderToPool).toBe(0);
    expect(out.closingWdv).toBe(0);
  });

  it('rejects a rate that is not a fraction', () => {
    expect(() => computePoolPeriod({ pool: 'main', openingWdv: 0, wdaRate: 18, aiaLimit: 0 })).toThrow(/fraction/);
  });

  it('the balancing adjustment on the rules object is the shared one', () => {
    expect(uk.balancingAdjustment({ terminationValue: 5000, adjustableValue: 3000, taxableUsePercent: 100 })).toEqual({ amount: 2000, assessable: true });
  });
});

describe('UK concessions and register fields', () => {
  it('lists the AIA, full expensing, the 40% FYA and the zero-emission car FYA in 2026', () => {
    const keys = uk.firstYearConcessions('2026-02-01').map((c) => c.key);
    expect(keys).toEqual(['annual_investment_allowance', 'full_expensing', 'fya_40', 'fya_100_zero_emission_car']);
    for (const c of uk.firstYearConcessions('2026-02-01')) expect(c.verified).toBe(true);
  });

  it('does not list the 40% FYA before 2026', () => {
    expect(uk.firstYearConcessions('2025-06-01').map((c) => c.key)).not.toContain('fya_40');
  });

  it('asks the register for taxpayer type, car, CO₂ and newness', () => {
    expect(uk.extraAssetFields().map((f) => f.key)).toEqual(['taxpayerType', 'isCar', 'co2GPerKm', 'isNew']);
    expect(uk.extraAssetFields().find((f) => f.key === 'co2GPerKm')?.type).toBe('number');
    expect(uk.extraAssetFields().find((f) => f.key === 'taxpayerType')?.options?.length).toBe(2);
  });

  it('instantAssetWriteOff is the AIA figure in force', () => {
    expect(uk.instantAssetWriteOff(new Date(2026, 6, 1))).toMatchObject({ limit: 1_000_000, verified: true });
  });
});

describe("UK explainer — Fin's voice, HMRC's words, gov.uk links only", () => {
  const e = uk.explainer();
  const allText = [e.whatItIs, e.whenItApplies, ...e.howItWorks, ...e.readMore.map((r) => r.label)].join('\n');

  it('leads with the cash-basis line', () => {
    expect(e.whenItApplies).toMatch(/^If you are a sole trader on the cash basis, this only applies to business cars/);
  });

  it('uses HMRC vocabulary', () => {
    expect(e.vocabulary.writtenDown).toBe('Written down value');
    expect(e.vocabulary.decline).toBe('Writing-down allowance');
    expect(e.vocabulary.rateBasis).toBe('Pool');
    expect(allText).toMatch(/annual investment allowance/i);
    expect(allText).toMatch(/balancing charge/i);
    expect(allText).toMatch(/pool/i);
  });

  it('speaks to "you" and never as "we"', () => {
    expect(allText).toMatch(/\byou\b/i);
    expect(allText).not.toMatch(/\b(we|us|our)\b/i);
    expect(allText).not.toMatch(/\bAI\b/);
  });

  it('links only to gov.uk', () => {
    expect(e.readMore.length).toBeGreaterThanOrEqual(5);
    for (const r of e.readMore) {
      expect(r.url).toMatch(/^https:\/\/www\.gov\.uk\//);
      expect(r.authority).toBe('HMRC');
    }
    expect(e.readMore.some((r) => r.url.endsWith('/work-out-what-you-can-claim'))).toBe(true);
  });

  it('returns a fresh copy each call', () => {
    const a = uk.explainer();
    a.howItWorks.push('tampered');
    expect(uk.explainer().howItWorks).not.toContain('tampered');
  });
});
