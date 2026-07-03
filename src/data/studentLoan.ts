/**
 * Student / Training Loan Compulsory Repayments — @ai2/tax-plugins
 * embracingearth.space
 *
 * WHY THIS EXISTS: the `{country}-IT` plugins model income tax, but a
 * compulsory student-loan repayment is a SEPARATE charge assessed on a
 * broader "repayment income" base and levied alongside income tax. Australia's
 * HELP/HECS is the first implementation; the shape is generic so the UK
 * (Plan 1/2/4/5), NZ and US federal loans can be added as their own schemes.
 *
 * SCOPE & HONESTY: this computes the COMPULSORY repayment the tax system
 * withholds — not the loan balance, indexation, or voluntary repayments. It is
 * an indicative estimate carrying a "not tax advice" disclaimer at the surface
 * layers (MCP / website), never a filing figure.
 *
 * EFFECTIVE-DATING: each country holds an array of schemes ordered most-recent
 * -first, each with an `effectiveFrom`. `getStudentLoanRepayment(cc, {asOf})`
 * picks the scheme whose window contains `asOf` (falls back to the newest),
 * mirroring companyTax.ts so a future budget change is a data edit, not code.
 *
 * AUSTRALIA — the 2025-26 reform: from the 2025-26 income year the ATO switched
 * from a whole-of-income system (a single rate applied to ALL repayment income)
 * to a MARGINAL system (rate applied only to income ABOVE the threshold), with
 * the top band reverting to a flat rate on total income. Thresholds index
 * annually. Source (verified 2026-07-03):
 * https://www.ato.gov.au/tax-rates-and-codes/study-and-training-support-loans-rates-and-repayment-thresholds
 */

export interface StudentLoanBand {
  /** Repayment-income floor for this band (inclusive lower bound). */
  floor: number;
  /**
   * MARGINAL schemes: rate applied to repayment income above `floor`.
   * WHOLE-OF-INCOME schemes (and marginal top bands with `wholeOfIncome`):
   * rate applied to TOTAL repayment income.
   */
  rate: number;
  /**
   * Accumulated repayment carried in at `floor` (marginal schemes only).
   * e.g. AU 2025-26 middle band = ($125,000 - $67,000) × 15% = $8,700.
   */
  base?: number;
  /**
   * Top band flag: apply `rate` to TOTAL repayment income rather than the
   * excess over `floor`. Matches the ATO top band from 2025-26 onward, which
   * is continuous with the marginal band below it by design.
   */
  wholeOfIncome?: boolean;
}

export interface StudentLoanScheme {
  /** ISO date this year's schedule takes effect (inclusive). */
  effectiveFrom: string;
  /** Financial-year label, e.g. '2025-26'. */
  taxYearLabel: string;
  /**
   * 'marginal'        → repayment on income above `minThreshold` (AU 2025-26+).
   * 'wholeOfIncome'   → single rate on total repayment income (AU ≤2024-25,
   *                     UK plans). Kept generic for other jurisdictions.
   */
  method: 'marginal' | 'wholeOfIncome';
  /** Repayment income at or below this pays nil. */
  minThreshold: number;
  /** Bands ordered by ascending `floor`. */
  bands: StudentLoanBand[];
  /** Authoritative source URL for this year's schedule. */
  source: string;
}

export interface StudentLoanInfo {
  countryCode: string;
  authorityName: string;
  /** Local label, e.g. 'HELP / study and training loans'. */
  label: string;
  /** Schemes ordered most-recent-first. */
  schemes: StudentLoanScheme[];
}

/**
 * Compulsory student-loan repayment schedules. Australia only for now; the
 * structure is generic so other countries slot in as new entries.
 *
 * AU figures verified against the ATO threshold tables on 2026-07-03. Only the
 * MARGINAL years (2025-26 onward) are modelled — the pre-2025-26 whole-of-income
 * tables are a different, now-superseded system and are intentionally out of
 * scope for this forward-looking estimate.
 */
