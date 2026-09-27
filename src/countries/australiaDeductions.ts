/**
 * Australia — per-unit deduction rates for individuals — ai2fin.com
 * Authority: Australian Taxation Office (ATO); Commissioner of Taxation
 *
 * Two rates a return quotes back to the person lodging it:
 *
 * 1. The WORKING FROM HOME FIXED RATE — cents per work hour, published by the
 *    ATO on "Fixed rate method" (last updated 8 June 2026).
 * 2. The CENTS PER KILOMETRE RATE for car expenses — set each year by the
 *    Commissioner's determination under s 28-25(4) ITAA 1997, capped at
 *    5,000 business kilometres per car per year.
 *
 * Both are EFFECTIVE-DATED BY INCOME YEAR, in the same shape as the instant
 * asset write-off rows in ./australiaDepreciation: each row runs from its
 * `effectiveFrom` (always a 1 July) until the next row starts, and a window
 * where the authority has published nothing is a row in its own right —
 * `rate: null, verified: false` — rather than a gap the resolver falls through.
 *
 * A YEAR WITH NO PUBLISHED RATE NEVER BORROWS LAST YEAR'S. The lookup says so,
 * names the last published rate and the year it was for, and leaves the number
 * out. A rate that silently carries forward is the failure this file exists to
 * prevent: nobody checks a figure that looks confident, and the ATO has changed
 * the fixed rate three times since 2020.
 *
 * Every verified row carries the page or instrument it was read from and the
 * day it was read, so the Rate Watch job can flag a citation that has gone
 * stale and a current year that still has no verified row.
 *
 * Reference: https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions/working-from-home-expenses/fixed-rate-method
 * Reference: https://softwaredevelopers.ato.gov.au/CentsperKilometreDeductionRateforCarExpenses
 * Reference: https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/income-and-deductions-for-business/deductions/deductions-for-motor-vehicle-expenses/cents-per-kilometre-method
 */

import { toYmd } from '../data/rateLedger';
import { type EffectiveDatedRow, resolveEffectiveDated, sortNewestFirst } from '../depreciation';

const ATO_WFH_FIXED_RATE =
  'https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions/working-from-home-expenses/fixed-rate-method';
const ATO_SD_CENTS_PER_KM_2026 = 'https://softwaredevelopers.ato.gov.au/CentsperKilometreDeductionRateforCarExpenses';
const ATO_BUSINESS_CENTS_PER_KM =
  'https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/income-and-deductions-for-business/deductions/deductions-for-motor-vehicle-expenses/cents-per-kilometre-method';

/** The day every citation below was last read against its source. */
const READ_ON = '2026-09-27';

// ─── Shapes ─────────────────────────────────────────────────────────────────

export interface AuDeductionRateRow extends EffectiveDatedRow {
  /**
   * AUD per unit (0.7 is 70 cents), or null where no rate is published for
   * the window. `effectiveFrom` is always 1 July: the row runs until the next
   * row's `effectiveFrom`.
   */
  rate: number | null;
  /** false means "this could not be confirmed" — never print an unverified number. */
  verified: boolean;
  /** The page or instrument the figure (or its absence) was read from. null only on the "not recorded" floor. */
  sourceUrl: string | null;
  /** YYYY-MM-DD the source was last read. null only on the "not recorded" floor. */
  readOn: string | null;
  /** The legal instrument that sets the rate, where one does. */
  instrument?: string;
  note: string;
}

export interface AuDeductionRate {
  /** AUD per unit for the income year, or null where none is published. */
  rate: number | null;
  verified: boolean;
  /** The income year the rate was resolved for, e.g. '2025-26'. */
  incomeYear: string;
  sourceUrl: string | null;
  readOn: string | null;
  note: string;
  /**
   * Only where `rate` is null: the most recent published rate and the last
   * income year it applied to — for display ("last published: 70 cents, for
   * 2025-26"), NEVER for use. Absent where nothing earlier is recorded.
   */
  lastPublished?: { rate: number; incomeYear: string };
}

// ─── Income years ───────────────────────────────────────────────────────────

export interface AuIncomeYear {
  /** '2025-26' — ASCII hyphen, the form every label in this package uses. */
  label: string;
  /** The calendar year the income year starts in (2025 for 2025-26). */
  startYear: number;
  /** YYYY-MM-DD of 1 July. */
  startYmd: string;
}

/** An income-year label ('2025-26' or '2025–26') or a calendar day (Date or 'YYYY-MM-DD'). */
export type AuIncomeYearInput = Date | string;

