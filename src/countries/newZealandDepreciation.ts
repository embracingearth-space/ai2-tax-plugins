/**
 * New Zealand — depreciation — ai2fin.com
 * Authority: Inland Revenue (IRD)
 *
 * New Zealand is a RATE-PER-ASSET regime, not an effective-life one. Inland
 * Revenue publishes a diminishing value (DV) rate and a straight line (SL)
 * rate for every asset in IR265 "General depreciation rates" (March 2026), and
 * the arithmetic is:
 *
 *   DV: cost × DV rate in year one; adjusted tax value (cost less depreciation
 *       claimed) × DV rate each year after.
 *   SL: cost × SL rate every year.
 *
 * Worked example, IRD's own: a $10,000 espresso machine at 30% DV claims
 * $3,000 in year one and carries an adjusted tax value of $7,000.
 *
 * PART YEARS ARE WHOLE MONTHS, NOT DAYS. "Count part-months as whole months.
 * Depreciation × months used ÷ 12." Bought 20 May in an April–March year is
 * 11 months, so $3,000 × 11 ÷ 12 = $2,750. Not 10 months, and not a day
 * fraction — the Australian 365-day convention is wrong here by design, so the
 * rules below REFUSE a days-based input rather than silently computing an ATO
 * number for an IRD return.
 *
 * Two first-year concessions, both effective-dated, both read from IRD's
 * "Claiming depreciation" page on 2026-08-23:
 *   • Low value asset threshold — claim the whole cost straight away under the
 *     limit: $500 up to 16 March 2020, $5,000 from 17 March 2020 to 16 March
 *     2021 (temporary), $1,000 from 17 March 2021 onwards.
 *   • Investment Boost — "From 22 May 2025, you can claim 20% of the cost of
 *     new assets as an expense, then claim depreciation as usual on the
 *     remaining 80%." New assets only, hence the `isNewAsset` field.
 *
 * GST: "If you're registered for GST, you claim depreciation on the price of
 * the asset less the GST charged." Business-use % applies to the claim, not to
 * the adjusted tax value — the same discipline as the AU module.
 *
 * Pooling is described, not computed: low value assets may be pooled; DV only;
 * the lowest rate in the pool; not buildings; once in, an asset cannot come
 * out. The pool arithmetic is a later task, so `pool` is not in `methods`.
 *
 * Reference: https://www.ird.govt.nz/income-tax/income-tax-for-businesses-and-organisations/types-of-business-expenses/depreciation/claiming-depreciation
 * Reference: https://www.ird.govt.nz/income-tax/income-tax-for-businesses-and-organisations/types-of-business-expenses/depreciation/claiming-depreciation/work-out-diminishing-value-depreciation
 * Reference: https://www.ird.govt.nz/income-tax/income-tax-for-businesses-and-organisations/types-of-business-expenses/new-assets---investment-boost
 * Reference: https://www.ird.govt.nz/-/media/project/ir/home/documents/forms-and-guides/ir200---ir299/ir265/ir265-march-2026.pdf
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
  type RatePerAssetRules,
} from '../depreciation';

const IRD_DEPRECIATION_BASE =
  'https://www.ird.govt.nz/income-tax/income-tax-for-businesses-and-organisations/types-of-business-expenses';
const IRD_CLAIMING_DEPRECIATION = `${IRD_DEPRECIATION_BASE}/depreciation/claiming-depreciation`;
const IRD_DIMINISHING_VALUE = `${IRD_CLAIMING_DEPRECIATION}/work-out-diminishing-value-depreciation`;
const IRD_STRAIGHT_LINE = `${IRD_CLAIMING_DEPRECIATION}/work-out-straight-line-depreciation`;
const IRD_INVESTMENT_BOOST = `${IRD_DEPRECIATION_BASE}/new-assets---investment-boost`;
const IRD_IR265_PDF =
  'https://www.ird.govt.nz/-/media/project/ir/home/documents/forms-and-guides/ir200---ir299/ir265/ir265-march-2026.pdf';

/** The rate source in force. Every rate below was read out of this document. */
export const NZ_RATE_SOURCE = 'IR265 General depreciation rates (March 2026)';

// ─── Rates per asset — IR265 ────────────────────────────────────────────────

/**
 * An IR265 row: estimated useful life in years (informational — the RATE is
 * what is applied, not a life), and the DV and SL rates as fractions so they
 * pass straight into `declineInValue` as `annualRate`.
 */
