/**
 * China — special deductions and bracket arithmetic, hand-computed. embracingearth.space
 *
 * Taxable = gross − 60,000 basic deduction (STA Order 57)
 *                 − 10.5% social insurance (pension 8% + medical 2% + unemployment 0.5%)
 *                 − 5% housing provident fund,
 * both on the Beijing contribution base: monthly wage clamped to that contribution year's limits,
 * six months at each year's limits (contribution years run July–June).
 *   2026: ceiling 6 × 35,811 + 6 × 36,348 = 432,954; floor 6 × 7,162 + 6 × 7,270 = 86,592
 *   2025: ceiling 6 × 35,283 + 6 × 35,811 = 426,564; floor 6 × 6,821 + 6 × 7,162 = 83,898
 * Bands: STA Annex 1 (quick deductions 0/2,520/16,920/31,920/52,920/85,920/181,920). Tax rounds to whole yuan.
 */
import { calcIncomeTax } from '../../src';
import { CN_INCOME_TAX } from '../../src/data/incomeTaxWorld/cn';
import { applyDeductions, type DeductionRule } from '../../src/data/incomeTaxFactory';
import { progressive } from '../../src/data/incomeTaxMath';

const r = (g: number, y: string) => calcIncomeTax('CN', g, y)!;

describe('China 2026 — special deductions on the Beijing base', () => {
  it.each([
    // [gross, taxable, tax]
    [50000, 0, 0], // deductions exceed gross
    // base floor binds: SI 10.5% × 86,592 = 9,092.16 (not 8,400); HPF 4,000 → 6,907.84 × 3% = 207.24
    [80000, 6907.84, 207],
    // within the limits: taxable = 0.845 × gross − 60,000
    [100000, 24500, 735], // 24,500 × 3%
    [300000, 193500, 21780], // 1,080 + 10,800 + 49,500 × 20%
    // above the ceiling: deductions = 60,000 + 15.5% × 432,954 = 127,107.87
    [600000, 472892.13, 88948], // 73,080 + 52,892.13 × 30% = 88,947.64
    [1500000, 1372892.13, 435881], // 250,080 + 412,892.13 × 45% = 435,881.46
  ])('gross %d → taxable %d, tax %d', (g, taxable, tax) => {
    const x = r(g, '2026');
    expect(x.taxable).toBeCloseTo(taxable, 2);
    expect(x.incomeTax).toBe(tax);
    expect(x.verified).toBe(true);
  });
});

describe('China 2025 — the 2024/25 and 2025/26 Beijing limits', () => {
  it.each([
    // floor: SI 10.5% × 83,898 = 8,809.29; HPF 4,000 → 7,190.71 × 3% = 215.72
    [80000, 7190.71, 216],
    [100000, 24500, 735],
    // ceiling: 60,000 + 15.5% × 426,564 = 126,117.42
    [600000, 473882.58, 89245], // 73,080 + 53,882.58 × 30% = 89,244.77
  ])('gross %d → taxable %d, tax %d', (g, taxable, tax) => {
    const x = r(g, '2025');
    expect(x.taxable).toBeCloseTo(taxable, 2);
    expect(x.incomeTax).toBe(tax);
    expect(x.verified).toBe(true);
  });
});

describe('China — the audit case: CNY 100,000 is no longer taxed on 40,000', () => {
  it('deducts social insurance and housing fund, not just the basic deduction', () => {
    // Before: 40,000 × 3% + ... = 1,480. Now 735 (HPF 5%); 525 with HPF 12%.
    expect(r(100000, '2026').incomeTax).toBe(735);
  });
});

describe('China — the assumptions state the default and quantify the alternative', () => {
  const year = CN_INCOME_TAX.years[0]!;
  /** Tax for the 2026 year with the housing fund at `rate` instead of 5%. */
  const taxWithHousingFund = (gross: number, rate: number): number => {
    const deductions = year.deductions!.map((d): DeductionRule => (d.kind === 'share' && d.name.startsWith('Housing') ? { ...d, rate } : d));
    const taxable = gross - applyDeductions({ ...year, deductions }, gross, { round: Math.round, floor: Math.floor });
    return Math.round(progressive(taxable, year.bands));
  };

  const a = r(300000, '2026').assumptions!.join(' ');

  it('names Beijing and the contribution rates', () => {
    expect(a).toMatch(/Beijing/);
    expect(a).toMatch(/pension 8%, medical 2%, unemployment 0\.5%/);
    expect(a).toMatch(/7,270–36,348/);
  });

  it('the 12% housing-fund figures it quotes are what the engine gives at 12%', () => {
    expect(taxWithHousingFund(100000, 0.05)).toBe(735);
    expect(taxWithHousingFund(100000, 0.12)).toBe(525);
    expect(taxWithHousingFund(300000, 0.05)).toBe(21780);
    expect(taxWithHousingFund(300000, 0.12)).toBe(17580);
    expect(a).toMatch(/CNY 525 instead of 735/);
    expect(a).toMatch(/CNY 17,580 instead of 21,780/);
  });

  it('carries no unquantified hedge', () => {
    expect(a).not.toMatch(/slightly|may be overstated/);
  });

  it('is an employment-income figure (employee contributions applied); self-employed is refused', () => {
    expect(r(300000, '2026').incomeBasis).toBe('employment');
    expect(r(300000, '2026').assumptions![0]).toMatch(/^Computed as employment income/);
    expect(() => calcIncomeTax('CN', 300000, '2026', { incomeType: 'self-employed' })).toThrow(RangeError);
  });
});
