/**
 * Personal income tax — take-home estimator. @ai2/tax-plugins
 * embracingearth.space
 *
 * WHY THIS EXISTS. Before this file, the identical arithmetic lived in THREE
 * places that had already drifted from each other: the website's
 * lib/incomeTaxCalc.ts, the public Tax MCP's inline INCOME map, and this
 * engine's `{country}-IT` FILING plugins. Two confirmed production bugs came
 * from exactly that split — AU's Medicare levy not being offset by LITO below
 * ~$35k (the website and the MCP computed the combination in a different
 * order), and the MCP serving New Zealand's 2025-26 bracket set for months
 * into 2026-27 because only the website had added the new year. This is now
 * the one implementation; the website and the Tax MCP both render it rather
 * than each holding their own copy.
 *
 * SCOPE: general "what would I take home" arithmetic — general information,
 * not a filing figure and not tax advice. The `{country}-IT` plugins
 * (australiaIncomeTax.ts etc.) are a DIFFERENT, deliberately separate thing:
 * they model an actual return (ITR, Schedule C, Self-Assessment) at the
 * fidelity a filing needs, for the paid filing product. This module has no
 * relationship to those beyond covering some of the same countries — do not
 * reconcile the two into one; they answer different questions.
 *
 * EFFECTIVE-DATED: each country holds bracket SETS ordered newest-first, each
 * with an `effectiveFrom` + `taxYearLabel`, resolved by resolveIncomeSet() the
 * same way rateLedger.ts resolves consumption-tax rows — the newest set whose
 * effective date has arrived, or an explicit label override.
 *
 * COMPOSITION, in order (see calcIncomeTax): deduction(gross) → a pre-band
 * reduction (UK personal allowance with its taper; IN standard deduction; 0
 * for AU/NZ, whose tax-free step is the first 0% band instead) → progressive
 * tax on the taxable amount → offsets(ctx) → credits that reduce the tax (AU
 * LITO; IN s.87A rebate with marginal relief) → levies(ctx) → charges that
 * compound on the POST-OFFSET base (AU Medicare; UK National Insurance; IN
 * surcharge + cess). Order matters: AU's LITO must be free to spill over and
 * offset the Medicare levy too, not just the income tax component, which is
 * exactly the bug this file's history records.
 */
import { resolveEffectiveDated } from './effectiveDating';

export interface IncomeTaxBand {
  upTo: number | null;
  rate: number;
}

export interface IncomeLineItem {
  name: string;
  amount: number;
}

export interface IncomeBracketSet {
  /** ISO date the set takes effect (inclusive). */
  effectiveFrom: string;
  /** Display label, e.g. "2025-26". */
  taxYearLabel: string;
  bands: IncomeTaxBand[];
}

export interface IncomeTaxResult {
  code: string;
  country: string;
  currency: string;
  locale: string;
  taxYear: string;
  gross: number;
  taxable: number;
  incomeTax: number;
  levies: IncomeLineItem[];
  offsets: IncomeLineItem[];
  totalTax: number;
  takeHome: number;
  marginalRate: number;
  averageRate: number;
}

/**
 * THE YEAR REACHES EVERY HOOK, NOT JUST THE BANDS.
 *
 * `sets` is effective-dated, but deduction/offsets/levies/marginalRate are one
 * function per country — and the constants they hold are indexed annually just
 * as the bands are: the UK personal allowance and NI thresholds, India's
 * standard deduction and s.87A limits, the US standard deduction and FICA wage
 * base, Australia's Medicare low-income thresholds. Resolving 2024-25 bands and
 * then applying this year's constants to them would silently mix two tax years,
 * and every set added to `sets` widens that gap.
 *
 * So the resolved year travels with the context. Today every defined year's
 * constants happen to be identical — the UK thresholds are frozen to 2031,
 * India's schedule was carried forward unchanged, the US has a single year
 * defined, and Australia's LITO and 2% Medicare rate are unchanged across all
 * four — so no hook needs to branch yet and no figure changes. The plumbing is
 * here so that the first genuinely year-scoped constant is a data edit inside
 * one hook, rather than a signature change that has to be discovered first.
 */
