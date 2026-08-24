/**
 * South Africa — wear-and-tear allowance — ai2fin.com
 * Authority: South African Revenue Service (SARS)
 *
 * South Africa is a WRITE-OFF PERIOD regime: SARS publishes a period in years
 * per asset in the schedule to Interpretation Note 47, and the taxpayer
 * elects straight line or diminishing value over it. Everything below was
 * read from Interpretation Note 47 (Issue 5), 9 February 2021 — the s.11(e)
 * wear-and-tear allowance under the Income Tax Act 58 of 1962 — on
 * 2026-08-24. Binding General Ruling 7 makes the schedule binding.
 *
 *   • VALUE is the cash cost, excluding finance charges (and excluding any
 *     VAT input tax claimed).
 *   • METHOD is elected: straight line, or diminishing value on the income
 *     tax value (IN47 4.3.2). SARS publishes the PERIOD, not a DV rate — so
 *     straight line at 1 ÷ years is the default here, and the DV method
 *     requires the taxpayer's OWN rate rather than inventing one.
 *   • PART YEARS ARE APPORTIONED BY DAYS (IN47 4.1.6): an asset brought into
 *     use or disposed of during the year claims the days it was used.
 *   • SMALL ITEMS costing less than R7,000 each are written off in full in
 *     the year acquired and brought into use (acquisitions on or after
 *     1 March 2009); a SET — chairs bought together — is one item, tested
 *     against the limit as a whole.
 *   • s.12C (manufacturing plant, 40/20/20/20 new or 20% × 5 used) and s.12E
 *     (small business corporations, 100% manufacturing or 50/30/20) REPLACE
 *     s.11(e) for the assets they cover. They were not read for this release
 *     and ship as `verified: false` notes, never as rates.
 *
 * Reference: https://www.sars.gov.za/legal-counsel/legal-advisory/interpretation-notes/
 * Reference: https://www.sars.gov.za/wp-content/uploads/Legal/Notes/LAPD-IntR-IN-2012-47-Wear-and-Tear-Depreciation-Allowance.pdf
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
  type WriteOffPeriodRules,
  type ZaWriteOffPeriodOutcome,
} from '../depreciation';

const SARS_INTERPRETATION_NOTES =
  'https://www.sars.gov.za/legal-counsel/legal-advisory/interpretation-notes/';
const SARS_IN47_PDF =
  'https://www.sars.gov.za/wp-content/uploads/Legal/Notes/LAPD-IntR-IN-2012-47-Wear-and-Tear-Depreciation-Allowance.pdf';

/** Where every write-off period below was read from. */
export const ZA_WRITE_OFF_SOURCE = 'SARS IN47 (Issue 5) schedule';

/** Items costing less than this are written off in full — acquisitions on or after 1 March 2009. */
export const ZA_SMALL_ITEM_LIMIT = 7000;
export const ZA_SMALL_ITEM_LIMIT_FROM = '2009-03-01';

// ─── Write-off periods — the IN47 schedule ──────────────────────────────────

/**
 * A SHORT, VERIFIED list: every row was read from the schedule of write-off
 * periods in Interpretation Note 47 (Issue 5), pages 22-28. Assets not on
 * this list are not missing by accident — look them up in the schedule rather
 * than guessing, because a wrong period is a wrong deduction every year for
 * the life of the asset. `years` is the schedule's write-off period; the
 * straight-line rate follows as 1 ÷ years.
 */
