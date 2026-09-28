/**
 * The home-space comparison under the UK and US rules — ai2fin.com
 */
import { gbBusinessRoomComparison, usHomeOfficeComparison, validateGbBusinessRoom, type GbBusinessRoomInput, type UsHomeOfficeInput } from '../src/decisions/homeSpaceCountries';
import { recommendHomeSpace } from '../src/decisions/homeSpaceComparison';
import { daysInclusive } from '../src/decisions/dates';
import { DecisionInputError } from '../src/decisions/inputGuards';
import { GB_CGT_BASIC_RATE_ROWS, resolveHomeRate, US_SIMPLIFIED_METHOD_ROWS } from '../src/decisions/homeRuleRates';
import { homeRulesFor } from '../src/decisions/homeRules';

const gb: GbBusinessRoomInput = {
  exclusiveUse: true,
  areaSharePct: 10,
  valueSharePct: 12,
  fixedCostsPerYear: 12_000,
  marginalRatePct: 40,
  cgtBand: 'higher',
  ownedFrom: '2020-04-06',
  businessUseStart: '2025-04-06',
  saleDate: '2027-04-05',
  expectedGrowth: 100_000,
};

describe('GB — a room used only for the business', () => {
  it('fixed costs by floor area, the gain by VALUE share × days, 24% after the £3,000 exempt amount', () => {
    const r = gbBusinessRoomComparison(gb);
    expect(r.use.total).toBe(2);
    expect(r.deductionAmounts.total).toBeCloseTo(12_000 * 0.1 * 2, 2);
    expect(r.deductions.total).toBeCloseTo(960, 2);
    const gain = (100_000 * 0.12 * 730) / daysInclusive('2020-04-06', '2027-04-05');
    expect(r.cgt.businessPartGain).toBeCloseTo(gain, 2);
    expect(r.cgt.annualExemptUsed).toBe(3000);
    expect(r.cgt.ratePct).toBe(24);
    expect(r.cgt.counted).toBeCloseTo((gain - 3000) * 0.24, 2);
    expect(r.rates.every((x) => !x.estimate)).toBe(true);
    const v = recommendHomeSpace(r);
    expect(v.verdict).toBe('placeOfBusiness');
    expect(v.tones).toEqual({ placeOfBusiness: 'better', desk: 'worse' });
  });

  it('the exempt amount can be used elsewhere, and a bigger value share tips it to the desk', () => {
    const r = gbBusinessRoomComparison({ ...gb, valueSharePct: 40, annualExemptAvailable: false });
    expect(r.cgt.annualExemptUsed).toBe(0);
    expect(recommendHomeSpace(r).verdict).toBe('desk');
  });

  it('not exclusive: running costs only, relief untouched — nothing to weigh', () => {
    const r = gbBusinessRoomComparison({ ...gb, exclusiveUse: false });
    expect(r.deductions.total).toBe(0);
    expect(r.cgt.counted).toBe(0);
    expect(recommendHomeSpace(r).verdict).toBe('even');
    expect(r.notes[0].text).toMatch(/Private Residence Relief is unaffected/);
  });

  it('the final 9 months do not cover the business part (s224(1)), and the split by value is for an accountant', () => {
    const r = gbBusinessRoomComparison(gb);
    expect(r.notes.map((n) => n.text).join(' ')).toMatch(/final 9 months do not cover it/);
    expect(r.notes.find((n) => /split by value/.test(n.text))!.forAccountant).toBe(true);
  });

  it('a sale in an unpublished year uses the latest rates, labelled an estimate', () => {
    const r = gbBusinessRoomComparison({ ...gb, saleDate: '2027-06-30' });
    expect(r.rates.every((x) => x.estimate)).toBe(true);
    expect(r.notes.map((n) => n.text).join(' ')).toMatch(/estimate/);
  });

  it('the unpublished-year note names the GB tax year (6 April to 5 April), not the calendar year', () => {
    // 2028-02-01 falls in the 2027-28 GB tax year, not calendar year 2028.
    const r = gbBusinessRoomComparison({ ...gb, saleDate: '2028-02-01' });
    const note = r.notes.find((n) => /CGT figures are not published yet/.test(n.text))!.text;
    expect(note).toMatch(/2027-28 CGT figures/);
    expect(note).not.toMatch(/2028 CGT figures/);
  });

  it('refuses a sale before 6 April 2025 (no rates recorded) and a bad band', () => {
    const p = validateGbBusinessRoom({ ...gb, saleDate: '2025-01-01', cgtBand: 'top' as never });
    expect(p.map((x) => x.field)).toEqual(expect.arrayContaining(['cgtBand', 'saleDate']));
    expect(p.map((x) => x.message).join()).toMatch(/before 6 April 2025 are not recorded/);
    expect(() => gbBusinessRoomComparison({ ...gb, saleDate: '2025-01-01' })).toThrow(DecisionInputError);
  });
});

const us: UsHomeOfficeInput = {
  role: 'self_employed',
  regularAndExclusive: true,
  officeSqFt: 200,
  homeSqFt: 2000,
  businessUseStart: '2025-01-01',
  saleDate: '2027-12-31',
  otherIndirectCostsPerYear: 6000,
  mortgageInterestAndTaxesPerYear: 12_000,
  itemizes: false,
  buildingBasis: 300_000,
  marginalRatePct: 24,
};

