/**
 * Capital gains — the rules per country, a resolver, and an estimator.
 * @ai2/tax-plugins — embracingearth.space
 *
 * WHY THIS EXISTS. The website's CGT calculator and the Tax MCP Worker's
 * `cgt_estimate` each carried their own Australia-only arithmetic, and nothing
 * answered "how are capital gains taxed in country X" at all. This module is the
 * one answer: effective-dated rule sets for 71 countries, each with its official
 * sources, citation date and verified flag, and an estimator that computes a
 * figure only where the rule is simple, verified and fully encoded.
 *
 * ONE COPY OF EACH FIGURE. Three countries already had CGT figures in the engine
 * and are DERIVED here, never re-typed:
 *  - AU: the 50% discount from AU_HOME_SPACE_FIGURES, its end date and
 *    provenance from the AU-IT plugin (AU_CGT_INDEXATION_FROM, AU_CGT_PROVENANCE);
 *    the gain is taxed through the AU income-tax scheme.
 *  - GB: the 18% / 24% rates and the annual exempt amount from the GB CGT rows
 *    in decisions/homeRuleRates (the ones Rate Watch already watches); the basic
 *    rate band from the GB income-tax scheme.
 *  - FI: FI_CAPITAL_INCOME_YEARS, computed by finnishCapitalGainTax.
 * Every other country comes from ./capitalGains.data (the researched sets).
 *
 * THE ESTIMATOR NEVER PRESENTS UNVERIFIED DATA AS FACT. It returns a number
 * (`status: 'computed'`) only when the asset rule in force is `verified`, has no
 * `notComputed` reason, and every figure it needs is encoded — for a rule taxed
 * at the marginal income rate, that means the income-tax engine covers the
 * country and the year. Otherwise it returns the rule in words, the sources and
 * the reason (`status: 'rule-only'`), so a consumer can say "confirm with the
 * authority" instead of quoting a figure. A country added to the income-tax
 * engine later is picked up automatically for its income-inclusion rules.
 *
 * SCOPE: a resident individual selling (a) listed shares or (b) investment
 * property, as general information. Not a filing figure, not tax advice. Each
 * figure lists what it assumed beside it (`assumptions`).
 */
import { CAPITAL_GAINS_RESEARCHED, CGT_NOT_RESEARCHED } from './capitalGains.data';
import { COUNTRY_CURRENCY_MAP } from './currencies';
import { calcIncomeTax, getIncomeTaxBands, getIncomeTaxScheme, type IncomeTaxResult } from './incomeTax';
import { FI_CAPITAL_INCOME_YEARS, finnishCapitalGainTax, type FinnishCapitalIncomeYear } from './finland';
import { toYmd } from './rateLedger';
import { addOneYear } from './effectiveDating';
import { AU_CGT_AUTHORITY_URLS, AU_CGT_INDEXATION_FROM, AU_CGT_PROVENANCE } from '../countries/australiaIncomeTax';
import { AU_HOME_SPACE_FIGURES } from '../decisions/homeSpaceRates';
import {
  GB_CGT_ANNUAL_EXEMPT_ROWS,
  GB_CGT_BASIC_RATE_ROWS,
  GB_CGT_HIGHER_RATE_ROWS,
  HOME_RATE_URLS,
  HOME_RULES_READ_ON,
  type HomeRateRow,
} from '../decisions/homeRuleRates';
import { addDays, addMonths, parseYmd } from '../decisions/dates';

export { CGT_NOT_RESEARCHED };

// ─── Types ───────────────────────────────────────────────────────────────────

/** How gains are taxed, as the research classed it. `mixed`: shares and property differ in kind. */
export type CgtRegime = 'separate-rate' | 'taxed-as-income' | 'exempt' | 'mixed';
export type CgtAssetClass = 'shares' | 'property';

export interface CgtSource {
  authority: string;
  url: string;
  /** YYYY-MM-DD the page was read. */
  citationDate: string;
  /** TRUE only when the page is an official one (authority, ministry, gazette, legislation database) and states what `note` says. */
  verified: boolean;
  /** What the page actually confirms. */
  note: string;
}

export interface CgtBand {
  upTo: number | null;
  rate: number;
}

/**
 * The machine-readable rule. Amounts are in the country's currency.
 *  - exempt: no tax.
 *  - flat: `rate` on the gain (times `inclusion` where only part is taxed).
 *  - bands: progressive `bands` over `base`: the gain alone; the year's income in the
 *    same schedule (`categoryIncome`: capital income, savings base, share income),
 *    stacked on `otherCategoryIncome`; or taxable income (`taxableIncome`: the
 *    gain on top of the taxable part of `otherIncome`, from the income-tax engine).
 *  - income: `inclusion` of the gain is added to ordinary income and taxed at the
 *    marginal rate, through the income-tax engine.
 *  - proceeds: `rate` on the sale price, whatever the gain (a final tax on value).
 *  - calculator: a dedicated calculator in the engine (FI: finnishCapitalGainTax).
 *  - summary: no machine-readable rule; the words only.
 */
export type CgtTreatment =
  | { kind: 'exempt' }
  | { kind: 'flat'; rate: number; inclusion?: number }
  | { kind: 'bands'; bands: CgtBand[]; base: 'gain' | 'categoryIncome' | 'taxableIncome' }
  | { kind: 'income'; inclusion: number }
  | { kind: 'proceeds'; rate: number }
  | { kind: 'calculator'; calculator: 'FI' }
  | { kind: 'summary' };

