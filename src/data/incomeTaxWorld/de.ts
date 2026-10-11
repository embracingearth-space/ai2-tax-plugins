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
 * Taxable income (zvE) is computed the way the BMF's wage-tax programme does
 * for a full year (Programmablaufplan, UPEVP): gross − Arbeitnehmer-
 * Pauschbetrag − Sonderausgaben-Pauschbetrag − Vorsorgepauschale (§39b(2)
 * Satz 5 Nr. 3 EStG), the allowance for the employee's social contributions.
 *
 * Tariff figures read on gesetze-im-internet.de and BGBl. on 2026-10-06; the
 * Vorsorgepauschale on the BMF Programmablaufplan 2025 and 2026, the
 * SV-Rechengrößenverordnungen and the BMG notices in the Bundesanzeiger on
 * 2026-10-11.
 */
import type { CountryIncomeTaxData, DeductionRule, LevyRule } from '../incomeTaxFactory';
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

const pauschbetraege = [
  { kind: 'fixed', name: 'Arbeitnehmer-Pauschbetrag (§9a EStG)', amount: 1230 },
  { kind: 'fixed', name: 'Sonderausgaben-Pauschbetrag (§10c EStG)', amount: 36 },
] as const;

/** The year's social-insurance parameters for the Vorsorgepauschale (all annual). */
interface Vorsorge {
  /** Beitragsbemessungsgrenze, pension (and from 2026 unemployment) insurance. */
  bbgRv: number;
  /** Beitragsbemessungsgrenze, health and care insurance. */
  bbgKvPv: number;
  /** Average additional health rate (durchschnittlicher Zusatzbeitragssatz), whole; the employee bears half. */
  kvZusatz: number;
  /** From 2026: the employee unemployment share, counted only inside the 1,900 Höchstbetrag. */
  av?: number;
  /** Up to 2025: the Mindestvorsorgepauschale, 12% of wage capped at 1,900, applies if larger. */
  mindest?: true;
}

/** Employee pension share: half of 18.6%. */
const RV_AN = 0.093;
/** Employee health share: half the reduced 14.0% rate (§243 SGB V), the rate the PAP uses. */
const KV_AN = 0.07;
/** Employee care share 1.8% + the 0.6% childless surcharge (§55(3) SGB XI); outside Saxony. */
const PV_AN_KINDERLOS = 0.024;
const HOECHSTBETRAG = 1900;

// The PAP's BigDecimal steps: Teilbeträge cut down to cents, the total rounded
// up to whole euros. Snapping to a millionth first keeps 69,750 × 0.1085 from
// landing a float hair below a cent; under `exact` rounding both are identity.
const centsDown = (x: number, q: MoneyRounding): number => q.floor(Math.round(x * 1e6) / 1e4) / 100;
const euroUp = (x: number, q: MoneyRounding): number => -q.floor(-Math.round(x * 1e6) / 1e6);

/**
 * Vorsorgepauschale (§39b(2) Satz 5 Nr. 3 EStG) for a statutorily insured
 * employee, as the PAP computes it (UPEVP with MVSP / MVSPKVPV / MVSPHB):
 *   VSP = ⌈RV + KV/PV⌉, or, if larger,
 *         ⌈RV + min(KV/PV + AV, 1,900)⌉      (2026, unemployment insurance)
 *         ⌈RV + min(12% × wage, 1,900)⌉     (2025, Mindestvorsorgepauschale)
 */
function vorsorgepauschale(p: Vorsorge): DeductionRule {
  return {
    kind: 'custom',
    name: 'Vorsorgepauschale (§39b(2) Satz 5 Nr. 3 EStG)',
    amount: ({ gross, q }) => {
      const rvBase = Math.min(gross, p.bbgRv);
      const rv = centsDown(rvBase * RV_AN, q);
      const kvpv = centsDown(Math.min(gross, p.bbgKvPv) * (KV_AN + p.kvZusatz / 2 + PV_AN_KINDERLOS), q);
      let vsp = euroUp(rv + kvpv, q);
      if (p.av !== undefined) {
        const av = centsDown(rvBase * p.av, q);
        vsp = Math.max(vsp, euroUp(rv + Math.min(kvpv + av, HOECHSTBETRAG), q));
      }
      if (p.mindest) {
        vsp = Math.max(vsp, euroUp(rv + Math.min(centsDown(rvBase * 0.12, q), HOECHSTBETRAG), q));
      }
      return vsp;
    },
  };
}

// 2026: BBG RV/ALV 101,400 and KV/PV 69,750 (SV-Rechengrößenverordnung 2026 §§2, 4);
// average Zusatzbeitrag 2.9% (BMG, BAnz AT 10.11.2025 B7); ALV 2.6% (§341 SGB III).
const VSP_2026 = vorsorgepauschale({ bbgRv: 101400, bbgKvPv: 69750, kvZusatz: 0.029, av: 0.013 });
// 2025: BBG RV 96,600 and KV/PV 66,150 (SV-Rechengrößenverordnung 2025);
// average Zusatzbeitrag 2.5% (BMG, BAnz AT 07.11.2024 B4).
const VSP_2025 = vorsorgepauschale({ bbgRv: 96600, bbgKvPv: 66150, kvZusatz: 0.025, mindest: true });

