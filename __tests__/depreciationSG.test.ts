/**
 * Singapore depreciation tests — @ai2/tax-plugins
 * ai2fin.com
 *
 * The numeric cases are IRAS's own formulas from the "Capital Allowances"
 * page: one-third of cost for three years under s.19A(1), 75%/25% over two
 * years under s.19A(1E), 100% in one year under s.19A(2) and s.19A(10A), and
 * the s.19 initial allowance of 20% plus an annual allowance of 80% over the
 * working life. If one of these fails, the plugin disagrees with IRAS — do
 * not "fix" the test.
 *
 * The elective blocks are the rule that makes Singapore its own regime: the
 * method is chosen PER ASSET, the two-year write-off existed only for three
 * YAs, and an S-plated private car gets nothing at all.
 */

import {
  singaporePlugin,
  getDepreciationRules,
  SG_DEPRECIATION_RULES,
  SG_LOW_VALUE_PER_ITEM_LIMIT,
  SG_LOW_VALUE_TOTAL_PER_YA,
  SG_TWO_YEAR_YAS,
  sgAllowanceForYear,
  sgEligibility,
  sgLowValueCap,
  sgMethodsFor,
  type SgAssetInput,
} from '../src';

const sg = SG_DEPRECIATION_RULES;

// ─── Wiring ─────────────────────────────────────────────────────────────────

describe('SG depreciation — wiring and regime', () => {
  it('the Singapore plugin hands back its own rules', () => {
    expect(getDepreciationRules(singaporePlugin)).toBe(sg);
    expect(sg.countryCode).toBe('SG');
  });

  it('is a write-off elective regime with no part-year apportionment', () => {
    expect(sg.regime).toBe('write_off_elective');
    expect(sg.defaultMethod).toBe('prime_cost');
    expect(sg.methods).toEqual(['prime_cost', 'immediate_writeoff']);
    expect(sg.methods).not.toContain('pool');
  });

  it('declares an explainer, concessions and extra fields like every regime', () => {
    const e = sg.explainer();
    expect(e.vocabulary.writtenDown).toBe('Tax written down value (TWDV)');
    expect(e.howItWorks.length).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(sg.firstYearConcessions(new Date(2026, 0, 1)))).toBe(true);
    expect(sg.extraAssetFields().map((f) => f.key)).toEqual([
      'isComputerOrAutomation',
      'isSPlatedPrivateCar',
      'workingLifeYears',
    ]);
  });
});

// ─── The IRAS formulas, to the cent ─────────────────────────────────────────

describe('SG allowances — s.19A(1) three-year write-off', () => {
  const asset: SgAssetInput = { cost: 3000 };

  it('a $3,000 asset claims $1,000 a year for three years and nothing after', () => {
    for (const year of [1, 2, 3]) {
      const a = sgAllowanceForYear(asset, 'three_year_s19a1', year);
      expect(a.allowance).toBe(1000);
      expect(a.initialAllowance).toBe(0);
      expect(a.totalYears).toBe(3);
      expect(a.verified).toBe(true);
    }
    expect(sgAllowanceForYear(asset, 'three_year_s19a1', 4).allowance).toBe(0);
  });

  it('the final year absorbs the rounding cent so the TWDV ends at zero', () => {
    const tenK: SgAssetInput = { cost: 10000 };
    const years = [1, 2, 3].map((y) => sgAllowanceForYear(tenK, 'three_year_s19a1', y).allowance);
    expect(years).toEqual([3333.33, 3333.33, 3333.34]);
    expect(years.reduce((t, a) => t + a, 0)).toBe(10000);
  });

  it('yearIndex is 1-based and whole', () => {
    expect(() => sgAllowanceForYear(asset, 'three_year_s19a1', 0)).toThrow(/1-based/);
    expect(() => sgAllowanceForYear(asset, 'three_year_s19a1', 1.5)).toThrow(/1-based/);
  });
});

