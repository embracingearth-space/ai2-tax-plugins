/**
 * Germany — Einkommensteuer (§32a EStG tariff), Solidaritätszuschlag and
 * optional Kirchensteuer, single employee (Grundtarif). @ai2/tax-plugins — embracingearth.space
 *
 * The §32a tariff is a zone FORMULA, implemented exactly as `tariff`: zvE is
 * rounded down to whole euros, the tax is rounded down to whole euros. `bands`
 * only describe the zones (rate = marginal rate at the start of the zone).
 *
 * Soli (§3, §4 SolZG): 5.5% of income tax, nil while the tax does not exceed
 * the Freigrenze, and never more than 11.9% of (tax − Freigrenze).
 *
 * Every figure was read on official pages (gesetze-im-internet.de, BGBl., BMF) on 2026-10-06.
 */
import type { CountryIncomeTaxData, LevyRule } from '../incomeTaxFactory';
import type { MoneyRounding } from '../incomeTax';

interface Tariff32a {
  gfb: number; // Grundfreibetrag (end of zone 1)
  z2: number; // end of zone 2
  z3: number; // end of zone 3
  a2: number; // zone 2 coefficient
  a3: number; // zone 3 coefficient
  c3: number; // zone 3 constant
  c4: number; // zone 4 subtrahend
  c5: number; // zone 5 subtrahend
}

/** §32a(1) EStG, zones 1–5. Zone 4 ends at 277,825 in both years. */
function tariff32a(p: Tariff32a) {
  return (taxable: number, q: MoneyRounding): number => {
    const x = q.floor(taxable);
    let t: number;
    if (x <= p.gfb) t = 0;
    else if (x <= p.z2) {
      const y = (x - p.gfb) / 10000;
      t = (p.a2 * y + 1400) * y;
    } else if (x <= p.z3) {
      const z = (x - p.z2) / 10000;
      t = (p.a3 * z + 2397) * z + p.c3;
    } else if (x <= 277825) t = 0.42 * x - p.c4;
    else t = 0.45 * x - p.c5;
    return q.floor(Math.max(0, t));
  };
}

const bandsFor = (p: Tariff32a) => [
  { upTo: p.gfb, rate: 0 },
  { upTo: p.z2, rate: 0.14 },
  { upTo: p.z3, rate: 0.2397 },
  { upTo: 277825, rate: 0.42 },
  { upTo: null, rate: 0.45 },
];

/** Solidaritätszuschlag with the single-person Freigrenze and the 11.9% Milderungszone. */
const soli = (freigrenze: number): LevyRule => ({
  kind: 'custom',
  name: 'Solidaritätszuschlag',
  amount: ({ taxAfterCredits }) =>
    taxAfterCredits <= freigrenze ? 0 : Math.min(0.055 * taxAfterCredits, 0.119 * (taxAfterCredits - freigrenze)),
});

/** Kirchensteuer: options.churchTaxRate (8% BY/BW, 9% elsewhere) × income tax; 0 for a non-member. */
const churchTax: LevyRule = {
  kind: 'custom',
  name: 'Kirchensteuer',
  amount: ({ taxAfterCredits, options }) => (options.churchTaxRate ?? 0) * taxAfterCredits,
};

const deductions = [
  { kind: 'fixed', name: 'Arbeitnehmer-Pauschbetrag (§9a EStG)', amount: 1230 },
  { kind: 'fixed', name: 'Sonderausgaben-Pauschbetrag (§10c EStG)', amount: 36 },
] as const;

const P2026: Tariff32a = { gfb: 12348, z2: 17799, z3: 69878, a2: 914.51, a3: 173.1, c3: 1034.87, c4: 11135.63, c5: 19470.38 };
const P2025: Tariff32a = { gfb: 12096, z2: 17443, z3: 68480, a2: 932.3, a3: 176.64, c3: 1015.13, c4: 10911.92, c5: 19246.67 };

export const DE_INCOME_TAX: CountryIncomeTaxData = {
  code: 'DE',
  country: 'Germany',
  currency: 'EUR',
  locale: 'de-DE',
  timeZone: 'Europe/Berlin',
  file: 'src/data/incomeTaxWorld/de.ts',
  note: 'Single employee (Grundtarif, Steuerklasse I): income tax from the §32a EStG formula on gross wage less the Arbeitnehmer-Pauschbetrag (1,230) and Sonderausgaben-Pauschbetrag (36), plus the solidarity surcharge, plus church tax only when a churchTaxRate is given. Taxable income does NOT deduct the deductible social contributions (Vorsorgeaufwendungen), so for a statutorily insured employee the estimate overstates the tax. Excludes social-security contributions, actual Werbungskosten and all other deductions.',
  assumptions: [
    'Single, no children, assessed under the basic tariff (Grundtarif); wage income only.',
    'Taxable income = gross wage − Arbeitnehmer-Pauschbetrag 1,230 − Sonderausgaben-Pauschbetrag 36. Deductible social contributions (Vorsorgeaufwendungen: pension, basic health and care insurance) are NOT deducted, so for a statutorily insured employee this estimate OVERSTATES the income tax.',
    'Employee social-security contributions (pension, unemployment, health, long-term care) are not included as charges.',
    'Church tax is 0 unless options.churchTaxRate is given (8% in Bavaria and Baden-Württemberg, 9% in the other Länder, as a share of income tax).',
  ],
  optionsSupported: ['churchTaxRate'],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: bandsFor(P2026),
      tariff: tariff32a(P2026),
      deductions: [...deductions],
      // Freigrenze 20,350 single from VZ 2026 (§3(3) SolZG, Art. 4 SteFeG).
      levies: [soli(20350), churchTax],
      source: 'https://www.gesetze-im-internet.de/estg/__32a.html',
      authorityName: 'Bundesministerium der Justiz (gesetze-im-internet.de), §32a EStG',
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: bandsFor(P2025),
      tariff: tariff32a(P2025),
      deductions: [...deductions],
      // Freigrenze 19,950 single for VZ 2025 (Art. 3 SteFeG).
      levies: [soli(19950), churchTax],
      source: 'https://www.recht.bund.de/bgbl/1/2024/449/VO.html',
      authorityName: 'Bundesgesetzblatt (recht.bund.de), Steuerfortentwicklungsgesetz, BGBl. 2024 I Nr. 449',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
