/**
 * Ireland depreciation tests — @ai2/tax-plugins
 * ai2fin.com
 *
 * The numeric cases are Revenue's own arithmetic: wear and tear at 12.5% of
 * the allowable cost a year over 8 years (s.284 TCA 1997), and the car cost
 * cap by CO₂ band from Tax and Duty Manual Part 11-00-01 — up to 155 g/km is
 * deemed €24,000 whatever the car cost, 156-190 gets half, over 190 gets
 * nothing, and no CO₂ figure means Category G. If one of these fails, the
 * plugin disagrees with Revenue — do not "fix" the test.
 *
 * The in-use block is the gate that makes the Irish rules honest: an asset
 * not in use for the trade at the END of the accounting period claims nothing
 * for that period, and the field is required rather than defaulted.
 */

import {
  IE_DEPRECIATION_RULES,
  IE_DISPOSAL_BALANCING,
  IE_WEAR_AND_TEAR_RATE,
  IE_WEAR_AND_TEAR_YEARS,
  IE_CAR_SPECIFIED_LIMIT,
  ieAllowableCost,
  ieWearAndTear,
} from '../src';

const ie = IE_DEPRECIATION_RULES;

// ─── Regime ─────────────────────────────────────────────────────────────────

describe('IE depreciation — regime and constants', () => {
  it('is a straight-line fixed-rate regime: 12.5% over 8 years', () => {
    expect(ie.countryCode).toBe('IE');
    expect(ie.regime).toBe('straight_line_fixed');
    expect(ie.rate).toBe(0.125);
    expect(ie.writeOffYears).toBe(8);
    expect(IE_WEAR_AND_TEAR_RATE * IE_WEAR_AND_TEAR_YEARS).toBe(1);
    expect(IE_CAR_SPECIFIED_LIMIT).toBe(24000);
    expect(ie.defaultMethod).toBe('prime_cost');
    expect(ie.methods).toEqual(['prime_cost', 'immediate_writeoff']);
  });

  it('the register must collect inUseAtPeriodEnd — required, not optional', () => {
    const fields = ie.extraAssetFields();
    expect(fields.map((f) => f.key)).toEqual([
      'inUseAtPeriodEnd',
      'isCar',
      'co2GPerKm',
      'isCommercialVehicle',
      'isEnergyEfficientSeai',
    ]);
    expect(fields.find((f) => f.key === 'inUseAtPeriodEnd')?.required).toBe(true);
  });
});

// ─── Wear and tear — the €25,000 machine ────────────────────────────────────

describe('IE wear and tear — 12.5% of allowable cost, straight line', () => {
  it('a €25,000 machine claims €3,125 a year, eight times over', () => {
    const year = ieWearAndTear({ allowableCost: 25000, inUseAtPeriodEnd: true });
    expect(year.allowance).toBe(3125);
    expect(year.rate).toBe(0.125);
    expect(year.proRated).toBe(false);
    expect(year.allowance * 8).toBe(25000);
  });

  it('not in use for the trade at the period end claims nothing, with the reason', () => {
    const idle = ieWearAndTear({ allowableCost: 25000, inUseAtPeriodEnd: false });
    expect(idle.allowance).toBe(0);
    expect(idle.note).toMatch(/end of the accounting period/);
  });

  it('a short accounting period pro-rates: nine months is €2,343.75', () => {
    const nine = ieWearAndTear({ allowableCost: 25000, inUseAtPeriodEnd: true, periodMonths: 9 });
    expect(nine.allowance).toBe(2343.75);
    expect(nine.proRated).toBe(true);
    expect(() => ieWearAndTear({ allowableCost: 25000, inUseAtPeriodEnd: true, periodMonths: 0 })).toThrow(/1 to 12/);
    expect(() => ieWearAndTear({ allowableCost: 25000, inUseAtPeriodEnd: true, periodMonths: 13 })).toThrow(/1 to 12/);
    expect(() => ieWearAndTear({ allowableCost: 25000, inUseAtPeriodEnd: true, periodMonths: 6.5 })).toThrow(/1 to 12/);
  });
});

// ─── The car cap by CO₂ band ────────────────────────────────────────────────

