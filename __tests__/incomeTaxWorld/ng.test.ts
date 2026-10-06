/**
 * Nigeria — NTA 2025 (2026) and PITA (2025) arithmetic. embracingearth.space
 */
import { calcIncomeTax } from '../../src';

const r = (g: number, y: string) => calcIncomeTax('NG', g, y)!;

describe('Nigeria 2026 — Nigeria Tax Act Fourth Schedule, taxable = gross − 2.5% NHF', () => {
  it.each([
    [800000, 0], // taxable 780,000 inside the 0% band
    [840000, 2850], // taxable 819,000: 19,000 × 15%
    [3200000, 351600], // taxable 3,120,000: 2,200,000 × 15% + 120,000 × 18%
    [12400000, 1968900], // taxable 12,090,000: 330,000 + 1,620,000 + 90,000 × 21%
    [26000000, 4760500], // taxable 25,350,000: + 2,730,000 + 350,000 × 23%
    [52000000, 10605000], // taxable 50,700,000: + 5,750,000 + 700,000 × 25%
  ])('gross %d → tax %d', (g, t) => {
    expect(r(g, '2026').incomeTax).toBe(t);
    expect(r(g, '2026').verified).toBe(true);
  });
});

describe('Nigeria 2025 — PITA with CRA and minimum tax', () => {
  it('CRA of N200,000 + 20% of gross', () => {
    // 1,000,000 − 25,000 NHF − 400,000 CRA = 575,000; 300,000 × 7% + 275,000 × 11%
    expect(r(1000000, '2025').taxable).toBe(575000);
    expect(r(1000000, '2025').incomeTax).toBe(51250);
    // 5,000,000 − 125,000 − 1,200,000 = 3,675,000; 560,000 + 475,000 × 24%
    expect(r(5000000, '2025').incomeTax).toBe(674000);
  });
  it('CRA uses 1% of gross once that exceeds N200,000', () => {
    // 30,000,000 − 750,000 − (300,000 + 6,000,000) = 22,950,000; 560,000 + 19,750,000 × 24%
    expect(r(30000000, '2025').incomeTax).toBe(5300000);
  });
  it('tops up to the 1% minimum tax', () => {
    // 300,000 − 7,500 − 260,000 = 32,500 × 7% = 2,275; minimum 3,000
    const x = r(300000, '2025');
    expect(x.incomeTax).toBe(2275);
    expect(x.totalTax).toBe(3000);
  });
  it('says the pension contribution is not deducted', () => {
    expect(r(5000000, '2025').assumptions!.join(' ')).toMatch(/pension/);
  });
});
