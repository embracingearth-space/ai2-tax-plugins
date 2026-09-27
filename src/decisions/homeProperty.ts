/**
 * Home and property decisions — pure decision maths — ai2fin.com
 *
 * Three questions people ask about their own home, answered with the same
 * numbers wherever they are asked (the app, the marketing site, the Tax MCP):
 *
 *  1. homeBusinessSpaceTradeoff — work from a desk or shared room, or set up a
 *     "place of business"? The second earns occupancy deductions now and costs
 *     part of the main residence exemption later.
 *  2. mainResidenceChoice — owning two homes at once, which one should the
 *     exemption cover for the overlap? Applies the 6-year absence rule.
 *  3. roomOrPartnerArrangement — someone living with you: a domestic
 *     arrangement, or a lodger paying market rent?
 *
 * PURE: no I/O, no clock, no globals — every date is an input, so the same
 * inputs give the same answer on every host. Every rule is a row in
 * ./homePropertyRules with its authority URL and read date, and every note a
 * result carries points at one.
 *
 * AU first. Any other country returns `{ supported: false, authority }` with a
 * link to that country's tax authority and NO numbers — a number computed
 * under the wrong country's rules is worse than none.
 *
 * MONEY: results are in the input currency, rounded to cents. Gains are
 * assumed to accrue EVENLY BY DAY between the dates given; the ATO's own
 * apportionment is by days, so with even growth the "home first used to
 * produce income" market-value reset gives the same answer as apportioning
 * the whole gain by days. Supply real valuations where you have them.
 */

import { getPluginInfo } from '../registry';
import {
  addDays,
  addMonths,
  daysInclusive,
  heldAtLeast12Months,
  incomeYearStart,
  maxYmd,
  minYmd,
  nextIncomeYearLabel,
  overlapDays,
  parseYmd,
} from './dates';
import { AU_HOME_PROPERTY_RULES, note, type DecisionNote, type HomePropertyRule, type HomePropertyRuleKey } from './homePropertyRules';

// ─── Shared ─────────────────────────────────────────────────────────────────

/** Any country other than AU: no numbers, just where to look. */
export interface UnsupportedCountry {
  supported: false;
  country: string;
  /** The country's tax authority from the plugin registry, or null where the package has no official plugin for it. */
  authority: { name: string; fullName: string; url: string } | null;
  note: string;
}

/** 1 July 2027 — the first day CGT events fall under the Tax Reform No. 1 Act regime. */
export const AU_CGT_REGIME_2027_FROM = '2027-07-01';
const MINIMUM_TAX_RATE = 0.3;
const DISCOUNT = 0.5;

