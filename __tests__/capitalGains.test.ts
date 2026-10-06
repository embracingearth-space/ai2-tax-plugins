/**
 * Capital gains — the rules for 71 countries, the resolver and the estimator.
 * embracingearth.space
 *
 * Pinned here: every set is cited (https source, citation date, verified flag)
 * and says why when it is not verified; the effective dating (AU's 2027 reform,
 * Sri Lanka's 15% from 3 June 2026); the estimator's arithmetic for each kind of
 * rule; and that it never returns a figure from unverified data.
 */
import {
  CAPITAL_GAINS_RULES,
  CGT_NOT_RESEARCHED,
  listCapitalGainsCountries,
  resolveCapitalGainsRules,
  estimateCapitalGainsTax as estimate,
  calcIncomeTax,
  finnishCapitalGainTax,
  AU_CGT_INDEXATION_FROM,
  AU_CGT_PROVENANCE,
  GB_CGT_ANNUAL_EXEMPT_ROWS,
  GB_CGT_BASIC_RATE_ROWS,
  GB_CGT_HIGHER_RATE_ROWS,
  type CgtRuleSet,
  type CgtTreatment,
  type CapitalGainsInput,
} from '../src';

const AUDIT = '2026-10-06';
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const allSets = (): Array<[string, CgtRuleSet]> => Object.values(CAPITAL_GAINS_RULES).flatMap((c) => c.sets.map((s) => [c.code, s] as [string, CgtRuleSet]));
const treatments = (s: CgtRuleSet): CgtTreatment[] =>
  (['shares', 'property'] as const).flatMap((k) => [s[k].treatment, ...(s[k].holding?.steps.map((x) => x.treatment) ?? [])]);

