/**
 * Canada — FEDERAL personal income-tax parameters, by year. @ai2/tax-plugins
 * embracingearth.space
 *
 * ONE COPY OF THE NUMBERS. Two consumers read these: the take-home scheme in
 * incomeTax.ts (INCOME_TAX_SCHEMES.CA) and the T1 filing plugin in
 * countries/canadaIncomeTax.ts. They are deliberately different calculations
 * (see incomeTax.ts's header) but they must not quote different brackets, so
 * the brackets, basic personal amount and CPP limits live here once — the same
 * arrangement finland.ts has with the Finnish scheme.
 *
 * FEDERAL ONLY. Every province and territory levies its own income tax on top,
 * with its own brackets and credits; none of that is here. Anything that
 * presents a figure computed from this file must say so.
 *
 * Newest first. A year is added only once the CRA has published its indexed
 * amounts (normally in November, before the year starts — which is why the rate
 * watch flags a missing Canadian year from 1 January with no grace period).
 * Never edit a year in place once it has been relied on: add the next year.
 *
 * Every figure below was read on the CRA page named beside it on 2026-10-06.
 */

export interface CanadaFederalSource {
  what: string;
  url: string;
}

export interface CanadaFederalYear {
  /** Calendar tax year, e.g. '2026'. */
  taxYear: string;
  effectiveFrom: string;
  /** Federal brackets on taxable income. `upTo` null = no upper limit. */
  bands: readonly { upTo: number | null; rate: number }[];
  /** The lowest federal rate, at which the non-refundable credits are computed. */
  lowestRate: number;
  /**
   * Basic personal amount (line 30000). The full `max` is reduced on a straight
   * line to `min` as net income rises from `reduceFrom` (the start of the 29%
   * bracket) to `reduceTo` (the start of the 33% bracket).
   */
  basicPersonalAmount: { max: number; min: number; reduceFrom: number; reduceTo: number };
  /** CPP: year's maximum pensionable earnings, basic exemption and the employee rate. */
  cpp: { ympe: number; basicExemption: number; employeeRate: number };
  /** RRSP dollar limit for the year. */
  rrspDollarLimit: number;
  sources: readonly CanadaFederalSource[];
  /** YYYY-MM-DD these figures were last read against `sources`. */
  citationDate: string;
  /** TRUE only when every figure above was confirmed on the official page. */
  verified: boolean;
}

const CRA = 'https://www.canada.ca/en/revenue-agency';
export const CA_FEDERAL_URLS = {
  rates2026: `${CRA}/services/tax/individuals/tax-rates-brackets/current-year.html`,
  rates2025: `${CRA}/services/tax/individuals/tax-rates-brackets/last-year.html`,
  indexation2026: `${CRA}/services/tax/individuals/frequently-asked-questions-individuals/adjustment-personal-income-tax-benefit-amounts.html`,
  bpa2025: `${CRA}/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-30000-basic-personal-amount.html`,
  cppRates: `${CRA}/services/tax/businesses/topics/payroll/payroll-deductions-contributions/canada-pension-plan-cpp/cpp-contribution-rates-maximums-exemptions.html`,
  rrspLimits: `${CRA}/services/tax/registered-plans-administrators/pspa/mp-rrsp-dpsp-tfsa-limits-ympe.html`,
} as const;

