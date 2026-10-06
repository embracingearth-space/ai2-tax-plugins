/**
 * Jamaica — PAYE income tax, single resident employee under 55.
 * @ai2/tax-plugins — embracingearth.space
 *
 * Statutory income = gross emoluments − employee NIS (3% of emoluments up to
 * J$5,000,000). Tax: 0% up to the EFFECTIVE annual threshold, 25% to
 * J$6,000,000, 30% above. The threshold rises every 1 April, so the effective
 * annual threshold is a 3/12 + 9/12 weighting (TAJ Technical Advisory 042025).
 *
 * Every figure was read on jamaicatax.gov.jm on 2026-10-06.
 */
import type { CountryIncomeTaxData, DeductionRule } from '../incomeTaxFactory';

const ADVISORY = 'https://www.jamaicatax.gov.jm/documents/10194/52231399/Technical_Advisory_Threshold+_042025.pdf/c4adbf81-8ddd-9a1b-9e8b-8bdc431162df';

const nis: DeductionRule = { kind: 'share', name: 'Employee NIS contribution (deducted to statutory income)', rate: 0.03, ceiling: 5000000 };

export const JM_INCOME_TAX: CountryIncomeTaxData = {
  code: 'JM',
  country: 'Jamaica',
  currency: 'JMD',
  locale: 'en-JM',
  timeZone: 'America/Jamaica',
  file: 'src/data/incomeTaxWorld/jm.ts',
  note: 'Single resident employee under 55: income tax at 0% up to the effective annual threshold, 25% to J$6,000,000 and 30% above, on statutory income after employee NIS. Excludes NIS, NHT and Education Tax as charges, approved pension contributions, and age/pension exemptions.',
  assumptions: [
    'Resident employee under 55, no pension income, calendar year of assessment, no approved pension or retirement contributions.',
    'Employee NIS (3% of emoluments up to J$5,000,000) is deducted to reach statutory income as the law requires, but NIS, NHT (2%) and Education Tax (2.25%) are social or payroll contributions and are not included as charges.',
    'The 0% band is the effective annual threshold (weighted because the threshold changes on 1 April); it is not deducted again.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      // 1,799,376 × 3/12 + 1,902,360 × 9/12 = 449,844 + 1,426,770 = 1,876,614.
      bands: [
        { upTo: 1876614, rate: 0 },
        { upTo: 6000000, rate: 0.25 },
        { upTo: null, rate: 0.3 },
      ],
      deductions: [nis],
      source: ADVISORY,
      authorityName: 'Tax Administration Jamaica',
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      // 1,700,088 × 3/12 + 1,799,376 × 9/12 = 425,022 + 1,349,532 = 1,774,554.
      bands: [
        { upTo: 1774554, rate: 0 },
        { upTo: 6000000, rate: 0.25 },
        { upTo: null, rate: 0.3 },
      ],
      deductions: [nis],
      source: ADVISORY,
      authorityName: 'Tax Administration Jamaica',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
