/**
 * Vietnam — bracket arithmetic. embracingearth.space
 * 2026 (Law 109/2025 Art. 9): taxable = gross − 186,000,000.
 * 2025 (Law 04/2007 as amended, Art. 22): taxable = gross − 132,000,000.
 */
import { calcIncomeTax } from '../../src';

const r = (g: number, y: string) => calcIncomeTax('VN', g, y)!;

describe('Vietnam 2026 — five brackets, verified', () => {
  it.each([
    [186000000, 0],
    [306000000, 6000000], // 120m × 5%
    [306000100, 6000010], // + 100 × 10%
    [546000000, 30000000], // + 240m × 10%
    [906000000, 102000000], // + 360m × 20%
    [1386000000, 246000000], // + 480m × 30%
    [1386000100, 246000035], // + 100 × 35%
  ])('gross %d → tax %d', (g, t) => {
    expect(r(g, '2026').incomeTax).toBe(t);
    expect(r(g, '2026').verified).toBe(true);
  });
});

describe('Vietnam 2025 — seven brackets, unverified family deduction', () => {
  it.each([
    [192000000, 3000000], // 60m × 5%
    [192000100, 3000010], // + 100 × 10%
    [252000000, 9000000], // + 60m × 10%
    [348000000, 23400000], // + 96m × 15%
    [516000000, 57000000], // + 168m × 20%
    [756000000, 117000000], // + 240m × 25%
    [1092000000, 217800000], // + 336m × 30%
    [1092000100, 217800035], // + 100 × 35%
  ])('gross %d → tax %d', (g, t) => {
    expect(r(g, '2025').incomeTax).toBe(t);
    expect(r(g, '2025').verified).toBe(false);
  });

  it('explains why 2025 is unverified', () => {
    expect(r(500000000, '2025').assumptions!.join(' ')).toMatch(/Resolution 954/);
  });
});

it('says insurance contributions are not included', () => {
  expect(r(500000000, '2026').assumptions!.join(' ')).toMatch(/social, health and unemployment insurance/);
});