describe('US — simplified or regular method', () => {
  it('not itemizing: the regular method wins even after the depreciation is taxed at sale', () => {
    const r = usHomeOfficeComparison(us);
    expect(r.eligible).toBe(true);
    expect(r.use.total).toBe(3);
    expect(r.simplified).toMatchObject({ deductions: 3000, depreciation: 0, saleTax: 0, taxValue: 720 });
    const dep = (300_000 * 0.1 * 3) / 39;
    expect(r.regular.depreciation).toBeCloseTo(dep, 2);
    expect(r.regular.deductions).toBeCloseTo(18_000 * 0.1 * 3 + dep, 2);
    expect(r.regular.saleTax).toBeCloseTo(dep * 0.24, 2);
    expect(r.better).toBe('regular');
    expect(r.amount).toBe(Math.round(r.regular.net - r.simplified.net));
  });

  it('itemizing: interest and taxes are deductible either way, so the simplified method wins here', () => {
    const r = usHomeOfficeComparison({ ...us, itemizes: true });
    expect(r.better).toBe('simplified');
  });

  it('the depreciation portion is taxed at no more than 25%', () => {
    const r = usHomeOfficeComparison({ ...us, marginalRatePct: 35 });
    expect(r.regular.saleTax).toBeCloseTo(r.regular.depreciation * 0.25, 2);
  });

  it('simplified is capped at 300 sq ft', () => {
    const r = usHomeOfficeComparison({ ...us, officeSqFt: 500, businessUseStart: '2026-01-01', saleDate: '2026-12-31' });
    expect(r.simplified.deductions).toBe(1500);
  });

  it('2027 has no checked figure yet: the 2026 one is used, labelled an estimate', () => {
    const r = usHomeOfficeComparison(us);
    expect(r.rates.find((x) => x.label.startsWith('Simplified method 2027'))!.estimate).toBe(true);
    expect(r.rates.find((x) => x.label.startsWith('Simplified method 2026'))!.estimate).toBe(false);
  });

  it('a separate structure: its share of the gain is taxed at the rate you give, under both methods', () => {
    const r = usHomeOfficeComparison({ ...us, separateStructure: true, expectedGrowth: 90_000, longTermCapitalGainsRatePct: 15 });
    expect(r.separateStructureTax).toBeCloseTo(90_000 * 0.1 * 0.15, 2);
    expect(r.notes.find((n) => /separate structure/.test(n.text))!.forAccountant).toBe(true);
  });

  it('a separate structure with businessUseEnd before saleDate: expectedGrowth is not discounted a second time by the days ratio', () => {
    // expectedGrowth is already "growth over the use" (businessUseStart to businessUseEnd) per the input's own
    // contract, so no further usedDays/ownedDays factor should apply — it would understate the tax otherwise.
    const r = usHomeOfficeComparison({
      ...us,
      businessUseEnd: '2026-06-30', // well before saleDate (2027-12-31)
      separateStructure: true,
      expectedGrowth: 90_000,
      longTermCapitalGainsRatePct: 15,
    });
    expect(r.separateStructureTax).toBeCloseTo(90_000 * 0.1 * 0.15, 2);
  });

  it('employees and non-exclusive use get nothing', () => {
    expect(usHomeOfficeComparison({ ...us, role: 'employee' })).toMatchObject({ eligible: false, ineligibleReason: 'employee', better: null });
    expect(usHomeOfficeComparison({ ...us, regularAndExclusive: false })).toMatchObject({ eligible: false, ineligibleReason: 'not_regular_and_exclusive' });
  });
});

describe('resolveHomeRate — an unpublished year is an estimate, never a gap or an invented number', () => {
  it('verified year: the figure, not an estimate', () => {
    expect(resolveHomeRate(GB_CGT_BASIC_RATE_ROWS, '2026-05-01')).toMatchObject({ value: 18, estimate: false, fromRow: '2025-04-06' });
  });
  it('unpublished year: the latest verified figure, labelled an estimate', () => {
    expect(resolveHomeRate(GB_CGT_BASIC_RATE_ROWS, '2027-05-01')).toMatchObject({ value: 18, estimate: true, fromRow: '2025-04-06' });
    expect(resolveHomeRate(US_SIMPLIFIED_METHOD_ROWS, '2027-02-01')).toMatchObject({ value: 5, estimate: true });
  });
  it('before anything was recorded: null', () => {
    expect(resolveHomeRate(GB_CGT_BASIC_RATE_ROWS, '2020-05-01')).toBeNull();
  });
});

describe('the rule cards still cover CA, NZ and IN, and other countries stay unsupported', () => {
  it.each(['CA', 'NZ', 'IN'])('%s has a card', (c) => {
    expect(homeRulesFor(c).supported).toBe(true);
  });
  it('an unmodelled country is unsupported', () => {
    expect(homeRulesFor('FR').supported).toBe(false);
  });
  it('the US depreciation rate note is now verified', () => {
    const r = homeRulesFor('US');
    if (!r.supported) throw new Error('US');
    expect(r.notes.find((n) => n.id === 'us-recapture-rate')).toMatchObject({ status: 'verified', forAccountant: false });
  });
});
