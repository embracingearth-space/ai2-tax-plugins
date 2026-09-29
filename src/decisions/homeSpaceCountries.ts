/**
 * The home-space comparison for the United Kingdom and the United States — ai2fin.com
 *
 * Same idea as the AU comparison (./homeSpaceComparison), under each
 * country's own rules, and only with figures verified on the authority's
 * page. Anything the pages leave to judgement is a note, not a number.
 *
 * GB — `gbBusinessRoomComparison`: a room used ONLY for the business, or a
 * desk or shared space.
 *  - A room used exclusively for the trade lets you claim the business share
 *    of fixed costs (mortgage interest, council tax, insurance, rent) for that
 *    room (BIM47820). A space with any regular personal use gets running costs
 *    only, and Private Residence Relief is untouched. The test is "stringent"
 *    (CG64663), and "a temporary or occasional office does not count".
 *  - At sale, the gain on the exclusively used part gets no relief: s224(1)
 *    TCGA 1992 applies s223 (including the final 9 months) only to the part
 *    "not exclusively used". The split is BY VALUE — the Valuation Office
 *    apportions "in proportion to the value of the respective parts" — so the
 *    input is the room's share of the home's value, not its floor area. Where
 *    exclusive use covered only part of the ownership, s224(2) allows a "just
 *    and reasonable" adjustment; this applies it by days, which is a
 *    judgement, stated as one.
 *  - CGT at 18% or 24% (2025-26, 2026-27), less the £3,000 annual exempt
 *    amount if no other gain uses it.
 *  - Employees: no deduction from 6 April 2026 (s360B ITEPA); that is in
 *    `homeRulesFor('GB')`, not a calculator. A lodger is Rent a Room, also there.
 *
 * US — `usHomeOfficeComparison`: the simplified method or the regular method
 * (Form 8829), for a self-employed person whose area is used regularly and
 * exclusively. Employees get nothing (`eligible: false`).
 *  - Simplified: $5 a square foot up to 300, depreciation deemed zero, so
 *    nothing to recapture.
 *  - Regular: the business share of indirect costs plus 39-year straight-line
 *    depreciation of the building. At sale, depreciation allowed or allowable
 *    after 6 May 1997 cannot be excluded and is taxed at up to 25%.
 *  - An office inside the home needs no allocation of gain. A separate
 *    structure does: its share of the gain is not excludable (the same under
 *    both methods, so it never moves the choice), taxed at the long-term rate
 *    you give — the package has no verified capital gains brackets.
 *
 * Both return a result `recommendHomeSpace` reads (GB), or their own choice
 * between methods (US), with `isAboutEven` deciding "about even".
 */

import { daysInclusive, heldAtLeast12Months, overlapDays, parseYmd } from './dates';
import { DecisionInputError, Problems, type DecisionInputProblem } from './inputGuards';
import {
  GB_CGT_ANNUAL_EXEMPT_ROWS,
  GB_CGT_BASIC_RATE_ROWS,
  GB_CGT_HIGHER_RATE_ROWS,
  US_HOME_OFFICE_RECOVERY_YEARS_ROWS,
  US_SIMPLIFIED_METHOD_ROWS,
  US_UNRECAPTURED_1250_MAX_RATE_ROWS,
  resolveHomeRate,
  type HomeRateRow,
  type ResolvedHomeRate,
} from './homeRuleRates';
import { isAboutEven } from './homeSpaceComparison';

const cents = (n: number) => Math.round(n * 100) / 100;
const DAY_MS = 86_400_000;

/** A figure the result used, with where it came from and whether it is an estimate for an unpublished year. */
export interface UsedRate {
  label: string;
  value: number;
  estimate: boolean;
  sourceUrl: string;
  readOn: string;
}

export interface CountryNote {
  text: string;
  /** true: a judgement or an unverified point — check it with an accountant. */
  forAccountant: boolean;
  sourceUrl?: string;
}

