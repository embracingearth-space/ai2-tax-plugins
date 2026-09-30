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
 * CGT FROM 1 JULY 2027 IS LAW, AND ONLY HALF OF IT IS COMPUTABLE TODAY. The
 * Treasury Laws Amendment (Tax Reform No. 1) Act 2026 generally replaces the
 * 50% discount with cost-base indexation (for a resident who held the asset
 * 12 months) and a possible 30% minimum tax for gains accruing
 * after 1 July 2027. The gain to 30 June 2027 keeps the discount, so every
 * CGT figure is split: `preJuly2027` carries current-law figures for the gain
 * to 30 June 2027, and `postJuly2027` is `{ computable: false, note }`. The
 * asset is taken to be sold just before 1 July 2027 at market value
 * (s 112-155(3)(a)) or, by choice, under an apportioning method the MINISTER
 * determines by legislative instrument (s 112-185). No instrument has been
 * made — only a Treasury exposure draft, which grows value at a compounding
 * daily rate — and indexation needs CPI figures that do not exist yet, so the
 * later portion is never computed here as law. (An estimate, with its CPI
 * assumption stated, is in ./homeSpaceComparison.)
 *
 * THE "EVEN GROWTH BY DAY" SPLIT IS AN ASSUMPTION, NOT THE LAW'S METHOD. With
 * no valuations, the gain to 30 June 2027 is the whole gain × days to then ÷
 * all days (straight line). The law's default is a market valuation just
 * before 1 July 2027; the draft apportioning method compounds daily, which
 * puts less of a rising home's growth before 1 July 2027 than a straight line
 * does. Supply the two valuations for the law's default.
 *
 * MONEY: results are in the input currency, rounded to cents. Gains are
 * assumed to accrue EVENLY BY DAY between the dates given; the ATO's own
 * apportionment is by days, so with even growth the "home first used to
 * produce income" market-value reset gives the same answer as apportioning
 * the whole gain by days. Supply real valuations where you have them.
 */

import { getPluginInfo } from '../registry';
import { AU_CGT_INDEXATION_FROM } from '../countries/australiaIncomeTax';
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
import { DecisionInputError, MAX_HOURS_PER_YEAR, MAX_WEEKS_PER_YEAR, Problems, type DecisionInputProblem } from './inputGuards';
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

/**
 * The rate every tax figure in a result was multiplied by, stated so a UI can show it beside the figures. The
 * functions apply ONE flat marginal rate to every dollar of deduction and gain; they do not work out brackets,
 * and a gain large enough to cross a bracket is taxed at the rate given.
 */
export interface MarginalRateAssumption {
  marginalRatePct: number;
  note: string;
}

const marginalAssumption = (pctGiven: number): MarginalRateAssumption => ({
  marginalRatePct: Number(pctGiven),
  note:
    `Every tax figure here is the amount × ${Number(pctGiven)}%, the marginal rate you gave, applied flat. It is ` +
    'not a bracket calculation: include the Medicare levy in the rate if you want it counted, and use a higher rate ' +
    'if a large gain would push you into the next bracket.',
});

export { DecisionInputError, MAX_HOURS_PER_YEAR, MAX_WEEKS_PER_YEAR };
export type { DecisionInputProblem };

/**
 * 1 July 2027 — gains accruing from this day are taxed under the Tax Reform No. 1 Act (indexation, a possible
 * 30% minimum). Defined once, in the AU income tax plugin, as AU_CGT_INDEXATION_FROM; re-exported here under
 * this name so the decisions API reads naturally without a second copy of the date.
 */
export const AU_CGT_REGIME_2027_FROM = AU_CGT_INDEXATION_FROM;
/** The last day whose gain keeps the 50% discount for a CGT event on or after 1 July 2027. */
const LAST_DISCOUNT_DAY = addDays(AU_CGT_REGIME_2027_FROM, -1);
const DISCOUNT = 0.5;

const cents = (n: number) => Math.round(n * 100) / 100;
const pct = (n: number, field: string, { max = 100 } = {}) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0 || v > max) throw new RangeError(`${field}: expected a percentage from 0 to ${max}, got ${n}`);
  return v / 100;
};
const money = (n: number, field: string) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) throw new RangeError(`${field}: expected a non-negative number, got ${n}`);
  return v;
};