export interface CgtHoldingStep {
  /** Held MORE than `from` units (see CgtHolding.unit) — step 0 starts at 0. */
  from: number;
  treatment: CgtTreatment;
  label: string;
}

/**
 * A treatment that changes with how long the asset was held. Steps run ascending
 * from 0; the last step reached applies. Units:
 *  - months / days: reached when the disposal is AFTER the `from` anniversary
 *    (the day of acquisition and the day of disposal both excluded — the ATO's
 *    12-month test, and the IRS "more than one year"). On the anniversary itself
 *    the earlier step still applies.
 *  - calendarYears: reached when (year of disposal − year of acquisition) ≥ `from`.
 *  - yearsAt1January: reached when the asset was held more than `from` years on
 *    1 January of the year of disposal (Japan's land rule).
 */
export interface CgtHolding {
  unit: 'months' | 'days' | 'calendarYears' | 'yearsAt1January';
  steps: CgtHoldingStep[];
}

/** An allowance subtracted from the gain: the greater of `amount` and `fractionOfGain` of it. */
export interface CgtExemption {
  amount?: number;
  fractionOfGain?: number;
  per: 'year' | 'disposal';
  note: string;
}

/** A cliff: at or below it, no tax at all; above it, the whole gain is taxed. */
export interface CgtThreshold {
  gainBelow?: number;
  gainAtMost?: number;
  proceedsAtMost?: number;
  per: 'year' | 'month' | 'disposal';
  note: string;
}

export interface CgtAssetRule {
  /** The rate or rule, in words. */
  rule: string;
  holdingPeriod: string;
  annualExemption?: string;
  /** Property only: the main-residence (home) exemption. */
  mainResidence?: string;
  notes: string;
  /** The headline rule was confirmed on an official page. */
  verified: boolean;
  treatment: CgtTreatment;
  holding?: CgtHolding;
  exemption?: CgtExemption;
  threshold?: CgtThreshold;
  /** The treatment applies to assets acquired on or after this day; earlier ones follow a rule given only in words. */
  appliesToAcquisitionsFrom?: string;
  /** Why the estimator gives the rule and no number, although the rule may be verified. */
  notComputed?: string;
  /** What any figure computed from this rule assumes. */
  assumptions?: string[];
}

export interface CgtRuleSet {
  /** YYYY-MM-DD the set takes effect (inclusive). It runs until the next set starts. */
  effectiveFrom: string;
  /** FALSE when the research did not record the rule's start; `effectiveFrom` is then its citation date. */
  startRecorded: boolean;
  startNote?: string;
  /** For a yearly schedule, the tax year the set is for. */
  taxYearLabel?: string;
  regime: CgtRegime;
  inflationIndexation: string;
  shares: CgtAssetRule;
  property: CgtAssetRule;
  sources: CgtSource[];
  /** The newest citation date among the set's figures; null when no figure was read for it (a year not yet published). */
  citationDate: string | null;
  /** Both asset rules are verified. */
  verified: boolean;
  verificationNote?: string;
  /** What the research could not confirm. */
  uncertainties: string[];
}

export interface CgtCountry {
  code: string;
  country: string;
  /**
   * TRUE when a set holds figures for one tax year only (thresholds indexed every
   * year: US, DK; FI's yearly capital-income figures). Such a set stops counting
   * as verified once its year has ended with no successor.
   */
  annual?: boolean;
  /** IANA time zone the tax year turns over in, where a Date is read as a local day. */
  timeZone?: string;
  /** Newest first. */
  sets: CgtRuleSet[];
}

// ─── Derived countries: AU, GB, FI ───────────────────────────────────────────

const AU_DISCOUNT = AU_HOME_SPACE_FIGURES.cgtDiscount.value;
const AU_MINIMUM_TAX = AU_HOME_SPACE_FIGURES.minimumTaxRate.value;
const pc = (n: number) => `${+(n * 100).toFixed(3)}%`;

