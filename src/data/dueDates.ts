/**
 * Filing and payment due dates — @ai2/tax-plugins
 * 2fin
 *
 * WHY RULES, NOT DATES: a due date is a rule the authority states ("the 28th
 * of the month after the quarter ends, except the October–December quarter,
 * due 28 February"). Stored as a rule it is right for every future year the
 * rule stands, and a change in the law is a NEW effective-dated row, never an
 * edit to an old one. Every row carries the authority page it was read from,
 * the day it was read and a review-by date; rateWatch.analyzeDueDateRules
 * flags a row whose citation is stale or past review, exactly as it does for
 * rates.
 *
 * WHAT A RESULT PROMISES:
 *   • `ymd`         the statutory date, a plain calendar date (no timezone)
 *   • `adjustedYmd` the date after the authority's weekend rule. Public
 *                   holidays are NOT modelled — they differ by state and year —
 *                   and `holidayNote` says how the authority treats them, so a
 *                   consumer never shows a later date than the law allows.
 *   • `approximate` true when the exact date needs something the caller did
 *                   not give (India's quarterly date depends on the state);
 *                   the date given is then the EARLIER of the possibilities.
 *
 * WHAT IS COVERED: GST/VAT activity statements for AU, GB, CA, NZ and IN;
 * income-tax payments for the self-employed in AU, GB, CA, US and IN. A
 * country or obligation not covered returns null — never a guess.
 *
 * Calendar arithmetic is done on UTC calendar dates only.
 */

import { toYmd } from './rateLedger';

export type DueFrequency = 'monthly' | 'quarterly' | 'annual';
export type DueObligation = 'indirect_return' | 'income_tax';
export type DueAction = 'lodge_and_pay' | 'lodge' | 'pay';
/**
 * next_business_day  a date on a Saturday or Sunday moves to the Monday
 * none               the date stands even at a weekend (pay earlier)
 */
export type NonBusinessDayRule = 'next_business_day' | 'none';

export interface DueDate {
  obligation: DueObligation;
  action: DueAction;
  /** Short name of the return or payment, in the authority's words ("BAS", "VAT Return", "Payment on account"). */
  title: string;
  /** Statutory date, YYYY-MM-DD. */
  ymd: string;
  /** After the weekend rule, YYYY-MM-DD. Public holidays are not applied (see holidayNote). */
  adjustedYmd: string;
  nonBusinessDay: NonBusinessDayRule;
  holidayNote: string;
  /** Who it applies to, when not everyone ("if you pay PAYG instalments"). */
  appliesIf?: string;
  /** India advance tax: the share of the year's tax due by this date, cumulative. */
  cumulativeShare?: number;
  /** The exact date needs more than the caller gave; this is the earliest possibility. */
  approximate?: boolean;
  notes: string[];
  sourceUrl: string;
  readOn: string;
  verified: boolean;
}

export interface DueDateRuleSource {
  sourceUrl: string;
  /** The day the rule was read on the authority's page, YYYY-MM-DD. */
  readOn: string;
  /** Re-check by this day; the rate watch flags it once past. */
  reviewBy: string;
  verified: boolean;
}

export interface IndirectDueOptions {
  /** India quarterly (QRMP): the state of the principal place of business (ISO 3166-2 like "MH" / "IN-MH", or its name). */
  region?: string | null;
  /** Australia annual GST return: false when no income tax return is required (due 28 February). Default true. */
  filesIncomeTaxReturn?: boolean;
  /** Canada annual filer: an individual with business income and a 31 December year end (file 15 June, pay 30 April). */
  individualWithBusinessIncome?: boolean;
}

export interface IncomeTaxDueOptions {
  /** India: income declared under the presumptive scheme (s 44AD / 44ADA): one instalment, 15 March. */
  presumptive?: boolean;
}

interface Period {
  /** First day, YYYY-MM-DD. */
  start: string;
  /** Last day, YYYY-MM-DD. */
  end: string;
}

interface CountryDueRules {
  countryCode: string;
  authority: string;
  /** First period (by its last day) or tax year (by its first day) the row describes. */
  effectiveFrom: string;
  nonBusinessDay: NonBusinessDayRule;
  holidayNote: string;
  indirect?: {
    source: DueDateRuleSource;
    dueFor(period: Period, frequency: DueFrequency, opts: IndirectDueOptions): Omit<DueDate, CommonKeys>[] | null;
  };
  incomeTax?: {
    source: DueDateRuleSource;
    dueFor(taxYear: Period, opts: IncomeTaxDueOptions): Omit<DueDate, CommonKeys>[];
  };
}

