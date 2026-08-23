/**
 * Ireland — capital allowances (wear and tear) — ai2fin.com
 * Authority: Revenue (the Office of the Revenue Commissioners)
 *
 * Ireland is a STRAIGHT-LINE FIXED-RATE regime: one statutory rate for all
 * plant and machinery. Wear and tear under s.284 TCA 1997 is 12.5% of the
 * allowable cost a year, straight line, over 8 years — the rate for capital
 * expenditure incurred since 4 December 2002. Everything below was read from
 * Revenue's "Capital allowances and deductions" page (published 25 Sep 2025)
 * and the Notes for Guidance to Part 11C TCA 1997, Finance Act 2025 Edition
 * (checked 2026-08-23, UTC):
 *
 *   • The allowance runs only where the asset is IN USE FOR THE TRADE AT THE
 *     END of the accounting period, and is reduced for a period shorter than
 *     12 months. `wearAndTear` enforces both; `inUseAtPeriodEnd` is a
 *     required input, never defaulted, because a field nobody filled in must
 *     not claim a year's allowance.
 *   • The cost is the NET cost — after grants and any VAT that can be
 *     reclaimed.
 *   • CARS are capped by CO₂ category against the specified amount of €24,000
 *     (ss.380K and 380L TCA 1997, Part 11C). The categories, as amended by
 *     s.14 Finance Act 2020 for expenditure incurred on or after 1 January
 *     2021, are A up to 120 g/km, B 121–140, C 141–155, D 156–170, E 171–190
 *     and F over 190. For expenditure incurred BEFORE 1 January 2027 the
 *     allowable cost is €24,000 for categories A and B REGARDLESS of the
 *     actual cost — even a cheaper car; the lesser of €12,000 and half the
 *     cost for category C; and nil for D, E and F. For expenditure incurred
 *     FROM 1 January 2027, s.33 Finance Act 2024 moves each rung down: €24,000
 *     for category A only, the lesser of €12,000 and half the cost for B, and
 *     nil for C, D, E and F. A car whose emissions Revenue cannot verify is
 *     deemed to be in Category F and gets nothing. Commercial vehicles are not
 *     capped (Part 11-00-03).
 *
 *     NOTE ON SOURCES: Tax and Duty Manual Part 11-00-01 still describes the
 *     SEVEN-category A–G regime with 155 g/km and 190 g/km thresholds, but its
 *     cover is stamped "Document last reviewed November 2019" — it predates
 *     the commencement of s.19 Finance Act 2019 and s.14 Finance Act 2020.
 *     The statute as amended governs, so the categories above come from
 *     Part 11C, not from that manual.
 *   • The ACCELERATED CAPITAL ALLOWANCE gives 100% in year one for
 *     energy-efficient equipment on the SEAI Triple E register (also gas
 *     vehicles and refuelling equipment, and equipment in an employee crèche
 *     or gym).
 *   • Industrial buildings write off at 4% over 25 years — carried as a
 *     category row for the schedule's rate-basis column; `declineInValue`
 *     computes plant and machinery only.
 *
 * DISPOSALS ARE FLAGGED, NOT FULLY MODELLED: a disposal triggers a balancing
 * allowance or charge against the tax written down value, but the exact Irish
 * mechanics (TDM Part 09-02-03) were not read for this release, so
 * `IE_DISPOSAL_BALANCING` ships `verified: false` and `balancingAdjustment`
 * is the generic proceeds-less-written-down-value comparison.
 *
 * Reference: https://www.revenue.ie/en/companies-and-charities/corporation-tax-for-companies/corporation-tax/capital-allowances-and-deductions.aspx
 * Reference: https://www.revenue.ie/en/tax-professionals/tdm/income-tax-capital-gains-tax-corporation-tax/part-11/11-00-01.pdf
 */

import {
  computeBalancingAdjustment,
  computeDeclineInValue,
  type AssetFieldSpec,
  type BalancingAdjustmentInput,
  type BalancingAdjustmentOutcome,
  type DeclineInValueInput,
  type DeclineInValueOutcome,
  type DepreciationExplainer,
  type EffectiveLifeCategory,
  type FirstYearConcession,
  type IeAllowableCostOutcome,
  type IeAssetInput,
  type IeCarLimitRegime,
  type IeCo2Band,
  type IeWearAndTearInput,
  type IeWearAndTearOutcome,
  type InstantAssetWriteOffInfo,
  type StraightLineFixedRules,
} from '../depreciation';