export const ZA_WRITE_OFF_CATEGORIES: EffectiveLifeCategory[] = [
  { key: 'computer_personal', label: 'Personal computer', years: 3, source: ZA_WRITE_OFF_SOURCE },
  {
    key: 'computer_mainframe_or_server',
    label: 'Computer — mainframe or server',
    years: 5,
    source: ZA_WRITE_OFF_SOURCE,
  },
  { key: 'tablet', label: 'Tablet computer', years: 2, source: ZA_WRITE_OFF_SOURCE },
  { key: 'software_pc', label: 'Computer software (personal computers)', years: 2, source: ZA_WRITE_OFF_SOURCE },
  {
    key: 'software_mainframe_purchased',
    label: 'Computer software (mainframe, purchased)',
    years: 3,
    source: ZA_WRITE_OFF_SOURCE,
  },
  {
    key: 'software_mainframe_self_developed',
    label: 'Computer software (mainframe, self-developed)',
    years: 5,
    source: ZA_WRITE_OFF_SOURCE,
  },
  { key: 'cellular_telephone', label: 'Cellular telephone', years: 2, source: ZA_WRITE_OFF_SOURCE },
  { key: 'furniture_and_fittings', label: 'Furniture and fittings', years: 6, source: ZA_WRITE_OFF_SOURCE },
  { key: 'passenger_car', label: 'Passenger car', years: 5, source: ZA_WRITE_OFF_SOURCE },
  { key: 'delivery_vehicle', label: 'Delivery vehicle', years: 4, source: ZA_WRITE_OFF_SOURCE },
  { key: 'truck_heavy', label: 'Truck (heavy duty)', years: 3, source: ZA_WRITE_OFF_SOURCE },
  { key: 'truck_other', label: 'Truck (other)', years: 4, source: ZA_WRITE_OFF_SOURCE },
  {
    key: 'office_equipment_electronic',
    label: 'Office equipment — electronic',
    years: 3,
    source: ZA_WRITE_OFF_SOURCE,
  },
  {
    key: 'office_equipment_mechanical',
    label: 'Office equipment — mechanical',
    years: 5,
    source: ZA_WRITE_OFF_SOURCE,
  },
  { key: 'photocopier', label: 'Photocopier', years: 5, source: ZA_WRITE_OFF_SOURCE },
  { key: 'fitted_carpet', label: 'Fitted carpet', years: 6, source: ZA_WRITE_OFF_SOURCE },
  { key: 'power_tool', label: 'Power tool (hand-operated)', years: 5, source: ZA_WRITE_OFF_SOURCE },
  { key: 'generator_portable', label: 'Generator (portable)', years: 5, source: ZA_WRITE_OFF_SOURCE },
  { key: 'generator_standby', label: 'Generator (standby)', years: 15, source: ZA_WRITE_OFF_SOURCE },
  { key: 'cash_register', label: 'Cash register', years: 5, source: ZA_WRITE_OFF_SOURCE },
];

const PERIOD_BY_KEY = new Map(ZA_WRITE_OFF_CATEGORIES.map((c) => [c.key, c] as const));

export function zaWriteOffPeriod(categoryKey: string): ZaWriteOffPeriodOutcome | null {
  const row = PERIOD_BY_KEY.get(categoryKey);
  return row ? { years: row.years, source: row.source ?? ZA_WRITE_OFF_SOURCE, verified: true } : null;
}

// ─── Small items — effective-dated ──────────────────────────────────────────

export interface ZaSmallItemRow extends EffectiveDatedRow, InstantAssetWriteOffInfo {}

/**
 * The R7,000 limit applies to acquisitions on or after 1 March 2009. The
 * earlier limit was not read this session, so a date before that resolves to
 * an unverified null rather than R7,000 backdated. The limit is STRICT: an
 * item must cost LESS than R7,000, so R6,999 qualifies and R7,000 does not.
 */
export const ZA_SMALL_ITEM_ROWS: ZaSmallItemRow[] = [
  {
    effectiveFrom: ZA_SMALL_ITEM_LIMIT_FROM,
    limit: ZA_SMALL_ITEM_LIMIT,
    verified: true,
    // SARS's wording is "costing less than R7,000" — exactly R7,000 misses.
    boundary: 'under',
    note:
      'An item costing less than R7,000 is written off in full in the year it is acquired and ' +
      'brought into use (acquisitions on or after 1 March 2009). A set — chairs bought together ' +
      '— is one item, tested against the limit as a whole.',
  },
  {
    effectiveFrom: '1900-01-01',
    limit: null,
    verified: false,
    note:
      'The small-item limit for acquisitions before 1 March 2009 is not recorded here. Confirm ' +
      'the limit for that year with SARS or your tax practitioner.',
  },
];

