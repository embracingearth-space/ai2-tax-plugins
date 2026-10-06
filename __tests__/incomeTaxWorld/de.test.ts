/**
 * Germany — §32a EStG tariff, Soli, church tax. embracingearth.space
 * gross = zvE + 1,266 (Arbeitnehmer-Pauschbetrag 1,230 + Sonderausgaben-Pauschbetrag 36).
 */
import { calcIncomeTax } from '../../src';

const P = 1266;
const at = (zvE: number, year: string, opts?: { churchTaxRate?: number }) => calcIncomeTax('DE', zvE + P, year, opts)!;
const levy = (r: ReturnType<typeof at>, name: string) => r.levies.find((l) => l.name === name)?.amount ?? 0;

describe('Germany — derived from the official §32a formula — not an official example', () => {
  it.each([
    ['2026', 30000, 4217],
    ['2026', 50000, 10548],
    ['2026', 100000, 30864],
    ['2025', 30000, 4303],
    ['2025', 50000, 10691],
    ['2025', 100000, 31088],
  ])('%s: zvE %d → income tax %d', (year, zvE, tax) => {
    const r = at(zvE, year);
    expect(r.taxable).toBe(zvE);
    expect(r.incomeTax).toBe(tax);
    expect(r.verified).toBe(true);
  });
});

describe('Germany — zone boundaries (formula arithmetic, tax floored to whole euros)', () => {
  it.each([
    // 2026: zone 1 to 12,348 → 0; zone 2 end 17,799: y = 0.5451, (914.51y + 1400)y = 1034.87 → 1034
    ['2026', 12348, 0], ['2026', 12349, 0], ['2026', 17799, 1034], ['2026', 17800, 1035],
    // zone 3 end 69,878 → 18,213.x; zone 4: 0.42 × 69,879 − 11,135.63 = 18,213.55
    ['2026', 69878, 18213], ['2026', 69879, 18213],
    // 0.42 × 277,825 − 11,135.63 = 105,550.87; 0.45 × 277,826 − 19,470.38 = 105,551.32
    ['2026', 277825, 105550], ['2026', 277826, 105551],
    ['2025', 12096, 0], ['2025', 17443, 1015], ['2025', 68480, 17849], ['2025', 68481, 17850],
    ['2025', 277825, 105774], ['2025', 277826, 105775],
  ])('%s: zvE %d → %d', (year, zvE, tax) => {
    expect(at(zvE as number, year as string).incomeTax).toBe(tax);
  });
});

describe('Germany — solidarity surcharge and church tax', () => {
  it('no Soli while income tax is within the Freigrenze (2026: 18,213 ≤ 20,350)', () => {
    expect(levy(at(69878, '2026'), 'Solidaritätszuschlag')).toBe(0);
  });
  it('Milderungszone: zvE 100,000 (2026) → 11.9% × (30,864 − 20,350) = 1,251.17', () => {
    expect(levy(at(100000, '2026'), 'Solidaritätszuschlag')).toBe(1251);
  });
  it('Milderungszone 2025 uses the 19,950 Freigrenze: 11.9% × (31,088 − 19,950) = 1,325.42', () => {
    expect(levy(at(100000, '2025'), 'Solidaritätszuschlag')).toBe(1325);
  });
  it('full 5.5% above the transition: zvE 300,000 (2026) tax 115,529 → 6,354.10', () => {
    const r = at(300000, '2026');
    expect(r.incomeTax).toBe(115529);
    expect(levy(r, 'Solidaritätszuschlag')).toBe(6354);
  });
  it('church tax only with churchTaxRate: 9% × 30,864 = 2,777.76', () => {
    expect(levy(at(100000, '2026'), 'Kirchensteuer')).toBe(0);
    expect(levy(at(100000, '2026', { churchTaxRate: 0.09 }), 'Kirchensteuer')).toBe(2778);
  });
  it('says Vorsorgeaufwendungen are not deducted and the estimate overstates tax', () => {
    expect(at(50000, '2026').assumptions!.join(' ')).toMatch(/OVERSTATES/);
  });
});
