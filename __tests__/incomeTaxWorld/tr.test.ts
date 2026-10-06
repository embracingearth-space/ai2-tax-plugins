/**
 * Türkiye — GIB Gelir Vergisi Tarifesi 2026 / 2025 (wage column); GVK md. 23/18.
 * No official worked example: the figures below are derived from the official
 * formula — not an official example. embracingearth.space
 */
import { calcIncomeTax } from '../../src';

const run = (gross: number, year: string) => calcIncomeTax('TR', gross, year)!;
const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);

describe('Türkiye', () => {
  it('2026 gross 600,000 (derived from the official formula): taxable 510,000; 100,200 − tax on 336,906 (57,881.20) = 42,318.80', () => {
    const r = run(600000, '2026');
    near(r.taxable, 510000);
    near(r.incomeTax, 100200);
    near(r.totalTax, 42318.8);
    expect(r.verified).toBe(true);
  });

  it('a minimum-wage earner (33,030 × 12 = 396,360) pays no income tax', () => {
    expect(run(396360, '2026').totalTax).toBe(0);
  });

  it('2026 premium ceiling: gross 5,000,000 → 535,086 premiums; taxable 4,464,914; 1,405,219.90 − 57,881.20 = 1,347,338.70', () => {
    const r = run(5000000, '2026');
    near(r.taxable, 4464914);
    near(r.totalTax, 1347338.7);
  });

  it('2026 band edges (190,000 / 400,000 / 1,500,000 / 5,300,000 taxable)', () => {
    const s = (t: number) =>
      t <= 190000 ? 0.15 * t
      : t <= 400000 ? 28500 + 0.2 * (t - 190000)
      : t <= 1500000 ? 70500 + 0.27 * (t - 400000)
      : t <= 5300000 ? 367500 + 0.35 * (t - 1500000)
      : 1697500 + 0.4 * (t - 5300000);
    for (const g of [470000, 472000, 1764000, 1766000, 6800000, 6900000]) {
      const r = run(g, '2026');
      near(r.incomeTax, s(r.taxable));
    }
  });

  it('2025 gross 600,000 (derived): 106,700 − tax on 265,256.10 (45,151.22) = 61,548.78', () => {
    near(run(600000, '2025').totalTax, 61548.78);
  });
});
