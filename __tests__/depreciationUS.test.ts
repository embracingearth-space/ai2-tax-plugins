/**
 * United States MACRS depreciation tests — @ai2/tax-plugins
 * ai2fin.com
 *
 * The United States is the TABLE regime: the IRS prints the yearly
 * percentages and this module ships them verbatim. The figures are the
 * authority's own (read 2026-08-24): Tables A-1 to A-5 and Table B-1 from
 * Publication 946 (2025) pp. 71-73 and 99; the >40%-in-Q4 mid-quarter test
 * from chapter 4; the §179 dollar limits from "What's New" for 2025 and
 * 2026; the bonus cliff at 20 January 2025 from P.L. 119-21 as described in
 * the same publication; the §280F passenger automobile caps from Rev. Proc.
 * 2025-16 and 2026-15; and the $2,500 / $5,000 de minimis safe harbor from
 * the tangible property regulations.
 */

import {
  getDepreciationRules,
  getPluginForCountry,
  computeMacrsYear,
  US_DEPRECIATION_RULES,
  US_MACRS_TABLE_A1,
  US_MACRS_MID_QUARTER_TABLES,
  US_PROPERTY_CLASSES,
  usPropertyClass,
  usTablePercent,
  usConvention,
  usSection179,
  usBonusPercent,
  usAutoCap,
  usDeMinimis,
  type MacrsRules,
} from '../src';

const us = US_DEPRECIATION_RULES;

