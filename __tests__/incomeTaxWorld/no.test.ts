/**
 * Norway — trinnskatt + 22% on general income. Own arithmetic from the
 * Stortingets skattevedtak (no official example in the research). embracingearth.space
 */
import { calcIncomeTax } from '../../src';

const general = (r: ReturnType<typeof calcIncomeTax>) => r!.levies.find((l) => l.name.startsWith('Tax on general income'))?.amount ?? 0;

describe('Norway 2026', () => {
  it('trinnskatt step edges', () => {
    expect(calcIncomeTax('NO', 226100, '2026')!.incomeTax).toBe(0);
    expect(calcIncomeTax('NO', 226200, '2026')!.incomeTax).toBe(2); // 100 × 1.7%
    // 92,200 × 1.7% 1,567.40 + 406,750 × 4% 16,270 = 17,837.40
    expect(calcIncomeTax('NO', 725050, '2026')!.incomeTax).toBe(17837);
    expect(calcIncomeTax('NO', 726050, '2026')!.incomeTax).toBe(17974); // + 1,000 × 13.7%
    // + 255,050×13.7% 34,941.85 + 487,100×16.8% 81,832.80 + 532,800×17.8% 94,838.40 = 229,450.45
    expect(calcIncomeTax('NO', 2000000, '2026')!.incomeTax).toBe(229450);
  });
  it('22% on wages − minstefradrag − personfradrag', () => {
    // 500,000 − 95,700 (cap) − 114,540 = 289,760 × 22% = 63,747.20
    expect(general(calcIncomeTax('NO', 500000, '2026'))).toBe(63747);
    // 200,000: minstefradrag 92,000 (46%) + 114,540 exceeds the income → 0
    expect(general(calcIncomeTax('NO', 200000, '2026'))).toBe(0);
    expect(calcIncomeTax('NO', 500000, '2026')!.verified).toBe(true);
  });
});

describe('Norway 2025', () => {
  it('500,000', () => {
    const r = calcIncomeTax('NO', 500000, '2025')!;
    // 88,650 × 1.7% 1,507.05 + 193,950 × 4% 7,758 = 9,265.05
    expect(r.incomeTax).toBe(9265);
    // 500,000 − 92,000 − 108,550 = 299,450 × 22% = 65,879
    expect(general(r)).toBe(65879);
    expect(r.assumptions!.join(' ')).toMatch(/Trygdeavgift/);
  });
});
