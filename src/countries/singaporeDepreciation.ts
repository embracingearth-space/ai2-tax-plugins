/**
 * Singapore — capital allowances — ai2fin.com
 * Authority: Inland Revenue Authority of Singapore (IRAS)
 *
 * Singapore is a WRITE-OFF ELECTIVE regime: book depreciation is not
 * deductible, capital allowances replace it, and the write-off method is
 * ELECTED PER ASSET under sections 19 and 19A of the Income Tax Act 1947.
 * Everything below was read from IRAS's "Capital Allowances" page (the
 * accordion text captured 2026-08-24):
 *
 *   • s.19A(1)  — three-year write-off: AA = 1/3 of cost each year, any
 *                 qualifying asset, and claims may be deferred.
 *   • s.19A(2)  — 100% in one year for computers and prescribed automation
 *                 equipment (including laptops, printers and software).
 *   • s.19A(10A) — 100% in one year for low-value assets costing no more than
 *                 $5,000 each, capped at $30,000 of such claims per YA; the
 *                 excess goes to the three-year or working-life method. The
 *                 $30,000 total is across assets, so the HOST enforces it —
 *                 `lowValueCap(ya)` publishes both limits.
 *   • s.19A(1E) — two-year write-off, 75% then 25%, ONLY for assets acquired
 *                 in the basis periods for YAs 2021, 2022 and 2024
 *                 (a COVID-era concession; no deferment).
 *   • s.19     — working life: IA = 20% of cost in year one, plus
 *                 AA = 80% of cost ÷ working life each year. From YA 2023 the
 *                 Sixth Schedule is streamlined to an irrevocable election of
 *                 6 or 12 years (or 16, for a 16-year asset); a motor
 *                 vehicle's working life is 6 years.
 *
 * THERE IS NO DAY OR MONTH APPORTIONMENT. Allowances are claimed per year of
 * assessment, in full, and unclaimed allowances may be deferred — so
 * `declineInValue` never pro-rates, and the ATO's day fraction is refused by
 * construction rather than computed.
 *
 * S-PLATED PRIVATE PASSENGER CARS DO NOT QUALIFY at all; goods and commercial
 * vehicles do. Renovation works (doors, flooring, lighting) are a s.14N
 * deduction, not plant, and are not modelled here. Hire-purchase assets claim
 * allowances on the principal paid each YA — the host's replay, not this
 * module's.
 *
 * Reference: https://www.iras.gov.sg/taxes/corporate-income-tax/income-deductions-for-companies/claiming-allowances/capital-allowances
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
  type InstantAssetWriteOffInfo,
  type SgAllowanceOutcome,
  type SgAssetInput,
  type SgEligibilityOutcome,
  type SgLowValueCapOutcome,
  type SgWriteOffMethod,
  type WriteOffElectiveRules,
} from '../depreciation';
import { toYmd } from '../data/rateLedger';

const IRAS_CAPITAL_ALLOWANCES =
  'https://www.iras.gov.sg/taxes/corporate-income-tax/income-deductions-for-companies/claiming-allowances/capital-allowances';

/** s.19A(10A): each asset no more than $5,000 … */
export const SG_LOW_VALUE_PER_ITEM_LIMIT = 5000;
/** … and no more than $30,000 of such claims per year of assessment, across assets. */
export const SG_LOW_VALUE_TOTAL_PER_YA = 30000;
/** s.19A(1E): the two-year 75%/25% write-off exists ONLY for these YAs' basis periods. */
export const SG_TWO_YEAR_YAS: readonly number[] = [2021, 2022, 2024];
/** The streamlined 6/12/16 working-life election applies from YA 2023. */
export const SG_WORKING_LIFE_ELECTION_FROM_YA = 2023;
/** s.19 initial allowance: 20% of cost, in year one. */
export const SG_INITIAL_ALLOWANCE_RATE = 0.2;
/** The Sixth Schedule working life of a motor vehicle. */
export const SG_MOTOR_VEHICLE_WORKING_LIFE = 6;

/** Round to whole cents — the IRAS worked examples reconcile to the cent. */
function toCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function requireYearIndex(yearIndex: number): number {
  if (!Number.isInteger(yearIndex) || yearIndex < 1) {
    throw new RangeError(`yearIndex is 1-based and must be a whole number (received ${String(yearIndex)})`);
  }
  return yearIndex;
}

// ─── Eligibility ────────────────────────────────────────────────────────────