function auCountry(): CgtCountry {
  const p = AU_CGT_PROVENANCE;
  const sources: CgtSource[] = [
    { authority: 'Australian Taxation Office', url: AU_CGT_AUTHORITY_URLS.cgtDiscount, citationDate: p.citationDate, verified: p.verified, note: `The ${pc(AU_DISCOUNT)} discount for an Australian resident who owned the asset at least 12 months.` },
    { authority: 'Australian Taxation Office', url: AU_CGT_AUTHORITY_URLS.taxReform2027, citationDate: p.citationDate, verified: p.verified, note: 'The 2027 CGT changes are law and apply from 1 July 2027.' },
    { authority: 'Federal Register of Legislation', url: AU_CGT_AUTHORITY_URLS.taxReformAct, citationDate: p.citationDate, verified: p.verified, note: 'Treasury Laws Amendment (Tax Reform No. 1) Act 2026 (No. 49): indexation (s 110-36(1A)) and the 30% minimum tax (Division 119) for CGT events from 1 July 2027.' },
    {
      authority: 'Australian Taxation Office',
      url: 'https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/property-and-capital-gains-tax/your-main-residence-home/eligibility-for-main-residence-exemption',
      citationDate: '2026-10-06',
      verified: true,
      note: 'Main residence exempt for an Australian resident where the dwelling was the home for the whole ownership period and was not used to produce income.',
    },
  ];
  const mainResidence =
    'Exempt for an Australian resident where the dwelling was the home of the owner (and partner or dependants) for the whole ownership period, ' +
    'was not used to produce income, and the land is up to 2 hectares; partial exemption otherwise; the 6-year rule can keep a former home exempt while it is rented.';
  const discountSteps: CgtHolding = {
    unit: 'months',
    steps: [
      { from: 0, treatment: { kind: 'income', inclusion: 1 }, label: 'Held 12 months or less: the whole gain is taxed as income' },
      { from: 12, treatment: { kind: 'income', inclusion: 1 - AU_DISCOUNT }, label: `Held at least 12 months: the ${pc(AU_DISCOUNT)} CGT discount applies` },
    ],
  };
  const current = (asset: CgtAssetClass): CgtAssetRule => ({
    rule: `The net capital gain is added to assessable income and taxed at the marginal income tax rates, after a ${pc(AU_DISCOUNT)} discount where the asset was held at least 12 months.`,
    holdingPeriod: 'At least 12 months, not counting the day of acquisition or of the CGT event, for the discount (resident individuals).',
    annualExemption: 'None.',
    ...(asset === 'property' ? { mainResidence } : {}),
    notes: `For CGT events from ${AU_CGT_INDEXATION_FROM} the discount is replaced by cost-base indexation and a ${pc(AU_MINIMUM_TAX)} minimum tax (Treasury Laws Amendment (Tax Reform No. 1) Act 2026); see the next set.`,
    verified: p.verified,
    treatment: discountSteps.steps[0]!.treatment,
    holding: discountSteps,
    assumptions: ['An Australian resident individual; capital losses are applied before the discount.', 'The income-tax figure includes the Medicare levy and offsets, as the AU income-tax scheme does.'],
  });
  const reform = (asset: CgtAssetClass): CgtAssetRule => ({
    rule:
      `For CGT events from ${AU_CGT_INDEXATION_FROM} the ${pc(AU_DISCOUNT)} discount generally applies only to the gain to 30 June 2027. For the gain after it, the cost base may be indexed for inflation ` +
      `(an Australian resident who held the asset at least 12 months), and a ${pc(AU_MINIMUM_TAX)} minimum tax may apply (Division 119). A qualifying new residential dwelling or affordable housing keeps a discount of at least 50%.`,
    holdingPeriod: 'At least 12 months for indexation (s 114-10(1)).',
    annualExemption: 'None.',
    ...(asset === 'property' ? { mainResidence: `${mainResidence} The exemption is kept from 1 July 2027.` } : {}),
    notes: 'Assets held on 30 June 2027 are taken to be sold at market value and reacquired on 1 July 2027 (s 112-155); the gain to then is deferred and keeps the discount.',
    verified: p.verified,
    treatment: { kind: 'summary' },
    notComputed: 'Indexation needs CPI figures from the September 2027 quarter, not yet published, and the minimum tax and the 30 June 2027 valuation are not modelled; only the rule is given.',
  });
  return {
    code: 'AU',
    country: 'Australia',
    timeZone: 'Australia/Sydney',
    sets: [
      {
        effectiveFrom: AU_CGT_INDEXATION_FROM,
        startRecorded: true,
        startNote: 'Treasury Laws Amendment (Tax Reform No. 1) Act 2026, assented 26 June 2026: CGT events from 1 July 2027.',
        regime: 'taxed-as-income',
        inflationIndexation: 'yes (cost base indexed for the period from 1 July 2027)',
        shares: reform('shares'),
        property: reform('property'),
        sources,
        citationDate: p.citationDate,
        verified: p.verified,
        uncertainties: ['The Minister\'s apportioning method (s 112-185) is not yet made; the CPI for quarters from September 2027 is not yet known.'],
      },
      {
        effectiveFrom: '1999-09-21',
        startRecorded: true,
        startNote: 'The CGT discount applies to CGT events after 11.45 am on 21 September 1999.',
        regime: 'taxed-as-income',
        inflationIndexation: 'partial (assets acquired before 21 September 1999 may use indexation frozen at 30 September 1999 instead of the discount)',
        shares: current('shares'),
        property: current('property'),
        sources,
        citationDate: p.citationDate,
        verified: p.verified,
        uncertainties: [],
      },
    ],
  };
}

/** The row in force on `ymd`, newest-first by derivation, never by trust. */
function rowAt(rows: readonly HomeRateRow[], ymd: string): HomeRateRow | undefined {
  return [...rows].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)).find((r) => r.effectiveFrom <= ymd);
}
const usable = (r: HomeRateRow | undefined): r is HomeRateRow & { value: number; readOn: string } => Boolean(r?.verified && r.value !== null && r.readOn);

