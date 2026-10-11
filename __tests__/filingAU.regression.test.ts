/**
 * Regression tests — AU-IT (Australian individual return) filing audit, findings 16–21
 * ai2fin.com
 *
 * Each worked example carries the OLD wrong figure and the corrected one,
 * both computed by hand in the comment, so a reader can check the arithmetic
 * without running the plugin. Every case pins `income_year` so the expected
 * values do not move with the date the suite runs on.
 *
 * Rules relied on (ATO pages, read 2026-10-11 through search results — the
 * site refuses direct fetches):
 *  - LITO: $700 to $37,500; less 5c per $1 to $45,000 (→ $325); less 1.5c
 *    per $1 to $66,667 (→ $0). Non-refundable.
 *  - Medicare levy: nil to the lower threshold, then 10% of the excess
 *    (Medicare Levy Act 1986 s 7(2)) until the full 2%; 2025-26 single
 *    thresholds $28,011 / $35,013, 2024-25 $27,222 / $34,027.
 *  - myTax 2026 Tax estimate: non-refundable offsets reduce only the tax on
 *    taxable income; any excess is "not offset against other liabilities"
 *    such as the Medicare levy.
 *  - Franking credits are refunded once tax and Medicare levy are met.
 *  - SBITO: 16% of the tax on net small business income, max $1,000,
 *    aggregated turnover under $5m.
 */

import { australiaIncomeTaxPlugin as p, calcAuTax, currentFyStartYear } from '../src';

const calc = (v: Record<string, string | number | boolean>) => p.calculateFields(v);
const num = (r: Record<string, unknown>, k: string) => Number(r[k]);

// ─── 16. LITO schedule ──────────────────────────────────────────────────────

describe('16 — LITO follows the ATO schedule ($37,500 / 5c / $45,000 / 1.5c / $66,667)', () => {
  it('$45,000 (2025-26): LITO $325, not $700 — $375 more tax', () => {
    // income tax: (45,000 − 18,200) × 16% = 4,288
    // LITO: 700 − (45,000 − 37,500) × 5c = 700 − 375 = 325   (old: flat 700 to $45k)
    // Medicare: 45,000 × 2% = 900 (above the $35,013 upper threshold)
    // total: 4,288 − 325 + 900 = 4,863                       (old: 4,288 + 900 − 700 = 4,488)
    const r = calc({ income_year: '2025-26', salary_wages: 45000 });
    expect(num(r, 'lito')).toBe(325);
    expect(num(r, 'total_tax')).toBe(4863);
  });

  it('$55,000 (2025-26): LITO $175, not $377 — $202 more tax', () => {
    // income tax: 4,288 + (55,000 − 45,000) × 30% = 7,288
    // LITO: 325 − (55,000 − 45,000) × 1.5c = 325 − 150 = 175  (old: 700 − 10,000 × 3.23c = 377)
    // Medicare: 1,100
    // total: 7,288 − 175 + 1,100 = 8,213                     (old: 7,288 + 1,100 − 377 = 8,011)
    const r = calc({ income_year: '2025-26', salary_wages: 55000 });
    expect(num(r, 'lito')).toBe(175);
    expect(num(r, 'total_tax')).toBe(8213);
  });

  it.each([
    [37500, 700], // the full offset up to and including $37,500
    [40000, 575], // 700 − 2,500 × 5c        (old: 700)
    [60000, 100], // 325 − 15,000 × 1.5c     (old: 700 − 15,000 × 3.23c ≈ 216)
    [66667, 0], //   325 − 21,667 × 1.5c = −0.005 → nil
    [80000, 0],
  ])('taxable $%i → LITO $%i', (salary, lito) => {
    expect(num(calc({ income_year: '2025-26', salary_wages: salary }), 'lito')).toBe(lito);
  });
});

// ─── 17. Medicare low-income reduction; LITO never reduces the levy ────────