export interface NzRateCategory extends EffectiveLifeCategory {
  /** Diminishing value rate, as a fraction (0.3 = 30%). */
  dv: number;
  /** Straight line rate, as a fraction. */
  sl: number;
  /** IR265 page, category heading and the asset description exactly as printed. */
  source: string;
}

function ir265(page: number, heading: string, description: string): string {
  return `${NZ_RATE_SOURCE}, p.${page}, "${heading}": "${description}"`;
}

const HOTS = 'Hotels, motels, restaurants, cafes, taverns and takeaway bars (HOTS)';
const COMP = 'Computers (COMP)';
const OFUR = 'Office equipment and furniture (OFUR)';
const TRAN = 'Transportation (TRAN)';

/**
 * A SHORT, VERIFIED list. Every row was read from the IR265 March 2026 PDF
 * itself — the page rendered and the three columns checked by eye, because a
 * text extraction of that document misaligns columns between rows. Assets not
 * on this list are not missing by accident: look them up in IR265 or IRD's
 * depreciation rate finder rather than guessing, because a wrong rate is a
 * wrong deduction every year for the life of the asset.
 *
 * `years` is IR265's "Est useful life" column, kept for the schedule's
 * rate-basis column. It is NOT used to derive a rate — NZ applies the
 * published rate directly.
 */
export const NZ_RATE_CATEGORIES: NzRateCategory[] = [
  // Hotels, motels, restaurants, cafes, taverns and takeaway bars — p.20
  {
    key: 'coffee_maker',
    label: 'Coffee maker (espresso machine)',
    years: 6.66,
    dv: 0.3,
    sl: 0.21,
    source: ir265(20, HOTS, 'Coffee makers'),
  },
  // Computers — p.47
  {
    key: 'computer_laptop',
    label: 'Laptop computer',
    years: 4,
    dv: 0.5,
    sl: 0.4,
    source: ir265(47, COMP, 'Laptop computers'),
  },
  {
    key: 'computer_desktop',
    label: 'Personal computer (desktop)',
    years: 4,
    dv: 0.5,
    sl: 0.4,
    source: ir265(47, COMP, 'Personal computers'),
  },
  {
    key: 'computer_server',
    label: 'Network server',
    years: 4,
    dv: 0.5,
    sl: 0.4,
    source: ir265(47, COMP, 'Network servers'),
  },
  {
    key: 'network_router',
    label: 'Router',
    years: 4,
    dv: 0.5,
    sl: 0.4,
    source: ir265(47, COMP, 'Routers'),
  },
  {
    key: 'printer',
    label: 'Printer',
    years: 5,
    dv: 0.4,
    sl: 0.3,
    source: ir265(47, COMP, 'Printers'),
  },
  {
    key: 'tablet_or_smartphone',
    label: 'Tablet or smartphone',
    years: 3,
    dv: 0.67,
    sl: 0.67,
    source: ir265(
      47,
      COMP,
      'Tablet computers and electronic media storage devices (including smartphones, MP3 players and similar devices) - applies from 2013/14 and subsequent income years',
    ),
  },
  // Office equipment and furniture — pp.50-51
  {
    key: 'office_chair',
    label: 'Office chair',
    years: 12.5,
    dv: 0.16,
    sl: 0.105,
    source: ir265(50, OFUR, 'Chairs'),
  },
  {
    key: 'office_desk',
    label: 'Office desk',
    years: 15.5,
    dv: 0.13,
    sl: 0.085,
    source: ir265(50, OFUR, 'Desks'),
  },
  {
    key: 'filing_cabinet',
    label: 'Filing cabinet',
    years: 15.5,
    dv: 0.13,
    sl: 0.085,
    source: ir265(50, OFUR, 'Filing cabinets'),
  },
  {
    key: 'office_furniture_loose',
    label: 'Office furniture (loose)',
    years: 12.5,
    dv: 0.16,
    sl: 0.105,
    source: ir265(50, OFUR, 'Furniture (loose)'),
  },
  {
    key: 'mobile_phone',
    label: 'Mobile phone',
    years: 3,
    dv: 0.67,
    sl: 0.67,
    source: ir265(51, OFUR, 'Mobile telephones, including smartphones'),
  },
  {
    key: 'office_equipment_default',
    label: 'Office equipment (not listed elsewhere)',
    years: 5,
    dv: 0.4,
    sl: 0.3,
    source: ir265(51, OFUR, 'Office equipment (default class)'),
  },
  {
    key: 'photocopier',
    label: 'Photocopier',
    years: 5,
    dv: 0.4,
    sl: 0.3,
    source: ir265(51, OFUR, 'Photocopiers'),
  },
  {
    key: 'telephone_system',
    label: 'Telephone system',
    years: 6.66,
    dv: 0.3,
    sl: 0.21,
    source: ir265(51, OFUR, 'Telephone systems'),
  },
  // Transportation — p.55
  {
    key: 'motor_vehicle_car',
    label: 'Car (up to 12 seats)',
    years: 5,
    dv: 0.3,
    sl: 0.21,
    source: ir265(
      55,
      TRAN,
      'Motor vehicles (for transporting people, up to and including 12 seats) (residual value has been estimated at 25%)',
    ),
  },
  {
    key: 'light_commercial_vehicle',
    label: 'Ute or van (light goods, up to 3.5 tonnes)',
    years: 10,
    dv: 0.2,
    sl: 0.135,
    source: ir265(
      55,
      TRAN,
      'Motor vehicles - class NA (for transporting light goods, gross vehicle mass up to 3.5 tonnes)',
    ),
  },
];