function gbCountry(): CgtCountry {
  // The GB rows hold the figures; a set starts wherever one of them changes. The
  // 1900 floors only say "not recorded before", so sets start at the first real row.
  const series = [GB_CGT_BASIC_RATE_ROWS, GB_CGT_HIGHER_RATE_ROWS, GB_CGT_ANNUAL_EXEMPT_ROWS];
  const starts = [...new Set(series.flat().filter((r) => r.effectiveFrom >= '2000-01-01').map((r) => r.effectiveFrom))].sort().reverse();
  const brb = (getIncomeTaxBands('GB')[0]?.upTo ?? null) as number | null;
  const residence =
    'Private Residence Relief: no CGT on your home if it is your only home, you lived in it as your main home for all the time you owned it, ' +
    'and the grounds are under 5,000 square metres; partial relief otherwise. Married couples and civil partners have one main home at a time.';
  const extraSources: CgtSource[] = [
    { authority: 'GOV.UK (HMRC)', url: 'https://www.gov.uk/tax-sell-home', citationDate: '2026-10-06', verified: true, note: 'Private Residence Relief conditions: one home, main home for all of ownership, grounds under 5,000 sq m.' },
    { authority: 'GOV.UK (HMRC)', url: 'https://www.gov.uk/tax-sell-shares', citationDate: '2026-10-06', verified: true, note: 'No CGT on shares in an ISA or PEP, or on UK government gilts.' },
  ];
  return {
    code: 'GB',
    country: 'United Kingdom',
    timeZone: 'Europe/London',
    sets: starts.map((day) => {
      const [basic, higher, aea] = series.map((rows) => rowAt(rows, day));
      const ok = usable(basic) && usable(higher) && usable(aea) && brb !== null;
      const readOn = [basic, higher, aea].map((r) => r?.readOn).filter((d): d is string => Boolean(d)).sort();
      const sources: CgtSource[] = [
        {
          authority: 'GOV.UK (HMRC)',
          url: HOME_RATE_URLS.gbCgtRates,
          citationDate: readOn[0] ?? HOME_RULES_READ_ON,
          verified: ok,
          note: ok ? `${basic!.note} ${higher!.note} ${aea!.note}` : [basic, higher, aea].map((r) => r?.note).filter(Boolean).join(' '),
        },
        ...extraSources,
      ];
      const asset = (kind: CgtAssetClass): CgtAssetRule => ({
        rule: ok
          ? `${basic!.value}% on gains within the unused basic rate band (taxable income plus gains up to £${brb!.toLocaleString('en-GB')}), ${higher!.value}% above it.`
          : 'The rates for this tax year are not recorded in the engine\'s GB CGT rows.',
        holdingPeriod: 'None (no short- or long-term distinction).',
        annualExemption: ok ? `£${aea!.value.toLocaleString('en-GB')} annual exempt amount for individuals.` : 'Not recorded for this tax year.',
        ...(kind === 'property' ? { mainResidence: residence } : {}),
        notes: kind === 'shares' ? 'Shares held in an ISA or PEP, and gilts, are exempt.' : 'Gains on UK residential property must be reported and paid within 60 days of completion.',
        verified: ok,
        treatment: ok
          ? { kind: 'bands', base: 'taxableIncome', bands: [{ upTo: brb!, rate: basic!.value / 100 }, { upTo: null, rate: higher!.value / 100 }] }
          : { kind: 'summary' },
        ...(ok ? { exemption: { amount: aea!.value, per: 'year' as const, note: `£${aea!.value.toLocaleString('en-GB')} annual exempt amount.` } } : {}),
        assumptions: ['England, Wales and Northern Ireland income-tax bands; the annual exempt amount is otherwise unused; losses are this year\'s.'],
      });
      return {
        effectiveFrom: day,
        startRecorded: true,
        startNote: 'Derived from the GB CGT rows in decisions/homeRuleRates: a set starts wherever a rate or the annual exempt amount changes there.',
        regime: 'separate-rate',
        inflationIndexation: 'no',
        shares: asset('shares'),
        property: asset('property'),
        sources,
        citationDate: ok ? readOn[readOn.length - 1]! : null,
        verified: ok,
        ...(ok ? {} : { verificationNote: 'No verified rate or annual exempt amount is recorded for this tax year.' }),
        uncertainties: [],
      } satisfies CgtRuleSet;
    }),
  };
}

function fiSet(y: FinnishCapitalIncomeYear): CgtRuleSet {
  const sources: CgtSource[] = y.sources.map((s) => ({
    authority: s.instrument,
    url: s.url,
    citationDate: y.citationDate,
    verified: y.verified,
    note: s.what,
  }));
  const asset = (kind: CgtAssetClass): CgtAssetRule => ({
    rule: `Capital income: ${pc(y.rate)} on total capital income up to ${y.threshold.toLocaleString('fi-FI')} €, ${pc(y.higherRate)} above.`,
    holdingPeriod: `No rate difference by holding period. A deemed acquisition cost of ${pc(y.deemedCost.rate)} of the sale price (${pc(y.deemedCost.longRate)} if held ${y.deemedCost.longYears} years or more) may be used instead of the actual cost.`,
    annualExemption: `Gains are tax-free when the year's total sale prices are ${y.smallDisposalsThreshold.toLocaleString('fi-FI')} € or less.`,
    ...(kind === 'property'
      ? { mainResidence: 'Exempt if the seller owned the home for at least 2 years and the seller or family lived in it permanently and continuously for at least 2 years during ownership.' }
      : {}),
    notes: `Losses offset capital gains, then other capital income, and carry forward ${y.lossCarryForwardYears} years.`,
    verified: y.verified,
    treatment: { kind: 'calculator', calculator: 'FI' },
    assumptions: ['finnishCapitalGainTax: the more favourable of actual and deemed cost; otherCategoryIncome is the year\'s other capital income.'],
  });
  return {
    effectiveFrom: y.effectiveFrom,
    startRecorded: true,
    taxYearLabel: y.taxYear,
    regime: 'separate-rate',
    inflationIndexation: 'no (the deemed acquisition cost is the substitute)',
    shares: asset('shares'),
    property: asset('property'),
    sources,
    citationDate: y.citationDate,
    verified: y.verified,
    uncertainties: [],
  };
}

