/**
 * Rate ledger — every country, US states and Canadian provinces. ai2fin.com
 *
 * The 2026-10-06 expansion took the ledger from 88 countries to 199 and from
 * one sub-national row to 64 jurisdictions. These tests pin what that
 * expansion must never do: claim a start date nobody established, cite a page
 * over plain http, let a sub-national row answer a national question, or serve
 * a placeholder rate as a fact.
 */
import {
  RATE_LEDGER,
  RATE_FLOOR,
  resolveRateRow,
  getStandardRateAsOf,
  activeNationalRows,
  isRateIndicative,
  COUNTRY_TAX_RATES,
  getTaxRateInfo,
  getStandardTaxRate,
} from '../src/data';
import { analyzeLedger } from '../src/rateWatch';

const TODAY = '2026-10-06';
const label = (r: (typeof RATE_LEDGER)[number]) => `${r.countryCode}${r.stateProvince ? '-' + r.stateProvince : ''}@${r.effectiveFrom}`;
const countries = [...new Set(RATE_LEDGER.map((r) => r.countryCode))];

describe('every country resolves today', () => {
  it('every country in the ledger has a national row in force on the read date', () => {
    const missing = countries.filter((cc) => resolveRateRow(cc, TODAY) === undefined);
    expect(missing).toEqual([]);
  });

  it('a sample of the new countries resolves to its researched rate', () => {
    expect(getStandardRateAsOf('JM', TODAY)).toBe(0.15); // GCT, 15% since 1 Apr 2020
    expect(getStandardRateAsOf('ZW', TODAY)).toBe(0.155); // 15% -> 15.5% on 1 Jan 2026
    expect(getStandardRateAsOf('MV', TODAY)).toBe(0.08);
    expect(getStandardRateAsOf('LI', TODAY)).toBe(0.081);
    expect(getStandardRateAsOf('BN', TODAY)).toBe(0); // no VAT/GST: a verified zero
    expect(resolveRateRow('BN', TODAY)?.taxFamily).toBe('NONE');
  });

  it('every country except the indicative ones reaches the flat view', () => {
    const indicativeNow = activeNationalRows(TODAY, { includeIndicative: true }).filter(isRateIndicative).map((r) => r.countryCode).sort();
    expect(indicativeNow).toEqual(['AF', 'CU', 'SO', 'SS', 'SY', 'TD']);
    expect(activeNationalRows(TODAY)).toHaveLength(countries.length - indicativeNow.length);
  });
});

