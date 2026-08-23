/**
 * Canada capital cost allowance tests — @ai2/tax-plugins
 * ai2fin.com
 *
 * Canada is the CLASS regime: the class is the unit, not the asset. The
 * figures are canada.ca's own (read 2026-08-24): class rates from "Classes of
 * depreciable property"; the half-year rule and the accelerated investment
 * incentive (1.5× net additions before 2024, half-year rule merely suspended
 * for 2024-2027) from "Accelerated investment incentive", whose worked
 * Examples 3, 5 and 6 are replayed here to the dollar; the class 10.1 caps
 * by year; the zero-emission vehicle 100% → 75% → 55% phase-out; recapture,
 * terminal loss, "lesser of proceeds and cost", the class 10.1 half-year rule
 * on sale and the optional claim from Guide T4002 Chapter 4 and "Basic
 * information about CCA".
 */

import {
  getDepreciationRules,
  getPluginForCountry,
  computeClassPeriod,
  CA_DEPRECIATION_RULES,
  CA_CCA_CLASSES,
  CA_PASSENGER_VEHICLE_CAP_ROWS,
  caClassFor,
  caFirstYear,
  caPassengerVehicleCap,
  caZeroEmissionVehicleCap,
  type ClassCcaRules,
} from '../src';

const ca = CA_DEPRECIATION_RULES;

describe('CA capital cost allowance — wiring and regime', () => {
  it('the CA plugin hands back the class rules', () => {
    const rules = getDepreciationRules(getPluginForCountry('CA')) as ClassCcaRules;
    expect(rules).toBe(ca);
    expect(rules.countryCode).toBe('CA');
    expect(rules.regime).toBe('class_cca');
    expect(rules.defaultMethod).toBe('pool');
    expect(rules.methods).not.toContain('diminishing_value');
  });

  it('refuses a per-asset method — the class is the unit', () => {
    expect(() =>
      ca.declineInValue({ method: 'diminishing_value', cost: 1000, openingAdjustableValue: 1000, daysHeld: 365, daysInYear: 365 }),
    ).toThrow(/CLASS/);
    expect(() => ca.declineInValue({ method: 'pool', cost: 1000, openingAdjustableValue: 1000 })).toThrow(/annualRate/);
    const out = ca.declineInValue({ method: 'pool', cost: 0, openingAdjustableValue: 58_800, annualRate: 0.04 });
    expect(out.declineInValue).toBe(2352);
    expect(out.closingAdjustableValue).toBe(56_448);
  });

  it('the CCA claim is prorated by days over 365 in a short fiscal period', () => {
    expect(ca.dayFractionDenominator(366)).toBe(365);
  });
});

