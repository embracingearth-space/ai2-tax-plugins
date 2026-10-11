/**
 * Organisations (clubs, PTAs, charities) — @ai2/tax-plugins
 * ai2fin.com
 *
 * Statuses, reliefs and figures are asserted as the authorities' pages state
 * them (read 11 October 2026, UTC): GOV.UK (HMRC, Charity Commission), OSCR,
 * CCNI, the ATO and the ACNC. The Charity Commission thresholds are asserted
 * on both sides of 30 September 2026, the day the new ones start. 2fin
 */

import * as pkg from '../src';
import {
  formatGiftAidDate,
  giftAidClaimValue,
  giftAidScheduleColumns,
  orgReportingThresholds,
  orgRulesFor,
  orgRulesInventory,
  orgTypesFor,
  ORG_FIGURES,
  ORG_REPORTS,
  ORG_RULE_SOURCES,
  type OrgRules,
} from '../src';

const rules = (country: string, code: string, yearEnd?: string): OrgRules => {
  const r = orgRulesFor(country, code, yearEnd);
  if (!r) throw new Error(`no rules for ${country} ${code}`);
  return r;
};
const figure = (country: string, id: string, yearEnd?: string) => {
  const f = orgReportingThresholds(country, yearEnd).find((x) => x.id === id);
  if (!f) throw new Error(`no figure ${id}`);
  return f;
};

const GB_CODES = ['GB_CLUB', 'GB_PTA', 'GB_CASC', 'GB_CHARITY', 'GB_CIO', 'GB_CHARITABLE_COMPANY'];
const AU_CODES = ['AU_INCORPORATED_ASSOCIATION', 'AU_ACNC_CHARITY', 'AU_CLUB'];
const ALL: Array<[string, string]> = [
  ...GB_CODES.map((c): [string, string] => ['GB', c]),
  ...AU_CODES.map((c): [string, string] => ['AU', c]),
  ['FR', 'CLUB'],
  ['FR', 'CHARITY'],
];

describe('orgTypesFor', () => {
  it('GB: the six types, in order, with labels, kinds and registers', () => {
    expect(orgTypesFor('GB').map((t) => [t.code, t.label, t.kind, t.registeredWith])).toEqual([
      ['GB_CLUB', 'Club or society', 'club', 'Not registered'],
      ['GB_PTA', "PTA or parents' association", 'pta', 'Not registered'],
      ['GB_CASC', 'Community amateur sports club', 'club', 'HMRC'],
      ['GB_CHARITY', 'Registered charity', 'charity', 'Charity Commission, OSCR or CCNI'],
      ['GB_CIO', 'Charitable incorporated organisation', 'charity', 'Charity Commission'],
      ['GB_CHARITABLE_COMPANY', 'Charitable company', 'charity', 'Companies House and the Charity Commission'],
    ]);
  });

  it('AU: incorporated association, ACNC charity, club', () => {
    expect(orgTypesFor('AU').map((t) => [t.code, t.label, t.kind, t.registeredWith])).toEqual([
      ['AU_INCORPORATED_ASSOCIATION', 'Incorporated association', 'association', 'The state or territory regulator it is incorporated with'],
      ['AU_ACNC_CHARITY', 'Registered charity (ACNC)', 'charity', 'ACNC'],
      ['AU_CLUB', 'Club or community group', 'community', 'Not registered'],
    ]);
  });

  it('any other country: the generic CLUB and CHARITY, in that country', () => {
    expect(orgTypesFor('fr')).toEqual([
      { code: 'CLUB', label: 'Club or community group', country: 'FR', kind: 'community', registeredWith: 'Check locally', group: 'organisation' },
      { code: 'CHARITY', label: 'Charity or nonprofit', country: 'FR', kind: 'charity', registeredWith: 'Check locally', group: 'organisation' },
    ]);
  });

  it("UK is GB; every type is group 'organisation' in its country; not a country code → []; results are copies", () => {
    expect(orgTypesFor(' uk ')).toEqual(orgTypesFor('GB'));
    for (const c of ['GB', 'AU', 'NZ']) {
      for (const ty of orgTypesFor(c)) expect({ code: ty.code, group: ty.group, country: ty.country }).toEqual({ code: ty.code, group: 'organisation', country: c });
    }
    expect(orgTypesFor('')).toEqual([]);
    expect(orgTypesFor('GBR')).toEqual([]);
    const a = orgTypesFor('GB');
    a[0].label = 'changed';
    expect(orgTypesFor('GB')[0].label).toBe('Club or society');
  });

  it('every type has rules', () => {
    for (const c of ['GB', 'AU', 'US']) for (const ty of orgTypesFor(c)) expect(orgRulesFor(c, ty.code)).not.toBeNull();
  });
});

