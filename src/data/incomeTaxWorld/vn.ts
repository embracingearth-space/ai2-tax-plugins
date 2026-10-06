/**
 * Vietnam — PIT on wage income, single resident employee. @ai2/tax-plugins — embracingearth.space
 *
 * 2026: Law 109/2025/QH15 — Art. 9 five-bracket schedule, Art. 10(1)(a) family deduction
 * VND 15.5m/month (186m/year). Effective 1 Jul 2026 but applies to wage income from tax
 * period 2026 (Art. 29(2)).
 * 2025: Law 04/2007 as amended (VBHN 103/VBHN-VPQH) Art. 22 seven-bracket schedule; family
 * deduction 11m/month (132m/year) under Resolution 954/2020/UBTVQH14 — not confirmed from
 * the resolution text.
 */
import type { CountryIncomeTaxData } from '../incomeTaxFactory';

export const VN_INCOME_TAX: CountryIncomeTaxData = {
  code: 'VN',
  country: 'Vietnam',
  currency: 'VND',
  locale: 'vi-VN',
  timeZone: 'Asia/Ho_Chi_Minh',
  file: 'src/data/incomeTaxWorld/vn.ts',
  note: 'Single tax-resident employee with wage income only: progressive PIT on annual income after the taxpayer family-circumstance deduction. 2026 uses Law 109/2025/QH15 (five brackets, VND 186m deduction); 2025 uses the seven-bracket schedule of Law 04/2007 as amended with the VND 132m deduction. Excludes the deduction of compulsory social, health and unemployment insurance contributions, voluntary pension/insurance and charitable deductions, and those contributions as charges. Vietnam has no local personal income tax.',
  assumptions: [
    'Single tax-resident individual, no dependants, wage/salary income only; tax period = calendar year.',
    'Compulsory social, health and unemployment insurance contributions are not included as a charge. They are deductible, but their 2025–2026 wage ceilings (and the health/unemployment rates) were not confirmed, so taxable income ignores them and tax may be overstated.',
  ],
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
      deductions: [{ kind: 'fixed', name: 'Family-circumstance deduction (taxpayer)', amount: 186000000 }],
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
      deductions: [{ kind: 'fixed', name: 'Family-circumstance deduction (taxpayer, Resolution 954/2020)', amount: 132000000 }],
      source: 'https://congbao.chinhphu.vn/van-ban/van-ban-hop-nhat-so-103-vbhn-vpqh-46034.htm',
      authorityName: 'Official Gazette of Vietnam (congbao.chinhphu.vn) — consolidated PIT Law 103/VBHN-VPQH',
      citationDate: '2026-10-06',
      verified: false,
      verificationNote: 'The bands are from the official gazette, but the VND 132m family deduction (Resolution 954/2020) was confirmed only by the Government e-newspaper, not the resolution text.',
    },
  ],
};