const ZA_SMALL_ITEM_ROWS_NEWEST_FIRST: readonly ZaSmallItemRow[] = sortNewestFirst(ZA_SMALL_ITEM_ROWS);

export function zaSmallItemThreshold(onDate: Date | string): InstantAssetWriteOffInfo {
  const row = resolveEffectiveDated(ZA_SMALL_ITEM_ROWS_NEWEST_FIRST, toYmd(onDate));
  return {
    limit: row.limit,
    verified: row.verified,
    note: row.note,
    ...(row.boundary ? { boundary: row.boundary } : {}),
  };
}

// ─── Explainer ──────────────────────────────────────────────────────────────

/**
 * SARS's own terms — "wear-and-tear allowance", "income tax value",
 * "write-off period" — in Fin's voice, speaking to "you". The links are the
 * SARS pages the rules were read from; nothing else.
 */
const ZA_EXPLAINER: DepreciationExplainer = {
  whatItIs:
    'Assets you use in the trade are claimed as a wear-and-tear allowance over the write-off ' +
    'period SARS publishes for that asset in Interpretation Note 47.',
  whenItApplies:
    'Qualifying assets owned and used for the trade, on the cash cost excluding finance ' +
    'charges. An item costing less than R7,000 is written off in full in the year you bring it ' +
    'into use — a set bought together counts as one item. Manufacturing plant (section 12C) and ' +
    'small business corporation assets (section 12E) follow their own faster write-offs instead.',
  howItWorks: [
    'Record the cash cost — excluding finance charges and any VAT you claim back — and the date the asset was brought into use.',
    "Find the asset's write-off period in the Interpretation Note 47 schedule: a personal computer is 3 years, a passenger car 5, furniture 6.",
    'Claim the straight-line share each year — cost ÷ the write-off period — or elect the diminishing-value method on the income tax value at your own rate.',
    'Brought into use part-way through the year? Apportion by the days you used it, then claim your business-use share.',
  ],
  readMore: [
    {
      label: 'Interpretation notes',
      url: SARS_INTERPRETATION_NOTES,
      authority: 'SARS',
    },
    {
      label: 'Interpretation Note 47 — wear-and-tear or depreciation allowance',
      url: SARS_IN47_PDF,
      authority: 'SARS',
    },
  ],
  vocabulary: {
    asset: 'Qualifying asset',
    decline: 'Wear-and-tear allowance',
    writtenDown: 'Income tax value',
    rate: 'Rate',
    rateBasis: 'Write-off period',
  },
};

// ─── Rules object ───────────────────────────────────────────────────────────

