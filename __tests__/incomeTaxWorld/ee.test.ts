/**
 * Estonia — 22% after the basic exemption. Own arithmetic from EMTA's
 * published figures (no official example). embracingearth.space
 */
import { calcIncomeTax } from '../../src';

describe('Estonia', () => {
  it('2026: flat 8,400 exemption at every income', () => {
    expect(calcIncomeTax('EE', 8400, '2026')!.totalTax).toBe(0);
    expect(calcIncomeTax('EE', 60000, '2026')!.totalTax).toBe(11352); // 51,600 × 22%
    expect(calcIncomeTax('EE', 60000, '2026')!.verified).toBe(true);
  });
  it('2025: exemption tapers between 14,400 and 25,200', () => {
    expect(calcIncomeTax('EE', 14400, '2025')!.totalTax).toBe(1441); // 6,552 × 22% = 1,441.44
    // exemption 7,848 − 7,848/10,800 × 5,600 = 3,778.67; 16,221.33 × 22% = 3,568.69
    expect(calcIncomeTax('EE', 20000, '2025')!.totalTax).toBe(3569);
    expect(calcIncomeTax('EE', 25200, '2025')!.totalTax).toBe(5544); // no exemption left
  });
});