export const STUDENT_LOAN_SCHEMES: Record<string, StudentLoanInfo> = {
  AU: {
    countryCode: 'AU',
    authorityName: 'ATO',
    label: 'HELP / study and training support loans',
    schemes: [
      {
        effectiveFrom: '2026-07-01',
        taxYearLabel: '2026-27',
        method: 'marginal',
        minThreshold: 69528,
        bands: [
          { floor: 69528, rate: 0.15, base: 0 },
          { floor: 129717, rate: 0.17, base: 9028 },
          { floor: 186051, rate: 0.10, base: 0, wholeOfIncome: true },
        ],
        source:
          'https://www.ato.gov.au/tax-rates-and-codes/study-and-training-support-loans-rates-and-repayment-thresholds',
      },
      {
        effectiveFrom: '2025-07-01',
        taxYearLabel: '2025-26',
        method: 'marginal',
        minThreshold: 67000,
        bands: [
          { floor: 67000, rate: 0.15, base: 0 },
          { floor: 125000, rate: 0.17, base: 8700 },
          { floor: 179286, rate: 0.10, base: 0, wholeOfIncome: true },
        ],
        source:
          'https://www.ato.gov.au/tax-rates-and-codes/study-and-training-support-loans-rates-and-repayment-thresholds',
      },
    ],
  },
};

/** Country codes with a student-loan schedule defined here. */
export function listStudentLoanCountries(): string[] {
  return Object.keys(STUDENT_LOAN_SCHEMES);
}

/**
 * Resolve the student-loan info for a country, or null if unsupported.
 * Accepts compound keys ('AU-IT') and bare codes ('AU') alike.
 */
export function getStudentLoanInfo(countryCode?: string | null): StudentLoanInfo | null {
  if (!countryCode) return null;
  const base = countryCode.toUpperCase().split('-')[0];
  return STUDENT_LOAN_SCHEMES[base] ?? null;
}

function resolveScheme(
  info: StudentLoanInfo,
  opts: { asOf?: Date; taxYear?: string },
): StudentLoanScheme | null {
  if (opts.taxYear) {
    return info.schemes.find((s) => s.taxYearLabel === opts.taxYear) ?? null;
  }
  const asOfTime = (opts.asOf ?? new Date()).getTime();
  return (
    info.schemes.find((s) => new Date(s.effectiveFrom).getTime() <= asOfTime) ??
    info.schemes[info.schemes.length - 1]
  );
}

export interface ResolvedStudentLoanRepayment {
  countryCode: string;
  authorityName: string;
  label: string;
  taxYearLabel: string;
  method: 'marginal' | 'wholeOfIncome';
  repaymentIncome: number;
  minThreshold: number;
  /** Compulsory repayment for the year, rounded to whole dollars. */
  repayment: number;
  /** repayment ÷ repaymentIncome (0 when income is 0). */
  effectiveRate: number;
  source: string;
  effectiveFrom: string;
}

/**
 * Compute the compulsory student-loan repayment for a country as of a date.
 *
 * @param countryCode  ISO code or compound key ('AU' / 'AU-IT').
 * @param opts.repaymentIncome  ATO "repayment income" (taxable income +
 *   reportable super contributions + reportable fringe benefits + net
 *   investment loss + exempt foreign income). Caller assembles this.
 * @param opts.asOf     Date selecting the year's schedule (default: now).
 * @param opts.taxYear  Explicit FY label ('2025-26'); overrides asOf.
 * @returns resolved repayment, or null when the country/year is unsupported.
 */
export function getStudentLoanRepayment(
  countryCode: string | null | undefined,
  opts: { repaymentIncome: number; asOf?: Date; taxYear?: string },
): ResolvedStudentLoanRepayment | null {
  const info = getStudentLoanInfo(countryCode);
  if (!info) return null;
  const scheme = resolveScheme(info, opts);
  if (!scheme) return null;

  const income = Number.isFinite(opts.repaymentIncome) ? Math.max(0, opts.repaymentIncome) : 0;

  let repayment = 0;
  if (income > scheme.minThreshold) {
    // Bands are ascending by floor; pick the highest band whose floor <= income.
    const band =
      [...scheme.bands].reverse().find((b) => income >= b.floor) ?? scheme.bands[0];
    if (scheme.method === 'wholeOfIncome' || band.wholeOfIncome) {
      repayment = income * band.rate;
    } else {
      repayment = (band.base ?? 0) + (income - band.floor) * band.rate;
    }
  }
  // Round to cents here (kills float noise) and reproduce the ATO worked
  // examples exactly; the assessment layer rounds to whole dollars.
  repayment = Math.round(repayment * 100) / 100;

  return {
    countryCode: info.countryCode,
    authorityName: info.authorityName,
    label: info.label,
    taxYearLabel: scheme.taxYearLabel,
    method: scheme.method,
    repaymentIncome: income,
    minThreshold: scheme.minThreshold,
    repayment,
    effectiveRate: income > 0 ? repayment / income : 0,
    source: scheme.source,
    effectiveFrom: scheme.effectiveFrom,
  };
}