const cents = (n: number) => Math.round(n * 100) / 100;
/** 250000 → "$250,000" — grouped by hand so the text does not depend on the host's ICU build. */
const dollars = (n: number) => `$${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const pct = (n: number, field: string, { max = 100 } = {}) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0 || v > max) throw new RangeError(`${field}: expected a percentage from 0 to ${max}, got ${n}`);
  return v / 100;
};
const money = (n: number, field: string, { allowNegative = false } = {}) => {
  const v = Number(n);
  if (!Number.isFinite(v) || (!allowNegative && v < 0)) throw new RangeError(`${field}: expected ${allowNegative ? 'a' : 'a non-negative'} number, got ${n}`);
  return v;
};

function unsupported(country: string): UnsupportedCountry {
  const code = country.toUpperCase();
  const info = getPluginInfo(code);
  const a = info?.plugin.authority;
  return {
    supported: false,
    country: code,
    authority: a ? { name: a.name, fullName: a.fullName, url: a.helpUrl ?? a.portalUrl } : null,
    note:
      `These home and property rules are modelled for Australia only. ${code} has its own rules for home offices, ` +
      'rent and the sale of a home — check them with the tax authority' + (a ? ` (${a.name}).` : '.'),
  };
}

const isAu = (country: string | undefined) => (country ?? 'AU').toUpperCase() === 'AU';

/** The rule rows a result relied on, de-duplicated, for a "where does this come from" list. */
function rulesFor(notes: DecisionNote[]): Array<HomePropertyRule & { key: HomePropertyRuleKey }> {
  const keys = [...new Set(notes.map((n) => n.rule))];
  return keys.map((key) => ({ key, ...AU_HOME_PROPERTY_RULES[key] }));
}

// ─── The 1 July 2027 CGT regime ─────────────────────────────────────────────

export interface Regime2027Assumptions {
  /** Market value of the whole home when business use (or letting) first started — the cost base under the first-use rule. */
  homeValueAtFirstUse?: number;
  /** Assumed annual CPI inflation, in percent, for the indexation factor. */
  assumedInflationPct?: number;
  /** Whole-home market value just before 1 July 2027. Default: even growth by day between first use and sale. */
  valueAt30June2027?: number;
  /**
   * The part of `marginalRatePct` that is Medicare levy. Division 119 compares against income tax only, so a
   * marginal rate that includes the 2% levy would understate the top-up. Default 0.
   */
  medicareLevyPct?: number;
}

export type Regime2027Result =
  | { status: 'enacted'; applies: false; note: string }
  | { status: 'enacted'; applies: true; computable: false; note: string; missing: string[] }
  | {
      status: 'enacted';
      applies: true;
      computable: true;
      /** Gain to 30 June 2027 (your taxable share), before the discount. */
      deferredGain: number;
      deferredDiscountApplies: boolean;
      /** Gain from 1 July 2027 on the indexed cost base (your taxable share). */
      indexedGain: number;
      indexationFactor: number;
      /** Income tax at your marginal rate on both parts. */
      taxAtMarginal: number;
      /** Division 119 extra tax so the indexed gain bears at least 30%. */
      minimumTaxTopUp: number;
      tax: number;
      assumptions: string[];
    };

interface RegimeInputs {
  firstUse: string;
  saleDate: string;
  /** Your taxable fraction of the whole-home gain (share × ownership × days factor). */
  taxableFraction: number;
  expectedGrowth: number;
  marginal: number;
  a: Regime2027Assumptions;
}

/**
 * The enacted regime for a CGT event on or after 1 July 2027, for the taxable
 * slice of a home. Computable only with a first-use value and an inflation
 * assumption: indexation multiplies a cost base, so growth alone is not
 * enough, and the statutory factor uses CPI figures that do not exist yet.
 */
function regime2027({ firstUse, saleDate, taxableFraction, expectedGrowth, marginal, a }: RegimeInputs): Regime2027Result {
  if (saleDate < AU_CGT_REGIME_2027_FROM) {
    return {
      status: 'enacted',
      applies: false,
      note: 'The sale is before 1 July 2027, so the 50% discount rules apply in full and this regime does not.',
    };
  }
  const missing: string[] = [];
  if (a.homeValueAtFirstUse === undefined) missing.push('homeValueAtFirstUse');
  if (a.assumedInflationPct === undefined) missing.push('assumedInflationPct');
  if (missing.length) {
    return {
      status: 'enacted',
      applies: true,
      computable: false,
      missing,
      note:
        'The sale falls under the rules enacted by the Treasury Laws Amendment (Tax Reform No. 1) Act 2026: the gain to ' +
        '30 June 2027 keeps the 50% discount, and the gain after it is worked out on a cost base indexed for inflation, with ' +
        'a 30% minimum tax on it. Indexation multiplies the cost base, so it needs the home\'s value when first used to ' +
        'produce income and an inflation assumption: pass ' + missing.join(' and ') + '.',
    };
  }
  const v0 = money(a.homeValueAtFirstUse as number, 'homeValueAtFirstUse');
  const inflation = pct(a.assumedInflationPct as number, 'assumedInflationPct', { max: 50 });
  const medicare = pct(a.medicareLevyPct ?? 0, 'medicareLevyPct', { max: 10 });
  const vSale = v0 + expectedGrowth;
  const assumptions: string[] = [
    `Cost base: the home's value when first used to produce income, ${dollars(v0)}.`,
    `Indexation: ${(inflation * 100).toFixed(2)}% a year compounded by day. The Act uses published CPI figures (Subdivision 960-M), which do not exist yet for future quarters.`,
    'Your taxable share (floor area × ownership × days used) is applied to the gain before and after 1 July 2027 alike.',
    'Division 119 is applied with your marginal rate as a flat rate on the gain; the Act compares tax with and without the gain across your whole taxable income.',
  ];

  let deferredGain = 0;
  let deferredDiscountApplies = false;
  let reacquired = firstUse;
  let costBase = v0;
  if (firstUse < AU_CGT_REGIME_2027_FROM) {
    // Deemed sale just before, and reacquisition on, 1 July 2027 at market value.
    const v2027 =
      a.valueAt30June2027 !== undefined
        ? money(a.valueAt30June2027, 'valueAt30June2027')
        : v0 + expectedGrowth * (daysInclusive(firstUse, '2027-06-30') / daysInclusive(firstUse, saleDate));
    if (a.valueAt30June2027 === undefined) {
      assumptions.push('Value just before 1 July 2027: even growth by day between first use and sale (the Act uses market value, or a method the Commissioner determines).');
    }
    deferredGain = Math.max(0, (v2027 - v0) * taxableFraction);
    // The 12-month test for the deferred gain is applied as if the deemed event happened on the sale date.
    deferredDiscountApplies = heldAtLeast12Months(firstUse, saleDate);
    reacquired = AU_CGT_REGIME_2027_FROM;
    costBase = v2027;
  }
  const years = (parseYmd(saleDate) - parseYmd(reacquired)) / (365.25 * 86_400_000);
  // Indexation needs the asset held 12 months from the (deemed) acquisition; the statutory factor is rounded to 3 places.
  const indexationFactor = heldAtLeast12Months(reacquired, saleDate) ? Math.round((1 + inflation) ** years * 1000) / 1000 : 1;
  const indexedGain = Math.max(0, (vSale - costBase * indexationFactor) * taxableFraction);

  const deferredTaxable = deferredGain * (deferredDiscountApplies ? DISCOUNT : 1);
  const taxAtMarginal = (deferredTaxable + indexedGain) * marginal;
  // Division 119, with a flat marginal rate: 30% of the gain less the income tax on it, rounded down.
  const incomeTaxRate = Math.max(0, marginal - medicare);
  const minimumTaxTopUp = Math.max(0, Math.floor(indexedGain * MINIMUM_TAX_RATE - indexedGain * incomeTaxRate));
  return {
    status: 'enacted',
    applies: true,
    computable: true,
    deferredGain: cents(deferredGain),
    deferredDiscountApplies,
    indexedGain: cents(indexedGain),
    indexationFactor,
    taxAtMarginal: cents(taxAtMarginal),
    minimumTaxTopUp,
    tax: cents(taxAtMarginal + minimumTaxTopUp),
    assumptions,
  };
}

