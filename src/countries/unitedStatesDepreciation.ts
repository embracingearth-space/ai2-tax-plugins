/**
 * United States — MACRS depreciation — ai2fin.com
 * Authority: Internal Revenue Service (IRS)
 *
 * The United States is a TABLE regime. The IRS does not hand out a formula
 * and leave the arithmetic to the taxpayer: Publication 946 assigns each
 * asset a property class (Table B-1), a convention (half-year unless the
 * >40%-in-Q4 test forces mid-quarter), and then PRINTS the percentage of the
 * basis deductible each year (Appendix A). The percentages below are those
 * tables verbatim; nothing here re-derives them from the 200% declining
 * balance method they encode.
 *
 * Everything below was read from the authority's own documents on 2026-08-24:
 *   Publication 946 (2025), "How To Depreciate Property" — Table B-1 (p. 99),
 *   Tables A-1 and A-2 (p. 71), Tables A-3 to A-5 (pp. 72-73), the
 *   convention rules (ch. 4), the §179 dollar limits ("What's New" for 2025
 *   and 2026), and the bonus phase-down / reinstatement ("What's New");
 *   Rev. Proc. 2025-16 and Rev. Proc. 2026-15 (the §280F passenger
 *   automobile caps for 2025 and 2026); Notice 2015-82 and the tangible
 *   property regulations page (the de minimis safe harbor).
 *
 * MOST SMALL BUSINESSES NEVER REACH THE TABLES. The §179 election
 * ($2,560,000 for tax years beginning in 2026), the 100% special
 * depreciation allowance for property acquired and placed in service after
 * 19 January 2025 (P.L. 119-21), and the $2,500 de minimis safe harbor
 * ($5,000 with an applicable financial statement) expense the cost in year
 * one. The schedule exists for what those leave behind — and for passenger
 * automobiles, whose deduction the §280F caps ration out no matter how
 * generous the elections were.
 *
 * BONUS DEPRECIATION HAS A CLIFF, NOT A PHASE. Property acquired BEFORE
 * 20 January 2025 keeps the old phase-down: 40% where placed in service in
 * 2025 (60% for long-production-period property and certain aircraft, not
 * modelled). Property acquired and placed in service AFTER 19 January 2025
 * is back at 100%, with an election to take 40% instead in the first tax
 * year ending after that date. The acquisition date decides, so it is an
 * input, never assumed.
 *
 * Reference: https://www.irs.gov/publications/p946
 * Reference: https://www.irs.gov/taxtopics/tc704
 * Reference: https://www.irs.gov/forms-pubs/about-form-4562
 * Reference: https://www.irs.gov/businesses/small-businesses-self-employed/tangible-property-final-regulations
 */

import { toYmd } from '../data/rateLedger';
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
  type MacrsRules,
  type UsAssetInput,
  type UsAutoCapOutcome,
  type UsBonusOutcome,
  type UsConventionInput,
  type UsConventionOutcome,
  type UsDeMinimisOutcome,
  type UsPropertyClassAssignment,
  type UsSection179Outcome,
  type UsTableConvention,
  type UsTablePercentOutcome,
} from '../depreciation';

const IRS_P946 = 'https://www.irs.gov/publications/p946';
const IRS_TOPIC_704 = 'https://www.irs.gov/taxtopics/tc704';
const IRS_FORM_4562 = 'https://www.irs.gov/forms-pubs/about-form-4562';
const IRS_TANGIBLE_PROPERTY =
  'https://www.irs.gov/businesses/small-businesses-self-employed/tangible-property-final-regulations';

/** The irs.gov pages these rules were read from. */
export const US_DEPRECIATION_AUTHORITY_URLS = {
  publication946: IRS_P946,
  topic704: IRS_TOPIC_704,
  form4562: IRS_FORM_4562,
  tangiblePropertyRegulations: IRS_TANGIBLE_PROPERTY,
} as const;

// ─── Dates ──────────────────────────────────────────────────────────────────

/** Property acquired BEFORE this date keeps the old bonus phase-down (40% in 2025). */
export const US_BONUS_100_ACQUIRED_AFTER = '2025-01-19';

function yearOf(ymd: string): number {
  return Number(ymd.slice(0, 4));
}

