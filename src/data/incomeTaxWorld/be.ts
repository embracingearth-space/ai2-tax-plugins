/**
 * Belgium — federal personal income tax, single employee. @ai2/tax-plugins — embracingearth.space
 *
 * Years are INCOME years, labelled with the assessment year (aanslagjaar /
 * exercice d'imposition) in which they are taxed. Taxable income = gross pay
 * less the personal social-security contribution, less the flat-rate
 * professional expenses (art. 51 CIR 92: 30% of that net pay, capped). Tax on
 * it under the federal bands (art. 130), less the tax on the tax-free amount
 * (belastingvrije som / quotité exemptée, art. 131 and 134) at the lowest rate.
 *
 * EXCLUDED: the regional surcharge (Flanders / Wallonia / Brussels) and the
 * communal surcharge, which vary by region and commune; the research found no
 * official average or named default. This is therefore not the full tax.
 *
 * Bands, forfait cap and tax-free amount read on the SPF Finances indexation
 * notices (Fisconetplus, Moniteur belge 13.02.2026 and 12.08.2026) on
 * 2026-10-11; the 13.07% on socialsecurity.be on 2026-10-06.
 */
import type { CountryIncomeTaxData, DeductionRule } from '../incomeTaxFactory';

/** Personal ONSS contribution 13.07% (pensions 7.50 + health 3.55 + benefits 1.15 + unemployment 0.87), no ceiling. */
const onss = { kind: 'share', name: 'Personal social-security contribution (ONSS/RSZ 13.07%)', rate: 0.1307 } as const;

/**
 * Forfait frais professionnels for employees (art. 51 CIR 92): 30% of gross
 * pay "préalablement diminués" of the personal social contributions — so of
 * what the ONSS rule above left — capped at the year's indexed amount.
 */
const forfait = (cap: number): DeductionRule => ({
  kind: 'custom',
  name: 'Flat-rate professional expenses (forfait frais professionnels 30%)',
  amount: ({ gross, deductedSoFar }) => Math.min(0.3 * (gross - deductedSoFar), cap),
});

const FISCONET = 'https://eservices.minfin.fgov.be/myminfin-web/pages/public/fisconet/document/';

export const BE_INCOME_TAX: CountryIncomeTaxData = {
  code: 'BE',
  country: 'Belgium',
  currency: 'EUR',
  locale: 'fr-BE',
  timeZone: 'Europe/Brussels',
  file: 'src/data/incomeTaxWorld/be.ts',
  note: 'Federal personal income tax for a single white-collar employee: the federal bands on gross pay less the 13.07% personal social-security contribution and the 30% flat-rate professional-expenses deduction (capped), less the tax on the tax-free amount. EXCLUDES the regional and communal surcharges (no official average was obtained), so this is not the full tax. Also excludes actual professional expenses, the fiscal work bonus (parameters not confirmed), the work bonus on social contributions, the special social-security contribution, and social contributions as a charge.',
  region: 'Federal tax only — regional and communal surcharges are not included',
  assumptions: [
    'Single, no dependants, individually taxed resident white-collar employee (bediende / employé). Years are income years; the assessment year is the following year.',
    'The 13.07% personal social-security contribution is deducted from taxable income but not included in the tax; the work bonus (werkbonus) that reduces it for low wages and the special social-security contribution are not modelled.',
    'The flat-rate professional-expenses deduction (forfait frais professionnels, art. 51 CIR 92) is applied: 30% of gross pay after the personal social-security contribution, capped at 6,070 for income year 2026 and 5,930 for income year 2025. Actual expenses, where higher, are not modelled.',
    'Regional surcharges (opcentiemen / centimes additionnels) and the communal surcharge (aanvullende gemeentebelasting / taxe communale) are NOT included; together they usually add several percent of income.',
  ],
  incomeBasis: {
    default: 'employment',
    selfEmployed: 'differs',
    selfEmployedNote: 'Employee social security (13.07%) is deducted here; a self-employed person pays social contributions of about 20.5% (deductible), so the tax is lower.',
  },
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
      deductions: [onss, forfait(6070)],
      // 11,550: base raised from 4,785 to 4,945 from AY 2027 by the law of 15 July 2026
      // (M.B. 29.07.2026), × 2.3356. The SPF taux-d'imposition page still shows the old 11,180.
      credits: [{ kind: 'taxOnAmount', name: 'Tax-free amount (quotité exemptée / belastingvrije som)', amount: 11550 }],
      source: `${FISCONET}042cb526-403e-4f40-9a45-dbccd0a12583`,
      authorityName: 'SPF Finances / FOD Financiën (Fisconetplus), indexation notice for assessment year 2027',
      citationDate: '2026-10-11',
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
      deductions: [onss, forfait(5930)],
      credits: [{ kind: 'taxOnAmount', name: 'Tax-free amount (quotité exemptée / belastingvrije som)', amount: 10910 }],
      source: `${FISCONET}934106e5-36bd-4f61-8928-ba9ca100727f`,
      authorityName: 'SPF Finances / FOD Financiën (Fisconetplus), indexation notice for assessment year 2026',
      citationDate: '2026-10-11',
      verified: true,
    },
  ],
};
