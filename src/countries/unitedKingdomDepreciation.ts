/**
 * United Kingdom — capital allowances — ai2fin.com
 * Authority: HM Revenue & Customs (HMRC)
 *
 * The United Kingdom is a POOLED regime. Plant and machinery is not written
 * down asset by asset: it is grouped into pools — the main pool, the special
 * rate pool, and single-asset pools (a short-life asset election, or an asset
 * with private use) — and the writing-down allowance (WDA) is a rate on each
 * pool's written down value every accounting period. An asset in this module
 * is a contribution to a pool; the pool is the unit of allowance.
 *
 * Everything below was read from gov.uk on 2026-08-23/24:
 *   gov.uk/capital-allowances (overview), /annual-investment-allowance,
 *   /40-first-year-allowance, /business-cars;
 *   gov.uk/work-out-capital-allowances/rates-and-pools and
 *   /work-out-what-you-can-claim.
 *
 * THE CASH-BASIS GATE COMES FIRST. "If you're a sole trader or partnership and
 * you use cash basis, you can only claim capital allowances on business cars."
 * Most of this product's UK users are cash-basis sole traders, so for them
 * this whole regime applies to cars and nothing else — everything else is an
 * ordinary expense. `eligibility()` says so per asset and the explainer leads
 * with it.
 *
 * Writing-down allowances: main pool 18%, falling to 14% from 1 April 2026
 * (Corporation Tax) or 6 April 2026 (Income Tax); a period straddling the
 * change uses a hybrid rate, time-apportioned by days. Special rate pool 6%
 * (integral features, long-life assets, solar panels, thermal insulation,
 * high-CO₂ cars).
 *
 * Annual investment allowance: £1,000,000 from 1 January 2019 (£200,000 for
 * 2016-2018, £500,000 for April 2014 - December 2015), pro-rated for an
 * accounting period that is not 12 months — "9 months → 9/12 × £1,000,000 =
 * £750,000". Not on cars, pre-owned items or gifts; only in the period bought.
 *
 * First-year allowances, effective-dated: full expensing (100%) and the 50%
 * special-rate FYA for companies from 1 April 2023; the super-deduction (130%)
 * for companies from 1 April 2021 to 31 March 2023; the 40% FYA for plant
 * bought on or after 1 January 2026 that is new and unused, main-rate and not
 * a car, with WDA on the remaining 60% from the NEXT period; 100% FYA for new
 * zero-emission cars.
 *
 * Business cars are routed by CO₂ and purchase date, the page's own table:
 *   from April 2021:        new 0 g/km or electric → 100% FYA; ≤50 → main; >50 → special
 *   April 2018 - April 2021: new ≤50 → 100% FYA; ≤110 → main; >110 → special
 *   April 2015 - April 2018: new ≤75 → 100% FYA; ≤130 → main; >130 → special
 *
 * Small pools allowance: where the main or special rate pool balance is £1,000
 * or less BEFORE the allowance is worked out, the whole balance may be claimed
 * instead of WDA (either, never both); not for single-asset pools; the £1,000
 * is pro-rated like the AIA ("9 months → 9/12 × £1,000 = £750").
 *
 * Disposal: proceeds come out of the pool, capped at original cost; where the
 * deduction exceeds the balance the difference is a balancing charge.
 *
 * Reference: https://www.gov.uk/capital-allowances
 * Reference: https://www.gov.uk/capital-allowances/annual-investment-allowance
 * Reference: https://www.gov.uk/capital-allowances/40-first-year-allowance
 * Reference: https://www.gov.uk/capital-allowances/business-cars
 * Reference: https://www.gov.uk/work-out-capital-allowances/rates-and-pools
 * Reference: https://www.gov.uk/work-out-capital-allowances/work-out-what-you-can-claim
 */

import { toYmd } from '../data/rateLedger';
import {
  computeBalancingAdjustment,
  computeDeclineInValue,
  resolveEffectiveDated,
  sortNewestFirst,
  type AssetFieldSpec,
  type BalancingAdjustmentInput,
  type BalancingAdjustmentOutcome,
  type DeclineInValueInput,
  type DeclineInValueOutcome,
  type DepreciationExplainer,
  type EffectiveDatedRow,
  type EffectiveLifeCategory,
  type FirstYearConcession,
  type InstantAssetWriteOffInfo,
  type PooledAllowanceRules,
  type UkAiaOutcome,
  type UkAssetInput,
  type UkEligibilityOutcome,
  type UkFirstYearAllowanceOutcome,
  type UkPeriod,
  type UkPool,
  type UkPoolAssignment,
  type UkSmallPoolsOutcome,
  type UkTaxpayerType,
  type UkWdaRateOutcome,
} from '../depreciation';

