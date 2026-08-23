/**
 * Depreciation (capital allowances) — @ai2/tax-plugins
 * ai2fin.com
 *
 * A depreciation schedule is arithmetic over one income year: an opening
 * adjustable value, a rate, the days the asset was held, and a decline in
 * value that reduces the adjustable value carried into the next year. The
 * arithmetic is the same shape everywhere; only the rates, the effective lives
 * and the write-off concessions are jurisdictional, which is why they live
 * behind `DepreciationRules` and are supplied by a country plugin.
 *
 * The formulas below are the ATO's own, from "Prime cost (straight line) and
 * diminishing value methods" (last updated 27 June 2025):
 *
 *   Prime cost        = cost       x (days held / denominator) x (100% / effective life)
 *   Diminishing value = base value x (days held / denominator) x (200% / effective life)
 *
 * with 150% instead of 200% where the asset started to be held before
 * 10 May 2006. `base value` is the opening adjustable value for the income
 * year: cost plus second-element costs, less the decline in value up to the
 * end of the prior year.
 *
 * THREE THINGS THAT ARE EASY TO GET WRONG, SO THEY ARE PARAMETERS, NOT CONSTANTS:
 *
 * 1. `daysInYear` is the DENOMINATOR the jurisdiction prescribes, passed in and
 *    never assumed — and it is NOT always the number of days in the income year.
 *    The ATO's published formula fixes the denominator at 365 while stating that
 *    "days held can be 366 for a leap year", so in a leap year a full-year hold
 *    legitimately yields 366/365 of a year's decline. Callers pass what their
 *    authority prescribes; nothing here clamps the fraction to 1. Dividing by
 *    366 in a leap year instead shortens every leap-year claim by about a
 *    quarter of a percent — small per asset, systematic across a register.
 *    A jurisdiction whose denominator is fixed does not merely document it: it
 *    APPLIES it inside its own `declineInValue` and overrides whatever the
 *    caller passed, because trusting every caller to have read a comment is not
 *    enforcement. See `AU_DEPRECIATION_RULES.declineInValue`.
 * 2. Private use does NOT reduce the base value carried forward. The decline in
 *    value is computed on the full base and only the taxable-use portion is
 *    deductible, which is why a schedule carries separate "decline in value"
 *    and "deductible" columns. This module returns the decline; applying the
 *    taxable-use percentage is the caller's job (and `balancingAdjustment` is
 *    the one place the percentage is applied here, because the ATO applies it
 *    to the disposal amount itself).
 * 3. `secondElementCostThisYear` is the improvement (second element of cost)
 *    incurred DURING this income year. The ATO's base value is the asset's cost
 *    in the year it is first used, and in every later year the opening
 *    adjustable value PLUS second-element costs incurred that year — so a
 *    $5,000 opening value improved by $1,000 declines from $6,000, not $5,000.
 *    A host that seeds year one from cost gets year one right without it.
 *
 *    IT IS MODELLED FOR DIMINISHING VALUE ONLY, AND THE OTHER METHODS REFUSE IT
 *    RATHER THAN QUIETLY IGNORING IT, because each needs something this module
 *    is not told:
 *      • PRIME COST — the ATO recalculates from the opening adjustable value
 *        plus the second-element cost over the asset's REMAINING effective
 *        life, and nothing here can tell a remaining life from a full one.
 *        Do that recalculation in the host and call this with
 *        `cost: openingAdjustableValue + secondElementCostThisYear` and
 *        `effectiveLifeYears: <remaining life>`; the arithmetic here is then
 *        exactly the ATO's.
 *      • POOL — a second-element cost is allocated to the pool in its own
 *        right and attracts the allocation-year rate while the rest of the
 *        balance attracts the ongoing rate. That is two rates in one year, so
 *        it is two calls, not one.
 *      • IMMEDIATE WRITE-OFF — a later improvement is its own write-off
 *        decision, tested against the threshold for the year it was incurred.
 *
 * The decline is clamped at the base value: an asset cannot
 * depreciate below zero, and an uncapped diminishing-value or immediate
 * write-off calculation on a nearly-written-off asset otherwise produces a
 * negative closing value that quietly becomes income next year.
 */

