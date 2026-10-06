/**
 * Norway — bracket tax (trinnskatt) and the 22% tax on general income,
 * single employee (tax class 1). @ai2/tax-plugins — embracingearth.space
 *
 * Two bases (Stortingets skattevedtak):
 *   trinnskatt   on personinntekt = gross wages, no deductions (the bands);
 *   22% tax      on alminnelig inntekt = wages − minstefradrag (46%, capped)
 *                − personfradrag. The 22% is municipal + county + state
 *                fellesskatt; the Storting sets the maximum municipal and
 *                county rates and Skatteetaten publishes the total as 22.0%
 *                for persons (18.5% in the Finnmark/Nord-Troms tiltakssone,
 *                not modelled). It is a statutory total, so it is a levy, not
 *                an optional local rate.
 * Trygdeavgift (national insurance) is out of scope.
 */
import type { CountryIncomeTaxData, IncomeTaxYearData } from '../incomeTaxFactory';

function year(
  taxYear: string,
  bands: IncomeTaxYearData['bands'],
  minstefradragMax: number,
  personfradrag: number,
  source: string,
  authorityName: string,
): IncomeTaxYearData {
  return {
    taxYear,
    effectiveFrom: `${taxYear}-01-01`,
    bands,
    levies: [
      {
        kind: 'custom',
        name: 'Tax on general income (alminnelig inntekt), 22%',
        amount: ({ gross }) => 0.22 * Math.max(0, gross - Math.min(0.46 * gross, minstefradragMax) - personfradrag),
      },
    ],
    source,
    authorityName,
    citationDate: '2026-10-06',
    verified: true,
  };
}

export const NO_INCOME_TAX: CountryIncomeTaxData = {
  code: 'NO',
  country: 'Norway',
  currency: 'NOK',
  locale: 'nb-NO',
  timeZone: 'Europe/Oslo',
  file: 'src/data/incomeTaxWorld/no.ts',
  note: 'Single employee, tax class 1: trinnskatt (bracket tax) on gross wages plus the 22% tax on general income (municipal, county and state fellesskatt) after the minstefradrag and personfradrag. Excludes trygdeavgift (national insurance), the Finnmark/Nord-Troms reduced rate, the trial arbeidsfradrag, and actual expenses in place of the minstefradrag.',
  assumptions: [
    'Single, no children, tax class 1, aged 17-69, resident all year outside the Finnmark/Nord-Troms tiltakssone, wage income only.',
    'Minstefradrag (46% of wages, capped) rather than actual expenses; the trial work deduction (skatteloven § 6-86) is not applied.',
    'Trygdeavgift (national insurance contribution) is a social contribution and is not included.',
  ],
  years: [
    year(
      '2026',
      [
        { upTo: 226100, rate: 0 },
        { upTo: 318300, rate: 0.017 },
        { upTo: 725050, rate: 0.04 },
        { upTo: 980100, rate: 0.137 },
        { upTo: 1467200, rate: 0.168 },
        { upTo: null, rate: 0.178 },
      ],
      95700,
      114540,
      'https://lovdata.no/dokument/STV/forskrift/2025-12-18-2747',
      'Stortinget — skattevedtak for inntektsåret 2026 (Lovdata)',
    ),
    year(
      '2025',
      [
        { upTo: 217400, rate: 0 },
        { upTo: 306050, rate: 0.017 },
        { upTo: 697150, rate: 0.04 },
        { upTo: 942400, rate: 0.137 },
        { upTo: 1410750, rate: 0.167 },
        { upTo: null, rate: 0.177 },
      ],
      92000,
      108550,
      'https://lovdata.no/dokument/STV/forskrift/2024-12-13-3203',
      'Stortinget — skattevedtak for inntektsåret 2025 (Lovdata)',
    ),
  ],
};