// ─── Property classes — Publication 946 Table B-1 ───────────────────────────

export interface UsPropertyClassRow {
  /** The Table B-1 asset class. */
  assetClass: string;
  label: string;
  /** GDS (MACRS) recovery period in years — the column the percentage tables key on. */
  recoveryYears: number;
  /**
   * The ALTERNATIVE depreciation system recovery period in years, from the
   * same Rev. Proc. 87-56 row.
   *
   * It is not a copy of the GDS period and must not be defaulted to one. An
   * automobile and a light truck are five years under both, but a trailer and
   * a heavy truck are five under GDS and SIX under ADS. Anything that lands on
   * ADS — listed property used 50% or less for business, under section
   * 280F(b)(1), and an election under section 168(g) — writes off over THIS
   * period, and using the shorter GDS figure there claims too much every year.
   */
  adsRecoveryYears: number;
  verified: true;
  note?: string;
}

/**
 * Publication 946 Table B-1, the asset classes a small business meets, GDS
 * recovery periods verbatim. The full table runs to specialised industry
 * classes not shipped here; an asset class not on this list resolves
 * unverified rather than guessed.
 */
export const US_PROPERTY_CLASSES: readonly UsPropertyClassRow[] = [
  { assetClass: '00.11', label: 'Office furniture, fixtures and equipment (7-year)', recoveryYears: 7, adsRecoveryYears: 10, verified: true },
  { assetClass: '00.12', label: 'Information systems — computers and peripheral equipment (5-year)', recoveryYears: 5, adsRecoveryYears: 5, verified: true },
  { assetClass: '00.13', label: 'Data handling equipment, except computers (5-year)', recoveryYears: 5, adsRecoveryYears: 6, verified: true },
  { assetClass: '00.22', label: 'Automobiles, taxis (5-year)', recoveryYears: 5, adsRecoveryYears: 5, verified: true },
  { assetClass: '00.241', label: 'Light general purpose trucks — under 13,000 pounds (5-year)', recoveryYears: 5, adsRecoveryYears: 5, verified: true },
  { assetClass: '00.242', label: 'Heavy general purpose trucks — 13,000 pounds or more (5-year)', recoveryYears: 5, adsRecoveryYears: 6, verified: true },
  { assetClass: '00.27', label: 'Trailers and trailer-mounted containers (5-year)', recoveryYears: 5, adsRecoveryYears: 6, verified: true },
  { assetClass: '00.3', label: 'Land improvements (15-year)', recoveryYears: 15, adsRecoveryYears: 20, verified: true },
];

const CLASS_BY_KEY: ReadonlyMap<string, UsPropertyClassRow> = new Map(
  US_PROPERTY_CLASSES.map((c) => [c.assetClass, c]),
);

/** The row for a Table B-1 asset class, or null where the class is not on the list shipped here. */
export function usPropertyClassRow(assetClass: string): UsPropertyClassRow | null {
  return CLASS_BY_KEY.get(String(assetClass).trim()) ?? null;
}

const KIND_TO_CLASS: Readonly<Record<string, string>> = {
  office_furniture: '00.11',
  computer: '00.12',
  data_handling: '00.13',
  automobile: '00.22',
  light_truck: '00.241',
  heavy_truck: '00.242',
  trailer: '00.27',
  land_improvement: '00.3',
};

function assignment(row: UsPropertyClassRow, verified = true, note?: string): UsPropertyClassAssignment {
  return {
    recoveryYears: row.recoveryYears,
    adsRecoveryYears: row.adsRecoveryYears,
    assetClass: row.assetClass,
    label: row.label,
    source: `${IRS_P946} — Publication 946 (2025), Table B-1`,
    verified,
    note: note ?? row.note,
  };
}

/**
 * Which property class an asset belongs to. A class already on the register
 * wins; otherwise the asset's `kind` routes it by Table B-1. Property with no
 * class of its own is 7-year property by Pub 946's own words — chapter 4:
 * "Any property that does not have a class life and has not been designated
 * by law as being in any other class" — but nothing here can tell an
 * unclassified asset from a misdescribed one, so that answer is unverified.
 */