const GOV_UK = 'https://www.gov.uk';
const HMRC_OVERVIEW = `${GOV_UK}/capital-allowances`;
const HMRC_AIA = `${GOV_UK}/capital-allowances/annual-investment-allowance`;
const HMRC_FYA_40 = `${GOV_UK}/capital-allowances/40-first-year-allowance`;
const HMRC_BUSINESS_CARS = `${GOV_UK}/capital-allowances/business-cars`;
const HMRC_RATES_AND_POOLS = `${GOV_UK}/work-out-capital-allowances/rates-and-pools`;
const HMRC_WHAT_YOU_CAN_CLAIM = `${GOV_UK}/work-out-capital-allowances/work-out-what-you-can-claim`;

const DAY_MS = 86_400_000;
const FLOOR = '1900-01-01';

// ─── Dates ──────────────────────────────────────────────────────────────────

function ymdToUtcMs(ymd: string): number {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(5, 7));
  const d = Number(ymd.slice(8, 10));
  const ms = Date.UTC(y, m - 1, d);
  if (!Number.isFinite(ms)) throw new RangeError(`Unreadable date: ${ymd}`);
  return ms;
}

/** Days from `from` to `to`, both inclusive. */
function daysInclusive(from: string, to: string): number {
  return Math.round((ymdToUtcMs(to) - ymdToUtcMs(from)) / DAY_MS) + 1;
}

function addDays(ymd: string, days: number): string {
  return new Date(ymdToUtcMs(ymd) + days * DAY_MS).toISOString().slice(0, 10);
}

function readPeriod(period: UkPeriod): { start: string; end: string; days: number } {
  const start = toYmd(period.periodStart);
  const end = toYmd(period.periodEnd);
  const days = daysInclusive(start, end);
  if (days < 1) {
    throw new RangeError(`periodEnd must be on or after periodStart (received ${start} – ${end})`);
  }
  return { start, end, days };
}

/**
 * The fraction of a year a period is, HMRC's way: whole months over twelve
 * where the period runs from the first of a month to the last of a month
 * ("9 months → 9/12"), days over 365 otherwise. Exactly 1 for any 12-month
 * period, leap year or not.
 */
