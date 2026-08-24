/**
 * Australia — capital allowances (depreciation) — ai2fin.com
 * Authority: Australian Taxation Office (ATO)
 *
 * Two sets of rules sit behind one interface:
 *
 * 1. The GENERAL rules — prime cost and diminishing value, from "Prime cost
 *    (straight line) and diminishing value methods" (last updated 27 June 2025).
 *    The arithmetic is shared with every other country in ../depreciation.
 * 2. The SIMPLIFIED rules for small business (aggregated turnover under
 *    $10 million), from "Simpler depreciation rules for small business" (last
 *    updated 9 December 2025): the instant asset write-off, and the general
 *    small business pool at 15% in the allocation year and 30% after.
 *
 * THE WRITE-OFF LIMIT IS EFFECTIVE-DATED AND STOPS AT 30 JUNE 2026 ON PURPOSE.
 * The ATO states $20,000 for 2023-24, 2024-25 and 2025-26. It states nothing
 * for 2026-27, so this file states nothing either: the row for 2026-27 onwards
 * carries `limit: null, verified: false` and a note telling you to confirm the
 * current limit. It does NOT carry $20,000 forward and does NOT assume the
 * $1,000 statutory reversion — printing an unverified statutory threshold in a
 * tax product is worse than printing nothing, because nobody checks a number
 * that looks confident.
 *
 * Reference: https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/depreciation-and-capital-expenses-and-allowances/general-depreciation-rules-capital-allowances/prime-cost-straight-line-and-diminishing-value-methods
 * Reference: https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/depreciation-and-capital-expenses-and-allowances/simpler-depreciation-for-small-business
 * Reference: https://www.legislation.gov.au/F2025L01097/asmade
 */

import { toYmd } from '../data/rateLedger';
import {
  computeBalancingAdjustment,
  computeDeclineInValue,
  type BalancingAdjustmentInput,
  type BalancingAdjustmentOutcome,
  type DeclineInValueInput,
  type DeclineInValueOutcome,
  type AssetFieldSpec,
  type DepreciationExplainer,
  type DepreciationRules,
  type EffectiveLifeCategory,
  type FirstYearConcession,
  type InstantAssetWriteOffInfo,
} from '../depreciation';

const ATO_GENERAL_DEPRECIATION =
  'https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/depreciation-and-capital-expenses-and-allowances/general-depreciation-rules-capital-allowances/prime-cost-straight-line-and-diminishing-value-methods';
const ATO_SIMPLER_DEPRECIATION =
  'https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/depreciation-and-capital-expenses-and-allowances/simpler-depreciation-for-small-business';

/**
 * The Commissioner's effective life determination in force: the Income Tax
 * Assessment (Effective Life of Depreciating Assets) Determination 2025
 * (LI 2025/20, F2025L01097), which commenced 16 September 2025 and repealed the
 * 2015 determination. Effective lives used to be published in taxation rulings
 * (TR 2022/1 and its predecessors); that practice ended, so a citation to a TR
 * is now a citation to a withdrawn document.
 */
export const AU_EFFECTIVE_LIFE_DETERMINATION =
  'Income Tax Assessment (Effective Life of Depreciating Assets) Determination 2025 (F2025L01097), Table B';

const TABLE_B = `${AU_EFFECTIVE_LIFE_DETERMINATION} — https://www.legislation.gov.au/F2025L01097/asmade`;

/**
 * A SHORT, VERIFIED list, not a long guessed one. Every row below was read out
 * of Table B of the determination itself (Table B applies across all industries;
 * Table A is industry-specific and is deliberately not modelled here). Assets
 * that are not on this list are not missing by accident — they are left for you
 * to look up or self-assess, because a wrong effective life is a wrong deduction
 * every year for the life of the asset.
 *
 * Effective life is a choice: you may adopt the Commissioner's figure or
 * self-assess your own. These are the Commissioner's.
 *
 * Every `source` below is the instrument's OWN wording, quoted in full and not
 * summarised. A shortened quote reads as a citation while being something the
 * determination does not actually say, and the whole point of the field is that
 * a reader can check the figure against the source without trusting us.
 */