export function usPropertyClass(asset: UsAssetInput): UsPropertyClassAssignment {
  if (asset.assetClass != null && String(asset.assetClass).trim() !== '') {
    const row = usPropertyClassRow(asset.assetClass);
    if (row) return assignment(row);
    return {
      recoveryYears: null,
      adsRecoveryYears: null,
      assetClass: String(asset.assetClass).trim(),
      label: `Asset class ${String(asset.assetClass).trim()}`,
      source: `${IRS_P946} — Publication 946 (2025), Table B-1`,
      verified: false,
      note:
        `Asset class ${String(asset.assetClass).trim()} is not one of the classes recorded here, so its ` +
        'recovery period is not known to these rules. Find it in Table B-1 or B-2 of Publication 946.',
    };
  }

  const kind = asset.kind ?? 'other';
  const cls = KIND_TO_CLASS[kind];
  if (cls) return assignment(CLASS_BY_KEY.get(cls) as UsPropertyClassRow);

  return {
    recoveryYears: 7,
    // Section 168(g)(2)(C)(iii): property with no class life is twelve years
    // under the alternative depreciation system, not seven.
    adsRecoveryYears: 12,
    assetClass: null,
    label: '7-year property — no class life',
    source: `${IRS_P946} — Publication 946 (2025), chapter 4, "Which Property Class Applies"`,
    verified: false,
    note:
      'Personal property with no class life is 7-year property under GDS, but nothing here says what ' +
      'this asset is. Record its kind or its Table B-1 asset class before relying on the period.',
  };
}

// ─── Percentage tables — Publication 946 Appendix A ─────────────────────────

type TableColumns = Readonly<Record<number, readonly number[]>>;

/**
 * Table A-1 — half-year convention, 200% declining balance switching to
 * straight line, verbatim from Publication 946 (2025) p. 71. Row = recovery
 * year, value = percentage of the depreciable basis.
 */
export const US_MACRS_TABLE_A1: TableColumns = {
  3: [33.33, 44.45, 14.81, 7.41],
  5: [20.0, 32.0, 19.2, 11.52, 11.52, 5.76],
  7: [14.29, 24.49, 17.49, 12.49, 8.93, 8.92, 8.93, 4.46],
  10: [10.0, 18.0, 14.4, 11.52, 9.22, 7.37, 6.55, 6.55, 6.56, 6.55, 3.28],
  15: [5.0, 9.5, 8.55, 7.7, 6.93, 6.23, 5.9, 5.9, 5.91, 5.9, 5.91, 5.9, 5.91, 5.9, 5.91, 2.95],
};

/**
 * Tables A-2 to A-5 — mid-quarter convention by the quarter the property was
 * placed in service, verbatim from Publication 946 (2025) pp. 71-73.
 */
export const US_MACRS_MID_QUARTER_TABLES: Readonly<Record<1 | 2 | 3 | 4, TableColumns>> = {
  // Table A-2 — placed in service in the first quarter.
  1: {
    3: [58.33, 27.78, 12.35, 1.54],
    5: [35.0, 26.0, 15.6, 11.01, 11.01, 1.38],
    7: [25.0, 21.43, 15.31, 10.93, 8.75, 8.74, 8.75, 1.09],
    10: [17.5, 16.5, 13.2, 10.56, 8.45, 6.76, 6.55, 6.55, 6.56, 6.55, 0.82],
    15: [8.75, 9.13, 8.21, 7.39, 6.65, 5.99, 5.9, 5.91, 5.9, 5.91, 5.9, 5.91, 5.9, 5.91, 5.9, 0.74],
  },
  // Table A-3 — placed in service in the second quarter.
  2: {
    3: [41.67, 38.89, 14.14, 5.3],
    5: [25.0, 30.0, 18.0, 11.37, 11.37, 4.26],
    7: [17.85, 23.47, 16.76, 11.97, 8.87, 8.87, 8.87, 3.34],
    10: [12.5, 17.5, 14.0, 11.2, 8.96, 7.17, 6.55, 6.55, 6.56, 6.55, 2.46],
    15: [6.25, 9.38, 8.44, 7.59, 6.83, 6.15, 5.91, 5.9, 5.91, 5.9, 5.91, 5.9, 5.91, 5.9, 5.91, 2.21],
  },
  // Table A-4 — placed in service in the third quarter.
  3: {
    3: [25.0, 50.0, 16.67, 8.33],
    5: [15.0, 34.0, 20.4, 12.24, 11.3, 7.06],
    7: [10.71, 25.51, 18.22, 13.02, 9.3, 8.85, 8.86, 5.53],
    10: [7.5, 18.5, 14.8, 11.84, 9.47, 7.58, 6.55, 6.55, 6.56, 6.55, 4.1],
    15: [3.75, 9.63, 8.66, 7.8, 7.02, 6.31, 5.9, 5.9, 5.91, 5.9, 5.91, 5.9, 5.91, 5.9, 5.91, 3.69],
  },
  // Table A-5 — placed in service in the fourth quarter.
  4: {
    3: [8.33, 61.11, 20.37, 10.19],
    5: [5.0, 38.0, 22.8, 13.68, 10.94, 9.58],
    7: [3.57, 27.55, 19.68, 14.06, 10.04, 8.73, 8.73, 7.64],
    10: [2.5, 19.5, 15.6, 12.48, 9.98, 7.99, 6.55, 6.55, 6.56, 6.55, 5.74],
    15: [1.25, 9.88, 8.89, 8.0, 7.2, 6.48, 5.9, 5.9, 5.9, 5.91, 5.9, 5.91, 5.9, 5.91, 5.9, 5.17],
  },
};

