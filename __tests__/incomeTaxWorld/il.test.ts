/**
 * Israel — income tax less credit points. embracingearth.space
 */
import { calcIncomeTax } from '../../src';

describe('Israel — band edges (employment income has no standard deduction)', () => {
  it.each([
    ['2026', 84120, 8412], // 84,120 × 10%
    ['2026', 120720, 13536], // 8,412 + 36,600 × 14%
    ['2026', 228000, 34992], // 13,536 + 107,280 × 20%
    ['2026', 228100, 35023], // + 100 × 31%
    ['2025', 193800, 28152], // 13,536 + 73,080 × 20%
    ['2025', 193900, 28183], // + 100 × 31%
  ])('%s: ILS %d → income tax ILS %d', (year, gross, tax) => {
    expect(calcIncomeTax('IL', gross, year)!.incomeTax).toBe(tax);
  });

  it('2025: 3% surtax above ILS 721,560 shows as the 50% band', () => {
    // 28,152 + 75,480 × 31% + 291,000 × 35% + 161,280 × 47% = 229,202.4; +1,000 × 50% = 500.
    expect(calcIncomeTax('IL', 721560, '2025')!.incomeTax).toBe(229202);
    expect(calcIncomeTax('IL', 722560, '2025')!.incomeTax).toBe(229702);
  });

  it('2.25 credit points (ILS 6,534) are non-refundable', () => {
    const r = calcIncomeTax('IL', 60000, '2026')!;
    expect(r.incomeTax).toBe(6000);
    expect(r.totalTax).toBe(0);
    expect(calcIncomeTax('IL', 120720, '2026')!.totalTax).toBe(13536 - 6534);
  });

  it('both years are unverified and say why', () => {
    for (const y of ['2026', '2025']) {
      const r = calcIncomeTax('IL', 200000, y)!;
      expect(r.verified).toBe(false);
      expect(r.assumptions!.join(' ')).toMatch(/gov\.il/);
    }
  });
});
