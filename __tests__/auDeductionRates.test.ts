/**
 * AU deduction rates — @ai2/tax-plugins
 * ai2fin.com
 *
 * The working from home fixed rate and the cents per kilometre rate, effective-
 * dated by income year. Every figure asserted here was read on 27 September
 * 2026 from the ATO's "Fixed rate method" page (last updated 8 June 2026) and
 * from the Commissioner's cents-per-km determinations on the Federal Register
 * of Legislation. If one of these fails, the plugin disagrees with the source —
 * re-read the source before touching the test.
 *
 * The rule under test above all others: a year with no published rate returns
 * `rate: null, verified: false` and NAMES the last published rate without
 * applying it.
 */

import * as pkg from '../src';
import {
  AU_CENTS_PER_KM_MAX_BUSINESS_KM,
  AU_CENTS_PER_KM_ROWS,
  AU_WFH_FIXED_RATE_ROWS,
  auIncomeYear,
  centsPerKmRate,
  formatAuCents,
  workFromHomeFixedRate,
  australiaIncomeTaxPlugin,
  auCarExpensesHelpText,
  auWorkFromHomeHelpText,
} from '../src';

// ─── Income years ───────────────────────────────────────────────────────────

describe('auIncomeYear', () => {
  it('reads a label in either dash', () => {
    expect(auIncomeYear('2025-26')).toEqual({ label: '2025-26', startYear: 2025, startYmd: '2025-07-01' });
    expect(auIncomeYear('2025–26').label).toBe('2025-26');
    expect(auIncomeYear('1999-00').label).toBe('1999-00');
  });

  it('puts 30 June and 1 July in different years', () => {
    expect(auIncomeYear('2026-06-30').label).toBe('2025-26');
    expect(auIncomeYear('2026-07-01').label).toBe('2026-27');
  });

  it('reads a Date by its LOCAL calendar day', () => {
    // new Date(2026, 6, 1) is 1 July on the caller's calendar in every zone.
    expect(auIncomeYear(new Date(2026, 6, 1)).label).toBe('2026-27');
    expect(auIncomeYear(new Date(2026, 5, 30)).label).toBe('2025-26');
  });

  it('throws on anything it would otherwise have to guess', () => {
    expect(() => auIncomeYear('2025-27')).toThrow(RangeError);
    expect(() => auIncomeYear('2025')).toThrow(RangeError);
    expect(() => auIncomeYear('2025-13-01')).toThrow(RangeError);
    expect(() => auIncomeYear('next year')).toThrow(RangeError);
    expect(() => auIncomeYear(new Date('not a date'))).toThrow(RangeError);
  });
});

// ─── Working from home fixed rate ───────────────────────────────────────────