import type { TaxFilingPlugin } from './types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type DepreciationMethod =
  | 'prime_cost'
  | 'diminishing_value'
  | 'immediate_writeoff'
  | 'pool';

/**
 * How a jurisdiction models depreciation. The four are NOT the same model
 * wearing different rates, and pretending they are is how a product ships a
 * wrong number with a confident face:
 *
 *   effective_life    — a life in years becomes a rate (AU: 100%/200% ÷ life),
 *                       apportioned by DAYS held, claimed per asset.
 *   rate_per_asset    — the authority publishes a rate per asset (NZ: IR265),
 *                       apportioned by whole MONTHS, claimed per asset.
 *   pooled_allowance  — the POOL is the unit, not the asset (UK: main/special
 *                       rate pools, writing down allowance on the pool balance).
 *   class_cca         — the CLASS is the unit (CA: capital cost allowance on
 *                       the undepreciated capital cost of each class).
 *   generic           — no country-specific rules are loaded.
 *
 * A host branches on this: AU/NZ print a per-asset schedule; UK/CA print a
 * pool/class statement. Only `effective_life`, `rate_per_asset` and `generic`
 * are implemented today.
 */
export type DepreciationRegime =
  | 'effective_life'
  | 'rate_per_asset'
  | 'pooled_allowance'
  | 'class_cca'
  | 'generic';

/**
 * The part of the year an asset was used, in the unit the jurisdiction
 * apportions by. Days is the ATO's convention; whole months is Inland
 * Revenue's ("count part-months as whole months"), so `monthsUsed` must be a
 * whole number from 0 to 12 — the engine refuses a fraction of a month rather
 * than quietly computing something no authority publishes.
 */
export type PartYearInput =
  | { kind: 'days'; daysHeld: number; daysInYear: number }
  | { kind: 'months'; monthsUsed: number };

/** Column labels for a schedule, in the authority's own words. */
export interface DepreciationVocabulary {
  /** The thing being depreciated — "Depreciating asset" (ATO), "Asset" (IRD). */
  asset: string;
  /** The year's amount — "Decline in value" (ATO), "Depreciation" (IRD). */
  decline: string;
  /** The carried value — "Adjustable value" (ATO), "Adjusted tax value" (IRD), "Written down value" (HMRC). */
  writtenDown: string;
  /** The rate column. */
  rate: string;
  /** What the rate is derived from — "Effective life" (ATO), "Estimated useful life" (IRD), "Pool" (HMRC), "Class" (CRA). */
  rateBasis: string;
}

/**
 * The per-country copy a host renders at the top of its assets page. It is
 * content, not layout: the plugin says what depreciation IS in this country,
 * in the authority's vocabulary, and links ONLY to the authority's own pages.
 * Never hard-code this in a client; a client that knows the rules for one
 * country prints them for every country.
 */
export interface DepreciationExplainer {
  /** One sentence: what this page is, in this country's words. */
  whatItIs: string;
  /** Who it applies to and when — including the carve-outs. */
  whenItApplies: string;
  /** Three or four plain steps, using the country's own arithmetic. */
  howItWorks: string[];
  /** Official pages only. */
  readMore: { label: string; url: string; authority: string }[];
  vocabulary: DepreciationVocabulary;
}

/**
 * A concession that changes what is claimed in the year an asset is acquired.
 * `threshold_write_off`: the whole cost is deducted where it is under `limit`.
 * `upfront_percent`: `percent` of the cost is deducted up front and the rest
 * is depreciated as usual. `verified: false` means the figure could not be
 * confirmed for that date — render the note, never a number.
 */
