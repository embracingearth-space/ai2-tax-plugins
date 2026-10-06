/**
 * Latvia — IIN after employee VSAOI and the non-taxable minimum. Own arithmetic
 * from the Finance Ministry / VID figures (no official single-person example). embracingearth.space
 */
import { calcIncomeTax } from '../../src';

describe('Latvia 2026', () => {
  it('25.5% band', () => {
    // 50,000 − 5,250 VSAOI − 6,600 = 38,150 × 25.5% = 9,728.25
    expect(calcIncomeTax('LV', 50000, '2026')!.totalTax).toBe(9728);
    expect(calcIncomeTax('LV', 50000, '2026')!.verified).toBe(true);
  });
  it('105,300 edge (VSAOI capped at 11,056.50)', () => {
    // 122,900 − 11,056.5 − 6,600 = 105,243.5 × 25.5% = 26,837.09
    expect(calcIncomeTax('LV', 122900, '2026')!.totalTax).toBe(26837);
    // 105,343.5: 26,851.50 + 43.5 × 33% 14.36 = 26,865.86
    expect(calcIncomeTax('LV', 123000, '2026')!.totalTax).toBe(26866);
  });
  it('36% above 200,000', () => {
    // 282,343.5: 26,851.50 + 94,700×33% 31,251 + 82,343.5×36% 29,643.66 = 87,746.16
    expect(calcIncomeTax('LV', 300000, '2026')!.totalTax).toBe(87746);
  });
});

describe('Latvia 2025', () => {
  it('non-taxable minimum 6,120', () => {
    // 50,000 − 5,250 − 6,120 = 38,630 × 25.5% = 9,850.65
    expect(calcIncomeTax('LV', 50000, '2025')!.totalTax).toBe(9851);
  });
});