/** BMF Programmablaufplan (official XML of the wage-tax algorithm), which also carries the §32a constants. */
const papUrl = (year: number) => `https://www.bmf-steuerrechner.de/javax.faces.resource/daten/xmls/Lohnsteuer${year}.xml.xhtml`;

const P2026: Tariff32a = { gfb: 12348, z2: 17799, z3: 69878, a2: 914.51, a3: 173.1, c3: 1034.87, c4: 11135.63, c5: 19470.38 };
const P2025: Tariff32a = { gfb: 12096, z2: 17443, z3: 68480, a2: 932.3, a3: 176.64, c3: 1015.13, c4: 10911.92, c5: 19246.67 };

export const DE_INCOME_TAX: CountryIncomeTaxData = {
  code: 'DE',
  country: 'Germany',
  currency: 'EUR',
  locale: 'de-DE',
  timeZone: 'Europe/Berlin',
  file: 'src/data/incomeTaxWorld/de.ts',
  note: 'Single statutorily insured employee (Grundtarif, Steuerklasse I): income tax from the §32a EStG formula on gross wage less the Arbeitnehmer-Pauschbetrag (1,230), the Sonderausgaben-Pauschbetrag (36) and the Vorsorgepauschale for pension, health, care and (from 2026) unemployment insurance, computed as the BMF wage-tax programme does for a full year; plus the solidarity surcharge, plus church tax only when a churchTaxRate is given. Excludes social-security contributions as a charge, actual Werbungskosten and all other deductions.',
  assumptions: [
    'Single, no children, assessed under the basic tariff (Grundtarif, Steuerklasse I); wage income only; statutorily insured for pension, unemployment, health and long-term care; childless and aged 23 or over (so the 0.6% care surcharge applies); not employed in Saxony.',
    'Taxable income = gross wage − Arbeitnehmer-Pauschbetrag 1,230 − Sonderausgaben-Pauschbetrag 36 − Vorsorgepauschale (§39b(2) Satz 5 Nr. 3 EStG), as the BMF Programmablaufplan computes it for a full year of wage tax: pension 9.3% up to the pension ceiling, plus health (7% + half the additional rate) and care (2.4%) up to the health ceiling. In 2026 unemployment insurance (1.3%) counts only while health, care and unemployment together stay within 1,900; in 2025 the minimum allowance (12% of wage, at most 1,900) applies where it is larger.',
    "The health additional rate used is the official AVERAGE (2026: 2.9%, 2025: 2.5%). Payroll uses your own fund's rate: each 0.1 point above or below the average moves the allowance by 0.05% of wage, up to the health ceiling.",
    'This is the wage-tax (Lohnsteuer) figure. The annual assessment deducts the contributions actually paid under §10 EStG instead, which can differ from the payroll allowance.',
    'Employee social-security contributions themselves (pension, unemployment, health, long-term care) are not included as charges.',
    'Church tax is 0 unless options.churchTaxRate is given (8% in Bavaria and Baden-Württemberg, 9% in the other Länder, as a share of income tax).',
  ],
  incomeBasis: {
    default: 'employment',
    selfEmployed: 'differs',
    selfEmployedNote: 'The €1,230 employee lump sum (Arbeitnehmer-Pauschbetrag) applies to employees only; a self-employed person deducts actual business expenses and their own insurance contributions instead.',
  },
  optionsSupported: ['churchTaxRate'],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: bandsFor(P2026),
      tariff: tariff32a(P2026),
      // Tariff: §32a EStG (gesetze-im-internet.de), identical to the PAP's UPTAB26.
      deductions: [...pauschbetraege, VSP_2026],
      // Freigrenze 20,350 single from VZ 2026 (§3(3) SolZG, Art. 4 SteFeG).
      levies: [soli(20350), churchTax],
      source: papUrl(2026),
      authorityName: 'Bundesministerium der Finanzen (BMF), Programmablaufplan für den maschinellen Lohnsteuerabzug 2026',
      citationDate: '2026-10-11',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: bandsFor(P2025),
      tariff: tariff32a(P2025),
      // Tariff: Steuerfortentwicklungsgesetz, BGBl. 2024 I Nr. 449, identical to the revised PAP's UPTAB25.
      deductions: [...pauschbetraege, VSP_2025],
      // Freigrenze 19,950 single for VZ 2025 (Art. 3 SteFeG).
      levies: [soli(19950), churchTax],
      source: papUrl(2025),
      authorityName: 'Bundesministerium der Finanzen (BMF), Programmablaufplan für den maschinellen Lohnsteuerabzug 2025 (revised for the Steuerfortentwicklungsgesetz)',
      citationDate: '2026-10-11',
      verified: true,
    },
  ],
};
