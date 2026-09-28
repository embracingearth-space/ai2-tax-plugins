/**
 * Desk or shared room vs a place of business, like with like — ai2fin.com
 *
 * `homeBusinessSpaceTradeoff` counts whole income years of deductions and the
 * CGT on the whole gain. That mixes periods for a sale after 30 June 2027:
 * four years of occupancy deductions were being weighed against CGT on only
 * the growth to 30 June 2027, because that is all the current rules govern.
 * The answer then leaned towards a place of business when it should not have.
 *
 * `homeSpaceComparison` weighs the same stretch of time on both sides:
 *
 *  - Years of use are counted BY DAY, per income year: the days used in that
 *    year ÷ the days in it. Use from 1 June to 15 July is about 0.12 of a year,
 *    not two years. Several dated periods, each with its own floor-area share,
 *    are supported (the app's dated business-use periods).
 *  - For a sale on or after 1 July 2027 the verdict weighs deductions to
 *    30 June 2027 against CGT on growth to 30 June 2027 — the part the current
 *    rules govern — and reports the later period separately: the later
 *    deductions against the later CGT at today's rules (for scale), and, when
 *    the home's values are given, an ESTIMATE under the rules from 1 July 2027
 *    (cost base indexed at an assumed CPI rate, no discount, the marginal rate
 *    with the 30% minimum).
 *
 * `recommendHomeSpace` turns a comparison into a verdict — placeOfBusiness,
 * desk, even, dependsOnLater or notYet — with the amounts behind it. It has no
 * words: the app, the website and the Tax MCP each say it in their own
 * language, from the same numbers. "About even" is within 5% of the larger
 * side, or under 100 in the input currency.
 *
 * PURE: no clock, no I/O. AU only; any other country is `unsupported`, with
 * no numbers. `recommendHomeSpace` reads only the fields it names, so a
 * comparison built under another country's rules can use it too.
 */

import { AU_CGT_REGIME_2027_FROM, unsupported, type UnsupportedCountry } from './homeProperty';
import { addDays, daysInclusive, heldAtLeast12Months, maxYmd, minYmd, overlapDays, parseYmd } from './dates';
import { DecisionInputError, Problems, type DecisionInputProblem } from './inputGuards';
import { AU_HOME_PROPERTY_RULES, note, type DecisionNote, type HomePropertyRule, type HomePropertyRuleKey } from './homePropertyRules';
import { AU_HOME_SPACE_FIGURES, type SourcedFigure } from './homeSpaceRates';

// ─── Types ──────────────────────────────────────────────────────────────────

/** One dated stretch of business use at one floor-area share. Both dates inclusive. */
export interface HomeSpaceUsePeriod {
  start: string;
  end: string;
  /** Floor area used as a place of business in this period, percent of the home. */
  sharePct: number;
}

export interface HomeSpaceComparisonInput {
  /** ISO country code; AU here. Default 'AU'. */
  country?: string;
  /** One period: the share, and `businessUseStart`/`businessUseEnd`. Or give `usePeriods` instead. */
  businessSharePct?: number;
  businessUseStart?: string;
  /** Default: use continues to `saleDate`. */
  businessUseEnd?: string;
  /** Several dated periods, each with its own share. Must not overlap, and must end on or before `saleDate`. */
  usePeriods?: HomeSpaceUsePeriod[];
  /** YYYY-MM-DD of the sale contract. Renting: the last day the comparison covers. */
  saleDate: string;
  /** Whole-home occupancy costs YOU pay each year (interest or rent, rates, land tax, insurance). */
  occupancyCostsPerYear: number;
  /** The business part of running costs each year — the same either way. Default 0. */
  runningCostsPerYear?: number;
  /** Marginal rate, percent (e.g. 32 for 30% plus the 2% Medicare levy). Applied flat. */
  marginalRatePct: number;
  /** Your share of the home, percent. Default 100. */
  ownershipPct?: number;
  /** Does the person asking run the business? Default true. A co-owner who does not keeps the full exemption. */
  ownerRunsBusiness?: boolean;
  /** Growth in the whole home's value from first business use to the sale. Ignored when renting. */
  expectedGrowth: number;
  /** A renter has no capital gain: the occupancy deductions are all there is to weigh. Default false. */
  renting?: boolean;
  /**
   * The home's market value when business use began. With `valueAt30June2027` (for use starting before 1 July
   * 2027), the gain to 30 June 2027 is split by value — the law's default — and the later CGT is estimated under
   * the rules from 1 July 2027. For use starting on or after 1 July 2027, this value alone is enough.
   */
  homeValueAtFirstUse?: number;
  /** The home's market value just before 1 July 2027. */
  valueAt30June2027?: number;
}

