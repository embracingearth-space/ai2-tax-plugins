/**
 * Years → dated decision inputs — ai2fin.com
 *
 * The decisions (./homeProperty) take DATED inputs: when business use began,
 * when a home was sold. A "Weigh it up" screen asks only for a number of
 * years. This module is the one mapping between the two, moved here from the
 * app's adapter (client/src/utils/homeDecisions.ts) so the app, the website
 * and the Tax MCP date a scenario the same way:
 *
 *  - Business space: the claim covers `years` whole income years from the
 *    current Australian income year. Business use runs from 1 July of that
 *    year; the home is taken to be sold on 30 June at the end of the last one.
 *  - Moving out: you move out today, into a home you settle on today, and both
 *    are sold `years` later (same day, clamped to the month end). If the old
 *    home earns income while you are away, it is rented from today. A
 *    part-owner's gain is their share of the whole home's growth.
 *  - Someone else lives here: letting starts today and the home is sold
 *    `years` later. The costs given are YOUR share of the whole home's costs;
 *    the decision takes whole-home costs and applies the ownership share
 *    itself, so they are grossed back up here.
 *
 * `today` is an input (a Date read by its LOCAL calendar day, or
 * 'YYYY-MM-DD'), never the clock, so a scenario is reproducible.
 *
 * Each function returns `{ input, problems }`: the dated input, and every
 * problem the matching validate…() finds in it (plus any the mapping itself
 * finds, e.g. a fractional number of years). Call the decision only when
 * `problems` is empty.
 */