export const AU_EFFECTIVE_LIFE_CATEGORIES: EffectiveLifeCategory[] = [
  // Table B — "Computers and computer equipment"
  {
    key: 'computer_laptop',
    label: 'Laptop or tablet',
    years: 2,
    source: `${TABLE_B}: "Mobile/portable computers (including laptops, tablets)"`,
  },
  {
    key: 'computer_desktop',
    label: 'Desktop computer',
    years: 4,
    source: `${TABLE_B}: "Desktop computers (including personal computers)"`,
  },
  {
    key: 'computer_monitor',
    label: 'Computer monitor',
    years: 4,
    source: `${TABLE_B}: "Computer monitors"`,
  },
  {
    key: 'computer_server',
    label: 'Server',
    years: 4,
    source: `${TABLE_B}: "Servers"`,
  },
  {
    key: 'network_equipment',
    label: 'Network equipment (modem, router, switch)',
    years: 5,
    source: `${TABLE_B}: "Network equipment (including hubs, modems routers, switches, etc)"`,
  },
  // Table B — "Telephony"
  {
    key: 'mobile_phone',
    label: 'Mobile phone',
    years: 3,
    source: `${TABLE_B}: "Telephony: Mobile phones"`,
  },
  {
    key: 'telephone_system',
    label: 'Telephone system (PABX, VoIP)',
    years: 7,
    source: `${TABLE_B}: "Telephony: Telephone systems (including analogue and digital telephone systems, PABX/PBX systems, key/commander systems, VoIP systems and hybrid telephone systems such as IP-PBX systems etc)"`,
  },
  // Table B — "Office furniture, freestanding"
  {
    key: 'office_desk',
    label: 'Office desk',
    years: 20,
    source: `${TABLE_B}: "Office furniture, freestanding: Desks"`,
  },
  {
    key: 'office_chair',
    label: 'Office chair',
    years: 10,
    source: `${TABLE_B}: "Office furniture, freestanding: Chairs"`,
  },
  {
    key: 'office_workstation',
    label: 'Workstation (desk and partitions)',
    years: 20,
    source: `${TABLE_B}: "Office furniture, freestanding: Workstations (including desks and partitions)"`,
  },
  {
    key: 'office_cabinet_metal',
    label: 'Metal cabinet or filing cabinet',
    years: 20,
    source: `${TABLE_B}: "Office furniture, freestanding: Cabinets (including credenzas, cupboards, filing, mapping, mobile, stationery and storage type): Metal"`,
  },
  // Table B — "Office machines and equipment"
  {
    key: 'photocopier',
    label: 'Photocopier',
    years: 5,
    source: `${TABLE_B}: "Office machines and equipment: Photo copying machines"`,
  },
  {
    key: 'multifunction_printer',
    label: 'Multifunction printer (print, copy, scan, fax)',
    years: 5,
    source: `${TABLE_B}: "Office machines and equipment: Multi function machines (includes fax, copy, print and scan functions)"`,
  },
  // Table B — "Motor vehicles and trailers"
  {
    key: 'motor_vehicle_car',
    label: 'Car',
    years: 8,
    source: `${TABLE_B}: "Motor vehicles and trailers: Cars (motor vehicles designed to carry a load of less than one tonne and fewer than 9 passengers): Generally"`,
  },
  {
    key: 'light_commercial_vehicle',
    label: 'Ute or van (one tonne or more)',
    years: 12,
    source: `${TABLE_B}: "Motor vehicles and trailers: Light commercial vehicles designed to carry a load of one tonne or greater and having a gross vehicle mass of 3.5 tonnes or less"`,
  },
];

const EFFECTIVE_LIFE_BY_KEY = new Map(
  AU_EFFECTIVE_LIFE_CATEGORIES.map((c) => [c.key, c.years] as const),
);

// ─── Instant asset write-off — effective-dated ──────────────────────────────

export interface AuWriteOffRow extends InstantAssetWriteOffInfo {
  /** YYYY-MM-DD, inclusive. The row runs until the next row's effectiveFrom. */
  effectiveFrom: string;
}

/**
 * Resolved by calendar day the same way the rate ledger resolves a rate: the row
 * with the greatest `effectiveFrom` on or before the date. Rows are contiguous
 * by construction (each runs until the next one starts), so no date inside the
 * covered range falls into a hole. Each row states what the ATO states for its
 * window — including the windows where the answer is "not published", which are
 * rows in their own right rather than gaps.
 *
 * Written newest-first for readability, but the resolver sorts rather than
 * trusting that: see `sortWriteOffRowsNewestFirst`. A row added out of order
 * still resolves correctly.
 */
