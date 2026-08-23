/**
 * India block-of-assets depreciation tests — @ai2/tax-plugins
 * ai2fin.com
 *
 * India is the BLOCK regime under the law that took effect on 1 April 2026:
 * section 33 of the Income-tax Act 2025 and Appendix I (rule 25) of the
 * Income-tax Rules 2026 — the 1961 Act and 1962 Rules are cited nowhere
 * here except as the thing that was replaced. The figures are the Gazette
 * table's own (read 2026-08-24): block rates verbatim; the 180-day half-rate
 * rule of s. 33(4); the 20% (or 10% + 10%) additional depreciation of
 * s. 33(8)-(9); and the rule that sale proceeds swallowing the block, or an
 * emptied block, is a short-term capital gain or loss the module flags and
 * never computes.
 */

import {
  getDepreciationRules,
  getPluginForCountry,
  computeBlockPeriod,
  IN_DEPRECIATION_RULES,
  IN_BLOCKS,
  inBlockFor,
  inHalfRate,
  inAdditionalDepreciation,
  type BlockWdvRules,
} from '../src';

const ind = IN_DEPRECIATION_RULES;

describe('IN block depreciation — wiring and regime', () => {
  it('the India plugin hands back the block rules', () => {
    const rules = getDepreciationRules(getPluginForCountry('IN')) as BlockWdvRules;
    expect(rules).toBe(ind);
    expect(rules.countryCode).toBe('IN');
    expect(rules.regime).toBe('block_wdv');
    expect(rules.defaultMethod).toBe('pool');
    expect(rules.methods).not.toContain('diminishing_value');
  });

  it('refuses a per-asset method — the block is the unit', () => {
    expect(() =>
      ind.declineInValue({ method: 'diminishing_value', cost: 1000, openingAdjustableValue: 1000, daysHeld: 365, daysInYear: 365 }),
    ).toThrow(/BLOCK/);
    expect(() => ind.declineInValue({ method: 'pool', cost: 1000, openingAdjustableValue: 1000 })).toThrow(/annualRate/);
    const out = ind.declineInValue({ method: 'pool', cost: 0, openingAdjustableValue: 100_000, annualRate: 0.4 });
    expect(out.declineInValue).toBe(40_000);
    expect(out.closingAdjustableValue).toBe(60_000);
  });

  it('has no general instant write-off, and says so unverified rather than inventing one', () => {
    const w = ind.instantAssetWriteOff(new Date(2026, 4, 1));
    expect(w.limit).toBeNull();
    expect(w.verified).toBe(false);
  });
});

describe('IN blocks — Appendix I of the Income-tax Rules 2026', () => {
  it('every shipped block carries the Gazette rate and is verified', () => {
    const rates = Object.fromEntries(IN_BLOCKS.map((b) => [b.block, b.rate]));
    expect(rates).toEqual({
      building_residential: 0.05,
      building_other: 0.1,
      building_temporary: 0.4,
      furniture_fittings: 0.1,
      plant_machinery_general: 0.15,
      motor_car: 0.15,
      motor_vehicle_hire: 0.3,
      aeroplane: 0.4,
      computers_software: 0.4,
      books_profession: 0.4,
      ships: 0.2,
      intangibles: 0.25,
    });
    for (const b of IN_BLOCKS) expect(b.verified).toBe(true);
  });

  it('every source cites the 2026 Rules, never the 1962 ones', () => {
    for (const b of IN_BLOCKS) {
      expect(b.source).toMatch(/^Income-tax Rules 2026, Appendix I \(rule 25\)/);
      expect(b.source).not.toMatch(/1961|1962/);
    }
  });

  it('routes by kind: furniture 10%, machinery 15%, car 15%, hire taxi 30%, computer and software 40%, intangible 25%', () => {
    expect(inBlockFor({ cost: 50_000, kind: 'furniture' })).toMatchObject({ block: 'furniture_fittings', rate: 0.1, verified: true });
    expect(inBlockFor({ cost: 200_000, kind: 'machinery' }).rate).toBe(0.15);
    expect(inBlockFor({ cost: 800_000, kind: 'motor_car' }).rate).toBe(0.15);
    expect(inBlockFor({ cost: 900_000, kind: 'bus_lorry_taxi_hire' }).rate).toBe(0.3);
    expect(inBlockFor({ cost: 100_000, kind: 'computer' }).block).toBe('computers_software');
    expect(inBlockFor({ cost: 20_000, kind: 'software' }).rate).toBe(0.4);
    expect(inBlockFor({ cost: 500_000, kind: 'intangible' }).rate).toBe(0.25);
    expect(inBlockFor({ cost: 5_000_000, kind: 'building_residential' }).rate).toBe(0.05);
  });

  it('an office appliance is general machinery at 15%, with the additional-depreciation exclusion noted', () => {
    const r = inBlockFor({ cost: 30_000, kind: 'office_appliance' });
    expect(r).toMatchObject({ block: 'plant_machinery_general', rate: 0.15, verified: true });
    expect(r.note).toMatch(/never qualify for additional depreciation/);
  });

  it('a recorded block wins over kind; an unknown block is unverified with no rate', () => {
    expect(inBlockFor({ cost: 1_000, kind: 'computer', blockKey: 'furniture_fittings' }).rate).toBe(0.1);
    const unknown = inBlockFor({ cost: 1_000, blockKey: 'windmills' });
    expect(unknown.rate).toBeNull();
    expect(unknown.verified).toBe(false);
  });

  it('an asset with no kind falls to general machinery and plant, unverified', () => {
    const r = inBlockFor({ cost: 1_000 });
    expect(r.block).toBe('plant_machinery_general');
    expect(r.verified).toBe(false);
  });
});