export interface FirstYearConcession {
  key: string;
  label: string;
  kind: 'threshold_write_off' | 'upfront_percent';
  /** Currency units, for `threshold_write_off`. */
  limit: number | null;
  /** 0-100, for `upfront_percent`. */
  percent: number | null;
  verified: boolean;
  note: string;
  /** An `extraAssetFields()` key this concession depends on, e.g. `isNewAsset`. */
  requiresField?: string;
}

/**
 * A field the asset register must collect for THIS country beyond the common
 * ones (cost, date, method, category, business-use %). NZ needs `isNewAsset`
 * for Investment Boost; the UK will need CO₂ g/km; Canada the CCA class.
 */
export interface AssetFieldSpec {
  key: string;
  label: string;
  type: 'boolean' | 'number' | 'text' | 'enum';
  required: boolean;
  help: string;
  options?: { value: string; label: string }[];
}

export interface DeclineInValueInput {
  method: DepreciationMethod;
  /** First plus second element of cost, tax-exclusive where the tax credit is claimable. */
  cost: number;
  /** Base value at the start of this income year (cost less prior-year declines). */
  openingAdjustableValue: number;
  /**
   * Second element of cost — an improvement — incurred DURING this income year.
   * The ATO's base value in a year after the first is the opening adjustable
   * value PLUS this, so a $5,000 opening value improved by $1,000 declines from
   * $6,000. Optional and defaulting to 0, which is the ordinary case.
   *
   * Diminishing value only. The other three methods THROW rather than ignore a
   * non-zero value, because each of them needs a different treatment this module
   * is not given enough to perform — see item 3 in the header of this module for
   * what to pass instead.
   */
  secondElementCostThisYear?: number;
  /**
   * Commissioner's or self-assessed effective life. Ignored by write-off and
   * pool. Required for prime cost and diminishing value UNLESS `annualRate` is
   * given, in which case it is not consulted.
   */
  effectiveLifeYears?: number;
  /**
   * The annual rate as a fraction (0.3 = 30%), for a `rate_per_asset` regime
   * where the authority publishes the rate itself rather than a life to derive
   * it from (NZ: IR265 lists a DV and an SL rate per asset). When given, it is
   * applied as-is to both prime cost (straight line) and diminishing value —
   * no 200% multiplier, no division by a life — and `effectiveLifeYears` is
   * ignored.
   */
  annualRate?: number;
  /**
   * The part of the year the asset was used, in the jurisdiction's unit. When
   * given, `daysHeld` / `daysInYear` are ignored; when absent, they are
   * required and the days form is used, so every existing caller is unchanged.
   */
  partYear?: PartYearInput;
  /**
   * Days in the income year the asset was used or installed ready for use.
   * MAY be 366 in a leap income year — the ATO says so explicitly — and may
   * therefore exceed `daysInYear`. That is not an error. Required unless
   * `partYear` is given.
   */
  daysHeld?: number;
  /**
   * The DENOMINATOR the jurisdiction prescribes for the day fraction — not
   * necessarily the number of days in the income year. Australia fixes it at
   * 365 in every year, leap or not (see AU_DAY_FRACTION_DENOMINATOR). Pass what
   * your authority publishes; never assume.
   *
   * A jurisdiction whose denominator is fixed OVERRIDES this inside its own
   * `declineInValue`, so passing 366 to `AU_DEPRECIATION_RULES` gives the same
   * answer as passing 365. The generic rules honour whatever you pass.
   * Required unless `partYear` is given.
   */
  daysInYear?: number;
  /** Diminishing value at 150% rather than 200%. */
  heldBefore10May2006?: boolean;
  /**
   * Pool method only: this is the year the asset was allocated to the pool, so
   * the allocation-year rate applies rather than the ongoing rate. Optional and
   * defaulting to false, because most pooled assets in a schedule are ongoing —
   * a country whose pool has no allocation-year rate ignores it.
   */
  poolAllocationYear?: boolean;
}

