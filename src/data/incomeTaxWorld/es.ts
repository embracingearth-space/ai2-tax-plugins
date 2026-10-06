/**
 * Spain — IRPF, single employee, territorio común. @ai2/tax-plugins — embracingearth.space
 *
 * IRPF is charged on one base (base liquidable general) under TWO scales: the
 * state scale (art. 63 Ley 35/2006) and the autonomous community's own scale.
 * The national scheme here is the STATE half only; selecting a community
 * (options.region 'MD' | 'CT' | 'AN') adds its half as a levy line.
 *
 * Base: gross − employee social-security contributions (art. 19.2.a) −
 * reducción art. 20 (on rendimiento neto before the 2,000) − otros gastos 2,000
 * (art. 19.2.f). The mínimo personal is not deducted from the base: each scale
 * is applied to the mínimo and that "cuota sobre el mínimo" is subtracted
 * (art. 63.1.2 / art. 56). The DA 61 deduction (SMI-related) reduces the state
 * + regional cuota together; without a region only the state half is reduced.
 *
 * Figures read on boe.es and sede.agenciatributaria.gob.es on 2026-10-06.
 */
import type { CountryIncomeTaxData, DeductionRule, IncomeTaxYearData } from '../incomeTaxFactory';
import type { IncomeTaxBand, IncomeTaxRegion, IncomeTaxRegionSet } from '../incomeTax';
import { progressive, piecewiseLinear, nonNegative } from '../incomeTaxMath';

const BOE_IRPF = 'https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764';
const AEAT_ESTATAL_2025 =
  'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c15-calculo-impuesto-determinacion-cuotas-integras/gravamen-base-liquidable-general/gravamen-estatal.html';

/** Escala general estatal, art. 63.1 Ley 35/2006 (unchanged 2021–2026). */
export const ES_STATE_BANDS: IncomeTaxBand[] = [
  { upTo: 12450, rate: 0.095 },
  { upTo: 20200, rate: 0.12 },
  { upTo: 35200, rate: 0.15 },
  { upTo: 60000, rate: 0.185 },
  { upTo: 300000, rate: 0.225 },
  { upTo: null, rate: 0.245 },
];

/** Mínimo del contribuyente, art. 57 (under 65). */
export const ES_STATE_MINIMO = 5550;

/**
 * Employee contributions as an annual band table on gross: the common rate up
 * to 12 × the monthly maximum base, then the employee share of the cotización
 * adicional de solidaridad on pay above it (monthly tranches × 12).
 * 2026: CC 4.70 + desempleo 1.55 + FP 0.10 + MEI 0.15 = 6.50%; max base 5,101.20/month;
 *   solidaridad employee 0.19 / 0.21 / 0.24% (Orden PJC/297/2026).
 * 2025: 4.70 + 1.55 + 0.10 + MEI 0.13 = 6.48%; max base 4,909.50/month;
 *   solidaridad employee 0.15 / 0.17 / 0.19% (Orden PJC/178/2025).
 */
const SS_TABLE: Record<string, IncomeTaxBand[]> = {
  '2026': [
    { upTo: 5101.2 * 12, rate: 0.065 },
    { upTo: 5611.32 * 12, rate: 0.0019 },
    { upTo: 7651.8 * 12, rate: 0.0021 },
    { upTo: null, rate: 0.0024 },
  ],
  '2025': [
    { upTo: 4909.5 * 12, rate: 0.0648 },
    { upTo: 5400.45 * 12, rate: 0.0015 },
    { upTo: 7364.25 * 12, rate: 0.0017 },
    { upTo: null, rate: 0.0019 },
  ],
};

/** DA 61 deduction (SMI-related), on rendimientos íntegros del trabajo. */
const DA61: Record<string, readonly (readonly [number, number])[]> = {
  // RDL 5/2026 art. 28: 590.89 up to 17,094, less 0.2 × excess, nil from 20,048.45.
  '2026': [[17094, 590.89], [20048.45, 0]],
  // Ley 5/2025 DF 3: 340 up to 16,576, less 0.2 × excess, nil from 18,276.
  '2025': [[16576, 340], [18276, 0]],
};

const ssDeduction: DeductionRule = {
  kind: 'custom',
  name: 'Employee social-security contributions (art. 19.2.a)',
  amount: ({ gross, year }) => progressive(gross, SS_TABLE[year.taxYear]!),
};