describe('SG allowances — s.19A(1E) two-year write-off, 75% then 25%', () => {
  it('a $3,000 asset claims $2,250 then $750', () => {
    const asset: SgAssetInput = { cost: 3000 };
    expect(sgAllowanceForYear(asset, 'two_year_s19a1e', 1).allowance).toBe(2250);
    expect(sgAllowanceForYear(asset, 'two_year_s19a1e', 2).allowance).toBe(750);
    expect(sgAllowanceForYear(asset, 'two_year_s19a1e', 3).allowance).toBe(0);
  });

  it('is offered only for the basis periods of YAs 2021, 2022 and 2024', () => {
    const asset: SgAssetInput = { cost: 3000 };
    expect(SG_TWO_YEAR_YAS).toEqual([2021, 2022, 2024]);
    for (const ya of SG_TWO_YEAR_YAS) {
      expect(sgMethodsFor(asset, ya)).toContain('two_year_s19a1e');
    }
    expect(sgMethodsFor(asset, 2023)).not.toContain('two_year_s19a1e');
    expect(sgMethodsFor(asset, 2026)).not.toContain('two_year_s19a1e');
  });
});

describe('SG allowances — s.19 working life, IA 20% plus AA 80% over the life', () => {
  const asset: SgAssetInput = { cost: 60000, workingLifeYears: 6 };

  it('a $60,000 asset over 6 years: $20,000 in year one, $8,000 a year after', () => {
    const y1 = sgAllowanceForYear(asset, 'working_life_s19', 1);
    expect(y1).toMatchObject({ initialAllowance: 12000, annualAllowance: 8000, allowance: 20000, totalYears: 6 });
    for (const year of [2, 3, 4, 5, 6]) {
      const a = sgAllowanceForYear(asset, 'working_life_s19', year);
      expect(a.initialAllowance).toBe(0);
      expect(a.allowance).toBe(8000);
    }
    expect(sgAllowanceForYear(asset, 'working_life_s19', 7).allowance).toBe(0);
  });

  it('the allowances sum to the cost exactly', () => {
    const total = [1, 2, 3, 4, 5, 6]
      .map((y) => sgAllowanceForYear(asset, 'working_life_s19', y).allowance)
      .reduce((t, a) => t + a, 0);
    expect(total).toBe(60000);
  });

  it('requires the 6/12/16 election rather than assuming one', () => {
    expect(() => sgAllowanceForYear({ cost: 60000 }, 'working_life_s19', 1)).toThrow(/workingLifeYears/);
    expect(() =>
      sgAllowanceForYear({ cost: 60000, workingLifeYears: 8 as never }, 'working_life_s19', 1),
    ).toThrow(/workingLifeYears/);
    const sixteen = sgAllowanceForYear({ cost: 160000, workingLifeYears: 16 }, 'working_life_s19', 1);
    expect(sixteen).toMatchObject({ initialAllowance: 32000, annualAllowance: 8000, totalYears: 16 });
  });

  it('the streamlined election is offered from YA 2023, not before', () => {
    expect(sgMethodsFor(asset, 2023)).toContain('working_life_s19');
    expect(sgMethodsFor(asset, 2022)).not.toContain('working_life_s19');
  });
});

