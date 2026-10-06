/**
 * Portugal — IRS, single employee (categoria A), mainland. @ai2/tax-plugins — embracingearth.space
 *
 * Rendimento coletável = gross − dedução específica (art. 25.º CIRS: 8.54 ×
 * IAS, or the compulsory social-security contributions if higher). Art. 68.º
 * bands (the col. A / col. B method equals marginal banding), plus the taxa
 * adicional de solidariedade (art. 68.º-A), which is part of IRS.
 *
 * Figures read on info.portaldasfinancas.gov.pt, diariodarepublica.pt and
 * gov.pt on 2026-10-06.
 */
import type { CountryIncomeTaxData, DeductionRule, LevyRule } from '../incomeTaxFactory';

/** Art. 25.º n.º 1 a): the greater of 8.54 × IAS and the employee's 11% social-security contribution. */
const deducaoEspecifica = (fixed: number): DeductionRule => ({
  kind: 'custom',
  name: 'Dedução específica (art. 25.º CIRS)',
  amount: ({ gross }) => Math.max(fixed, gross * 0.11),
});

/** Art. 68.º-A: 2.5% of taxable income from 80,000 to 250,000, 5% above. */
const solidariedade: LevyRule = {
  kind: 'bands',
  name: 'Taxa adicional de solidariedade (art. 68.º-A)',
  base: 'taxable',
  bands: [
    { upTo: 80000, rate: 0 },
    { upTo: 250000, rate: 0.025 },
    { upTo: null, rate: 0.05 },
  ],
};

export const PT_INCOME_TAX: CountryIncomeTaxData = {
  code: 'PT',
  country: 'Portugal',
  currency: 'EUR',
  locale: 'pt-PT',
  timeZone: 'Europe/Lisbon',
  file: 'src/data/incomeTaxWorld/pt.ts',
  note: 'IRS for a single mainland employee taxed separately: the art. 68.º bands on gross pay less the dedução específica (8.54 × IAS or the 11% social-security contribution if higher), plus the taxa adicional de solidariedade. Excludes the mínimo de existência (its phase-out formula was not fully researched, so low-income tax is overstated), deductions from the tax such as despesas gerais familiares (they depend on invoices), IRS Jovem, the Azores and Madeira rates, the municipal IRS give-back, and social contributions as a charge.',
  region: 'Mainland Portugal — Azores and Madeira apply reduced regional rates, not modelled',
  assumptions: [
    'Single, no children, resident in mainland Portugal, taxed separately; not eligible for IRS Jovem.',
    'The employee social-security contribution (11%) is not included in the tax; it enters only through the dedução específica, which is the greater of 8.54 × IAS and that contribution.',
    'The mínimo de existência is not applied, so the tax of low earners is overstated.',
    'No deductions from the tax (despesas gerais familiares up to €250, health, education, housing) are applied, as they depend on the taxpayer\'s invoices.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: [
        { upTo: 8342, rate: 0.125 },
        { upTo: 12587, rate: 0.157 },
        { upTo: 17838, rate: 0.212 },
        { upTo: 23089, rate: 0.241 },
        { upTo: 29397, rate: 0.311 },
        { upTo: 43090, rate: 0.349 },
        { upTo: 46566, rate: 0.431 },
        { upTo: 86634, rate: 0.446 },
        { upTo: null, rate: 0.48 },
      ],
      // 8.54 × IAS 2026 (537.13, Portaria 480-A/2025/1) = 4,587.09 — statutory formula, not a figure AT has printed yet.
      deductions: [deducaoEspecifica(4587.09)],
      levies: [solidariedade],
      source: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs68.aspx',
      authorityName: 'Autoridade Tributária e Aduaneira (CIRS art. 68.º)',
      citationDate: '2026-10-06',
      verified: true,
      assumptions: ['The 2026 dedução específica (€4,587.09) is computed from the statutory formula 8.54 × IAS (€537.13); the AT has not yet published its 2026 figure.'],
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      // Lei 55-A/2025 table, applied to all 2025 income per the AT IRS 2025 leaflet.
      bands: [
        { upTo: 8059, rate: 0.125 },
        { upTo: 12160, rate: 0.16 },
        { upTo: 17233, rate: 0.215 },
        { upTo: 22306, rate: 0.244 },
        { upTo: 28400, rate: 0.314 },
        { upTo: 41629, rate: 0.349 },
        { upTo: 44987, rate: 0.431 },
        { upTo: 83696, rate: 0.446 },
        { upTo: null, rate: 0.48 },
      ],
      deductions: [deducaoEspecifica(4462.15)],
      levies: [solidariedade],
      source: 'https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/Folhetos_informativos/Documents/IRS_deducoes_2025.pdf',
      authorityName: 'Autoridade Tributária e Aduaneira (IRS 2025 leaflet)',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