function rate(rows: readonly HomeRateRow[], ymd: string, label: string, field: string): UsedRate {
  const r: ResolvedHomeRate | null = resolveHomeRate(rows, ymd);
  if (!r) throw new DecisionInputError([{ field, message: `no verified ${label} is recorded for ${ymd}` }]);
  return { label, value: r.value, estimate: r.estimate, sourceUrl: r.sourceUrl, readOn: r.readOn };
}

/** Years of use by tax year: days used in each year ÷ days in it. `yearStart(y)` is the first day of tax year y. */
function yearsOfUse(start: string, end: string, yearOf: (ymd: string) => number, yearStart: (y: number) => string, labelOf: (y: number) => string) {
  const byYear: { label: string; fraction: number; days: number }[] = [];
  let total = 0;
  for (let y = yearOf(start); y <= yearOf(end); y++) {
    const ys = yearStart(y);
    const ye = new Date(parseYmd(yearStart(y + 1)) - DAY_MS).toISOString().slice(0, 10);
    const inYear = daysInclusive(ys, ye);
    const days = overlapDays(start, end, ys, ye);
    const fraction = days / inYear;
    byYear.push({ label: labelOf(y), fraction: Math.round(fraction * 10_000) / 10_000, days });
    total += fraction;
  }
  return { byYear, total: Math.round(total * 10_000) / 10_000, exact: total };
}

// ─── United Kingdom ─────────────────────────────────────────────────────────

const GOVUK = {
  bim47820: 'https://www.gov.uk/hmrc-internal-manuals/business-income-manual/bim47820',
  cg64663: 'https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg64663',
  s224: 'https://www.legislation.gov.uk/ukpga/1992/12/section/224',
  sellWorkFromHome: 'https://www.gov.uk/tax-sell-home/work-from-home',
  hs283: 'https://www.gov.uk/government/publications/private-residence-relief-hs283-self-assessment-helpsheet/hs283-private-residence-relief-2025',
  simplifiedWfh: 'https://www.gov.uk/simpler-income-tax-simplified-expenses/working-from-home',
};

export interface GbBusinessRoomInput {
  country?: 'GB' | 'UK' | string;
  /** Is the room used ONLY for the business, with no regular personal use? */
  exclusiveUse: boolean;
  /** The room's share of the home's floor area, percent — apportions the fixed costs. */
  areaSharePct: number;
  /** The room's share of the home's VALUE, percent — apportions the gain (CG64663). Ask a valuer if unsure. */
  valueSharePct: number;
  /** Whole-home fixed costs you pay each year: mortgage interest, council tax, insurance, water rates, rent. */
  fixedCostsPerYear: number;
  /** Income tax (and Class 4 NIC, if you want it counted) as one flat percent. */
  marginalRatePct: number;
  /** The CGT rate that applies: 'basic' (18%) or 'higher' (24%) for 2025-26 and 2026-27. */
  cgtBand: 'basic' | 'higher';
  /** Whether the £3,000 annual exempt amount is free for this gain (no other gains use it). Default true. */
  annualExemptAvailable?: boolean;
  /** YYYY-MM-DD you acquired the home. */
  ownedFrom: string;
  businessUseStart: string;
  /** Default: use continues to the sale. */
  businessUseEnd?: string;
  saleDate: string;
  /** Gain on the whole home over your ownership (sale price less cost). The UK has no reset at first business use. */
  expectedGrowth: number;
  /** Your share of the home, percent. Default 100. */
  ownershipPct?: number;
}