const REVENUE_CAPITAL_ALLOWANCES =
  'https://www.revenue.ie/en/companies-and-charities/corporation-tax-for-companies/corporation-tax/capital-allowances-and-deductions.aspx';
const REVENUE_NOTES_PART_11C =
  'https://www.revenue.ie/en/tax-professionals/documents/notes-for-guidance/tca/part11c.pdf';

/** s.284 TCA 1997: 12.5% a year for expenditure incurred since 4 December 2002. */
export const IE_WEAR_AND_TEAR_RATE = 0.125;
/** The write-off period the 12.5% implies. */
export const IE_WEAR_AND_TEAR_YEARS = 8;
/** The "specified amount" for cars, s.380K(4) TCA 1997. */
export const IE_CAR_SPECIFIED_LIMIT = 24000;
/** Half the specified amount — the ceiling for the middle category, s.380L(3). */
export const IE_CAR_HALF_SPECIFIED_LIMIT = IE_CAR_SPECIFIED_LIMIT / 2;
/** Category A: CO₂ emissions up to and including this figure, in g/km (s.380K, FA 2020). */
export const IE_CAR_CO2_CATEGORY_A_MAX = 120;
/** Category B: up to and including this figure, above the Category A line. */
export const IE_CAR_CO2_CATEGORY_B_MAX = 140;
/** Category C: up to and including this figure, above the Category B line. */
export const IE_CAR_CO2_CATEGORY_C_MAX = 155;
/** Category D: up to and including this figure, above the Category C line. */
export const IE_CAR_CO2_CATEGORY_D_MAX = 170;
/** Category E: up to and including this figure, above the Category D line. Category F is anything higher. */
export const IE_CAR_CO2_CATEGORY_E_MAX = 190;
/**
 * The day s.33 Finance Act 2024's tighter emissions limits bite. Expenditure
 * incurred on or after this date uses the `from_2027` rungs.
 */
export const IE_CAR_LIMIT_REGIME_CHANGE_DATE = '2027-01-01';

/** Round to whole cents. */
function toCents(value: number): number {
  return Math.round(value * 100) / 100;
}

// ─── Allowable cost — the car cap by CO₂ band ───────────────────────────────

/**
 * A car's CO₂ category, s.380K(2) TCA 1997 as amended by s.14 Finance Act
 * 2020. Six categories, A to F, for expenditure incurred on or after
 * 1 January 2021 — the earlier seven-category A–G table is superseded.
 */
export function ieCarCo2Category(co2GPerKm: number): IeCo2Band {
  const grams = Number(co2GPerKm);
  // A negative or non-finite reading is not a verified low-emissions car — it
  // is bad input. Falling through to the `<=` chain below would read it as
  // BETTER than zero and hand it Category A's specified-cost ceiling instead
  // of the unverified/worst-case F.
  if (!Number.isFinite(grams) || grams < 0) return 'F';
  if (grams <= IE_CAR_CO2_CATEGORY_A_MAX) return 'A';
  if (grams <= IE_CAR_CO2_CATEGORY_B_MAX) return 'B';
  if (grams <= IE_CAR_CO2_CATEGORY_C_MAX) return 'C';
  if (grams <= IE_CAR_CO2_CATEGORY_D_MAX) return 'D';
  if (grams <= IE_CAR_CO2_CATEGORY_E_MAX) return 'E';
  return 'F';
}

/**
 * Which set of s.380L limits applies to expenditure incurred on a date. The
 * cut is 1 January 2027 (s.33 Finance Act 2024); an unrecorded or unparseable
 * date falls to `pre_2027`, the regime in force for every euro spent up to
 * 31 December 2026.
 */
export function ieCarLimitRegime(expenditureIncurredOn?: Date | string | null): IeCarLimitRegime {
  if (expenditureIncurredOn == null) return 'pre_2027';
  const when =
    expenditureIncurredOn instanceof Date
      ? expenditureIncurredOn
      : new Date(String(expenditureIncurredOn));
  if (Number.isNaN(when.getTime())) return 'pre_2027';
  return when >= new Date(`${IE_CAR_LIMIT_REGIME_CHANGE_DATE}T00:00:00Z`) ? 'from_2027' : 'pre_2027';
}

/** Which category gets the full specified amount, and which gets half, in each regime. */
const IE_CAR_LIMIT_RUNGS: Record<IeCarLimitRegime, { full: IeCo2Band; half: IeCo2Band }> = {
  pre_2027: { full: 'B', half: 'C' },
  from_2027: { full: 'A', half: 'B' },
};

