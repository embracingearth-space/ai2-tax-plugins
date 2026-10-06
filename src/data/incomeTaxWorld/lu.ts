/**
 * Luxembourg — impôt sur le revenu, tax class 1 employee. @ai2/tax-plugins — embracingearth.space
 *
 * Base tariff (tarif de base, applicable from tax year 2025; no later
 * adaptation published) on taxable income after the minimum flat frais
 * d'obtention (540), dépenses spéciales (480) and employee social
 * contributions. Credits CIS and CI-CO2 salarié on gross salary. The fonds
 * pour l'emploi surcharge (7%, 9% above 150,000) is part of income tax.
 *
 * Figures read on impotsdirects.public.lu, ccss.public.lu and guichet.lu on 2026-10-06.
 */
import type { CountryIncomeTaxData, CreditRule, DeductionRule, LevyRule } from '../incomeTaxFactory';
import type { IncomeTaxBand } from '../incomeTax';

const ACD_TARIF = 'https://impotsdirects.public.lu/fr/az/t/tarif_pers.html';

const BANDS: IncomeTaxBand[] = [
  { upTo: 13230, rate: 0 },
  { upTo: 15435, rate: 0.08 },
  { upTo: 17640, rate: 0.09 },
  { upTo: 19845, rate: 0.1 },
  { upTo: 22050, rate: 0.11 },
  { upTo: 24255, rate: 0.12 },
  { upTo: 26550, rate: 0.14 },
  { upTo: 28845, rate: 0.16 },
  { upTo: 31140, rate: 0.18 },
  { upTo: 33435, rate: 0.2 },
  { upTo: 35730, rate: 0.22 },
  { upTo: 38025, rate: 0.24 },
  { upTo: 40320, rate: 0.26 },
  { upTo: 42615, rate: 0.28 },
  { upTo: 44910, rate: 0.3 },
  { upTo: 47205, rate: 0.32 },
  { upTo: 49500, rate: 0.34 },
  { upTo: 51795, rate: 0.36 },
  { upTo: 54090, rate: 0.38 },
  { upTo: 117450, rate: 0.39 },
  { upTo: 176160, rate: 0.4 },
  { upTo: 234870, rate: 0.41 },
  { upTo: null, rate: 0.42 },
];

const flat: DeductionRule[] = [
  { kind: 'fixed', name: "Frais d'obtention (minimum forfait)", amount: 540 },
  { kind: 'fixed', name: 'Dépenses spéciales (minimum forfait)', amount: 480 },
];

/** CIS: 300 + 2.9% of (gross − 936) from 936 to 11,265; 600 to 40,000; less 1.5% of the excess; nil from 80,000. */
const cis: CreditRule = {
  kind: 'schedule',
  name: "Crédit d'impôt pour salariés (CIS)",
  base: 'gross',
  points: [[936, 0], [936, 300], [11265, 300 + (11265 - 936) * 0.029], [11266, 600], [40000, 600], [80000, 0]],
};

/** CI-CO2 salarié: flat from 936 to 40,000, then linear to nil at 80,000. */
const co2 = (amount: number): CreditRule => ({
  kind: 'schedule',
  name: "Crédit d'impôt CO2 pour salariés (CI-CO2)",
  base: 'gross',
  points: [[936, 0], [936, amount], [40000, amount], [80000, 0]],
});

/** 7% of the income tax; 9% where taxable income exceeds 150,000 (class 1). */
const fondsEmploi: LevyRule = {
  kind: 'custom',
  name: "Contribution au fonds pour l'emploi",
  amount: ({ taxable, incomeTax }) => incomeTax * (taxable > 150000 ? 0.09 : 0.07),
};

export const LU_INCOME_TAX: CountryIncomeTaxData = {
  code: 'LU',
  country: 'Luxembourg',
  currency: 'EUR',
  locale: 'fr-LU',
  timeZone: 'Europe/Luxembourg',
  file: 'src/data/incomeTaxWorld/lu.ts',
  note: "Income tax for a tax-class-1 employee under the base tariff, after the minimum flat frais d'obtention and dépenses spéciales and the verified employee social contributions, less the CIS and CI-CO2 salarié credits, plus the fonds pour l'emploi surcharge. Luxembourg has no municipal income tax. Excludes the 2026 employee pension contribution from the base (its rate is not officially confirmed), the dependency-insurance abatement, and social contributions as a charge.",
  assumptions: [
    'Single, no children, under 64, tax class 1, resident employee; minimum flat frais d\'obtention (540) and dépenses spéciales (480) only.',
    'Social contributions are not included in the tax. Employee health (2.80% + 0.25%, up to the maximum contributory base) and dependency insurance (1.40%, without its abatement) are deducted from taxable income; the pension contribution is deducted for 2025 (8%) but not for 2026, whose employee share is not stated on an official page — so 2026 tax may be overstated.',
    'CIS and CI-CO2 are applied as non-refundable reductions of the tax; in payroll they are paid out even when no tax is due.',
    "The fonds pour l'emploi surcharge is charged on the tariff tax before the CIS / CI-CO2 credits; the official rounding of the tariff is not applied.",
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: BANDS,
      deductions: [
        ...flat,
        // Max contributory base 13,518.68/month Jan–May, 13,856.63 from June: 5 × 13,518.68 + 7 × 13,856.63 = 164,589.81.
        { kind: 'share', name: 'Employee health insurance (soins de santé + prestations en espèces)', rate: 0.0305, ceiling: 164589.81 },
        { kind: 'share', name: 'Employee dependency insurance', rate: 0.014 },
      ],
      credits: [cis, co2(216)],
      levies: [fondsEmploi],
      source: ACD_TARIF,
      authorityName: 'Administration des contributions directes (ACD)',
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: BANDS,
      deductions: [
        ...flat,
        // 13,188.96/month Jan–Apr, 13,518.68 from May: 4 × 13,188.96 + 8 × 13,518.68 = 160,905.28.
        { kind: 'share', name: 'Employee pension insurance', rate: 0.08, ceiling: 160905.28 },
        { kind: 'share', name: 'Employee health insurance (soins de santé + prestations en espèces)', rate: 0.0305, ceiling: 160905.28 },
        { kind: 'share', name: 'Employee dependency insurance', rate: 0.014 },
      ],
      credits: [cis, co2(192)],
      levies: [fondsEmploi],
      source: ACD_TARIF,
      authorityName: 'Administration des contributions directes (ACD)',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