const RATE_BY_KEY = new Map(NZ_RATE_CATEGORIES.map((c) => [c.key, c] as const));

export function nzRateFor(categoryKey: string): { dv: number; sl: number; source: string } | null {
  const row = RATE_BY_KEY.get(categoryKey);
  return row ? { dv: row.dv, sl: row.sl, source: row.source } : null;
}

// ─── Whole months ───────────────────────────────────────────────────────────

/**
 * Months used in the income year, IRD's way: from the month the asset was
 * bought (or first used for business) to the month the income year ends,
 * inclusive, with a part-month counted as a whole month. Bought on the 1st or
 * the 31st of May in an April–March year both give 11 — the day of the month
 * does not matter at all. An acquisition after the year end gives 0; a whole
 * year gives 12.
 *
 * `toYmd` reads a Date by its LOCAL calendar day, so a date built from local
 * parts lands in the month the caller sees.
 */
export function nzWholeMonthsUsed(
  acquiredOrFirstUsed: Date | string,
  incomeYearEnd: Date | string,
): number {
  const from = toYmd(acquiredOrFirstUsed);
  const to = toYmd(incomeYearEnd);
  const fromIndex = Number(from.slice(0, 4)) * 12 + Number(from.slice(5, 7));
  const toIndex = Number(to.slice(0, 4)) * 12 + Number(to.slice(5, 7));
  if (!Number.isFinite(fromIndex) || !Number.isFinite(toIndex)) {
    throw new RangeError(`Unreadable date: ${String(acquiredOrFirstUsed)} / ${String(incomeYearEnd)}`);
  }
  return Math.min(12, Math.max(0, toIndex - fromIndex + 1));
}

// ─── Low value asset threshold — effective-dated ────────────────────────────

export interface NzLowValueRow extends EffectiveDatedRow, InstantAssetWriteOffInfo {}

/**
 * IRD's table, verbatim in substance: up to 16 March 2020, $500; 17 March 2020
 * to 16 March 2021, $5,000 (temporary); 17 March 2021 onwards, $1,000. All
 * three rows are the page's own, so all three are verified. The thresholds
 * are keyed by the date the asset was bought.
 */
export const NZ_LOW_VALUE_ASSET_ROWS: NzLowValueRow[] = [
  {
    effectiveFrom: '2021-03-17',
    limit: 1000,
    verified: true,
    note:
      'Low value asset threshold of $1,000 for assets bought from 17 March 2021. An asset under ' +
      'the threshold is claimed in full as an expense in the year you buy it, rather than ' +
      'depreciated. Use the GST-exclusive cost if you are GST registered.',
  },
  {
    effectiveFrom: '2020-03-17',
    limit: 5000,
    verified: true,
    note:
      'Temporary low value asset threshold of $5,000 for assets bought from 17 March 2020 to ' +
      '16 March 2021. An asset under the threshold is claimed in full as an expense in the year ' +
      'you buy it.',
  },
  {
    effectiveFrom: '1900-01-01',
    limit: 500,
    verified: true,
    note:
      'Low value asset threshold of $500 for assets bought up to 16 March 2020. An asset under ' +
      'the threshold is claimed in full as an expense in the year you buy it.',
  },
];

