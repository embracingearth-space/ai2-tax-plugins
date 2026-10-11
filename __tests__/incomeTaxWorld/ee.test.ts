/**
 * Estonia — 22% after the employee contributions and the basic exemption.
 * Anchored on EMTA's own payroll examples, scaled to a year. embracingearth.space
 */
import { calcIncomeTax } from '../../src';

describe('Estonia — EMTA worked examples, ×12', () => {
  it('2026: EMTA "Näide 13" (1,700/month, II pillar 2%): (1,700 − 34 − 27.20 − 700) × 22% = 206.54 a month', () => {
    // https://emta.ee/node/330/chapter/44606/pdf — 12 × 1,700 = 20,400:
    // (20,400 − 326.40 − 408 − 8,400) × 22% = 11,265.60 × 22% = 2,478.43 (12 × 206.54 = 2,478.48)
    const r = calcIncomeTax('EE', 20400, '2026')!;
    expect(r.taxable).toBeCloseTo(11265.6, 6);
    expect(r.totalTax).toBe(2478);
    expect(r.verified).toBe(true);
  });

  it('2025: the taper is fed gross pay — EMTA TSD example 2: 1,800/month → exemption 218/month', () => {
    // 12 × 1,800 = 21,600: exemption 7,848 − 7,848/10,800 × 7,200 = 2,616 (= 12 × 218)
    // (21,600 − 345.60 − 432 − 2,616) × 22% = 18,206.40 × 22% = 4,005.41 (EMTA's example uses a 4% II pillar)
    const r = calcIncomeTax('EE', 21600, '2025')!;
    expect(r.taxable).toBeCloseTo(18206.4, 6);
    expect(r.totalTax).toBe(4005);
  });
});

describe('Estonia (own arithmetic from the published rates — not official examples)', () => {
  it('2026: flat 8,400 exemption after the 3.6% of contributions', () => {
    // (60,000 × 0.964 − 8,400) × 22% = 49,440 × 22% = 10,876.80 (was 11,352 without the contributions)
    expect(calcIncomeTax('EE', 60000, '2026')!.totalTax).toBe(10877);
    // 8,700 × 0.964 = 8,386.80 < 8,400
    expect(calcIncomeTax('EE', 8700, '2026')!.totalTax).toBe(0);
  });

  it('2025: exemption tapers between 14,400 and 25,200 of gross income', () => {
    // (14,400 × 0.964 − 7,848) × 22% = 6,033.60 × 22% = 1,327.39
    expect(calcIncomeTax('EE', 14400, '2025')!.totalTax).toBe(1327);
    // exemption 7,848 − 7,848/10,800 × 5,600 = 3,778.67; (19,280 − 3,778.67) × 22% = 3,410.29
    expect(calcIncomeTax('EE', 20000, '2025')!.totalTax).toBe(3410);
    // no exemption left: 24,292.80 × 22% = 5,344.42
    expect(calcIncomeTax('EE', 25200, '2025')!.totalTax).toBe(5344);
  });

  it('names both contributions as deductions and says the II-pillar rate is the default 2%', () => {
    const a = calcIncomeTax('EE', 30000, '2026')!.assumptions!.join(' ');
    expect(a).toMatch(/unemployment-insurance premium \(1\.6%\)/);
    expect(a).toMatch(/default 2%/);
    expect(a).not.toMatch(/slightly overstated/);
  });
});