export interface DeclineInValueOutcome {
  /** Decline in value for the income year, in currency units, clamped at the base value. */
  declineInValue: number;
  /**
   * Base value less the decline — where base value is the opening adjustable
   * value plus any `secondElementCostThisYear`, so an improvement made this year
   * is carried into the next one. Never negative.
   */
  closingAdjustableValue: number;
  /** The annual rate applied, as a fraction (0.2 = 20%), before the day fraction. */
  rate: number;
}

export interface EffectiveLifeCategory {
  key: string;
  label: string;
  years: number;
  /** The determination, ruling or table the figure was read from. */
  source?: string;
}

export interface InstantAssetWriteOffInfo {
  /** The threshold in currency units, or null where it is not known for that date. */
  limit: number | null;
  /** false means "this could not be confirmed" — never print an unverified number. */
  verified: boolean;
  note: string;
}

export interface BalancingAdjustmentInput {
  /** Consideration received on disposal. */
  terminationValue: number;
  /** Written-down (adjustable) value at the date of disposal. */
  adjustableValue: number;
  /** 0-100. The private portion is excluded from the adjustment. */
  taxableUsePercent: number;
}

export interface BalancingAdjustmentOutcome {
  /** Positive = assessable income, negative = deduction. */
  amount: number;
  assessable: boolean;
}

export interface DepreciationRules {
  countryCode: string;
  /** Which model these rules implement — see `DepreciationRegime`. Hosts branch on it. */
  regime: DepreciationRegime;
  /** The methods this jurisdiction allows. */
  methods: DepreciationMethod[];
  defaultMethod: DepreciationMethod;
  /** Decline in value for ONE income year. Pure; no dates beyond those passed in. */
  declineInValue(input: DeclineInValueInput): DeclineInValueOutcome;
  /**
   * The denominator this jurisdiction prescribes for the day fraction, given
   * the actual number of days in the income year.
   *
   * It is NOT always the length of the year: Australia fixes it at 365 even in
   * a leap year, so a full 366-day hold claims 366/365 of a year's decline.
   * Callers must ask here rather than counting days themselves — keeping that
   * rule inside the plugin is the whole point.
   */
  dayFractionDenominator(daysInIncomeYear: number): number;
  /** Commissioner's effective life in years for a category key. null = self-assess. */
  effectiveLife(categoryKey: string): number | null;
  effectiveLifeCategories(): EffectiveLifeCategory[];
  /** Effective-dated write-off limit; verified=false means "this could not be confirmed". */
  instantAssetWriteOff(onDate: Date): InstantAssetWriteOffInfo;
  balancingAdjustment(input: BalancingAdjustmentInput): BalancingAdjustmentOutcome;
  /** The per-country copy for an assets page, in the authority's vocabulary. */
  explainer(): DepreciationExplainer;
  /** Regime-specific first-year concessions in force on a date, each with `verified`. */
  firstYearConcessions(onDate: Date | string): FirstYearConcession[];
  /** What the register must collect for THIS country beyond the common fields. */
  extraAssetFields(): AssetFieldSpec[];
}

/**
 * A jurisdiction that publishes a rate per asset and apportions by whole
 * months — New Zealand. `rateFor` returns fractions (0.3 = 30%) so a result
 * can be passed straight to `declineInValue` as `annualRate`.
 */
export interface RatePerAssetRules extends DepreciationRules {
  regime: 'rate_per_asset';
  /** Part-months count as whole months; the fraction is months ÷ 12. */
  partYear: 'months_whole';
  rateFor(categoryKey: string): { dv: number; sl: number; source: string } | null;
  lowValueThreshold(onDate: Date | string): { limit: number | null; verified: boolean; note: string };
  investmentBoost(onDate: Date | string): { percent: number | null; verified: boolean; note: string };
}

// ─── Effective-dated rows ───────────────────────────────────────────────────

/** A row that applies from a calendar day until the next row starts. */
export interface EffectiveDatedRow {
  /** YYYY-MM-DD, inclusive. */
  effectiveFrom: string;
}