/** Bisection on a tax curve that rises with growth; null where the curve never reaches the target. */
function solveGrowth(target: number, taxAt: (growth: number) => number | null): number | null {
  if (!(target > 0)) return null;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const t = taxAt(hi);
    if (t === null) return null;
    if (t >= target) break;
    hi *= 2;
    if (hi > 1e12) return null;
  }
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const t = taxAt(mid) as number;
    if (t >= target) hi = mid;
    else lo = mid;
  }
  return Math.round(hi);
}

// ─── 1. Desk or shared room vs place of business ────────────────────────────

export interface HomeBusinessSpaceInput extends Regime2027Assumptions {
  /** ISO country code; anything but AU is unsupported. Default 'AU'. */
  country?: string;
  /** The first income year the claim covers, e.g. '2025-26'. */
  incomeYear: string;
  /** Floor area set aside as a place of business, percent of the home. */
  businessSharePct: number;
  /** Whole-home occupancy costs you pay each year: interest or rent, rates, land tax, insurance. */
  occupancyCostsPerYear: number;
  /** The business portion of running costs each year — claimable either way. */
  runningCostsPerYear: number;
  /** Income years of claims. */
  years: number;
  /** Growth in the whole home's value from `businessUseStart` to `saleDate`. */
  expectedGrowth: number;
  /** Your marginal rate as a percent, e.g. 32 for 30% plus the 2% Medicare levy. */
  marginalRatePct: number;
  /** Your share of the home. Default 100. */
  ownershipPct?: number;
  /** Is the person asking the one who runs the business? Default true. A co-owner who does not keeps the full exemption. */
  ownerRunsBusiness?: boolean;
  /** YYYY-MM-DD business use of the area began. */
  businessUseStart: string;
  /** YYYY-MM-DD business use ended, if before the sale. Default: continues to the sale. */
  businessUseEnd?: string;
  /** YYYY-MM-DD of the sale contract (the CGT event). */
  saleDate: string;
}

export interface SpaceOption {
  deductionsPerYear: number;
  deductionsTotal: number;
  /** Deductions × marginal rate. */
  taxValue: number;
  /** CGT on the business share when the home is sold, under the discount rules. */
  cgtCurrentLaw: number;
  /** taxValue − cgtCurrentLaw. */
  net: number;
}

export interface HomeBusinessSpaceResult {
  supported: true;
  country: 'AU';
  incomeYears: string[];
  options: { deskOrSharedRoom: SpaceOption; placeOfBusiness: SpaceOption };
  /** What a place of business adds: the occupancy share. */
  extraDeductions: { perYear: number; total: number; taxValue: number };
  cgt: {
    currentLaw: {
      /** Your taxable share of the whole-home growth, before the discount. */
      businessShareGain: number;
      discountApplies: boolean;
      taxableGain: number;
      tax: number;
      /** false when the sale is on or after 1 July 2027 — shown for comparison, the 2027 regime applies. */
      appliesToThisSale: boolean;
    };
    from1July2027: Regime2027Result;
  };
  /** Place of business minus desk: extra deduction value less CGT. Positive favours a place of business. */
  net: { currentLaw: number; from1July2027: number | null };
  /** Growth at which the extra deductions exactly pay for the CGT. Above it, the desk wins. */
  breakEvenGrowth: { currentLaw: number | null; from1July2027: number | null };
  notes: DecisionNote[];
  rules: Array<HomePropertyRule & { key: HomePropertyRuleKey }>;
}

/**
 * Desk or shared room vs a place of business, for the person running the
 * business. Running costs are claimable either way; occupancy costs only as a
 * place of business, and they cost the exemption on the same share of the
 * home. A co-owner who does not run the business claims nothing and keeps the
 * full exemption.
 */