export interface UseYearsByIncomeYear {
  /** '2025-26'. */
  label: string;
  /** Floor-area-weighted years of use in that income year: Σ share × days used ÷ days in the year, ÷ the largest share. */
  fraction: number;
  /** Days of business use in that income year. */
  days: number;
  /** An income year from 2027-28 on. */
  post: boolean;
}

export interface HomeSpaceComparison {
  supported: true;
  country: 'AU';
  currency: 'AUD';
  /** Years of use, day-accurate, split at 30 June 2027. Periods that overlap no income year count nothing. */
  use: { byYear: UseYearsByIncomeYear[]; pre: number; post: number; total: number; firstUse: string; lastUse: string };
  /** Average occupancy a year that a place of business adds over the use (your share): deduction amounts ÷ years. */
  occupancyPerYear: number;
  /** Occupancy deductions a place of business adds (amounts), split at 30 June 2027. */
  deductionAmounts: { pre: number; post: number; total: number };
  /** Their tax value (amount × marginal rate). */
  deductions: { pre: number; post: number; total: number };
  /** Tax value of running costs over the use — the same either way, so it never moves the verdict. */
  runningTaxValue: number;
  cgt: {
    /** CGT the verdict counts: on growth to 30 June 2027, or the whole gain for an earlier sale. */
    counted: number;
    /** CGT on the rest of the gain at today's rules — for scale only; the rules from 1 July 2027 differ. */
    laterAtTodaysRules: number;
    /** CGT on the whole gain at today's rules. */
    wholeAtTodaysRules: number;
    /** An estimate of the later CGT under the rules from 1 July 2027, when the values it needs are given. */
    laterAtNewRules: null | {
      gain: number;
      tax: number;
      /** (1 + CPI) ^ (quarters ÷ 4) from the cost base's quarter to the sale's. */
      indexFactor: number;
      /** The rate the gain was taxed at: max(marginal rate, the 30% minimum). */
      ratePct: number;
      /** The CPI figure assumed, with its source and review date. */
      cpi: SourcedFigure;
      assumption: string;
    };
    discountApplies: boolean;
    /** How the gain to 30 June 2027 was measured. */
    basis: 'whole gain — sale before 1 July 2027' | 'even growth by day to 30 June 2027' | 'valuations supplied' | 'renting — no gain';
  };
  /** Growth at which the whole-use deductions equal the whole-gain CGT at today's rules. Null when there is no gain to weigh. */
  breakEvenGrowth: number | null;
  /** Sale on or after 1 July 2027 (and not renting): only growth to 30 June 2027 is under the current rules. */
  partial: boolean;
  /** Partial, with no use before 1 July 2027: nothing falls under known rules, so it cannot be weighed yet. */
  notYet: boolean;
  renting: boolean;
  assumptions: { marginalRatePct: number; note: string; growth: string };
  notes: DecisionNote[];
  rules: Array<HomePropertyRule & { key: HomePropertyRuleKey }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const LAST_DISCOUNT_DAY = addDays(AU_CGT_REGIME_2027_FROM, -1);
const FIRST_POST_2027_INCOME_YEAR = 2027;
const cents = (n: number) => Math.round(n * 100) / 100;
const DAY_MS = 86_400_000;
const dayNo = (ymd: string) => parseYmd(ymd) / DAY_MS;
const incomeYearOf = (ymd: string) => {
  const y = Number(ymd.slice(0, 4));
  return Number(ymd.slice(5, 7)) >= 7 ? y : y - 1;
};
const label = (y: number) => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
const quarterOf = (ymd: string) => Number(ymd.slice(0, 4)) * 4 + Math.floor((Number(ymd.slice(5, 7)) - 1) / 3);

function rulesFor(notes: DecisionNote[]): Array<HomePropertyRule & { key: HomePropertyRuleKey }> {
  return [...new Set(notes.map((n) => n.rule))].map((key) => ({ key, ...AU_HOME_PROPERTY_RULES[key] }));
}

/** The periods to weigh: `usePeriods`, or the single period the flat fields describe. */
function periodsOf(input: HomeSpaceComparisonInput): HomeSpaceUsePeriod[] {
  if (Array.isArray(input.usePeriods)) return input.usePeriods;
  return [{ start: input.businessUseStart as string, end: input.businessUseEnd ?? input.saleDate, sharePct: input.businessSharePct as number }];
}

// ─── Validation ─────────────────────────────────────────────────────────────

/** Every problem with a homeSpaceComparison input; empty when it can be computed. Does not throw. */
export function validateHomeSpaceComparison(input: HomeSpaceComparisonInput): DecisionInputProblem[] {
  const p = new Problems();
  if (!input || typeof input !== 'object') return [{ field: 'input', message: 'expected an object' }];
  p.percent(input.marginalRatePct, 'marginalRatePct');
  if (input.ownershipPct !== undefined) p.percent(input.ownershipPct, 'ownershipPct');
  p.amount(input.occupancyCostsPerYear, 'occupancyCostsPerYear');
  if (input.runningCostsPerYear !== undefined) p.amount(input.runningCostsPerYear, 'runningCostsPerYear');
  p.amount(input.expectedGrowth, 'expectedGrowth');
  const sale = p.date(input.saleDate, 'saleDate');

  if (input.usePeriods !== undefined) {
    if (input.businessUseStart !== undefined || input.businessSharePct !== undefined || input.businessUseEnd !== undefined) {
      p.add('usePeriods', 'give usePeriods, or businessSharePct with businessUseStart — not both');
    }
    if (!Array.isArray(input.usePeriods) || input.usePeriods.length === 0) {
      p.add('usePeriods', 'expected at least one period');
    } else {
      const ok: HomeSpaceUsePeriod[] = [];
      input.usePeriods.forEach((u, i) => {
        const f = (k: string) => `usePeriods[${i}].${k}`;
        if (!u || typeof u !== 'object') {
          p.add(`usePeriods[${i}]`, 'expected an object');
          return;
        }
        const s = p.date(u.start, f('start'));
        const e = p.date(u.end, f('end'));
        const sh = p.percent(u.sharePct, f('sharePct'));
        if (s && e && p.order(u.start, u.end, f('start'), f('end')) && sh) {
          if (sale && u.end > input.saleDate) p.add(f('end'), `must be on or before saleDate (${input.saleDate}), got ${u.end}`);
          else ok.push(u);
        }
      });
      const sorted = [...ok].sort((a, b) => a.start.localeCompare(b.start));
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].start <= sorted[i - 1].end) p.add('usePeriods', `periods overlap: ${sorted[i - 1].start}–${sorted[i - 1].end} and ${sorted[i].start}–${sorted[i].end}`);
      }
    }
  } else {
    p.percent(input.businessSharePct, 'businessSharePct');
    const start = p.date(input.businessUseStart, 'businessUseStart');
    if (start && sale) p.order(input.businessUseStart as string, input.saleDate, 'businessUseStart', 'saleDate');
    if (input.businessUseEnd !== undefined && p.date(input.businessUseEnd, 'businessUseEnd') && start && sale) {
      p.order(input.businessUseStart as string, input.businessUseEnd, 'businessUseStart', 'businessUseEnd');
      if (input.businessUseEnd > input.saleDate) p.add('businessUseEnd', `must be on or before saleDate (${input.saleDate}), got ${input.businessUseEnd}`);
    }
  }

  if (input.homeValueAtFirstUse !== undefined) p.amount(input.homeValueAtFirstUse, 'homeValueAtFirstUse');
  if (input.valueAt30June2027 !== undefined) {
    p.amount(input.valueAt30June2027, 'valueAt30June2027');
    if (input.homeValueAtFirstUse === undefined) p.add('homeValueAtFirstUse', 'give it with valueAt30June2027, or neither');
  }
  return p.list;
}

