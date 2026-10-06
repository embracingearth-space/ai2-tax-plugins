/**
 * Austria — Einkommensteuer (§33 EStG 1988), single employee. @ai2/tax-plugins — embracingearth.space
 *
 * Taxable income (Einkommen) = gross − employee social insurance (deductible
 * under §16(1)(4) EStG) − Werbungskostenpauschale €132. Tariff §33(1) with a
 * 0% first band. Credits: Verkehrsabsetzbetrag and its Zuschlag (phased out on
 * Einkommen). No municipal or provincial income tax exists.
 *
 * Figures read on bmf.gv.at and sozialversicherung.at on 2026-10-06.
 */
import type { CountryIncomeTaxData, DeductionRule } from '../incomeTaxFactory';

const BMF_TARIF = 'https://www.bmf.gv.at/themen/steuern/arbeitnehmerveranlagung/steuertarif-steuerabsetzbetraege/steuertarif-steuerabsetzbetraege.html';

/**
 * Employee social insurance for Angestellte outside Vienna: PV 10.25 + KV 3.87
 * + AV 2.95 = 17.07% up to the annual Höchstbeitragsgrundlage (12 × monthly +
 * special-payment cap), and AK 0.5 + WBF 0.5 = 1% on regular pay only (12 × monthly).
 */
function social(ceiling: number, regularCeiling: number): DeductionRule[] {
  return [
    { kind: 'share', name: 'Employee social insurance (PV, KV, AV)', rate: 0.1707, ceiling },
    { kind: 'share', name: 'Arbeiterkammerumlage + Wohnbauförderungsbeitrag', rate: 0.01, ceiling: regularCeiling },
    { kind: 'fixed', name: 'Werbungskostenpauschale', amount: 132 },
  ];
}

export const AT_INCOME_TAX: CountryIncomeTaxData = {
  code: 'AT',
  country: 'Austria',
  currency: 'EUR',
  locale: 'de-AT',
  timeZone: 'Europe/Vienna',
  file: 'src/data/incomeTaxWorld/at.ts',
  note: 'Income tax under the §33 EStG tariff for a single employee, after employee social insurance and the €132 Werbungskostenpauschale, less the Verkehrsabsetzbetrag and its Zuschlag. All pay is taxed on the tariff: the 6% rate on 13th/14th salaries is not modelled, so tax is overstated for 14-salary employees. Excludes the refundable SV-Rückerstattung, the commuter allowances, and social insurance as a charge.',
  assumptions: [
    'Single, no children, resident salaried employee (Angestellte/r) outside Vienna, not a commuter (no Pendlerpauschale).',
    'Employee social-insurance contributions (17.07% PV/KV/AV up to the Höchstbeitragsgrundlage, plus 1% AK/WBF) are deducted from taxable income but not included in the tax; the reduced unemployment rate for low monthly pay is not applied.',
    'All gross pay is taxed on the progressive tariff; the separate 6% taxation of 13th/14th salaries (sonstige Bezüge) is not modelled, which overstates the tax of an employee paid 14 salaries.',
    'Credits are non-refundable here: the SV-Rückerstattung (negative tax) is not included.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: [
        { upTo: 13539, rate: 0 },
        { upTo: 21992, rate: 0.2 },
        { upTo: 36458, rate: 0.3 },
        { upTo: 70365, rate: 0.4 },
        { upTo: 104859, rate: 0.48 },
        { upTo: 1000000, rate: 0.5 },
        { upTo: null, rate: 0.55 },
      ],
      // Höchstbeitragsgrundlage 2026: 6,930/month × 12 + 13,860 special payments = 97,020; 12 × 6,930 = 83,160.
      deductions: social(97020, 83160),
      credits: [
        { kind: 'fixed', name: 'Verkehrsabsetzbetrag', amount: 496 },
        { kind: 'schedule', name: 'Zuschlag zum Verkehrsabsetzbetrag', base: 'taxable', points: [[19761, 804], [30259, 0]] },
      ],
      source: BMF_TARIF,
      authorityName: 'Bundesministerium für Finanzen (BMF)',
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: [
        { upTo: 13308, rate: 0 },
        { upTo: 21617, rate: 0.2 },
        { upTo: 35836, rate: 0.3 },
        { upTo: 69166, rate: 0.4 },
        { upTo: 103072, rate: 0.48 },
        { upTo: 1000000, rate: 0.5 },
        { upTo: null, rate: 0.55 },
      ],
      // 2025: 6,450/month × 12 + 12,900 = 90,300; 12 × 6,450 = 77,400.
      deductions: social(90300, 77400),
      credits: [
        { kind: 'fixed', name: 'Verkehrsabsetzbetrag', amount: 487 },
        { kind: 'schedule', name: 'Zuschlag zum Verkehrsabsetzbetrag', base: 'taxable', points: [[19424, 790], [29743, 0]] },
      ],
      source: BMF_TARIF,
      authorityName: 'Bundesministerium für Finanzen (BMF)',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
