/**
 * Colombia — art. 241 ET table in UVT, INCR contributions, 25% labour exemption.
 * No official DIAN worked example captured. Unverified: the ET text is served over http only.
 * embracingearth.space
 */
import { calcIncomeTax } from '../../src';

describe('Colombia 2026 (UVT 52,374; SMMLV 1,750,905)', () => {
  it('COP 60,000,000: INCR 8% (4.8M) − 25% exemption (13.8M) → 41,400,000 < 1,090 UVT → no tax', () => {
    const r = calcIncomeTax('CO', 60000000, '2026')!;
    expect(r.taxable).toBe(41400000);
    expect(r.totalTax).toBe(0);
  });

  it('COP 100,000,000: monthly 8.33M ≥ 4 SMMLV → FSP 1%; INCR 9M, exemption 22.75M → 68,250,000', () => {
    // 68,250,000 / 52,374 = 1,303.13 UVT; (1,303.13 − 1,090) × 19% = 40.495 UVT × 52,374 = 2,120,844.60
    const r = calcIncomeTax('CO', 100000000, '2026')!;
    expect(r.taxable).toBe(68250000);
    expect(r.incomeTax).toBe(2120845);
    expect(r.verified).toBe(false);
  });

  it('COP 200,000,000: exemption capped at 790 UVT (41,375,000) → 140,625,000 in the 28% row (+116 UVT)', () => {
    // 140,625,000 / 52,374 = 2,684.97 UVT; 116 + (2,684.97 − 1,700) × 28% = 391.79 UVT × 52,374 = 20,520,360
    const r = calcIncomeTax('CO', 200000000, '2026')!;
    expect(r.taxable).toBe(140625000);
    expect(r.incomeTax).toBe(20520360);
  });

  it('COP 1,000,000,000: contributions capped at 25 SMMLV with FSP 2% → INCR 52,527,150; 39% row (+10,352 UVT)', () => {
    // taxable 1,000,000,000 − 52,527,150 − 41,375,000 = 906,097,850 = 17,300.83 UVT → 35% row:
    // 2,296 + (17,300.83 − 8,670) × 35% = 5,316.79 UVT × 52,374 = 278,456,048.50
    const r = calcIncomeTax('CO', 1000000000, '2026')!;
    expect(r.taxable).toBe(906097850);
    expect(r.incomeTax).toBe(278456049);
  });
});

describe('Colombia 2025 (UVT 49,799; SMMLV 1,423,500)', () => {
  it('COP 100,000,000 → 68,250,000 = 1,370.51 UVT → 280.51 × 19% = 53.30 UVT × 49,799 = 2,654,127.10', () => {
    expect(calcIncomeTax('CO', 100000000, '2025')!.incomeTax).toBe(2654127);
  });

  it('COP 200,000,000 → exemption cap 39,341,000 → 142,659,000 → 22,016,880', () => {
    // 142,659,000 / 49,799 = 2,864.70 UVT; 116 + 1,164.70 × 28% = 442.12 UVT × 49,799 = 22,016,880
    expect(calcIncomeTax('CO', 200000000, '2025')!.incomeTax).toBe(22016880);
  });
});