export const ZA_DEPRECIATION_RULES: WriteOffPeriodRules = {
  countryCode: 'ZA',
  regime: 'write_off_period',
  // `prime_cost` is the straight line over the IN47 period (the default);
  // `diminishing_value` is the elected DV method on the income tax value, at
  // the taxpayer's own rate; `immediate_writeoff` is the small-item rule.
  methods: ['prime_cost', 'diminishing_value', 'immediate_writeoff'],
  defaultMethod: 'prime_cost',

  /** IN47 apportions by days over the actual year, so the caller's denominator is honoured. */
  dayFractionDenominator(daysInIncomeYear: number): number {
    return daysInIncomeYear;
  },

  /**
   * Straight line takes the IN47 period as `effectiveLifeYears` (the rate is
   * 1 ÷ years) or an explicit `annualRate`, apportioned by days — IN47 4.1.6.
   * DIMINISHING VALUE REQUIRES YOUR OWN RATE: SARS publishes the write-off
   * period, not a DV percentage, and deriving one with the ATO's 200%
   * multiplier would print an Australian number on a South African return.
   */
  declineInValue(input: DeclineInValueInput): DeclineInValueOutcome {
    if (input.method === 'pool') {
      throw new RangeError(
        'South Africa claims the wear-and-tear allowance per asset — there is no pool method.',
      );
    }
    if (input.method === 'immediate_writeoff') {
      // A small item is written off in full; there is no day apportionment.
      return computeDeclineInValue({ ...input, partYear: { kind: 'months', monthsUsed: 12 } });
    }
    if (input.method === 'diminishing_value') {
      if (input.annualRate == null) {
        throw new RangeError(
          'SARS lets you elect the diminishing-value method on the income tax value (IN47 4.3.2) ' +
            'but publishes no DV rate — pass annualRate with your own elected rate, or use ' +
            'straight line (prime_cost), the default.',
        );
      }
      return computeDeclineInValue({ ...input, heldBefore10May2006: false });
    }
    return computeDeclineInValue(input);
  },

  /** The IN47 schedule write-off period, for the rate-basis column. */
  effectiveLife(categoryKey: string): number | null {
    return PERIOD_BY_KEY.get(categoryKey)?.years ?? null;
  },

  effectiveLifeCategories(): EffectiveLifeCategory[] {
    return ZA_WRITE_OFF_CATEGORIES.map((c) => ({ ...c }));
  },

  /** South Africa's "write-off" is the small-item rule: less than R7,000 per item. */
  instantAssetWriteOff(onDate: Date | string): InstantAssetWriteOffInfo {
    return zaSmallItemThreshold(onDate);
  },

  balancingAdjustment(input: BalancingAdjustmentInput): BalancingAdjustmentOutcome {
    return computeBalancingAdjustment(input);
  },

  explainer(): DepreciationExplainer {
    return {
      ...ZA_EXPLAINER,
      howItWorks: [...ZA_EXPLAINER.howItWorks],
      readMore: ZA_EXPLAINER.readMore.map((r) => ({ ...r })),
      vocabulary: { ...ZA_EXPLAINER.vocabulary },
    };
  },

  /**
   * The small-item write-off with its effective-dated `verified` state, and
   * the s.12C / s.12E regimes as unverified NOTES — they were not read this
   * session, and a note that says so beats a number that guesses.
   */
  firstYearConcessions(onDate: Date | string): FirstYearConcession[] {
    const small = zaSmallItemThreshold(onDate);
    return [
      {
        key: 'small_item_write_off',
        label: 'Small items (under R7,000)',
        kind: 'threshold_write_off',
        limit: small.limit,
        percent: null,
        verified: small.verified,
        note: small.note,
      },
      {
        key: 's12c_manufacturing_plant',
        label: 'Manufacturing plant (section 12C)',
        kind: 'upfront_percent',
        limit: null,
        percent: null,
        verified: false,
        note:
          'Manufacturing plant and machinery follows section 12C instead of the wear-and-tear ' +
          'allowance — 40/20/20/20 for new plant, 20% a year for five years for used plant. Not ' +
          'modelled here: confirm with SARS or your tax practitioner.',
      },
      {
        key: 's12e_small_business_corporation',
        label: 'Small business corporation assets (section 12E)',
        kind: 'upfront_percent',
        limit: null,
        percent: null,
        verified: false,
        note:
          'A small business corporation writes manufacturing assets off 100% in year one and ' +
          'other assets 50/30/20 under section 12E instead of the wear-and-tear allowance. Not ' +
          'modelled here: confirm with SARS or your tax practitioner.',
      },
    ];
  },

  /** Nothing beyond the common fields — the category picks the write-off period. */
  extraAssetFields(): AssetFieldSpec[] {
    return [];
  },

  writeOffPeriod(categoryKey: string): ZaWriteOffPeriodOutcome | null {
    return zaWriteOffPeriod(categoryKey);
  },

  smallItemThreshold(onDate: Date | string): InstantAssetWriteOffInfo {
    return zaSmallItemThreshold(onDate);
  },
};

/** The pages these rules were read from, for a "where does this come from" link. */
export const ZA_DEPRECIATION_AUTHORITY_URLS = {
  interpretationNotes: SARS_INTERPRETATION_NOTES,
  in47: SARS_IN47_PDF,
} as const;

export default ZA_DEPRECIATION_RULES;
