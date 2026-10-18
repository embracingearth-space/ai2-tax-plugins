/**
 * Filing and payment due dates, against dates the authorities publish. 2fin
 *
 * Every expected date below is either stated by the authority itself (quoted
 * page in the comment) or follows from the rule it states, with the weekday
 * worked by hand. A result's `adjustedYmd` applies the authority's weekend
 * rule only; public holidays are described, never computed.
 */
import {
  dueDateCoverage,
  dueDateRulesPastReview,
  incomeTaxDueDates,
  indiaQrmpReturnDay,
  indirectReturnDueDates,
} from '../src';

const pick = (rows: ReturnType<typeof indirectReturnDueDates>) =>
  (rows ?? []).map((r) => [r.title, r.ymd, r.adjustedYmd, r.action]);

describe('Australia — BAS (ato.gov.au "Due dates for lodging and paying your BAS")', () => {
  test('quarterly: 28th of the month after the quarter', () => {
    expect(pick(indirectReturnDueDates('AU', { start: '2026-07-01', end: '2026-09-30' }, 'quarterly'))).toEqual([
      ['BAS', '2026-10-28', '2026-10-28', 'lodge_and_pay'],
    ]);
  });

  test('October–December quarter: 28 February — 2027 is a Sunday, so Monday 1 March', () => {
    // The ATO BAS agent program lists Q2 2026–27 as 28 February 2027.
    const [q2] = indirectReturnDueDates('AU', { start: '2026-10-01', end: '2026-12-31' }, 'quarterly')!;
    expect([q2.ymd, q2.adjustedYmd]).toEqual(['2027-02-28', '2027-03-01']);
    expect(q2.notes.join(' ')).toMatch(/no online extension/);
    expect(q2.holidayNote).toMatch(/next business day/);
  });

  test('monthly: the 21st of the next month', () => {
    expect(pick(indirectReturnDueDates('AU', { start: '2026-09-01', end: '2026-09-30' }, 'monthly'))).toEqual([
      ['BAS', '2026-10-21', '2026-10-21', 'lodge_and_pay'],
    ]);
  });

  test('annual GST return: 31 October (a Saturday in 2026 → 2 November); 28 February with no tax return', () => {
    const year = { start: '2025-07-01', end: '2026-06-30' };
    expect(pick(indirectReturnDueDates('AU', year, 'annual'))).toEqual([
      ['Annual GST return', '2026-10-31', '2026-11-02', 'lodge_and_pay'],
    ]);
    expect(pick(indirectReturnDueDates('AU', year, 'annual', { filesIncomeTaxReturn: false }))[0][1]).toBe('2027-02-28');
  });

  test('income tax 2026–27: four PAYG instalments, the return 31 October, the bill 21 November', () => {
    const rows = incomeTaxDueDates('AU', { start: '2026-07-01', end: '2027-06-30' })!;
    expect(rows.map((r) => [r.title, r.ymd, r.adjustedYmd])).toEqual([
      ['PAYG instalment', '2026-10-28', '2026-10-28'],
      ['PAYG instalment', '2027-02-28', '2027-03-01'],
      ['PAYG instalment', '2027-04-28', '2027-04-28'],
      ['PAYG instalment', '2027-07-28', '2027-07-28'],
      ['Tax return', '2027-10-31', '2027-11-01'], // Sunday
      ['Tax bill', '2027-11-21', '2027-11-22'], // Sunday
    ]);
    expect(rows[0].appliesIf).toMatch(/PAYG instalments/);
    expect(rows[5].notes.join(' ')).toMatch(/21 days after/);
  });
});

describe('United Kingdom — VAT (gov.uk/submit-vat-return) and Self Assessment', () => {
  test('1 calendar month and 7 days after the period; a weekend does not move it', () => {
    // Quarter to 30 September 2026 → 7 November 2026, a Saturday: still the 7th.
    const [q] = indirectReturnDueDates('GB', { start: '2026-07-01', end: '2026-09-30' }, 'quarterly')!;
    expect([q.title, q.ymd, q.adjustedYmd, q.nonBusinessDay]).toEqual(['VAT Return', '2026-11-07', '2026-11-07', 'none']);
    expect(q.holidayNote).toMatch(/Faster Payment/);
    expect(indirectReturnDueDates('GB', { start: '2027-01-01', end: '2027-03-31' }, 'quarterly')![0].ymd).toBe('2027-05-07');
  });

  test('Annual Accounting Scheme: two months after the period', () => {
    expect(indirectReturnDueDates('GB', { start: '2026-04-01', end: '2027-03-31' }, 'annual')![0].ymd).toBe('2027-05-31');
  });

  test('2026–27: payments on account 31 January and 31 July 2027, balancing payment 31 January 2028', () => {
    const rows = incomeTaxDueDates('GB', { start: '2026-04-06', end: '2027-04-05' })!;
    expect(rows.map((r) => [r.title, r.ymd])).toEqual([
      ['First payment on account', '2027-01-31'],
      ['Second payment on account', '2027-07-31'],
      ['Online tax return and balancing payment', '2028-01-31'],
    ]);
  });
});