export interface IncomeYearContext {
  /** How to quantise money to whole currency units. Normally real rounding;
   *  the engine swaps in a pass-through when it differences liability for the
   *  marginal rate, where whole-unit quantisation would flatten the answer into
   *  uselessness — see `marginalRateFor`. Hooks must go through THIS, never
   *  call Math.round/Math.floor directly, or they reintroduce the quantisation
   *  the marginal-rate pass is trying to lift. */
  q: MoneyRounding;
  /** The resolved set's label, e.g. '2025-26' — the year every constant in a
   *  hook must be read against. */
  taxYearLabel: string;
  /** The resolved set's effective date, for hooks keyed by date rather than label. */
  effectiveFrom: string;
}

/** Context passed to a country's offsets() — credits applied to the computed tax. */
export interface IncomeOffsetContext extends IncomeYearContext {
  gross: number;
  taxable: number;
  incomeTax: number;
}

/** Context passed to a country's levies() — charges on top of the tax.
 *  `baseTax` is the income tax AFTER offsets (rebates), so charges that compound
 *  on the net liability (IN surcharge + cess) use the right base. */
export interface IncomeLevyContext extends IncomeOffsetContext {
  baseTax: number;
}

/** Context passed to a country's deduction() — the pre-band reduction. */
export interface IncomeDeductionContext extends IncomeYearContext {
  gross: number;
}

/** One selectable tax year for a country, as returned by getIncomeTaxYears. */
export interface IncomeTaxYearOption {
  value: string;
  label: string;
  effectiveFrom: string;
  isCurrent: boolean;
}

export interface IncomeTaxScheme {
  code: string;
  country: string;
  currency: string;
  locale: string;
  /** IANA tz the financial year rolls over in (so 1 July is local, not UTC). */
  timeZone: string;
  /** Newest-first effective-dated bracket sets. */
  sets: IncomeBracketSet[];
  /** Pre-band deduction from gross (UK personal allowance, IN standard
   *  deduction). Omit when the tax-free step is a 0% band (AU/NZ). */
  deduction?: (ctx: IncomeDeductionContext) => number;
  levies: (ctx: IncomeLevyContext) => IncomeLineItem[];
  offsets: (ctx: IncomeOffsetContext) => IncomeLineItem[];
  note: string;
  /** Optional regional caveat (UK = England/Wales/NI only; Scotland differs). */
  region?: string;
  /** Authoritative source for this schedule. */
  source: string;
  authorityName: string;
  /** YYYY-MM-DD this schedule was last checked against `source`. */
  citationDate: string;
  /** TRUE only when checked against an official authority page. */
  verified: boolean;
}

/** How a calculation quantises money. Both members matter: statutes round some
 *  amounts and floor others (the UK allowance taper sheds £1 per WHOLE £2 over
 *  £100,000), and a marginal rate has to be able to lift both. */
export interface MoneyRounding {
  round: (n: number) => number;
  floor: (n: number) => number;
}

/** Real money: whole currency units, the way the authority publishes them. */
const wholeUnits: MoneyRounding = { round: Math.round, floor: Math.floor };
/** Pass-through — the policy used when differencing for a marginal rate. */
const exact: MoneyRounding = { round: (n) => n, floor: (n) => n };

