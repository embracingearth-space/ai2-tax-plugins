/**
 * Argentina — ARCA annual art. 94 scale + art. 30 deductions. No official worked example.
 * embracingearth.space
 */
import { calcIncomeTax } from '../../src';

// 2026: 6,019,671.36 + 28,894,422.56 = 34,914,093.92; + one twelfth (2,909,507.83) = 37,823,601.75
const D26 = 6019671.36 + 28894422.56 + (6019671.36 + 28894422.56) / 12;
// 2025: 4,507,505.52 + 21,636,026.50 = 26,143,532.02; + one twelfth = 28,322,159.69
const D25 = 4507505.52 + 21636026.5 + (4507505.52 + 21636026.5) / 12;

describe('Argentina 2026', () => {
  it('no tax up to the personal deductions', () => {
    const r = calcIncomeTax('AR', 37823601, '2026')!;
    expect(r.totalTax).toBe(0);
  });

  it('band edges: 5% band 2,336,953.69 × 5% = 116,847.68; top of 15% band = 1,133,422.54', () => {
    expect(calcIncomeTax('AR', D26 + 2336953.69, '2026')!.incomeTax).toBe(116848);
    // 116,847.68 + 2,336,953.67 × 9% (210,325.83) + 2,336,953.69 × 12% (280,434.44) + 3,505,430.54 × 15% (525,814.58)
    expect(calcIncomeTax('AR', D26 + 10516291.59, '2026')!.incomeTax).toBe(1133423);
    // 1,000 above at 19% → + 190
    expect(calcIncomeTax('AR', D26 + 10516291.59 + 1000, '2026')!.incomeTax).toBe(1133613);
  });

  it('top rate 35%; verified', () => {
    const r = calcIncomeTax('AR', 150000000, '2026')!;
    expect(r.marginalRate).toBeCloseTo(0.35, 6);
    expect(r.verified).toBe(true);
  });

  it('says contributions are not deducted', () => {
    expect(calcIncomeTax('AR', 60000000, '2026')!.assumptions!.join(' ')).toMatch(/NOT deducted/);
  });
});

describe('Argentina 2025', () => {
  it('first band 1,749,901.45 × 5% = 87,495.07', () => {
    expect(calcIncomeTax('AR', D25 + 1749901.45, '2025')!.incomeTax).toBe(87495);
  });
});
