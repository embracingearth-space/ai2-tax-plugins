/**
 * India — depreciation on blocks of assets — ai2fin.com
 * Authority: Central Board of Direct Taxes (CBDT), Income Tax Department
 *
 * India is a BLOCK regime. Depreciable assets are not written down item by
 * item: they are grouped into blocks of assets — buildings, furniture,
 * machinery and plant, intangibles — and depreciation under section 33 of the
 * Income-tax Act 2025 is the prescribed percentage of each block's written
 * down value, on the WDV method. An asset in this module is a contribution to
 * a block; the block is the unit of allowance.
 *
 * THE LAW CHANGED ON 1 APRIL 2026. The Income-tax Act 1961 and the
 * Income-tax Rules 1962 ceased to have effect on 31 March 2026; depreciation
 * now lives in section 33 of the Income-tax Act 2025 and the rates in
 * Appendix I (see rule 25) of the Income-tax Rules 2026. Every citation below
 * is to the 2025 Act and the 2026 Rules — the old section 32 / "New Appendix
 * I" citations appear nowhere except this note recording their replacement.
 *
 * Everything below was read from the authority's own documents on
 * 2026-08-23 (UTC):
 *   Income-tax Rules 2026, Appendix I (see rule 25), "Table of rates at which
 *   depreciation is admissible", from the Gazette notification (pp. 1802-1808)
 *   and the same table on incometaxindia.gov.in; Section 33, Income-tax Act
 *   2025 (incometaxindia.gov.in, page reviewed 30 July 2026).
 *
 * Rates shipped, verbatim: buildings mainly residential 5%, other buildings
 * 10%, purely temporary erections 40%; furniture and fittings including
 * electrical fittings 10%; machinery and plant general 15%; motor cars not on
 * hire 15% (30% for the 23 Aug 2019 – 31 Mar 2020 purchase window); motor
 * buses, lorries and taxis on hire 30% (45% for the same window); aeroplanes
 * 40%; computers including computer software 40%; books owned by a
 * professional 40%; ships 20%; Part B intangibles — know-how, patents,
 * copyrights, trademarks, licences, franchises — 25%. Goodwill is not a
 * depreciable asset.
 *
 * THE 180-DAY RULE (s. 33(4)): an asset acquired during the tax year
 * (1 April – 31 March) and put to use for LESS than 180 days in that year
 * earns half the prescribed rate in that year. The block earns the full rate
 * on everything else, and on the same asset from the next year.
 *
 * ADDITIONAL DEPRECIATION (s. 33(8)-(9)): 20% of actual cost, on top of the
 * normal rate, for NEW machinery or plant (other than ships and aircraft)
 * acquired and installed by an assessee engaged in manufacture, production or
 * power generation — never for office appliances, road transport vehicles, or
 * premises. Under 180 days' use splits it: 10% in the first year, 10% in the
 * next.
 *
 * SALES COME OFF THE BLOCK, NOT THE ASSET. Moneys receivable for assets sold
 * reduce the block's written down value. Proceeds that swallow the block, or
 * a block left with no assets in it, produce a short-term capital gain or
 * loss under the Act — a return item this module flags for review and never
 * computes.
 *
 * Reference: https://www.incometaxindia.gov.in/w/section-33-187
 * Reference: https://www.incometaxindia.gov.in/w/appendix-i-1
 */

import {
  computeBalancingAdjustment,
  computeDeclineInValue,
  type AssetFieldSpec,
  type BalancingAdjustmentInput,
  type BalancingAdjustmentOutcome,
  type BlockWdvRules,
  type DeclineInValueInput,
  type DeclineInValueOutcome,
  type DepreciationExplainer,
  type EffectiveLifeCategory,
  type FirstYearConcession,
  type InAdditionalDepreciationOutcome,
  type InAssetInput,
  type InBlockAssignment,
  type InBlockKey,
  type InHalfRateOutcome,
  type InstantAssetWriteOffInfo,
} from '../depreciation';

const IN_SECTION_33 = 'https://www.incometaxindia.gov.in/w/section-33-187';
const IN_APPENDIX_I = 'https://www.incometaxindia.gov.in/w/appendix-i-1';

