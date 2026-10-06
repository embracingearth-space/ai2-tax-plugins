/**
 * Philippines — tax on compensation income (TRAIN schedule), single employee.
 * @ai2/tax-plugins — embracingearth.space
 *
 * RR 11-2018 annual table "for taxable year 2023 and onwards". No personal
 * exemption since TRAIN; the first PHP 250,000 is the 0% band. The employee SSS
 * share (5% of the Monthly Salary Credit, MSC PHP 5,000–35,000, SSS Circular
 * 2024-006) is excluded from gross income (NIRC s.32(B)(7)(f)).
 */
import type { CountryIncomeTaxData, DeductionRule, IncomeTaxYearData } from '../incomeTaxFactory';

const RR_11_2018 = 'https://bir-cdn.bir.gov.ph/local/pdf/RR%20No.%2011-2018.pdf';

const bands: IncomeTaxYearData['bands'] = [
  { upTo: 250000, rate: 0 },
  { upTo: 400000, rate: 0.15 },
  { upTo: 800000, rate: 0.2 },
  { upTo: 2000000, rate: 0.25 },
  { upTo: 8000000, rate: 0.3 },
  { upTo: null, rate: 0.35 },
];

const deductions: DeductionRule[] = [
  {
    kind: 'custom',
    name: 'SSS employee contribution (excluded from gross income)',
    // 5% of monthly pay clamped to the MSC range 5,000–35,000 (stepped MSC brackets approximated linearly).
    amount: ({ gross }) => (gross > 0 ? 12 * 0.05 * Math.min(35000, Math.max(5000, gross / 12)) : 0),
  },
];

export const PH_INCOME_TAX: CountryIncomeTaxData = {
  code: 'PH',
  country: 'Philippines',
  currency: 'PHP',
  locale: 'en-PH',
  timeZone: 'Asia/Manila',
  file: 'src/data/incomeTaxWorld/ph.ts',
  note: 'Resident citizen employee with compensation income only (not a minimum wage earner): TRAIN graduated rates on taxable compensation after excluding the employee SSS contribution. Excludes the PHP 90,000 13th-month/other-benefits exclusion (gross is assumed to contain no such benefits), de minimis benefits, and the PhilHealth and Pag-IBIG exclusions (employee shares not confirmed).',
  assumptions: [
    'Single resident citizen, purely compensation income, not a minimum wage earner; tax year = calendar year.',
    'Gross is assumed to be regular compensation only — no 13th-month pay or other benefits (those are excluded up to PHP 90,000 a year and would lower the tax).',
    'Social contributions (SSS, PhilHealth, Pag-IBIG) are not included as charges. The employee SSS share (5% of the Monthly Salary Credit, PHP 5,000–35,000 a month) is excluded from taxable income; the PhilHealth and Pag-IBIG employee shares were not confirmed on an official page and are not excluded, so tax may be slightly overstated.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands,
      deductions: [...deductions],
      source: RR_11_2018,
      authorityName: 'Bureau of Internal Revenue (BIR)',
      citationDate: '2026-10-06',
      verified: true,
      assumptions: ['2026 uses the RR 11-2018 schedule for "taxable year 2023 and onwards" and the SSS schedule effective January 2025, which the SSS page still showed on 2026-10-06.'],
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands,
      deductions: [...deductions],
      source: RR_11_2018,
      authorityName: 'Bureau of Internal Revenue (BIR)',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