const pad2 = (n: number) => String(n).padStart(2, '0');

function incomeYearFromStart(startYear: number): AuIncomeYear {
  return { label: `${startYear}-${pad2((startYear + 1) % 100)}`, startYear, startYmd: `${startYear}-07-01` };
}

/**
 * The Australian income year (1 July to 30 June) for a label or a day. A Date
 * is read by its LOCAL calendar day (see `toYmd`), so `new Date(2026, 6, 1)`
 * is 2026-27 in every time zone. Throws on anything else rather than guessing:
 * a malformed year resolving to "now" would quote the wrong year's rate.
 */
export function auIncomeYear(input: AuIncomeYearInput): AuIncomeYear {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) throw new RangeError('auIncomeYear: invalid Date');
    return auIncomeYear(toYmd(input));
  }
  const s = String(input).trim();
  const label = /^(\d{4})[-–](\d{2})$/.exec(s);
  if (label) {
    const start = Number(label[1]);
    if (Number(label[2]) !== (start + 1) % 100) {
      throw new RangeError(`auIncomeYear: "${s}" is not an income year — the second part must follow the first`);
    }
    return incomeYearFromStart(start);
  }
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (day) {
    const y = Number(day[1]);
    const m = Number(day[2]);
    const d = Number(day[3]);
    if (m < 1 || m > 12 || d < 1 || d > 31) throw new RangeError(`auIncomeYear: "${s}" is not a calendar day`);
    return incomeYearFromStart(m >= 7 ? y : y - 1);
  }
  throw new RangeError(`auIncomeYear: expected an income year like "2025-26" or a day like "2025-07-01", got "${s}"`);
}

// ─── Working from home — fixed rate ─────────────────────────────────────────

/**
 * The revised fixed rate method (67 cents onwards) started on 1 July 2022 and
 * covers the expenses listed below; the 52 cent rate before it was a separate
 * method with its own list. Exported so text that describes the coverage can
 * tell the two apart.
 */
export const AU_WFH_REVISED_METHOD_FROM = '2022-07-01';

const WFH_COVERS =
  'It covers home and mobile internet and data, mobile and home phone usage, electricity and ' +
  'gas for heating, cooling and lighting, and stationery and computer consumables. Depreciation ' +
  'of equipment and furniture is claimed separately.';

/**
 * Read from the ATO's "Fixed rate method" page (last updated 8 June 2026) on
 * 27 September 2026: "2024–25 and 2025–26: use 70 cents per work hour;
 * 2022–23 and 2023–24: use 67 cents per work hour; 2020–21 and 2021–22: use
 * 52 cent per work hour." Nothing is published for 2026–27, so that row is
 * `rate: null` — and the lookup names 70 cents as the last published rate
 * without applying it.
 *
 * WHEN THE ATO PUBLISHES 2026-27: set `rate`, `verified: true`, `readOn`, and
 * rewrite the note; add a `rate: null` row for the year after if the ATO has
 * published only a single year.
 */
export const AU_WFH_FIXED_RATE_ROWS: AuDeductionRateRow[] = [
  {
    effectiveFrom: '2026-07-01',
    rate: null,
    verified: false,
    sourceUrl: ATO_WFH_FIXED_RATE,
    readOn: READ_ON,
    // Runs on for every later year until a rate is published, so the note
    // names the last published year rather than "2026-27".
    note:
      'The ATO has not published a working from home fixed rate for any income year after ' +
      '2025-26 (checked 27 September 2026).',
  },
  {
    effectiveFrom: '2024-07-01',
    rate: 0.7,
    verified: true,
    sourceUrl: ATO_WFH_FIXED_RATE,
    readOn: READ_ON,
    note: `70 cents per work hour for 2024-25 and 2025-26. ${WFH_COVERS}`,
  },
  {
    effectiveFrom: '2022-07-01',
    rate: 0.67,
    verified: true,
    sourceUrl: ATO_WFH_FIXED_RATE,
    readOn: READ_ON,
    note: `67 cents per work hour for 2022-23 and 2023-24. ${WFH_COVERS}`,
  },
  {
    effectiveFrom: '2020-07-01',
    rate: 0.52,
    verified: true,
    sourceUrl: ATO_WFH_FIXED_RATE,
    readOn: READ_ON,
    note:
      '52 cents per work hour for 2020-21 and 2021-22. This is the earlier fixed rate method, ' +
      'which the ATO describes on a page of its own; check what it covers there rather than ' +
      'assuming the expenses listed for the current method.',
  },
  {
    effectiveFrom: '1900-07-01',
    rate: null,
    verified: false,
    sourceUrl: null,
    readOn: null,
    note:
      'Working from home fixed rates for income years before 2020-21 are not recorded here. ' +
      'Confirm the rate for that year with the ATO or your registered tax agent.',
  },
];