export function unsupported(country: string): UnsupportedCountry {
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

// ─── The 1 July 2027 split ──────────────────────────────────────────────────

/** Current-law CGT on the gain that accrued to 30 June 2027 (or the whole gain, for an earlier sale). */
export interface PreJuly2027Cgt {
  /** Your taxable share of the gain in this portion, before the discount. */
  gain: number;
  discountApplies: boolean;
  /** After the 50% discount, where it applies. */
  taxableGain: number;
  tax: number;
  /** How the portion was measured. */
  basis: 'whole gain — sale before 1 July 2027' | 'even growth by day to 30 June 2027' | 'valuations supplied';
}

export type PostJuly2027Cgt =
  | { applies: false; note: string }
  | { applies: true; computable: false; note: string };

const POST_JULY_2027_NOTE =
  'Gains accruing after 1 July 2027 are taxed under the Treasury Laws Amendment (Tax Reform No. 1) Act 2026. The ' +
  '50% discount generally stops; the cost base may be indexed for inflation instead if you are an Australian ' +
  'resident and held the asset at least 12 months (s 110-36(1A), Division 114); and a 30% minimum tax may apply ' +
  '(Division 119 — not for a qualifying new dwelling or affordable housing, or if you received certain support ' +
  'payments such as the age pension). The Act takes the home ' +
  'to be sold just before 1 July 2027 at market value and reacquired on that day, or, by choice, valued under an ' +
  'apportioning method the Minister determines (s 112-155, s 112-185); that method is not yet made (only an ' +
  'exposure draft), and indexation depends on CPI figures not yet released. This portion is therefore not ' +
  'computed as law — only the gain to 30 June 2027 is, under the current rules.';

function postJuly2027(saleDate: string): PostJuly2027Cgt {
  return saleDate < AU_CGT_REGIME_2027_FROM
    ? { applies: false, note: 'The sale is before 1 July 2027, so the current rules (the 50% discount) apply to the whole gain.' }
    : { applies: true, computable: false, note: POST_JULY_2027_NOTE };
}

/** The 2027 notes every CGT result carries when the sale is on or after 1 July 2027. */
function notes2027(saleDate: string): DecisionNote[] {
  return saleDate < AU_CGT_REGIME_2027_FROM
    ? []
    : [
        note('cgtFrom1July2027', 'The sale is on or after 1 July 2027: only the gain to 30 June 2027 is worked out here, under the current rules. The rest is not computed.'),
        note('minimumTax30', 'A 30% minimum tax may apply to gains accruing after 1 July 2027, unless an exception in Division 119 applies.'),
      ];
}

// ─── Validation ─────────────────────────────────────────────────────────────

/** Every problem with a homeBusinessSpaceTradeoff input; empty when it can be computed. Does not throw. */
export function validateHomeBusinessSpace(input: HomeBusinessSpaceInput): DecisionInputProblem[] {
  const p = new Problems();
  if (!input || typeof input !== 'object') return [{ field: 'input', message: 'expected an object' }];
  if (typeof input.incomeYear !== 'string' || !/^(\d{4})[-\u2013](\d{2})$/.test(input.incomeYear) ||
      Number(input.incomeYear.slice(5)) !== (Number(input.incomeYear.slice(0, 4)) + 1) % 100) {
    p.add('incomeYear', `expected an income year like "2025-26", got ${JSON.stringify(input.incomeYear)}`);
  }
  p.percent(input.businessSharePct, 'businessSharePct');
  p.percent(input.marginalRatePct, 'marginalRatePct');
  if (input.ownershipPct !== undefined) p.percent(input.ownershipPct, 'ownershipPct');
  p.amount(input.occupancyCostsPerYear, 'occupancyCostsPerYear');
  p.amount(input.expectedGrowth, 'expectedGrowth');
  p.years(input.years, 'years');

  const hoursGiven = input.workHoursPerYear !== undefined || input.runningCostPerHour !== undefined;
  if (input.runningCostsPerYear !== undefined && hoursGiven) {
    p.add('runningCostsPerYear', 'give running costs per year, or work hours with a cost per hour — not both');
  } else if (input.runningCostsPerYear !== undefined) {
    p.amount(input.runningCostsPerYear, 'runningCostsPerYear');
  } else if (hoursGiven) {
    p.number(input.workHoursPerYear, 'workHoursPerYear', { min: 0, max: MAX_HOURS_PER_YEAR, what: 'hours from 0 to 8,760 (the hours in a year)' });
    p.amount(input.runningCostPerHour, 'runningCostPerHour');
  } else {
    p.add('runningCostsPerYear', 'required, or give workHoursPerYear with runningCostPerHour');
  }

  const start = p.date(input.businessUseStart, 'businessUseStart');
  const sale = p.date(input.saleDate, 'saleDate');
  if (start && sale) p.order(input.businessUseStart, input.saleDate, 'businessUseStart', 'saleDate');
  if (input.businessUseEnd !== undefined && p.date(input.businessUseEnd, 'businessUseEnd') && start && sale) {
    p.order(input.businessUseStart, input.businessUseEnd, 'businessUseStart', 'businessUseEnd');
    if (input.businessUseEnd > input.saleDate) p.add('businessUseEnd', `must be on or before saleDate (${input.saleDate}), got ${input.businessUseEnd}`);
  }
  if ((input.homeValueAtFirstUse === undefined) !== (input.valueAt30June2027 === undefined)) {
    p.add('homeValueAtFirstUse', 'give both or neither of homeValueAtFirstUse and valueAt30June2027');
  } else if (input.homeValueAtFirstUse !== undefined) {
    p.amount(input.homeValueAtFirstUse, 'homeValueAtFirstUse');
    p.amount(input.valueAt30June2027, 'valueAt30June2027');
  }
  return p.list;
}

/** Every problem with a mainResidenceChoice input; empty when it can be computed. Does not throw. */
export function validateMainResidenceChoice(input: MainResidenceChoiceInput): DecisionInputProblem[] {
  const p = new Problems();
  if (!input || typeof input !== 'object') return [{ field: 'input', message: 'expected an object' }];
  p.percent(input.marginalRatePct, 'marginalRatePct');
  if (!Array.isArray(input.homes) || input.homes.length !== 2) {
    p.add('homes', 'expected exactly two homes — the former one and the new one');
    return p.list;
  }
  const withMoveOut = input.homes.filter((h) => h && h.movedOut !== undefined).length;
  if (withMoveOut !== 1) p.add('homes', 'exactly one home must have movedOut (the former home)');
  if (input.homes[0]?.name === input.homes[1]?.name) p.add('homes', `the two homes need different names, both are "${input.homes[0]?.name}"`);
  input.homes.forEach((h, i) => {
    const f = (k: string) => `homes[${i}].${k}`;
    if (!h || typeof h !== 'object') {
      p.add(`homes[${i}]`, 'expected an object');
      return;
    }
    if (typeof h.name !== 'string' || !h.name.trim()) p.add(f('name'), 'expected a name');
    p.amount(h.expectedGrowth, f('expectedGrowth'));
    const owned = p.date(h.ownedFrom, f('ownedFrom'));
    const saleDate = input.saleDates?.[h.name];
    const sold = p.date(saleDate, `saleDates.${h.name}`);
    if (owned && sold) p.order(h.ownedFrom, saleDate as string, f('ownedFrom'), `saleDates.${h.name}`);
    if (h.movedOut !== undefined && p.date(h.movedOut, f('movedOut')) && owned && sold) {
      p.order(h.ownedFrom, h.movedOut, f('ownedFrom'), f('movedOut'));
      if (h.movedOut > (saleDate as string)) p.add(f('movedOut'), `must be on or before its sale (${saleDate}), got ${h.movedOut}`);
      if (h.rentedFrom !== undefined && p.date(h.rentedFrom, f('rentedFrom'))) {
        p.order(h.movedOut, h.rentedFrom, f('movedOut'), f('rentedFrom'));
        if (h.rentedFrom > (saleDate as string)) p.add(f('rentedFrom'), `must be on or before its sale (${saleDate}), got ${h.rentedFrom}`);
      }
    } else if (h.movedOut === undefined && h.rentedFrom !== undefined) {
      p.add(f('rentedFrom'), 'only the former home (the one with movedOut) can be rented after moving out');
    }
  });
  return p.list;
}

/** Every problem with a roomOrPartnerArrangement input; empty when it can be computed. Does not throw. */
export function validateRoomOrPartnerArrangement(input: DomesticArrangementInput | LodgerArrangementInput): DecisionInputProblem[] {
  const p = new Problems();
  if (!input || typeof input !== 'object') return [{ field: 'input', message: 'expected an object' }];
  if (input.kind === 'domestic') return p.list;
  if (input.kind !== 'lodger') return [{ field: 'kind', message: `expected 'domestic' or 'lodger', got ${JSON.stringify((input as { kind: unknown }).kind)}` }];
  p.amount(input.weeklyRent, 'weeklyRent');
  if (input.weeksLetPerYear !== undefined) {
    p.number(input.weeksLetPerYear, 'weeksLetPerYear', { min: 0, max: MAX_WEEKS_PER_YEAR, what: 'weeks from 0 to 52' });
  }
  p.amount(input.homeCostsPerYear, 'homeCostsPerYear');
  p.percent(input.marginalRatePct, 'marginalRatePct');
  if (input.ownershipPct !== undefined) p.percent(input.ownershipPct, 'ownershipPct');
  if (input.years !== undefined) p.years(input.years, 'years');
  p.amount(input.expectedGrowth, 'expectedGrowth');
  if (input.letSharePct !== undefined) p.percent(input.letSharePct, 'letSharePct');
  else if (input.exclusivePct !== undefined) {
    const ok = p.percent(input.exclusivePct, 'exclusivePct') && (input.sharedPct === undefined || p.percent(input.sharedPct, 'sharedPct'));
    const byOk = input.sharedBy === undefined || p.number(input.sharedBy, 'sharedBy', { min: 1, integer: true, what: 'a whole number of people, at least 1' });
    if (ok && byOk && Number(input.exclusivePct) + Number(input.sharedPct ?? 0) / Number(input.sharedBy ?? 2) > 100) {
      p.add('exclusivePct', 'exclusivePct + sharedPct ÷ sharedBy exceeds 100%');
    }
  } else p.add('letSharePct', 'required, or give exclusivePct (and sharedPct)');
  const first = p.date(input.firstLetDate, 'firstLetDate');
  const sale = p.date(input.saleDate, 'saleDate');
  if (first && sale) p.order(input.firstLetDate, input.saleDate, 'firstLetDate', 'saleDate');
  if (input.letEndDate !== undefined && p.date(input.letEndDate, 'letEndDate') && first && sale) {
    p.order(input.firstLetDate, input.letEndDate, 'firstLetDate', 'letEndDate');
    if (input.letEndDate > input.saleDate) p.add('letEndDate', `must be on or before saleDate (${input.saleDate}), got ${input.letEndDate}`);
  }
  return p.list;
}

const assertValid = (problems: DecisionInputProblem[]) => {
  if (problems.length) throw new DecisionInputError(problems);
};

// ─── 1. Desk or shared room vs place of business ────────────────────────────

export interface HomeBusinessSpaceInput {
  /** ISO country code; anything but AU is unsupported. Default 'AU'. */
  country?: string;
  /** The first income year the claim covers, e.g. '2025-26'. */
  incomeYear: string;
  /** Floor area set aside as a place of business, percent of the home. */
  businessSharePct: number;
  /** Whole-home occupancy costs you pay each year: interest or rent, rates, land tax, insurance. */
  occupancyCostsPerYear: number;
  /**
   * The business portion of running costs each year — claimable either way. Give this, or
   * `workHoursPerYear` with `runningCostPerHour` (e.g. the ATO fixed rate), not both.
   */
  runningCostsPerYear?: number;
  /** Hours worked from home in a year, 0 to 8,760. With `runningCostPerHour`, running costs = hours × rate. */
  workHoursPerYear?: number;
  /** Running costs per work hour (AUD), e.g. 0.70 — see workFromHomeFixedRate. */
  runningCostPerHour?: number;
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
  /**
   * Optional valuations for a sale on or after 1 July 2027: the whole home's value when business use began and
   * just before 1 July 2027. Both or neither; without them the gain to 30 June 2027 assumes even growth by day.
   */
  homeValueAtFirstUse?: number;
  valueAt30June2027?: number;
}

export interface SpaceOption {
  deductionsPerYear: number;
  deductionsTotal: number;
  /** Deductions × marginal rate. */
  taxValue: number;
  /** Current-law CGT on the business share — the whole gain (see `cgt.currentLaw.appliesToThisSale`). */
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
    /** The whole gain under the 50% discount rules. The law for a sale before 1 July 2027; a comparison after it. */
    currentLaw: { businessShareGain: number; discountApplies: boolean; taxableGain: number; tax: number; appliesToThisSale: boolean };
    /** Current-law figures for the gain to 30 June 2027 (the whole gain, for an earlier sale). */
    preJuly2027: PreJuly2027Cgt;
    postJuly2027: PostJuly2027Cgt;
  };
  /**
   * Place of business minus desk: extra deduction value less CGT. Positive favours a place of business.
   * `complete` is false for a sale on or after 1 July 2027, where the CGT on the later gain is not computed.
   */
  net: { currentLaw: number; complete: boolean };
  /** Growth at which the extra deductions exactly pay for the CGT under the current rules. Above it, the desk wins. */
  breakEvenGrowth: { currentLaw: number | null };
  /** The flat marginal rate every tax figure uses, and how running costs were arrived at. */
  assumptions: MarginalRateAssumption & { runningCosts: { perYear: number; basis: 'given' | 'hours × rate'; workHoursPerYear?: number; runningCostPerHour?: number } };
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
  // Refuse impossible input before any arithmetic (see ./inputGuards).
  assertValid(validateHomeBusinessSpace(input));

  const share = pct(input.businessSharePct, 'businessSharePct');
  const ownership = pct(input.ownershipPct ?? 100, 'ownershipPct');
  const marginal = pct(input.marginalRatePct, 'marginalRatePct');
  const occupancy = money(input.occupancyCostsPerYear, 'occupancyCostsPerYear');
  const byHours = input.runningCostsPerYear === undefined;
  const running = byHours
    ? money(input.workHoursPerYear as number, 'workHoursPerYear') * money(input.runningCostPerHour as number, 'runningCostPerHour')
    : money(input.runningCostsPerYear as number, 'runningCostsPerYear');
  const assumptions: HomeBusinessSpaceResult['assumptions'] = {
    ...marginalAssumption(input.marginalRatePct),
    runningCosts: byHours
      ? { perYear: cents(running), basis: 'hours × rate', workHoursPerYear: Number(input.workHoursPerYear), runningCostPerHour: Number(input.runningCostPerHour) }
      : { perYear: cents(running), basis: 'given' },
  };
  const growth = money(input.expectedGrowth, 'expectedGrowth');
  const years = Number(input.years);
  if (!Number.isInteger(years) || years < 1 || years > 50) throw new RangeError(`years: expected a whole number from 1 to 50, got ${input.years}`);
  parseYmd(input.businessUseStart, 'businessUseStart');
  parseYmd(input.saleDate, 'saleDate');
  if (input.saleDate < input.businessUseStart) throw new RangeError('saleDate: must be on or after businessUseStart');
  const useEnd = input.businessUseEnd ?? input.saleDate;
  parseYmd(useEnd, 'businessUseEnd');
  if (useEnd < input.businessUseStart || useEnd > input.saleDate) throw new RangeError('businessUseEnd: must fall between businessUseStart and saleDate');
  if ((input.homeValueAtFirstUse === undefined) !== (input.valueAt30June2027 === undefined)) {
    throw new RangeError('homeValueAtFirstUse and valueAt30June2027: give both or neither');
  }

  const incomeYears: string[] = [];
  // Normalise an en-dash label ('2023–24') to the hyphen form every label in the package uses.
  const firstStart = incomeYearStart(input.incomeYear);
  const firstLabel = `${firstStart}-${String((firstStart + 1) % 100).padStart(2, '0')}`;
  for (let y = firstLabel, i = 0; i < years; i++, y = nextIncomeYearLabel(y)) incomeYears.push(y);

  const runsIt = input.ownerRunsBusiness ?? true;
  const notes: DecisionNote[] = [
    note('runningExpensesAnyWorkArea', 'Running costs are claimable from a desk or shared room as well as from a place of business.'),
    note('occupancyOnlyPlaceOfBusiness', 'Occupancy costs are claimable only if the area is a genuine place of business.'),
    note('occupancyByFloorAreaAndTime', `Occupancy is apportioned by floor area: ${cents(share * 100)}% here.`),
  ];
  const beforeRegime = input.saleDate < AU_CGT_REGIME_2027_FROM;

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
        currentLaw: { businessShareGain: 0, discountApplies: false, taxableGain: 0, tax: 0, appliesToThisSale: beforeRegime },
        preJuly2027: { gain: 0, discountApplies: false, taxableGain: 0, tax: 0, basis: beforeRegime ? 'whole gain — sale before 1 July 2027' : 'even growth by day to 30 June 2027' },
        postJuly2027: { applies: false, note: 'Your share stays fully exempt, so there is no gain to tax under either set of rules.' },
      },
      net: { currentLaw: 0, complete: true },
      breakEvenGrowth: { currentLaw: null },
      assumptions,
      notes,
      rules: rulesFor(notes),
    };
  }

  // Deductions. Occupancy costs are those you pay; the business share of them is deductible.
  const extraPerYear = occupancy * share;
  const extraTotal = extraPerYear * years;
  const extraTaxValue = extraTotal * marginal;

  // CGT under the discount rules. The gain runs from first business use (the first-use rule resets the cost
  // base to market value then); if use stopped before the sale, the days factor applies (ATO steps 1 to 6).
  const totalDays = daysInclusive(input.businessUseStart, input.saleDate);
  const useDays = daysInclusive(input.businessUseStart, useEnd);
  const taxableFraction = ownership * share * (useDays / totalDays);
  const businessShareGain = Math.max(0, growth) * taxableFraction;
  const discountApplies = heldAtLeast12Months(input.businessUseStart, input.saleDate);
  const discountFactor = discountApplies ? DISCOUNT : 1;
  const cgtTax = businessShareGain * discountFactor * marginal;

  // The gain to 30 June 2027: the whole gain for an earlier sale; otherwise the business-use days up to then.
  let preGain: number;
  let basis: PreJuly2027Cgt['basis'];
  if (beforeRegime) {
    preGain = businessShareGain;
    basis = 'whole gain — sale before 1 July 2027';
  } else if (input.homeValueAtFirstUse !== undefined && input.valueAt30June2027 !== undefined) {
    // The deemed sale at 30 June 2027, by the same steps: value gain × share × ownership × (days used ÷ days).
    const preDays = input.businessUseStart <= LAST_DISCOUNT_DAY ? daysInclusive(input.businessUseStart, LAST_DISCOUNT_DAY) : 0;
    const usedPre = overlapDays(input.businessUseStart, useEnd, input.businessUseStart, LAST_DISCOUNT_DAY);
    const valueGain = money(input.valueAt30June2027, 'valueAt30June2027') - money(input.homeValueAtFirstUse, 'homeValueAtFirstUse');
    preGain = preDays > 0 ? Math.max(0, valueGain) * ownership * share * (usedPre / preDays) : 0;
    basis = 'valuations supplied';
  } else {
    const usedPre = overlapDays(input.businessUseStart, useEnd, input.businessUseStart, LAST_DISCOUNT_DAY);
    preGain = (Math.max(0, growth) * ownership * share * usedPre) / totalDays;
    basis = 'even growth by day to 30 June 2027';
  }
  const preTaxable = preGain * discountFactor;

  notes.push(
    note('partialExemptionFollowsInterest', 'As a place of business, the same share of the home loses the main residence exemption.'),
    note('homeFirstUsedToProduceIncome', 'The taxable gain is measured from the home\'s value when business use started.'),
  );
  if (useDays !== totalDays) notes.push(note('floorAreaAndDaysApportionment', 'Business use stopped before the sale, so the gain is apportioned by days used.'));
  if (ownership < 1) notes.push(note('coOwnerNotInBusiness', 'A co-owner who does not run the business keeps the full exemption on their share.'));
  notes.push(
    discountApplies
      ? note('cgtDiscount', 'Held at least 12 months from first business use, so the 50% discount applies under the current rules.')
      : note('noDiscountWithin12MonthsOfFirstUse', 'Sold within 12 months of first business use, so no CGT discount.'),
  );
  notes.push(note('personalServicesIncome', 'If your income is personal services income, some occupancy costs may not be deductible.'));
  notes.push(note('smallBusinessConcessionsRare', 'The small business CGT concessions will rarely apply to a home used mainly as a home.'));
  notes.push(...notes2027(input.saleDate));

  const breakEven = taxableFraction * discountFactor * marginal > 0 ? extraTaxValue / (taxableFraction * discountFactor * marginal) : null;

  const pob = running + extraPerYear;
  return {
    supported: true,
    country: 'AU',
    incomeYears,
    options: {
      deskOrSharedRoom: {
        deductionsPerYear: cents(running),
        deductionsTotal: cents(running * years),
        taxValue: cents(running * years * marginal),
        cgtCurrentLaw: 0,
        net: cents(running * years * marginal),
      },
      placeOfBusiness: {
        deductionsPerYear: cents(pob),
        deductionsTotal: cents(pob * years),
        taxValue: cents(pob * years * marginal),
        cgtCurrentLaw: cents(cgtTax),
        net: cents(pob * years * marginal - cgtTax),
      },
    },
    extraDeductions: { perYear: cents(extraPerYear), total: cents(extraTotal), taxValue: cents(extraTaxValue) },
    cgt: {
      currentLaw: {
        businessShareGain: cents(businessShareGain),
        discountApplies,
        taxableGain: cents(businessShareGain * discountFactor),
        tax: cents(cgtTax),
        appliesToThisSale: beforeRegime,
      },
      preJuly2027: { gain: cents(preGain), discountApplies, taxableGain: cents(preTaxable), tax: cents(preTaxable * marginal), basis },
      postJuly2027: postJuly2027(input.saleDate),
    },
    net: { currentLaw: cents(extraTaxValue - cgtTax), complete: beforeRegime },
    breakEvenGrowth: { currentLaw: breakEven === null ? null : Math.round(breakEven) },
    assumptions,
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
  /** Whole taxable gain, before the discount. */
  taxableGain: number;
  discountApplies: boolean;
  /** Current-law tax on the whole taxable gain (the law for a sale before 1 July 2027). */
  tax: number;
  /** Current-law figures for the part of the taxable gain that accrued to 30 June 2027. */
  preJuly2027: PreJuly2027Cgt;
  postJuly2027: PostJuly2027Cgt;
}

