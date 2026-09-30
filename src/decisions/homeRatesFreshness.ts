/**
 * Keeping the home rules up to date — ai2fin.com
 *
 * Every figure and rule the home decisions use carries a `reviewBy` date: the
 * day by which a person must read its source again (or, for a year with no
 * published figure, check whether one has appeared). This module lists them
 * in one place, so that:
 *
 *  - `__tests__/homeRatesFreshness.test.ts` FAILS once today is past any
 *    in-force `reviewBy` — stale home figures block CI and the release instead
 *    of shipping silently;
 *  - the scheduled Rate Watch report names them (scripts/rate-watch/run.cjs);
 *  - a host can show "checked on …, next review by …" beside a figure.
 *
 * Rate rows (effective-dated series) are judged by the row in force on the
 * day; the AU home-space figures and the AU rule rows are single entries.
 * Pure: the day is an input.
 */

// NOT '../rateWatch': that CI script is excluded from the package build (see tsconfig.json), and importing it here
// would pull it back into every consumer's `prepare` build. Rate Watch imports this module instead.
import { toYmd } from '../data';
import { AU_WFH_FIXED_RATE_ROWS, auIncomeYear } from '../countries/australiaDeductions';
import { AU_HOME_SPACE_FIGURES } from './homeSpaceRates';
import { AU_HOME_PROPERTY_RULES } from './homePropertyRules';
import {
  GB_CGT_ANNUAL_EXEMPT_ROWS,
  GB_CGT_BASIC_RATE_ROWS,
  GB_CGT_HIGHER_RATE_ROWS,
  GB_RENT_A_ROOM_ROWS,
  NZ_BOARDER_STANDARD_COST_ROWS,
  NZ_SQUARE_METRE_RATE_ROWS,
  US_HOME_OFFICE_RECOVERY_YEARS_ROWS,
  US_SIMPLIFIED_METHOD_ROWS,
  US_UNRECAPTURED_1250_MAX_RATE_ROWS,
  gbTaxYear,
  nzIncomeYear,
  usTaxYear,
} from './homeRuleRates';

interface RowLike {
  effectiveFrom: string;
  value: number | null;
  verified: boolean;
  sourceUrl: string | null;
  readOn: string | null;
  reviewBy?: string | null;
}

interface HomeRowSeries {
  series: string;
  country: string;
  label: string;
  file: string;
  yearOf: (ymd: string) => string;
  rows: readonly RowLike[];
}

const RATES_FILE = 'src/decisions/homeRuleRates.ts';

/** Every effective-dated series the home decisions read. Rate Watch watches the same series (a test holds them equal). */
export const HOME_RATE_SERIES: readonly HomeRowSeries[] = [
  {
    series: 'AU.workFromHomeFixedRate',
    country: 'AU',
    label: 'Working from home fixed rate',
    file: 'src/countries/australiaDeductions.ts',
    yearOf: (d) => auIncomeYear(d).label,
    rows: AU_WFH_FIXED_RATE_ROWS.map((r) => ({ effectiveFrom: r.effectiveFrom, value: r.rate, verified: r.verified, sourceUrl: r.sourceUrl, readOn: r.readOn, reviewBy: r.reviewBy ?? null })),
  },
  { series: 'GB.rentARoom', country: 'GB', label: 'Rent a Room tax-free amount', file: RATES_FILE, yearOf: gbTaxYear, rows: GB_RENT_A_ROOM_ROWS },
  { series: 'US.homeOfficeSimplifiedMethod', country: 'US', label: 'Home office simplified method', file: RATES_FILE, yearOf: usTaxYear, rows: US_SIMPLIFIED_METHOD_ROWS },
  { series: 'NZ.homeOfficeSquareMetreRate', country: 'NZ', label: 'Home office square-metre rate', file: RATES_FILE, yearOf: nzIncomeYear, rows: NZ_SQUARE_METRE_RATE_ROWS },
  { series: 'NZ.boarderStandardCost', country: 'NZ', label: 'Boarder standard cost', file: RATES_FILE, yearOf: nzIncomeYear, rows: NZ_BOARDER_STANDARD_COST_ROWS },
  { series: 'GB.cgtBasicRate', country: 'GB', label: 'Capital Gains Tax rate, basic rate band', file: RATES_FILE, yearOf: gbTaxYear, rows: GB_CGT_BASIC_RATE_ROWS },
  { series: 'GB.cgtHigherRate', country: 'GB', label: 'Capital Gains Tax rate, above the basic rate band', file: RATES_FILE, yearOf: gbTaxYear, rows: GB_CGT_HIGHER_RATE_ROWS },
  { series: 'GB.cgtAnnualExempt', country: 'GB', label: 'Capital Gains Tax annual exempt amount', file: RATES_FILE, yearOf: gbTaxYear, rows: GB_CGT_ANNUAL_EXEMPT_ROWS },
  { series: 'US.unrecaptured1250MaxRate', country: 'US', label: 'Unrecaptured section 1250 gain, maximum rate', file: RATES_FILE, yearOf: usTaxYear, rows: US_UNRECAPTURED_1250_MAX_RATE_ROWS },
  { series: 'US.homeOfficeRecoveryYears', country: 'US', label: 'Home office depreciation recovery period', file: RATES_FILE, yearOf: usTaxYear, rows: US_HOME_OFFICE_RECOVERY_YEARS_ROWS },
];

