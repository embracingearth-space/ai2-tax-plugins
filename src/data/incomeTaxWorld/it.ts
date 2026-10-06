/**
 * Italy — IRPEF (national), single employee on an open-ended contract.
 * @ai2/tax-plugins — embracingearth.space
 *
 * Gross → reddito complessivo: employee INPS contributions are excluded from
 * employment income (9.19% IVS up to the massimale, plus 1% on pay above the
 * prima fascia di retribuzione pensionabile, also up to the massimale).
 * Credits: detrazione per lavoro dipendente (art. 13 c.1 and c.1.1 TUIR) and the
 * ulteriore detrazione (L. 207/2024 art. 1 c.6), both on reddito complessivo,
 * full year. The art. 13 ratios are used unrounded (the law truncates them to
 * four decimals; the difference is cents).
 *
 * Excluded: the somma non imponibile (L. 207/2024 c.4, a cash sum for
 * R ≤ 20,000) and the trattamento integrativo (a cash bonus) — neither reduces
 * tax; and the addizionali regionale and comunale, which vary by region and
 * comune with no official national average.
 */
import type { CountryIncomeTaxData, CreditRule, DeductionRule } from '../incomeTaxFactory';

/** Employee INPS contributions for a year: massimale and prima fascia (INPS circolari). */
const inps = (primaFascia: number, massimale: number): DeductionRule => ({
  kind: 'custom',
  name: 'Contributi INPS a carico del lavoratore',
  amount: ({ gross }) => {
    const capped = Math.min(gross, massimale);
    return 0.0919 * capped + 0.01 * Math.max(capped - primaFascia, 0);
  },
});

/** Art. 13 c.1 and c.1.1 TUIR, full year, open-ended contract. R = reddito complessivo. */
const detrazioneLavoro: CreditRule = {
  kind: 'custom',
  name: 'Detrazione per lavoro dipendente (art. 13 TUIR)',
  amount: ({ taxable: r }) => {
    let d: number;
    if (r <= 15000) d = 1955;
    else if (r <= 28000) d = 1910 + (1190 * (28000 - r)) / 13000;
    else if (r <= 50000) d = (1910 * (50000 - r)) / 22000;
    else d = 0;
    return d + (r > 25000 && r <= 35000 ? 65 : 0);
  },
};

/** Ulteriore detrazione, L. 207/2024 art. 1 c.6 (employees, not pensioners). */
const ulterioreDetrazione: CreditRule = {
  kind: 'custom',
  name: 'Ulteriore detrazione (L. 207/2024 art. 1 c.6)',
  amount: ({ taxable: r }) => {
    if (r <= 20000 || r > 40000) return 0;
    if (r <= 32000) return 1000;
    return (1000 * (40000 - r)) / 8000;
  },
};

export const IT_INCOME_TAX: CountryIncomeTaxData = {
  code: 'IT',
  country: 'Italy',
  currency: 'EUR',
  locale: 'it-IT',
  timeZone: 'Europe/Rome',
  file: 'src/data/incomeTaxWorld/it.ts',
  note: 'Single employee on an open-ended contract, full year: national IRPEF on gross pay less employee INPS contributions, less the detrazione per lavoro dipendente and the ulteriore detrazione. EXCLUDES the addizionale regionale and addizionale comunale (set by each region and comune, no official national average), so this is not the full income tax. Also excludes the cuneo-fiscale tax-free cash sum and the trattamento integrativo (cash amounts, not tax reductions), other detrazioni, and substitute taxes.',
  assumptions: [
    'Single resident employee, open-ended contract, full year worked, no dependants, no other income, no oneri deducibili or detraibili.',
    'Reddito complessivo = gross pay − employee INPS contributions (9.19% up to the massimale, plus 1% above the prima fascia), the standard payroll treatment; the massimale applies to workers first insured after 1995. The INPS contributions are not included as charges (they are social-security contributions).',
    'Excludes the addizionale regionale (1.23%–3.33%) and addizionale comunale (0%–0.9%): they vary by residence and the figure is therefore NOT the full IRPEF burden.',
    'Excludes the cuneo-fiscale somma non imponibile (a tax-free cash sum for reddito complessivo up to 20,000) and the trattamento integrativo (up to 1,200): both are paid as cash, not deducted from tax, so tax shown below 20,000 is not reduced by them.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: [
        { upTo: 28000, rate: 0.23 },
        { upTo: 50000, rate: 0.33 }, // 35% → 33% by L. 199/2025 art. 1 c.3
        { upTo: null, rate: 0.43 },
      ],
      // INPS circ. 6/2026: prima fascia 56,224; massimale 122,295.
      deductions: [inps(56224, 122295)],
      credits: [detrazioneLavoro, ulterioreDetrazione],
      source: 'https://www.agenziaentrate.gov.it/portale/imposta-sul-reddito-delle-persone-fisiche-irpef-/aliquote-e-calcolo-dell-irpef',
      authorityName: 'Agenzia delle Entrate',
      citationDate: '2026-10-06',
      verified: true,
      assumptions: ['The 440 EUR reduction of certain detrazioni above 200,000 (TUIR art. 16-ter c.5-bis) does not apply: no such detrazioni are modelled.'],
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: [
        { upTo: 28000, rate: 0.23 },
        { upTo: 50000, rate: 0.35 },
        { upTo: null, rate: 0.43 },
      ],
      // INPS circ. 26/2025: prima fascia 55,448; massimale 120,607.
      deductions: [inps(55448, 120607)],
      credits: [detrazioneLavoro, ulterioreDetrazione],
      source: 'https://www.agenziaentrate.gov.it/portale/imposta-sul-reddito-delle-persone-fisiche-irpef-/aliquote-e-calcolo-dell-irpef',
      authorityName: 'Agenzia delle Entrate',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
