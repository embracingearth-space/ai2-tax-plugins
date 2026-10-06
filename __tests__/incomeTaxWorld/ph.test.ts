/**
 * Philippines — bracket arithmetic from the RR 11-2018 annual table (its cumulative
 * column: 22,500 / 102,500 / 402,500 / 2,202,500). embracingearth.space
 * From PHP 420,000 of pay the SSS share is at its cap (1,750 × 12 = 21,000).
 */
import { calcIncomeTax } from '../../src';

const r = (g: number, y: string) => calcIncomeTax('PH', g, y)!;

describe.each(['2026', '2025'])('Philippines %s — band edges (taxable = gross − 21,000)', (y) => {
  it.each([
    // below PHP 420,000 the SSS share is 5% of pay: taxable = 0.95 × gross
    [263000, 0], // taxable 249,850
    [280000, 2400], // taxable 266,000: 16,000 × 15%
    [421000, 22500],
    [821000, 102500],
    [2021000, 402500],
    [8021000, 2202500],
    [8021100, 2202535], // + 100 × 35%
  ])('gross %d → tax %d', (g, t) => {
    expect(r(g, y).incomeTax).toBe(t);
    expect(r(g, y).verified).toBe(true);
  });

  it('SSS exclusion uses the MSC floor of PHP 5,000/month and cap of 35,000/month', () => {
    expect(r(48000, y).taxable).toBe(48000 - 3000); // 5% × 5,000 × 12
    expect(r(240000, y).taxable).toBe(240000 - 12000); // 5% × 20,000 × 12
    expect(r(1000000, y).taxable).toBe(979000);
  });
});