const TABLE_NAMES: Readonly<Record<1 | 2 | 3 | 4, string>> = {
  1: 'Table A-2',
  2: 'Table A-3',
  3: 'Table A-4',
  4: 'Table A-5',
};

/**
 * The Appendix A figure for a recovery period, year (1-based) and convention.
 * A year past the end of the table is 0 — the property is fully depreciated —
 * and a recovery period the tables here do not cover (20-year, real property)
 * is null and unverified rather than interpolated.
 */
export function usTablePercent(
  recoveryYears: number,
  yearIndex: number,
  convention: UsTableConvention,
): UsTablePercentOutcome {
  const year = Number(yearIndex);
  if (!Number.isInteger(year) || year < 1) {
    throw new RangeError(`yearIndex must be a whole number from 1 (received ${String(yearIndex)})`);
  }
  const isHalfYear = convention === 'half_year';
  const quarter = isHalfYear ? null : convention.midQuarter;
  if (quarter != null && ![1, 2, 3, 4].includes(quarter)) {
    throw new RangeError(`midQuarter must be 1-4 (received ${String(quarter)})`);
  }
  const table = isHalfYear ? 'Table A-1' : TABLE_NAMES[quarter as 1 | 2 | 3 | 4];
  const columns = isHalfYear ? US_MACRS_TABLE_A1 : US_MACRS_MID_QUARTER_TABLES[quarter as 1 | 2 | 3 | 4];
  const column = columns[Number(recoveryYears)];
  if (!column) {
    return {
      percent: null,
      table,
      verified: false,
      note:
        `The ${String(recoveryYears)}-year column is not shipped here (3, 5, 7, 10 and 15-year property ` +
        'only). Read it from Appendix A of Publication 946, or use the mid-month tables for real property.',
    };
  }
  if (year > column.length) {
    return {
      percent: 0,
      table,
      verified: true,
      note: `Year ${year} is past the end of the ${recoveryYears}-year recovery period: the property is fully depreciated.`,
    };
  }
  return { percent: column[year - 1], table: `${table}, Publication 946 (2025)`, verified: true };
}

// ─── Convention — the >40%-in-Q4 test ───────────────────────────────────────

/**
 * Pub 946 chapter 4: use the mid-quarter convention where the total
 * depreciable bases of MACRS property placed in service during the last
 * three months of the tax year are MORE than 40% of the year's total
 * (excluding real property and property placed in service and disposed of in
 * the same year; bases reflect the §179 reduction but not bonus). Otherwise
 * the half-year convention.
 */
