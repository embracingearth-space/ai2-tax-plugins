/**
 * South Africa — SARS bands, rebates and thresholds. No SARS worked examples are used:
 * the employer-guide payroll examples come from bracketed tables. embracingearth.space
 */
import { calcIncomeTax } from '../../src';

const r = (g: number, y: string, age?: number) => calcIncomeTax('ZA', g, y, age === undefined ? undefined : { age })!;

describe('South Africa 2026-27 (SARS 2027 year of assessment)', () => {
  it.each([
    [245100, 44118], // 245,100 × 18% (SARS cumulative figure)
    [383100, 79998], // + 138,000 × 26%
    [530200, 125599], // + 147,100 × 31%
    [695800, 185215], // + 165,600 × 36%
    [887000, 259783], // + 191,200 × 39%
    [1878600, 666339], // + 991,600 × 41%
    [1878700, 666384], // + 100 × 45%
  ])('taxable %d → tax before rebates %d', (g, t) => {
    expect(r(g, '2026-27').incomeTax).toBe(t);
    expect(r(g, '2026-27').verified).toBe(true);
  });

  it('primary rebate R17,820 → threshold R99,000', () => {
    expect(r(99000, '2026-27').totalTax).toBe(0);
    expect(r(99100, '2026-27').totalTax).toBe(18);
  });
  it('secondary rebate from 65 → threshold R153,250; tertiary from 75 → R171,300', () => {
    expect(r(153250, '2026-27', 65).totalTax).toBe(0);
    expect(r(153250, '2026-27', 64).totalTax).toBe(9765);
    expect(r(171300, '2026-27', 75).totalTax).toBe(0);
    expect(r(171400, '2026-27', 75).totalTax).toBe(18);
  });
});

describe('South Africa 2025-26', () => {
  it('bands and threshold R95,750', () => {
    expect(r(237100, '2025-26').incomeTax).toBe(42678); // 237,100 × 18%
    expect(r(370500, '2025-26').incomeTax).toBe(77362); // + 133,400 × 26%
    expect(r(95750, '2025-26').totalTax).toBe(0);
    expect(r(95850, '2025-26').totalTax).toBe(18);
  });
});
