/**
 * Türkiye — gelir vergisi on wages (GVK md. 103, wage column), single employee.
 * @ai2/tax-plugins — embracingearth.space
 *
 * Base = gross − employee SGK (9% pension + 5% health) and unemployment (1%)
 * premiums, capped at 12 × the monthly upper earnings limit. Minimum-wage
 * exemption (GVK md. 23/18): the tax on the minimum wage net of the same
 * premiums is not charged. Summed over a year of cumulative monthly
 * withholding that is the tariff's tax on 12 × minimum wage × 0.85, which the
 * `taxOnAmount` credit computes (evenly paid wages assumed).
 */
import type { CountryIncomeTaxData } from '../incomeTaxFactory';

const AUTHORITY = 'Gelir İdaresi Başkanlığı (GİB)';

export const TR_INCOME_TAX: CountryIncomeTaxData = {
  code: 'TR',
  country: 'Türkiye',
  currency: 'TRY',
  locale: 'tr-TR',
  timeZone: 'Europe/Istanbul',
  file: 'src/data/incomeTaxWorld/tr.ts',
  note: 'Single resident private-sector employee: wage-income tariff (15–40%) on gross pay less employee SGK and unemployment premiums, less the minimum-wage income-tax exemption. Excludes the premiums themselves, stamp duty on wages (0.759% above the minimum wage, a separate tax), disability and sector-specific exemptions.',
  assumptions: [
    'Single, no children, resident employee (4/a insured) with one employer, paid evenly over the year.',
    'Employee social insurance premiums (9% pension, 5% health, 1% unemployment, capped at 12 × the monthly upper earnings limit) are deducted from the tax base but not included in the tax shown.',
    'Stamp duty (damga vergisi) on wages is not included.',
    'The minimum-wage exemption is computed on an annual basis as the tariff tax on 12 × the monthly gross minimum wage net of premiums; month-by-month payroll may differ slightly.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: [
        { upTo: 190000, rate: 0.15 },
        { upTo: 400000, rate: 0.2 },
        { upTo: 1500000, rate: 0.27 },
        { upTo: 5300000, rate: 0.35 },
        { upTo: null, rate: 0.4 },
      ],
      // Monthly upper limit TRY 297,270 × 12.
      deductions: [{ kind: 'share', name: 'Employee SGK + unemployment premiums (15%)', rate: 0.15, ceiling: 3567240 }],
      // Minimum wage TRY 33,030/month × 12 × 0.85 = 336,906.
      credits: [{ kind: 'taxOnAmount', name: 'Minimum-wage income-tax exemption (GVK md. 23/18)', amount: 336906 }],
      source: 'https://cdn.gib.gov.tr/api/gibportal-file/file/getFileResources?objectKey=arsiv%2Fyardim-kaynaklar%2Fyararli-bilgiler%2Fgelir-vergisi-tarifeleri%2Fgelir-vergisi-tarifesi-2026.pdf',
      authorityName: AUTHORITY,
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: [
        { upTo: 158000, rate: 0.15 },
        { upTo: 330000, rate: 0.2 },
        { upTo: 1200000, rate: 0.27 },
        { upTo: 4300000, rate: 0.35 },
        { upTo: null, rate: 0.4 },
      ],
      // Monthly upper limit TRY 195,041.40 (daily 6,501.38 × 30) × 12.
      deductions: [{ kind: 'share', name: 'Employee SGK + unemployment premiums (15%)', rate: 0.15, ceiling: 2340496.8 }],
      // Minimum wage TRY 26,005.50/month × 12 × 0.85 = 265,256.10.
      credits: [{ kind: 'taxOnAmount', name: 'Minimum-wage income-tax exemption (GVK md. 23/18)', amount: 265256.1 }],
      source: 'https://cdn.gib.gov.tr/api/gibportal-file/file/getFileResources?objectKey=arsiv%2Fyardim-kaynaklar%2Fyararli-bilgiler%2Fgelir-vergisi-tarifeleri%2Fgelir-vergisi-tarifesi-2025.pdf',
      authorityName: AUTHORITY,
      citationDate: '2026-10-06',
      verified: true,
      assumptions: ['The 2025 SGK upper earnings limit is derived from the daily limit (× 30) on an SGK page that prints it with a typo.'],
    },
  ],
};
