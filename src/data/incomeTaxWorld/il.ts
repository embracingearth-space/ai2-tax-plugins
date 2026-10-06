/**
 * Israel — income tax on employment income, single resident employee.
 * @ai2/tax-plugins — embracingearth.space
 *
 * No personal allowance: relief is given as tax credit points (nekudot zikui),
 * ILS 2,904 a year per point in 2025 and 2026 (ILS 242/month; frozen 2025-27).
 * A resident man has 2.25 points = ILS 6,534. The top band (50%) is the 47%
 * rate plus the 3% surtax of s.121B above ILS 721,560 — surtax is part of
 * income tax, so it is in the bands.
 */
import type { CountryIncomeTaxData } from '../incomeTaxFactory';

// 2.25 points × ILS 2,904.
const credits = [{ kind: 'fixed', name: 'Resident credit points (2.25 × ILS 2,904)', amount: 6534 }] as const;

export const IL_INCOME_TAX: CountryIncomeTaxData = {
  code: 'IL',
  country: 'Israel',
  currency: 'ILS',
  locale: 'he-IL',
  timeZone: 'Asia/Jerusalem',
  file: 'src/data/incomeTaxWorld/il.ts',
  note: 'Single resident employee: income tax on employment income at 10% to 47%, plus the 3% surtax above ILS 721,560 (shown as a 50% band), less 2.25 resident credit points. Excludes Bituach Leumi and health insurance contributions, the extra credit points for women, children, new immigrants and degrees, and benefit-locality credits.',
  assumptions: [
    'Single resident man aged 18 to retirement age, no children: 2.25 credit points (a woman has 2.75 = ILS 7,986, not modelled). The number of points is not confirmed from an official source.',
    'Social contributions are not included: Bituach Leumi (National Insurance) and health insurance contributions are not income tax.',
    'The extra 2% surtax on capital income does not apply to wages.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      // 20%/31% limits 228,000 / 301,200 per the March-2026 amendment (retroactive to 1 Jan 2026), from secondary sources;
      // the Tax Authority's pre-amendment Feb-2026 booklet shows 193,800 / 269,280.
      bands: [
        { upTo: 84120, rate: 0.1 },
        { upTo: 120720, rate: 0.14 },
        { upTo: 228000, rate: 0.2 },
        { upTo: 301200, rate: 0.31 },
        { upTo: 560280, rate: 0.35 },
        { upTo: 721560, rate: 0.47 },
        { upTo: null, rate: 0.5 },
      ],
      credits: [...credits],
      source: 'https://taxes-refund.co.il/tax-brackets/',
      authorityName: 'taxes-refund.co.il (secondary; Israel Tax Authority not reachable)',
      citationDate: '2026-10-06',
      verified: false,
      verificationNote:
        'The widened 20% and 31% band limits (ILS 228,000 / 301,200) enacted in March 2026 come from secondary sources only; gov.il blocked automated access, and the Tax Authority booklet read via an archive copy predates the amendment.',
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: [
        { upTo: 84120, rate: 0.1 },
        { upTo: 120720, rate: 0.14 },
        { upTo: 193800, rate: 0.2 },
        { upTo: 269280, rate: 0.31 },
        { upTo: 560280, rate: 0.35 },
        { upTo: 721560, rate: 0.47 },
        { upTo: null, rate: 0.5 },
      ],
      credits: [...credits],
      source:
        'https://web.archive.org/web/20261002160831id_/https://www.gov.il/BlobFolder/generalpage/income-tax-annual-deductions-booklet/he/generalInformation_income-tax-yearly-deductions-booklet_yearly-deductions-booklet-2025.pdf',
      authorityName: 'Israel Tax Authority — annual deductions booklet 2025 (Internet Archive copy)',
      citationDate: '2026-10-06',
      verified: false,
      verificationNote:
        'The figures were read from an Internet Archive copy of the Tax Authority 2025 booklet because gov.il blocked automated access; they match the OECD tax database, but confirm on gov.il.',
    },
  ],
};