export function homeBusinessSpaceTradeoff(input: HomeBusinessSpaceInput): HomeBusinessSpaceResult | UnsupportedCountry {
  if (!isAu(input.country)) return unsupported(input.country as string);

  const share = pct(input.businessSharePct, 'businessSharePct');
  const ownership = pct(input.ownershipPct ?? 100, 'ownershipPct');
  const marginal = pct(input.marginalRatePct, 'marginalRatePct');
  const occupancy = money(input.occupancyCostsPerYear, 'occupancyCostsPerYear');
  const running = money(input.runningCostsPerYear, 'runningCostsPerYear');
  const growth = money(input.expectedGrowth, 'expectedGrowth', { allowNegative: true });
  const years = Number(input.years);
  if (!Number.isInteger(years) || years < 1 || years > 50) throw new RangeError(`years: expected a whole number from 1 to 50, got ${input.years}`);
  parseYmd(input.businessUseStart, 'businessUseStart');
  parseYmd(input.saleDate, 'saleDate');
  if (input.saleDate < input.businessUseStart) throw new RangeError('saleDate: must be on or after businessUseStart');
  const useEnd = input.businessUseEnd ?? input.saleDate;
  parseYmd(useEnd, 'businessUseEnd');
  if (useEnd < input.businessUseStart || useEnd > input.saleDate) throw new RangeError('businessUseEnd: must fall between businessUseStart and saleDate');

  const incomeYears: string[] = [];
  incomeYearStart(input.incomeYear);
  for (let y = input.incomeYear, i = 0; i < years; i++, y = nextIncomeYearLabel(y)) incomeYears.push(y);

  const runsIt = input.ownerRunsBusiness ?? true;
  const notes: DecisionNote[] = [
    note('runningExpensesAnyWorkArea', 'Running costs are claimable from a desk or shared room as well as from a place of business.'),
    note('occupancyOnlyPlaceOfBusiness', 'Occupancy costs are claimable only if the area is a genuine place of business.'),
    note('occupancyByFloorAreaAndTime', `Occupancy is apportioned by floor area: ${cents(share * 100)}% here.`),
  ];

  if (!runsIt) {
    notes.push(note('coOwnerNotInBusiness', 'You do not run the business, so you claim no occupancy costs and keep the full main residence exemption on your share.'));
    const zero: SpaceOption = { deductionsPerYear: 0, deductionsTotal: 0, taxValue: 0, cgtCurrentLaw: 0, net: 0 };
    return {
      supported: true,
      country: 'AU',
      incomeYears,
      options: { deskOrSharedRoom: zero, placeOfBusiness: { ...zero } },
      extraDeductions: { perYear: 0, total: 0, taxValue: 0 },
      cgt: {
        currentLaw: { businessShareGain: 0, discountApplies: false, taxableGain: 0, tax: 0, appliesToThisSale: input.saleDate < AU_CGT_REGIME_2027_FROM },
        from1July2027: { status: 'enacted', applies: false, note: 'Your share stays fully exempt, so there is no gain to tax under either regime.' },
      },
      net: { currentLaw: 0, from1July2027: 0 },
      breakEvenGrowth: { currentLaw: null, from1July2027: null },
      notes,
      rules: rulesFor(notes),
    };
  }

  // Deductions. Occupancy costs are those you pay; the business share of them is deductible.
  const extraPerYear = occupancy * share;
  const extraTotal = extraPerYear * years;
  const extraTaxValue = extraTotal * marginal;
  const desk = { deductionsPerYear: running, deductionsTotal: running * years };

  // CGT under the discount rules. The gain runs from first business use (the first-use rule
  // resets the cost base to market value then); if use stopped before the sale, the days factor applies.
  const daysFactor = useEnd === input.saleDate ? 1 : daysInclusive(input.businessUseStart, useEnd) / daysInclusive(input.businessUseStart, input.saleDate);
  const taxableFraction = ownership * share * daysFactor;
  const businessShareGain = Math.max(0, growth) * taxableFraction;
  const discountApplies = heldAtLeast12Months(input.businessUseStart, input.saleDate);
  const discountFactor = discountApplies ? DISCOUNT : 1;
  const taxableGain = businessShareGain * discountFactor;
  const cgtTax = taxableGain * marginal;

  const regime = (g: number) =>
    regime2027({ firstUse: input.businessUseStart, saleDate: input.saleDate, taxableFraction, expectedGrowth: g, marginal, a: input });
  const from1July2027 = regime(growth);
  const regimeTax = from1July2027.applies && from1July2027.computable ? from1July2027.tax : null;

  notes.push(
    note('partialExemptionFollowsInterest', 'As a place of business, the same share of the home loses the main residence exemption.'),
    note('homeFirstUsedToProduceIncome', 'The taxable gain is measured from the home\'s value when business use started.'),
  );
  if (daysFactor !== 1) notes.push(note('floorAreaAndDaysApportionment', 'Business use stopped before the sale, so the gain is apportioned by days used.'));
  if (ownership < 1) notes.push(note('coOwnerNotInBusiness', 'A co-owner who does not run the business keeps the full exemption on their share.'));
  notes.push(
    discountApplies
      ? note('cgtDiscount', 'Held at least 12 months from first business use, so the 50% discount applies under the current rules.')
      : note('noDiscountWithin12MonthsOfFirstUse', 'Sold within 12 months of first business use, so no CGT discount.'),
  );
  notes.push(note('personalServicesIncome', 'If your income is personal services income, some occupancy costs may not be deductible.'));
  notes.push(note('smallBusinessConcessionsRare', 'The small business CGT concessions will rarely apply to a home used mainly as a home.'));
  if (input.saleDate >= AU_CGT_REGIME_2027_FROM) {
    notes.push(note('cgtFrom1July2027', 'The sale is on or after 1 July 2027: the enacted indexation regime applies to the gain after 30 June 2027.'));
    notes.push(note('minimumTax30', 'A 30% minimum tax applies to the indexed gain.'));
  }

  const breakEvenCurrent = discountFactor * taxableFraction * marginal > 0 ? extraTaxValue / (taxableFraction * discountFactor * marginal) : null;
  const breakEven2027 =
    regimeTax === null ? null : solveGrowth(extraTaxValue, (g) => {
      const r = regime(g);
      return r.applies && r.computable ? r.tax : null;
    });

  const pob = { deductionsPerYear: running + extraPerYear, deductionsTotal: (running + extraPerYear) * years };
  return {
    supported: true,
    country: 'AU',
    incomeYears,
    options: {
      deskOrSharedRoom: {
        deductionsPerYear: cents(desk.deductionsPerYear),
        deductionsTotal: cents(desk.deductionsTotal),
        taxValue: cents(desk.deductionsTotal * marginal),
        cgtCurrentLaw: 0,
        net: cents(desk.deductionsTotal * marginal),
      },
      placeOfBusiness: {
        deductionsPerYear: cents(pob.deductionsPerYear),
        deductionsTotal: cents(pob.deductionsTotal),
        taxValue: cents(pob.deductionsTotal * marginal),
        cgtCurrentLaw: cents(cgtTax),
        net: cents(pob.deductionsTotal * marginal - cgtTax),
      },
    },
    extraDeductions: { perYear: cents(extraPerYear), total: cents(extraTotal), taxValue: cents(extraTaxValue) },
    cgt: {
      currentLaw: {
        businessShareGain: cents(businessShareGain),
        discountApplies,
        taxableGain: cents(taxableGain),
        tax: cents(cgtTax),
        appliesToThisSale: input.saleDate < AU_CGT_REGIME_2027_FROM,
      },
      from1July2027,
    },
    net: { currentLaw: cents(extraTaxValue - cgtTax), from1July2027: regimeTax === null ? null : cents(extraTaxValue - regimeTax) },
    breakEvenGrowth: { currentLaw: breakEvenCurrent === null ? null : Math.round(breakEvenCurrent), from1July2027: breakEven2027 },
    notes,
    rules: rulesFor(notes),
  };
}

