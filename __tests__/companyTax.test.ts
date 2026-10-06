/**
 * Company tax — headline rates and their provenance. embracingearth.space
 *
 * Every set says where its rate came from, when it was last read there, and
 * whether it agreed. The rates themselves are pinned to what the authority
 * pages said on 2026-10-06 (see the comments beside each set in
 * src/data/companyTax.ts), so a stray edit to a number fails here.
 */
import { COMPANY_TAX_RATES, getCompanyTaxRate, listCompanyTaxCountries } from '../src';

describe('company tax — provenance on every set', () => {
  const sets = Object.values(COMPANY_TAX_RATES).flatMap((c) => c.rates.map((r) => ({ cc: c.countryCode, ...r })));

  it('covers AU, US, GB, IN, CA and FI', () => {
    expect(listCompanyTaxCountries().sort()).toEqual(['AU', 'CA', 'FI', 'GB', 'IN', 'US']);
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

  it('every set shipped today was confirmed against its official page (2026-10-06 audit)', () => {
    // When a set cannot be confirmed, flip it to verified:false with a note
    // and narrow this assertion to name it — never delete the check.
    for (const s of sets) expect({ cc: s.cc, from: s.effectiveFrom, verified: s.verified }).toEqual({ cc: s.cc, from: s.effectiveFrom, verified: true });
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

  it('India states the 30% rate for companies above the turnover limit, which the headline omits', () => {
    expect(getCompanyTaxRate('IN', on)!.note).toMatch(/30%/);
  });
});