type CommonKeys = 'obligation' | 'adjustedYmd' | 'nonBusinessDay' | 'holidayNote' | 'sourceUrl' | 'readOn' | 'verified';

// ─── Calendar (UTC calendar dates only) ─────────────────────────────────────

const parts = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return { y, m, d };
};
/** Day `d` of month `m` (1-12; may overflow into the next year) of year `y`. */
export function ymdOf(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d, 12)).toISOString().slice(0, 10);
}
/** The last day of month `m` (1-12; may overflow) of year `y`. */
function lastDayOf(y: number, m: number): string {
  return new Date(Date.UTC(y, m, 0, 12)).toISOString().slice(0, 10);
}
function weekday(ymd: string): number {
  const { y, m, d } = parts(ymd);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}
function adjust(ymd: string, rule: NonBusinessDayRule): string {
  if (rule === 'none') return ymd;
  const w = weekday(ymd);
  const { y, m, d } = parts(ymd);
  if (w === 6) return ymdOf(y, m, d + 2);
  if (w === 0) return ymdOf(y, m, d + 1);
  return ymd;
}

// ─── Sources (read on the authority's own page) ─────────────────────────────

const READ = '2026-10-19';
const REVIEW = '2027-10-19';
const src = (sourceUrl: string): DueDateRuleSource => ({ sourceUrl, readOn: READ, reviewBy: REVIEW, verified: true });

// ─── India: the states whose QRMP GSTR-3B is due on the 22nd ────────────────

/**
 * CGST Rule 61(5) proviso as notified: principal place of business in
 * Chhattisgarh, Madhya Pradesh, Gujarat, Maharashtra, Karnataka, Goa, Kerala,
 * Tamil Nadu, Telangana, Andhra Pradesh, the Union territories of Daman and
 * Diu and Dadra and Nagar Haveli, Puducherry, Andaman and Nicobar Islands or
 * Lakshadweep → the 22nd; every other State or UT → the 24th.
 */
const IN_QRMP_22ND = new Map<string, true>(
  [
    ['CT', 'chhattisgarh'], ['CG', 'chhattisgarh'],
    ['MP', 'madhya pradesh'],
    ['GJ', 'gujarat'],
    ['MH', 'maharashtra'],
    ['KA', 'karnataka'],
    ['GA', 'goa'],
    ['KL', 'kerala'],
    ['TN', 'tamil nadu'],
    ['TG', 'telangana'], ['TS', 'telangana'],
    ['AP', 'andhra pradesh'],
    ['DH', 'dadra and nagar haveli and daman and diu'], ['DD', 'daman and diu'], ['DN', 'dadra and nagar haveli'],
    ['PY', 'puducherry'], ['PY', 'pondicherry'],
    ['AN', 'andaman and nicobar islands'],
    ['LD', 'lakshadweep'],
  ].flatMap(([code, name]) => [[code, true], [name, true]] as Array<[string, true]>),
);
/** ISO 3166-2:IN codes of every State and UT, so an unknown string is told apart from a 24th-day state. */
const IN_STATE_CODES = new Set([
  'AN', 'AP', 'AR', 'AS', 'BR', 'CH', 'CT', 'CG', 'DH', 'DD', 'DN', 'DL', 'GA', 'GJ', 'HP', 'HR', 'JH', 'JK', 'KA', 'KL',
  'LA', 'LD', 'MH', 'ML', 'MN', 'MP', 'MZ', 'NL', 'OR', 'OD', 'PB', 'PY', 'RJ', 'SK', 'TG', 'TS', 'TN', 'TR', 'UP', 'UK', 'UT', 'WB',
]);
const IN_STATE_NAMES_24TH = new Set([
  'arunachal pradesh', 'assam', 'bihar', 'chandigarh', 'delhi', 'national capital territory of delhi', 'himachal pradesh',
  'haryana', 'jharkhand', 'jammu and kashmir', 'ladakh', 'meghalaya', 'manipur', 'mizoram', 'nagaland', 'odisha', 'orissa',
  'punjab', 'rajasthan', 'sikkim', 'tripura', 'uttar pradesh', 'uttarakhand', 'west bengal',
]);

