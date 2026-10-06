/**
 * Luxembourg — class 1 base tariff, CIS / CI-CO2, fonds pour l'emploi. embracingearth.space
 * Expectations derived from the official ACD tariff and credit formulas — not official examples.
 */
import { calcIncomeTax } from '../../src';

const levy = (r: ReturnType<typeof calcIncomeTax>) => r!.levies.find((l) => l.name.includes('fonds'))?.amount ?? 0;
const credits = (r: ReturnType<typeof calcIncomeTax>) => r!.offsets.reduce((s, o) => s + o.amount, 0);

describe('Luxembourg (derived from the official formula — not an official example)', () => {
  it('2026 €60,000: health 3.05% + dependency 1.4% + 1,020 flat → 56,310', () => {
    const r = calcIncomeTax('LU', 60000, '2026')!;
    expect(r.taxable).toBe(56310);
    // bands to 54,090 = 8,859.60; + 2,220 × 39% = 865.80 → 9,725.40
    expect(r.incomeTax).toBe(9725);
    // CIS 600 − 20,000 × 1.5% = 300; CI-CO2 216 − 20,000 × 0.54% = 108
    expect(credits(r)).toBe(408);
    // 9,725 × 7% = 680.75
    expect(levy(r)).toBe(681);
    expect(r.totalTax).toBe(9725 - 408 + 681);
    expect(r.verified).toBe(true);
  });

  it('2025 €60,000 also deducts the 8% pension contribution; CI-CO2 192', () => {
    const r = calcIncomeTax('LU', 60000, '2025')!;
    // 60,000 − 1,020 − 4,800 − 1,830 − 840 = 51,510; 8,859.60 − 2,580 × 38% = 7,884.90
    expect(r.taxable).toBe(51510);
    expect(r.incomeTax).toBe(7885);
    // CIS 300; CI-CO2 192 − 20,000 × 0.48% = 96
    expect(credits(r)).toBe(396);
    // 7,885 × 7% = 551.95
    expect(levy(r)).toBe(552);
  });

  it('zero band to 13,230 and 8% just above it', () => {
    // 2026: taxable = gross × 0.9555 − 1,020; 14,913 → 13,229.37 → nil
    expect(calcIncomeTax('LU', 14913, '2026')!.incomeTax).toBe(0);
    // 15,000 → 13,312.50; 82.50 × 8% = 6.60
    expect(calcIncomeTax('LU', 15000, '2026')!.incomeTax).toBe(7);
  });

  it('CIS and CI-CO2 are nil from €80,000 gross', () => {
    expect(credits(calcIncomeTax('LU', 80000, '2026'))).toBe(0);
  });

  it("fonds pour l'emploi rises to 9% above 150,000 taxable", () => {
    const r = calcIncomeTax('LU', 200000, '2026')!;
    expect(r.taxable).toBeGreaterThan(150000);
    expect(Math.abs(levy(r) - r.incomeTax * 0.09)).toBeLessThanOrEqual(1);
  });
});
