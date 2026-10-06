/**
 * United Arab Emirates — no personal income tax on employment income.
 * @ai2/tax-plugins — embracingearth.space
 *
 * Encoded as a confirmed absence: one 0% band. u.ae states the UAE does not
 * levy income tax on individuals; Cabinet Decision 49/2023 art. 2(2)(a) keeps
 * wages out of a natural person's corporate-tax "Business" at any amount.
 */
import type { CountryIncomeTaxData, IncomeTaxYearData } from '../incomeTaxFactory';

const SOURCE = 'https://u.ae/en/information-and-services/finance-and-investment/taxation';

const year = (taxYear: string, effectiveFrom: string): IncomeTaxYearData => ({
  taxYear,
  effectiveFrom,
  bands: [{ upTo: null, rate: 0 }],
  source: SOURCE,
  authorityName: 'UAE Government portal (u.ae)',
  citationDate: '2026-10-06',
  verified: true,
});

export const AE_INCOME_TAX: CountryIncomeTaxData = {
  code: 'AE',
  country: 'United Arab Emirates',
  currency: 'AED',
  locale: 'ar-AE',
  timeZone: 'Asia/Dubai',
  file: 'src/data/incomeTaxWorld/ae.ts',
  note: 'No personal income tax on employment income in the UAE, at federal or emirate level: the tax on wages is nil. Excludes the GPSSA pension contribution (UAE nationals only) and the ILOE unemployment-insurance premium.',
  assumptions: [
    'Resident employee; wages are not a taxable Business for a natural person (Cabinet Decision 49/2023 art. 2(2)(a)).',
    'Social contributions are not included: the GPSSA pension contribution (11% for UAE nationals) and the fixed ILOE unemployment-insurance premium are not income tax.',
  ],
  years: [year('2026', '2026-01-01'), year('2025', '2025-01-01')],
};
