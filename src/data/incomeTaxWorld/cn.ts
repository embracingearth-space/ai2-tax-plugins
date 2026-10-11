/**
 * China — IIT on comprehensive income (wages), single resident employee. @ai2/tax-plugins — embracingearth.space
 *
 * Bands: STA Annex 1 "Individual Income Tax Rates (Applicable to Comprehensive Income)" — the
 * statutory seven-bracket 3–45% schedule in force since 2019.
 * Basic deduction CNY 60,000/year: STA Order No. 57 (annual reconciliation measures, effective 26 Feb 2025).
 *
 * Special deductions (专项扣除, IIT Law art. 6): the employee's basic pension, basic medical and
 * unemployment insurance and housing provident fund contributions, at the named default
 * locality Beijing (read 2026-10-11):
 *   - pension 8% (rsj.beijing.gov.cn contribution-rate history, individual 8% through 2025.07–2026.06),
 *     medical 2% (Beijing Order 68 art. 10), unemployment 0.5% (京人社就发〔2021〕8号: 1% split 5:5);
 *   - one monthly base for all three, the previous year's average wage clamped to Beijing's
 *     limits: 6,821–35,283 (2024.07–2025.06, 京人社发〔2024〕12号), 7,162–35,811
 *     (2025.07–2026.06, 京人社发〔2025〕11号), 7,270–36,348 (2026.07–2027.06, 京人社发〔2026〕7号);
 *   - housing provident fund 5%, the statutory minimum (HPF Regulations art. 18 as amended by
 *     国令第844号; Beijing allows 5–12%), on the same wage up to Beijing's HPF ceiling, which
 *     equals the social-insurance ceiling in each of 2024–2026 (京房公积金管委会办〔2024〕11号,
 *     〔2025〕13号, 〔2026〕6号) and is inside the 财税〔2006〕10号 deduction cap (12% of up to
 *     3× the city average wage).
 * Contribution years run July–June, so a calendar tax year takes six months at each year's limits.
 */
import type { CountryIncomeTaxData, DeductionRule } from '../incomeTaxFactory';

const BANDS = [
  { upTo: 36000, rate: 0.03 },
  { upTo: 144000, rate: 0.1 },
  { upTo: 300000, rate: 0.2 },
  { upTo: 420000, rate: 0.25 },
  { upTo: 660000, rate: 0.3 },
  { upTo: 960000, rate: 0.35 },
  { upTo: null, rate: 0.45 },
];

/** Beijing monthly base limits for the contribution years a calendar year spans: Jan–Jun, then Jul–Dec. */
const specialDeductions = (firstHalf: { floor: number; ceiling: number }, secondHalf: { floor: number; ceiling: number }): DeductionRule[] => {
  const ceiling = 6 * firstHalf.ceiling + 6 * secondHalf.ceiling;
  const floor = 6 * firstHalf.floor + 6 * secondHalf.floor;
  return [
    // Pension 8% + medical 2% + unemployment 0.5%, never on less than the base floor.
    { kind: 'share', name: 'Social insurance — pension, medical, unemployment (10.5%)', rate: 0.105, ceiling, min: 0.105 * floor },
    { kind: 'share', name: 'Housing provident fund (5%)', rate: 0.05, ceiling },
  ];
};

const BASE_2024_25 = { floor: 6821, ceiling: 35283 };
const BASE_2025_26 = { floor: 7162, ceiling: 35811 };
const BASE_2026_27 = { floor: 7270, ceiling: 36348 };

export const CN_INCOME_TAX: CountryIncomeTaxData = {
  code: 'CN',
  country: 'China',
  currency: 'CNY',
  locale: 'zh-CN',
  timeZone: 'Asia/Shanghai',
  file: 'src/data/incomeTaxWorld/cn.ts',
  note: 'Single tax-resident employee with wage income only, in Beijing: annual IIT on comprehensive income after the CNY 60,000 basic deduction and the special deductions for the employee\'s social insurance (pension 8%, medical 2%, unemployment 0.5%) and housing provident fund (5%) on Beijing\'s contribution bases, using the seven-bracket 3–45% schedule. Excludes itemized special additional deductions, the separate taxation option for an annual one-off bonus, and the contributions themselves as charges. China has no provincial or municipal income tax.',
  assumptions: [
    'Single tax-resident individual, no children or other itemized special additional deductions, wage income only, paid the same wage every month; tax year = calendar year. Monthly cumulative withholding is reconciled to this annual figure.',
    'The employee\'s social insurance (pension 8%, medical 2%, unemployment 0.5%) and housing provident fund contributions are deducted from taxable income as IIT Law art. 6 allows, but are not included as a charge. They are computed for Beijing, the named default locality: each contribution year (July–June) uses Beijing\'s monthly base limits, CNY 7,162–35,811 for July 2025–June 2026 and 7,270–36,348 from July 2026. Other cities set their own limits, and some a different unemployment rate.',
    'The housing provident fund is deducted at 5%, the legal minimum; employers in Beijing choose 5–12%. At 12% the deduction is larger: on CNY 100,000 the 2026 tax is CNY 525 instead of 735, and on CNY 300,000 it is CNY 17,580 instead of 21,780.',
    'Beijing\'s CNY 3 a month serious-illness medical charge is not deducted (whether it counts as a special deduction was not confirmed).',
  ],
  incomeBasis: {
    default: 'employment',
    selfEmployed: 'differs',
    selfEmployedNote: 'Freelance service fees are taxed after a 20% expense reduction, and sole proprietors use the 5–35% business-income schedule, so their tax differs.',
  },
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: BANDS,
      deductions: [{ kind: 'fixed', name: 'Basic deduction', amount: 60000 }, ...specialDeductions(BASE_2025_26, BASE_2026_27)],
      source: 'https://www.chinatax.gov.cn/eng/c102962/c102967/c102997/c103004/c5245812/content.html',
      authorityName: 'State Taxation Administration (chinatax.gov.cn)',
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: BANDS,
      deductions: [{ kind: 'fixed', name: 'Basic deduction', amount: 60000 }, ...specialDeductions(BASE_2024_25, BASE_2025_26)],
      source: 'https://www.chinatax.gov.cn/eng/c102962/c102967/c102997/c103004/c5245812/content.html',
      authorityName: 'State Taxation Administration (chinatax.gov.cn)',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
