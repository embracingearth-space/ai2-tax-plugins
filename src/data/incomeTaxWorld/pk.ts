/**
 * Pakistan — income tax on salary (salaried individual table).
 * @ai2/tax-plugins — embracingearth.space
 *
 * Tax year runs 1 July – 30 June; Pakistan names it by the year it ends
 * (label '2026-27' = Tax Year 2027). Table: Income Tax Ordinance 2001, First
 * Schedule Part I Division I clause (2), published as fixed amount + marginal
 * rate and converted to marginal bands (cumulative amounts reconcile).
 */
import type { CountryIncomeTaxData } from '../incomeTaxFactory';

export const PK_INCOME_TAX: CountryIncomeTaxData = {
  code: 'PK',
  country: 'Pakistan',
  currency: 'PKR',
  locale: 'en-PK',
  timeZone: 'Asia/Karachi',
  file: 'src/data/incomeTaxWorld/pk.ts',
  note: 'Salaried individual: the Finance Act salaried-income table on annual taxable salary, plus the s.4AB surcharge for salaried individuals where it applies (9% of tax above PKR 10m taxable income in Tax Year 2026; abolished for salaried individuals from Tax Year 2027). Excludes EOBI contributions and provincial professional tax.',
  assumptions: [
    'Individual whose income is mainly salary; resident; no other income, no exempt allowances.',
    'Social contributions are not included: the EOBI employee contribution is not income tax.',
    'Provincial professional tax (a fixed levy in some provinces) is not included.',
  ],
  years: [
    {
      taxYear: '2026-27',
      effectiveFrom: '2026-07-01',
      // Finance Act 2026 s.(44): 0 / 1% / 6,000+11% / 116,000+20% / 316,000+25% / 541,000+29% / 976,000+32% / 1,424,000+35%.
      bands: [
        { upTo: 600000, rate: 0 },
        { upTo: 1200000, rate: 0.01 },
        { upTo: 2200000, rate: 0.11 },
        { upTo: 3200000, rate: 0.2 },
        { upTo: 4100000, rate: 0.25 },
        { upTo: 5600000, rate: 0.29 },
        { upTo: 7000000, rate: 0.32 },
        { upTo: null, rate: 0.35 },
      ],
      source: 'https://download1.fbr.gov.pk/Docs/20266291261044366FinanceAct2026.pdf',
      authorityName: 'Federal Board of Revenue (FBR) — Finance Act 2026',
      citationDate: '2026-10-06',
      verified: true,
      assumptions: ['Tax Year 2027 (1 Jul 2026 – 30 Jun 2027). Finance Act 2026 amended the s.4AB proviso: no surcharge is payable by salaried individuals.'],
    },
    {
      taxYear: '2025-26',
      effectiveFrom: '2025-07-01',
      // Finance Act 2025 table: 0 / 1% / 6,000+11% / 116,000+23% / 346,000+30% / 616,000+35%.
      bands: [
        { upTo: 600000, rate: 0 },
        { upTo: 1200000, rate: 0.01 },
        { upTo: 2200000, rate: 0.11 },
        { upTo: 3200000, rate: 0.23 },
        { upTo: 4100000, rate: 0.3 },
        { upTo: null, rate: 0.35 },
      ],
      levies: [
        {
          // s.4AB proviso (Finance Act 2025): 9% of the income tax where taxable income exceeds PKR 10,000,000.
          kind: 'custom',
          name: 'Surcharge (s.4AB, salaried)',
          amount: ({ taxable, taxAfterCredits }) => (taxable > 10000000 ? taxAfterCredits * 0.09 : 0),
        },
      ],
      source: 'https://download1.fbr.gov.pk/Docs/2025881983148210Income-Tax-Ordinance,-2001-Amended-upto-31.07.2025.pdf',
      authorityName: 'Federal Board of Revenue (FBR) — Income Tax Ordinance 2001 (amended to 31.07.2025)',
      citationDate: '2026-10-06',
      verified: true,
      assumptions: ['Tax Year 2026 (1 Jul 2025 – 30 Jun 2026).'],
    },
  ],
};