export interface HomeRateInventoryItem {
  /** 'GB.cgtBasicRate', 'AU.homeSpace.cpiAssumption', 'AU.rule.cgtFrom1July2027'. */
  series: string;
  country: string;
  label: string;
  /** The figure in force, or null for a year with nothing published (and for a rule, which has text, not a number). */
  value: number | null;
  /** The tax year the in-force row covers, in that country's terms. */
  taxYear: string;
  sourceUrl: string | null;
  readOn: string | null;
  reviewBy: string | null;
  /** The file a person edits after re-reading the source. */
  file: string;
}

/** Every home figure and rule in force on `asOf`, with its value, tax year, source, read date and review date. */
export function homeRateInventory(asOf?: string | Date): HomeRateInventoryItem[] {
  const today = toYmd(asOf ?? new Date());
  const items: HomeRateInventoryItem[] = [];
  for (const s of HOME_RATE_SERIES) {
    const current = [...s.rows].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)).find((r) => r.effectiveFrom <= today);
    items.push({
      series: s.series,
      country: s.country,
      label: s.label,
      value: current && current.verified ? current.value : null,
      taxYear: s.yearOf(today),
      sourceUrl: current?.sourceUrl ?? null,
      readOn: current?.readOn ?? null,
      reviewBy: current?.reviewBy ?? null,
      file: s.file,
    });
  }
  for (const [key, f] of Object.entries(AU_HOME_SPACE_FIGURES)) {
    items.push({
      series: `AU.homeSpace.${key}`,
      country: 'AU',
      label: `${key} (${f.kind})`,
      value: f.value,
      taxYear: f.taxYear,
      sourceUrl: f.sourceUrl,
      readOn: f.readOn,
      reviewBy: f.reviewBy,
      file: 'src/decisions/homeSpaceRates.ts',
    });
  }
  for (const [key, r] of Object.entries(AU_HOME_PROPERTY_RULES)) {
    items.push({
      series: `AU.rule.${key}`,
      country: 'AU',
      label: `rule: ${key}`,
      value: null,
      taxYear: 'current',
      sourceUrl: r.sourceUrl,
      readOn: r.readOn,
      reviewBy: r.reviewBy,
      file: 'src/decisions/homePropertyRules.ts',
    });
  }
  return items;
}

/** Items with no review date, or whose review date has passed. Empty means every home figure is within its review window. */
export function homeRatesPastReview(asOf?: string | Date): Array<HomeRateInventoryItem & { reviewBy: string | null }> {
  const today = toYmd(asOf ?? new Date());
  return homeRateInventory(today).filter((i) => i.reviewBy === null || i.reviewBy < today);
}

/**
 * The AU home-space figures and rules past review — the part of `homeRatesPastReview` that Rate Watch's deduction
 * analysis does not already report (it reports the rate rows itself, as `pastReviewBy`).
 */
export function homeFiguresPastReview(asOf?: string | Date): HomeRateInventoryItem[] {
  return homeRatesPastReview(asOf).filter((i) => i.series.startsWith('AU.homeSpace.') || i.series.startsWith('AU.rule.'));
}
