/**
 * Iceland — state tax + útsvar less the personal tax credit. Own arithmetic
 * from Skatturinn's published rates (no official total-tax example). embracingearth.space
 */
import { calcIncomeTax } from '../../src';

describe('Iceland 2026', () => {
  it('first band edge at 5,977,464 taxable (gross 6,226,525 less 4% pension)', () => {
    // 5,977,464 × 16.55% = 989,270.29
    expect(calcIncomeTax('IS', 6226525, '2026')!.incomeTax).toBe(989270);
    // +96 taxable × 23.05% = 22.13
    expect(calcIncomeTax('IS', 6226625, '2026')!.incomeTax).toBe(989292);
  });
  it('10,000,000: state tax, credit, útsvar at 14.94%', () => {
    const r = calcIncomeTax('IS', 10000000, '2026')!;
    // taxable 9,600,000: 989,270.29 + 3,622,536 × 23.05% 834,994.55 = 1,824,264.84
    expect(r.incomeTax).toBe(1824265);
    // 1,824,265 − 869,898 + 9,600,000 × 14.94% (1,434,240)
    expect(r.totalTax).toBe(2388607);
    expect(r.verified).toBe(true);
  });
  it('credit left over after state tax reduces útsvar (3,000,000)', () => {
    // taxable 2,880,000 × (16.55% + 14.94%) = 906,912 − 869,898 = 37,014
    expect(calcIncomeTax('IS', 3000000, '2026')!.totalTax).toBe(37014);
  });
});

describe('Iceland 2025', () => {
  it('10,000,000', () => {
    // 5,664,060 × 16.55% 937,401.93 + 3,935,940 × 23.05% 907,234.17 = 1,844,636.10
    expect(calcIncomeTax('IS', 10000000, '2025')!.incomeTax).toBe(1844636);
  });
});
