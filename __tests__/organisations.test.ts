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
  ORG_URLS,
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
const IN_NPO_CODES = ['IN_PUBLIC_TRUST', 'IN_SOCIETY', 'IN_SECTION8_COMPANY'];
const IN_CODES = [...IN_NPO_CODES, 'IN_CLUB'];
/** Every country with its own types, and its codes. */
const US_EXEMPT_CODES = ['US_501C3', 'US_501C7', 'US_501C4'];
const US_CODES = [...US_EXEMPT_CODES, 'US_CLUB'];
const CA_CODES = ['CA_REGISTERED_CHARITY', 'CA_NPO', 'CA_RCAAA'];
const COUNTRY_CODES: Record<string, string[]> = { GB: GB_CODES, AU: AU_CODES, IN: IN_CODES, US: US_CODES, CA: CA_CODES };
const ALL: Array<[string, string]> = [
  ...Object.entries(COUNTRY_CODES).flatMap(([country, codes]) => codes.map((c): [string, string] => [country, c])),
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
    for (const c of [...Object.keys(COUNTRY_CODES), 'FR']) for (const ty of orgTypesFor(c)) expect(orgRulesFor(c, ty.code)).not.toBeNull();
  });

  it('each country with its own types offers exactly its codes, in order', () => {
    for (const [c, codes] of Object.entries(COUNTRY_CODES)) expect(orgTypesFor(c).map((t) => t.code)).toEqual(codes);
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
    const codes = new Set(Object.keys(COUNTRY_CODES).flatMap((c) => orgTypesFor(c)).map((x) => x.code));
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

/** The currency every money figure of a country is in. */
const CURRENCY: Record<string, string> = { GB: 'GBP', AU: 'AUD', IN: 'INR', US: 'USD', CA: 'CAD' };

describe('every country: figures in its own currency, sources in its own country', () => {
  it.each(Object.keys(COUNTRY_CODES))('%s', (c) => {
    const figs = orgReportingThresholds(c, '2026-12-31');
    expect(figs.length).toBeGreaterThan(0);
    for (const f of figs) {
      expect(f.country).toBe(c);
      if (f.currency !== null) expect({ id: f.id, currency: f.currency }).toEqual({ id: f.id, currency: CURRENCY[c] });
      expect(ORG_RULE_SOURCES[f.source].country).toBe(c);
    }
  });
});

describe('India (IN) — Income-tax Act, 2025, from tax year 2026-27', () => {
  it('types: public trust, society, section 8 company, club or association (RWAs included)', () => {
    expect(orgTypesFor('IN').map((t) => [t.code, t.label, t.kind])).toEqual([
      ['IN_PUBLIC_TRUST', 'Public charitable trust', 'charity'],
      ['IN_SOCIETY', 'Registered society', 'association'],
      ['IN_SECTION8_COMPANY', 'Section 8 company', 'charity'],
      ['IN_CLUB', 'Club or association (including a resident welfare association)', 'club'],
    ]);
  });

  it('statuses: exempt only if registered under section 332 and 85% applied; clubs on mutuality; no forecast', () => {
    for (const code of IN_NPO_CODES) {
      const r = rules('IN', code);
      expect(r.incomeTax.status).toBe('exempt_if_conditions');
      expect(r.incomeTax.note).toContain('section 332');
      expect(r.incomeTax.note).toContain('85%');
      expect(r.incomeTax.note).toContain('Form 112');
      expect(r.incomeTax.note).toContain('Foreign Contribution (Regulation) Act, 2010');
      expect(r.incomeTaxForecast).toBe(false);
    }
    const club = rules('IN', 'IN_CLUB');
    expect(club.incomeTax.status).toBe('mutuality');
    expect(club.incomeTax.note).toContain('interest on bank deposits are taxable');
    expect(club.incomeTaxForecast).toBe(false);
  });

  it('the 2025 Act is cited, not the 1961 sections it replaced', () => {
    const urls = rules('IN', 'IN_PUBLIC_TRUST').sources.map((s) => s.sourceUrl);
    expect(urls).toEqual(expect.arrayContaining([ORG_URLS.inAct2025Commencement, ORG_URLS.inS332Registration, ORG_URLS.inS336TaxableRegularIncome, ORG_URLS.inForm112Faqs]));
    expect(ORG_RULE_SOURCES.inAct2025InForce.claim).toContain('1st April, 2026');
    expect(ORG_RULE_SOURCES.inForm112.claim).toContain('Form 10B and 10BB');
  });

  it('donor deduction (section 133 / 354) is information only for the NPOs; none for clubs', () => {
    for (const code of IN_NPO_CODES) {
      const d = rules('IN', code).donationRelief!;
      expect(d).toMatchObject({ scheme: 'donor_deduction', declarationRequired: false });
      expect(d.ratePerPound).toBeUndefined();
      expect(d.claimWindowYears).toBeUndefined();
      expect(d.note).toContain('section 354');
      expect(d.note).toContain('certificate');
    }
    expect(rules('IN', 'IN_CLUB').donationRelief).toBeNull();
  });

  it('reports: receipts and payments and GST for every type; regulators: the Income Tax Department for the NPOs', () => {
    for (const code of IN_CODES) expect(rules('IN', code).reports).toEqual(['receipts_payments', 'gst']);
    for (const code of IN_NPO_CODES) expect(rules('IN', code).regulators.map((r) => r.name)).toEqual(['Income Tax Department (India)']);
    expect(rules('IN', 'IN_CLUB').regulators).toEqual([]);
  });

  it('accounts: a section 8 company keeps accrual books (Companies Act s 128); trusts, societies and clubs may use receipts and payments', () => {
    const co = rules('IN', 'IN_SECTION8_COMPANY');
    expect(co.accounts.receiptsAndPaymentsAllowed).toBe(false);
    expect(co.accounts.note).toContain('accrual basis');
    expect(co.sources.map((s) => s.id)).toContain('inCompanyAccruals');
    for (const code of ['IN_PUBLIC_TRUST', 'IN_SOCIETY', 'IN_CLUB']) expect(rules('IN', code).accounts.receiptsAndPaymentsAllowed).toBe(true);
    expect(rules('IN', 'IN_CLUB').accounts.note).toContain('Rs. 7,500');
  });

  it('figures: 85%, 30%, 5 years, donor 50% / 10% / Rs 2,000 cash, Form 112 small NPO, GST Rs 20 lakh / 10 lakh, RWA Rs 7,500', () => {
    expect(orgReportingThresholds('IN').map((f) => [f.id, f.value, f.test, f.currency])).toEqual([
      ['IN.ita.applicationShareAtLeast', 0.85, 'at_least', null],
      ['IN.ita.specifiedIncomeRate', 0.3, 'is', null],
      ['IN.ita.accumulationMaxYears', 5, 'or_less', null],
      ['IN.ita.donorDeductionShare', 0.5, 'is', null],
      ['IN.ita.donorDeductionIncomeCap', 0.1, 'or_less', null],
      ['IN.ita.donationCashUpTo', 2000, 'or_less', 'INR'],
      ['IN.ita.smallNpoRegularIncomeUpTo', 50000000, 'or_less', 'INR'],
      ['IN.ita.smallNpoForeignContributionUpTo', 1000000, 'or_less', 'INR'],
      ['IN.gst.registrationOver', 2000000, 'over', 'INR'],
      ['IN.gst.registrationSpecialCategoryOver', 1000000, 'over', 'INR'],
      ['IN.gst.rwaMemberContributionExemptUpTo', 7500, 'or_less', 'INR'],
    ]);
    expect(figure('IN', 'IN.gst.rwaMemberContributionExemptUpTo').appliesTo).toEqual(['IN_SOCIETY', 'IN_CLUB']);
  });

  it('sources: every IN row from an Indian government page or the Supreme Court, read today, reviewed before tax year 2027-28', () => {
    const rows = Object.values(ORG_RULE_SOURCES).filter((s) => s.country === 'IN');
    expect(rows.length).toBeGreaterThan(15);
    for (const s of rows) {
      expect(s.sourceUrl).toMatch(/^https:\/\/(www\.incometaxindia\.gov\.in|taxinformation\.cbic\.gov\.in|cbic-gst\.gov\.in|api\.sci\.gov\.in)\//);
      expect({ id: s.id, readOn: s.readOn, reviewBy: s.reviewBy }).toEqual({ id: s.id, readOn: '2026-10-11', reviewBy: '2027-03-31' });
    }
    for (const code of IN_CODES) expect(rules('IN', code).sources.length).toBeGreaterThan(3);
  });
});

describe('United States (US) — federal (IRS)', () => {
  it('types: 501(c)(3), 501(c)(7), 501(c)(4) and others, a club not recognised as exempt', () => {
    expect(orgTypesFor('US').map((t) => [t.code, t.label, t.kind])).toEqual([
      ['US_501C3', 'Charity (501(c)(3) public charity)', 'charity'],
      ['US_501C7', 'Social club (501(c)(7))', 'club'],
      ['US_501C4', 'Social welfare or other nonprofit (501(c)(4) and others)', 'association'],
      ['US_CLUB', 'Club or group not recognised as exempt', 'community'],
    ]);
  });

  it('statuses: 501(c)(3) and (c)(4) exempt if conditions; a social club on mutuality; an unrecognised club check locally', () => {
    expect(rules('US', 'US_501C3').incomeTax.status).toBe('exempt_if_conditions');
    expect(rules('US', 'US_501C4').incomeTax.status).toBe('exempt_if_conditions');
    expect(rules('US', 'US_501C7').incomeTax.status).toBe('mutuality');
    expect(rules('US', 'US_CLUB').incomeTax.status).toBe('check_locally');
    for (const code of US_CODES) expect(rules('US', code).incomeTaxForecast).toBe(false);
    for (const code of US_EXEMPT_CODES) {
      const note = rules('US', code).incomeTax.note;
      expect(note).toContain('Form 990-N');
      expect(note).toContain('990-T');
    }
    expect(rules('US', 'US_501C7').incomeTax.note).toContain('35%');
    expect(rules('US', 'US_501C4').incomeTax.note).toContain('Form 8976');
  });

  it('donor deduction only for 501(c)(3), information only; written acknowledgment at $250', () => {
    const d = rules('US', 'US_501C3').donationRelief!;
    expect(d).toMatchObject({ scheme: 'donor_deduction', declarationRequired: false });
    expect(d.note).toContain('$250');
    for (const code of ['US_501C7', 'US_501C4', 'US_CLUB']) expect(rules('US', code).donationRelief).toBeNull();
    expect(rules('US', 'US_501C4').accounts.note).toContain('generally not deductible');
  });

  it('reports: receipts and payments only (no federal VAT/GST, no return export); regulators: IRS, plus the states for a charity', () => {
    for (const code of US_CODES) expect(rules('US', code).reports).toEqual(['receipts_payments']);
    expect(rules('US', 'US_501C3').regulators.map((r) => r.name)).toEqual(['IRS (exempt organizations)', 'State charity regulator']);
    expect(rules('US', 'US_501C7').regulators.map((r) => r.name)).toEqual(['IRS (exempt organizations)']);
    expect(rules('US', 'US_CLUB').regulators).toEqual([]);
  });

  it('figures: Form 990-N / 990-EZ thresholds, due month, revocation, 990-T, social club limits, $250 acknowledgment', () => {
    expect(orgReportingThresholds('US').map((f) => [f.id, f.value, f.test, f.currency])).toEqual([
      ['US.irs.form990nGrossReceiptsUpTo', 50000, 'or_less', 'USD'],
      ['US.irs.form990ezGrossReceiptsUnder', 200000, 'under', 'USD'],
      ['US.irs.form990ezTotalAssetsUnder', 500000, 'under', 'USD'],
      ['US.irs.returnDueMonthAfterYearEnd', 5, 'is', null],
      ['US.irs.automaticRevocationYears', 3, 'is', null],
      ['US.irs.form990tUnrelatedIncomeAtLeast', 1000, 'at_least', 'USD'],
      ['US.irs.socialClubNonmemberShareUpTo', 0.35, 'or_less', null],
      ['US.irs.socialClubNonmemberFacilitiesShareUpTo', 0.15, 'or_less', null],
      ['US.irs.writtenAcknowledgmentAtLeast', 250, 'at_least', 'USD'],
    ]);
  });

  it('sources: every US row an irs.gov page, read today, reviewed before the 2027 filing season', () => {
    const rows = Object.values(ORG_RULE_SOURCES).filter((s) => s.country === 'US');
    expect(rows.length).toBeGreaterThan(10);
    for (const s of rows) {
      expect(s.authority).toBe('IRS');
      expect(s.sourceUrl).toMatch(/^https:\/\/www\.irs\.gov\//);
      expect({ id: s.id, readOn: s.readOn, reviewBy: s.reviewBy }).toEqual({ id: s.id, readOn: '2026-10-11', reviewBy: '2027-01-31' });
    }
    for (const code of US_CODES) expect(rules('US', code).sources.length).toBeGreaterThan(3);
  });
});

describe('Canada (CA) — CRA', () => {
  it('types: registered charity, non-profit organisation, national RCAAA', () => {
    expect(orgTypesFor('CA').map((t) => [t.code, t.label, t.kind, t.registeredWith])).toEqual([
      ['CA_REGISTERED_CHARITY', 'Registered charity', 'charity', 'CRA'],
      ['CA_NPO', 'Non-profit organisation (club, association or society)', 'community', 'Not registered with the CRA'],
      ['CA_RCAAA', 'Registered Canadian amateur athletic association (national)', 'club', 'CRA'],
    ]);
  });

  it('statuses: all exempt if conditions; notes name the return each files', () => {
    for (const code of CA_CODES) {
      expect(rules('CA', code).incomeTax.status).toBe('exempt_if_conditions');
      expect(rules('CA', code).incomeTaxForecast).toBe(false);
    }
    expect(rules('CA', 'CA_REGISTERED_CHARITY').incomeTax.note).toContain('T3010');
    expect(rules('CA', 'CA_REGISTERED_CHARITY').incomeTax.note).toContain('disbursement quota');
    expect(rules('CA', 'CA_NPO').incomeTax.note).toContain('T1044');
    expect(rules('CA', 'CA_NPO').incomeTax.note).toContain('149(5)');
    expect(rules('CA', 'CA_RCAAA').incomeTax.note).toContain('T2052');
    expect(rules('CA', 'CA_RCAAA').incomeTax.note).toContain('choose "Non-profit organisation"');
  });

  it('official donation receipts for the charity and the RCAAA only; information only', () => {
    for (const code of ['CA_REGISTERED_CHARITY', 'CA_RCAAA']) {
      expect(rules('CA', code).donationRelief).toMatchObject({ scheme: 'donor_deduction', declarationRequired: false });
      expect(rules('CA', code).donationRelief!.note).toContain('official donation receipts');
    }
    expect(rules('CA', 'CA_NPO').donationRelief).toBeNull();
  });

  it('reports: receipts and payments and GST/HST; regulator: the CRA for the registered types', () => {
    for (const code of CA_CODES) expect(rules('CA', code).reports).toEqual(['receipts_payments', 'gst']);
    expect(rules('CA', 'CA_REGISTERED_CHARITY').regulators.map((r) => r.name)).toEqual(['CRA (Canada Revenue Agency)']);
    expect(rules('CA', 'CA_RCAAA').regulators.map((r) => r.name)).toEqual(['CRA (Canada Revenue Agency)']);
    expect(rules('CA', 'CA_NPO').regulators).toEqual([]);
  });

  it('figures: T3010 / T1044 / T2052 six months, disbursement quota, T1044 tests, GST/HST small supplier', () => {
    expect(orgReportingThresholds('CA').map((f) => [f.id, f.value, f.test, f.currency])).toEqual([
      ['CA.cra.t3010DueMonths', 6, 'or_less', null],
      ['CA.cra.dqThresholdOver', 100000, 'over', 'CAD'],
      ['CA.cra.dqRate', 0.035, 'is', null],
      ['CA.cra.dqRateOverMillion', 0.05, 'is', null],
      ['CA.cra.dqHigherRateOver', 1000000, 'over', 'CAD'],
      ['CA.cra.t1044PropertyIncomeOver', 10000, 'over', 'CAD'],
      ['CA.cra.t1044TotalAssetsOver', 200000, 'over', 'CAD'],
      ['CA.cra.t1044DueMonths', 6, 'or_less', null],
      ['CA.cra.t2052DueMonths', 6, 'or_less', null],
      ['CA.cra.gstSmallSupplierTaxableSuppliesUpTo', 50000, 'or_less', 'CAD'],
      ['CA.cra.gstCharityGrossRevenueUpTo', 250000, 'or_less', 'CAD'],
    ]);
  });

  it('sources: every CA row a canada.ca CRA page, read today, reviewed by 31 January 2027', () => {
    const rows = Object.values(ORG_RULE_SOURCES).filter((s) => s.country === 'CA');
    expect(rows.length).toBeGreaterThan(8);
    for (const s of rows) {
      expect(s.authority).toBe('CRA');
      expect(s.sourceUrl).toMatch(/^https:\/\/www\.canada\.ca\/en\/revenue-agency\//);
      expect({ id: s.id, readOn: s.readOn, reviewBy: s.reviewBy }).toEqual({ id: s.id, readOn: '2026-10-11', reviewBy: '2027-01-31' });
    }
    for (const code of CA_CODES) expect(rules('CA', code).sources.length).toBeGreaterThan(2);
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
    expect(pkg.ORG_REPORTS).toEqual(['receipts_payments', 'gift_aid_schedule', 'vat', 'gst_bas', 'gst']);
    expect(pkg.GB_CC_THRESHOLDS_FROM_YEAR_END).toBe('2026-09-30');
  });
});
