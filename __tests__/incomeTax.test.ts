/**
 * Personal income-tax estimator — anchor + regression tests. embracingearth.space
 *
 * These anchors are the same ones already pinned in the website's
 * lib/incomeTaxCalc.test.ts, independently re-derived against authority
 * schedules there. Reproducing them here proves this implementation is a
 * faithful port, not a rewrite that happens to look similar — a single wrong
 * digit anywhere in the composition (deduction → progressive tax → offsets →
 * levies) would show up as a mismatch against a number someone already
 * checked against the ATO/HMRC/IRS/Income Tax Dept by hand.
 */
import {
  calcIncomeTax,
  getIncomeTaxYears,
  getIncomeTaxScheme,
  listIncomeTaxCountries,
  INCOME_TAX_SCHEMES,
} from '../src';

const sum = (items: { amount: number }[]) => items.reduce((s, i) => s + i.amount, 0);

describe('income-tax take-home anchors', () => {
  it('AU $90k FY2025-26 → $70,412 take-home (regression guard)', () => {
    const r = calcIncomeTax('AU', 90000, '2025-26')!;
    expect(r.incomeTax).toBe(17788);
    expect(sum(r.levies)).toBe(1800);
    expect(r.totalTax).toBe(19588);
    expect(r.takeHome).toBe(70412);
  });

  it('UK £60k → £11,432 income tax + £3,211 NI (England/Wales/NI)', () => {
    const r = calcIncomeTax('GB', 60000, '2025-26')!;
    expect(r.taxable).toBe(47430);
    expect(r.incomeTax).toBe(11432);
    expect(r.levies.find((l) => l.name === 'National Insurance')?.amount).toBe(3211);
    expect(r.takeHome).toBe(45357);
  });

  it('IN ₹12.75L (new regime) → ₹0 tax via the s.87A rebate', () => {
    const r = calcIncomeTax('IN', 1275000, '2025-26 (AY 2026-27)')!;
    expect(r.taxable).toBe(1200000);
    expect(r.incomeTax).toBe(60000);
    expect(r.offsets.find((o) => o.name === 'Section 87A rebate')?.amount).toBe(60000);
    expect(r.totalTax).toBe(0);
  });

  it('IN ₹16L (new regime) → ₹113,100 (slab tax + 4% cess)', () => {
    const r = calcIncomeTax('IN', 1600000, '2025-26 (AY 2026-27)')!;
    expect(r.incomeTax).toBe(108750);
    expect(r.levies.find((l) => l.name.startsWith('Health'))?.amount).toBe(4350);
    expect(r.totalTax).toBe(113100);
  });

  it('IN s.87A marginal relief just above ₹12L caps the cliff', () => {
    const r = calcIncomeTax('IN', 1285000, '2025-26 (AY 2026-27)')!;
    expect(r.taxable).toBe(1210000);
    expect(r.totalTax).toBe(10400);
  });

  it('NZ stays income-tax-only (no levies/offsets)', () => {
    const r = calcIncomeTax('NZ', 80000, '2025-26')!;
    expect(r.levies).toHaveLength(0);
    expect(r.offsets).toHaveLength(0);
  });

  it('US $100k → federal $13,170 on $83,900 taxable', () => {
    const r = calcIncomeTax('US', 100000, '2026')!;
    expect(r.taxable).toBe(83900);
    expect(r.incomeTax).toBe(13170);
  });
});

/**
 * The specific bug this whole module exists to have fixed exactly once, in
 * exactly one place: AU's LITO must survive zeroing out income tax and go on
 * to offset the Medicare levy too — the ATO nets LITO against the combined
 * liability. Both figures are the live taxmcp.ai2fin.com response, not
 * hand-derived (see the website's PR history for the incident this was).
 */
describe('AU LITO offsets the Medicare levy, not just income tax', () => {
  it('$9,100 → $0 total tax', () => {
    const r = calcIncomeTax('AU', 9100, '2026-27')!;
    expect(r.incomeTax).toBe(0);
    expect(sum(r.levies)).toBe(182);
    expect(sum(r.offsets)).toBe(700);
    expect(r.totalTax).toBe(0);
    expect(r.takeHome).toBe(9100);
  });

  it('$18,200 (tax-free threshold) → $0 total tax, not $364', () => {
    const r = calcIncomeTax('AU', 18200, '2026-27')!;
    expect(r.totalTax).toBe(0);
    expect(r.takeHome).toBe(18200);
  });

  it('$20,000 → $0 total tax (the exact case that once diverged between the website and the MCP)', () => {
    const r = calcIncomeTax('AU', 20000, '2026-27')!;
    expect(r.totalTax).toBe(0);
  });
});

describe('tax-year resolution', () => {
  it('resolves an explicit year label', () => {
    expect(calcIncomeTax('AU', 90000, '2024-25')!.taxYear).toBe('2024-25');
  });

  it('an explicit unknown year returns null, never a silently-substituted current year', () => {
    expect(calcIncomeTax('AU', 90000, '1999-00')).toBeNull();
    expect(calcIncomeTax('GB', 90000, '2019-20')).toBeNull();
  });

  it('an unsupported country returns null, never a guessed figure', () => {
    expect(calcIncomeTax('ZZ', 90000)).toBeNull();
    expect(calcIncomeTax('FR', 90000)).toBeNull();
  });

  it('every scheme resolves to a year that has actually started', () => {
    for (const code of listIncomeTaxCountries()) {
      const scheme = getIncomeTaxScheme(code)!;
      const current = calcIncomeTax(code, 50000)!.taxYear;
      const years = getIncomeTaxYears(code);
      const currentEntry = years.find((y) => y.value === current)!;
      expect(currentEntry).toBeDefined();
      expect(currentEntry.isCurrent).toBe(true);
    }
  });

  it('exactly one year is flagged current per country', () => {
    for (const code of listIncomeTaxCountries()) {
      const flagged = getIncomeTaxYears(code).filter((y) => y.isCurrent);
      expect(flagged).toHaveLength(1);
    }
  });
});

describe('every scheme carries real provenance', () => {
  it('names an authority, a source URL, and a citation date for every country', () => {
    for (const code of listIncomeTaxCountries()) {
      const scheme = INCOME_TAX_SCHEMES[code]!;
      expect(scheme.authorityName.length).toBeGreaterThan(0);
      expect(scheme.source).toMatch(/^https:\/\//);
      expect(scheme.citationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(scheme.verified).toBe(true);
    }
  });

  it('covers the five countries the website and the MCP both need', () => {
    expect(listIncomeTaxCountries().sort()).toEqual(['AU', 'GB', 'IN', 'NZ', 'US']);
  });
});

describe('marginal rate (country-specific)', () => {
  it('AU folds in the 2% Medicare levy', () => {
    expect(calcIncomeTax('AU', 90000, '2025-26')!.marginalRate).toBeCloseTo(0.32, 6);
  });

  it('UK marginal rate includes National Insurance', () => {
    expect(calcIncomeTax('GB', 40000, '2025-26')!.marginalRate).toBeCloseTo(0.28, 6);
    expect(calcIncomeTax('GB', 60000, '2025-26')!.marginalRate).toBeCloseTo(0.42, 6);
  });

  it('UK taper zone (£100k–£125,140) shows the 60%+ effective marginal', () => {
    expect(calcIncomeTax('GB', 110000, '2025-26')!.marginalRate).toBeCloseTo(0.62, 6);
  });

  it('India marginal rate includes the 4% cess', () => {
    expect(calcIncomeTax('IN', 1500000, '2025-26 (AY 2026-27)')!.marginalRate).toBeCloseTo(0.156, 6);
  });
});