// ─── Car expenses — cents per kilometre ─────────────────────────────────────

/** "a maximum of 5,000 business kilometres per car, per year" — ATO, last updated 27 May 2026. */
export const AU_CENTS_PER_KM_MAX_BUSINESS_KM = 5000;

const DETERMINATION = 'Income Tax Assessment (Cents per Kilometre Deduction Rate for Car Expenses) Determination';

/**
 * Each rate below is the Commissioner's determination as registered on the
 * Federal Register of Legislation, read through the register's API on
 * 27 September 2026. Each determination applies "to the income year
 * commencing on 1 July [year], and to any subsequent income years until
 * such time as it is repealed or varied" — EXCEPT the 2026 one, whose s 6
 * sets 91 cents "for the income year commencing on 1 July 2026" and nothing
 * after. The ATO's notice for it says why: 91 cents is "the base cents per
 * kilometre rate of 89 cents with a temporary one-off uplift of 2 cents", and
 * "for future income years, the calculated annual indexation rate will be
 * applied to the 2026–27 base cents per kilometre rate of 89 cents". So
 * 2027-28 is a row of its own with no rate, and 91 cents must not run on.
 */
export const AU_CENTS_PER_KM_ROWS: AuDeductionRateRow[] = [
  {
    effectiveFrom: '2027-07-01',
    rate: null,
    verified: false,
    sourceUrl: ATO_SD_CENTS_PER_KM_2026,
    readOn: READ_ON,
    note:
      'No cents per kilometre rate has been determined for any income year after 2026-27 ' +
      '(checked 27 September 2026). The 91 cents for 2026-27 was a one-off: the ATO will ' +
      'index the 89 cent base rate for later years.',
  },
  {
    effectiveFrom: '2026-07-01',
    rate: 0.91,
    verified: true,
    sourceUrl: ATO_SD_CENTS_PER_KM_2026,
    readOn: READ_ON,
    instrument: `${DETERMINATION} 2026 (F2026L00785), s 6`,
    note:
      '91 cents per kilometre for 2026-27: the base rate of 89 cents plus a temporary one-off ' +
      'uplift of 2 cents for that year only. Up to 5,000 business kilometres per car.',
  },
  {
    effectiveFrom: '2024-07-01',
    rate: 0.88,
    verified: true,
    sourceUrl: 'https://www.legislation.gov.au/F2024L00697/asmade',
    readOn: READ_ON,
    instrument: `${DETERMINATION} 2024 (F2024L00697), s 6`,
    note: '88 cents per kilometre for 2024-25 and 2025-26. Up to 5,000 business kilometres per car.',
  },
  {
    effectiveFrom: '2023-07-01',
    rate: 0.85,
    verified: true,
    sourceUrl: 'https://www.legislation.gov.au/F2023L00767/asmade',
    readOn: READ_ON,
    instrument: `${DETERMINATION} 2023 (F2023L00767), s 5`,
    note: '85 cents per kilometre for 2023-24. Up to 5,000 business kilometres per car.',
  },
  {
    effectiveFrom: '2022-07-01',
    rate: 0.78,
    verified: true,
    sourceUrl: 'https://www.legislation.gov.au/F2022L00813/asmade',
    readOn: READ_ON,
    instrument: 'Income Tax Assessment – Cents per Kilometre Deduction Rate for Car Expenses Determination 2022 (F2022L00813), s 4',
    note: '78 cents per kilometre for 2022-23. Up to 5,000 business kilometres per car.',
  },
  {
    effectiveFrom: '2020-07-01',
    rate: 0.72,
    verified: true,
    sourceUrl: 'https://www.legislation.gov.au/F2020L00676/asmade',
    readOn: READ_ON,
    instrument: 'Income Tax Assessment Act 1997 - Cents per Kilometre Deduction Rate for Car Expenses 2020 (F2020L00676), s 3',
    note: '72 cents per kilometre for 2020-21 and 2021-22. Up to 5,000 business kilometres per car.',
  },
  {
    effectiveFrom: '2018-07-01',
    rate: 0.68,
    verified: true,
    sourceUrl: 'https://www.legislation.gov.au/F2018L01023/asmade',
    readOn: READ_ON,
    instrument: 'Income Tax Assessment Act 1997 - Cents per Kilometre Deduction Rate for Car Expenses 2018 (F2018L01023)',
    note: '68 cents per kilometre for 2018-19 and 2019-20. Up to 5,000 business kilometres per car.',
  },
  {
    effectiveFrom: '1900-07-01',
    rate: null,
    verified: false,
    sourceUrl: null,
    readOn: null,
    note:
      'Cents per kilometre rates for income years before 2018-19 are not recorded here. ' +
      'Confirm the rate for that year with the ATO or your registered tax agent.',
  },
];