/**
 * The S-plate gate. IRAS: S-plated private passenger cars do not qualify for
 * capital allowances; goods and commercial vehicles do. Tri-state on purpose —
 * an unanswered question does not disqualify an asset, because most assets are
 * not cars at all.
 */
export function sgEligibility(asset: SgAssetInput): SgEligibilityOutcome {
  if (asset.isSPlatedPrivateCar === true) {
    return {
      eligible: false,
      note:
        'Capital allowances cannot be claimed on an S-plated private passenger car. Goods and ' +
        'commercial vehicles — vans, trucks, motorcycles — do qualify.',
    };
  }
  return {
    eligible: true,
    note: 'Qualifying fixed asset: plant and machinery used in the trade or business.',
  };
}

// ─── Which methods an asset may elect ───────────────────────────────────────

/**
 * The elections open to an asset for a year of assessment, most-immediate
 * first. Empty where the asset cannot claim at all (S-plated car). The
 * two-year 75%/25% appears only for the three YAs it existed in; the
 * streamlined working-life election only from YA 2023, because the earlier
 * Sixth Schedule lives are not recorded here and a method that cannot be
 * computed honestly is not offered.
 */
export function sgMethodsFor(asset: SgAssetInput, yearOfAssessment: number): SgWriteOffMethod[] {
  if (!Number.isInteger(yearOfAssessment) || yearOfAssessment < 1948) {
    throw new RangeError(
      `yearOfAssessment must be a whole year, e.g. 2026 (received ${String(yearOfAssessment)})`,
    );
  }
  if (!sgEligibility(asset).eligible) {
    return [];
  }
  const cost = Math.max(0, Number(asset.cost) || 0);
  const methods: SgWriteOffMethod[] = [];
  if (asset.isComputerOrAutomation === true) {
    methods.push('one_year_s19a2');
  }
  // The per-item limit is only recorded from the YA 2023 streamlining (see
  // sgLowValueCap) — the same reasoning that gates working_life_s19 below.
  // Offering the election for an earlier YA would write off a cost against a
  // limit this module has already declared it cannot verify.
  if (yearOfAssessment >= SG_WORKING_LIFE_ELECTION_FROM_YA && cost > 0 && cost <= SG_LOW_VALUE_PER_ITEM_LIMIT) {
    methods.push('one_year_low_value_s19a10a');
  }
  if (SG_TWO_YEAR_YAS.includes(yearOfAssessment)) {
    methods.push('two_year_s19a1e');
  }
  methods.push('three_year_s19a1');
  if (yearOfAssessment >= SG_WORKING_LIFE_ELECTION_FROM_YA) {
    methods.push('working_life_s19');
  }
  return methods;
}

// ─── One year of one method — the IRAS arithmetic ───────────────────────────

/**
 * IRAS's formulas, to the cent. Where a division leaves a stranded cent
 * (a $10,000 asset over three years is $3,333.33 + $3,333.33 + $3,333.34),
 * the FINAL year absorbs it, so the allowances always sum to the cost and the
 * tax written down value ends at exactly zero.
 */