const IE_CATEGORY_ORDER: IeCo2Band[] = ['A', 'B', 'C', 'D', 'E', 'F'];

/** The g/km ceiling of a category, for the note. Category F has none. */
const IE_CATEGORY_CEILING: Record<IeCo2Band, number | null> = {
  A: IE_CAR_CO2_CATEGORY_A_MAX,
  B: IE_CAR_CO2_CATEGORY_B_MAX,
  C: IE_CAR_CO2_CATEGORY_C_MAX,
  D: IE_CAR_CO2_CATEGORY_D_MAX,
  E: IE_CAR_CO2_CATEGORY_E_MAX,
  F: null,
};

function ieRegimeNote(regime: IeCarLimitRegime): string {
  return regime === 'from_2027'
    ? 'the limits for expenditure incurred from 1 January 2027 (s.33 Finance Act 2024)'
    : 'the limits for expenditure incurred before 1 January 2027';
}

/**
 * What the 12.5% is applied to. For anything that is not a car this is simply
 * the net cost. For a car it is the figure s.380L deems it to have cost — and
 * the top rung DEEMS €24,000 in both directions, so an €18,000 low-emission
 * car claims on €24,000 and a €48,000 one claims on €24,000 too.
 *
 * Which rung a category sits on moves on 1 January 2027, so the answer depends
 * on `asset.expenditureIncurredOn` as well as the emissions.
 */
export function ieAllowableCost(asset: IeAssetInput): IeAllowableCostOutcome {
  const cost = Math.max(0, Number(asset.cost) || 0);
  if (asset.isCar !== true) {
    return {
      allowableCost: cost,
      band: null,
      regime: null,
      capApplied: false,
      verified: true,
      note:
        asset.isCommercialVehicle === true
          ? 'Commercial vehicles are not subject to the car cost cap: wear and tear runs on the ' +
            'net cost after grants and reclaimable VAT.'
          : 'Plant and machinery: wear and tear runs on the net cost after grants and ' +
            'reclaimable VAT.',
    };
  }
  const regime = ieCarLimitRegime(asset.expenditureIncurredOn);
  const co2 = asset.co2GPerKm;
  if (co2 == null || !Number.isFinite(Number(co2))) {
    return {
      allowableCost: 0,
      band: 'F',
      regime,
      capApplied: true,
      verified: true,
      note:
        'A car whose CO₂ emissions cannot be verified is deemed to be in Category F, so no wear ' +
        'and tear allowance is due. Record the official CO₂ figure from the vehicle registration ' +
        'certificate to use the banded limits.',
    };
  }
  const band = ieCarCo2Category(Number(co2));
  const rungs = IE_CAR_LIMIT_RUNGS[regime];
  const rank = IE_CATEGORY_ORDER.indexOf(band);
  const ceiling = IE_CATEGORY_CEILING[band];
  const range =
    ceiling == null
      ? `over ${IE_CAR_CO2_CATEGORY_E_MAX} g/km`
      : rank === 0
        ? `up to ${ceiling} g/km`
        : `${(IE_CATEGORY_CEILING[IE_CATEGORY_ORDER[rank - 1]] as number) + 1}–${ceiling} g/km`;

  if (rank <= IE_CATEGORY_ORDER.indexOf(rungs.full)) {
    return {
      allowableCost: IE_CAR_SPECIFIED_LIMIT,
      band,
      regime,
      capApplied: cost !== IE_CAR_SPECIFIED_LIMIT,
      verified: true,
      note:
        `Category ${band} (${range}) under ${ieRegimeNote(regime)}: the car is deemed to cost ` +
        `the specified amount of €${IE_CAR_SPECIFIED_LIMIT.toLocaleString('en-IE')}, whatever ` +
        'it actually cost.',
    };
  }
  if (band === rungs.half) {
    return {
      allowableCost: Math.min(IE_CAR_HALF_SPECIFIED_LIMIT, toCents(cost / 2)),
      band,
      regime,
      capApplied: true,
      verified: true,
      note:
        `Category ${band} (${range}) under ${ieRegimeNote(regime)}: the allowable cost is the ` +
        `lesser of €${IE_CAR_HALF_SPECIFIED_LIMIT.toLocaleString('en-IE')} and half the actual ` +
        'cost.',
    };
  }
  return {
    allowableCost: 0,
    band,
    regime,
    capApplied: true,
    verified: true,
    note:
      `Category ${band} (${range}) under ${ieRegimeNote(regime)}: no wear and tear allowance ` +
      'is due.',
  };
}