describe('workFromHomeFixedRate — every row boundary', () => {
  // [last day of the earlier window, first day of the later one, earlier rate, later rate]
  const boundaries: Array<[string, string, number | null, number | null]> = [
    ['2020-06-30', '2020-07-01', null, 0.52],
    ['2022-06-30', '2022-07-01', 0.52, 0.67],
    ['2024-06-30', '2024-07-01', 0.67, 0.7],
    ['2026-06-30', '2026-07-01', 0.7, null],
  ];

  it.each(boundaries)('%s → %s', (before, after, rateBefore, rateAfter) => {
    expect(workFromHomeFixedRate(before).rate).toBe(rateBefore);
    expect(workFromHomeFixedRate(after).rate).toBe(rateAfter);
  });

  it('matches the ATO page year by year', () => {
    const byYear = Object.fromEntries(
      ['2020-21', '2021-22', '2022-23', '2023-24', '2024-25', '2025-26'].map((y) => [y, workFromHomeFixedRate(y).rate]),
    );
    expect(byYear).toEqual({
      '2020-21': 0.52,
      '2021-22': 0.52,
      '2022-23': 0.67,
      '2023-24': 0.67,
      '2024-25': 0.7,
      '2025-26': 0.7,
    });
  });

  it('returns the full shape, with the citation, for a published year', () => {
    expect(workFromHomeFixedRate('2025-26')).toEqual({
      rate: 0.7,
      verified: true,
      incomeYear: '2025-26',
      sourceUrl: expect.stringMatching(/working-from-home-expenses\/fixed-rate-method$/),
      readOn: '2026-09-27',
      note: expect.stringMatching(/^70 cents per work hour for 2024-25 and 2025-26\./),
    });
  });

  it('2026-27 is unpublished: no rate, unverified, and the last published rate named — not used', () => {
    const r = workFromHomeFixedRate('2026-27');
    expect(r.rate).toBeNull();
    expect(r.verified).toBe(false);
    expect(r.incomeYear).toBe('2026-27');
    expect(r.lastPublished).toEqual({ rate: 0.7, incomeYear: '2025-26' });
    expect(r.note).toMatch(/has not published/);
    expect(r.note).toMatch(/70 cents per work hour, for 2025-26/);
    expect(r.note).toMatch(/does not carry over/);
  });

  it('a later unpublished year says the same thing about its own year, not about 2026-27', () => {
    const r = workFromHomeFixedRate('2028-29');
    expect(r.rate).toBeNull();
    expect(r.note).toMatch(/confirm the 2028-29 rate/);
    expect(r.note).not.toMatch(/for 2026-27/);
  });

  it('a day resolves to its income year', () => {
    expect(workFromHomeFixedRate('2026-03-31')).toMatchObject({ rate: 0.7, incomeYear: '2025-26' });
    expect(workFromHomeFixedRate(new Date(2026, 8, 27))).toMatchObject({ rate: null, incomeYear: '2026-27' });
  });

  it('before 2020-21 is "not recorded", with no last-published rate to borrow', () => {
    const r = workFromHomeFixedRate('2019-20');
    expect(r).toMatchObject({ rate: null, verified: false, sourceUrl: null, readOn: null });
    expect(r.lastPublished).toBeUndefined();
    expect(r.note).toMatch(/not recorded here/);
  });
});

// ─── Cents per kilometre ────────────────────────────────────────────────────

