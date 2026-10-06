/**
 * China — IIT on comprehensive income (wages), single resident employee. @ai2/tax-plugins — embracingearth.space
 *
 * Bands: STA Annex 1 "Individual Income Tax Rates (Applicable to Comprehensive Income)" — the
 * statutory seven-bracket 3–45% schedule in force since 2019.
 * Basic deduction CNY 60,000/year: STA Order No. 57 (annual reconciliation measures, effective 26 Feb 2025).
 */
import type { CountryIncomeTaxData } from '../incomeTaxFactory';

const BANDS = [
  { upTo: 36000, rate: 0.03 },
  { upTo: 144000, rate: 0.1 },
  { upTo: 300000, rate: 0.2 },
  { upTo: 420000, rate: 0.25 },
  { upTo: 660000, rate: 0.3 },
  { upTo: 960000, rate: 0.35 },
  { upTo: null, rate: 0.45 },
];

export const CN_INCOME_TAX: CountryIncomeTaxData = {
  code: 'CN',
  country: 'China',
  currency: 'CNY',
  locale: 'zh-CN',
  timeZone: 'Asia/Shanghai',
  file: 'src/data/incomeTaxWorld/cn.ts',
  note: 'Single tax-resident employee with wage income only: annual IIT on comprehensive income after the CNY 60,000 basic deduction, using the seven-bracket 3–45% schedule. Excludes the deduction of employee social insurance and housing provident fund contributions, itemized special additional deductions, the separate taxation option for an annual one-off bonus, and those contributions as charges. China has no provincial or municipal income tax.',
  assumptions: [
    'Single tax-resident individual, no children or other itemized special additional deductions, wage income only; tax year = calendar year. Monthly cumulative withholding is reconciled to this annual figure.',
    'Employee social insurance (pension, medical, unemployment) and housing provident fund contributions are not included as a charge. They are deductible from taxable income, but their employee rates were not confirmed from an official page, so taxable income ignores them and tax may be overstated.',
    'Contribution bases are set by city; the named default locality is Beijing (monthly base ceiling CNY 36,348 from July 2026, CNY 35,811 for the 2025 contribution year). These ceilings are not applied because the rates are unconfirmed.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: BANDS,
      deductions: [{ kind: 'fixed', name: 'Basic deduction', amount: 60000 }],
      source: 'https://www.chinatax.gov.cn/eng/c102962/c102967/c102997/c103004/c5245812/content.html',
      authorityName: 'State Taxation Administration (chinatax.gov.cn)',
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: BANDS,
      deductions: [{ kind: 'fixed', name: 'Basic deduction', amount: 60000 }],
      source: 'https://www.chinatax.gov.cn/eng/c102962/c102967/c102997/c103004/c5245812/content.html',
      authorityName: 'State Taxation Administration (chinatax.gov.cn)',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
