/**
 * Shared income-tax arithmetic. @ai2/tax-plugins — embracingearth.space
 *
 * Kept in its own module so that the scheme factory (incomeTaxFactory.ts), the
 * sub-national tables and incomeTax.ts can all use ONE progressive-band
 * implementation without a runtime import cycle: incomeTax.ts builds
 * INCOME_TAX_SCHEMES from the country data modules, and those modules build
 * their hooks from this file.
 */

export interface Band {
  upTo: number | null;
  rate: number;
}

/** Tax on `income` under a progressive band table (`upTo` null = no upper limit). */
export function progressive(income: number, bands: readonly Band[]): number {
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

/**
 * A piecewise-linear schedule through `points` ([x, y] pairs, x ascending),
 * flat beyond both ends. This is the shape most phase-in / phase-out credits
 * are legislated in ("€5,685 less 6.51% of the excess over €45,592, nil from
 * €132,920"), written as the corner points the statute names rather than as
 * a hand-coded if-chain per country.
 *
 * A vertical step (two points with the same x) is allowed: below x the earlier
 * y applies, at and above x the later one.
 */
export function piecewiseLinear(x: number, points: readonly (readonly [number, number])[]): number {
  if (points.length === 0) return 0;
  const first = points[0]!;
  if (x <= first[0]) return first[1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x0, y0] = points[i - 1]!;
    if (x < x1) return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return points[points.length - 1]![1];
}

/** max(0, n) — written once so every "cannot go below nil" reads the same. */
export const nonNegative = (n: number): number => (n > 0 ? n : 0);