/** The incometaxindia.gov.in pages these rules were read from. */
export const IN_DEPRECIATION_AUTHORITY_URLS = {
  section33: IN_SECTION_33,
  appendixI: IN_APPENDIX_I,
} as const;

/** Section 33(4): an asset put to use for fewer days than this in its acquisition year earns half the rate. */
export const IN_HALF_RATE_UNDER_DAYS = 180;

// ─── Blocks — Appendix I, Income-tax Rules 2026 ─────────────────────────────

export interface InBlockRow {
  block: InBlockKey;
  label: string;
  /** As a fraction. */
  rate: number;
  /** The Appendix I item, cited to the 2026 Rules. */
  source: string;
  verified: true;
  note?: string;
}

const APPENDIX = 'Income-tax Rules 2026, Appendix I (rule 25)';

/**
 * Appendix I of the Income-tax Rules 2026, the blocks a small business meets.
 * Every rate is the table's own; the historic 2019-20 uplifted vehicle rates
 * are notes, not rates, because they closed on 1 April 2020.
 */
export const IN_BLOCKS: readonly InBlockRow[] = [
  {
    block: 'building_residential',
    label: 'Buildings used mainly for residential purposes (5%)',
    rate: 0.05,
    source: `${APPENDIX}, Part A, item I(1)`,
    verified: true,
    note: 'Hotels and boarding houses are not residential buildings for this purpose — they take the 10% rate.',
  },
  {
    block: 'building_other',
    label: 'Buildings other than residential (10%)',
    rate: 0.1,
    source: `${APPENDIX}, Part A, item I(2)`,
    verified: true,
  },
  {
    block: 'building_temporary',
    label: 'Purely temporary erections such as wooden structures (40%)',
    rate: 0.4,
    source: `${APPENDIX}, Part A, item I(4)`,
    verified: true,
  },
  {
    block: 'furniture_fittings',
    label: 'Furniture and fittings including electrical fittings (10%)',
    rate: 0.1,
    source: `${APPENDIX}, Part A, item II`,
    verified: true,
  },
  {
    block: 'plant_machinery_general',
    label: 'Machinery and plant — general (15%)',
    rate: 0.15,
    source: `${APPENDIX}, Part A, item III(1)`,
    verified: true,
    note: 'The residual machinery and plant block: everything not given its own higher rate.',
  },
  {
    block: 'motor_car',
    label: 'Motor cars, not used in a business of running them on hire (15%)',
    rate: 0.15,
    source: `${APPENDIX}, Part A, item III(2)(i)`,
    verified: true,
    note:
      'Cars acquired between 23 August 2019 and 31 March 2020 and put to use before 1 April 2020 took ' +
      '30% (item III(2)(ii)); that window is closed and is not applied here.',
  },
  {
    block: 'motor_vehicle_hire',
    label: 'Motor buses, lorries and taxis used in a business of running them on hire (30%)',
    rate: 0.3,
    source: `${APPENDIX}, Part A, item III(3)(ii)`,
    verified: true,
    note:
      'Hire vehicles acquired between 23 August 2019 and 31 March 2020 and put to use before ' +
      '1 April 2020 took 45% (item III(3)(iii)); that window is closed and is not applied here.',
  },
  {
    block: 'aeroplane',
    label: 'Aeroplanes and aeroengines (40%)',
    rate: 0.4,
    source: `${APPENDIX}, Part A, item III(3)(i)`,
    verified: true,
  },
  {
    block: 'computers_software',
    label: 'Computers including computer software (40%)',
    rate: 0.4,
    source: `${APPENDIX}, Part A, item III(5)`,
    verified: true,
  },
  {
    block: 'books_profession',
    label: 'Books owned by an assessee carrying on a profession (40%)',
    rate: 0.4,
    source: `${APPENDIX}, Part A, item III (books)`,
    verified: true,
    note: 'Annual publications and other professional books both take 40%, as do lending library books.',
  },
  {
    block: 'ships',
    label: 'Ships — ocean-going and inland vessels (20%)',
    rate: 0.2,
    source: `${APPENDIX}, Part A, item IV(1)-(2)`,
    verified: true,
  },
  {
    block: 'intangibles',
    label: 'Know-how, patents, copyrights, trademarks, licences, franchises (25%)',
    rate: 0.25,
    source: `${APPENDIX}, Part B`,
    verified: true,
    note: 'Goodwill of a business or profession is not a depreciable asset and takes no rate.',
  },
];