describe('Canada — GST/HST (canada.ca reporting requirements and deadlines) and instalments', () => {
  test('quarterly: one month after the period — 31 October 2026 is a Saturday, so 2 November', () => {
    const [q] = indirectReturnDueDates('CA', { start: '2026-07-01', end: '2026-09-30' }, 'quarterly')!;
    expect([q.ymd, q.adjustedYmd]).toEqual(['2026-10-31', '2026-11-02']);
    // A quarter ending 31 March → 30 April (the CRA's own example).
    expect(indirectReturnDueDates('CA', { start: '2027-01-01', end: '2027-03-31' }, 'quarterly')![0].ymd).toBe('2027-04-30');
  });

  test('annual, individual with business income: pay 30 April, file 15 June; otherwise three months', () => {
    const year = { start: '2026-01-01', end: '2026-12-31' };
    expect(pick(indirectReturnDueDates('CA', year, 'annual', { individualWithBusinessIncome: true }))).toEqual([
      ['GST/HST payment', '2027-04-30', '2027-04-30', 'pay'],
      ['GST/HST return', '2027-06-15', '2027-06-15', 'lodge'],
    ]);
    expect(indirectReturnDueDates('CA', year, 'annual')![0].ymd).toBe('2027-03-31');
  });

  test('2026 instalments 15 Mar (a Sunday → 16), Jun, Sep, Dec; balance 30 April 2027; return 15 June 2027', () => {
    const rows = incomeTaxDueDates('CA', { start: '2026-01-01', end: '2026-12-31' })!;
    expect(rows.map((r) => [r.title, r.ymd, r.adjustedYmd])).toEqual([
      ['Tax instalment', '2026-03-15', '2026-03-16'],
      ['Tax instalment', '2026-06-15', '2026-06-15'],
      ['Tax instalment', '2026-09-15', '2026-09-15'],
      ['Tax instalment', '2026-12-15', '2026-12-15'],
      ['Balance owing', '2027-04-30', '2027-04-30'],
      ['Tax return (self-employed)', '2027-06-15', '2027-06-15'],
    ]);
  });
});

describe('New Zealand — GST (ird.govt.nz "Filing GST")', () => {
  test('the 28th of the next month; 31 March → 7 May; 30 November → 15 January', () => {
    // IRD: the period ending 30 September 2025 was due 28 October 2025.
    expect(indirectReturnDueDates('NZ', { start: '2025-09-01', end: '2025-09-30' }, 'monthly')![0].ymd).toBe('2025-10-28');
    expect(indirectReturnDueDates('NZ', { start: '2026-03-01', end: '2026-03-31' }, 'monthly')![0].ymd).toBe('2026-05-07');
    expect(indirectReturnDueDates('NZ', { start: '2026-11-01', end: '2026-11-30' }, 'monthly')![0].ymd).toBe('2027-01-15');
  });
});

