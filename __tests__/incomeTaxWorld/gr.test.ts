/**
 * Greece — minfin.gov.gr KFE art. 15 (2026 scale per Law 5246/2025) and art. 16.
 * embracingearth.space
 */
import { calcIncomeTax } from '../../src';

const run = (gross: number, year: string) => calcIncomeTax('GR', gross, year)!;
const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);

describe('Greece', () => {
  it('2026 gross 30,000: taxable 25,989; 900 + 2,000 + 26% × 5,989 = 4,457.14; reduction 777 − 20 × 13.989 = 497.22; net 3,959.92', () => {
    const r = run(30000, '2026');
    near(r.taxable, 25989);
    near(r.incomeTax, 4457.14);
    near(r.totalTax, 3959.92);
    expect(r.verified).toBe(true);
  });

  it('2025 gross 30,000: 900 + 2,200 + 28% × 5,989 = 4,776.92; net 4,279.70', () => {
    near(run(30000, '2025').totalTax, 4279.7);
  });

  it('2026 contribution ceiling and 44% band: gross 100,000 → 12,453.26 contributions; taxable 87,546.74; tax 28,820.56; no reduction', () => {
    const r = run(100000, '2026');
    near(r.taxable, 87546.74);
    near(r.totalTax, 28820.56);
  });

  it('reduction full up to 12,000 taxable and limited to the tax: gross 10,000 → 9% × 8,663 = 779.67 − 777 = 2.67', () => {
    near(run(10000, '2026').totalTax, 2.67);
  });

  it('2026 band edges at 40,000 and 60,000 taxable', () => {
    const s = (t: number) => (t <= 40000 ? 5500 + 0.34 * (t - 30000) : t <= 60000 ? 8900 + 0.39 * (t - 40000) : 16700 + 0.44 * (t - 60000));
    for (const g of [46000, 47000, 69000, 70000]) {
      const r = run(g, '2026');
      near(r.incomeTax, s(r.taxable));
    }
  });
});
