/**
 * UK Self Assessment (GB-SA) filing plugin — regression cases. @ai2/tax-plugins
 * ai2fin.com
 *
 * REGRESSION: the plugin charged compulsory Class 2 NI, deducted pension and
 * Gift Aid from income instead of extending the bands, taxed dividends and
 * savings at the main rates with no allowances, ignored the Scottish rates it
 * advertised, and widened the basic rate band when the personal allowance
 * tapered. Each case gives the old (wrong) figure and the hand calculation.
 *
 * Rules (GOV.UK, read 2026-10-11):
 * - Class 2/4: https://www.gov.uk/self-employed-national-insurance-rates
 * - Bands, dividend rates: https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past
 *   and https://www.gov.uk/tax-on-dividends
 * - Savings: https://www.gov.uk/apply-tax-free-interest-on-savings/how-much-is-tax-free
 * - Band extension: https://www.gov.uk/tax-on-your-private-pension/pension-tax-relief,
 *   https://www.gov.uk/donating-to-charity/gift-aid, HMRC PTM056120
 * - Scotland: https://www.gov.uk/scottish-income-tax
 *
 * Bands below are TAXABLE income (after the £12,570 personal allowance):
 * basic 20% to 37,700, higher 40% to 125,140, additional 45% above.
 */

import { ukSelfAssessmentPlugin } from '../src';

const p = ukSelfAssessmentPlugin;
const calc = (v: Record<string, unknown>) => p.calculateFields(v as never);
const tax = (v: Record<string, unknown>) => Number(calc(v).income_tax);
const Y26 = { tax_year: '2026-27' };
const Y25 = { tax_year: '2025-26' };

describe('GB-SA — Class 2 NI is no longer charged (finding 7)', () => {
  it('charges Class 4 only on £40k profit', () => {
    const r = calc({ ...Y26, turnover: 40000 });
    // Old: class2 = 3.45 × 52 = 179.40; total due 5,486 + 1,645.80 + 179.40 = 7,311.20.
    expect(Number(r.class2_nics)).toBe(0);
    // Class 4: (40,000 − 12,570) × 6% = 1,645.80.
    expect(Number(r.class4_nics)).toBe(1645.8);
    // Income tax 27,430 × 20% = 5,486; total 5,486 + 1,645.80 = 7,131.80.
    expect(Number(r.total_tax_due)).toBe(7131.8);
  });

  it('charges nothing between the small profits threshold and the lower profits limit', () => {
    const r = calc({ ...Y26, turnover: 10000 });
    expect(Number(r.class2_nics)).toBe(0);
    expect(Number(r.class4_nics)).toBe(0);
  });

  it('explains the treated-as-paid threshold and voluntary rate for the year', () => {
    const help = (incomeYear: string) => p.getFormSchema({ incomeYear })
      .flatMap((s) => s.fields).find((f) => f.id === 'class2_nics')!.helpText!;
    expect(help('2026-27')).toMatch(/£7,105.*£3\.65 a week/);
    expect(help('2025-26')).toMatch(/£6,845.*£3\.50 a week/);
  });
});

describe('GB-SA — pension and Gift Aid extend the bands (finding 8)', () => {
  it('does not deduct a basic-rate taxpayer\'s pension from income (audit case)', () => {
    const r = calc({ ...Y26, turnover: 40000, pension_contributions: 5000 });
    // Old: taxable 35,000 → (35,000 − 12,570) × 20% = 4,486.
    // Correct: 20% relief is given at source. Taxable 27,430, basic limit
    // 37,700 + 5,000 = 42,700, all at 20% = 5,486.
    expect(Number(r.income_tax)).toBe(5486);
    expect(Number(r.taxable_income)).toBe(40000);
    expect(Number(r.adjusted_net_income)).toBe(35000);
  });

  it('gives higher-rate relief only on income taxed at 40% (GOV.UK example shape)', () => {
    // £60,270 income, £12,000 gross into relief at source: GOV.UK says extra 20%
    // relief on £10,000 (the income taxed at 40%) = £2,000.
    // Without: 37,700 × 20% + 10,000 × 40% = 11,540.
    // With: taxable 47,700, basic limit 49,700 → 47,700 × 20% = 9,540.
    // Old: taxable 48,270 → 35,700 × 20% = 7,140.
    const without = tax({ ...Y26, turnover: 60270 });
    const withPension = tax({ ...Y26, turnover: 60270, pension_contributions: 12000 });
    expect(without).toBe(11540);
    expect(withPension).toBe(9540);
    expect(without - withPension).toBe(2000);
  });

  it('reduces adjusted net income for the personal allowance taper', () => {
    // £110,000 profit, £10,000 gross pension. ANI 100,000 → full £12,570 allowance.
    // Taxable 97,430; basic limit 47,700: 47,700 × 20% = 9,540; 49,730 × 40% = 19,892 → 29,432.
    // Old: taxable 100,000, allowance 12,570, bands not extended: 7,540 + 49,730 × 40% → 27,432.
    const r = calc({ ...Y26, turnover: 110000, pension_contributions: 10000 });
    expect(Number(r.adjusted_net_income)).toBe(100000);
    expect(Number(r.personal_allowance)).toBe(12570);
    expect(Number(r.income_tax)).toBe(29432);
    // Without the pension: ANI 110,000, allowance 7,570, taxable 102,430:
    // 7,540 + 64,730 × 40% = 33,432.
    const none = calc({ ...Y26, turnover: 110000 });
    expect(Number(none.personal_allowance)).toBe(7570);
    expect(Number(none.income_tax)).toBe(33432);
  });

  it('grosses up Gift Aid: a 40% taxpayer giving £100 saves £25 (GOV.UK example)', () => {
    // £70,000 profit. Without: 7,540 + 19,730 × 40% = 15,432.
    // £100 given → £125 gross; basic limit 37,825: 7,565 + 19,605 × 40% = 15,407.
    // Old: taxable 69,900 → 7,540 + 19,630 × 40% = 15,392 (a £40 saving).
    expect(tax({ ...Y26, turnover: 70000 })).toBe(15432);
    expect(tax({ ...Y26, turnover: 70000, gift_aid: 100 })).toBe(15407);
  });
});

