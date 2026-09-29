/**
 * Finland — tax on wages, and tax on capital gains, for a resident individual.
 * @ai2/tax-plugins · embracingearth.space
 *
 * WHAT A FINNISH WAGE EARNER ACTUALLY PAYS (tax years 2025 and 2026), in the
 * order Verohallinto computes it for the tax card (sources on each year below):
 *
 *   gross wages
 *   − tulonhankkimisvähennys (750 €, the automatic cost-of-earning deduction)
 *   = puhdas ansiotulo (net earned income — the base of the credit phase-out
 *     and of YLE tax)
 *   − employee pension contribution (TyEL), unemployment insurance
 *     contribution and health-insurance daily-allowance contribution
 *   − perusvähennys (basic deduction, computed last)
 *   = verotettava ansiotulo — ONE taxable income for state AND municipal tax
 *     since the 2023 reform (TVL 96 § heading, HE 98/2025)
 *
 *   state tax (progressive scale) + municipal tax + church tax (members only)
 *   + medical-care contribution (all on that taxable income)
 *   − työtulovähennys (earned-income credit): off the state tax first, any
 *     excess off municipal tax, medical-care contribution and church tax in
 *     proportion (TVL 125 § 1 mom); what still remains is lost
 *   + YLE tax (no credits reduce it) + daily-allowance contribution
 *   = what the tax card withholds
 *   + employee pension and unemployment contributions (withheld separately)
 *   = everything deducted from pay.
 *
 * VALIDATED TO THE CENT against Verohallinto's own published examples — see
 * __tests__/finland.test.ts, which reproduces every row of "Esimerkkejä palkan,
 * eläkkeen ja etuuden veroprosenteista" for 2025 and 2026.
 *
 * NOT MODELLED, and said so in the result's assumptions rather than silently
 * ignored: Åland (its own state scale, basic deduction and media fee — refused,
 * not approximated), the child increase of the credit, commuting and other
 * deductions, pension and benefit income, and part-year age changes (a
 * contribution that starts or stops on a birthday is applied for the whole year
 * by the age at the end of it).
 */
import { FI_MUNICIPAL_RATES_RAW, FI_MUNICIPAL_RATES_SOURCE } from './finlandMunicipalRates';

export interface FinnishBand {
  upTo: number | null;
  rate: number;
}

export interface FinnishSource {
  /** What the figure is, e.g. "State income-tax scale". */
  what: string;
  /** The instrument, e.g. "Laki vuoden 2026 tuloveroasteikosta 1140/2025". */
  instrument: string;
  url: string;
}

/** Every parameter of the wage-tax computation for one tax year. */
export interface FinnishEarnedIncomeYear {
  /** Calendar tax year, e.g. '2026'. */
  taxYear: string;
  effectiveFrom: string;
  /** State progressive scale on taxable earned income. */
  stateBands: readonly FinnishBand[];
  /** Tulonhankkimisvähennys, capped at the wages themselves. */
  costDeduction: number;
  /** Perusvähennys: full amount, reduced by `phaseOutRate` of income above it. */
  basicDeduction: { max: number; phaseOutRate: number };
  /** Työtulovähennys. `phaseOut` bands run on NET earned income. */
  workCredit: {
    rate: number;
    max: number;
    /** Added to `max` when the taxpayer turned 65 before the tax year began. */
    age65Increase: number;
    phaseOut: readonly { from: number; to: number | null; rate: number }[];
  };
  /** Employee earnings-related pension contribution (TyEL). */
  pension: { rate: number; elevated?: { rate: number; fromAge: number; toAge: number } };
  /** Employee unemployment insurance contribution, ages 18–64. */
  unemploymentRate: number;
  /** Health-insurance daily-allowance contribution: NIL below the threshold,
   *  and on ALL of the wages at or above it (a cliff, not a band). */
  dailyAllowance: { rate: number; threshold: number };
  /** Health-insurance medical-care contribution on taxable earned income. */
  medicalCareRate: number;
  /** Yleisradiovero on net earned + capital income above the threshold, capped. */
  yle: { rate: number; threshold: number; max: number };
  /** Published average municipal income-tax rate, as a FRACTION. */
  averageMunicipalRate: number;
  sources: readonly FinnishSource[];
  /** YYYY-MM-DD these parameters were last checked against the sources. */
  citationDate: string;
}

