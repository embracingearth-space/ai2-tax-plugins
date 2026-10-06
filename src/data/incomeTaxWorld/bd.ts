/**
 * Bangladesh — personal income tax, general resident individual.
 * @ai2/tax-plugins — embracingearth.space
 *
 * Income year runs 1 July – 30 June and is assessed in the following tax year
 * (label '2026-27' = income year 2026-27, assessed in tax year 2027-28).
 * Finance Act 2026 Schedule 2 sets the same slabs for tax years 2026-27 and
 * 2027-28 (NBR Paripatra 2026-27, s.1.1), so both income years use them.
 */
import type { CountryIncomeTaxData } from '../incomeTaxFactory';

const SOURCE = 'https://nbr.gov.bd/uploads/news-scroller/Aykor_Poripothro_2026-2027_BG_Press_Modify_Copy.pdf';

// First 4,00,000 nil; next 3,00,000 10%; next 4,00,000 15%; next 5,00,000 20%; next 20,00,000 25%; balance 30%.
const bands = () => [
  { upTo: 400000, rate: 0 },
  { upTo: 700000, rate: 0.1 },
  { upTo: 1100000, rate: 0.15 },
  { upTo: 1600000, rate: 0.2 },
  { upTo: 3600000, rate: 0.25 },
  { upTo: null, rate: 0.3 },
];

export const BD_INCOME_TAX: CountryIncomeTaxData = {
  code: 'BD',
  country: 'Bangladesh',
  currency: 'BDT',
  locale: 'bn-BD',
  timeZone: 'Asia/Dhaka',
  file: 'src/data/incomeTaxWorld/bd.ts',
  note: 'General resident individual: Finance Act 2026 slabs (nil up to BDT 4,00,000, then 10% to 30%) applied to the whole salary. Excludes the salary exemption (ITA 2023), the investment tax rebate, the area-based minimum tax and the higher thresholds for women, age 65+, persons with disability and others.',
  assumptions: [
    'Resident general individual (male, under 65, no disability); tax-free threshold BDT 4,00,000.',
    'The exempt portion of salary under ITA 2023 is NOT deducted (not verified in the research), so the tax may be overstated.',
    'No investment tax rebate and no area-based minimum tax.',
    'No social contributions are deducted or added: there is no mandatory employee social-security contribution on private-sector wages (the Universal Pension Scheme is voluntary).',
  ],
  years: [
    {
      taxYear: '2026-27',
      effectiveFrom: '2026-07-01',
      bands: bands(),
      source: SOURCE,
      authorityName: 'National Board of Revenue (NBR)',
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025-26',
      effectiveFrom: '2025-07-01',
      bands: bands(),
      source: SOURCE,
      authorityName: 'National Board of Revenue (NBR)',
      citationDate: '2026-10-06',
      verified: true,
      assumptions: ['Income year 2025-26 is assessed in tax year 2026-27 at Finance Act 2026 rates; payroll withholding during the year used the Finance Act 2025 schedule.'],
    },
  ],
};
