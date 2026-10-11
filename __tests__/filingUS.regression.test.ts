/**
 * US individual return (US-IT, Schedule C / 1040) — @ai2/tax-plugins
 * ai2fin.com
 *
 * REGRESSION: an audit of the compiled plugin found six errors. Each worked
 * example keeps the OLD (wrong) value in a comment next to the corrected
 * expectation, which is computed by hand from the cited IRS authority:
 *  1. Employee wages had no field, so the app put W-2 wages in gross receipts
 *     and they were charged SE tax and half of it deducted.
 *  2. The 0.9% Additional Medicare Tax sat inside SE tax and was halved into
 *     the deduction (Schedule SE lines 10-13; Form 8959; IRC 164(f)).
 *  3. No $400 floor on SE earnings (Schedule SE line 4c).
 *  4. The simplified home office deduction could create a loss, and the
 *     output showed the computed figure over a user's override.
 *  5. Help text quoted stale amounts ($15,000, $176,100 for 2026, 72.5¢ only).
 *  6. No qualified business income deduction (IRC 199A, Form 8995).
 *
 * The plugin taxes by the calendar year today (it has no return-year input),
 * so every block pins the clock to the year its figures belong to.
 *
 * 2026 single brackets (Rev. Proc. 2025-32 s.4.01): 10% to 12,400, 12% to
 * 50,400, 22% to 105,700, 24% to 201,775, 32% to 256,225, 35% to 640,600.
 * Standard deduction $16,100; SS wage base $184,500; QBI threshold $201,750,
 * phase-in range $75,000.
 */

import { usIncomeTaxPlugin } from '../src';

const p = usIncomeTaxPlugin;
const calc = (v: Record<string, unknown>) => p.calculateFields(v as never);
const n = (x: unknown) => Number(x);
const help = (id: string) => p.getFormSchema().flatMap((s) => s.fields).find((f) => f.id === id)?.helpText ?? '';
const warnings = (v: Record<string, unknown>) => p.validateForm(v as never).filter((x) => x.severity === 'warning').map((x) => x.fieldId);

function inYear(isoDay: string) {
  beforeAll(() => {
    jest.useFakeTimers({ now: new Date(`${isoDay}T12:00:00`) });
  });
  afterAll(() => {
    jest.useRealTimers();
  });
}