const VERO_WITHHOLDING_2026 =
  'https://www.vero.fi/syventavat-vero-ohjeet/paatokset/47363/verohallinnon-paatos-ennakonpidatysprosenttien-laskentaperusteista-palkkatuloa-varten-ja-ennakonkannossa-maarattavan-ennakkoveron-laskentaperusteista-vuodelle-2026/';
const VERO_WITHHOLDING_2025 =
  'https://www.vero.fi/syventavat-vero-ohjeet/paatokset/47363/verohallinnon-paatos-ennakonpidatysprosenttien-laskentaperusteista-palkkatuloa-varten-ja-ennakonkannossa-maarattavan-ennakkoveron-laskentaperusteista-vuodelle-2025/';
const TVL = 'https://www.finlex.fi/fi/lainsaadanto/1992/1535';

/**
 * Newest first. A year is added only once its scale is ENACTED: the 2027 scale,
 * credit and basic deduction are a government proposal (HE 174/2026, given
 * 21.9.2026) until Parliament passes them, normally in December. Until then a
 * 2027 date resolves to 2026 and the rate-watch rollover check flags the gap —
 * which is the honest behaviour, not a bug to paper over with the proposal.
 */
export const FI_EARNED_INCOME_YEARS: readonly FinnishEarnedIncomeYear[] = [
  {
    taxYear: '2026',
    effectiveFrom: '2026-01-01',
    // Laki vuoden 2026 tuloveroasteikosta 1140/2025. The published "tax at the
    // lower limit" column (2 780,80 / 4 794,80 / 7 063,55 / 11 053,55) is exactly
    // what these marginal bands accumulate to — the scale is continuous.
    stateBands: [
      { upTo: 22000, rate: 0.1264 },
      { upTo: 32600, rate: 0.19 },
      { upTo: 40100, rate: 0.3025 },
      { upTo: 52100, rate: 0.3325 },
      { upTo: null, rate: 0.375 },
    ],
    costDeduction: 750,
    basicDeduction: { max: 4265, phaseOutRate: 0.18 },
    // TVL 125 § as amended by 1141/2025: the second phase-out is gone, so the
    // credit stops shrinking at 50 550 € of net earned income and never reaches
    // zero (3 430 − 311 = 3 119 € for everyone above that).
    workCredit: {
      rate: 0.18,
      max: 3430,
      age65Increase: 1200,
      phaseOut: [{ from: 35000, to: 50550, rate: 0.02 }],
    },
    // One rate for every age from 2026 — the 53–62 surcharge ended with 2025.
    pension: { rate: 0.073 },
    unemploymentRate: 0.0089,
    dailyAllowance: { rate: 0.0088, threshold: 17255 },
    medicalCareRate: 0.011,
    yle: { rate: 0.025, threshold: 15150, max: 160 },
    averageMunicipalRate: FI_MUNICIPAL_RATES_SOURCE['2026']!.averageMunicipalRate / 100,
    sources: [
      { what: 'State income-tax scale', instrument: 'Laki vuoden 2026 tuloveroasteikosta 1140/2025', url: 'https://www.finlex.fi/fi/lainsaadanto/saadoskokoelma/2025/1140' },
      { what: 'Earned-income credit and basic deduction', instrument: 'Tuloverolaki 125 § and 106 § as amended by 1141/2025', url: TVL },
      { what: 'Employee contributions, medical-care contribution, YLE tax and the order of computation', instrument: 'Verohallinnon päätös ennakonpidätysprosenttien laskentaperusteista vuodelle 2026, VH/5046/00.01.00/2025', url: VERO_WITHHOLDING_2026 },
      { what: 'Municipal and parish rates', instrument: `Kuntien ja seurakuntien tuloveroprosentit vuonna 2026, ${FI_MUNICIPAL_RATES_SOURCE['2026']!.decision}`, url: FI_MUNICIPAL_RATES_SOURCE['2026']!.url },
    ],
    citationDate: '2026-09-29',
  },
  {
    taxYear: '2025',
    effectiveFrom: '2025-01-01',
    // Laki vuoden 2025 tuloveroasteikosta 701/2024 — six brackets, including the
    // temporary 150 000 € top bracket that 2026 removed.
    stateBands: [
      { upTo: 21200, rate: 0.1264 },
      { upTo: 31500, rate: 0.19 },
      { upTo: 52100, rate: 0.3025 },
      { upTo: 88200, rate: 0.34 },
      { upTo: 150000, rate: 0.4175 },
      { upTo: null, rate: 0.4425 },
    ],
    costDeduction: 750,
    basicDeduction: { max: 4115, phaseOutRate: 0.18 },
    // TVL 125 § as amended by 702/2024 (the credit that replaced the repealed
    // earned-income allowance, 105 a §, from 2025).
    workCredit: {
      rate: 0.18,
      max: 3225,
      age65Increase: 1200,
      phaseOut: [
        { from: 24250, to: 42550, rate: 0.0222 },
        { from: 42550, to: null, rate: 0.0344 },
      ],
    },
    // From the month after the 53rd birthday to the end of the month of the
    // 63rd, the employee rate was 8.65% — applied here by age at year end.
    pension: { rate: 0.0715, elevated: { rate: 0.0865, fromAge: 53, toAge: 62 } },
    unemploymentRate: 0.0059,
    dailyAllowance: { rate: 0.0084, threshold: 16862 },
    medicalCareRate: 0.0106,
    yle: { rate: 0.025, threshold: 15150, max: 160 },
    averageMunicipalRate: FI_MUNICIPAL_RATES_SOURCE['2025']!.averageMunicipalRate / 100,
    sources: [
      { what: 'State income-tax scale', instrument: 'Laki vuoden 2025 tuloveroasteikosta 701/2024', url: 'https://www.finlex.fi/fi/lainsaadanto/saadoskokoelma/2024/701' },
      { what: 'Earned-income credit and basic deduction', instrument: 'Tuloverolaki 125 § and 106 § as amended by 702/2024', url: TVL },
      { what: 'Employee contributions, medical-care contribution, YLE tax and the order of computation', instrument: 'Verohallinnon päätös ennakonpidätysprosenttien laskentaperusteista vuodelle 2025', url: VERO_WITHHOLDING_2025 },
      { what: 'Municipal and parish rates', instrument: `Kuntien ja seurakuntien tuloveroprosentit vuonna 2025, ${FI_MUNICIPAL_RATES_SOURCE['2025']!.decision}`, url: FI_MUNICIPAL_RATES_SOURCE['2025']!.url },
    ],
    citationDate: '2026-09-29',
  },
];

