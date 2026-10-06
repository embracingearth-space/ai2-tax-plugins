/**
 * China — bracket arithmetic. embracingearth.space
 * Taxable = gross − 60,000 (STA Order 57). Bands: STA Annex 1 comprehensive-income table.
 * Expectations also equal taxable × rate − quick deduction (0/2,520/16,920/31,920/52,920/85,920/181,920).
 */
import { calcIncomeTax } from '../../src';

const r = (g: number, y: string) => calcIncomeTax('CN', g, y)!;

describe.each(['2026', '2025'])('China %s — seven brackets, verified', (y) => {
  it.each([
    [60000, 0],
    [96000, 1080], // 36,000 × 3%
    [96100, 1090], // + 100 × 10%
    [204000, 11880], // + 108,000 × 10%
    [204100, 11900], // + 100 × 20%
    [360000, 43080], // + 156,000 × 20%
    [360100, 43105], // + 100 × 25%
    [480000, 73080], // + 120,000 × 25%
    [480100, 73110], // + 100 × 30%
    [720000, 145080], // + 240,000 × 30%
    [720100, 145115], // + 100 × 35%
    [1020000, 250080], // + 300,000 × 35%
    [1020100, 250125], // + 100 × 45%
  ])('gross %d → tax %d', (g, t) => {
    expect(r(g, y).incomeTax).toBe(t);
    expect(r(g, y).verified).toBe(true);
  });
});

it('says social insurance is not included and names Beijing as default', () => {
  const a = r(300000, '2026').assumptions!.join(' ');
  expect(a).toMatch(/social insurance/);
  expect(a).toMatch(/Beijing/);
});
