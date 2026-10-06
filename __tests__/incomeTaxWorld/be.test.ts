/**
 * Belgium — federal tax, income years 2026 (AY 2027) and 2025 (AY 2026). embracingearth.space
 */
import { calcIncomeTax } from '../../src';
import { BE_INCOME_TAX } from '../../src/data/incomeTaxWorld/be';
import { progressive } from '../../src/data/incomeTaxMath';

const bands = (label: string) => BE_INCOME_TAX.years.find((y) => y.taxYear === label)!.bands;

describe('Belgium — official SPF Finances example', () => {
  it('official: taxable 38,000 (income year 2025) → 13,212 − 2,727.50 = 10,484.50', () => {
    // https://fin.belgium.be/fr/particuliers/declaration-impot/revenus/taux-imposition
    const b = bands('2025 (AY 2026)');
    expect(progressive(38000, b)).toBeCloseTo(13212, 6);
    expect(progressive(38000, b) - 10910 * 0.25).toBeCloseTo(10484.5, 6);
  });
});

describe('Belgium (derived from the official formula — not an official example)', () => {
  it('€40,000 income year 2026: 13.07% ONSS → 34,772', () => {
    const r = calcIncomeTax('BE', 40000, '2026 (AY 2027)')!;
    expect(r.taxable).toBe(34772);
    // 16,720 × 25% + 12,790 × 40% + 5,262 × 45% = 4,180 + 5,116 + 2,367.90 = 11,663.90
    expect(r.incomeTax).toBe(11664);
    // 11,180 × 25% = 2,795
    expect(r.totalTax).toBe(11664 - 2795);
    expect(r.verified).toBe(true);
  });

  it('band edges 2026: 16,720 / 29,510 / 51,070', () => {
    const b = bands('2026 (AY 2027)');
    expect(progressive(16720, b)).toBeCloseTo(4180, 6);
    // 4,180 + 12,790 × 40% = 9,296
    expect(progressive(29510, b)).toBeCloseTo(9296, 6);
    // 9,296 + 21,560 × 45% (9,702) = 18,998
    expect(progressive(51070, b)).toBeCloseTo(18998, 6);
    expect(progressive(51170, b) - progressive(51070, b)).toBeCloseTo(50, 6);
  });

  it('no tax while taxable income is within the tax-free amount', () => {
    // 12,000 × 0.8693 = 10,431.60 < 11,180
    expect(calcIncomeTax('BE', 12000, '2026 (AY 2027)')!.totalTax).toBe(0);
  });

  it('says the regional and communal surcharges are excluded', () => {
    expect(calcIncomeTax('BE', 40000, '2025 (AY 2026)')!.assumptions!.join(' ')).toMatch(/communal surcharge.*NOT included/);
  });
});