// ─── Lookups ────────────────────────────────────────────────────────────────

/** "70 cents per work hour", "91 cents per kilometre". */
export type AuRateUnit = 'per work hour' | 'per kilometre';

/** 0.7 → "70 cents per work hour". Integer cents, so 0.67 never prints as 67.00000000000001. */
export function formatAuCents(rate: number, unit: AuRateUnit): string {
  return `${Math.round(rate * 100)} cents ${unit}`;
}

/**
 * For an unpublished year: the last published rate and the last year it
 * covered, derived from the rows so it cannot drift from them. undefined
 * where no earlier verified row exists (the "not recorded" floor).
 */
function lastPublishedBefore(
  rowsNewestFirst: readonly AuDeductionRateRow[],
  row: AuDeductionRateRow,
): { rate: number; incomeYear: string } | undefined {
  const i = rowsNewestFirst.indexOf(row);
  for (let j = i + 1; j < rowsNewestFirst.length; j++) {
    const prev = rowsNewestFirst[j];
    if (prev.verified && prev.rate !== null) {
      // It ran until the next-newer row started, so its last year is the one before that.
      const endedYear = Number(rowsNewestFirst[j - 1].effectiveFrom.slice(0, 4));
      return { rate: prev.rate, incomeYear: auIncomeYear(`${endedYear - 1}-07-01`).label };
    }
  }
  return undefined;
}

function lookup(
  rowsNewestFirst: readonly AuDeductionRateRow[],
  input: AuIncomeYearInput,
  unit: AuRateUnit,
): AuDeductionRate {
  const year = auIncomeYear(input);
  const row = resolveEffectiveDated(rowsNewestFirst, year.startYmd);
  const base = { incomeYear: year.label, sourceUrl: row.sourceUrl, readOn: row.readOn };
  if (row.verified && row.rate !== null) {
    return { ...base, rate: row.rate, verified: true, note: row.note };
  }
  // No published rate: say so, name the last one, and do not apply it.
  const last = lastPublishedBefore(rowsNewestFirst, row);
  if (!last) return { ...base, rate: null, verified: false, note: row.note };
  return {
    ...base,
    rate: null,
    verified: false,
    note:
      `${row.note} The last published rate is ${formatAuCents(last.rate, unit)}, for ${last.incomeYear}. ` +
      `It does not carry over: confirm the ${year.label} rate with the ATO before claiming.`,
    lastPublished: last,
  };
}

const WFH_NEWEST_FIRST: readonly AuDeductionRateRow[] = sortNewestFirst(AU_WFH_FIXED_RATE_ROWS);
const CENTS_PER_KM_NEWEST_FIRST: readonly AuDeductionRateRow[] = sortNewestFirst(AU_CENTS_PER_KM_ROWS);

/**
 * The working from home fixed rate for an income year ('2025-26') or for the
 * income year a day falls in. `rate` is AUD per work hour; null with
 * `verified: false` where the ATO has published nothing for that year.
 */
export function workFromHomeFixedRate(incomeYearOrDate: AuIncomeYearInput): AuDeductionRate {
  return lookup(WFH_NEWEST_FIRST, incomeYearOrDate, 'per work hour');
}

/**
 * The cents per kilometre rate for car expenses for an income year or a day.
 * `rate` is AUD per business kilometre, capped at
 * AU_CENTS_PER_KM_MAX_BUSINESS_KM per car per year.
 */
export function centsPerKmRate(incomeYearOrDate: AuIncomeYearInput): AuDeductionRate {
  return lookup(CENTS_PER_KM_NEWEST_FIRST, incomeYearOrDate, 'per kilometre');
}

/** The pages these rates were read from, for a "where does this come from" link. */
export const AU_DEDUCTION_RATE_AUTHORITY_URLS = {
  workFromHomeFixedRate: ATO_WFH_FIXED_RATE,
  centsPerKm2026Notice: ATO_SD_CENTS_PER_KM_2026,
  centsPerKmMethod: ATO_BUSINESS_CENTS_PER_KM,
} as const;
