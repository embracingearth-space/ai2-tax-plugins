/**
 * CA-IT (T1) — CPP, credits and self-employment income regression tests.
 * @ai2/tax-plugins — ai2fin.com
 *
 * REGRESSION (2026-10 audit, findings 11–16). Every expected figure below was
 * worked by hand from the CRA's own rules, with the CRA pages read 2026-10-11:
 *   - Schedule 8 (5000-S8, 2025): canada.ca/.../general-income-tax-benefit-package/5000-s8.html
 *   - CPP rates: .../canada-pension-plan-cpp/cpp-contribution-rates-maximums-exemptions.html
 *     (2026: YMPE 74,600, exemption 3,500, 5.95%, self-employed max 8,460.90;
 *      2025: 71,300, max 8,068.20)
 *   - CPP2: .../making-deductions/second-additional-cpp-contribution-rates-maximums.html
 *     (YAMPE 2026 85,000 / 2025 81,200; 4% each side; SE max 832 / 792)
 *   - Tax treatment: .../news/2023/05/the-canada-pension-plan-enhancement--...html
 *     ("Claim a non-refundable tax credit on 4.95% of the base CPP contributions,
 *      and claim a tax deduction on the other 4.95%"; "All CPP2 contributions are
 *      tax deductible")
 *   - EI: .../employment-insurance-ei/ei-premium-rates-maximums.html (2026 68,900 at 1.63%)
 *   - Indexation (2026): Canada employment amount 1,501; medical 3% ceiling 2,890;
 *     disability amount 10,341.
 *   - T2125 Part 3: gross business 13499 / professional 13699; net 13500 / 13700.
 *
 * 2026 federal: 14% to 58,523 (= 8,193.22), 20.5% to 117,045; BPA 16,452 × 14%
 * = 2,303.28. Amounts are worked line by line in cents, as on the return.
 */

import { canadaIncomeTaxPlugin, calcIncomeTax } from '../src';
import { CA_IT_RETURN_EXTRAS } from '../src/countries/canadaIncomeTax';
import { CA_FEDERAL_YEARS } from '../src/data/canadaFederal';

const p = canadaIncomeTaxPlugin;
const calc = (v: Record<string, unknown>) => p.calculateFields(v as never) as Record<string, number>;
const field = (id: string) => p.getFormSchema().flatMap((s) => s.fields).find((f) => f.id === id)!;

function at(iso: string) {
  beforeAll(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(new Date(iso));
  });
  afterAll(() => {
    jest.useRealTimers();
  });
}

describe('CA-IT 2026 — finding 11: self-employed CPP is split into a credit and a deduction, CPP2 is charged', () => {
  at('2026-10-11T12:00:00Z');

  it('SE $80,000: total federal payable 17,591.35 (was 18,753.63)', () => {
    // OLD: federal tax on 80,000 = 8,193.22 + 21,477 × 20.5% − 2,303.28 = 10,292.73,
    //      plus 71,100 × 11.9% = 8,460.90 → 18,753.63. The half it computed as
    //      "cppDeduction" was never used; no CPP2, no line 31000 credit.
    // NEW (Schedule 8 Part 4/5):
    //   line 43  71,100 × 9.9% = 7,038.90   line 44  71,100 × 2% = 1,422.00
    //   line 45  (80,000 − 74,600) × 8% = 432.00
    //   line 31000 = 7,038.90 × 50% = 3,519.45
    //   line 22200 = 3,519.45 + 1,422.00 + 432.00 = 5,373.45
    //   net income 80,000 − 5,373.45 = 74,626.55
    //   federal tax 8,193.22 + 16,103.55 × 20.5% − 2,303.28 = 9,191.17
    //   credits 3,519.45 × 14% = 492.72 → line 42000 8,698.45
    //   + line 42100 (8,460.90 + 432.00) = 17,591.35
    //   (17,591.34 if nothing is rounded to cents along the way.)
    const r = calc({ self_employment_net: 80000 });
    expect(r.cpp_contributions).toBe(8460.9);
    expect(r.cpp2_contributions).toBe(432);
    expect(r.cpp_base_self_employed).toBe(3519.45);
    expect(r.cpp_deduction_self_employed).toBe(5373.45);
    expect(r.net_income).toBe(74626.55);
    expect(r.federal_tax).toBe(9191.17);
    expect(r.non_refundable_credits).toBe(492.72);
    expect(r.net_federal_tax).toBe(8698.45);
    expect(r.total_federal_payable).toBe(17591.35);
  });

  it('SE $100,000 pays exactly the CRA self-employed maxima: 8,460.90 CPP and 832.00 CPP2', () => {
    const r = calc({ self_employment_net: 100000 });
    expect(r.cpp_contributions).toBe(8460.9);
    expect(r.cpp2_contributions).toBe(832);
  });
});