// ─── Municipalities ──────────────────────────────────────────────────────────

export interface FinnishMunicipality {
  name: string;
  /** Municipal income-tax rate as a FRACTION (0.053 = 5.3%). */
  municipalRate: number;
  /** Evangelical Lutheran parish rate as a fraction — the church most members belong to. */
  evangelicalLutheranRate: number;
  /** Orthodox parish rate as a fraction. */
  orthodoxRate: number;
  /** Åland municipalities: a different tax system this engine does not model. */
  aland: boolean;
}

/**
 * The sixteen Åland municipalities. Åland residents pay state tax on a scale
 * 12.64 points lower, take a different basic deduction and pay a media fee
 * instead of YLE tax (Vero's 2026 decision, 4.4 and 7.1) — the mainland
 * arithmetic would overstate their tax by thousands, so they are refused.
 */
export const FI_ALAND_MUNICIPALITIES: readonly string[] = Object.freeze([
  'Brändö', 'Eckerö', 'Finström', 'Föglö', 'Geta', 'Hammarland', 'Jomala', 'Kumlinge',
  'Kökar', 'Lemland', 'Lumparland', 'Maarianhamina', 'Saltvik', 'Sottunga', 'Sund', 'Vårdö',
]);
const ALAND = new Set(FI_ALAND_MUNICIPALITIES);

/**
 * Swedish names, keyed in FOLDED form (lower case, diacritics removed — see
 * fold()), mapped to the name Vero's table uses. Finland is officially
 * bilingual and many municipalities are Swedish-speaking, so "Helsingfors",
 * "Åbo" or "Pargas" are not typos; an assistant relaying a question asked in
 * Swedish will pass them. Finnish names need no entry: case- and
 * diacritic-insensitive matching already finds "jyvaskyla".
 */
