/**
 * Income-tax schemes from DATA — the factory behind most countries in
 * INCOME_TAX_SCHEMES. @ai2/tax-plugins — embracingearth.space
 *
 * WHY A FACTORY. AU, GB, IN, US, CA and FI each have hand-written hooks in
 * incomeTax.ts, because each has a rule that does not fit a table (the AU
 * Medicare shade-in, the IN 87A marginal relief, Finland's tax-card order).
 * Most countries do not: their wage tax is a band table, a pre-band deduction
 * or two, a credit or two that phase in or out on a straight line, and perhaps
 * a surtax. Writing a module of hooks per country for that would be forty
 * copies of the same twelve lines, each a chance to get the order wrong. So a
 * country here is a RECORD (CountryIncomeTaxData) and buildIncomeTaxScheme()
 * turns it into the same IncomeTaxScheme the hand-written countries are.
 *
 * THE RULE VOCABULARY, in the order the engine applies it:
 *
 *   deductions  gross → taxable. Applied in order, each seeing what the
 *               earlier ones already took. The total is capped at gross.
 *                 fixed     a flat amount (DE Arbeitnehmer-Pauschbetrag)
 *                 share     rate × the part of gross between `floor` and
 *                           `ceiling`, clamped to [min, max] (FR 10% abattement
 *                           min 509 / max 14,555; an employee contribution of
 *                           9.19% the law makes deductible)
 *                 schedule  piecewise-linear in gross (ES reducción art. 20)
 *                 custom    anything else, as a function
 *   bands       progressive tax on taxable — or `tariff`, a statutory formula
 *               used instead (DE §32a), where the law IS a formula.
 *   credits     non-refundable reductions of that tax, applied in order, each
 *               capped at what is left, so the sum never exceeds the tax.
 *                 fixed        a flat credit (IE personal + employee credits)
 *                 schedule     piecewise-linear in gross or taxable (NL
 *                              arbeidskorting, algemene heffingskorting)
 *                 taxOnAmount  the bands' own tax on the first `amount` of
 *                              taxable income (ES mínimo personal: "cuota
 *                              sobre el mínimo")
 *                 custom       anything else
 *   levies      charges that are legally part of income tax, computed after
 *               the credits (DE solidarity surcharge, IE USC, KR local income
 *               tax). Social-security contributions are NOT levies here — see
 *               each country's `assumptions`.
 *                 bands        a progressive table on gross or taxable, with
 *                              an optional all-or-nothing exemption
 *                 shareOfTax   rate × the income tax after credits
 *                 custom       anything else
 *
 * PROVENANCE IS PER YEAR. Every year carries its own source, authority,
 * citation date and `verified` flag, because the research often confirms one
 * year on the authority's page and not the other. `verified: false` REQUIRES a
 * `verificationNote` saying why — the engine repeats it in the result's
 * assumptions so a consumer can say "confirm with the authority" instead of
 * presenting the figure as fact. The builder refuses a record that breaks any
 * of this, at module load, so a bad record fails every test rather than
 * shipping.
 *
 * NEVER EDIT A YEAR IN PLACE once it has shipped: append the next year at the
 * top of `years`.
 */
import type {
  IncomeTaxBand,
  IncomeLineItem,
  IncomeTaxScheme,
  IncomeTaxOptions,
  IncomeTaxRegion,
  MoneyRounding,
} from './incomeTax';
import { progressive, piecewiseLinear, nonNegative } from './incomeTaxMath';

export type IncomeBase = 'gross' | 'taxable';

type Points = readonly (readonly [number, number])[];

/** What a custom deduction sees. */
export interface DeductionRuleContext {
  gross: number;
  /** Total of the deductions applied before this one. */
  deductedSoFar: number;
  q: MoneyRounding;
  year: IncomeTaxYearData;
  options: Readonly<IncomeTaxOptions>;
}

export type DeductionRule =
  | { kind: 'fixed'; name: string; amount: number }
  | { kind: 'share'; name: string; rate: number; floor?: number; ceiling?: number; min?: number; max?: number }
  | { kind: 'schedule'; name: string; points: Points }
  | { kind: 'custom'; name: string; amount: (ctx: DeductionRuleContext) => number };

