/**
 * Slovakia — financnasprava.sk bands and NČZD. embracingearth.space
 */
import { calcIncomeTax } from '../../src';

const run = (gross: number, year: string) => calcIncomeTax('SK', gross, year)!;
const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);

// 2026: 19% to 43,983.32 (8,356.83); 25% to 60,349.21 (+4,091.47); 30% to 75,010.32 (+4,398.33); 35% above.
const scale26 = (t: number) =>
  t <= 43983.32 ? 0.19 * t
  : t <= 60349.21 ? 8356.83 + 0.25 * (t - 43983.32)
  : t <= 75010.32 ? 12448.3 + 0.3 * (t - 60349.21)
  : 16846.63 + 0.35 * (t - 75010.32);

describe('Slovakia', () => {
  it('2026 band edges follow the published table', () => {
    for (const g of [50000, 52000, 70000, 72000, 88000, 90000, 100000]) {
      const r = run(g, '2026');
      near(r.incomeTax, scale26(r.taxable));
    }
  });

  it('2026 gross 20,000: base 17,120 ≤ 26,083.13 → full NČZD 5,966.73; taxable 11,153.27; tax 2,119.12', () => {
    const r = run(20000, '2026');
    near(r.taxable, 11153.27);
    near(r.totalTax, 2119.12);
  });

  it('2026 NČZD taper: gross 40,000 → base 34,240; NČZD 14,661.11 − 11,413.33 = 3,247.78; taxable 30,992.22; tax 5,888.52', () => {
    const r = run(40000, '2026');
    near(r.taxable, 30992.22);
    near(r.totalTax, 5888.52);
  });

  it('2026 NČZD is continuous at the 26,083.13 limit (14,661.11 − 26,083.13 / 3 = 5,966.73)', () => {
    expect(14661.11 - 26083.13 / 3).toBeCloseTo(5966.73, 1);
  });

  it('2026 gross 80,000: NČZD zero; taxable 68,480; 12,448.30 + 30% × 8,130.79 = 14,887.54', () => {
    near(run(80000, '2026').totalTax, 14887.54);
  });

  it('2025 gross 80,000: base 69,280 (4% health); 9,203.87 + 25% × 20,838.57 = 14,413.51', () => {
    near(run(80000, '2025').totalTax, 14413.51);
  });

  it('2025 taper uses 1/4: gross 40,000 → base 34,640; NČZD 12,110.36 − 8,660 = 3,450.36; taxable 31,189.64; tax 5,926.03', () => {
    const r = run(40000, '2025');
    near(r.taxable, 31189.64);
    near(r.totalTax, 5926.03);
  });

  it('verified both years', () => {
    expect(run(30000, '2026').verified).toBe(true);
    expect(run(30000, '2025').verified).toBe(true);
  });
});