export function usConvention(input: UsConventionInput): UsConventionOutcome {
  const bases = input.basesByQuarter;
  if (!Array.isArray(bases) || bases.length !== 4) {
    throw new RangeError('basesByQuarter must be four totals, Q1 through Q4');
  }
  const clean = bases.map((b) => Math.max(0, Number(b) || 0));
  const total = clean.reduce((t, b) => t + b, 0);
  const q4Share = total > 0 ? clean[3] / total : 0;
  const midQuarter = q4Share > 0.4;
  return {
    convention: midQuarter ? 'mid_quarter' : 'half_year',
    q4Share,
    verified: true,
    note: midQuarter
      ? `${(q4Share * 100).toFixed(1)}% of the year's depreciable bases were placed in service in the ` +
        'fourth quarter — more than 40%, so the mid-quarter convention applies to everything placed in ' +
        'service this year, each asset by its own quarter.'
      : `${(q4Share * 100).toFixed(1)}% of the year's depreciable bases were placed in service in the ` +
        'fourth quarter — not more than 40%, so the half-year convention applies.',
  };
}

// ─── §179 — dollar limits by tax year ───────────────────────────────────────

interface UsSection179Row {
  taxYear: number;
  limit: number;
  phaseOutThreshold: number;
  suvCap: number;
}

/** Publication 946 "What's New" for 2025 and 2026, verbatim. */
export const US_SECTION_179_ROWS: readonly UsSection179Row[] = [
  { taxYear: 2025, limit: 2_500_000, phaseOutThreshold: 4_000_000, suvCap: 31_300 },
  { taxYear: 2026, limit: 2_560_000, phaseOutThreshold: 4_090_000, suvCap: 32_000 },
];

export function usSection179(taxYear: number): UsSection179Outcome {
  const y = Number(taxYear);
  if (!Number.isInteger(y)) throw new RangeError(`taxYear must be a calendar year (received ${String(taxYear)})`);
  const row = US_SECTION_179_ROWS.find((r) => r.taxYear === y);
  if (!row) {
    return {
      limit: null,
      phaseOutThreshold: null,
      suvCap: null,
      verified: false,
      note:
        `The section 179 dollar limit for a tax year beginning in ${y} is not recorded here — Publication ` +
        '946 (2025) publishes 2025 and 2026 only. Check the current edition or the inflation adjustment ' +
        'revenue procedure before relying on a figure.',
    };
  }
  return {
    limit: row.limit,
    phaseOutThreshold: row.phaseOutThreshold,
    suvCap: row.suvCap,
    verified: true,
    note:
      `For a tax year beginning in ${y} the section 179 deduction is capped at ` +
      `$${row.limit.toLocaleString('en-US')}, reduced dollar for dollar where section 179 property placed ` +
      `in service exceeds $${row.phaseOutThreshold.toLocaleString('en-US')}; sport utility vehicles are ` +
      `capped at $${row.suvCap.toLocaleString('en-US')}. The limits apply across ALL the year's section ` +
      '179 property together, and the deduction cannot exceed business income for the year.',
  };
}

// ─── Bonus (special depreciation allowance) ─────────────────────────────────

/**
 * The special depreciation allowance, keyed on the ACQUISITION date (P.L.
 * 119-21): 100% for property acquired and placed in service after 19 January
 * 2025; 40% for property acquired before 20 January 2025 and placed in
 * service in 2025 (60% for long-production-period property and certain
 * aircraft, not modelled). Other combinations are not in Publication 946
 * (2025) and resolve unverified.
 */
export function usBonusPercent(acquired: Date | string, placedInService: Date | string): UsBonusOutcome {
  const acquiredYmd = toYmd(acquired);
  const placedYmd = toYmd(placedInService);
  if (placedYmd < acquiredYmd) {
    throw new RangeError(
      `placedInService (${placedYmd}) cannot be before the acquisition date (${acquiredYmd})`,
    );
  }
  if (acquiredYmd > US_BONUS_100_ACQUIRED_AFTER) {
    return {
      percent: 100,
      verified: true,
      note:
        'Acquired and placed in service after 19 January 2025: P.L. 119-21 reinstated the 100% special ' +
        'depreciation allowance. An election to take 40% instead (60% for long-production-period property ' +
        'and certain aircraft) is available for the first tax year ending after 19 January 2025; the ' +
        'election is yours to make and is not applied here.',
    };
  }
  if (yearOf(placedYmd) === 2025) {
    return {
      percent: 40,
      verified: true,
      note:
        'Acquired before 20 January 2025 and placed in service in 2025: the special depreciation ' +
        'allowance is limited to 40% under the phase-down (60% for long-production-period property and ' +
        'certain aircraft, not modelled here).',
    };
  }
  return {
    percent: null,
    verified: false,
    note:
      `Acquired before 20 January 2025 and placed in service in ${yearOf(placedYmd)}: Publication 946 ` +
      '(2025) gives the phase-down figure for property placed in service in 2025 only. Check the current ' +
      'edition for this combination before relying on a percentage.',
  };
}

