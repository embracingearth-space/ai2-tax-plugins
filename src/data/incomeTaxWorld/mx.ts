/**
 * Mexico — ISR on salaries (LISR Título IV, Capítulo I), single resident employee.
 * @ai2/tax-plugins — embracingearth.space
 *
 * The annual tariff (art. 152 LISR, published in Anexo 8 RMF) is a table of
 * lower limit + cuota fija + rate on the excess over the lower limit. It is
 * implemented exactly as that table (`tariff`); `bands` restate it as
 * marginal rates for display. There is no tax-free allowance.
 *
 * Subsidio para el empleo (decree DOF 31-12-2025 / 31-12-2024): a monthly,
 * non-refundable credit against ISR for months whose ISR-base income does not
 * exceed the decree limit. Annualised here as 12 monthly amounts, granted when
 * gross / 12 is within the limit, and capped at the tax (excess neither paid
 * nor carried forward — base decree DOF 01-05-2024, art. Segundo).
 */
import type { CountryIncomeTaxData, CreditRule } from '../incomeTaxFactory';
import type { MoneyRounding } from '../incomeTax';

type Row = readonly [lowerLimit: number, cuotaFija: number, rate: number];

/** Art. 152 tariff: cuota fija + rate × (taxable − lower limit) in the row containing taxable. */
const tariffFrom = (rows: readonly Row[]) => (taxable: number, q: MoneyRounding): number => {
  if (taxable <= 0) return 0;
  let row = rows[0]!;
  for (const r of rows) if (taxable >= r[0]) row = r;
  return q.round(row[1] + (taxable - row[0]) * row[2]);
};

// Anexo 8 RMF 2026, C.II — annual tariff for ejercicio 2026.
const ROWS_2026: Row[] = [
  [0.01, 0, 0.0192],
  [10135.12, 194.59, 0.064],
  [86022.12, 5051.37, 0.1088],
  [151176.2, 12140.13, 0.16],
  [175735.67, 16069.64, 0.1792],
  [210403.7, 22282.14, 0.2136],
  [424353.98, 67981.92, 0.2352],
  [668840.15, 125485.07, 0.3],
  [1276925.99, 307910.81, 0.32],
  [1702567.98, 444116.23, 0.34],
  [5107703.93, 1601862.46, 0.35],
];

// Anexo 8 RMF 2025, C.II — annual tariff for ejercicio 2025.
const ROWS_2025: Row[] = [
  [0.01, 0, 0.0192],
  [8952.5, 171.88, 0.064],
  [75984.56, 4461.94, 0.1088],
  [133536.08, 10723.55, 0.16],
  [155229.81, 14194.54, 0.1792],
  [185852.58, 19682.13, 0.2136],
  [374837.89, 60049.4, 0.2352],
  [590796.0, 110842.74, 0.3],
  [1127926.85, 271981.99, 0.32],
  [1503902.47, 392294.17, 0.34],
  [4511707.38, 1414947.85, 0.35],
];

const subsidio = (annualAmount: number, monthlyIncomeLimit: number): CreditRule => ({
  kind: 'custom',
  name: 'Subsidio para el empleo',
  // Compared in cents so 12 × the limit itself qualifies despite float error.
  amount: ({ gross }) => (Math.round((gross / 12) * 100) <= Math.round(monthlyIncomeLimit * 100) ? annualAmount : 0),
});

export const MX_INCOME_TAX: CountryIncomeTaxData = {
  code: 'MX',
  country: 'Mexico',
  currency: 'MXN',
  locale: 'es-MX',
  timeZone: 'America/Mexico_City',
  file: 'src/data/incomeTaxWorld/mx.ts',
  note: 'Single resident employee: annual ISR on salary under the art. 152 LISR tariff, less the subsidio para el empleo where monthly income is within the decree limit. Excludes IMSS/RCV employee contributions, exempt income (aguinaldo, PTU, prima vacacional exemptions) and annual personal deductions (art. 151).',
  assumptions: [
    'Single resident employee with one employer, paid the same salary every month; gross is all taxable salary (no aguinaldo, PTU or other exempt income).',
    'No annual personal deductions (art. 151 LISR). Mexico has no tax-free allowance: the first tariff row is taxed at 1.92%.',
    'Subsidio para el empleo annualised as twelve monthly amounts, granted only when gross ÷ 12 does not exceed the monthly limit; it cannot exceed the tax.',
    'IMSS and retirement (RCV) employee social-security contributions are not included and are not deducted.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: [
        { upTo: 10135.11, rate: 0.0192 },
        { upTo: 86022.11, rate: 0.064 },
        { upTo: 151176.19, rate: 0.1088 },
        { upTo: 175735.66, rate: 0.16 },
        { upTo: 210403.69, rate: 0.1792 },
        { upTo: 424353.97, rate: 0.2136 },
        { upTo: 668840.14, rate: 0.2352 },
        { upTo: 1276925.98, rate: 0.3 },
        { upTo: 1702567.97, rate: 0.32 },
        { upTo: 5107703.92, rate: 0.34 },
        { upTo: null, rate: 0.35 },
      ],
      tariff: tariffFrom(ROWS_2026),
      // January: 15.59% × UMA-2025 monthly 3,439.46 = 536.21; Feb–Dec: 15.02% × UMA-2026 monthly 3,566.22 = 535.65.
      // 536.21 + 11 × 535.65 = 6,428.36. Monthly income limit MXN 11,492.66 (decree DOF 31-12-2025).
      credits: [subsidio(6428.36, 11492.66)],
      source: 'https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2026/rmf/anexos/Anexo-8-RMF-2026_DOF-28122025.pdf',
      authorityName: 'Servicio de Administración Tributaria (SAT) — Anexo 8 RMF 2026, DOF',
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: [
        { upTo: 8952.49, rate: 0.0192 },
        { upTo: 75984.55, rate: 0.064 },
        { upTo: 133536.07, rate: 0.1088 },
        { upTo: 155229.8, rate: 0.16 },
        { upTo: 185852.57, rate: 0.1792 },
        { upTo: 374837.88, rate: 0.2136 },
        { upTo: 590795.99, rate: 0.2352 },
        { upTo: 1127926.84, rate: 0.3 },
        { upTo: 1503902.46, rate: 0.32 },
        { upTo: 4511707.37, rate: 0.34 },
        { upTo: null, rate: 0.35 },
      ],
      tariff: tariffFrom(ROWS_2025),
      // Feb–Dec: 13.8% × UMA-2025 monthly 3,439.46 = 474.65. January 2025 (14.39% × UMA-2024) is not
      // verified, so the Feb–Dec amount is borrowed for January: 12 × 474.65 = 5,695.80. Limit MXN 10,171.00.
      credits: [subsidio(5695.8, 10171)],
      source: 'https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2025/rmf/anexos/Anexo8_RMF2025-30122024.pdf',
      authorityName: 'Servicio de Administración Tributaria (SAT) — Anexo 8 RMF 2025, DOF',
      citationDate: '2026-10-06',
      verified: false,
      verificationNote:
        'The 2025 tariff is confirmed in Anexo 8 RMF 2025, but the January 2025 subsidio para el empleo depends on the 2024 UMA, which was not verified; the February–December monthly amount (MXN 474.65) is used for January too.',
      assumptions: ['Subsidio para el empleo 2025: MXN 474.65 a month for all twelve months (January amount borrowed from February–December).'],
    },
  ],
};
