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
  type DepreciationRules,
  type EffectiveLifeCategory,
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
    source: `${TABLE_B}: "Telephony: Telephone systems"`,
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
    source: `${TABLE_B}: "Office furniture, freestanding: Cabinets ... Metal"`,
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
 * Newest-first, resolved by calendar day the same way the rate ledger resolves a
 * rate: the row with the greatest `effectiveFrom` on or before the date. Rows
 * are contiguous by construction (each runs until the next one starts), so no
 * date inside the covered range falls into a hole. Each row states what the ATO
 * states for its window — including the windows where the answer is "not
 * published", which are rows in their own right rather than gaps.
 */
export const AU_INSTANT_ASSET_WRITE_OFF_ROWS: AuWriteOffRow[] = [
  {
    effectiveFrom: '2026-07-01',
    limit: null,
    verified: false,
    note:
      'The ATO has not published an instant asset write-off limit for 2026-27 or later. ' +
      'Confirm the current limit with the ATO or your registered tax agent before you write ' +
      'an asset off — the 2025-26 limit does not carry forward on its own.',
  },
  {
    effectiveFrom: '2023-07-01',
    limit: 20000,
    verified: true,
    note:
      '$20,000 per asset for the 2023-24, 2024-25 and 2025-26 income years, for small ' +
      'businesses with an aggregated turnover under $10 million using the simplified ' +
      'depreciation rules. The asset must be first used or installed ready for use for a ' +
      'taxable purpose within the income year. The limit applies per asset, so more than one ' +
      'asset can be written off.',
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

export function auInstantAssetWriteOff(onDate: Date | string): InstantAssetWriteOffInfo {
  const ymd = toYmd(onDate);
  // Rows are newest-first, so the first one that has started is the one in force.
  // A date before the earliest row falls back to that earliest row, which is
  // itself an unverified "not recorded here" — never to a number.
  const row =
    AU_INSTANT_ASSET_WRITE_OFF_ROWS.find((r) => r.effectiveFrom <= ymd) ??
    AU_INSTANT_ASSET_WRITE_OFF_ROWS[AU_INSTANT_ASSET_WRITE_OFF_ROWS.length - 1];
  return { limit: row.limit, verified: row.verified, note: row.note };
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

export const AU_DEPRECIATION_RULES: DepreciationRules = {
  countryCode: 'AU',
  methods: ['prime_cost', 'diminishing_value', 'immediate_writeoff', 'pool'],
  // The ATO's own worked examples lead with diminishing value, and it is what a
  // business claiming under the general rules usually chooses.
  defaultMethod: 'diminishing_value',

  declineInValue(input: DeclineInValueInput): DeclineInValueOutcome {
    return computeDeclineInValue(input, AU_SMALL_BUSINESS_POOL_RATES);
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
};

/** The pages these rules were read from, for a "where does this come from" link. */
export const AU_DEPRECIATION_AUTHORITY_URLS = {
  generalRules: ATO_GENERAL_DEPRECIATION,
  simplerRules: ATO_SIMPLER_DEPRECIATION,
  effectiveLifeDetermination: 'https://www.legislation.gov.au/F2025L01097/asmade',
} as const;

export default AU_DEPRECIATION_RULES;