describe('SG allowances — the one-year write-offs', () => {
  it('s.19A(2): a computer claims 100% in year one, and the method is gated on the field', () => {
    const laptop: SgAssetInput = { cost: 5000, isComputerOrAutomation: true };
    expect(sgAllowanceForYear(laptop, 'one_year_s19a2', 1).allowance).toBe(5000);
    expect(sgAllowanceForYear(laptop, 'one_year_s19a2', 2).allowance).toBe(0);
    expect(() => sgAllowanceForYear({ cost: 5000 }, 'one_year_s19a2', 1)).toThrow(/automation/);
    expect(() =>
      sgAllowanceForYear({ cost: 5000, isComputerOrAutomation: null }, 'one_year_s19a2', 1),
    ).toThrow(/automation/);
  });

  it('s.19A(10A): a low-value asset claims 100%, over $5,000 is refused', () => {
    expect(sgAllowanceForYear({ cost: 4400 }, 'one_year_low_value_s19a10a', 1).allowance).toBe(4400);
    expect(sgAllowanceForYear({ cost: 5000 }, 'one_year_low_value_s19a10a', 1).allowance).toBe(5000);
    expect(() => sgAllowanceForYear({ cost: 5001 }, 'one_year_low_value_s19a10a', 1)).toThrow(/5,000/);
  });

  it('the $30,000 cap is published for the host: seven $4,400 assets do not all fit', () => {
    const cap = sgLowValueCap(2026);
    expect(cap).toMatchObject({
      perItemLimit: SG_LOW_VALUE_PER_ITEM_LIMIT,
      totalPerYa: SG_LOW_VALUE_TOTAL_PER_YA,
      verified: true,
    });
    // IRAS's illustration: 7 × $4,400 = $30,800 exceeds the cap; 6 fit.
    expect(7 * 4400).toBeGreaterThan(cap.totalPerYa as number);
    expect(6 * 4400).toBeLessThanOrEqual(cap.totalPerYa as number);
  });

  it('limits for years of assessment before 2023 are not invented', () => {
    const early = sgLowValueCap(2019);
    expect(early).toMatchObject({ perItemLimit: null, totalPerYa: null, verified: false });
    expect(early.note).toMatch(/IRAS/);
  });
});

// ─── Eligibility and elections ──────────────────────────────────────────────

describe('SG eligibility — the S-plate gate', () => {
  it('an S-plated private passenger car gets nothing, with the IRAS wording', () => {
    const car: SgAssetInput = { cost: 120000, isSPlatedPrivateCar: true };
    const out = sgEligibility(car);
    expect(out.eligible).toBe(false);
    expect(out.note).toMatch(/S-plated private passenger car/);
    expect(sgMethodsFor(car, 2026)).toEqual([]);
    expect(() => sgAllowanceForYear(car, 'three_year_s19a1', 1)).toThrow(/S-plated/);
  });

  it('an unanswered question is not a disqualification, and commercial vehicles qualify', () => {
    expect(sgEligibility({ cost: 1000 }).eligible).toBe(true);
    expect(sgEligibility({ cost: 1000, isSPlatedPrivateCar: null }).eligible).toBe(true);
    expect(sgEligibility({ cost: 80000, isSPlatedPrivateCar: false }).eligible).toBe(true);
  });

  it('methodsFor offers the elections the asset actually has', () => {
    expect(sgMethodsFor({ cost: 4000, isComputerOrAutomation: true }, 2026)).toEqual([
      'one_year_s19a2',
      'one_year_low_value_s19a10a',
      'three_year_s19a1',
      'working_life_s19',
    ]);
    expect(sgMethodsFor({ cost: 20000 }, 2024)).toEqual([
      'two_year_s19a1e',
      'three_year_s19a1',
      'working_life_s19',
    ]);
    expect(() => sgMethodsFor({ cost: 1000 }, 24.5)).toThrow(/whole year/);
  });
});

// ─── declineInValue — no apportionment, elective rates only ─────────────────

describe('SG declineInValue — allowances are per YA, never day-apportioned', () => {
  it('prime cost with the one-third rate matches the three-year write-off', () => {
    const r = sg.declineInValue({
      method: 'prime_cost',
      cost: 3000,
      openingAdjustableValue: 3000,
      annualRate: 1 / 3,
      partYear: { kind: 'months', monthsUsed: 12 },
    });
    expect(r.declineInValue).toBe(1000);
    expect(r.closingAdjustableValue).toBe(2000);
  });

  it('a day count is overridden, not honoured — there is no IRAS day fraction', () => {
    const r = sg.declineInValue({
      method: 'prime_cost',
      cost: 3000,
      openingAdjustableValue: 3000,
      annualRate: 1 / 3,
      daysHeld: 100,
      daysInYear: 365,
    });
    expect(r.declineInValue).toBe(1000);
  });

  it('refuses a missing rate and the methods Singapore does not have', () => {
    expect(() =>
      sg.declineInValue({ method: 'prime_cost', cost: 3000, openingAdjustableValue: 3000 }),
    ).toThrow(/annualRate/);
    expect(() =>
      sg.declineInValue({ method: 'diminishing_value', cost: 3000, openingAdjustableValue: 3000, annualRate: 0.3 }),
    ).toThrow(/not available/);
    expect(() =>
      sg.declineInValue({ method: 'pool', cost: 3000, openingAdjustableValue: 3000 }),
    ).toThrow(/not available/);
  });

  it('immediate write-off claims the whole value', () => {
    const r = sg.declineInValue({ method: 'immediate_writeoff', cost: 4400, openingAdjustableValue: 4400 });
    expect(r.declineInValue).toBe(4400);
    expect(r.closingAdjustableValue).toBe(0);
  });
});

