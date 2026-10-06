/**
 * Switzerland — direct federal tax (Art. 36 DBG). embracingearth.space
 * Expectations derived from the ESTV tariff formula — not official examples.
 */
import { calcIncomeTax } from '../../src';

describe('Switzerland federal tax (derived from the official formula — not an official example)', () => {
  it('CHF 100,000 (2026): AHV 5.3%, ALV 1.1%, 2,000 + 1,800 → 89,800', () => {
    const r = calcIncomeTax('CH', 100000, '2026')!;
    expect(r.taxable).toBe(89800);
    // 138.60 + 10,300 × 0.88% + 14,500 × 2.64% + 18,200 × 2.97% + 5,900 × 5.94% + 7,700 × 6.6%
    // = 138.60 + 90.64 + 382.80 + 540.54 + 350.46 + 508.20 = 2,011.24
    expect(r.incomeTax).toBe(2011);
    expect(r.verified).toBe(true);
  });

  it('tax below CHF 25 is not levied; income taken in CHF 100 steps', () => {
    // 23,000 → 17,728 → 17,700: 2,500 × 0.77% = 19.25 < 25 → nil
    expect(calcIncomeTax('CH', 23000, '2026')!.incomeTax).toBe(0);
    // 24,000 → 18,664 → 18,600: 3,400 × 0.77% = 26.18
    expect(calcIncomeTax('CH', 24000, '2026')!.incomeTax).toBe(26);
    // 20,000 → 14,920: inside the 15,200 zero band
    expect(calcIncomeTax('CH', 20000, '2026')!.incomeTax).toBe(0);
  });

  it('flat 11.5% of the whole income from CHF 794,000 (2026)', () => {
    // 1,000,000 − 53,000 − 1,630.20 − 3,800 = 941,569.80 → 941,500 × 11.5% = 108,272.50
    expect(calcIncomeTax('CH', 1000000, '2026')!.incomeTax).toBe(108272);
  });

  it('2025 uses the 2025 tariff (76,100 / 82,000 / 108,800 thresholds)', () => {
    // 89,800: 138.60 + 90.64 + 382.80 + 18,100 × 2.97% (537.57) + 5,900 × 5.94% (350.46) + 7,800 × 6.6% (514.80) = 2,014.87
    expect(calcIncomeTax('CH', 100000, '2025')!.incomeTax).toBe(2014);
  });

  it('says cantonal and communal tax are excluded', () => {
    expect(calcIncomeTax('CH', 100000, '2026')!.assumptions!.join(' ')).toMatch(/Cantonal and communal income taxes are NOT included/);
  });
});
