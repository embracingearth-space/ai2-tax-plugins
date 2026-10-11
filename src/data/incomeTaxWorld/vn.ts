/**
 * Vietnam — PIT on wage income, single resident employee. @ai2/tax-plugins — embracingearth.space
 *
 * 2026: Law 109/2025/QH15 — Art. 9 five-bracket schedule, Art. 10(1)(a) family deduction
 * VND 15.5m/month (186m/year). Effective 1 Jul 2026 but applies to wage income from tax
 * period 2026 (Art. 29(2)).
 * 2025: Law 04/2007 as amended (VBHN 103/VBHN-VPQH) Art. 22 seven-bracket schedule; family
 * deduction 11m/month (132m/year) under Resolution 954/2020/UBTVQH14 — not confirmed from
 * the resolution text.
 *
 * Both years deduct the employee's compulsory insurance contributions (Law 109/2025 Art. 8(2);
 * Law 04/2007 Art. 21(1) for social and health insurance, Circular 111/2013/TT-BTC Art. 9(2)(a)
 * for unemployment insurance). Read 2026-10-11 on the official gazette:
 *   - social insurance 8% (Law 58/2014 Art. 85(1); Law 41/2024 Art. 33(1)(a) from 1 Jul 2025) and
 *     health insurance 1.5% (one third of 4.5%, Decree 188/2025 Art. 6(1)(a)), on salary up to
 *     20 × the base salary / reference level: VND 46.8m a month (base 2.34m, Decree 73/2024)
 *     until June 2026, 50.6m from 1 Jul 2026 (base 2.53m, Decree 161/2026);
 *   - unemployment insurance 1% (Law 38/2013 Art. 57(1)(a); Decree 374/2025 Art. 4(1) under the
 *     2025 Employment Law), on salary up to 20 × the regional minimum wage — Region I: 4.96m
 *     (Decree 74/2024) → 99.2m for 2025; 5.31m (Decree 293/2025) → 106.2m for 2026.
 */
import type { CountryIncomeTaxData, DeductionRule } from '../incomeTaxFactory';

/** Employee SI + HI (9.5%) and UI (1%), each up to its own annual ceiling (the sum of the monthly ceilings). */
const insurance = (siHiCeiling: number, uiCeiling: number): DeductionRule[] => [
  { kind: 'share', name: 'Social and health insurance (8% + 1.5%)', rate: 0.095, ceiling: siHiCeiling },
  { kind: 'share', name: 'Unemployment insurance (1%)', rate: 0.01, ceiling: uiCeiling },
];

export const VN_INCOME_TAX: CountryIncomeTaxData = {
  code: 'VN',
  country: 'Vietnam',
  currency: 'VND',
  locale: 'vi-VN',
  timeZone: 'Asia/Ho_Chi_Minh',
  file: 'src/data/incomeTaxWorld/vn.ts',
  note: 'Single tax-resident employee with wage income only: progressive PIT on annual income after the taxpayer family-circumstance deduction. 2026 uses Law 109/2025/QH15 (five brackets, VND 186m deduction); 2025 uses the seven-bracket schedule of Law 04/2007 as amended with the VND 132m deduction. Both years also deduct the employee\'s compulsory social (8%), health (1.5%) and unemployment (1%) insurance contributions up to their salary ceilings. Excludes voluntary pension/insurance and charitable deductions, and the contributions themselves as charges. Vietnam has no local personal income tax.',
  assumptions: [
    'Single tax-resident individual, no dependants, wage/salary income only; tax period = calendar year.',
    'The employee\'s compulsory insurance contributions are deducted from taxable income as the law allows, but are not included as a charge: social insurance 8% and health insurance 1.5% on salary up to VND 46.8m a month (50.6m from July 2026), unemployment insurance 1% up to 20 times the Region I minimum wage (99.2m a month in 2025, 106.2m in 2026). Region I (urban Hanoi and Ho Chi Minh City) is the named default; the lowest (Region IV) ceiling is 69m a month in 2025 and 74m in 2026, so the region changes the result only above VND 828m a year in 2025 and 888m in 2026.',
    'Contributions are charged on the contractual salary and regular allowances, taken here as all of gross pay. Bonuses and other irregular pay carry no contributions, so for pay that includes them the deduction is overstated and the tax understated.',
  ],
  incomeBasis: {
    default: 'employment',
    selfEmployed: 'differs',
    selfEmployedNote: 'Household businesses are taxed on revenue rather than income, with a revenue exemption threshold, so the figure does not apply to them.',
  },
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: [
        { upTo: 120000000, rate: 0.05 },
        { upTo: 360000000, rate: 0.1 },
        { upTo: 720000000, rate: 0.2 },
        { upTo: 1200000000, rate: 0.3 },
        { upTo: null, rate: 0.35 },
      ],
      deductions: [
        { kind: 'fixed', name: 'Family-circumstance deduction (taxpayer)', amount: 186000000 },
        ...insurance(6 * 46800000 + 6 * 50600000, 12 * 106200000),
      ],
      source: 'https://congbao.chinhphu.vn/van-ban/luat-so-109-2025-qh15-468671.htm',
      authorityName: 'Official Gazette of Vietnam (congbao.chinhphu.vn) — Law 109/2025/QH15',
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: [
        { upTo: 60000000, rate: 0.05 },
        { upTo: 120000000, rate: 0.1 },
        { upTo: 216000000, rate: 0.15 },
        { upTo: 384000000, rate: 0.2 },
        { upTo: 624000000, rate: 0.25 },
        { upTo: 960000000, rate: 0.3 },
        { upTo: null, rate: 0.35 },
      ],
      deductions: [
        { kind: 'fixed', name: 'Family-circumstance deduction (taxpayer, Resolution 954/2020)', amount: 132000000 },
        ...insurance(12 * 46800000, 12 * 99200000),
      ],
      source: 'https://congbao.chinhphu.vn/van-ban/van-ban-hop-nhat-so-103-vbhn-vpqh-46034.htm',
      authorityName: 'Official Gazette of Vietnam (congbao.chinhphu.vn) — consolidated PIT Law 103/VBHN-VPQH',
      citationDate: '2026-10-06',
      verified: false,
      verificationNote: 'The bands are from the official gazette, but the VND 132m family deduction (Resolution 954/2020) was confirmed only by the Government e-newspaper, not the resolution text.',
    },
  ],
};