export const AU_INSTANT_ASSET_WRITE_OFF_ROWS: AuWriteOffRow[] = [
  {
    // 2026-27: THE LEGISLATED FIGURE IS $1,000, and it is not "unpublished".
    //
    // This row used to read `limit: null, verified: false` — "the ATO has not
    // published a limit". That was wrong in both directions. There IS a
    // standing legislated threshold: absent a temporary increase, the
    // simplified depreciation rules write off assets costing less than
    // $1,000, and the $20,000 row above was one of those temporary increases,
    // which ended 30 June 2026. Reporting null meant a $900 asset got no
    // offer at all (a real, if small, missed deduction) and a $15,000 asset
    // got no warning (an over-claim under the law as it currently stands).
    //
    // The $20,000 permanent threshold announced in the 2026-27 Budget from
    // 1 July 2026 is NOT YET LAW — the enabling bill was still before
    // Parliament as at 2026-08-25, and the ATO's own new-legislation page
    // says so. It is carried in `proposed`, never in `limit`: this package
    // does not report an announcement as a rate. embracingearth.space
    effectiveFrom: '2026-07-01',
    limit: 1000,
    verified: true,
    boundary: 'under',
    note:
      '$1,000 per asset — the standing threshold under the simplified depreciation rules, ' +
      'which is what applies once a temporary increase ends. The $20,000 threshold for ' +
      '2023-24 to 2025-26 ended on 30 June 2026. A permanent $20,000 threshold from ' +
      '1 July 2026 was announced in the 2026-27 Budget but is NOT YET LAW, so it cannot be ' +
      'relied on for an asset you are claiming now. Check the progress of the enabling ' +
      'legislation with the ATO or your registered tax agent before you write off anything ' +
      'above $1,000.',
    proposed: {
      limit: 20000,
      note:
        'Announced in the 2026-27 Federal Budget: a permanent $20,000 instant asset write-off ' +
        'from 1 July 2026 for small businesses with an aggregated turnover under $10 million. ' +
        'Before Parliament and not yet law as at 25 August 2026 — if it passes, assets costing ' +
        'less than $20,000 first used or installed ready for use from 1 July 2026 would qualify.',
    },
  },
  {
    effectiveFrom: '2023-07-01',
    limit: 20000,
    verified: true,
    // The ATO's wording is "cost less than $20,000" — exactly $20,000 misses.
    boundary: 'under',
    note:
      '$20,000 per asset for the 2023-24, 2024-25 and 2025-26 income years, for small ' +
      'businesses with an aggregated turnover under $10 million using the simplified ' +
      'depreciation rules. The asset must cost less than $20,000 and be first used or ' +
      'installed ready for use for a taxable purpose within the income year. The limit ' +
      'applies per asset, so more than one asset can be written off.',
  },
  {
    effectiveFrom: '2020-10-06',
    limit: null,
    verified: false,
    note:
      'Temporary full expensing applied from 6 October 2020 to 30 June 2023, so there was no ' +
      'ordinary write-off limit to apply in that window. Check the rules for that income year ' +
      'with the ATO rather than using a threshold.',
  },
  {
    effectiveFrom: '2000-07-01',
    limit: null,
    verified: false,
    note:
      'Write-off limits for income years before 2020-21 are not recorded here. Confirm the ' +
      'limit for that year with the ATO or your registered tax agent.',
  },
];

/**
 * Newest-first, by `effectiveFrom`. `YYYY-MM-DD` sorts correctly as a string, so
 * no date parsing is involved.
 *
 * The literal above IS written newest-first, but the resolver must not DEPEND on
 * that: an editor who inserts a new row at the bottom would otherwise get a
 * stale limit back with `verified: true`, and no test on an existing date would
 * fail. Order is derived, never assumed.
 */
export function sortWriteOffRowsNewestFirst(rows: readonly AuWriteOffRow[]): AuWriteOffRow[] {
  return [...rows].sort((a, b) =>
    a.effectiveFrom < b.effectiveFrom ? 1 : a.effectiveFrom > b.effectiveFrom ? -1 : 0,
  );
}

/**
 * The row in force on a date, from any set of rows in any order. Exported so the
 * ordering guarantee can be tested against a deliberately out-of-order literal.
 */
export function resolveWriteOffRow(
  rows: readonly AuWriteOffRow[],
  onDate: Date | string,
): InstantAssetWriteOffInfo {
  const ymd = toYmd(onDate);
  const ordered = sortWriteOffRowsNewestFirst(rows);
  // The first row that has started is the one in force. A date before the
  // earliest row falls back to that earliest row, which is itself an unverified
  // "not recorded here" — never to a number.
  const row = ordered.find((r) => r.effectiveFrom <= ymd) ?? ordered[ordered.length - 1];
  return {
    limit: row.limit,
    verified: row.verified,
    note: row.note,
    ...(row.boundary ? { boundary: row.boundary } : {}),
    ...(row.proposed ? { proposed: { ...row.proposed } } : {}),
  };
}