describe('citations and dates are honest', () => {
  it('every verified row cites https', () => {
    const plain = RATE_LEDGER.filter((r) => r.source.verified && !r.source.url.startsWith('https://')).map(label);
    expect(plain).toEqual([]);
  });

  it('the five plain-http citations were moved to https or downgraded', () => {
    // MK and SL: the same official page loads over https and was re-read.
    expect(resolveRateRow('MK', TODAY)?.source).toMatchObject({ verified: true, url: 'https://www.ujp.gov.mk/-/plakjanje/opsti_danocni_stapki' });
    expect(resolveRateRow('SL', TODAY)?.source.verified).toBe(true);
    expect(resolveRateRow('SL', TODAY)?.source.url).toMatch(/^https:\/\/webtestcms\.nra\.gov\.sl\//);
    // NI, HT, KP: the authority is http-only, so the row cannot be verified.
    for (const cc of ['NI', 'HT', 'KP']) {
      const row = resolveRateRow(cc, TODAY)!;
      expect(row.source.verified).toBe(false);
      expect(row.source.url).toMatch(/^https:\/\//);
    }
  });

  it('no row has a null, sentinel or citation-date start', () => {
    for (const r of RATE_LEDGER) {
      expect(typeof r.effectiveFrom).toBe('string');
      expect(r.effectiveFrom >= RATE_FLOOR).toBe(true); // rules out 1970-01-01 and every pre-2000 date
      // A start equal to the day the page was read is a placeholder, not a start.
      expect({ row: label(r), placeholder: r.effectiveFrom === r.source.citationDate }).toEqual({ row: label(r), placeholder: false });
    }
  });

  it('a row whose start is unknown says so instead of passing the floor off as a date', () => {
    const floorAdded = RATE_LEDGER.filter((r) => r.source.citationDate === TODAY && r.effectiveFrom === RATE_FLOOR);
    expect(floorAdded.length).toBeGreaterThan(0);
    for (const r of floorAdded) {
      expect({ row: label(r), explained: /START DATE UNKNOWN|IN FORCE BEFORE THE LEDGER FLOOR|anchored at the ledger floor/.test(r.source.note ?? '') })
        .toEqual({ row: label(r), explained: true });
    }
  });

  it('a tax that began after 2000 is not floored into years it did not exist', () => {
    // St Vincent's VAT started in 2007; South Sudan became a state in 2011.
    expect(resolveRateRow('VC', '2005-01-01')).toBeUndefined();
    expect(resolveRateRow('SS', '2010-01-01')).toBeUndefined();
  });

  it('effectiveTo is exclusive: a last day of 31 Dec is stored as 1 Jan', () => {
    expect(getStandardRateAsOf('TJ', '2026-12-31')).toBe(0.14);
    expect(getStandardRateAsOf('TJ', '2027-01-01')).toBe(0.13);
    expect(resolveRateRow('LR', '2026-12-31')?.standardRate).toBe(0.13);
    expect(resolveRateRow('CA', '2025-03-31', { stateProvince: 'NS' })?.standardRate).toBe(0.15);
    expect(resolveRateRow('CA', '2025-04-01', { stateProvince: 'NS' })?.standardRate).toBe(0.14);
    expect(resolveRateRow('US', '2041-06-30', { stateProvince: 'AZ' })?.standardRate).toBe(0.056);
    expect(resolveRateRow('US', '2041-07-01', { stateProvince: 'AZ' })?.standardRate).toBe(0.05);
  });

  it('pins every unverified row by name, so a new one is a visible failure', () => {
    const unverified = RATE_LEDGER.filter((r) => !r.source.verified).map(label).sort();
    expect(unverified).toEqual([
      'AF@2000-01-01', 'AG@2024-01-01', 'BR@2000-01-01', 'CU@2012-07-23', 'ER@2000-01-01', 'FM@2000-01-01',
      'GD@2010-02-01', 'GN@2000-01-01', 'GT@2001-08-01', 'HT@2000-01-01', 'IL@2000-01-01', 'IQ@2000-01-01',
      'IR@2024-03-20', 'KM@2000-01-01', 'KP@2000-01-01', 'KW@2000-01-01', 'LC@2017-02-01', 'LR@2027-01-01',
      'LY@2000-01-01', 'MR@2000-01-01', 'MW@2000-01-01', 'NI@2013-01-01', 'NR@2000-01-01', 'SO@2000-01-01',
      'SS@2011-07-09', 'ST@2023-06-01', 'SY@2000-01-01', 'TD@2000-01-01', 'US-ID@2006-10-01', 'US-LA@2030-01-01',
      'US-NM@2023-07-01', 'US-OH@2013-09-01', 'US-RI@2000-01-01', 'VA@2000-01-01', 'YE@2000-01-01',
    ]);
  });
});

describe('sub-national rows never change the national answer', () => {
  it('the US and Canada still answer their national row', () => {
    for (const d of ['2005-06-01', '2020-01-01', TODAY]) {
      expect(resolveRateRow('US', d)?.stateProvince).toBeNull();
      expect(getStandardRateAsOf('US', d)).toBe(0);
      expect(resolveRateRow('CA', d)?.stateProvince).toBeNull();
    }
    expect(getStandardRateAsOf('CA', TODAY)).toBe(0.05);
    expect(COUNTRY_TAX_RATES['US'].standardRate).toBe(0);
    expect(COUNTRY_TAX_RATES['CA'].standardRate).toBe(0.05);
    expect(getStandardTaxRate('US')).toBe(0);
    expect(activeNationalRows(TODAY).every((r) => r.stateProvince === null)).toBe(true);
  });

  it('covers every US state plus DC and every Canadian province and territory', () => {
    const us = new Set(RATE_LEDGER.filter((r) => r.countryCode === 'US' && r.stateProvince).map((r) => r.stateProvince));
    const ca = new Set(RATE_LEDGER.filter((r) => r.countryCode === 'CA' && r.stateProvince).map((r) => r.stateProvince));
    expect(us.size).toBe(51);
    expect(us.has('DC')).toBe(true);
    expect([...ca].sort()).toEqual(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']);
    // Ontario was already in the ledger and was not duplicated.
    expect(RATE_LEDGER.filter((r) => r.countryCode === 'CA' && r.stateProvince === 'ON')).toHaveLength(1);
  });

  it('resolves a state or province only when asked for it', () => {
    expect(resolveRateRow('US', TODAY, { stateProvince: 'CA' })?.standardRate).toBe(0.0725);
    expect(resolveRateRow('US', TODAY, { stateProvince: 'OR' })?.standardRate).toBe(0);
    expect(resolveRateRow('CA', TODAY, { stateProvince: 'QC' })?.standardRate).toBe(0.09975);
    expect(resolveRateRow('CA', TODAY, { stateProvince: 'BC' })?.combinedRate).toBe(0.12);
  });

  it('every HST row stores the full harmonised rate, as Ontario does', () => {
    const hst = RATE_LEDGER.filter((r) => r.countryCode === 'CA' && r.taxType === 'HST');
    expect(hst.length).toBe(6);
    for (const r of hst) expect(r.standardRate).toBe(r.combinedRate);
  });
});

describe('indicative rates are flagged and never served as fact', () => {
  const indicative = RATE_LEDGER.filter(isRateIndicative);

  it('flags exactly the rows whose figure is a placeholder, partial, low-confidence or in conflict', () => {
    expect(indicative.map(label).sort()).toEqual([
      'AF@2000-01-01', 'CU@2012-07-23', 'LR@2027-01-01', 'SO@2000-01-01', 'SS@2011-07-09', 'SY@2000-01-01',
      'TD@2000-01-01', 'US-LA@2030-01-01',
    ]);
  });

  it('an indicative row is never verified, and its note says why', () => {
    for (const r of indicative) {
      expect(r.source.verified).toBe(false);
      expect(r.source.note).toMatch(/^INDICATIVE - NOT A CONFIRMED RATE: /);
    }
  });

  it('degrades every as-fact surface to "unknown"', () => {
    for (const cc of ['SY', 'CU', 'SO', 'SS', 'TD', 'AF']) {
      expect(resolveRateRow(cc, TODAY)?.rateIsIndicative).toBe(true); // still on record, with the flag
      expect(getStandardRateAsOf(cc, TODAY)).toBe(0);
      expect(getTaxRateInfo(cc, TODAY)).toBeUndefined();
      expect(cc in COUNTRY_TAX_RATES).toBe(false);
      expect(activeNationalRows(TODAY).some((r) => r.countryCode === cc)).toBe(false);
    }
  });

  it("Liberia's confirmed GST is served; its unconfirmed 2027 VAT rate is not", () => {
    expect(getStandardRateAsOf('LR', '2026-06-01')).toBe(0.13);
    expect(getTaxRateInfo('LR', '2026-06-01')?.standardRate).toBe(0.13);
    expect(resolveRateRow('LR', '2027-06-01')?.taxType).toBe('VAT');
    expect(getStandardRateAsOf('LR', '2027-06-01')).toBe(0);
    expect(activeNationalRows('2027-06-01').some((r) => r.countryCode === 'LR')).toBe(false);
  });

  it('an indicative country is omitted, not replaced by an older row', () => {
    // Liberia in 2027: the GST row has ended and the VAT row is indicative, so
    // the country drops out of the flat view instead of falling back to GST.
    const withFlag = activeNationalRows('2027-06-01', { includeIndicative: true }).find((r) => r.countryCode === 'LR');
    expect(withFlag?.taxType).toBe('VAT');
  });

  it('Rate Watch still puts every indicative country in front of a human', () => {
    const f = analyzeLedger(TODAY);
    const flagged = f.unverified.filter((u) => /indicative/.test(u.reason)).map((u) => u.countryCode).sort();
    expect(flagged).toEqual(['AF', 'CU', 'SO', 'SS', 'SY', 'TD']);
  });
});

describe('surcharged rates and confirmed history', () => {
  it('stores the rate actually charged, with the statutory base in the note', () => {
    const cm = resolveRateRow('CM', TODAY)!;
    expect(cm.standardRate).toBe(0.1925);
    expect(cm.source.note).toMatch(/17[.,]5 ?%/);
    const cg = resolveRateRow('CG', TODAY)!;
    expect(cg.standardRate).toBe(0.189);
    expect(cg.source.note).toMatch(/18%/);
  });

  it("Singapore's GST history from IRAS's own table", () => {
    expect(getStandardRateAsOf('SG', '2002-12-31')).toBe(0.03);
    expect(getStandardRateAsOf('SG', '2003-01-01')).toBe(0.04);
    expect(getStandardRateAsOf('SG', '2004-01-01')).toBe(0.05);
    expect(getStandardRateAsOf('SG', '2007-06-30')).toBe(0.05);
    expect(getStandardRateAsOf('SG', '2007-07-01')).toBe(0.07);
    expect(getStandardRateAsOf('SG', '2022-12-31')).toBe(0.07);
    expect(getStandardRateAsOf('SG', '2023-01-01')).toBe(0.08);
    expect(getStandardRateAsOf('SG', '2024-01-01')).toBe(0.09);
  });

  it("Switzerland's VAT history from the ESTV's own table", () => {
    expect(getStandardRateAsOf('CH', '2000-06-01')).toBe(0.075);
    expect(getStandardRateAsOf('CH', '2001-01-01')).toBe(0.076);
    expect(getStandardRateAsOf('CH', '2011-01-01')).toBe(0.08);
    expect(getStandardRateAsOf('CH', '2018-01-01')).toBe(0.077);
    expect(getStandardRateAsOf('CH', '2023-12-31')).toBe(0.077);
    expect(getStandardRateAsOf('CH', '2024-01-01')).toBe(0.081);
  });

  it("Sri Lanka's 2022 steps, and the 8% era left honestly unrecorded", () => {
    expect(getStandardRateAsOf('LK', '2022-06-01')).toBe(0.12);
    expect(getStandardRateAsOf('LK', '2022-09-01')).toBe(0.15);
    expect(getStandardRateAsOf('LK', '2023-12-31')).toBe(0.15);
    expect(getStandardRateAsOf('LK', '2024-01-01')).toBe(0.18);
    // IRD's page says only "Prior to 01.06.2022 - 8%", with no start date.
    expect(resolveRateRow('LK', '2022-05-31')).toBeUndefined();
  });
});