describe('17 — Medicare levy low-income reduction, and LITO does not reduce the levy', () => {
  it('$25,000 salary (2026-27): $320, not $820', () => {
    // income tax: (25,000 − 18,200) × 15% = 1,020; less LITO 700 = 320
    // Medicare: 25,000 ≤ 28,011 lower threshold → nil         (old: flat 2% = 500)
    // total: 320 + 0 = 320                                    (old: 1,020 + 500 − 700 = 820)
    const r = calc({ income_year: '2026-27', salary_wages: 25000 });
    expect(num(r, 'medicare_levy')).toBe(0);
    expect(num(r, 'total_tax')).toBe(320);
  });

  it('$30,000 (2025-26): the levy shades in at 10c per $1 over $28,011', () => {
    // income tax: 11,800 × 16% = 1,888; less LITO 700 = 1,188
    // Medicare: min(600, (30,000 − 28,011) × 10%) = min(600, 198.90) → 199   (old: 600)
    // total: 1,188 + 199 = 1,387                                               (old: 1,888 + 600 − 700 = 1,788)
    const r = calc({ income_year: '2025-26', salary_wages: 30000 });
    expect(num(r, 'medicare_levy')).toBe(199);
    expect(num(r, 'total_tax')).toBe(1387);
  });

  it('above the upper threshold the full 2% applies', () => {
    // 36,000 × 2% = 720 (the 10% shade-in would be 798.90, capped at the full levy)
    expect(num(calc({ income_year: '2025-26', salary_wages: 36000 }), 'medicare_levy')).toBe(720);
  });

  it('2024-25 uses its own (lower) thresholds, $27,222 / $34,027', () => {
    // Medicare: min(600, (30,000 − 27,222) × 10%) = 277.80 → 278   (old: 600)
    expect(num(calc({ income_year: '2024-25', salary_wages: 30000 }), 'medicare_levy')).toBe(278);
  });

  it('a year with no recorded thresholds (2027-28) keeps the flat 2% and says so', () => {
    // income tax: 6,800 × 14% = 952; less LITO 700 = 252
    // Medicare: no 2027-28 thresholds → flat 25,000 × 2% = 500
    // total: 252 + 500 = 752
    const v = { income_year: '2027-28', salary_wages: 25000 };
    const r = calc(v);
    expect(num(r, 'medicare_levy')).toBe(500);
    expect(num(r, 'total_tax')).toBe(752);
    const msg = p.validateForm(v).find((x) => x.fieldId === 'medicare_levy');
    expect(msg?.severity).toBe('warning');
    expect(msg?.message).toMatch(/2027-28 are not recorded/);
    const help = p.getFormSchema({ incomeYear: '2027-28' }).flatMap((s) => s.fields).find((f) => f.id === 'medicare_levy')!.helpText;
    expect(help).toMatch(/not recorded here, so the flat 2% is used/);
  });

  it('unused LITO does not spill over onto the Medicare levy (myTax 2026 estimate)', () => {
    // 2027-28 (flat 2%), $20,000: income tax 1,800 × 14% = 252; LITO 700 → tax nil, 448 unused
    // Medicare 400 stays payable in full
    // total: 0 + 400 = 400   (old, and the world engine's spill-over: max(0, 252 + 400 − 700) = 0)
    const r = calc({ income_year: '2027-28', salary_wages: 20000 });
    expect(num(r, 'lito')).toBe(700);
    expect(num(r, 'medicare_levy')).toBe(400);
    expect(num(r, 'total_tax')).toBe(400);
  });
});

// ─── 18. Franking credits are refundable ───────────────────────────────────

