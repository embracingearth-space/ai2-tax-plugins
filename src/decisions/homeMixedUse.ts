/**
 * A home that is partly a place of business AND partly let, at the same time — ai2fin.com
 *
 * `homeSpaceComparison` (business space) and `roomOrPartnerArrangement`
 * (a lodger) each treat the rest of the home as fully exempt. Run side by
 * side for one home, they each start the taxable gain from their own first
 * income use and each measure it over their own days, so their two CGT
 * figures do not add up to the home's. The ATO works it out once for the
 * home: the gain from the day the home was FIRST used to produce income (the
 * market-value reset), times the non-exempt share — floor area × days, for
 * every income-producing use — over the days from that first use to the sale
 * (Using your home for rental or business, steps 1 to 6).
 *
 * `homeMixedUseComparison` does that once:
 *  - the business share (dated periods, as homeSpaceComparison) and the let
 *    share (the lodger's exclusive area plus their part of shared areas), both
 *    by day; together they may not exceed 100% on any day;
 *  - one CGT figure on the COMBINED non-exempt share, split at 30 June 2027
 *    exactly as homeSpaceComparison splits it, with the optional valuations;
 *  - occupancy deductions on the business share only; rent and the let
 *    share's costs on the let share only;
 *  - the place-of-business verdict GIVEN the lodger: the extra deductions
 *    against the extra CGT a place of business adds on top of the letting
 *    (combined CGT − the letting's CGT alone), through recommendHomeSpace.
 *
 * WHEN THE COMBINED FIGURE EQUALS THE SUM. The gain is linear in the share,
 * so when both uses start on the same day the combined CGT is the sum of the
 * two separate figures. It differs when they start on different days: the
 * separate calculators then measure from different first-use days (and
 * different market values), and the one that starts later loses the days
 * the other was already producing income. The tests pin both.
 *
 * AUSTRALIA ONLY. The research (home-rules-research.md §6) shows the same
 * combinable structure elsewhere, for a later change:
 *  - GB: an exclusive business room loses relief by VALUE; a single lodger
 *    does not restrict it, two or more (or a let part) restrict it by the let
 *    share, with lettings relief up to £40,000 if you lived there too.
 *  - US: both uses reach the sale only through depreciation (inside the
 *    dwelling), against one §121 exclusion.
 *  - NZ: bright-line's main-home exclusion needs more than 50% of the AREA as
 *    the main home for more than half the time — business and let areas count
 *    together against it.
 *  - CA: no effect while both are ancillary, with no structural change and no
 *    CCA; otherwise a deemed disposition of the parts.
 *  - IN: no exemption to lose.
 */

import { AU_CGT_REGIME_2027_FROM, unsupported, type UnsupportedCountry } from './homeProperty';
import { addDays, daysInclusive, heldAtLeast12Months, maxYmd, minYmd, overlapDays } from './dates';
import { DecisionInputError, MAX_WEEKS_PER_YEAR, Problems, type DecisionInputProblem } from './inputGuards';
import { AU_HOME_PROPERTY_RULES, note, type DecisionNote, type HomePropertyRule, type HomePropertyRuleKey } from './homePropertyRules';
import { AU_HOME_SPACE_FIGURES } from './homeSpaceRates';
import { recommendHomeSpace, type HomeSpaceRecommendation, type HomeSpaceUsePeriod } from './homeSpaceComparison';

export interface HomeMixedUseInput {
  country?: string;
  /** The business share: dated periods (as homeSpaceComparison), or one share with its dates. */
  business: { usePeriods?: HomeSpaceUsePeriod[]; sharePct?: number; start?: string; end?: string };
  /** The let share, and the rent. */
  letting: {
    /** The let share of the home, percent — or give exclusivePct (and sharedPct, sharedBy). */
    sharePct?: number;
    /** Floor area only the lodger uses, percent. */
    exclusivePct?: number;
    /** Floor area the lodger shares with you, percent; the lodger's part is sharedPct ÷ sharedBy. */
    sharedPct?: number;
    /** People sharing the shared area, you included. Default 2. */
    sharedBy?: number;
    start: string;
    /** Default: letting continues to the sale. */
    end?: string;
    weeklyRent: number;
    /** Weeks let each year. Default 52. */
    weeksLetPerYear?: number;
    /** Whole-home costs a year apportioned by the let share: interest, rates, insurance, repairs. */
    homeCostsPerYear: number;
  };
  saleDate: string;
  /** Whole-home occupancy costs YOU pay a year — the business share of them is the place-of-business deduction. */
  occupancyCostsPerYear: number;
  marginalRatePct: number;
  ownershipPct?: number;
  /** Growth in the whole home's value from the FIRST income use (business or letting) to the sale. */
  expectedGrowth: number;
  /** The home's value when it was first used to produce income, and just before 1 July 2027. */
  homeValueAtFirstUse?: number;
  valueAt30June2027?: number;
}

