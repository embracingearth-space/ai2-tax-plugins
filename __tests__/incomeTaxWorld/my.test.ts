/**
 * Malaysia — bracket arithmetic from the LHDN resident rate table. embracingearth.space
 * From RM50,000 of pay the reliefs are all capped: chargeable = gross − 9,000 − 4,000 − 350.
 */
import { calcIncomeTax } from '../../src';

const r = (g: number, y: string) => calcIncomeTax('MY', g, y)!;

describe.each(['2026', '2025'])('Malaysia %s — band edges (chargeable = gross − 13,350)', (y) => {
  it.each([
    [63350, 1500], // 15,000 × 1% + 15,000 × 3% + 15,000 × 6% = 150 + 450 + 900
    [83350, 3700], // + 20,000 × 11%
    [113350, 9400], // + 30,000 × 19%
    [413350, 84400], // + 300,000 × 25%
    [613350, 136400], // + 200,000 × 26%
    [2013350, 528400], // + 1,400,000 × 28%
    [2013450, 528430], // + 100 × 30%
  ])('gross %d → tax %d', (g, t) => {
    expect(r(g, y).incomeTax).toBe(t);
    expect(r(g, y).verified).toBe(true);
  });

  it('caps EPF relief at RM4,000 and SOCSO/EIS relief at RM350', () => {
    // 30,000: EPF 3,300, SOCSO/EIS 210 → 30,000 − 9,000 − 3,300 − 210
    expect(r(30000, y).taxable).toBe(17490);
    expect(r(100000, y).taxable).toBe(86650);
  });

  it('gives the RM400 rebate only while chargeable income ≤ RM35,000', () => {
    // 45,000: chargeable 45,000 − 9,000 − 4,000 − 315 = 31,685; tax 150 + 11,685 × 3% = 500.55
    const low = r(45000, y);
    expect(low.taxable).toBe(31685);
    expect(low.offsets.reduce((s, o) => s + o.amount, 0)).toBe(400);
    expect(low.totalTax).toBe(101);
    // 60,000: chargeable 46,650 → no rebate
    expect(r(60000, y).offsets).toEqual([]);
  });
});
