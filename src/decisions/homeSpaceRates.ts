/**
 * The figures the home-space comparison multiplies by — ai2fin.com
 *
 * Each one carries where it was read, when, and the day by which a person must
 * read it again (`reviewBy`). A figure past its `reviewBy` is not wrong by
 * itself, but nobody has confirmed it is still right, so Rate Watch reports it
 * and the freshness test fails the build until someone re-reads the source and
 * moves the date (see the README, "Keeping the home rules up to date").
 *
 * `kind` separates law from assumption. The CPI rate is an ASSUMPTION about the
 * future: indexation uses the All Groups CPI for quarters that have not
 * happened yet, so the comparison's estimate of CGT under the rules from
 * 1 July 2027 states it next to every figure it touches.
 */

export interface SourcedFigure {
  value: number;
  /** The tax year or period the figure is for, in the authority's own terms. */
  taxYear: string;
  /** 'law' is read from the Act or the authority; 'assumption' is a stated estimate, never presented as law. */
  kind: 'law' | 'assumption';
  sourceUrl: string;
  /** YYYY-MM-DD the source was read. */
  readOn: string;
  /** YYYY-MM-DD by which a person must re-read the source; after it the build fails (see __tests__/homeRatesFreshness). */
  reviewBy: string;
  note: string;
}

export const AU_TAX_REFORM_NO1_ACT_URL = 'https://www.legislation.gov.au/C2026A00049/asmade/text';
export const AU_CGT_DISCOUNT_URL = 'https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/cgt-discount';
export const RBA_INFLATION_TARGET_URL = 'https://www.rba.gov.au/monetary-policy/about.html';

export const AU_HOME_SPACE_FIGURES = {
  /** The 50% CGT discount: the rule for gains accruing to 30 June 2027 (s 115-100; kept for them by s 112-160). */
  cgtDiscount: {
    value: 0.5,
    taxYear: 'gains accruing to 30 June 2027',
    kind: 'law',
    sourceUrl: AU_CGT_DISCOUNT_URL,
    readOn: '2026-09-27',
    reviewBy: '2027-06-30',
    note: 'Individuals who held the asset at least 12 months (not counting the day of acquisition or of the CGT event) halve the gain.',
  },
  /** Division 119: tax on the minimum-tax gain is topped up to 30% of it, before offsets. */
  minimumTaxRate: {
    value: 0.3,
    taxYear: 'gains accruing from 1 July 2027',
    kind: 'law',
    sourceUrl: AU_TAX_REFORM_NO1_ACT_URL,
    readOn: '2026-09-28',
    reviewBy: '2027-06-30',
    note: 'Treasury Laws Amendment (Tax Reform No. 1) Act 2026, Division 119 (s 119-1): "a rate of tax of 30%" on the gains it covers. Recipients of listed payments are exempt; deferred pre-2027 gains are not covered.',
  },
  /**
   * Assumed CPI growth a year, for indexing a cost base from the September 2027 quarter to the sale. The midpoint of
   * the RBA's 2–3% target. An assumption about future CPI, not a published figure.
   */
  cpiAssumption: {
    value: 0.025,
    taxYear: 'from the September 2027 quarter',
    kind: 'assumption',
    sourceUrl: RBA_INFLATION_TARGET_URL,
    readOn: '2026-09-28',
    reviewBy: '2027-06-30',
    note: 'The RBA targets consumer price inflation "of 2–3 per cent per annum"; 2.5% is the midpoint. Indexation uses the All Groups CPI (s 960-280), which is not yet known for any quarter from September 2027.',
  },
} as const satisfies Record<string, SourcedFigure>;

export type AuHomeSpaceFigureKey = keyof typeof AU_HOME_SPACE_FIGURES;