export interface GbBusinessRoomResult {
  supported: true;
  country: 'GB';
  currency: 'GBP';
  exclusiveUse: boolean;
  use: { byYear: { label: string; fraction: number; days: number }[]; total: number };
  /** Fixed costs the room adds as deductions (amount and tax value). Zero without exclusive use. */
  deductionAmounts: { pre: number; post: number; total: number };
  deductions: { pre: number; post: number; total: number };
  cgt: {
    /** Gain on the exclusively used part, by value share × days of exclusive use ÷ days owned. */
    businessPartGain: number;
    annualExemptUsed: number;
    ratePct: number;
    counted: number;
    laterAtTodaysRules: 0;
    wholeAtTodaysRules: number;
    laterAtNewRules: null;
  };
  breakEvenGrowth: number | null;
  partial: false;
  notYet: false;
  renting: false;
  rates: UsedRate[];
  notes: CountryNote[];
}

const gbYearOf = (ymd: string) => (ymd.slice(5) >= '04-06' ? Number(ymd.slice(0, 4)) : Number(ymd.slice(0, 4)) - 1);
const gbYearStart = (y: number) => `${y}-04-06`;
const gbLabel = (y: number) => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;

export function validateGbBusinessRoom(input: GbBusinessRoomInput): DecisionInputProblem[] {
  const p = new Problems();
  if (!input || typeof input !== 'object') return [{ field: 'input', message: 'expected an object' }];
  if (typeof input.exclusiveUse !== 'boolean') p.add('exclusiveUse', 'expected true or false');
  p.percent(input.areaSharePct, 'areaSharePct');
  p.percent(input.valueSharePct, 'valueSharePct');
  p.amount(input.fixedCostsPerYear, 'fixedCostsPerYear');
  p.percent(input.marginalRatePct, 'marginalRatePct');
  if (input.cgtBand !== 'basic' && input.cgtBand !== 'higher') p.add('cgtBand', `expected 'basic' or 'higher', got ${JSON.stringify(input.cgtBand)}`);
  if (input.ownershipPct !== undefined) p.percent(input.ownershipPct, 'ownershipPct');
  p.amount(input.expectedGrowth, 'expectedGrowth');
  const owned = p.date(input.ownedFrom, 'ownedFrom');
  const start = p.date(input.businessUseStart, 'businessUseStart');
  const sale = p.date(input.saleDate, 'saleDate');
  if (owned && start) p.order(input.ownedFrom, input.businessUseStart, 'ownedFrom', 'businessUseStart');
  if (start && sale) p.order(input.businessUseStart, input.saleDate, 'businessUseStart', 'saleDate');
  if (input.businessUseEnd !== undefined && p.date(input.businessUseEnd, 'businessUseEnd') && start && sale) {
    p.order(input.businessUseStart, input.businessUseEnd, 'businessUseStart', 'businessUseEnd');
    if (input.businessUseEnd > input.saleDate) p.add('businessUseEnd', `must be on or before saleDate (${input.saleDate}), got ${input.businessUseEnd}`);
  }
  if (sale && input.saleDate < '2025-04-06') p.add('saleDate', 'CGT rates before 6 April 2025 are not recorded in this package');
  return p.list;
}

