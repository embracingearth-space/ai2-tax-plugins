/**
 * Vietnam — compulsory insurance deduction and bracket arithmetic, hand-computed. embracingearth.space
 *
 * Taxable = gross − family-circumstance deduction − employee insurance:
 *   SI 8% + HI 1.5% = 9.5% on salary up to 20 × base salary,
 *   UI 1% on salary up to 20 × the Region I minimum wage.
 * 2026 (Law 109/2025): deduction 186,000,000; SI/HI ceiling 6 × 46.8m + 6 × 50.6m = 584.4m;
 *       UI ceiling 12 × 106.2m = 1,274.4m. Bands 5/10/20/30/35% to 120m/360m/720m/1,200m.
 * 2025 (Law 04/2007 as amended): deduction 132,000,000; SI/HI ceiling 12 × 46.8m = 561.6m;
 *       UI ceiling 12 × 99.2m = 1,190.4m. Bands 5/10/15/20/25/30/35% to 60m/120m/216m/384m/624m/960m.
 */
import { calcIncomeTax } from '../../src';
import { VN_INCOME_TAX } from '../../src/data/incomeTaxWorld/vn';
import { applyDeductions } from '../../src/data/incomeTaxFactory';

const r = (g: number, y: string) => calcIncomeTax('VN', g, y)!;

describe('Vietnam 2026 — insurance deducted, five brackets, verified', () => {
  it.each([
    // [gross, taxable, tax]
    [200000000, 0, 0], // 186m + 10.5% × 200m = 207m > gross
    [400000000, 172000000, 11200000], // 400 − 186 − 42 = 172m: 6m + 52m × 10%
    // SI/HI capped: 9.5% × 584.4m = 55,518,000; UI 10m → 1,000 − 186 − 65.518 = 748.482m
    [1000000000, 748482000, 110544600], // 102m + 28,482,000 × 30%
    // UI capped too: 1% × 1,274.4m = 12,744,000 → 1,500 − 186 − 68.262 = 1,245.738m
    [1500000000, 1245738000, 262008300], // 246m + 45,738,000 × 35%
  ])('gross %d → taxable %d, tax %d', (g, taxable, tax) => {
    const x = r(g, '2026');
    expect(x.taxable).toBe(taxable);
    expect(x.incomeTax).toBe(tax);
    expect(x.verified).toBe(true);
  });
});

describe('Vietnam 2025 — insurance deducted, seven brackets, unverified family deduction', () => {
  it.each([
    [400000000, 226000000, 25400000], // 400 − 132 − 42 = 226m: 3m + 6m + 14.4m + 10m × 20%
    // SI/HI capped: 9.5% × 561.6m = 53,352,000; UI 10m → 1,000 − 132 − 63.352 = 804.648m
    [1000000000, 804648000, 171194400], // 117m + 180,648,000 × 30%
    // UI capped: 1% × 1,190.4m = 11,904,000 → 1,500 − 132 − 65.256 = 1,302.744m
    [1500000000, 1302744000, 337760400], // 217.8m + 342,744,000 × 35%
  ])('gross %d → taxable %d, tax %d', (g, taxable, tax) => {
    const x = r(g, '2025');
    expect(x.taxable).toBe(taxable);
    expect(x.incomeTax).toBe(tax);
    expect(x.verified).toBe(false);
  });

  it('explains why 2025 is unverified', () => {
    expect(r(500000000, '2025').assumptions!.join(' ')).toMatch(/Resolution 954/);
  });
});

describe('Vietnam — the audit case and the assumptions', () => {
  it('VND 400m: 2026 tax is 11.2m, not the 15.4m it was without the insurance deduction', () => {
    expect(r(400000000, '2026').incomeTax).toBe(11200000);
  });

  const a = r(500000000, '2026').assumptions!.join(' ');
  it('states the rates, ceilings and the Region I default', () => {
    expect(a).toMatch(/social insurance 8% and health insurance 1\.5%/);
    expect(a).toMatch(/46\.8m a month \(50\.6m from July 2026\)/);
    expect(a).toMatch(/Region I/);
    expect(a).toMatch(/only above VND 828m a year in 2025 and 888m in 2026/);
  });

  it('the Region IV thresholds it quotes are where a Region IV ceiling starts to change the deduction', () => {
    // Region IV unemployment-insurance ceiling: 20 × 3.45m (2025) and 20 × 3.70m (2026), per month.
    const regionIV: Record<string, number> = { '2025': 12 * 69000000, '2026': 12 * 74000000 };
    for (const [label, ceiling] of Object.entries(regionIV)) {
      const year = VN_INCOME_TAX.years.find((y) => y.taxYear === label)!;
      const asRegionIV = { ...year, deductions: year.deductions!.map((d) => (d.kind === 'share' && d.name.startsWith('Unemployment') ? { ...d, ceiling } : d)) };
      const q = { round: Math.round, floor: Math.floor };
      expect(ceiling).toBe(label === '2025' ? 828000000 : 888000000);
      expect(applyDeductions(asRegionIV, ceiling, q)).toBe(applyDeductions(year, ceiling, q)); // same up to the threshold
      expect(applyDeductions(asRegionIV, ceiling + 100000000, q)).toBeLessThan(applyDeductions(year, ceiling + 100000000, q)); // lower above it
    }
  });

  it('carries no unquantified hedge', () => {
    expect(a).not.toMatch(/slightly|may be overstated/);
  });

  it('is an employment-income figure (employee insurance applied); self-employed is refused', () => {
    expect(r(500000000, '2026').incomeBasis).toBe('employment');
    expect(r(500000000, '2026').assumptions![0]).toMatch(/^Computed as employment income/);
    expect(() => calcIncomeTax('VN', 500000000, '2026', { incomeType: 'self-employed' })).toThrow(RangeError);
  });
});
