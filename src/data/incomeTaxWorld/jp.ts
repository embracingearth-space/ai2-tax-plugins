/**
 * Japan — national income tax + special reconstruction income tax, single employee.
 * @ai2/tax-plugins — embracingearth.space
 *
 * gross salary
 *   − employment income deduction (給与所得控除, NTA No.1410)
 *   − basic deduction (基礎控除, NTA No.1199), tapered by total income
 *     (合計所得金額 = salary after the employment income deduction)
 *   − social-insurance premiums (社会保険料控除, NTA No.1130: fully deductible)
 *   = taxable income, rounded down to ¥1,000
 * → 5%–45% bands (NTA No.2260) → + 2.1% reconstruction surtax on that tax.
 *
 * The employment income deduction is encoded with the NTA formula; below
 * ¥6.6m the statute uses a lookup table (所得税法別表第五) that rounds slightly
 * differently, which the research did not capture.
 *
 * Inhabitant tax (住民税) is EXCLUDED: it uses its own deductions, and the
 * FY2027 inhabitant-tax basic deduction (which applies to 2026 income) was not
 * confirmed from an official source.
 */
import type { CountryIncomeTaxData, DeductionRule, IncomeTaxYearData } from '../incomeTaxFactory';

const BANDS = 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm';

const bands = () => [
  { upTo: 1950000, rate: 0.05 },
  { upTo: 3300000, rate: 0.1 },
  { upTo: 6950000, rate: 0.2 },
  { upTo: 9000000, rate: 0.23 },
  { upTo: 18000000, rate: 0.33 },
  { upTo: 40000000, rate: 0.4 },
  { upTo: null, rate: 0.45 },
];

/** Basic deduction: tiers of [total income up to (inclusive), amount]; null = no upper limit. */
const basicDeduction = (tiers: readonly (readonly [number | null, number])[]): DeductionRule => ({
  kind: 'custom',
  name: 'Basic deduction (基礎控除)',
  // deductedSoFar is the employment income deduction alone (this rule runs second).
  amount: ({ gross, deductedSoFar }) => {
    const totalIncome = Math.max(0, gross - deductedSoFar);
    for (const [upTo, amount] of tiers) if (upTo === null || totalIncome <= upTo) return amount;
    return 0;
  },
});

/** Social-insurance premiums, employee share. Monthly ceilings × 12 as an annual approximation. */
const socialInsurance = (health: number, employment: number): DeductionRule[] => [
  // Kyokai Kenpo Tokyo health insurance; top standard monthly remuneration ¥1,390,000.
  { kind: 'share', name: 'Health insurance premiums (健康保険)', rate: health, ceiling: 1390000 * 12 },
  // Employees' pension 18.3% / 2; top standard monthly remuneration ¥650,000.
  { kind: 'share', name: "Employees' pension premiums (厚生年金)", rate: 0.0915, ceiling: 650000 * 12 },
  { kind: 'share', name: 'Employment insurance premiums (雇用保険)', rate: employment },
];

/** Taxable income is rounded down to ¥1,000: deduct the remainder. */
const roundDownTo1000: DeductionRule = {
  kind: 'custom',
  name: 'Rounding of taxable income down to ¥1,000',
  amount: ({ gross, deductedSoFar, q }) => {
    const left = gross - deductedSoFar;
    return left > 0 ? left - q.floor(left / 1000) * 1000 : 0;
  },
};

const common = {
  levies: [{ kind: 'shareOfTax', name: 'Special reconstruction income tax (復興特別所得税)', rate: 0.021 }],
  source: BANDS,
  authorityName: 'National Tax Agency (国税庁)',
  citationDate: '2026-10-06',
  verified: true,
} as const;

const y2026: IncomeTaxYearData = {
  taxYear: '2026',
  effectiveFrom: '2026-01-01',
  bands: bands(),
  deductions: [
    // 2026–27 (Reiwa 8 reform, in force 2026-12-01, applies to all of 2026): min ¥740,000 to ¥2.2m;
    // 30% + 80,000 to 3.6m; 20% + 440,000 to 6.6m; 10% + 1,100,000 to 8.5m; cap ¥1,950,000.
    { kind: 'schedule', name: 'Employment income deduction (給与所得控除)', points: [[2200000, 740000], [3600000, 1160000], [6600000, 1760000], [8500000, 1950000]] },
    basicDeduction([[4890000, 1040000], [6550000, 670000], [23500000, 620000], [24000000, 480000], [24500000, 320000], [25000000, 160000], [null, 0]]),
    // FY2026 (from March 2026) Tokyo health 9.85% / 2; employment insurance FY2026 5/1,000.
    ...socialInsurance(0.04925, 0.005),
    roundDownTo1000,
  ],
  ...common,
  levies: [...common.levies],
};

const y2025: IncomeTaxYearData = {
  taxYear: '2025',
  effectiveFrom: '2025-01-01',
  bands: bands(),
  deductions: [
    // 2025: min ¥650,000 to ¥1.9m; then as 2026.
    { kind: 'schedule', name: 'Employment income deduction (給与所得控除)', points: [[1900000, 650000], [3600000, 1160000], [6600000, 1760000], [8500000, 1950000]] },
    basicDeduction([[1320000, 950000], [3360000, 880000], [4890000, 680000], [6550000, 630000], [23500000, 580000], [24000000, 480000], [24500000, 320000], [25000000, 160000], [null, 0]]),
    // FY2025 Tokyo health 9.91% / 2; employment insurance FY2025 5.5/1,000.
    ...socialInsurance(0.04955, 0.0055),
    roundDownTo1000,
  ],
  ...common,
  levies: [...common.levies],
};

export const JP_INCOME_TAX: CountryIncomeTaxData = {
  code: 'JP',
  country: 'Japan',
  currency: 'JPY',
  locale: 'ja-JP',
  timeZone: 'Asia/Tokyo',
  file: 'src/data/incomeTaxWorld/jp.ts',
  note: 'Single employee: national income tax at 5%–45% on salary after the employment income deduction, the basic deduction and the employee social-insurance premiums, plus the 2.1% special reconstruction income tax. EXCLUDES the inhabitant (resident) tax of about 10% plus a per-capita levy, so it is not the full tax on salary. Also excludes other deductions (spouse, dependants, life insurance, iDeCo) and the 2027 change to the surtax.',
  assumptions: [
    'Single, no dependants, resident, under 40 (no long-term care premium), employee of a Kyokai Kenpo Tokyo-branch workplace in a general business.',
    'Social contributions are not charged here, but the employee health insurance, employees\' pension and employment insurance premiums are DEDUCTED from taxable income as the law allows, using the fiscal-year rates for that calendar year and monthly ceilings × 12 (an approximation: real premiums use standard monthly remuneration, bonus caps and mid-year rate changes). The child-rearing support levy is not deducted (its deductibility was not confirmed).',
    'Inhabitant tax (住民税, about 10% of a separately computed base, charged the following year) is NOT included.',
    'The employment income deduction uses the NTA formula; the statutory table used below ¥6.6m rounds slightly differently.',
  ],
  years: [y2026, y2025],
};
