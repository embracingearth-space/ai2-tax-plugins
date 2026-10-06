/**
 * coverage() — the manifest the app, website and MCPs read their coverage from.
 * embracingearth.space
 *
 * Two things are pinned here. The SHAPE, because three consumers parse it. And
 * that every count EQUALS its registry — computed independently from the
 * registry in this file, never from the manifest — so the manifest can never
 * claim a country the data does not hold, and never quietly drop one either.
 * Dates are fixed so the assertions do not move with the clock.
 */
import {
  coverage,
  COVERAGE_CAPABILITIES,
  activeNationalRows,
  listIncomeTaxCountries,
  INCOME_TAX_SCHEMES,
  listCompanyTaxCountries,
  COMPANY_TAX_RATES,
  FI_CAPITAL_INCOME_YEARS,
  STUDENT_LOAN_SCHEMES,
  RETIREMENT_SCHEMES,
  RATE_LEDGER,
  calcIncomeTax,
  listCapitalGainsCountries,
  resolveCapitalGainsRules,
  CGT_NOT_RESEARCHED,
} from '../src';
import type { CoverageEntry, CoverageManifest } from '../src';

const AUDIT = '2026-10-06';
const sorted = (xs: string[]) => [...xs].sort();
const codes = (es: CoverageEntry[]) => es.map((e) => e.code);