/** Sorted once, at module load, rather than on every lookup. */
const AU_WRITE_OFF_ROWS_NEWEST_FIRST: readonly AuWriteOffRow[] = sortWriteOffRowsNewestFirst(
  AU_INSTANT_ASSET_WRITE_OFF_ROWS,
);

export function auInstantAssetWriteOff(onDate: Date | string): InstantAssetWriteOffInfo {
  return resolveWriteOffRow(AU_WRITE_OFF_ROWS_NEWEST_FIRST, onDate);
}

// ─── General small business pool ────────────────────────────────────────────

/** 15% in the year an asset is allocated to the pool, 30% each year after. */
export const AU_SMALL_BUSINESS_POOL_RATES = { allocationYear: 0.15, ongoing: 0.3 } as const;

/**
 * The low-pool-balance rule: where the pool balance at the end of the income
 * year — before that year's deductions — is below the instant asset write-off
 * limit, the whole balance is deducted.
 *
 * This is deliberately a separate call rather than something declineInValue()
 * does quietly. It depends on the write-off limit, which is unverified for
 * 2026-27 onwards, and a rule that silently zeroes a pool is exactly the kind
 * of thing that should be shown to the person lodging before it is applied.
 * `deductWholeBalance: null` means the limit for that date is not known, so the
 * question cannot be answered — not that the answer is no.
 */
export function auSmallBusinessPoolWriteOff(
  poolBalanceBeforeDeductions: number,
  onDate: Date | string,
): { deductWholeBalance: boolean | null; amount: number | null } & InstantAssetWriteOffInfo {
  const writeOff = auInstantAssetWriteOff(onDate);
  const balance = Number(poolBalanceBeforeDeductions) || 0;
  if (writeOff.limit === null) {
    return { ...writeOff, deductWholeBalance: null, amount: null };
  }
  const deductWholeBalance = balance > 0 && balance < writeOff.limit;
  return {
    ...writeOff,
    deductWholeBalance,
    amount: deductWholeBalance ? balance : 0,
  };
}

// ─── Rules object ───────────────────────────────────────────────────────────

/**
 * Australia fixes the day-fraction denominator at 365 in EVERY income year.
 *
 * The published formula is "cost × (days held ÷ 365) × (100% ÷ effective life)"
 * and the same page states that "days held can be 366 for a leap year". Both
 * are true at once: in a leap year a full-year hold yields 366/365 of a year's
 * decline. Dividing by 366 instead would quietly shorten every leap-year claim,
 * so callers must pass 365 here — not the actual length of the income year.
 *
 * The rules below do not merely publish this number — `declineInValue` applies
 * it, overriding whatever `daysInYear` a caller passed. A rule that lives in a
 * comment is a rule every caller has to remember; a rule that lives in the
 * plugin is a rule nobody can get wrong.
 *
 * Reference: ATO, "Prime cost (straight line) and diminishing value methods".
 */
export const AU_DAY_FRACTION_DENOMINATOR = 365;

/**
 * The ATO's own vocabulary: "depreciating asset", "decline in value",
 * "adjustable value", "effective life". The two links are the two pages the
 * rules above were read from — nothing else.
 */
const AU_EXPLAINER: DepreciationExplainer = {
  whatItIs:
    'A depreciating asset — one that loses value as you use it — is claimed as a decline in ' +
    'value over its effective life, not all at once.',
  whenItApplies:
    'Assets you hold for a taxable purpose, claimed for the days in the income year you held ' +
    'them. A small business using the simplified depreciation rules can instead write an ' +
    'asset off immediately where it costs less than the instant asset write-off limit for ' +
    'that year, and pool the rest.',
  howItWorks: [
    'Record the cost (GST-exclusive if you claim the GST credit) and the date it was first used or installed ready for use.',
    "Take the Commissioner's effective life for the asset, or self-assess your own; the rate follows from it.",
    'Prime cost claims the same amount each year: cost × days held ÷ 365 × 100% ÷ effective life.',
    'Diminishing value claims more early: adjustable value × days held ÷ 365 × 200% ÷ effective life, and the claim is your taxable-use share of that decline.',
  ],
  readMore: [
    {
      label: 'Prime cost (straight line) and diminishing value methods',
      url: ATO_GENERAL_DEPRECIATION,
      authority: 'ATO',
    },
    { label: 'Simpler depreciation for small business', url: ATO_SIMPLER_DEPRECIATION, authority: 'ATO' },
  ],
  vocabulary: {
    asset: 'Depreciating asset',
    decline: 'Decline in value',
    writtenDown: 'Adjustable value',
    rate: 'Rate',
    rateBasis: 'Effective life',
  },
};

