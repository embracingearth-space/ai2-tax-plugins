/**
 * Czechia — daň z příjmů fyzických osob, single employee.
 * @ai2/tax-plugins — embracingearth.space
 *
 * Base = gross employment income (super-gross wage abolished). 15% up to
 * 36 × the average wage, 23% above; basic taxpayer credit (sleva na
 * poplatníka) 30,840 CZK, non-refundable.
 */
import type { CountryIncomeTaxData, CreditRule } from '../incomeTaxFactory';

const AUTHORITY = 'Finanční správa ČR (financnisprava.gov.cz)';
const credits: CreditRule[] = [{ kind: 'fixed', name: 'Sleva na poplatníka (basic taxpayer credit)', amount: 30840 }];

export const CZ_INCOME_TAX: CountryIncomeTaxData = {
  code: 'CZ',
  country: 'Czechia',
  currency: 'CZK',
  locale: 'cs-CZ',
  timeZone: 'Europe/Prague',
  file: 'src/data/incomeTaxWorld/cz.ts',
  note: 'Single resident employee: 15% on gross employment income up to 36 × the average wage and 23% above, less the 30,840 CZK basic taxpayer credit. Excludes employee social insurance (7.1%) and health insurance (4.5%), other credits and allowances, and rounding of the tax base to whole hundreds.',
  assumptions: [
    'Single, no children, resident employee with one employer.',
    'Employee social insurance (6.5% pension + 0.6% sickness) and health insurance (4.5%) are not included; the tax base is gross pay.',
    'Only the basic taxpayer credit (sleva na poplatníka); no other credits or deductions.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      // 36 × average wage 48,967 = 1,762,812 CZK.
      bands: [
        { upTo: 1762812, rate: 0.15 },
        { upTo: null, rate: 0.23 },
      ],
      credits,
      source: 'https://financnisprava.gov.cz/cs/dane/dane/dan-z-prijmu/zamestnanci-zamestnavatele/obecne-informace',
      authorityName: AUTHORITY,
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      // 36 × average wage 46,557 = 1,676,052 CZK.
      bands: [
        { upTo: 1676052, rate: 0.15 },
        { upTo: null, rate: 0.23 },
      ],
      credits,
      source: 'https://financnisprava.gov.cz/cs/dane/dane/dan-z-prijmu/dotazy-a-odpovedi/dan-z-prijmu-fyzickych-osob/aktualne-k-dani-z-prijmu-fyzickych-osob-2025',
      authorityName: AUTHORITY,
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