function fiCountry(): CgtCountry {
  const sets = [...FI_CAPITAL_INCOME_YEARS].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)).map(fiSet);
  return { code: 'FI', country: 'Finland', annual: true, timeZone: 'Europe/Helsinki', sets };
}

// ─── The registry ────────────────────────────────────────────────────────────

/**
 * Freeze the whole object graph, not just the top level: the resolver and the
 * estimator hand out live sets, sources and uncertainties, and a consumer
 * mutating one would change every later estimate, coverage() and Rate Watch
 * result in the same process.
 */
function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}

/** Every country with capital-gains rules, by ISO code. */
export const CAPITAL_GAINS_RULES: Readonly<Record<string, CgtCountry>> = deepFreeze(
  Object.fromEntries(
    [...Object.values(CAPITAL_GAINS_RESEARCHED), auCountry(), gbCountry(), fiCountry()]
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((c) => [c.code, c]),
  ),
);

/** Codes with capital-gains rules, sorted. */
export function listCapitalGainsCountries(): string[] {
  return Object.keys(CAPITAL_GAINS_RULES).sort();
}

export function getCapitalGainsCountry(code?: string | null): CgtCountry | null {
  return code ? CAPITAL_GAINS_RULES[code.toUpperCase()] ?? null : null;
}

/** The calendar day `asOf` falls on, in `timeZone` when given (a day string is already a day). */
export function cgtDay(asOf: string | Date | undefined, timeZone?: string): string {
  if (typeof asOf === 'string') {
    // Reject a malformed day: rule sets are picked by string comparison.
    const day = asOf.slice(0, 10);
    parseYmd(day, 'asOf');
    return day;
  }
  const at = asOf ?? new Date();
  if (!timeZone) return toYmd(at);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export interface ResolvedCgtRules {
  code: string;
  country: string;
  /** The day the rules were resolved for. */
  day: string;
  set: CgtRuleSet;
  /** For a yearly country: the set's year covers `day`. Always true otherwise. */
  yearCovered: boolean;
  /** `set.verified` and `yearCovered`. */
  verified: boolean;
  /** The set's first verified source, else its first source. */
  source: CgtSource | null;
}

/** The first verified https source of a set, else its first source. */
export function primaryCgtSource(set: CgtRuleSet): CgtSource | null {
  return set.sources.find((s) => s.verified && s.url.startsWith('https://')) ?? set.sources[0] ?? null;
}

/**
 * The rules in force for `country` on `asOf` (a 'YYYY-MM-DD' day, or a Date read in
 * the country's own time zone where it has one; default today). Null when the
 * country is not covered or no set has started by then — never the oldest set as
 * a fallback, because that would answer for a date it does not cover.
 */
export function resolveCapitalGainsRules(country: string, asOf?: string | Date): ResolvedCgtRules | null {
  const c = getCapitalGainsCountry(country);
  if (!c) return null;
  const day = cgtDay(asOf, c.timeZone);
  const set = [...c.sets].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)).find((s) => s.effectiveFrom <= day);
  if (!set) return null;
  const yearCovered = !c.annual || day < addOneYear(set.effectiveFrom);
  return { code: c.code, country: c.country, day, set, yearCovered, verified: set.verified && yearCovered, source: primaryCgtSource(set) };
}

// ─── The estimator ───────────────────────────────────────────────────────────

export interface CapitalGainsInput {
  /** ISO 3166-1 alpha-2. */
  country: string;
  asset: CgtAssetClass;
  /** Sale price, in the country's currency. */
  proceeds: number;
  /** What the asset cost, including eligible acquisition and sale costs. */
  costBase: number;
  /** Capital losses to set against this gain (applied before any discount or allowance). */
  capitalLosses?: number;
  /** YYYY-MM-DD. Needed where the rate depends on how long the asset was held (or pass `holdingMonths`). */
  acquiredOn?: string;
  /** YYYY-MM-DD; default today. Picks the rule set and the income-tax year. */
  disposedOn?: string;
  /** Whole months held, when the dates are not known. A step on its boundary month is taken as reached. */
  holdingMonths?: number;
  /** Other taxable income this year (gross, as the income-tax engine takes it): where the gain is taxed at the marginal rate or stacked on income. */
  otherIncome?: number;
  /** Other income this year in the gain's own schedule (capital income, savings base, share income). Default 0. */
  otherCategoryIncome?: number;
}

export type CapitalGainsStatus = 'computed' | 'rule-only' | 'needs-input' | 'not-covered';

export interface CapitalGainsRuleText {
  rule: string;
  holdingPeriod: string;
  annualExemption?: string;
  mainResidence?: string;
  notes: string;
}

