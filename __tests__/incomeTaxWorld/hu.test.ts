/**
 * Hungary — NAV: flat 15% SZJA on gross wages. embracingearth.space
 */
import { calcIncomeTax } from '../../src';

describe('Hungary', () => {
  it.each(['2026', '2025'])('%s: 15% of gross, verified', (y) => {
    const r = calcIncomeTax('HU', 10_000_000, y)!;
    expect(r.taxable).toBe(10_000_000);
    expect(r.totalTax).toBe(1_500_000);
    expect(r.verified).toBe(true);
  });

  it('says the 18.5% contribution is not included', () => {
    expect(calcIncomeTax('HU', 5_000_000, '2026')!.assumptions!.join(' ')).toMatch(/18\.5%/);
  });
});
