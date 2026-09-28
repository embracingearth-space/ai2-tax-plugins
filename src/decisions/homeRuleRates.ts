/**
 * Effective-dated figures behind the per-country home rules — ai2fin.com
 *
 * The same row shape as the AU deduction rates (./../countries/australiaDeductions):
 * a row runs from its `effectiveFrom` until the next row starts, and a year the
 * authority has published nothing for is a `value: null, verified: false` row
 * rather than a gap — so Rate Watch can flag the current year the moment it has
 * no verified figure, and a lookup never carries last year's number forward.
 *
 * Only figures read on the authority's own page are `verified: true`. A figure
 * seen only in an official-domain search excerpt is recorded as `value: null`
 * with the excerpt in the note: it is never a number the app uses.
 *
 * All pages read on 28 September 2026 (UTC).
 */

export interface HomeRateRow {
  /** YYYY-MM-DD, the first day of the tax year the figure is for. */
  effectiveFrom: string;
  value: number | null;
  verified: boolean;
  sourceUrl: string | null;
  readOn: string | null;
  note: string;
}

export const HOME_RULES_READ_ON = '2026-09-28';
const R = HOME_RULES_READ_ON;

export const HOME_RATE_URLS = {
  gbRentARoom: 'https://www.gov.uk/rent-room-in-your-home/the-rent-a-room-scheme',
  usSimplifiedMethod: 'https://www.irs.gov/taxtopics/tc509',
  nzSquareMetreRate: 'https://www.ird.govt.nz/updates/news-folder/2026/square-metre-rate-for-home-office-calculations-2026',
  nzBoarderStandardCost:
    'https://www.ird.govt.nz/property/renting-out-residential-property/residential-rental-income-and-paying-tax-on-it/rules-for-working-out-rental-income-and-expenses/standard-cost-method-for-boarders-and-home-stay-students',
} as const;

/**
 * GB Rent a Room: £7,500 a year (£3,750 if the income is shared). The page
 * states it without a year; the row starts at the tax year it was read in
 * (from 6 April 2026) and earlier years are not recorded here.
 */
export const GB_RENT_A_ROOM_ROWS: HomeRateRow[] = [
  { effectiveFrom: '2026-04-06', value: 7500, verified: true, sourceUrl: HOME_RATE_URLS.gbRentARoom, readOn: R, note: '£7,500 a year tax-free (£3,750 if you share the income).' },
  { effectiveFrom: '1900-04-06', value: null, verified: false, sourceUrl: null, readOn: null, note: 'Rent a Room limits before 2026-27 are not recorded here.' },
];

/** US simplified home-office method: $5 per sq ft, up to 300 sq ft — the 2025 publications. 2026 not yet confirmed. */
export const US_SIMPLIFIED_METHOD_ROWS: HomeRateRow[] = [
  { effectiveFrom: '2026-01-01', value: null, verified: false, sourceUrl: HOME_RATE_URLS.usSimplifiedMethod, readOn: R, note: 'The 2026 simplified-method rate has not been confirmed on an IRS page for 2026.' },
  { effectiveFrom: '2025-01-01', value: 5, verified: true, sourceUrl: HOME_RATE_URLS.usSimplifiedMethod, readOn: R, note: '$5 per square foot of the area used, up to 300 square feet; depreciation is treated as zero.' },
  { effectiveFrom: '1900-01-01', value: null, verified: false, sourceUrl: null, readOn: null, note: 'Simplified-method rates before 2025 are not recorded here.' },
];

/**
 * NZ home-office square-metre rate (utilities), by income year (1 April to 31
 * March). $57.30 for the 2026 income year was read on the IRD page; $55.60 for
 * 2025 appeared only in a search excerpt, so it is not a number here; the 2027
 * income year rate was not found.
 */
export const NZ_SQUARE_METRE_RATE_ROWS: HomeRateRow[] = [
  { effectiveFrom: '2026-04-01', value: null, verified: false, sourceUrl: HOME_RATE_URLS.nzSquareMetreRate, readOn: R, note: 'The square-metre rate for the 2027 income year (from 1 April 2026) has not been found on an IRD page.' },
  { effectiveFrom: '2025-04-01', value: 57.3, verified: true, sourceUrl: HOME_RATE_URLS.nzSquareMetreRate, readOn: R, note: '$57.30 per square metre of home-office area for the 2026 income year (1 April 2025 to 31 March 2026), for utilities.' },
  { effectiveFrom: '2024-04-01', value: null, verified: false, sourceUrl: null, readOn: null, note: 'The 2025 income year rate ($55.60) was seen only in a search excerpt, not on the page; confirm it with IRD.' },
];

/** NZ standard cost for boarders and home-stay students: $245 per boarder per week, 1 to 4 boarders, 2025–2026 income year. */
export const NZ_BOARDER_STANDARD_COST_ROWS: HomeRateRow[] = [
  { effectiveFrom: '2026-04-01', value: null, verified: false, sourceUrl: HOME_RATE_URLS.nzBoarderStandardCost, readOn: R, note: 'The boarder standard cost for the 2027 income year (from 1 April 2026) has not been found on an IRD page.' },
  { effectiveFrom: '2025-04-01', value: 245, verified: true, sourceUrl: HOME_RATE_URLS.nzBoarderStandardCost, readOn: R, note: '$245 per boarder per week, for 1 to 4 boarders, for the 2025–2026 income year.' },
  { effectiveFrom: '1900-04-01', value: null, verified: false, sourceUrl: null, readOn: null, note: 'Boarder standard costs before the 2025–2026 income year are not recorded here.' },
];

/** The verified row with the given start date — throws if it is missing or unverified, so a figure can never drift from its row. */
export function verifiedRow(rows: readonly HomeRateRow[], effectiveFrom: string): HomeRateRow & { value: number; sourceUrl: string; readOn: string } {
  const row = rows.find((r) => r.effectiveFrom === effectiveFrom);
  if (!row || !row.verified || row.value === null || !row.sourceUrl || !row.readOn) {
    throw new Error(`homeRuleRates: no verified row from ${effectiveFrom}`);
  }
  return row as HomeRateRow & { value: number; sourceUrl: string; readOn: string };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** GB tax year label for a day: 6 April to 5 April ('2026-27'). */
export function gbTaxYear(ymd: string): string {
  const y = Number(ymd.slice(0, 4));
  const start = ymd.slice(5) >= '04-06' ? y : y - 1;
  return `${start}-${pad2((start + 1) % 100)}`;
}

/** NZ income year for a day: named for the year it ENDS in (1 April 2025 – 31 March 2026 is the 2026 income year). */
export function nzIncomeYear(ymd: string): string {
  const y = Number(ymd.slice(0, 4));
  return `${ymd.slice(5) >= '04-01' ? y + 1 : y} income year`;
}

/** US tax year: the calendar year. */
export function usTaxYear(ymd: string): string {
  return ymd.slice(0, 4);
}
