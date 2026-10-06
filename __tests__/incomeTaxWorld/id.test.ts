/**
 * Indonesia — Art. 17 band arithmetic (UU 7/2021). embracingearth.space
 * Taxable = gross − biaya jabatan (5%, max 6,000,000) − JHT 2% − PTKP 54,000,000.
 * From gross 120,000,000 up, taxable = 0.98 × gross − 60,000,000.
 */
import { calcIncomeTax } from '../../src';

const r = (g: number, y: string) => calcIncomeTax('ID', g, y)!;

describe.each(['2026', '2025'])('Indonesia %s', (y) => {
  it.each([
    [50000000, 0, 0], // 50m − 2.5m − 1m − 54m < 0
    [60000000, 1800000, 90000], // 60m − 3m − 1.2m − 54m = 1.8m × 5%
    [120000000, 57600000, 2880000], // 120 − 6 − 2.4 − 54 = 57.6m × 5%
    [125000000, 62500000, 3375000], // 3,000,000 + 2.5m × 15%
    [320000000, 253600000, 32400000], // 3m + 190m × 15% = 31.5m; + 3.6m × 25%
    [575000000, 503500000, 95050000], // 31.5m + 250m × 25% = 94m; + 3.5m × 30%
    [5200000000, 5036000000, 1456600000], // 94m + 4.5bn × 30% = 1,444m; + 36m × 35%
  ])('gross %d → taxable %d, tax %d', (g, taxable, t) => {
    expect(r(g, y).taxable).toBe(taxable);
    expect(r(g, y).incomeTax).toBe(t);
    expect(r(g, y).verified).toBe(true);
  });

  it('biaya jabatan caps at IDR 6,000,000 (reached at gross 120m)', () => {
    expect(r(100000000, y).taxable).toBe(100000000 - 5000000 - 2000000 - 54000000);
    expect(r(200000000, y).taxable).toBe(200000000 - 6000000 - 4000000 - 54000000);
  });

  it('says BPJS contributions are not included', () => {
    expect(r(200000000, y).assumptions!.join(' ')).toMatch(/BPJS/);
  });
});