// ─── §280F passenger automobile caps ────────────────────────────────────────

interface UsAutoCapRow {
  year: number;
  withBonus: [number, number, number, number];
  withoutBonus: [number, number, number, number];
}

/**
 * The §280F depreciation caps for passenger automobiles, [year 1, year 2,
 * year 3, each succeeding year]: Rev. Proc. 2025-16 (placed in service in
 * 2025) and Rev. Proc. 2026-15 (2026), verbatim.
 */
export const US_AUTO_CAP_ROWS: readonly UsAutoCapRow[] = [
  { year: 2025, withBonus: [20_200, 19_600, 11_800, 7_060], withoutBonus: [12_200, 19_600, 11_800, 7_060] },
  { year: 2026, withBonus: [20_300, 19_800, 11_900, 7_160], withoutBonus: [12_300, 19_800, 11_900, 7_160] },
];

export function usAutoCap(placedInServiceYear: number, withBonus: boolean): UsAutoCapOutcome {
  const y = Number(placedInServiceYear);
  if (!Number.isInteger(y)) {
    throw new RangeError(`placedInServiceYear must be a calendar year (received ${String(placedInServiceYear)})`);
  }
  const row = US_AUTO_CAP_ROWS.find((r) => r.year === y);
  if (!row) {
    return {
      caps: null,
      verified: false,
      note:
        `The passenger automobile caps for a vehicle placed in service in ${y} are not recorded here — ` +
        'the revenue procedures read cover 2025 and 2026 only. Check the current year\'s revenue ' +
        'procedure before relying on a figure.',
    };
  }
  const caps = withBonus ? row.withBonus : row.withoutBonus;
  return {
    caps: [...caps] as [number, number, number, number],
    verified: true,
    note:
      `A passenger automobile placed in service in ${y} ${withBonus ? 'with' : 'without'} the special ` +
      `depreciation allowance can deduct at most $${caps[0].toLocaleString('en-US')} in year one, ` +
      `$${caps[1].toLocaleString('en-US')} in year two, $${caps[2].toLocaleString('en-US')} in year ` +
      `three and $${caps[3].toLocaleString('en-US')} each year after, no matter what section 179, bonus ` +
      'and the tables would otherwise allow.',
  };
}

// ─── De minimis safe harbor ─────────────────────────────────────────────────

/**
 * The tangible property regulations' de minimis safe harbor (§1.263(a)-1(f),
 * Notice 2015-82): items up to $2,500 per item or invoice can be expensed
 * outright — $5,000 with an applicable financial statement — under an annual
 * election. This is why most small purchases never reach the asset register.
 */
export function usDeMinimis(hasAfs: boolean): UsDeMinimisOutcome {
  const limit = hasAfs ? 5_000 : 2_500;
  return {
    limit,
    verified: true,
    note: hasAfs
      ? 'With an applicable financial statement, the de minimis safe harbor covers items up to $5,000 per ' +
        'item or invoice. It is an annual election, made with a statement on the timely filed return.'
      : 'Without an applicable financial statement, the de minimis safe harbor covers items up to $2,500 ' +
        'per item or invoice ($500 before 1 January 2016). It is an annual election, made with a ' +
        'statement on the timely filed return.',
  };
}

// ─── Explainer ──────────────────────────────────────────────────────────────