// ─── 2. Which home is the main residence ────────────────────────────────────

export interface HomeTimeline {
  name: string;
  /** YYYY-MM-DD you acquired it (settlement), and moved in as soon as practicable. */
  ownedFrom: string;
  /** YYYY-MM-DD you stopped living in it. Set on the former home only. */
  movedOut?: string;
  /** Growth in its value from `ownedFrom` to its sale. */
  expectedGrowth: number;
  /** YYYY-MM-DD it started being rented out (income-producing) after you moved out; rented from then to the sale. */
  rentedFrom?: string;
}

export interface MainResidenceChoiceInput {
  country?: string;
  /** Exactly two: the former home (with `movedOut`) and the new one. */
  homes: HomeTimeline[];
  /** Sale (contract) date for each home, by name. */
  saleDates: Record<string, string>;
  marginalRatePct: number;
}

export interface HomeOutcome {
  name: string;
  ownedDays: number;
  taxableDays: number;
  exemptGain: number;
  taxableGain: number;
  discountApplies: boolean;
  tax: number;
}

export interface MainResidenceOption {
  /** The home treated as the main residence while you owned both. */
  nominated: string;
  homes: HomeOutcome[];
  totalTax: number;
}

export interface MainResidenceChoiceResult {
  supported: true;
  country: 'AU';
  /** Days you owned both homes after the new one was bought. */
  overlap: { from: string; to: string; days: number };
  /** Days at the end of the overlap when both are exempt under the moving-house rule (0 where it does not apply). */
  movingHouseDays: number;
  options: MainResidenceOption[];
  /** The option with less tax, and how much less. */
  better: { nominated: string; saving: number };
  notes: DecisionNote[];
  rules: Array<HomePropertyRule & { key: HomePropertyRuleKey }>;
}

/**
 * Days of an income-producing absence beyond the 6-year limit, inclusive —
 * the ATO's Roya example: rented from 29 September 1999, the 6 years run to
 * 29 September 2005 and the taxable days start on 30 September 2005.
 */
export function daysBeyondSixYears(rentedFrom: string, absenceEnd: string): number {
  const lastExempt = addMonths(rentedFrom, 72);
  return absenceEnd <= lastExempt ? 0 : daysInclusive(addDays(lastExempt, 1), absenceEnd);
}

/**
 * Which home's exemption should cover the period you owned both? Compares the
 * two pure choices over the overlap: the former home kept as your main
 * residence under the absence rule (the new home taxable meanwhile), or the
 * new home (the former home taxable from when you bought it). You may split
 * the overlap between them; this compares the two ends.
 */