describe('orgRulesFor — income tax, relief, reports', () => {
  it('statuses per type', () => {
    const status = (c: string, code: string) => rules(c, code).incomeTax.status;
    expect(status('GB', 'GB_CLUB')).toBe('mutuality');
    expect(status('GB', 'GB_PTA')).toBe('mutuality');
    expect(status('GB', 'GB_CASC')).toBe('exempt_if_conditions');
    for (const code of ['GB_CHARITY', 'GB_CIO', 'GB_CHARITABLE_COMPANY']) expect(status('GB', code)).toBe('exempt_if_conditions');
    expect(status('AU', 'AU_ACNC_CHARITY')).toBe('exempt_if_conditions');
    expect(status('AU', 'AU_INCORPORATED_ASSOCIATION')).toBe('check_locally');
    expect(status('AU', 'AU_CLUB')).toBe('check_locally');
    expect(status('FR', 'CLUB')).toBe('check_locally');
    expect(status('FR', 'CHARITY')).toBe('check_locally');
  });

  it('reports per type: receipts_payments everywhere; Gift Aid for GB charities and CASCs; VAT in GB; GST/BAS in AU', () => {
    const reports = (c: string, code: string) => rules(c, code).reports;
    expect(reports('GB', 'GB_CLUB')).toEqual(['receipts_payments', 'vat']);
    expect(reports('GB', 'GB_PTA')).toEqual(['receipts_payments', 'vat']);
    for (const code of ['GB_CASC', 'GB_CHARITY', 'GB_CIO', 'GB_CHARITABLE_COMPANY']) {
      expect(reports('GB', code)).toEqual(['receipts_payments', 'gift_aid_schedule', 'vat']);
    }
    for (const code of AU_CODES) expect(reports('AU', code)).toEqual(['receipts_payments', 'gst_bas']);
    expect(reports('FR', 'CLUB')).toEqual(['receipts_payments']);
    expect(reports('FR', 'CHARITY')).toEqual(['receipts_payments']);
  });

  it.each(ALL)('%s %s: reports come from the vocabulary; a forecast only where the whole surplus is taxable', (c, code) => {
    const r = rules(c, code);
    for (const rep of r.reports) expect(ORG_REPORTS).toContain(rep);
    expect(r.reports[0]).toBe('receipts_payments');
    expect(r.incomeTaxForecast).toBe(r.incomeTax.status === 'taxable');
    expect(r.incomeTax.note.length).toBeGreaterThan(40);
    expect(r.accounts.note.length).toBeGreaterThan(10);
  });

  it('Gift Aid for GB charities and CASCs: 25p per £1, declaration, 4 years', () => {
    for (const code of ['GB_CASC', 'GB_CHARITY', 'GB_CIO', 'GB_CHARITABLE_COMPANY']) {
      expect(rules('GB', code).donationRelief).toMatchObject({ scheme: 'gift_aid', ratePerPound: 0.25, declarationRequired: true, claimWindowYears: 4 });
    }
    expect(rules('GB', 'GB_CASC').donationRelief!.note).toContain('membership fees');
    expect(rules('GB', 'GB_CHARITY').donationRelief!.note).toContain('£2,000 a tax year');
    expect(rules('GB', 'GB_CLUB').donationRelief).toBeNull();
    expect(rules('GB', 'GB_PTA').donationRelief).toBeNull();
  });

  it('AU charity: DGR is information only, separate from charity endorsement', () => {
    const d = rules('AU', 'AU_ACNC_CHARITY').donationRelief!;
    expect(d).toMatchObject({ scheme: 'dgr', declarationRequired: false });
    expect(d.ratePerPound).toBeUndefined();
    expect(d.claimWindowYears).toBeUndefined();
    expect(d.note).toContain('separate');
    expect(rules('AU', 'AU_ACNC_CHARITY').incomeTax.note).toContain('endorsed by the ATO');
    expect(rules('AU', 'AU_CLUB').donationRelief).toBeNull();
    expect(rules('AU', 'AU_INCORPORATED_ASSOCIATION').donationRelief).toBeNull();
  });

  it('the PTA note points a charity PTA at Registered charity; the club note says members are not taxed', () => {
    expect(rules('GB', 'GB_PTA').incomeTax.note).toContain('choose "Registered charity"');
    expect(rules('GB', 'GB_CLUB').incomeTax.note).toContain('own full members is not taxed');
    expect(rules('GB', 'GB_CASC').incomeTax.note).toContain('£50,000');
  });

  it('a code from another country, a generic code in GB/AU, or nonsense → null; UK is GB; codes are case-insensitive', () => {
    expect(orgRulesFor('GB', 'AU_CLUB')).toBeNull();
    expect(orgRulesFor('AU', 'GB_CLUB')).toBeNull();
    expect(orgRulesFor('GB', 'CLUB')).toBeNull();
    expect(orgRulesFor('FR', 'GB_CLUB')).toBeNull();
    expect(orgRulesFor('', 'CLUB')).toBeNull();
    expect(orgRulesFor('GB', 'nope')).toBeNull();
    expect(rules('uk', 'gb_cio').code).toBe('GB_CIO');
  });

  it('results are copies', () => {
    const a = rules('GB', 'GB_CIO');
    a.reports.length = 0;
    a.sources[0].claim = 'changed';
    a.regulators.length = 0;
    const b = rules('GB', 'GB_CIO');
    expect(b.reports.length).toBe(3);
    expect(b.sources[0].claim).not.toBe('changed');
    expect(b.regulators.length).toBeGreaterThan(0);
  });
});

