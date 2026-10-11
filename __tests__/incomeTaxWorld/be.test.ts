/**
 * Belgium — federal tax, income years 2026 (AY 2027) and 2025 (AY 2026). embracingearth.space
 */
import { calcIncomeTax } from '../../src';
import { BE_INCOME_TAX } from '../../src/data/incomeTaxWorld/be';
import { progressive } from '../../src/data/incomeTaxMath';

const bands = (label: string) => BE_INCOME_TAX.years.find((y) => y.taxYear === label)!.bands;
const deduction = (r: ReturnType<typeof calcIncomeTax>) => r!.gross - r!.taxable;

describe('Belgium — official SPF Finances example', () => {
  it('official: taxable 38,000 (income year 2025) → 13,212 − 2,727.50 = 10,484.50', () => {
    // https://fin.belgium.be/en/private-individuals/tax-return/income/tax-rates ("Peter")
    const b = bands('2025 (AY 2026)');
    expect(progressive(38000, b)).toBeCloseTo(13212, 6);
    expect(progressive(38000, b) - 10910 * 0.25).toBeCloseTo(10484.5, 6);
  });
});

describe('Belgium — flat-rate professional expenses (derived from art. 51 CIR 92 — not an official example)', () => {
  it('€50,000 income year 2026: ONSS 6,535, forfait capped at 6,070 → taxable 37,395 → 9,956', () => {
    const r = calcIncomeTax('BE', 50000, '2026 (AY 2027)')!;
    // 50,000 − 13.07% = 43,465; 30% = 13,039.50 > cap 6,070
    expect(r.taxable).toBe(37395);
    // 16,720 × 25% + 12,790 × 40% + 7,885 × 45% = 4,180 + 5,116 + 3,548.25 = 12,844.25
    expect(r.incomeTax).toBe(12844);
    // tax-free amount 11,550 × 25% = 2,887.50
    expect(r.totalTax).toBe(12844 - 2888);
    expect(r.verified).toBe(true);
  });

  it('€50,000 income year 2025: forfait capped at 5,930 → taxable 37,535 → 10,275', () => {
    const r = calcIncomeTax('BE', 50000, '2025 (AY 2026)')!;
    expect(r.taxable).toBe(37535);
    // 16,320 × 25% + 12,480 × 40% + 8,735 × 45% = 4,080 + 4,992 + 3,930.75 = 13,002.75
    expect(r.incomeTax).toBe(13003);
    // 10,910 × 25% = 2,727.50
    expect(r.totalTax).toBe(13003 - 2728);
  });

  it('€40,000 income year 2026: 34,772 after ONSS, less 6,070 → 28,702 → 6,085', () => {
    const r = calcIncomeTax('BE', 40000, '2026 (AY 2027)')!;
    expect(r.taxable).toBe(28702);
    // 4,180 + 11,982 × 40% = 8,972.80
    expect(r.incomeTax).toBe(8973);
    expect(r.totalTax).toBe(8973 - 2888);
  });

  it('below the cap the forfait is 30% of pay after ONSS: €20,000 → 17,386 − 5,215.80 = 12,170.20', () => {
    const r = calcIncomeTax('BE', 20000, '2026 (AY 2027)')!;
    expect(r.taxable).toBeCloseTo(12170.2, 6);
    expect(deduction(r)).toBeCloseTo(2614 + 5215.8, 6);
    // 12,170.20 × 25% = 3,042.55 − 2,887.50 = 155.05
    expect(r.totalTax).toBe(3043 - 2888);
  });

  it('the cap binds from about €23,275 gross (6,070 / 30% = 20,233.33 after ONSS, ÷ 0.8693)', () => {
    expect(deduction(calcIncomeTax('BE', 23300, '2026 (AY 2027)'))).toBeCloseTo(23300 * 0.1307 + 6070, 6);
    expect(deduction(calcIncomeTax('BE', 23200, '2026 (AY 2027)'))).toBeLessThan(23200 * 0.1307 + 6070);
  });
});

describe('Belgium — bands and tax-free amount', () => {
  it('band edges 2026: 16,720 / 29,510 / 51,070', () => {
    const b = bands('2026 (AY 2027)');
    expect(progressive(16720, b)).toBeCloseTo(4180, 6);
    // 4,180 + 12,790 × 40% = 9,296
    expect(progressive(29510, b)).toBeCloseTo(9296, 6);
    // 9,296 + 21,560 × 45% (9,702) = 18,998
    expect(progressive(51070, b)).toBeCloseTo(18998, 6);
    expect(progressive(51170, b) - progressive(51070, b)).toBeCloseTo(50, 6);
  });

  it('income year 2026 uses the 11,550 tax-free amount (law of 15 July 2026), not the old 11,180', () => {
    const credit = calcIncomeTax('BE', 50000, '2026 (AY 2027)')!.offsets[0]!;
    expect(credit.amount).toBe(2888);
  });

  it('no tax while taxable income is within the tax-free amount', () => {
    // 12,000 × 0.8693 = 10,431.60; less 30% = 7,302.12 < 11,550
    expect(calcIncomeTax('BE', 12000, '2026 (AY 2027)')!.totalTax).toBe(0);
  });

  it('cites the SPF Finances indexation notice of each assessment year', () => {
    expect(calcIncomeTax('BE', 40000, '2026 (AY 2027)')!.source).toContain('fisconet/document/042cb526');
    expect(calcIncomeTax('BE', 40000, '2025 (AY 2026)')!.source).toContain('fisconet/document/934106e5');
  });

  it('says the regional and communal surcharges are excluded and the forfait is applied', () => {
    const a = calcIncomeTax('BE', 40000, '2025 (AY 2026)')!.assumptions!.join(' ');
    expect(a).toMatch(/communal surcharge.*NOT included/);
    expect(a).toMatch(/forfait frais professionnels, art\. 51 CIR 92\) is applied/);
  });
});