describe('CA-IT 2025 — the 2025 ceilings (YMPE 71,300, YAMPE 81,200)', () => {
  at('2025-06-30T12:00:00Z');

  it('SE $100,000 pays the 2025 maxima: 8,068.20 CPP (6,712.20 + 1,356.00) and 792.00 CPP2', () => {
    const r = calc({ self_employment_net: 100000 });
    expect(r.cpp_contributions).toBe(8068.2);
    expect(r.cpp2_contributions).toBe(792);
    // Line 31000 = 6,712.20 / 2; line 22200 = 3,356.10 + 1,356.00 + 792.00.
    expect(r.cpp_base_self_employed).toBe(3356.1);
    expect(r.cpp_deduction_self_employed).toBe(5504.1);
  });

  it('an employee on $100,000 pays the 2025 employee maxima: 4,034.10 CPP, 396.00 CPP2, 1,077.48 EI', () => {
    const r = calc({ employment_income: 100000 });
    expect(r.cpp_employee).toBe(4034.1);
    expect(r.cpp2_employee).toBe(396);
    expect(r.ei_premiums).toBe(1077.48);
    expect(r.canada_employment_amount).toBe(1471);
  });
});

describe('CA-IT 2026 — finding 12: self-employed CPP counts what the T4s already paid (Schedule 8 Part 5)', () => {
  at('2026-10-11T12:00:00Z');

  it('$80,000 T4 + $20,000 SE: SE pays only CPP2 on 5,000 → 400; total payable 13,660.60 (was 16,356.23)', () => {
    // OLD: (20,000 − 3,500) × 11.9% = 1,963.50 on top of 14,392.73 federal tax
    //      on 100,000 → 16,356.23 (fresh exemption, fresh YMPE).
    // FINDING 12 ALONE (audit's figure): SE CPP is just CPP2 (85,000 − 80,000) × 8%
    //      = 400, deducted at 22200 → tax on 99,600 = 14,310.73 + 400 = 14,710.73.
    // WITH FINDING 16 TOO (employee CPP/EI/Canada employment amount):
    //   T4 CPP 71,100 × 5.95% = 4,230.45 covers the whole YMPE → SE base/first = 0
    //   CPP2: room 10,400 − 216 / 4% = 5,000 → line 45 = 400; line 22200 = 400
    //   line 22215 = 711.00 + 216.00 = 927.00
    //   net income 100,000 − 400 − 927 = 98,673
    //   federal tax 8,193.22 + 40,150 × 20.5% − 2,303.28 = 14,120.69
    //   credits (3,519.45 + 1,123.07 EI + 1,501) × 14% = 860.09 → 13,260.60
    //   + 400 CPP2 → 13,660.60
    const r = calc({ employment_income: 80000, self_employment_net: 20000 });
    expect(r.cpp_contributions).toBe(0);
    expect(r.cpp2_contributions).toBe(400);
    expect(r.cpp_deduction_self_employed).toBe(400);
    expect(r.cpp_deduction_employment).toBe(927);
    expect(r.net_income).toBe(98673);
    expect(r.federal_tax).toBe(14120.69);
    expect(r.non_refundable_credits).toBe(860.09);
    expect(r.total_federal_payable).toBe(13660.6);
  });

  it('$50,000 T4 + $30,000 SE: SE base room is what the T4 left of the YMPE', () => {
    // T4 covers 50,000 − 3,500 = 46,500 → SE base earnings 71,100 − 46,500 = 24,600
    //   × 11.9% = 2,927.40; CPP2 (80,000 − 74,600) × 8% = 432.00.
    const r = calc({ employment_income: 50000, self_employment_net: 30000 });
    expect(r.cpp_employee).toBe(2766.75);
    expect(r.cpp_contributions).toBe(2927.4);
    expect(r.cpp2_contributions).toBe(432);
  });

  it('employment below the basic exemption leaves the rest of it for the SE earnings (Part 5 lines 23-29)', () => {
    // 2,000 T4 + 100,000 SE: combined base earnings min(102,000, 74,600) − 3,500
    //   = 71,100, all on SE → 8,460.90; CPP2 85,000 − 74,600 = 10,400 × 8% = 832.
    const r = calc({ employment_income: 2000, self_employment_net: 100000 });
    expect(r.cpp_employee).toBe(0);
    expect(r.cpp_contributions).toBe(8460.9);
    expect(r.cpp2_contributions).toBe(832);
    // 2,000 T4 + 10,000 SE: 12,000 − 3,500 = 8,500 × 11.9% = 1,011.50.
    expect(calc({ employment_income: 2000, self_employment_net: 10000 }).cpp_contributions).toBe(1011.5);
  });

  it('a self-employment loss never reduces CPP on employment', () => {
    const r = calc({ employment_income: 80000, self_employment_net: -5000 });
    expect(r.cpp_contributions).toBe(0);
    expect(r.cpp2_contributions).toBe(0);
    expect(r.cpp_employee).toBe(4230.45);
  });
});