describe('IN 180-day rule — s. 33(4)', () => {
  it('under 180 days halves the rate; 180 or more keeps it whole', () => {
    expect(inHalfRate(100)).toMatchObject({ half: true, factor: 0.5, verified: true });
    expect(inHalfRate(179).half).toBe(true);
    expect(inHalfRate(180)).toMatchObject({ half: false, factor: 1 });
    expect(inHalfRate(365).half).toBe(false);
    expect(() => inHalfRate(-1)).toThrow(/putToUseDays/);
    expect(() => inHalfRate(400)).toThrow(/putToUseDays/);
  });

  it('the note cites the Income-tax Act 2025, not its predecessor', () => {
    expect(inHalfRate(100).note).toMatch(/section 33\(4\)/);
    expect(inHalfRate(100).note).toMatch(/Income-tax Act 2025/);
  });
});

describe('IN block replay — computeBlockPeriod', () => {
  it('a ₹1,00,000 computer used 200 days claims ₹40,000 — the full 40% rate', () => {
    const y = computeBlockPeriod({ openingWdv: 0, rate: 0.4, additions: [{ cost: 100_000, putToUseDays: 200 }] });
    expect(y.additionsFullRate).toBe(100_000);
    expect(y.additionsHalfRate).toBe(0);
    expect(y.depreciation).toBe(40_000);
    expect(y.closingWdv).toBe(60_000);
    expect(y.shortTermCapitalGainReview).toBe(false);
  });

  it('the same computer used 100 days claims ₹20,000 — half the rate in year one', () => {
    const y = computeBlockPeriod({ openingWdv: 0, rate: 0.4, additions: [{ cost: 100_000, putToUseDays: 100 }] });
    expect(y.additionsHalfRate).toBe(100_000);
    expect(y.depreciationHalfRate).toBe(20_000);
    expect(y.depreciation).toBe(20_000);
    expect(y.closingWdv).toBe(80_000);
  });

  it('an addition with no days recorded gets the full rate, and the split adds up', () => {
    const y = computeBlockPeriod({
      openingWdv: 50_000,
      rate: 0.15,
      additions: [{ cost: 30_000 }, { cost: 20_000, putToUseDays: 90 }],
    });
    // Full rate on 50,000 + 30,000; half rate on 20,000.
    expect(y.depreciationFullRate).toBe(12_000);
    expect(y.depreciationHalfRate).toBe(1_500);
    expect(y.depreciation).toBe(13_500);
    expect(y.closingWdv).toBe(86_500);
  });

  it('sale proceeds come off the block before the rate applies', () => {
    const y = computeBlockPeriod({ openingWdv: 100_000, rate: 0.15, saleProceeds: 30_000 });
    expect(y.wdvBeforeDepreciation).toBe(70_000);
    expect(y.depreciation).toBe(10_500);
    expect(y.closingWdv).toBe(59_500);
  });

  it('proceeds swallowing the block are flagged for short-term capital gain review, never computed', () => {
    const y = computeBlockPeriod({ openingWdv: 40_000, rate: 0.15, additions: [{ cost: 10_000 }], saleProceeds: 65_000 });
    expect(y.wdvBeforeDepreciation).toBe(-15_000);
    expect(y.shortTermCapitalGainReview).toBe(true);
    expect(y.depreciation).toBe(0);
    expect(y.closingWdv).toBe(0);
  });

  it('a block left with no assets is the same flag — the remainder is a capital loss, not depreciation', () => {
    const y = computeBlockPeriod({ openingWdv: 40_000, rate: 0.15, saleProceeds: 25_000, blockEmptied: true });
    expect(y.wdvBeforeDepreciation).toBe(15_000);
    expect(y.shortTermCapitalGainReview).toBe(true);
    expect(y.depreciation).toBe(0);
    expect(y.closingWdv).toBe(0);
  });

  it('proceeds eat the full-rate portion first, so the half-rate restriction keeps biting', () => {
    const y = computeBlockPeriod({
      openingWdv: 0,
      rate: 0.4,
      additions: [{ cost: 50_000, putToUseDays: 300 }, { cost: 100_000, putToUseDays: 60 }],
      saleProceeds: 60_000,
    });
    // Balance 90,000, all of it under-180 additions: half rate throughout.
    expect(y.wdvBeforeDepreciation).toBe(90_000);
    expect(y.depreciationFullRate).toBe(0);
    expect(y.depreciationHalfRate).toBe(18_000);
    expect(y.closingWdv).toBe(72_000);
  });

  it('rejects a rate outside range and nonsense day counts', () => {
    expect(() => computeBlockPeriod({ openingWdv: 100, rate: 40 })).toThrow(/rate/);
    expect(() => computeBlockPeriod({ openingWdv: 100, rate: 0.4, additions: [{ cost: 100, putToUseDays: 500 }] })).toThrow(/putToUseDays/);
  });
});

