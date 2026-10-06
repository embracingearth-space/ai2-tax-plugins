/**
 * Slovakia — daň z príjmov fyzickej osoby, single employee.
 * @ai2/tax-plugins — embracingearth.space
 *
 * Base = gross − employee social insurance (9.4%, capped at 12 × the monthly
 * maximum assessment base) − employee health insurance (5% in 2026, 4% in
 * 2025) − NČZD (non-taxable part for the taxpayer, tapered on the tax base).
 */
import type { CountryIncomeTaxData, DeductionRule } from '../incomeTaxFactory';

const AUTHORITY = 'Finančná správa SR (financnasprava.sk)';

/**
 * NČZD na daňovníka: `full` if the tax base (after contributions) is at most
 * `limit`; otherwise `cap − base / divisor`, not below zero.
 */
const nczd = (full: number, limit: number, cap: number, divisor: number): DeductionRule => ({
  kind: 'custom',
  name: 'Nezdaniteľná časť základu dane na daňovníka (NČZD)',
  amount: ({ gross, deductedSoFar }) => {
    const base = Math.max(0, gross - deductedSoFar);
    return base <= limit ? full : Math.max(0, cap - base / divisor);
  },
});

export const SK_INCOME_TAX: CountryIncomeTaxData = {
  code: 'SK',
  country: 'Slovakia',
  currency: 'EUR',
  locale: 'sk-SK',
  timeZone: 'Europe/Bratislava',
  file: 'src/data/incomeTaxWorld/sk.ts',
  note: 'Single resident employee: national income-tax bands on employment income after employee social and health insurance and the tapered non-taxable part for the taxpayer (NČZD). 2026 uses the four-band scale (19/25/30/35%); 2025 the 19/25% scale. Excludes the contributions themselves, the child tax bonus, spouse and pension-saving allowances.',
  assumptions: [
    'Single, no children, resident employee, not disabled and not a pensioner; wages paid evenly over the year.',
    'Employee social insurance (sickness 1.4%, old-age 4%, disability 3%, unemployment 1%, capped at 12 × the monthly maximum assessment base) and health insurance are deducted from the tax base but not included in the tax shown. Their deductibility follows standard Slovak rules and was not confirmed on a fetched official page.',
    'Health insurance is treated as uncapped.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: [
        { upTo: 43983.32, rate: 0.19 },
        { upTo: 60349.21, rate: 0.25 },
        { upTo: 75010.32, rate: 0.3 },
        { upTo: null, rate: 0.35 },
      ],
      deductions: [
        // Monthly maximum assessment base 16,764 EUR × 12.
        { kind: 'share', name: 'Employee social insurance (9.4%)', rate: 0.094, ceiling: 201168 },
        { kind: 'share', name: 'Employee health insurance (5%)', rate: 0.05 },
        // 21 × ŽM 284.13; limit 91.8 × ŽM; 51.6 × ŽM − 1/3 of the base.
        nczd(5966.73, 26083.13, 14661.11, 3),
      ],
      source: 'https://podpora.financnasprava.sk/081400-Sadzba-dane-z-pr%C3%ADjmov-fyzickej-osoby-za-rok-2026',
      authorityName: AUTHORITY,
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: [
        { upTo: 48441.43, rate: 0.19 },
        { upTo: null, rate: 0.25 },
      ],
      deductions: [
        // Monthly maximum assessment base 15,730 EUR × 12.
        { kind: 'share', name: 'Employee social insurance (9.4%)', rate: 0.094, ceiling: 188760 },
        { kind: 'share', name: 'Employee health insurance (4%)', rate: 0.04 },
        // 21 × ŽM 273.99; limit 92.8 × ŽM; 44.2 × ŽM − 1/4 of the base.
        nczd(5753.79, 25426.27, 12110.36, 4),
      ],
      source: 'https://podpora.financnasprava.sk/353281-Sadzba-dane-z-pr%C3%ADjmov-fyzickej-osoby-za-rok-2025',
      authorityName: AUTHORITY,
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