describe('US-IT 2026', () => {
  inYear('2026-10-11');

  describe('1. W-2 wages', () => {
    it('taxes $80k of wages as ordinary income with no SE tax', () => {
      // OLD (wages typed as gross receipts): SE tax 11,303.64, half 5,651.82,
      // AGI 74,348.18, taxable 58,248.18, federal tax 7,526.60.
      // NEW: AGI 80,000; taxable 80,000 − 16,100 = 63,900;
      // 1,240 + 4,560 + 22% × 13,500 (= 2,970) = 8,770.00.
      const r = calc({ wages: 80000 });
      expect(n(r.self_employment_tax)).toBe(0);
      expect(n(r.adjusted_gross_income)).toBe(80000);
      expect(n(r.taxable_income)).toBe(63900);
      expect(n(r.federal_tax)).toBe(8770);
      expect(n(r.qbi_deduction)).toBe(0);
      expect(n(r.total_tax)).toBe(8770);
    });

    it('lets Social Security wages use up the wage base first (Schedule SE lines 8a-10)', () => {
      // Wages 150,000 + profit 100,000. Line 6 = 100,000 × 92.35% = 92,350.
      // Line 9 = 184,500 − 150,000 = 34,500; line 10 = 34,500 × 12.4% = 4,278.00;
      // line 11 = 92,350 × 2.9% = 2,678.15; SE tax 6,956.15 (OLD: no wage input,
      // 92,350 × 15.3% = 14,129.55). Half = 3,478.075 → 3,478.08.
      const r = calc({ wages: 150000, gross_receipts: 100000 });
      expect(n(r.self_employment_tax)).toBe(6956.15);
      expect(n(r.adjusted_gross_income)).toBe(250000 - 3478.08);
    });

    it('uses boxes 3 + 7 when they differ from box 1', () => {
      // Box 1 150,000 but box 3 170,000 (pre-tax deferrals). Line 9 = 14,500;
      // 14,500 × 12.4% = 1,798.00 + 2,678.15 = 4,476.15.
      const r = calc({ wages: 150000, wages_ss: 170000, gross_receipts: 100000 });
      expect(n(r.self_employment_tax)).toBe(4476.15);
    });
  });

  describe('2. Additional Medicare Tax is its own line', () => {
    it('keeps the 0.9% out of SE tax and out of the half-SE deduction', () => {
      // Profit 300,000: line 6 = 277,050. SE tax = 184,500 × 12.4% (22,878.00)
      // + 277,050 × 2.9% (8,034.45) = 30,912.45. OLD 31,605.90 (added
      // (277,050 − 200,000) × 0.9% = 693.45 inside SE tax, half 15,802.95).
      // Additional Medicare 693.45 on its own; half-SE 15,456.225 → 15,456.23.
      const r = calc({ gross_receipts: 300000 });
      expect(n(r.self_employment_tax)).toBe(30912.45);
      expect(n(r.additional_medicare_tax)).toBe(693.45);
      expect(n(r.adjusted_gross_income)).toBe(300000 - 15456.23);
    });

    it('combines Medicare wages and SE earnings against one $200,000 threshold (Form 8959)', () => {
      // Wages 150,000 + profit 100,000: Part I 0; Part II threshold
      // 200,000 − 150,000 = 50,000; (92,350 − 50,000) × 0.9% = 381.15.
      // OLD: 0 (SE earnings alone never passed 200,000).
      expect(n(calc({ wages: 150000, gross_receipts: 100000 }).additional_medicare_tax)).toBe(381.15);
      // Wages only, 250,000: (250,000 − 200,000) × 0.9% = 450.00.
      expect(n(calc({ wages: 250000 }).additional_medicare_tax)).toBe(450);
      // Box 5 overrides box 1: 260,000 → 540.00.
      expect(n(calc({ wages: 250000, wages_medicare: 260000 }).additional_medicare_tax)).toBe(540);
    });
  });

  describe('3. $400 floor on SE earnings', () => {
    it('charges no SE tax when 92.35% of profit is under $400', () => {
      // 400 × 92.35% = 369.40 < 400 → 0. OLD: 369.40 × 15.3% = 56.52.
      expect(n(calc({ gross_receipts: 400 }).self_employment_tax)).toBe(0);
      // 433 × 92.35% = 399.88 < 400 → 0.
      expect(n(calc({ gross_receipts: 433 }).self_employment_tax)).toBe(0);
      // 434 × 92.35% = 400.799 ≥ 400 → × 15.3% = 61.32.
      expect(n(calc({ gross_receipts: 434 }).self_employment_tax)).toBe(61.32);
    });
  });

  describe('4. Simplified home office deduction', () => {
    it('cannot push the business into a loss', () => {
      // Gross 1,000, 300 sqft: $1,500 limited to line 29 profit 1,000.
      // OLD: deduction 1,500, net profit −500. NEW: 1,000 and net 0.
      const r = calc({ gross_receipts: 1000, home_office_sqft: 300 });
      expect(n(r.home_office_deduction)).toBe(1000);
      expect(n(r.net_profit_loss)).toBe(0);
      // Gross 2,000 − supplies 1,200 = 800 limit.
      const s = calc({ gross_receipts: 2000, supplies: 1200, home_office_sqft: 300 });
      expect(n(s.home_office_deduction)).toBe(800);
      expect(n(s.net_profit_loss)).toBe(0);
    });

    it('returns the user\'s override, not the computed figure', () => {
      // OLD: output 1,500 while net profit used 900. NEW: 900 and net 100.
      const r = calc({ gross_receipts: 1000, home_office_sqft: 300, home_office_deduction: 900 });
      expect(n(r.home_office_deduction)).toBe(900);
      expect(n(r.net_profit_loss)).toBe(100);
      expect(warnings({ gross_receipts: 1000, home_office_deduction: 900 })).not.toContain('home_office_deduction');
    });

    it('warns when an override exceeds the gross income limit', () => {
      expect(warnings({ gross_receipts: 1000, home_office_deduction: 1200 })).toContain('home_office_deduction');
    });

    it('still gives the full simplified amount when profit covers it', () => {
      const r = calc({ gross_receipts: 100000, home_office_sqft: 200 });
      expect(n(r.home_office_deduction)).toBe(1000);
    });
  });

  describe('5. Help text matches the year parameters', () => {
    it('quotes 2026 figures', () => {
      // OLD: '$15,000 single / $30,000 MFJ (2025)', '(up to $176,100)', '72.5¢/mile (2026)'.
      expect(help('standard_deduction')).toContain('$16,100');
      expect(help('self_employment_tax')).toContain('$184,500');
      expect(help('wages_ss')).toContain('$184,500');
      expect(help('car_truck')).toContain('72.5¢');
      expect(help('car_truck')).toContain('76¢');
      expect(help('qbi_deduction')).toContain('$201,750');
      const all = JSON.stringify(p.getFormSchema());
      expect(all).not.toContain('$15,000');
      expect(all).not.toContain('$176,100');
    });
  });

  describe('6. Qualified business income deduction', () => {
    it('gives 20% of QBI capped at 20% of taxable income ($80k profit)', () => {
      // SE tax 11,303.64, half 5,651.82; AGI 74,348.18; taxable before QBI
      // 58,248.18. QBI = 80,000 − 5,651.82 = 74,348.18 → 20% = 14,869.64;
      // cap 20% × 58,248.18 = 11,649.636 → 11,649.64 (rounded to cents, like
      // the half-SE deduction). Taxable 46,598.54;
      // 1,240 + 12% × 34,198.54 (= 4,103.82) = 5,343.82.
      // OLD: no QBI, 7,526.60. (The audit's 5,343.83 used the unrounded
      // 11,649.636; both are 20% of the same figures, a cent apart.)
      const r = calc({ gross_receipts: 80000 });
      expect(n(r.qbi_deduction)).toBe(11649.64);
      expect(n(r.taxable_income)).toBeCloseTo(46598.54, 2); // unrounded in the plugin, as before
      expect(n(r.federal_tax)).toBe(5343.82);
      expect(n(r.total_tax)).toBe(16647.46);
      expect(warnings({ gross_receipts: 80000 })).not.toContain('qbi_deduction');
    });

    it('is 20% of QBI when that is the smaller (wages 60k + profit 40k)', () => {
      // SE 36,940 × 15.3% = 5,651.82, half 2,825.91. AGI 97,174.09; taxable
      // before QBI 81,074.09. QBI 37,174.09 × 20% = 7,434.82 (< 16,214.82).
      // Taxable 73,639.27: 1,240 + 4,560 + 22% × 23,239.27 = 10,912.64.
      const r = calc({ wages: 60000, gross_receipts: 40000 });
      expect(n(r.qbi_deduction)).toBe(7434.82);
      expect(n(r.federal_tax)).toBe(10912.64);
      expect(n(r.total_tax)).toBe(16564.46);
    });

    it('uses the lowest lawful amount inside the phase-in range, and warns', () => {
      // Wages 200,000 + profit 80,000. Wage base used up: SE = 73,880 × 2.9%
      // = 2,142.52, half 1,071.26. Additional Medicare 73,880 × 0.9% = 664.92.
      // AGI 278,928.74; taxable before QBI 262,828.74 (61,078.74 over).
      // r = 61,078.74 / 75,000 = 0.814383; applicable % = 0.185617.
      // As an SSTB with no W-2 wages/property: 20% × 78,928.74 × 0.185617²
      // = 15,785.75 × 0.034453 = 543.88. Taxable 262,284.86:
      // 58,448 + 35% × 6,059.86 = 60,568.95. Total 63,376.39.
      const r = calc({ wages: 200000, gross_receipts: 80000 });
      expect(n(r.qbi_deduction)).toBe(543.88);
      expect(n(r.federal_tax)).toBe(60568.95);
      expect(n(r.additional_medicare_tax)).toBe(664.92);
      expect(n(r.total_tax)).toBe(63376.39);
      expect(warnings({ wages: 200000, gross_receipts: 80000 })).toContain('qbi_deduction');
    });

    it('is nil past the phase-in range under the conservative treatment', () => {
      // Wages 300,000 + profit 80,000: taxable before QBI 362,828.74 > 276,750.
      // Federal 58,448 + 35% × 106,603.74 = 95,759.31. Additional Medicare
      // 900.00 (wages) + 664.92 (SE) = 1,564.92. Total 99,466.75.
      const r = calc({ wages: 300000, gross_receipts: 80000 });
      expect(n(r.qbi_deduction)).toBe(0);
      expect(n(r.federal_tax)).toBe(95759.31);
      expect(n(r.additional_medicare_tax)).toBe(1564.92);
      expect(n(r.total_tax)).toBe(99466.75);
    });

    it('applies the $400 minimum only with material participation and $1,000+ QBI', () => {
      // Wages 50,000 + profit 1,500: SE 1,385.25 × 15.3% = 211.94, half 105.97.
      // QBI 1,394.03 → 20% = 278.81. Taxable before QBI 35,294.03.
      const active = calc({ wages: 50000, gross_receipts: 1500, materially_participated: true });
      expect(n(active.qbi_deduction)).toBe(400);
      // 35,294.03 − 400 = 34,894.03: 1,240 + 12% × 22,494.03 = 3,939.28.
      expect(n(active.federal_tax)).toBe(3939.28);
      expect(n(calc({ wages: 50000, gross_receipts: 1500 }).qbi_deduction)).toBe(278.81);
      expect(n(calc({ wages: 50000, gross_receipts: 1500, materially_participated: 'true' }).qbi_deduction)).toBe(400);
      // Profit 1,000: SE 923.50 × 15.3% = 141.30, half 70.65; QBI 929.35
      // < 1,000 → no minimum, 20% = 185.87.
      expect(n(calc({ wages: 50000, gross_receipts: 1000, materially_participated: true }).qbi_deduction)).toBe(185.87);
    });

    it('gives nothing on a loss', () => {
      const r = calc({ wages: 50000, gross_receipts: 1000, other_expenses: 3000, materially_participated: true });
      expect(n(r.net_profit_loss)).toBe(-2000);
      expect(n(r.qbi_deduction)).toBe(0);
      expect(n(r.adjusted_gross_income)).toBe(48000);
    });
  });
});