/** 22 / 24, or null when the region doesn't name an Indian State or UT. */
export function indiaQrmpReturnDay(region: string | null | undefined): 22 | 24 | null {
  if (!region) return null;
  const raw = region.trim();
  const code = raw.toUpperCase().replace(/^IN-/, '');
  const name = raw.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ');
  if (IN_QRMP_22ND.has(code) || IN_QRMP_22ND.has(name)) return 22;
  if (IN_STATE_CODES.has(code) || IN_STATE_NAMES_24TH.has(name)) return 24;
  return null;
}

// ─── The rules ──────────────────────────────────────────────────────────────

const RULES: CountryDueRules[] = [
  {
    countryCode: 'AU',
    authority: 'ATO',
    effectiveFrom: '2024-07-01',
    nonBusinessDay: 'next_business_day',
    holidayNote: 'If it falls on a weekend or public holiday, you have until the next business day.',
    indirect: {
      source: src('https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/business-activity-statements-bas/due-dates-for-lodging-and-paying-your-bas'),
      dueFor(period, frequency, opts) {
        const { y, m } = parts(period.end);
        if (frequency === 'monthly') {
          return [{ action: 'lodge_and_pay', title: 'BAS', ymd: ymdOf(y, m + 1, 21), notes: [] }];
        }
        if (frequency === 'quarterly') {
          const ymd = m === 12 ? ymdOf(y + 1, 2, 28) : ymdOf(y, m + 1, 28);
          return [
            {
              action: 'lodge_and_pay',
              title: 'BAS',
              ymd,
              notes:
                m === 12
                  ? ['The October–December quarter already includes an extra month, so no online extension applies.']
                  : ['Lodging online may give you two more weeks. A registered tax or BAS agent may have later dates.'],
            },
          ];
        }
        // Annual GST return: 31 October after the year; 28 February when no income tax return is required.
        return opts.filesIncomeTaxReturn === false
          ? [{ action: 'lodge_and_pay', title: 'Annual GST return', ymd: ymdOf(y + 1, 2, 28), notes: ['You are not required to lodge an income tax return.'] }]
          : [{ action: 'lodge_and_pay', title: 'Annual GST return', ymd: ymdOf(y, 10, 31), notes: [] }];
      },
    },
    incomeTax: {
      source: src('https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/payg-instalments/when-are-payg-instalments-due'),
      dueFor(year) {
        const s = parts(year.start).y;
        const e = parts(year.end).y;
        const instalment = (ymd: string) => ({
          action: 'pay' as const,
          title: 'PAYG instalment',
          ymd,
          appliesIf: 'you pay PAYG instalments quarterly',
          notes: [],
        });
        return [
          instalment(ymdOf(s, 10, 28)),
          instalment(ymdOf(s + 1, 2, 28)),
          instalment(ymdOf(e, 4, 28)),
          instalment(ymdOf(e, 7, 28)),
          {
            action: 'lodge',
            title: 'Tax return',
            ymd: ymdOf(e, 10, 31),
            appliesIf: 'you lodge your own return',
            notes: ['A registered tax agent engaged before 31 October can lodge later.'],
          },
          {
            action: 'pay',
            title: 'Tax bill',
            ymd: ymdOf(e, 11, 21),
            appliesIf: 'you lodge your own return by 31 October',
            notes: ['If your notice of assessment comes later, payment is due 21 days after it.'],
          },
        ];
      },
    },
  },
  {
    countryCode: 'GB',
    authority: 'HMRC',
    effectiveFrom: '2024-04-06',
    nonBusinessDay: 'none',
    holidayNote:
      'Due on this date even at a weekend or bank holiday: a Faster Payment arrives the same day; other payments must clear by the last working day before.',
    indirect: {
      source: src('https://www.gov.uk/submit-vat-return'),
      dueFor(period, frequency) {
        const { y, m } = parts(period.end);
        if (frequency === 'annual') {
          return [
            {
              action: 'lodge_and_pay',
              title: 'VAT Return',
              ymd: lastDayOf(y, m + 2),
              appliesIf: 'you use the Annual Accounting Scheme',
              notes: ['Your interim payments are due through the year as HMRC sets them.'],
            },
          ];
        }
        // 1 calendar month and 7 days after the end of the period.
        return [{ action: 'lodge_and_pay', title: 'VAT Return', ymd: ymdOf(y, m + 2, 7), notes: [] }];
      },
    },
    incomeTax: {
      source: src('https://www.gov.uk/understand-self-assessment-bill/payments-on-account'),
      dueFor(year) {
        const e = parts(year.end).y; // a tax year ends 5 April
        const poa = 'your last bill was £1,000 or more and under 80% was taken at source';
        return [
          { action: 'pay', title: 'First payment on account', ymd: ymdOf(e, 1, 31), appliesIf: poa, notes: ['Usually half of last year’s bill.'] },
          { action: 'pay', title: 'Second payment on account', ymd: ymdOf(e, 7, 31), appliesIf: poa, notes: ['Usually half of last year’s bill.'] },
          {
            action: 'lodge_and_pay',
            title: 'Online tax return and balancing payment',
            ymd: ymdOf(e + 1, 1, 31),
            notes: ['Capital gains tax and student loan repayments are paid here, not on account.'],
          },
        ];
      },
    },
  },
  {
    countryCode: 'CA',
    authority: 'CRA',
    effectiveFrom: '2024-01-01',
    nonBusinessDay: 'next_business_day',
    holidayNote: 'If it falls on a weekend or a public holiday the CRA recognises, the next business day is on time.',
    indirect: {
      source: src(
        'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/file-gst-hst-return/reporting-requirements-deadlines.html',
      ),
      dueFor(period, frequency, opts) {
        const { y, m, d } = parts(period.end);
        if (frequency !== 'annual') {
          return [{ action: 'lodge_and_pay', title: 'GST/HST return', ymd: lastDayOf(y, m + 1), notes: [] }];
        }
        if (opts.individualWithBusinessIncome && m === 12 && d === 31) {
          return [
            { action: 'pay', title: 'GST/HST payment', ymd: ymdOf(y + 1, 4, 30), notes: [] },
            { action: 'lodge', title: 'GST/HST return', ymd: ymdOf(y + 1, 6, 15), notes: ['Paying by 30 April avoids interest even though the return is due later.'] },
          ];
        }
        return [{ action: 'lodge_and_pay', title: 'GST/HST return', ymd: lastDayOf(y, m + 3), notes: [] }];
      },
    },
    incomeTax: {
      source: src('https://www.canada.ca/en/revenue-agency/services/payments/payments-cra/individual-payments/income-tax-instalments/due-dates.html'),
      dueFor(year) {
        const y = parts(year.start).y; // calendar year
        const instalment = (m: number) => ({
          action: 'pay' as const,
          title: 'Tax instalment',
          ymd: ymdOf(y, m, 15),
          appliesIf: 'your net tax owing is over $3,000 ($1,800 in Quebec) this year and in either of the two years before',
          notes: [],
        });
        return [
          instalment(3),
          instalment(6),
          instalment(9),
          instalment(12),
          { action: 'pay', title: 'Balance owing', ymd: ymdOf(y + 1, 4, 30), notes: [] },
          { action: 'lodge', title: 'Tax return (self-employed)', ymd: ymdOf(y + 1, 6, 15), notes: ['The balance is still due 30 April.'] },
        ];
      },
    },
  },
  {
    countryCode: 'NZ',
    authority: 'IRD',
    effectiveFrom: '2024-04-01',
    nonBusinessDay: 'next_business_day',
    holidayNote: 'If it falls on a weekend or public holiday, it is due the next working day.',
    indirect: {
      source: src('https://www.ird.govt.nz/gst/filing-and-paying-gst-and-refunds/filing-gst'),
      dueFor(period) {
        const { y, m } = parts(period.end);
        const ymd = m === 3 ? ymdOf(y, 5, 7) : m === 11 ? ymdOf(y + 1, 1, 15) : ymdOf(y, m + 1, 28);
        return [{ action: 'lodge_and_pay', title: 'GST return', ymd, notes: ['No extension of time is available.'] }];
      },
    },
  },
  {
    countryCode: 'IN',
    authority: 'GSTN / Income Tax Department',
    effectiveFrom: '2024-04-01',
    nonBusinessDay: 'none',
    holidayNote: 'Pay by this date; the government sometimes extends it by notification.',
    indirect: {
      source: src('https://tutorial.gst.gov.in/userguide/returns/GSTR3B.htm'),
      dueFor(period, frequency, opts) {
        const { y, m } = parts(period.end);
        if (frequency === 'monthly') {
          return [{ action: 'lodge_and_pay', title: 'GSTR-3B', ymd: ymdOf(y, m + 1, 20), notes: [] }];
        }
        if (frequency !== 'quarterly') return null;
        // QRMP: tax for the first two months by PMT-06 on the 25th; the return
        // on the 22nd or 24th after the quarter, by state.
        const s = parts(period.start);
        const day = indiaQrmpReturnDay(opts.region);
        return [
          { action: 'pay', title: 'PMT-06 payment', ymd: ymdOf(s.y, s.m + 1, 25), notes: ['Tax for the first month of the quarter.'] },
          { action: 'pay', title: 'PMT-06 payment', ymd: ymdOf(s.y, s.m + 2, 25), notes: ['Tax for the second month of the quarter.'] },
          {
            action: 'lodge_and_pay',
            title: 'GSTR-3B',
            ymd: ymdOf(y, m + 1, day ?? 22),
            ...(day ? {} : { approximate: true }),
            notes: day ? [] : ['Due the 22nd or 24th depending on your state; set your state for the exact date.'],
          },
        ];
      },
    },
    incomeTax: {
      source: src('https://www.incometaxindia.gov.in/w/what-are-the-due-dates-for-payment-of-advance-tax-'),
      dueFor(year, opts) {
        const s = parts(year.start).y; // financial year 1 April – 31 March
        const march = { action: 'pay' as const, title: 'Advance tax', ymd: ymdOf(s + 1, 3, 15), cumulativeShare: 1, notes: [] as string[] };
        if (opts.presumptive) {
          return [{ ...march, notes: ['Presumptive income (s 44AD / 44ADA): the whole advance tax in one instalment.'] }];
        }
        return [
          { action: 'pay', title: 'Advance tax', ymd: ymdOf(s, 6, 15), cumulativeShare: 0.15, notes: [] },
          { action: 'pay', title: 'Advance tax', ymd: ymdOf(s, 9, 15), cumulativeShare: 0.45, notes: [] },
          { action: 'pay', title: 'Advance tax', ymd: ymdOf(s, 12, 15), cumulativeShare: 0.75, notes: [] },
          march,
        ];
      },
    },
  },
  {
    countryCode: 'US',
    authority: 'IRS',
    effectiveFrom: '2024-01-01',
    nonBusinessDay: 'next_business_day',
    holidayNote: 'If it falls on a weekend or legal holiday, the next business day is on time.',
    incomeTax: {
      source: src('https://www.irs.gov/publications/p505'),
      dueFor(year) {
        const y = parts(year.start).y; // calendar year
        const est = (ymd: string, covers: string) => ({ action: 'pay' as const, title: 'Estimated tax', ymd, notes: [`For income from ${covers}.`] });
        return [
          est(ymdOf(y, 4, 15), '1 January to 31 March'),
          est(ymdOf(y, 6, 15), '1 April to 31 May'),
          est(ymdOf(y, 9, 15), '1 June to 31 August'),
          est(ymdOf(y + 1, 1, 15), '1 September to 31 December'),
          { action: 'lodge_and_pay', title: 'Tax return and balance', ymd: ymdOf(y + 1, 4, 15), notes: [] },
        ];
      },
    },
  },
];

