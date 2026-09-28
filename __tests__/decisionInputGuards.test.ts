/**
 * Input guards for the home and property decisions — @ai2/tax-plugins
 * ai2fin.com
 *
 * The decisions are shared maths; a website user typed 1,000,000 work hours
 * and was shown "$700,000 running costs a year". Each guard below must stop
 * the computation (a DecisionInputError listing every problem), and valid
 * input must still produce the exact worked figures.
 */

import {
  DecisionInputError,
  homeBusinessSpaceTradeoff,
  mainResidenceChoice,
  roomOrPartnerArrangement,
  validateHomeBusinessSpace,
  validateMainResidenceChoice,
  validateRoomOrPartnerArrangement,
  type HomeBusinessSpaceInput,
  type HomeBusinessSpaceResult,
  type LodgerArrangementInput,
  type LodgerArrangementResult,
  type MainResidenceChoiceInput,
  type MainResidenceChoiceResult,
} from '../src';

const space: HomeBusinessSpaceInput = {
  incomeYear: '2023-24',
  businessSharePct: 35,
  occupancyCostsPerYear: 9600,
  runningCostsPerYear: 1200,
  years: 4,
  expectedGrowth: 50_000,
  marginalRatePct: 32,
  businessUseStart: '2023-07-01',
  saleDate: '2027-06-30',
};

const lodger: LodgerArrangementInput = {
  kind: 'lodger',
  weeklyRent: 250,
  letSharePct: 35,
  homeCostsPerYear: 20_000,
  marginalRatePct: 32,
  firstLetDate: '2003-07-01',
  saleDate: '2026-06-30',
  expectedGrowth: 400_000,
};

const homes: MainResidenceChoiceInput = {
  homes: [
    { name: 'Old', ownedFrom: '2002-01-01', movedOut: '2025-01-01', expectedGrowth: 867_500 },
    { name: 'New', ownedFrom: '2025-01-01', expectedGrowth: 100_000 },
  ],
  saleDates: { Old: '2025-10-01', New: '2035-01-01' },
  marginalRatePct: 32,
};

/** The problems a call throws, as `field` list — and proof that it threw a DecisionInputError, not a result. */
function refused(fn: () => unknown): string[] {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DecisionInputError);
    expect(e).toBeInstanceOf(RangeError); // existing RangeError checks still hold
    return (e as DecisionInputError).problems.map((p) => p.field);
  }
  throw new Error('expected the call to refuse its input');
}

// ─── Hours ──────────────────────────────────────────────────────────────────

describe('work hours: 0 to 8,760 a year', () => {
  const byHours = (h: number): HomeBusinessSpaceInput => ({ ...space, runningCostsPerYear: undefined, workHoursPerYear: h, runningCostPerHour: 0.7 });

  it('the reported case: 1,000,000 hours is refused, never "$700,000 running costs"', () => {
    expect(refused(() => homeBusinessSpaceTradeoff(byHours(1_000_000)))).toEqual(['workHoursPerYear']);
  });

  it('8,760 is the most there can be; 8,761 and -1 are refused', () => {
    expect(() => homeBusinessSpaceTradeoff(byHours(8760))).not.toThrow();
    expect(refused(() => homeBusinessSpaceTradeoff(byHours(8761)))).toEqual(['workHoursPerYear']);
    expect(refused(() => homeBusinessSpaceTradeoff(byHours(-1)))).toEqual(['workHoursPerYear']);
  });

  it('valid hours: running costs = hours × rate, stated in the assumptions', () => {
    const r = homeBusinessSpaceTradeoff(byHours(1000)) as HomeBusinessSpaceResult;
    expect(r.options.deskOrSharedRoom.deductionsPerYear).toBe(700);
    expect(r.assumptions.runningCosts).toEqual({ perYear: 700, basis: 'hours × rate', workHoursPerYear: 1000, runningCostPerHour: 0.7 });
  });

  it('running costs per year and hours together are ambiguous; neither is missing', () => {
    expect(refused(() => homeBusinessSpaceTradeoff({ ...space, workHoursPerYear: 100, runningCostPerHour: 0.7 }))).toEqual(['runningCostsPerYear']);
    expect(refused(() => homeBusinessSpaceTradeoff({ ...space, runningCostsPerYear: undefined }))).toEqual(['runningCostsPerYear']);
  });
});

// ─── Percentages, amounts, years, marginal rate ─────────────────────────────