export const FI_MUNICIPALITY_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  helsingfors: 'Helsinki', esbo: 'Espoo', vanda: 'Vantaa', grankulla: 'Kauniainen',
  abo: 'Turku', tammerfors: 'Tampere', uleaborg: 'Oulu', lahtis: 'Lahti', vasa: 'Vaasa',
  borga: 'Porvoo', kyrkslatt: 'Kirkkonummi', sibbo: 'Sipoo', tusby: 'Tuusula', traskanda: 'Järvenpää',
  kervo: 'Kerava', lojo: 'Lohja', karleby: 'Kokkola', jakobstad: 'Pietarsaari', villmanstrand: 'Lappeenranta',
  bjorneborg: 'Pori', raumo: 'Rauma', tavastehus: 'Hämeenlinna', mariehamn: 'Maarianhamina',
  'st. michel': 'Mikkeli', 'sankt michel': 'Mikkeli', nyslott: 'Savonlinna', tornea: 'Tornio',
  kajana: 'Kajaani', hyvinge: 'Hyvinkää', raseborg: 'Raasepori', pargas: 'Parainen', kimitoon: 'Kemiönsaari',
  hango: 'Hanko', lovisa: 'Loviisa', kasko: 'Kaskinen', narpes: 'Närpiö', korsholm: 'Mustasaari',
  malax: 'Maalahti', pedersore: 'Pedersören kunta', vora: 'Vöyri', larsmo: 'Luoto', kronoby: 'Kruunupyy',
  inga: 'Inkoo', sjundea: 'Siuntio', kristinestad: 'Kristiinankaupunki', nykarleby: 'Uusikaarlepyy',
  nystad: 'Uusikaupunki', fredrikshamn: 'Hamina', kotka: 'Kotka', koski: 'Koski Tl',
});

const fold = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

const municipalCache = new Map<string, readonly FinnishMunicipality[]>();

/** Every municipality for a tax year, or [] when that year's table is not held. */
export function finnishMunicipalities(taxYear: string): readonly FinnishMunicipality[] {
  const hit = municipalCache.get(taxYear);
  if (hit) return hit;
  const raw = FI_MUNICIPAL_RATES_RAW[taxYear];
  if (!raw) return [];
  const rows = Object.freeze(
    raw.split('\n').map((line) => {
      const [name, m, e, o] = line.split('|');
      return Object.freeze({
        name: name!,
        municipalRate: Math.round(Number(m) * 100) / 10000,
        evangelicalLutheranRate: Math.round(Number(e) * 100) / 10000,
        orthodoxRate: Math.round(Number(o) * 100) / 10000,
        aland: ALAND.has(name!),
      });
    }),
  );
  municipalCache.set(taxYear, rows);
  return rows;
}

/**
 * Look a municipality up by name — Finnish or Swedish, any case, with or
 * without diacritics ("Jyvaskyla" finds Jyväskylä). Null when nothing matches,
 * so a caller can say so instead of silently using the average.
 */
export function findFinnishMunicipality(name: string, taxYear: string): FinnishMunicipality | null {
  const list = finnishMunicipalities(taxYear);
  if (!list.length || typeof name !== 'string') return null;
  const exact = name.trim().toLowerCase();
  const byExact = list.find((m) => m.name.toLowerCase() === exact);
  if (byExact) return byExact;
  const folded = fold(name);
  const byFold = list.find((m) => fold(m.name) === folded);
  if (byFold) return byFold;
  const alias = FI_MUNICIPALITY_ALIASES[folded];
  return alias ? list.find((m) => m.name === alias) ?? null : null;
}

// ─── Wages ───────────────────────────────────────────────────────────────────

export interface FinnishWageOptions {
  /** Municipal rate as a fraction; omit for the published average. */
  localTaxRate?: number;
  /** Church-tax rate as a fraction for a parish member; omit or 0 otherwise. */
  churchTaxRate?: number;
  /** Age at the end of the tax year; omit to assume a working age of 18–52. */
  age?: number;
}

/** Every component, EXACT (unrounded) — callers choose their own rounding. */
export interface FinnishWageBreakdown {
  taxYear: string;
  gross: number;
  costDeduction: number;
  netEarnedIncome: number;
  pension: number;
  unemployment: number;
  dailyAllowance: number;
  basicDeduction: number;
  taxableIncome: number;
  stateTax: number;
  municipalTax: number;
  churchTax: number;
  medicalCare: number;
  /** The full credit the wages earn, before it meets the taxes it can reduce. */
  workCredit: number;
  /** The part of it those taxes could absorb — never more than they total. */
  workCreditUsed: number;
  yleTax: number;
  /** State + municipal + church + medical care − credit used + YLE + daily
   *  allowance: what the tax card withholds. */
  taxCardTotal: number;
  /** taxCardTotal + pension + unemployment: everything taken from pay. */
  totalDeductions: number;
  municipalRate: number;
  churchRate: number;
  pensionRate: number;
  /** Assumptions the figures depend on, in plain words. */
  assumptions: string[];
}