describe('CGT data — every set is cited', () => {
  it('covers 71 countries, and none of the ones not researched', () => {
    expect(listCapitalGainsCountries()).toHaveLength(71);
    expect(CGT_NOT_RESEARCHED).toEqual(['CR', 'PE', 'TH', 'UY', 'VN']);
    for (const code of CGT_NOT_RESEARCHED) expect(CAPITAL_GAINS_RULES[code]).toBeUndefined();
    for (const [code, c] of Object.entries(CAPITAL_GAINS_RULES)) expect(c.code).toBe(code);
  });

  it('every set has at least one https source, every source a citation date and a verified flag', () => {
    for (const [code, s] of allSets()) {
      expect(s.sources.length).toBeGreaterThan(0);
      for (const src of s.sources) {
        expect(src.url).toMatch(/^https:\/\//);
        expect(src.citationDate).toMatch(YMD);
        expect(typeof src.verified).toBe('boolean');
        expect(src.authority.length).toBeGreaterThan(0);
        expect(src.note.length).toBeGreaterThan(0);
      }
      expect(typeof s.verified).toBe('boolean');
      // A citation date for every set that holds figures; null only for a year with nothing published.
      if (s.citationDate === null) expect({ code, verified: s.verified }).toEqual({ code, verified: false });
      else expect(s.citationDate).toMatch(YMD);
    }
  });

  it('a verified asset rule has an official (verified, https) source behind it — never a Big-4 or PwC page', () => {
    for (const [code, s] of allSets()) {
      for (const k of ['shares', 'property'] as const) {
        if (!s[k].verified) continue;
        expect({ code, k, ok: s.sources.some((x) => x.verified && x.url.startsWith('https://')) }).toEqual({ code, k, ok: true });
      }
      for (const src of s.sources.filter((x) => x.verified)) expect(src.url).not.toMatch(/pwc\.com|kpmg|ey\.com|deloitte|oecd\.org/i);
      expect(s.verified).toBe(s.shares.verified && s.property.verified);
    }
  });

  it('an unverified set says why', () => {
    for (const [code, s] of allSets().filter(([, x]) => !x.verified)) {
      expect({ code, note: (s.verificationNote ?? '').length > 10 }).toEqual({ code, note: true });
    }
  });

  it('the eight countries with no official source at all are unverified', () => {
    for (const code of ['BG', 'CN', 'CY', 'GR', 'GT', 'IL', 'LT', 'RS']) {
      for (const s of CAPITAL_GAINS_RULES[code]!.sets) {
        expect(s.verified).toBe(false);
        expect(s.sources.every((x) => !x.verified)).toBe(true);
      }
    }
  });

  it('sets run newest first with distinct start dates; a start the research did not record is the citation date', () => {
    for (const c of Object.values(CAPITAL_GAINS_RULES)) {
      const starts = c.sets.map((s) => s.effectiveFrom);
      expect(starts).toEqual([...starts].sort().reverse());
      expect(new Set(starts).size).toBe(starts.length);
      for (const s of c.sets) {
        expect(s.effectiveFrom).toMatch(YMD);
        if (!s.startRecorded) {
          expect(s.effectiveFrom).toBe(s.citationDate);
          expect(s.startNote).toMatch(/did not record/);
        }
      }
    }
  });

  it('rules are well formed: rates are fractions, bands ascend, holding steps start at 0 and ascend', () => {
    for (const [code, s] of allSets()) {
      for (const t of treatments(s)) {
        if (t.kind === 'flat' || t.kind === 'proceeds') expect(t.rate).toBeGreaterThanOrEqual(0);
        if (t.kind === 'flat' || t.kind === 'proceeds') expect(t.rate).toBeLessThan(1);
        if (t.kind === 'flat' && t.inclusion !== undefined) expect(t.inclusion).toBeGreaterThan(0);
        if (t.kind === 'income') expect(t.inclusion > 0 && t.inclusion <= 1).toBe(true);
        if (t.kind === 'bands') {
          const ups = t.bands.map((b) => b.upTo);
          expect(ups[ups.length - 1]).toBeNull();
          const nums = ups.slice(0, -1) as number[];
          expect(nums).toEqual([...nums].sort((a, b) => a - b));
        }
      }
      for (const k of ['shares', 'property'] as const) {
        const h = s[k].holding;
        if (!h) continue;
        expect({ code, k, first: h.steps[0]!.from }).toEqual({ code, k, first: 0 });
        expect(s[k].treatment).toEqual(h.steps[0]!.treatment);
        const froms = h.steps.map((x) => x.from);
        expect(froms).toEqual([...froms].sort((a, b) => a - b));
      }
    }
  });
});

describe('CGT data — one copy of each figure (AU, GB, FI are derived)', () => {
  it('AU takes its provenance and its 2027 date from the AU-IT plugin', () => {
    const au = CAPITAL_GAINS_RULES.AU!;
    expect(au.sets.map((s) => s.effectiveFrom)).toEqual([AU_CGT_INDEXATION_FROM, '1999-09-21']);
    for (const s of au.sets) expect(s).toMatchObject({ citationDate: AU_CGT_PROVENANCE.citationDate, verified: AU_CGT_PROVENANCE.verified });
    expect(au.sets[1]!.shares.holding!.steps[1]!.treatment).toEqual({ kind: 'income', inclusion: 0.5 });
  });

  it('GB takes its rates and annual exempt amount from the watched GB CGT rows', () => {
    const r = resolveCapitalGainsRules('GB', '2026-06-01')!;
    const value = (rows: typeof GB_CGT_BASIC_RATE_ROWS) => rows.find((x) => x.effectiveFrom <= '2026-06-01' && x.verified)!.value!;
    expect(r.set.shares.treatment).toEqual({
      kind: 'bands', base: 'taxableIncome',
      bands: [{ upTo: 37700, rate: value(GB_CGT_BASIC_RATE_ROWS) / 100 }, { upTo: null, rate: value(GB_CGT_HIGHER_RATE_ROWS) / 100 }],
    });
    expect(r.set.shares.exemption!.amount).toBe(value(GB_CGT_ANNUAL_EXEMPT_ROWS));
    // 2027-28 is not published in the rows, so it is not here either.
    expect(resolveCapitalGainsRules('GB', '2027-04-06')).toMatchObject({ verified: false, set: { citationDate: null } });
  });
});

describe('resolveCapitalGainsRules — effective dating', () => {
  it('AU: the 50% discount before 1 July 2027, indexation and the minimum tax from it', () => {
    expect(resolveCapitalGainsRules('AU', '2027-06-30')!.set.effectiveFrom).toBe('1999-09-21');
    const after = resolveCapitalGainsRules('AU', '2027-07-01')!.set;
    expect(after.effectiveFrom).toBe('2027-07-01');
    expect(after.shares.rule).toMatch(/indexed for inflation/);
    expect(after.shares.rule).toMatch(/30% minimum tax/);
  });

  it('LK: 10% until 2 June 2026, 15% from 3 June 2026', () => {
    expect(resolveCapitalGainsRules('LK', '2026-06-02')!.set.property.treatment).toEqual({ kind: 'flat', rate: 0.1 });
    expect(resolveCapitalGainsRules('LK', '2026-06-03')!.set.property.treatment).toEqual({ kind: 'flat', rate: 0.15 });
    expect(resolveCapitalGainsRules('LK', '2018-03-31')).toBeNull();
  });

  it('no set before the first one — never the oldest set as a fallback', () => {
    // Japan's start was not recorded, so its set begins on the citation date.
    expect(resolveCapitalGainsRules('JP', '2026-10-05')).toBeNull();
    expect(resolveCapitalGainsRules('JP', AUDIT)!.verified).toBe(true);
    expect(resolveCapitalGainsRules('ZZ', AUDIT)).toBeNull();
  });

  it('a yearly country stops being verified when its year runs out (US 2026 thresholds)', () => {
    expect(resolveCapitalGainsRules('US', '2026-12-31')).toMatchObject({ verified: true, yearCovered: true });
    expect(resolveCapitalGainsRules('US', '2027-01-01')).toMatchObject({ verified: false, yearCovered: false });
  });

  it('reads a Date in the country time zone (FI rolls into 2027 first)', () => {
    const at = new Date('2026-12-31T22:30:00Z');
    expect(resolveCapitalGainsRules('FI', at)).toMatchObject({ day: '2027-01-01', verified: false });
    expect(resolveCapitalGainsRules('FI', '2026-12-31')).toMatchObject({ verified: true });
  });

  it('GR: property CGT suspended in 2026; an unverified reminder set from 2027', () => {
    expect(resolveCapitalGainsRules('GR', AUDIT)!.set.property.treatment).toEqual({ kind: 'exempt' });
    const next = resolveCapitalGainsRules('GR', '2027-01-01')!;
    expect(next.set.property.treatment).toEqual({ kind: 'flat', rate: 0.15 });
    expect(next.verified).toBe(false);
  });
});

describe('estimateCapitalGainsTax — arithmetic', () => {
  const base = { proceeds: 50000, costBase: 30000 };

  it('AU: losses first, then the 50% discount, taxed at the marginal rate (the Worker cgt_estimate rule)', () => {
    const r = estimate({ country: 'AU', asset: 'shares', ...base, capitalLosses: 4000, acquiredOn: '2024-01-10', disposedOn: '2026-03-01', otherIncome: 90000 });
    expect(r).toMatchObject({ status: 'computed', verified: true, gain: 20000, lossesApplied: 4000, taxBase: 8000, taxYear: '2025-26' });
    expect(r.tax).toBe(calcIncomeTax('AU', 98000, '2025-26')!.totalTax - calcIncomeTax('AU', 90000, '2025-26')!.totalTax);
    expect(r.step).toMatch(/50% CGT discount/);
  });

  it('AU: the 12-month test excludes the day of acquisition and of the sale', () => {
    const at = (disposedOn: string) => estimate({ country: 'AU', asset: 'shares', ...base, acquiredOn: '2025-07-01', disposedOn, otherIncome: 90000 }).taxBase;
    expect(at('2026-07-01')).toBe(20000);
    expect(at('2026-07-02')).toBe(10000);
    // Whole months, when the dates are not known.
    expect(estimate({ country: 'AU', asset: 'shares', ...base, holdingMonths: 12, disposedOn: '2026-07-02', otherIncome: 90000 }).taxBase).toBe(10000);
  });

  it('AU from 1 July 2027: the rule in words, no figure', () => {
    const r = estimate({ country: 'AU', asset: 'property', ...base, acquiredOn: '2020-01-01', disposedOn: '2027-07-01', otherIncome: 90000 });
    expect(r).toMatchObject({ status: 'rule-only', verified: true, tax: null });
    expect(r.reason).toMatch(/CPI/);
  });

  it('GB: the annual exempt amount, then 18% inside the unused basic rate band and 24% above', () => {
    // £40,000 salary → £27,430 taxable; £17,000 chargeable: £10,270 at 18% + £6,730 at 24%.
    const r = estimate({ country: 'GB', asset: 'shares', ...base, disposedOn: '2026-06-01', otherIncome: 40000 });
    expect(r).toMatchObject({ status: 'computed', exemptionApplied: 3000, taxBase: 17000, tax: 3463.8, taxYear: '2026-27' });
  });

  it('US: short-term at ordinary rates without FICA; long-term 0/15/20 stacked on taxable income', () => {
    const lt = estimate({ country: 'US', asset: 'shares', proceeds: 150000, costBase: 50000, acquiredOn: '2020-01-01', disposedOn: '2026-06-01', otherIncome: 60000 });
    const taxable = calcIncomeTax('US', 60000, '2026')!.taxable;
    expect(lt.tax).toBe((49450 - taxable) * 0 + (100000 - (49450 - taxable)) * 0.15);
    const st = estimate({ country: 'US', asset: 'shares', proceeds: 150000, costBase: 50000, acquiredOn: '2026-01-01', disposedOn: '2026-06-01', otherIncome: 60000 });
    expect(st.tax).toBe(calcIncomeTax('US', 160000, '2026')!.incomeTax - calcIncomeTax('US', 60000, '2026')!.incomeTax);
    expect(st.assumptions.join(' ')).toMatch(/Leaves out Social Security/);
    // One year exactly is still short-term ("more than one year").
    expect(estimate({ country: 'US', asset: 'shares', ...base, acquiredOn: '2025-06-01', disposedOn: '2026-06-01', otherIncome: 60000 }).step).toMatch(/one year or less/);
  });

  it('CA: half the gain at the federal marginal rate; a home flipped within 365 days is fully taxed', () => {
    const r = estimate({ country: 'CA', asset: 'shares', proceeds: 150000, costBase: 50000, disposedOn: '2026-06-01', otherIncome: 60000 });
    expect(r).toMatchObject({ status: 'computed', taxBase: 50000, tax: 50000 * 0.205 });
    expect(r.assumptions.join(' ')).toMatch(/provincial/);
    const flip = estimate({ country: 'CA', asset: 'property', ...base, acquiredOn: '2026-01-01', disposedOn: '2026-12-30', otherIncome: 60000 });
    expect(flip).toMatchObject({ taxBase: 20000, step: expect.stringMatching(/flipping/) });
  });

  it('flat rates, with an allowance (DE, IE) or a share of the gain (SE)', () => {
    expect(estimate({ country: 'DE', asset: 'shares', ...base, disposedOn: AUDIT }).tax).toBe(5011.25); // (20,000 − 1,000) × 26.375%
    expect(estimate({ country: 'IE', asset: 'shares', ...base, disposedOn: AUDIT }).tax).toBe(6180.9); // (20,000 − 1,270) × 33%
    expect(estimate({ country: 'SE', asset: 'property', ...base, disposedOn: AUDIT }).tax).toBe(4400); // 20,000 × 22/30 × 30%
  });

  it('a schedule of its own, stacked on the year\'s income in it (ES savings base)', () => {
    expect(estimate({ country: 'ES', asset: 'shares', proceeds: 80000, costBase: 20000, disposedOn: AUDIT }).tax).toBe(1140 + 9240 + 2300);
    expect(estimate({ country: 'ES', asset: 'shares', proceeds: 80000, costBase: 20000, disposedOn: AUDIT, otherCategoryIncome: 50000 }).tax).toBe(60000 * 0.23);
  });

  it('a rate that falls with years held (MY RPGT, with its RM10,000-or-10% exemption)', () => {
    const at = (acquiredOn: string) => estimate({ country: 'MY', asset: 'property', proceeds: 800000, costBase: 500000, acquiredOn, disposedOn: '2026-06-03' });
    expect(at('2022-05-01')).toMatchObject({ exemptionApplied: 30000, tax: 270000 * 0.15 });
    expect(at('2024-05-01').tax).toBe(270000 * 0.3);
    expect(at('2020-05-01').tax).toBe(0);
  });

  it('a share of the gain taxed by calendar years since acquisition (HU property)', () => {
    const at = (acquiredOn: string) => estimate({ country: 'HU', asset: 'property', proceeds: 80e6, costBase: 50e6, acquiredOn, disposedOn: '2026-10-07' }).tax;
    expect(at('2025-12-31')).toBe(30e6 * 0.15);
    expect(at('2024-01-01')).toBe(30e6 * 0.9 * 0.15);
    expect(at('2021-12-31')).toBe(0);
  });

  it('JP land: long-term only if held more than 5 years on 1 January of the year of sale', () => {
    const at = (acquiredOn: string) => estimate({ country: 'JP', asset: 'property', proceeds: 8e7, costBase: 5e7, acquiredOn, disposedOn: '2026-11-01' }).tax;
    expect(at('2021-05-01')).toBe(3e7 * 0.3963);
    expect(at('2020-12-31')).toBe(3e7 * 0.20315);
  });

  it('a tax on the sale price, whatever the gain (PH, ID)', () => {
    expect(estimate({ country: 'PH', asset: 'property', proceeds: 5e6, costBase: 6e6, disposedOn: AUDIT })).toMatchObject({ tax: 300000, taxBase: 5e6, loss: 1e6 });
    expect(estimate({ country: 'ID', asset: 'shares', proceeds: 1e8, costBase: 9e7, disposedOn: AUDIT }).tax).toBe(100000);
  });

  it('cliffs: BR shares under R$20,000 sold in the month, LK gains of Rs 50,000 or less', () => {
    expect(estimate({ country: 'BR', asset: 'shares', proceeds: 20000, costBase: 5000, disposedOn: AUDIT }).tax).toBe(0);
    expect(estimate({ country: 'BR', asset: 'shares', proceeds: 20001, costBase: 5000, disposedOn: AUDIT }).tax).toBe(15001 * 0.15);
    expect(estimate({ country: 'LK', asset: 'property', proceeds: 1050000, costBase: 1e6, disposedOn: AUDIT }).tax).toBe(0);
    expect(estimate({ country: 'LK', asset: 'property', proceeds: 5e6, costBase: 3e6, disposedOn: '2026-06-02' }).tax).toBe(200000);
    expect(estimate({ country: 'LK', asset: 'property', proceeds: 5e6, costBase: 3e6, disposedOn: '2026-06-03' }).tax).toBe(300000);
  });

  it('exempt regimes compute 0, verified', () => {
    for (const country of ['AE', 'SG', 'HK', 'QA', 'NL']) {
      expect(estimate({ country, asset: 'shares', ...base, disposedOn: AUDIT })).toMatchObject({ status: 'computed', tax: 0, verified: true });
    }
  });

  it('FI goes through finnishCapitalGainTax', () => {
    const r = estimate({ country: 'FI', asset: 'shares', ...base, disposedOn: '2026-06-03', otherCategoryIncome: 25000 });
    const fi = finnishCapitalGainTax({ proceeds: 50000, acquisitionCost: 30000, capitalLosses: 0, otherCapitalIncome: 25000, taxYear: '2026' })!;
    expect(r).toMatchObject({ status: 'computed', tax: fi.tax, taxYear: '2026', taxBase: fi.taxableGain });
  });

  it('NZ: a home sold within the 2-year bright-line period is taxed as income; after it, not', () => {
    const at = (acquiredOn: string) => estimate({ country: 'NZ', asset: 'property', proceeds: 900000, costBase: 800000, acquiredOn, disposedOn: '2026-06-03', otherIncome: 80000 });
    expect(at('2025-05-01').tax).toBe(100000 * 0.33);
    expect(at('2024-05-01').tax).toBe(0);
  });
});

describe('estimateCapitalGainsTax — no figure from unverified or unencoded data', () => {
  const base = { proceeds: 50000, costBase: 30000, disposedOn: AUDIT };

  it('an unverified rule gives the rule and its source, never a figure', () => {
    for (const country of ['BG', 'CN', 'CY', 'GT', 'IL', 'JM', 'RS']) {
      const r = estimate({ country, asset: 'property', ...base, acquiredOn: '2025-01-01' });
      expect(r).toMatchObject({ status: 'rule-only', verified: false, tax: null });
      expect(r.reason).toMatch(/not verified/);
      expect(r.source).not.toBeNull();
      expect(r.rule!.rule.length).toBeGreaterThan(0);
    }
    // Partly verified: Belgian shares are law, Belgian property is not.
    expect(estimate({ country: 'BE', asset: 'property', ...base, acquiredOn: '2025-01-01' })).toMatchObject({ status: 'rule-only', verified: false });
  });

  it('a verified rule that is not modelled gives the reason (cantonal tax, unmodelled abatement)', () => {
    expect(estimate({ country: 'CH', asset: 'property', ...base })).toMatchObject({ status: 'rule-only', verified: true, reason: expect.stringMatching(/canton/) });
    expect(estimate({ country: 'FR', asset: 'property', ...base })).toMatchObject({ status: 'rule-only', verified: true });
    expect(estimate({ country: 'HR', asset: 'shares', ...base })).toMatchObject({ status: 'rule-only', reason: expect.stringMatching(/unofficial/) });
  });

  it('a gain taxed as income where the engine has no income tax for the country: the rule only', () => {
    const r = estimate({ country: 'ZA', asset: 'shares', ...base, otherIncome: 100000 });
    expect(r).toMatchObject({ status: 'rule-only', verified: true, tax: null });
    expect(r.reason).toMatch(/no verified South Africa income-tax year/);
  });

  it('asks for what it needs', () => {
    expect(estimate({ country: 'US', asset: 'shares', ...base, disposedOn: '2026-06-01', otherIncome: 1 })).toMatchObject({ status: 'needs-input', reason: expect.stringMatching(/acquiredOn/) });
    expect(estimate({ country: 'CA', asset: 'shares', ...base, disposedOn: '2026-06-01' })).toMatchObject({ status: 'needs-input', reason: expect.stringMatching(/otherIncome/) });
    expect(estimate({ country: 'JP', asset: 'property', ...base, holdingMonths: 80 })).toMatchObject({ status: 'needs-input', reason: expect.stringMatching(/^acquiredOn is needed/) });
  });

  it('not covered: an unresearched country, or a date before the first set', () => {
    expect(estimate({ country: 'TH', asset: 'shares', ...base })).toMatchObject({ status: 'not-covered', reason: expect.stringMatching(/not yet researched/) });
    expect(estimate({ country: 'JP', asset: 'shares', ...base, disposedOn: '2026-01-15' })).toMatchObject({ status: 'not-covered', reason: expect.stringMatching(/earliest set starts 2026-10-06/) });
  });

  it('an asset bought before a rule\'s cut-off gets the rule, not the new rate (PK, TW)', () => {
    expect(estimate({ country: 'PK', asset: 'shares', ...base, acquiredOn: '2024-06-30' })).toMatchObject({ status: 'rule-only', reason: expect.stringMatching(/before 2024-07-01/) });
    expect(estimate({ country: 'PK', asset: 'shares', ...base, acquiredOn: '2024-07-01' }).tax).toBe(3000);
  });

  it('rejects inputs that cannot describe a sale', () => {
    const bad: Array<Partial<CapitalGainsInput>> = [
      { proceeds: -1 }, { costBase: Number.NaN }, { capitalLosses: -5 }, { disposedOn: '2026-02-30' }, { acquiredOn: '2027-01-01' },
    ];
    for (const b of bad) expect(() => estimate({ country: 'DE', asset: 'shares', ...base, ...b } as CapitalGainsInput)).toThrow(RangeError);
    expect(() => estimate({ country: 'DE', asset: 'cars' as never, ...base })).toThrow(RangeError);
  });
});

describe('registry is immutable to consumers', () => {
  it('deep-freezes the sets the resolver hands out', () => {
    const r = resolveCapitalGainsRules('AU', '2026-01-01')!;
    expect(Object.isFrozen(r.set)).toBe(true);
    expect(Object.isFrozen(r.set.shares)).toBe(true);
    for (const c of Object.values(CAPITAL_GAINS_RULES)) expect(Object.isFrozen(c.sets)).toBe(true);
  });
});

describe('asOf validation', () => {
  it('rejects a malformed day string instead of mis-ordering it', () => {
    expect(() => resolveCapitalGainsRules('AU', '2026-1-1')).toThrow(RangeError);
    expect(resolveCapitalGainsRules('AU', '2026-01-01T09:00:00Z')).not.toBeNull();
  });
});