describe('GB-SA — savings and dividends taxed on top, with allowances (finding 9)', () => {
  it('£40k profit + £10k dividends (audit case)', () => {
    // Old: 50,000 at main rates → 37,430 × 20% = 7,486.
    // Non-savings 27,430 × 20% = 5,486. Dividends from 27,430: £500 allowance
    // (to 27,930), then 9,500 inside the basic band (limit 37,700).
    // 2026-27: 9,500 × 10.75% = 1,021.25 → 6,507.25.
    expect(tax({ ...Y26, turnover: 40000, dividends: 10000 })).toBe(6507.25);
    // 2025-26: 9,500 × 8.75% = 831.25 → 6,317.25.
    expect(tax({ ...Y25, turnover: 40000, dividends: 10000 })).toBe(6317.25);
  });

  it('taxes dividends above the basic band at the upper rate', () => {
    // £60k profit: 7,540 + 9,730 × 40% = 11,432; dividends start at 47,430 (higher band):
    // 9,500 × 35.75% = 3,396.25 → 14,828.25. Old: 7,540 + 19,730 × 40% = 15,432.
    expect(tax({ ...Y26, turnover: 60000, dividends: 10000 })).toBe(14828.25);
  });

  it('applies the £1,000 personal savings allowance for a basic-rate taxpayer', () => {
    // 5,486 + (3,000 − 1,000) × 20% = 5,886. Old: 30,430 × 20% = 6,086.
    expect(tax({ ...Y26, turnover: 40000, savings_interest: 3000 })).toBe(5886);
  });

  it('applies the starting rate for savings, reduced by other income above the allowance', () => {
    // £14,000 profit: non-savings taxable 1,430 → 286. Starting rate 5,000 − 1,430 = 3,570
    // at 0%, PSA 1,000 at 0%, remaining 1,430 × 20% = 286 → 572.
    // Old: 20,000 − 12,570 = 7,430 × 20% = 1,486.
    expect(tax({ ...Y26, turnover: 14000, savings_interest: 6000 })).toBe(572);
  });

  it('sets unused personal allowance against savings', () => {
    // £10,000 profit uses 10,000 of the allowance; 2,570 left against savings → 7,430 taxable.
    // Starting rate 5,000 + PSA 1,000 at 0%, 1,430 × 20% = 286. Old: 1,486.
    expect(tax({ ...Y26, turnover: 10000, savings_interest: 10000 })).toBe(286);
  });

  it('halves the PSA for a higher-rate taxpayer', () => {
    // 11,432 + (2,000 − 500) × 40% = 12,032. Old: 7,540 + 11,730 × 40% = 12,232.
    expect(tax({ ...Y26, turnover: 60000, savings_interest: 2000 })).toBe(12032);
  });

  it('gives an additional-rate taxpayer no PSA', () => {
    // £150k: allowance 0. 37,700 × 20% + 87,440 × 40% + 24,860 × 45% = 53,703;
    // savings 2,000 × 45% = 900 → 54,603.
    // Old: 52,089 (also the band bug below).
    expect(tax({ ...Y26, turnover: 150000, savings_interest: 2000 })).toBe(54603);
  });
});

