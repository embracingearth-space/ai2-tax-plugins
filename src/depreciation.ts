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
 * pool/class statement. All five are implemented.
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

// ─── Pooled allowances (United Kingdom) ─────────────────────────────────────

/**
 * HMRC's pools. `main` and `special` are the two rate pools; `single` is a
 * single-asset pool (a short-life asset election, or an asset with private
 * use), which takes the rate of the pool it would otherwise have joined and
 * gets a balancing adjustment of its own on disposal.
 */
export type UkPool = 'main' | 'special' | 'single';

/** Whether a period's WDA rate comes from the Corporation Tax or the Income Tax calendar. */
export type UkTaxpayerType = 'income_tax' | 'corporation_tax';

/** An accounting period (Corporation Tax) or basis period (Income Tax), both ends inclusive. */
export interface UkPeriod {
  periodStart: Date | string;
  periodEnd: Date | string;
}

export interface UkWdaRateOutcome {
  /** The rate to apply to the pool balance, as a fraction. Time-apportioned where hybrid. */
  rate: number;
  /** Present where the period straddles a rate change: the two rates and the days each applied. */
  hybrid?: { before: number; after: number; daysBefore: number; daysAfter: number };
  verified: boolean;
  note: string;
}

export interface UkAiaOutcome {
  /** The limit for THIS period — the annual figure, pro-rated where the period is not 12 months. */
  limit: number | null;
  /** The annual figure the limit was pro-rated from. */
  annualLimit: number | null;
  proRated: boolean;
  verified: boolean;
  note: string;
}

export interface UkSmallPoolsOutcome {
  /** Write the whole pool off where its balance, before the allowance, is at or under this. */
  limit: number | null;
  annualLimit: number | null;
  proRated: boolean;
  verified: boolean;
  note: string;
}

export type UkFirstYearAllowanceKind =
  | 'full_expensing'
  | 'fya_50_special_rate'
  | 'fya_40'
  | 'fya_100_zero_emission_car'
  | 'super_deduction';

export interface UkFirstYearAllowanceOutcome {
  /** 0-100 (130 for the super-deduction). null where the answer depends on a fact not supplied. */
  percent: number | null;
  kind: UkFirstYearAllowanceKind | null;
  /** The share of cost (0-100) that goes INTO the pool for writing-down allowances from the NEXT period. */
  remainderToPool: number;
  /** Which pool the remainder joins. */
  pool: UkPool;
  verified: boolean;
  note: string;
}

export interface UkPoolAssignment {
  pool: UkPool;
  verified: boolean;
  note: string;
}

/**
 * What the UK rules need to know about an asset. Everything beyond `cost` is
 * optional and tri-state: an unanswered question is never treated as a "yes".
 */
export interface UkAssetInput {
  cost: number;
  /** A car (not a van, lorry or motorcycle). Cars never qualify for AIA or the 40% FYA. */
  isCar?: boolean | null;
  /** Official CO₂ figure in g/km. Required to route a car; 0 for an electric car. */
  co2GPerKm?: number | null;
  /** Bought new and unused, not second-hand. */
  isNew?: boolean | null;
  taxpayerType?: UkTaxpayerType | null;
  /** Integral features, long-life assets, solar panels, thermal insulation: the special rate pool. */
  isSpecialRate?: boolean | null;
  /** Short-life asset election, or private use: a single-asset pool. */
  singleAssetPool?: boolean | null;
  /** Sole trader or partnership using the cash basis. */
  cashBasis?: boolean | null;
}

export interface UkEligibilityOutcome {
  eligible: boolean;
  note: string;
}

/**
 * A jurisdiction where the POOL is the unit of allowance, not the asset —
 * the United Kingdom. Assets are contributions to a pool; the allowance is a
 * rate on the pool's written down value each period, after the annual
 * investment allowance and first-year allowances have taken what they take.
 */