export interface CapitalGainsEstimate {
  /** computed: `tax` is a figure from verified data. rule-only: the rule in words, no figure (see `reason`). needs-input: an input is missing (see `reason`). not-covered: no rules for the country or date. */
  status: CapitalGainsStatus;
  country: string;
  countryName: string | null;
  asset: CgtAssetClass;
  disposedOn: string;
  currency: string | null;
  regime: CgtRegime | null;
  /** The rule this answer rests on is verified on an official page. A figure is only ever given when TRUE. */
  verified: boolean;
  /** The tax caused by this disposal; null unless `status` is 'computed'. */
  tax: number | null;
  /** Proceeds minus cost, floored at 0. */
  gain: number;
  /** Cost minus proceeds, floored at 0. */
  loss: number;
  lossesApplied: number;
  exemptionApplied: number;
  /** The amount the rate was applied to (after losses, allowances and any inclusion fraction; the sale price for a tax on value). */
  taxBase: number | null;
  /** The holding-period step that applied, in words. */
  step: string | null;
  /** The income-tax year used, where the gain was taxed through the income-tax engine. */
  taxYear: string | null;
  /** Why there is no figure, when there is none. */
  reason: string | null;
  assumptions: string[];
  rule: CapitalGainsRuleText | null;
  effectiveFrom: string | null;
  source: CgtSource | null;
  sources: CgtSource[];
  uncertainties: string[];
}

const CURRENCY_FALLBACK: Readonly<Record<string, string>> = { GT: 'GTQ', JM: 'JMD', LI: 'CHF', MU: 'MUR', TZ: 'TZS', UG: 'UGX' };
export function cgtCurrency(code: string): string | null {
  return COUNTRY_CURRENCY_MAP[code] ?? CURRENCY_FALLBACK[code] ?? null;
}

const money = (n: number) => Math.round(n * 100) / 100;

function progressive(amount: number, bands: readonly CgtBand[]): number {
  let tax = 0;
  let lower = 0;
  for (const b of bands) {
    const upper = b.upTo ?? Infinity;
    if (amount > lower) tax += (Math.min(amount, upper) - lower) * b.rate;
    lower = upper;
    if (amount <= upper) break;
  }
  return tax;
}

/** Held past the `from` step under `unit`? Undefined when it cannot be told from the inputs. */
function reached(unit: CgtHolding['unit'], from: number, acquiredOn: string | undefined, disposedOn: string, holdingMonths: number | undefined): boolean | undefined {
  if (from === 0) return true;
  if (acquiredOn) {
    switch (unit) {
      case 'months':
        return disposedOn >= addDays(addMonths(acquiredOn, from), 1);
      case 'days':
        return disposedOn >= addDays(acquiredOn, from);
      case 'calendarYears':
        return Number(disposedOn.slice(0, 4)) - Number(acquiredOn.slice(0, 4)) >= from;
      case 'yearsAt1January':
        return `${disposedOn.slice(0, 4)}-01-01` >= addDays(addMonths(acquiredOn, 12 * from), 1);
    }
  }
  if (holdingMonths !== undefined && unit === 'months') return holdingMonths >= from;
  return undefined;
}

/**
 * Levies in an income-tax scheme that are charged on taxable income, and so on an
 * included gain too: AU's Medicare levy (2% of taxable income), IN's surcharge and cess (on the tax). Every other levy a scheme carries is a
 * charge on earnings — US FICA, GB National Insurance — and is left out.
 */
const LEVIES_ON_GAINS: Readonly<Record<string, RegExp>> = { AU: /^Medicare levy/, IN: /^(Surcharge|Health & Education cess)/ };
const leviedOnGains = (code: string, name: string) => Boolean(LEVIES_ON_GAINS[code]?.test(name));

/** Income tax after offsets, plus only the levies that reach a capital gain. */
function taxOnIncome(code: string, r: IncomeTaxResult): number {
  const offsets = r.offsets.reduce((t, o) => t + o.amount, 0);
  const levies = r.levies.filter((l) => leviedOnGains(code, l.name)).reduce((t, l) => t + l.amount, 0);
  return Math.max(0, r.incomeTax - offsets + levies);
}

/** The income-tax year label covering `day` for a country the income-tax engine holds, else null. */
function incomeYearFor(code: string, day: string): string | null {
  const scheme = getIncomeTaxScheme(code);
  if (!scheme || !scheme.verified) return null;
  const set = [...scheme.sets].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)).find((s) => s.effectiveFrom <= day);
  return set && day < addOneYear(set.effectiveFrom) ? set.taxYearLabel : null;
}

function check(n: unknown, field: string, required: boolean): number | undefined {
  if (n === undefined && !required) return undefined;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) throw new RangeError(`${field} must be a non-negative number, got ${String(n)}`);
  return n;
}

/**
 * Estimate the tax on one disposal by a resident individual.
 *
 * Throws RangeError on inputs that cannot describe a sale (negative or non-finite
 * amounts, an impossible date, acquisition after disposal). Everything else comes
 * back as a result whose `status` says what it is; read `verified`, `reason` and
 * `assumptions` beside any figure.
 *
 * @example
 *   estimateCapitalGainsTax({ country: 'AU', asset: 'shares', proceeds: 50000, costBase: 30000,
 *     acquiredOn: '2024-01-10', disposedOn: '2026-03-01', otherIncome: 90000 });
 *   // { status: 'computed', tax: …, step: 'Held at least 12 months: the 50% CGT discount applies', … }
 */