// ─── Resolution ─────────────────────────────────────────────────────────────

function rulesFor(countryCode: string, onOrBefore: string): CountryDueRules | null {
  const cc = String(countryCode || '').toUpperCase().split('-')[0];
  // Newest row whose window has started by the period's date. Before the first
  // row nothing is claimed: those years were not checked.
  return (
    RULES.filter((r) => r.countryCode === cc && r.effectiveFrom <= onOrBefore).sort((a, b) =>
      b.effectiveFrom.localeCompare(a.effectiveFrom),
    )[0] ?? null
  );
}

function finish(
  rules: CountryDueRules,
  obligation: DueObligation,
  source: DueDateRuleSource,
  rows: Omit<DueDate, CommonKeys>[],
): DueDate[] {
  return rows.map((r) => ({
    ...r,
    obligation,
    adjustedYmd: adjust(r.ymd, rules.nonBusinessDay),
    nonBusinessDay: rules.nonBusinessDay,
    holidayNote: rules.holidayNote,
    sourceUrl: source.sourceUrl,
    readOn: source.readOn,
    verified: source.verified,
  }));
}

/**
 * When the GST/VAT activity statement for `period` is due (lodge and pay, or
 * each separately where the authority splits them). Null when the country or
 * frequency is not covered.
 */