describe('US-IT 2025', () => {
  inYear('2025-06-30');

  it('quotes 2025 figures in help text', () => {
    expect(help('standard_deduction')).toContain('$15,750');
    expect(help('self_employment_tax')).toContain('$176,100');
    expect(help('car_truck')).toContain('70¢');
    expect(help('qbi_deduction')).toContain('$197,300');
  });

  it('uses the 2025 QBI threshold ($197,300) and $50,000 range', () => {
    // Wages 190,000 + profit 40,000. Wage base 176,100 used up: SE = 36,940 ×
    // 2.9% = 1,071.26, half 535.63. AGI 229,464.37; taxable before QBI
    // 229,464.37 − 15,750 = 213,714.37 (16,414.37 over). r = 0.328287;
    // applicable 0.671713; 20% × 39,464.37 × 0.451198 = 3,561.25.
    // Taxable 210,153.12: 40,199 + 32% × 12,853.12 = 44,312.00.
    const r = calc({ wages: 190000, gross_receipts: 40000 });
    expect(n(r.qbi_deduction)).toBe(3561.25);
    expect(n(r.federal_tax)).toBe(44312);
  });

  it('has no $400 minimum before 2026', () => {
    // QBI 1,394.03 × 20% = 278.81 even with material participation.
    expect(n(calc({ wages: 50000, gross_receipts: 1500, materially_participated: true }).qbi_deduction)).toBe(278.81);
  });
});

describe('quarterly estimated payments net of withholding (Form 1040-ES)', () => {
  inYear('2026-06-01');

  it('does not ask a fully withheld employee for estimated payments', () => {
    // $80k wages with $9,000 withheld: federal tax 8,770 → nothing left to estimate.
    const r = calc({ wages: 80000, withholding: 9000 });
    expect(n(r.total_tax)).toBe(8770);
    expect(n(r.quarterly_estimated)).toBe(0);
  });

  it('spreads what withholding leaves owing over four quarters', () => {
    // Was total_tax ÷ 4 whatever had been withheld.
    const r = calc({ wages: 80000, withholding: 4770 });
    expect(n(r.quarterly_estimated)).toBe(1000); // (8,770 − 4,770) ÷ 4
  });
});
