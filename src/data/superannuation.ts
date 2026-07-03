/**
 * Retirement / Pension Contributions — @ai2/tax-plugins
 * embracingearth.space
 *
 * WHY THIS EXISTS: retirement contributions (AU Superannuation Guarantee) sit
 * alongside income tax but are a distinct system — an employer contribution
 * taxed inside the fund, not on the individual return. This module estimates
 * the mandatory contribution, concessional-cap usage, in-fund contributions
 * tax, and the Division 293 high-earner surcharge. It is the first of a generic
 * "retirement scheme" shape; NZ KiwiSaver, UK auto-enrolment and US 401(k)
 * employer contributions can be added as their own schemes.
 *
 * SCOPE & HONESTY: an indicative estimate, not advice and not a filing figure.
 * It does NOT model fund fees, insurance, investment returns, non-concessional
 * contributions, carry-forward unused caps, or the low-income super tax offset.
 *
 * EFFECTIVE-DATING: schemes are ordered most-recent-first with an
 * `effectiveFrom`; `getSuperannuationEstimate(cc, {asOf})` picks the scheme
 * whose window contains `asOf`. Mirrors companyTax.ts / studentLoan.ts.
 *
 * AUSTRALIA — figures verified against the ATO on 2026-07-03:
 *   SG rate 12% from 1 Jul 2025 (11.5% in 2024-25); concessional cap $30,000
 *   through 2025-26, rising to $32,500 from 1 Jul 2026; Division 293 threshold
 *   $250,000 (extra 15%). Maximum contribution base: QUARTERLY through 2025-26
 *   ($62,500/qtr), then ANNUAL from 2026-27 ($270,830 = $32,500 × 100 ÷ 12)
 *   because Payday Super replaces the quarterly SG calculation from 1 Jul 2026.
 *   Sources:
 *   https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds
 *   https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/super-guarantee
 *   https://www.ato.gov.au/businesses-and-organisations/super-for-employers/payday-super/paying-super-on-payday/what-payments-are-qualifying-earnings/maximum-contributions-base
 */

export interface RetirementScheme {
  /** ISO date this year's parameters take effect (inclusive). */
  effectiveFrom: string;
  /** Financial-year label, e.g. '2025-26'. */
  taxYearLabel: string;
  /** Mandatory employer contribution rate on earnings (AU SG: 0.12 = 12%). */
  guaranteeRate: number;
  /** Before-tax (concessional) contributions cap for the year. */
  concessionalCap: number;
  /** Tax rate on concessional contributions inside the fund (AU: 15%). */
  contributionsTaxRate: number;
  /** Combined income + concessional contributions above which Div 293 applies. */
  highEarnerThreshold: number;
  /** Additional tax rate on contributions above the high-earner threshold. */
  highEarnerSurchargeRate: number;
  /**
   * Maximum earnings per quarter that attract the guarantee (AU maximum
   * contribution base, quarterly years through 2025-26). Mutually exclusive
   * with maxContributionBaseAnnual.
   */
  maxContributionBaseQuarter?: number;
  /**
   * Maximum earnings per financial year that attract the guarantee. AU uses an
   * ANNUAL base from 2026-27 (Payday Super replaced the quarterly calculation
   * on 1 Jul 2026; the ATO derives it as concessional cap ÷ SG rate).
   */
  maxContributionBaseAnnual?: number;
  /** Authoritative source URL. */
  source: string;
}

export interface RetirementInfo {
  countryCode: string;
  authorityName: string;
  /** Local label, e.g. 'Superannuation Guarantee'. */
  label: string;
  /** Local name for the contribution ('super', 'KiwiSaver', 'pension'). */
  contributionName: string;
  /** Schemes ordered most-recent-first. */
  schemes: RetirementScheme[];
}

export const RETIREMENT_SCHEMES: Record<string, RetirementInfo> = {
  AU: {
    countryCode: 'AU',
    authorityName: 'ATO',
    label: 'Superannuation Guarantee',
    contributionName: 'super',
    schemes: [
      {
        effectiveFrom: '2026-07-01',
        taxYearLabel: '2026-27',
        guaranteeRate: 0.12,
        concessionalCap: 32500,
        contributionsTaxRate: 0.15,
        highEarnerThreshold: 250000,
        highEarnerSurchargeRate: 0.15,
        // Payday Super (from 1 Jul 2026) uses an ANNUAL maximum contribution
        // base: $270,830 = $32,500 concessional cap × 100 ÷ 12 (ATO-published),
        // so SG at the base lands exactly on the concessional cap.
        maxContributionBaseAnnual: 270830,
        source: 'https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds',
      },
      {
        effectiveFrom: '2025-07-01',
        taxYearLabel: '2025-26',
        guaranteeRate: 0.12,
        concessionalCap: 30000,
        contributionsTaxRate: 0.15,
        highEarnerThreshold: 250000,
        highEarnerSurchargeRate: 0.15,
        maxContributionBaseQuarter: 62500,
        source: 'https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds',
      },
      {
        effectiveFrom: '2024-07-01',
        taxYearLabel: '2024-25',
        guaranteeRate: 0.115,
        concessionalCap: 30000,
        contributionsTaxRate: 0.15,
        highEarnerThreshold: 250000,
        highEarnerSurchargeRate: 0.15,
        maxContributionBaseQuarter: 65070,
        source: 'https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds',
      },
    ],
  },
};

/** Country codes with a retirement scheme defined here. */
export function listRetirementCountries(): string[] {
  return Object.keys(RETIREMENT_SCHEMES);
}