/** A room used only for the business vs a desk or shared space, under the UK rules. */
export function gbBusinessRoomComparison(input: GbBusinessRoomInput): GbBusinessRoomResult {
  const problems = validateGbBusinessRoom(input);
  if (problems.length) throw new DecisionInputError(problems);
  const marginal = Number(input.marginalRatePct) / 100;
  const ownership = Number(input.ownershipPct ?? 100) / 100;
  const end = input.businessUseEnd ?? input.saleDate;
  const use = yearsOfUse(input.businessUseStart, end, gbYearOf, gbYearStart, gbLabel);
  const exclusive = input.exclusiveUse;

  const rates = [
    rate(input.cgtBand === 'basic' ? GB_CGT_BASIC_RATE_ROWS : GB_CGT_HIGHER_RATE_ROWS, input.saleDate, `CGT rate (${input.cgtBand})`, 'saleDate'),
    rate(GB_CGT_ANNUAL_EXEMPT_ROWS, input.saleDate, 'CGT annual exempt amount', 'saleDate'),
  ];
  const [cgtRate, aea] = rates;

  const amount = exclusive ? Number(input.fixedCostsPerYear) * (Number(input.areaSharePct) / 100) * use.exact : 0;
  const ownedDays = daysInclusive(input.ownedFrom, input.saleDate);
  const usedDays = daysInclusive(input.businessUseStart, end);
  const fraction = exclusive ? (ownership * (Number(input.valueSharePct) / 100) * usedDays) / ownedDays : 0;
  const gain = Math.max(0, Number(input.expectedGrowth)) * fraction;
  const aeaUsed = input.annualExemptAvailable === false ? 0 : Math.min(gain, aea.value);
  const tax = Math.max(0, gain - aeaUsed) * (cgtRate.value / 100);
  // Break-even ignores the annual exempt amount (it is a one-off per year, not per pound of growth).
  const perPound = fraction * (cgtRate.value / 100);
  const breakEven = exclusive && perPound > 0 ? (amount * marginal) / perPound : null;

  const notes: CountryNote[] = exclusive
    ? [
        { text: 'Fixed costs (mortgage interest, council tax, insurance, water rates, rent) are deductible in proportion for a part of the home set aside solely for the trade.', forAccountant: false, sourceUrl: GOVUK.bim47820 },
        { text: 'The exclusive-use test is "stringent": a room with some regular personal use is not restricted, and a temporary or occasional office does not count.', forAccountant: false, sourceUrl: GOVUK.cg64663 },
        { text: 'At sale, the gain on the exclusively used part gets no Private Residence Relief, and the final 9 months do not cover it: s224(1) applies them only to the part not exclusively used.', forAccountant: false, sourceUrl: GOVUK.s224 },
        { text: 'The gain is split by value, not floor area; the Valuation Office apportions it. The value share here is your estimate.', forAccountant: true, sourceUrl: GOVUK.cg64663 },
        ...(usedDays < ownedDays
          ? [{ text: 'Exclusive use covered only part of your ownership. s224(2) allows a "just and reasonable" adjustment; this counts it by days, which is a judgement, not a rule.', forAccountant: true, sourceUrl: GOVUK.s224 }]
          : []),
        { text: 'Whether the simplified flat rate can be combined with a share of fixed costs for the same room was not stated on the page read.', forAccountant: true, sourceUrl: GOVUK.simplifiedWfh },
      ]
    : [
        { text: 'A space also used personally: running costs only, and Private Residence Relief is unaffected.', forAccountant: false, sourceUrl: GOVUK.sellWorkFromHome },
      ];
  if (rates.some((r) => r.estimate)) notes.push({ text: `The ${gbLabel(gbYearOf(input.saleDate))} CGT figures are not published yet; the latest published ones are used as an estimate.`, forAccountant: false });
  if (!heldAtLeast12Months(input.ownedFrom, input.saleDate)) notes.push({ text: 'A home owned for under a year: check whether the sale is a trade.', forAccountant: true });

  return {
    supported: true,
    country: 'GB',
    currency: 'GBP',
    exclusiveUse: exclusive,
    use: { byYear: use.byYear, total: use.total },
    deductionAmounts: { pre: cents(amount), post: 0, total: cents(amount) },
    deductions: { pre: cents(amount * marginal), post: 0, total: cents(amount * marginal) },
    cgt: {
      businessPartGain: cents(gain),
      annualExemptUsed: cents(aeaUsed),
      ratePct: cgtRate.value,
      counted: cents(tax),
      laterAtTodaysRules: 0,
      wholeAtTodaysRules: cents(tax),
      laterAtNewRules: null,
    },
    breakEvenGrowth: breakEven === null ? null : Math.round(breakEven),
    partial: false,
    notYet: false,
    renting: false,
    rates,
    notes,
  };
}

// ─── United States ──────────────────────────────────────────────────────────

const IRS = {
  p587: 'https://www.irs.gov/publications/p587',
  p523: 'https://www.irs.gov/publications/p523',
  tc509: 'https://www.irs.gov/taxtopics/tc509',
  i2106: 'https://www.irs.gov/pub/irs-pdf/i2106.pdf',
};