export interface MixedCgt {
  /** CGT on growth to 30 June 2027 (the whole gain for an earlier sale). */
  counted: number;
  /** The rest, at today's rules — for scale only. */
  laterAtTodaysRules: number;
  wholeAtTodaysRules: number;
}

export interface HomeMixedUseResult {
  supported: true;
  country: 'AU';
  currency: 'AUD';
  /** The first day the home produced income (business or letting): the gain is measured from here. */
  firstIncomeUse: string;
  /** The largest combined non-exempt share on any day, percent. */
  maxCombinedSharePct: number;
  /** Occupancy deductions (tax value) on the business share, split at 30 June 2027. */
  businessDeductions: { pre: number; post: number; total: number };
  /** The letting over its days: rent, the let share's deductions, the net and its tax. */
  letting: { sharePct: number; rent: number; deductions: number; net: number; tax: number };
  cgt: {
    /** One figure for the home: the combined non-exempt share, from the first income use. */
    combined: MixedCgt;
    /** The combined figure attributed by share × days (for display; not two separate calculations). */
    businessPart: MixedCgt;
    letPart: MixedCgt;
    /** The letting alone, as if there were no business use — the base the place-of-business verdict is weighed on. */
    lettingAlone: MixedCgt;
    /** What running the two calculators separately would give: business alone + letting alone. */
    sumOfSeparate: MixedCgt;
    discountApplies: boolean;
    basis: 'whole gain — sale before 1 July 2027' | 'even growth by day to 30 June 2027' | 'valuations supplied';
  };
  /** The place-of-business verdict given the letting: extra deductions against the extra CGT on top of the letting. */
  placeOfBusiness: HomeSpaceRecommendation;
  partial: boolean;
  notes: DecisionNote[];
  rules: Array<HomePropertyRule & { key: HomePropertyRuleKey }>;
}

const LAST_DISCOUNT_DAY = addDays(AU_CGT_REGIME_2027_FROM, -1);
const cents = (n: number) => Math.round(n * 100) / 100;

type Span = { start: string; end: string; share: number };

function businessSpans(input: HomeMixedUseInput): Span[] {
  const b = input.business ?? {};
  const list = Array.isArray(b.usePeriods)
    ? b.usePeriods.map((u) => ({ start: u.start, end: u.end, share: Number(u.sharePct) / 100 }))
    : b.sharePct !== undefined && b.start
      ? [{ start: b.start, end: b.end ?? input.saleDate, share: Number(b.sharePct) / 100 }]
      : [];
  return list.filter((s) => s.share > 0).sort((a, c) => a.start.localeCompare(c.start));
}

function letShareOf(l: HomeMixedUseInput['letting']): number {
  if (l.sharePct !== undefined) return Number(l.sharePct) / 100;
  return (Number(l.exclusivePct ?? 0) + Number(l.sharedPct ?? 0) / Number(l.sharedBy ?? 2)) / 100;
}

function letSpans(input: HomeMixedUseInput): Span[] {
  const share = letShareOf(input.letting);
  return share > 0 ? [{ start: input.letting.start, end: input.letting.end ?? input.saleDate, share }] : [];
}