describe('homeBusinessSpaceTradeoff guards', () => {
  it.each([
    ['businessSharePct', { businessSharePct: 101 }],
    ['businessSharePct', { businessSharePct: -5 }],
    ['ownershipPct', { ownershipPct: 150 }],
    ['marginalRatePct', { marginalRatePct: 101 }],
    ['marginalRatePct', { marginalRatePct: -1 }],
    ['occupancyCostsPerYear', { occupancyCostsPerYear: -1 }],
    ['runningCostsPerYear', { runningCostsPerYear: -1 }],
    ['expectedGrowth', { expectedGrowth: -10_000 }],
    ['years', { years: 0 }],
    ['years', { years: 51 }],
    ['years', { years: 2.5 }],
    ['businessSharePct', { businessSharePct: Number.NaN }],
    ['saleDate', { saleDate: '2023-06-30' }], // before business use started
    ['saleDate', { saleDate: '2027-02-30' }], // not a real day
    ['businessUseStart', { businessUseStart: '1 July 2023' }],
    ['businessUseEnd', { businessUseEnd: '2030-01-01' }], // after the sale
    ['businessUseEnd', { businessUseEnd: '2023-01-01' }], // before the start
    ['incomeYear', { incomeYear: '2023-25' }],
  ] as Array<[string, Partial<HomeBusinessSpaceInput>]>)('refuses %s = %j', (field, over) => {
    expect(refused(() => homeBusinessSpaceTradeoff({ ...space, ...over }))).toEqual([field]);
  });

  it('reports every problem at once, and validate… returns the same list without throwing', () => {
    const bad = { ...space, businessSharePct: 200, years: 0, marginalRatePct: 150 };
    expect(refused(() => homeBusinessSpaceTradeoff(bad))).toEqual(['businessSharePct', 'marginalRatePct', 'years']);
    expect(validateHomeBusinessSpace(bad).map((p) => p.field)).toEqual(['businessSharePct', 'marginalRatePct', 'years']);
    expect(validateHomeBusinessSpace(space)).toEqual([]);
  });

  it('boundaries are allowed: 0% and 100%, 1 and 50 years, zero growth', () => {
    for (const over of [{ businessSharePct: 0 }, { businessSharePct: 100 }, { marginalRatePct: 0 }, { marginalRatePct: 100 }, { years: 1 }, { years: 50 }, { expectedGrowth: 0 }]) {
      expect(validateHomeBusinessSpace({ ...space, ...over })).toEqual([]);
    }
  });

  it('the worked case is unchanged, and the marginal rate is stated', () => {
    const r = homeBusinessSpaceTradeoff(space) as HomeBusinessSpaceResult;
    expect(r.extraDeductions.taxValue).toBe(4300.8);
    expect(r.cgt.currentLaw.tax).toBe(2800);
    expect(r.breakEvenGrowth.currentLaw).toBe(76_800);
    expect(r.assumptions.marginalRatePct).toBe(32);
    expect(r.assumptions.note).toMatch(/32%/);
    expect(r.assumptions.runningCosts).toEqual({ perYear: 1200, basis: 'given' });
  });

  it('a country the rules do not cover still answers unsupported, without validation', () => {
    expect(homeBusinessSpaceTradeoff({ ...space, country: 'NZ', businessSharePct: 500 })).toMatchObject({ supported: false });
  });
});

describe('roomOrPartnerArrangement guards', () => {
  it.each([
    ['weeksLetPerYear', { weeksLetPerYear: 53 }],
    ['weeksLetPerYear', { weeksLetPerYear: -1 }],
    ['weeklyRent', { weeklyRent: -100 }],
    ['homeCostsPerYear', { homeCostsPerYear: -1 }],
    ['expectedGrowth', { expectedGrowth: -1 }],
    ['letSharePct', { letSharePct: 101 }],
    ['marginalRatePct', { marginalRatePct: 250 }],
    ['years', { years: 51 }],
    ['saleDate', { saleDate: '2003-06-30' }],
    ['letEndDate', { letEndDate: '2030-01-01' }],
    ['firstLetDate', { firstLetDate: '2003-13-01' }],
  ] as Array<[string, Partial<LodgerArrangementInput>]>)('refuses %s = %j', (field, over) => {
    expect(refused(() => roomOrPartnerArrangement({ ...lodger, ...over }))).toEqual([field]);
  });

  it('52 weeks is allowed; the Thomas example is unchanged; the marginal rate is stated', () => {
    const r = roomOrPartnerArrangement({ ...lodger, weeksLetPerYear: 52 }) as LodgerArrangementResult;
    expect(r.cgt.netGain).toBe(70_000);
    expect(r.assumptions.marginalRatePct).toBe(32);
  });

  it('an unknown kind is refused; domestic needs nothing else', () => {
    expect(validateRoomOrPartnerArrangement({ kind: 'nephew' } as unknown as LodgerArrangementInput).map((p) => p.field)).toEqual(['kind']);
    expect(validateRoomOrPartnerArrangement({ kind: 'domestic' })).toEqual([]);
  });
});

describe('mainResidenceChoice guards', () => {
  const withHome = (i: number, over: object): MainResidenceChoiceInput => ({
    ...homes,
    homes: homes.homes.map((h, j) => (j === i ? { ...h, ...over } : h)),
  });

  it.each([
    ['marginalRatePct', { ...homes, marginalRatePct: 120 }],
    ['homes[0].expectedGrowth', withHome(0, { expectedGrowth: -5 })],
    ['homes[0].movedOut', withHome(0, { movedOut: '2001-01-01' })], // before owning it
    ['homes[0].movedOut', withHome(0, { movedOut: '2026-01-01' })], // after selling it
    ['homes[0].rentedFrom', withHome(0, { rentedFrom: '2024-01-01' })], // before moving out
    ['homes[1].ownedFrom', withHome(1, { ownedFrom: '2025-02-31' })],
    ['saleDates.New', { ...homes, saleDates: { Old: '2025-10-01', New: '2020-01-01' } }], // sold before bought
    ['saleDates.New', { ...homes, saleDates: { Old: '2025-10-01' } }],
    ['homes', { ...homes, homes: [homes.homes[0]] }],
  ] as Array<[string, MainResidenceChoiceInput]>)('refuses %s', (field, input) => {
    expect(refused(() => mainResidenceChoice(input))).toContain(field);
  });

  it('the Jeneen and John example is unchanged; the marginal rate is stated', () => {
    const r = mainResidenceChoice(homes) as MainResidenceChoiceResult;
    expect(r.movingHouseDays).toBe(184);
    expect(r.assumptions.marginalRatePct).toBe(32);
    expect(validateMainResidenceChoice(homes)).toEqual([]);
  });
});
