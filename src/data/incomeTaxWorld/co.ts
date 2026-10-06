/**
 * Colombia — impuesto sobre la renta, cédula general (labour income), single
 * resident employee. @ai2/tax-plugins — embracingearth.space
 *
 * Renta líquida gravable = labour income
 *   − ingresos no constitutivos de renta (INCR): employee pension 4%, Fondo de
 *     Solidaridad Pensional (1% of the whole IBC once IBC ≥ 4 SMMLV, +0.2–1%
 *     from 16 SMMLV — Ley 100 art. 20) and health 4% (Ley 1122 art. 10), on a
 *     monthly IBC capped at 25 SMMLV;
 *   − 25% labour exemption (ET art. 206 num. 10), capped at 790 UVT. (The art.
 *     336 global cap of 40% / 1,340 UVT never binds with only this exemption.)
 * Tax: the art. 241 ET table, which is stated in UVT with fixed amounts
 * (+116 / +788 / +2,296 / +5,901 / +10,352 UVT); implemented exactly as that
 * table in UVT and converted at the year's UVT value. `bands` show the COP
 * limits (UVT × value, rounded to the nearest 1,000 per ET art. 868).
 */
import type { CountryIncomeTaxData, DeductionRule } from '../incomeTaxFactory';
import type { MoneyRounding } from '../incomeTax';

/** Art. 241 ET: [lower UVT, fixed UVT, marginal rate]. */
const ART_241: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [1090, 0, 0.19],
  [1700, 116, 0.28],
  [4100, 788, 0.33],
  [8670, 2296, 0.35],
  [18970, 5901, 0.37],
  [31000, 10352, 0.39],
];

const tariff = (uvt: number) => (taxable: number, q: MoneyRounding): number => {
  const x = taxable / uvt;
  let row = ART_241[0]!;
  for (const r of ART_241) if (x > r[0]) row = r;
  return q.round((row[1] + (x - row[0]) * row[2]) * uvt);
};

/** Employee pension + FSP + health on the monthly IBC (gross / 12, capped at 25 SMMLV), annualised. */
const incr = (smmlv: number): DeductionRule => ({
  kind: 'custom',
  name: 'Mandatory pension, FSP and health contributions (INCR)',
  amount: ({ gross }) => {
    const monthly = gross / 12;
    const ibc = Math.min(monthly, 25 * smmlv);
    const inSmmlv = monthly / smmlv;
    let fsp = 0;
    if (inSmmlv >= 4) fsp = 0.01;
    if (inSmmlv >= 16) fsp += 0.002;
    if (inSmmlv >= 17) fsp += 0.002;
    if (inSmmlv >= 18) fsp += 0.002;
    if (inSmmlv >= 19) fsp += 0.002;
    if (inSmmlv >= 20) fsp += 0.002;
    return 12 * ibc * (0.04 + 0.04 + fsp);
  },
});

const exemption = (cap: number): DeductionRule => ({
  kind: 'custom',
  name: '25% labour-income exemption (ET art. 206 num. 10)',
  amount: ({ gross, deductedSoFar }) => Math.min(0.25 * Math.max(0, gross - deductedSoFar), cap),
});

const NOTE =
  'The art. 241 table and the art. 206 / 336 limits were read on the Senate\'s official Estatuto Tributario text (secretariasenado.gov.co), which is served only over http, not https; the UVT value is from DIAN (https).';

export const CO_INCOME_TAX: CountryIncomeTaxData = {
  code: 'CO',
  country: 'Colombia',
  currency: 'COP',
  locale: 'es-CO',
  timeZone: 'America/Bogota',
  file: 'src/data/incomeTaxWorld/co.ts',
  note: 'Single resident employee: income tax on the cédula general under the art. 241 ET table (0%–39%, in UVT) after the mandatory pension, solidarity-fund and health contributions and the 25% labour exemption (capped at 790 UVT). Excludes dependants, other deductions (interest, prepaid health, voluntary pension), the 1% e-invoice deduction, and the contributions themselves as charges.',
  assumptions: [
    'Single resident employee, ordinary (non-integral) salary, paid the same salary every month, no dependants and no other income.',
    'Employee social-security contributions (pension 4%, Fondo de Solidaridad Pensional 1–2% from 4 SMMLV, health 4%, on a monthly base capped at 25 SMMLV) are subtracted as non-taxable income as the law provides, but are not included as charges.',
    'Only the 25% labour exemption is claimed; no other exempt income or deductions.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: [
        { upTo: 57088000, rate: 0 },
        { upTo: 89036000, rate: 0.19 },
        { upTo: 214733000, rate: 0.28 },
        { upTo: 454083000, rate: 0.33 },
        { upTo: 993535000, rate: 0.35 },
        { upTo: 1623594000, rate: 0.37 },
        { upTo: null, rate: 0.39 },
      ],
      tariff: tariff(52374), // UVT 2026 = COP 52,374 (DIAN Res. 000238/2025)
      // SMMLV 2026 = COP 1,750,905; 790 UVT = COP 41,375,000 (art. 868 rounding).
      deductions: [incr(1750905), exemption(41375000)],
      source: 'https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0238_2025.htm',
      authorityName: 'DIAN / Estatuto Tributario (Secretaría General del Senado)',
      citationDate: '2026-10-06',
      verified: false,
      verificationNote: NOTE,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: [
        { upTo: 54281000, rate: 0 },
        { upTo: 84658000, rate: 0.19 },
        { upTo: 204176000, rate: 0.28 },
        { upTo: 431757000, rate: 0.33 },
        { upTo: 944687000, rate: 0.35 },
        { upTo: 1543769000, rate: 0.37 },
        { upTo: null, rate: 0.39 },
      ],
      tariff: tariff(49799), // UVT 2025 = COP 49,799 (DIAN Res. 000193/2024)
      // SMMLV 2025 = COP 1,423,500; 790 UVT = COP 39,341,000.
      deductions: [incr(1423500), exemption(39341000)],
      source: 'https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0193_2024.htm',
      authorityName: 'DIAN / Estatuto Tributario (Secretaría General del Senado)',
      citationDate: '2026-10-06',
      verified: false,
      verificationNote: NOTE,
    },
  ],
};