describe('IE cars — the €24,000 specified limit by CO₂ band', () => {
  it('a €48,000 car at 120 g/km is deemed €24,000 → €3,000 a year', () => {
    const cost = ieAllowableCost({ cost: 48000, isCar: true, co2GPerKm: 120 });
    expect(cost).toMatchObject({ allowableCost: 24000, band: 'A-C', capApplied: true, verified: true });
    expect(ieWearAndTear({ allowableCost: cost.allowableCost, inUseAtPeriodEnd: true }).allowance).toBe(3000);
  });

  it('the A-C band deems €24,000 in BOTH directions — a cheaper car claims on €24,000 too', () => {
    const cheap = ieAllowableCost({ cost: 18000, isCar: true, co2GPerKm: 100 });
    expect(cheap.allowableCost).toBe(24000);
    expect(cheap.capApplied).toBe(true);
  });

  it('a €48,000 car at 160 g/km gets the lower of half the limit and half the cost → €1,500 a year', () => {
    const cost = ieAllowableCost({ cost: 48000, isCar: true, co2GPerKm: 160 });
    expect(cost).toMatchObject({ allowableCost: 12000, band: 'D-E', capApplied: true });
    expect(ieWearAndTear({ allowableCost: cost.allowableCost, inUseAtPeriodEnd: true }).allowance).toBe(1500);
    // Half the cost wins where the car is cheap: €20,000 at 160 g/km → €10,000.
    expect(ieAllowableCost({ cost: 20000, isCar: true, co2GPerKm: 160 }).allowableCost).toBe(10000);
  });

  it('over 190 g/km gets nothing', () => {
    const cost = ieAllowableCost({ cost: 48000, isCar: true, co2GPerKm: 200 });
    expect(cost).toMatchObject({ allowableCost: 0, band: 'F-G' });
    expect(ieWearAndTear({ allowableCost: cost.allowableCost, inUseAtPeriodEnd: true }).allowance).toBe(0);
  });

  it('no CO₂ figure on record is Category G, with the manual’s treatment', () => {
    const unknown = ieAllowableCost({ cost: 30000, isCar: true });
    expect(unknown).toMatchObject({ allowableCost: 0, band: 'F-G', verified: true });
    expect(unknown.note).toMatch(/Category G/);
    expect(ieAllowableCost({ cost: 30000, isCar: true, co2GPerKm: null }).allowableCost).toBe(0);
  });

  it('the band boundaries are 155 and 190 inclusive', () => {
    expect(ieAllowableCost({ cost: 48000, isCar: true, co2GPerKm: 155 }).band).toBe('A-C');
    expect(ieAllowableCost({ cost: 48000, isCar: true, co2GPerKm: 156 }).band).toBe('D-E');
    expect(ieAllowableCost({ cost: 48000, isCar: true, co2GPerKm: 190 }).band).toBe('D-E');
    expect(ieAllowableCost({ cost: 48000, isCar: true, co2GPerKm: 191 }).band).toBe('F-G');
  });

  it('commercial vehicles and ordinary plant are uncapped', () => {
    expect(ieAllowableCost({ cost: 48000, isCommercialVehicle: true }).allowableCost).toBe(48000);
    expect(ieAllowableCost({ cost: 25000 })).toMatchObject({ allowableCost: 25000, band: null, capApplied: false });
  });
});

// ─── declineInValue — the statute's rate, not the caller's ──────────────────

describe('IE declineInValue — 12.5% is applied whatever was passed', () => {
  it('a €25,000 machine declines €3,125 with the rate forced to 12.5%', () => {
    const r = ie.declineInValue({
      method: 'prime_cost',
      cost: 25000,
      openingAdjustableValue: 25000,
      annualRate: 0.5, // must be overridden — s.284 leaves no rate to choose
      effectiveLifeYears: 4, // must be ignored
    });
    expect(r.rate).toBe(0.125);
    expect(r.declineInValue).toBe(3125);
    expect(r.closingAdjustableValue).toBe(21875);
  });

  it('a short period is months, and a days-based input is refused', () => {
    const nine = ie.declineInValue({
      method: 'prime_cost',
      cost: 25000,
      openingAdjustableValue: 25000,
      partYear: { kind: 'months', monthsUsed: 9 },
    });
    expect(nine.declineInValue).toBe(2343.75);
    expect(() =>
      ie.declineInValue({
        method: 'prime_cost',
        cost: 25000,
        openingAdjustableValue: 25000,
        daysHeld: 180,
        daysInYear: 365,
      }),
    ).toThrow(/months/i);
  });

  it('the accelerated capital allowance is the immediate write-off; nothing else exists', () => {
    const aca = ie.declineInValue({ method: 'immediate_writeoff', cost: 8000, openingAdjustableValue: 8000 });
    expect(aca.declineInValue).toBe(8000);
    expect(() =>
      ie.declineInValue({ method: 'diminishing_value', cost: 8000, openingAdjustableValue: 8000, annualRate: 0.25 }),
    ).toThrow(/not available/);
    expect(() => ie.declineInValue({ method: 'pool', cost: 8000, openingAdjustableValue: 8000 })).toThrow(
      /not available/,
    );
  });
});