function progressive(income: number, bands: readonly FinnishBand[]): number {
  let tax = 0;
  let lower = 0;
  for (const b of bands) {
    const upper = b.upTo ?? Infinity;
    if (income > lower) tax += (Math.min(income, upper) - lower) * b.rate;
    lower = upper;
    if (income <= upper) break;
  }
  return tax;
}

/** Resolve a tax year by label, or by today's date in Helsinki when omitted.
 *  An explicit label that is not held returns undefined — never a neighbour. */
export function resolveFinnishYear(taxYear?: string, today?: string): FinnishEarnedIncomeYear | undefined {
  if (taxYear) return FI_EARNED_INCOME_YEARS.find((y) => y.taxYear === taxYear);
  const d = today ?? helsinkiToday();
  return FI_EARNED_INCOME_YEARS.find((y) => y.effectiveFrom <= d) ?? FI_EARNED_INCOME_YEARS[FI_EARNED_INCOME_YEARS.length - 1];
}

function helsinkiToday(): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Helsinki', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * The upper age of the TyEL insurance obligation depends on the birth year
 * (Vero's withholding decisions, 4.3.1): 68 for those born 1957 or earlier,
 * 69 for 1958–1961, 70 from 1962.
 */
function pensionUpperAge(birthYear: number): number {
  if (birthYear <= 1957) return 68;
  if (birthYear <= 1961) return 69;
  return 70;
}

/**
 * `rounding: 'cents'` (the default) rounds every tax and contribution to the
 * cent before they are added up, which is what the assessment does — with it
 * the result reproduces Vero's published examples to the cent (three 2026 rows
 * came out a cent low without it). `'exact'` leaves them unrounded, for callers
 * that difference liability over a one-euro step (the engine's marginal rate),
 * where cent quantisation would add up to a point of noise.
 */
export function finnishWageTax(
  gross: number,
  year: FinnishEarnedIncomeYear,
  options: FinnishWageOptions = {},
  rounding: 'cents' | 'exact' = 'cents',
): FinnishWageBreakdown {
  // Half-up on the DECIMAL value. `Math.round(n * 100)` alone rounds half-cents
  // down whenever the product lands a hair under .5 in binary — 2369.895 × 100
  // is 236989.49999999997 — and that was the last cent between this and Vero's
  // €50,000 example. Trimming the product to six places first removes the noise.
  const c = rounding === 'cents' ? (n: number) => Math.round(+(n * 100).toFixed(6)) / 100 : (n: number) => n;
  const g = Number.isFinite(gross) && gross > 0 ? gross : 0;
  const age = options.age;
  const municipalRate = options.localTaxRate ?? year.averageMunicipalRate;
  const churchRate = options.churchTaxRate ?? 0;
  // Validated HERE, not only in calcIncomeTax's resolveOptions: this function
  // is exported, and a direct caller passing 1.8 for "1.8%" would otherwise get
  // church tax a hundred times too high, or a misleading Åland error for 5.3.
  for (const [k, v] of [['localTaxRate', municipalRate], ['churchTaxRate', churchRate]] as const) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1) {
      throw new RangeError(`${k} must be a fraction between 0 and 1 (e.g. 0.053 for 5.3%), got ${String(v)}`);
    }
  }
  if (age != null && (!Number.isInteger(age) || age < 0 || age > 130)) {
    throw new RangeError(`age must be a whole number of years, got ${String(age)}`);
  }
  if (municipalRate >= 0.15) {
    // Only Åland municipalities levy this much (17–20%), because Åland's state
    // scale is 12.64 points lower to compensate. The mainland scale on an Åland
    // rate would double-count those points.
    throw new RangeError(`A municipal rate of ${(municipalRate * 100).toFixed(2)}% is an Åland rate; Åland taxation (its own state scale, basic deduction and media fee) is not modelled.`);
  }

  // Age rules, by age at the end of the year (see the header on part years).
  const birthYear = age == null ? null : Number(year.taxYear) - age;
  let pensionRate = year.pension.rate;
  if (age != null && birthYear != null) {
    if (age < 17 || age >= pensionUpperAge(birthYear)) pensionRate = 0;
    else if (year.pension.elevated && age >= year.pension.elevated.fromAge && age <= year.pension.elevated.toAge) pensionRate = year.pension.elevated.rate;
  }
  const unemploymentApplies = age == null || (age >= 18 && age <= 64);
  const dailyAllowanceAge = age == null || (age >= 16 && age <= 68);
  const yleApplies = age == null || age >= 18;
  // "Turned 65 before the start of the tax year" = 66 or older at its end.
  const creditMax = year.workCredit.max + (age != null && age >= 66 ? year.workCredit.age65Increase : 0);

  const costDeduction = Math.min(g, year.costDeduction);
  const netEarnedIncome = g - costDeduction;

  const pension = c(g * pensionRate);
  const unemployment = c(unemploymentApplies ? g * year.unemploymentRate : 0);
  const dailyAllowance = c(dailyAllowanceAge && g >= year.dailyAllowance.threshold ? g * year.dailyAllowance.rate : 0);

  const beforeBasic = Math.max(0, netEarnedIncome - pension - unemployment - dailyAllowance);
  const basicDeduction =
    beforeBasic <= year.basicDeduction.max
      ? beforeBasic
      : Math.max(0, year.basicDeduction.max - year.basicDeduction.phaseOutRate * (beforeBasic - year.basicDeduction.max));
  const taxableIncome = Math.max(0, beforeBasic - basicDeduction);

  const stateTax = c(progressive(taxableIncome, year.stateBands));
  const municipalTax = c(taxableIncome * municipalRate);
  const churchTax = c(taxableIncome * churchRate);
  const medicalCare = c(taxableIncome * year.medicalCareRate);

  let phaseOut = 0;
  for (const band of year.workCredit.phaseOut) {
    const top = band.to ?? Infinity;
    if (netEarnedIncome > band.from) phaseOut += (Math.min(netEarnedIncome, top) - band.from) * band.rate;
  }
  const workCredit = c(Math.max(0, Math.min(g * year.workCredit.rate, creditMax) - phaseOut));
  const creditable = stateTax + municipalTax + churchTax + medicalCare;
  const workCreditUsed = Math.min(workCredit, creditable);

  const yleTax = c(yleApplies ? Math.min(year.yle.max, Math.max(0, (netEarnedIncome - year.yle.threshold) * year.yle.rate)) : 0);

  const taxCardTotal = c(creditable - workCreditUsed + yleTax + dailyAllowance);
  const totalDeductions = c(taxCardTotal + pension + unemployment);

  const pct = (r: number) => `${+(r * 100).toFixed(2)}%`;
  const assumptions = [
    options.localTaxRate == null
      ? `Municipal tax at the ${year.taxYear} national average of ${pct(municipalRate)} — pass your municipality for its own rate (Helsinki and Espoo are 5.3%).`
      : `Municipal tax at ${pct(municipalRate)}.`,
    churchRate > 0 ? `Church tax at ${pct(churchRate)} (parish member).` : 'Not a member of a parish, so no church tax.',
    age == null
      ? 'Assumes an employee aged 18–52 with wages only, no children and no other deductions.'
      : `Age ${age} at the end of ${year.taxYear}; contributions that start or stop on a birthday are applied for the whole year. Wages only, no children and no other deductions.`,
  ];

  return {
    taxYear: year.taxYear, gross: g, costDeduction, netEarnedIncome, pension, unemployment, dailyAllowance,
    basicDeduction, taxableIncome, stateTax, municipalTax, churchTax, medicalCare, workCredit, workCreditUsed,
    yleTax, taxCardTotal, totalDeductions, municipalRate, churchRate, pensionRate, assumptions,
  };
}