export interface UsHomeOfficeInput {
  country?: 'US' | string;
  role: 'employee' | 'self_employed';
  /** Used regularly and exclusively for the business, as the principal place of business or to meet clients. */
  regularAndExclusive: boolean;
  officeSqFt: number;
  homeSqFt: number;
  businessUseStart: string;
  businessUseEnd?: string;
  saleDate: string;
  /** Whole-home indirect costs a year you would NOT deduct anyway: insurance, utilities, repairs (and rent). */
  otherIndirectCostsPerYear: number;
  /**
   * Whole-home mortgage interest and real estate taxes a year. If you itemize, they are deductible either way (on
   * Schedule A under the simplified method), so they do not favour the regular method; if you do not, the business
   * share is extra under the regular method.
   */
  mortgageInterestAndTaxesPerYear?: number;
  itemizes?: boolean;
  /** The building's basis for depreciation (the lesser of adjusted basis and value at first use, excluding land). */
  buildingBasis: number;
  /** Federal marginal rate on ordinary income, percent, applied flat. */
  marginalRatePct: number;
  /** An office in a separate structure rather than inside the home. */
  separateStructure?: boolean;
  /** Growth in the whole property's value over the use; needed only for a separate structure. */
  expectedGrowth?: number;
  /** Your long-term capital gains rate, percent — needed only for a separate structure with growth. */
  longTermCapitalGainsRatePct?: number;
}

export interface UsMethodOutcome {
  deductions: number;
  /** Of which depreciation (regular only). */
  depreciation: number;
  taxValue: number;
  /** Tax at sale that this method causes: the depreciation recapture (regular), zero (simplified). */
  saleTax: number;
  net: number;
}

export interface UsHomeOfficeResult {
  supported: true;
  country: 'US';
  currency: 'USD';
  eligible: boolean;
  ineligibleReason: null | 'employee' | 'not_regular_and_exclusive';
  businessPct: number;
  use: { byYear: { label: string; fraction: number; days: number }[]; total: number };
  simplified: UsMethodOutcome;
  regular: UsMethodOutcome;
  /** A separate structure's share of the gain, not excludable under either method. Null inside the home. */
  separateStructureTax: number | null;
  better: 'simplified' | 'regular' | 'even' | null;
  /** |regular.net − simplified.net|, whole dollars. */
  amount: number;
  rates: UsedRate[];
  notes: CountryNote[];
}

const usYearOf = (ymd: string) => Number(ymd.slice(0, 4));

export function validateUsHomeOffice(input: UsHomeOfficeInput): DecisionInputProblem[] {
  const p = new Problems();
  if (!input || typeof input !== 'object') return [{ field: 'input', message: 'expected an object' }];
  if (input.role !== 'employee' && input.role !== 'self_employed') p.add('role', `expected 'employee' or 'self_employed', got ${JSON.stringify(input.role)}`);
  if (typeof input.regularAndExclusive !== 'boolean') p.add('regularAndExclusive', 'expected true or false');
  const home = p.number(input.homeSqFt, 'homeSqFt', { min: 1, what: 'square feet, at least 1' });
  const office = p.number(input.officeSqFt, 'officeSqFt', { min: 0, what: 'square feet, 0 or more' });
  if (home && office && Number(input.officeSqFt) > Number(input.homeSqFt)) p.add('officeSqFt', 'cannot be larger than the home');
  p.amount(input.otherIndirectCostsPerYear, 'otherIndirectCostsPerYear');
  if (input.mortgageInterestAndTaxesPerYear !== undefined) p.amount(input.mortgageInterestAndTaxesPerYear, 'mortgageInterestAndTaxesPerYear');
  p.amount(input.buildingBasis, 'buildingBasis');
  p.percent(input.marginalRatePct, 'marginalRatePct');
  const start = p.date(input.businessUseStart, 'businessUseStart');
  const sale = p.date(input.saleDate, 'saleDate');
  if (start && sale) p.order(input.businessUseStart, input.saleDate, 'businessUseStart', 'saleDate');
  if (input.businessUseEnd !== undefined && p.date(input.businessUseEnd, 'businessUseEnd') && start && sale) {
    p.order(input.businessUseStart, input.businessUseEnd, 'businessUseStart', 'businessUseEnd');
    if (input.businessUseEnd > input.saleDate) p.add('businessUseEnd', `must be on or before saleDate (${input.saleDate}), got ${input.businessUseEnd}`);
  }
  if (start && input.businessUseStart < '2025-01-01') p.add('businessUseStart', 'figures before 2025 are not recorded in this package');
  if (input.separateStructure) {
    if (input.expectedGrowth !== undefined) p.amount(input.expectedGrowth, 'expectedGrowth');
    if (Number(input.expectedGrowth ?? 0) > 0) p.percent(input.longTermCapitalGainsRatePct, 'longTermCapitalGainsRatePct');
  }
  return p.list;
}

