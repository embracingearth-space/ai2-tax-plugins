/**
 * Greece — income tax on wages (KFE arts. 15–16), single employee.
 * @ai2/tax-plugins — embracingearth.space
 *
 * Base = gross − employee e-EFKA contributions (13.37%, KPK 101, capped at
 * 12 × the monthly insurable-earnings ceiling). Scale per art. 15(1)(a);
 * the 2026 scale is from Law 5246/2025. Tax reduction (art. 16) 777 EUR, cut
 * by 20 EUR per 1,000 EUR of taxable income above 12,000 EUR (pro rata).
 */
import type { CountryIncomeTaxData, CreditRule } from '../incomeTaxFactory';

const KFE = 'https://minfin.gov.gr/wp-content/uploads/2026/04/%CE%9A%CE%A9%CE%94%CE%99%CE%9A%CE%9F%CE%A0%CE%9F%CE%99%CE%97%CE%A3%CE%97-%CE%A4%CE%9F%CE%A5-%CE%9A%CE%A9%CE%94%CE%99%CE%9A%CE%91-%CE%A6%CE%9F%CE%A1%CE%9F%CE%9B%CE%9F%CE%93%CE%99%CE%91%CE%A3-%CE%95%CE%99%CE%A3%CE%9F%CE%94%CE%97%CE%9C%CE%91%CE%A4%CE%9F%CE%A3-%CE%9C%CE%95%CE%A7%CE%A1%CE%99-%CE%A4%CE%9F-%CE%9D-5264-2025.pdf';
const AUTHORITY = 'Ministry of National Economy and Finance (minfin.gov.gr)';

// 777 at 12,000; minus 20 per 1,000 → zero at 12,000 + 777 / 0.02 = 50,850.
const reduction: CreditRule = {
  kind: 'schedule',
  name: 'Tax reduction for wage income (art. 16 KFE)',
  base: 'taxable',
  points: [
    [12000, 777],
    [50850, 0],
  ],
};

export const GR_INCOME_TAX: CountryIncomeTaxData = {
  code: 'GR',
  country: 'Greece',
  currency: 'EUR',
  locale: 'el-GR',
  timeZone: 'Europe/Athens',
  file: 'src/data/incomeTaxWorld/gr.ts',
  note: 'Single resident employee aged 31 or over without dependent children: wage-income scale (KFE art. 15) on gross pay less employee e-EFKA contributions, less the art. 16 tax reduction. Excludes the contributions themselves, youth (up to 30) and child-related reduced rates, and other income.',
  assumptions: [
    'Single, no dependent children, aged 31 or over, resident, wage income only, paid evenly over the year.',
    'Employee e-EFKA social contributions (13.37%, capped at 12 × the monthly insurable-earnings ceiling) are deducted from taxable income but not included in the tax shown. Their deductibility follows the standard KFE rule and was not re-confirmed on a fetched official page.',
    'The art. 16 reduction of 20 EUR per 1,000 EUR above 12,000 EUR is applied pro rata.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: [
        { upTo: 10000, rate: 0.09 },
        { upTo: 20000, rate: 0.2 },
        { upTo: 30000, rate: 0.26 },
        { upTo: 40000, rate: 0.34 },
        { upTo: 60000, rate: 0.39 },
        { upTo: null, rate: 0.44 },
      ],
      // Monthly ceiling 7,761.94 EUR × 12 (e-EFKA circular 4/2026).
      deductions: [{ kind: 'share', name: 'Employee e-EFKA contributions (13.37%)', rate: 0.1337, ceiling: 93143.28 }],
      credits: [reduction],
      source: KFE,
      authorityName: AUTHORITY,
      citationDate: '2026-10-06',
      verified: true,
      assumptions: ['The 13.37% employee contribution rate is the one set from 1 January 2025; no 2026 change was found.'],
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: [
        { upTo: 10000, rate: 0.09 },
        { upTo: 20000, rate: 0.22 },
        { upTo: 30000, rate: 0.28 },
        { upTo: 40000, rate: 0.36 },
        { upTo: null, rate: 0.44 },
      ],
      // Monthly ceiling 7,572.62 EUR × 12 (e-EFKA circular 3/2025).
      deductions: [{ kind: 'share', name: 'Employee e-EFKA contributions (13.37%)', rate: 0.1337, ceiling: 90871.44 }],
      credits: [reduction],
      source: KFE,
      authorityName: AUTHORITY,
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
