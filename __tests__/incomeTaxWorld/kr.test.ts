/**
 * South Korea — income tax + local income tax. embracingearth.space
 */
import { calcIncomeTax } from '../../src';
import { progressive } from '../../src/data/incomeTaxMath';
import { KR_INCOME_TAX } from '../../src/data/incomeTaxWorld/kr';

const local = (r: ReturnType<typeof calcIncomeTax>) => r!.levies.find((l) => l.name.startsWith('Local income tax'))?.amount ?? 0;
const credit = (r: ReturnType<typeof calcIncomeTax>) => r!.offsets.reduce((s, o) => s + o.amount, 0);

describe('South Korea — official NTS example', () => {
  it('official: calculated tax on a 2025 tax base of 30,000,000 won is 3,240,000 won', () => {
    // https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2228&cntntsId=7667 — 30,000,000 × 15% − 1,260,000
    expect(progressive(30000000, KR_INCOME_TAX.years[1]!.bands)).toBeCloseTo(3240000, 4);
  });
});

describe('South Korea — band edges (on the tax base)', () => {
  const bands = KR_INCOME_TAX.years[0]!.bands;
  it.each([
    [14000000, 840000], // 14m × 6%
    [14001000, 840150], // + 1,000 × 15%
    [50000000, 6240000], // 840,000 + 36m × 15%
    [88000000, 15360000], // + 38m × 24%
    [150000000, 37060000], // + 62m × 35%
    [300000000, 94060000], // + 150m × 38%
    [500000000, 174060000], // + 200m × 40%
    [1000000000, 384060000], // + 500m × 42%
    [1000001000, 384060450], // + 1,000 × 45%
  ])('base %d won → %d won (matches the NTS progressive-deduction table)', (base, tax) => {
    expect(progressive(base, bands)).toBeCloseTo(tax, 4);
  });
});

describe('South Korea — gross salary to tax (derived from the statute — not an official example)', () => {
  it('2026, 50,000,000 won: credit held at the 660,000 floor of the salary cap', () => {
    // Earned deduction 12,000,000 + 5% × 5,000,000 = 12,250,000; basic 1,500,000.
    // Premiums: pension 4.75% 2,375,000; NHI 3.595% 1,797,500; LTC 0.4724% 236,200; EI 0.9% 450,000.
    // Base 50,000,000 − 18,608,700 = 31,391,300. Tax 840,000 + 17,391,300 × 15% = 3,448,695.
    // Credit 715,000 + 30% × 2,148,695 = 1,359,608.5; cap 740,000 − 17m × 0.008 = 604,000 → not below 660,000.
    // Local 10% × (3,448,695 − 660,000) = 278,869.5.
    const r = calcIncomeTax('KR', 50000000, '2026')!;
    expect(r.taxable).toBe(31391300);
    expect(r.incomeTax).toBe(3448695);
    expect(credit(r)).toBe(660000);
    expect(local(r)).toBe(278870);
    expect(r.verified).toBe(true);
  });

  it('2026, 20,000,000 won: credit is 55% of tax below 1.3m won of tax', () => {
    // Earned deduction 7,500,000 + 15% × 5m = 8,250,000; basic 1,500,000; premiums 950,000 + 719,000 + 94,480 + 180,000.
    // Base 8,306,520; tax 6% = 498,391.2; credit 55% = 274,115.16; local 10% × (498,391.2 − 274,115) = 22,427.6.
    const r = calcIncomeTax('KR', 20000000, '2026')!;
    expect(r.taxable).toBe(8306520);
    expect(credit(r)).toBe(274115);
    expect(local(r)).toBe(22428);
  });

  it('credit salary cap: 740,000 won up to 33m won of salary', () => {
    // 33,000,000: earned 7.5m + 15% × 18m = 10,200,000; basic 1.5m; premiums 9.7174% = 3,206,742.
    // Base 18,093,258; tax 840,000 + 4,093,258 × 15% = 1,453,988.7; credit 715,000 + 30% × 153,988.7 = 761,196.6 → cap 740,000.
    expect(credit(calcIncomeTax('KR', 33000000, '2026'))).toBe(740000);
  });

  it('2025 uses 4.5% pension and 7.09% NHI', () => {
    // 50m: premiums 2,250,000 + 1,772,500 + 229,550 + 450,000 = 4,702,050; base 50m − 12.25m − 1.5m − 4,702,050 = 31,547,950.
    expect(calcIncomeTax('KR', 50000000, '2025')!.taxable).toBe(31547950);
  });
});
