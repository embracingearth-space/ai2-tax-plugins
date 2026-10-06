/**
 * Argentina — Impuesto a las Ganancias on employment income (4th category,
 * art. 82 a–c LIG), single resident employee. @ai2/tax-plugins — embracingearth.space
 *
 * Annual liquidation ("liquidación anual y final") as published by ARCA: the
 * art. 94 scale applied to net income after the art. 30 personal deductions —
 * ganancia no imponible (a), deducción especial for employees (c ap. 2) and the
 * extra one-twelfth of (a) + (b) + (c ap. 2) the law adds where c.2 applies
 * (Ley 27.743). ARCA states the scale as "$X más Y% sobre el excedente de $Z",
 * which the marginal bands reproduce.
 *
 * Personal social-security contributions are deductible by law (Ley 24.241
 * art. 112), but the 2026/2025 contribution ceiling (base imponible máxima) and
 * the INSSJP 3% rate were not verified, so they are NOT deducted here.
 */
import type { CountryIncomeTaxData, DeductionRule } from '../incomeTaxFactory';

const personal = (gni: number, especial: number): DeductionRule[] => [
  { kind: 'fixed', name: 'Ganancia no imponible (art. 30 a)', amount: gni },
  { kind: 'fixed', name: 'Deducción especial — employees (art. 30 c ap. 2)', amount: especial },
  // One twelfth of a) + b) + c) ap. 2; b) (cargas de familia) is zero for a single person.
  { kind: 'fixed', name: 'Deducción especial — one-twelfth (art. 30, Ley 27.743)', amount: (gni + especial) / 12 },
];

export const AR_INCOME_TAX: CountryIncomeTaxData = {
  code: 'AR',
  country: 'Argentina',
  currency: 'ARS',
  locale: 'es-AR',
  timeZone: 'America/Argentina/Buenos_Aires',
  file: 'src/data/incomeTaxWorld/ar.ts',
  note: 'Single resident employee: Impuesto a las Ganancias on the annual art. 94 scale (5%–35%) after the ganancia no imponible and the employee deducción especial (including its one-twelfth top-up), using the July-updated annual amounts ARCA publishes for the final liquidation. Excludes personal social-security contributions (not deducted — see assumptions), family deductions and other general deductions.',
  assumptions: [
    'Single resident employee (4th category), no spouse or children, no other income and no general deductions (rent, medical, mortgage interest, etc.).',
    'Uses the annual "liquidación anual y final" scale and deductions; monthly withholding during the year uses semester tables and can differ.',
    'Personal social-security contributions (11% pension, 3% obra social, 3% INSSJP) are not included as charges and are NOT deducted, because their 2025/2026 contribution ceiling was not verified; taxable income therefore ignores them and the tax is overstated for most employees.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: [
        { upTo: 2336953.69, rate: 0.05 },
        { upTo: 4673907.36, rate: 0.09 },
        { upTo: 7010861.05, rate: 0.12 },
        { upTo: 10516291.59, rate: 0.15 },
        { upTo: 21032583.18, rate: 0.19 },
        { upTo: 31548874.77, rate: 0.23 },
        { upTo: 47323312.16, rate: 0.27 },
        { upTo: 70984968.25, rate: 0.31 },
        { upTo: null, rate: 0.35 },
      ],
      deductions: personal(6019671.36, 28894422.56),
      source: 'https://www.arca.gob.ar/gananciasYBienes/ganancias/personas-humanas-sucesiones-indivisas/declaracion-jurada/documentos/Tabla-Art-94-LIG-liquidacion-anual-y-final-2026.pdf',
      authorityName: 'ARCA (Agencia de Recaudación y Control Aduanero)',
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: [
        { upTo: 1749901.45, rate: 0.05 },
        { upTo: 3499802.89, rate: 0.09 },
        { upTo: 5249704.34, rate: 0.12 },
        { upTo: 7874556.52, rate: 0.15 },
        { upTo: 15749113.04, rate: 0.19 },
        { upTo: 23623669.56, rate: 0.23 },
        { upTo: 35435504.34, rate: 0.27 },
        { upTo: 53153256.52, rate: 0.31 },
        { upTo: null, rate: 0.35 },
      ],
      deductions: personal(4507505.52, 21636026.5),
      source: 'https://www.arca.gob.ar/gananciasYBienes/ganancias/personas-humanas-sucesiones-indivisas/declaracion-jurada/documentos/Tabla-Art-94-LIG-liquidacion-anual-y-final-2025.pdf',
      authorityName: 'ARCA (Agencia de Recaudación y Control Aduanero)',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
