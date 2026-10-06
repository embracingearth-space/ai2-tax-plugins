/**
 * Slovenia — dohodnina, single employee.
 * @ai2/tax-plugins — embracingearth.space
 *
 * Base = gross − employee contributions (percentage part) − general allowance
 * (splošna olajšava), raised for low incomes by (K − 1.17259 × income) up to
 * the published income limit. Five-band annual scale (FURS "Lestvica").
 */
import type { CountryIncomeTaxData, DeductionRule } from '../incomeTaxFactory';

const AUTHORITY = 'Finančna uprava RS (FURS)';

const generalAllowance = (base: number, k: number, limit: number): DeductionRule => ({
  kind: 'custom',
  name: 'Splošna olajšava (general allowance)',
  // Income for the low-income increase is taken as gross employment income.
  amount: ({ gross }) => base + (gross <= limit ? Math.max(0, k - 1.17259 * gross) : 0),
});

export const SI_INCOME_TAX: CountryIncomeTaxData = {
  code: 'SI',
  country: 'Slovenia',
  currency: 'EUR',
  locale: 'sl-SI',
  timeZone: 'Europe/Ljubljana',
  file: 'src/data/incomeTaxWorld/si.ts',
  note: 'Single resident employee aged 30–69: annual dohodnina scale (16–50%) on gross pay less the percentage employee social contributions and the general allowance (increased for low incomes). Excludes the contributions themselves, the flat monthly mandatory health contribution (OZP), the under-29 and 70+ allowances, dependant allowances and voluntary pension saving.',
  assumptions: [
    'Single, no dependants, resident, aged 30–69, not disabled; employment income only.',
    'Employee social contributions (pension and disability 15.5%, health 6.36%, long-term care 1%, parental 0.1%, unemployment 0.14%) are deducted from the tax base but not included in the tax shown. Their deductibility follows standard ZDoh-2 rules and was not confirmed on a fetched official page.',
    'The flat monthly mandatory health contribution (OZP) is neither included nor deducted.',
    'The low-income increase of the general allowance is applied to gross employment income.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: [
        { upTo: 9721.43, rate: 0.16 },
        { upTo: 28592.44, rate: 0.26 },
        { upTo: 57184.88, rate: 0.33 },
        { upTo: 82346.23, rate: 0.39 },
        { upTo: null, rate: 0.5 },
      ],
      deductions: [
        { kind: 'share', name: 'Employee social contributions (23.10%)', rate: 0.231 },
        generalAllowance(5551.93, 20832.39, 17766.18),
      ],
      source: 'https://www.fu.gov.si/fileadmin/Internet/Davki_in_druge_dajatve/Podrocja/Dohodnina/Letna_odmera_dohodnine/Opis/Lestvica_za_leto_2026.docx',
      authorityName: AUTHORITY,
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: [
        { upTo: 9210.26, rate: 0.16 },
        { upTo: 27089, rate: 0.26 },
        { upTo: 54178, rate: 0.33 },
        { upTo: 78016.32, rate: 0.39 },
        { upTo: null, rate: 0.5 },
      ],
      deductions: [
        // 22.10% all year + 1% long-term care from 1 July 2025 only = 22.60% on evenly paid wages.
        { kind: 'share', name: 'Employee social contributions (22.10% + 1% long-term care for July–December)', rate: 0.226 },
        generalAllowance(5260, 19736.99, 16832),
      ],
      source: 'https://www.fu.gov.si/fileadmin/Internet/Davki_in_druge_dajatve/Podrocja/Dohodnina/Letna_odmera_dohodnine/Opis/Lestvica_za_leto_2025.docx',
      authorityName: AUTHORITY,
      citationDate: '2026-10-06',
      verified: true,
      assumptions: ['Wages paid evenly over 2025: the 1% long-term-care contribution applies to half of the year.'],
    },
  ],
};
