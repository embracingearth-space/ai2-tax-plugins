/**
 * Guatemala — LAT art. 72–73. Unverified (official sites blocked automated access).
 * embracingearth.space
 */
import { calcIncomeTax } from '../../src';

describe('Guatemala', () => {
  it('2026: Q200,000 → taxable 200,000 − 48,000 − 3,024 − 4.83% × 200,000 (9,660) = 139,316; × 5% = 6,965.80', () => {
    const r = calcIncomeTax('GT', 200000, '2026')!;
    expect(r.taxable).toBeCloseTo(139316, 0);
    expect(r.incomeTax).toBe(6966);
  });

  it('2026: 5% → 7% at Q300,000 taxable (gross = 351,024 / 0.9517 ≈ 368,838.92)', () => {
    expect(calcIncomeTax('GT', 368838.92, '2026')!.incomeTax).toBe(15000);
    // 400,000 → taxable 329,656 → 15,000 + 29,656 × 7% = 17,075.92
    const r = calcIncomeTax('GT', 400000, '2026')!;
    expect(r.incomeTax).toBe(17076);
  });

  it('2025 has no extraordinary Q3,024 deduction: 200,000 → taxable 142,340 → 7,117', () => {
    expect(calcIncomeTax('GT', 200000, '2025')!.incomeTax).toBe(7117);
  });

  it('is unverified in every year and says why', () => {
    for (const y of ['2026', '2025']) {
      const r = calcIncomeTax('GT', 200000, y)!;
      expect(r.verified).toBe(false);
      expect(r.assumptions!.join(' ')).toMatch(/blocked automated access/);
    }
  });
});