// ─── The comparison ─────────────────────────────────────────────────────────

/**
 * What a place of business adds and what it costs at sale, over the same days. See the file comment for the rules;
 * `recommendHomeSpace` turns the result into a verdict.
 */
export function homeSpaceComparison(input: HomeSpaceComparisonInput): HomeSpaceComparison | UnsupportedCountry {
  const country = (input?.country ?? 'AU').toUpperCase();
  if (country !== 'AU') return unsupported(country);
  const problems = validateHomeSpaceComparison(input);
  if (problems.length) throw new DecisionInputError(problems);

  const marginal = Number(input.marginalRatePct) / 100;
  const ownership = Number(input.ownershipPct ?? 100) / 100;
  const occupancy = Number(input.occupancyCostsPerYear);
  const running = Number(input.runningCostsPerYear ?? 0);
  const renting = input.renting === true;
  const runsIt = input.ownerRunsBusiness ?? true;
  const growth = renting ? 0 : Number(input.expectedGrowth);
  const sale = input.saleDate;
  const periods = periodsOf(input)
    .map((u) => ({ start: u.start, end: u.end, share: Number(u.sharePct) / 100 }))
    .sort((a, b) => a.start.localeCompare(b.start));
  const firstUse = periods[0].start;
  const lastUse = periods.reduce((m, u) => maxYmd(m, u.end), periods[0].end);

  // Years of use by income year, day-accurate. `fraction` counts days (for the "N years of use" label);
  // `weighted` counts share × days, which is what the deductions scale with.
  const byYear: UseYearsByIncomeYear[] = [];
  let pre = 0;
  let post = 0;
  let wPre = 0;
  let wPost = 0;
  for (let y = incomeYearOf(firstUse); y <= incomeYearOf(lastUse); y++) {
    const ys = `${y}-07-01`;
    const ye = `${y + 1}-06-30`;
    const inYear = dayNo(ye) - dayNo(ys) + 1;
    let days = 0;
    let weighted = 0;
    for (const u of periods) {
      const d = overlapDays(u.start, u.end, ys, ye);
      days += d;
      weighted += (d * u.share) / inYear;
    }
    const fraction = days / inYear;
    const isPost = y >= FIRST_POST_2027_INCOME_YEAR;
    byYear.push({ label: label(y), fraction, days, post: isPost });
    if (isPost) {
      post += fraction;
      wPost += weighted;
    } else {
      pre += fraction;
      wPre += weighted;
    }
  }
  const total = pre + post;

  const amounts = runsIt ? { pre: occupancy * wPre, post: occupancy * wPost, total: occupancy * (wPre + wPost) } : { pre: 0, post: 0, total: 0 };
  const deductions = { pre: amounts.pre * marginal, post: amounts.post * marginal, total: amounts.total * marginal };

  const partial = !renting && sale >= AU_CGT_REGIME_2027_FROM;
  const notYet = partial && pre === 0;

  // CGT. The gain runs from first business use (the market-value reset at first income use); the non-exempt share
  // is Σ share × days used ÷ days from first use to the sale (the ATO's floor area × days steps).
  const totalDays = daysInclusive(firstUse, sale);
  const shareDays = periods.reduce((n, u) => n + u.share * daysInclusive(u.start, u.end), 0);
  const shareDaysPre = periods.reduce((n, u) => n + u.share * overlapDays(u.start, u.end, firstUse, LAST_DISCOUNT_DAY), 0);
  const taxableFraction = runsIt && !renting ? (ownership * shareDays) / totalDays : 0;
  const discountApplies = heldAtLeast12Months(firstUse, sale);
  const discountFactor = discountApplies ? 1 - AU_HOME_SPACE_FIGURES.cgtDiscount.value : 1;
  const wholeGain = Math.max(0, growth) * taxableFraction;
  const wholeTax = wholeGain * discountFactor * marginal;

  const hasValues = input.homeValueAtFirstUse !== undefined;
  const startsBefore = firstUse < AU_CGT_REGIME_2027_FROM;
  let preGain: number;
  let basis: HomeSpaceComparison['cgt']['basis'];
  if (renting) {
    preGain = 0;
    basis = 'renting — no gain';
  } else if (!partial) {
    preGain = wholeGain;
    basis = 'whole gain — sale before 1 July 2027';
  } else if (hasValues && input.valueAt30June2027 !== undefined && startsBefore) {
    const preDays = daysInclusive(firstUse, LAST_DISCOUNT_DAY);
    const valueGain = Number(input.valueAt30June2027) - Number(input.homeValueAtFirstUse);
    preGain = runsIt ? (Math.max(0, valueGain) * ownership * shareDaysPre) / preDays : 0;
    basis = 'valuations supplied';
  } else {
    preGain = runsIt ? (Math.max(0, growth) * ownership * shareDaysPre) / totalDays : 0;
    basis = 'even growth by day to 30 June 2027';
  }
  const counted = preGain * discountFactor * marginal;

  // The later period under the rules from 1 July 2027 — an estimate, only with the values it needs.
  let laterAtNewRules: HomeSpaceComparison['cgt']['laterAtNewRules'] = null;
  if (partial && runsIt && hasValues && (!startsBefore || input.valueAt30June2027 !== undefined)) {
    const v0 = Number(input.homeValueAtFirstUse);
    const costBase = startsBefore ? Number(input.valueAt30June2027) : v0;
    const indexFrom = startsBefore ? AU_CGT_REGIME_2027_FROM : firstUse;
    const cpi = AU_HOME_SPACE_FIGURES.cpiAssumption;
    const quarters = Math.max(0, quarterOf(sale) - quarterOf(indexFrom));
    const indexFactor = (1 + cpi.value) ** (quarters / 4);
    const postFrom = maxYmd(firstUse, AU_CGT_REGIME_2027_FROM);
    const postDays = daysInclusive(postFrom, sale);
    const shareDaysPost = periods.reduce((n, u) => n + u.share * overlapDays(u.start, u.end, postFrom, sale), 0);
    const fraction = postDays > 0 ? (ownership * shareDaysPost) / postDays : 0;
    const gain = Math.max(0, v0 + Math.max(0, growth) - costBase * indexFactor) * fraction;
    const rate = Math.max(marginal, AU_HOME_SPACE_FIGURES.minimumTaxRate.value);
    laterAtNewRules = {
      gain: cents(gain),
      tax: cents(gain * rate),
      indexFactor: Math.round(indexFactor * 10_000) / 10_000,
      ratePct: Math.round(rate * 10_000) / 100,
      cpi,
      assumption:
        `An estimate: the cost base (${startsBefore ? 'the value just before 1 July 2027' : 'the value when business use began'}) ` +
        `indexed at an assumed ${cpi.value * 100}% CPI a year from the ${startsBefore ? 'September 2027' : 'first'} quarter to the ` +
        `sale's, no discount, taxed at your marginal rate but at least ${AU_HOME_SPACE_FIGURES.minimumTaxRate.value * 100}%. ` +
        'The real CPI figures are not yet known.',
    };
  }

  const breakEven = taxableFraction * discountFactor * marginal > 0 ? deductions.total / (taxableFraction * discountFactor * marginal) : null;

  const notes: DecisionNote[] = [
    note('runningExpensesAnyWorkArea', 'Running costs are claimable from a desk or shared room as well as from a place of business, so they do not change the answer.'),
    note('occupancyOnlyPlaceOfBusiness', 'Occupancy costs are claimable only if the area is a genuine place of business.'),
    note('occupancyByFloorAreaAndTime', 'Occupancy is apportioned by floor area and by the days in each income year the area was used.'),
  ];
  if (!runsIt) notes.push(note('coOwnerNotInBusiness', 'You do not run the business, so you claim no occupancy costs and keep the full main residence exemption on your share.'));
  if (runsIt && !renting) {
    notes.push(
      note('partialExemptionFollowsInterest', 'As a place of business, the same share of the home loses the main residence exemption, whether or not you claim.'),
      note('homeFirstUsedToProduceIncome', "The taxable gain is measured from the home's value when business use started."),
      discountApplies
        ? note('cgtDiscount', 'Held at least 12 months from first business use, so the 50% discount applies to the gain to 30 June 2027.')
        : note('noDiscountWithin12MonthsOfFirstUse', 'Sold within 12 months of first business use, so no CGT discount.'),
    );
    if (partial) {
      notes.push(
        note(
          'cgtFrom1July2027',
          basis === 'valuations supplied'
            ? 'The sale is on or after 1 July 2027: the verdict weighs deductions and CGT to 30 June 2027, splitting the gain by the values you gave (the law\'s default, market value just before 1 July 2027).'
            : 'The sale is on or after 1 July 2027: the verdict weighs deductions and CGT to 30 June 2027. Without the home\'s values, the gain to then assumes even growth by day — an assumption; the law uses the market value just before 1 July 2027, and the draft apportioning method compounds daily.',
        ),
        note('minimumTax30', 'A 30% minimum tax may apply to gains accruing after 1 July 2027, unless an exception in Division 119 applies.'),
      );
    }
    notes.push(note('smallBusinessConcessionsRare', 'The small business CGT concessions will rarely apply to a home used mainly as a home.'));
  }
  notes.push(note('personalServicesIncome', 'If your income is personal services income, some occupancy costs may not be deductible.'));

  return {
    supported: true,
    country: 'AU',
    currency: 'AUD',
    use: {
      byYear: byYear.map((b) => ({ ...b, fraction: Math.round(b.fraction * 10_000) / 10_000 })),
      pre: Math.round(pre * 10_000) / 10_000,
      post: Math.round(post * 10_000) / 10_000,
      total: Math.round(total * 10_000) / 10_000,
      firstUse,
      lastUse: minYmd(lastUse, sale),
    },
    occupancyPerYear: cents(total > 0 ? amounts.total / total : 0),
    deductionAmounts: { pre: cents(amounts.pre), post: cents(amounts.post), total: cents(amounts.total) },
    deductions: { pre: cents(deductions.pre), post: cents(deductions.post), total: cents(deductions.total) },
    runningTaxValue: cents(running * total * marginal),
    cgt: {
      counted: cents(counted),
      laterAtTodaysRules: cents(partial ? Math.max(0, wholeTax - counted) : 0),
      wholeAtTodaysRules: cents(wholeTax),
      laterAtNewRules,
      discountApplies,
      basis,
    },
    breakEvenGrowth: renting || breakEven === null ? null : Math.round(breakEven),
    partial,
    notYet,
    renting,
    assumptions: {
      marginalRatePct: Number(input.marginalRatePct),
      note: `Every tax figure is the amount × ${Number(input.marginalRatePct)}%, the marginal rate you gave, applied flat — not a bracket calculation.`,
      growth:
        basis === 'even growth by day to 30 June 2027'
          ? 'Growth is assumed to accrue evenly by day (straight line). The law values the home just before 1 July 2027; give the values for that split.'
          : 'Growth is assumed to accrue evenly by day between the dates given.',
    },
    notes,
    rules: rulesFor(notes),
  };
}