export const AU_DEPRECIATION_RULES: DepreciationRules = {
  countryCode: 'AU',
  regime: 'effective_life',
  methods: ['prime_cost', 'diminishing_value', 'immediate_writeoff', 'pool'],
  // The ATO's own worked examples lead with diminishing value, and it is what a
  // business claiming under the general rules usually chooses.
  defaultMethod: 'diminishing_value',

  /**
   * 365 in every income year, leap or not — see AU_DAY_FRACTION_DENOMINATOR.
   * The argument is accepted and deliberately ignored.
   */
  dayFractionDenominator(): number {
    return AU_DAY_FRACTION_DENOMINATOR;
  },

  /**
   * The DENOMINATOR IS THIS PLUGIN'S, NOT THE CALLER'S. `daysInYear` is
   * overridden with AU_DAY_FRACTION_DENOMINATOR whatever was passed, so a host
   * that counts the real length of a leap income year and passes 366 gets the
   * same answer as one that passes 365 — instead of silently underclaiming by
   * 366/365. Documenting the rule and then forwarding the caller's number is not
   * enforcement; this is.
   *
   * `daysHeld` is untouched and may still be 366: the ATO says so explicitly, so
   * a full leap-year hold claims 366/365 of a year's decline.
   *
   * BOTH INPUT FORMS ARE OVERRIDDEN. The engine reads the denominator from
   * `partYear.daysInYear` when the caller uses the days form of `partYear`, and
   * from the legacy `input.daysInYear` otherwise, so overriding only the legacy
   * field would leave the newer form free to pass 366 and underclaim — the two
   * forms would then disagree for the same jurisdiction. The `partYear`
   * PRECEDENCE is untouched: the days form still wins over the legacy fields,
   * it just wins with the ATO's denominator in it. A months-form `partYear`
   * carries no denominator and is forwarded as it stands.
   */
  declineInValue(input: DeclineInValueInput): DeclineInValueOutcome {
    return computeDeclineInValue(
      {
        ...input,
        daysInYear: AU_DAY_FRACTION_DENOMINATOR,
        partYear:
          input.partYear?.kind === 'days'
            ? { ...input.partYear, daysInYear: AU_DAY_FRACTION_DENOMINATOR }
            : input.partYear,
      },
      AU_SMALL_BUSINESS_POOL_RATES,
    );
  },

  effectiveLife(categoryKey: string): number | null {
    return EFFECTIVE_LIFE_BY_KEY.get(categoryKey) ?? null;
  },

  effectiveLifeCategories(): EffectiveLifeCategory[] {
    return [...AU_EFFECTIVE_LIFE_CATEGORIES];
  },

  instantAssetWriteOff(onDate: Date): InstantAssetWriteOffInfo {
    return auInstantAssetWriteOff(onDate);
  },

  balancingAdjustment(input: BalancingAdjustmentInput): BalancingAdjustmentOutcome {
    return computeBalancingAdjustment(input);
  },

  explainer(): DepreciationExplainer {
    return {
      ...AU_EXPLAINER,
      howItWorks: [...AU_EXPLAINER.howItWorks],
      readMore: AU_EXPLAINER.readMore.map((r) => ({ ...r })),
    };
  },

  /** The instant asset write-off, with its effective-dated `verified` state. */
  firstYearConcessions(onDate: Date | string): FirstYearConcession[] {
    const w = auInstantAssetWriteOff(onDate);
    return [
      {
        key: 'instant_asset_write_off',
        label: 'Instant asset write-off',
        kind: 'threshold_write_off',
        limit: w.limit,
        percent: null,
        verified: w.verified,
        note: w.note,
      },
    ];
  },

  /** Nothing beyond the common fields. */
  extraAssetFields(): AssetFieldSpec[] {
    return [];
  },
};

/** The pages these rules were read from, for a "where does this come from" link. */
export const AU_DEPRECIATION_AUTHORITY_URLS = {
  generalRules: ATO_GENERAL_DEPRECIATION,
  simplerRules: ATO_SIMPLER_DEPRECIATION,
  effectiveLifeDetermination: 'https://www.legislation.gov.au/F2025L01097/asmade',
} as const;

export default AU_DEPRECIATION_RULES;