/** Sorted once, at module load; the literal's order is never trusted. */
const NZ_LOW_VALUE_ROWS_NEWEST_FIRST: readonly NzLowValueRow[] = sortNewestFirst(
  NZ_LOW_VALUE_ASSET_ROWS,
);

export function nzLowValueThreshold(onDate: Date | string): InstantAssetWriteOffInfo {
  const row = resolveEffectiveDated(NZ_LOW_VALUE_ROWS_NEWEST_FIRST, toYmd(onDate));
  return { limit: row.limit, verified: row.verified, note: row.note };
}

// ─── Investment Boost — effective-dated ─────────────────────────────────────

export interface NzInvestmentBoostInfo {
  /** 0-100, or null where no Investment Boost applies on that date. */
  percent: number | null;
  verified: boolean;
  note: string;
}

export interface NzInvestmentBoostRow extends EffectiveDatedRow, NzInvestmentBoostInfo {}

export const NZ_INVESTMENT_BOOST_START = '2025-05-22';

/**
 * "From 22 May 2025, you can claim 20% of the cost of new assets as an
 * expense, then claim depreciation as usual on the remaining 80%." Before that
 * date there was no Investment Boost, and the row says so as unverified-null
 * rather than 0%, because 0% would print as a confirmed figure.
 */
export const NZ_INVESTMENT_BOOST_ROWS: NzInvestmentBoostRow[] = [
  {
    effectiveFrom: NZ_INVESTMENT_BOOST_START,
    percent: 20,
    verified: true,
    note:
      'Investment Boost: for NEW assets bought from 22 May 2025, claim 20% of the cost as an ' +
      'expense in the year you buy it, then depreciate the remaining 80% as usual. It does not ' +
      'apply to second-hand assets.',
  },
  {
    effectiveFrom: '1900-01-01',
    percent: null,
    verified: false,
    note:
      'Investment Boost applies to new assets bought from 22 May 2025. No up-front deduction ' +
      'is recorded here for an asset bought before that date; confirm any earlier concession ' +
      'with Inland Revenue or your tax agent.',
  },
];

const NZ_INVESTMENT_BOOST_ROWS_NEWEST_FIRST: readonly NzInvestmentBoostRow[] = sortNewestFirst(
  NZ_INVESTMENT_BOOST_ROWS,
);

export function nzInvestmentBoost(onDate: Date | string): NzInvestmentBoostInfo {
  const row = resolveEffectiveDated(NZ_INVESTMENT_BOOST_ROWS_NEWEST_FIRST, toYmd(onDate));
  return { percent: row.percent, verified: row.verified, note: row.note };
}

export interface NzInvestmentBoostSplit extends NzInvestmentBoostInfo {
  /** Whether the boost was applied to THIS asset (date and newness both satisfied). */
  applied: boolean;
  /** The 20% claimed as an expense in the year of purchase; 0 where not applied. */
  expensedNow: number;
  /** What is depreciated at the asset's rate: the remaining 80%, or the full cost. */
  depreciableCost: number;
}

/**
 * Investment Boost modelled the way IRD describes it: a concession that
 * REDUCES THE DEPRECIABLE BASE. A $10,000 new asset bought on or after 22 May
 * 2025 expenses $2,000 now and depreciates $8,000 × rate. A used asset, or an
 * earlier purchase, depreciates the full $10,000 and expenses nothing.
 * `isNewAsset` is a tri-state on purpose: unknown is NOT new, so the boost is
 * never applied on a field nobody filled in.
 */
export function nzInvestmentBoostSplit(input: {
  cost: number;
  acquiredOn: Date | string;
  isNewAsset: boolean | null | undefined;
}): NzInvestmentBoostSplit {
  const cost = Math.max(0, Number(input.cost) || 0);
  const boost = nzInvestmentBoost(input.acquiredOn);
  const applied = boost.percent !== null && boost.verified && input.isNewAsset === true;
  const expensedNow = applied ? Math.round(cost * (boost.percent as number)) / 100 : 0;
  return {
    ...boost,
    applied,
    expensedNow,
    depreciableCost: Math.round((cost - expensedNow) * 100) / 100,
  };
}