export interface PooledAllowanceRules extends DepreciationRules {
  regime: 'pooled_allowance';
  /** Which pool an asset joins, by the authority's table (cars: CO₂ and purchase date). */
  poolFor(asset: UkAssetInput, onDate: Date | string): UkPoolAssignment;
  /** The writing-down allowance rate for a pool over a period, hybrid where the period straddles a change. */
  wdaRate(pool: UkPool, period: UkPeriod & { taxpayer: UkTaxpayerType }): UkWdaRateOutcome;
  /** The annual investment allowance for a period, pro-rated for a period that is not 12 months. */
  aia(period: UkPeriod): UkAiaOutcome;
  /** The best first-year allowance an asset qualifies for on a date, or null. */
  firstYearAllowance(asset: UkAssetInput, onDate: Date | string): UkFirstYearAllowanceOutcome | null;
  /** Cash-basis sole traders and partnerships can claim capital allowances on business cars only. */
  cashBasisRestriction(): { carsOnly: true; note: string };
  /** Whether THIS asset can be claimed at all (the cash-basis gate). */
  eligibility(asset: UkAssetInput): UkEligibilityOutcome;
  /** The small pools allowance limit for a period, pro-rated like the AIA. */
  smallPoolsAllowance(period: UkPeriod): UkSmallPoolsOutcome;
}

// ─── Class CCA (Canada) ─────────────────────────────────────────────────────

/**
 * The CRA classes these rules resolve to. `CaClassAssignment.cls` is typed as
 * a string so a host that stores a class this list does not cover ("43",
 * "16") round-trips it; `CA_CCA_CLASSES` is the list with rates.
 */
export type CaCcaClass = '1' | '8' | '10' | '10.1' | '12' | '14.1' | '50' | '54' | '55';

/**
 * What a Canadian asset IS, in the words the classes page uses, so `classFor`
 * can suggest a class where the register has not recorded one.
 */
export type CaAssetKind =
  | 'building'
  | 'furniture'
  | 'appliance'
  | 'machinery'
  | 'equipment'
  | 'tool'
  | 'photocopier'
  | 'phone_equipment'
  | 'computer'
  | 'systems_software'
  | 'software'
  | 'motor_vehicle'
  | 'passenger_vehicle'
  | 'taxi_or_rental_vehicle'
  | 'goodwill'
  | 'licence_unlimited'
  | 'other';

/**
 * What the Canadian rules need to know about an asset. Everything beyond
 * `cost` is optional and tri-state: an unanswered question is never a "yes".
 */
export interface CaAssetInput {
  /** Capital cost BEFORE GST/HST and PST — the class 10 / 10.1 test uses the pre-tax price. */
  cost: number;
  kind?: CaAssetKind | null;
  /** A class the register already holds; when present it wins over `kind`. */
  ccaClass?: string | null;
  isZeroEmissionVehicle?: boolean | null;
  acquiredDate?: Date | string | null;
  /** Defaults to `acquiredDate`. The enhanced first-year rules key on this year. */
  availableForUseDate?: Date | string | null;
  /** Bought from a non-arm's-length person, or on a rollover: not eligible for the AII. */
  nonArmsLength?: boolean | null;
}

export interface CaClassAssignment {
  cls: CaCcaClass | string;
  /** The class rate as a fraction (0.3 = 30%), or null where the class is not on the list. */
  rate: number | null;
  /** The canada.ca page the rate was read from. */
  source: string;
  verified: boolean;
  note?: string;
}

export interface CaFirstYearOutcome {
  /** Whether the half-year rule applies to this addition. */
  halfYear: boolean;
  /**
   * The accelerated investment incentive factor on the net addition: 1.5 for
   * property available for use before 2024, 1 for 2024-2027 (the half-year
   * rule stays suspended and nothing is added), null where the AII does not
   * apply (ZEV classes, pre-21 Nov 2018 property, non-arm's-length).
   */
  aiiMultiplier: number | null;
  /**
   * The all-in factor the net addition is multiplied by to reach the base
   * amount for CCA — what `computeClassPeriod` takes as `baseMultiplier`.
   * 0.5 under the half-year rule; 1.5 or 1 under the AII; 10/3, 2.5 or 11/6
   * for a class 54 zero-emission vehicle (so that 30% of it is 100%, 75%, 55%).
   */
  baseMultiplier: number;
  /** The first-year claim as a percentage of cost, where it is a round figure (ZEV 100/75/55); null otherwise. */
  enhancedPercent: number | null;
  verified: boolean;
  note: string;
}

