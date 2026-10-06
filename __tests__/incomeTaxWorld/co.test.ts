/**
 * Colombia — art. 241 ET table in UVT, 25% labour exemption (cap 790 UVT).
 * Source: DIAN Normograma (https), verified. No official DIAN worked example captured.
 * Taxable = gross − min(25% × gross, 790 UVT). INCR contributions are not subtracted (rates unverified).
 * embracingearth.space
 */
import { calcIncomeTax } from '../../src';

const r = (g: number, y: string) => calcIncomeTax('CO', g, y)!;

describe('Colombia 2026 (UVT 52,374; exemption cap 41,375,000) — verified', () => {
  // At 1,700 / 8,670 / 31,000 UVT the lower row gives 0.1 UVT more than the next row's fixed amount (the art. 241 fixed amounts are rounded).
  it.each([
    [60000000, 0], // taxable 45,000,000 = 859.2 UVT < 1,090
    [76116880, 0], // taxable 57,087,660 = 1,090 UVT exactly
    [118714400, 6070147], // taxable 89,035,800 = 1,700 UVT, still in the 19% row: 610 × 19% = 115.9 UVT × 52,374
    [256108400, 41270712], // cap binds: taxable 214,733,400 = 4,100 UVT → 788 UVT
    [495457580, 120255941], // taxable 454,082,580 = 8,670 UVT, 33% row: 788 + 4,570 × 33% = 2,296.1 UVT
    [1034909780, 309058974], // taxable 993,534,780 = 18,970 UVT → 5,901 UVT
    [1664969000, 542180885], // taxable 1,623,594,000 = 31,000 UVT, 37% row: 5,901 + 12,030 × 37% = 10,352.1 UVT
  ])('gross %d → tax %d', (g, t) => {
    expect(r(g, '2026').incomeTax).toBe(t);
    expect(r(g, '2026').verified).toBe(true);
  });

  it('COP 100,000,000 → taxable 75,000,000 = 1,432.01 UVT → 342.01 × 19% = 64.98 UVT', () => {
    // (75,000,000 / 52,374 − 1,090) × 0.19 × 52,374 = 14,250,000 − 10,846,655.4 = 3,403,344.6
    expect(r(100000000, '2026').taxable).toBe(75000000);
    expect(r(100000000, '2026').incomeTax).toBe(3403345);
  });

  it('just above 31,000 UVT: +100 taxable at 39%', () => {
    expect(r(1664969100, '2026').incomeTax).toBe(542175687);
  });

  it('says contributions are not included', () => {
    expect(r(100000000, '2026').assumptions!.join(' ')).toMatch(/social-security contributions.*not included/);
  });
});

describe('Colombia 2025 (UVT 49,799; exemption cap 39,341,000) — verified', () => {
  it.each([
    [243516900, 39241612], // taxable 204,175,900 = 4,100 UVT → 788 UVT × 49,799
    [1583110000, 515524228], // taxable 1,543,769,000 = 31,000 UVT, 37% row: 10,352.1 UVT × 49,799
  ])('gross %d → tax %d', (g, t) => {
    expect(r(g, '2025').incomeTax).toBe(t);
    expect(r(g, '2025').verified).toBe(true);
  });
});
