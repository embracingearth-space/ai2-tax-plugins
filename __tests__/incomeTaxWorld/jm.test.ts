/**
 * Jamaica — TAJ Technical Advisory 042025 (effective thresholds) + NIS deduction.
 * embracingearth.space
 */
import { calcIncomeTax } from '../../src';

describe('Jamaica 2026', () => {
  it('official: TAJ Scenario 5 (YA 2026), statutory income J$1,896,000 → J$4,846.50', () => {
    // https://www.jamaicatax.gov.jm/documents/10194/52231399/Technical_Advisory_Threshold+_042025.pdf/c4adbf81-8ddd-9a1b-9e8b-8bdc431162df
    // The scenario states statutory income; gross 1,954,640 − 3% NIS (58,639.20) = 1,896,000.80.
    // (1,896,000.80 − 1,876,614) × 25% = 4,846.70 → 4,847 (the scenario's 4,846.50 plus 0.80 × 25%).
    const r = calcIncomeTax('JM', 1954640, '2026')!;
    expect(r.incomeTax).toBe(4847);
    expect(r.verified).toBe(true);
  });

  it('zero at the threshold, 25% just above', () => {
    // statutory = gross × 0.97; 1,934,653 × 0.97 = 1,876,613.41 < 1,876,614
    expect(calcIncomeTax('JM', 1934653, '2026')!.incomeTax).toBe(0);
    // 2,000,000 → 1,940,000; (1,940,000 − 1,876,614) × 25% = 15,846.50 → 15,847 (round half up)
    expect(calcIncomeTax('JM', 2000000, '2026')!.incomeTax).toBe(15847);
  });

  it('NIS is capped at J$5,000,000 and 30% applies above J$6,000,000 statutory income', () => {
    // 7,000,000 − 150,000 = 6,850,000; (6,000,000 − 1,876,614) × 25% + 850,000 × 30% = 1,030,846.50 + 255,000
    const r = calcIncomeTax('JM', 7000000, '2026')!;
    expect(r.taxable).toBe(6850000);
    expect(r.incomeTax).toBe(1285847);
  });
});

describe('Jamaica 2025', () => {
  it('derived from the official formula — not an official example: TAJ Scenario 1 salary without its pension contribution', () => {
    // 7,000,000 − 150,000 NIS = 6,850,000; (6,000,000 − 1,774,554) × 25% + 850,000 × 30% = 1,056,361.50 + 255,000
    const r = calcIncomeTax('JM', 7000000, '2025')!;
    expect(r.incomeTax).toBe(1311362);
    expect(r.verified).toBe(true);
  });

  it('says NIS, NHT and Education Tax are not charged', () => {
    expect(calcIncomeTax('JM', 3000000, '2025')!.assumptions!.join(' ')).toMatch(/Education Tax/);
  });
});