/** Every problem with a homeMixedUseComparison input; empty when it can be computed. Does not throw. */
export function validateHomeMixedUse(input: HomeMixedUseInput): DecisionInputProblem[] {
  const p = new Problems();
  if (!input || typeof input !== 'object') return [{ field: 'input', message: 'expected an object' }];
  p.percent(input.marginalRatePct, 'marginalRatePct');
  if (input.ownershipPct !== undefined) p.percent(input.ownershipPct, 'ownershipPct');
  p.amount(input.occupancyCostsPerYear, 'occupancyCostsPerYear');
  p.amount(input.expectedGrowth, 'expectedGrowth');
  const sale = p.date(input.saleDate, 'saleDate');

  const b = input.business;
  if (!b || typeof b !== 'object') p.add('business', 'expected an object');
  else if (Array.isArray(b.usePeriods)) {
    b.usePeriods.forEach((u, i) => {
      const f = (k: string) => `business.usePeriods[${i}].${k}`;
      const s = p.date(u?.start, f('start'));
      const e = p.date(u?.end, f('end'));
      p.percent(u?.sharePct, f('sharePct'));
      if (s && e) p.order(u.start, u.end, f('start'), f('end'));
      if (e && sale && u.end > input.saleDate) p.add(f('end'), `must be on or before saleDate (${input.saleDate}), got ${u.end}`);
    });
  } else {
    p.percent(b.sharePct, 'business.sharePct');
    const s = p.date(b.start, 'business.start');
    if (s && sale) p.order(b.start as string, input.saleDate, 'business.start', 'saleDate');
    if (b.end !== undefined && p.date(b.end, 'business.end') && s) p.order(b.start as string, b.end, 'business.start', 'business.end');
  }

  const l = input.letting;
  if (!l || typeof l !== 'object') p.add('letting', 'expected an object');
  else {
    if (l.sharePct !== undefined) p.percent(l.sharePct, 'letting.sharePct');
    else if (l.exclusivePct !== undefined) {
      p.percent(l.exclusivePct, 'letting.exclusivePct');
      if (l.sharedPct !== undefined) p.percent(l.sharedPct, 'letting.sharedPct');
      if (l.sharedBy !== undefined) p.number(l.sharedBy, 'letting.sharedBy', { min: 1, integer: true, what: 'a whole number of people, at least 1' });
    } else p.add('letting.sharePct', 'required, or give exclusivePct (and sharedPct)');
    const s = p.date(l.start, 'letting.start');
    if (s && sale) p.order(l.start, input.saleDate, 'letting.start', 'saleDate');
    if (l.end !== undefined && p.date(l.end, 'letting.end') && s) {
      p.order(l.start, l.end, 'letting.start', 'letting.end');
      if (sale && l.end > input.saleDate) p.add('letting.end', `must be on or before saleDate (${input.saleDate}), got ${l.end}`);
    }
    p.amount(l.weeklyRent, 'letting.weeklyRent');
    p.amount(l.homeCostsPerYear, 'letting.homeCostsPerYear');
    if (l.weeksLetPerYear !== undefined) p.number(l.weeksLetPerYear, 'letting.weeksLetPerYear', { min: 0, max: MAX_WEEKS_PER_YEAR, what: 'weeks from 0 to 52' });
  }
  if (input.homeValueAtFirstUse !== undefined) p.amount(input.homeValueAtFirstUse, 'homeValueAtFirstUse');
  if (input.valueAt30June2027 !== undefined) {
    p.amount(input.valueAt30June2027, 'valueAt30June2027');
    if (input.homeValueAtFirstUse === undefined) p.add('homeValueAtFirstUse', 'give it with valueAt30June2027, or neither');
  }

  // The two uses may not overlap into more than the whole home on any day.
  if (!p.list.length) {
    for (const bs of businessSpans(input)) {
      for (const ls of letSpans(input)) {
        if (overlapDays(bs.start, bs.end, ls.start, ls.end) > 0 && bs.share + ls.share > 1 + 1e-9) {
          p.add(
            'letting.sharePct',
            `the business share (${cents(bs.share * 100)}%) and the let share (${cents(ls.share * 100)}%) come to more than 100% from ${maxYmd(bs.start, ls.start)}`,
          );
        }
      }
    }
  }
  return p.list;
}

