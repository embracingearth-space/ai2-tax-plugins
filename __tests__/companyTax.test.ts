/**
 * Company tax — headline rates and their provenance. embracingearth.space
 *
 * Every set says where its rate came from, when it was last read there, and
 * whether it agreed. The rates themselves are pinned to what the authority
 * pages said on 2026-10-06 (see the comments beside each set in
 * src/data/companyTax.ts), so a stray edit to a number fails here.
 */
import { COMPANY_TAX_RATES, COMPANY_TAX_NOT_COVERED, getCompanyTaxRate, listCompanyTaxCountries, coverage } from '../src';

describe('company tax — provenance on every set', () => {
  const sets = Object.values(COMPANY_TAX_RATES).flatMap((c) => c.rates.map((r) => ({ cc: c.countryCode, ...r })));

  it('covers the home countries plus the world: 139 countries', () => {
    expect(listCompanyTaxCountries()).toEqual(expect.arrayContaining(['AU', 'CA', 'FI', 'GB', 'IN', 'US', 'DE', 'FR', 'JP']));
    expect(listCompanyTaxCountries()).toHaveLength(139);
  });

  it('no country is both covered and listed as not covered', () => {
    for (const cc of Object.keys(COMPANY_TAX_NOT_COVERED)) expect(COMPANY_TAX_RATES[cc]).toBeUndefined();
    expect(Object.keys(COMPANY_TAX_NOT_COVERED)).toHaveLength(58);
  });

  it('every set has an https source, a YYYY-MM-DD citation date and a verified flag', () => {
    for (const s of sets) {
      expect(s.source).toMatch(/^https:\/\//);
      expect(s.citationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof s.verified).toBe('boolean');
    }
  });

  it('an unverified set says why, beside itself', () => {
    for (const s of sets.filter((x) => !x.verified)) {
      expect(s.verificationNote && s.verificationNote.length).toBeTruthy();
    }
  });

  it('every home-country set was confirmed against its official page (2026-10-06 audit)', () => {
    // When a set cannot be confirmed, flip it to verified:false with a note
    // and narrow this assertion to name it — never delete the check.
    for (const s of sets.filter((x) => ['AU', 'US', 'GB', 'IN', 'CA', 'FI'].includes(x.cc))) {
      expect({ cc: s.cc, from: s.effectiveFrom, verified: s.verified }).toEqual({ cc: s.cc, from: s.effectiveFrom, verified: true });
    }
  });

  it('an OECD-sourced set is never verified, cites the OECD and tells the reader to confirm nationally', () => {
    const oecd = sets.filter((s) => s.sourceAuthority?.startsWith('OECD'));
    expect(oecd.length).toBe(109);
    for (const s of oecd) {
      expect(s.verified).toBe(false);
      expect(s.source).toMatch(/^https:\/\/sdmx\.oecd\.org\//);
      expect(COMPANY_TAX_RATES[s.cc]!.authorityName).toBe('OECD Corporate Tax Statistics');
      expect(s.note).toMatch(/confirm with .*national tax authority/i);
      expect(s.verificationNote).toMatch(/national source not read/);
    }
  });

  it('the national pages that were read and are still marked unverified say why (BT undated, ZW undated)', () => {
    for (const cc of ['BT', 'ZW']) {
      const r = getCompanyTaxRate(cc, new Date('2026-10-06T12:00:00Z'))!;
      expect(r.verified).toBe(false);
      expect(r.verificationNote).toMatch(/undated/);
    }
  });

  it('sets are ordered newest-first with unique start dates per country', () => {
    for (const c of Object.values(COMPANY_TAX_RATES)) {
      const froms = c.rates.map((r) => r.effectiveFrom);
      expect(froms).toEqual([...froms].sort().reverse());
      expect(new Set(froms).size).toBe(froms.length);
    }
  });
});

describe('company tax — the confirmed rates', () => {
  const on = new Date('2026-10-06T12:00:00Z');
  it.each([
    ['AU', 0.30, 0.25],
    ['US', 0.21, undefined],
    ['GB', 0.25, 0.19],
    ['IN', 0.25, 0.22],
    ['CA', 0.15, 0.09],
    ['FI', 0.20, undefined],
  ])('%s: standard %p, small-company %p', (cc, standard, small) => {
    const r = getCompanyTaxRate(cc, on)!;
    expect(r.standardRate).toBe(standard);
    expect(r.smallCompanyRate).toBe(small);
  });

  it('the resolved rate carries its provenance through to the caller', () => {
    const r = getCompanyTaxRate('GB', on, { preferSmallRate: true })!;
    expect(r).toMatchObject({ rate: 0.19, usedSmallRate: true, verified: true, citationDate: '2026-10-06', source: 'https://www.gov.uk/corporation-tax-rates' });
  });

  it('an unverified rate carries verified:false, its note and the OECD as publisher through to the caller', () => {
    const r = getCompanyTaxRate('FR', on)!;
    expect(r).toMatchObject({ verified: false, sourceAuthority: expect.stringMatching(/^OECD/) });
    expect(r.verificationNote).toMatch(/Confirm with France/);
  });

  it.each([
    ['AT', 0.23], ['BR', 0.15], ['CY', 0.15], ['CZ', 0.21], ['EE', 0.22], ['JP', 0.232], ['NL', 0.258], ['NZ', 0.28],
    ['SG', 0.17], ['ZA', 0.27], ['AE', 0.09], ['KE', 0.3], ['RU', 0.25], ['TW', 0.2], ['MY', 0.24], ['DE', 0.15],
  ])('%s: verified national rate %p', (cc, rate) => {
    const r = getCompanyTaxRate(cc, on)!;
    expect(r.standardRate).toBe(rate);
    expect(r.verified).toBe(true);
  });

  it.each([['HR', 0.18, 0.10], ['PH', 0.25, 0.20], ['PL', 0.19, 0.09]])('%s: small-company rate only where confirmed with a clear threshold', (cc, std, small) => {
    expect(getCompanyTaxRate(cc, on)).toMatchObject({ standardRate: std, smallCompanyRate: small, verified: true });
  });

  it('a profit band is not a small-company rate (JP, NL, ZA, AE keep one rate and describe the band)', () => {
    for (const cc of ['JP', 'NL', 'ZA', 'AE', 'MY', 'TW']) expect(getCompanyTaxRate(cc, on)!.smallCompanyRate).toBeUndefined();
  });

  it('Finland stays at 20% in 2027: the 18% is a proposal, not law', () => {
    expect(getCompanyTaxRate('FI', new Date('2027-06-01T12:00:00Z'))!.standardRate).toBe(0.20);
  });

  it('Cyprus 15% from 2026-01-01', () => {
    expect(getCompanyTaxRate('CY', on)).toMatchObject({ standardRate: 0.15, effectiveFrom: '2026-01-01', verified: true });
  });

  it('a country with no researched figure has no rate (never guessed)', () => {
    expect(getCompanyTaxRate('AF', on)).toBeNull();
    expect(getCompanyTaxRate('VE', on)).toBeNull();
  });

  it('India states the 30% rate for companies above the turnover limit, which the headline omits', () => {
    expect(getCompanyTaxRate('IN', on)!.note).toMatch(/30%/);
  });
});

describe('company tax — Germany: enacted cuts resolve by date (KStG § 23)', () => {
  it.each([
    ['2026-10-06', 0.15], ['2027-12-31', 0.15], ['2028-01-01', 0.14], ['2029-06-30', 0.13],
    ['2030-01-01', 0.12], ['2031-12-31', 0.11], ['2032-01-01', 0.10], ['2040-01-01', 0.10],
  ])('%s -> %p', (d, rate) => {
    const r = getCompanyTaxRate('DE', new Date(`${d}T12:00:00Z`))!;
    expect(r.standardRate).toBe(rate);
    expect(r.verified).toBe(true);
    expect(r.source).toBe('https://www.gesetze-im-internet.de/kstg_1977/__23.html');
  });
});

describe('company tax — coverage() counts by status', () => {
  it('139 covered (28 verified, 111 unverified), 58 not covered, as of 2026-10-06', () => {
    const m = coverage('2026-10-06');
    expect(m.counts.companyTax).toEqual({ countries: 139, verified: 28, notCovered: 58 });
    expect(m.companyTaxNotCovered).toEqual(Object.keys(COMPANY_TAX_NOT_COVERED).sort());
    expect(m.companyTaxNotCovered).toContain('AF');
    expect(m.companyTax.find((e) => e.code === 'FR')!.scope).toMatch(/OECD/);
  });
});