/**
 * Newest-first by `effectiveFrom`. `YYYY-MM-DD` sorts correctly as a string.
 * Order is derived, never trusted, so a row appended at the bottom of a literal
 * still resolves correctly.
 */
export function sortNewestFirst<T extends EffectiveDatedRow>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) =>
    a.effectiveFrom < b.effectiveFrom ? 1 : a.effectiveFrom > b.effectiveFrom ? -1 : 0,
  );
}

/**
 * The row in force on a date: the one with the greatest `effectiveFrom` on or
 * before it. A date before the earliest row gets the earliest row, which every
 * ledger here makes an unverified "not recorded" — never a number. `ymd` is the
 * caller's LOCAL calendar day (see `toYmd` in the rate ledger).
 */
export function resolveEffectiveDated<T extends EffectiveDatedRow>(
  rowsNewestFirst: readonly T[],
  ymd: string,
): T {
  return (
    rowsNewestFirst.find((r) => r.effectiveFrom <= ymd) ?? rowsNewestFirst[rowsNewestFirst.length - 1]
  );
}

// ─── Shared arithmetic ──────────────────────────────────────────────────────

/** Diminishing value multiplier: 200% normally, 150% for assets held before 10 May 2006. */
export const DV_RATE_MULTIPLIER = 2.0;
export const DV_RATE_MULTIPLIER_PRE_10_MAY_2006 = 1.5;