export const CA_FEDERAL_YEARS: readonly CanadaFederalYear[] = [
  {
    taxYear: '2026',
    effectiveFrom: '2026-01-01',
    // CRA "Tax rates and income brackets — 2026": 14% to $58,523; 20.5% to
    // $117,045; 26% to $181,440; 29% to $258,482; 33% above.
    bands: [
      { upTo: 58523, rate: 0.14 },
      { upTo: 117045, rate: 0.205 },
      { upTo: 181440, rate: 0.26 },
      { upTo: 258482, rate: 0.29 },
      { upTo: null, rate: 0.33 },
    ],
    lowestRate: 0.14,
    // CRA indexation page (2.0% for 2026): BPA 16,452, reduced to 14,829
    // between 181,440 and 258,482 of net income.
    basicPersonalAmount: { max: 16452, min: 14829, reduceFrom: 181440, reduceTo: 258482 },
    cpp: { ympe: 74600, basicExemption: 3500, employeeRate: 0.0595 },
    rrspDollarLimit: 33810,
    sources: [
      { what: 'Federal brackets and rates', url: CA_FEDERAL_URLS.rates2026 },
      { what: 'Basic personal amount and its reduction range (2026 indexation)', url: CA_FEDERAL_URLS.indexation2026 },
      { what: 'CPP maximum pensionable earnings, basic exemption, rate', url: CA_FEDERAL_URLS.cppRates },
      { what: 'RRSP dollar limit', url: CA_FEDERAL_URLS.rrspLimits },
    ],
    citationDate: '2026-10-06',
    verified: true,
  },
  {
    taxYear: '2025',
    effectiveFrom: '2025-01-01',
    // CRA "Tax rates and income brackets — 2025": "The federal tax rate
    // decreased from 15% to 14% on July 1, 2025, making the tax rate 14.5% for
    // 2025." 14.5% to $57,375; 20.5% to $114,750; 26% to $177,882; 29% to
    // $253,414; 33% above.
    bands: [
      { upTo: 57375, rate: 0.145 },
      { upTo: 114750, rate: 0.205 },
      { upTo: 177882, rate: 0.26 },
      { upTo: 253414, rate: 0.29 },
      { upTo: null, rate: 0.33 },
    ],
    lowestRate: 0.145,
    // Line 30000 (2025): $177,882 or less claim $16,129; more than $253,414
    // claim $14,538; the federal worksheet reduces it on a straight line between.
    basicPersonalAmount: { max: 16129, min: 14538, reduceFrom: 177882, reduceTo: 253414 },
    cpp: { ympe: 71300, basicExemption: 3500, employeeRate: 0.0595 },
    rrspDollarLimit: 32490,
    sources: [
      { what: 'Federal brackets and rates', url: CA_FEDERAL_URLS.rates2025 },
      { what: 'Basic personal amount and its reduction range', url: CA_FEDERAL_URLS.bpa2025 },
      { what: 'CPP maximum pensionable earnings, basic exemption, rate', url: CA_FEDERAL_URLS.cppRates },
      { what: 'RRSP dollar limit', url: CA_FEDERAL_URLS.rrspLimits },
    ],
    citationDate: '2026-10-06',
    verified: true,
  },
];

for (const y of CA_FEDERAL_YEARS) {
  y.bands.forEach(Object.freeze);
  Object.freeze(y.bands);
  Object.freeze(y.basicPersonalAmount);
  Object.freeze(y.cpp);
  y.sources.forEach(Object.freeze);
  Object.freeze(y.sources);
  Object.freeze(y);
}
Object.freeze(CA_FEDERAL_YEARS);

/**
 * The year in force for a calendar year number. A year before the oldest one
 * defined resolves to the oldest (the same fallback the plugin always had); a
 * year after the newest resolves to the newest — which is exactly the silent
 * stale answer the rate watch's rollover check exists to flag.
 */
export function canadaFederalYear(year: number): CanadaFederalYear {
  return CA_FEDERAL_YEARS.find((y) => Number(y.taxYear) <= year) ?? CA_FEDERAL_YEARS[CA_FEDERAL_YEARS.length - 1]!;
}

/** The federal basic personal amount for a net income, per the line 30000 worksheet. */
export function canadaBasicPersonalAmount(netIncome: number, y: CanadaFederalYear): number {
  const { max, min, reduceFrom, reduceTo } = y.basicPersonalAmount;
  if (netIncome <= reduceFrom) return max;
  if (netIncome >= reduceTo) return min;
  return max - (netIncome - reduceFrom) * ((max - min) / (reduceTo - reduceFrom));
}
