/**
 * South Africa — personal income tax, resident employee. @ai2/tax-plugins — embracingearth.space
 *
 * The year runs 1 March – end of February. SARS names a year by the calendar
 * year it ENDS in ("2027 year of assessment" = 1 Mar 2026 – 28 Feb 2027); we
 * label by income period: '2026-27'. Tax = bands − rebates (credits, floored
 * at zero). Rebates: primary for everyone, secondary from age 65, tertiary
 * from 75 (options.age; default under 65). The tax threshold (R99,000 for
 * 2026-27) is a consequence of the primary rebate, not a deduction.
 * UIF is a social contribution and is not deductible.
 */
import type { CountryIncomeTaxData, CreditRule } from '../incomeTaxFactory';

const SARS_RATES = 'https://www.sars.gov.za/tax-rates/income-tax/rates-of-tax-for-individuals/';

function rebates(primary: number, secondary: number, tertiary: number): CreditRule[] {
  return [
    { kind: 'fixed', name: 'Primary rebate', amount: primary },
    { kind: 'custom', name: 'Secondary rebate (65 and older)', amount: ({ options }) => ((options.age ?? 0) >= 65 ? secondary : 0) },
    { kind: 'custom', name: 'Tertiary rebate (75 and older)', amount: ({ options }) => ((options.age ?? 0) >= 75 ? tertiary : 0) },
  ];
}

export const ZA_INCOME_TAX: CountryIncomeTaxData = {
  code: 'ZA',
  country: 'South Africa',
  currency: 'ZAR',
  locale: 'en-ZA',
  timeZone: 'Africa/Johannesburg',
  file: 'src/data/incomeTaxWorld/za.ts',
  note: 'Resident individual: SARS annual rates on taxable income (taken as the whole remuneration) less the primary rebate, plus the secondary and tertiary rebates when an age of 65 or 75 is given. Excludes retirement-fund contribution deductions, medical scheme fees tax credits and other deductions; this is the statutory formula, so payroll PAYE from the bracketed SARS tables can differ by a few rand.',
  assumptions: [
    'Resident individual under 65 unless an age is given; employment income only, no retirement-fund contributions or medical scheme credits.',
    'UIF (Unemployment Insurance Fund, employee 1%) is a social contribution and is not included; it is not deductible for income tax.',
  ],
  optionsSupported: ['age'],
  years: [
    {
      taxYear: '2026-27',
      effectiveFrom: '2026-03-01',
      bands: [
        { upTo: 245100, rate: 0.18 },
        { upTo: 383100, rate: 0.26 },
        { upTo: 530200, rate: 0.31 },
        { upTo: 695800, rate: 0.36 },
        { upTo: 887000, rate: 0.39 },
        { upTo: 1878600, rate: 0.41 },
        { upTo: null, rate: 0.45 },
      ],
      credits: rebates(17820, 9765, 3249),
      source: SARS_RATES,
      authorityName: 'South African Revenue Service (SARS)',
      citationDate: '2026-10-06',
      verified: true,
      assumptions: ['SARS calls this the 2027 year of assessment (1 March 2026 – 28 February 2027).'],
    },
    {
      taxYear: '2025-26',
      effectiveFrom: '2025-03-01',
      bands: [
        { upTo: 237100, rate: 0.18 },
        { upTo: 370500, rate: 0.26 },
        { upTo: 512800, rate: 0.31 },
        { upTo: 673000, rate: 0.36 },
        { upTo: 857900, rate: 0.39 },
        { upTo: 1817000, rate: 0.41 },
        { upTo: null, rate: 0.45 },
      ],
      credits: rebates(17235, 9444, 3145),
      source: SARS_RATES,
      authorityName: 'South African Revenue Service (SARS)',
      citationDate: '2026-10-06',
      verified: true,
      assumptions: ['SARS calls this the 2026 year of assessment (1 March 2025 – 28 February 2026).'],
    },
  ],
};
