/**
 * France — impôt sur le revenu, single salaried employee (1 part de quotient
 * familial). @ai2/tax-plugins — embracingearth.space
 *
 * Years are INCOME years: '2025' = revenus 2025 under the LF 2026 barème
 * (Loi n° 2026-103, art. 4); '2024' = revenus 2024 under the LF 2025 barème
 * (Loi n° 2025-127, art. 2). The barème for 2026 income is set by the loi de
 * finances pour 2027, not enacted on 2026-10-06, so there is no '2026' year.
 *
 * Gross → taxable:
 *  1. net imposable = gross − deductible employee contributions: assurance
 *     vieillesse (6.90% to the PASS, 0.40% on all), AGIRC-ARRCO (T1 3.15% +
 *     CEG 0.86%; T2 8.64% + CEG 1.08%; CET 0.14% on T1+T2 only when pay exceeds
 *     the PASS), CSG déductible 6.8% on 98.25% of gross up to 4 PASS (100% above).
 *     CSG non déductible (2.4%) and CRDS (0.5%) stay taxable.
 *  2. déduction forfaitaire de 10% on net imposable, clamped to the year's min/max.
 * Tax: barème on 1 part, then the décote for a single person.
 */
import type { CountryIncomeTaxData, CreditRule, DeductionRule } from '../incomeTaxFactory';

/** Deductible employee contributions for a year with plafond de la sécurité sociale `pass`. */
const deductibleContributions = (pass: number): DeductionRule => ({
  kind: 'custom',
  name: 'Cotisations salariales déductibles et CSG déductible',
  amount: ({ gross }) => {
    const t1 = Math.min(gross, pass);
    const t2 = Math.min(Math.max(gross - pass, 0), 7 * pass); // tranche 2: 1 to 8 PASS
    const vieillesse = 0.069 * t1 + 0.004 * gross;
    const agircArrco = (0.0315 + 0.0086) * t1 + (0.0864 + 0.0108) * t2 + (gross > pass ? 0.0014 * (t1 + t2) : 0);
    const csgBase = 0.9825 * Math.min(gross, 4 * pass) + Math.max(gross - 4 * pass, 0);
    return vieillesse + agircArrco + 0.068 * csgBase;
  },
});

/** Déduction forfaitaire de 10% for frais professionnels on the net taxable salary (min limited to the salary). */
const abattement = (min: number, max: number): DeductionRule => ({
  kind: 'custom',
  name: 'Déduction forfaitaire de 10 % (frais professionnels)',
  amount: ({ gross, deductedSoFar }) => {
    const net = Math.max(gross - deductedSoFar, 0);
    return Math.min(Math.max(0.1 * net, Math.min(min, net)), max);
  },
});

/** Décote (CGI art. 197 I 4 a), single person: amount − 45.25% × tax, when tax is below the threshold. */
const decote = (threshold: number, amount: number): CreditRule => ({
  kind: 'custom',
  name: 'Décote',
  amount: ({ incomeTax }) => (incomeTax < threshold ? Math.max(0, amount - 0.4525 * incomeTax) : 0),
});

export const FR_INCOME_TAX: CountryIncomeTaxData = {
  code: 'FR',
  country: 'France',
  currency: 'EUR',
  locale: 'fr-FR',
  timeZone: 'Europe/Paris',
  file: 'src/data/incomeTaxWorld/fr.ts',
  note: 'Single salaried employee (1 part): impôt sur le revenu on gross salary less deductible employee contributions (assurance vieillesse, AGIRC-ARRCO, CSG déductible) and the 10% déduction forfaitaire, at the barème for the INCOME year, less the décote. The barème for 2026 income is not yet enacted (loi de finances pour 2027), so the latest year is 2025 income. Excludes CSG/CRDS and social contributions as charges, other reductions and credits, and the contribution exceptionnelle sur les hauts revenus.',
  assumptions: [
    'Single person, 1 part de quotient familial, no dependants, resident, private-sector salarié under the régime général outside Alsace-Moselle; salary is the only income.',
    'Tax years are income years: "2025" means revenus 2025 (impôt 2026, LF 2026 barème). Withholding (prélèvement à la source) rates during a calendar year come from earlier returns and are not modelled.',
    'Net taxable salary = gross − employee old-age contributions (6.90% to the PASS + 0.40%) − AGIRC-ARRCO employee shares (default 60/40 split) − CSG déductible 6.8% on 98.25% of gross. CSG non déductible and CRDS remain in taxable income.',
    'Employee health (maladie) and unemployment (chômage) contributions are taken as nil, so none is deducted; this could not be confirmed on urssaf.fr. Cadre APEC, prévoyance and mutuelle contributions are not deducted.',
    'Social-security contributions, CSG and CRDS are not included as charges in the tax figure.',
  ],
  years: [
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: [
        { upTo: 11600, rate: 0 },
        { upTo: 29579, rate: 0.11 },
        { upTo: 84577, rate: 0.3 },
        { upTo: 181917, rate: 0.41 },
        { upTo: null, rate: 0.45 },
      ],
      // PASS 2025 = 47,100 (AGIRC-ARRCO PSS table); 10% min 509 / max 14,555 (service-public F1989).
      deductions: [deductibleContributions(47100), abattement(509, 14555)],
      // Décote 2025 income: below 1,982, 897 − 45.25% × tax (brochure pratique 2026 ch. 21).
      credits: [decote(1982, 897)],
      source: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F1419',
      authorityName: 'service-public.gouv.fr (DILA) — barème LF 2026, Loi n° 2026-103 art. 4',
      citationDate: '2026-10-06',
      verified: true,
      assumptions: ['Revenus 2025 under the LF 2026 barème (Loi n° 2026-103 du 19 février 2026); contributions at 2025 rates with PASS 47,100.'],
    },
    {
      taxYear: '2024',
      effectiveFrom: '2024-01-01',
      bands: [
        { upTo: 11497, rate: 0 },
        { upTo: 29315, rate: 0.11 },
        { upTo: 83823, rate: 0.3 },
        { upTo: 180294, rate: 0.41 },
        { upTo: null, rate: 0.45 },
      ],
      // PASS 2024 = 46,368 (AGIRC-ARRCO PSS table); 10% min 504 / max 14,426 (brochure 2025 ch. 06, 2041-GP).
      deductions: [deductibleContributions(46368), abattement(504, 14426)],
      // Décote 2024 income: below 1,964, 889 − 45.25% × tax (brochure pratique 2025 ch. 21).
      credits: [decote(1964, 889)],
      source: 'https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000051168019',
      authorityName: 'Légifrance — Loi n° 2025-127 du 14 février 2025 de finances pour 2025, art. 2',
      citationDate: '2026-10-06',
      verified: false,
      verificationNote:
        'The barème, décote and 10% limits for 2024 income were confirmed on Légifrance and impots.gouv.fr, but the CSG déductible rate (6.8% on 98.25% of gross) used to reach net taxable salary was read on 2025/2026 pages, not confirmed for 2024.',
    },
  ],
};