/**
 * The tax-card withholding rate (veroprosentti) Vero would set for this pay:
 * the tax-card total as a share of gross, rounded UP to the next half point
 * (withholding decision, section 8). Employee pension and unemployment
 * contributions are withheld separately and are not part of it.
 */
export function finnishTaxCardRate(b: FinnishWageBreakdown): number {
  if (b.gross <= 0) return 0;
  const exact = (b.taxCardTotal / b.gross) * 100;
  // Guard float noise: 18.500000000000004 must stay 18.5, not climb to 19.
  const halfPoints = Math.ceil(Math.round(exact * 2 * 1e6) / 1e6);
  return Math.min(60, halfPoints / 2);
}

// ─── Capital gains ───────────────────────────────────────────────────────────

export interface FinnishCapitalIncomeYear {
  taxYear: string;
  effectiveFrom: string;
  /** Capital income tax: `rate` up to `threshold`, `higherRate` above (TVL 124 § 2 mom). */
  rate: number;
  higherRate: number;
  threshold: number;
  /** Deemed acquisition cost as a share of the sale price (TVL 46 § 1 mom). */
  deemedCost: { rate: number; longRate: number; longYears: number };
  /** All gains of a year are tax-free when that year's total sale prices are at
   *  most this (TVL 48 § 6 mom). */
  smallDisposalsThreshold: number;
  /** Capital losses carry forward this many years (TVL 50 §). */
  lossCarryForwardYears: number;
  sources: readonly FinnishSource[];
  citationDate: string;
}