export function estimateCapitalGainsTax(input: CapitalGainsInput): CapitalGainsEstimate {
  const code = String(input.country ?? '').toUpperCase();
  const proceeds = check(input.proceeds, 'proceeds', true)!;
  const costBase = check(input.costBase, 'costBase', true)!;
  const capitalLosses = check(input.capitalLosses, 'capitalLosses', false) ?? 0;
  const holdingMonths = check(input.holdingMonths, 'holdingMonths', false);
  const otherIncome = check(input.otherIncome, 'otherIncome', false);
  const otherCategoryIncome = check(input.otherCategoryIncome, 'otherCategoryIncome', false);
  if (input.asset !== 'shares' && input.asset !== 'property') throw new RangeError(`asset must be 'shares' or 'property', got ${String(input.asset)}`);
  const c = getCapitalGainsCountry(code);
  const disposedOn = input.disposedOn ?? cgtDay(undefined, c?.timeZone);
  parseYmd(disposedOn, 'disposedOn');
  if (input.acquiredOn !== undefined) {
    parseYmd(input.acquiredOn, 'acquiredOn');
    if (input.acquiredOn > disposedOn) throw new RangeError('acquiredOn must be on or before disposedOn');
  }

  const gain = Math.max(0, proceeds - costBase);
  const loss = Math.max(0, costBase - proceeds);
  const base: CapitalGainsEstimate = {
    status: 'not-covered', country: code, countryName: c?.country ?? null, asset: input.asset, disposedOn,
    currency: cgtCurrency(code), regime: null, verified: false, tax: null, gain, loss, lossesApplied: 0, exemptionApplied: 0,
    taxBase: null, step: null, taxYear: null, reason: null, assumptions: [], rule: null, effectiveFrom: null,
    source: null, sources: [], uncertainties: [],
  };
  if (!c) {
    const why = CGT_NOT_RESEARCHED.includes(code) ? 'not yet researched' : 'not covered';
    return { ...base, reason: `Capital gains for ${code || 'this country'} are ${why} by the engine.` };
  }
  const r = resolveCapitalGainsRules(code, disposedOn);
  if (!r) {
    const earliest = [...c.sets].map((s) => s.effectiveFrom).sort()[0];
    return { ...base, reason: `No ${c.country} rule is on file for ${disposedOn}; the earliest set starts ${earliest}.` };
  }
  const a = r.set[input.asset];
  const out: CapitalGainsEstimate = {
    ...base,
    regime: r.set.regime,
    verified: a.verified && r.yearCovered,
    rule: { rule: a.rule, holdingPeriod: a.holdingPeriod, ...(a.annualExemption ? { annualExemption: a.annualExemption } : {}), ...(a.mainResidence ? { mainResidence: a.mainResidence } : {}), notes: a.notes },
    effectiveFrom: r.set.effectiveFrom,
    source: r.source,
    sources: r.set.sources,
    uncertainties: r.set.uncertainties,
    assumptions: [...(a.assumptions ?? [])],
  };
  const ruleOnly = (reason: string, verified = out.verified): CapitalGainsEstimate => ({ ...out, status: 'rule-only', verified, reason });
  const authority = r.source?.authority ?? 'the tax authority';

  if (!r.yearCovered) return ruleOnly(`The ${c.country} figures on file are for ${r.set.taxYearLabel ?? r.set.effectiveFrom.slice(0, 4)}; ${disposedOn} falls in a year with none yet. Confirm with ${authority}.`, false);
  if (!a.verified) return ruleOnly(`This rule is not verified on an official page${r.set.verificationNote ? ` (${r.set.verificationNote})` : ''}. Confirm with ${authority}.`, false);
  if (a.notComputed) return ruleOnly(a.notComputed);
  if (a.appliesToAcquisitionsFrom) {
    if (!input.acquiredOn) out.assumptions.push(`Acquired on or after ${a.appliesToAcquisitionsFrom}.`);
    else if (input.acquiredOn < a.appliesToAcquisitionsFrom) return ruleOnly(`Acquired before ${a.appliesToAcquisitionsFrom}: an earlier rule applies (see the rule text).`);
  }

  // Which treatment: by holding period where it matters.
  let treatment = a.treatment;
  if (a.holding) {
    let idx = 0;
    for (let i = 1; i < a.holding.steps.length; i++) {
      const ok = reached(a.holding.unit, a.holding.steps[i]!.from, input.acquiredOn, disposedOn, holdingMonths);
      if (ok === undefined) {
        const field = a.holding.unit === 'months' ? 'acquiredOn (or holdingMonths)' : 'acquiredOn';
        return { ...out, status: 'needs-input', reason: `${field} is needed: the treatment depends on how long the asset was held.` };
      }
      if (ok) idx = i;
    }
    const step = a.holding.steps[idx]!;
    treatment = step.treatment;
    out.step = step.label;
    if (!input.acquiredOn && holdingMonths !== undefined) out.assumptions.push(`Held ${holdingMonths} whole months; near a boundary, pass acquiredOn for the exact day.`);
  }

  if (treatment.kind === 'summary') return ruleOnly(out.step ? `${out.step}: not modelled.` : 'This rule is not machine-readable; see the rule text.');

  if (treatment.kind === 'calculator') {
    const label = r.set.taxYearLabel;
    const fi = finnishCapitalGainTax({
      proceeds, acquisitionCost: costBase, capitalLosses, otherCapitalIncome: otherCategoryIncome, taxYear: label,
      ...(input.acquiredOn ? { yearsHeld: Math.floor(monthsBetween(input.acquiredOn, disposedOn) / 12) } : holdingMonths !== undefined ? { yearsHeld: Math.floor(holdingMonths / 12) } : {}),
    });
    if (!fi) return ruleOnly(`No Finnish capital-income year ${label} is on file.`);
    return {
      ...out, status: 'computed', tax: money(fi.tax), gain: fi.gain, loss: fi.loss, lossesApplied: fi.lossesApplied,
      taxBase: fi.taxableGain, taxYear: fi.taxYear, assumptions: [...out.assumptions, ...fi.notes],
    };
  }

  // A tax on the sale price ignores the gain, losses and allowances.
  if (treatment.kind === 'proceeds') {
    return { ...out, status: 'computed', tax: money(proceeds * treatment.rate), taxBase: proceeds };
  }

  // Cliffs, then losses, then allowances.
  const th = a.threshold;
  if (th && ((th.proceedsAtMost !== undefined && proceeds <= th.proceedsAtMost) || (th.gainAtMost !== undefined && gain <= th.gainAtMost) || (th.gainBelow !== undefined && gain < th.gainBelow))) {
    out.assumptions.push(`${th.note} Assumes this is the only such disposal in the ${th.per}.`);
    return { ...out, status: 'computed', tax: 0, taxBase: 0 };
  }
  const lossesApplied = Math.min(capitalLosses, gain);
  const net = gain - lossesApplied;
  const ex = a.exemption;
  const exemptionApplied = ex ? Math.min(net, Math.max(ex.amount ?? 0, (ex.fractionOfGain ?? 0) * net)) : 0;
  const chargeable = net - exemptionApplied;
  Object.assign(out, { lossesApplied, exemptionApplied });

  switch (treatment.kind) {
    case 'exempt':
      return { ...out, status: 'computed', tax: 0, taxBase: 0 };
    case 'flat': {
      const taxBase = chargeable * (treatment.inclusion ?? 1);
      return { ...out, status: 'computed', tax: money(taxBase * treatment.rate), taxBase: money(taxBase) };
    }
    case 'bands': {
      if (treatment.base === 'gain') return { ...out, status: 'computed', tax: money(progressive(chargeable, treatment.bands)), taxBase: money(chargeable) };
      if (treatment.base === 'categoryIncome') {
        const other = otherCategoryIncome ?? 0;
        if (otherCategoryIncome === undefined) out.assumptions.push('No other income in the same schedule this year (otherCategoryIncome).');
        return { ...out, status: 'computed', tax: money(progressive(other + chargeable, treatment.bands) - progressive(other, treatment.bands)), taxBase: money(chargeable) };
      }
      const label = incomeYearFor(code, disposedOn);
      if (!label) return ruleOnly(`The gain is stacked on taxable income, and the engine has no verified ${c.country} income-tax year for ${disposedOn}.`);
      if (otherIncome === undefined) return { ...out, status: 'needs-input', reason: 'otherIncome is needed: the rate depends on where the gain falls above your other taxable income.' };
      const taxable = calcIncomeTax(code, otherIncome, label)!.taxable;
      return {
        ...out, status: 'computed', taxYear: label, taxBase: money(chargeable),
        tax: money(progressive(taxable + chargeable, treatment.bands) - progressive(taxable, treatment.bands)),
      };
    }
    case 'income': {
      const label = incomeYearFor(code, disposedOn);
      if (!label) return ruleOnly(`The gain is taxed at the marginal income rate, and the engine has no verified ${c.country} income-tax year for ${disposedOn}.`);
      if (otherIncome === undefined) return { ...out, status: 'needs-input', reason: 'otherIncome is needed: the gain is taxed at the marginal rate on top of your other income.' };
      const included = chargeable * treatment.inclusion;
      const without = calcIncomeTax(code, otherIncome, label)!;
      const withGain = calcIncomeTax(code, otherIncome + included, label)!;
      const scheme = getIncomeTaxScheme(code)!;
      const payroll = [...new Set(withGain.levies.filter((l) => !leviedOnGains(code, l.name)).map((l) => l.name))];
      return {
        ...out, status: 'computed', taxYear: label, taxBase: money(included),
        tax: money(Math.max(0, taxOnIncome(code, withGain) - taxOnIncome(code, without))),
        assumptions: [
          ...out.assumptions,
          `Income tax as the engine computes it for ${c.country}: ${scheme.note}`,
          ...(payroll.length ? [`Leaves out ${payroll.join(', ')}: charged on earnings, not on a capital gain.`] : []),
        ],
      };
    }
  }
}

/** Whole months from `from` to `to`. */
function monthsBetween(from: string, to: string): number {
  let m = (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + (Number(to.slice(5, 7)) - Number(from.slice(5, 7)));
  if (to.slice(8) < from.slice(8)) m -= 1;
  return Math.max(0, m);
}
