/**
 * Input guards for the home and property decisions — ai2fin.com
 *
 * The decision functions are shared maths: the app's "Weigh it up", the
 * website's calculators and the Tax MCP all call them, and at least one of
 * those passes free-form user input straight through. A user typed 1,000,000
 * work hours into a website tool and was shown "$700,000 running costs a
 * year". So the functions refuse impossible inputs themselves, before any
 * arithmetic, instead of trusting every caller to have checked.
 *
 * HOW A REFUSAL IS REPORTED. The functions THROW a `DecisionInputError` — a
 * `RangeError` subclass carrying every problem found, not just the first:
 * `{ field, message }[]`. A throw, not an `{ invalid: true }` result, because
 * the existing result union is `Result | UnsupportedCountry` and every caller
 * already reads `supported: true` as "numbers follow"; a third variant with
 * `supported: true` and no numbers would be misread by a caller that has not
 * been updated (the app's adapter maps any `supported: true` result straight
 * into its UI), whereas a throw is already handled everywhere — the adapter
 * catches it and falls back, and a caller that does not catch fails loudly
 * rather than printing a wrong figure. Being a RangeError subclass, every
 * existing `toThrow(RangeError)` / `instanceof RangeError` check still holds.
 *
 * A UI that wants to show the problems before calling can run the matching
 * `validate…` function, which returns the same list without throwing.
 */

export interface DecisionInputProblem {
  /** The input field, e.g. 'workHoursPerYear' or 'homes[0].expectedGrowth'. */
  field: string;
  message: string;
}

export class DecisionInputError extends RangeError {
  readonly problems: DecisionInputProblem[];
  constructor(problems: DecisionInputProblem[]) {
    super(problems.map((p) => `${p.field}: ${p.message}`).join('; '));
    this.name = 'DecisionInputError';
    this.problems = problems;
    Object.setPrototypeOf(this, DecisionInputError.prototype);
  }
}

/** Hours in a 365-day year: nobody works more hours from home than there are in the year. */
export const MAX_HOURS_PER_YEAR = 8760;
/** Weeks in a year for letting: 52. */
export const MAX_WEEKS_PER_YEAR = 52;

const YMD = /^\d{4}-\d{2}-\d{2}$/;
/** 8760 → '8,760' — grouped by hand so messages do not depend on the host's ICU build. */
const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Collects problems; each check records one and returns whether the value was usable. */
export class Problems {
  readonly list: DecisionInputProblem[] = [];

  add(field: string, message: string): false {
    this.list.push({ field, message });
    return false;
  }

  /** A finite number, optionally within [min, max]. */
  number(value: unknown, field: string, { min, max, integer = false, what = 'a number' }: { min?: number; max?: number; integer?: boolean; what?: string } = {}): boolean {
    const v = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
    if (!Number.isFinite(v)) return this.add(field, `expected ${what}, got ${JSON.stringify(value)}`);
    if (integer && !Number.isInteger(v)) return this.add(field, `expected a whole number, got ${v}`);
    if (min !== undefined && v < min) return this.add(field, `must be at least ${fmt(min)}, got ${fmt(v)}`);
    if (max !== undefined && v > max) return this.add(field, `must be at most ${fmt(max)}, got ${fmt(v)}`);
    return true;
  }

  percent(value: unknown, field: string): boolean {
    return this.number(value, field, { min: 0, max: 100, what: 'a percentage from 0 to 100' });
  }

  /** Money that cannot be negative: a cost, a rent, a value, a growth figure. */
  amount(value: unknown, field: string): boolean {
    return this.number(value, field, { min: 0, what: 'an amount of zero or more' });
  }

  years(value: unknown, field: string): boolean {
    return this.number(value, field, { min: 1, max: 50, integer: true, what: 'a whole number of years from 1 to 50' });
  }

  /** A real calendar day, 'YYYY-MM-DD' (no rollover, no surrounding space). */
  date(value: unknown, field: string): value is string {
    if (typeof value !== 'string' || !YMD.test(value)) return this.add(field, `expected a date 'YYYY-MM-DD', got ${JSON.stringify(value)}`);
    const [y, m, d] = value.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return this.add(field, `"${value}" is not a real calendar day`);
    return true;
  }

  /** `later` must not be before `earlier` (both already valid dates). */
  order(earlier: string, later: string, earlierField: string, laterField: string): boolean {
    return later >= earlier || this.add(laterField, `must be on or after ${earlierField} (${earlier}), got ${later}`);
  }
}
