/**
 * Ireland — income tax + USC. Revenue's own worked examples are the anchors.
 * embracingearth.space
 */
import { calcIncomeTax } from '../../src';

const usc = (r: ReturnType<typeof calcIncomeTax>) => r!.levies.find((l) => l.name === 'Universal Social Charge')?.amount ?? 0;

describe('Ireland 2026 — official Revenue examples', () => {
  it('Ruth: single PAYE employee on €48,000 pays €6,400 income tax (revenue.ie, 2026)', () => {
    // 44,000 × 20% + 4,000 × 40% − 4,000 credits = 6,400.
    const r = calcIncomeTax('IE', 48000, '2026')!;
    expect(r.incomeTax - r.offsets.reduce((s, o) => s + o.amount, 0)).toBe(6400);
    expect(r.verified).toBe(true);
  });

  it.each([
    [25000, 319.82],
    [50000, 1032.82],
    [75000, 2030.62],
  ])('USC on €%d is €%d (Revenue "Calculating your USC", 2026)', (gross, expected) => {
    expect(usc(calcIncomeTax('IE', gross, '2026'))).toBe(Math.round(expected));
  });
});

describe('Ireland — bracket and exemption boundaries', () => {
  it('pays no USC at the €13,000 exemption limit, and USC on the WHOLE income one euro above it', () => {
    expect(usc(calcIncomeTax('IE', 13000, '2026'))).toBe(0);
    // 12,012 × 0.5% + 989 × 2% = 60.06 + 19.78 = 79.84
    expect(usc(calcIncomeTax('IE', 13001, '2026'))).toBe(80);
  });

  it('switches from 20% to 40% at the €44,000 standard rate cut-off point', () => {
    expect(calcIncomeTax('IE', 44000, '2026')!.incomeTax).toBe(8800);
    expect(calcIncomeTax('IE', 44100, '2026')!.incomeTax).toBe(8840);
    expect(calcIncomeTax('IE', 50000, '2026')!.marginalRate).toBeCloseTo(0.4 + 0.03, 6);
  });

  it('credits are non-refundable: €20,000 of income owes no income tax and gets no refund', () => {
    const r = calcIncomeTax('IE', 20000, '2026')!;
    expect(r.incomeTax).toBe(4000);
    expect(r.offsets.reduce((s, o) => s + o.amount, 0)).toBe(4000);
    expect(r.totalTax).toBe(usc(r));
  });

  it('2025 uses the 2025 USC 2% band ceiling (€27,382, not 2026’s €28,700)', () => {
    // 12,012 × 0.5% + 15,370 × 2% + 2,618 × 3% = 60.06 + 307.40 + 78.54 = 446.00
    expect(usc(calcIncomeTax('IE', 30000, '2025'))).toBe(446);
    // 2026: 60.06 + 16,688 × 2% (333.76) + 1,300 × 3% (39.00) = 432.82
    expect(usc(calcIncomeTax('IE', 30000, '2026'))).toBe(433);
  });

  it('says PRSI is not included', () => {
    expect(calcIncomeTax('IE', 50000, '2026')!.assumptions!.join(' ')).toMatch(/PRSI/);
  });
});