export function indirectReturnDueDates(
  countryCode: string,
  period: Period,
  frequency: DueFrequency,
  opts: IndirectDueOptions = {},
): DueDate[] | null {
  const rules = rulesFor(countryCode, period.end);
  if (!rules?.indirect) return null;
  const rows = rules.indirect.dueFor(period, frequency, opts);
  return rows ? finish(rules, 'indirect_return', rules.indirect.source, rows) : null;
}

/**
 * When income tax for the self-employed is paid (instalments, the balance)
 * and the return lodged, for the tax year `taxYear`. Null when not covered.
 */
export function incomeTaxDueDates(
  countryCode: string,
  taxYear: Period,
  opts: IncomeTaxDueOptions = {},
): DueDate[] | null {
  const rules = rulesFor(countryCode, taxYear.start);
  if (!rules?.incomeTax) return null;
  return finish(rules, 'income_tax', rules.incomeTax.source, rules.incomeTax.dueFor(taxYear, opts));
}

/** Which countries have which due dates, for a coverage table or a picker. */
export function dueDateCoverage(): Array<{ countryCode: string; authority: string; indirect: boolean; incomeTax: boolean }> {
  const latest = new Map<string, CountryDueRules>();
  for (const r of RULES) {
    const seen = latest.get(r.countryCode);
    if (!seen || r.effectiveFrom > seen.effectiveFrom) latest.set(r.countryCode, r);
  }
  return [...latest.values()].map((r) => ({
    countryCode: r.countryCode,
    authority: r.authority,
    indirect: Boolean(r.indirect),
    incomeTax: Boolean(r.incomeTax),
  }));
}

