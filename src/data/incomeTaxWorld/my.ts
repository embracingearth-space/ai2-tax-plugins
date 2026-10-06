/**
 * Malaysia — resident individual income tax, single employee. @ai2/tax-plugins — embracingearth.space
 *
 * Chargeable income = employment income − personal relief RM9,000 − EPF relief
 * (11% employee share, max RM4,000) − SOCSO + EIS relief (0.5% + 0.2% of wages
 * up to RM6,000/month, max RM350). RM400 rebate (ITA s.6A(2)(a)) where
 * chargeable income does not exceed RM35,000.
 * Sources: LHDN 2026 MTD computerised-calculation spec; LHDN rate and relief
 * pages; KWSP and PERKESO contribution pages.
 */
import type { CountryIncomeTaxData, CreditRule, DeductionRule, IncomeTaxYearData } from '../incomeTaxFactory';

const MTD_2026 = 'https://www.hasil.gov.my/wp-content/uploads/spesifikasi-kaedah-pengiraan-berkomputer-pcb-2026.pdf';
const RATES = 'https://www.hasil.gov.my/en/individu/kadar-cukai/';

const bands: IncomeTaxYearData['bands'] = [
  { upTo: 5000, rate: 0 },
  { upTo: 20000, rate: 0.01 },
  { upTo: 35000, rate: 0.03 },
  { upTo: 50000, rate: 0.06 },
  { upTo: 70000, rate: 0.11 },
  { upTo: 100000, rate: 0.19 },
  { upTo: 400000, rate: 0.25 },
  { upTo: 600000, rate: 0.26 },
  { upTo: 2000000, rate: 0.28 },
  { upTo: null, rate: 0.3 },
];

const deductions: DeductionRule[] = [
  { kind: 'fixed', name: 'Personal relief', amount: 9000 },
  // EPF employee 11%, no wage ceiling (kwsp.gov.my); relief restricted to RM4,000.
  { kind: 'share', name: 'EPF contribution relief', rate: 0.11, max: 4000 },
  // SOCSO 0.5% + EIS 0.2% on wages up to RM6,000/month (perkeso.gov.my); relief max RM350.
  { kind: 'share', name: 'SOCSO/EIS contribution relief', rate: 0.007, ceiling: 72000, max: 350 },
];

const credits: CreditRule[] = [
  {
    kind: 'custom',
    name: 'Individual tax rebate (s.6A(2)(a))',
    amount: ({ taxable }) => (taxable <= 35000 ? 400 : 0),
  },
];

export const MY_INCOME_TAX: CountryIncomeTaxData = {
  code: 'MY',
  country: 'Malaysia',
  currency: 'MYR',
  locale: 'ms-MY',
  timeZone: 'Asia/Kuala_Lumpur',
  file: 'src/data/incomeTaxWorld/my.ts',
  note: 'Single tax-resident employee (Malaysian citizen below 60): resident rates on chargeable income after the RM9,000 personal relief and the EPF (max RM4,000) and SOCSO/EIS (max RM350) contribution reliefs, less the RM400 rebate where chargeable income is RM35,000 or less. Excludes other reliefs (life insurance, medical, lifestyle, children), zakat and non-resident rates.',
  assumptions: [
    'Single tax-resident individual, Malaysian citizen below 60, no dependants, employment income only; year of assessment = calendar year.',
    'EPF, SOCSO and EIS contributions are social contributions and are not included as charges; their employee shares (11%, 0.5%, 0.2% to RM6,000/month) are deducted only as the capped tax reliefs (RM4,000 and RM350).',
    'SOCSO is collected by stepped schedule; the nominal 0.5% rate is used for the relief, which reaches its RM350 cap at about RM50,000 of wages.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands,
      deductions: [...deductions],
      credits: [...credits],
      source: MTD_2026,
      authorityName: 'Lembaga Hasil Dalam Negeri Malaysia (LHDN / HASiL)',
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands,
      deductions: [...deductions],
      credits: [...credits],
      source: RATES,
      authorityName: 'Lembaga Hasil Dalam Negeri Malaysia (LHDN / HASiL)',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
