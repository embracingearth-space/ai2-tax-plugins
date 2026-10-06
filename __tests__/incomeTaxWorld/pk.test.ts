/**
 * Pakistan — salaried income tax. embracingearth.space
 */
import { calcIncomeTax } from '../../src';

const surcharge = (r: ReturnType<typeof calcIncomeTax>) => r!.levies.reduce((s, l) => s + l.amount, 0);

describe('Pakistan — band edges match the Finance Act fixed amounts', () => {
  it.each([
    ['2026-27', 600000, 0],
    ['2026-27', 1200000, 6000],
    ['2026-27', 2200000, 116000],
    ['2026-27', 3200000, 316000],
    ['2026-27', 4100000, 541000],
    ['2026-27', 5600000, 976000],
    ['2026-27', 7000000, 1424000],
    ['2026-27', 7000100, 1424035], // + 100 × 35%
    ['2025-26', 3200000, 346000],
    ['2025-26', 4100000, 616000],
    ['2025-26', 4100100, 616035],
  ])('%s: PKR %d → PKR %d', (year, gross, tax) => {
    const r = calcIncomeTax('PK', gross, year)!;
    expect(r.incomeTax).toBe(tax);
    expect(r.verified).toBe(true);
  });

  it('2025-26: 9% surcharge only above PKR 10,000,000 of taxable income', () => {
    // 616,000 + 5,900,000 × 35% = 2,681,000; at 10,000,100 the tax is 2,681,035 and the surcharge 9% = 241,293.15.
    expect(surcharge(calcIncomeTax('PK', 10000000, '2025-26'))).toBe(0);
    expect(surcharge(calcIncomeTax('PK', 10000100, '2025-26'))).toBe(241293);
  });

  it('2026-27: no surcharge for salaried individuals', () => {
    expect(surcharge(calcIncomeTax('PK', 20000000, '2026-27'))).toBe(0);
  });
});