/** CGT on a set of share spans, measured the ATO's way: from the first income use, share × days ÷ days to the sale. */
function cgtOn(spans: Span[], input: HomeMixedUseInput, from: string, marginal: number, ownership: number): MixedCgt & { discountApplies: boolean; basis: HomeMixedUseResult['cgt']['basis']; shareDays: number } {
  const sale = input.saleDate;
  const growth = Math.max(0, Number(input.expectedGrowth));
  const totalDays = daysInclusive(from, sale);
  const shareDays = spans.reduce((n, s) => n + s.share * overlapDays(s.start, s.end, from, sale), 0);
  const shareDaysPre = spans.reduce((n, s) => n + s.share * overlapDays(s.start, s.end, from, LAST_DISCOUNT_DAY), 0);
  const discountApplies = heldAtLeast12Months(from, sale);
  const factor = discountApplies ? 1 - AU_HOME_SPACE_FIGURES.cgtDiscount.value : 1;
  const whole = totalDays > 0 ? ((growth * ownership * shareDays) / totalDays) * factor * marginal : 0;
  const partial = sale >= AU_CGT_REGIME_2027_FROM;
  let preGain: number;
  let basis: HomeMixedUseResult['cgt']['basis'];
  if (!partial) {
    preGain = totalDays > 0 ? (growth * ownership * shareDays) / totalDays : 0;
    basis = 'whole gain — sale before 1 July 2027';
  } else if (input.homeValueAtFirstUse !== undefined && input.valueAt30June2027 !== undefined && from < AU_CGT_REGIME_2027_FROM) {
    const preDays = daysInclusive(from, LAST_DISCOUNT_DAY);
    const valueGain = Math.max(0, Number(input.valueAt30June2027) - Number(input.homeValueAtFirstUse));
    preGain = (valueGain * ownership * shareDaysPre) / preDays;
    basis = 'valuations supplied';
  } else {
    preGain = totalDays > 0 ? (growth * ownership * shareDaysPre) / totalDays : 0;
    basis = 'even growth by day to 30 June 2027';
  }
  const counted = preGain * factor * marginal;
  return {
    counted,
    laterAtTodaysRules: partial ? Math.max(0, whole - counted) : 0,
    wholeAtTodaysRules: whole,
    discountApplies,
    basis,
    shareDays,
  };
}

const round = (c: MixedCgt): MixedCgt => ({ counted: cents(c.counted), laterAtTodaysRules: cents(c.laterAtTodaysRules), wholeAtTodaysRules: cents(c.wholeAtTodaysRules) });
const scale = (c: MixedCgt, k: number): MixedCgt => ({ counted: c.counted * k, laterAtTodaysRules: c.laterAtTodaysRules * k, wholeAtTodaysRules: c.wholeAtTodaysRules * k });
const add = (a: MixedCgt, b: MixedCgt): MixedCgt => ({ counted: a.counted + b.counted, laterAtTodaysRules: a.laterAtTodaysRules + b.laterAtTodaysRules, wholeAtTodaysRules: a.wholeAtTodaysRules + b.wholeAtTodaysRules });
const minus = (a: MixedCgt, b: MixedCgt): MixedCgt => ({ counted: a.counted - b.counted, laterAtTodaysRules: a.laterAtTodaysRules - b.laterAtTodaysRules, wholeAtTodaysRules: a.wholeAtTodaysRules - b.wholeAtTodaysRules });