const US_EXPLAINER: DepreciationExplainer = {
  whatItIs:
    'Most equipment is written off in the year you buy it — the section 179 deduction, 100% bonus ' +
    'depreciation and the $2,500 de minimis election usually cover the whole cost. The MACRS schedule ' +
    'is for what those leave behind, and for cars over the annual cap.',
  whenItApplies:
    'Property you own and use in your business for more than a year. The IRS assigns each asset a ' +
    'recovery period — 5 years for computers, cars and trucks, 7 for office furniture — and publishes ' +
    'the percentage of the cost deductible each year. Buy more than 40% of the year\'s assets in the ' +
    'last quarter and the mid-quarter convention trims the first-year claim. Passenger automobiles are ' +
    'capped each year ($20,300 in year one for 2026, with bonus) no matter how much the elections would ' +
    'otherwise allow.',
  howItWorks: [
    'Expense what you can first: items up to $2,500 under the de minimis election, then the section 179 ' +
      'deduction up to the annual limit, then bonus depreciation — 100% for property acquired and placed ' +
      'in service after 19 January 2025, 40% if it was acquired earlier.',
    'Whatever basis is left gets a recovery period from Publication 946 (Table B-1) and a convention — ' +
      'half-year normally, mid-quarter if more than 40% of the year\'s purchases landed in the fourth quarter.',
    'Each year, deduct the percentage the IRS table prints for that year of the recovery period times ' +
      'the remaining basis — no formula to run, the table IS the answer.',
    'For a car, compare the year\'s total against the section 280F cap and claim the smaller; anything ' +
      'the cap holds back waits for later years.',
  ],
  readMore: [
    { label: 'Publication 946 — How To Depreciate Property', url: IRS_P946, authority: 'IRS' },
    { label: 'Topic No. 704 — Depreciation', url: IRS_TOPIC_704, authority: 'IRS' },
    { label: 'About Form 4562 — Depreciation and Amortization', url: IRS_FORM_4562, authority: 'IRS' },
    { label: 'Tangible property regulations — de minimis safe harbor', url: IRS_TANGIBLE_PROPERTY, authority: 'IRS' },
  ],
  vocabulary: {
    asset: 'Depreciable property',
    decline: 'Depreciation deduction',
    writtenDown: 'Adjusted basis',
    rate: 'Table percentage',
    rateBasis: 'Recovery period',
  },
};

const US_EXTRA_ASSET_FIELDS: AssetFieldSpec[] = [
  {
    key: 'assetClass',
    label: 'Asset class (Table B-1)',
    type: 'enum',
    required: false,
    options: US_PROPERTY_CLASSES.map((c) => ({ value: c.assetClass, label: c.label })),
    help:
      'The Publication 946 Table B-1 class this property belongs to. Leave it blank and Fin suggests ' +
      'one from what the asset is; set it where you know better.',
  },
  {
    key: 'placedInServiceDate',
    label: 'Placed in service',
    type: 'text',
    required: false,
    help:
      'The date the property was first ready and available for use, if later than the purchase date. ' +
      'The convention, the bonus percentage and the automobile caps all key on this date.',
  },
  {
    key: 'isPassengerAutomobile',
    label: 'Passenger automobile',
    type: 'boolean',
    required: false,
    help:
      'A car, or a truck or van rated 6,000 pounds gross vehicle weight or less. Subject to the annual ' +
      'section 280F caps, which ration the deduction no matter what the elections allow.',
  },
  {
    key: 'hasAfs',
    label: 'Applicable financial statement',
    type: 'boolean',
    required: false,
    help:
      'The business has audited financial statements (or another applicable financial statement). ' +
      'Raises the de minimis safe harbor from $2,500 to $5,000 per item or invoice.',
  },
];

// ─── Rules object ───────────────────────────────────────────────────────────

