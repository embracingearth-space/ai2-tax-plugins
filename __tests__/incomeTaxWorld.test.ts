/**
 * Every data-built income-tax scheme — the contract each one must keep.
 * embracingearth.space
 *
 * Country-specific arithmetic lives in __tests__/incomeTaxWorld/<cc>.test.ts.
 * This file holds what must be true of EVERY scheme, so a country added later
 * is checked without anyone remembering to write these again: provenance on
 * every year, an explanation on every unverified year, results that carry
 * their own `verified` and source, and nothing that silently passes an
 * unverified figure off as fact.
 */
import { calcIncomeTax, INCOME_TAX_SCHEMES, listIncomeTaxCountries, getIncomeTaxYears } from '../src';
import { WORLD_INCOME_TAX_DATA } from '../src/data/incomeTaxWorld';
import { buildIncomeTaxScheme, type CountryIncomeTaxData } from '../src/data/incomeTaxFactory';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

describe('data-built schemes — provenance on every year', () => {
  it.each(WORLD_INCOME_TAX_DATA.map((d) => [d.code, d] as const))('%s: every year has an https source, an authority, a citation date and a verified boolean', (_code, d) => {
    for (const y of d.years) {
      expect(y.source).toMatch(/^https:\/\//);
      expect(y.authorityName.length).toBeGreaterThan(0);
      expect(y.citationDate).toMatch(YMD);
      expect(typeof y.verified).toBe('boolean');
      if (!y.verified) expect((y.verificationNote ?? '').trim().length).toBeGreaterThan(20);
    }
  });

  it.each(WORLD_INCOME_TAX_DATA.map((d) => [d.code, d] as const))('%s: is registered, states its assumptions, and says what social contributions it leaves out', (code, d) => {
    expect(listIncomeTaxCountries()).toContain(code);
    expect(INCOME_TAX_SCHEMES[code]!.sets.map((s) => s.taxYearLabel)).toEqual(d.years.map((y) => y.taxYear));
    expect(d.assumptions.length).toBeGreaterThan(0);
    // Scope rule: social-security contributions are out of scope for these
    // schemes, and every scheme must say so (or say it has none to leave out).
    expect(d.assumptions.join(' ')).toMatch(/social|contribution|insurance|PRSI|CPF|pension/i);
  });

  it.each(WORLD_INCOME_TAX_DATA.map((d) => [d.code, d] as const))('%s: the result carries verified + source, and an unverified year says why', (code, d) => {
    for (const y of d.years) {
      const r = calcIncomeTax(code, 60000, y.taxYear)!;
      expect(r).not.toBeNull();
      expect(r.taxYear).toBe(y.taxYear);
      expect(r.source).toBe(y.source);
      expect(r.citationDate).toBe(y.citationDate);
      expect(r.verified).toBe(y.verified);
      if (!y.verified) {
        expect(r.assumptions!.some((a) => a.includes('not verified') && a.includes(y.source))).toBe(true);
      }
    }
  });

  it.each(WORLD_INCOME_TAX_DATA.map((d) => [d.code] as const))('%s: tax never decreases as income rises, and never exceeds income', (code) => {
    for (const { value } of getIncomeTaxYears(code)) {
      let prev = -1;
      for (let g = 0; g <= 3_000_000; g += 7_919) {
        const r = calcIncomeTax(code, g, value)!;
        expect(r.totalTax).toBeGreaterThanOrEqual(0);
        expect(r.totalTax).toBeLessThanOrEqual(g);
        // A one-unit rounding wobble is tolerated; a real drop is not.
        expect(r.totalTax).toBeGreaterThanOrEqual(prev - 1);
        prev = r.totalTax;
      }
    }
  });
});

describe('the factory refuses a record that would ship without provenance', () => {
  const base: CountryIncomeTaxData = {
    code: 'ZZ', country: 'Zedland', currency: 'EUR', locale: 'en', timeZone: 'UTC', file: 'x', note: 'n', assumptions: ['a'],
    years: [{ taxYear: '2026', effectiveFrom: '2026-01-01', bands: [{ upTo: null, rate: 0.1 }], source: 'https://example.gov/z', authorityName: 'Z', citationDate: '2026-10-06', verified: true }],
  };
  const withYear = (patch: Partial<CountryIncomeTaxData['years'][number]>): CountryIncomeTaxData => ({ ...base, years: [{ ...base.years[0]!, ...patch }] });

  it('accepts a well-formed record', () => {
    expect(() => buildIncomeTaxScheme(base)).not.toThrow();
  });
  it('rejects an unverified year with no reason', () => {
    expect(() => buildIncomeTaxScheme(withYear({ verified: false }))).toThrow(/verificationNote/);
  });
  it('rejects a non-https source', () => {
    expect(() => buildIncomeTaxScheme(withYear({ source: 'http://example.gov' }))).toThrow(/https/);
  });
  it('rejects a bad citation date', () => {
    expect(() => buildIncomeTaxScheme(withYear({ citationDate: '6 Oct 2026' }))).toThrow(/citationDate/);
  });
  it('rejects a rate given as a percentage', () => {
    expect(() => buildIncomeTaxScheme(withYear({ bands: [{ upTo: null, rate: 20 }] }))).toThrow(/fraction/);
  });
  it('rejects years out of order', () => {
    const y = base.years[0]!;
    expect(() => buildIncomeTaxScheme({ ...base, years: [{ ...y, taxYear: '2025', effectiveFrom: '2025-01-01' }, y] })).toThrow(/newest first/);
  });
});