/** Simplified or regular method for a US home office, including what each costs at sale. */
export function usHomeOfficeComparison(input: UsHomeOfficeInput): UsHomeOfficeResult {
  const problems = validateUsHomeOffice(input);
  if (problems.length) throw new DecisionInputError(problems);
  const marginal = Number(input.marginalRatePct) / 100;
  const end = input.businessUseEnd ?? input.saleDate;
  const use = yearsOfUse(input.businessUseStart, end, usYearOf, (y) => `${y}-01-01`, (y) => String(y));
  const bizPct = Number(input.officeSqFt) / Number(input.homeSqFt);
  const zero: UsMethodOutcome = { deductions: 0, depreciation: 0, taxValue: 0, saleTax: 0, net: 0 };

  const ineligibleReason = input.role === 'employee' ? 'employee' : !input.regularAndExclusive ? 'not_regular_and_exclusive' : null;
  if (ineligibleReason) {
    return {
      supported: true,
      country: 'US',
      currency: 'USD',
      eligible: false,
      ineligibleReason,
      businessPct: Math.round(bizPct * 10_000) / 100,
      use: { byYear: use.byYear, total: use.total },
      simplified: zero,
      regular: { ...zero },
      separateStructureTax: null,
      better: null,
      amount: 0,
      rates: [],
      notes: [
        ineligibleReason === 'employee'
          ? { text: 'Employees are not eligible to claim the home office deduction: miscellaneous itemized deductions were eliminated for tax years after 2017.', forAccountant: false, sourceUrl: IRS.i2106 }
          : { text: 'The area must be used regularly and exclusively for the business (daycare and inventory storage aside).', forAccountant: false, sourceUrl: IRS.p587 },
      ],
    };
  }

  // Each year's figures use that year's rate (or the latest published, labelled an estimate).
  const rates: UsedRate[] = [];
  let simplifiedDed = 0;
  let depreciation = 0;
  for (const y of use.byYear) {
    const day = `${y.label}-07-01`;
    const perSqFt = rate(US_SIMPLIFIED_METHOD_ROWS, day, `Simplified method ${y.label}, per sq ft`, 'businessUseStart');
    const years = rate(US_HOME_OFFICE_RECOVERY_YEARS_ROWS, day, `Recovery period ${y.label}, years`, 'businessUseStart');
    rates.push(perSqFt, years);
    simplifiedDed += perSqFt.value * Math.min(Number(input.officeSqFt), 300) * (y.days / daysInclusive(`${y.label}-01-01`, `${y.label}-12-31`));
    depreciation += ((Number(input.buildingBasis) * bizPct) / years.value) * (y.days / daysInclusive(`${y.label}-01-01`, `${y.label}-12-31`));
  }
  const extraInterestTaxes = input.itemizes ? 0 : Number(input.mortgageInterestAndTaxesPerYear ?? 0);
  const regularIndirect = (Number(input.otherIndirectCostsPerYear) + extraInterestTaxes) * bizPct * use.exact;
  const cap1250 = rate(US_UNRECAPTURED_1250_MAX_RATE_ROWS, input.saleDate, 'Unrecaptured section 1250 gain, maximum rate', 'saleDate');
  rates.push(cap1250);
  const recaptureRate = Math.min(marginal, cap1250.value / 100);

  const simplified: UsMethodOutcome = {
    deductions: cents(simplifiedDed),
    depreciation: 0,
    taxValue: cents(simplifiedDed * marginal),
    saleTax: 0,
    net: cents(simplifiedDed * marginal),
  };
  const regularDed = regularIndirect + depreciation;
  const regular: UsMethodOutcome = {
    deductions: cents(regularDed),
    depreciation: cents(depreciation),
    taxValue: cents(regularDed * marginal),
    saleTax: cents(depreciation * recaptureRate),
    net: cents(regularDed * marginal - depreciation * recaptureRate),
  };
  const diff = regular.net - simplified.net;
  const better = isAboutEven(diff, Math.max(regular.taxValue, simplified.taxValue), regular.saleTax) ? 'even' : diff > 0 ? 'regular' : 'simplified';

  let separateStructureTax: number | null = null;
  if (input.separateStructure) {
    // expectedGrowth is already growth "over the use" (businessUseStart to businessUseEnd/saleDate) per the
    // input's own contract — not growth over the whole ownership. A further usedDays/ownedDays factor here would
    // apply that same period a second time and understate the tax when businessUseEnd is before saleDate.
    const growth = Math.max(0, Number(input.expectedGrowth ?? 0));
    separateStructureTax = cents(growth * bizPct * (Number(input.longTermCapitalGainsRatePct ?? 0) / 100));
  }

  const notes: CountryNote[] = [
    { text: 'Simplified method: $5 a square foot up to 300 square feet; depreciation is deemed zero, so there is nothing to recapture; no carryforward.', forAccountant: false, sourceUrl: IRS.tc509 },
    { text: 'Regular method: the business share of indirect costs plus 39-year straight-line depreciation; limited to the gross income from the business use, with the excess carried forward.', forAccountant: false, sourceUrl: IRS.p587 },
    { text: 'At sale you cannot exclude the gain equal to depreciation allowed or allowable after 6 May 1997; it is taxed at a maximum 25%.', forAccountant: false, sourceUrl: IRS.p523 },
    input.separateStructure
      ? { text: 'A separate structure: its share of the gain is not excludable (allocated and reported on Form 4797) unless you also lived in that part for 2 of the last 5 years. The same under both methods.', forAccountant: true, sourceUrl: IRS.p587 }
      : { text: 'An office inside your home needs no allocation of gain; only the depreciation is taxed.', forAccountant: false, sourceUrl: IRS.p523 },
    { text: 'Depreciation here is straight line by day, a simplification of the mid-month convention. Self-employment tax, the income limit, state tax and the §121 exclusion cap are not modelled.', forAccountant: true },
  ];
  if (rates.some((r) => r.estimate)) notes.push({ text: 'A year here has no published figure yet; the latest published one is used as an estimate.', forAccountant: false });

  return {
    supported: true,
    country: 'US',
    currency: 'USD',
    eligible: true,
    ineligibleReason: null,
    businessPct: Math.round(bizPct * 10_000) / 100,
    use: { byYear: use.byYear, total: use.total },
    simplified,
    regular,
    separateStructureTax,
    better,
    amount: Math.round(Math.abs(diff)),
    rates: dedupe(rates),
    notes,
  };
}

function dedupe(rates: UsedRate[]): UsedRate[] {
  const seen = new Set<string>();
  return rates.filter((r) => (seen.has(r.label) ? false : (seen.add(r.label), true)));
}

