/**
 * South Africa depreciation tests — @ai2/tax-plugins
 * ai2fin.com
 *
 * The numeric cases follow Interpretation Note 47 (Issue 5): straight line
 * over the schedule's write-off period (a personal computer is 3 years, so
 * R10,000 claims R3,333.33 in a full year), apportioned by days for a part
 * year (4.1.6), and the small-item rule — an item costing LESS than R7,000 is
 * written off in full, for acquisitions on or after 1 March 2009. If one of
 * these fails, the plugin disagrees with SARS — do not "fix" the test.
 *
 * The method block is the election that names the regime: straight line is
 * the default, and diminishing value is allowed but SARS publishes no DV
 * rate, so the rules demand the taxpayer's own rather than inventing one.
 */

import {
  southAfricaPlugin,
  getDepreciationRules,
  ZA_DEPRECIATION_RULES,
  ZA_WRITE_OFF_CATEGORIES,
  ZA_SMALL_ITEM_ROWS,
  ZA_SMALL_ITEM_LIMIT,
  zaWriteOffPeriod,
  zaSmallItemThreshold,
  sortNewestFirst,
  resolveEffectiveDated,
} from '../src';

const za = ZA_DEPRECIATION_RULES;
const FULL_YEAR = { daysHeld: 365, daysInYear: 365 } as const;

// ─── Wiring ─────────────────────────────────────────────────────────────────

describe('ZA depreciation — wiring and regime', () => {
  it('the South Africa plugin hands back its own rules', () => {
    expect(getDepreciationRules(southAfricaPlugin)).toBe(za);
    expect(za.countryCode).toBe('ZA');
  });

  it('is a write-off period regime with an SL/DV election and day apportionment', () => {
    expect(za.regime).toBe('write_off_period');
    expect(za.defaultMethod).toBe('prime_cost');
    expect(za.methods).toEqual(['prime_cost', 'diminishing_value', 'immediate_writeoff']);
    expect(za.methods).not.toContain('pool');
    // IN47 apportions over the actual year, so the caller's denominator is honoured.
    expect(za.dayFractionDenominator(366)).toBe(366);
  });
});

// ─── The IN47 schedule ──────────────────────────────────────────────────────

describe('ZA write-off periods — the IN47 (Issue 5) schedule, short and sourced', () => {
  it('a personal computer is 3 years, a passenger car 5, furniture 6', () => {
    expect(zaWriteOffPeriod('computer_personal')).toEqual({
      years: 3,
      source: 'SARS IN47 (Issue 5) schedule',
      verified: true,
    });
    expect(zaWriteOffPeriod('passenger_car')?.years).toBe(5);
    expect(zaWriteOffPeriod('furniture_and_fittings')?.years).toBe(6);
    expect(za.effectiveLife('computer_personal')).toBe(3);
  });

  it('the short-life and long-life rows read straight from the schedule', () => {
    expect(zaWriteOffPeriod('tablet')?.years).toBe(2);
    expect(zaWriteOffPeriod('cellular_telephone')?.years).toBe(2);
    expect(zaWriteOffPeriod('software_pc')?.years).toBe(2);
    expect(zaWriteOffPeriod('truck_heavy')?.years).toBe(3);
    expect(zaWriteOffPeriod('delivery_vehicle')?.years).toBe(4);
    expect(zaWriteOffPeriod('generator_standby')?.years).toBe(15);
  });

  it('every row is sourced, positive and unique; an unknown asset is null, not a guess', () => {
    for (const c of ZA_WRITE_OFF_CATEGORIES) {
      expect(c.source).toBe('SARS IN47 (Issue 5) schedule');
      expect(c.years).toBeGreaterThan(0);
    }
    const keys = ZA_WRITE_OFF_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(zaWriteOffPeriod('espresso_machine')).toBeNull();
    expect(za.effectiveLife('espresso_machine')).toBeNull();
  });

  it('effectiveLifeCategories returns copies', () => {
    const cats = za.effectiveLifeCategories();
    expect(cats.length).toBe(ZA_WRITE_OFF_CATEGORIES.length);
    expect(cats).not.toBe(ZA_WRITE_OFF_CATEGORIES);
  });
});

// ─── Straight line over the period, apportioned by days ─────────────────────

describe('ZA wear-and-tear — straight line, day-apportioned (IN47 4.1.6)', () => {
  it('a R10,000 personal computer claims R3,333.33 in a full year', () => {
    const y1 = za.declineInValue({
      method: 'prime_cost',
      cost: 10000,
      openingAdjustableValue: 10000,
      effectiveLifeYears: zaWriteOffPeriod('computer_personal')!.years,
      ...FULL_YEAR,
    });
    expect(y1.declineInValue).toBe(3333.33);
    expect(y1.closingAdjustableValue).toBe(6666.67);
    expect(y1.rate).toBeCloseTo(1 / 3, 10);
  });

  it('brought into use for 100 days claims 100/365ths', () => {
    const part = za.declineInValue({
      method: 'prime_cost',
      cost: 10000,
      openingAdjustableValue: 10000,
      effectiveLifeYears: 3,
      daysHeld: 100,
      daysInYear: 365,
    });
    // 10,000 × (100 ÷ 365) × (1 ÷ 3)
    expect(part.declineInValue).toBe(913.24);
  });

  it('diminishing value demands the taxpayer’s own rate — SARS publishes none', () => {
    expect(() =>
      za.declineInValue({
        method: 'diminishing_value',
        cost: 10000,
        openingAdjustableValue: 10000,
        effectiveLifeYears: 3,
        ...FULL_YEAR,
      }),
    ).toThrow(/annualRate/);
    const dv = za.declineInValue({
      method: 'diminishing_value',
      cost: 10000,
      openingAdjustableValue: 10000,
      annualRate: 0.4,
      ...FULL_YEAR,
    });
    expect(dv.declineInValue).toBe(4000);
    expect(dv.rate).toBe(0.4);
  });

  it('there is no pool method', () => {
    expect(() =>
      za.declineInValue({ method: 'pool', cost: 10000, openingAdjustableValue: 10000, ...FULL_YEAR }),
    ).toThrow(/per asset/);
  });
});