describe('18 — excess franking credits are refunded, not clamped away', () => {
  it('$7,000 franked amount + $3,000 credits only: a $3,000 refund', () => {
    // taxable: 7,000 + 3,000 = 10,000 → income tax nil, Medicare nil (≤ $28,011)
    // liability 0; total_tax stays nil and the 3,000 is a franking_credit_refund;
    // balance due −3,000 (a refund)
    // old: max(0, 0 + 200 − 700 − 3,000) = 0 → the $3,000 refund was lost
    const r = calc({ income_year: '2025-26', franked_dividends: 7000, franking_credits: 3000 });
    expect(num(r, 'taxable_income')).toBe(10000);
    expect(num(r, 'total_tax')).toBe(0);
    expect(num(r, 'franking_credit_refund')).toBe(3000);
    expect(num(r, 'balance_due')).toBe(-3000);
  });

  it('non-refundable LITO stops at nil; the franking credit is still refunded in full', () => {
    // salary 10,000 + 7,000 + 3,000 = 20,000; income tax 1,800 × 16% = 288
    // LITO 700 → tax nil (412 unused, lost); Medicare nil; franking 3,000 refunded
    // refund 3,000   (old: max(0, 288 + 400 − 700 − 3,000) = 0 — refund lost)
    const r = calc({ income_year: '2025-26', salary_wages: 10000, franked_dividends: 7000, franking_credits: 3000 });
    expect(num(r, 'total_tax')).toBe(0);
    expect(num(r, 'franking_credit_refund')).toBe(3000);
    expect(num(r, 'balance_due')).toBe(-3000);
  });

  it('withholding on top of an excess credit adds to the refund', () => {
    // as above, plus 500 withheld: balance due = −3,000 − 500 = −3,500
    const r = calc({ income_year: '2025-26', salary_wages: 10000, franked_dividends: 7000, franking_credits: 3000, tax_withheld: 500 });
    expect(num(r, 'balance_due')).toBe(-3500);
  });
});

// ─── 19. One franked-dividend convention ───────────────────────────────────

describe('19 — franked dividends: cash franked amount + credit in its own field, counted once', () => {
  const fields = p.getFormSchema({ incomeYear: '2026-27' }).flatMap((s) => s.fields);
  const field = (id: string) => fields.find((f) => f.id === id)!;

  it('the label asks for the franked amount, not a grossed-up figure', () => {
    expect(field('franked_dividends').label).toBe('Franked dividends (franked amount)');
    expect(field('franked_dividends').label).not.toMatch(/grossed/i);
    expect(field('franked_dividends').helpText).toMatch(/NOT grossed up/);
  });

  it('$80,000 salary + $7,000 franked + $3,000 credits (2026-27): $16,320, not $17,280', () => {
    // taxable: 80,000 + 7,000 + 3,000 = 90,000 (the credit grossed up once)
    // income tax: 26,800 × 15% + 45,000 × 30% = 4,020 + 13,500 = 17,520
    // Medicare 1,800; LITO nil; less franking 3,000
    // total: 17,520 + 1,800 − 3,000 = 16,320
    // old (10,000 "grossed up, include credits" as labelled, + 3,000 again): taxable 93,000
    //   → 4,020 + 48,000 × 30% = 18,420; + 1,860 − 3,000 = 17,280
    const r = calc({ income_year: '2026-27', salary_wages: 80000, franked_dividends: 7000, franking_credits: 3000 });
    expect(num(r, 'total_income')).toBe(90000);
    expect(num(r, 'total_tax')).toBe(16320);
  });
});

// ─── 20. The return's income year, not today's ─────────────────────────────

describe("20 — bands, LITO/Medicare thresholds and HELP follow the return's income year", () => {
  it('$100,000 for 2025-26 is taxed at 16% in the first bracket even after 1 July 2026', () => {
    // 2025-26: 26,800 × 16% + 55,000 × 30% = 4,288 + 16,500 = 20,788
    // 2026-27: 26,800 × 15% + 16,500 = 20,520 — the old form applied this to every return
    //          done after 1 July 2026: 26,800 × 1% = $268 too little
    expect(num(calc({ income_year: '2025-26', salary_wages: 100000 }), 'income_tax')).toBe(20788);
    expect(num(calc({ income_year: '2026-27', salary_wages: 100000 }), 'income_tax')).toBe(20520);
  });

  it('accepts a day inside the year', () => {
    expect(num(calc({ income_year: '2026-03-31', salary_wages: 100000 }), 'income_tax')).toBe(20788);
  });

  it('blank still means the current income year', () => {
    expect(num(calc({ salary_wages: 100000 }), 'income_tax')).toBe(calcAuTax(100000, currentFyStartYear()));
  });

  it('an unreadable year still calculates (current year) and is reported as an error', () => {
    const v = { income_year: 'last year', salary_wages: 100000 };
    expect(num(calc(v), 'income_tax')).toBe(calcAuTax(100000, currentFyStartYear()));
    expect(p.validateForm(v).find((x) => x.fieldId === 'income_year')?.severity).toBe('error');
  });

  it('a year before 2024-25 is reported as not modelled', () => {
    expect(p.validateForm({ income_year: '2023-24', salary_wages: 50000 }).find((x) => x.fieldId === 'income_year')?.severity).toBe('error');
  });

  it('HELP uses the return year’s thresholds', () => {
    // 2025-26: (90,000 − 67,000) × 15% = 3,450
    // 2026-27: (90,000 − 69,528) × 15% = 3,070.80 → 3,071
    expect(num(calc({ income_year: '2025-26', salary_wages: 90000, has_study_loan: true }), 'study_loan_repayment')).toBe(3450);
    expect(num(calc({ income_year: '2026-27', salary_wages: 90000, has_study_loan: true }), 'study_loan_repayment')).toBe(3071);
  });

  it('the schema carries an income_year select covering the schema year', () => {
    const f = p.getFormSchema({ incomeYear: '2025-26' }).flatMap((s) => s.fields).find((x) => x.id === 'income_year')!;
    expect(f.type).toBe('select');
    expect(f.selectOptions!.map((o) => o.value)).toEqual(expect.arrayContaining(['2024-25', '2025-26', '2026-27', '2027-28']));
  });
});

