/**
 * Thailand — personal income tax, single resident employee. @ai2/tax-plugins — embracingearth.space
 *
 * Net income = employment income (s.40(1)) − the 50% expense deduction (max
 * THB 100,000) − the THB 60,000 personal allowance. The first THB 150,000 of
 * net income is exempt (Royal Decree No. 470), shown as the 0% band.
 * Rate table: rd.go.th "from tax year 2560 onwards"; deductions: PND 90
 * instructions for tax year 2568.
 *
 * Social Security Fund contributions are deductible "as actually paid under the
 * social security law" (Revenue Code s.47(1)(ฌ); PND 90 2568 instructions p. 12
 * item 12; PND 94 2569 instructions p. 10 — no baht cap stated). A section 33
 * insured employee pays 5% of wages on a monthly base of THB 1,650–15,000 to
 * 2025 (Ministerial Regulation No. 7, B.E. 2538) and 1,650–17,500 for 2026–2028
 * (Ministerial Regulation on the minimum and maximum wage base for section 33
 * contributions, B.E. 2568, Royal Gazette vol. 142 part 81 ก, 12 Dec 2025, in force
 * 1 Jan 2026): at most 9,000 a year for 2025 and 10,500 for 2026. Read 2026-10-11.
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

const SSO_WAGE_BASE_2026 = 'https://www.sso.go.th/wpr/download/download_by_pool_file/47755';

/** The allowances plus the employee's 5% Social Security Fund contribution on wages up to `monthlyCeiling`. */
const deductions = (monthlyCeiling: number): DeductionRule[] => [
  { kind: 'share', name: 'Employment expense deduction (50%, max THB 100,000)', rate: 0.5, max: 100000 },
  { kind: 'fixed', name: 'Personal allowance', amount: 60000 },
  { kind: 'share', name: `Social Security Fund contribution (5% of wages up to THB ${monthlyCeiling.toLocaleString('en-US')}/month)`, rate: 0.05, ceiling: 12 * monthlyCeiling },
];

export const TH_INCOME_TAX: CountryIncomeTaxData = {
  code: 'TH',
  country: 'Thailand',
  currency: 'THB',
  locale: 'th-TH',
  timeZone: 'Asia/Bangkok',
  file: 'src/data/incomeTaxWorld/th.ts',
  note: 'Single resident employee with employment income only: progressive personal income tax on net income after the 50% (max THB 100,000) expense deduction, the THB 60,000 personal allowance and the employee\'s Social Security Fund contribution (5% of wages, at most THB 9,000 for 2025 and 10,500 for 2026); the first THB 150,000 of net income is exempt. Excludes Social Security Fund contributions as a charge, other allowances (insurance, provident fund, children) and incentive deductions.',
  assumptions: [
    'Single resident individual, no children, employment income (s.40(1)) only; tax year = calendar year.',
    'Only the 50% expense deduction (max THB 100,000), the THB 60,000 personal allowance and the Social Security Fund contribution are deducted.',
    'The employee\'s Social Security Fund contribution (section 33 insured person: 5% of wages on a monthly base of up to THB 15,000 in 2025 and 17,500 from 2026) is deducted as paid, as the Revenue Code allows, but is not included as a charge. Temporary flood-relief cuts to 3% in named provinces (nine southern provinces for December 2025–May 2026) are not applied; an employee there deducts up to THB 1,750 less for 2026 and pays correspondingly more tax.',
  ],
  incomeBasis: {
    default: 'employment',
    selfEmployed: 'differs',
    selfEmployedNote: 'The employment expense deduction (50%, capped) applies here; professional and business income use different deemed-expense rates (30% to 60%), so the tax differs.',
  },
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands,
      deductions: deductions(17500),
      source: RATES,
      authorityName: 'Revenue Department of Thailand (rd.go.th)',
      citationDate: '2026-10-06',
      verified: true,
      assumptions: [
        'Tax year 2569 (B.E.): the standing rate table applies; the 2569 PND 90/91 instructions were not yet published, and no 2568–2569 legislation changes rates or allowances.',
        `The THB 17,500 monthly wage ceiling for Social Security contributions is in force from 1 January 2026 (Royal Gazette, 12 Dec 2025: ${SSO_WAGE_BASE_2026}); the 10,500 maximum deduction is 5% of it, as the Revenue Department allows contributions as paid.`,
      ],
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands,
      deductions: deductions(15000),
      source: PND90_2568,
      authorityName: 'Revenue Department of Thailand (rd.go.th)',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