export function mainResidenceChoice(input: MainResidenceChoiceInput): MainResidenceChoiceResult | UnsupportedCountry {
  if (!isAu(input.country)) return unsupported(input.country as string);
  if (!Array.isArray(input.homes) || input.homes.length !== 2) throw new RangeError('homes: expected exactly two homes — the former one and the new one');
  const former = input.homes.find((h) => h.movedOut !== undefined);
  const next = input.homes.find((h) => h.movedOut === undefined);
  if (!former || !next) throw new RangeError('homes: exactly one home must have movedOut (the former home)');
  const marginal = pct(input.marginalRatePct, 'marginalRatePct');

  const saleOf = (h: HomeTimeline) => {
    const s = input.saleDates?.[h.name];
    parseYmd(s, `saleDates.${h.name}`);
    if (s < h.ownedFrom) throw new RangeError(`saleDates.${h.name}: before ownedFrom`);
    return s;
  };
  for (const h of input.homes) {
    parseYmd(h.ownedFrom, `${h.name}.ownedFrom`);
    money(h.expectedGrowth, `${h.name}.expectedGrowth`, { allowNegative: true });
  }
  const saleF = saleOf(former);
  const saleN = saleOf(next);
  const movedOut = former.movedOut as string;
  parseYmd(movedOut, `${former.name}.movedOut`);
  if (movedOut < former.ownedFrom || movedOut > saleF) throw new RangeError(`${former.name}.movedOut: must fall between ownedFrom and its sale`);
  if (former.rentedFrom !== undefined) {
    parseYmd(former.rentedFrom, `${former.name}.rentedFrom`);
    if (former.rentedFrom < movedOut || former.rentedFrom > saleF) throw new RangeError(`${former.name}.rentedFrom: must fall between movedOut and its sale`);
  }

  // The overlap: both owned, from the day the new home was acquired.
  const overlapFrom = maxYmd(next.ownedFrom, former.ownedFrom);
  const overlapTo = minYmd(saleF, saleN);
  const overlap = overlapTo < overlapFrom ? 0 : daysInclusive(overlapFrom, overlapTo);

  // Moving-house rule: up to 6 months before the old home is disposed of, both are exempt, if you lived in
  // it for a continuous 3 months in the 12 months before disposal and it earned no income in those 12 months.
  const yearBefore = addMonths(saleF, -12);
  const livedLast12 = overlapDays(former.ownedFrom, movedOut, yearBefore, saleF);
  const threeMonths = daysInclusive(yearBefore, addDays(addMonths(yearBefore, 3), -1));
  const rentedLast12 = former.rentedFrom !== undefined && overlapDays(former.rentedFrom, saleF, yearBefore, saleF) > 0;
  const movingRuleMet = overlap > 0 && saleF <= saleN && livedLast12 >= threeMonths && !rentedLast12;
  // The ATO's Jeneen and John example: sold 1 October 2025, both exempt "1 April 2025 to 1 October 2025".
  const movingHouseDays = movingRuleMet ? overlapDays(overlapFrom, overlapTo, addMonths(saleF, -6), saleF) : 0;

  const outcome = (h: HomeTimeline, sale: string, taxableDays: number, firstIncomeUse: string | null): HomeOutcome => {
    const ownedDays = daysInclusive(h.ownedFrom, sale);
    const g = Math.max(0, h.expectedGrowth);
    const taxableGain = ownedDays > 0 ? (g * taxableDays) / ownedDays : 0;
    // No discount where the first-use rule applies and income use began within 12 months of the sale.
    const acquired = firstIncomeUse && taxableDays > 0 ? firstIncomeUse : h.ownedFrom;
    const discountApplies = heldAtLeast12Months(acquired, sale);
    return {
      name: h.name,
      ownedDays,
      taxableDays,
      exemptGain: cents(g - taxableGain),
      taxableGain: cents(taxableGain),
      discountApplies,
      tax: cents(taxableGain * (discountApplies ? DISCOUNT : 1) * marginal),
    };
  };

  // Income-producing days beyond 6 years in the absence (only while the former home is still nominated).
  const beyondSix = (absenceEnd: string) => (former.rentedFrom && former.rentedFrom <= absenceEnd ? daysBeyondSixYears(former.rentedFrom, absenceEnd) : 0);

  // Option 1: the former home stays the main residence throughout; the new home is taxable for the overlap.
  const keepFormer: MainResidenceOption = {
    nominated: former.name,
    homes: [
      outcome(former, saleF, beyondSix(saleF), former.rentedFrom ?? null),
      outcome(next, saleN, Math.max(0, overlap - movingHouseDays), null),
    ],
    totalTax: 0,
  };
  // Option 2: the new home from the day it was acquired; the former home is taxable for the overlap,
  // plus any income-producing absence days beyond 6 years before it.
  const preOverlapEnd = addDays(overlapFrom, -1);
  const formerTaxable = Math.max(0, overlap - movingHouseDays) + (preOverlapEnd >= movedOut ? beyondSix(preOverlapEnd) : 0);
  const takeNew: MainResidenceOption = {
    nominated: next.name,
    homes: [outcome(former, saleF, formerTaxable, former.rentedFrom ?? null), outcome(next, saleN, 0, null)],
    totalTax: 0,
  };
  for (const o of [keepFormer, takeNew]) o.totalTax = cents(o.homes.reduce((s, h) => s + h.tax, 0));

  const better = keepFormer.totalTax <= takeNew.totalTax ? keepFormer : takeNew;
  const other = better === keepFormer ? takeNew : keepFormer;

  const notes: DecisionNote[] = [
    note('oneMainResidence', 'Only one home can be your main residence at a time, apart from the moving-house overlap.'),
    note(
      'sixYearRule',
      former.rentedFrom
        ? `${former.name} was rented after you moved out, so it can stay your main residence for up to 6 years of renting in that absence.`
        : `${former.name} was not rented after you moved out, so it can stay your main residence for the whole absence.`,
    ),
    note(
      'movingHouseSixMonths',
      movingRuleMet
        ? `Both homes are exempt for the last ${movingHouseDays} days before ${former.name} was sold (the moving-house rule).`
        : 'The moving-house rule (both homes exempt for up to 6 months) does not apply on these dates.',
    ),
    note('homeFirstUsedToProduceIncome', 'Gains are assumed to accrue evenly by day; with even growth the market-value reset at first income use gives the same result.'),
    note('cgtDiscount', 'The 50% discount applies to each home held at least 12 months.'),
    note('spouseDifferentHomes', 'If you have a spouse living in a different home, you must choose one home for both of you or each nominate your own, with a half-period rule. This result is for one owner, or spouses choosing the same home.'),
  ];
  if (saleF >= AU_CGT_REGIME_2027_FROM || saleN >= AU_CGT_REGIME_2027_FROM) {
    notes.push(note('cgtFrom1July2027', 'A sale on or after 1 July 2027 falls under the enacted indexation regime for the gain after 30 June 2027; the figures here use the discount rules throughout.'));
  }

  return {
    supported: true,
    country: 'AU',
    overlap: { from: overlapFrom, to: overlapTo, days: overlap },
    movingHouseDays,
    options: [keepFormer, takeNew],
    better: { nominated: better.nominated, saving: cents(other.totalTax - better.totalTax) },
    notes,
    rules: rulesFor(notes),
  };
}