// ─── One period's wear and tear ─────────────────────────────────────────────

/**
 * One accounting period's allowance: 12.5% of the allowable cost, in full for
 * a 12-month period, pro-rated for a shorter one — and NOTHING where the
 * asset was not in use for the trade at the end of the period, which is
 * s.284's own condition, not a convention of this module.
 */
export function ieWearAndTear(input: IeWearAndTearInput): IeWearAndTearOutcome {
  const allowableCost = Math.max(0, Number(input.allowableCost) || 0);
  const months = input.periodMonths == null ? 12 : Number(input.periodMonths);
  if (!Number.isInteger(months) || months < 1 || months > 12) {
    throw new RangeError(
      `periodMonths must be a whole number of months from 1 to 12 (received ${String(input.periodMonths)})`,
    );
  }
  if (input.inUseAtPeriodEnd !== true) {
    return {
      allowance: 0,
      rate: IE_WEAR_AND_TEAR_RATE,
      proRated: false,
      verified: true,
      note:
        'No wear and tear allowance for this period: the asset must be in use for the purposes ' +
        'of the trade at the end of the accounting period. An asset sold, scrapped or idle at ' +
        'the period end claims nothing for the period.',
    };
  }
  const proRated = months !== 12;
  return {
    allowance: toCents(allowableCost * IE_WEAR_AND_TEAR_RATE * (months / 12)),
    rate: IE_WEAR_AND_TEAR_RATE,
    proRated,
    verified: true,
    note: proRated
      ? `Wear and tear at 12.5% a year, reduced for a ${months}-month accounting period.`
      : 'Wear and tear at 12.5% of the allowable cost — one-eighth a year over 8 years.',
  };
}

// ─── Disposals — flagged, not fully modelled ────────────────────────────────

/**
 * The Irish balancing mechanics were NOT read for this release. The generic
 * arithmetic (proceeds less tax written down value) is available through
 * `balancingAdjustment`, but render this note next to any Irish disposal
 * rather than presenting the figure as Revenue's own.
 */
export const IE_DISPOSAL_BALANCING = {
  verified: false,
  note:
    'Disposing of an asset triggers a balancing allowance or balancing charge against its tax ' +
    'written down value. The exact Irish mechanics (Tax and Duty Manual Part 09-02-03) are not ' +
    'modelled here yet — the figure shown is the generic proceeds-less-written-down-value ' +
    'comparison. Confirm the treatment with Revenue or your tax advisor before relying on it.',
} as const;

// ─── Explainer ──────────────────────────────────────────────────────────────

/**
 * Revenue's own terms — "wear and tear allowance", "tax written down value",
 * "accelerated capital allowance" — in Fin's voice, speaking to "you". The
 * links are the Revenue pages the rules were read from; nothing else.
 */
const IE_EXPLAINER: DepreciationExplainer = {
  whatItIs:
    'Plant and machinery you use in the trade is claimed as a wear and tear allowance — 12.5% ' +
    'of the cost a year, the same amount for 8 years.',
  whenItApplies:
    'Assets in use for the trade at the end of the accounting period, on the net cost after ' +
    'grants and any VAT you can reclaim. Cars are capped by CO₂ category against the €24,000 ' +
    'specified amount — a car up to 140 g/km is deemed to cost €24,000, 141 to 155 g/km gets ' +
    'the lesser of €12,000 and half the cost, and anything higher gets nothing — while ' +
    'commercial vehicles are uncapped. Spend on a car from 1 January 2027 and each rung moves ' +
    'down a category: only 120 g/km and under keeps the full €24,000. Energy-efficient ' +
    'equipment on the SEAI Triple E register can instead claim 100% in year one under the ' +
    'accelerated capital allowance.',
  howItWorks: [
    'Record the net cost — after grants and reclaimable VAT — and, for a car, its official CO₂ figure and the date you incurred the expenditure.',
    'Work out the allowable cost: the net cost for most assets; for a car, the CO₂-banded figure against the €24,000 specified amount.',
    'Claim 12.5% of the allowable cost each year for 8 years, reduced for an accounting period shorter than 12 months — and only where the asset is still in use for the trade at the period end.',
    'The tax written down value is the allowable cost less what you have claimed; a disposal triggers a balancing allowance or charge against it.',
  ],
  readMore: [
    {
      label: 'Capital allowances and deductions',
      url: REVENUE_CAPITAL_ALLOWANCES,
      authority: 'Revenue',
    },
    {
      label: 'Notes for Guidance — Part 11C: emissions-based limits for certain road vehicles',
      url: REVENUE_NOTES_PART_11C,
      authority: 'Revenue',
    },
  ],
  vocabulary: {
    asset: 'Plant and machinery',
    decline: 'Wear and tear allowance',
    writtenDown: 'Tax written down value',
    rate: 'Rate',
    rateBasis: 'Rate',
  },
};