export interface MainResidenceOption {
  /** The home treated as the main residence while you owned both. */
  nominated: string;
  homes: HomeOutcome[];
  /** Sum of the current-law tax on both homes. */
  totalTax: number;
  /** Sum of the current-law tax on the gain to 30 June 2027. */
  totalTaxPreJuly2027: number;
}

export interface MainResidenceChoiceResult {
  supported: true;
  country: 'AU';
  /** Days you owned both homes after the new one was bought. */
  overlap: { from: string; to: string; days: number };
  /** Days at the end of the overlap when both are exempt under the moving-house rule (0 where it does not apply). */
  movingHouseDays: number;
  options: MainResidenceOption[];
  /**
   * The option with less current-law tax, and how much less. `complete` is false when either sale is on or
   * after 1 July 2027: the tax on gains after 30 June 2027 is not computed, and could change the answer.
   */
  better: { nominated: string; saving: number; complete: boolean };
  /** The flat marginal rate every tax figure uses. */
  assumptions: MarginalRateAssumption;
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

/** An inclusive span of taxable days. */
type Span = { from: string; to: string };
const spanDays = (spans: Span[]) => spans.reduce((n, s) => n + (s.to < s.from ? 0 : daysInclusive(s.from, s.to)), 0);
const spanDaysTo = (spans: Span[], last: string) =>
  spans.reduce((n, s) => n + (s.to < s.from ? 0 : overlapDays(s.from, s.to, s.from, last)), 0);

/**
 * Which home's exemption should cover the period you owned both? Compares the
 * two pure choices over the overlap: the former home kept as your main
 * residence under the absence rule (the new home taxable meanwhile), or the
 * new home (the former home taxable from when you bought it). You may split
 * the overlap between them; this compares the two ends.
 */
export function mainResidenceChoice(input: MainResidenceChoiceInput): MainResidenceChoiceResult | UnsupportedCountry {
  if (!isAu(input.country)) return unsupported(input.country as string);
  assertValid(validateMainResidenceChoice(input));
  if (!Array.isArray(input.homes) || input.homes.length !== 2) throw new RangeError('homes: expected exactly two homes — the former one and the new one');
  const former = input.homes.find((h) => h.movedOut !== undefined);
  const next = input.homes.find((h) => h.movedOut === undefined);
  if (!former || !next) throw new RangeError('homes: exactly one home must have movedOut (the former home)');
  // Sale dates are keyed by name, so two homes with one name would silently share a sale date.
  if (former.name === next.name) throw new RangeError(`homes: the two homes need different names, both are "${former.name}"`);
  const marginal = pct(input.marginalRatePct, 'marginalRatePct');

  const saleOf = (h: HomeTimeline) => {
    const s = input.saleDates?.[h.name];
    parseYmd(s, `saleDates.${h.name}`);
    if (s < h.ownedFrom) throw new RangeError(`saleDates.${h.name}: before ownedFrom`);
    return s;
  };
  for (const h of input.homes) {
    parseYmd(h.ownedFrom, `${h.name}.ownedFrom`);
    money(h.expectedGrowth, `${h.name}.expectedGrowth`);
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

  // Moving-house rule: for up to 6 months before the old home is disposed of, both are exempt, if you lived in
  // it for a continuous 3 months in the 12 months before disposal and it earned no income in those 12 months.
  const yearBefore = addMonths(saleF, -12);
  const livedLast12 = overlapDays(former.ownedFrom, movedOut, yearBefore, saleF);
  const threeMonths = daysInclusive(yearBefore, addDays(addMonths(yearBefore, 3), -1));
  const rentedLast12 = former.rentedFrom !== undefined && overlapDays(former.rentedFrom, saleF, yearBefore, saleF) > 0;
  const movingRuleMet = overlap > 0 && saleF <= saleN && livedLast12 >= threeMonths && !rentedLast12;
  // The ATO's Jeneen and John example: sold 1 October 2025, both exempt "1 April 2025 to 1 October 2025".
  const movingFrom = addMonths(saleF, -6);
  const movingHouseDays = movingRuleMet ? overlapDays(overlapFrom, overlapTo, movingFrom, saleF) : 0;
  // The overlap days one home loses: the overlap, less the moving-house days at its end.
  const contested: Span = { from: overlapFrom, to: movingRuleMet ? minYmd(overlapTo, addDays(movingFrom, -1)) : overlapTo };

  // Income-producing days beyond 6 years in the absence, as a span ending on `absenceEnd`.
  const beyondSix = (absenceEnd: string): Span[] => {
    if (!former.rentedFrom || former.rentedFrom > absenceEnd) return [];
    const firstTaxable = addDays(addMonths(former.rentedFrom, 72), 1);
    return firstTaxable <= absenceEnd ? [{ from: firstTaxable, to: absenceEnd }] : [];
  };

  const outcome = (h: HomeTimeline, sale: string, taxable: Span[], firstIncomeUse: string | null): HomeOutcome => {
    const ownedDays = daysInclusive(h.ownedFrom, sale);
    const g = Math.max(0, h.expectedGrowth);
    const taxableDays = spanDays(taxable);
    const taxableGain = ownedDays > 0 ? (g * taxableDays) / ownedDays : 0;
    // The first-use rule resets the acquisition date only if the home was fully exempt until income use began —
    // i.e. every taxable day falls on or after it. If some taxable days come earlier (the home was not your main
    // residence while vacant), the rule does not apply ("claimed the exemption for another property for the
    // period"), and the 12-month test runs from the original acquisition.
    const firstUseApplies = firstIncomeUse !== null && taxableDays > 0 && taxable.every((s) => s.to < s.from || s.from >= firstIncomeUse);
    const acquired = firstUseApplies ? (firstIncomeUse as string) : h.ownedFrom;
    const discountApplies = heldAtLeast12Months(acquired, sale);
    const factor = discountApplies ? DISCOUNT : 1;
    const beforeRegime = sale < AU_CGT_REGIME_2027_FROM;
    const preGain = beforeRegime ? taxableGain : ownedDays > 0 ? (g * spanDaysTo(taxable, LAST_DISCOUNT_DAY)) / ownedDays : 0;
    return {
      name: h.name,
      ownedDays,
      taxableDays,
      exemptGain: cents(g - taxableGain),
      taxableGain: cents(taxableGain),
      discountApplies,
      tax: cents(taxableGain * factor * marginal),
      preJuly2027: {
        gain: cents(preGain),
        discountApplies,
        taxableGain: cents(preGain * factor),
        tax: cents(preGain * factor * marginal),
        basis: beforeRegime ? 'whole gain — sale before 1 July 2027' : 'even growth by day to 30 June 2027',
      },
      postJuly2027: postJuly2027(sale),
    };
  };

  // Option 1: the former home stays the main residence for as long as the absence rule allows; the new home is
  // taxable for that part of the overlap. Once a rented former home passes its 6 years it is no longer being
  // treated as your main residence, so the new home can be from the next day (the ATO's James example).
  const formerCoverEnds = former.rentedFrom ? addMonths(former.rentedFrom, 72) : contested.to;
  const newTaxable: Span = { from: contested.from, to: minYmd(contested.to, formerCoverEnds) };
  const keepFormer: MainResidenceOption = {
    nominated: former.name,
    homes: [outcome(former, saleF, beyondSix(saleF), former.rentedFrom ?? null), outcome(next, saleN, [newTaxable], null)],
    totalTax: 0,
    totalTaxPreJuly2027: 0,
  };
  // Option 2: the new home from the day it was acquired; the former home is taxable for the overlap, plus any
  // income-producing absence days beyond 6 years before it.
  // Clamped to the former home's sale: with no overlap (the new home bought after the old one was sold) the day
  // before the new purchase can fall after that sale, and the span must not count days the home was not owned.
  const preOverlapEnd = minYmd(addDays(overlapFrom, -1), saleF);
  // If the new home is sold first, the former home is still owned after the overlap. Nominating the new home ended
  // the absence choice for the former ("You can choose when to stop the period covered by your choice" — ATO,
  // Treating former home as main residence), so its days after the overlap are taxable too, not only those beyond
  // the 6-year limit. This result does not model moving back in.
  const postOverlap: Span[] = overlap > 0 && overlapTo < saleF ? [{ from: addDays(overlapTo, 1), to: saleF }] : [];
  const takeNew: MainResidenceOption = {
    nominated: next.name,
    homes: [
      outcome(
        former,
        saleF,
        [...(preOverlapEnd >= movedOut ? beyondSix(preOverlapEnd) : []), contested, ...postOverlap],
        former.rentedFrom ?? null,
      ),
      outcome(next, saleN, [], null),
    ],
    totalTax: 0,
    totalTaxPreJuly2027: 0,
  };
  for (const o of [keepFormer, takeNew]) {
    o.totalTax = cents(o.homes.reduce((s, h) => s + h.tax, 0));
    o.totalTaxPreJuly2027 = cents(o.homes.reduce((s, h) => s + h.preJuly2027.tax, 0));
  }

  const better = keepFormer.totalTax <= takeNew.totalTax ? keepFormer : takeNew;
  const other = better === keepFormer ? takeNew : keepFormer;
  const lastSale = maxYmd(saleF, saleN);

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
    ...notes2027(lastSale),
  ];

  return {
    supported: true,
    country: 'AU',
    overlap: { from: overlapFrom, to: overlapTo, days: overlap },
    movingHouseDays,
    options: [keepFormer, takeNew],
    better: { nominated: better.nominated, saving: cents(other.totalTax - better.totalTax), complete: lastSale < AU_CGT_REGIME_2027_FROM },
    assumptions: marginalAssumption(input.marginalRatePct),
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
  cgt: {
    /** The whole gain under the 50% discount rules. The law for a sale before 1 July 2027; a comparison after it. */
    taxableGain: number;
    discountApplies: boolean;
    netGain: number;
    tax: number;
    appliesToThisSale: boolean;
    preJuly2027: PreJuly2027Cgt;
    postJuly2027: PostJuly2027Cgt;
  };
  mainResidenceExemption: 'partial';
  /** The flat marginal rate every tax figure uses. */
  assumptions: MarginalRateAssumption;
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
  assertValid(validateRoomOrPartnerArrangement(input));

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
  if (!Number.isFinite(weeks) || weeks < 0 || weeks > MAX_WEEKS_PER_YEAR) throw new RangeError(`weeksLetPerYear: expected 0 to 52, got ${input.weeksLetPerYear}`);
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
  const growth = money(input.expectedGrowth, 'expectedGrowth');

  // Income tax, per year. The rent is your share's if you co-own; so are the costs you bear.
  const rent = rentWeekly * weeks * ownership;
  const deductions = costs * share * (weeks / 52) * ownership;
  const net = rent - deductions;
  const tax = net * marginal;

  // CGT: the ATO's steps 1 to 6 — gain from first letting × let share × (days let ÷ days from first letting to sale).
  const totalDays = daysInclusive(input.firstLetDate, input.saleDate);
  const letDays = daysInclusive(input.firstLetDate, letEnd);
  const perDay = (Math.max(0, growth) * share * ownership) / totalDays;
  const taxableGain = perDay * letDays;
  const discountApplies = heldAtLeast12Months(input.firstLetDate, input.saleDate);
  const factor = discountApplies ? DISCOUNT : 1;
  const beforeRegime = input.saleDate < AU_CGT_REGIME_2027_FROM;
  const preGain = beforeRegime ? taxableGain : perDay * overlapDays(input.firstLetDate, letEnd, input.firstLetDate, LAST_DISCOUNT_DAY);

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
  notes.push(...notes2027(input.saleDate));

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
      netGain: cents(taxableGain * factor),
      tax: cents(taxableGain * factor * marginal),
      appliesToThisSale: beforeRegime,
      preJuly2027: {
        gain: cents(preGain),
        discountApplies,
        taxableGain: cents(preGain * factor),
        tax: cents(preGain * factor * marginal),
        basis: beforeRegime ? 'whole gain — sale before 1 July 2027' : 'even growth by day to 30 June 2027',
      },
      postJuly2027: postJuly2027(input.saleDate),
    },
    mainResidenceExemption: 'partial',
    assumptions: marginalAssumption(input.marginalRatePct),
    notes,
    rules: rulesFor(notes),
  };
}