const BLOCK_BY_KEY: ReadonlyMap<string, InBlockRow> = new Map(IN_BLOCKS.map((b) => [b.block, b]));

/** The row for a block key, or null where the block is not on the list shipped here. */
export function inBlockRow(block: string): InBlockRow | null {
  return BLOCK_BY_KEY.get(String(block).trim()) ?? null;
}

function assignment(row: InBlockRow, verified = true, note?: string): InBlockAssignment {
  return {
    block: row.block,
    rate: row.rate,
    label: row.label,
    source: row.source,
    verified,
    note: note ?? row.note,
  };
}

const KIND_TO_BLOCK: Readonly<Record<string, InBlockKey>> = {
  building_residential: 'building_residential',
  building_other: 'building_other',
  building_temporary: 'building_temporary',
  furniture: 'furniture_fittings',
  electrical_fittings: 'furniture_fittings',
  machinery: 'plant_machinery_general',
  plant: 'plant_machinery_general',
  office_appliance: 'plant_machinery_general',
  motor_car: 'motor_car',
  bus_lorry_taxi_hire: 'motor_vehicle_hire',
  aeroplane: 'aeroplane',
  computer: 'computers_software',
  software: 'computers_software',
  books: 'books_profession',
  ship: 'ships',
  intangible: 'intangibles',
};

/**
 * Which block an asset joins. A block already on the register wins; otherwise
 * the asset's `kind` routes it by Appendix I's own words. An asset nothing
 * describes falls to the residual machinery and plant block, unverified.
 */
export function inBlockFor(asset: InAssetInput): InBlockAssignment {
  if (asset.blockKey != null && String(asset.blockKey).trim() !== '') {
    const row = inBlockRow(asset.blockKey);
    if (row) return assignment(row);
    return {
      block: String(asset.blockKey).trim(),
      rate: null,
      label: `Block ${String(asset.blockKey).trim()}`,
      source: APPENDIX,
      verified: false,
      note:
        `Block "${String(asset.blockKey).trim()}" is not one of the blocks recorded here, so its rate is ` +
        'not known to these rules. Find it in Appendix I of the Income-tax Rules 2026.',
    };
  }

  const kind = asset.kind ?? 'other';
  const key = KIND_TO_BLOCK[kind];
  if (key) {
    const row = BLOCK_BY_KEY.get(key) as InBlockRow;
    if (kind === 'office_appliance') {
      return assignment(
        row,
        true,
        'Office appliances are machinery and plant at the general 15% rate — and they never qualify for ' +
          'additional depreciation, however new they are.',
      );
    }
    return assignment(row);
  }

  return assignment(
    BLOCK_BY_KEY.get('plant_machinery_general') as InBlockRow,
    false,
    'Machinery and plant at 15% is the residual block, but nothing here says what this asset is. ' +
      'Record its kind or its block.',
  );
}

// ─── The 180-day rule — s. 33(4) ────────────────────────────────────────────

export function inHalfRate(putToUseDays: number): InHalfRateOutcome {
  const days = Number(putToUseDays);
  if (!Number.isFinite(days) || days < 0 || days > 366) {
    throw new RangeError(
      `putToUseDays must be 0-366 — the days the asset was put to use in the tax year (received ${String(putToUseDays)})`,
    );
  }
  if (days < IN_HALF_RATE_UNDER_DAYS) {
    return {
      half: true,
      factor: 0.5,
      verified: true,
      note:
        `Acquired during the tax year and put to use for ${days} days — fewer than 180 — so section 33(4) ` +
        'of the Income-tax Act 2025 restricts this year\'s depreciation to 50% of the prescribed rate. ' +
        'From next year the block earns the full rate on it.',
    };
  }
  return {
    half: false,
    factor: 1,
    verified: true,
    note: `Put to use for ${days} days — 180 or more — so the full prescribed rate applies.`,
  };
}

// ─── Additional depreciation — s. 33(8)-(9) ─────────────────────────────────