export interface CaVehicleCapOutcome {
  /** The prescribed amount before sales taxes, or null where that year is not on the page. */
  cap: number | null;
  verified: boolean;
  note: string;
}

/**
 * A jurisdiction where the CLASS is the unit — Canada. Assets are
 * contributions to a numbered class; capital cost allowance is a rate on the
 * class's undepreciated capital cost each year, after the half-year rule or
 * the accelerated investment incentive has adjusted the year's net additions.
 */
export interface ClassCcaRules extends DepreciationRules {
  regime: 'class_cca';
  /** Which class an asset joins, by the CRA's "Classes of depreciable property" page. */
  classFor(asset: CaAssetInput): CaClassAssignment;
  /** Half-year rule, AII or ZEV enhancement for an addition available for use on a date. */
  firstYear(asset: CaAssetInput, onDate: Date | string): CaFirstYearOutcome;
  /** The class 10.1 threshold for a passenger vehicle bought in a calendar year, before tax. */
  passengerVehicleCap(year: number): CaVehicleCapOutcome;
  /** The capital cost limit for a zero-emission passenger vehicle in class 54, before tax. */
  zeroEmissionVehicleCap(year: number): CaVehicleCapOutcome;
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

// ─── Pool period arithmetic (pooled_allowance regime) ───────────────────────

export interface PoolPeriodAddition {
  cost: number;
  /**
   * 0-130: the first-year allowance claimed on this addition. The rest of the
   * cost joins the pool for writing-down allowances from the NEXT period — the
   * 40% FYA's "remaining 60%" is not written down in the period it was bought.
   */
  fyaPercent?: number;
  /**
   * Whether the annual investment allowance may be claimed on this addition.
   * Defaults to true. Cars, pre-owned items and gifts are not eligible. Ignored
   * where `fyaPercent` is given — an addition takes one or the other.
   */
  aiaEligible?: boolean;
}

export interface PoolPeriodDisposal {
  /** Consideration received. */
  proceeds: number;
  /** Original cost; where given, the amount taken out of the pool is capped at it. */
  originalCost?: number;
}

export interface PoolPeriodInput {
  pool: UkPool;
  /** Written down value brought forward. */
  openingWdv: number;
  additions?: PoolPeriodAddition[];
  disposals?: PoolPeriodDisposal[];
  /** The writing-down allowance rate for this pool and period, as a fraction (0 allowed). */
  wdaRate: number;
  /**
   * The AIA available to THIS pool this period, already pro-rated. A business
   * has ONE AIA across all its pools; the host decides how much of it lands here.
   */
  aiaLimit: number;
  /**
   * The small pools allowance limit for this period, already pro-rated, or
   * null/undefined to disable. Never applies to a single-asset pool.
   */
  smallPoolsLimit?: number | null;
  /**
   * The business has ceased, or (single-asset pool) the asset has been
   * disposed of: whatever remains after disposals is a balancing allowance
   * rather than carried forward.
   */
  closing?: boolean;
}

export interface PoolPeriodOutcome {
  openingWdv: number;
  additions: number;
  aiaClaimed: number;
  fyaClaimed: number;
  /** What the FYA left over, carried into the pool for next period's WDA. */
  fyaRemainderToPool: number;
  disposals: number;
  /** Positive where disposal proceeds exceed the pool balance; goes on the return as income. */
  balancingCharge: number;
  /** Positive where the pool is closed with a balance left; deductible. */
  balancingAllowance: number;
  smallPoolsAllowance: number;
  wdaClaimed: number;
  /** AIA + FYA + small pools + WDA + balancing allowance. */
  totalAllowance: number;
  closingWdv: number;
}

/**
 * One period of one pool, in HMRC's order: additions in; AIA and first-year
 * allowances against the additions that qualify; disposals out, capped at
 * cost; a balancing charge where proceeds exceed the balance; the small pools
 * allowance where the main or special pool is at or under the limit BEFORE
 * the allowance is worked out (either that or WDA, never both); otherwise the
 * writing-down allowance on what remains; and the FYA remainder joins the
 * closing balance for next period.
 *
 * Per period only. Multi-year replay is the host's: it calls this once per
 * period with last period's `closingWdv` as this period's `openingWdv`.
 */
export function computePoolPeriod(input: PoolPeriodInput): PoolPeriodOutcome {
  const openingWdv = Math.max(0, Number(input.openingWdv) || 0);
  const rate = Number(input.wdaRate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new RangeError(`wdaRate must be a fraction in [0, 1] — 0.18 for 18% (received ${String(input.wdaRate)})`);
  }
  const aiaLimit = Math.max(0, Number(input.aiaLimit) || 0);

  let additions = 0;
  let aiaClaimed = 0;
  let fyaClaimed = 0;
  let fyaRemainderToPool = 0;
  let aiaExcessToPool = 0;

  for (const a of input.additions ?? []) {
    const cost = Math.max(0, Number(a.cost) || 0);
    additions += cost;
    if (a.fyaPercent != null) {
      const pct = Number(a.fyaPercent);
      if (!Number.isFinite(pct) || pct < 0 || pct > 130) {
        throw new RangeError(`fyaPercent must be 0-130 (received ${String(a.fyaPercent)})`);
      }
      const fya = toCents((cost * pct) / 100);
      fyaClaimed += fya;
      // The 130% super-deduction leaves nothing in the pool; a 40% FYA leaves 60%.
      fyaRemainderToPool += toCents(cost - Math.min(cost, fya));
    } else if (a.aiaEligible !== false) {
      const room = Math.max(0, aiaLimit - aiaClaimed);
      const claim = Math.min(cost, room);
      aiaClaimed += claim;
      aiaExcessToPool += cost - claim;
    } else {
      aiaExcessToPool += cost;
    }
  }

  let disposals = 0;
  for (const d of input.disposals ?? []) {
    const proceeds = Math.max(0, Number(d.proceeds) || 0);
    disposals +=
      d.originalCost != null ? Math.min(proceeds, Math.max(0, Number(d.originalCost) || 0)) : proceeds;
  }

  // The balance the allowance is worked out on: brought forward, plus the
  // additions AIA did not cover (they get WDA this period), less disposals.
  let balance = toCents(openingWdv + aiaExcessToPool - disposals);
  let balancingCharge = 0;
  if (balance < 0) {
    balancingCharge = toCents(-balance);
    balance = 0;
  }

  let balancingAllowance = 0;
  let smallPoolsAllowance = 0;
  let wdaClaimed = 0;
  if (input.closing) {
    // A closing pool has nowhere to carry anything: the balance and the FYA
    // remainder are both allowed now.
    balancingAllowance = toCents(balance + fyaRemainderToPool);
    balance = 0;
  } else if (
    input.pool !== 'single' &&
    input.smallPoolsLimit != null &&
    balance > 0 &&
    balance <= Math.max(0, Number(input.smallPoolsLimit) || 0)
  ) {
    smallPoolsAllowance = balance;
    balance = 0;
  } else {
    wdaClaimed = toCents(balance * rate);
    balance = toCents(balance - wdaClaimed);
  }

  const closingWdv = input.closing ? 0 : toCents(balance + fyaRemainderToPool);

  return {
    openingWdv,
    additions: toCents(additions),
    aiaClaimed: toCents(aiaClaimed),
    fyaClaimed: toCents(fyaClaimed),
    fyaRemainderToPool: toCents(fyaRemainderToPool),
    disposals: toCents(disposals),
    balancingCharge,
    balancingAllowance,
    smallPoolsAllowance,
    wdaClaimed,
    totalAllowance: toCents(
      aiaClaimed + fyaClaimed + smallPoolsAllowance + wdaClaimed + balancingAllowance,
    ),
    closingWdv,
  };
}

// ─── Class period arithmetic (class_cca regime) ─────────────────────────────

export interface ClassPeriodAddition {
  /** Capital cost of the addition (for a class 10.1 or 54 vehicle, already capped at the prescribed amount plus tax). */
  cost: number;
  /**
   * The factor this addition's net amount is multiplied by to reach the base
   * amount for CCA — `CaFirstYearOutcome.baseMultiplier`. Defaults to 0.5,
   * the half-year rule; 1 where the AII suspends it (2024-2027); 1.5 under the
   * AII before 2024; 10/3, 2.5 or 11/6 for a class 54 zero-emission vehicle.
   */
  baseMultiplier?: number;
}

export interface ClassPeriodDisposal {
  /** Proceeds of disposition less related expenses. */
  proceeds: number;
  /** Capital cost of the property disposed of; the amount taken out of the class is the LESSER of proceeds and this. */
  capitalCost?: number;
}

export interface ClassPeriodInput {
  /** Undepreciated capital cost at the start of the year (T2125 Area A column 2). */
  openingUcc: number;
  /** The class rate as a fraction (0.2 = 20%). */
  rate: number;
  additions?: ClassPeriodAddition[];
  disposals?: ClassPeriodDisposal[];
  /** No property is left in the class at the end of the year: a positive balance is a terminal loss. */
  classEmptied?: boolean;
  /**
   * Class 10.1: the recapture and terminal loss rules do not apply. In the
   * year the vehicle is disposed of, `halfYearOnSale` claims 50% of the CCA
   * that would have been allowed had it still been owned (base = half the
   * opening UCC), provided it was owned at the end of the previous year.
   */
  noRecaptureOrTerminalLoss?: boolean;
  halfYearOnSale?: boolean;
  /**
   * CCA is optional — "any amount you like, from zero to the maximum". A cap
   * on this year's claim; null or undefined claims the maximum.
   */
  claimLimit?: number | null;
  /** A fiscal period shorter than 365 days prorates the claim: days ÷ 365. Defaults to 1. */
  shortYearFraction?: number;
}

export interface ClassPeriodOutcome {
  openingUcc: number;
  additions: number;
  /** The lesser of proceeds and capital cost, summed. */
  disposals: number;
  /** Column 7: opening + additions − disposals, before any adjustment. */
  uccAfterAdditionsAndDispositions: number;
  /** Positive where column 7 is negative: goes on the return as income, and the class closes at zero. */
  recapture: number;
  /** Positive where the class is emptied with a balance left: deductible, and the class closes at zero. */
  terminalLoss: number;
  /** Signed: negative for the half-year reduction, positive for the AII / ZEV uplift. */
  firstYearAdjustment: number;
  /** Column 19: the amount the rate is applied to. */
  baseAmount: number;
  rate: number;
  /** The most that can be claimed this year. */
  maxCca: number;
  /** What was claimed: the maximum, or `claimLimit` where lower. */
  ccaClaimed: number;
  /** Column 22: column 7 less CCA claimed; zero after a recapture or terminal loss. */
  closingUcc: number;
}

/**
 * One year of one class, in the CRA's order (T2125 Area A): opening UCC;
 * additions in; dispositions out at the LESSER of proceeds and capital cost;
 * the UCC after additions and dispositions (column 7) — negative is a
 * recapture, positive with nothing left in the class is a terminal loss, and
 * in either case no CCA and the class closes at zero; otherwise the
 * first-year adjustment on the net additions (the half-year rule takes half
 * off, the accelerated investment incentive adds a half on or merely leaves
 * the whole amount in, a zero-emission vehicle adds more); CCA at the class
 * rate on that base, prorated for a short fiscal period and never more than
 * the balance; and the closing UCC, which is column 7 less the CCA claimed.
 *
 * Dispositions reduce the additions NOT eligible for the AII before the
 * eligible ones — the AII page's Example 5: "The disposition is first offset
 * against the NEP before reducing the eligible acquisition." Here that is
 * "lowest `baseMultiplier` first", which is the same ordering.
 *
 * Per year only. Multi-year replay is the host's: it calls this once per
 * year with last year's `closingUcc` as this year's `openingUcc`.
 */
export function computeClassPeriod(input: ClassPeriodInput): ClassPeriodOutcome {
  const openingUcc = Math.max(0, Number(input.openingUcc) || 0);
  const rate = Number(input.rate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new RangeError(`rate must be a fraction in [0, 1] — 0.2 for 20% (received ${String(input.rate)})`);
  }
  const shortYearFraction = input.shortYearFraction == null ? 1 : Number(input.shortYearFraction);
  if (!Number.isFinite(shortYearFraction) || shortYearFraction <= 0 || shortYearFraction > 1) {
    throw new RangeError(
      `shortYearFraction must be in (0, 1] — days in the fiscal period ÷ 365 (received ${String(input.shortYearFraction)})`,
    );
  }

  const adds = (input.additions ?? []).map((a) => {
    const cost = Math.max(0, Number(a.cost) || 0);
    const m = a.baseMultiplier == null ? 0.5 : Number(a.baseMultiplier);
    if (!Number.isFinite(m) || m < 0) {
      throw new RangeError(`baseMultiplier must be a non-negative number (received ${String(a.baseMultiplier)})`);
    }
    return { cost, m };
  });
  const additions = adds.reduce((t, a) => t + a.cost, 0);

  let disposals = 0;
  for (const d of input.disposals ?? []) {
    const proceeds = Math.max(0, Number(d.proceeds) || 0);
    disposals +=
      d.capitalCost != null ? Math.min(proceeds, Math.max(0, Number(d.capitalCost) || 0)) : proceeds;
  }

  const column7 = toCents(openingUcc + additions - disposals);

  const done = (partial: Partial<ClassPeriodOutcome>): ClassPeriodOutcome => ({
    openingUcc,
    additions: toCents(additions),
    disposals: toCents(disposals),
    uccAfterAdditionsAndDispositions: column7,
    recapture: 0,
    terminalLoss: 0,
    firstYearAdjustment: 0,
    baseAmount: 0,
    rate,
    maxCca: 0,
    ccaClaimed: 0,
    closingUcc: 0,
    ...partial,
  });

  if (column7 < 0) {
    // Class 10.1 has no recapture: the balance simply closes at zero.
    return done({ recapture: input.noRecaptureOrTerminalLoss ? 0 : toCents(-column7) });
  }

  if (input.classEmptied && !input.noRecaptureOrTerminalLoss) {
    return done({ terminalLoss: column7 });
  }

  let baseAmount: number;
  let firstYearAdjustment = 0;
  if (input.halfYearOnSale) {
    // Class 10.1 in the year of sale: half the CCA that would have been
    // allowed — the base is 50% of the opening UCC, the additions and
    // dispositions of the year notwithstanding.
    baseAmount = toCents(openingUcc * 0.5);
  } else {
    // Dispositions come off the least-favoured additions first (the half-year
    // ones before the AII ones), then off the opening balance.
    let remaining = disposals;
    for (const a of [...adds].sort((x, y) => x.m - y.m)) {
      const offset = Math.min(a.cost, remaining);
      remaining -= offset;
      firstYearAdjustment += (a.cost - offset) * (a.m - 1);
    }
    firstYearAdjustment = toCents(firstYearAdjustment);
    baseAmount = toCents(Math.max(0, column7 + firstYearAdjustment));
  }

  const maxCca = toCents(Math.min(column7, baseAmount * rate * shortYearFraction));
  const ccaClaimed =
    input.claimLimit == null ? maxCca : toCents(Math.min(maxCca, Math.max(0, Number(input.claimLimit) || 0)));
  // A class 10.1 vehicle sold this year leaves the class: nothing carries forward.
  const closingUcc = input.classEmptied ? 0 : toCents(column7 - ccaClaimed);

  return done({ firstYearAdjustment, baseAmount, maxCca, ccaClaimed, closingUcc });
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