describe('India — GSTR-3B (tutorial.gst.gov.in) and advance tax (incometaxindia.gov.in)', () => {
  test('monthly: the 20th — the portal lists September 2026 as due 20 October 2026', () => {
    expect(pick(indirectReturnDueDates('IN', { start: '2026-09-01', end: '2026-09-30' }, 'monthly'))).toEqual([
      ['GSTR-3B', '2026-10-20', '2026-10-20', 'lodge_and_pay'],
    ]);
  });

  test('QRMP: PMT-06 on the 25th; the return on the 22nd or 24th by state (portal: 22 and 24 October 2026)', () => {
    const q = { start: '2026-07-01', end: '2026-09-30' };
    expect(pick(indirectReturnDueDates('IN', q, 'quarterly', { region: 'MH' }))).toEqual([
      ['PMT-06 payment', '2026-08-25', '2026-08-25', 'pay'],
      ['PMT-06 payment', '2026-09-25', '2026-09-25', 'pay'],
      ['GSTR-3B', '2026-10-22', '2026-10-22', 'lodge_and_pay'],
    ]);
    expect(indirectReturnDueDates('IN', q, 'quarterly', { region: 'Delhi' })![2].ymd).toBe('2026-10-24');
    expect(indirectReturnDueDates('IN', q, 'quarterly', { region: 'IN-UP' })![2].ymd).toBe('2026-10-24');
    // No state: the earlier date, marked approximate.
    const unknown = indirectReturnDueDates('IN', q, 'quarterly')![2];
    expect([unknown.ymd, unknown.approximate]).toEqual(['2026-10-22', true]);
  });

  test('state lookup: codes, IN- codes and names; a stranger is unknown', () => {
    expect(['MH', 'in-ka', 'Tamil Nadu', 'Telangana', 'Puducherry', 'Andaman & Nicobar Islands'].map(indiaQrmpReturnDay)).toEqual([22, 22, 22, 22, 22, 22]);
    expect(['DL', 'West Bengal', 'IN-RJ', 'Uttar Pradesh'].map(indiaQrmpReturnDay)).toEqual([24, 24, 24, 24]);
    expect([null, '', 'Atlantis', 'NSW'].map(indiaQrmpReturnDay)).toEqual([null, null, null, null]);
  });

  test('advance tax 2026–27: 15%, 45%, 75%, 100%; presumptive scheme: all by 15 March', () => {
    const fy = { start: '2026-04-01', end: '2027-03-31' };
    expect(incomeTaxDueDates('IN', fy)!.map((r) => [r.ymd, r.cumulativeShare])).toEqual([
      ['2026-06-15', 0.15],
      ['2026-09-15', 0.45],
      ['2026-12-15', 0.75],
      ['2027-03-15', 1],
    ]);
    expect(incomeTaxDueDates('IN', fy, { presumptive: true })!.map((r) => r.ymd)).toEqual(['2027-03-15']);
  });
});

describe('United States — estimated tax (IRS Publication 505, Form 1040-ES 2026)', () => {
  test('2026: 15 April, 15 June, 15 September, 15 January 2027; return 15 April 2027', () => {
    const rows = incomeTaxDueDates('US', { start: '2026-01-01', end: '2026-12-31' })!;
    expect(rows.map((r) => r.ymd)).toEqual(['2026-04-15', '2026-06-15', '2026-09-15', '2027-01-15', '2027-04-15']);
    expect(rows[0].notes.join(' ')).toMatch(/1 January to 31 March/);
  });

  test('no federal GST/VAT return: null, never a guess', () => {
    expect(indirectReturnDueDates('US', { start: '2026-07-01', end: '2026-09-30' }, 'quarterly')).toBeNull();
  });
});

describe('honest edges', () => {
  test('an uncovered country, and a period before the rules were checked, return null', () => {
    expect(indirectReturnDueDates('DE', { start: '2026-07-01', end: '2026-09-30' }, 'quarterly')).toBeNull();
    expect(incomeTaxDueDates('JP', { start: '2026-01-01', end: '2026-12-31' })).toBeNull();
    expect(indirectReturnDueDates('AU', { start: '2019-07-01', end: '2019-09-30' }, 'quarterly')).toBeNull();
  });

  test('every result cites its authority and when it was read', () => {
    const all = [
      ...indirectReturnDueDates('AU', { start: '2026-07-01', end: '2026-09-30' }, 'quarterly')!,
      ...incomeTaxDueDates('GB', { start: '2026-04-06', end: '2027-04-05' })!,
      ...incomeTaxDueDates('US', { start: '2026-01-01', end: '2026-12-31' })!,
    ];
    for (const r of all) {
      expect(r.sourceUrl).toMatch(/^https:\/\/(www\.)?(ato\.gov\.au|gov\.uk|irs\.gov)\//);
      expect(r.readOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.verified).toBe(true);
    }
  });

  test('coverage lists what is modelled', () => {
    const c = Object.fromEntries(dueDateCoverage().map((r) => [r.countryCode, [r.indirect, r.incomeTax]]));
    expect(c).toEqual({ AU: [true, true], GB: [true, true], CA: [true, true], NZ: [true, false], IN: [true, true], US: [false, true] });
  });

  test('the rate watch flags every rule once past its review date, and none today', () => {
    expect(dueDateRulesPastReview('2026-10-19')).toEqual([]);
    const later = dueDateRulesPastReview('2027-10-20');
    expect(later).toHaveLength(10);
    expect(later[0]).toMatchObject({ file: 'src/data/dueDates.ts', reviewBy: '2027-10-19' });
  });
});