describe('centsPerKmRate — every row boundary', () => {
  const boundaries: Array<[string, string, number | null, number | null]> = [
    ['2018-06-30', '2018-07-01', null, 0.68],
    ['2020-06-30', '2020-07-01', 0.68, 0.72],
    ['2022-06-30', '2022-07-01', 0.72, 0.78],
    ['2023-06-30', '2023-07-01', 0.78, 0.85],
    ['2024-06-30', '2024-07-01', 0.85, 0.88],
    ['2026-06-30', '2026-07-01', 0.88, 0.91],
    ['2027-06-30', '2027-07-01', 0.91, null],
  ];

  it.each(boundaries)('%s → %s', (before, after, rateBefore, rateAfter) => {
    expect(centsPerKmRate(before).rate).toBe(rateBefore);
    expect(centsPerKmRate(after).rate).toBe(rateAfter);
  });

  it('2025-26 is 88 cents, under the 2024 determination, verified', () => {
    // The 2024 determination sets 88 cents "for income years commencing on or
    // after 1 July 2024" and was repealed from 1 July 2026 — so it covers 2025-26.
    expect(centsPerKmRate('2025-26')).toMatchObject({
      rate: 0.88,
      verified: true,
      sourceUrl: 'https://www.legislation.gov.au/F2024L00697/asmade',
    });
  });

  it('2026-27 is 91 cents, verified, and says the 2 cent uplift is one-off', () => {
    const r = centsPerKmRate('2026-27');
    expect(r).toMatchObject({ rate: 0.91, verified: true, incomeYear: '2026-27', readOn: '2026-09-27' });
    expect(r.sourceUrl).toBe('https://softwaredevelopers.ato.gov.au/CentsperKilometreDeductionRateforCarExpenses');
    expect(r.note).toMatch(/89 cents/);
    expect(r.note).toMatch(/one-off/);
  });

  it('91 cents does NOT run on into 2027-28: the 2026 determination is for one year only', () => {
    const r = centsPerKmRate('2027-28');
    expect(r.rate).toBeNull();
    expect(r.verified).toBe(false);
    expect(r.lastPublished).toEqual({ rate: 0.91, incomeYear: '2026-27' });
    expect(r.note).toMatch(/89 cent base/);
  });

  it('caps business kilometres at 5,000 per car', () => {
    expect(AU_CENTS_PER_KM_MAX_BUSINESS_KM).toBe(5000);
  });

  it('every verified row cites a source and a read date; every row with a rate is verified', () => {
    for (const row of [...AU_CENTS_PER_KM_ROWS, ...AU_WFH_FIXED_RATE_ROWS]) {
      if (row.rate !== null) expect(row.verified).toBe(true);
      if (row.verified) {
        expect(row.sourceUrl).toMatch(/^https:\/\//);
        expect(row.readOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      expect(row.effectiveFrom.slice(4)).toBe('-07-01');
    }
  });
});

describe('the row literals', () => {
  it('are written newest-first for readability (the lookups sort anyway)', () => {
    for (const rows of [AU_WFH_FIXED_RATE_ROWS, AU_CENTS_PER_KM_ROWS]) {
      const dates = rows.map((r) => r.effectiveFrom);
      expect([...dates].sort().reverse()).toEqual(dates);
    }
  });
});

describe('formatAuCents', () => {
  it('prints integer cents, never a float artefact', () => {
    expect(formatAuCents(0.67, 'per work hour')).toBe('67 cents per work hour');
    expect(formatAuCents(0.29 + 0.62, 'per kilometre')).toBe('91 cents per kilometre');
  });
});

// ─── Package index ──────────────────────────────────────────────────────────

describe('the package index exports the lookups', () => {
  it('exposes workFromHomeFixedRate and centsPerKmRate as the same functions', () => {
    expect(typeof pkg.workFromHomeFixedRate).toBe('function');
    expect(typeof pkg.centsPerKmRate).toBe('function');
    expect(pkg.workFromHomeFixedRate('2024-25').rate).toBe(0.7);
    expect(pkg.centsPerKmRate('2024-25').rate).toBe(0.88);
  });

  it('exposes the rows, the cap and the help-text builders', () => {
    expect(pkg.AU_WFH_FIXED_RATE_ROWS).toBe(AU_WFH_FIXED_RATE_ROWS);
    expect(pkg.AU_CENTS_PER_KM_ROWS).toBe(AU_CENTS_PER_KM_ROWS);
    expect(pkg.AU_CENTS_PER_KM_MAX_BUSINESS_KM).toBe(5000);
    expect(typeof pkg.auWorkFromHomeHelpText).toBe('function');
    expect(typeof pkg.auCarExpensesHelpText).toBe('function');
    expect(pkg.AU_DEDUCTION_RATE_AUTHORITY_URLS.workFromHomeFixedRate).toMatch(/fixed-rate-method$/);
  });
});

// ─── AU-IT help text ────────────────────────────────────────────────────────

const helpFor = (incomeYear?: string | Date) => {
  const fields = australiaIncomeTaxPlugin.getFormSchema(incomeYear === undefined ? undefined : { incomeYear }).flatMap((s) => s.fields);
  const byId = Object.fromEntries(fields.map((f) => [f.id, f.helpText]));
  return { car: byId.work_related_car as string, wfh: byId.work_from_home as string };
};

describe('AU-IT help text is built from the rows for the return\'s income year', () => {
  it('2025-26: 70c and 88c, from the rows', () => {
    const h = helpFor('2025-26');
    expect(h.wfh).toMatch(/^Fixed rate: 70c per work hour for 2025-26 /);
    expect(h.wfh).toMatch(/Or actual cost method\.$/);
    expect(h.car).toBe('Cents per km (88c/km 2025-26, max 5,000 business km per car) or logbook');
  });

  it('2023-24: 67c and 85c', () => {
    const h = helpFor('2023-24');
    expect(h.wfh).toMatch(/^Fixed rate: 67c per work hour for 2023-24 /);
    expect(h.car).toMatch(/^Cents per km \(85c\/km 2023-24,/);
  });

  it('2020-21: the 52c rate is labelled as the earlier method, not given the current coverage list', () => {
    const h = helpFor('2020-21');
    expect(h.wfh).toMatch(/52c per work hour for 2020-21 \(the earlier fixed rate method/);
    expect(h.wfh).not.toMatch(/internet/);
  });

  it('2026-27: 91c/km, and NO fixed rate — the last one named, not applied', () => {
    const h = helpFor('2026-27');
    expect(h.car).toBe('Cents per km (91c/km 2026-27, max 5,000 business km per car) or logbook');
    expect(h.wfh).toBe(
      'Fixed rate: no rate is published for 2026-27 yet (last published: 70c per work hour, for 2025-26 — it does not carry over). Or actual cost method.',
    );
    expect(h.wfh).not.toMatch(/^Fixed rate: 70c/);
  });

  it('2027-28: neither rate is published, and 91c is not carried forward', () => {
    const h = helpFor('2027-28');
    expect(h.car).toMatch(/^Cents per km: no rate is published for 2027-28 yet \(last published: 91c per km, for 2026-27/);
    expect(h.car).toMatch(/Max 5,000 business km per car\. Or logbook\.$/);
  });

  it('a year before the recorded rows says "not recorded", not "yet"', () => {
    const h = helpFor('2017-18');
    expect(h.car).toMatch(/the rate for 2017-18 is not recorded here/);
    expect(h.wfh).toMatch(/the rate for 2017-18 is not recorded here/);
    expect(h.wfh).not.toMatch(/yet/);
  });

  it('accepts a day inside the year, and a Date', () => {
    expect(helpFor('2026-06-30')).toEqual(helpFor('2025-26'));
    expect(helpFor(new Date(2026, 6, 1))).toEqual(helpFor('2026-27'));
  });

  it('with no income year it uses today\'s — and no longer quotes the stale 67c or 88c', () => {
    const today = helpFor();
    expect(today).toEqual(helpFor(new Date()));
    expect(today.wfh).not.toMatch(/67c\/hour/);
    expect(today.car).not.toMatch(/88c\/km 2025-26, max 5,000 km\)/);
  });

  it('the exported builders produce the same text the schema carries', () => {
    expect(auWorkFromHomeHelpText('2024-25')).toBe(helpFor('2024-25').wfh);
    expect(auCarExpensesHelpText('2024-25')).toBe(helpFor('2024-25').car);
  });
});

// ─── Capital gains help text: the 50% discount has an end date ─────────────

describe('AU-IT capital gains help text follows the Tax Reform No. 1 Act', () => {
  const cgFor = (incomeYear: string) =>
    australiaIncomeTaxPlugin.getFormSchema({ incomeYear }).flatMap((s) => s.fields).find((f) => f.id === 'capital_gains')!.helpText as string;

  it('up to 2026-27: the 50% discount, at least 12 months, the ATO\'s own counting rule', () => {
    const h = cgFor('2026-27');
    expect(h).toMatch(/50% CGT discount/);
    expect(h).toMatch(/at least 12 months/);
    expect(h).toMatch(/not counting the day/);
    expect(h).not.toMatch(/>12 months/);
  });

  it('from 2027-28: the discount generally only to 30 June 2027, indexation after, a conditional 30% minimum — law, not announced', () => {
    const h = cgFor('2027-28');
    expect(h).toMatch(/generally applies only to the gain up to 30 June 2027/);
    expect(h).toMatch(/indexed for inflation/);
    // s 115-102 / s 115-125: new residential dwellings and affordable housing keep at least 50%.
    expect(h).toMatch(/new residential dwelling or affordable housing can still get a discount of at least 50%/);
    // s 119-5(2), s 119-15: the minimum is conditional, never stated as applying to everyone.
    expect(h).toMatch(/30% minimum tax may apply/);
    expect(h).toMatch(/age pension/);
    expect(h).not.toMatch(/minimum tax applies/);
    expect(h).toMatch(/Tax Reform No\. 1\) Act 2026/);
    expect(h).not.toMatch(/announced/i);
  });

  it('switches on 1 July 2027 exactly', () => {
    expect(pkg.auCapitalGainsHelpText('2027-06-30')).toBe(cgFor('2026-27'));
    expect(pkg.auCapitalGainsHelpText('2027-07-01')).toBe(cgFor('2027-28'));
    expect(pkg.AU_CGT_INDEXATION_FROM).toBe('2027-07-01');
    expect(pkg.AU_CGT_AUTHORITY_URLS.taxReformAct).toBe('https://www.legislation.gov.au/C2026A00049/latest');
  });
});