// ─── Concessions, disposals, reference data ─────────────────────────────────

describe('IE concessions and honesty flags', () => {
  it('the ACA is the one concession: 100%, gated on the SEAI field', () => {
    const cs = ie.firstYearConcessions('2026-01-01');
    expect(cs).toHaveLength(1);
    expect(cs[0]).toMatchObject({
      key: 'accelerated_capital_allowance_seai',
      kind: 'upfront_percent',
      percent: 100,
      verified: true,
      requiresField: 'isEnergyEfficientSeai',
    });
  });

  it('no write-off threshold is invented', () => {
    const w = ie.instantAssetWriteOff(new Date());
    expect(w.limit).toBeNull();
    expect(w.verified).toBe(false);
    expect(w.note).toMatch(/SEAI/);
  });

  it('disposal balancing mechanics ship unverified, with the note to render', () => {
    expect(IE_DISPOSAL_BALANCING.verified).toBe(false);
    expect(IE_DISPOSAL_BALANCING.note).toMatch(/balancing/i);
    // The generic arithmetic still answers, so a host is not left with nothing.
    expect(ie.balancingAdjustment({ terminationValue: 5000, adjustableValue: 3000, taxableUsePercent: 100 })).toEqual({
      amount: 2000,
      assessable: true,
    });
  });

  it('effective lives: plant 8 years, industrial buildings 25, nothing else', () => {
    expect(ie.effectiveLife('plant_and_machinery')).toBe(8);
    expect(ie.effectiveLife('industrial_building')).toBe(25);
    expect(ie.effectiveLife('computer_laptop')).toBeNull();
    expect(ie.effectiveLifeCategories().map((c) => c.key)).toEqual(['plant_and_machinery', 'industrial_building']);
  });
});

// ─── Explainer ──────────────────────────────────────────────────────────────

describe("IE explainer — Fin's voice, Revenue's words, revenue.ie links only", () => {
  const e = ie.explainer();
  const allText = [e.whatItIs, e.whenItApplies, ...e.howItWorks, ...e.readMore.map((r) => r.label)].join('\n');

  it('uses Revenue vocabulary for the column labels', () => {
    expect(e.vocabulary.asset).toBe('Plant and machinery');
    expect(e.vocabulary.decline).toBe('Wear and tear allowance');
    expect(e.vocabulary.writtenDown).toBe('Tax written down value');
  });

  it('speaks to "you" and never as "we"', () => {
    expect(allText).toMatch(/\byou\b/i);
    expect(allText).not.toMatch(/\b(we|us|our)\b/i);
    expect(allText).not.toMatch(/\bAI\b/);
  });

  it('names the 12.5%, the car cap and the period-end condition', () => {
    expect(allText).toMatch(/12\.5%/);
    expect(allText).toMatch(/€24,000/);
    expect(allText).toMatch(/end of the accounting period/);
    expect(allText).toMatch(/SEAI/);
  });

  it('links only to revenue.ie', () => {
    expect(e.readMore.length).toBeGreaterThanOrEqual(2);
    for (const r of e.readMore) {
      expect(r.url).toMatch(/^https:\/\/www\.revenue\.ie\//);
      expect(r.authority).toBe('Revenue');
    }
  });

  it('returns a fresh copy each call', () => {
    const a = ie.explainer();
    a.howItWorks.push('tampered');
    expect(ie.explainer().howItWorks).not.toContain('tampered');
  });
});
