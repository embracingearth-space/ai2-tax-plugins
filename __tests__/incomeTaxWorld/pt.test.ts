/**
 * Portugal — IRS categoria A, mainland. embracingearth.space
 * Expectations derived from the official art. 68.º table — not official examples.
 */
import { calcIncomeTax } from '../../src';

const solid = (r: ReturnType<typeof calcIncomeTax>) => r!.levies.find((l) => l.name.startsWith('Taxa adicional'))?.amount ?? 0;

describe('Portugal (derived from the official formula — not an official example)', () => {
  it('2026 €30,000: dedução específica 4,587.09 (more than 11% SS) → 25,412.91', () => {
    const r = calcIncomeTax('PT', 30000, '2026')!;
    expect(r.taxable).toBeCloseTo(25412.91, 2);
    // 1,042.75 + 666.465 + 1,113.212 + 1,265.491 + 2,323.91 × 31.1% (722.736) = 4,810.65
    expect(r.incomeTax).toBe(4811);
    expect(r.verified).toBe(true);
  });

  it('2026 €50,000: 11% SS (5,500) exceeds 8.54 × IAS → 44,500', () => {
    const r = calcIncomeTax('PT', 50000, '2026')!;
    expect(r.taxable).toBe(44500);
    // to 43,090: 10,828.563; + 1,410 × 43.1% = 607.71 → 11,436.27
    expect(r.incomeTax).toBe(11436);
    expect(solid(r)).toBe(0);
  });

  it('solidarity surcharge 2.5% above 80,000 taxable', () => {
    const r = calcIncomeTax('PT', 100000, '2026')!;
    // 89,000: to 46,566 = 12,326.719; + 40,068 × 44.6% + 2,366 × 48% = 31,332.73
    expect(r.incomeTax).toBe(31333);
    // 9,000 × 2.5%
    expect(solid(r)).toBe(225);
  });

  it('2025 uses the Lei 55-A/2025 table and dedução 4,462.15', () => {
    const r = calcIncomeTax('PT', 30000, '2025')!;
    // 25,537.85: 8,059 × 12.5% + 4,101 × 16% + 5,073 × 21.5% + 5,073 × 24.4% + 3,231.85 × 31.4%
    // = 1,007.375 + 656.16 + 1,090.695 + 1,237.812 + 1,014.801 = 5,006.84
    expect(r.taxable).toBeCloseTo(25537.85, 2);
    expect(r.incomeTax).toBe(5007);
  });

  it('says the mínimo de existência and social contributions are not included', () => {
    const a = calcIncomeTax('PT', 30000, '2026')!.assumptions!.join(' ');
    expect(a).toMatch(/mínimo de existência/);
    expect(a).toMatch(/social-security contribution/);
  });
});
