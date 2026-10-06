/**
 * Thailand — personal income tax, single resident employee. @ai2/tax-plugins — embracingearth.space
 *
 * Net income = employment income (s.40(1)) − the 50% expense deduction (max
 * THB 100,000) − the THB 60,000 personal allowance. The first THB 150,000 of
 * net income is exempt (Royal Decree No. 470), shown as the 0% band.
 * Rate table: rd.go.th "from tax year 2560 onwards"; deductions: PND 90
 * instructions for tax year 2568.
 */
import type { CountryIncomeTaxData, DeductionRule, IncomeTaxYearData } from '../incomeTaxFactory';

const RATES = 'https://www.rd.go.th/59670.html';
const PND90_2568 = 'https://www.rd.go.th/fileadmin/tax_pdf/pit/2568/Ins90_241268.pdf';

const bands: IncomeTaxYearData['bands'] = [
  { upTo: 150000, rate: 0 },
  { upTo: 300000, rate: 0.05 },
  { upTo: 500000, rate: 0.1 },
  { upTo: 750000, rate: 0.15 },
  { upTo: 1000000, rate: 0.2 },
  { upTo: 2000000, rate: 0.25 },
  { upTo: 5000000, rate: 0.3 },
  { upTo: null, rate: 0.35 },
];

const deductions: DeductionRule[] = [
  { kind: 'share', name: 'Employment expense deduction (50%, max THB 100,000)', rate: 0.5, max: 100000 },
  { kind: 'fixed', name: 'Personal allowance', amount: 60000 },
];

export const TH_INCOME_TAX: CountryIncomeTaxData = {
  code: 'TH',
  country: 'Thailand',
  currency: 'THB',
  locale: 'th-TH',
  timeZone: 'Asia/Bangkok',
  file: 'src/data/incomeTaxWorld/th.ts',
  note: 'Single resident employee with employment income only: progressive personal income tax on net income after the 50% (max THB 100,000) expense deduction and the THB 60,000 personal allowance; the first THB 150,000 of net income is exempt. Excludes Social Security Fund contributions (and their deduction), other allowances (insurance, provident fund, children) and incentive deductions.',
  assumptions: [
    'Single resident individual, no children, employment income (s.40(1)) only; tax year = calendar year.',
    'Only the 50% expense deduction (max THB 100,000) and the THB 60,000 personal allowance are applied.',
    'Social Security Fund contributions are not included as a charge. They are deductible as paid, but the employee contribution rate was not confirmed on an official page, so taxable income ignores them and tax may be slightly overstated.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands,
      deductions: [...deductions],
      source: RATES,
      authorityName: 'Revenue Department of Thailand (rd.go.th)',
      citationDate: '2026-10-06',
      verified: true,
      assumptions: ['Tax year 2569 (B.E.): the standing rate table applies; the 2569 PND 90/91 instructions were not yet published, and no 2568–2569 legislation changes rates or allowances.'],
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands,
      deductions: [...deductions],
      source: PND90_2568,
      authorityName: 'Revenue Department of Thailand (rd.go.th)',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