/** Round to whole cents. Money, not floating-point noise; the report rounds again to dollars. */
function toCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function requirePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive number (received ${String(value)})`);
  }
  return value;
}

/**
 * The longest a depreciating asset can be held within one income year. Days
 * beyond this are a caller bug (an unclosed date range, a disposal before
 * acquisition), so they are capped rather than turned into a larger deduction.
 */
const MAX_DAYS_HELD = 366;

/** A published annual rate must be a fraction in (0, 1]; 30 where 0.3 was meant is a 30× deduction. */
function requireRate(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1) {
    throw new RangeError(
      `annualRate must be a fraction in (0, 1] — 0.3 for 30% (received ${String(rate)})`,
    );
  }
  return rate;
}

/**
 * The fraction of the year to apportion by, in whichever unit the caller used.
 *
 * DAYS (the default, and every pre-2.2 caller): `daysHeld / daysInYear`, NOT
 * clamped to 1. The ATO fixes the denominator at 365 and says in the same
 * breath that "days held can be 366 for a leap year", so the fraction is
 * deliberately allowed to exceed 1 — clamping it silently shortened every
 * leap-year claim. Guard only against nonsense: a hold longer than a leap year
 * is a caller bug, not a bigger deduction.
 *
 * MONTHS (NZ): `monthsUsed / 12`, where `monthsUsed` is a whole number from 0
 * to 12. Inland Revenue's rule is "count part-months as whole months", so the
 * CALLER rounds a part-month up before it gets here and this refuses a
 * fraction — there is no authority for 10.5 months and the engine will not
 * invent one.
 */
function partYearFraction(input: DeclineInValueInput): number {
  const py = input.partYear;
  if (py?.kind === 'months') {
    const months = Number(py.monthsUsed);
    if (!Number.isInteger(months) || months < 0 || months > 12) {
      throw new RangeError(
        'monthsUsed must be a whole number from 0 to 12 — part-months count as whole months ' +
          `(received ${String(py.monthsUsed)})`,
      );
    }
    return months / 12;
  }
  const daysInYear = requirePositive(
    py?.kind === 'days' ? py.daysInYear : (input.daysInYear as number),
    'daysInYear',
  );
  const heldRaw = py?.kind === 'days' ? py.daysHeld : input.daysHeld;
  const daysHeld = Math.min(Math.max(0, Number(heldRaw) || 0), MAX_DAYS_HELD);
  return daysHeld / daysInYear;
}

/**
 * The ATO formulas, shared by every implementation. `poolRates` is supplied
 * only by a jurisdiction that offers the pool method; without it, asking for
 * `pool` is an error rather than a silently-invented rate.
 */
export function computeDeclineInValue(
  input: DeclineInValueInput,
  poolRates?: { allocationYear: number; ongoing: number },
): DeclineInValueOutcome {
  const opening = Math.max(0, Number(input.openingAdjustableValue) || 0);
  const cost = Math.max(0, Number(input.cost) || 0);
  const secondElement = Math.max(0, Number(input.secondElementCostThisYear) || 0);
  if (secondElement > 0 && input.method !== 'diminishing_value') {
    throw new RangeError(
      'secondElementCostThisYear is modelled for the diminishing value method only, not ' +
        `"${String(input.method)}". Prime cost needs the asset's REMAINING effective life, ` +
        'which this module cannot tell from a full one — recalculate in the caller and pass ' +
        '`cost: openingAdjustableValue + secondElementCostThisYear` with the remaining life. ' +
        'A pooled improvement takes the allocation-year rate while the rest of the pool takes ' +
        'the ongoing rate, so it is two calls. An improvement to a written-off asset is its ' +
        'own write-off decision.',
    );
  }
  /**
   * The ATO's `base value`: the opening adjustable value plus any second-element
   * cost incurred this year. Equal to the opening value whenever there is no
   * improvement, which is every case the other three methods allow.
   */
  const baseValue = opening + secondElement;
  const dayFraction = partYearFraction(input);

  let rate: number;
  let raw: number;

  switch (input.method) {
    case 'prime_cost': {
      rate =
        input.annualRate != null
          ? requireRate(input.annualRate)
          : 1 / requirePositive(input.effectiveLifeYears as number, 'effectiveLifeYears');
      raw = cost * dayFraction * rate;
      break;
    }
    case 'diminishing_value': {
      if (input.annualRate != null) {
        // A published per-asset rate is applied as-is: no multiplier, no life.
        rate = requireRate(input.annualRate);
      } else {
        const life = requirePositive(input.effectiveLifeYears as number, 'effectiveLifeYears');
        const multiplier = input.heldBefore10May2006
          ? DV_RATE_MULTIPLIER_PRE_10_MAY_2006
          : DV_RATE_MULTIPLIER;
        rate = multiplier / life;
      }
      // Base value, not the opening value: an improvement made this year
      // depreciates from the year it was incurred.
      raw = baseValue * dayFraction * rate;
      break;
    }
    case 'immediate_writeoff': {
      // The whole opening value declines in the year the asset is written off;
      // there is no day apportionment on an immediate deduction.
      rate = 1;
      raw = baseValue;
      break;
    }
    case 'pool': {
      if (!poolRates) {
        throw new RangeError('The pool method is not available in these depreciation rules');
      }
      // Pool deductions are a rate on the pool balance, not apportioned by days held.
      rate = input.poolAllocationYear ? poolRates.allocationYear : poolRates.ongoing;
      raw = baseValue * rate;
      break;
    }
    default:
      throw new RangeError(`Unknown depreciation method: ${String(input.method)}`);
  }

  // An asset cannot depreciate below zero — and the ceiling is the base value,
  // so this year's improvement is depreciable this year rather than being
  // stranded above a cap set by the opening value alone.
  const declineInValue = toCents(Math.min(Math.max(raw, 0), baseValue));
  return {
    declineInValue,
    closingAdjustableValue: toCents(baseValue - declineInValue),
    rate,
  };
}

/**
 * Termination value less adjustable value, weighted by taxable use. Positive is
 * assessable income (the asset sold for more than its written-down value);
 * negative is a deduction.
 */
export function computeBalancingAdjustment(
  input: BalancingAdjustmentInput,
): BalancingAdjustmentOutcome {
  const taxableUse = Math.min(100, Math.max(0, Number(input.taxableUsePercent) || 0)) / 100;
  const gross = (Number(input.terminationValue) || 0) - (Number(input.adjustableValue) || 0);
  const amount = toCents(gross * taxableUse);
  return { amount, assessable: amount > 0 };
}