export function sgAllowanceForYear(
  asset: SgAssetInput,
  method: SgWriteOffMethod,
  yearIndex: number,
): SgAllowanceOutcome {
  requireYearIndex(yearIndex);
  const cost = Math.max(0, Number(asset.cost) || 0);
  const eligibility = sgEligibility(asset);
  if (!eligibility.eligible) {
    throw new RangeError(eligibility.note);
  }

  const done = (
    totalYears: number,
    initialAllowance: number,
    annualAllowance: number,
    note: string,
  ): SgAllowanceOutcome => ({
    initialAllowance: toCents(initialAllowance),
    annualAllowance: toCents(annualAllowance),
    allowance: toCents(initialAllowance + annualAllowance),
    totalYears,
    verified: true,
    note,
  });

  switch (method) {
    case 'one_year_s19a2': {
      if (asset.isComputerOrAutomation !== true) {
        throw new RangeError(
          'The one-year write-off under section 19A(2) is for computers and prescribed automation ' +
            'equipment only — record isComputerOrAutomation, or elect another method.',
        );
      }
      return done(
        1,
        0,
        yearIndex === 1 ? cost : 0,
        'Section 19A(2): 100% write-off in one year for computers and prescribed automation equipment.',
      );
    }
    case 'one_year_low_value_s19a10a': {
      if (cost > SG_LOW_VALUE_PER_ITEM_LIMIT) {
        throw new RangeError(
          `The low-value one-year write-off under section 19A(10A) is for assets costing no more than ` +
            `$${SG_LOW_VALUE_PER_ITEM_LIMIT.toLocaleString('en-SG')} each — this asset costs more. ` +
            'Elect the three-year or working-life method instead.',
        );
      }
      return done(
        1,
        0,
        yearIndex === 1 ? cost : 0,
        `Section 19A(10A): 100% write-off in one year for a low-value asset. The total claimed this ` +
          `way is capped at $${SG_LOW_VALUE_TOTAL_PER_YA.toLocaleString('en-SG')} per year of ` +
          'assessment across assets — see lowValueCap().',
      );
    }
    case 'two_year_s19a1e': {
      const year1 = toCents(cost * 0.75);
      const aa = yearIndex === 1 ? year1 : yearIndex === 2 ? toCents(cost - year1) : 0;
      return done(
        2,
        0,
        aa,
        'Section 19A(1E): two-year write-off — 75% of cost in the first year, 25% in the second. ' +
          'Only for assets acquired in the basis periods for YAs 2021, 2022 and 2024, and the claim ' +
          'cannot be deferred.',
      );
    }
    case 'three_year_s19a1': {
      const annual = toCents(cost / 3);
      const aa = yearIndex < 3 ? annual : yearIndex === 3 ? toCents(cost - 2 * annual) : 0;
      return done(
        3,
        0,
        aa,
        'Section 19A(1): annual allowance of one-third of cost for three years. Claims may be deferred.',
      );
    }
    case 'working_life_s19': {
      const wl = asset.workingLifeYears;
      if (wl !== 6 && wl !== 12 && wl !== 16) {
        throw new RangeError(
          'Pass workingLifeYears — the irrevocable working-life election of 6 or 12 years (16 for a ' +
            '16-year asset) available from YA 2023. A motor vehicle has a working life of 6 years.',
        );
      }
      const ia = yearIndex === 1 ? toCents(cost * SG_INITIAL_ALLOWANCE_RATE) : 0;
      const iaYearOne = toCents(cost * SG_INITIAL_ALLOWANCE_RATE);
      const annual = toCents((cost - iaYearOne) / wl);
      const aa =
        yearIndex < wl
          ? annual
          : yearIndex === wl
            ? toCents(cost - iaYearOne - (wl - 1) * annual)
            : 0;
      return done(
        wl,
        ia,
        aa,
        `Section 19: initial allowance of 20% of cost in year one, plus an annual allowance of 80% of ` +
          `cost spread over the ${wl}-year working life.`,
      );
    }
    default:
      throw new RangeError(`Unknown Singapore write-off method: ${String(method)}`);
  }
}

// ─── The low-value cap ──────────────────────────────────────────────────────

/**
 * The s.19A(10A) limits: $5,000 per asset, $30,000 in total per YA. The total
 * runs ACROSS assets, which one asset's arithmetic cannot see, so the host
 * enforces it — sum the low-value claims for the YA and route the overflow to
 * the three-year or working-life method. IRAS's own illustration: seven
 * assets at $4,400 each is $30,800, so six ($26,400) fit under the cap and
 * the seventh is written off another way.
 *
 * The limits are the page's current ones. For a year of assessment before the
 * YA 2023 streamlining the page says nothing, and neither does this — earlier
 * limits come back null and unverified rather than today's numbers backdated.
 */
export function sgLowValueCap(yearOfAssessment: number): SgLowValueCapOutcome {
  if (yearOfAssessment >= SG_WORKING_LIFE_ELECTION_FROM_YA) {
    return {
      perItemLimit: SG_LOW_VALUE_PER_ITEM_LIMIT,
      totalPerYa: SG_LOW_VALUE_TOTAL_PER_YA,
      verified: true,
      note:
        'Section 19A(10A): 100% write-off in one year for low-value assets costing no more than ' +
        '$5,000 each, up to $30,000 of such claims per year of assessment across assets. Anything ' +
        'over the cap is written off over three years or the working life instead.',
    };
  }
  return {
    perItemLimit: null,
    totalPerYa: null,
    verified: false,
    note:
      'The low-value asset limits for years of assessment before 2023 are not recorded here. ' +
      'Confirm the limits for that year with IRAS before claiming.',
  };
}

// ─── Explainer ──────────────────────────────────────────────────────────────