/** Blocks that can never carry additional depreciation: not machinery or plant, or excluded by s. 33(8). */
const NO_ADDITIONAL_DEPRECIATION_BLOCKS: ReadonlySet<string> = new Set([
  'building_residential',
  'building_other',
  'building_temporary',
  'furniture_fittings',
  'ships',
  'aeroplane',
  'books_profession',
  'intangibles',
  // Road transport vehicles routed here BY KIND (motor_car, bus_lorry_taxi_hire
  // → motor_vehicle_hire) — s. 33(8) excludes them whatever the boolean flag
  // says, and a caller that only sets `kind` must get the same "no" as one
  // that sets `isRoadTransportVehicle`.
  'motor_car',
  'motor_vehicle_hire',
]);

/**
 * Section 33(8)-(9) of the Income-tax Act 2025: an assessee engaged in the
 * manufacture or production of an article or thing, or in the generation,
 * transmission or distribution of power, gets an ADDITIONAL 20% of the actual
 * cost of NEW machinery or plant in the year it is acquired and installed —
 * on top of the normal rate. Never for ships, aircraft, office appliances,
 * road transport vehicles, or anything already fully deducted. Under 180
 * days' use splits it 10% + 10% across two years. Every condition is a
 * recorded answer, not a guess: an unanswered question is a "no".
 */
export function inAdditionalDepreciation(asset: InAssetInput): InAdditionalDepreciationOutcome {
  const no = (note: string): InAdditionalDepreciationOutcome => ({
    eligible: false,
    percent: null,
    splitYearOne: null,
    splitYearTwo: null,
    verified: true,
    note,
  });

  if (asset.isManufacturer !== true) {
    return no(
      asset.isManufacturer == null
        ? 'Additional depreciation needs the assessee to be engaged in manufacture, production or power ' +
            'generation (section 33(8), Income-tax Act 2025), and that has not been recorded — an ' +
            'unanswered question is never a yes.'
        : 'Additional depreciation under section 33(8) of the Income-tax Act 2025 is for assessees ' +
            'engaged in manufacture, production or power generation only.',
    );
  }
  if (asset.isNewAsset !== true) {
    return no(
      asset.isNewAsset == null
        ? 'Additional depreciation is for NEW machinery or plant, and whether this asset is new has not ' +
            'been recorded — an unanswered question is never a yes.'
        : 'Additional depreciation under section 33(8) of the Income-tax Act 2025 is for new machinery ' +
            'or plant only, not previously used by any person.',
    );
  }
  // `kind: 'office_appliance'` routes to the same plant_machinery_general
  // block as ordinary machinery (inBlockFor has no separate block for it), so
  // the block-based exclusion below can't catch it — only the boolean or the
  // kind itself can.
  if (asset.isOfficeAppliance === true || asset.kind === 'office_appliance') {
    return no('Office appliances are excluded from additional depreciation by section 33(8) of the Income-tax Act 2025.');
  }
  if (asset.isRoadTransportVehicle === true) {
    return no('Road transport vehicles are excluded from additional depreciation by section 33(8) of the Income-tax Act 2025.');
  }
  const block = inBlockFor(asset);
  if (NO_ADDITIONAL_DEPRECIATION_BLOCKS.has(String(block.block))) {
    return no(
      'Additional depreciation under section 33(8) of the Income-tax Act 2025 is for machinery or plant ' +
        'other than ships and aircraft — buildings, furniture, ships, aircraft and intangibles never qualify.',
    );
  }

  const under180 = asset.putToUseDays != null && Number(asset.putToUseDays) < IN_HALF_RATE_UNDER_DAYS;
  if (under180) {
    return {
      eligible: true,
      percent: null,
      splitYearOne: 10,
      splitYearTwo: 10,
      verified: true,
      note:
        'New machinery or plant of a manufacturer, put to use under 180 days in the year of acquisition: ' +
        'section 33(9) of the Income-tax Act 2025 splits the additional depreciation — 10% of actual cost ' +
        'this year, the remaining 10% next year — on top of the normal (half) rate.',
    };
  }
  return {
    eligible: true,
    percent: 20,
    splitYearOne: null,
    splitYearTwo: null,
    verified: true,
    note:
      'New machinery or plant acquired and installed by a manufacturer or power producer: section 33(8) ' +
      'of the Income-tax Act 2025 allows an additional 20% of actual cost in the year of installation, ' +
      'on top of the normal rate.',
  };
}