const CAPITAL_SOURCES: readonly FinnishSource[] = [
  { what: 'Capital income tax rates', instrument: 'Tuloverolaki 124 § 2 mom', url: TVL },
  { what: 'Deemed acquisition cost', instrument: 'Tuloverolaki 46 § 1 mom', url: TVL },
  { what: 'Small-disposals exemption and loss rules', instrument: 'Tuloverolaki 48 § 6 mom and 50 §', url: TVL },
  { what: 'How gains are taxed in practice', instrument: 'Verohallinto: Selling shares', url: 'https://www.vero.fi/en/individuals/property/investments/selling-shares/' },
];

export const FI_CAPITAL_INCOME_YEARS: readonly FinnishCapitalIncomeYear[] = [
  { taxYear: '2026', effectiveFrom: '2026-01-01', rate: 0.3, higherRate: 0.34, threshold: 30000, deemedCost: { rate: 0.2, longRate: 0.4, longYears: 10 }, smallDisposalsThreshold: 1000, lossCarryForwardYears: 5, sources: CAPITAL_SOURCES, citationDate: '2026-09-29' },
  { taxYear: '2025', effectiveFrom: '2025-01-01', rate: 0.3, higherRate: 0.34, threshold: 30000, deemedCost: { rate: 0.2, longRate: 0.4, longYears: 10 }, smallDisposalsThreshold: 1000, lossCarryForwardYears: 5, sources: CAPITAL_SOURCES, citationDate: '2026-09-29' },
];

export interface FinnishCapitalGainInput {
  /** Sale price. */
  proceeds: number;
  /** What the asset cost. */
  acquisitionCost: number;
  /** Costs of the sale and purchase (brokerage, fees) — part of the actual-cost method. */
  saleExpenses?: number;
  /** Whole years owned; 10 or more raises the deemed cost from 20% to 40%. Omit
   *  to assume under 10 years (the smaller deemed cost — the cautious side). */
  yearsHeld?: number;
  /** Other capital income this year (dividends, rent, other gains): decides how
   *  much of the gain falls above the 30 000 € threshold. */
  otherCapitalIncome?: number;
  /** Capital losses available to offset this gain (same year or carried forward). */
  capitalLosses?: number;
  /** The year's total sale prices, THIS sale included — tests the 1 000 € rule.
   *  Omit when this is the only sale of the year. */
  totalProceedsThisYear?: number;
  taxYear?: string;
}

export interface FinnishCapitalGainResult {
  taxYear: string;
  proceeds: number;
  /** actual = acquisition cost + expenses; deemed = 20% / 40% of the price. */
  method: 'actual' | 'deemed';
  deemedCostRate: number;
  costDeducted: number;
  gain: number;
  /** A loss (only ever from the actual-cost method — the deemed cost cannot create one). */
  loss: number;
  lossDeductible: boolean;
  smallDisposalsExempt: boolean;
  lossesApplied: number;
  taxableGain: number;
  tax: number;
  notes: string[];
}

export function resolveFinnishCapitalYear(taxYear?: string, today?: string): FinnishCapitalIncomeYear | undefined {
  if (taxYear) return FI_CAPITAL_INCOME_YEARS.find((y) => y.taxYear === taxYear);
  const d = today ?? helsinkiToday();
  return FI_CAPITAL_INCOME_YEARS.find((y) => y.effectiveFrom <= d) ?? FI_CAPITAL_INCOME_YEARS[FI_CAPITAL_INCOME_YEARS.length - 1];
}

function capitalTax(income: number, y: FinnishCapitalIncomeYear): number {
  const x = Math.max(0, income);
  return Math.min(x, y.threshold) * y.rate + Math.max(0, x - y.threshold) * y.higherRate;
}

