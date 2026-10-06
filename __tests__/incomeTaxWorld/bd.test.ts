/**
 * Bangladesh — individual income tax slabs. embracingearth.space
 */
import { calcIncomeTax } from '../../src';

describe('Bangladesh — slab edges (Finance Act 2026)', () => {
  it.each(['2026-27', '2025-26'])('%s', (year) => {
    const tax = (g: number) => calcIncomeTax('BD', g, year)!.incomeTax;
    expect(tax(400000)).toBe(0);
    expect(tax(401000)).toBe(100); // 1,000 × 10%
    expect(tax(700000)).toBe(30000); // 300,000 × 10%
    expect(tax(1100000)).toBe(90000); // + 400,000 × 15%
    expect(tax(1600000)).toBe(190000); // + 500,000 × 20%
    expect(tax(3600000)).toBe(690000); // + 2,000,000 × 25%
    expect(tax(3601000)).toBe(690300); // + 1,000 × 30%
    expect(calcIncomeTax('BD', 1000000, year)!.verified).toBe(true);
  });

  it('says the salary exemption is not applied', () => {
    expect(calcIncomeTax('BD', 1000000, '2026-27')!.assumptions!.join(' ')).toMatch(/exempt portion of salary/);
  });
});
