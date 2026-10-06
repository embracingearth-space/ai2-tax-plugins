/**
 * Costa Rica — impuesto único sobre las rentas del trabajo dependiente (salary
 * tax), single resident employee. @ai2/tax-plugins — embracingearth.space
 *
 * The law is a MONTHLY scale on total monthly pay, withheld by the employer
 * and final (Ley 7092 art. 33). Bands here are 12 × the decree's monthly limits
 * (Decreto 45333-H for 2026, 44772-H for 2025). CCSS and Banco Popular worker
 * contributions are not deductible from the salary-tax base.
 */
import type { CountryIncomeTaxData } from '../incomeTaxFactory';

export const CR_INCOME_TAX: CountryIncomeTaxData = {
  code: 'CR',
  country: 'Costa Rica',
  currency: 'CRC',
  locale: 'es-CR',
  timeZone: 'America/Costa_Rica',
  file: 'src/data/incomeTaxWorld/cr.ts',
  note: 'Single resident salaried employee: the salary tax at 0% / 10% / 15% / 20% / 25% on gross pay, annualised from the monthly scale. Excludes the child and spouse credits, the aguinaldo (exempt up to one twelfth of annual salary) and CCSS / Banco Popular worker contributions.',
  assumptions: [
    'Single resident employee with one employer, no children or spouse credit, paid the same salary every month; the aguinaldo is not part of the input.',
    'CCSS (health and IVM) and Banco Popular worker social-security contributions are not included and are not deductible from the salary-tax base.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      // Monthly 918,000 / 1,347,000 / 2,364,000 / 4,727,000 × 12.
      bands: [
        { upTo: 11016000, rate: 0 },
        { upTo: 16164000, rate: 0.1 },
        { upTo: 28368000, rate: 0.15 },
        { upTo: 56724000, rate: 0.2 },
        { upTo: null, rate: 0.25 },
      ],
      source: 'https://sinalevi.go.cr/ResultadosNormativa/Informacion?param1=105834&param2=148657&param3=1',
      authorityName: 'Ministerio de Hacienda — Decreto Ejecutivo 45333-H (SINALEVI)',
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      // Monthly 922,000 / 1,352,000 / 2,373,000 / 4,745,000 × 12.
      bands: [
        { upTo: 11064000, rate: 0 },
        { upTo: 16224000, rate: 0.1 },
        { upTo: 28476000, rate: 0.15 },
        { upTo: 56940000, rate: 0.2 },
        { upTo: null, rate: 0.25 },
      ],
      source: 'https://sinalevi.go.cr/ResultadosNormativa/Informacion?param1=103391&param2=148976&param3=1',
      authorityName: 'Ministerio de Hacienda — Decreto Ejecutivo 44772-H (SINALEVI)',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