// ─── 3. Someone living with you ─────────────────────────────────────────────

export interface DomesticArrangementInput {
  country?: string;
  kind: 'domestic';
}

export interface LodgerArrangementInput {
  country?: string;
  kind: 'lodger';
  /** Market rent the lodger pays, per week. */
  weeklyRent: number;
  /** Weeks let each year. Default 52. */
  weeksLetPerYear?: number;
  /** Let share of the home, percent — or give exclusivePct and sharedPct instead. */
  letSharePct?: number;
  /** Floor area only the lodger uses, percent. */
  exclusivePct?: number;
  /** Floor area you and the lodger share, percent; the lodger's part is sharedPct ÷ sharedBy. */
  sharedPct?: number;
  /** People sharing the shared area, including you. Default 2. */
  sharedBy?: number;
  /** Whole-home costs each year that are apportioned by the let share: interest, rates, insurance, repairs. */
  homeCostsPerYear: number;
  marginalRatePct: number;
  /** Income years of letting to show. Default 1. */
  years?: number;
  ownershipPct?: number;
  /** YYYY-MM-DD letting began. */
  firstLetDate: string;
  /** YYYY-MM-DD letting ended, if before the sale. */
  letEndDate?: string;
  /** YYYY-MM-DD of the sale contract. */
  saleDate: string;
  /** Growth in the whole home's value from `firstLetDate` (or acquisition, if let from then) to the sale. */
  expectedGrowth: number;
}

export interface DomesticArrangementResult {
  supported: true;
  country: 'AU';
  kind: 'domestic';
  assessableIncomePerYear: 0;
  deductionsPerYear: 0;
  mainResidenceExemption: 'unaffected';
  notes: DecisionNote[];
  rules: Array<HomePropertyRule & { key: HomePropertyRuleKey }>;
}

export interface LodgerArrangementResult {
  supported: true;
  country: 'AU';
  kind: 'lodger';
  letSharePct: number;
  perYear: { rent: number; deductions: number; net: number; tax: number };
  total: { rent: number; deductions: number; net: number; tax: number };
  cgt: { taxableGain: number; discountApplies: boolean; netGain: number; tax: number; appliesToThisSale: boolean };
  mainResidenceExemption: 'partial';
  notes: DecisionNote[];
  rules: Array<HomePropertyRule & { key: HomePropertyRuleKey }>;
}

/**
 * A domestic arrangement (family sharing costs) is not income and costs
 * nothing; a lodger at market rent is rent in, the let share of costs out, and
 * the let share of the home out of the exemption from when letting began.
 */