function progressive(income: number, bands: IncomeTaxBand[]): number {
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

const grossOf = (gross: number) => (Number.isFinite(gross) && gross > 0 ? gross : 0);

/** Everything liability needs, for one income. Deliberately free of any
 *  marginal-rate concern so `marginalRateFor` can call it twice without
 *  recursing: the marginal rate is a property OF this, never an input to it. */
interface Liability {
  taxable: number;
  incomeTax: number;
  offsets: IncomeLineItem[];
  levies: IncomeLineItem[];
  totalTax: number;
}

function liabilityAt(
  c: IncomeTaxScheme,
  set: IncomeBracketSet,
  gross: number,
  q: MoneyRounding = wholeUnits,
): Liability {
  const g = grossOf(gross);

  // The resolved year and rounding policy, forwarded to every hook so a
  // year-scoped constant is read against the SAME year as the bands, and so
  // every hook rounds the same way this call was asked to.
  const year = { taxYearLabel: set.taxYearLabel, effectiveFrom: set.effectiveFrom, q };

  // 1. Pre-band deduction (capped at gross so taxable can't go negative).
  const deduction = c.deduction ? Math.min(g, c.deduction({ gross: g, ...year })) : 0;
  const taxable = Math.max(0, g - deduction);

  // 2. Progressive tax on the taxable amount.
  const incomeTax = q.round(progressive(taxable, set.bands));

  // 3. Offsets (rebates) reduce the tax first → baseTax. NOT floored at zero
  //    here: AU's LITO can exceed incomeTax at low incomes, and the leftover
  //    must still be able to offset the levy added in step 4 — one combined
  //    max(0, incomeTax + levy - offset) rather than two separately-floored
  //    steps. India's 87A rebate is self-bounded to incomeTax by its own
  //    offsets() above, so this changes nothing for IN.
  const offsets = c.offsets({ gross: g, taxable, incomeTax, ...year });
  const offsetsTotal = offsets.reduce((s, o) => s + o.amount, 0);
  const baseTax = incomeTax - offsetsTotal;

  // 4. Levies compound on top of the post-offset base (IN surcharge/cess need this).
  const levies = c.levies({ gross: g, taxable, incomeTax, baseTax, ...year });
  const leviesTotal = levies.reduce((s, l) => s + l.amount, 0);

  return { taxable, incomeTax, offsets, levies, totalTax: Math.max(0, baseTax + leviesTotal) };
}

/**
 * The marginal rate is DIFFERENCED from complete liability, never derived from
 * the band table. Reading the band the taxpayer's taxable income falls in gets
 * the answer wrong wherever anything other than the bands moves with income —
 * and something almost always does:
 *
 *   - Below a deduction, taxable is 0 and no band applies, but gross-based
 *     levies (US FICA) still bite on the next dollar.
 *   - Inside an offset phase-out, the withdrawal adds to the rate (AU's LITO
 *     sheds 5c per dollar from $37,500, so what the table calls a 16% band is
 *     really 21% before the levy).
 *   - Inside a levy shade-in, the levy rate is not its headline rate (AU
 *     Medicare shades in at 10c/$ between $28,011 and $35,013 — five times the
 *     2% headline).
 *
 * Each of those used to need its own hand-written hook, and each hook was a
 * chance to get it wrong. Differencing gets all three for free and cannot
 * drift from the liability it describes, because it IS that liability.
 */
const MARGINAL_STEP = 1;

/**
 * Differenced over ONE currency unit, with rounding switched off for both
 * evaluations. That last part is what makes a one-unit window viable: every
 * component of a real liability rounds to whole units, so a rounded $1 step is
 * swallowed entirely and reports 0% everywhere. A wider window papers over
 * that, but only unevenly — $100 reproduces band, offset-withdrawal and levy
 * shade-in transitions exactly, yet still misreports India, whose 4% cess sees
 * only ₹0.6 of movement per ₹100 and rounds it to nothing or to ₹1 (15.0% or
 * 16.0% against a true 15.6%). Widening the window until India resolves would
 * blur every AUD/GBP band edge by the same amount, and the width that works
 * depends on the currency's unit magnitude — a per-country constant, which is
 * exactly the hand-tuned thing this change exists to delete. Removing the
 * rounding removes the reason to widen at all.
 */
function marginalRateFor(c: IncomeTaxScheme, set: IncomeBracketSet, gross: number): number {
  const here = liabilityAt(c, set, gross, exact).totalTax;
  const next = liabilityAt(c, set, gross + MARGINAL_STEP, exact).totalTax;
  return (next - here) / MARGINAL_STEP;
}

// Australia thresholds are stable across these years; only the first taxed
// bracket steps down (legislated): 16% to FY2025-26, 15% FY2026-27, 14% FY2027-28.
const auBands = (firstRate: number): IncomeTaxBand[] => [
  { upTo: 18200, rate: 0 },
  { upTo: 45000, rate: firstRate },
  { upTo: 135000, rate: 0.3 },
  { upTo: 190000, rate: 0.37 },
  { upTo: null, rate: 0.45 },
];

// India new-regime slabs. The 56th GST Council's rate changes (Sep 2025) were
// consumption tax only; this is income tax and unaffected. Budget 2026 carried
// the new-regime schedule forward unchanged.
const inNewRegimeSlabs: IncomeTaxBand[] = [
  { upTo: 400000, rate: 0 },
  { upTo: 800000, rate: 0.05 },
  { upTo: 1200000, rate: 0.1 },
  { upTo: 1600000, rate: 0.15 },
  { upTo: 2000000, rate: 0.2 },
  { upTo: 2400000, rate: 0.25 },
  { upTo: null, rate: 0.3 },
];

// US FEDERAL brackets on TAXABLE income (after the standard deduction), SINGLE
// filer, tax year 2026 (IRS Rev. Proc. 2025-32). Married-filing-jointly thresholds
// differ. State income tax (0%–~13%) is out of scope — see the US note.
const usFederal2026: IncomeTaxBand[] = [
  { upTo: 12400, rate: 0.1 },
  { upTo: 50400, rate: 0.12 },
  { upTo: 105700, rate: 0.22 },
  { upTo: 201775, rate: 0.24 },
  { upTo: 256225, rate: 0.32 },
  { upTo: 640600, rate: 0.35 },
  { upTo: null, rate: 0.37 },
];

// UK income-tax bands on TAXABLE income (after the personal allowance). FROZEN
// from 2025-26 through 2026-27 (the threshold freeze runs to April 2031). The 45%
// boundary is £125,140. The calculator covers employment income + NI only; the
// separate dividend/savings rates are out of scope and excluded in the note.
const gbBands: IncomeTaxBand[] = [
  { upTo: 37700, rate: 0.2 },
  { upTo: 125140, rate: 0.4 },
  { upTo: null, rate: 0.45 },
];

// New Zealand brackets — unchanged since 1 April 2025 (Budget 2024 thresholds);
// no change for the year starting 1 April 2026.
const nzBands: IncomeTaxBand[] = [
  { upTo: 15600, rate: 0.105 },
  { upTo: 53500, rate: 0.175 },
  { upTo: 78100, rate: 0.3 },
  { upTo: 180000, rate: 0.33 },
  { upTo: null, rate: 0.39 },
];

// India new-regime surcharge on income tax, by taxable-income band, WITH marginal
// relief at each threshold: the rise in (tax + surcharge) crossing a threshold
// can't exceed the rise in income. New regime caps surcharge at 25%.
function inSurcharge(taxable: number, baseTax: number): number {
  const bands = [
    { over: 20000000, rate: 0.25, lower: 0.15 },
    { over: 10000000, rate: 0.15, lower: 0.1 },
    { over: 5000000, rate: 0.1, lower: 0 },
  ];
  const b = bands.find((x) => taxable > x.over);
  if (!b) return 0;
  let surcharge = baseTax * b.rate;
  // At the threshold, 87A no longer applies, so tax there is the plain slab tax;
  // its surcharge uses the next-lower band's rate.
  const taxAtThreshold = progressive(b.over, inNewRegimeSlabs);
  const surchargeAtThreshold = taxAtThreshold * b.lower;
  const cap = taxAtThreshold + surchargeAtThreshold + (taxable - b.over) - baseTax;
  if (surcharge > cap) surcharge = Math.max(0, cap);
  return surcharge;
}

/**
 * AU MEDICARE LEVY LOW-INCOME REDUCTION — Medicare Levy Act 1986 s 7,
 * "Levy in cases of small incomes".
 *
 * Below the lower threshold no levy is payable at all. Between the two it is
 * "shaded in" at 10% of the excess over the lower threshold, which by
 * construction meets the full 2% exactly at the upper threshold. Above it, the
 * ordinary 2% applies. Charging a flat 2% at every income — which this file did
 * until now, while its own note conceded the levy "may reduce for low incomes" —
 * overstates the liability of every Australian earning under $35,013.
 *
 * HOW THESE FIGURES WERE ESTABLISHED, because they are user-facing tax numbers:
 * the 10% shading mechanism is confirmed in the Act itself via
 * legislation.gov.au; the $35,013 upper threshold is confirmed from ATO
 * content. The $28,011 lower threshold sits at exactly the ratio a 2% levy
 * requires (1 - 0.02/0.10 = 0.8; 28011/35013 = 0.8000), and that model was
 * itself validated against the legislated worked example from the 1.5% era
 * (18488/21750, ratio 0.8500 = 1 - 0.015/0.10) — where the shaded amount lands
 * on the full levy to the cent. Two independent confirmations plus an exact
 * structural fit, not a lifted figure.
 *
 * KEYED BY YEAR ON PURPOSE. These thresholds are indexed annually. A year with
 * no entry here keeps the flat 2% rather than borrowing another year's
 * thresholds — inventing an indexed figure is the failure this whole effort
 * exists to remove. 2024-25 used different (lower) thresholds that are not
 * verified here, and 2027-28's are not announced yet; both therefore stay flat
 * until someone verifies and adds them.
 */
const AU_MEDICARE_LOW_INCOME: Record<string, { lower: number; upper: number }> = {
  // Carried forward per the Act until amended — the same treatment the bands get.
  '2026-27': { lower: 28011, upper: 35013 },
  '2025-26': { lower: 28011, upper: 35013 },
};

/** The Medicare levy actually payable on `taxable` for a given AU tax year. */
function auMedicareLevy(taxable: number, taxYearLabel: string, q: MoneyRounding): number {
  const full = taxable * 0.02;
  const band = AU_MEDICARE_LOW_INCOME[taxYearLabel];
  if (!band) return q.round(full);
  if (taxable <= band.lower) return 0;
  // Shade in at 10% of the excess, never exceeding the ordinary 2%. The cap
  // matters because the ATO rounds the published thresholds independently, so
  // the two lines cross a few cents before the upper threshold rather than
  // exactly on it.
  return q.round(Math.min(full, (taxable - band.lower) * 0.10));
}

export const INCOME_TAX_SCHEMES: Record<string, IncomeTaxScheme> = {
  AU: {
    code: 'AU', country: 'Australia', currency: 'AUD', locale: 'en-AU', timeZone: 'Australia/Sydney',
    sets: [
      { effectiveFrom: '2027-07-01', taxYearLabel: '2027-28', bands: auBands(0.14) },
      { effectiveFrom: '2026-07-01', taxYearLabel: '2026-27', bands: auBands(0.15) },
      { effectiveFrom: '2025-07-01', taxYearLabel: '2025-26', bands: auBands(0.16) },
      { effectiveFrom: '2024-07-01', taxYearLabel: '2024-25', bands: auBands(0.16) },
    ],
    levies: ({ taxable, taxYearLabel, q }) => {
      const levy = auMedicareLevy(taxable, taxYearLabel, q);
      // Nil below the lower threshold — emit no line rather than a $0 one, so
      // the absence of the levy is visible instead of looking like a rounding
      // artefact.
      if (levy <= 0) return [];
      const reduced = Boolean(AU_MEDICARE_LOW_INCOME[taxYearLabel]) && levy < q.round(taxable * 0.02);
      return [{ name: reduced ? 'Medicare levy (reduced, low income)' : 'Medicare levy (2%)', amount: levy }];
    },
    offsets: ({ taxable, q }) => {
      // LITO (ATO schedule): $700 up to $37,500; less 5c per $1 to $45,000
      // (→ $325); less 1.5c per $1 to $66,667 (→ $0).
      let lito = 0;
      if (taxable <= 37500) lito = 700;
      else if (taxable <= 45000) lito = q.round(700 - (taxable - 37500) * 0.05);
      else if (taxable <= 66667) lito = q.round(325 - (taxable - 45000) * 0.015);
      lito = Math.max(0, lito);
      return lito > 0 ? [{ name: 'Low Income Tax Offset', amount: lito }] : [];
    },
    note: 'Includes the Medicare levy low-income reduction (nil to $28,011, shaded in at 10% of the excess to $35,013). Excludes HECS/HELP, the Medicare levy surcharge, the seniors and pensioners thresholds, family thresholds and other offsets.',
    source: 'https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents',
    authorityName: 'Australian Taxation Office (ATO)',
    citationDate: '2026-08-20',
    verified: true,
  },
  NZ: {
    code: 'NZ', country: 'New Zealand', currency: 'NZD', locale: 'en-NZ', timeZone: 'Pacific/Auckland',
    // NZ tax year runs 1 April – 31 March; brackets frozen across both years.
    sets: [
      { effectiveFrom: '2026-04-01', taxYearLabel: '2026-27', bands: nzBands },
      { effectiveFrom: '2025-04-01', taxYearLabel: '2025-26', bands: nzBands },
    ],
    levies: () => [],
    offsets: () => [],
    note: 'Income tax only — the separate ACC earners’ levy is not included.',
    source: 'https://www.ird.govt.nz/income-tax/income-tax-for-individuals/tax-codes-and-tax-rates-for-individuals',
    authorityName: 'Inland Revenue (IRD)',
    citationDate: '2026-08-20',
    verified: true,
  },
  GB: {
    code: 'GB', country: 'United Kingdom', currency: 'GBP', locale: 'en-GB', timeZone: 'Europe/London',
    // UK tax year runs 6 April – 5 April; income tax + NI frozen across both years.
    sets: [
      { effectiveFrom: '2026-04-06', taxYearLabel: '2026-27', bands: gbBands },
      { effectiveFrom: '2025-04-06', taxYearLabel: '2025-26', bands: gbBands },
    ],
    deduction: ({ gross, q }) => {
      // Personal allowance £12,570, tapered £1 for every £2 of income over
      // £100,000 (fully gone at £125,140).
      const taper = Math.max(0, q.floor((gross - 100000) / 2));
      return Math.max(0, 12570 - taper);
    },
    levies: ({ gross, q }) => {
      // Employee Class 1 National Insurance: 8% between the £12,570 primary
      // threshold and the £50,270 upper earnings limit, 2% above (on gross).
      const ni = Math.max(0, Math.min(gross, 50270) - 12570) * 0.08 + Math.max(0, gross - 50270) * 0.02;
      return ni > 0 ? [{ name: 'National Insurance', amount: q.round(ni) }] : [];
    },
    offsets: () => [],
    note: 'England, Wales & Northern Ireland rates — Scotland sets its own bands. Personal allowance tapers above £100,000. Excludes student-loan repayments and the separate dividend/savings rates.',
    region: 'England, Wales & Northern Ireland',
    source: 'https://www.gov.uk/income-tax-rates',
    authorityName: 'HM Revenue & Customs (HMRC)',
    citationDate: '2026-08-20',
    verified: true,
  },
  IN: {
    code: 'IN', country: 'India', currency: 'INR', locale: 'en-IN', timeZone: 'Asia/Kolkata',
    // FY runs 1 April – 31 March (labelled with its assessment year). Budget 2026
    // carried the new-regime schedule forward unchanged, so both years are frozen.
    sets: [
      { effectiveFrom: '2026-04-01', taxYearLabel: '2026-27 (AY 2027-28)', bands: inNewRegimeSlabs },
      { effectiveFrom: '2025-04-01', taxYearLabel: '2025-26 (AY 2026-27)', bands: inNewRegimeSlabs },
    ],
    // Standard deduction for salaried individuals / pensioners (new regime).
    deduction: () => 75000,
    // 4% Health & Education cess rides on top of the slab rate. (In the narrow
    // ₹12L–~₹12.77L 87A marginal-relief band the effective rate is ~100% as the
    // rebate withdraws; that edge isn't reflected in this headline figure.)
    offsets: ({ taxable, incomeTax, q }) => {
      // Section 87A rebate (new regime): up to ₹60,000, making taxable income up
      // to ₹12L effectively tax-free. Marginal relief just above ₹12L caps the
      // INCOME TAX (pre-cess) to the income earned over ₹12L; the 4% cess then
      // applies on top — the standard treatment (₹12.10L taxable → ₹10,000 tax +
      // ₹400 cess = ₹10,400). Cess is a separate Finance-Act levy on the tax, not
      // part of the relief, so it is deliberately NOT folded into this cap.
      let rebate = 0;
      if (taxable <= 1200000) rebate = Math.min(incomeTax, 60000);
      else rebate = Math.max(0, incomeTax - (taxable - 1200000));
      return rebate > 0 ? [{ name: 'Section 87A rebate', amount: q.round(rebate) }] : [];
    },
    levies: ({ taxable, baseTax, q }) => {
      const surcharge = q.round(inSurcharge(taxable, baseTax));
      const cess = q.round((baseTax + surcharge) * 0.04);
      const items: IncomeLineItem[] = [];
      if (surcharge > 0) items.push({ name: 'Surcharge', amount: surcharge });
      if (cess > 0) items.push({ name: 'Health & Education cess (4%)', amount: cess });
      return items;
    },
    note: 'New tax regime (the default), salaried — includes the ₹75,000 standard deduction, the Section 87A rebate (taxable income up to ₹12L is effectively tax-free) and 4% Health & Education cess. Excludes the old regime, capital-gains special rates and Chapter VI-A deductions.',
    source: 'https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable-1',
    authorityName: 'Income Tax Department, India',
    citationDate: '2026-08-20',
    verified: true,
  },
  US: {
    code: 'US', country: 'United States', currency: 'USD', locale: 'en-US', timeZone: 'America/New_York',
    // US tax year = calendar year. FEDERAL brackets only, single filer.
    sets: [
      { effectiveFrom: '2026-01-01', taxYearLabel: '2026', bands: usFederal2026 },
    ],
    // Standard deduction, single filer (2026). MFJ is $32,200 (not modelled).
    deduction: () => 16100,
    levies: ({ gross, q }) => {
      // Employee FICA: Social Security 6.2% to the $184,500 wage base; Medicare
      // 1.45% on all wages + 0.9% additional Medicare above $200,000 (single).
      const socialSecurity = q.round(Math.min(gross, 184500) * 0.062);
      const medicare = q.round(gross * 0.0145) + q.round(Math.max(0, gross - 200000) * 0.009);
      const items: IncomeLineItem[] = [];
      if (socialSecurity > 0) items.push({ name: 'Social Security (6.2%)', amount: socialSecurity });
      if (medicare > 0) items.push({ name: 'Medicare (1.45%)', amount: medicare });
      return items;
    },
    offsets: () => [],
    note: 'FEDERAL income tax + FICA (Social Security & Medicare), single filer, 2026, taking the standard deduction. EXCLUDES state and local income tax — nil in Texas, Florida, Washington and others, up to ~13% in California — and assumes no other deductions or credits. Married-filing-jointly brackets and deduction differ.',
    region: 'Federal only — excludes state tax',
    source: 'https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill',
    authorityName: 'Internal Revenue Service (IRS)',
    citationDate: '2026-08-20',
    verified: true,
  },
};

// Frozen at module load. This record is re-exported from src/index.ts, so a
// consumer of the published package could otherwise reassign a country's rate
// or hook and corrupt every later calculation in the same process — including
// the drift and parity guards, which would then be comparing against mutated
// data and cheerfully agreeing. Object.freeze is shallow, so the schemes and
// their band arrays are frozen individually.
for (const scheme of Object.values(INCOME_TAX_SCHEMES)) {
  for (const set of scheme.sets) {
    set.bands.forEach(Object.freeze);
    Object.freeze(set.bands);
    Object.freeze(set);
  }
  Object.freeze(scheme.sets);
  Object.freeze(scheme);
}
Object.freeze(INCOME_TAX_SCHEMES);

/** Country codes with an income-tax schedule defined here. */
export function listIncomeTaxCountries(): string[] {
  return Object.keys(INCOME_TAX_SCHEMES);
}

/** Resolve a scheme by ISO code or compound key ('AU' / 'AU-IT'), or null. */
export function getIncomeTaxScheme(countryCode?: string | null): IncomeTaxScheme | null {
  if (!countryCode) return null;
  const base = countryCode.toUpperCase().split('-')[0]!;
  return INCOME_TAX_SCHEMES[base] ?? null;
}

/**
 * Today's date in a given IANA zone, as YYYY-MM-DD — so a financial year rolls
 * at LOCAL midnight (e.g. 1 July AEST), not UTC. EXPORTED so callers needing
 * the same clock (a student-loan or superannuation schedule, say) stay in sync
 * with the bracket-set resolver rather than reimplementing this.
 */
export function localToday(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Delegates to the shared resolveEffectiveDated() (see effectiveDating.ts) —
 * NOT a fourth hand-rolled copy of the same date-window logic that
 * companyTax.ts/studentLoan.ts/superannuation.ts already share.
 *
 * The one adaptation this needs: resolveEffectiveDated's default `asOf` is a
 * plain `new Date()`, compared against `effectiveFrom` in UTC — which is
 * exactly the bug this resolver was originally written to avoid. AEST is
 * UTC+10, so a naive UTC comparison rolls the Australian financial year ten
 * hours late. Passing `asOf` as `localToday(timeZone)` re-expressed at UTC
 * midnight sidesteps that: both operands become "YYYY-MM-DD at 00:00Z", so the
 * comparison is exactly equivalent to lexical date-string comparison in the
 * scheme's own local calendar — while still sharing the one resolver.
 */
function resolveIncomeSet(scheme: IncomeTaxScheme, taxYear?: string): IncomeBracketSet | undefined {
  const asOf = new Date(`${localToday(scheme.timeZone)}T00:00:00Z`);
  return resolveEffectiveDated(scheme.sets, { taxYear, asOf }, (s) => s.taxYearLabel);
}

/** Selectable tax years for a country (newest-first), with the current one flagged. */
export function getIncomeTaxYears(countryCode: string): IncomeTaxYearOption[] {
  const scheme = getIncomeTaxScheme(countryCode);
  if (!scheme) return [];
  const current = resolveIncomeSet(scheme)?.taxYearLabel;
  return scheme.sets.map((s) => ({
    value: s.taxYearLabel, label: s.taxYearLabel, effectiveFrom: s.effectiveFrom,
    isCurrent: s.taxYearLabel === current,
  }));
}

/**
 * Compute income tax + take-home for a country.
 * Returns `null` when the country has no scheme here, or when an explicit
 * `taxYear` was given but that year is not defined (fails loudly rather than
 * silently substituting the current year's figures).
 */
export function calcIncomeTax(countryCode: string, gross: number, taxYear?: string): IncomeTaxResult | null {
  const c = getIncomeTaxScheme(countryCode);
  if (!c) return null;
  const set = resolveIncomeSet(c, taxYear);
  if (!set) return null;
  const { taxable, incomeTax, offsets, levies, totalTax } = liabilityAt(c, set, gross);
  const g = grossOf(gross);

  return {
    code: c.code, country: c.country, currency: c.currency, locale: c.locale,
    taxYear: set.taxYearLabel,
    gross: g, taxable, incomeTax, levies, offsets, totalTax, takeHome: g - totalTax,
    marginalRate: g > 0 ? marginalRateFor(c, set, g) : 0,
    averageRate: g > 0 ? totalTax / g : 0,
  };
}

export function getIncomeTaxBands(countryCode: string, taxYear?: string): IncomeTaxBand[] {
  const c = getIncomeTaxScheme(countryCode);
  if (!c) return [];
  // A COPY, not the live array. nzBands and gbBands are module-level constants
  // shared by two sets each, so a consumer of the published package sorting or
  // pushing into what it got back would corrupt every later calculation in the
  // same process.
  return (resolveIncomeSet(c, taxYear)?.bands ?? []).map((b) => ({ ...b }));
}
