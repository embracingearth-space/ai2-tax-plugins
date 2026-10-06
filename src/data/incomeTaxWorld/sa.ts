/**
 * Saudi Arabia — no personal income tax on employment income.
 * @ai2/tax-plugins — embracingearth.space
 *
 * Encoded as a confirmed absence: one 0% band. ZATCA's income-tax scope lists
 * non-Saudi shares in resident companies, non-Saudi residents conducting
 * business and non-residents with a PE or Saudi-source income — not resident
 * employees' wages.
 */
import type { CountryIncomeTaxData, IncomeTaxYearData } from '../incomeTaxFactory';

const SOURCE = 'https://zatca.gov.sa/en/Pages/IncomeTax.aspx';

const year = (taxYear: string, effectiveFrom: string): IncomeTaxYearData => ({
  taxYear,
  effectiveFrom,
  bands: [{ upTo: null, rate: 0 }],
  source: SOURCE,
  authorityName: 'Zakat, Tax and Customs Authority (ZATCA)',
  citationDate: '2026-10-06',
  verified: true,
});

export const SA_INCOME_TAX: CountryIncomeTaxData = {
  code: 'SA',
  country: 'Saudi Arabia',
  currency: 'SAR',
  locale: 'ar-SA',
  timeZone: 'Asia/Riyadh',
  file: 'src/data/incomeTaxWorld/sa.ts',
  note: 'No personal income tax on employment income of resident employees (Saudi or non-Saudi): the tax on wages is nil. Income tax and zakat on business income are out of scope. Excludes GOSI social-insurance contributions.',
  assumptions: [
    'Resident employee with wage income only; no business activity.',
    'Social contributions are not included: GOSI annuities and SANED unemployment insurance (Saudi nationals) are social insurance, not income tax.',
  ],
  years: [year('2026', '2026-01-01'), year('2025', '2025-01-01')],
};
