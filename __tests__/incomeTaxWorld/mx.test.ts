/**
 * Mexico — art. 152 LISR annual tariff + subsidio para el empleo.
 * No official SAT worked example was located; every expectation is hand arithmetic
 * from the Anexo 8 RMF tariff (cuota fija + rate on the excess over the lower limit).
 * embracingearth.space
 */
import { calcIncomeTax } from '../../src';

const credit = (r: ReturnType<typeof calcIncomeTax>) => r!.offsets.reduce((s, o) => s + o.amount, 0);

describe('Mexico 2026 — tariff rows', () => {
  it('top of row 1 and start of row 2', () => {
    // (10,135.11 − 0.01) × 1.92% = 194.594 → 195
    expect(calcIncomeTax('MX', 10135.11, '2026')!.incomeTax).toBe(195);
    // row 2 lower limit: cuota fija 194.59 → 195
    expect(calcIncomeTax('MX', 10135.12, '2026')!.incomeTax).toBe(195);
  });

  it('row 3 → row 4 (16%) at 151,176.20', () => {
    // 5,051.37 + (151,176.19 − 86,022.12) × 10.88% = 12,140.13 → 12,140; next row cuota fija 12,140.13
    expect(calcIncomeTax('MX', 151176.19, '2026')!.incomeTax).toBe(12140);
    expect(calcIncomeTax('MX', 151176.2, '2026')!.incomeTax).toBe(12140);
  });

  it('top row: 6,000,000 → 1,601,862.46 + (6,000,000 − 5,107,703.93) × 35% = 1,914,166.08', () => {
    const r = calcIncomeTax('MX', 6000000, '2026')!;
    expect(r.incomeTax).toBe(1914166);
    expect(r.marginalRate).toBeCloseTo(0.35, 6);
    expect(r.verified).toBe(true);
  });
});

describe('Mexico — subsidio para el empleo', () => {
  it('2026: granted at the monthly limit (12 × 11,492.66 = 137,911.92), lost just above', () => {
    // tax = 5,051.37 + (137,911.92 − 86,022.12) × 10.88% = 10,696.98 → 10,697
    // subsidio = 536.21 + 11 × 535.65 = 6,428.36 → 6,428
    const at = calcIncomeTax('MX', 137911.92, '2026')!;
    expect(at.incomeTax).toBe(10697);
    expect(credit(at)).toBe(6428);
    expect(at.totalTax).toBe(4269);
    const above = calcIncomeTax('MX', 137912.04, '2026')!;
    expect(credit(above)).toBe(0);
    expect(above.totalTax).toBe(10697);
  });

  it('is non-refundable: low income pays nothing and gets nothing back', () => {
    const r = calcIncomeTax('MX', 50000, '2026')!;
    expect(r.totalTax).toBe(0);
    expect(credit(r)).toBe(r.incomeTax);
  });

  it('2025 uses its own tariff and subsidio (12 × 474.65), and is unverified', () => {
    // 4,461.94 + (100,000 − 75,984.56) × 10.88% = 7,074.82 → 7,075; subsidio 5,695.80 → 5,696 (100,000 / 12 ≤ 10,171)
    const r = calcIncomeTax('MX', 100000, '2025')!;
    expect(r.incomeTax).toBe(7075);
    expect(credit(r)).toBe(5696);
    expect(r.verified).toBe(false);
    expect(r.assumptions!.join(' ')).toMatch(/January/);
  });

  it('says IMSS contributions are not included', () => {
    expect(calcIncomeTax('MX', 300000, '2026')!.assumptions!.join(' ')).toMatch(/IMSS/);
  });
});
