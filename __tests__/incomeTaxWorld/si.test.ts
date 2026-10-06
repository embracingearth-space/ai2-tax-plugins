/**
 * Slovenia — FURS Lestvica 2026 / 2025. embracingearth.space
 */
import { calcIncomeTax } from '../../src';

const run = (gross: number, year: string) => calcIncomeTax('SI', gross, year)!;
const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);

describe('Slovenia', () => {
  it('2026 gross 40,000: 40,000 × 76.9% = 30,760 − 5,551.93 = 25,208.07; 1,555.43 + 26% × 15,486.64 = 5,581.96', () => {
    const r = run(40000, '2026');
    near(r.taxable, 25208.07);
    near(r.totalTax, 5581.96);
    expect(r.verified).toBe(true);
  });

  it('2026 low-income allowance: gross 15,000 → 5,551.93 + (20,832.39 − 17,588.85) = 8,795.47; taxable 2,739.53; tax 438.32', () => {
    const r = run(15000, '2026');
    near(r.taxable, 2739.53);
    near(r.totalTax, 438.32);
  });

  it('2026 increase reaches zero at 17,766.18: taxable 17,766.18 × 0.769 − 5,551.93 = 8,110.26', () => {
    near(run(17766.18, '2026').taxable, 8110.26);
  });

  it('2026 top band: gross 120,000 → taxable 86,728.07; 1,555.43 + 4,906.46 + 9,435.51 + 9,812.93 + 50% × 4,381.84 = 27,901.25', () => {
    near(run(120000, '2026').totalTax, 27901.25);
  });

  it('2025 gross 40,000: 22.6% → 30,960 − 5,260 = 25,700; 1,473.64 + 26% × 16,489.74 = 5,760.97', () => {
    near(run(40000, '2025').totalTax, 5760.97);
  });
});
