/**
 * Nigeria — NTA 2025 (2026) and PITA (2025) arithmetic, hand-computed. embracingearth.space
 *
 * Both years deduct the employee's 8% Pension Reform Act contribution (on all of gross pay).
 * The National Housing Fund contribution is NOT deducted: since the Business Facilitation
 * (Miscellaneous Provisions) Act 2023 it is voluntary for private-sector employees.
 */
import { calcIncomeTax } from '../../src';
import { NG_INCOME_TAX } from '../../src/data/incomeTaxWorld/ng';
import { applyDeductions, type DeductionRule } from '../../src/data/incomeTaxFactory';
import { progressive } from '../../src/data/incomeTaxMath';

const r = (g: number, y: string) => calcIncomeTax('NG', g, y)!;

describe('Nigeria 2026 — Nigeria Tax Act Fourth Schedule, taxable = gross − 8% pension', () => {
  it.each([
    [800000, 0], // taxable 736,000 inside the 0% band
    [900000, 4200], // taxable 828,000: 28,000 × 15%
    [2000000, 156000], // taxable 1,840,000: 1,040,000 × 15%
    [10000000, 1446000], // taxable 9,200,000: 330,000 + 6,200,000 × 18%
    [30000000, 5278000], // taxable 27,600,000: 330,000 + 1,620,000 + 2,730,000 + 2,600,000 × 23%
    [60000000, 11730000], // taxable 55,200,000: + 5,750,000 + 5,200,000 × 25%
  ])('gross %d → tax %d', (g, t) => {
    expect(r(g, '2026').taxable).toBe(g * 0.92);
    expect(r(g, '2026').incomeTax).toBe(t);
    expect(r(g, '2026').verified).toBe(true);
  });
});

describe('Nigeria 2025 — PITA with pension, CRA and minimum tax', () => {
  it('CRA of N200,000 + 20% of gross', () => {
    // 1,000,000 − 80,000 pension − 400,000 CRA = 520,000; 300,000 × 7% + 220,000 × 11%
    expect(r(1000000, '2025').taxable).toBe(520000);
    expect(r(1000000, '2025').incomeTax).toBe(45200);
    // 5,000,000 − 400,000 − 1,200,000 = 3,400,000; 560,000 + 200,000 × 24%
    expect(r(5000000, '2025').incomeTax).toBe(608000);
  });
  it('CRA uses 1% of gross once that exceeds N200,000', () => {
    // 30,000,000 − 2,400,000 − (300,000 + 6,000,000) = 21,300,000; 560,000 + 18,100,000 × 24%
    expect(r(30000000, '2025').incomeTax).toBe(4904000);
  });
  it('tops up to the 1% minimum tax', () => {
    // 300,000 − 24,000 − 260,000 = 16,000 × 7% = 1,120; minimum 3,000
    const x = r(300000, '2025');
    expect(x.incomeTax).toBe(1120);
    expect(x.totalTax).toBe(3000);
  });
});

describe('Nigeria — self-employed profit: no compulsory pension, compulsory NHF instead', () => {
  const se = { incomeType: 'self-employed' } as const;

  it('2026: N2,000,000 − 2.5% NHF = 1,950,000; 1,150,000 × 15% = 172,500', () => {
    const x = calcIncomeTax('NG', 2000000, '2026', se)!;
    expect(x.taxable).toBe(1950000);
    expect(x.incomeTax).toBe(172500);
    expect(x.incomeBasis).toBe('self-employed');
    expect(x.assumptions![0]).toMatch(/^Computed as self-employed profit/);
  });

  it('2025: 5,000,000 − 125,000 NHF − 1,200,000 CRA = 3,675,000; 560,000 + 475,000 × 24%', () => {
    expect(calcIncomeTax('NG', 5000000, '2025', se)!.incomeTax).toBe(674000);
  });

  it('the employee figure says it is employment income and points to the self-employed option', () => {
    const x = r(2000000, '2026');
    expect(x.incomeBasis).toBe('employment');
    expect(x.assumptions![0]).toMatch(/incomeType "self-employed"/);
    expect(x.assumptions![0]).toMatch(/N172,500 of tax, against N156,000/);
  });
});

describe('Nigeria — the audit case and the quantified alternatives', () => {
  const year = NG_INCOME_TAX.years[0]!;
  const tax2026 = (gross: number, deductions: DeductionRule[]): number =>
    Math.round(progressive(gross - applyDeductions({ ...year, deductions }, gross, { round: Math.round, floor: Math.floor }), year.bands));

  it('N2,000,000: 156,000 with the pension (172,500 before, with NHF and no pension)', () => {
    expect(r(2000000, '2026').incomeTax).toBe(156000);
  });

  const a = r(2000000, '2026').assumptions!.join(' ');

  it('the figures the assumptions quote are what the engine gives', () => {
    const pension80 = { kind: 'share', name: 'Pension on 80% of pay', rate: 0.08 * 0.8 } as const;
    const nhf = { kind: 'share', name: 'National Housing Fund (2.5%)', rate: 0.025 } as const;
    expect(tax2026(2000000, [pension80])).toBe(160800);
    expect(tax2026(2000000, [])).toBe(180000);
    expect(tax2026(2000000, [...year.deductions!, nhf])).toBe(148500);
    expect(a).toMatch(/N160,800 instead of N156,000/);
    expect(a).toMatch(/2026 tax on N2,000,000 is N180,000/);
    expect(a).toMatch(/N148,500 on N2,000,000 in 2026/);
  });

  it('says why NHF is not deducted', () => {
    expect(a).toMatch(/Business Facilitation \(Miscellaneous Provisions\) Act 2023/);
    expect(a).toMatch(/voluntary for private-sector employees/);
  });

  it('carries no unquantified hedge', () => {
    expect(a).not.toMatch(/slightly|may be overstated/);
  });
});
