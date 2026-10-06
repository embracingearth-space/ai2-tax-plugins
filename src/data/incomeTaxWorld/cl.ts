/**
 * Chile — Impuesto Único de Segunda Categoría on salary, single resident
 * employee with one employer. @ai2/tax-plugins — embracingearth.space
 *
 * The scale is fixed in UTA (13.5 / 30 / 50 / 70 / 90 / 120 / 310 UTA at 0% /
 * 4% / 8% / 13.5% / 23% / 30.4% / 35% / 40%); CLP limits = UTA × the UTA value
 * the research states for the year. Taxable income is pay after the employee's
 * mandatory contributions, which the law deducts: AFP 10% + AFP commission,
 * health 7% (capped at the monthly pension/health ceiling in UF) and seguro de
 * cesantía 0.6% (indefinite contract, own ceiling in UF). UF ceilings are
 * converted at the UF value the research names.
 */
import type { CountryIncomeTaxData, DeductionRule } from '../incomeTaxFactory';

const contributions = (pensionHealthRate: number, pensionHealthCeilingMonthly: number, cesantiaCeilingMonthly: number): DeductionRule[] => [
  {
    kind: 'share',
    name: 'AFP pension + health contributions',
    rate: pensionHealthRate,
    ceiling: 12 * pensionHealthCeilingMonthly,
  },
  { kind: 'share', name: 'Seguro de cesantía (employee, indefinite contract)', rate: 0.006, ceiling: 12 * cesantiaCeilingMonthly },
];

export const CL_INCOME_TAX: CountryIncomeTaxData = {
  code: 'CL',
  country: 'Chile',
  currency: 'CLP',
  locale: 'es-CL',
  timeZone: 'America/Santiago',
  file: 'src/data/incomeTaxWorld/cl.ts',
  note: 'Single resident employee with one employer: Impuesto Único de Segunda Categoría on the annualised UTA scale (0%–40%) after the deductible employee pension, health and unemployment-insurance contributions. Excludes those contributions as charges, voluntary pension savings (APV), Isapre premiums above 7%, and other income (Global Complementario).',
  assumptions: [
    'Single resident employee, one employer, indefinite contract, paid the same salary every month; Fonasa 7% for health.',
    'Employee social-security contributions (AFP 10% + commission, health 7%, seguro de cesantía 0.6%) are deducted from taxable income as the law requires, up to their monthly UF ceilings, but are not included as charges.',
    'Monthly withholding uses each month\'s UTM, so the sum of monthly tax can differ slightly from this annualised scale.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      // UTA × 865,812 (October 2026 UTA, SII); = 12 × the October 2026 monthly SII table.
      bands: [
        { upTo: 11688462, rate: 0 },
        { upTo: 25974360, rate: 0.04 },
        { upTo: 43290600, rate: 0.08 },
        { upTo: 60606840, rate: 0.135 },
        { upTo: 77923080, rate: 0.23 },
        { upTo: 103897440, rate: 0.304 },
        { upTo: 268401720, rate: 0.35 },
        { upTo: null, rate: 0.4 },
      ],
      // 10% AFP + 0.46% AFP Uno commission (named default) + 7% health; ceiling 90.0 UF × 41,106.35 = 3,699,571.50/month.
      // Cesantía ceiling 135.2 UF × 41,106.35 = 5,557,578.52/month.
      deductions: contributions(0.1746, 3699571.5, 5557578.52),
      source: 'https://www.sii.cl/valores_y_fechas/impuesto_2da_categoria/impuesto2026.htm',
      authorityName: 'Servicio de Impuestos Internos (SII)',
      citationDate: '2026-10-06',
      verified: false,
      verificationNote:
        'The CLP band limits use the October 2026 UTA (CLP 865,812); the final annual table for 2026 uses the December 2026 UTA, not yet published. Contribution ceilings use the UF of 6 Oct 2026 and the 90.0 / 135.2 UF ceilings for the whole year.',
      assumptions: ['AFP commission: AFP Uno 0.46% (lowest; official range 0.46%–1.45%).'],
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      // SII Global Complementario table AT 2026 (income 2025) at December 2025 UTA 834,504.
      bands: [
        { upTo: 11265804, rate: 0 },
        { upTo: 25035120, rate: 0.04 },
        { upTo: 41725200, rate: 0.08 },
        { upTo: 58415280, rate: 0.135 },
        { upTo: 75105360, rate: 0.23 },
        { upTo: 100140480, rate: 0.304 },
        { upTo: 258696240, rate: 0.35 },
        { upTo: null, rate: 0.4 },
      ],
      // 10% AFP + 7% health (AFP commission omitted: Jan–Sep 2025 rates not verified); ceiling 87.8 UF × 39,727.96 = 3,488,114.89/month.
      // Cesantía ceiling 131.8 UF × 39,727.96 = 5,236,145.13/month.
      deductions: contributions(0.17, 3488114.89, 5236145.13),
      source: 'https://www.sii.cl/valores_y_fechas/renta/2026/personas_naturales.html',
      authorityName: 'Servicio de Impuestos Internos (SII)',
      citationDate: '2026-10-06',
      verified: true,
      assumptions: [
        'AFP commission is not deducted for 2025 (per-AFP rates for January–September 2025 were not verified), so taxable income is slightly overstated.',
        'Contribution ceilings 87.8 UF (pension/health) and 131.8 UF (cesantía) converted at the UF of 31 Dec 2025 (CLP 39,727.96).',
      ],
    },
  ],
};