// ─── Generic (jurisdiction-neutral) rules ───────────────────────────────────

const GENERIC_WRITE_OFF_NOTE =
  'No immediate write-off threshold is published here for this country. Check the current ' +
  'limit with your tax authority or your registered tax agent before writing an asset off.';

/**
 * The fallback every country gets. Prime cost and diminishing value only: the
 * two formulas are near-universal, while write-off thresholds, pooling rules and
 * effective lives are not, and inventing another country's numbers would be
 * worse than leaving the field blank for you to fill in.
 */
/**
 * Says plainly that nothing country-specific is loaded. No link, because there
 * is no authority to link to — an invented "generic" URL would be a citation
 * to nothing.
 */
const GENERIC_EXPLAINER: DepreciationExplainer = {
  whatItIs:
    'Assets you keep for more than a year are usually claimed over time rather than all at once.',
  whenItApplies:
    'No country-specific depreciation rules are loaded for this country, so no rate, ' +
    'write-off threshold or part-year convention here is its own. Confirm every figure ' +
    'with your tax authority or your tax agent before you rely on it.',
  howItWorks: [
    'Record the asset and its cost, excluding any tax credit you can claim back.',
    'Pick straight line (the same amount each year) or diminishing value (a percentage of the remaining value each year).',
    'Set the effective life yourself — none is published here — and the rate follows from it.',
    "Claim the business-use share of each year's amount.",
  ],
  readMore: [],
  vocabulary: {
    asset: 'Asset',
    decline: 'Depreciation',
    writtenDown: 'Written down value',
    rate: 'Rate',
    rateBasis: 'Effective life',
  },
};

export const GENERIC_DEPRECIATION_RULES: DepreciationRules = {
  /** No special convention: the fraction is over the real length of the year. */
  dayFractionDenominator(daysInIncomeYear: number): number {
    return requirePositive(daysInIncomeYear, 'daysInIncomeYear');
  },

  countryCode: '*',
  regime: 'generic',
  methods: ['prime_cost', 'diminishing_value'],
  defaultMethod: 'prime_cost',

  /**
   * The caller's `daysInYear` is used as given. With no jurisdiction there is no
   * published convention to override it with, so the honest denominator is
   * whatever the caller's own authority prescribes.
   */
  declineInValue(input: DeclineInValueInput): DeclineInValueOutcome {
    if (input.method !== 'prime_cost' && input.method !== 'diminishing_value') {
      throw new RangeError(
        `Method "${String(input.method)}" is not available in the generic depreciation rules ` +
          '(prime_cost and diminishing_value only)',
      );
    }
    return computeDeclineInValue(input);
  },

  effectiveLife(): number | null {
    return null;
  },

  effectiveLifeCategories(): EffectiveLifeCategory[] {
    return [];
  },

  instantAssetWriteOff(): InstantAssetWriteOffInfo {
    return { limit: null, verified: false, note: GENERIC_WRITE_OFF_NOTE };
  },

  balancingAdjustment(input: BalancingAdjustmentInput): BalancingAdjustmentOutcome {
    return computeBalancingAdjustment(input);
  },

  explainer(): DepreciationExplainer {
    return { ...GENERIC_EXPLAINER, howItWorks: [...GENERIC_EXPLAINER.howItWorks], readMore: [] };
  },

  /** Nothing is loaded, so nothing is offered — not even an unverified placeholder. */
  firstYearConcessions(): FirstYearConcession[] {
    return [];
  },

  extraAssetFields(): AssetFieldSpec[] {
    return [];
  },
};

/**
 * The depreciation rules for a plugin — its own where it has them, the
 * jurisdiction-neutral set otherwise, so every country gets a schedule.
 */
export function getDepreciationRules(plugin: TaxFilingPlugin): DepreciationRules {
  return plugin.getDepreciationRules?.() ?? GENERIC_DEPRECIATION_RULES;
}
