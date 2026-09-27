/**
 * Home and property decisions — @ai2/tax-plugins
 * ai2fin.com
 *
 * Where a case reproduces an ATO worked example, the example is named and its
 * figures are asserted as the ATO prints them (Fatima, Thomas, Roya, Jeneen
 * and John). If one fails, the module disagrees with the ATO — re-read the page
 * before touching the test. The other figures are the product brief's own
 * worked case (35% share, $9,600 occupancy, 4 years, 32%).
 */

import * as pkg from '../src';
import {
  AU_CGT_REGIME_2027_FROM,
  AU_HOME_PROPERTY_RULES,
  daysBeyondSixYears,
  homeBusinessSpaceTradeoff,
  mainResidenceChoice,
  roomOrPartnerArrangement,
  type HomeBusinessSpaceInput,
  type HomeBusinessSpaceResult,
  type LodgerArrangementResult,
  type MainResidenceChoiceResult,
} from '../src';
import { addMonths, daysInclusive, heldAtLeast12Months, nextIncomeYearLabel, parseYmd } from '../src/decisions/dates';

// Four income years of claims, 2023-24 to 2026-27, and a sale on the last day of them —
// before 1 July 2027, so the discount rules are the law for this sale.
const base: HomeBusinessSpaceInput = {
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
const space = (over: Partial<HomeBusinessSpaceInput> = {}) => homeBusinessSpaceTradeoff({ ...base, ...over }) as HomeBusinessSpaceResult;

// ─── Dates ──────────────────────────────────────────────────────────────────

describe('decision dates', () => {
  it('counts days inclusively, as the ATO does', () => {
    expect(daysInclusive('2018-11-01', '2022-08-01')).toBe(1370); // Fatima
    expect(daysInclusive('2018-11-01', '2026-05-01')).toBe(2739); // Fatima
    expect(daysInclusive('1999-09-29', '2024-09-29')).toBe(9133); // Roya
    expect(daysInclusive('2002-01-01', '2025-10-01')).toBe(8675); // Jeneen and John
  });

  it('the 12-month test excludes the day of acquisition and the day of the CGT event', () => {
    expect(heldAtLeast12Months('2026-07-01', '2027-07-01')).toBe(false);
    expect(heldAtLeast12Months('2026-07-01', '2027-07-02')).toBe(true);
  });

  it('clamps month arithmetic to the month end and rejects impossible days', () => {
    expect(addMonths('2025-08-31', 6)).toBe('2026-02-28');
    expect(() => parseYmd('2026-02-30')).toThrow(RangeError);
    expect(nextIncomeYearLabel('2099-00')).toBe('2100-01');
  });
});

// ─── 1. Desk or place of business ───────────────────────────────────────────

describe('homeBusinessSpaceTradeoff — the brief\'s worked case', () => {
  it('extra deductions: $9,600 × 35% × 4 = $13,440, worth $4,300.80 (≈ $4,301) at 32%', () => {
    const r = space();
    expect(r.extraDeductions).toEqual({ perYear: 3360, total: 13_440, taxValue: 4300.8 });
    expect(Math.round(r.extraDeductions.taxValue)).toBe(4301);
    expect(r.incomeYears).toEqual(['2023-24', '2024-25', '2025-26', '2026-27']);
    expect(r.cgt.currentLaw.appliesToThisSale).toBe(true);
  });

  it.each([
    [50_000, 2800],
    [100_000, 5600],
    [250_000, 14_000],
  ])('CGT on $%i growth is $%i under the discount rules', (growth, tax) => {
    const r = space({ expectedGrowth: growth });
    expect(r.cgt.currentLaw.discountApplies).toBe(true);
    expect(r.cgt.currentLaw.tax).toBe(tax);
    expect(r.options.placeOfBusiness.cgtCurrentLaw).toBe(tax);
  });

  it('breaks even at $76,800 of growth — above it, the desk wins', () => {
    const r = space();
    expect(r.breakEvenGrowth.currentLaw).toBe(76_800);
    expect(space({ expectedGrowth: 76_800 }).net.currentLaw).toBeCloseTo(0, 2);
    expect(space({ expectedGrowth: 70_000 }).net.currentLaw).toBeGreaterThan(0);
    expect(space({ expectedGrowth: 90_000 }).net.currentLaw).toBeLessThan(0);
  });

  it('running costs are claimable in both options; only occupancy differs', () => {
    const r = space();
    expect(r.options.deskOrSharedRoom.deductionsPerYear).toBe(1200);
    expect(r.options.placeOfBusiness.deductionsPerYear).toBe(1200 + 3360);
    expect(r.options.deskOrSharedRoom.cgtCurrentLaw).toBe(0);
    expect(r.options.placeOfBusiness.taxValue - r.options.deskOrSharedRoom.taxValue).toBeCloseTo(r.extraDeductions.taxValue, 2);
  });

  it('cites a source and read date for every note', () => {
    const r = space();
    for (const n of r.notes) {
      expect(n.sourceUrl).toMatch(/^https:\/\/www\.(ato|legislation)\.gov\.au\//);
      expect(n.readOn).toBe('2026-09-27');
    }
    expect(r.rules.map((x) => x.key)).toEqual(expect.arrayContaining(['occupancyOnlyPlaceOfBusiness', 'partialExemptionFollowsInterest', 'cgtDiscount']));
  });
});

describe('homeBusinessSpaceTradeoff — owners and dates', () => {
  it('a co-owner who does not run the business claims nothing and keeps the full exemption', () => {
    const r = space({ ownerRunsBusiness: false });
    expect(r.extraDeductions.total).toBe(0);
    expect(r.cgt.currentLaw.tax).toBe(0);
    expect(r.breakEvenGrowth.currentLaw).toBeNull();
    expect(r.notes.map((n) => n.rule)).toContain('coOwnerNotInBusiness');
  });

  it('a 50% owner running the business pays CGT on half the business share — break-even doubles', () => {
    const r = space({ ownershipPct: 50 });
    expect(r.cgt.currentLaw.tax).toBe(1400);
    expect(r.breakEvenGrowth.currentLaw).toBe(153_600);
  });

  it('no discount when sold within 12 months of first business use', () => {
    const inside = space({ businessUseStart: '2026-07-01', saleDate: '2027-06-30' });
    expect(inside.cgt.currentLaw.discountApplies).toBe(false);
    expect(inside.cgt.currentLaw.tax).toBe(5600); // 50,000 × 35% × 32%, undiscounted
    expect(inside.notes.map((n) => n.rule)).toContain('noDiscountWithin12MonthsOfFirstUse');
  });

  it('reproduces the ATO\'s Fatima example (business use stopped before the sale)', () => {
    // 40% from 1 Nov 2018 to 1 Aug 2022, sold 1 May 2026; $520,000 → $620,000.
    const r = space({
      businessSharePct: 40,
      businessUseStart: '2018-11-01',
      businessUseEnd: '2022-08-01',
      saleDate: '2026-05-01',
      expectedGrowth: 100_000,
    });
    expect(Math.floor(r.cgt.currentLaw.businessShareGain)).toBe(20_007);
    expect(Math.floor(r.cgt.currentLaw.taxableGain)).toBe(10_003);
  });

  it('rejects inputs it would otherwise have to guess at', () => {
    expect(() => space({ businessSharePct: 120 })).toThrow(RangeError);
    expect(() => space({ years: 0 })).toThrow(RangeError);
    expect(() => space({ saleDate: '2023-06-30' })).toThrow(RangeError);
    expect(() => space({ businessUseEnd: '2030-01-01' })).toThrow(RangeError);
    expect(() => space({ incomeYear: '2025-27' })).toThrow(RangeError);
  });
});

describe('homeBusinessSpaceTradeoff — CGT from 1 July 2027 is law, and only the pre-2027 part is computed', () => {
  it('a sale before 1 July 2027: the whole gain is current law, and nothing is post-2027', () => {
    const r = space();
    expect(r.cgt.currentLaw.appliesToThisSale).toBe(true);
    expect(r.cgt.preJuly2027).toEqual({ gain: 17_500, discountApplies: true, taxableGain: 8750, tax: 2800, basis: 'whole gain — sale before 1 July 2027' });
    expect(r.cgt.postJuly2027).toMatchObject({ applies: false });
    expect(r.net.complete).toBe(true);
    expect(r.notes.map((n) => n.rule)).not.toContain('cgtFrom1July2027');
  });

  it('a sale on 1 July 2027: post-2027 is { computable: false } with the reason, never a guess', () => {
    const r = space({ saleDate: AU_CGT_REGIME_2027_FROM });
    expect(r.cgt.currentLaw.appliesToThisSale).toBe(false);
    expect(r.cgt.postJuly2027).toMatchObject({ applies: true, computable: false });
    const post = r.cgt.postJuly2027;
    if (post.applies) {
      expect(post.note).toMatch(/Tax Reform No\. 1\) Act 2026/);
      expect(post.note).toMatch(/indexed for inflation/);
      expect(post.note).toMatch(/30% minimum tax/);
      expect(post.note).toMatch(/not yet published/);
      expect(post.note).not.toMatch(/announced/i);
    }
    expect(r.net.complete).toBe(false);
    expect(r.notes.map((n) => n.rule)).toEqual(expect.arrayContaining(['cgtFrom1July2027', 'minimumTax30']));
  });

  it('pre-2027 portion by even growth: two years of four accrued by 30 June 2027 — half the gain, discounted', () => {
    // First use 1 July 2025, sale 30 June 2029: 730 of 1,461 days fall on or before 30 June 2027.
    const r = space({ businessUseStart: '2025-07-01', saleDate: '2029-06-30', expectedGrowth: 100_000 });
    const pre = r.cgt.preJuly2027;
    expect(pre.basis).toBe('even growth by day to 30 June 2027');
    expect(pre.gain).toBeCloseTo((100_000 * 0.35 * 730) / 1461, 2);
    expect(pre.discountApplies).toBe(true);
    expect(pre.tax).toBeCloseTo(pre.gain * 0.5 * 0.32, 2);
    // The whole-gain figure is still returned, as a comparison, and says it is not the law for this sale.
    expect(r.cgt.currentLaw.tax).toBe(5600);
    expect(r.cgt.currentLaw.appliesToThisSale).toBe(false);
  });

  it('pre-2027 portion from valuations, when both are supplied', () => {
    const r = space({ businessUseStart: '2025-07-01', saleDate: '2029-06-30', homeValueAtFirstUse: 800_000, valueAt30June2027: 850_000 });
    expect(r.cgt.preJuly2027).toMatchObject({ basis: 'valuations supplied', gain: 17_500, taxableGain: 8750, tax: 2800 });
    expect(() => space({ saleDate: '2029-06-30', homeValueAtFirstUse: 800_000 })).toThrow(/both or neither/);
  });

  it('business use that starts after 30 June 2027 has no pre-2027 portion', () => {
    const r = space({ businessUseStart: '2027-07-01', saleDate: '2031-07-01' });
    expect(r.cgt.preJuly2027.gain).toBe(0);
    expect(r.cgt.postJuly2027).toMatchObject({ applies: true, computable: false });
  });
});

// ─── 2. Which home is the main residence ────────────────────────────────────

const mrc = (i: Parameters<typeof mainResidenceChoice>[0]) => mainResidenceChoice(i) as MainResidenceChoiceResult;

describe('mainResidenceChoice', () => {
  it('reproduces the ATO\'s Jeneen and John example: 6 months both exempt, 90 of 8,675 days at stake', () => {
    const r = mrc({
      homes: [
        { name: 'Old', ownedFrom: '2002-01-01', movedOut: '2025-01-01', expectedGrowth: 867_500 },
        { name: 'New', ownedFrom: '2025-01-01', expectedGrowth: 100_000 },
      ],
      saleDates: { Old: '2025-10-01', New: '2035-01-01' },
      marginalRatePct: 32,
    });
    expect(r.overlap.days).toBe(274);
    expect(r.movingHouseDays).toBe(184); // 1 April 2025 to 1 October 2025
    const nominateNew = r.options.find((o) => o.nominated === 'New')!;
    const old = nominateNew.homes.find((h) => h.name === 'Old')!;
    expect(old.taxableDays).toBe(90);
    expect(old.ownedDays).toBe(8675);
    expect(old.taxableGain).toBe(9000); // 867,500 × 90 ÷ 8,675
    const nominateOld = r.options.find((o) => o.nominated === 'Old')!;
    expect(nominateOld.homes.find((h) => h.name === 'New')!.taxableDays).toBe(90);
    expect(r.better.nominated).toBe('Old');
  });

  it('a rented former home: the 6-year rule caps its exemption, and the moving-house rule does not apply', () => {
    // James (ATO): moved out and rented 10 Oct 2015, bought the new home 3 Oct 2020, sold 1 Mar 2026.
    const input = {
      homes: [
        { name: 'Brisbane', ownedFrom: '2013-09-15', movedOut: '2015-10-10', rentedFrom: '2015-10-10', expectedGrowth: 300_000 },
        { name: 'Perth', ownedFrom: '2020-10-03', expectedGrowth: 50_000 },
      ],
      saleDates: { Brisbane: '2026-03-01', Perth: '2040-01-01' },
      marginalRatePct: 37,
    };
    const r = mrc(input);
    expect(r.movingHouseDays).toBe(0);
    const keep = r.options.find((o) => o.nominated === 'Brisbane')!;
    // The 6 years run to 10 Oct 2021; taxable from 11 Oct 2021.
    expect(keep.homes.find((h) => h.name === 'Brisbane')!.taxableDays).toBe(daysInclusive('2021-10-11', '2026-03-01'));
    expect(keep.homes.find((h) => h.name === 'Perth')!.taxableDays).toBe(r.overlap.days);
    const take = r.options.find((o) => o.nominated === 'Perth')!;
    expect(take.homes.find((h) => h.name === 'Brisbane')!.taxableDays).toBe(daysInclusive('2020-10-03', '2026-03-01'));
    expect(take.homes.find((h) => h.name === 'Perth')!.taxableDays).toBe(0);
    // Picks the cheaper and says by how much.
    const cheaper = Math.min(keep.totalTax, take.totalTax);
    expect(r.options.find((o) => o.nominated === r.better.nominated)!.totalTax).toBe(cheaper);
    expect(r.better.saving).toBeCloseTo(Math.abs(keep.totalTax - take.totalTax), 2);
    expect(r.notes.map((n) => n.rule)).toEqual(expect.arrayContaining(['sixYearRule', 'oneMainResidence', 'spouseDifferentHomes', 'movingHouseSixMonths']));
  });

  it('before 1 July 2027 the comparison is complete; after it, pre-2027 figures only and better.complete is false', () => {
    const homes = [
      { name: 'Old', ownedFrom: '2002-01-01', movedOut: '2025-01-01', expectedGrowth: 867_500 },
      { name: 'New', ownedFrom: '2025-01-01', expectedGrowth: 100_000 },
    ];
    const early = mrc({ homes, saleDates: { Old: '2025-10-01', New: '2026-06-30' }, marginalRatePct: 32 });
    expect(early.better.complete).toBe(true);
    const late = mrc({ homes, saleDates: { Old: '2025-10-01', New: '2035-01-01' }, marginalRatePct: 32 });
    expect(late.better.complete).toBe(false);
    const nw = late.options.find((o) => o.nominated === 'Old')!.homes.find((h) => h.name === 'New')!;
    // New's 90 taxable days all fall before 30 June 2027, so the whole taxable gain is pre-2027.
    expect(nw.preJuly2027.gain).toBe(nw.taxableGain);
    expect(nw.postJuly2027).toMatchObject({ applies: true, computable: false });
    const old = late.options.find((o) => o.nominated === 'Old')!.homes.find((h) => h.name === 'Old')!;
    expect(old.postJuly2027).toMatchObject({ applies: false });
  });

  it('counts the 6-year limit the ATO\'s way (Roya: 6,940 taxable days)', () => {
    expect(daysBeyondSixYears('1999-09-29', '2024-09-29')).toBe(6940);
    expect(daysBeyondSixYears('2020-01-01', '2026-01-01')).toBe(0);
    expect(daysBeyondSixYears('2020-01-01', '2026-01-02')).toBe(1);
  });

  it('a former home left vacant stays fully exempt however long the absence', () => {
    const r = mrc({
      homes: [
        { name: 'A', ownedFrom: '2005-01-01', movedOut: '2010-01-01', expectedGrowth: 400_000 },
        { name: 'B', ownedFrom: '2010-01-01', expectedGrowth: 10_000 },
      ],
      saleDates: { A: '2026-01-01', B: '2030-01-01' },
      marginalRatePct: 45,
    });
    expect(r.options.find((o) => o.nominated === 'A')!.homes.find((h) => h.name === 'A')!.taxableDays).toBe(0);
  });

  it('rejects a timeline it cannot interpret', () => {
    const h = { name: 'X', ownedFrom: '2020-01-01', expectedGrowth: 1 };
    expect(() => mainResidenceChoice({ homes: [h], saleDates: { X: '2021-01-01' }, marginalRatePct: 30 })).toThrow(/exactly two/);
    expect(() => mainResidenceChoice({ homes: [h, { ...h, name: 'Y' }], saleDates: { X: '2021-01-01', Y: '2021-01-01' }, marginalRatePct: 30 })).toThrow(/movedOut/);
  });
});

// ─── 3. Someone living with you ─────────────────────────────────────────────

describe('roomOrPartnerArrangement', () => {
  it('domestic: no income, no deductions, exemption unaffected', () => {
    const r = roomOrPartnerArrangement({ kind: 'domestic' });
    expect(r).toMatchObject({ supported: true, kind: 'domestic', assessableIncomePerYear: 0, deductionsPerYear: 0, mainResidenceExemption: 'unaffected' });
    if (r.supported) expect(r.notes.map((n) => n.rule)).toEqual(['domesticArrangement', 'noIncomeFromOccupierNoCgt']);
  });

  it('lodger at market rent: reproduces the ATO\'s Thomas example (35% share, $400,000 gain → $70,000)', () => {
    const r = roomOrPartnerArrangement({
      kind: 'lodger',
      weeklyRent: 250,
      exclusivePct: 20,
      sharedPct: 30,
      sharedBy: 2,
      homeCostsPerYear: 20_000,
      marginalRatePct: 32,
      firstLetDate: '2003-07-01',
      saleDate: '2026-06-30',
      expectedGrowth: 400_000,
    }) as LodgerArrangementResult;
    expect(r.letSharePct).toBe(35);
    expect(r.cgt.taxableGain).toBe(140_000);
    expect(r.cgt.discountApplies).toBe(true);
    expect(r.cgt.netGain).toBe(70_000);
    expect(r.cgt.tax).toBe(22_400);
    // Income tax: $13,000 rent less 35% of $20,000.
    expect(r.perYear).toEqual({ rent: 13_000, deductions: 7000, net: 6000, tax: 1920 });
    expect(r.mainResidenceExemption).toBe('partial');
  });

  it('apportions the gain by days when letting stopped before the sale', () => {
    const r = roomOrPartnerArrangement({
      kind: 'lodger',
      weeklyRent: 200,
      letSharePct: 40,
      homeCostsPerYear: 10_000,
      marginalRatePct: 32,
      firstLetDate: '2018-11-01',
      letEndDate: '2022-08-01',
      saleDate: '2026-05-01',
      expectedGrowth: 100_000,
    }) as LodgerArrangementResult;
    expect(Math.floor(r.cgt.taxableGain)).toBe(20_007);
  });

  it('a sale after 1 July 2027: the let-share gain to 30 June 2027 under current rules, the rest not computed', () => {
    const r = roomOrPartnerArrangement({
      kind: 'lodger',
      weeklyRent: 300,
      letSharePct: 25,
      homeCostsPerYear: 12_000,
      marginalRatePct: 32,
      firstLetDate: '2025-07-01',
      saleDate: '2029-06-30',
      expectedGrowth: 146_100,
    }) as LodgerArrangementResult;
    expect(r.cgt.appliesToThisSale).toBe(false);
    expect(r.cgt.preJuly2027.gain).toBeCloseTo((146_100 * 0.25 * 730) / 1461, 2);
    expect(r.cgt.postJuly2027).toMatchObject({ applies: true, computable: false });
  });

  it('flags a rental loss against the new-builds negative gearing limit', () => {
    const r = roomOrPartnerArrangement({
      kind: 'lodger',
      weeklyRent: 50,
      letSharePct: 30,
      homeCostsPerYear: 40_000,
      marginalRatePct: 32,
      firstLetDate: '2026-01-01',
      saleDate: '2030-01-01',
      expectedGrowth: 0,
    }) as LodgerArrangementResult;
    expect(r.perYear.net).toBeLessThan(0);
    expect(r.notes.map((n) => n.rule)).toContain('negativeGearingNewBuilds');
  });

  it('needs a let share', () => {
    expect(() =>
      roomOrPartnerArrangement({ kind: 'lodger', weeklyRent: 1, homeCostsPerYear: 1, marginalRatePct: 30, firstLetDate: '2026-01-01', saleDate: '2027-01-01', expectedGrowth: 0 }),
    ).toThrow(/letSharePct/);
  });
});

// ─── Other countries ────────────────────────────────────────────────────────

describe('other countries get the authority, never a number', () => {
  it.each(['NZ', 'nz', 'US'])('%s is unsupported, with the authority link', (country) => {
    const r = homeBusinessSpaceTradeoff({ ...base, country });
    expect(r.supported).toBe(false);
    if (r.supported) return;
    expect(r.country).toBe(country.toUpperCase());
    expect(r.authority?.url).toMatch(/^https:\/\//);
    expect(JSON.stringify(r)).not.toMatch(/"(tax|taxValue|deductionsTotal)"/);
  });

  it('every function answers the same way, and an unknown country has no authority rather than a guess', () => {
    const m = mainResidenceChoice({ country: 'GB', homes: [], saleDates: {}, marginalRatePct: 20 });
    const l = roomOrPartnerArrangement({ country: 'CA', kind: 'domestic' });
    expect(m.supported).toBe(false);
    expect(l.supported).toBe(false);
    const zz = homeBusinessSpaceTradeoff({ ...base, country: 'ZZ' });
    expect(zz).toMatchObject({ supported: false, authority: null });
  });
});

// ─── Package surface ────────────────────────────────────────────────────────

describe('the package index', () => {
  it('exports the three decisions and the rule rows', () => {
    expect(pkg.homeBusinessSpaceTradeoff).toBe(homeBusinessSpaceTradeoff);
    expect(pkg.mainResidenceChoice).toBe(mainResidenceChoice);
    expect(pkg.roomOrPartnerArrangement).toBe(roomOrPartnerArrangement);
    expect(Object.keys(pkg.AU_HOME_PROPERTY_RULES).length).toBeGreaterThan(15);
  });

  it('every rule row is verified, dated and linked', () => {
    for (const [key, r] of Object.entries(AU_HOME_PROPERTY_RULES)) {
      expect({ key, verified: r.verified }).toEqual({ key, verified: true });
      expect(r.sourceUrl).toMatch(/^https:\/\/www\.(ato|legislation)\.gov\.au\//);
      expect(r.readOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