// ─── The verdict ────────────────────────────────────────────────────────────

/** "About even" when the gap is within 5% of the larger side… */
export const HOME_SPACE_EVEN_SHARE = 0.05;
/** …or under 100 in the input currency. */
export const HOME_SPACE_EVEN_FLOOR = 100;

export function isAboutEven(net: number, deductionsValue: number, cgt: number): boolean {
  return Math.abs(net) < Math.max(HOME_SPACE_EVEN_SHARE * Math.max(Math.abs(deductionsValue), Math.abs(cgt)), HOME_SPACE_EVEN_FLOOR);
}

export type HomeSpaceVerdict = 'placeOfBusiness' | 'desk' | 'even' | 'dependsOnLater' | 'notYet';
/** Better is shown green with the word "better", worse red with the word "worse", neutral otherwise — never colour alone. */
export type HomeSpaceTone = 'better' | 'worse' | 'neutral';

export interface HomeSpaceRecommendation {
  verdict: HomeSpaceVerdict;
  tones: { placeOfBusiness: HomeSpaceTone; desk: HomeSpaceTone };
  /** |net|, in the comparison's currency, rounded to whole units. */
  amount: number;
  /** Deductions' tax value − CGT, over the period weighed. Positive favours a place of business. */
  net: number;
  /** What was weighed: the whole use, or the years to 30 June 2027. */
  weighed: { scope: 'wholePeriod' | 'toJune2027'; deductions: number; cgt: number };
  /** Partial or not yet: the later period, and which CGT figure was used for it. */
  later: null | { deductions: number; cgt: number; net: number; basis: 'todaysRules' | 'newRulesEstimate' };
  breakEvenGrowth: number | null;
  partial: boolean;
  renting: boolean;
  currency: string;
}

