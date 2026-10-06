/**
 * Guatemala — ISR on employment income (rentas del trabajo, LAT Decreto 10-2012
 * Libro I Título III), single resident employee. @ai2/tax-plugins — embracingearth.space
 *
 * Renta imponible = salary − Q48,000 personal deduction without proof (art. 72 a)
 * − IGSS employee contributions (art. 72 c) − for 2026 only the extraordinary
 * Q3,024 deduction (Decreto 13-2026 art. 4). Tax: 5% to Q300,000, then
 * Q15,000 + 7% of the excess (art. 73).
 *
 * Every year is unverified: congreso.gob.gt and portal.sat.gob.gt block
 * automated access, so the decrees were read on web.archive.org snapshots.
 */
import type { CountryIncomeTaxData, DeductionRule } from '../incomeTaxFactory';

const NOTE =
  "Guatemala's official sites (SAT and Congreso) blocked automated access; the figures were read from archived copies of Decreto 10-2012 and Decreto 13-2026, and later amendments to arts. 72–73 were not checked against a consolidated text.";

const bands = [
  { upTo: 300000, rate: 0.05 },
  { upTo: null, rate: 0.07 },
];

const personal: DeductionRule = { kind: 'fixed', name: 'Personal deduction without proof (LAT art. 72 a)', amount: 48000 };
// IGSS cuota laboral 4.83% of salary (IGSS); no ceiling stated in the source.
const igss: DeductionRule = { kind: 'share', name: 'IGSS employee contributions (LAT art. 72 c)', rate: 0.0483 };

export const GT_INCOME_TAX: CountryIncomeTaxData = {
  code: 'GT',
  country: 'Guatemala',
  currency: 'GTQ',
  locale: 'es-GT',
  timeZone: 'America/Guatemala',
  file: 'src/data/incomeTaxWorld/gt.ts',
  note: 'Single resident employee: ISR on salary at 5% / 7% after the Q48,000 personal deduction, the IGSS employee contributions and, for 2026, the extraordinary Q3,024 deduction. Excludes the optional up-to-Q12,000 IVA-invoice deduction, donations, life-insurance premiums, the bonificación incentivo, and the IGSS contributions themselves as a charge.',
  assumptions: [
    'Single resident employee (relación de dependencia), calendar liquidation period.',
    'Gross is taxable salary only: aguinaldo and Bono 14 (exempt up to one monthly salary each, LAT art. 70) and the bonificación incentivo are not part of the input.',
    'IGSS employee social-security contributions (4.83% of salary, no ceiling assumed) are deducted from taxable income as the law allows, but are not added as a charge.',
    'The optional IVA-invoice deduction (up to Q12,000) is not assumed.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands,
      deductions: [
        personal,
        { kind: 'fixed', name: 'Extraordinary deduction 2026 (Decreto 13-2026 art. 4)', amount: 3024 },
        igss,
      ],
      source: 'https://www.congreso.gob.gt/assets/uploads/info_legislativo/decretos/2012/010-2012.pdf',
      authorityName: 'Congreso de la República de Guatemala — Decreto 10-2012 (Ley de Actualización Tributaria) and Decreto 13-2026',
      citationDate: '2026-10-06',
      verified: false,
      verificationNote: NOTE,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands,
      deductions: [personal, igss],
      source: 'https://www.congreso.gob.gt/assets/uploads/info_legislativo/decretos/2012/010-2012.pdf',
      authorityName: 'Congreso de la República de Guatemala — Decreto 10-2012 (Ley de Actualización Tributaria)',
      citationDate: '2026-10-06',
      verified: false,
      verificationNote: NOTE,
    },
  ],
};
