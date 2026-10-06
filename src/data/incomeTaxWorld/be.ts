/**
 * Belgium — federal personal income tax, single employee. @ai2/tax-plugins — embracingearth.space
 *
 * Years are INCOME years, labelled with the assessment year (aanslagjaar /
 * exercice d'imposition) in which they are taxed. Tax on taxable income under
 * the federal bands, less the tax on the tax-free amount (belastingvrije som /
 * quotité exemptée) at the lowest rate.
 *
 * EXCLUDED: the regional surcharge (Flanders / Wallonia / Brussels) and the
 * communal surcharge, which vary by region and commune; the research found no
 * official average or named default. This is therefore not the full tax.
 *
 * Figures read on fin.belgium.be and socialsecurity.be on 2026-10-06.
 */
import type { CountryIncomeTaxData } from '../incomeTaxFactory';

const SPF_RATES = 'https://fin.belgium.be/fr/particuliers/declaration-impot/revenus/taux-imposition';

/** Personal ONSS contribution 13.07% (pensions 7.50 + health 3.55 + benefits 1.15 + unemployment 0.87), no ceiling. */
const onss = { kind: 'share', name: 'Personal social-security contribution (ONSS/RSZ 13.07%)', rate: 0.1307 } as const;

export const BE_INCOME_TAX: CountryIncomeTaxData = {
  code: 'BE',
  country: 'Belgium',
  currency: 'EUR',
  locale: 'fr-BE',
  timeZone: 'Europe/Brussels',
  file: 'src/data/incomeTaxWorld/be.ts',
  note: 'Federal personal income tax for a single white-collar employee: the federal bands on gross pay less the 13.07% personal social-security contribution, less the tax on the tax-free amount. EXCLUDES the regional and communal surcharges (no official average was obtained), so this is not the full tax. Also excludes the flat-rate professional-expenses deduction and the fiscal work bonus (parameters not confirmed), the work bonus on social contributions, the special social-security contribution, and social contributions as a charge.',
  region: 'Federal tax only — regional and communal surcharges are not included',
  assumptions: [
    'Single, no dependants, individually taxed resident white-collar employee (bediende / employé). Years are income years; the assessment year is the following year.',
    'The 13.07% personal social-security contribution is deducted from taxable income but not included in the tax; the work bonus (werkbonus) that reduces it for low wages and the special social-security contribution are not modelled.',
    'Regional surcharges (opcentiemen / centimes additionnels) and the communal surcharge (aanvullende gemeentebelasting / taxe communale) are NOT included; together they usually add several percent of income.',
    'The flat-rate professional-expenses deduction (forfait frais professionnels) is not applied because its parameters were not confirmed, so tax is overstated.',
  ],
  years: [
    {
      taxYear: '2026 (AY 2027)',
      effectiveFrom: '2026-01-01',
      bands: [
        { upTo: 16720, rate: 0.25 },
        { upTo: 29510, rate: 0.4 },
        { upTo: 51070, rate: 0.45 },
        { upTo: null, rate: 0.5 },
      ],
      deductions: [onss],
      credits: [{ kind: 'taxOnAmount', name: 'Tax-free amount (quotité exemptée / belastingvrije som)', amount: 11180 }],
      source: SPF_RATES,
      authorityName: 'SPF Finances / FOD Financiën',
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025 (AY 2026)',
      effectiveFrom: '2025-01-01',
      bands: [
        { upTo: 16320, rate: 0.25 },
        { upTo: 28800, rate: 0.4 },
        { upTo: 49840, rate: 0.45 },
        { upTo: null, rate: 0.5 },
      ],
      deductions: [onss],
      credits: [{ kind: 'taxOnAmount', name: 'Tax-free amount (quotité exemptée / belastingvrije som)', amount: 10910 }],
      source: SPF_RATES,
      authorityName: 'SPF Finances / FOD Financiën',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