// ─── Concessions, write-off info and the working life ───────────────────────

describe('SG concessions and reference data', () => {
  it('instantAssetWriteOff maps to the s.19A(10A) per-item limit', () => {
    expect(sg.instantAssetWriteOff(new Date(2026, 0, 15))).toMatchObject({ limit: 5000, verified: true });
    expect(sg.instantAssetWriteOff(new Date(2018, 5, 1))).toMatchObject({ limit: null, verified: false });
  });

  it('firstYearConcessions carries the two one-year routes with their fields', () => {
    const cs = sg.firstYearConcessions('2026-01-01');
    expect(cs.map((c) => [c.key, c.kind, c.limit, c.percent, c.verified])).toEqual([
      ['one_year_computers_automation', 'upfront_percent', null, 100, true],
      ['one_year_low_value', 'threshold_write_off', 5000, null, true],
    ]);
    expect(cs[0].requiresField).toBe('isComputerOrAutomation');
    expect(cs[1].note).toMatch(/30,000/);
  });

  it('only the motor vehicle working life is shipped — nothing else is guessed', () => {
    expect(sg.effectiveLife('motor_vehicle')).toBe(6);
    expect(sg.effectiveLife('computer_laptop')).toBeNull();
    const cats = sg.effectiveLifeCategories();
    expect(cats).toHaveLength(1);
    expect(cats[0]).toMatchObject({ key: 'motor_vehicle', years: 6 });
    expect(cats[0].source).toMatch(/Sixth Schedule/);
  });
});

// ─── Explainer ──────────────────────────────────────────────────────────────

describe("SG explainer — Fin's voice, IRAS's words, IRAS's links only", () => {
  const e = sg.explainer();
  const allText = [e.whatItIs, e.whenItApplies, ...e.howItWorks, ...e.readMore.map((r) => r.label)].join('\n');

  it('uses IRAS vocabulary for the column labels', () => {
    expect(e.vocabulary.asset).toBe('Qualifying fixed asset');
    expect(e.vocabulary.decline).toBe('Capital allowance');
    expect(e.vocabulary.writtenDown).toBe('Tax written down value (TWDV)');
    expect(e.vocabulary.rateBasis).toBe('Write-off method');
  });

  it('speaks to "you" and never as "we"', () => {
    expect(allText).toMatch(/\byou\b/i);
    expect(allText).not.toMatch(/\b(we|us|our)\b/i);
    expect(allText).not.toMatch(/\bAI\b/);
  });

  it('leads with the elections and the S-plate carve-out', () => {
    expect(allText).toMatch(/three years/i);
    expect(allText).toMatch(/S-plated/);
    expect(allText).toMatch(/\$5,000/);
    expect(allText).toMatch(/\$30,000/);
  });

  it('links only to iras.gov.sg', () => {
    expect(e.readMore.length).toBeGreaterThanOrEqual(1);
    for (const r of e.readMore) {
      expect(r.url).toMatch(/^https:\/\/www\.iras\.gov\.sg\//);
      expect(r.authority).toBe('IRAS');
    }
  });

  it('returns a fresh copy each call', () => {
    const a = sg.explainer();
    a.howItWorks.push('tampered');
    expect(sg.explainer().howItWorks).not.toContain('tampered');
  });
});
