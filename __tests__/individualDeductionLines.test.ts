/**
 * Individual tax return deduction lines — @ai2/tax-plugins
 * ai2fin.com
 *
 * The AU lines are the ATO's 2026 individual and supplementary return
 * questions D1–D15 (read 28 September 2026). Each must feed a real AU-IT
 * field, cite its page, and leave rates to the effective-dated lookups.
 */

import * as pkg from '../src';
import {
  AU_CENTS_PER_KM_MAX_BUSINESS_KM,
  australiaIncomeTaxPlugin,
  individualDeductionLine,
  individualDeductionLines,
  methodRate,
  type IndividualDeductionForm,
} from '../src';

const au = individualDeductionLines('AU') as IndividualDeductionForm;
const auItFields = new Set(australiaIncomeTaxPlugin.getFormSchema({ incomeYear: '2025-26' }).flatMap((s) => s.fields).map((f) => f.id));

describe('AU individual deduction lines', () => {
  it('are D1 to D15 in the form\'s order, D1–D10 on the return and D11–D15 on the supplementary', () => {
    expect(au.lines.map((l) => l.ref)).toEqual(['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15']);
    expect(au.lines.filter((l) => l.form === 'individual').map((l) => l.ref)).toEqual(['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10']);
  });

  it('use the form\'s own words', () => {
    const labels = Object.fromEntries(au.lines.map((l) => [l.ref, l.label]));
    expect(labels).toMatchObject({
      D1: 'Work-related car expenses',
      D2: 'Work-related travel expenses',
      D3: 'Work clothing, laundry and dry-cleaning expenses',
      D4: 'Work-related self-education expenses',
      D5: 'Other work-related expenses',
      D6: 'Low-value pool deduction',
      D7: 'Interest income deductions',
      D8: 'Dividend deductions',
      D9: 'Gifts or donations',
      D10: 'Cost of managing tax affairs',
      D12: 'Personal superannuation contributions',
    });
  });

  it('feed real AU-IT fields', () => {
    const feeds = Object.fromEntries(au.lines.map((l) => [l.ref, l.feedsField]));
    expect(feeds).toMatchObject({
      D1: 'work_related_car',
      D2: 'work_related_travel',
      D3: 'work_related_clothing',
      D4: 'self_education',
      D5: 'other_deductions',
      D9: 'donations',
      D10: 'tax_agent_fee',
      D11: null,
    });
    for (const l of au.lines) {
      for (const f of [l.feedsField, ...(l.subFields ?? []).map((s) => s.field), ...(l.methods ?? []).map((m) => m.feedsField)]) {
        if (f) expect({ line: l.ref, field: f, exists: auItFields.has(f) }).toEqual({ line: l.ref, field: f, exists: true });
      }
    }
    expect(individualDeductionLine('au.d15_other')!.subFields).toEqual([expect.objectContaining({ field: 'income_protection' })]);
    expect(individualDeductionLine('au.d5_other_work')!.subFields).toEqual([expect.objectContaining({ field: 'work_from_home' })]);
  });

  it('every line cites its ATO page, with the page date and the read date', () => {
    for (const l of au.lines) {
      expect(l.source.url).toMatch(/^https:\/\/www\.ato\.gov\.au\/forms-and-instructions\/individual-(supplementary-)?tax-return-2026-instructions\//);
      expect(l.source.readOn).toBe('2026-09-28');
      expect(l.source.pageLastUpdated).toMatch(/^2026-\d{2}-\d{2}$/);
      expect(l.key).toMatch(/^au\.d\d{1,2}_[a-z_]+$/);
      expect(l.description.length).toBeGreaterThan(20);
    }
  });

  it('keys are unique and look-ups round-trip', () => {
    const keys = au.lines.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(individualDeductionLine(k)!.key).toBe(k);
    expect(individualDeductionLine('au.d99_nothing')).toBeNull();
  });
});

describe('D1 methods link to the rate lookups', () => {
  const d1 = individualDeductionLine('au.d1_car')!;
  const cents = d1.methods!.find((m) => m.key === 'cents_per_km')!;

  it('cents per km: capped at 5,000 km, the rate by year from centsPerKmRate', () => {
    expect(d1.methods!.map((m) => m.key)).toEqual(['cents_per_km', 'logbook']);
    expect(cents.cap).toEqual({ amount: AU_CENTS_PER_KM_MAX_BUSINESS_KM, unit: 'km' });
    expect(cents.cap!.amount).toBe(5000);
    expect(methodRate(cents, '2025-26')!.rate).toBe(0.88); // "88c per kilometre for 2025–26" — the D1 page
    expect(methodRate(cents, '2026-27')!.rate).toBe(0.91);
    expect(methodRate(cents, '2027-28')!.rate).toBeNull(); // not yet determined: never carried forward
  });

  it('the logbook method uses actual costs, so it has no rate', () => {
    expect(methodRate(d1.methods!.find((m) => m.key === 'logbook')!, '2025-26')).toBeNull();
  });

  it('D5 working from home: the fixed rate from workFromHomeFixedRate (70c for 2025–26)', () => {
    const fixed = individualDeductionLine('au.d5_other_work')!.methods!.find((m) => m.key === 'fixed_rate')!;
    expect(methodRate(fixed, '2025-26')!.rate).toBe(0.7);
    expect(methodRate(fixed, '2026-27')!.rate).toBeNull();
  });

  it('no rate is copied into the line data', () => {
    expect(JSON.stringify(au)).not.toMatch(/0\.88|0\.91|0\.7\b|88c|70c/);
  });
});

describe('other countries', () => {
  it.each(['GB', 'US', 'CA', 'NZ', 'IN', 'ZZ'])('%s returns null until its return lines are verified', (c) => {
    expect(individualDeductionLines(c)).toBeNull();
  });

  it('accepts lower case, and returns a copy', () => {
    const a = individualDeductionLines('au')!;
    a.lines.length = 0;
    expect(individualDeductionLines('AU')!.lines.length).toBe(15);
  });

  it('is exported from the package index', () => {
    expect(pkg.individualDeductionLines).toBe(individualDeductionLines);
    expect(pkg.methodRate).toBe(methodRate);
  });
});