describe('US MACRS — wiring and regime', () => {
  it('the US plugin hands back the MACRS rules', () => {
    const rules = getDepreciationRules(getPluginForCountry('US')) as MacrsRules;
    expect(rules).toBe(us);
    expect(rules.countryCode).toBe('US');
    expect(rules.regime).toBe('macrs');
    expect(rules.defaultMethod).toBe('immediate_writeoff');
    expect(rules.methods).not.toContain('diminishing_value');
  });

  it('refuses a formula method — the IRS table is the answer', () => {
    expect(() =>
      us.declineInValue({ method: 'diminishing_value', cost: 1000, openingAdjustableValue: 1000, daysHeld: 365, daysInYear: 365 }),
    ).toThrow(/table/i);
    const out = us.declineInValue({ method: 'immediate_writeoff', cost: 2000, openingAdjustableValue: 2000 });
    expect(out.declineInValue).toBe(2000);
    expect(out.closingAdjustableValue).toBe(0);
  });

  it('effective life categories are the Table B-1 classes, and effectiveLife resolves a class key', () => {
    expect(us.effectiveLife('00.12')).toBe(5);
    expect(us.effectiveLife('00.11')).toBe(7);
    expect(us.effectiveLife('unknown')).toBeNull();
    const cats = us.effectiveLifeCategories();
    expect(cats.map((c) => c.key)).toEqual(US_PROPERTY_CLASSES.map((c) => c.assetClass));
    for (const c of cats) expect(c.source).toMatch(/^https:\/\/www\.irs\.gov\//);
  });
});

describe('US property classes — Table B-1', () => {
  it('routes by kind: computer 00.12 (5-yr), furniture 00.11 (7-yr), automobile 00.22 (5-yr), land improvement 00.3 (15-yr)', () => {
    expect(usPropertyClass({ cost: 3_000, kind: 'computer' })).toMatchObject({ assetClass: '00.12', recoveryYears: 5, verified: true });
    expect(usPropertyClass({ cost: 10_000, kind: 'office_furniture' })).toMatchObject({ assetClass: '00.11', recoveryYears: 7, verified: true });
    expect(usPropertyClass({ cost: 40_000, kind: 'automobile' })).toMatchObject({ assetClass: '00.22', recoveryYears: 5, verified: true });
    expect(usPropertyClass({ cost: 30_000, kind: 'light_truck' })).toMatchObject({ assetClass: '00.241', recoveryYears: 5 });
    expect(usPropertyClass({ cost: 50_000, kind: 'land_improvement' })).toMatchObject({ assetClass: '00.3', recoveryYears: 15 });
  });

  it('a recorded asset class wins over kind; an unknown class is unverified with no period', () => {
    expect(usPropertyClass({ cost: 3_000, kind: 'computer', assetClass: '00.11' }).recoveryYears).toBe(7);
    const unknown = usPropertyClass({ cost: 3_000, assetClass: '30.1' });
    expect(unknown.recoveryYears).toBeNull();
    expect(unknown.verified).toBe(false);
  });

  it('an asset with no kind falls to 7-year property, unverified — Pub 946\'s "no class life" default', () => {
    const r = usPropertyClass({ cost: 1_000 });
    expect(r.recoveryYears).toBe(7);
    expect(r.assetClass).toBeNull();
    expect(r.verified).toBe(false);
  });
});

describe('US percentage tables — Appendix A verbatim', () => {
  it('Table A-1 half-year rows are the page\'s own and each column sums to 100%', () => {
    expect(US_MACRS_TABLE_A1[3]).toEqual([33.33, 44.45, 14.81, 7.41]);
    expect(US_MACRS_TABLE_A1[5]).toEqual([20.0, 32.0, 19.2, 11.52, 11.52, 5.76]);
    expect(US_MACRS_TABLE_A1[7]).toEqual([14.29, 24.49, 17.49, 12.49, 8.93, 8.92, 8.93, 4.46]);
    for (const years of [3, 5, 7, 10, 15]) {
      const sum = US_MACRS_TABLE_A1[years].reduce((t, p) => t + p, 0);
      expect(sum).toBeCloseTo(100, 6);
      expect(US_MACRS_TABLE_A1[years]).toHaveLength(years + 1);
    }
  });

  it('every mid-quarter column sums to 100% too', () => {
    for (const q of [1, 2, 3, 4] as const) {
      for (const years of [3, 5, 7, 10, 15]) {
        const col = US_MACRS_MID_QUARTER_TABLES[q][years];
        expect(col).toHaveLength(years + 1);
        expect(col.reduce((t, p) => t + p, 0)).toBeCloseTo(100, 6);
      }
    }
  });

  it('tablePercent reads the half-year and mid-quarter tables by year', () => {
    expect(usTablePercent(7, 1, 'half_year')).toMatchObject({ percent: 14.29, verified: true });
    expect(usTablePercent(5, 2, 'half_year').percent).toBe(32.0);
    expect(usTablePercent(5, 1, { midQuarter: 1 })).toMatchObject({ percent: 35.0, verified: true });
    expect(usTablePercent(7, 1, { midQuarter: 1 }).percent).toBe(25.0);
    expect(usTablePercent(5, 1, { midQuarter: 2 }).percent).toBe(25.0);
    expect(usTablePercent(5, 1, { midQuarter: 3 }).percent).toBe(15.0);
    expect(usTablePercent(5, 1, { midQuarter: 4 }).percent).toBe(5.0);
    expect(usTablePercent(5, 6, { midQuarter: 4 }).percent).toBe(9.58);
  });

  it('a year past the recovery period is 0; a recovery period not shipped is null and unverified', () => {
    expect(usTablePercent(5, 7, 'half_year')).toMatchObject({ percent: 0, verified: true });
    const missing = usTablePercent(20, 1, 'half_year');
    expect(missing.percent).toBeNull();
    expect(missing.verified).toBe(false);
    expect(() => usTablePercent(5, 0, 'half_year')).toThrow(/yearIndex/);
  });
});

describe('US convention — the >40%-in-Q4 test', () => {
  it('more than 40% of the year\'s bases in the fourth quarter forces mid-quarter', () => {
    const mq = usConvention({ basesByQuarter: [10_000, 0, 0, 7_000] });
    expect(mq.convention).toBe('mid_quarter');
    expect(mq.q4Share).toBeCloseTo(7_000 / 17_000, 12);
  });

  it('exactly 40% stays half-year — the test is MORE than 40%', () => {
    const hy = usConvention({ basesByQuarter: [6_000, 0, 0, 4_000] });
    expect(hy.convention).toBe('half_year');
    expect(hy.q4Share).toBeCloseTo(0.4, 12);
    expect(usConvention({ basesByQuarter: [0, 0, 0, 0] }).convention).toBe('half_year');
  });
});

describe('US §179, bonus, auto caps and de minimis', () => {
  it('§179 for 2026: $2,560,000 limit, $4,090,000 phase-out, $32,000 SUV cap', () => {
    expect(usSection179(2026)).toMatchObject({
      limit: 2_560_000,
      phaseOutThreshold: 4_090_000,
      suvCap: 32_000,
      verified: true,
    });
    expect(usSection179(2025)).toMatchObject({ limit: 2_500_000, phaseOutThreshold: 4_000_000, suvCap: 31_300 });
  });

  it('§179 for a year the publication does not cover is unverified, never a guess', () => {
    const old = usSection179(2024);
    expect(old.limit).toBeNull();
    expect(old.verified).toBe(false);
  });

  it('bonus is 40% for property acquired before 20 January 2025 and 100% after 19 January 2025', () => {
    expect(usBonusPercent('2025-01-19', '2025-06-01')).toMatchObject({ percent: 40, verified: true });
    expect(usBonusPercent('2025-01-20', '2025-06-01')).toMatchObject({ percent: 100, verified: true });
    expect(usBonusPercent('2026-03-01', '2026-03-15').percent).toBe(100);
    expect(usBonusPercent('2025-01-20', '2025-06-01').note).toMatch(/40%/); // the election is mentioned, never applied
  });

  it('an old acquisition placed in service outside 2025 is unverified — the publication stops there', () => {
    const out = usBonusPercent('2024-12-01', '2026-03-01');
    expect(out.percent).toBeNull();
    expect(out.verified).toBe(false);
    expect(() => usBonusPercent('2025-06-01', '2025-01-01')).toThrow(/placedInService/);
  });

  it('auto caps: 2026 with bonus $20,300 first year, without $12,300; unknown years are unverified', () => {
    expect(usAutoCap(2026, true).caps).toEqual([20_300, 19_800, 11_900, 7_160]);
    expect(usAutoCap(2026, false).caps).toEqual([12_300, 19_800, 11_900, 7_160]);
    expect(usAutoCap(2025, true).caps).toEqual([20_200, 19_600, 11_800, 7_060]);
    expect(usAutoCap(2025, false).caps![0]).toBe(12_200);
    const unknown = usAutoCap(2027, true);
    expect(unknown.caps).toBeNull();
    expect(unknown.verified).toBe(false);
  });

  it('de minimis: $2,500 per item without an applicable financial statement, $5,000 with one', () => {
    expect(usDeMinimis(false)).toMatchObject({ limit: 2_500, verified: true });
    expect(usDeMinimis(true)).toMatchObject({ limit: 5_000, verified: true });
  });

  it('instantAssetWriteOff mirrors the §179 limit for the year of the date', () => {
    expect(us.instantAssetWriteOff(new Date(2026, 5, 1)).limit).toBe(2_560_000);
    expect(us.instantAssetWriteOff(new Date(2024, 5, 1)).verified).toBe(false);
  });
});

describe('US year arithmetic — computeMacrsYear', () => {
  it('$10,000 of 7-year furniture, half-year convention: year 1 is $1,429', () => {
    const pct = usTablePercent(7, 1, 'half_year').percent as number;
    const y1 = computeMacrsYear({ cost: 10_000, yearIndex: 1, tablePercent: pct });
    expect(y1.deduction).toBe(1_429);
    expect(y1.tableDepreciation).toBe(1_429);
    expect(y1.section179).toBe(0);
    expect(y1.bonus).toBe(0);
    expect(y1.depreciableBasis).toBe(10_000);
  });

  it('a $10,000 5-year computer deducts $3,200 in year 2', () => {
    const pct = usTablePercent(5, 2, 'half_year').percent as number;
    const y2 = computeMacrsYear({ cost: 10_000, yearIndex: 2, tablePercent: pct });
    expect(y2.deduction).toBe(3_200);
  });

  it('§179 comes off first, bonus takes what is left, the table gets the rest', () => {
    const y1 = computeMacrsYear({ cost: 10_000, yearIndex: 1, tablePercent: 14.29, section179: 4_000, bonusPercent: 100 });
    expect(y1.section179).toBe(4_000);
    expect(y1.bonus).toBe(6_000);
    expect(y1.tableDepreciation).toBe(0);
    expect(y1.deduction).toBe(10_000);
    expect(y1.depreciableBasis).toBe(0);
    // 40% bonus leaves 60% of the post-§179 basis on the schedule.
    const partial = computeMacrsYear({ cost: 10_000, yearIndex: 1, tablePercent: 20, section179: 0, bonusPercent: 40 });
    expect(partial.bonus).toBe(4_000);
    expect(partial.tableDepreciation).toBe(1_200);
    expect(partial.deduction).toBe(5_200);
  });

  it('later years deduct the table figure only — §179 and bonus merely keep the basis reduced', () => {
    const y2 = computeMacrsYear({ cost: 10_000, yearIndex: 2, tablePercent: 32, bonusPercent: 40 });
    expect(y2.section179).toBe(0);
    expect(y2.bonus).toBe(0);
    expect(y2.depreciableBasis).toBe(6_000);
    expect(y2.deduction).toBe(1_920);
  });

  it('the 2026 §280F cap is a ceiling: a $60,000 car with 100% bonus deducts $20,300, not $60,000', () => {
    const caps = usAutoCap(2026, true).caps as [number, number, number, number];
    const y1 = computeMacrsYear({ cost: 60_000, yearIndex: 1, tablePercent: 20, bonusPercent: 100, autoCap: caps[0] });
    expect(y1.cappedByAutoLimit).toBe(true);
    expect(y1.deduction).toBe(20_300);
    // Under the cap, nothing is trimmed.
    const cheap = computeMacrsYear({ cost: 10_000, yearIndex: 1, tablePercent: 20, autoCap: caps[0] });
    expect(cheap.cappedByAutoLimit).toBe(false);
    expect(cheap.deduction).toBe(2_000);
  });

  it('§179 above cost is clamped to cost', () => {
    const y1 = computeMacrsYear({ cost: 5_000, yearIndex: 1, tablePercent: 20, section179: 9_000 });
    expect(y1.section179).toBe(5_000);
    expect(y1.depreciableBasis).toBe(0);
    expect(y1.deduction).toBe(5_000);
  });

  it('a total exactly equal to the cap is not reported as capped', () => {
    const y1 = computeMacrsYear({ cost: 10_000, yearIndex: 1, tablePercent: 20, autoCap: 2_000 });
    expect(y1.deduction).toBe(2_000);
    expect(y1.cappedByAutoLimit).toBe(false);
  });

  it('rejects nonsense: a fractional year, a percent over 100', () => {
    expect(() => computeMacrsYear({ cost: 1_000, yearIndex: 1.5, tablePercent: 20 })).toThrow(/yearIndex/);
    expect(() => computeMacrsYear({ cost: 1_000, yearIndex: 1, tablePercent: 200 })).toThrow(/tablePercent/);
    expect(() => computeMacrsYear({ cost: 1_000, yearIndex: 1, tablePercent: 20, bonusPercent: 101 })).toThrow(/bonusPercent/);
  });
});

describe('US concessions, fields and the explainer', () => {
  it('firstYearConcessions: §179, bonus and the de minimis election, dated correctly', () => {
    const c = us.firstYearConcessions('2026-02-01');
    const byKey = Object.fromEntries(c.map((x) => [x.key, x]));
    expect(byKey.section_179).toMatchObject({ limit: 2_560_000, verified: true });
    expect(byKey.bonus_depreciation).toMatchObject({ percent: 100, verified: true });
    expect(byKey.de_minimis_safe_harbor).toMatchObject({ limit: 2_500, verified: true });
    // Before the cliff, the bonus is the 40% phase-down figure.
    const early = us.firstYearConcessions('2025-01-10');
    expect(early.find((x) => x.key === 'bonus_depreciation')).toMatchObject({ percent: 40, verified: true });
  });

  it('extraAssetFields: asset class enum, placed-in-service date, automobile and AFS booleans', () => {
    const fields = us.extraAssetFields();
    expect(fields.map((f) => f.key)).toEqual(['assetClass', 'placedInServiceDate', 'isPassengerAutomobile', 'hasAfs']);
    const cls = fields[0];
    expect(cls.type).toBe('enum');
    expect(cls.options?.map((o) => o.value)).toEqual(US_PROPERTY_CLASSES.map((c) => c.assetClass));
  });

  it("explainer: Fin's voice, the IRS's vocabulary, irs.gov links only", () => {
    const e = us.explainer();
    expect(e.whatItIs).toMatch(/section 179/);
    expect(e.whatItIs).toMatch(/de minimis/);
    expect(e.whenItApplies).toMatch(/recovery period/);
    expect(e.howItWorks.length).toBeGreaterThanOrEqual(3);
    expect(e.howItWorks.length).toBeLessThanOrEqual(4);
    const all = [e.whatItIs, e.whenItApplies, ...e.howItWorks].join(' ');
    expect(all).not.toMatch(/\b(we|us|our)\b/i);
    expect(all).not.toMatch(/\bAI\b/);
    expect(e.vocabulary).toEqual({
      asset: 'Depreciable property',
      decline: 'Depreciation deduction',
      writtenDown: 'Adjusted basis',
      rate: 'Table percentage',
      rateBasis: 'Recovery period',
    });
    expect(e.readMore.length).toBeGreaterThan(0);
    for (const r of e.readMore) {
      expect(r.url).toMatch(/^https:\/\/www\.irs\.gov\//);
      expect(r.authority).toBe('IRS');
    }
  });

  it('the explainer is a fresh copy each time', () => {
    const a = us.explainer();
    a.howItWorks.push('mutated');
    a.readMore.pop();
    expect(us.explainer().howItWorks).not.toContain('mutated');
    expect(us.explainer().readMore.length).toBe(4);
  });
});
