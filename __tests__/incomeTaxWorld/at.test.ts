/**
 * Austria — §33 EStG tariff with Verkehrsabsetzbetrag. embracingearth.space
 * All expectations derived from the official tariff and BMF credit table — not official examples.
 */
import { calcIncomeTax } from '../../src';

const credits = (r: ReturnType<typeof calcIncomeTax>) => r!.offsets.reduce((s, o) => s + o.amount, 0);

describe('Austria (derived from the official formula — not an official example)', () => {
  it('2026 €40,000: social insurance 18.07% + €132 → Einkommen 32,640', () => {
    const r = calcIncomeTax('AT', 40000, '2026')!;
    // 40,000 − 6,828 − 400 − 132 = 32,640
    expect(r.taxable).toBe(32640);
    // 8,453 × 20% + 10,648 × 30% = 1,690.60 + 3,194.40 = 4,885
    expect(r.incomeTax).toBe(4885);
    // VAB 496; Zuschlag nil above 30,259
    expect(credits(r)).toBe(496);
    expect(r.totalTax).toBe(4389);
    expect(r.verified).toBe(true);
  });

  it('2026 €25,000: Zuschlag inside its phase-out', () => {
    const r = calcIncomeTax('AT', 25000, '2026')!;
    // 25,000 − 4,267.50 − 250 − 132 = 20,350.50; (20,350.50 − 13,539) × 20% = 1,362.30
    expect(r.incomeTax).toBe(1362);
    // 804 − 804 × 589.50 / 10,498 = 758.85 → 759; + 496
    expect(credits(r)).toBe(1255);
    expect(r.totalTax).toBe(107);
  });

  it('zero-rate band ends at Einkommen 13,539', () => {
    // 16,686 × 0.8193 − 132 = 13,538.84 → nil
    expect(calcIncomeTax('AT', 16686, '2026')!.incomeTax).toBe(0);
    // 16,700 × 0.8193 − 132 = 13,550.31 → 11.31 × 20% = 2.26
    expect(calcIncomeTax('AT', 16700, '2026')!.incomeTax).toBe(2);
  });

  it('2026 €120,000: contributions capped at 97,020 / 83,160, inside the 48% band', () => {
    const r = calcIncomeTax('AT', 120000, '2026')!;
    // 97,020 × 17.07% + 83,160 × 1% + 132 = 16,561.31 + 831.60 + 132 → Einkommen 102,475.09
    // 1,690.60 + 4,339.80 + 13,562.80 + 32,110.09 × 48% (15,412.84) = 35,006.04
    expect(r.incomeTax).toBe(35006);
    expect(r.totalTax).toBe(34510);
  });

  it('2025 tariff and credits', () => {
    const r = calcIncomeTax('AT', 40000, '2025')!;
    // 8,309 × 20% + 11,023 × 30% = 1,661.80 + 3,306.90 = 4,968.70; − VAB 487
    expect(r.incomeTax).toBe(4969);
    expect(r.totalTax).toBe(4482);
  });

  it('says social insurance and the 6% special-payment rate are not modelled', () => {
    const a = calcIncomeTax('AT', 40000, '2026')!.assumptions!.join(' ');
    expect(a).toMatch(/social-insurance/);
    expect(a).toMatch(/13th\/14th/);
  });
});
