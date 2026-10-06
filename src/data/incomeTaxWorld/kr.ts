/**
 * South Korea — income tax on earned income + local income tax, single employee.
 * @ai2/tax-plugins — embracingearth.space
 *
 * gross salary (총급여액)
 *   − earned income deduction (근로소득공제, Income Tax Act art. 47)
 *   − basic deduction ₩1,500,000 (art. 50)
 *   − National Pension contributions (art. 51-3)
 *   − NHI, long-term care and employment insurance premiums (art. 52(1))
 *   = tax base → 6%–45% (art. 55)
 *   − earned income tax credit (art. 59)
 *   + local income tax = 1/10 of the national rates on the same base (Local Tax
 *     Act art. 92), withheld as 10% of the income tax (art. 103-13).
 *
 * Claiming the art. 52 premium deduction rules out the ₩130,000 standard tax
 * credit (art. 59-4(9)), so that credit is not applied.
 */
import type { CountryIncomeTaxData, CreditRule, DeductionRule, IncomeTaxYearData } from '../incomeTaxFactory';

const bands = () => [
  { upTo: 14000000, rate: 0.06 },
  { upTo: 50000000, rate: 0.15 },
  { upTo: 88000000, rate: 0.24 },
  { upTo: 150000000, rate: 0.35 },
  { upTo: 300000000, rate: 0.38 },
  { upTo: 500000000, rate: 0.4 },
  { upTo: 1000000000, rate: 0.42 },
  { upTo: null, rate: 0.45 },
];

// Art. 47: 70% to 5m; 3.5m + 40% to 15m; 7.5m + 15% to 45m; 12m + 5% to 100m; 14.75m + 2% above; cap 20m
// (reached at 100m + 5.25m / 2% = 362.5m).
const earnedIncomeDeduction: DeductionRule = {
  kind: 'schedule',
  name: 'Earned income deduction (근로소득공제)',
  points: [[0, 0], [5000000, 3500000], [15000000, 7500000], [45000000, 12000000], [100000000, 14750000], [362500000, 20000000]],
};

/** Art. 59: 55% of tax to ₩1.3m, then 715,000 + 30%; capped by total salary. */
const earnedIncomeTaxCredit: CreditRule = {
  kind: 'custom',
  name: 'Earned income tax credit (근로소득세액공제)',
  amount: ({ gross, incomeTax }) => {
    const credit = incomeTax <= 1300000 ? incomeTax * 0.55 : 715000 + (incomeTax - 1300000) * 0.3;
    let cap: number;
    if (gross <= 33000000) cap = 740000;
    else if (gross <= 70000000) cap = Math.max(660000, 740000 - (gross - 33000000) * 0.008);
    else if (gross <= 120000000) cap = Math.max(500000, 660000 - (gross - 70000000) / 2);
    else cap = Math.max(200000, 500000 - (gross - 120000000) / 2);
    return Math.min(credit, cap);
  },
};

/** Employee premiums deducted from income. `pensionBaseCap` is the annual sum of the monthly caps. */
const premiums = (p: { pension: number; pensionBaseCap: number; nhi: number; nhiPremiumCap: number; ltc: number }): DeductionRule[] => [
  { kind: 'share', name: 'National Pension contributions (국민연금)', rate: p.pension, ceiling: p.pensionBaseCap },
  // The NHI cap is on the employee premium itself (monthly × 12).
  { kind: 'share', name: 'National Health Insurance premiums (건강보험)', rate: p.nhi, max: p.nhiPremiumCap },
  // LTC premium = NHI premium × (LTC rate / NHI rate), so it follows the NHI cap proportionally.
  { kind: 'share', name: 'Long-term care insurance premiums (장기요양보험)', rate: p.ltc, max: (p.nhiPremiumCap * p.ltc) / p.nhi },
  // Unemployment-benefit premium 1.8%, employee half.
  { kind: 'share', name: 'Employment insurance premiums (고용보험)', rate: 0.009 },
];

const common = {
  credits: [earnedIncomeTaxCredit],
  levies: [{ kind: 'shareOfTax', name: 'Local income tax (지방소득세)', rate: 0.1 }],
  citationDate: '2026-10-06',
  verified: true,
} as const;

const y2026: IncomeTaxYearData = {
  taxYear: '2026',
  effectiveFrom: '2026-01-01',
  bands: bands(),
  deductions: [
    earnedIncomeDeduction,
    { kind: 'fixed', name: 'Basic deduction (기본공제)', amount: 1500000 },
    // Pension 4.75% (2025 reform); monthly base cap 6,370,000 Jan–Jun, 6,590,000 Jul–Dec.
    // NHI 7.19% / 2 = 3.595%, employee premium cap 4,591,740/month; LTC 0.9448% / 2.
    ...premiums({ pension: 0.0475, pensionBaseCap: 6370000 * 6 + 6590000 * 6, nhi: 0.03595, nhiPremiumCap: 4591740 * 12, ltc: 0.004724 }),
  ],
  ...common,
  credits: [...common.credits],
  levies: [...common.levies],
  source: 'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=280405&efYd=20260701',
  authorityName: 'Korea Ministry of Government Legislation — Income Tax Act (소득세법)',
};

const y2025: IncomeTaxYearData = {
  taxYear: '2025',
  effectiveFrom: '2025-01-01',
  bands: bands(),
  deductions: [
    earnedIncomeDeduction,
    { kind: 'fixed', name: 'Basic deduction (기본공제)', amount: 1500000 },
    // Pension 4.5%; monthly base cap 6,170,000 Jan–Jun, 6,370,000 Jul–Dec.
    // NHI 7.09% / 2 = 3.545%, employee premium cap 4,504,170/month; LTC 0.9182% / 2.
    ...premiums({ pension: 0.045, pensionBaseCap: 6170000 * 6 + 6370000 * 6, nhi: 0.03545, nhiPremiumCap: 4504170 * 12, ltc: 0.004591 }),
  ],
  ...common,
  credits: [...common.credits],
  levies: [...common.levies],
  source: 'https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2228&cntntsId=7667',
  authorityName: 'National Tax Service (국세청)',
};

export const KR_INCOME_TAX: CountryIncomeTaxData = {
  code: 'KR',
  country: 'South Korea',
  currency: 'KRW',
  locale: 'ko-KR',
  timeZone: 'Asia/Seoul',
  file: 'src/data/incomeTaxWorld/kr.ts',
  note: 'Single resident employee: income tax at 6%–45% on salary after the earned income deduction, the ₩1.5m basic deduction and the employee social-insurance premiums, less the earned income tax credit, plus local income tax at 10% of the income tax. Excludes other special deductions and credits (insurance, medical, education, donations, rent, card spending), non-taxable allowances and local variation of the local income tax rate.',
  assumptions: [
    'Single, no dependants, resident employee; all salary taxable (non-taxable items such as meal allowance ignored).',
    'Social contributions are not charged here, but the employee National Pension, National Health Insurance, long-term care and employment insurance contributions are DEDUCTED from taxable income as the law allows (annual approximation of monthly caps; the pension minimum base is ignored).',
    'Because the insurance premium deduction is claimed, the ₩130,000 standard tax credit does not apply.',
    'Local income tax at the standard 10% of national income tax (no local ±50% variation).',
  ],
  years: [y2026, y2025],
};