// ─── Pooling — documented, not computed ─────────────────────────────────────

/** IRD's pooling rules, as metadata for a host to show. No pool arithmetic yet. */
export const NZ_POOLING_RULES = {
  available: false,
  note:
    'Low value assets can be pooled and depreciated together. A pool must use the diminishing ' +
    'value method, must use the lowest depreciation rate of the assets in it, cannot contain ' +
    'buildings, and once an asset is in a pool it cannot be taken out. Pool arithmetic is not ' +
    'computed here yet — each asset is depreciated on its own.',
  conditions: [
    'diminishing value method only',
    'the lowest depreciation rate of any asset in the pool',
    'no buildings',
    'an asset in a pool cannot be removed from it',
  ],
  source: IRD_CLAIMING_DEPRECIATION,
} as const;

// ─── Explainer ──────────────────────────────────────────────────────────────

/**
 * IRD's own terms — "adjusted tax value", "low value asset", "Investment
 * Boost" — in Fin's voice, speaking to "you". The links are the IRD pages the
 * rules were read from and the IR265 PDF; nothing else.
 */
const NZ_EXPLAINER: DepreciationExplainer = {
  whatItIs:
    'Assets you keep for more than a year are claimed over time at the rate Inland Revenue ' +
    'sets for that asset, not all at once.',
  whenItApplies:
    'Anything costing more than the low value asset threshold — $1,000 for purchases from ' +
    '17 March 2021, GST-exclusive if you are GST registered. Under that, claim it straight ' +
    'away. New assets bought from 22 May 2025 get 20% up front under Investment Boost, with ' +
    'the remaining 80% depreciated as usual.',
  howItWorks: [
    'Record the cost (less GST if you are GST registered) and the month you bought it or first used it for business.',
    "Find the asset's diminishing value (DV) or straight line (SL) rate in IR265.",
    'Diminishing value: cost × DV rate in year one, then adjusted tax value × DV rate each year after. Straight line: cost × SL rate every year.',
    'Bought part-way through the year? Count the months you used it, part-months as whole months, and claim that many twelfths. Then claim your business-use share.',
  ],
  readMore: [
    { label: 'Claiming depreciation', url: IRD_CLAIMING_DEPRECIATION, authority: 'Inland Revenue' },
    {
      label: 'Work out diminishing value depreciation',
      url: IRD_DIMINISHING_VALUE,
      authority: 'Inland Revenue',
    },
    { label: 'Work out straight line depreciation', url: IRD_STRAIGHT_LINE, authority: 'Inland Revenue' },
    { label: 'New assets - Investment Boost', url: IRD_INVESTMENT_BOOST, authority: 'Inland Revenue' },
    { label: 'IR265 General depreciation rates (March 2026)', url: IRD_IR265_PDF, authority: 'Inland Revenue' },
  ],
  vocabulary: {
    asset: 'Asset',
    decline: 'Depreciation',
    writtenDown: 'Adjusted tax value',
    rate: 'Depreciation rate',
    rateBasis: 'Estimated useful life',
  },
};

const NZ_EXTRA_ASSET_FIELDS: AssetFieldSpec[] = [
  {
    key: 'isNewAsset',
    label: 'Bought new (not second-hand)',
    type: 'boolean',
    required: false,
    help:
      'Investment Boost applies only to new assets bought from 22 May 2025. Leave this off ' +
      'for a second-hand asset and it is depreciated in full.',
  },
];

// ─── Rules object ───────────────────────────────────────────────────────────

