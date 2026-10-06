/**
 * Czechia — financnisprava.gov.cz: 15% up to 36 × average wage, 23% above; credit 30,840.
 * embracingearth.space
 */
import { calcIncomeTax } from '../../src';

const run = (gross: number, year: string) => calcIncomeTax('CZ', gross, year)!;
const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);

describe('Czechia', () => {
  it('2026 edge 1,762,812: 15% = 264,421.80; +100 at 23% = 264,444.80 (before credit)', () => {
    near(run(1762812, '2026').incomeTax, 264421.8);
    near(run(1762912, '2026').incomeTax, 264444.8);
  });

  it('2025 edge 1,676,052: 251,407.80; +100 → 251,430.80', () => {
    near(run(1676052, '2025').incomeTax, 251407.8);
    near(run(1676152, '2025').incomeTax, 251430.8);
  });

  it('gross 1,000,000: taxable is gross; 150,000 − 30,840 = 119,160', () => {
    const r = run(1000000, '2026');
    expect(r.taxable).toBe(1000000);
    near(r.totalTax, 119160);
  });

  it('credit corner: 205,600 × 15% = 30,840 → zero; non-refundable below; 206,600 → 150', () => {
    expect(run(205600, '2026').totalTax).toBe(0);
    expect(run(100000, '2026').totalTax).toBe(0);
    near(run(206600, '2026').totalTax, 150);
  });

  it('both years verified', () => {
    expect(run(600000, '2026').verified).toBe(true);
    expect(run(600000, '2025').verified).toBe(true);
  });
});