// ─── Explainer ──────────────────────────────────────────────────────────────

const IN_EXPLAINER: DepreciationExplainer = {
  whatItIs:
    'Assets are grouped into blocks — buildings, furniture, machinery, vehicles, computers, intangibles ' +
    '— and depreciation is a fixed percentage of each block\'s written down value, not of each item.',
  whenItApplies:
    'Anything you own and use for your business or profession during the tax year, 1 April to 31 March. ' +
    'An asset bought during the year and put to use for fewer than 180 days earns half the rate in that ' +
    'first year. If you manufacture goods or generate power, new plant and machinery earns an extra 20% ' +
    'of cost in the year it is installed (10% now and 10% next year when used under 180 days). Sale ' +
    'proceeds come off the block rather than producing a per-asset profit or loss.',
  howItWorks: [
    'Start each block with its written down value from last year, add what you bought at actual cost, ' +
      'and take off the moneys received for anything sold.',
    'Claim the block\'s Appendix I rate on that balance — 10% furniture, 15% machinery and cars, 30% ' +
      'hire vehicles, 40% computers and software, 25% intangibles — with half the rate on additions ' +
      'used under 180 days.',
    'The balance after depreciation is next year\'s written down value; the same asset earns the full ' +
      'rate from its second year.',
    'If sale proceeds exceed the block, or the block is left empty, the difference is a short-term ' +
      'capital gain or loss on the return — flag it for your tax adviser rather than depreciating.',
  ],
  readMore: [
    { label: 'Section 33 — Depreciation (Income-tax Act 2025)', url: IN_SECTION_33, authority: 'Income Tax Department' },
    {
      label: 'Appendix I — Table of rates at which depreciation is admissible (Income-tax Rules 2026)',
      url: IN_APPENDIX_I,
      authority: 'Income Tax Department',
    },
  ],
  vocabulary: {
    asset: 'Asset in block',
    decline: 'Depreciation',
    writtenDown: 'Written down value of the block',
    rate: 'Rate',
    rateBasis: 'Block of assets',
  },
};

const IN_EXTRA_ASSET_FIELDS: AssetFieldSpec[] = [
  {
    key: 'blockKey',
    label: 'Block of assets',
    type: 'enum',
    required: false,
    options: IN_BLOCKS.map((b) => ({ value: b.block, label: b.label })),
    help:
      'The Appendix I block this asset belongs to. Leave it blank and Fin suggests one from what the ' +
      'asset is; set it where you know better.',
  },
  {
    key: 'putToUseDays',
    label: 'Days put to use in the first year',
    type: 'number',
    required: false,
    help:
      'How many days the asset was put to use in the tax year you acquired it (1 April – 31 March). ' +
      'Fewer than 180 halves the first-year rate under section 33(4).',
  },
  {
    key: 'isManufacturer',
    label: 'Manufacturer or power producer',
    type: 'boolean',
    required: false,
    help:
      'The business manufactures or produces an article or thing, or generates, transmits or ' +
      'distributes power. Needed for the 20% additional depreciation on new plant and machinery.',
  },
  {
    key: 'isNewAsset',
    label: 'New asset',
    type: 'boolean',
    required: false,
    help: 'Not previously used by any person. Additional depreciation is for new machinery and plant only.',
  },
  {
    key: 'isOfficeAppliance',
    label: 'Office appliance',
    type: 'boolean',
    required: false,
    help: 'Office appliances depreciate at the general 15% rate but never earn additional depreciation.',
  },
  {
    key: 'isRoadTransportVehicle',
    label: 'Road transport vehicle',
    type: 'boolean',
    required: false,
    help: 'Road transport vehicles are excluded from additional depreciation, whatever the business.',
  },
];

// ─── Rules object ───────────────────────────────────────────────────────────