describe('orgRulesFor — accounts and regulators', () => {
  it('a charitable company: accruals accounts whatever its size, filed at Companies House too', () => {
    const a = rules('GB', 'GB_CHARITABLE_COMPANY').accounts;
    expect(a.receiptsAndPaymentsAllowed).toBe(false);
    expect(a.upToGrossIncome).toBeUndefined();
    expect(a.note).toContain('Companies House');
    expect(a.note).toContain('examiner or accountant prepares the accruals');
    expect(rules('GB', 'GB_CHARITABLE_COMPANY').reports).toContain('receipts_payments');
    expect(rules('GB', 'GB_CHARITABLE_COMPANY').regulators.map((r) => r.name)).toContain('Companies House');
  });

  it('a non-company charity or CIO: receipts and payments up to £500,000 for years ending from 30 Sep 2026, £250,000 before', () => {
    for (const code of ['GB_CHARITY', 'GB_CIO']) {
      expect(rules('GB', code, '2026-09-30').accounts).toMatchObject({ receiptsAndPaymentsAllowed: true, upToGrossIncome: 500000, currency: 'GBP', thresholdId: 'GB.cc.receiptsAndPaymentsUpTo' });
      expect(rules('GB', code, '2027-03-31').accounts.upToGrossIncome).toBe(500000);
      expect(rules('GB', code, '2026-09-29').accounts.upToGrossIncome).toBe(250000);
      expect(rules('GB', code, '2026-03-31').accounts.upToGrossIncome).toBe(250000);
    }
    // Today (the default) is after 30 September 2026.
    expect(rules('GB', 'GB_CIO', '2026-10-11').accounts.upToGrossIncome).toBe(500000);
    expect(rules('GB', 'GB_CHARITY').accounts.note).toContain('OSCR');
  });

  it('the year end accepts a Date and rejects nonsense', () => {
    expect(rules('GB', 'GB_CIO', new Date(2026, 8, 30) as unknown as string).accounts.upToGrossIncome).toBe(500000);
    expect(() => orgRulesFor('GB', 'GB_CIO', '2026-02-30')).toThrow(RangeError);
    expect(() => orgRulesFor('GB', 'GB_CIO', new Date('nope'))).toThrow(RangeError);
  });

  it('regulators: the three UK charity regulators for a registered charity; HMRC for a CASC; ACNC and ATO in AU', () => {
    const names = (c: string, code: string) => rules(c, code).regulators.map((r) => r.name);
    expect(names('GB', 'GB_CHARITY')).toEqual([
      'Charity Commission',
      'OSCR (Office of the Scottish Charity Regulator)',
      'CCNI (Charity Commission for Northern Ireland)',
      'HMRC',
    ]);
    expect(names('GB', 'GB_CIO')).toEqual(['Charity Commission', 'HMRC']);
    expect(names('GB', 'GB_CASC')).toEqual(['HMRC']);
    expect(names('GB', 'GB_CLUB')).toEqual([]);
    expect(names('AU', 'AU_ACNC_CHARITY')).toEqual(['ACNC (Australian Charities and Not-for-profits Commission)', 'ATO']);
    expect(names('AU', 'AU_INCORPORATED_ASSOCIATION')).toEqual(['State or territory regulator']);
    expect(names('FR', 'CHARITY')).toEqual([]);
    for (const [c, code] of ALL) for (const r of rules(c, code).regulators) expect(r.url).toMatch(/^https:\/\//);
  });
});

describe('sources', () => {
  it.each(ALL)('%s %s: every source is a dated https page from ORG_RULE_SOURCES', (c, code) => {
    const r = rules(c, code);
    if (c === 'FR') expect(r.sources).toEqual([]);
    else expect(r.sources.length).toBeGreaterThan(2);
    for (const s of r.sources) {
      expect(s).toEqual(ORG_RULE_SOURCES[s.id as keyof typeof ORG_RULE_SOURCES]);
      expect(s.country).toBe(c);
    }
  });

  it('every source row: https, read and review dates, a claim', () => {
    for (const [id, s] of Object.entries(ORG_RULE_SOURCES)) {
      expect({ id, url: s.sourceUrl }).toEqual({ id, url: expect.stringMatching(/^https:\/\//) });
      expect({ id, readOn: s.readOn, reviewBy: s.reviewBy }).toEqual({ id, readOn: '2026-10-11', reviewBy: expect.stringMatching(/^2027-\d{2}-\d{2}$/) });
      if (s.pageLastUpdated !== null) expect(s.pageLastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.claim.length).toBeGreaterThan(40);
      expect(s.id).toBe(id);
    }
  });
});

describe('orgReportingThresholds', () => {
  it('GB, years ending on or after 30 September 2026: the new Charity Commission thresholds', () => {
    const y = '2026-12-31';
    expect(figure('GB', 'GB.cc.registration', y)).toMatchObject({ value: 5000, test: 'at_least', currency: 'GBP' });
    expect(figure('GB', 'GB.cc.annualReturn', y)).toMatchObject({ value: 10000, test: 'over' });
    expect(figure('GB', 'GB.cc.independentExamination', y)).toMatchObject({ value: 40000, test: 'over' });
    expect(figure('GB', 'GB.cc.receiptsAndPaymentsUpTo', y)).toMatchObject({ value: 500000, test: 'or_less', appliesTo: ['GB_CHARITY', 'GB_CIO'] });
    expect(figure('GB', 'GB.cc.qualifiedExaminer', y)).toMatchObject({ value: 500000, test: 'over' });
    expect(figure('GB', 'GB.cc.auditIncome', y)).toMatchObject({ value: 1500000, test: 'over' });
    expect(figure('GB', 'GB.cc.auditAssets', y)).toMatchObject({ value: 5000000, test: 'over' });
  });

  it('GB, years ending before 30 September 2026: the old ones', () => {
    const y = '2026-09-29';
    expect(figure('GB', 'GB.cc.independentExamination', y).value).toBe(25000);
    expect(figure('GB', 'GB.cc.receiptsAndPaymentsUpTo', y).value).toBe(250000);
    expect(figure('GB', 'GB.cc.qualifiedExaminer', y).value).toBe(250000);
    expect(figure('GB', 'GB.cc.auditIncome', y).value).toBe(1000000);
    expect(figure('GB', 'GB.cc.auditAssets', y).value).toBe(3260000);
    expect(figure('GB', 'GB.cc.annualReturn', y).value).toBe(10000);
  });

  it('every Charity Commission figure names its regulator; OSCR and CCNI differ on receipts and payments', () => {
    for (const f of orgReportingThresholds('GB', '2026-12-31').filter((x) => x.id.startsWith('GB.cc.'))) expect(f.regulator).toBe('Charity Commission (England and Wales)');
    expect(figure('GB', 'GB.oscr.receiptsAndPaymentsUnder')).toMatchObject({ value: 250000, test: 'under', regulator: 'OSCR (Scotland)' });
    expect(figure('GB', 'GB.ccni.receiptsAndPaymentsUpTo')).toMatchObject({ value: 250000, test: 'or_less', regulator: 'CCNI (Northern Ireland)' });
  });

  it('GB HMRC figures: Gift Aid, GASDS, CASC limits, VAT', () => {
    expect(figure('GB', 'GB.hmrc.giftAidRatePerPound').value).toBe(0.25);
    expect(figure('GB', 'GB.hmrc.giftAidClaimWindowYears').value).toBe(4);
    expect(figure('GB', 'GB.hmrc.giftAidDeclarationRecordYears').value).toBe(6);
    expect(figure('GB', 'GB.hmrc.giftAidScheduleMaxRows').value).toBe(1000);
    expect(figure('GB', 'GB.hmrc.giftAidAggregateDonationMax').value).toBe(20);
    expect(figure('GB', 'GB.hmrc.giftAidAggregateLineMax').value).toBe(1000);
    expect(figure('GB', 'GB.hmrc.gasdsDonationMax').value).toBe(30);
    expect(figure('GB', 'GB.hmrc.gasdsTopUpMax').value).toBe(2000);
    expect(figure('GB', 'GB.hmrc.gasdsClaimWindowYears').value).toBe(2);
    expect(figure('GB', 'GB.hmrc.cascTradingTurnoverMax')).toMatchObject({ value: 50000, appliesTo: ['GB_CASC'] });
    expect(figure('GB', 'GB.hmrc.cascPropertyIncomeMax')).toMatchObject({ value: 30000, appliesTo: ['GB_CASC'] });
    expect(figure('GB', 'GB.hmrc.clubDormantCorporationTaxUnder')).toMatchObject({ value: 100, test: 'under' });
    expect(figure('GB', 'GB.hmrc.vatRegistrationOver')).toMatchObject({ value: 90000, test: 'over' });
  });

  it('AU: ACNC sizes and the NFP GST threshold', () => {
    expect(orgReportingThresholds('AU').map((f) => [f.id, f.value, f.test])).toEqual([
      ['AU.acnc.smallUnder', 500000, 'under'],
      ['AU.acnc.largeAtLeast', 3000000, 'at_least'],
      ['AU.ato.nfpGstRegistrationAtLeast', 150000, 'at_least'],
    ]);
    for (const f of orgReportingThresholds('AU')) expect(f.currency).toBe('AUD');
  });

  it('one row per id for any year end; other countries have none; UK is GB; results are copies', () => {
    for (const y of ['2025-03-31', '2026-09-29', '2026-09-30', '2030-01-01']) {
      const ids = orgReportingThresholds('GB', y).map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(orgReportingThresholds('FR')).toEqual([]);
    expect(orgReportingThresholds('UK', '2026-12-31')).toEqual(orgReportingThresholds('GB', '2026-12-31'));
    const a = orgReportingThresholds('GB');
    a[0].appliesTo.push('X');
    expect(orgReportingThresholds('GB')[0].appliesTo).not.toContain('X');
  });

  it('every figure: law, finite, https source matching its source row, read and review dates, codes that exist', () => {
    const codes = new Set([...orgTypesFor('GB'), ...orgTypesFor('AU')].map((x) => x.code));
    for (const f of ORG_FIGURES) {
      const s = ORG_RULE_SOURCES[f.source];
      expect({ id: f.id, kind: f.kind, finite: Number.isFinite(f.value) }).toEqual({ id: f.id, kind: 'law', finite: true });
      expect({ id: f.id, url: f.sourceUrl, readOn: f.readOn, reviewBy: f.reviewBy }).toEqual({ id: f.id, url: s.sourceUrl, readOn: s.readOn, reviewBy: s.reviewBy });
      expect(f.sourceUrl).toMatch(/^https:\/\//);
      expect(s.country).toBe(f.country);
      for (const c of f.appliesTo) expect({ id: f.id, code: c, known: codes.has(c) }).toEqual({ id: f.id, code: c, known: true });
    }
  });
});

describe('Gift Aid schedule', () => {
  it("the schedule's columns, in order, after HMRC's pre-filled Item column", () => {
    expect(giftAidScheduleColumns()).toEqual([
      'Title',
      'First name',
      'Last name',
      'House name or number',
      'Postcode',
      'Aggregated donations',
      'Sponsored event',
      'Donation date',
      'Amount',
    ]);
    // The source row records the same headings, with Item first.
    expect(ORG_RULE_SOURCES.giftAidScheduleColumns.claim).toContain(`Item, ${giftAidScheduleColumns().join(', ')}.`);
    const a = giftAidScheduleColumns();
    a.pop();
    expect(giftAidScheduleColumns()).toHaveLength(9);
  });

  it('dates are DD/MM/YY from the local calendar day', () => {
    expect(formatGiftAidDate(new Date(2026, 3, 5))).toBe('05/04/26');
    expect(formatGiftAidDate(new Date(2000, 0, 1, 23, 59))).toBe('01/01/00');
    expect(formatGiftAidDate(new Date(2027, 11, 31))).toBe('31/12/27');
    expect(() => formatGiftAidDate(new Date('nope'))).toThrow(RangeError);
    expect(() => formatGiftAidDate('2026-04-05' as unknown as Date)).toThrow(RangeError);
  });

  it('claim value: 25p per £1, to the penny', () => {
    expect(giftAidClaimValue(100)).toBe(25);
    expect(giftAidClaimValue(0)).toBe(0);
    expect(giftAidClaimValue(8000)).toBe(2000);
    expect(giftAidClaimValue(33.33)).toBe(8.33);
    expect(giftAidClaimValue(10.02)).toBe(2.51);
    expect(giftAidClaimValue(0.1 + 0.2)).toBe(0.08);
    expect(() => giftAidClaimValue(-1)).toThrow(RangeError);
    expect(() => giftAidClaimValue(Number.NaN)).toThrow(RangeError);
    expect(() => giftAidClaimValue(Infinity)).toThrow(RangeError);
  });
});

describe('inventory and package exports', () => {
  it('lists every source and every figure (both Charity Commission periods), with unique series', () => {
    const inv = orgRulesInventory();
    const series = inv.map((i) => i.series);
    expect(new Set(series).size).toBe(series.length);
    expect(inv.length).toBe(Object.keys(ORG_RULE_SOURCES).length + ORG_FIGURES.length);
    expect(series).toContain('ORG.GB.source.giftAidRate');
    expect(series).toContain('ORG.AU.source.mutuality');
    expect(series).toContain('ORG.GB.cc.receiptsAndPaymentsUpTo@2026-09-30');
    expect(series).toContain('ORG.GB.cc.receiptsAndPaymentsUpTo@before-2026-09-30');
    for (const i of inv) expect(i.file).toBe('src/decisions/organisationSources.ts');
  });

  it('is exported from the package root', () => {
    expect(pkg.orgTypesFor).toBe(orgTypesFor);
    expect(pkg.orgRulesFor).toBe(orgRulesFor);
    expect(pkg.orgReportingThresholds).toBe(orgReportingThresholds);
    expect(pkg.giftAidScheduleColumns).toBe(giftAidScheduleColumns);
    expect(pkg.formatGiftAidDate).toBe(formatGiftAidDate);
    expect(pkg.giftAidClaimValue).toBe(giftAidClaimValue);
    expect(pkg.orgRulesInventory).toBe(orgRulesInventory);
    expect(typeof pkg.orgRulesPastReview).toBe('function');
    expect(pkg.ORG_REPORTS).toEqual(['receipts_payments', 'gift_aid_schedule', 'vat', 'gst_bas']);
    expect(pkg.GB_CC_THRESHOLDS_FROM_YEAR_END).toBe('2026-09-30');
  });
});
