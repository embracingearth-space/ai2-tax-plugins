/**
 * Nigeria — personal income tax (PAYE), single resident employee.
 * @ai2/tax-plugins — embracingearth.space
 *
 * 2026: Nigeria Tax Act 2025 (commencement 1 January 2026, repeals PITA).
 *   Fourth Schedule bands with a 0% first N800,000; the Consolidated Relief
 *   Allowance is abolished; eligible deductions under s.30(2)(a).
 * 2025: Personal Income Tax Act (as amended 2011). Sixth Schedule bands on
 *   income after the CRA (N200,000 or 1% of gross, whichever is higher, plus
 *   20% of gross, s.33(1)); minimum tax of 1% of gross income (s.37).
 * Both years: the National Housing Fund contribution (2.5% of gross, FMBN) is
 * deductible.
 */
import type { CountryIncomeTaxData, DeductionRule } from '../incomeTaxFactory';

const NTA_2025 = 'https://lirs.gov.ng/assets/docs/Gazette%20-%20NIGERIA%20TAX%20ACT,%202025.pdf';
const PIT_RATES = 'https://lirs.gov.ng/assets/docs/pit-tax-rate.pdf';

const nhf: DeductionRule = { kind: 'share', name: 'National Housing Fund contribution (2.5%)', rate: 0.025 };

export const NG_INCOME_TAX: CountryIncomeTaxData = {
  code: 'NG',
  country: 'Nigeria',
  currency: 'NGN',
  locale: 'en-NG',
  timeZone: 'Africa/Lagos',
  file: 'src/data/incomeTaxWorld/ng.ts',
  note: 'Single resident PAYE employee: from 2026 the Nigeria Tax Act 2025 rates (0% on the first N800,000) on income after the NHF contribution; for 2025 the PITA rates on income after the Consolidated Relief Allowance and NHF, with the 1% minimum tax. Excludes the pension contribution deduction (rate unverified), rent relief, NHIS, life assurance, mortgage interest and the minimum-wage exemption.',
  assumptions: [
    'Single resident individual, employment income under PAYE, no rent relief, life assurance or mortgage interest claimed; tax year = calendar year.',
    'Social contributions (pension, NHF, NHIS) are not included as charges. The National Housing Fund contribution (2.5% of gross) is deducted. The employee pension contribution (commonly 8%) was not confirmed on an official page and is not deducted, so tax may be overstated for an employee in the contributory pension scheme.',
    'The exemption for earners at or below the national minimum wage is not applied (the threshold was not recorded in the research).',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: [
        { upTo: 800000, rate: 0 },
        { upTo: 3000000, rate: 0.15 },
        { upTo: 12000000, rate: 0.18 },
        { upTo: 25000000, rate: 0.21 },
        { upTo: 50000000, rate: 0.23 },
        { upTo: null, rate: 0.25 },
      ],
      deductions: [nhf],
      source: NTA_2025,
      authorityName: 'Nigeria Tax Act 2025, Official Gazette No. 117 (copy hosted by Lagos State Internal Revenue Service)',
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: [
        { upTo: 300000, rate: 0.07 },
        { upTo: 600000, rate: 0.11 },
        { upTo: 1100000, rate: 0.15 },
        { upTo: 1600000, rate: 0.19 },
        { upTo: 3200000, rate: 0.21 },
        { upTo: null, rate: 0.24 },
      ],
      deductions: [
        nhf,
        {
          kind: 'custom',
          name: 'Consolidated Relief Allowance',
          amount: ({ gross }) => (gross > 0 ? Math.max(200000, 0.01 * gross) + 0.2 * gross : 0),
        },
      ],
      levies: [
        {
          kind: 'custom',
          name: 'Minimum tax top-up (1% of gross income, PITA s.37)',
          amount: ({ gross, taxAfterCredits }) => Math.max(0, 0.01 * gross - taxAfterCredits),
        },
      ],
      source: PIT_RATES,
      authorityName: 'Lagos State Internal Revenue Service (PITA Sixth Schedule)',
      citationDate: '2026-10-06',
      verified: true,
      assumptions: ['The CRA is computed on gross employment income; the Finance Act 2020 redefinition of gross income for relief purposes was not read from the Act and is not applied.'],
    },
  ],
};