/** Art. 20 (RDL 4/2024), on rendimiento neto before the 2,000 (= gross − SS here). */
const art20: DeductionRule = {
  kind: 'custom',
  name: 'Reducción por obtención de rendimientos del trabajo (art. 20)',
  amount: ({ gross, deductedSoFar }) => {
    const rnt = gross - deductedSoFar;
    if (rnt <= 14852) return 7302;
    if (rnt <= 17673.52) return 7302 - 1.75 * (rnt - 14852);
    if (rnt < 19747.5) return nonNegative(2364.34 - 1.14 * (rnt - 17673.52));
    return 0;
  },
};

const deductions: DeductionRule[] = [
  ssDeduction,
  art20,
  { kind: 'fixed', name: 'Otros gastos deducibles (art. 19.2.f)', amount: 2000 },
];

function year(taxYear: '2026' | '2025', source: string, ruleName: string): IncomeTaxYearData {
  return {
    taxYear,
    effectiveFrom: `${taxYear}-01-01`,
    bands: ES_STATE_BANDS,
    deductions,
    credits: [
      { kind: 'taxOnAmount', name: 'Mínimo personal (cuota estatal sobre el mínimo, art. 63.1.2)', amount: ES_STATE_MINIMO },
      { kind: 'schedule', name: ruleName, base: 'gross', points: DA61[taxYear]! },
    ],
    source,
    authorityName: taxYear === '2026' ? 'Boletín Oficial del Estado (Ley 35/2006, texto consolidado)' : 'Agencia Tributaria (Manual práctico Renta 2025)',
    citationDate: '2026-10-06',
    verified: true,
  };
}

// ---------------------------------------------------------------- regions

interface RegionYear {
  bands: IncomeTaxBand[];
  minimo: number;
  source: string;
  authorityName: string;
}

/**
 * The regional cuota: the community's scale on the same base, less that scale
 * on the community's mínimo, less whatever part of the DA 61 deduction the
 * state half could not absorb (DA 61 reduces the state + regional cuota).
 */
function regionalSet(name: string, taxYear: '2026' | '2025', r: RegionYear): IncomeTaxRegionSet {
  return {
    effectiveFrom: `${taxYear}-01-01`,
    taxYearLabel: taxYear,
    bands: r.bands,
    compute: ({ gross, nationalTaxable, nationalIncomeTax, q }) => {
      const cuota = progressive(nationalTaxable, r.bands) - progressive(Math.min(r.minimo, nationalTaxable), r.bands);
      const stateAfterMinimo = nonNegative(nationalIncomeTax - progressive(Math.min(ES_STATE_MINIMO, nationalTaxable), ES_STATE_BANDS));
      const da61Left = nonNegative(piecewiseLinear(gross, DA61[taxYear]!) - stateAfterMinimo);
      const amount = q.round(nonNegative(cuota - da61Left));
      return { levies: amount > 0 ? [{ name: `IRPF regional half (${name})`, amount }] : [] };
    },
    source: r.source,
    authorityName: r.authorityName,
    citationDate: '2026-10-06',
    verified: true,
  };
}

const AEAT_REG = 'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c15-calculo-impuesto-determinacion-cuotas-integras/gravamen-base-liquidable-general/gravamen-autonomico/';
const AEAT_2025 = 'Agencia Tributaria (Manual práctico Renta 2025)';

function region(code: string, name: string, legal: string, years: Record<'2026' | '2025', RegionYear>): IncomeTaxRegion {
  return {
    code,
    name,
    mode: 'additional',
    sets: [regionalSet(name, '2026', years['2026']), regionalSet(name, '2025', years['2025'])],
    note: `${name}: the autonomous-community half of IRPF (${legal}) on the same base liquidable general, less the community's scale on its own mínimo personal. Regional deductions (deducciones autonómicas) are not modelled.`,
    file: 'src/data/incomeTaxWorld/es.ts',
  };
}