/**
 * IRAS's own terms — "capital allowance", "tax written down value", "initial
 * allowance", "annual allowance" — in Fin's voice, speaking to "you". The link
 * is the IRAS page the rules were read from; nothing else.
 */
const SG_EXPLAINER: DepreciationExplainer = {
  whatItIs:
    'Book depreciation is not deductible in Singapore — capital allowances replace it, and you ' +
    'pick a write-off method for each qualifying fixed asset.',
  whenItApplies:
    'Plant and machinery used in your trade or business. Most small businesses take three years, ' +
    'or one year for computers, automation equipment and anything costing $5,000 or less (up to ' +
    '$30,000 of such one-year claims per year of assessment). S-plated private passenger cars do ' +
    'not qualify; goods and commercial vehicles do.',
  howItWorks: [
    'Record the cost (less GST if you claim the input tax) and what the asset is.',
    'Pick a method for that asset: one year (computers, automation equipment, or low-value assets up to $5,000), three years (one-third of cost each year), or the working life (20% up front, then the remaining 80% spread over an elected 6, 12 or 16 years).',
    'Claim the allowance for each year of assessment — there is no part-year reduction, and unclaimed allowances under sections 19 and 19A(1) can be deferred.',
    'The tax written down value is cost less the allowances claimed so far; on disposal, compare the sale price against it for a balancing allowance or charge.',
  ],
  readMore: [
    { label: 'Capital allowances', url: IRAS_CAPITAL_ALLOWANCES, authority: 'IRAS' },
  ],
  vocabulary: {
    asset: 'Qualifying fixed asset',
    decline: 'Capital allowance',
    writtenDown: 'Tax written down value (TWDV)',
    rate: 'Rate',
    rateBasis: 'Write-off method',
  },
};

const SG_EXTRA_ASSET_FIELDS: AssetFieldSpec[] = [
  {
    key: 'isComputerOrAutomation',
    label: 'Computer or prescribed automation equipment',
    type: 'boolean',
    required: false,
    help:
      'Computers and prescribed automation equipment — laptops, printers, software — can be ' +
      'written off 100% in one year under section 19A(2).',
  },
  {
    key: 'isSPlatedPrivateCar',
    label: 'S-plated private passenger car',
    type: 'boolean',
    required: false,
    help:
      'Capital allowances cannot be claimed on an S-plated private passenger car. Goods and ' +
      'commercial vehicles qualify.',
  },
  {
    key: 'workingLifeYears',
    label: 'Working life election (section 19)',
    type: 'enum',
    required: false,
    help:
      'The irrevocable working-life election from YA 2023: 6 or 12 years, or 16 for an asset ' +
      'with a 16-year working life. A motor vehicle has a working life of 6 years.',
    options: [
      { value: '6', label: '6 years' },
      { value: '12', label: '12 years' },
      { value: '16', label: '16 years' },
    ],
  },
];

// ─── Rules object ───────────────────────────────────────────────────────────