describe('CA-IT 2026 — finding 13: credits reduce federal tax only, never the CPP payable', () => {
  at('2026-10-11T12:00:00Z');

  it('SE $20,000 + $3,000 donations: payable is the CPP, 1,963.50 (was 1,620.22)', () => {
    // OLD: 496.72 federal tax + 1,963.50 CPP − 840 donation credit = 1,620.22.
    // NEW: line 22200 = 816.75 + 330 = 1,146.75 → net income 18,853.25
    //   federal tax 18,853.25 × 14% − 2,303.28 = 336.18
    //   credits 816.75 × 14% + (200 × 14% + 2,800 × 29%) = 114.35 + 840 = 954.35
    //   line 42000 = max(0, 336.18 − 954.35) = 0; + line 42100 1,963.50.
    const r = calc({ self_employment_net: 20000, charitable_donations: 3000 });
    expect(r.cpp_contributions).toBe(1963.5);
    expect(r.net_federal_tax).toBe(0);
    expect(r.total_federal_payable).toBe(1963.5);
  });
});

describe('CA-IT 2026 — finding 14: medical expenses and the disability amount are credited', () => {
  at('2026-10-11T12:00:00Z');

  it('a $10,000 disability amount is worth 10,000 × 14% = 1,400 off federal tax (was 0)', () => {
    const base = calc({ employment_income: 80000 });
    const withDtc = calc({ employment_income: 80000, disability_amount: 10000 });
    expect(withDtc.non_refundable_credits - base.non_refundable_credits).toBeCloseTo(1400, 2);
    expect(base.net_federal_tax - withDtc.net_federal_tax).toBeCloseTo(1400, 2);
  });

  it('medical: expenses above 3% of net income when that is under the $2,890 ceiling', () => {
    // $80,000 T4: net income 80,000 − 927 = 79,073; 3% = 2,372.19 < 2,890
    //   → 5,000 − 2,372.19 = 2,627.81 (was 0). Credits (3,519.45 + 1,123.07 +
    //   1,501 + 2,627.81) × 14% = 8,771.33 × 14% = 1,227.99 (860.09 without).
    const r = calc({ employment_income: 80000, medical_expenses: 5000 });
    expect(r.medical_expenses_allowable).toBe(2627.81);
    expect(r.non_refundable_credits).toBe(1227.99);
  });

  it('medical: the $2,890 ceiling applies once 3% of net income is larger', () => {
    // $200,000 T4: 3% of 198,873 = 5,966.19 > 2,890 → 5,000 − 2,890 = 2,110.
    expect(calc({ employment_income: 200000, medical_expenses: 5000 }).medical_expenses_allowable).toBe(2110);
  });

  it('warns when the disability amount is above the year amount', () => {
    const w = p.validateForm({ disability_amount: 12000 });
    expect(w.some((x) => x.fieldId === 'disability_amount')).toBe(true);
    expect(p.validateForm({ disability_amount: 10341 }).some((x) => x.fieldId === 'disability_amount')).toBe(false);
  });
});

