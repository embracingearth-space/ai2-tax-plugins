/**
 * Latvia — personal income tax (IIN), resident employee.
 * @ai2/tax-plugins — embracingearth.space
 *
 * Bands on annual taxable income = wages − employee VSAOI (10.5%, on wages up
 * to the 105,300 maximum contribution object) − the non-taxable minimum. The
 * employee VSAOI is deductible (VID worked examples compute IIN as
 * (gross − employee VSAOI − minimum) × 25.5%). The 36% top band is 33% plus
 * the additional 3% on income above 200,000. Employers withhold 25.5%; the 33%
 * and 36% are settled in the annual declaration.
 */
import type { CountryIncomeTaxData, IncomeTaxYearData } from '../incomeTaxFactory';

const BANDS: IncomeTaxYearData['bands'] = [
  { upTo: 105300, rate: 0.255 },
  { upTo: 200000, rate: 0.33 },
  { upTo: null, rate: 0.36 },
];

const vsaoi = { kind: 'share', name: 'Employee social insurance (VSAOI 10.5%) deducted', rate: 0.105, ceiling: 105300 } as const;

export const LV_INCOME_TAX: CountryIncomeTaxData = {
  code: 'LV',
  country: 'Latvia',
  currency: 'EUR',
  locale: 'lv-LV',
  timeZone: 'Europe/Riga',
  file: 'src/data/incomeTaxWorld/lv.ts',
  note: 'Resident employee, annual assessment: IIN at 25.5% / 33% / 36% on wages less the employee social-insurance contribution and the non-taxable minimum. Excludes the employee VSAOI itself, the solidarity tax above the VSAOI ceiling, dependant relief and other reliefs.',
  assumptions: [
    'Single, no dependants, resident, insured for all social-insurance types, wage income only.',
    'The employee state social insurance contribution (VSAOI, 10.5% up to 105,300 a year) is a social contribution and is not included as a charge, but it is deducted from the taxable income as the law provides.',
    'The solidarity tax on earnings above the VSAOI ceiling is not included.',
    'Bands are annual; the employer withholds only 25.5% and the higher rates are settled in the annual declaration.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: BANDS,
      deductions: [vsaoi, { kind: 'fixed', name: 'Non-taxable minimum (gada neapliekamais minimums)', amount: 6600 }],
      source: 'https://www.fm.gov.lv/lv/media/24752/download?attachment=',
      authorityName: 'Finanšu ministrija (Ministry of Finance of Latvia)',
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: BANDS,
      // 12 × 510 a month (VID, 2025).
      deductions: [vsaoi, { kind: 'fixed', name: 'Non-taxable minimum (gada neapliekamais minimums)', amount: 6120 }],
      source: 'https://www.vid.gov.lv/lv/media/28329/download?attachment=',
      authorityName: 'Valsts ieņēmumu dienests (State Revenue Service of Latvia)',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
