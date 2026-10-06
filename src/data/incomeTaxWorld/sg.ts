/**
 * Singapore — resident individual income tax. @ai2/tax-plugins — embracingearth.space
 *
 * Income earned in calendar year N is assessed in Year of Assessment N+1, so
 * the label is the income year with the YA in brackets: '2026 (YA 2027)'.
 * Chargeable income = employment income − Earned Income Relief (S$1,000 below
 * 55, S$6,000 at 55–59, S$8,000 at 60+, capped at earned income) − CPF Relief
 * (the compulsory employee CPF share, CPF Table 1 for citizens / SPR 3rd year
 * on, on Ordinary Wages up to the monthly OW ceiling). Rates: IRAS table
 * "From YA 2024 onwards". No Personal Income Tax Rebate is enacted for YA 2026
 * or YA 2027 (IRAS lists only YA 2024 and YA 2025).
 */
import type { CountryIncomeTaxData, DeductionRule, IncomeTaxYearData } from '../incomeTaxFactory';

const IRAS_RATES = 'https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/individual-income-tax-rates';

const bands: IncomeTaxYearData['bands'] = [
  { upTo: 20000, rate: 0 },
  { upTo: 30000, rate: 0.02 },
  { upTo: 40000, rate: 0.035 },
  { upTo: 80000, rate: 0.07 },
  { upTo: 120000, rate: 0.115 },
  { upTo: 160000, rate: 0.15 },
  { upTo: 200000, rate: 0.18 },
  { upTo: 240000, rate: 0.19 },
  { upTo: 280000, rate: 0.195 },
  { upTo: 320000, rate: 0.2 },
  { upTo: 500000, rate: 0.22 },
  { upTo: 1000000, rate: 0.23 },
  { upTo: null, rate: 0.24 },
];

const earnedIncomeRelief: DeductionRule = {
  kind: 'custom',
  name: 'Earned Income Relief',
  amount: ({ gross, options }) => {
    const age = options.age ?? 0;
    return Math.min(gross, age >= 60 ? 8000 : age >= 55 ? 6000 : 1000);
  },
};

/** Employee CPF rates by age band (≤55, 55–60, 60–65, 65–70, >70), CPF Table 1. */
function cpfRelief(rates: readonly [number, number, number, number, number], owCeilingMonthly: number): DeductionRule {
  return {
    kind: 'custom',
    name: 'CPF Relief (compulsory employee CPF)',
    amount: ({ gross, options }) => {
      // Full employee share only above S$750/month; below that it is nil or graduated
      // (chargeable income is then inside the 0% band anyway).
      if (gross / 12 <= 750) return 0;
      const age = options.age ?? 0;
      const rate = age <= 55 ? rates[0] : age <= 60 ? rates[1] : age <= 65 ? rates[2] : age <= 70 ? rates[3] : rates[4];
      return rate * Math.min(gross, 12 * owCeilingMonthly);
    },
  };
}

export const SG_INCOME_TAX: CountryIncomeTaxData = {
  code: 'SG',
  country: 'Singapore',
  currency: 'SGD',
  locale: 'en-SG',
  timeZone: 'Asia/Singapore',
  file: 'src/data/incomeTaxWorld/sg.ts',
  note: 'Tax-resident employee who is a Singapore Citizen or SPR (3rd year onwards): resident rates on chargeable income after Earned Income Relief and CPF Relief for compulsory employee CPF on Ordinary Wages. Excludes other reliefs and rebates (Parenthood Tax Rebate, donations, SRS), Additional Wages treatment, and non-resident rates.',
  assumptions: [
    'Tax-resident Singapore Citizen or SPR (3rd year onwards); age below 55 unless an age is given; all pay is Ordinary Wages spread evenly over 12 months.',
    'CPF contributions are not included as a charge; the compulsory employee CPF share (CPF Table 1, up to the monthly Ordinary Wage ceiling) is deducted as CPF Relief. Payroll rounding of CPF is ignored.',
    'Income earned in calendar year N is assessed in Year of Assessment N+1.',
  ],
  optionsSupported: ['age'],
  years: [
    {
      taxYear: '2026 (YA 2027)',
      effectiveFrom: '2026-01-01',
      bands,
      // CPF from 1 Jan 2026: 20/18/12.5/7.5/5%, OW ceiling S$8,000.
      deductions: [earnedIncomeRelief, cpfRelief([0.2, 0.18, 0.125, 0.075, 0.05], 8000)],
      source: IRAS_RATES,
      authorityName: 'Inland Revenue Authority of Singapore (IRAS); CPF Board',
      citationDate: '2026-10-06',
      verified: true,
      assumptions: ['No Personal Income Tax Rebate has been announced for YA 2027; the YA 2024-onwards rate table is used pending Budget 2027.'],
    },
    {
      taxYear: '2025 (YA 2026)',
      effectiveFrom: '2025-01-01',
      bands,
      // CPF from 1 Jan 2025: 20/17/11.5/7.5/5%, OW ceiling S$7,400.
      deductions: [earnedIncomeRelief, cpfRelief([0.2, 0.17, 0.115, 0.075, 0.05], 7400)],
      source: IRAS_RATES,
      authorityName: 'Inland Revenue Authority of Singapore (IRAS); CPF Board',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
