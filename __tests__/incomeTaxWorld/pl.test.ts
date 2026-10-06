/**
 * Poland — bands, contributions, credit, solidarity levy. embracingearth.space
 * Bands/credit: podatki.gov.pl skala podatkowa (12% to 120,000 less 3,600; 10,800 + 32% above).
 */
import { calcIncomeTax } from '../../src';

const run = (gross: number, year: string) => calcIncomeTax('PL', gross, year)!;
/** The engine rounds to whole units; allow one unit. */
const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
const scale = (t: number) => (t <= 120000 ? 0.12 * t : 14400 + 0.32 * (t - 120000));

describe('Poland', () => {
  it('band edge at 120,000 taxable: 12% below, 32% above', () => {
    for (const g of [130000, 142000, 143000, 160000]) {
      const r = run(g, '2026');
      near(r.incomeTax, scale(r.taxable));
    }
  });

  it('2026 gross 100,000: taxable 100,000 − 11,260 − 2,450 − 3,000 = 83,290; 9,994.80 − 3,600 = 6,394.80', () => {
    const r = run(100000, '2026');
    near(r.taxable, 83290);
    near(r.totalTax, 6394.8);
    expect(r.verified).toBe(true);
  });

  it('pension/disability capped at the 282,600 ZUS ceiling', () => {
    // 282,600 × 11.26% = 31,820.76; 300,000 × 2.45% = 7,350; 300,000 − 31,820.76 − 7,350 − 3,000 = 257,829.24
    // 14,400 + 32% × 137,829.24 = 58,505.36; − 3,600 = 54,905.36
    const r = run(300000, '2026');
    near(r.taxable, 257829.24);
    near(r.totalTax, 54905.36);
  });

  it('solidarity levy: 4% of income above 1,000,000', () => {
    // 1,200,000 − 31,820.76 − 29,400 − 3,000 = 1,135,779.24; 4% × 135,779.24 = 5,431.17
    near(run(1200000, '2026').levies.find((l) => /solidar/i.test(l.name))!.amount, 5431.17);
    expect(run(900000, '2026').levies.length).toBe(0);
  });

  it('the credit is non-refundable', () => {
    // 30,000 × 0.8629 − 3,000 = 22,887; 12% = 2,746.44 < 3,600 → 0
    expect(run(30000, '2026').totalTax).toBe(0);
  });

  it('2025 uses the 260,190 ceiling and is unverified (flat-rate costs read on a 2026 page)', () => {
    // 260,190 × 11.26% = 29,297.39; 300,000 − 29,297.39 − 7,350 − 3,000 = 260,352.61
    const r = run(300000, '2025');
    near(r.taxable, 260352.61);
    expect(r.verified).toBe(false);
    expect(r.assumptions!.join(' ')).toMatch(/labelled for 2026/);
  });

  it('says the health contribution is not included', () => {
    expect(run(100000, '2026').assumptions!.join(' ')).toMatch(/health contribution/);
  });
});