type ComparisonLike = Pick<HomeSpaceComparison, 'deductions' | 'breakEvenGrowth' | 'partial' | 'notYet' | 'renting'> & {
  currency: string;
  cgt: Pick<HomeSpaceComparison['cgt'], 'counted' | 'laterAtTodaysRules' | 'wholeAtTodaysRules'> & { laterAtNewRules: { tax: number } | null };
};

const round = (n: number) => Math.round(n);

/**
 * The verdict, like with like. A sale before 1 July 2027 (or renting): all deductions against all CGT. A later sale
 * with use before then: deductions to 30 June 2027 against CGT on growth to then, and the later period checked
 * separately — if it points the same way the verdict stands; if not, it depends on growth after June 2027. Use that
 * starts on or after 1 July 2027 cannot be weighed under known numbers: `notYet`, with the later figures.
 */
export function recommendHomeSpace(c: ComparisonLike): HomeSpaceRecommendation {
  const d = c.deductions;
  const counted = c.cgt.counted;
  const newRules = c.cgt.laterAtNewRules;
  const laterCgt = newRules ? newRules.tax : c.cgt.laterAtTodaysRules;
  const laterBasis = newRules ? ('newRulesEstimate' as const) : ('todaysRules' as const);
  const neutral = { placeOfBusiness: 'neutral', desk: 'neutral' } as const;
  const base = { breakEvenGrowth: c.renting ? null : c.breakEvenGrowth, partial: c.partial, renting: c.renting, currency: c.currency };

  if (c.partial && c.notYet) {
    const cgt = newRules ? newRules.tax : c.cgt.wholeAtTodaysRules;
    return {
      ...base,
      verdict: 'notYet',
      tones: neutral,
      amount: 0,
      net: 0,
      weighed: { scope: 'toJune2027', deductions: 0, cgt: 0 },
      later: { deductions: round(d.total), cgt: round(cgt), net: round(d.total - cgt), basis: laterBasis },
    };
  }

  const dedCounted = c.partial ? d.pre : d.total;
  const net = dedCounted - counted;
  const amount = round(Math.abs(net));
  const evenNow = isAboutEven(net, dedCounted, counted);
  const weighed = { scope: c.partial ? ('toJune2027' as const) : ('wholePeriod' as const), deductions: round(dedCounted), cgt: round(counted) };
  const pick = (pob: boolean) =>
    pob ? ({ placeOfBusiness: 'better', desk: 'worse' } as const) : ({ placeOfBusiness: 'worse', desk: 'better' } as const);

  if (c.partial) {
    const netLater = d.post - laterCgt;
    const total = net + netLater;
    const evenTotal = isAboutEven(total, d.total, counted + laterCgt);
    const later = { deductions: round(d.post), cgt: round(laterCgt), net: round(netLater), basis: laterBasis };
    if (!evenNow && !evenTotal && Math.sign(net) === Math.sign(total)) {
      return { ...base, verdict: net > 0 ? 'placeOfBusiness' : 'desk', tones: pick(net > 0), amount, net: round(net), weighed, later };
    }
    return { ...base, verdict: evenNow && evenTotal ? 'even' : 'dependsOnLater', tones: neutral, amount, net: round(net), weighed, later };
  }

  if (evenNow) return { ...base, verdict: 'even', tones: neutral, amount, net: round(net), weighed, later: null };
  return { ...base, verdict: net > 0 ? 'placeOfBusiness' : 'desk', tones: pick(net > 0), amount, net: round(net), weighed, later: null };
}
