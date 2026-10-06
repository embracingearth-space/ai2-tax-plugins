/**
 * France — impôt sur le revenu, 1 part. embracingearth.space
 */
import { calcIncomeTax } from '../../src';
import { progressive } from '../../src/data/incomeTaxMath';
import { FR_INCOME_TAX } from '../../src/data/incomeTaxWorld/fr';

/** The gross whose net taxable income (after contributions and the 10% deduction) equals `target`. */
const grossFor = (target: number, year: string): number => {
  let lo = 0;
  let hi = target * 2;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (calcIncomeTax('FR', mid, year)!.taxable < target) lo = mid;
    else hi = mid;
  }
  return hi;
};

describe('France 2025 income — official service-public example', () => {
  // https://www.service-public.gouv.fr/particuliers/vosdroits/F1419 — single, 1 part, revenu net imposable
  // 30,000 → impôt brut 2,103.99 (17,979 × 11% + 421 × 30%), no décote. Tested two ways: the bands' own
  // arithmetic on 30,000 exactly, and the engine at the gross that yields a net taxable income of 30,000.
  it('the 2025 bands give 2,103.99 on 30,000', () => {
    expect(progressive(30000, FR_INCOME_TAX.years[0]!.bands)).toBeCloseTo(2103.99, 2);
  });
  it('the engine, at the gross yielding 30,000 net taxable, charges 2,104 with no décote', () => {
    const r = calcIncomeTax('FR', grossFor(30000, '2025'), '2025')!;
    expect(r.taxable).toBeCloseTo(30000, 3);
    expect(r.incomeTax).toBe(2104);
    expect(r.offsets).toEqual([]);
    expect(r.totalTax).toBe(2104);
    expect(r.verified).toBe(true);
  });
});

describe('France — gross to net taxable', () => {
  it('2025, gross 30,000: contributions 2,070 + 120 + 1,203 + CSG 6.8% × 29,475 (2,004.30) = 5,397.30; less 10% of 24,602.70 → 22,142.43', () => {
    expect(calcIncomeTax('FR', 30000, '2025')!.taxable).toBeCloseTo(22142.43, 2);
  });
  it('the 10% deduction is capped at 14,555 (2025)', () => {
    // gross 300,000: the 10% of net would exceed the cap, so taxable = net − 14,555 exactly.
    const r = calcIncomeTax('FR', 300000, '2025')!;
    const pass = 47100;
    const t2 = 300000 - pass;
    const contrib = 0.069 * pass + 0.004 * 300000 + 0.0401 * pass + 0.0972 * t2 + 0.0014 * 300000 + 0.068 * (0.9825 * 4 * pass + (300000 - 4 * pass));
    expect(r.taxable).toBeCloseTo(300000 - contrib - 14555, 6);
  });
});

describe('France — bands and décote corners (2025)', () => {
  it('nil up to 11,600 taxable', () => {
    expect(calcIncomeTax('FR', grossFor(11600, '2025'), '2025')!.totalTax).toBe(0);
  });
  it('taxable 25,000: tax 13,400 × 11% = 1,474; décote 897 − 45.25% × 1,474 = 230.02 → 1,244', () => {
    const r = calcIncomeTax('FR', grossFor(25000, '2025'), '2025')!;
    expect(r.incomeTax).toBe(1474);
    expect(r.offsets[0]!.amount).toBe(230);
    expect(r.totalTax).toBe(1244);
  });
  it('taxable 29,579 (top of 11%): 1,977.69 → 1,978 < 1,982, décote 897 − 895.05 = 1.95 → 2', () => {
    const r = calcIncomeTax('FR', grossFor(29579, '2025'), '2025')!;
    expect(r.incomeTax).toBe(1978);
    expect(r.offsets[0]!.amount).toBe(2);
  });
  it('taxable 84,577 → 1,977.69 + 54,998 × 30% = 18,477.09; 30,000 above it at 41% → 30,777.09', () => {
    expect(calcIncomeTax('FR', grossFor(84577, '2025'), '2025')!.incomeTax).toBe(18477);
    expect(calcIncomeTax('FR', grossFor(114577, '2025'), '2025')!.incomeTax).toBe(30777);
  });
});

describe('France 2024 income (LF 2025 barème)', () => {
  it('bands: 30,000 → 17,818 × 11% + 685 × 30% = 2,165.48', () => {
    expect(calcIncomeTax('FR', grossFor(30000, '2024'), '2024')!.incomeTax).toBe(2165);
  });
  it('is unverified, and the assumptions say why', () => {
    const r = calcIncomeTax('FR', 40000, '2024')!;
    expect(r.verified).toBe(false);
    expect(r.assumptions!.join(' ')).toMatch(/CSG déductible/);
  });
  it('has no 2026 income year (barème not enacted)', () => {
    expect(FR_INCOME_TAX.years.map((y) => y.taxYear)).toEqual(['2025', '2024']);
  });
});
