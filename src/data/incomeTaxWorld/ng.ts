/**
 * Nigeria — personal income tax (PAYE), single resident employee.
 * @ai2/tax-plugins — embracingearth.space
 *
 * 2026: Nigeria Tax Act 2025 (commencement 1 January 2026, repeals PITA).
 *   Fourth Schedule bands with a 0% first N800,000, applied after the
 *   s.30(2)(a) eligible deductions; the Consolidated Relief Allowance is abolished.
 * 2025: Personal Income Tax Act (as amended 2011). Sixth Schedule bands on
 *   income after the CRA (N200,000 or 1% of gross, whichever is higher, plus
 *   20% of gross, s.33(1)) and the Sixth Schedule para 2 tax-exempt
 *   deductions; minimum tax of 1% of gross income (s.37).
 * Both years: the employee's 8% contribution under the Pension Reform Act 2014
 * (s.4(1)(b), on monthly emoluments of at least basic + housing + transport,
 * s.120) is deductible — NTA 2025 s.30(2)(a)(iii); PITA Sixth Schedule para
 * 2(d); PRA s.10(1). The National Housing Fund contribution (2.5%) is
 * deductible too (NTA s.30(2)(a)(i); PITA para 2(a)) but is NOT applied to an
 * employee: since the Business Facilitation (Miscellaneous Provisions) Act 2023
 * (s.45, amending NHF Act s.4) it is compulsory only for public-sector employees
 * and the self-employed and voluntary for private-sector employees — per KPMG
 * Nigeria and Templars; the amending Act's text was not found on an official
 * site. With incomeType 'self-employed' the pension (voluntary for them, PRA
 * s.2(3)) is dropped and the compulsory NHF contribution deducted instead.
 * Read 2026-10-11: NTA gazette p. A415, PenCom's PRA 2014 copy, PITA (Amendment) Act 2011 p. A392.
 */
import type { CountryIncomeTaxData, DeductionRule } from '../incomeTaxFactory';

const NTA_2025 = 'https://lirs.gov.ng/assets/docs/Gazette%20-%20NIGERIA%20TAX%20ACT,%202025.pdf';
const PIT_RATES = 'https://lirs.gov.ng/assets/docs/pit-tax-rate.pdf';

const selfEmployed = (options: { incomeType?: string }) => options.incomeType === 'self-employed';

/** An employee's compulsory contribution is the 8% pension; for the self-employed the pension is
 *  voluntary (PRA s.2(3)) but the 2.5% NHF contribution is compulsory (NHF Act s.4 as amended in 2023). */
const contributions: DeductionRule[] = [
  { kind: 'custom', name: 'Pension contribution (8%, Pension Reform Act 2014)', amount: ({ gross, options }) => (selfEmployed(options) ? 0 : 0.08 * gross) },
  { kind: 'custom', name: 'National Housing Fund contribution (2.5%, self-employed)', amount: ({ gross, options }) => (selfEmployed(options) ? 0.025 * gross : 0) },
];

export const NG_INCOME_TAX: CountryIncomeTaxData = {
  code: 'NG',
  country: 'Nigeria',
  currency: 'NGN',
  locale: 'en-NG',
  timeZone: 'Africa/Lagos',
  file: 'src/data/incomeTaxWorld/ng.ts',
  note: 'Single resident private-sector PAYE employee in the contributory pension scheme: from 2026 the Nigeria Tax Act 2025 rates (0% on the first N800,000) on income after the 8% employee pension contribution; for 2025 the PITA rates on income after the Consolidated Relief Allowance and the pension contribution, with the 1% minimum tax. Excludes the National Housing Fund contribution (compulsory only in the public sector), rent relief, NHIS, life assurance, mortgage interest and the minimum-wage exemption.',
  assumptions: [
    'Single resident individual, employment income under PAYE (or self-employed profit, with incomeType "self-employed"), no rent relief, life assurance or mortgage interest claimed; tax year = calendar year.',
    'Social contributions are not included as charges. For an employee, the pension contribution of 8% under the Pension Reform Act 2014 is deducted, on the whole of gross pay: the Act charges it on monthly emoluments of at least basic salary + housing + transport allowances. If the contract charges it on basic + housing + transport only and those are 80% of pay, tax on N2,000,000 in 2026 is N160,800 instead of N156,000. An employer with fewer than 15 employees (3, by the Act\'s definition of employer) need not run the scheme; with no pension deduction the 2026 tax on N2,000,000 is N180,000.',
    'For an employee, the National Housing Fund contribution (2.5%) is deductible but not deducted: since the Business Facilitation (Miscellaneous Provisions) Act 2023 it is compulsory only for public-sector employees and the self-employed, and voluntary for private-sector employees. A public-sector employee contributing 2.5% of gross pays N148,500 on N2,000,000 in 2026 instead of N156,000.',
    'The exemption for earners at or below the national minimum wage is not applied (the threshold was not recorded in the research).',
  ],
  incomeBasis: {
    default: 'employment',
    selfEmployed: 'modelled',
    selfEmployedNote: 'The same table applies to self-employed profit, but the deduction differs: the self-employed have no compulsory pension contribution (it is voluntary for them) and must pay the 2.5% National Housing Fund contribution, which is deducted instead. On N2,000,000 in 2026 that is N172,500 of tax, against N156,000 for an employee.',
  },
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: [
        { upTo: 800000, rate: 0 },
        { upTo: 3000000, rate: 0.15 },
        { upTo: 12000000, rate: 0.18 },
        { upTo: 25000000, rate: 0.21 },
        { upTo: 50000000, rate: 0.23 },
        { upTo: null, rate: 0.25 },
      ],
      deductions: [...contributions],
      source: NTA_2025,
      authorityName: 'Nigeria Tax Act 2025, Official Gazette No. 117 (copy hosted by Lagos State Internal Revenue Service)',
      citationDate: '2026-10-11',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: [
        { upTo: 300000, rate: 0.07 },
        { upTo: 600000, rate: 0.11 },
        { upTo: 1100000, rate: 0.15 },
        { upTo: 1600000, rate: 0.19 },
        { upTo: 3200000, rate: 0.21 },
        { upTo: null, rate: 0.24 },
      ],
      deductions: [
        ...contributions,
        {
          kind: 'custom',
          name: 'Consolidated Relief Allowance',
          amount: ({ gross }) => (gross > 0 ? Math.max(200000, 0.01 * gross) + 0.2 * gross : 0),
        },
      ],
      levies: [
        {
          kind: 'custom',
          name: 'Minimum tax top-up (1% of gross income, PITA s.37)',
          amount: ({ gross, taxAfterCredits }) => Math.max(0, 0.01 * gross - taxAfterCredits),
        },
      ],
      source: PIT_RATES,
      authorityName: 'Lagos State Internal Revenue Service (PITA Sixth Schedule)',
      citationDate: '2026-10-06',
      verified: true,
      assumptions: ['The CRA is computed on gross employment income; the Finance Act 2020 redefinition of gross income for relief purposes was not read from the Act and is not applied.'],
    },
  ],
};
