/**
 * Luxembourg — class 1 base tariff, CIS / CI-CO2, fonds pour l'emploi. embracingearth.space
 * Expectations derived from the official ACD tariff and credit formulas, the
 * CCSS contribution notices and the Recueil des barèmes — not official examples.
 */
import { calcIncomeTax } from '../../src';
import { LU_INCOME_TAX } from '../../src/data/incomeTaxWorld/lu';
import { progressive } from '../../src/data/incomeTaxMath';

const levy = (r: ReturnType<typeof calcIncomeTax>) => r!.levies.find((l) => l.name.includes('fonds'))?.amount ?? 0;
const credits = (r: ReturnType<typeof calcIncomeTax>) => r!.offsets.reduce((s, o) => s + o.amount, 0);

describe('Luxembourg (derived from the official formula — not an official example)', () => {
  it('2026 €60,000: pension 8.50% + health 3.05% + 1,020 flat → 52,050 (was 56,310 without pension)', () => {
    const r = calcIncomeTax('LU', 60000, '2026')!;
    // 60,000 − 1,020 − 5,100 − 1,830 = 52,050
    expect(r.taxable).toBe(52050);
    // bands to 54,090 = 8,859.60; − 2,040 × 38% = 8,084.40
    expect(r.incomeTax).toBe(8084);
    // CIS 600 − 20,000 × 1.5% = 300; CI-CO2 216 − 20,000 × 0.54% = 108
    expect(credits(r)).toBe(408);
    // 8,084 × 7% = 565.88
    expect(levy(r)).toBe(566);
    expect(r.totalTax).toBe(8084 - 408 + 566);
    expect(r.verified).toBe(true);
  });

  it('2025 €60,000: pension 8% + health 3.05% → 52,350; CI-CO2 192', () => {
    const r = calcIncomeTax('LU', 60000, '2025')!;
    // 60,000 − 1,020 − 4,800 − 1,830 = 52,350; 8,859.60 − 1,740 × 38% = 8,198.40
    expect(r.taxable).toBe(52350);
    expect(r.incomeTax).toBe(8198);
    // CIS 300; CI-CO2 192 − 20,000 × 0.48% = 96
    expect(credits(r)).toBe(396);
    // 8,198 × 7% = 573.86
    expect(levy(r)).toBe(574);
  });

  it('the dependency-insurance contribution is not deducted (not tax-deductible)', () => {
    for (const year of ['2026', '2025']) {
      const r = calcIncomeTax('LU', 60000, year)!;
      expect(r.assumptions!.join(' ')).toMatch(/dependency-insurance contribution \(1\.40%\) is not tax-deductible/);
    }
    expect(LU_INCOME_TAX.years.flatMap((y) => y.deductions ?? []).some((d) => /dependency/i.test(d.name))).toBe(false);
  });

  it('pension and health stop at the maximum contributory base: 2026 €200,000 → 179,969.88', () => {
    // 164,589.81 × 8.5% = 13,990.13; × 3.05% = 5,019.99
    expect(calcIncomeTax('LU', 200000, '2026')!.taxable).toBeCloseTo(200000 - 1020 - 164589.81 * 0.1155, 6);
  });

  it('zero band to 13,230 and 8% just above it', () => {
    // 2026: taxable = gross × 0.8845 − 1,020; 16,110 → 13,229.30 → nil
    expect(calcIncomeTax('LU', 16110, '2026')!.incomeTax).toBe(0);
    // 16,200 → 13,308.90; 78.90 × 8% = 6.31
    expect(calcIncomeTax('LU', 16200, '2026')!.incomeTax).toBe(6);
  });

  it('CIS and CI-CO2 are nil from €80,000 gross', () => {
    expect(credits(calcIncomeTax('LU', 80000, '2026'))).toBe(0);
  });
});

describe("Luxembourg — fonds pour l'emploi: 9% only on the slice above 150,000", () => {
  it('the offset is the Recueil des barèmes 931.80: 2% of the tariff tax at 150,000 (46,590)', () => {
    const bands = LU_INCOME_TAX.years[0]!.bands;
    expect(progressive(150000, bands)).toBeCloseTo(46590, 6);
    expect(0.02 * progressive(150000, bands)).toBeCloseTo(931.8, 6);
  });

  it('2026 €200,000: taxable 179,969.88, tax 0.41R − 15,171.60 = 58,616 → 0.09 × 58,616 − 931.80 = 4,343.64', () => {
    const r = calcIncomeTax('LU', 200000, '2026')!;
    expect(r.incomeTax).toBe(58616);
    expect(levy(r)).toBe(4344);
  });

  it('no cliff at 150,000 taxable: €100 more gross around the threshold adds cents, not ~932', () => {
    // above the contributory ceiling, taxable = gross − 20,030.12: 170,000 → 149,969.88; 170,100 → 150,069.88
    const below = calcIncomeTax('LU', 170000, '2026')!;
    const above = calcIncomeTax('LU', 170100, '2026')!;
    expect(below.taxable).toBeLessThan(150000);
    expect(above.taxable).toBeGreaterThan(150000);
    // tax +40 at 40%: 7% of the first 30.12 of income and 9% of the next 69.88 ≈ 8.4
    expect(levy(above) - levy(below)).toBeGreaterThan(0);
    expect(levy(above) - levy(below)).toBeLessThan(15);
  });
});
