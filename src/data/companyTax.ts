/**
 * Company / Corporate Income Tax Rates — @ai2/tax-plugins
 * embracingearth.space
 *
 * WHY THIS EXISTS: the `{country}-IT` plugins model the INDIVIDUAL return
 * (employee / sole trader). They do NOT model company tax — a company is a
 * separate legal entity taxed at a flat headline rate on profit. This module
 * fills that gap for the forecast engine's CompanyFlatRate strategy.
 *
 * SCOPE & HONESTY: these are HEADLINE rates only. Real company tax involves
 * base-rate-entity tests (AU), state/provincial corporate tax (US, CA),
 * franking/imputation, small-profits marginal relief (GB), surcharges/cess
 * (IN), etc. The forecast surfaces these as INDICATIVE estimates with a loud
 * "not tax advice" disclaimer — never a filing figure.
 *
 * EFFECTIVE-DATING: each country holds an array of rate sets ordered most-
 * recent-first, each with an `effectiveFrom`. `getCompanyTaxRate(cc, asOf)`
 * picks the most recent set effective on or before `asOf`; if `asOf` predates
 * every set, it falls back to the oldest defined set.
 * This mirrors the effective-dated pattern used by the income-tax brackets so
 * a future budget-year change is a data edit, not a code change.
 */

export interface CompanyTaxRateSet {
  /** ISO date this rate set takes effect (inclusive). */
  effectiveFrom: string;
  /** Headline corporate income tax rate as a fraction (0.30 = 30%). */
  standardRate: number;
  /**
   * Optional reduced rate for small / base-rate-entity companies, where the
   * jurisdiction has one (AU base-rate entity 25%, GB small-profits 19%).
   */
  smallCompanyRate?: number;
  /** Plain-English note shown in the forecast disclaimer for this country. */
  note: string;
  /** Authoritative source URL for the rate. */
  source: string;
}

export interface CompanyTaxInfo {
  countryCode: string;
  authorityName: string;
  /** Local label for the tax ("Company tax", "Corporation Tax", etc.). */
  label: string;
  rates: CompanyTaxRateSet[];
}

/**
 * Headline company tax rates for the countries the forecast engine supports
 * end-to-end (AU/US/GB/IN/CA). Ordered most-recent-first per country.
 */
export const COMPANY_TAX_RATES: Record<string, CompanyTaxInfo> = {
  AU: {
    countryCode: 'AU',
    authorityName: 'ATO',
    label: 'Company tax',
    rates: [
      {
        effectiveFrom: '2021-07-01',
        standardRate: 0.30,
        smallCompanyRate: 0.25, // base-rate entity (aggregated turnover < $50m, ≤80% passive)
        note: 'Base-rate entities (aggregated turnover under $50m, no more than 80% passive income) pay 25%; all other companies 30%.',
        source: 'https://www.ato.gov.au/rates/changes-to-company-tax-rates/',
      },
    ],
  },
  US: {
    countryCode: 'US',
    authorityName: 'IRS',
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2018-01-01',
        standardRate: 0.21, // federal flat rate (TCJA). State corporate tax is additional.
        note: 'Flat 21% federal rate. Most states levy an additional corporate income tax (0%–~12%) not included here.',
        source: 'https://www.irs.gov/instructions/i1120',
      },
    ],
  },
  GB: {
    countryCode: 'GB',
    authorityName: 'HMRC',
    label: 'Corporation Tax',
    rates: [
      {
        effectiveFrom: '2023-04-01',
        standardRate: 0.25, // main rate
        smallCompanyRate: 0.19, // small-profits rate (profits ≤ £50k); marginal relief £50k–£250k
        note: 'Main rate 25% (profits over £250k). Small-profits rate 19% (profits under £50k), with marginal relief in between.',
        source: 'https://www.gov.uk/corporation-tax-rates',
      },
    ],
  },
  IN: {
    countryCode: 'IN',
    authorityName: 'Income Tax Department',
    label: 'Corporate tax',
    rates: [
      {
        effectiveFrom: '2019-09-20',
        standardRate: 0.25, // domestic company, turnover ≤ ₹400cr (plus surcharge + 4% cess, not modelled)
        smallCompanyRate: 0.22, // concessional regime u/s 115BAA (no incentives)
        note: 'Domestic companies: 25% (turnover up to ₹400cr) or 22% concessional regime. Surcharge and 4% health & education cess apply on top and are not included.',
        source: 'https://www.incometax.gov.in/iec/foportal/help/company/return-applicable-1',
      },
    ],
  },
  CA: {
    countryCode: 'CA',
    authorityName: 'CRA',
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2019-01-01',
        standardRate: 0.15, // federal general rate (after abatement). Provincial tax is additional.
        smallCompanyRate: 0.09, // federal small-business rate (CCPC, first $500k active income)
        note: 'Federal general rate 15%; small-business rate 9% (CCPC, first $500k). Provincial/territorial corporate tax is additional and varies.',
        source: 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/corporations/corporation-tax-rates.html',
      },
    ],
  },
};

/** Country codes with a company-tax rate set defined here. */
export function listCompanyTaxCountries(): string[] {
  return Object.keys(COMPANY_TAX_RATES);
}

/**
 * Resolve the company tax info for a country, or null if unsupported.
 * Accepts compound keys ('AU-IT') and bare codes ('AU') alike.
 */
export function getCompanyTaxInfo(countryCode?: string | null): CompanyTaxInfo | null {
  if (!countryCode) return null;
  const base = countryCode.trim().toUpperCase().split('-')[0];
  return COMPANY_TAX_RATES[base] ?? null;
}

export interface ResolvedCompanyRate {
  countryCode: string;
  authorityName: string;
  label: string;
  /** Effective rate chosen given the small-company flag. */
  rate: number;
  standardRate: number;
  smallCompanyRate?: number;
  usedSmallRate: boolean;
  note: string;
  source: string;
  effectiveFrom: string;
}

/**
 * Pick the effective company tax rate for a country as of a date.
 *
 * @param countryCode  ISO code or compound key.
 * @param asOf         Date the estimate is for (selects the rate window).
 * @param opts.preferSmallRate  When true and a small-company rate exists,
 *   use it (e.g. the company qualifies as a base-rate entity / small profits).
 * @returns resolved rate, or null when the country has no company-tax data.
 */
export function getCompanyTaxRate(
  countryCode: string | null | undefined,
  asOf: Date = new Date(),
  opts: { preferSmallRate?: boolean } = {},
): ResolvedCompanyRate | null {
  const info = getCompanyTaxInfo(countryCode);
  if (!info) return null;

  const asOfTime = asOf.getTime();
  // Rate sets are newest-first; pick the first whose effectiveFrom <= asOf,
  // else fall back to the oldest defined set.
  const set =
    info.rates.find((r) => new Date(r.effectiveFrom).getTime() <= asOfTime) ??
    info.rates[info.rates.length - 1];
  // Defensive: a country defined with an empty `rates` array would leave `set`
  // undefined — treat that as "no data" rather than crashing on dereference.
  if (!set) return null;

  const usedSmallRate = Boolean(opts.preferSmallRate && set.smallCompanyRate != null);
  const rate = usedSmallRate ? (set.smallCompanyRate as number) : set.standardRate;

  return {
    countryCode: info.countryCode,
    authorityName: info.authorityName,
    label: info.label,
    rate,
    standardRate: set.standardRate,
    smallCompanyRate: set.smallCompanyRate,
    usedSmallRate,
    note: set.note,
    source: set.source,
    effectiveFrom: set.effectiveFrom,
  };
}