/** Every rule source, newest row per country and obligation — what the rate watch checks. */
export function dueDateRuleSources(): Array<{ countryCode: string; obligation: DueObligation; effectiveFrom: string } & DueDateRuleSource> {
  const out: Array<{ countryCode: string; obligation: DueObligation; effectiveFrom: string } & DueDateRuleSource> = [];
  for (const r of RULES) {
    if (r.indirect) out.push({ countryCode: r.countryCode, obligation: 'indirect_return', effectiveFrom: r.effectiveFrom, ...r.indirect.source });
    if (r.incomeTax) out.push({ countryCode: r.countryCode, obligation: 'income_tax', effectiveFrom: r.effectiveFrom, ...r.incomeTax.source });
  }
  return out;
}

/**
 * Due-date rules the rate watch should flag: past their review-by date, or not
 * verified. Same shape as the home and organisation rule watches, so the
 * weekly report lists them the same way.
 */
export function dueDateRulesPastReview(
  asOf?: string | Date,
): Array<{ country: string; label: string; reviewBy: string; sourceUrl: string; file: string; verified: boolean }> {
  const today = toYmd(asOf ?? new Date());
  return dueDateRuleSources()
    .filter((s) => s.reviewBy < today || !s.verified)
    .map((s) => ({
      country: s.countryCode,
      label: s.obligation === 'indirect_return' ? 'GST/VAT return due dates' : 'Income tax payment due dates',
      reviewBy: s.reviewBy,
      sourceUrl: s.sourceUrl,
      file: 'src/data/dueDates.ts',
      verified: s.verified,
    }));
}

/**
 * The date the money is due, from a set of due dates for one period: the last
 * row that pays (`pay` or `lodge_and_pay`). Where the authority splits paying
 * from filing (Canada's annual filer pays 30 April and files 15 June) it is
 * the payment date; where several payments fall in a period (India's QRMP)
 * it is the final one. Null when there is nothing to pay.
 */
export function paymentDueDate(rows: DueDate[] | null | undefined): DueDate | null {
  const paying = (rows ?? []).filter((r) => r.action !== 'lodge');
  return paying.length ? [...paying].sort((a, b) => a.ymd.localeCompare(b.ymd))[paying.length - 1] : null;
}
