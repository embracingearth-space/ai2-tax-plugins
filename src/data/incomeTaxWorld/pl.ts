/**
 * Poland — PIT on the tax scale (skala podatkowa), single employee.
 * @ai2/tax-plugins — embracingearth.space
 *
 * Base = gross − employee social contributions (pension 9.76% + disability
 * 1.5% up to the annual ZUS ceiling, sickness 2.45% uncapped) − flat-rate
 * employee costs (3,000 PLN, one job, same locality). Scale 12% / 32% at
 * 120,000 PLN; the 3,600 PLN tax-reducing amount is a credit (10,800 + 32%
 * above 120,000 nets it). Solidarity levy (art. 30h, form DSF-1): 4% of income
 * above 1,000,000 PLN. The 9% health contribution is neither deducted nor charged.
 */
import type { CountryIncomeTaxData, DeductionRule, CreditRule, LevyRule } from '../incomeTaxFactory';

const SCALE_2026 = 'https://www.podatki.gov.pl/podatki-osobiste/pit/informacje-podstawowe/co-jest-opodatkowane/dochody-z-pracy';
const SCALE = 'https://www.podatki.gov.pl/podatki-osobiste/pit/stawki-i-limity';
const AUTHORITY = 'Ministerstwo Finansów / KAS (podatki.gov.pl)';

const deductions = (zusCeiling: number): DeductionRule[] => [
  { kind: 'share', name: 'Employee pension + disability contributions (9.76% + 1.5%)', rate: 0.0976 + 0.015, ceiling: zusCeiling },
  { kind: 'share', name: 'Employee sickness contribution (2.45%)', rate: 0.0245 },
  { kind: 'fixed', name: 'Flat-rate employee costs (koszty uzyskania przychodów)', amount: 3000 },
];

const bands = [
  { upTo: 120000, rate: 0.12 },
  { upTo: null, rate: 0.32 },
];

const credits: CreditRule[] = [{ kind: 'fixed', name: 'Kwota zmniejszająca podatek (tax-reducing amount)', amount: 3600 }];

const levies: LevyRule[] = [
  {
    kind: 'custom',
    name: 'Danina solidarnościowa (solidarity levy)',
    // DSF-1: income base less 1,000,000 PLN, × 4%.
    amount: ({ taxable }) => Math.max(0, taxable - 1_000_000) * 0.04,
  },
];

export const PL_INCOME_TAX: CountryIncomeTaxData = {
  code: 'PL',
  country: 'Poland',
  currency: 'PLN',
  locale: 'pl-PL',
  timeZone: 'Europe/Warsaw',
  file: 'src/data/incomeTaxWorld/pl.ts',
  note: 'Single employee with one employment contract on the PIT tax scale: 12% up to 120,000 PLN and 32% above, less the 3,600 PLN tax-reducing amount, on gross pay less employee social contributions and the 3,000 PLN flat-rate employee costs; plus the 4% solidarity levy on income above 1,000,000 PLN. Excludes the 9% health contribution, youth relief (under 26) and other PIT-0 reliefs, and the higher costs for commuting from another locality.',
  assumptions: [
    'Single, no children, one employment contract, living in the same locality as the workplace (3,000 PLN flat-rate costs).',
    'Employee social contributions (pension 9.76% and disability 1.5% up to the annual ZUS ceiling, sickness 2.45%) are deducted from the tax base but are not included in the tax shown.',
    'The 9% health contribution (składka zdrowotna) is not included and not deducted from the tax.',
    'No youth relief (ulga dla młodych) or other reliefs; tax scale, not a flat or lump-sum regime.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands,
      // ZUS annual pension/disability ceiling 2026: 282,600 PLN (MP 2025.1206).
      deductions: deductions(282600),
      credits,
      levies,
      source: SCALE_2026,
      authorityName: AUTHORITY,
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands,
      // ZUS annual ceiling 2025: 260,190 PLN (MP 2024.1051).
      deductions: deductions(260190),
      credits,
      levies,
      source: SCALE,
      authorityName: AUTHORITY,
      citationDate: '2026-10-06',
      verified: false,
      verificationNote:
        'The 2025 scale and tax-reducing amount are confirmed on podatki.gov.pl, but the 3,000 PLN flat-rate employee costs were read only on a page labelled for 2026; the same amount is assumed for 2025.',
    },
  ],
};