// ─── Small items — less than R7,000, from 1 March 2009 ──────────────────────

describe('ZA small items — written off in full under R7,000', () => {
  it('R7,000 from 1 March 2009, verified', () => {
    expect(zaSmallItemThreshold('2026-01-01')).toMatchObject({ limit: 7000, verified: true });
    expect(zaSmallItemThreshold('2009-03-01')).toMatchObject({ limit: 7000, verified: true });
    expect(ZA_SMALL_ITEM_LIMIT).toBe(7000);
  });

  it('the limit is strict — the note says LESS than R7,000, and a set is one item', () => {
    const t = zaSmallItemThreshold('2026-01-01');
    expect(t.note).toMatch(/less than R7,000/);
    expect(t.note).toMatch(/set/i);
    // The host compares cost < limit: R6,999 qualifies, R7,000 does not.
    expect(6999).toBeLessThan(t.limit as number);
    expect(7000).not.toBeLessThan(t.limit as number);
  });

  it('before 1 March 2009 the limit is not invented', () => {
    const early = zaSmallItemThreshold('2009-02-28');
    expect(early.limit).toBeNull();
    expect(early.verified).toBe(false);
    expect(early.note).toMatch(/SARS/);
  });

  it('a small item writes off in full with no day apportionment', () => {
    const r = za.declineInValue({ method: 'immediate_writeoff', cost: 6999, openingAdjustableValue: 6999 });
    expect(r.declineInValue).toBe(6999);
    expect(r.closingAdjustableValue).toBe(0);
  });

  it('the rules expose it as both smallItemThreshold and instantAssetWriteOff, order-independent', () => {
    const d = new Date(2026, 5, 1);
    expect(za.smallItemThreshold(d)).toEqual(za.instantAssetWriteOff(d));
    const ordered = sortNewestFirst([...ZA_SMALL_ITEM_ROWS].reverse());
    expect(resolveEffectiveDated(ordered, '2010-01-01').limit).toBe(7000);
    expect(resolveEffectiveDated(ordered, '2008-01-01').limit).toBeNull();
  });
});

// ─── Concessions — the honest notes ─────────────────────────────────────────

describe('ZA concessions — s.12C and s.12E ship as notes, never as rates', () => {
  it('carries the small-item rule verified and the two statutory regimes unverified', () => {
    const cs = za.firstYearConcessions('2026-01-01');
    expect(cs.map((c) => [c.key, c.verified])).toEqual([
      ['small_item_write_off', true],
      ['s12c_manufacturing_plant', false],
      ['s12e_small_business_corporation', false],
    ]);
    const s12c = cs.find((c) => c.key === 's12c_manufacturing_plant')!;
    expect(s12c.percent).toBeNull();
    expect(s12c.limit).toBeNull();
    expect(s12c.note).toMatch(/section 12C/);
    expect(cs.find((c) => c.key === 's12e_small_business_corporation')!.note).toMatch(/section 12E/);
  });

  it('nothing beyond the common register fields is required', () => {
    expect(za.extraAssetFields()).toEqual([]);
  });
});

// ─── Explainer ──────────────────────────────────────────────────────────────

describe("ZA explainer — Fin's voice, SARS's words, sars.gov.za links only", () => {
  const e = za.explainer();
  const allText = [e.whatItIs, e.whenItApplies, ...e.howItWorks, ...e.readMore.map((r) => r.label)].join('\n');

  it('uses SARS vocabulary for the column labels', () => {
    expect(e.vocabulary.asset).toBe('Qualifying asset');
    expect(e.vocabulary.decline).toBe('Wear-and-tear allowance');
    expect(e.vocabulary.writtenDown).toBe('Income tax value');
    expect(e.vocabulary.rateBasis).toBe('Write-off period');
  });

  it('speaks to "you" and never as "we"', () => {
    expect(allText).toMatch(/\byou\b/i);
    expect(allText).not.toMatch(/\b(we|us|our)\b/i);
    expect(allText).not.toMatch(/\bAI\b/);
  });

  it('names the schedule, the small-item rule and the day apportionment', () => {
    expect(allText).toMatch(/Interpretation Note 47/);
    expect(allText).toMatch(/R7,000/);
    expect(allText).toMatch(/days/i);
    expect(allText).toMatch(/cash cost/i);
  });

  it('links only to sars.gov.za', () => {
    expect(e.readMore.length).toBeGreaterThanOrEqual(2);
    for (const r of e.readMore) {
      expect(r.url).toMatch(/^https:\/\/www\.sars\.gov\.za\//);
      expect(r.authority).toBe('SARS');
    }
  });

  it('returns a fresh copy each call', () => {
    const a = za.explainer();
    a.howItWorks.push('tampered');
    expect(za.explainer().howItWorks).not.toContain('tampered');
  });
});
