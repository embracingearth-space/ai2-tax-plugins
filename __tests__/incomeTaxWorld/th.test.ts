/**
 * Thailand — bracket arithmetic from the rd.go.th rate table. embracingearth.space
 * Net income = pay − 50% expense deduction (max 100,000) − 60,000 allowance
 *                  − Social Security Fund contribution (5% of wages up to the monthly ceiling):
 *   2025: ceiling 15,000/month → at most 9,000  → above THB 200,000 of pay, net = pay − 169,000
 *   2026: ceiling 17,500/month → at most 10,500 → above THB 210,000 of pay, net = pay − 170,500
 */
import { calcIncomeTax } from '../../src';

const r = (g: number, y: string) => calcIncomeTax('TH', g, y)!;

describe.each([
  ['2026', 170500],
  ['2025', 169000],
])('Thailand %s — band edges (net = gross − %d)', (y, off) => {
  it.each([
    [150000, 0], // exempt band
    [150100, 5], // 100 × 5%
    [300000, 7500], // 150,000 × 5%
    [500000, 27500], // + 200,000 × 10%
    [750000, 65000], // + 250,000 × 15%
    [1000000, 115000], // + 250,000 × 20%
    [2000000, 365000], // + 1,000,000 × 25%
    [5000000, 1265000], // + 3,000,000 × 30%
    [5000100, 1265035], // + 100 × 35%
  ])('net %d → tax %d', (net, t) => {
    const x = r(net + off, y);
    expect(x.taxable).toBe(net);
    expect(x.incomeTax).toBe(t);
    expect(x.verified).toBe(true);
  });
});

describe('Thailand — the Social Security deduction follows the wage ceiling', () => {
  it.each([
    // [gross, taxable 2025, taxable 2026]
    [150000, 7500, 7500], // 150,000 − 75,000 − 60,000 − 7,500 (5% under both ceilings)
    [200000, 31000, 30000], // − 100,000 − 60,000 − 9,000 (2025 cap) / − 10,000 (5%, under the 2026 cap)
    [300000, 131000, 129500], // capped: 9,000 / 10,500
  ])('gross %d → taxable %d (2025), %d (2026)', (g, t25, t26) => {
    expect(r(g, '2025').taxable).toBe(t25);
    expect(r(g, '2026').taxable).toBe(t26);
  });

  it('the audit case: THB 500,000 pays 10,600 (2025) and 10,450 (2026), not 11,500', () => {
    expect(r(500000, '2025').incomeTax).toBe(10600); // net 331,000: 7,500 + 31,000 × 10%
    expect(r(500000, '2026').incomeTax).toBe(10450); // net 329,500: 7,500 + 29,500 × 10%
  });
});

describe('Thailand — the assumptions', () => {
  const a = r(500000, '2026').assumptions!.join(' ');
  it('state the contribution, both ceilings and the 2026 Gazette regulation', () => {
    expect(a).toMatch(/Social Security Fund contribution/);
    expect(a).toMatch(/THB 15,000 in 2025 and 17,500 from 2026/);
    expect(a).toMatch(/Royal Gazette, 12 Dec 2025/);
  });
  it('quantify the flood-relief exception: five months at 3% instead of 5% of 17,500', () => {
    expect(5 * (0.05 - 0.03) * 17500).toBeCloseTo(1750, 6);
    expect(a).toMatch(/up to THB 1,750 less for 2026/);
  });
  it('carry no unquantified hedge', () => {
    expect(a).not.toMatch(/slightly|may be overstated/);
  });
});