describe('IN additional depreciation — s. 33(8)-(9)', () => {
  const newPlant = { cost: 500_000, kind: 'machinery' as const, isManufacturer: true, isNewAsset: true };

  it('a manufacturer\'s new machinery earns 20% on top of the normal rate', () => {
    const r = inAdditionalDepreciation(newPlant);
    expect(r).toMatchObject({ eligible: true, percent: 20, splitYearOne: null, verified: true });
    expect(r.note).toMatch(/Income-tax Act 2025/);
  });

  it('under 180 days splits it: 10% this year, 10% next', () => {
    const r = inAdditionalDepreciation({ ...newPlant, putToUseDays: 120 });
    expect(r).toMatchObject({ eligible: true, percent: null, splitYearOne: 10, splitYearTwo: 10 });
  });

  it('office appliances and road transport vehicles never qualify', () => {
    expect(inAdditionalDepreciation({ ...newPlant, isOfficeAppliance: true }).eligible).toBe(false);
    expect(inAdditionalDepreciation({ ...newPlant, isRoadTransportVehicle: true }).eligible).toBe(false);
  });

  it('not a manufacturer, not new, or unanswered — never a yes', () => {
    expect(inAdditionalDepreciation({ cost: 500_000, kind: 'machinery', isManufacturer: false, isNewAsset: true }).eligible).toBe(false);
    expect(inAdditionalDepreciation({ cost: 500_000, kind: 'machinery', isManufacturer: true, isNewAsset: false }).eligible).toBe(false);
    const unanswered = inAdditionalDepreciation({ cost: 500_000, kind: 'machinery' });
    expect(unanswered.eligible).toBe(false);
    expect(unanswered.note).toMatch(/unanswered question is never a yes/);
  });

  it('ships, aircraft, buildings and intangibles are out whatever the answers say', () => {
    expect(inAdditionalDepreciation({ ...newPlant, kind: 'ship' }).eligible).toBe(false);
    expect(inAdditionalDepreciation({ ...newPlant, kind: 'aeroplane' }).eligible).toBe(false);
    expect(inAdditionalDepreciation({ ...newPlant, kind: 'building_other' }).eligible).toBe(false);
    expect(inAdditionalDepreciation({ ...newPlant, kind: 'intangible' }).eligible).toBe(false);
  });
});

describe('IN concessions, fields and the explainer', () => {
  it('firstYearConcessions: the 20% additional depreciation, gated on the manufacturer field', () => {
    const c = ind.firstYearConcessions('2026-06-01');
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ key: 'additional_depreciation_new_plant', percent: 20, verified: true, requiresField: 'isManufacturer' });
    expect(c[0].note).toMatch(/section 33\(8\), Income-tax Act 2025/);
  });

  it('extraAssetFields: block enum, days put to use, and the four additional-depreciation booleans', () => {
    const fields = ind.extraAssetFields();
    expect(fields.map((f) => f.key)).toEqual([
      'blockKey',
      'putToUseDays',
      'isManufacturer',
      'isNewAsset',
      'isOfficeAppliance',
      'isRoadTransportVehicle',
    ]);
    expect(fields[0].type).toBe('enum');
    expect(fields[0].options?.map((o) => o.value)).toEqual(IN_BLOCKS.map((b) => b.block));
    expect(fields[1].type).toBe('number');
  });

  it("explainer: Fin's voice, the Act's vocabulary, incometaxindia.gov.in links only", () => {
    const e = ind.explainer();
    expect(e.whatItIs).toMatch(/blocks/);
    expect(e.whenItApplies).toMatch(/1 April to 31 March/);
    expect(e.whenItApplies).toMatch(/180 days/);
    expect(e.howItWorks.length).toBeGreaterThanOrEqual(3);
    expect(e.howItWorks.length).toBeLessThanOrEqual(4);
    const all = [e.whatItIs, e.whenItApplies, ...e.howItWorks].join(' ');
    expect(all).not.toMatch(/\b(we|us|our)\b/i);
    expect(all).not.toMatch(/\bAI\b/);
    expect(e.vocabulary).toEqual({
      asset: 'Asset in block',
      decline: 'Depreciation',
      writtenDown: 'Written down value of the block',
      rate: 'Rate',
      rateBasis: 'Block of assets',
    });
    expect(e.readMore).toHaveLength(2);
    for (const r of e.readMore) {
      expect(r.url).toMatch(/^https:\/\/www\.incometaxindia\.gov\.in\//);
      expect(r.authority).toBe('Income Tax Department');
    }
  });

  it('the explainer is a fresh copy each time', () => {
    const a = ind.explainer();
    a.howItWorks.push('mutated');
    a.readMore.pop();
    expect(ind.explainer().howItWorks).not.toContain('mutated');
    expect(ind.explainer().readMore.length).toBe(2);
  });
});
