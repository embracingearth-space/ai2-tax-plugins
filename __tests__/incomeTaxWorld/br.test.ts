/**
 * Brazil — annual adjustment table, simplified discount / INSS, Lei 15.270 reduction (2026).
 * RFB's published examples are MONTHLY withholding examples, so none is used here.
 * embracingearth.space
 */
import { calcIncomeTax } from '../../src';

const credit = (r: ReturnType<typeof calcIncomeTax>) => r!.offsets.reduce((s, o) => s + o.amount, 0);

describe('Brazil 2026', () => {
  it('BRL 36,000: simplified discount 7,200 → base 28,800, inside the zero band', () => {
    const r = calcIncomeTax('BR', 36000, '2026')!;
    expect(r.taxable).toBe(28800);
    expect(r.totalTax).toBe(0);
  });

  it('BRL 60,000: table tax 2,694.15 fully removed by the reduction', () => {
    // base 48,000: 4,774.20 × 7.5% (358.07) + 11,092.80 × 15% (1,663.92) + 2,987.40 × 22.5% (672.17) = 2,694.15
    const r = calcIncomeTax('BR', 60000, '2026')!;
    expect(r.incomeTax).toBe(2694);
    expect(r.totalTax).toBe(0);
  });

  it('BRL 72,000: reduction 8,429.73 − 0.095575 × 72,000 = 1,548.33 (phase-out on gross, not on the base)', () => {
    // base 57,600: 358.07 + 1,663.92 + 10,963.56 × 22.5% (2,466.80) + 1,623.84 × 27.5% (446.56) = 4,935.34
    const r = calcIncomeTax('BR', 72000, '2026')!;
    expect(r.incomeTax).toBe(4935);
    expect(credit(r)).toBe(1548);
    expect(r.totalTax).toBe(3387);
  });

  it('above BRL 88,200: no reduction; simplified discount capped at 17,640 (exceeds INSS at the teto)', () => {
    // base 102,360: 358.07 + 1,663.92 + 2,466.80 + 46,383.84 × 27.5% (12,755.56) = 17,244.34
    const r = calcIncomeTax('BR', 120000, '2026')!;
    expect(r.taxable).toBe(102360);
    expect(credit(r)).toBe(0);
    expect(r.incomeTax).toBe(17244);
    expect(r.verified).toBe(true);
  });
});

describe('Brazil 2025', () => {
  it('zero band 28,467.20; simplified discount cap 16,754.34; no reduction', () => {
    // 36,000 → base 28,800: 332.80 × 7.5% = 24.96
    expect(calcIncomeTax('BR', 36000, '2025')!.incomeTax).toBe(25);
    // 100,000 → base 83,245.66: 408.93 + 1,663.92 + 2,466.80 + 27,269.50 × 27.5% (7,499.11) = 12,038.78
    const r = calcIncomeTax('BR', 100000, '2025')!;
    expect(r.taxable).toBeCloseTo(83245.66, 2);
    expect(r.incomeTax).toBe(12039);
    expect(credit(r)).toBe(0);
    expect(r.assumptions!.join(' ')).toMatch(/INSS/);
  });
});