export const US_DEPRECIATION_RULES: MacrsRules = {
  countryCode: 'US',
  regime: 'macrs',
  // The IRS prints the yearly percentages: there is no per-asset prime cost
  // or diminishing value formula to run, and for most assets the whole cost
  // goes in year one anyway.
  methods: ['immediate_writeoff'],
  defaultMethod: 'immediate_writeoff',

  /** Part years are handled by the conventions, not day counts; this is informational only. */
  dayFractionDenominator(): number {
    return 365;
  },

  /**
   * Immediate write-off only — §179, 100% bonus or the de minimis election.
   * The yearly schedule is table-driven and needs the recovery year, which
   * this interface does not carry: use `computeMacrsYear` with a figure from
   * `tablePercent`.
   */
  declineInValue(input: DeclineInValueInput): DeclineInValueOutcome {
    if (input.method === 'immediate_writeoff') {
      return computeDeclineInValue({ ...input, partYear: { kind: 'months', monthsUsed: 12 } });
    }
    throw new RangeError(
      `The United States depreciates by the IRS percentage tables, not a formula: method ` +
        `"${String(input.method)}" is not available. Use computeMacrsYear() with tablePercent(), or ` +
        '`immediate_writeoff` for §179 / bonus / de minimis property.',
    );
  },

  /** The GDS recovery period for a Table B-1 asset class key ('00.12' → 5). */
  effectiveLife(categoryKey: string): number | null {
    return usPropertyClassRow(categoryKey)?.recoveryYears ?? null;
  },

  effectiveLifeCategories(): EffectiveLifeCategory[] {
    return US_PROPERTY_CLASSES.map((c) => ({
      key: c.assetClass,
      label: c.label,
      years: c.recoveryYears,
      source: `${IRS_P946} — Publication 946 (2025), Table B-1`,
    }));
  },

  /** The closest US analogue is the §179 dollar limit for the year of the date. */
  instantAssetWriteOff(onDate: Date | string): InstantAssetWriteOffInfo {
    const s179 = usSection179(yearOf(toYmd(onDate)));
    return { limit: s179.limit, verified: s179.verified, note: s179.note };
  },

  propertyClass(asset: UsAssetInput): UsPropertyClassAssignment {
    return usPropertyClass(asset);
  },

  tablePercent(recoveryYears: number, yearIndex: number, convention: UsTableConvention): UsTablePercentOutcome {
    return usTablePercent(recoveryYears, yearIndex, convention);
  },

  convention(input: UsConventionInput): UsConventionOutcome {
    return usConvention(input);
  },

  section179(taxYear: number): UsSection179Outcome {
    return usSection179(taxYear);
  },

  bonusPercent(acquired: Date | string, placedInService: Date | string): UsBonusOutcome {
    return usBonusPercent(acquired, placedInService);
  },

  autoCap(placedInServiceYear: number, withBonus: boolean): UsAutoCapOutcome {
    return usAutoCap(placedInServiceYear, withBonus);
  },

  deMinimis(hasAfs: boolean): UsDeMinimisOutcome {
    return usDeMinimis(hasAfs);
  },

  /** Proceeds less adjusted basis, weighted by business use. Gains up to depreciation taken are recaptured as ordinary income. */
  balancingAdjustment(input: BalancingAdjustmentInput): BalancingAdjustmentOutcome {
    return computeBalancingAdjustment(input);
  },

  explainer(): DepreciationExplainer {
    return {
      ...US_EXPLAINER,
      howItWorks: [...US_EXPLAINER.howItWorks],
      readMore: US_EXPLAINER.readMore.map((r) => ({ ...r })),
      vocabulary: { ...US_EXPLAINER.vocabulary },
    };
  },

  firstYearConcessions(onDate: Date | string): FirstYearConcession[] {
    const ymd = toYmd(onDate);
    const year = yearOf(ymd);
    const s179 = usSection179(year);
    const bonus = usBonusPercent(ymd, ymd);
    const deMin = usDeMinimis(false);
    return [
      {
        key: 'section_179',
        label: 'Section 179 deduction',
        kind: 'threshold_write_off',
        limit: s179.limit,
        percent: null,
        verified: s179.verified,
        note: s179.note,
      },
      {
        key: 'bonus_depreciation',
        label: 'Special depreciation allowance (bonus)',
        kind: 'upfront_percent',
        limit: null,
        percent: bonus.percent,
        verified: bonus.verified,
        note: bonus.note,
      },
      {
        key: 'de_minimis_safe_harbor',
        label: 'De minimis safe harbor',
        kind: 'threshold_write_off',
        limit: deMin.limit,
        percent: null,
        verified: true,
        note:
          'Items up to $2,500 per item or invoice ($5,000 with an applicable financial statement) can be ' +
          'expensed outright under an annual election — they never reach the asset register at all.',
        requiresField: 'hasAfs',
      },
    ];
  },

  extraAssetFields(): AssetFieldSpec[] {
    return US_EXTRA_ASSET_FIELDS.map((f) => ({ ...f, options: f.options?.map((o) => ({ ...o })) }));
  },
};

export default US_DEPRECIATION_RULES;