// Comunidad de Madrid — DL 1/2010 art. 1 (scale, Ley 13/2023) and art. 2 (mínimo 5,956.65).
const MD_BANDS: IncomeTaxBand[] = [
  { upTo: 13362.22, rate: 0.085 },
  { upTo: 19004.63, rate: 0.107 },
  { upTo: 35425.68, rate: 0.128 },
  { upTo: 57320.4, rate: 0.174 },
  { upTo: null, rate: 0.205 },
];
// Cataluña — DL 1/2024 art. 611-1 (scale, DL 5/2025, from 2025) and 611-2 (mínimo 5,550).
const CT_BANDS: IncomeTaxBand[] = [
  { upTo: 12500, rate: 0.095 },
  { upTo: 22000, rate: 0.125 },
  { upTo: 33000, rate: 0.16 },
  { upTo: 53000, rate: 0.19 },
  { upTo: 90000, rate: 0.215 },
  { upTo: 120000, rate: 0.235 },
  { upTo: 175000, rate: 0.245 },
  { upTo: null, rate: 0.255 },
];
// Andalucía — Ley 5/2021 art. 23 (scale, DL 7/2022) and art. 23 bis (mínimo 5,790).
const AN_BANDS: IncomeTaxBand[] = [
  { upTo: 13000, rate: 0.095 },
  { upTo: 21100, rate: 0.12 },
  { upTo: 35200, rate: 0.15 },
  { upTo: 60000, rate: 0.185 },
  { upTo: null, rate: 0.225 },
];

export const ES_REGIONS: Record<string, IncomeTaxRegion> = {
  MD: region('MD', 'Comunidad de Madrid', 'Decreto Legislativo 1/2010', {
    '2026': { bands: MD_BANDS, minimo: 5956.65, source: 'https://www.boe.es/buscar/act.php?id=BOCM-m-2010-90068', authorityName: 'Boletín Oficial del Estado (DL 1/2010 Madrid, texto consolidado)' },
    '2025': { bands: MD_BANDS, minimo: 5956.65, source: `${AEAT_REG}comunidad-madrid.html`, authorityName: AEAT_2025 },
  }),
  CT: region('CT', 'Cataluña', 'Decreto Legislativo 1/2024', {
    '2026': { bands: CT_BANDS, minimo: 5550, source: 'https://www.boe.es/buscar/act.php?id=BOE-A-2024-6951', authorityName: 'Boletín Oficial del Estado (DL 1/2024 Cataluña, texto consolidado)' },
    '2025': { bands: CT_BANDS, minimo: 5550, source: `${AEAT_REG}comunidad-autonoma-cataluna.html`, authorityName: AEAT_2025 },
  }),
  AN: region('AN', 'Andalucía', 'Ley 5/2021', {
    '2026': { bands: AN_BANDS, minimo: 5790, source: 'https://www.boe.es/buscar/act.php?id=BOE-A-2021-17915', authorityName: 'Boletín Oficial del Estado (Ley 5/2021 Andalucía, texto consolidado)' },
    '2025': { bands: AN_BANDS, minimo: 5790, source: `${AEAT_REG}comunidad-autonoma-andalucia.html`, authorityName: AEAT_2025 },
  }),
};

export const ES_INCOME_TAX: CountryIncomeTaxData = {
  code: 'ES',
  country: 'Spain',
  currency: 'EUR',
  locale: 'es-ES',
  timeZone: 'Europe/Madrid',
  file: 'src/data/incomeTaxWorld/es.ts',
  note: 'IRPF for a single employee in the common regime: the STATE half of the tax (state scale less the state cuota on the mínimo personal of 5,550), after employee social-security contributions, the art. 20 reduction and the 2,000 otros gastos, less the DA 61 deduction for low earners. Without a selected autonomous community this is the state half only, not the full IRPF; Madrid, Cataluña and Andalucía can be selected to add the regional half. Excludes the foral regimes of País Vasco and Navarra, Ceuta/Melilla and Canarias specifics, regional deductions, and social-security contributions as a charge.',
  region: 'State half only unless an autonomous community is selected (MD, CT, AN); País Vasco and Navarra (foral regimes) are not covered',
  assumptions: [
    'Single, under 65, no descendants or disability, individual return, resident in a common-regime autonomous community; wages from one employer on an indefinite contract and no other income.',
    'Employee social-security contributions (contingencias comunes, desempleo, formación profesional, MEI, and the solidarity contribution above the maximum base) are deducted from the base as art. 19.2.a requires, but are not included in the tax — they are social contributions, not income tax. The minimum contribution base is not applied.',
    'Without an autonomous community selected the figure is the STATE half of IRPF only; the regional half (roughly as large again) is not included.',
    'The DA 61 deduction is applied to the state cuota; with a community selected, any part the state cuota cannot absorb reduces the regional cuota.',
  ],
  regions: ES_REGIONS,
  years: [
    year('2026', BOE_IRPF, 'Deducción por obtención de rendimientos del trabajo (DA 61, RDL 5/2026)'),
    year('2025', AEAT_ESTATAL_2025, 'Deducción por obtención de rendimientos del trabajo (DA 61, Ley 5/2025)'),
  ],
};
