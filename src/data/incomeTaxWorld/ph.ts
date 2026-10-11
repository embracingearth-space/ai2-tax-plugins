/**
 * Philippines — tax on compensation income (TRAIN schedule), single employee.
 * @ai2/tax-plugins — embracingearth.space
 *
 * RR 11-2018 annual table "for taxable year 2023 and onwards". No personal
 * exemption since TRAIN; the first PHP 250,000 is the 0% band. The employee's
 * mandatory SSS, PhilHealth and Pag-IBIG shares are excluded from gross income
 * (NIRC s.32(B)(7)(f); RR 2-98 s.2.78.1(B)(12) as amended by RR 11-2018 s.6):
 *   - SSS 5% of the Monthly Salary Credit, MSC PHP 5,000–35,000 (SSS Circular 2024-006, from January 2025);
 *   - PhilHealth 2.5%, half of the 5% premium on monthly basic salary floored at PHP 10,000 and
 *     capped at 100,000 (PhilHealth Circular 2020-0005 Rev. 1; Advisory 2025-0002; Advisory
 *     2026-0042 keeps 5% for 2026);
 *   - Pag-IBIG 2% of monthly fund salary up to PHP 10,000 (1% at 1,500 or less) — HDMF Circular
 *     No. 460, from February 2024, as quoted in DBM Circular Letter 2024-2 (the Fund's own site
 *     is behind a CAPTCHA). Voluntary contributions above that are taxable (RMC 27-2011).
 * Read 2026-10-11.
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
  {
    kind: 'custom',
    name: 'PhilHealth employee contribution (excluded from gross income)',
    // Half of 5% of monthly basic salary clamped to 10,000–100,000.
    amount: ({ gross }) => (gross > 0 ? 12 * 0.025 * Math.min(100000, Math.max(10000, gross / 12)) : 0),
  },
  {
    kind: 'custom',
    name: 'Pag-IBIG employee contribution (excluded from gross income)',
    // 2% of monthly fund salary up to 10,000 (1% when it is 1,500 or less): at most 200 a month.
    amount: ({ gross }) => {
      const monthly = gross / 12;
      return gross > 0 ? 12 * (monthly <= 1500 ? 0.01 * monthly : 0.02 * Math.min(10000, monthly)) : 0;
    },
  },
];

export const PH_INCOME_TAX: CountryIncomeTaxData = {
  code: 'PH',
  country: 'Philippines',
  currency: 'PHP',
  locale: 'en-PH',
  timeZone: 'Asia/Manila',
  file: 'src/data/incomeTaxWorld/ph.ts',
  note: 'Resident citizen employee with compensation income only (not a minimum wage earner): TRAIN graduated rates on taxable compensation after excluding the employee\'s mandatory SSS, PhilHealth and Pag-IBIG contributions. Excludes the PHP 90,000 13th-month/other-benefits exclusion (gross is assumed to contain no such benefits), de minimis benefits, and the contributions themselves as charges.',
  assumptions: [
    'Single resident citizen, purely compensation income, not a minimum wage earner; tax year = calendar year.',
    'Gross is assumed to be regular compensation only — no 13th-month pay or other benefits (those are excluded up to PHP 90,000 a year and would lower the tax).',
    'Social contributions (SSS, PhilHealth, Pag-IBIG) are not included as charges, but the employee\'s mandatory shares are excluded from taxable income: SSS 5% of the Monthly Salary Credit (PHP 5,000–35,000 a month, stepped brackets approximated linearly), PhilHealth 2.5% of monthly basic salary (PHP 10,000–100,000; all of gross is treated as basic salary) and Pag-IBIG 2% of up to PHP 10,000 a month (at most PHP 2,400 a year). Voluntary Pag-IBIG contributions above that are taxable and are not excluded.',
  ],
  incomeBasis: {
    default: 'employment',
    selfEmployed: 'differs',
    selfEmployedNote: 'A self-employed person can choose an 8% tax on gross receipts above ₱250,000, or the graduated rates with a 40% optional standard deduction plus percentage tax.',
  },
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
      assumptions: ['2026 uses the RR 11-2018 schedule for "taxable year 2023 and onwards", the SSS schedule effective January 2025, which the SSS page still showed on 2026-10-06, the 5% PhilHealth premium PhilHealth Advisory 2026-0042 confirms, and the Pag-IBIG rates of HDMF Circular No. 460.'],
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
