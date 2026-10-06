/**
 * Egypt — Law 7/2024 scale incl. bracket loss above EGP 600,000. embracingearth.space
 * 2026: above EGP 200,400 of pay social insurance is capped at 20,040 (10% × 16,700 × 12),
 * so net = gross − 20,040 − 20,000.
 */
import { calcIncomeTax } from '../../src';

const t = (g: number, y = '2026') => calcIncomeTax('EG', g, y)!.incomeTax;

describe('Egypt 2026 — scale', () => {
  it.each([
    [240040, 29750], // net 200,000: 15,000 × 10% + 15,000 × 15% + 130,000 × 20% = 1,500 + 2,250 + 26,000
    [440040, 74750], // net 400,000: + 200,000 × 22.5%
    [640040, 124750], // net 600,000: + 200,000 × 25%
    [640045, 124750], // net 600,005 rounds down to 600,000
    [640060, 128755], // net 600,020 loses the 0% band: 55,000 × 10% + 2,250 + 26,000 + 45,000 + 200,020 × 25%
    [840040, 181500], // net 800,000: 70,000 × 15% + 26,000 + 45,000 + 400,000 × 25%
    [1240040, 290000], // net 1,200,000: 400,000 × 22.5% + 800,000 × 25%
    [1240080, 300011], // net 1,200,040: 1,200,000 × 25% + 40 × 27.5%
  ])('gross %d → tax %d', (g, x) => {
    expect(t(g)).toBe(x);
    expect(calcIncomeTax('EG', g, '2026')!.verified).toBe(true);
  });

  it('deducts social insurance at 10% below the ceiling and the EGP 20,000 exemption', () => {
    expect(calcIncomeTax('EG', 100000, '2026')!.taxable).toBe(70000);
    expect(t(50000)).toBe(0); // net 25,000 < 40,000
  });
});

describe('Egypt 2025', () => {
  it('uses the 2025 insurable-wage ceiling of EGP 14,500/month', () => {
    // 17,400 social insurance + 20,000 exemption → net 600,000 → 124,750
    expect(t(637400, '2025')).toBe(124750);
    expect(calcIncomeTax('EG', 637400, '2025')!.verified).toBe(true);
  });
});