describe('CA class resolution — the classes page', () => {
  it('every shipped class carries the page rate and is verified', () => {
    const rates = Object.fromEntries(CA_CCA_CLASSES.map((c) => [c.cls, c.rate]));
    expect(rates).toEqual({ '1': 0.04, '8': 0.2, '10': 0.3, '10.1': 0.3, '12': 1, '14.1': 0.05, '50': 0.55, '54': 0.3, '55': 0.4 });
    for (const c of CA_CCA_CLASSES) expect(c.verified).toBe(true);
  });

  it('routes by kind: building 1, furniture 8, vehicle 10, software 12, goodwill 14.1, computer 50', () => {
    expect(caClassFor({ cost: 500_000, kind: 'building' }).cls).toBe('1');
    expect(caClassFor({ cost: 2_000, kind: 'furniture' }).cls).toBe('8');
    expect(caClassFor({ cost: 1_500, kind: 'photocopier' }).cls).toBe('8');
    expect(caClassFor({ cost: 45_000, kind: 'motor_vehicle' }).cls).toBe('10');
    expect(caClassFor({ cost: 800, kind: 'software' }).cls).toBe('12');
    expect(caClassFor({ cost: 50_000, kind: 'goodwill' }).cls).toBe('14.1');
    const pc = caClassFor({ cost: 3_000, kind: 'computer', acquiredDate: '2026-02-01' });
    expect(pc.cls).toBe('50');
    expect(pc.rate).toBe(0.55);
    expect(pc.verified).toBe(true);
    expect(pc.source).toMatch(/^https:\/\/www\.canada\.ca\//);
  });

  it('tools split at $500: under is class 12 at 100%, $500 and over is class 8 at 20%', () => {
    expect(caClassFor({ cost: 499.99, kind: 'tool' }).cls).toBe('12');
    expect(caClassFor({ cost: 500, kind: 'tool' }).cls).toBe('8');
  });

  it('computers acquired on or before 18 March 2007 are class 10, after it class 50', () => {
    expect(caClassFor({ cost: 2_000, kind: 'computer', acquiredDate: '2007-03-18' }).cls).toBe('10');
    expect(caClassFor({ cost: 2_000, kind: 'computer', acquiredDate: '2007-03-19' }).cls).toBe('50');
  });

  it('a recorded class wins over kind; an unknown class is unverified with no rate', () => {
    expect(caClassFor({ cost: 2_000, kind: 'computer', ccaClass: '8' }).cls).toBe('8');
    const unknown = caClassFor({ cost: 2_000, ccaClass: '43' });
    expect(unknown.cls).toBe('43');
    expect(unknown.rate).toBeNull();
    expect(unknown.verified).toBe(false);
  });

  it('an asset with no kind falls to class 8 unverified — the page says what goes there, not what this is', () => {
    const r = caClassFor({ cost: 1_000 });
    expect(r.cls).toBe('8');
    expect(r.verified).toBe(false);
  });
});

describe('CA class 10 vs 10.1 — the passenger vehicle cap by year', () => {
  it('the page caps: $30,000 before 2022, then 34/36/37/38 thousand', () => {
    expect(CA_PASSENGER_VEHICLE_CAP_ROWS.map((r) => r.cap)).toEqual([30_000, 34_000, 36_000, 37_000, 38_000]);
    expect(caPassengerVehicleCap(2021)).toMatchObject({ cap: 30_000, verified: true });
    expect(caPassengerVehicleCap(2024)).toMatchObject({ cap: 37_000, verified: true });
    expect(caPassengerVehicleCap(2025)).toMatchObject({ cap: 38_000, verified: true });
  });

  it("Vivienne's two 2025 vehicles: $39,000 is class 10.1, $28,000 is class 10", () => {
    const v1 = caClassFor({ cost: 39_000, kind: 'passenger_vehicle', acquiredDate: '2025-06-21' });
    const v2 = caClassFor({ cost: 28_000, kind: 'passenger_vehicle', acquiredDate: '2025-06-21' });
    expect(v1.cls).toBe('10.1');
    expect(v1.verified).toBe(true);
    expect(v1.note).toMatch(/recapture and terminal loss rules do not apply/);
    expect(v2.cls).toBe('10');
    expect(v2.verified).toBe(true);
  });

  it('a year the page has no cap for is unverified: a cheap car is still class 10, a dear one is 10.1 unverified', () => {
    const cap = caPassengerVehicleCap(2026);
    expect(cap.cap).toBeNull();
    expect(cap.verified).toBe(false);
    expect(cap.note).toMatch(/\$38,000/);
    expect(caClassFor({ cost: 25_000, kind: 'passenger_vehicle', acquiredDate: '2026-03-01' })).toMatchObject({ cls: '10', verified: true });
    expect(caClassFor({ cost: 60_000, kind: 'passenger_vehicle', acquiredDate: '2026-03-01' })).toMatchObject({ cls: '10.1', verified: false });
  });

  it('a passenger vehicle with no acquisition date cannot be resolved', () => {
    expect(caClassFor({ cost: 40_000, kind: 'passenger_vehicle' }).verified).toBe(false);
  });

  it('zero-emission passenger vehicle caps: $55,000, $59,000 in 2022, $61,000 from 2023', () => {
    expect(caZeroEmissionVehicleCap(2020)).toMatchObject({ cap: 55_000, verified: true });
    expect(caZeroEmissionVehicleCap(2022)).toMatchObject({ cap: 59_000, verified: true });
    expect(caZeroEmissionVehicleCap(2026)).toMatchObject({ cap: 61_000, verified: true });
    expect(caZeroEmissionVehicleCap(2018).cap).toBeNull();
  });

  it('a zero-emission vehicle goes to class 54 (55 for a taxi); one bought before 19 March 2019 is class 10', () => {
    expect(caClassFor({ cost: 50_000, kind: 'passenger_vehicle', isZeroEmissionVehicle: true, acquiredDate: '2026-01-10' }).cls).toBe('54');
    expect(caClassFor({ cost: 50_000, kind: 'taxi_or_rental_vehicle', isZeroEmissionVehicle: true, acquiredDate: '2026-01-10' }).cls).toBe('55');
    expect(caClassFor({ cost: 50_000, kind: 'passenger_vehicle', isZeroEmissionVehicle: true, acquiredDate: '2019-03-18' }).cls).toBe('10');
  });
});

describe('CA first year — half-year rule, AII and the ZEV uplift', () => {
  it('a computer bought in 2026 is class 50 at 55% with NO half-year rule (AII phase-out: rule suspended, nothing added)', () => {
    const asset = { cost: 3_000, kind: 'computer' as const, acquiredDate: '2026-02-01' };
    const fy = caFirstYear(asset, '2026-02-01');
    expect(fy.halfYear).toBe(false);
    expect(fy.aiiMultiplier).toBe(1);
    expect(fy.baseMultiplier).toBe(1);
    expect(fy.verified).toBe(true);
    expect(fy.note).toMatch(/phase-out/);
    // The proposed 100% for class 50 is mentioned, never applied.
    expect(fy.note).toMatch(/proposed/);
    const year = computeClassPeriod({ openingUcc: 0, rate: 0.55, additions: [{ cost: 3_000, baseMultiplier: fy.baseMultiplier }] });
    expect(year.baseAmount).toBe(3_000);
    expect(year.ccaClaimed).toBe(1_650);
    expect(year.closingUcc).toBe(1_350);
  });

  it('the same computer bought in 2015 gets the half-year rule', () => {
    const fy = caFirstYear({ cost: 3_000, kind: 'computer', acquiredDate: '2015-02-01' }, '2015-02-01');
    expect(fy.halfYear).toBe(true);
    expect(fy.aiiMultiplier).toBeNull();
    expect(fy.baseMultiplier).toBe(0.5);
    const year = computeClassPeriod({ openingUcc: 0, rate: 0.55, additions: [{ cost: 3_000 }] });
    expect(year.firstYearAdjustment).toBe(-1_500);
    expect(year.baseAmount).toBe(1_500);
    expect(year.ccaClaimed).toBe(825);
    expect(year.closingUcc).toBe(2_175);
  });

  it('AII before 2024: one-and-a-half times the net addition — the page\'s Example 3 to the dollar', () => {
    const fy = caFirstYear({ cost: 300, kind: 'motor_vehicle', acquiredDate: '2021-05-01' }, '2021-05-01');
    expect(fy).toMatchObject({ halfYear: false, aiiMultiplier: 1.5, baseMultiplier: 1.5, verified: true });
    const y1 = computeClassPeriod({ openingUcc: 0, rate: 0.3, additions: [{ cost: 300, baseMultiplier: 1.5 }] });
    expect(y1.firstYearAdjustment).toBe(150);
    expect(y1.baseAmount).toBe(450);
    expect(y1.ccaClaimed).toBe(135);
    expect(y1.closingUcc).toBe(165);
    // The page prints whole dollars ($50, $115); the engine keeps the cents: 30% of 165 is 49.50.
    const y2 = computeClassPeriod({ openingUcc: y1.closingUcc, rate: 0.3 });
    expect(y2.ccaClaimed).toBe(49.5);
    expect(y2.closingUcc).toBe(115.5);
  });

  it('AII Example 6 (2024): the half-year rule is suspended but nothing is added', () => {
    const y1 = computeClassPeriod({ openingUcc: 0, rate: 0.3, additions: [{ cost: 300, baseMultiplier: 1 }] });
    expect(y1.baseAmount).toBe(300);
    expect(y1.ccaClaimed).toBe(90);
    expect(y1.closingUcc).toBe(210);
    const y2 = computeClassPeriod({ openingUcc: 210, rate: 0.3 });
    expect(y2.ccaClaimed).toBe(63);
    expect(y2.closingUcc).toBe(147);
  });

  it('AII Example 5: a disposition comes off the non-eligible addition before the eligible one', () => {
    const y = computeClassPeriod({
      openingUcc: 100,
      rate: 0.3,
      additions: [
        { cost: 100, baseMultiplier: 1.5 },
        { cost: 100, baseMultiplier: 0.5 },
      ],
      disposals: [{ proceeds: 150 }],
    });
    expect(y.uccAfterAdditionsAndDispositions).toBe(150);
    expect(y.firstYearAdjustment).toBe(25);
    expect(y.baseAmount).toBe(175);
    // The page prints $53 and $97; 30% of 175 is exactly 52.50.
    expect(y.ccaClaimed).toBe(52.5);
    expect(y.closingUcc).toBe(97.5);
  });

  it('AII boundaries: acquired on 20 Nov 2018 is out, 21 Nov in; available for use in 2028 is out; non-arm\'s-length is out', () => {
    expect(caFirstYear({ cost: 1_000, kind: 'furniture', acquiredDate: '2018-11-20' }, '2018-11-20').halfYear).toBe(true);
    expect(caFirstYear({ cost: 1_000, kind: 'furniture', acquiredDate: '2018-11-21' }, '2018-11-21').aiiMultiplier).toBe(1.5);
    expect(caFirstYear({ cost: 1_000, kind: 'furniture', acquiredDate: '2027-12-01' }, '2028-01-15').halfYear).toBe(true);
    expect(caFirstYear({ cost: 1_000, kind: 'furniture', acquiredDate: '2026-01-01', nonArmsLength: true }, '2026-01-01').halfYear).toBe(true);
  });

  it('class 12 small tools have no half-year rule; class 12 software does unless the AII suspends it', () => {
    const tool = caFirstYear({ cost: 300, kind: 'tool', acquiredDate: '2015-01-01' }, '2015-01-01');
    expect(tool).toMatchObject({ halfYear: false, baseMultiplier: 1, enhancedPercent: 100 });
    expect(caFirstYear({ cost: 300, kind: 'software', acquiredDate: '2015-01-01' }, '2015-01-01').halfYear).toBe(true);
    expect(caFirstYear({ cost: 300, kind: 'software', acquiredDate: '2026-01-01' }, '2026-01-01').halfYear).toBe(false);
  });

  it('a class 54 zero-emission vehicle available for use in 2026 gets the enacted 55% — 30% of 11/6 times cost', () => {
    const asset = { cost: 50_000, kind: 'passenger_vehicle' as const, isZeroEmissionVehicle: true, acquiredDate: '2026-03-01' };
    const fy = caFirstYear(asset, '2026-03-01');
    expect(fy.halfYear).toBe(false);
    expect(fy.aiiMultiplier).toBeNull();
    expect(fy.enhancedPercent).toBe(55);
    expect(fy.baseMultiplier).toBeCloseTo(11 / 6, 12);
    expect(fy.verified).toBe(true);
    expect(fy.note).toMatch(/proposed changes/);
    const y = computeClassPeriod({ openingUcc: 0, rate: 0.3, additions: [{ cost: 50_000, baseMultiplier: fy.baseMultiplier }] });
    expect(y.ccaClaimed).toBeCloseTo(27_500, 2);
    expect(y.closingUcc).toBeCloseTo(22_500, 2);
  });

  it('ZEV phase-out by year of use: 100% before 2024, 75% in 2024-2025, half-year from 2028', () => {
    const zev = (d: string) => caFirstYear({ cost: 40_000, kind: 'passenger_vehicle', isZeroEmissionVehicle: true, acquiredDate: d }, d);
    expect(zev('2022-06-01').enhancedPercent).toBe(100);
    expect(zev('2022-06-01').baseMultiplier).toBeCloseTo(10 / 3, 12);
    expect(zev('2025-06-01').enhancedPercent).toBe(75);
    expect(zev('2028-06-01').halfYear).toBe(true);
    // Class 55 at 40%: 1 + 3/8 so that 40% of it is 55%.
    const taxi = caFirstYear({ cost: 40_000, kind: 'taxi_or_rental_vehicle', isZeroEmissionVehicle: true, acquiredDate: '2026-06-01' }, '2026-06-01');
    expect(taxi.baseMultiplier * 0.4).toBeCloseTo(0.55, 12);
  });
});

describe('CA class replay — recapture, terminal loss, class 10.1, optional claim, short year', () => {
  it('two years with a disposal producing a recapture', () => {
    // Class 8 furniture $10,000 bought 2022 under the AII: base 15,000, CCA 3,000, UCC 7,000.
    const fy = caFirstYear({ cost: 10_000, kind: 'furniture', acquiredDate: '2022-04-01' }, '2022-04-01');
    const y1 = computeClassPeriod({ openingUcc: 0, rate: 0.2, additions: [{ cost: 10_000, baseMultiplier: fy.baseMultiplier }] });
    expect(y1.ccaClaimed).toBe(3_000);
    expect(y1.closingUcc).toBe(7_000);
    // Sold in 2023 for $9,000 (cost $10,000): column 7 is −2,000 — a recapture, no CCA, class closes at zero.
    const y2 = computeClassPeriod({ openingUcc: y1.closingUcc, rate: 0.2, disposals: [{ proceeds: 9_000, capitalCost: 10_000 }], classEmptied: true });
    expect(y2.disposals).toBe(9_000);
    expect(y2.uccAfterAdditionsAndDispositions).toBe(-2_000);
    expect(y2.recapture).toBe(2_000);
    expect(y2.terminalLoss).toBe(0);
    expect(y2.ccaClaimed).toBe(0);
    expect(y2.closingUcc).toBe(0);
  });

  it('proceeds above cost come out at cost — the lesser of the two', () => {
    const y = computeClassPeriod({ openingUcc: 7_000, rate: 0.2, disposals: [{ proceeds: 12_000, capitalCost: 10_000 }], classEmptied: true });
    expect(y.disposals).toBe(10_000);
    expect(y.recapture).toBe(3_000);
  });

  it('a terminal loss when the class empties with a balance left', () => {
    const y = computeClassPeriod({ openingUcc: 7_000, rate: 0.2, disposals: [{ proceeds: 4_000, capitalCost: 10_000 }], classEmptied: true });
    expect(y.uccAfterAdditionsAndDispositions).toBe(3_000);
    expect(y.terminalLoss).toBe(3_000);
    expect(y.recapture).toBe(0);
    expect(y.ccaClaimed).toBe(0);
    expect(y.closingUcc).toBe(0);
  });

  it('the same disposal with property still in the class is an ordinary CCA year', () => {
    const y = computeClassPeriod({ openingUcc: 7_000, rate: 0.2, disposals: [{ proceeds: 4_000, capitalCost: 10_000 }] });
    expect(y.terminalLoss).toBe(0);
    expect(y.baseAmount).toBe(3_000);
    expect(y.ccaClaimed).toBe(600);
    expect(y.closingUcc).toBe(2_400);
  });

  it('class 10.1: no recapture, no terminal loss, and the half-year rule on sale', () => {
    // Sold for more than the UCC: no recapture, the class just closes.
    const gain = computeClassPeriod({
      openingUcc: 20_000, rate: 0.3, disposals: [{ proceeds: 30_000, capitalCost: 42_940 }],
      classEmptied: true, noRecaptureOrTerminalLoss: true, halfYearOnSale: true,
    });
    expect(gain.recapture).toBe(0);
    expect(gain.closingUcc).toBe(0);
    // Sold for less: no terminal loss; 50% of the CCA that would have been allowed (base = half the opening UCC).
    const loss = computeClassPeriod({
      openingUcc: 20_000, rate: 0.3, disposals: [{ proceeds: 5_000, capitalCost: 42_940 }],
      classEmptied: true, noRecaptureOrTerminalLoss: true, halfYearOnSale: true,
    });
    expect(loss.terminalLoss).toBe(0);
    expect(loss.baseAmount).toBe(10_000);
    expect(loss.ccaClaimed).toBe(3_000);
    expect(loss.closingUcc).toBe(0);
  });

  it('CCA is optional: a claim limit below the maximum is honoured and the rest stays in the class', () => {
    const y = computeClassPeriod({ openingUcc: 58_800, rate: 0.04, claimLimit: 1_000 });
    expect(y.maxCca).toBe(2_352);
    expect(y.ccaClaimed).toBe(1_000);
    expect(y.closingUcc).toBe(57_800);
    expect(computeClassPeriod({ openingUcc: 58_800, rate: 0.04, claimLimit: 0 }).ccaClaimed).toBe(0);
  });

  it("a short first fiscal period prorates by days over 365 — John's $3,500 over 214 days is $2,052", () => {
    const y = computeClassPeriod({ openingUcc: 3_500 / 0.2, rate: 0.2, shortYearFraction: 214 / 365 });
    expect(Math.round(y.ccaClaimed)).toBe(2_052);
  });

  it('CCA never takes the class below zero', () => {
    const y = computeClassPeriod({ openingUcc: 0, rate: 1, additions: [{ cost: 400, baseMultiplier: 1.5 }] });
    expect(y.baseAmount).toBe(600);
    expect(y.ccaClaimed).toBe(400);
    expect(y.closingUcc).toBe(0);
  });

  it('rejects a rate or fraction outside range', () => {
    expect(() => computeClassPeriod({ openingUcc: 100, rate: 20 })).toThrow(/rate/);
    expect(() => computeClassPeriod({ openingUcc: 100, rate: 0.2, shortYearFraction: 0 })).toThrow(/shortYearFraction/);
  });
});

describe('CA concessions, fields and the explainer', () => {
  it('firstYearConcessions: AII verified; proposed ZEV reinstatement and class 50 100% are verified:false', () => {
    const c = ca.firstYearConcessions('2026-02-01');
    const byKey = Object.fromEntries(c.map((x) => [x.key, x]));
    expect(byKey.accelerated_investment_incentive.verified).toBe(true);
    expect(byKey.accelerated_investment_incentive.note).toMatch(/Phase-out/);
    expect(byKey.zero_emission_vehicle).toMatchObject({ percent: 55, verified: true });
    expect(byKey.zero_emission_vehicle_reinstated_proposed).toMatchObject({ percent: null, verified: false });
    expect(byKey.zero_emission_vehicle_reinstated_proposed.note).toMatch(/proposed/i);
    expect(byKey.class_50_full_expensing_proposed).toMatchObject({ percent: null, verified: false });
    expect(byKey.class_12_small_tools).toMatchObject({ limit: 500, verified: true });
    // Before the AII existed, none of the incentives are offered.
    const old = ca.firstYearConcessions('2015-06-01').map((x) => x.key);
    expect(old).toEqual(['class_12_small_tools']);
  });

  it('has no general instant write-off, and says so unverified rather than inventing one', () => {
    const w = ca.instantAssetWriteOff(new Date(2026, 0, 1));
    expect(w.limit).toBeNull();
    expect(w.verified).toBe(false);
  });

  it('extraAssetFields: ccaClass enum of the shipped classes, isZeroEmissionVehicle, availableForUseDate', () => {
    const fields = ca.extraAssetFields();
    expect(fields.map((f) => f.key)).toEqual(['ccaClass', 'isZeroEmissionVehicle', 'availableForUseDate']);
    const cls = fields[0];
    expect(cls.type).toBe('enum');
    expect(cls.required).toBe(false);
    expect(cls.options?.map((o) => o.value)).toEqual(CA_CCA_CLASSES.map((c) => c.cls));
  });

  it("explainer: Fin's voice, the CRA's vocabulary, canada.ca links only", () => {
    const e = ca.explainer();
    expect(e.whatItIs).toBe('The CRA groups assets into numbered classes, each with its own rate. You claim on the class balance, not on each item.');
    expect(e.whenItApplies).toMatch(/half-year rule/);
    expect(e.whenItApplies).toMatch(/\$38,000/);
    expect(e.whenItApplies).toMatch(/optional/);
    expect(e.howItWorks.length).toBeGreaterThanOrEqual(3);
    expect(e.howItWorks.length).toBeLessThanOrEqual(4);
    const all = [e.whatItIs, e.whenItApplies, ...e.howItWorks].join(' ');
    expect(all).not.toMatch(/\b(we|us|our)\b/i);
    expect(all).not.toMatch(/\bAI\b/);
    expect(e.vocabulary).toEqual({
      asset: 'Depreciable property',
      decline: 'Capital cost allowance',
      writtenDown: 'Undepreciated capital cost',
      rate: 'Rate',
      rateBasis: 'Class',
    });
    expect(e.readMore.length).toBeGreaterThan(0);
    for (const r of e.readMore) {
      expect(r.url).toMatch(/^https:\/\/www\.canada\.ca\//);
      expect(r.authority).toBe('CRA');
    }
  });

  it('the explainer is a fresh copy each time', () => {
    const a = ca.explainer();
    a.howItWorks.push('mutated');
    a.readMore.pop();
    expect(ca.explainer().howItWorks).not.toContain('mutated');
    expect(ca.explainer().readMore.length).toBe(5);
  });
});
