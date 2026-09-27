/**
 * Calendar-day arithmetic for the decision helpers — ai2fin.com
 *
 * Every date here is a calendar day, 'YYYY-MM-DD', handled in UTC so the
 * answer never depends on the host's time zone. Day counts are INCLUSIVE of
 * both ends, because that is how the ATO counts them in its own worked
 * examples: "1 November 2018 to 1 August 2022, a total of 1,370 days" and
 * "30 September 2005 to 29 September 2024 = 6,940 days" are both the
 * difference plus one.
 */

const DAY_MS = 86_400_000;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse 'YYYY-MM-DD' strictly (no rollover: '2026-02-30' throws). */
export function parseYmd(ymd: string, field = 'date'): number {
  const m = YMD.exec(String(ymd ?? '').trim());
  if (!m) throw new RangeError(`${field}: expected a calendar day 'YYYY-MM-DD', got "${ymd}"`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
    throw new RangeError(`${field}: "${ymd}" is not a real calendar day`);
  }
  return t;
}

export function formatYmd(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** Days from `from` to `to`, counting both ends. 0 when `to` is before `from`. */
export function daysInclusive(from: string, to: string): number {
  const n = Math.round((parseYmd(to) - parseYmd(from)) / DAY_MS) + 1;
  return Math.max(0, n);
}

export function addDays(ymd: string, days: number): string {
  return formatYmd(parseYmd(ymd) + days * DAY_MS);
}

/** Same day-of-month `months` later, clamped to the month's last day (31 Aug + 6 months = 28/29 Feb). */
export function addMonths(ymd: string, months: number): string {
  const t = new Date(parseYmd(ymd));
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth() + months;
  const d = t.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return formatYmd(Date.UTC(y, m, Math.min(d, last)));
}

export const minYmd = (a: string, b: string) => (a <= b ? a : b);
export const maxYmd = (a: string, b: string) => (a >= b ? a : b);

/** Inclusive overlap of [a1, a2] and [b1, b2], in days (0 if they do not meet). */
export function overlapDays(a1: string, a2: string, b1: string, b2: string): number {
  const start = maxYmd(a1, b1);
  const end = minYmd(a2, b2);
  return end < start ? 0 : daysInclusive(start, end);
}

/**
 * The ATO's 12-month test for the CGT discount: "You exclude the day of
 * acquisition and the day of the CGT event when working out if you owned the
 * CGT asset for at least 12 months." So acquired 1 July 2026, a contract on
 * 2 July 2027 qualifies and one on 1 July 2027 does not.
 */
export function heldAtLeast12Months(acquired: string, cgtEvent: string): boolean {
  return cgtEvent >= addDays(addMonths(acquired, 12), 1);
}

/** 'YYYY-YY' → the next income year's label. Validates the label. */
export function nextIncomeYearLabel(label: string): string {
  const start = incomeYearStart(label);
  return `${start + 1}-${String((start + 2) % 100).padStart(2, '0')}`;
}

/** The first calendar year of an Australian-style income-year label ('2025-26' → 2025). */
export function incomeYearStart(label: string): number {
  const m = /^(\d{4})[-–](\d{2})$/.exec(String(label ?? '').trim());
  if (!m || Number(m[2]) !== (Number(m[1]) + 1) % 100) {
    throw new RangeError(`incomeYear: expected a label like "2025-26", got "${label}"`);
  }
  return Number(m[1]);
}