export function roomOrPartnerArrangement(
  input: DomesticArrangementInput | LodgerArrangementInput,
): DomesticArrangementResult | LodgerArrangementResult | UnsupportedCountry {
  if (!isAu(input.country)) return unsupported(input.country as string);

  if (input.kind === 'domestic') {
    const notes = [
      note('domesticArrangement', 'Board or cost-sharing from family or household members is a domestic arrangement: not income, and nothing is deductible.'),
      note('noIncomeFromOccupierNoCgt', 'With no assessable income from them, your main residence exemption is unaffected.'),
    ];
    return {
      supported: true,
      country: 'AU',
      kind: 'domestic',
      assessableIncomePerYear: 0,
      deductionsPerYear: 0,
      mainResidenceExemption: 'unaffected',
      notes,
      rules: rulesFor(notes),
    };
  }
  if (input.kind !== 'lodger') throw new RangeError(`kind: expected 'domestic' or 'lodger', got "${(input as { kind: string }).kind}"`);

  let share: number;
  if (input.letSharePct !== undefined) share = pct(input.letSharePct, 'letSharePct');
  else if (input.exclusivePct !== undefined) {
    const sharedBy = Number(input.sharedBy ?? 2);
    if (!Number.isInteger(sharedBy) || sharedBy < 1) throw new RangeError(`sharedBy: expected a whole number of at least 1, got ${input.sharedBy}`);
    share = pct(input.exclusivePct, 'exclusivePct') + pct(input.sharedPct ?? 0, 'sharedPct') / sharedBy;
    if (share > 1) throw new RangeError('exclusivePct + sharedPct ÷ sharedBy exceeds 100%');
  } else throw new RangeError('letSharePct or exclusivePct is required');

  const rentWeekly = money(input.weeklyRent, 'weeklyRent');
  const weeks = Number(input.weeksLetPerYear ?? 52);
  if (!Number.isFinite(weeks) || weeks < 0 || weeks > 53) throw new RangeError(`weeksLetPerYear: expected 0 to 53, got ${input.weeksLetPerYear}`);
  const costs = money(input.homeCostsPerYear, 'homeCostsPerYear');
  const marginal = pct(input.marginalRatePct, 'marginalRatePct');
  const ownership = pct(input.ownershipPct ?? 100, 'ownershipPct');
  const years = Number(input.years ?? 1);
  if (!Number.isInteger(years) || years < 1 || years > 50) throw new RangeError(`years: expected a whole number from 1 to 50, got ${input.years}`);
  parseYmd(input.firstLetDate, 'firstLetDate');
  parseYmd(input.saleDate, 'saleDate');
  if (input.saleDate < input.firstLetDate) throw new RangeError('saleDate: must be on or after firstLetDate');
  const letEnd = input.letEndDate ?? input.saleDate;
  parseYmd(letEnd, 'letEndDate');
  if (letEnd < input.firstLetDate || letEnd > input.saleDate) throw new RangeError('letEndDate: must fall between firstLetDate and saleDate');
  const growth = money(input.expectedGrowth, 'expectedGrowth', { allowNegative: true });

  // Income tax, per year. The rent is your share's if you co-own; so are the costs you bear.
  const rent = rentWeekly * weeks * ownership;
  const deductions = costs * share * (weeks / 52) * ownership;
  const net = rent - deductions;
  const tax = net * marginal;

  // CGT: the ATO's steps 1 to 6 — gain from first letting × let share × (days let ÷ days from first letting to sale).
  const daysFactor = letEnd === input.saleDate ? 1 : daysInclusive(input.firstLetDate, letEnd) / daysInclusive(input.firstLetDate, input.saleDate);
  const taxableGain = Math.max(0, growth) * share * ownership * daysFactor;
  const discountApplies = heldAtLeast12Months(input.firstLetDate, input.saleDate);
  const netGain = taxableGain * (discountApplies ? DISCOUNT : 1);

  const notes: DecisionNote[] = [
    note('lodgerLetShare', `Rent is assessable and the let share (${cents(share * 100)}%) of home costs is deductible.`),
    note('floorAreaAndDaysApportionment', 'The let share of the gain, for the days let, is outside the main residence exemption.'),
    note('homeFirstUsedToProduceIncome', 'If you lived there before letting, the gain is measured from the value when letting began.'),
    discountApplies
      ? note('cgtDiscount', 'Held at least 12 months from first letting, so the 50% discount applies.')
      : note('noDiscountWithin12MonthsOfFirstUse', 'Sold within 12 months of first letting, so no CGT discount.'),
  ];
  if (net < 0) {
    notes.push(note('negativeGearingNewBuilds', 'A rental loss: from 1 July 2027 negative gearing for residential property is limited to new builds, unless the property was held at 7:30pm AEST 12 May 2026. This result does not quarantine the loss.'));
  }
  if (input.saleDate >= AU_CGT_REGIME_2027_FROM) {
    notes.push(note('cgtFrom1July2027', 'A sale on or after 1 July 2027 falls under the enacted indexation regime for the gain after 30 June 2027; the CGT here uses the discount rules.'));
  }

  return {
    supported: true,
    country: 'AU',
    kind: 'lodger',
    letSharePct: cents(share * 100),
    perYear: { rent: cents(rent), deductions: cents(deductions), net: cents(net), tax: cents(tax) },
    total: { rent: cents(rent * years), deductions: cents(deductions * years), net: cents(net * years), tax: cents(tax * years) },
    cgt: {
      taxableGain: cents(taxableGain),
      discountApplies,
      netGain: cents(netGain),
      tax: cents(netGain * marginal),
      appliesToThisSale: input.saleDate < AU_CGT_REGIME_2027_FROM,
    },
    mainResidenceExemption: 'partial',
    notes,
    rules: rulesFor(notes),
  };
}
