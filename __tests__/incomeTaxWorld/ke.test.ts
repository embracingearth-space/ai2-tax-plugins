/**
 * Kenya — annual PAYE bands, personal relief, deductible SHIF/AHL/NSSF. embracingearth.space
 */
import { calcIncomeTax } from '../../src';

const r = (g: number, y: string) => calcIncomeTax('KE', g, y)!;
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(1);

describe('Kenya 2025 — taxable = gross × (1 − 2.75% SHIF − 1.5% AHL)', () => {
  const g = (taxable: number) => taxable / 0.9575;
  it('band edges', () => {
    near(r(g(288000), '2025').incomeTax, 28800); // 288,000 × 10%
    near(r(g(388000), '2025').incomeTax, 53800); // + 100,000 × 25%
    near(r(g(6000000), '2025').incomeTax, 1737400); // + 5,612,000 × 30%
    near(r(g(9600000), '2025').incomeTax, 2907400); // + 3,600,000 × 32.5%
    near(r(g(9700000), '2025').incomeTax, 2942400); // + 100,000 × 35%
  });
  it('personal relief of KES 28,800 wipes out tax up to taxable 288,000', () => {
    near(r(g(288000), '2025').totalTax, 0);
    near(r(g(388000), '2025').totalTax, 25000);
    expect(r(g(388000), '2025').verified).toBe(true);
  });
  it('SHIF has a KES 3,600 annual minimum', () => {
    expect(r(100000, '2025').taxable).toBe(100000 - 3600 - 1500);
  });
});

describe('Kenya 2026 — NSSF (6% to KES 108,000/month) also deducted', () => {
  it('caps NSSF at 77,760 a year', () => {
    // 2,000,000 − 55,000 SHIF − 30,000 AHL − 77,760 NSSF
    expect(r(2000000, '2026').taxable).toBe(1837240);
    // 600,000 − 16,500 − 9,000 − 36,000
    expect(r(600000, '2026').taxable).toBe(538500);
  });
  it('band edges', () => {
    const g = (taxable: number) => (taxable + 77760) / 0.9575;
    near(r(g(6000000), '2026').incomeTax, 1737400);
    near(r(g(9600000), '2026').incomeTax, 2907400);
    expect(r(g(6000000), '2026').verified).toBe(true);
  });
});