describe('GB-SA — the basic band does not widen when the allowance tapers', () => {
  it('£150k profit', () => {
    // Correct: 7,540 + 34,976 + 11,187 = 53,703.
    // Old: basic band 50,270 − 0 = 50,270 × 20% = 10,054; 74,870 × 40% = 29,948;
    // 24,860 × 45% = 11,187 → 51,189.
    expect(tax({ ...Y26, turnover: 150000 })).toBe(53703);
  });
});

describe('GB-SA — Scottish taxpayers (finding 10)', () => {
  const SCT = { taxpayer_region: 'SCT' };

  it('£40k profit, 2026-27', () => {
    // Old: rUK 5,486. Taxable 27,430: 3,967 × 19% = 753.73;
    // 12,989 × 20% = 2,597.80; 10,474 × 21% = 2,199.54 → 5,551.07.
    const r = calc({ ...Y26, ...SCT, turnover: 40000 });
    expect(Number(r.income_tax)).toBe(5551.07);
    // NI is UK-wide.
    expect(Number(r.class4_nics)).toBe(1645.8);
  });

  it('£40k profit, 2025-26 bands', () => {
    // 2,827 × 19% = 537.13; 12,094 × 20% = 2,418.80; 12,509 × 21% = 2,626.89 → 5,582.82.
    expect(tax({ ...Y25, ...SCT, turnover: 40000 })).toBe(5582.82);
  });

  it('£80k profit reaches the advanced rate', () => {
    // 753.73 + 2,597.80 + 14,136 × 21% (2,968.56) + 31,338 × 42% (13,161.96)
    // + 5,000 × 45% (2,250) = 21,732.05. Old: 7,540 + 29,730 × 40% = 19,432.
    expect(tax({ ...Y26, ...SCT, turnover: 80000 })).toBe(21732.05);
  });

  it('taxes dividends at UK rates and bands', () => {
    // 5,551.07 + 9,500 × 10.75% = 6,572.32.
    expect(tax({ ...Y26, ...SCT, turnover: 40000, dividends: 10000 })).toBe(6572.32);
  });

  it('sets the PSA by UK bands, not the Scottish higher rate', () => {
    // £45k: taxable 32,430 is in the Scottish 42% band but under the UK 37,700 limit,
    // so the £1,000 PSA covers the savings. 753.73 + 2,597.80 + 2,968.56 + 1,338 × 42% = 6,882.05.
    expect(tax({ ...Y26, ...SCT, turnover: 45000, savings_interest: 1000 })).toBe(6882.05);
  });

  it('extends the Scottish basic and higher limits, not the starter limit', () => {
    // £50k, £5k gross pension. Without: 753.73 + 2,597.80 + 2,968.56 + 6,338 × 42% = 8,982.05.
    // With: basic to 21,956, intermediate to 36,092: 753.73 + 17,989 × 20% (3,597.80)
    // + 14,136 × 21% (2,968.56) + 1,338 × 42% (561.96) = 7,882.05 (5,000 × 22% less).
    expect(tax({ ...Y26, ...SCT, turnover: 50000 })).toBe(8982.05);
    expect(tax({ ...Y26, ...SCT, turnover: 50000, pension_contributions: 5000 })).toBe(7882.05);
  });

  it('accepts the GB- prefix and ignores the other regions', () => {
    expect(tax({ ...Y26, taxpayer_region: 'GB-SCT', turnover: 40000 })).toBe(5551.07);
    for (const region of ['ENG', 'WAL', 'NIR', '']) {
      expect(tax({ ...Y26, taxpayer_region: region, turnover: 40000 })).toBe(5486);
    }
  });
});

describe('GB-SA — tax year selection', () => {
  afterEach(() => jest.useRealTimers());

  it('uses the current UK tax year when tax_year is blank', () => {
    jest.useFakeTimers({ now: new Date('2026-10-11T12:00:00Z') });
    expect(tax({ turnover: 40000, dividends: 10000 })).toBe(6507.25);
    jest.setSystemTime(new Date('2026-04-05T12:00:00Z'));
    expect(tax({ turnover: 40000, dividends: 10000 })).toBe(6317.25);
  });

  it('warns when the year is not modelled and uses the nearest modelled year', () => {
    const v = { tax_year: '2027/28', turnover: 40000, dividends: 10000 };
    expect(tax(v)).toBe(6507.25);
    expect(p.validateForm(v).some((r) => r.fieldId === 'tax_year' && r.severity === 'warning')).toBe(true);
    expect(p.validateForm({ ...Y26, turnover: 40000 })).toEqual([]);
  });

  it('keeps the old field ids and adds the new ones', () => {
    const ids = p.getFormSchema().flatMap((s) => s.fields).map((f) => f.id);
    for (const id of ['class2_nics', 'pension_contributions', 'gift_aid', 'tax_year', 'taxpayer_region', 'adjusted_net_income', 'personal_allowance']) {
      expect(ids).toContain(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});