describe('coverage() — shape', () => {
  const m: CoverageManifest = coverage(AUDIT);

  it('has one list per capability, plus asOf and counts', () => {
    expect(Object.keys(m).sort()).toEqual(sorted(['asOf', 'counts', ...COVERAGE_CAPABILITIES]));
    expect(COVERAGE_CAPABILITIES).toEqual(['gstVat', 'incomeTax', 'companyTax', 'cgt', 'studentLoan', 'retirement']);
    expect(m.asOf).toBe(AUDIT);
  });

  it('every entry carries code, verified, citationDate and sourceUrl', () => {
    for (const cap of COVERAGE_CAPABILITIES) {
      for (const e of m[cap]) {
        expect(e.code).toMatch(/^[A-Z]{2}$/);
        expect(typeof e.verified).toBe('boolean');
        expect(e.citationDate === null || /^\d{4}-\d{2}-\d{2}$/.test(e.citationDate)).toBe(true);
        expect(e.sourceUrl === null || /^https:\/\//.test(e.sourceUrl)).toBe(true);
      }
    }
  });

  it('lists each country at most once per capability, sorted by code', () => {
    for (const cap of COVERAGE_CAPABILITIES) {
      const cs = codes(m[cap]);
      expect(new Set(cs).size).toBe(cs.length);
      expect(cs).toEqual(sorted(cs));
    }
  });

  it('a verified entry always has a citation date and an official URL behind it', () => {
    for (const cap of COVERAGE_CAPABILITIES) {
      for (const e of m[cap].filter((x) => x.verified)) {
        expect(e.citationDate).not.toBeNull();
        expect(e.sourceUrl).not.toBeNull();
      }
    }
  });

  it('counts are the lengths of the lists they describe', () => {
    for (const cap of COVERAGE_CAPABILITIES) {
      expect(m.counts[cap]).toEqual({ countries: m[cap].length, verified: m[cap].filter((e) => e.verified).length });
    }
  });

  it('defaults to today', () => {
    expect(coverage().asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('coverage() — counts equal the registries (it cannot claim more than the data)', () => {
  const m = coverage(AUDIT);

  it('gstVat = the national ledger rows in force, verified only where the row says so', () => {
    const rows = activeNationalRows(AUDIT);
    expect(sorted(codes(m.gstVat))).toEqual(sorted(rows.map((r) => r.countryCode)));
    expect(m.counts.gstVat.verified).toBe(rows.filter((r) => r.source.verified && r.source.url && r.source.citationDate).length);
    // And never a country that is not in the ledger at all.
    const ledger = new Set(RATE_LEDGER.map((r) => r.countryCode));
    for (const c of codes(m.gstVat)) expect(ledger.has(c)).toBe(true);
  });

  it('incomeTax = INCOME_TAX_SCHEMES', () => {
    expect(sorted(codes(m.incomeTax))).toEqual(sorted(listIncomeTaxCountries()));
    expect(m.counts.incomeTax.verified).toBeLessThanOrEqual(Object.values(INCOME_TAX_SCHEMES).filter((s) => s.verified).length);
  });

  it('companyTax = COMPANY_TAX_RATES, provenance from the set in force', () => {
    expect(sorted(codes(m.companyTax))).toEqual(sorted(listCompanyTaxCountries()));
    for (const e of m.companyTax) {
      const inForce = [...COMPANY_TAX_RATES[e.code]!.rates]
        .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
        .find((r) => r.effectiveFrom <= AUDIT)!;
      expect(e).toMatchObject({ verified: inForce.verified, citationDate: inForce.citationDate, sourceUrl: inForce.source });
    }
  });

  it('cgt = CAPITAL_GAINS_RULES, provenance from the set in force — and never a country that was not researched', () => {
    expect(codes(m.cgt)).toEqual(listCapitalGainsCountries());
    for (const code of CGT_NOT_RESEARCHED) expect(codes(m.cgt)).not.toContain(code);
    for (const e of m.cgt) {
      const r = resolveCapitalGainsRules(e.code, AUDIT)!;
      expect(e).toMatchObject({ verified: r.verified, citationDate: r.set.citationDate, sourceUrl: r.source!.url });
      // Partial coverage says what it is, beside itself.
      expect(e.scope && e.scope.length).toBeTruthy();
    }
    const fi = m.cgt.find((e) => e.code === 'FI')!;
    expect(fi.citationDate).toBe(FI_CAPITAL_INCOME_YEARS.find((y) => y.taxYear === '2026')!.citationDate);
    expect(fi.taxYear).toBe('2026');
    // AU before 1 July 2027 is estimated; Switzerland's cantonal property tax is words only.
    expect(m.cgt.find((e) => e.code === 'AU')!.scope).toMatch(/Estimates shares and property/);
    expect(m.cgt.find((e) => e.code === 'CH')!.scope).toMatch(/Estimates shares;/);
    expect(m.cgt.find((e) => e.code === 'BE')!.scope).toMatch(/Property not verified/);
  });

  it('studentLoan and retirement = their schemes, and are never verified (no dated citation in the data)', () => {
    expect(sorted(codes(m.studentLoan))).toEqual(sorted(Object.values(STUDENT_LOAN_SCHEMES).map((s) => s.countryCode)));
    expect(sorted(codes(m.retirement))).toEqual(sorted(Object.values(RETIREMENT_SCHEMES).map((s) => s.countryCode)));
    expect(m.counts.studentLoan.verified).toBe(0);
    expect(m.counts.retirement.verified).toBe(0);
  });

  it('pins the audited counts as of 2026-10-06', () => {
    // A change here is a real change in what the engine covers — update it
    // together with the data, never on its own.
    expect(m.counts).toEqual({
      gstVat: { countries: 88, verified: 86 },
      incomeTax: { countries: 7, verified: 7 },
      companyTax: { countries: 6, verified: 6 },
      cgt: { countries: 71, verified: 58 },
      studentLoan: { countries: 1, verified: 0 },
      retirement: { countries: 1, verified: 0 },
    });
    expect(codes(m.incomeTax)).toEqual(['AU', 'CA', 'FI', 'GB', 'IN', 'NZ', 'US']);
    expect(codes(m.companyTax)).toEqual(['AU', 'CA', 'FI', 'GB', 'IN', 'US']);
    expect(m.cgt.filter((e) => !e.verified).map((e) => e.code)).toEqual(['BE', 'BG', 'CN', 'CY', 'GR', 'GT', 'HU', 'IL', 'IN', 'JM', 'LT', 'RO', 'RS']);
  });
});

describe('coverage() — verified is a claim about the date asked', () => {
  it('Canada income tax is listed as federal only', () => {
    const ca = coverage(AUDIT).incomeTax.find((e) => e.code === 'CA')!;
    expect(ca).toMatchObject({ verified: true, taxYear: '2026' });
    expect(ca.scope).toMatch(/Federal only/);
    expect(ca.scope).toMatch(/provincial/);
  });

  it('an income-tax year that has run out is still listed, but unverified', () => {
    // FI and CA hold 2026 as their newest year. On 1 January 2027 the engine
    // would go on answering with 2026's scale; the manifest must not call that
    // verified coverage.
    const m = coverage('2027-01-01');
    for (const code of ['FI', 'CA']) {
      expect(m.incomeTax.find((e) => e.code === code)).toMatchObject({ verified: false, taxYear: null });
    }
    // AU has 2027-28 on file already — still covered.
    expect(m.incomeTax.find((e) => e.code === 'AU')).toMatchObject({ verified: true, taxYear: '2026-27' });
  });

  it('GB CGT stops counting as verified when 2027-28 starts with nothing published', () => {
    expect(coverage('2027-04-05').cgt.find((e) => e.code === 'GB')!.verified).toBe(true);
    expect(coverage('2027-04-06').cgt.find((e) => e.code === 'GB')).toMatchObject({ verified: false, citationDate: null });
  });

  it('reads an instant in each country time zone, as calcIncomeTax does', () => {
    // 22:30Z on 31 December: already 1 January 2027 in Helsinki, still 2026 in
    // New York and Toronto. Independent of the host's own time zone.
    const m = coverage(new Date('2026-12-31T22:30:00Z'));
    expect(m.incomeTax.find((e) => e.code === 'FI')).toMatchObject({ verified: false, taxYear: null });
    expect(m.cgt.find((e) => e.code === 'FI')).toMatchObject({ verified: false });
    expect(m.incomeTax.find((e) => e.code === 'US')).toMatchObject({ verified: true, taxYear: '2026' });
    expect(m.incomeTax.find((e) => e.code === 'CA')).toMatchObject({ verified: true, taxYear: '2026' });
    // A day string is that day everywhere: FI is still in 2026 on the 31st.
    expect(coverage('2026-12-31').incomeTax.find((e) => e.code === 'FI')).toMatchObject({ verified: true, taxYear: '2026' });
  });

  it('agrees with the year calcIncomeTax serves right now, for every country', () => {
    for (const e of coverage().incomeTax) {
      if (e.taxYear !== null) expect(e.taxYear).toBe(calcIncomeTax(e.code, 50000)!.taxYear);
    }
  });

  it('a company rate is not annual — an old set in force is still verified coverage', () => {
    expect(coverage('2030-06-30').companyTax.find((e) => e.code === 'AU')!.verified).toBe(true);
  });
});