import {
  validateHomeBusinessSpace,
  validateMainResidenceChoice,
  validateRoomOrPartnerArrangement,
  type HomeBusinessSpaceInput,
  type LodgerArrangementInput,
  type MainResidenceChoiceInput,
} from './homeProperty';
import type { DecisionInputProblem } from './inputGuards';
import { parseYmd } from './dates';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** A local calendar day as YYYY-MM-DD. A string must already be a real calendar day; anything else throws a RangeError. */
export function dayOf(today: Date | string): string {
  if (typeof today === 'string') {
    parseYmd(today, 'today');
    return today;
  }
  if (!(today instanceof Date) || Number.isNaN(today.getTime())) throw new RangeError('today: expected a valid Date or a YYYY-MM-DD day');
  return `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
}

/** The same day `years` later, clamped to the month's end (29 Feb → 28 Feb). */
export function addYears(day: string, years: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const last = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  return `${y + years}-${pad2(m)}-${pad2(Math.min(d, last))}`;
}

/** The first calendar year of the Australian income year a day falls in (1 July to 30 June). */
export function auIncomeYearStartOf(day: string): number {
  const [y, m] = day.split('-').map(Number);
  return m >= 7 ? y : y - 1;
}

export interface Scenario<I> {
  input: I;
  problems: DecisionInputProblem[];
}

/** Whole years the decisions can date; anything else is reported, never rounded. */
function yearsProblem(years: number): DecisionInputProblem[] {
  const y = Number(years);
  return Number.isInteger(y) && y >= 1 && y <= 50 ? [] : [{ field: 'years', message: `expected a whole number of years from 1 to 50, got ${JSON.stringify(years)}` }];
}

/** Years to DATE with: the years given when valid, else 1 — so a bad `years` is reported once, not again as a reversed date. */
const datingYears = (years: number) => (yearsProblem(years).length ? 1 : Number(years));

/** Keep the first problem per field: the mapping's own check and the validator can both report `years`. */
function merge(...lists: DecisionInputProblem[][]): DecisionInputProblem[] {
  const seen = new Set<string>();
  return lists.flat().filter((p) => (seen.has(p.field) ? false : (seen.add(p.field), true)));
}

// ─── Business space ─────────────────────────────────────────────────────────

export interface SpaceScenarioInput {
  country?: string;
  years: number;
  businessSharePct: number;
  occupancyCostsPerYear: number;
  expectedGrowth: number;
  marginalRatePct: number;
  /** The home is co-owned. When false (the default) your share is taken as 100%. */
  coOwned?: boolean;
  /** Your share of the home, percent — used when `coOwned` is true. */
  ownershipPct?: number;
  /** Running costs are claimable either way, so they never change the comparison; default 0. */
  runningCostsPerYear?: number;
  /** Alternatively, hours worked from home and a cost per hour. */
  workHoursPerYear?: number;
  runningCostPerHour?: number;
}

export function spaceScenario(s: SpaceScenarioInput, today: Date | string): Scenario<HomeBusinessSpaceInput> {
  const day = dayOf(today);
  const start = auIncomeYearStartOf(day);
  const years = Number(s.years);
  const byHours = s.workHoursPerYear !== undefined || s.runningCostPerHour !== undefined;
  const input: HomeBusinessSpaceInput = {
    country: s.country ?? 'AU',
    incomeYear: `${start}-${pad2((start + 1) % 100)}`,
    businessSharePct: s.businessSharePct,
    occupancyCostsPerYear: s.occupancyCostsPerYear,
    ...(byHours
      ? { workHoursPerYear: s.workHoursPerYear, runningCostPerHour: s.runningCostPerHour }
      : { runningCostsPerYear: s.runningCostsPerYear ?? 0 }),
    years,
    expectedGrowth: s.expectedGrowth,
    marginalRatePct: s.marginalRatePct,
    // The website asks "co-owned?" first; a share only counts when the answer is yes.
    ownershipPct: s.coOwned ? s.ownershipPct ?? 100 : s.ownershipPct !== undefined && s.coOwned === undefined ? s.ownershipPct : 100,
    businessUseStart: `${start}-07-01`,
    // 30 June at the end of the last income year claimed.
    saleDate: `${start + datingYears(years)}-06-30`,
  };
  return { input, problems: merge(yearsProblem(s.years), validateHomeBusinessSpace(input)) };
}

// ─── Moving out ─────────────────────────────────────────────────────────────

export interface MovingHome {
  name: string;
  /** Growth in the whole home's value over the years. */
  growth: number;
  ownershipPct?: number;
}

export interface MovingScenarioInput {
  country?: string;
  years: number;
  marginalRatePct: number;
  leaving: MovingHome & { producesIncome?: boolean };
  moving: MovingHome;
}

export function movingScenario(s: MovingScenarioInput, today: Date | string): Scenario<MainResidenceChoiceInput> {
  const from = dayOf(today);
  const years = Number(s.years);
  const sale = addYears(from, datingYears(years));
  // The decision's result is for one owner, and its maths is linear in growth, so a part-owner's share is applied to the growth.
  const share = (h: MovingHome) => Math.min(100, Math.max(0, h.ownershipPct ?? 100)) / 100;
  const input: MainResidenceChoiceInput = {
    country: s.country ?? 'AU',
    homes: [
      {
        name: s.leaving.name,
        ownedFrom: from,
        movedOut: from,
        expectedGrowth: s.leaving.growth * share(s.leaving),
        ...(s.leaving.producesIncome ? { rentedFrom: from } : {}),
      },
      { name: s.moving.name, ownedFrom: from, expectedGrowth: s.moving.growth * share(s.moving) },
    ],
    saleDates: { [s.leaving.name]: sale, [s.moving.name]: sale },
    marginalRatePct: s.marginalRatePct,
  };
  return { input, problems: merge(yearsProblem(s.years), validateMainResidenceChoice(input)) };
}

// ─── Someone else lives here ────────────────────────────────────────────────

export interface LodgerScenarioInput {
  country?: string;
  years: number;
  marginalRatePct: number;
  weeklyRent: number;
  /**
   * The let share of the home, percent. Or give areas: `roomM2` (theirs alone), `commonM2` (shared, counts half)
   * and `wholeHomeM2` — the share is (room + common ÷ 2) ÷ whole home, as on the website.
   */
  letSharePct?: number;
  roomM2?: number;
  commonM2?: number;
  wholeHomeM2?: number;
  /** YOUR share of the whole home's yearly costs (the app's field). Give this or `wholeHomeCostsPerYear`. */
  homeCostsPerYear?: number;
  /** The WHOLE home's yearly costs (the website's field). */
  wholeHomeCostsPerYear?: number;
  ownershipPct?: number;
  weeksLetPerYear?: number;
  expectedGrowth: number;
}

export function lodgerScenario(s: LodgerScenarioInput, today: Date | string): Scenario<LodgerArrangementInput> {
  const firstLetDate = dayOf(today);
  const years = Number(s.years);
  const ownershipPct = Math.min(100, Math.max(0, s.ownershipPct ?? 100));
  const problems: DecisionInputProblem[] = [];
  if (ownershipPct <= 0) problems.push({ field: 'ownershipPct', message: 'must be above 0 — with no share of the home there is nothing to let' });

  // The let share: given, or from areas.
  let letSharePct = s.letSharePct;
  if (letSharePct === undefined) {
    const [room, common, whole] = [Number(s.roomM2 ?? NaN), Number(s.commonM2 ?? 0), Number(s.wholeHomeM2 ?? NaN)];
    if (!Number.isFinite(room) || room < 0) problems.push({ field: 'roomM2', message: "expected their room's area in m², zero or more (or give letSharePct)" });
    if (!Number.isFinite(common) || common < 0) problems.push({ field: 'commonM2', message: 'expected the shared area in m², zero or more' });
    if (!Number.isFinite(whole) || whole <= 0) problems.push({ field: 'wholeHomeM2', message: "expected the whole home's area in m², above zero" });
    else if (room + common > whole) problems.push({ field: 'roomM2', message: `their room and the shared areas (${room + common} m²) exceed the whole home (${whole} m²)` });
    letSharePct = Number.isFinite(room) && Number.isFinite(whole) && whole > 0 ? ((room + (Number.isFinite(common) ? common : 0) / 2) / whole) * 100 : NaN;
  }

  // Costs: the whole home's as given, or your share grossed back up (the decision applies the ownership share itself).
  let homeCosts: number;
  if (s.wholeHomeCostsPerYear !== undefined && s.homeCostsPerYear !== undefined) {
    problems.push({ field: 'homeCostsPerYear', message: "give your share of the costs or the whole home's, not both" });
    homeCosts = NaN;
  } else if (s.wholeHomeCostsPerYear !== undefined) homeCosts = s.wholeHomeCostsPerYear;
  else if (s.homeCostsPerYear !== undefined) homeCosts = ownershipPct > 0 ? (s.homeCostsPerYear * 100) / ownershipPct : s.homeCostsPerYear;
  else {
    problems.push({ field: 'homeCostsPerYear', message: 'required: your share of the costs, or wholeHomeCostsPerYear' });
    homeCosts = NaN;
  }

  const input: LodgerArrangementInput = {
    country: s.country ?? 'AU',
    kind: 'lodger',
    weeklyRent: s.weeklyRent,
    letSharePct,
    homeCostsPerYear: homeCosts,
    ...(s.weeksLetPerYear !== undefined ? { weeksLetPerYear: s.weeksLetPerYear } : {}),
    marginalRatePct: s.marginalRatePct,
    years,
    ownershipPct,
    firstLetDate,
    saleDate: addYears(firstLetDate, datingYears(years)),
    expectedGrowth: s.expectedGrowth,
  };
  return { input, problems: merge(yearsProblem(s.years), problems, validateRoomOrPartnerArrangement(input)) };
}
