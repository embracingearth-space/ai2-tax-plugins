/**
 * Philippines — bracket arithmetic from the RR 11-2018 annual table (its cumulative
 * column: 22,500 / 102,500 / 402,500 / 2,202,500), hand-computed. embracingearth.space
 *
 * Excluded employee contributions (m = gross / 12):
 *   SSS        12 × 5% × m clamped to 5,000–35,000      (max 21,000)
 *   PhilHealth 12 × 2.5% × m clamped to 10,000–100,000  (min 3,000, max 30,000)
 *   Pag-IBIG   12 × 2% × min(m, 10,000); 1% when m ≤ 1,500 (max 2,400)
 * So taxable = 0.925 × gross − 2,400 for gross 120,000–420,000,
 *              0.975 × gross − 23,400 for 420,000–1,200,000,
 *              gross − 53,400 from 1,200,000.
 */
import { calcIncomeTax } from '../../src';

const r = (g: number, y: string) => calcIncomeTax('PH', g, y)!;

describe.each(['2026', '2025'])('Philippines %s', (y) => {
  it.each([
    // [gross, taxable, tax]
    [272000, 249200, 0], // inside the 0% band
    [280000, 256600, 990], // 6,600 × 15%
    [400000, 367600, 17640], // 117,600 × 15% — the audit case (19,500 with SSS alone)
    [1000000, 951600, 140400], // 102,500 + 151,600 × 25%
    [1253400, 1200000, 202500], // 102,500 + 400,000 × 25%
    [2053400, 2000000, 402500],
    [8053400, 8000000, 2202500],
    [8053500, 8000100, 2202535], // + 100 × 35%
  ])('gross %d → taxable %d, tax %d', (g, taxable, tax) => {
    const x = r(g, y);
    expect(x.taxable).toBeCloseTo(taxable, 6);
    expect(x.incomeTax).toBe(tax);
    expect(x.verified).toBe(true);
  });

  it('applies each fund\'s floor, rate step and cap', () => {
    // m = 1,500: SSS floor 3,000; PhilHealth floor 3,000; Pag-IBIG 1% × 1,500 × 12 = 180
    expect(r(18000, y).taxable).toBe(18000 - 3000 - 3000 - 180);
    // m = 4,000: SSS floor 3,000; PhilHealth floor 3,000; Pag-IBIG 2% × 4,000 × 12 = 960
    expect(r(48000, y).taxable).toBe(48000 - 3000 - 3000 - 960);
    // m = 20,000: SSS 12,000; PhilHealth 6,000; Pag-IBIG cap 2,400
    expect(r(240000, y).taxable).toBe(240000 - 12000 - 6000 - 2400);
  });
});

describe('Philippines — the assumptions', () => {
  const a = r(400000, '2026').assumptions!.join(' ');
  it('name all three exclusions and their limits', () => {
    expect(a).toMatch(/SSS 5% of the Monthly Salary Credit/);
    expect(a).toMatch(/PhilHealth 2\.5% of monthly basic salary \(PHP 10,000–100,000/);
    expect(a).toMatch(/Pag-IBIG 2% of up to PHP 10,000 a month/);
  });
  it('carry no unquantified hedge', () => {
    expect(a).not.toMatch(/slightly|may be overstated/);
  });
});