const IE_EXTRA_ASSET_FIELDS: AssetFieldSpec[] = [
  {
    key: 'inUseAtPeriodEnd',
    label: 'In use for the trade at the period end',
    type: 'boolean',
    required: true,
    help:
      'Wear and tear runs only where the asset is in use for the purposes of the trade at the ' +
      'end of the accounting period. An asset sold, scrapped or idle at the period end claims ' +
      'nothing for the period.',
  },
  {
    key: 'isCar',
    label: 'Passenger car',
    type: 'boolean',
    required: false,
    help: 'Cars are capped by CO₂ category against the €24,000 specified amount.',
  },
  {
    key: 'co2GPerKm',
    label: 'CO₂ emissions (g/km)',
    type: 'number',
    required: false,
    help:
      'The official CO₂ figure decides a car’s category: up to 140 g/km (A or B) is deemed to ' +
      'cost €24,000, 141–155 (C) gets the lesser of €12,000 and half the cost, and over ' +
      '155 gets nothing — and a car with no figure recorded is deemed Category F, which gets ' +
      'nothing. From 1 January 2027 each rung moves down a category.',
  },
  {
    key: 'expenditureIncurredOn',
    label: 'Date the car expenditure was incurred',
    type: 'text',
    required: false,
    help:
      'The emissions limits tighten for expenditure incurred from 1 January 2027: only a car ' +
      'up to 120 g/km keeps the full €24,000 then. Left blank, the pre-2027 limits apply.',
  },
  {
    key: 'isCommercialVehicle',
    label: 'Commercial vehicle (van, lorry)',
    type: 'boolean',
    required: false,
    help: 'Commercial vehicles are not subject to the car cost cap.',
  },
  {
    key: 'isEnergyEfficientSeai',
    label: 'On the SEAI Triple E register',
    type: 'boolean',
    required: false,
    help:
      'Energy-efficient equipment on the SEAI Triple E register qualifies for the accelerated ' +
      'capital allowance: 100% of the cost in year one instead of 12.5% over 8 years.',
  },
];

// ─── Rules object ───────────────────────────────────────────────────────────