describe('CA-IT 2026 — finding 15: gross vs net self-employment lines and the auto-filled gross', () => {
  at('2026-10-11T12:00:00Z');

  it('labels: gross is 13499 / 13699, net is 13500 / 13700 (were 13500 and 13700)', () => {
    expect(field('self_employment_gross').officialLabel).toBe('Line 13499 / 13699');
    expect(field('self_employment_net').officialLabel).toBe('Line 13500 / 13700');
  });

  it('an auto-filled gross with no net is taxed as gross less expenses (was ignored: $0 income)', () => {
    // OLD: { self_employment_gross: 50,000 } → total_income 0, payable 0.
    expect(calc({ self_employment_gross: 50000 }).total_income).toBe(50000);
    expect(calc({ self_employment_gross: 50000, self_employment_expenses: 20000 }).total_income).toBe(30000);
    // Net, when entered, is what the T1 reads.
    expect(calc({ self_employment_gross: 50000, self_employment_expenses: 20000, self_employment_net: 10000 }).total_income).toBe(10000);
    // And it drives CPP the same way: (30,000 − 3,500) × 11.9% = 3,153.50.
    expect(calc({ self_employment_gross: 50000, self_employment_expenses: 20000 }).cpp_contributions).toBe(3153.5);
  });

  it('auto-fills the gross from sales net of GST/HST (T2125 3A less 3B), not the tax-inclusive total', () => {
    expect(p.getAutoPopulateMapping()).toEqual([{ fieldId: 'self_employment_gross', aggregateKey: 'income_net' }]);
    expect(field('self_employment_gross').autoPopulateFrom).toBe('income_net');
  });

  it('warns when gross is being taxed with no expenses entered', () => {
    expect(p.validateForm({ self_employment_gross: 50000 }).some((x) => x.fieldId === 'self_employment_expenses')).toBe(true);
    expect(p.validateForm({ self_employment_gross: 50000, self_employment_expenses: 0 }).some((x) => x.fieldId === 'self_employment_expenses')).toBe(false);
  });

  it('does not return the input fields (an auto-filled gross survives recalculation)', () => {
    const r = calc({ self_employment_gross: 987654 });
    expect(Object.prototype.hasOwnProperty.call(r, 'self_employment_gross')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(r, 'self_employment_net')).toBe(false);
  });
});

