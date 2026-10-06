/**
 * Netherlands — box 1 (incl. premie volksverzekeringen in bracket 1) and heffingskortingen. embracingearth.space
 */
import { calcIncomeTax } from '../../src';

const credit = (r: ReturnType<typeof calcIncomeTax>, name: string) => r!.offsets.find((o) => o.name === name)?.amount ?? 0;

describe('Netherlands — derived from the official Belastingdienst rates and tables — not an official example', () => {
  it('2026, 50,000: box 1 18,076.22; AHK 1,818.51; AK 5,398.04; tax + premiums 10,859', () => {
    const r = calcIncomeTax('NL', 50000, '2026')!;
    expect(r.incomeTax).toBe(18076);
    expect(credit(r, 'Algemene heffingskorting')).toBe(1819);
    expect(credit(r, 'Arbeidskorting')).toBe(5398);
    expect(r.totalTax).toBe(10859);
    expect(r.verified).toBe(true);
  });
  it('2025, 50,000: box 1 18,101.88; AHK 1,699.59; AK 5,147.92', () => {
    const r = calcIncomeTax('NL', 50000, '2025')!;
    expect(r.incomeTax).toBe(18102);
    expect(credit(r, 'Algemene heffingskorting')).toBe(1700);
    expect(credit(r, 'Arbeidskorting')).toBe(5148);
    expect(r.verified).toBe(true);
  });
});

describe('Netherlands — bracket and credit corners', () => {
  it('2026 bracket edges: 38,883 × 35.75% = 13,900.67; +39,543 × 37.56% = 28,753.02; then 49.5%', () => {
    expect(calcIncomeTax('NL', 38883, '2026')!.incomeTax).toBe(13901);
    expect(calcIncomeTax('NL', 40000, '2026')!.incomeTax).toBe(14320); // 13,900.67 + 1,117 × 37.56%
    expect(calcIncomeTax('NL', 78426, '2026')!.incomeTax).toBe(28753);
    expect(calcIncomeTax('NL', 79426, '2026')!.incomeTax).toBe(29248); // 28,753.02 + 1,000 × 49.5%
  });
  it('2025 bracket edge: 38,441 × 35.82% + 38,376 × 37.48% = 28,152.89', () => {
    expect(calcIncomeTax('NL', 76817, '2025')!.incomeTax).toBe(28153);
  });
  it('AHK: full 3,115 up to 29,736, nil from 78,427 (2026)', () => {
    expect(credit(calcIncomeTax('NL', 29736, '2026'), 'Algemene heffingskorting')).toBe(3115);
    expect(credit(calcIncomeTax('NL', 78427, '2026'), 'Algemene heffingskorting')).toBe(0);
  });
  it('arbeidskorting corners (2026): 8.324% × 11,965 = 995.97; 996 + 31.009% × 13,880 = 5,300.05; max 5,685 at 45,592; nil from 132,921', () => {
    expect(credit(calcIncomeTax('NL', 11965, '2026'), 'Arbeidskorting')).toBe(996);
    expect(credit(calcIncomeTax('NL', 25845, '2026'), 'Arbeidskorting')).toBe(5300);
    expect(credit(calcIncomeTax('NL', 45592, '2026'), 'Arbeidskorting')).toBe(5685);
    expect(credit(calcIncomeTax('NL', 132921, '2026'), 'Arbeidskorting')).toBe(0);
  });
  it('says bracket 1 includes the national-insurance premium', () => {
    expect(calcIncomeTax('NL', 50000, '2026')!.assumptions!.join(' ')).toMatch(/premie volksverzekeringen/);
  });
});
