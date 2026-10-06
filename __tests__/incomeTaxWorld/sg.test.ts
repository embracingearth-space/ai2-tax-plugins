/**
 * Singapore — IRAS resident rates, Earned Income Relief and CPF Relief. embracingearth.space
 * Expected taxes are IRAS's own "gross tax payable" column of the YA 2024-onwards table.
 * 2026 (YA 2027), under 55: above S$96,000 of pay, chargeable = gross − 1,000 EIR − 19,200 CPF.
 */
import { calcIncomeTax } from '../../src';

const r = (g: number, y: string, age?: number) => calcIncomeTax('SG', g, y, age === undefined ? undefined : { age })!;

describe('Singapore 2026 (YA 2027) — band edges', () => {
  it.each([
    [26250, 0], // chargeable 0.8 × 26,250 − 1,000 = 20,000
    [38750, 200], // chargeable 30,000
    [51250, 550], // chargeable 40,000
    [100200, 3350], // chargeable 80,000
    [140200, 7950],
    [180200, 13950],
    [220200, 21150],
    [260200, 28750],
    [300200, 36550],
    [340200, 44550],
    [520200, 84150],
    [1020200, 199150],
    [1020300, 199174], // + 100 × 24%
  ])('gross %d → tax %d', (g, t) => {
    expect(r(g, '2026 (YA 2027)').incomeTax).toBe(t);
    expect(r(g, '2026 (YA 2027)').verified).toBe(true);
  });

  it('age changes Earned Income Relief and the CPF rate', () => {
    // age 64: EIR 8,000, CPF 12.5% × 96,000 = 12,000 → chargeable 180,000 → 13,950 + 20,000 × 18%
    expect(r(200000, '2026 (YA 2027)', 64).taxable).toBe(180000);
    expect(r(200000, '2026 (YA 2027)', 64).incomeTax).toBe(17550);
  });
});

describe('Singapore 2025 (YA 2026)', () => {
  it('uses the 2025 OW ceiling of S$7,400/month', () => {
    // 200,000 − 1,000 − 20% × 88,800 = 181,240 → 13,950 + 21,240 × 18% = 17,773.2
    expect(r(200000, '2025 (YA 2026)').taxable).toBe(181240);
    expect(r(200000, '2025 (YA 2026)').incomeTax).toBe(17773);
  });
});