/**
 * Resolve the retirement info for a country, or null if unsupported.
 * Accepts compound keys ('AU-IT') and bare codes ('AU') alike.
 */
export function getRetirementInfo(countryCode?: string | null): RetirementInfo | null {
  if (!countryCode) return null;
  const base = countryCode.toUpperCase().split('-')[0];
  return RETIREMENT_SCHEMES[base] ?? null;
}

function resolveScheme(
  info: RetirementInfo,
  opts: { asOf?: Date; taxYear?: string },
): RetirementScheme | null {
  if (opts.taxYear) {
    return info.schemes.find((s) => s.taxYearLabel === opts.taxYear) ?? null;
  }
  const asOfTime = (opts.asOf ?? new Date()).getTime();
  return (
    info.schemes.find((s) => new Date(s.effectiveFrom).getTime() <= asOfTime) ??
    info.schemes[info.schemes.length - 1]
  );
}

export interface ResolvedSuperannuationEstimate {
  countryCode: string;
  authorityName: string;
  label: string;
  contributionName: string;
  taxYearLabel: string;
  guaranteeRate: number;
  /** Earnings the guarantee was applied to (after any quarterly base cap). */
  guaranteeableEarnings: number;
  /** Mandatory employer contribution for the year (rounded). */
  guaranteeAmount: number;
  /** SG + salary sacrifice + personal deductible, all concessional. */
  concessionalContributions: number;
  concessionalCap: number;
  /** Contributions above the cap (taxed at marginal rate, not modelled here). */
  excessConcessional: number;
  /** 15% contributions tax on concessional contributions within the cap. */
  contributionsTax: number;
  /** True when income + concessional contributions exceed the Div 293 threshold. */
  highEarnerSurchargeApplies: boolean;
  /** Division 293 tax (extra 15% on the lesser of excess-over-threshold or contributions). */
  highEarnerSurchargeTax: number;
  source: string;
  effectiveFrom: string;
}

/**
 * Estimate annual superannuation for a country as of a date.
 *
 * @param countryCode  ISO code or compound key ('AU' / 'AU-IT').
 * @param opts.ordinaryEarnings  Ordinary time earnings the guarantee applies to.
 * @param opts.salarySacrifice   Voluntary before-tax (concessional) contributions.
 * @param opts.personalDeductible Personal contributions claimed as a deduction.
 * @param opts.otherTaxableIncome Income counted toward the Div 293 threshold
 *   ON TOP of concessional contributions (e.g. taxable income). Caller assembles.
 * @param opts.asOf / opts.taxYear  Select the year's parameters.
 * @returns resolved estimate, or null when the country/year is unsupported.
 */
export function getSuperannuationEstimate(
  countryCode: string | null | undefined,
  opts: {
    ordinaryEarnings: number;
    salarySacrifice?: number;
    personalDeductible?: number;
    otherTaxableIncome?: number;
    asOf?: Date;
    taxYear?: string;
  },
): ResolvedSuperannuationEstimate | null {
  const info = getRetirementInfo(countryCode);
  if (!info) return null;
  const scheme = resolveScheme(info, opts);
  if (!scheme) return null;

  const ote = Math.max(0, num(opts.ordinaryEarnings));
  const salarySacrifice = Math.max(0, num(opts.salarySacrifice));
  const personalDeductible = Math.max(0, num(opts.personalDeductible));
  const otherIncome = Math.max(0, num(opts.otherTaxableIncome));

  // SG is capped by the maximum contribution base — quarterly (×4 annually)
  // through 2025-26, annual from 2026-27 (Payday Super) — where the year
  // defines one; otherwise the full OTE is guaranteeable. The two fields are
  // mutually exclusive per scheme (see RetirementScheme docs).
  const annualBaseCap =
    scheme.maxContributionBaseAnnual ??
    (scheme.maxContributionBaseQuarter != null ? scheme.maxContributionBaseQuarter * 4 : Infinity);
  const guaranteeableEarnings = Math.min(ote, annualBaseCap);
  const guaranteeAmount = Math.round(guaranteeableEarnings * scheme.guaranteeRate);

  const concessionalContributions = guaranteeAmount + salarySacrifice + personalDeductible;
  const excessConcessional = Math.max(0, concessionalContributions - scheme.concessionalCap);
  const cappedConcessional = Math.min(concessionalContributions, scheme.concessionalCap);
  const contributionsTax = Math.round(cappedConcessional * scheme.contributionsTaxRate);

  // Division 293: extra tax on the LESSER of (combined income over threshold)
  // and (taxable concessional contributions) — matching the ATO rule.
  const combinedIncome = otherIncome + concessionalContributions;
  const highEarnerSurchargeApplies = combinedIncome > scheme.highEarnerThreshold;
  const surchargeBase = Math.min(
    Math.max(0, combinedIncome - scheme.highEarnerThreshold),
    cappedConcessional,
  );
  const highEarnerSurchargeTax = highEarnerSurchargeApplies
    ? Math.round(surchargeBase * scheme.highEarnerSurchargeRate)
    : 0;

  return {
    countryCode: info.countryCode,
    authorityName: info.authorityName,
    label: info.label,
    contributionName: info.contributionName,
    taxYearLabel: scheme.taxYearLabel,
    guaranteeRate: scheme.guaranteeRate,
    guaranteeableEarnings,
    guaranteeAmount,
    concessionalContributions,
    concessionalCap: scheme.concessionalCap,
    excessConcessional,
    contributionsTax,
    highEarnerSurchargeApplies,
    highEarnerSurchargeTax,
    source: scheme.source,
    effectiveFrom: scheme.effectiveFrom,
  };
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
