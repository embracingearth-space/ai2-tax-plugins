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
  /** Commissioner's or self-assessed effective life. Ignored by write-off and pool. */
  effectiveLifeYears: number;
  /**
   * Days in the income year the asset was used or installed ready for use.
   * MAY be 366 in a leap income year — the ATO says so explicitly — and may
   * therefore exceed `daysInYear`. That is not an error.
   */
  daysHeld: number;
  /**
   * The DENOMINATOR the jurisdiction prescribes for the day fraction — not
   * necessarily the number of days in the income year. Australia fixes it at
   * 365 in every year, leap or not (see AU_DAY_FRACTION_DENOMINATOR). Pass what
   * your authority publishes; never assume.
   *
   * A jurisdiction whose denominator is fixed OVERRIDES this inside its own
   * `declineInValue`, so passing 366 to `AU_DEPRECIATION_RULES` gives the same
   * answer as passing 365. The generic rules honour whatever you pass.
   */
  daysInYear: number;
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
  const daysInYear = requirePositive(input.daysInYear, 'daysInYear');
  // NOT clamped to `daysInYear`. The ATO fixes the denominator at 365 and says
  // in the same breath that "days held can be 366 for a leap year", so the
  // fraction is deliberately allowed to exceed 1 — clamping it silently
  // shortened every leap-year claim. Guard only against nonsense: a hold longer
  // than a leap year is a caller bug, not a bigger deduction.
  const daysHeld = Math.min(Math.max(0, Number(input.daysHeld) || 0), MAX_DAYS_HELD);
  const dayFraction = daysHeld / daysInYear;

  let rate: number;
  let raw: number;

  switch (input.method) {
    case 'prime_cost': {
      const life = requirePositive(input.effectiveLifeYears, 'effectiveLifeYears');
      rate = 1 / life;
      raw = cost * dayFraction * rate;
      break;
    }
    case 'diminishing_value': {
      const life = requirePositive(input.effectiveLifeYears, 'effectiveLifeYears');
      const multiplier = input.heldBefore10May2006
        ? DV_RATE_MULTIPLIER_PRE_10_MAY_2006
        : DV_RATE_MULTIPLIER;
      rate = multiplier / life;
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
export const GENERIC_DEPRECIATION_RULES: DepreciationRules = {
  /** No special convention: the fraction is over the real length of the year. */
  dayFractionDenominator(daysInIncomeYear: number): number {
    return requirePositive(daysInIncomeYear, 'daysInIncomeYear');
  },

  countryCode: '*',
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
};

/**
 * The depreciation rules for a plugin — its own where it has them, the
 * jurisdiction-neutral set otherwise, so every country gets a schedule.
 */
export function getDepreciationRules(plugin: TaxFilingPlugin): DepreciationRules {
  return plugin.getDepreciationRules?.() ?? GENERIC_DEPRECIATION_RULES;
}