/** What a custom credit sees. */
export interface CreditRuleContext {
  gross: number;
  taxable: number;
  /** Income tax from the bands (or tariff), before any credit. */
  incomeTax: number;
  /** Credits already applied. */
  creditsSoFar: number;
  q: MoneyRounding;
  year: IncomeTaxYearData;
  options: Readonly<IncomeTaxOptions>;
}

export type CreditRule =
  | { kind: 'fixed'; name: string; amount: number }
  | { kind: 'schedule'; name: string; base: IncomeBase; points: Points }
  | { kind: 'taxOnAmount'; name: string; amount: number }
  | { kind: 'custom'; name: string; amount: (ctx: CreditRuleContext) => number };

/** What a custom levy sees. */
export interface LevyRuleContext {
  gross: number;
  taxable: number;
  incomeTax: number;
  /** Income tax after the credits — the base a surtax on "the tax" is charged on. */
  taxAfterCredits: number;
  q: MoneyRounding;
  year: IncomeTaxYearData;
  options: Readonly<IncomeTaxOptions>;
}

export type LevyRule =
  | { kind: 'bands'; name: string; base: IncomeBase; bands: IncomeTaxBand[]; exemptUpTo?: number }
  | { kind: 'shareOfTax'; name: string; rate: number }
  | { kind: 'custom'; name: string; amount: (ctx: LevyRuleContext) => number };

export interface IncomeTaxYearData {
  /** Label shown to users and accepted as `taxYear`, e.g. '2026' or '2026-27'. */
  taxYear: string;
  /** ISO date the year starts (inclusive), in the country's own calendar. */
  effectiveFrom: string;
  /** Progressive bands on TAXABLE income (after `deductions`). With a
   *  `tariff`, these describe its zones for display only. */
  bands: IncomeTaxBand[];
  /** A statutory tariff formula used instead of `bands`. Must round through `q`. */
  tariff?: (taxable: number, q: MoneyRounding) => number;
  deductions?: DeductionRule[];
  credits?: CreditRule[];
  levies?: LevyRule[];
  /** The official page these figures were read on. https only. */
  source: string;
  authorityName: string;
  /** YYYY-MM-DD the figures were read on `source`. */
  citationDate: string;
  /** TRUE only when every figure above was confirmed on an official https authority page. */
  verified: boolean;
  /** Required when `verified` is false: why, in words a user can act on. */
  verificationNote?: string;
  /** What this year's estimate assumes beyond the country's standing assumptions. */
  assumptions?: string[];
}

