/**
 * Kenya — PAYE income tax, single resident employee. @ai2/tax-plugins — embracingearth.space
 *
 * Annual bands: ITA Third Schedule Head B para 1 (unchanged since Finance Act
 * 2023). Personal relief KES 28,800 a year is a non-refundable credit (Head A).
 * Deductible before the bands (ITA s.15(2)(ac),(ae); KRA PAYE page): SHIF
 * 2.75% (min KES 300/month, LN 49/2024 reg. 17), Affordable Housing Levy
 * employee 1.5%, and NSSF employee contributions as pension contributions
 * (2026 only — the 2025 Tier II limit is unverified).
 */
import type { CountryIncomeTaxData, DeductionRule, IncomeTaxYearData } from '../incomeTaxFactory';

const ITA = 'https://new.kenyalaw.org/akn/ke/act/1973/16/eng@2026-07-01';

const bands: IncomeTaxYearData['bands'] = [
  { upTo: 288000, rate: 0.1 },
  { upTo: 388000, rate: 0.25 },
  { upTo: 6000000, rate: 0.3 },
  { upTo: 9600000, rate: 0.325 },
  { upTo: null, rate: 0.35 },
];

const shifAndAhl: DeductionRule[] = [
  { kind: 'share', name: 'SHIF contribution (2.75%, min KES 300/month)', rate: 0.0275, min: 3600 },
  { kind: 'share', name: 'Affordable Housing Levy (employee 1.5%)', rate: 0.015 },
];

const credits = [{ kind: 'fixed', name: 'Personal relief', amount: 28800 }] as const;

export const KE_INCOME_TAX: CountryIncomeTaxData = {
  code: 'KE',
  country: 'Kenya',
  currency: 'KES',
  locale: 'en-KE',
  timeZone: 'Africa/Nairobi',
  file: 'src/data/incomeTaxWorld/ke.ts',
  note: 'Single resident PAYE employee: annual income-tax bands on employment income after the deductible SHIF contribution and Affordable Housing Levy (and, for 2026, NSSF employee contributions), less KES 28,800 personal relief. Excludes insurance relief, mortgage interest, post-retirement medical fund and voluntary pension deductions, and the SHIF/AHL/NSSF payments themselves.',
  assumptions: [
    'Single resident individual, PAYE employment income only, no insurance premiums, mortgage or voluntary pension; tax year = calendar year.',
    'SHIF, the Affordable Housing Levy and NSSF are contributions, not income tax, and are not included as charges. SHIF (2.75%, min KES 300/month) and the employee Affordable Housing Levy (1.5%) are deducted in computing taxable income (ITA s.15(2)(ac),(ae)).',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands,
      deductions: [
        ...shifAndAhl,
        // NSSF Year 4 (from Feb 2026): 6% employee on pensionable pay up to the UEL KES 108,000/month (Tier I + II).
        { kind: 'share', name: 'NSSF employee contribution (Tier I + II)', rate: 0.06, ceiling: 12 * 108000 },
      ],
      credits: [...credits],
      source: ITA,
      authorityName: 'Kenya Law — Income Tax Act (Cap. 470); Kenya Revenue Authority',
      citationDate: '2026-10-06',
      verified: true,
      assumptions: ['NSSF employee contributions (6% up to KES 108,000/month, Year 4 limits) are deducted as pension contributions for the whole year; January 2026 actually used the lower Year 3 limits, so the deduction may be slightly overstated for that month.'],
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands,
      deductions: [...shifAndAhl],
      credits: [...credits],
      source: ITA,
      authorityName: 'Kenya Law — Income Tax Act (Cap. 470); Kenya Revenue Authority',
      citationDate: '2026-10-06',
      verified: true,
      assumptions: ['NSSF employee contributions are NOT deducted for 2025: the Year 3 Upper Earnings Limit was not confirmed on an official page, so taxable income ignores them and tax may be overstated.'],
    },
  ],
};
