/**
 * Japan — national income tax + reconstruction surtax. embracingearth.space
 */
import { calcIncomeTax } from '../../src';
import { progressive } from '../../src/data/incomeTaxMath';
import { JP_INCOME_TAX } from '../../src/data/incomeTaxWorld/jp';

const surtax = (r: ReturnType<typeof calcIncomeTax>) => r!.levies.find((l) => l.name.startsWith('Special reconstruction'))?.amount ?? 0;
const bands = JP_INCOME_TAX.years[0]!.bands;

describe('Japan — official NTA example', () => {
  it('official: tax on taxable income of ¥7,000,000 is ¥974,000 before the surtax (NTA No.2260)', () => {
    // https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm — 7,000,000 × 23% − 636,000 = 974,000
    expect(progressive(7000000, bands)).toBeCloseTo(974000, 6);
  });
});

describe('Japan — band edges (on taxable income)', () => {
  it.each([
    [1950000, 97500], // 1,950,000 × 5%
    [1951000, 97600], // + 1,000 × 10%
    [3300000, 232500], // 97,500 + 1,350,000 × 10%
    [6950000, 962500], // 232,500 + 3,650,000 × 20%
    [9000000, 1434000], // 962,500 + 2,050,000 × 23%
    [18000000, 4404000], // 1,434,000 + 9,000,000 × 33%
    [40000000, 13204000], // 4,404,000 + 22,000,000 × 40%
    [40001000, 13204450], // + 1,000 × 45%
  ])('taxable ¥%d → ¥%d', (taxable, tax) => {
    expect(progressive(taxable, bands)).toBeCloseTo(tax, 6);
  });
});

describe('Japan — gross salary to tax (derived from the official formula — not an official example)', () => {
  it('2026, ¥5,000,000 salary', () => {
    // Employment deduction 5,000,000 × 20% + 440,000 = 1,440,000; total income 3,560,000 → basic 1,040,000.
    // Premiums: health 4.925% 246,250 + pension 9.15% 457,500 + employment 0.5% 25,000 = 728,750.
    // Taxable 5,000,000 − 1,440,000 − 1,040,000 − 728,750 = 1,791,250 → 1,791,000. Tax 5% = 89,550; surtax 2.1% = 1,880.55.
    const r = calcIncomeTax('JP', 5000000, '2026')!;
    expect(r.taxable).toBe(1791000);
    expect(r.incomeTax).toBe(89550);
    expect(surtax(r)).toBe(1881);
    expect(r.verified).toBe(true);
  });

  it('2025, ¥5,000,000 salary uses the 2025 basic deduction (¥680,000 at total income 3.56m) and premium rates', () => {
    // Premiums: 247,750 + 457,500 + 27,500 = 732,750. Taxable 5,000,000 − 1,440,000 − 680,000 − 732,750 = 2,147,250 → 2,147,000.
    // Tax 97,500 + 197,000 × 10% = 117,200; surtax 2,461.2.
    const r = calcIncomeTax('JP', 5000000, '2025')!;
    expect(r.taxable).toBe(2147000);
    expect(r.incomeTax).toBe(117200);
    expect(surtax(r)).toBe(2461);
  });

  it('2026, ¥10,000,000 salary: employment deduction capped, pension premium capped at ¥650,000 × 12', () => {
    // Deduction cap 1,950,000; total income 8,050,000 → basic 620,000. Premiums: 492,500 + 7,800,000 × 9.15% (713,700) + 50,000 = 1,256,200.
    // Taxable 6,173,800 → 6,173,000. Tax 232,500 + 2,873,000 × 20% = 807,100; surtax 16,949.1.
    const r = calcIncomeTax('JP', 10000000, '2026')!;
    expect(r.taxable).toBe(6173000);
    expect(r.incomeTax).toBe(807100);
    expect(surtax(r)).toBe(16949);
  });

  it('2026: minimum employment deduction ¥740,000 + basic ¥1,040,000 leave ¥1,780,000 of salary untaxed', () => {
    // 1,780,000 − 740,000 − 1,040,000 = 0 before premiums.
    expect(calcIncomeTax('JP', 1780000, '2026')!.totalTax).toBe(0);
  });

  it('says the inhabitant tax is excluded and premiums are deducted, not charged', () => {
    const a = calcIncomeTax('JP', 5000000, '2026')!.assumptions!.join(' ');
    expect(a).toMatch(/Inhabitant tax/);
    expect(a).toMatch(/DEDUCTED/);
  });
});
