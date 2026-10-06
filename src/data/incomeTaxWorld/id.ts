/**
 * Indonesia — PPh 21 annual liability, single resident employee (TK/0). @ai2/tax-plugins — embracingearth.space
 *
 * Penghasilan Kena Pajak = gross − biaya jabatan (5%, max IDR 6,000,000; PMK 168/2023
 * Art. 10(2)) − employee JHT contribution (2%, Art. 10(1)(b)) − PTKP TK/0 IDR 54,000,000.
 * Bands: UU 7/2021 (HPP) Art. 17(1)(a). Monthly TER withholding (PP 58/2023) is payroll
 * mechanics; the December true-up brings the year to this Art. 17 liability.
 */
import type { CountryIncomeTaxData, DeductionRule, IncomeTaxYearData } from '../incomeTaxFactory';

const HPP = 'https://jdih.kemenkeu.go.id/dok/uu-7-tahun-2021';

const bands: IncomeTaxYearData['bands'] = [
  { upTo: 60000000, rate: 0.05 },
  { upTo: 250000000, rate: 0.15 },
  { upTo: 500000000, rate: 0.25 },
  { upTo: 5000000000, rate: 0.3 },
  { upTo: null, rate: 0.35 },
];

const deductions: DeductionRule[] = [
  { kind: 'share', name: 'Biaya jabatan (5%, max IDR 6,000,000)', rate: 0.05, max: 6000000 },
  { kind: 'share', name: 'Employee JHT old-age contribution (2%)', rate: 0.02 },
  { kind: 'fixed', name: 'PTKP (TK/0)', amount: 54000000 },
];

const year = (taxYear: string): IncomeTaxYearData => ({
  taxYear,
  effectiveFrom: `${taxYear}-01-01`,
  bands,
  deductions: [...deductions],
  source: HPP,
  authorityName: 'Kementerian Keuangan (JDIH) — UU 7/2021 and PMK 168/2023',
  citationDate: '2026-10-06',
  verified: true,
});

export const ID_INCOME_TAX: CountryIncomeTaxData = {
  code: 'ID',
  country: 'Indonesia',
  currency: 'IDR',
  locale: 'id-ID',
  timeZone: 'Asia/Jakarta',
  file: 'src/data/incomeTaxWorld/id.ts',
  note: 'Single resident permanent employee (PTKP status TK/0) with wage income only: annual PPh 21 liability under the Art. 17 bands on income after biaya jabatan (5%, max IDR 6,000,000), the 2% employee JHT contribution and PTKP of IDR 54,000,000. Monthly TER withholding is not modelled separately (it is reconciled to this figure in December). Excludes the employee JP pension contribution deduction, the sectoral PPh 21 DTP incentive, and BPJS contributions as charges. Indonesia has no regional personal income tax.',
  assumptions: [
    'Single resident permanent employee, no dependants (PTKP TK/0), wage income only; tax year = calendar year.',
    'BPJS social contributions (JHT, JP, JKN health) are not included as a charge. The deductible employee JHT contribution (2%) is deducted; the deductible JP contribution (1%) is not, because its wage cap was not confirmed, so tax may be slightly overstated.',
    'The PPh 21 borne-by-government (DTP) incentive for listed sectors is not applied.',
  ],
  years: [year('2026'), year('2025')],
};