export const SG_DEPRECIATION_RULES: WriteOffElectiveRules = {
  countryCode: 'SG',
  regime: 'write_off_elective',
  // `prime_cost` carries the straight-line arithmetic of the elective methods
  // (a published fraction of cost each year); `immediate_writeoff` is the
  // one-year 100% under s.19A(2) or s.19A(10A).
  methods: ['prime_cost', 'immediate_writeoff'],
  defaultMethod: 'prime_cost',

  /**
   * Not used: Singapore never apportions an allowance by days — a capital
   * allowance is claimed per year of assessment in full. Returned unchanged so
   * a host that asks every country gets an honest, unused number.
   */
  dayFractionDenominator(daysInIncomeYear: number): number {
    return daysInIncomeYear;
  },

  /**
   * NO PART-YEAR APPORTIONMENT, whatever the caller passed: an allowance
   * belongs to a year of assessment whole, so the part year is forced to a
   * full year rather than honouring a day count no IRAS formula uses.
   * `annualRate` is required for `prime_cost` (1/3 for the three-year
   * write-off); the s.19 initial-plus-annual shape and the elective routing
   * live in `allowanceForYear`, which is the canonical Singapore path.
   */
  declineInValue(input: DeclineInValueInput): DeclineInValueOutcome {
    if (input.method !== 'prime_cost' && input.method !== 'immediate_writeoff') {
      throw new RangeError(
        `Singapore's capital allowances are elective straight-line write-offs: method ` +
          `"${String(input.method)}" is not available. Use allowanceForYear(asset, method, year), ` +
          'or prime_cost with annualRate (1/3 for the three-year write-off).',
      );
    }
    if (input.method === 'prime_cost' && input.annualRate == null) {
      throw new RangeError(
        'Pass annualRate — 1/3 for the three-year write-off under section 19A(1) — or use ' +
          'allowanceForYear(asset, method, year) for the initial-plus-annual shape of section 19.',
      );
    }
    return computeDeclineInValue({
      ...input,
      heldBefore10May2006: false,
      partYear: { kind: 'months', monthsUsed: 12 },
    });
  },

  /** The Sixth Schedule working life, where it was read: a motor vehicle is 6 years. */
  effectiveLife(categoryKey: string): number | null {
    return categoryKey === 'motor_vehicle' ? SG_MOTOR_VEHICLE_WORKING_LIFE : null;
  },

  /**
   * One row. The Sixth Schedule sets working lives for everything, but only
   * the motor vehicle's 6 years was read from the IRAS page — the rest are
   * left for you to look up rather than guessed.
   */
  effectiveLifeCategories(): EffectiveLifeCategory[] {
    return [
      {
        key: 'motor_vehicle',
        label: 'Motor vehicle (goods or commercial)',
        years: SG_MOTOR_VEHICLE_WORKING_LIFE,
        source:
          'IRAS, Capital Allowances (captured 2026-08-24): the working life of a motor vehicle ' +
          'under the Sixth Schedule is 6 years',
      },
    ];
  },

  /**
   * Singapore's closest analogue to an instant write-off is the s.19A(10A)
   * low-value one-year claim: $5,000 per item. The date is mapped to the year
   * of assessment the way IRAS does — the basis period ending in a calendar
   * year is assessed in the following one.
   */
  instantAssetWriteOff(onDate: Date | string): InstantAssetWriteOffInfo {
    const ya = Number(toYmd(onDate).slice(0, 4)) + 1;
    const cap = sgLowValueCap(ya);
    return { limit: cap.perItemLimit, verified: cap.verified, note: cap.note };
  },

  balancingAdjustment(input: BalancingAdjustmentInput): BalancingAdjustmentOutcome {
    return computeBalancingAdjustment(input);
  },

  explainer(): DepreciationExplainer {
    return {
      ...SG_EXPLAINER,
      howItWorks: [...SG_EXPLAINER.howItWorks],
      readMore: SG_EXPLAINER.readMore.map((r) => ({ ...r })),
      vocabulary: { ...SG_EXPLAINER.vocabulary },
    };
  },

  firstYearConcessions(onDate: Date | string): FirstYearConcession[] {
    const ya = Number(toYmd(onDate).slice(0, 4)) + 1;
    const cap = sgLowValueCap(ya);
    return [
      {
        key: 'one_year_computers_automation',
        label: 'One-year write-off — computers and automation equipment',
        kind: 'upfront_percent',
        limit: null,
        percent: 100,
        verified: true,
        note:
          'Section 19A(2): computers and prescribed automation equipment can be written off 100% ' +
          'in one year.',
        requiresField: 'isComputerOrAutomation',
      },
      {
        key: 'one_year_low_value',
        label: 'One-year write-off — low-value assets',
        kind: 'threshold_write_off',
        limit: cap.perItemLimit,
        percent: null,
        verified: cap.verified,
        note: cap.note,
      },
    ];
  },

  extraAssetFields(): AssetFieldSpec[] {
    return SG_EXTRA_ASSET_FIELDS.map((f) => ({ ...f, options: f.options?.map((o) => ({ ...o })) }));
  },

  methodsFor(asset: SgAssetInput, yearOfAssessment: number): SgWriteOffMethod[] {
    return sgMethodsFor(asset, yearOfAssessment);
  },

  allowanceForYear(asset: SgAssetInput, method: SgWriteOffMethod, yearIndex: number): SgAllowanceOutcome {
    return sgAllowanceForYear(asset, method, yearIndex);
  },

  lowValueCap(yearOfAssessment: number): SgLowValueCapOutcome {
    return sgLowValueCap(yearOfAssessment);
  },

  eligibility(asset: SgAssetInput): SgEligibilityOutcome {
    return sgEligibility(asset);
  },
};

/** The page these rules were read from, for a "where does this come from" link. */
export const SG_DEPRECIATION_AUTHORITY_URLS = {
  capitalAllowances: IRAS_CAPITAL_ALLOWANCES,
} as const;

export default SG_DEPRECIATION_RULES;