export function ukPeriodYearFraction(period: UkPeriod): { fraction: number; months: number | null; days: number } {
  const { start, end, days } = readPeriod(period);
  const startsOnFirst = start.slice(8, 10) === '01';
  const endsOnLast = addDays(end, 1).slice(8, 10) === '01';
  if (startsOnFirst && endsOnLast) {
    const months =
      (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 +
      (Number(end.slice(5, 7)) - Number(start.slice(5, 7))) +
      1;
    return { fraction: months / 12, months, days };
  }
  return { fraction: days / 365, months: null, days };
}

/** The first day the April change applies, by calendar: 1 April (CT) or 6 April (IT). */
function aprilChange(year: number, taxpayer: UkTaxpayerType): string {
  return `${year}-04-${taxpayer === 'corporation_tax' ? '01' : '06'}`;
}

// ─── Writing-down allowance rates ───────────────────────────────────────────

export const UK_MAIN_POOL_WDA_BEFORE_APRIL_2026 = 0.18;
export const UK_MAIN_POOL_WDA_FROM_APRIL_2026 = 0.14;
export const UK_SPECIAL_RATE_POOL_WDA = 0.06;
/** The year the main pool rate fell from 18% to 14%: 1 April for CT, 6 April for IT. */
export const UK_MAIN_POOL_WDA_CHANGE_YEAR = 2026;

/**
 * The WDA rate for a pool over a period. The main pool is 18% before the
 * April 2026 change and 14% from it; a period that straddles the change
 * takes a hybrid rate — the two rates weighted by the days of the period on
 * each side. The special rate pool is 6% throughout. A single-asset pool
 * takes the rate of the pool the asset would otherwise be in, which the
 * caller knows and this function does not: ask for `main` or `special`.
 */
export function ukWdaRate(pool: UkPool, period: UkPeriod & { taxpayer: UkTaxpayerType }): UkWdaRateOutcome {
  const { start, end, days } = readPeriod(period);
  if (pool === 'special') {
    return {
      rate: UK_SPECIAL_RATE_POOL_WDA,
      verified: true,
      note: 'Special rate pool: writing-down allowance of 6% a year on the written down value.',
    };
  }
  if (pool === 'single') {
    throw new RangeError(
      'A single-asset pool takes the rate of the pool the asset would otherwise join: ask ukWdaRate for "main" or "special".',
    );
  }
  const change = aprilChange(UK_MAIN_POOL_WDA_CHANGE_YEAR, period.taxpayer);
  const changeLabel = period.taxpayer === 'corporation_tax' ? '1 April 2026' : '6 April 2026';
  if (end < change) {
    return {
      rate: UK_MAIN_POOL_WDA_BEFORE_APRIL_2026,
      verified: true,
      note: `Main pool: writing-down allowance of 18% a year for periods ending before ${changeLabel}.`,
    };
  }
  if (start >= change) {
    return {
      rate: UK_MAIN_POOL_WDA_FROM_APRIL_2026,
      verified: true,
      note: `Main pool: writing-down allowance of 14% a year for periods starting on or after ${changeLabel}.`,
    };
  }
  const daysBefore = daysInclusive(start, addDays(change, -1));
  const daysAfter = days - daysBefore;
  const rate =
    (UK_MAIN_POOL_WDA_BEFORE_APRIL_2026 * daysBefore + UK_MAIN_POOL_WDA_FROM_APRIL_2026 * daysAfter) / days;
  return {
    rate,
    hybrid: {
      before: UK_MAIN_POOL_WDA_BEFORE_APRIL_2026,
      after: UK_MAIN_POOL_WDA_FROM_APRIL_2026,
      daysBefore,
      daysAfter,
    },
    verified: true,
    note:
      `Main pool: this period straddles the ${changeLabel} change from 18% to 14%, so a hybrid rate ` +
      `applies — 18% for ${daysBefore} days and 14% for ${daysAfter} days of ${days}.`,
  };
}

// ─── Annual investment allowance — effective-dated ──────────────────────────

export interface UkAiaRow extends EffectiveDatedRow {
  /** The annual limit in pounds, or null where it is not recorded here. */
  limit: number | null;
  verified: boolean;
  note: string;
}

/**
 * gov.uk's AIA table. £1,000,000 from 1 January 2019 is the current figure;
 * the two earlier rows are the page's own. Before April 2014 the limit
 * changed several times and is not recorded here: a period that far back
 * resolves to an unverified null rather than a number.
 */
export const UK_AIA_ROWS: UkAiaRow[] = [
  {
    effectiveFrom: '2019-01-01',
    limit: 1_000_000,
    verified: true,
    note: 'Annual investment allowance of £1,000,000 from 1 January 2019.',
  },
  {
    effectiveFrom: '2016-01-01',
    limit: 200_000,
    verified: true,
    note: 'Annual investment allowance of £200,000 from 1 January 2016 to 31 December 2018.',
  },
  {
    effectiveFrom: '2014-04-01',
    limit: 500_000,
    verified: true,
    note: 'Annual investment allowance of £500,000 from April 2014 to 31 December 2015.',
  },
  {
    effectiveFrom: FLOOR,
    limit: null,
    verified: false,
    note:
      'The annual investment allowance limit before April 2014 is not recorded here. Check the ' +
      'historical table on gov.uk or ask your accountant.',
  },
];

const UK_AIA_ROWS_NEWEST_FIRST: readonly UkAiaRow[] = sortNewestFirst(UK_AIA_ROWS);

const AIA_EXCLUSIONS =
  'It cannot be claimed on cars, on items you owned before you used them in the business, or on ' +
  'items given to you, and only in the period you bought the item.';

/**
 * The AIA for a period: the annual limit in force, pro-rated where the period
 * is not 12 months. A period that straddles a change in the annual limit has
 * transitional rules this module does not model, so it returns the
 * time-weighted figure as `verified: false` with a note.
 */
export function ukAia(period: UkPeriod): UkAiaOutcome {
  const { start, end } = readPeriod(period);
  const atStart = resolveEffectiveDated(UK_AIA_ROWS_NEWEST_FIRST, start);
  const atEnd = resolveEffectiveDated(UK_AIA_ROWS_NEWEST_FIRST, end);
  const { fraction, months } = ukPeriodYearFraction(period);
  const proRated = fraction !== 1;
  const lengthText = months != null ? `${months} months` : `${daysInclusive(start, end)} days`;

  if (atStart.limit == null || atEnd.limit == null) {
    return { limit: null, annualLimit: null, proRated, verified: false, note: atStart.note };
  }
  if (atStart !== atEnd) {
    const daysBefore = daysInclusive(start, addDays(atEnd.effectiveFrom, -1));
    const daysAfter = daysInclusive(atEnd.effectiveFrom, end);
    const weighted =
      ((atStart.limit * daysBefore + atEnd.limit * daysAfter) / (daysBefore + daysAfter)) * fraction;
    return {
      limit: Math.round(weighted),
      annualLimit: atEnd.limit,
      proRated: true,
      verified: false,
      note:
        `This period straddles the change in the annual investment allowance on ${atEnd.effectiveFrom}. ` +
        'HMRC applies transitional rules to a straddling period that are not modelled here; the ' +
        'figure shown is a simple time-weighting. Confirm the limit with HMRC or your accountant.',
    };
  }
  const limit = Math.round(atStart.limit * fraction);
  return {
    limit,
    annualLimit: atStart.limit,
    proRated,
    verified: atStart.verified,
    note: proRated
      ? `${atStart.note} This period is ${lengthText}, so the limit is pro-rated to £${limit.toLocaleString('en-GB')}. ${AIA_EXCLUSIONS}`
      : `${atStart.note} ${AIA_EXCLUSIONS}`,
  };
}

/** The annual AIA figure in force on a date — the un-pro-rated limit, for a date rather than a period. */
export function ukAiaOnDate(onDate: Date | string): InstantAssetWriteOffInfo {
  const row = resolveEffectiveDated(UK_AIA_ROWS_NEWEST_FIRST, toYmd(onDate));
  return {
    limit: row.limit,
    verified: row.verified,
    note: row.limit == null ? row.note : `${row.note} Pro-rated where the accounting period is not 12 months. ${AIA_EXCLUSIONS}`,
  };
}

// ─── Small pools allowance ──────────────────────────────────────────────────

export const UK_SMALL_POOLS_ANNUAL_LIMIT = 1_000;

/**
 * "You can claim the full amount if the balance in your main or special rate
 * pool is £1,000 or less before you work out your allowance." Not for
 * single-asset pools; either this or WDA, never both; pro-rated for a period
 * that is not 12 months.
 */
export function ukSmallPoolsAllowance(period: UkPeriod): UkSmallPoolsOutcome {
  const { fraction, months, days } = ukPeriodYearFraction(period);
  const limit = Math.round(UK_SMALL_POOLS_ANNUAL_LIMIT * fraction);
  const proRated = fraction !== 1;
  return {
    limit,
    annualLimit: UK_SMALL_POOLS_ANNUAL_LIMIT,
    proRated,
    verified: true,
    note:
      'Small pools allowance: where the balance in the main or special rate pool is ' +
      `£${limit.toLocaleString('en-GB')} or less before the allowance is worked out` +
      (proRated ? ` (£1,000 pro-rated for a ${months != null ? `${months}-month` : `${days}-day`} period)` : '') +
      ', the whole balance can be claimed instead of a writing-down allowance — one or the other, ' +
      'not both. It does not apply to single-asset pools.',
  };
}

// ─── Business cars — CO₂ bands by purchase date ─────────────────────────────

export interface UkCarBandRow extends EffectiveDatedRow {
  /** A NEW car at or under this CO₂ gets the 100% first-year allowance. */
  fya100NewUpTo: number;
  /** A car at or under this CO₂ goes to the main pool; above it, the special rate pool. */
  mainRateUpTo: number;
  verified: boolean;
  note: string;
}

/**
 * gov.uk's business-cars table, verbatim in substance. Rows are keyed by the
 * Corporation Tax calendar (1 April); `ukPoolFor` shifts to 6 April for an
 * income-tax taxpayer. Before April 2015 the bands are not recorded here.
 */
export const UK_CAR_BAND_ROWS: UkCarBandRow[] = [
  {
    effectiveFrom: '2021-04-01',
    fya100NewUpTo: 0,
    mainRateUpTo: 50,
    verified: true,
    note:
      'Cars bought from April 2021: new and unused with 0 g/km CO₂ (or fully electric) — 100% ' +
      'first-year allowance; 50 g/km or less — main rate; over 50 g/km — special rate.',
  },
  {
    effectiveFrom: '2018-04-01',
    fya100NewUpTo: 50,
    mainRateUpTo: 110,
    verified: true,
    note:
      'Cars bought April 2018 to April 2021: new and unused with 50 g/km or less — 100% first-year ' +
      'allowance; 110 g/km or less — main rate; over 110 g/km — special rate.',
  },
  {
    effectiveFrom: '2015-04-01',
    fya100NewUpTo: 75,
    mainRateUpTo: 130,
    verified: true,
    note:
      'Cars bought April 2015 to April 2018: new and unused with 75 g/km or less — 100% first-year ' +
      'allowance; 130 g/km or less — main rate; over 130 g/km — special rate.',
  },
];

const UK_CAR_BAND_ROWS_NEWEST_FIRST: readonly UkCarBandRow[] = sortNewestFirst(UK_CAR_BAND_ROWS);

/** The car band row in force on a date, or null before April 2015. */
export function ukCarBand(onDate: Date | string, taxpayer?: UkTaxpayerType | null): UkCarBandRow | null {
  let ymd = toYmd(onDate);
  // The income-tax calendar starts each band on 6 April, not 1 April: a
  // purchase on 3 April 2021 by a sole trader is still in the 2018 band.
  if (taxpayer === 'income_tax' && ymd.slice(5, 10) >= '04-01' && ymd.slice(5, 10) < '04-06') {
    ymd = addDays(ymd, -5);
  }
  const row = UK_CAR_BAND_ROWS_NEWEST_FIRST.find((r) => r.effectiveFrom <= ymd);
  return row ?? null;
}

// ─── Pool routing ───────────────────────────────────────────────────────────

const SPECIAL_RATE_ITEMS =
  'integral features of a building, long-life assets, solar panels, thermal insulation';

/**
 * Which pool an asset joins. A single-asset election or private use wins;
 * cars are routed by CO₂ and purchase date; special-rate items go to the
 * special rate pool; everything else is main. A car with no CO₂ figure
 * cannot be routed and comes back unverified.
 */
export function ukPoolFor(asset: UkAssetInput, onDate: Date | string): UkPoolAssignment {
  if (asset.singleAssetPool === true) {
    return {
      pool: 'single',
      verified: true,
      note:
        'Single-asset pool: a short-life asset election or private use keeps this asset in a pool of ' +
        'its own, at the rate of the pool it would otherwise join, with its own balancing adjustment on disposal.',
    };
  }
  if (asset.isCar === true) {
    const band = ukCarBand(onDate, asset.taxpayerType);
    if (!band) {
      return {
        pool: 'main',
        verified: false,
        note:
          'The CO₂ bands for cars bought before April 2015 are not recorded here. Check the table on ' +
          'gov.uk (Business cars) for the pool this car belongs in.',
      };
    }
    const co2 = asset.co2GPerKm;
    if (co2 == null || !Number.isFinite(Number(co2))) {
      return {
        pool: 'main',
        verified: false,
        note:
          'A car is routed to a pool by its CO₂ figure and purchase date. Enter the official CO₂ g/km ' +
          '(0 for a fully electric car) to place it. ' +
          band.note,
      };
    }
    const pool: UkPool = Number(co2) <= band.mainRateUpTo ? 'main' : 'special';
    return { pool, verified: true, note: band.note };
  }
  if (asset.isSpecialRate === true) {
    return {
      pool: 'special',
      verified: true,
      note: `Special rate pool (${SPECIAL_RATE_ITEMS}): writing-down allowance of 6% a year.`,
    };
  }
  return {
    pool: 'main',
    verified: true,
    note: 'Main pool: most plant and machinery, written down at the main rate.',
  };
}

// ─── First-year allowances — effective-dated ────────────────────────────────

export const UK_FYA_40_START = '2026-01-01';
export const UK_FULL_EXPENSING_START = '2023-04-01';
export const UK_SUPER_DEDUCTION_START = '2021-04-01';
export const UK_SUPER_DEDUCTION_END = '2023-03-31';

const NOT_NEW_NOTE =
  'First-year allowances for plant apply to items bought new and unused. Tick "bought new" if this ' +
  'was not second-hand; otherwise it joins the pool for writing-down allowances.';

/**
 * The best first-year allowance an asset qualifies for on its purchase date,
 * or null where there is none — the asset then takes AIA (if eligible) or
 * joins its pool.
 *
 * Where the answer depends on a fact the register has not recorded — the
 * taxpayer type, because full expensing is for companies only — the result
 * is `percent: null, verified: false` with a note saying what to record,
 * rather than a guess in either direction.
 */
export function ukFirstYearAllowance(
  asset: UkAssetInput,
  onDate: Date | string,
): UkFirstYearAllowanceOutcome | null {
  const ymd = toYmd(onDate);
  const eligibility = ukEligibility(asset);
  if (!eligibility.eligible) return null;

  if (asset.isCar === true) {
    const band = ukCarBand(ymd, asset.taxpayerType);
    if (!band) return null;
    const co2 = asset.co2GPerKm;
    if (asset.isNew === true && co2 != null && Number.isFinite(Number(co2)) && Number(co2) <= band.fya100NewUpTo) {
      return {
        percent: 100,
        kind: 'fya_100_zero_emission_car',
        remainderToPool: 0,
        pool: 'main',
        verified: true,
        note: `100% first-year allowance: a new and unused car at ${Number(co2)} g/km. ${band.note}`,
      };
    }
    return null;
  }

  if (asset.isNew !== true) {
    return null;
  }
  const company = asset.taxpayerType === 'corporation_tax';
  const special = asset.isSpecialRate === true;
  const pool: UkPool = special ? 'special' : 'main';

  if (ymd >= UK_FULL_EXPENSING_START) {
    if (company) {
      return special
        ? {
            percent: 50,
            kind: 'fya_50_special_rate',
            remainderToPool: 50,
            pool,
            verified: true,
            note:
              '50% first-year allowance for companies on new special rate plant bought from 1 April 2023. ' +
              'The remaining 50% joins the special rate pool for writing-down allowances from the next period.',
          }
        : {
            percent: 100,
            kind: 'full_expensing',
            remainderToPool: 0,
            pool,
            verified: true,
            note: 'Full expensing: companies can deduct 100% of the cost of new main rate plant bought from 1 April 2023.',
          };
    }
    if (asset.taxpayerType == null) {
      return {
        percent: null,
        kind: null,
        remainderToPool: 100,
        pool,
        verified: false,
        note:
          'Whether this asset gets full expensing depends on who is claiming: a company can deduct ' +
          '100% of new main rate plant (50% for special rate plant) under full expensing, while a sole ' +
          'trader or partnership on traditional accounting gets the 40% first-year allowance on new main ' +
          'rate plant bought from 1 January 2026. Record the taxpayer type to resolve it.',
      };
    }
  }

  if (ymd >= UK_FYA_40_START && !special) {
    return {
      percent: 40,
      kind: 'fya_40',
      remainderToPool: 60,
      pool: 'main',
      verified: true,
      note:
        '40% first-year allowance: plant bought on or after 1 January 2026 that is new and unused, main ' +
        'rate and not a car. Claim 40% of the cost now; the remaining 60% joins the main pool and gets ' +
        'the writing-down allowance from the next period.',
    };
  }

  if (company && ymd >= UK_SUPER_DEDUCTION_START && ymd <= UK_SUPER_DEDUCTION_END) {
    return special
      ? {
          percent: 50,
          kind: 'fya_50_special_rate',
          remainderToPool: 50,
          pool,
          verified: true,
          note:
            '50% special rate first-year allowance for companies on new special rate plant bought ' +
            '1 April 2021 to 31 March 2023. The remaining 50% joins the special rate pool.',
        }
      : {
          percent: 130,
          kind: 'super_deduction',
          remainderToPool: 0,
          pool,
          verified: true,
          note: 'Super-deduction: companies could deduct 130% of the cost of new main rate plant bought 1 April 2021 to 31 March 2023.',
        };
  }

  return null;
}

// ─── Cash basis ─────────────────────────────────────────────────────────────

export const UK_CASH_BASIS_RESTRICTION = {
  carsOnly: true,
  note:
    'If you are a sole trader or partnership and you use the cash basis, you can only claim capital ' +
    'allowances on business cars. Everything else you buy for the business is simply an expense in ' +
    'the year you pay for it.',
} as const;

export function ukCashBasisRestriction(): { carsOnly: true; note: string } {
  return { ...UK_CASH_BASIS_RESTRICTION };
}

/** The cash-basis gate, per asset: a cash-basis trader can claim on cars and nothing else. */
export function ukEligibility(asset: UkAssetInput): UkEligibilityOutcome {
  if (asset.cashBasis === true && asset.isCar !== true) {
    return {
      eligible: false,
      note:
        `${UK_CASH_BASIS_RESTRICTION.note} This asset is not a car, so it does not go in a capital ` +
        'allowances pool — claim it as an expense instead.',
    };
  }
  return { eligible: true, note: 'Qualifies for capital allowances.' };
}

// ─── Explainer ──────────────────────────────────────────────────────────────

/**
 * HMRC's own terms — "written down value", "pool", "writing-down allowance",
 * "annual investment allowance", "balancing charge" — in Fin's voice. The
 * cash-basis line is first because for most readers it is the whole story.
 * Links are gov.uk pages only.
 */
const UK_EXPLAINER: DepreciationExplainer = {
  whatItIs:
    'Capital allowances let you deduct the cost of equipment you keep for more than a year — but ' +
    'HMRC groups it into pools and you claim on the pool, not on each item.',
  whenItApplies:
    'If you are a sole trader on the cash basis, this only applies to business cars — other ' +
    'equipment is simply an expense. On traditional accounting, most kit is covered in full by the ' +
    'annual investment allowance (£1,000,000 a year, pro-rated for a shorter period), and what ' +
    'that does not cover joins a pool.',
  howItWorks: [
    'Add each purchase to its pool: the main pool for most plant, the special rate pool for integral features and long-life assets, and cars by their CO₂ figure and purchase date.',
    'Claim the annual investment allowance against what qualifies (not cars, not second-hand items) and any first-year allowance — 40% on new main rate plant bought from 1 January 2026, with the other 60% written down from the next period.',
    "Take disposal proceeds out of the pool, capped at what the item cost. If that takes the pool below zero, the difference is a balancing charge on your return.",
    'Claim the writing-down allowance on what is left: 18% of the main pool (14% from April 2026) and 6% of the special rate pool. A main or special rate pool at £1,000 or less can be claimed in full instead. The remainder is the written down value you carry forward.',
  ],
  readMore: [
    { label: 'Capital allowances: overview', url: HMRC_OVERVIEW, authority: 'HMRC' },
    { label: 'Annual investment allowance', url: HMRC_AIA, authority: 'HMRC' },
    { label: '40% first-year allowance', url: HMRC_FYA_40, authority: 'HMRC' },
    { label: 'Business cars', url: HMRC_BUSINESS_CARS, authority: 'HMRC' },
    { label: 'Rates and pools', url: HMRC_RATES_AND_POOLS, authority: 'HMRC' },
    { label: 'Work out what you can claim', url: HMRC_WHAT_YOU_CAN_CLAIM, authority: 'HMRC' },
  ],
  vocabulary: {
    asset: 'Asset',
    decline: 'Writing-down allowance',
    writtenDown: 'Written down value',
    rate: 'Rate',
    rateBasis: 'Pool',
  },
};

const UK_EXTRA_ASSET_FIELDS: AssetFieldSpec[] = [
  {
    key: 'taxpayerType',
    label: 'Who is claiming',
    type: 'enum',
    required: false,
    options: [
      { value: 'income_tax', label: 'Sole trader or partnership (Income Tax)' },
      { value: 'corporation_tax', label: 'Company (Corporation Tax)' },
    ],
    help:
      'Sets which April the 14% main pool rate starts (6 April 2026 for Income Tax, 1 April 2026 for ' +
      'Corporation Tax) and whether full expensing, which is for companies only, applies.',
  },
  {
    key: 'isCar',
    label: 'This is a car',
    type: 'boolean',
    required: false,
    help:
      'Cars (not vans, lorries or motorcycles) are placed in a pool by CO₂ and purchase date, and are ' +
      'the only assets a cash-basis sole trader can claim capital allowances on.',
  },
  {
    key: 'co2GPerKm',
    label: 'CO₂ emissions (g/km)',
    type: 'number',
    required: false,
    help:
      'For cars only. The official CO₂ figure; enter 0 for a fully electric car. From April 2021, ' +
      '50 g/km or less goes to the main pool and over 50 g/km to the special rate pool.',
  },
  {
    key: 'isNew',
    label: 'Bought new and unused',
    type: 'boolean',
    required: false,
    help:
      'The 40% first-year allowance, full expensing and the 100% allowance for zero-emission cars ' +
      'apply to new and unused items only. Leave this off for a second-hand purchase.',
  },
];

// ─── Rules object ───────────────────────────────────────────────────────────

export const UK_DEPRECIATION_RULES: PooledAllowanceRules = {
  countryCode: 'GB',
  regime: 'pooled_allowance',
  // The unit is the pool: there is no per-asset prime cost or diminishing value here.
  methods: ['pool', 'immediate_writeoff'],
  defaultMethod: 'pool',

  /** Periods are apportioned by whole months or days over 365; this is informational only. */
  dayFractionDenominator(): number {
    return 365;
  },

  /**
   * One period's writing-down allowance on a pool balance, for a host that
   * only has the per-asset interface: pass the pool's written down value as
   * `openingAdjustableValue` and the rate from `wdaRate()` as `annualRate`.
   * Not apportioned by days — the rate is already hybrid where it needs to
   * be. For the full AIA / FYA / disposal order use `computePoolPeriod`.
   */
  declineInValue(input: DeclineInValueInput): DeclineInValueOutcome {
    if (input.method === 'immediate_writeoff') {
      return computeDeclineInValue({ ...input, partYear: { kind: 'months', monthsUsed: 12 } });
    }
    if (input.method !== 'pool') {
      throw new RangeError(
        `The United Kingdom writes plant down by POOL, not per asset: method "${String(input.method)}" ` +
          'is not available. Use `pool` with `annualRate` from wdaRate(), or computePoolPeriod().',
      );
    }
    if (input.annualRate == null) {
      throw new RangeError(
        'Pass `annualRate` — the writing-down allowance rate from wdaRate(pool, period) — for a UK pool.',
      );
    }
    const rate = input.annualRate;
    return computeDeclineInValue(
      { ...input, method: 'pool', partYear: { kind: 'months', monthsUsed: 12 } },
      { allocationYear: rate, ongoing: rate },
    );
  },

  /** HMRC publishes pool rates, not effective lives. */
  effectiveLife(): number | null {
    return null;
  },

  effectiveLifeCategories(): EffectiveLifeCategory[] {
    return [];
  },

  /** The UK's "write-off" is the annual investment allowance: the annual figure in force on the date. */
  instantAssetWriteOff(onDate: Date | string): InstantAssetWriteOffInfo {
    return ukAiaOnDate(onDate);
  },

  poolFor(asset: UkAssetInput, onDate: Date | string): UkPoolAssignment {
    return ukPoolFor(asset, onDate);
  },

  wdaRate(pool: UkPool, period: UkPeriod & { taxpayer: UkTaxpayerType }): UkWdaRateOutcome {
    return ukWdaRate(pool, period);
  },

  aia(period: UkPeriod): UkAiaOutcome {
    return ukAia(period);
  },

  firstYearAllowance(asset: UkAssetInput, onDate: Date | string): UkFirstYearAllowanceOutcome | null {
    return ukFirstYearAllowance(asset, onDate);
  },

  cashBasisRestriction() {
    return ukCashBasisRestriction();
  },

  eligibility(asset: UkAssetInput): UkEligibilityOutcome {
    return ukEligibility(asset);
  },

  smallPoolsAllowance(period: UkPeriod): UkSmallPoolsOutcome {
    return ukSmallPoolsAllowance(period);
  },

  /** Proceeds (capped at cost by the caller) less written down value: a balancing charge or allowance. */
  balancingAdjustment(input: BalancingAdjustmentInput): BalancingAdjustmentOutcome {
    return computeBalancingAdjustment(input);
  },

  explainer(): DepreciationExplainer {
    return {
      ...UK_EXPLAINER,
      howItWorks: [...UK_EXPLAINER.howItWorks],
      readMore: UK_EXPLAINER.readMore.map((r) => ({ ...r })),
      vocabulary: { ...UK_EXPLAINER.vocabulary },
    };
  },

  firstYearConcessions(onDate: Date | string): FirstYearConcession[] {
    const ymd = toYmd(onDate);
    const aia = ukAiaOnDate(ymd);
    const out: FirstYearConcession[] = [
      {
        key: 'annual_investment_allowance',
        label: 'Annual investment allowance',
        kind: 'threshold_write_off',
        limit: aia.limit,
        percent: null,
        verified: aia.verified,
        note: aia.note,
      },
    ];
    if (ymd >= UK_FULL_EXPENSING_START) {
      out.push({
        key: 'full_expensing',
        label: 'Full expensing (companies)',
        kind: 'upfront_percent',
        limit: null,
        percent: 100,
        verified: true,
        note: 'Companies can deduct 100% of the cost of new main rate plant bought from 1 April 2023 (50% for special rate plant).',
        requiresField: 'taxpayerType',
      });
    }
    if (ymd >= UK_FYA_40_START) {
      out.push({
        key: 'fya_40',
        label: '40% first-year allowance',
        kind: 'upfront_percent',
        limit: null,
        percent: 40,
        verified: true,
        note:
          '40% of the cost of new and unused main rate plant (not cars) bought on or after 1 January 2026, ' +
          'with the remaining 60% written down from the next period.',
        requiresField: 'isNew',
      });
    }
    const band = ukCarBand(ymd);
    if (band) {
      out.push({
        key: 'fya_100_zero_emission_car',
        label: '100% first-year allowance for new low-emission cars',
        kind: 'upfront_percent',
        limit: null,
        percent: 100,
        verified: true,
        note: band.note,
        requiresField: 'co2GPerKm',
      });
    }
    return out;
  },

  extraAssetFields(): AssetFieldSpec[] {
    return UK_EXTRA_ASSET_FIELDS.map((f) => ({ ...f, options: f.options?.map((o) => ({ ...o })) }));
  },
};

/** The gov.uk pages these rules were read from. */
export const UK_DEPRECIATION_AUTHORITY_URLS = {
  overview: HMRC_OVERVIEW,
  annualInvestmentAllowance: HMRC_AIA,
  fya40: HMRC_FYA_40,
  businessCars: HMRC_BUSINESS_CARS,
  ratesAndPools: HMRC_RATES_AND_POOLS,
  workOutWhatYouCanClaim: HMRC_WHAT_YOU_CAN_CLAIM,
} as const;

export default UK_DEPRECIATION_RULES;