// ─── 21. Small business income tax offset ──────────────────────────────────

describe('21 — small business income tax offset (16%, max $1,000, turnover under $5m)', () => {
  it('sole trader, $60,000 net profit (2025-26): capped at $1,000', () => {
    // income tax: 4,288 + 15,000 × 30% = 8,788; share of tax on business income = 100%
    // SBITO: min(1,000, 8,788 × 16% = 1,406.08) = 1,000
    // LITO: 325 − 15,000 × 1.5c = 100; Medicare 1,200
    // total: 8,788 − 100 − 1,000 + 1,200 = 8,888   (old: no SBITO, LITO ≈ 216 on the 3.23c taper → 9,772)
    const r = calc({ income_year: '2025-26', business_income: 60000 });
    expect(num(r, 'small_business_offset')).toBe(1000);
    expect(num(r, 'total_tax')).toBe(8888);
  });

  it('$50,000 salary + $20,000 business (2025-26): proportional, $539', () => {
    // taxable 70,000; income tax 4,288 + 25,000 × 30% = 11,788
    // SBITO: 11,788 × (20,000 ÷ 70,000) × 16% = 3,368 × 16% = 538.88 → 539
    // LITO nil; Medicare 1,400
    // total: 11,788 − 539 + 1,400 = 12,649   (old: 11,788 + 1,400 = 13,188)
    const r = calc({ income_year: '2025-26', salary_wages: 50000, business_income: 20000 });
    expect(num(r, 'small_business_offset')).toBe(539);
    expect(num(r, 'total_tax')).toBe(12649);
  });

  it('unticking the turnover box removes it', () => {
    const r = calc({ income_year: '2025-26', salary_wages: 50000, business_income: 20000, small_business_turnover_under_5m: false });
    expect(num(r, 'small_business_offset')).toBe(0);
    expect(num(r, 'total_tax')).toBe(13188);
  });

  it('nothing for an employee, or for a business loss', () => {
    expect(num(calc({ income_year: '2025-26', salary_wages: 70000 }), 'small_business_offset')).toBe(0);
    expect(num(calc({ income_year: '2025-26', salary_wages: 70000, business_income: -5000 }), 'small_business_offset')).toBe(0);
  });

  it('the eligibility field exists and says what it requires', () => {
    const f = p.getFormSchema().flatMap((s) => s.fields).find((x) => x.id === 'small_business_turnover_under_5m')!;
    expect(f.type).toBe('boolean');
    expect(f.label).toMatch(/under \$5 million/);
  });
});

// ─── The override-aware invariant still holds ──────────────────────────────

describe('AU-IT keeps no editable calculated field (calculateFields never returns a pre-override figure)', () => {
  it('every calculated field is read-only', () => {
    const calculated = p.getFormSchema().flatMap((s) => s.fields).filter((f) => f.calculated);
    expect(calculated.filter((f) => f.editable).map((f) => f.id)).toEqual([]);
  });
});