const IN_NO_GENERAL_WRITE_OFF: InstantAssetWriteOffInfo = {
  limit: null,
  verified: false,
  note:
    'India has no general instant write-off threshold: every depreciable asset joins a block at the ' +
    'Appendix I rate, however small. Purely temporary erections and computers take 40%, which is a ' +
    'rate, not a write-off. Check with your tax adviser before expensing an asset outright.',
};

export const IN_DEPRECIATION_RULES: BlockWdvRules = {
  countryCode: 'IN',
  regime: 'block_wdv',
  // The unit is the block: there is no per-asset prime cost or diminishing value here.
  methods: ['pool'],
  defaultMethod: 'pool',

  /** Part years are handled by the 180-day test, not day fractions; this is informational only. */
  dayFractionDenominator(): number {
    return 365;
  },

  /**
   * One year's depreciation on a block balance, for a host that only has the
   * per-asset interface: pass the block's written down value as
   * `openingAdjustableValue` and the Appendix I rate as `annualRate`. No
   * 180-day split, no sale proceeds — for those use `computeBlockPeriod`.
   */
  declineInValue(input: DeclineInValueInput): DeclineInValueOutcome {
    if (input.method !== 'pool') {
      throw new RangeError(
        `India depreciates by BLOCK of assets, not per asset: method "${String(input.method)}" is not ` +
          'available. Use `pool` with `annualRate` from blockFor(), or computeBlockPeriod().',
      );
    }
    if (input.annualRate == null) {
      throw new RangeError('Pass `annualRate` — the Appendix I rate from blockFor(asset) — for an Indian block.');
    }
    const rate = input.annualRate;
    return computeDeclineInValue(
      { ...input, method: 'pool', partYear: { kind: 'months', monthsUsed: 12 } },
      { allocationYear: rate, ongoing: rate },
    );
  },

  /** Appendix I publishes block rates, not effective lives. */
  effectiveLife(): number | null {
    return null;
  },

  effectiveLifeCategories(): EffectiveLifeCategory[] {
    return [];
  },

  instantAssetWriteOff(): InstantAssetWriteOffInfo {
    return { ...IN_NO_GENERAL_WRITE_OFF };
  },

  blockFor(asset: InAssetInput): InBlockAssignment {
    return inBlockFor(asset);
  },

  halfRate(putToUseDays: number): InHalfRateOutcome {
    return inHalfRate(putToUseDays);
  },

  additionalDepreciation(asset: InAssetInput): InAdditionalDepreciationOutcome {
    return inAdditionalDepreciation(asset);
  },

  /**
   * Blocks have no per-asset balancing adjustment — proceeds reduce the block
   * inside `computeBlockPeriod`, and an excess is a short-term capital gain
   * this module flags, never computes. This generic arithmetic is here for
   * hosts comparing a lone asset's proceeds against its share of the block.
   */
  balancingAdjustment(input: BalancingAdjustmentInput): BalancingAdjustmentOutcome {
    return computeBalancingAdjustment(input);
  },

  explainer(): DepreciationExplainer {
    return {
      ...IN_EXPLAINER,
      howItWorks: [...IN_EXPLAINER.howItWorks],
      readMore: IN_EXPLAINER.readMore.map((r) => ({ ...r })),
      vocabulary: { ...IN_EXPLAINER.vocabulary },
    };
  },

  firstYearConcessions(): FirstYearConcession[] {
    return [
      {
        key: 'additional_depreciation_new_plant',
        label: 'Additional depreciation — new plant and machinery (manufacturers)',
        kind: 'upfront_percent',
        limit: null,
        percent: 20,
        verified: true,
        note:
          'An assessee engaged in manufacture, production or power generation claims an extra 20% of the ' +
          'actual cost of new machinery or plant in the year it is installed (section 33(8), Income-tax ' +
          'Act 2025) — 10% now and 10% next year where it was used under 180 days. Not for office ' +
          'appliances, road transport vehicles, ships or aircraft.',
        requiresField: 'isManufacturer',
      },
    ];
  },

  extraAssetFields(): AssetFieldSpec[] {
    return IN_EXTRA_ASSET_FIELDS.map((f) => ({ ...f, options: f.options?.map((o) => ({ ...o })) }));
  },
};

export default IN_DEPRECIATION_RULES;