/** A home used for a business and let at the same time: one CGT figure, and the place-of-business verdict given the letting. */
export function homeMixedUseComparison(input: HomeMixedUseInput): HomeMixedUseResult | UnsupportedCountry {
  const country = (input?.country ?? 'AU').toUpperCase();
  if (country !== 'AU') return unsupported(country);
  const problems = validateHomeMixedUse(input);
  if (problems.length) throw new DecisionInputError(problems);

  const marginal = Number(input.marginalRatePct) / 100;
  const ownership = Number(input.ownershipPct ?? 100) / 100;
  const biz = businessSpans(input);
  const lets = letSpans(input);
  const all = [...biz, ...lets];
  if (!all.length) throw new DecisionInputError([{ field: 'business', message: 'no business or let share to weigh' }]);
  const firstIncomeUse = all.reduce((m, s) => minYmd(m, s.start), all[0].start);
  const sale = input.saleDate;

  // Business deductions: occupancy × share, by day in each income year, split at 30 June 2027.
  let wPre = 0;
  let wPost = 0;
  if (biz.length) {
    const firstYear = (d: string) => (Number(d.slice(5, 7)) >= 7 ? Number(d.slice(0, 4)) : Number(d.slice(0, 4)) - 1);
    const last = biz.reduce((m, s) => maxYmd(m, s.end), biz[0].end);
    for (let y = firstYear(biz[0].start); y <= firstYear(last); y++) {
      const ys = `${y}-07-01`;
      const ye = `${y + 1}-06-30`;
      const inYear = daysInclusive(ys, ye);
      const w = biz.reduce((n, s) => n + (overlapDays(s.start, s.end, ys, ye) * s.share) / inYear, 0);
      if (y >= 2027) wPost += w;
      else wPre += w;
    }
  }
  const occupancy = Number(input.occupancyCostsPerYear);
  const businessDeductions = { pre: occupancy * wPre * marginal, post: occupancy * wPost * marginal, total: occupancy * (wPre + wPost) * marginal };

  // Letting: rent and the let share's costs over the days let (weeks let a year scale both), your ownership share.
  const l = input.letting;
  const letShare = letShareOf(l);
  const weeks = Number(l.weeksLetPerYear ?? 52);
  const letYears = lets.length ? daysInclusive(lets[0].start, lets[0].end) / 365.25 : 0;
  const rent = Number(l.weeklyRent) * weeks * ownership * letYears;
  const letDeductions = Number(l.homeCostsPerYear) * letShare * (weeks / 52) * ownership * letYears;
  const letNet = rent - letDeductions;

  // CGT: once, on the combined share, from the first income use.
  const combined = cgtOn(all, input, firstIncomeUse, marginal, ownership);
  const bizShareDays = cgtOn(biz, input, firstIncomeUse, marginal, ownership).shareDays;
  const k = combined.shareDays > 0 ? bizShareDays / combined.shareDays : 0;
  const businessPart = scale(combined, k);
  const letPart = minus(combined, businessPart);
  // The separate calculators, each from its own first use — what running the two tabs side by side gives.
  const lettingAlone = lets.length ? cgtOn(lets, input, lets[0].start, marginal, ownership) : { counted: 0, laterAtTodaysRules: 0, wholeAtTodaysRules: 0 };
  const businessAlone = biz.length ? cgtOn(biz, input, biz[0].start, marginal, ownership) : { counted: 0, laterAtTodaysRules: 0, wholeAtTodaysRules: 0 };

  // The place-of-business verdict given the letting: the extra CGT a place of business adds on top of the letting.
  const extra = minus(combined, lettingAlone);
  const partial = sale >= AU_CGT_REGIME_2027_FROM;
  const placeOfBusiness = recommendHomeSpace({
    currency: 'AUD',
    deductions: businessDeductions,
    breakEvenGrowth: null,
    partial,
    notYet: partial && biz.length > 0 && biz[0].start >= AU_CGT_REGIME_2027_FROM,
    renting: false,
    cgt: { counted: Math.max(0, extra.counted), laterAtTodaysRules: Math.max(0, extra.laterAtTodaysRules), wholeAtTodaysRules: Math.max(0, extra.wholeAtTodaysRules), laterAtNewRules: null },
  });

  let maxCombined = 0;
  for (const s of all) {
    const same = all.filter((o) => overlapDays(o.start, o.end, s.start, s.end) > 0).reduce((n, o) => n + o.share, 0);
    maxCombined = Math.max(maxCombined, same);
  }

  const notes: DecisionNote[] = [
    note('floorAreaAndDaysApportionment', 'The business share and the let share are added, day by day, into one non-exempt share of the home.'),
    note('homeFirstUsedToProduceIncome', `The gain is measured once, from the first day the home produced income (${firstIncomeUse}), for both uses.`),
    note('occupancyOnlyPlaceOfBusiness', 'Occupancy costs are deductible on the business share only, if it is a genuine place of business.'),
    note('lodgerLetShare', 'Rent is assessable and the let share of home costs is deductible, on the let share only.'),
    combined.discountApplies
      ? note('cgtDiscount', 'Held at least 12 months from the first income use, so the 50% discount applies to the gain to 30 June 2027.')
      : note('noDiscountWithin12MonthsOfFirstUse', 'Sold within 12 months of the first income use, so no CGT discount.'),
  ];
  if (partial) notes.push(note('cgtFrom1July2027', 'The sale is on or after 1 July 2027: the figures weighed are to 30 June 2027; the later growth is shown at today\'s rules for scale only.'));

  return {
    supported: true,
    country: 'AU',
    currency: 'AUD',
    firstIncomeUse,
    maxCombinedSharePct: cents(maxCombined * 100),
    businessDeductions: { pre: cents(businessDeductions.pre), post: cents(businessDeductions.post), total: cents(businessDeductions.total) },
    letting: { sharePct: cents(letShare * 100), rent: cents(rent), deductions: cents(letDeductions), net: cents(letNet), tax: cents(letNet * marginal) },
    cgt: {
      combined: round(combined),
      businessPart: round(businessPart),
      letPart: round(letPart),
      lettingAlone: round(lettingAlone),
      sumOfSeparate: round(add(businessAlone, lettingAlone)),
      discountApplies: combined.discountApplies,
      basis: combined.basis,
    },
    placeOfBusiness,
    partial,
    notes,
    rules: [...new Set(notes.map((n) => n.rule))].map((key) => ({ key, ...AU_HOME_PROPERTY_RULES[key] })),
  };
}
