/**
 * Sweden 2026 — grundavdrag, jobbskatteavdrag, state tax. embracingearth.space
 */
import { calcIncomeTax } from '../../src';

describe('Sweden 2026 — official Skatteverket example', () => {
  it('official: SKV 433 (2026) §7.5.2 example 2 — 55,000 at municipal 32.84%: taxable income and municipal tax', () => {
    // https://www.skatteverket.se/download/18.1522bf3f19aea8075ba55c/1765284655603/teknisk-beskrivning-skv-433-2026-utgava-36.pdf
    // Official: taxable 29,900 and municipal tax 9,819. The fee and its reduction are excluded here, so the
    // jobbskatteavdrag is not limited to 6,019: 9,819 − 9,592.20 (full JSA) = 226.80 (derived, not official).
    const r = calcIncomeTax('SE', 55000, '2026', { localTaxRate: 0.3284 })!;
    expect(r.taxable).toBe(29900); // grundavdrag 25,041.60 rounded up to 25,100
    expect(r.totalTax).toBe(227);
    expect(r.verified).toBe(true);
  });
});

describe('Sweden 2026 — derived from the official formulas, not official examples', () => {
  it('400,000 at the 32.38% average', () => {
    const r = calcIncomeTax('SE', 400000, '2026')!;
    // GA 45,584 − 10% × (400,000 − 184,112) = 23,995.20 → 24,000; taxable 376,000
    expect(r.taxable).toBe(376000);
    // municipal 376,000 × 32.38% = 121,749; JSA (107,329.6 + 25.1% × 208,192 − 24,000) × 32.38% = 43,902.68; FIR 1,500
    // 121,749 − 43,902.68 − 1,500 = 76,346.32
    expect(r.totalTax).toBe(76346);
  });
  it('state tax starts at the brytpunkt 660,400 (skiktgräns 643,000 + minimum grundavdrag 17,400)', () => {
    expect(calcIncomeTax('SE', 660400, '2026')!.incomeTax).toBe(0);
    // taxable 644,000 → 1,000 × 20%
    expect(calcIncomeTax('SE', 661400, '2026')!.incomeTax).toBe(200);
  });
  it('says the pension contribution is not included', () => {
    expect(calcIncomeTax('SE', 400000, '2026')!.assumptions!.join(' ')).toMatch(/pension contribution/);
  });
});
