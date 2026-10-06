/**
 * Switzerland — direct federal tax (DBST, Art. 36(1) DBG), single person. @ai2/tax-plugins — embracingearth.space
 *
 * FEDERAL TAX ONLY. Cantonal and communal income taxes — usually the larger
 * part — are excluded: the research named the City of Zurich as a default but
 * could not retrieve the Canton Zurich tariff from an official source.
 *
 * The tariff is statutory: taxable income is taken in full CHF 100, the tax is
 * the formula amount ("für X Franken Y Franken und für je weitere 100 Franken
 * Z Franken mehr"), from the top threshold a flat 11.5% of the whole income,
 * and tax below CHF 25 is not levied.
 *
 * Figures read on estv.admin.ch and ahv-iv.ch on 2026-10-06.
 */
import type { CountryIncomeTaxData, IncomeTaxYearData } from '../incomeTaxFactory';
import type { IncomeTaxBand, MoneyRounding } from '../incomeTax';
import { progressive } from '../incomeTaxMath';

/** Art. 36(1) DBG as a tariff: CHF 100 steps, flat 11.5% from `flatFrom`, nil under CHF 25. */
function tariff(bands: IncomeTaxBand[], flatFrom: number) {
  return (taxable: number, q: MoneyRounding): number => {
    const t = q.floor(taxable / 100) * 100;
    const tax = t >= flatFrom ? t * 0.115 : progressive(t, bands);
    return tax < 25 ? 0 : q.floor(tax);
  };
}

const BANDS_2026: IncomeTaxBand[] = [
  { upTo: 15200, rate: 0 },
  { upTo: 33200, rate: 0.0077 },
  { upTo: 43500, rate: 0.0088 },
  { upTo: 58000, rate: 0.0264 },
  { upTo: 76200, rate: 0.0297 },
  { upTo: 82100, rate: 0.0594 },
  { upTo: 108900, rate: 0.066 },
  { upTo: 141500, rate: 0.088 },
  { upTo: 185100, rate: 0.11 },
  { upTo: 793900, rate: 0.132 },
  { upTo: null, rate: 0.115 },
];

const BANDS_2025: IncomeTaxBand[] = [
  { upTo: 15200, rate: 0 },
  { upTo: 33200, rate: 0.0077 },
  { upTo: 43500, rate: 0.0088 },
  { upTo: 58000, rate: 0.0264 },
  { upTo: 76100, rate: 0.0297 },
  { upTo: 82000, rate: 0.0594 },
  { upTo: 108800, rate: 0.066 },
  { upTo: 141500, rate: 0.088 },
  { upTo: 184900, rate: 0.11 },
  { upTo: 793300, rate: 0.132 },
  { upTo: null, rate: 0.115 },
];

/** Same deduction parameters in 2025 and 2026 (ESTV Rundschreiben 2-215 deduction table). */
const deductions: IncomeTaxYearData['deductions'] = [
  { kind: 'share', name: 'AHV/IV/EO employee contribution', rate: 0.053 },
  { kind: 'share', name: 'ALV employee contribution', rate: 0.011, ceiling: 148200 },
  { kind: 'fixed', name: 'Übrige Berufskosten (minimum flat deduction)', amount: 2000 },
  { kind: 'fixed', name: 'Versicherungsprämien und Sparzinsen (single, with pillar 2)', amount: 1800 },
];

export const CH_INCOME_TAX: CountryIncomeTaxData = {
  code: 'CH',
  country: 'Switzerland',
  currency: 'CHF',
  locale: 'de-CH',
  timeZone: 'Europe/Zurich',
  file: 'src/data/incomeTaxWorld/ch.ts',
  note: 'Direct federal tax only, for a single person without church membership, after employee AHV/IV/EO and ALV contributions, the minimum CHF 2,000 professional-expense deduction and the CHF 1,800 insurance deduction. EXCLUDES cantonal and communal income tax, which is usually larger than the federal tax, so this is not the full Swiss income tax. Also excludes pillar 2 (BVG) and NBU contributions, commuting costs and social contributions as a charge.',
  region: 'Federal tax only — cantonal and communal income taxes are not included',
  assumptions: [
    'Single, no children, no church membership, resident employee.',
    'Cantonal and communal income taxes are NOT included; they vary by canton and commune and no official default tariff was obtained.',
    'Employee AHV/IV/EO (5.3%) and ALV (1.1% up to CHF 148,200) social contributions are deducted from taxable income but not included in the tax; pillar 2 (BVG) and NBU contributions depend on the employer plan and are not deducted.',
    'Only the minimum CHF 2,000 flat professional-expense deduction is applied (the maximum is CHF 4,000), so tax may be slightly overstated; the insurance deduction is the CHF 1,800 for a single person with pillar 2 contributions.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: BANDS_2026,
      // 794,000 → 91,310.00 = 11.5% of the whole income.
      tariff: tariff(BANDS_2026, 794000),
      deductions,
      source: 'https://www.estv.admin.ch/dam/de/sd-web/vFK3ntWLQ4s4/2-215-D-2025-d.pdf',
      authorityName: 'Eidgenössische Steuerverwaltung ESTV',
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: BANDS_2025,
      // 793,400 → 91,241.00 = 11.5% of the whole income.
      tariff: tariff(BANDS_2025, 793400),
      deductions,
      source: 'https://www.estv.admin.ch/dam/de/sd-web/zkUbFt0fCQiy/dbst-rs-2-210-d-2024-de.pdf',
      authorityName: 'Eidgenössische Steuerverwaltung ESTV',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
