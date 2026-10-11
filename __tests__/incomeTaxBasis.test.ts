/**
 * Income basis, self-employed income and tax-year labels — @ai2/tax-plugins
 * ai2fin.com
 *
 * REGRESSION: the estimator takes one gross number and no income type, so it
 * handed salaried figures to freelancers without saying so. India gave a
 * freelancer on ₹14.1L the ₹75,000 salary standard deduction (₹83,460 instead
 * of ₹95,160) and the result carried no assumptions at all; six hand-written
 * schemes never stated their basis. And a tax year had to match the label
 * exactly, so India refused the plain '2026-27' its own Act now uses.
 */

import { calcIncomeTax, listIncomeTaxCountries, getIncomeTaxScheme, resolveIncomeTaxYear } from '../src';

describe('every result states its income basis', () => {
  it.each(listIncomeTaxCountries())('%s leads with the income basis', (code) => {
    const r = calcIncomeTax(code, 50000);
    expect(r).not.toBeNull();
    expect(['employment', 'any']).toContain(r!.incomeBasis);
    expect(r!.assumptions?.[0]).toMatch(/^Computed (as employment income|on gross income)/);
    const scheme = getIncomeTaxScheme(code)!;
    expect(scheme.incomeBasis.selfEmployedNote.length).toBeGreaterThan(20);
  });

  it('refuses self-employed income where it is not modelled, saying what differs', () => {
    expect(() => calcIncomeTax('US', 80000, undefined, { incomeType: 'self-employed' })).toThrow(/self-employment tax/);
    expect(() => calcIncomeTax('JP', 6000000, undefined, { incomeType: 'self-employed' })).toThrow(RangeError);
  });

  it('rejects an unknown incomeType rather than ignoring it', () => {
    expect(() => calcIncomeTax('AU', 80000, undefined, { incomeType: 'freelance' as never })).toThrow(/incomeType/);
  });

  it('answers self-employed income where it is the same, and says so', () => {
    const r = calcIncomeTax('NZ', 70000, undefined, { incomeType: 'self-employed' })!;
    expect(r.totalTax).toBe(calcIncomeTax('NZ', 70000)!.totalTax);
    expect(r.assumptions![0]).toMatch(/taxed the same way/);
  });
});

describe('IN — salary vs freelance income', () => {
  it('applies the ₹75,000 standard deduction to salary only', () => {
    const salary = calcIncomeTax('IN', 1410000, '2026-27')!;
    expect(salary.incomeBasis).toBe('employment');
    expect(salary.taxable).toBe(1335000);
    expect(salary.totalTax).toBe(83460);
    expect(salary.assumptions![0]).toMatch(/incomeType "self-employed"/);
  });

  it('gives freelance income no standard deduction (anchor case: ₹95,160)', () => {
    const r = calcIncomeTax('IN', 1410000, '2026-27', { incomeType: 'self-employed' })!;
    expect(r.incomeBasis).toBe('self-employed');
    expect(r.taxable).toBe(1410000);
    // 20,000 + 40,000 + 31,500 = 91,500 slab tax, + 4% cess 3,660.
    expect(r.totalTax).toBe(95160);
    expect(r.assumptions![0]).toMatch(/^Computed as self-employed profit/);
  });
});

describe('GB — Class 4 for self-employed profit', () => {
  it('charges Class 4 (6%/2%) instead of employee Class 1 (8%/2%)', () => {
    const employee = calcIncomeTax('GB', 50000, '2026-27')!;
    const selfEmployed = calcIncomeTax('GB', 50000, '2026-27', { incomeType: 'self-employed' })!;
    expect(employee.levies).toEqual([{ name: 'National Insurance (Class 1, employee)', amount: 2994 }]);
    // (50,000 − 12,570) × 6% = 2,245.80
    expect(selfEmployed.levies).toEqual([{ name: 'National Insurance (Class 4)', amount: 2246 }]);
    expect(selfEmployed.incomeTax).toBe(employee.incomeTax);
    expect(selfEmployed.totalTax).toBe(9732);
  });
});