export const IE_DEPRECIATION_RULES: StraightLineFixedRules = {
  countryCode: 'IE',
  regime: 'straight_line_fixed',
  rate: IE_WEAR_AND_TEAR_RATE,
  writeOffYears: IE_WEAR_AND_TEAR_YEARS,
  // `prime_cost` is Revenue's straight-line wear and tear; `immediate_writeoff`
  // is the 100% accelerated capital allowance.
  methods: ['prime_cost', 'immediate_writeoff'],
  defaultMethod: 'prime_cost',

  /**
   * Not used for the ordinary allowance: Ireland reduces a short ACCOUNTING
   * PERIOD by months, not a short hold by days — see `wearAndTear`. Returned
   * unchanged so a host that asks every country gets an honest, unused number.
   */
  dayFractionDenominator(daysInIncomeYear: number): number {
    return daysInIncomeYear;
  },

  /**
   * THE RATE IS THE STATUTE'S, NOT THE CALLER'S: 12.5% is applied whatever
   * `annualRate` or `effectiveLifeYears` was passed, because s.284 leaves no
   * rate to choose. Pass the ALLOWABLE cost (from `allowableCost()`) as
   * `cost`, and a `partYear` in months where the accounting period is short.
   * The in-use-at-period-end gate cannot be seen from here — `wearAndTear`
   * is the canonical Irish path and applies it.
   */
  declineInValue(input: DeclineInValueInput): DeclineInValueOutcome {
    if (input.method === 'immediate_writeoff') {
      return computeDeclineInValue({ ...input, partYear: { kind: 'months', monthsUsed: 12 } });
    }
    if (input.method !== 'prime_cost') {
      throw new RangeError(
        `Ireland's wear and tear allowance is straight line at a fixed 12.5%: method ` +
          `"${String(input.method)}" is not available. Use prime_cost, or immediate_writeoff for ` +
          'the 100% accelerated capital allowance.',
      );
    }
    if (input.partYear?.kind === 'days' || (input.partYear == null && input.daysHeld != null)) {
      throw new RangeError(
        'Ireland reduces the allowance for a SHORT ACCOUNTING PERIOD, in months — not for days ' +
          "held: pass `partYear: { kind: 'months', monthsUsed }` (the period length), not " +
          'daysHeld/daysInYear.',
      );
    }
    return computeDeclineInValue({
      ...input,
      annualRate: IE_WEAR_AND_TEAR_RATE,
      effectiveLifeYears: undefined,
      heldBefore10May2006: false,
      partYear: input.partYear ?? { kind: 'months', monthsUsed: 12 },
    });
  },

  effectiveLife(categoryKey: string): number | null {
    if (categoryKey === 'plant_and_machinery') return IE_WEAR_AND_TEAR_YEARS;
    if (categoryKey === 'industrial_building') return 25;
    return null;
  },

  /**
   * Two rows: everything that is plant writes off over the same 8 years, so a
   * long list would repeat one number. Industrial buildings are carried for
   * the rate-basis column only — their 4% arithmetic is not computed here.
   */
  effectiveLifeCategories(): EffectiveLifeCategory[] {
    return [
      {
        key: 'plant_and_machinery',
        label: 'Plant and machinery',
        years: IE_WEAR_AND_TEAR_YEARS,
        source:
          'Revenue, Capital allowances and deductions (published 25 Sep 2025): wear and tear at ' +
          '12.5% a year over 8 years, s.284 TCA 1997',
      },
      {
        key: 'industrial_building',
        label: 'Industrial building',
        years: 25,
        source:
          'Revenue, Capital allowances and deductions (published 25 Sep 2025): industrial ' +
          'buildings allowance at 4% over 25 years — not computed by these rules',
      },
    ];
  },

  /**
   * Ireland publishes no de minimis write-off threshold for plant. The 100%
   * route is the accelerated capital allowance for SEAI-registered equipment,
   * which is a concession, not a cost threshold.
   */
  instantAssetWriteOff(): InstantAssetWriteOffInfo {
    return {
      limit: null,
      verified: false,
      note:
        'Revenue publishes no immediate write-off cost threshold for plant and machinery — the ' +
        'wear and tear allowance runs over 8 years. Energy-efficient equipment on the SEAI ' +
        'Triple E register can instead claim 100% in year one under the accelerated capital ' +
        'allowance.',
    };
  },

  /** The generic arithmetic only — render IE_DISPOSAL_BALANCING.note beside it. */
  balancingAdjustment(input: BalancingAdjustmentInput): BalancingAdjustmentOutcome {
    return computeBalancingAdjustment(input);
  },

  explainer(): DepreciationExplainer {
    return {
      ...IE_EXPLAINER,
      howItWorks: [...IE_EXPLAINER.howItWorks],
      readMore: IE_EXPLAINER.readMore.map((r) => ({ ...r })),
      vocabulary: { ...IE_EXPLAINER.vocabulary },
    };
  },

  firstYearConcessions(): FirstYearConcession[] {
    return [
      {
        key: 'accelerated_capital_allowance_seai',
        label: 'Accelerated capital allowance — energy-efficient equipment',
        kind: 'upfront_percent',
        limit: null,
        percent: 100,
        verified: true,
        note:
          '100% of the cost in year one for energy-efficient equipment on the SEAI Triple E ' +
          'register — also gas vehicles and refuelling equipment, and equipment in an employee ' +
          'crèche or gym.',
        requiresField: 'isEnergyEfficientSeai',
      },
    ];
  },

  extraAssetFields(): AssetFieldSpec[] {
    return IE_EXTRA_ASSET_FIELDS.map((f) => ({ ...f }));
  },

  allowableCost(asset: IeAssetInput): IeAllowableCostOutcome {
    return ieAllowableCost(asset);
  },

  wearAndTear(input: IeWearAndTearInput): IeWearAndTearOutcome {
    return ieWearAndTear(input);
  },
};

/** The pages these rules were read from, for a "where does this come from" link. */
export const IE_DEPRECIATION_AUTHORITY_URLS = {
  capitalAllowances: REVENUE_CAPITAL_ALLOWANCES,
  notesPart11C: REVENUE_NOTES_PART_11C,
} as const;

export default IE_DEPRECIATION_RULES;
