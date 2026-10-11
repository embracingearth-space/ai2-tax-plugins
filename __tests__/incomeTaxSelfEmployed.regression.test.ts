/**
 * Self-employed income in the individual-return plugins — @ai2/tax-plugins
 * ai2fin.com
 *
 * REGRESSION: IN-IT gave every new-regime filer the ₹75,000 salaried standard
 * deduction, including freelancers with no salary, and taxed all presumptive
 * turnover at 8%. A freelancer on ₹14.1L was told ₹83,460 instead of ₹95,160.
 * The anchor case below was cross-checked against an independent implementation
 * (My Next Filing's worked example) and by hand.
 */

import { indiaIncomeTaxPlugin } from '../src';

describe('IN-IT — self-employed and presumptive income', () => {
  const p = indiaIncomeTaxPlugin;
  const calc = (v: Record<string, unknown>) => p.calculateFields(v as never);

  it('gives a freelancer with no salary no standard deduction (anchor case)', () => {
    // Declared professional profit ₹14L + ₹10k bank interest, TDS ₹40k.
    const r = calc({ tax_regime: 'new', business_income: 1400000, other_sources: 10000, tds: 40000 });
    expect(Number(r.standard_deduction)).toBe(0);
    expect(Number(r.taxable_income)).toBe(1410000);
    // 4-8L 5% = 20,000; 8-12L 10% = 40,000; 12-14.1L 15% = 31,500.
    expect(Number(r.tax_on_income)).toBe(91500);
    expect(Number(r.cess)).toBe(3660);
    expect(Number(r.total_tax)).toBe(95160);
    expect(Number(r.balance_due)).toBe(55160);
  });

  it('still gives a salaried filer the full ₹75,000', () => {
    const r = calc({ tax_regime: 'new', salary_income: 1575000 });
    expect(Number(r.standard_deduction)).toBe(75000);
    expect(Number(r.taxable_income)).toBe(1500000);
  });

  it('caps the standard deduction at the salary itself', () => {
    const r = calc({ tax_regime: 'new', salary_income: 50000, business_income: 1000000 });
    expect(Number(r.standard_deduction)).toBe(50000);
    expect(Number(r.taxable_income)).toBe(1000000);
    const old = calc({ tax_regime: 'old', salary_income: 30000, business_income: 500000 });
    expect(Number(old.standard_deduction)).toBe(30000);
  });

  it('deems 50% of a profession\'s gross receipts (formerly 44ADA)', () => {
    const r = calc({ tax_regime: 'new', professional_receipts: 1900000 });
    expect(Number(r.presumptive_income)).toBe(950000);
    expect(Number(r.taxable_income)).toBe(950000);
    expect(Number(r.total_tax)).toBe(0); // ≤ ₹12L → §87A rebate
  });

  it('deems 6% of digitally received turnover and 8% of the rest (formerly 44AD)', () => {
    expect(Number(calc({ presumptive_turnover_digital: 10000000 }).presumptive_income)).toBe(600000);
    expect(Number(calc({ presumptive_turnover: 1000000 }).presumptive_income)).toBe(80000);
    expect(Number(calc({ presumptive_turnover_digital: 5000000, presumptive_turnover: 500000 }).presumptive_income)).toBe(340000);
  });

  it('applies surcharge marginal relief just above ₹50L', () => {
    const r = calc({ tax_regime: 'new', business_income: 5000100 });
    // Tax at ₹50L = ₹10,80,000 with no surcharge; ₹100 more may cost at most ₹100.
    expect(Number(r.tax_on_income)).toBe(1080030);
    expect(Number(r.surcharge)).toBe(70);
    expect(Number(r.total_tax)).toBe(1080030 + 70 + 43204);
  });

  it('uses the 37% surcharge above ₹5Cr in the old regime and 25% in the new', () => {
    const old = calc({ tax_regime: 'old', business_income: 60000000 });
    expect(Number(old.tax_on_income)).toBe(17812500);
    expect(Number(old.surcharge)).toBe(6590625);
    const neu = calc({ tax_regime: 'new', business_income: 60000000 });
    expect(Number(neu.surcharge)).toBe(Math.round(Number(neu.tax_on_income) * 0.25));
  });

  it('warns at the presumptive limits', () => {
    const ids = (v: Record<string, unknown>) => p.validateForm(v as never).map((x) => `${x.fieldId}:${x.severity}`);
    expect(ids({ presumptive_turnover_digital: 25000000 })).toEqual([]); // ≤ ₹3Cr, no cash
    expect(ids({ presumptive_turnover_digital: 20000000, presumptive_turnover: 5000000 })).toContain('presumptive_turnover:warning');
    expect(ids({ professional_receipts: 6000000 })).toContain('professional_receipts:info');
    expect(ids({ professional_receipts: 8000000 })).toContain('professional_receipts:warning');
  });
});