/**
 * Tax on one disposal, as the EXTRA capital income tax it causes on top of the
 * year's other capital income. Returns null for an explicit tax year not held.
 * Throws RangeError on inputs that cannot describe a real sale.
 */
export function finnishCapitalGainTax(input: FinnishCapitalGainInput): FinnishCapitalGainResult | null {
  const y = resolveFinnishCapitalYear(input.taxYear);
  if (!y) return null;
  const nums: Record<string, number | undefined> = {
    proceeds: input.proceeds, acquisitionCost: input.acquisitionCost, saleExpenses: input.saleExpenses,
    yearsHeld: input.yearsHeld, otherCapitalIncome: input.otherCapitalIncome, capitalLosses: input.capitalLosses,
    totalProceedsThisYear: input.totalProceedsThisYear,
  };
  for (const [k, v] of Object.entries(nums)) {
    // proceeds and acquisitionCost are required: skipping them when undefined
    // let a missing cost silently become NaN and pick the 'deemed' method.
    const required = k === 'proceeds' || k === 'acquisitionCost';
    if ((required || v !== undefined) && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) {
      throw new RangeError(`${k} must be a non-negative number, got ${String(v)}`);
    }
  }
  const proceeds = input.proceeds;
  const expenses = input.saleExpenses ?? 0;
  const totalProceeds = input.totalProceedsThisYear ?? proceeds;
  if (totalProceeds < proceeds) throw new RangeError('totalProceedsThisYear must include this sale, so it cannot be less than proceeds');

  const long = (input.yearsHeld ?? 0) >= y.deemedCost.longYears;
  const deemedCostRate = long ? y.deemedCost.longRate : y.deemedCost.rate;
  const actual = input.acquisitionCost + expenses;
  const deemed = proceeds * deemedCostRate;
  // Whichever is more favourable, never both (TVL 46 § 1 mom).
  const method: 'actual' | 'deemed' = actual >= deemed ? 'actual' : 'deemed';
  const costDeducted = Math.max(actual, deemed);
  const gain = Math.max(0, proceeds - costDeducted);
  const loss = Math.max(0, actual - proceeds);

  const smallDisposalsExempt = totalProceeds <= y.smallDisposalsThreshold;
  // A loss on small disposals is not deductible when their acquisition costs are
  // also within the threshold (TVL 50 § 2 mom). Only this disposal's cost is
  // known here, which is exact when it is the year's only sale.
  const lossDeductible = loss > 0 && !(smallDisposalsExempt && input.acquisitionCost <= y.smallDisposalsThreshold);

  const available = input.capitalLosses ?? 0;
  const lossesApplied = smallDisposalsExempt ? 0 : Math.min(available, gain);
  const taxableGain = smallDisposalsExempt ? 0 : gain - lossesApplied;
  const other = input.otherCapitalIncome ?? 0;
  const tax = capitalTax(other + taxableGain, y) - capitalTax(other, y);

  const notes: string[] = [];
  if (method === 'deemed') notes.push(`The deemed acquisition cost (${deemedCostRate * 100}% of the sale price${long ? `, held ${y.deemedCost.longYears} years or more` : ''}) beat the actual cost, so it was used.`);
  if (input.yearsHeld === undefined && method === 'deemed') notes.push(`Assumed held under ${y.deemedCost.longYears} years; ${y.deemedCost.longYears}+ years raises the deemed cost to ${y.deemedCost.longRate * 100}%.`);
  if (smallDisposalsExempt && gain > 0) notes.push(`Tax-free: the year's sale prices total ${Math.round(totalProceeds)} €, within the ${y.smallDisposalsThreshold} € small-disposals rule.`);
  if (loss > 0) {
    notes.push(lossDeductible
      ? `A loss of ${Math.round(loss)} €: deductible from this year's capital gains and then other capital income, and carried forward ${y.lossCarryForwardYears} years.`
      : `A loss of ${Math.round(loss)} € that is not deductible, because the year's sale prices and acquisition costs are both within ${y.smallDisposalsThreshold} €.`);
  }
  if (taxableGain > 0 && other + taxableGain > y.threshold) notes.push(`Capital income above ${y.threshold} € is taxed at ${y.higherRate * 100}% instead of ${y.rate * 100}%.`);

  return {
    taxYear: y.taxYear, proceeds, method, deemedCostRate, costDeducted, gain, loss, lossDeductible,
    smallDisposalsExempt, lossesApplied, taxableGain, tax, notes,
  };
}