export const NZ_DEPRECIATION_RULES: RatePerAssetRules = {
  countryCode: 'NZ',
  regime: 'rate_per_asset',
  partYear: 'months_whole',
  // IRD's worked examples use diminishing value; `prime_cost` is IRD's straight line.
  methods: ['prime_cost', 'diminishing_value', 'immediate_writeoff'],
  defaultMethod: 'diminishing_value',

  /**
   * Not used: New Zealand apportions by whole months, not days, and
   * `declineInValue` refuses a days-based input. Returned unchanged so a host
   * that asks every country gets an honest, unused number rather than a throw.
   */
  dayFractionDenominator(daysInIncomeYear: number): number {
    return daysInIncomeYear;
  },

  /**
   * The rate is the published one, applied as-is, and the part year is whole
   * months — both are REQUIRED, not defaulted. A days-based input is refused
   * because IRD's rule is months, and computing 365ths here would print an
   * Australian number on a New Zealand return. A missing `annualRate` is
   * refused because NZ has no life to derive one from; look the asset up with
   * `rateFor()` and pass `dv` or `sl`.
   */
  declineInValue(input: DeclineInValueInput): DeclineInValueOutcome {
    if (input.method === 'pool') {
      throw new RangeError(
        'Pooling is not computed in the New Zealand depreciation rules yet — see NZ_POOLING_RULES. ' +
          'Depreciate each asset on its own.',
      );
    }
    if (input.method === 'immediate_writeoff') {
      // A low value asset is claimed in full; there is no month apportionment.
      return computeDeclineInValue({ ...input, partYear: { kind: 'months', monthsUsed: 12 } });
    }
    if (input.partYear?.kind !== 'months') {
      throw new RangeError(
        'New Zealand apportions a part year by WHOLE MONTHS, not days: pass ' +
          "`partYear: { kind: 'months', monthsUsed }` (use nzWholeMonthsUsed), not daysHeld/daysInYear.",
      );
    }
    if (input.annualRate == null) {
      throw new RangeError(
        'New Zealand applies the IR265 rate for the asset directly: pass `annualRate` (the `dv` ' +
          'or `sl` fraction from rateFor(categoryKey)); there is no effective life to derive it from.',
      );
    }
    // `heldBefore10May2006` is an ATO multiplier and has no meaning against a
    // published rate; the annualRate path never consults it.
    return computeDeclineInValue({ ...input, heldBefore10May2006: false });
  },

  /** IR265's estimated useful life, for the rate-basis column. Not what the rate is derived from. */
  effectiveLife(categoryKey: string): number | null {
    return RATE_BY_KEY.get(categoryKey)?.years ?? null;
  },

  effectiveLifeCategories(): EffectiveLifeCategory[] {
    return NZ_RATE_CATEGORIES.map((c) => ({ ...c }));
  },

  rateFor(categoryKey: string) {
    return nzRateFor(categoryKey);
  },

  /** NZ's "write-off" is the low value asset threshold. */
  instantAssetWriteOff(onDate: Date | string): InstantAssetWriteOffInfo {
    return nzLowValueThreshold(onDate);
  },

  lowValueThreshold(onDate: Date | string) {
    return nzLowValueThreshold(onDate);
  },

  investmentBoost(onDate: Date | string) {
    return nzInvestmentBoost(onDate);
  },

  balancingAdjustment(input: BalancingAdjustmentInput): BalancingAdjustmentOutcome {
    return computeBalancingAdjustment(input);
  },

  explainer(): DepreciationExplainer {
    return {
      ...NZ_EXPLAINER,
      howItWorks: [...NZ_EXPLAINER.howItWorks],
      readMore: NZ_EXPLAINER.readMore.map((r) => ({ ...r })),
      vocabulary: { ...NZ_EXPLAINER.vocabulary },
    };
  },

  firstYearConcessions(onDate: Date | string): FirstYearConcession[] {
    const low = nzLowValueThreshold(onDate);
    const boost = nzInvestmentBoost(onDate);
    return [
      {
        key: 'low_value_asset',
        label: 'Low value asset',
        kind: 'threshold_write_off',
        limit: low.limit,
        percent: null,
        verified: low.verified,
        note: low.note,
      },
      {
        key: 'investment_boost',
        label: 'Investment Boost',
        kind: 'upfront_percent',
        limit: null,
        percent: boost.percent,
        verified: boost.verified,
        note: boost.note,
        requiresField: 'isNewAsset',
      },
    ];
  },

  extraAssetFields(): AssetFieldSpec[] {
    return NZ_EXTRA_ASSET_FIELDS.map((f) => ({ ...f }));
  },
};

/** The pages these rules were read from, for a "where does this come from" link. */
export const NZ_DEPRECIATION_AUTHORITY_URLS = {
  claimingDepreciation: IRD_CLAIMING_DEPRECIATION,
  diminishingValue: IRD_DIMINISHING_VALUE,
  straightLine: IRD_STRAIGHT_LINE,
  investmentBoost: IRD_INVESTMENT_BOOST,
  ir265: IRD_IR265_PDF,
} as const;

export default NZ_DEPRECIATION_RULES;
