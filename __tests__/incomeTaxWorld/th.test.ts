/**
 * Thailand — bracket arithmetic from the rd.go.th rate table. embracingearth.space
 * Above THB 200,000 of pay, net income = pay − 100,000 expense deduction − 60,000 allowance.
 */
import { calcIncomeTax } from '../../src';

const tax = (g: number, y: string) => calcIncomeTax('TH', g, y)!.incomeTax;

describe.each(['2026', '2025'])('Thailand %s — band edges (net = gross − 160,000)', (y) => {
  it.each([
    [310000, 0], // net 150,000: exempt band
    [310100, 5], // 100 × 5%
    [460000, 7500], // 150,000 × 5%
    [460100, 7510],
    [660000, 27500], // + 200,000 × 10%
    [910000, 65000], // + 250,000 × 15%
    [1160000, 115000], // + 250,000 × 20%
    [2160000, 365000], // + 1,000,000 × 25%
    [5160000, 1265000], // + 3,000,000 × 30%
    [5160100, 1265035], // + 100 × 35%
  ])('gross %d → tax %d', (g, t) => {
    expect(tax(g, y)).toBe(t);
    expect(calcIncomeTax('TH', g, y)!.verified).toBe(true);
  });

  it('expense deduction is 50% up to THB 100,000', () => {
    expect(calcIncomeTax('TH', 150000, y)!.taxable).toBe(150000 - 75000 - 60000);
    expect(calcIncomeTax('TH', 200000, y)!.taxable).toBe(40000);
    expect(calcIncomeTax('TH', 300000, y)!.taxable).toBe(140000);
  });

  it('says social security is not included', () => {
    expect(calcIncomeTax('TH', 500000, y)!.assumptions!.join(' ')).toMatch(/Social Security/);
  });
});
