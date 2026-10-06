/**
 * Costa Rica — salary tax, 12 × the decree's monthly scale. No official worked example captured.
 * embracingearth.space
 */
import { calcIncomeTax } from '../../src';

describe('Costa Rica 2026 (Decreto 45333-H)', () => {
  it.each([
    // [gross, tax, arithmetic]
    [11016000, 0], // top of the 0% band
    [16164000, 514800], // 5,148,000 × 10%
    [16165000, 514950], // + 1,000 × 15%
    [28368000, 2345400], // 514,800 + 12,204,000 × 15% (1,830,600)
    [56724000, 8016600], // 2,345,400 + 28,356,000 × 20% (5,671,200)
    [60000000, 8835600], // 8,016,600 + 3,276,000 × 25% (819,000)
  ])('CRC %d → %d', (gross, tax) => {
    const r = calcIncomeTax('CR', gross, '2026')!;
    expect(r.incomeTax).toBe(tax);
    expect(r.totalTax).toBe(tax);
    expect(r.verified).toBe(true);
  });
});

describe('Costa Rica 2025 (Decreto 44772-H)', () => {
  it('10% band: (16,224,000 − 11,064,000) × 10% = 516,000', () => {
    expect(calcIncomeTax('CR', 16224000, '2025')!.incomeTax).toBe(516000);
    expect(calcIncomeTax('CR', 11064000, '2025')!.incomeTax).toBe(0);
  });

  it('says CCSS contributions are not included', () => {
    expect(calcIncomeTax('CR', 20000000, '2025')!.assumptions!.join(' ')).toMatch(/CCSS/);
  });
});