describe('CA-IT 2026 — finding 16: employees get CPP, EI and Canada employment amount credits', () => {
  at('2026-10-11T12:00:00Z');

  it('$80,000 T4: base CPP credit 3,519.45 × 14% = 492.72; total payable 9,242.60 (was 10,292.73)', () => {
    // OLD: 8,193.22 + 21,477 × 20.5% − 2,303.28 = 10,292.73, no CPP/EI/CEA at all.
    // NEW: box 16 71,100 × 5.95% = 4,230.45 (base 3,519.45 + first 711.00)
    //   box 16A (80,000 − 74,600) × 4% = 216.00; box 18 68,900 × 1.63% = 1,123.07
    //   line 22215 = 711 + 216 = 927 → net income 79,073
    //   federal tax 8,193.22 + 20,550 × 20.5% − 2,303.28 = 10,102.69
    //   credits (3,519.45 + 1,123.07 + 1,501) × 14% = 860.09 → 9,242.60
    const r = calc({ employment_income: 80000 });
    expect(r.cpp_employee).toBe(4230.45);
    expect(r.cpp2_employee).toBe(216);
    expect(r.ei_premiums).toBe(1123.07);
    expect(r.cpp_base_employment).toBe(3519.45);
    expect(r.cpp_base_employment * 0.14).toBeCloseTo(492.72, 2);
    expect(r.cpp_deduction_employment).toBe(927);
    expect(r.canada_employment_amount).toBe(1501);
    expect(r.net_income).toBe(79073);
    expect(r.federal_tax).toBe(10102.69);
    expect(r.non_refundable_credits).toBe(860.09);
    expect(r.total_federal_payable).toBe(9242.6);
    // No self-employment: nothing on lines 22200 / 31000 / 42100.
    expect(r.cpp_contributions).toBe(0);
    expect(r.cpp2_contributions).toBe(0);
    expect(r.cpp_deduction_self_employed).toBe(0);
  });

  it('the Canada employment amount is the lesser of employment income and $1,501', () => {
    expect(calc({ employment_income: 1000 }).canada_employment_amount).toBe(1000);
    expect(calc({ self_employment_net: 80000 }).canada_employment_amount).toBe(0);
  });

  it('T4 amounts entered by the user override the calculated ones, and are returned (override-aware)', () => {
    // Box 16 4,000: base share 4,000 × 4.95/5.95 = 3,327.73; first additional 672.27.
    const r = calc({ employment_income: 80000, cpp_employee: 4000, cpp2_employee: 0, ei_premiums: 1000 });
    expect(r.cpp_employee).toBe(4000);
    expect(r.cpp2_employee).toBe(0);
    expect(r.ei_premiums).toBe(1000);
    expect(r.cpp_base_employment).toBe(3327.73);
    expect(r.cpp_deduction_employment).toBe(672.27);
  });

  it('a T4 override of 0 (exempt employee) is respected — the like-for-like check against the CA scheme', () => {
    // The take-home scheme excludes CPP/EI by design, so with box 16/16A at 0 the
    // plugin's federal_tax (after the BPA only) matches it again.
    for (const income of [30000, 100000, 200000, 300000]) {
      const plugin = calc({ employment_income: income, cpp_employee: 0, cpp2_employee: 0 }).federal_tax;
      expect(Math.abs(plugin - calcIncomeTax('CA', income, '2026')!.totalTax)).toBeLessThanOrEqual(1);
    }
  });

  it('$300,000 T4: line 22215 = 711 + 416 = 1,127 lowers federal tax to 70,528.08 (was 70,899.99)', () => {
    // 72,976.05 bracket tax on 300,000 less 1,127 × 33% = 371.91 → 72,604.14,
    // less 14,829 × 14% = 2,076.06 → 70,528.08.
    expect(calc({ employment_income: 300000 }).federal_tax).toBe(70528.08);
  });

  it('flags a T4 amount above what the employment income requires (refund not computed)', () => {
    const w = p.validateForm({ employment_income: 80000, cpp_employee: 5000 });
    expect(w.some((x) => x.fieldId === 'cpp_employee' && x.severity === 'info')).toBe(true);
    expect(p.validateForm({ employment_income: 80000, cpp_employee: 4230.45 }).some((x) => x.fieldId === 'cpp_employee')).toBe(false);
  });

  it('the T4 fields are calculated AND editable, so the client lets the user override them', () => {
    for (const id of ['cpp_employee', 'cpp2_employee', 'ei_premiums']) {
      expect(field(id).calculated).toBe(true);
      expect(field(id).editable).toBe(true);
    }
  });
});

describe('CA-IT — year data kept locally until it moves into canadaFederal.ts', () => {
  it('every shared federal year has its CPP2 / EI / credit amounts here', () => {
    for (const y of CA_FEDERAL_YEARS) expect(CA_IT_RETURN_EXTRAS[y.taxYear]).toBeDefined();
  });

  it('the CPP base and first-additional rates add up to the shared employee rate', () => {
    for (const y of CA_FEDERAL_YEARS) expect(0.0495 + 0.01).toBeCloseTo(y.cpp.employeeRate, 10);
  });

  it('every calculated value is a schema field', () => {
    const ids = new Set(p.getFormSchema().flatMap((s) => s.fields).map((f) => f.id));
    for (const k of Object.keys(calc({ employment_income: 80000, self_employment_net: 20000 }))) expect(ids.has(k)).toBe(true);
  });
});