export interface CountryIncomeTaxData {
  /** ISO 3166-1 alpha-2. */
  code: string;
  country: string;
  currency: string;
  locale: string;
  /** IANA zone the tax year rolls over in. */
  timeZone: string;
  /** The file a person edits to append the next year (rate watch names it). */
  file: string;
  /** What the estimate covers and excludes, in one paragraph. */
  note: string;
  /** Standing assumptions, true of every year (filing status, what is excluded). */
  assumptions: string[];
  /** Optional regional caveat, e.g. 'Mainland Portugal — Azores and Madeira differ'. */
  region?: string;
  optionsSupported?: readonly (keyof IncomeTaxOptions)[];
  /**
   * The default local (municipal/cantonal) income-tax rate for a year, as a
   * fraction, where the country has one that varies by locality and the
   * research gives an OFFICIAL average or named default. A custom levy reads
   * `options.localTaxRate ?? defaultLocalTaxRate(year)`; declare
   * 'localTaxRate' in optionsSupported so a caller can pass their own.
   */
  defaultLocalTaxRate?: (taxYearLabel: string) => number;
  /**
   * Sub-national jurisdictions selectable with options.region (see
   * IncomeTaxRegion in incomeTax.ts). 'region' is added to optionsSupported
   * automatically.
   */
  regions?: Record<string, IncomeTaxRegion>;
  /** Newest first. */
  years: IncomeTaxYearData[];
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Refuse a record that would ship without provenance or out of order. */
function validate(d: CountryIncomeTaxData): void {
  const where = `income-tax data ${d.code}`;
  if (!/^[A-Z]{2}$/.test(d.code)) throw new Error(`${where}: code must be ISO alpha-2`);
  if (d.years.length === 0) throw new Error(`${where}: no years`);
  const labels = new Set<string>();
  d.years.forEach((y, i) => {
    const at = `${where} ${y.taxYear}`;
    if (labels.has(y.taxYear)) throw new Error(`${at}: duplicate tax year`);
    labels.add(y.taxYear);
    if (!YMD.test(y.effectiveFrom)) throw new Error(`${at}: effectiveFrom must be YYYY-MM-DD`);
    if (i > 0 && !(y.effectiveFrom < d.years[i - 1]!.effectiveFrom)) throw new Error(`${at}: years must be newest first`);
    if (!/^https:\/\//.test(y.source)) throw new Error(`${at}: source must be an https URL`);
    if (!y.authorityName) throw new Error(`${at}: authorityName missing`);
    if (!YMD.test(y.citationDate)) throw new Error(`${at}: citationDate must be YYYY-MM-DD`);
    if (typeof y.verified !== 'boolean') throw new Error(`${at}: verified must be a boolean`);
    if (!y.verified && !(y.verificationNote && y.verificationNote.trim())) throw new Error(`${at}: unverified year needs a verificationNote`);
    if (y.bands.length === 0 && !y.tariff) throw new Error(`${at}: no bands and no tariff`);
    let prev = -Infinity;
    y.bands.forEach((b, j) => {
      if (!(b.rate >= 0 && b.rate < 1)) throw new Error(`${at}: band rate ${b.rate} is not a fraction`);
      const last = j === y.bands.length - 1;
      if (last !== (b.upTo === null)) throw new Error(`${at}: only the last band may (and must) be open-ended`);
      if (b.upTo !== null) {
        if (!(b.upTo > prev)) throw new Error(`${at}: band limits must ascend`);
        prev = b.upTo;
      }
    });
  });
}

function deductionAmount(r: DeductionRule, gross: number, deductedSoFar: number, q: MoneyRounding, year: IncomeTaxYearData, options: Readonly<IncomeTaxOptions>): number {
  switch (r.kind) {
    case 'fixed':
      return r.amount;
    case 'share': {
      const top = r.ceiling === undefined ? gross : Math.min(gross, r.ceiling);
      let v = nonNegative(top - (r.floor ?? 0)) * r.rate;
      if (r.min !== undefined) v = Math.max(v, r.min);
      if (r.max !== undefined) v = Math.min(v, r.max);
      return v;
    }
    case 'schedule':
      return piecewiseLinear(gross, r.points);
    case 'custom':
      return r.amount({ gross, deductedSoFar, q, year, options });
  }
}

function creditAmount(r: CreditRule, ctx: CreditRuleContext, bands: readonly IncomeTaxBand[]): number {
  switch (r.kind) {
    case 'fixed':
      return r.amount;
    case 'schedule':
      return piecewiseLinear(r.base === 'gross' ? ctx.gross : ctx.taxable, r.points);
    case 'taxOnAmount':
      return progressive(Math.min(r.amount, ctx.taxable), bands);
    case 'custom':
      return r.amount(ctx);
  }
}

function levyAmount(r: LevyRule, ctx: LevyRuleContext): number {
  switch (r.kind) {
    case 'bands': {
      const base = r.base === 'gross' ? ctx.gross : ctx.taxable;
      if (r.exemptUpTo !== undefined && base <= r.exemptUpTo) return 0;
      return progressive(base, r.bands);
    }
    case 'shareOfTax':
      return ctx.taxAfterCredits * r.rate;
    case 'custom':
      return r.amount(ctx);
  }
}

/** The deductions for one year, applied in order and capped at gross. */
export function applyDeductions(year: IncomeTaxYearData, gross: number, q: MoneyRounding, options: Readonly<IncomeTaxOptions> = {}): number {
  let total = 0;
  for (const r of year.deductions ?? []) {
    total += nonNegative(deductionAmount(r, gross, total, q, year, options));
    if (total >= gross) return gross;
  }
  return total;
}

/** The credits for one year, each capped at the tax still left. */
export function applyCredits(
  year: IncomeTaxYearData,
  ctx: Omit<CreditRuleContext, 'creditsSoFar' | 'year'>,
): IncomeLineItem[] {
  const out: IncomeLineItem[] = [];
  let used = 0;
  for (const r of year.credits ?? []) {
    const left = nonNegative(ctx.incomeTax - used);
    if (left <= 0) break;
    const raw = nonNegative(creditAmount(r, { ...ctx, creditsSoFar: used, year }, year.bands));
    const amount = ctx.q.round(Math.min(raw, left));
    if (amount > 0) {
      out.push({ name: r.name, amount });
      used += amount;
    }
  }
  return out;
}

/** The levies for one year (rounded, zero lines dropped). */
export function applyLevies(year: IncomeTaxYearData, ctx: Omit<LevyRuleContext, 'year'>): IncomeLineItem[] {
  const out: IncomeLineItem[] = [];
  for (const r of year.levies ?? []) {
    const amount = ctx.q.round(nonNegative(levyAmount(r, { ...ctx, year })));
    if (amount > 0) out.push({ name: r.name, amount });
  }
  return out;
}

/**
 * Turn a country record into the IncomeTaxScheme the engine runs.
 *
 * Scheme-level provenance is DERIVED, never restated: `source` and
 * `authorityName` are the newest year's, `citationDate` the stalest year's (a
 * scheme is only as fresh as its oldest figure), and `verified` is true only
 * when every year is. Each set also carries its own provenance, which is what
 * calcIncomeTax, coverage() and the rate watch actually judge.
 */
export function buildIncomeTaxScheme(d: CountryIncomeTaxData): IncomeTaxScheme {
  validate(d);
  const byLabel = new Map(d.years.map((y) => [y.taxYear, y]));
  const yearFor = (label: string): IncomeTaxYearData => {
    const y = byLabel.get(label);
    if (!y) throw new Error(`No ${d.code} income-tax year ${label}`);
    return y;
  };
  const newest = d.years[0]!;
  return {
    code: d.code,
    country: d.country,
    currency: d.currency,
    locale: d.locale,
    timeZone: d.timeZone,
    file: d.file,
    sets: d.years.map((y) => ({
      effectiveFrom: y.effectiveFrom,
      taxYearLabel: y.taxYear,
      bands: y.bands.map((b) => ({ ...b })),
      ...(y.tariff ? { tariff: y.tariff } : {}),
      source: y.source,
      authorityName: y.authorityName,
      citationDate: y.citationDate,
      verified: y.verified,
      ...(y.verificationNote ? { verificationNote: y.verificationNote } : {}),
    })),
    deduction: ({ gross, taxYearLabel, q, options }) => applyDeductions(yearFor(taxYearLabel), gross, q, options),
    offsets: ({ gross, taxable, incomeTax, taxYearLabel, q, options }) =>
      applyCredits(yearFor(taxYearLabel), { gross, taxable, incomeTax, q, options }),
    levies: ({ gross, taxable, incomeTax, baseTax, taxYearLabel, q, options }) =>
      applyLevies(yearFor(taxYearLabel), { gross, taxable, incomeTax, taxAfterCredits: nonNegative(baseTax), q, options }),
    assumptions: ({ taxYearLabel }) => [...d.assumptions, ...(yearFor(taxYearLabel).assumptions ?? [])],
    ...(d.optionsSupported || d.regions
      ? { optionsSupported: [...new Set([...(d.optionsSupported ?? []), ...(d.regions ? (['region'] as const) : [])])] }
      : {}),
    ...(d.defaultLocalTaxRate ? { defaultLocalTaxRate: d.defaultLocalTaxRate } : {}),
    ...(d.regions ? { regions: d.regions } : {}),
    note: d.note,
    ...(d.region ? { region: d.region } : {}),
    source: newest.source,
    authorityName: newest.authorityName,
    citationDate: d.years.map((y) => y.citationDate).sort()[0]!,
    verified: d.years.every((y) => y.verified),
  };
}