describe('US / CA — federal-only figures say so', () => {
  it('flags federal-only when no state or province is selected', () => {
    expect(calcIncomeTax('US', 80000)!.assumptions).toContainEqual(expect.stringMatching(/^Federal tax only/));
    expect(calcIncomeTax('US', 80000, undefined, { region: 'CA' })!.assumptions).not.toContainEqual(expect.stringMatching(/^Federal tax only/));
    expect(calcIncomeTax('CA', 80000)!.assumptions).toContainEqual(expect.stringMatching(/^Federal tax only/));
  });

  it('shows the Additional Medicare Tax on its own line', () => {
    const r = calcIncomeTax('US', 300000)!;
    expect(r.levies).toContainEqual({ name: 'Medicare (1.45%)', amount: 4350 });
    expect(r.levies).toContainEqual({ name: 'Additional Medicare Tax (0.9%)', amount: 900 });
  });

  it('drops Yukon’s employee-only Canada employment amount for self-employed income', () => {
    const employed = calcIncomeTax('CA', 80000, '2026', { region: 'YT' })!;
    const selfEmployed = calcIncomeTax('CA', 80000, '2026', { region: 'YT', incomeType: 'self-employed' })!;
    // 6.4% × $1,501 = $96.06 less credit.
    expect(selfEmployed.totalTax - employed.totalTax).toBe(96);
  });
});

describe('AU — Medicare low-income reduction', () => {
  it('says when a year has no thresholds on file', () => {
    expect(calcIncomeTax('AU', 30000, '2024-25')!.assumptions).toContainEqual(expect.stringMatching(/not on file for 2024-25/));
    expect(calcIncomeTax('AU', 30000, '2025-26')!.assumptions).not.toContainEqual(expect.stringMatching(/not on file/));
  });
});

describe('tax-year labels as people type them', () => {
  it.each([
    ['IN', '2026-27', '2026-27 (AY 2027-28)'],
    ['IN', 'Tax Year 2026-27', '2026-27 (AY 2027-28)'],
    ['IN', '2026-2027', '2026-27 (AY 2027-28)'],
    ['IN', 'AY 2027-28', '2026-27 (AY 2027-28)'],
    ['IN', '2025-26', '2025-26 (AY 2026-27)'],
    ['GB', '2026/27', '2026-27'],
    ['GB', '2026 to 2027', '2026-27'],
    ['GB', '2026–27', '2026-27'],
    ['SG', 'YA 2027', '2026 (YA 2027)'],
    ['SG', 'YA2027', '2026 (YA 2027)'],
    ['SG', '2026', '2026 (YA 2027)'],
    ['BE', '2026', '2026 (AY 2027)'],
    ['PK', 'Tax Year 2027', '2026-27'],
    ['PK', '2027', '2026-27'],
    ['PK', '2026', '2025-26'], // FBR's own naming: Tax Year 2026 is July 2025 – June 2026
    ['ZA', '2027 year of assessment', '2026-27'],
    ['NZ', '2027 tax year', '2026-27'],
  ])('%s %s → %s', (code, typed, label) => {
    expect(resolveIncomeTaxYear(code, typed)).toBe(label);
    expect(calcIncomeTax(code, 50000, typed)!.taxYear).toBe(label);
  });

  it.each([
    ['IN', '2026-28'], // not consecutive
    ['US', '2026-27'], // a calendar-year country has no span labels
    ['SG', '2027'], // only 'YA 2027' names that year
    ['AU', 'FY2027'], // the ATO does not name years by their end
    ['IN', '2027-28 (AY 2028-29)'], // not on file
  ])('%s %s is refused, not guessed', (code, typed) => {
    expect(resolveIncomeTaxYear(code, typed)).toBeNull();
    expect(calcIncomeTax(code, 50000, typed)).toBeNull();
  });

  it('never matches a label by substring', () => {
    // India's '2025-26 (AY 2026-27)' contains '2026-27'; the plain year must find 2026-27.
    expect(resolveIncomeTaxYear('IN', '2026-27')).toBe('2026-27 (AY 2027-28)');
  });
});
