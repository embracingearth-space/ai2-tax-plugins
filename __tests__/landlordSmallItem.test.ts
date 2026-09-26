/**
 * Landlord small-item rules — `landlordSmallItemDeduction(onDate)` — @ai2/tax-plugins
 * ai2fin.com
 *
 * The business instant write-off is for businesses. A landlord who is not
 * carrying on a business is governed by a different rule in every country
 * here, and the host (the core app's `deductNowDecision`) feature-detects this
 * method and acts ONLY on `verified: true` with a non-null `limit`. So each
 * country is tested on three things: the verified figure on a date inside the
 * year, which side of the limit qualifies, and the honest unverified answer —
 * for a date before the rule, or for a country where the authority's answer
 * is "there is no per-item rule".
 */

import {
  AU_DEPRECIATION_RULES,
  AU_LANDLORD_SMALL_ITEM_ROWS,
  AU_LOW_VALUE_POOL_RATES,
  auLandlordSmallItemDeduction,
  NZ_DEPRECIATION_RULES,
  NZ_LANDLORD_SMALL_ITEM_ROWS,
  NZ_LOW_VALUE_ASSET_ROWS,
  nzLandlordSmallItemDeduction,
  US_DEPRECIATION_RULES,
  US_LANDLORD_SMALL_ITEM_ROWS,
  usDeMinimis,
  UK_DEPRECIATION_RULES,
  UK_LANDLORD_SMALL_ITEM_ROWS,
  CA_DEPRECIATION_RULES,
  IN_DEPRECIATION_RULES,
  SG_DEPRECIATION_RULES,
  ZA_DEPRECIATION_RULES,
  ZA_LESSOR_SMALL_ITEM_EXCLUDED_FROM,
  zaLandlordSmallItemDeduction,
  GENERIC_DEPRECIATION_RULES,
  sortNewestFirst,
  resolveEffectiveDated,
  type DepreciationRules,
  type LandlordSmallItemInfo,
} from '../src';

/**
 * The host's gate, restated: a rule the host may act on is verified AND has a
 * limit. Anything else defaults nothing (the note is for the host to display). Mirrors
 * `landlordSmallItemRule` in the core app's client/src/utils/depreciation.ts.
 */
function hostActsOn(info: LandlordSmallItemInfo | undefined): boolean {
  return !!info && info.verified && info.limit != null;
}

/** The host's comparison, restated, for a rule it acts on. */
function qualifies(info: LandlordSmallItemInfo, cost: number): boolean {
  const boundary = info.boundary ?? 'up_to';
  return boundary === 'up_to' ? cost <= (info.limit as number) : cost < (info.limit as number);
}

/** A threshold printed in a currency — what an unverified note must never carry. */
const CURRENCY_FIGURE = /[$£₹]\s?\d|\bR\s?\d|\bS\$\s?\d|\d\s?%/;

function landlord(rules: DepreciationRules, onDate: Date | string): LandlordSmallItemInfo {
  expect(typeof rules.landlordSmallItemDeduction).toBe('function');
  return rules.landlordSmallItemDeduction!(onDate);
}

// ─── AU ─────────────────────────────────────────────────────────────────────

describe('AU landlord note: when it is claimed, and the pool', () => {
  // s 40-80(2): the deduction falls in the income year the item is first used
  // or installed ready for use, not the year it is bought; and an item that
  // qualifies for it cannot be allocated to a low-value pool.
  it('names the year of first use, not the year of purchase', () => {
    const { AU_LANDLORD_SMALL_ITEM_ROWS } = require('../src/countries/australiaDepreciation');
    const row = AU_LANDLORD_SMALL_ITEM_ROWS.find((r: any) => r.limit === 300);
    expect(row.note).toMatch(/first use it, or install it ready for use/);
    expect(row.note).toMatch(/not the year you buy it/);
  });

  it('says a qualifying item cannot be pooled', () => {
    const { AU_LANDLORD_SMALL_ITEM_ROWS } = require('../src/countries/australiaDepreciation');
    const row = AU_LANDLORD_SMALL_ITEM_ROWS.find((r: any) => r.limit === 300);
    expect(row.pool.note).toMatch(/an item that does qualify cannot be pooled/);
  });
});

describe('AU landlord — $300 or less deducted in full (s 40-80(2)), under $1,000 poolable', () => {
  const au = AU_DEPRECIATION_RULES;

  it.each([
    ['2025-07-01', '2025-26 starts'],
    ['2026-06-30', '2025-26 ends'],
    ['2026-09-26', 'mid 2026-27'],
    ['2010-01-15', 'mid 2009-10'],
  ])('%s (%s) is $300, verified, inclusive', (date) => {
    const r = landlord(au, new Date(date));
    expect(r.limit).toBe(300);
    expect(r.verified).toBe(true);
    // "$300 or less" — exactly $300 qualifies.
    expect(r.boundary).toBe('up_to');
  });

  it('the boundary: $300 is deducted now, $300.01 is not', () => {
    const r = landlord(au, new Date('2026-09-26'));
    expect(qualifies(r, 300)).toBe(true);
    expect(qualifies(r, 300.01)).toBe(false);
  });

  it('the note carries the three s 40-80(2) conditions and says the business write-off does not apply', () => {
    const { note } = landlord(au, new Date('2026-09-26'));
    expect(note).toContain('$300 or less');
    expect(note).toContain('not from carrying on a business');
    expect(note).toContain('part of a set');
    expect(note).toContain('identical or substantially identical');
    expect(note).toContain('instant asset write-off is for small businesses');
  });

  it('the pool: less than $1,000 (strict), 18.75% then 37.5%, and the once-allocated rule', () => {
    const { pool } = landlord(au, new Date('2026-09-26'));
    expect(pool).toBeDefined();
    expect(pool!.limit).toBe(1000);
    expect(pool!.verified).toBe(true);
    // "cost less than $1,000" — exactly $1,000 cannot be pooled.
    expect(pool!.boundary).toBe('under');
    expect(pool!.note).toContain('18.75%');
    expect(pool!.note).toContain('37.5%');
    expect(pool!.note).toContain('every later low-cost asset');
    expect(AU_LOW_VALUE_POOL_RATES).toEqual({ allocationYear: 0.1875, ongoing: 0.375 });
  });

  it('is NOT the business write-off: a $900 item is deducted now by a business, pooled by a landlord', () => {
    const onDate = new Date('2026-09-26');
    const business = au.instantAssetWriteOff(onDate);
    const rental = landlord(au, onDate);
    expect(business.limit).not.toBe(rental.limit);
    expect(qualifies(rental, 900)).toBe(false);
    expect(900 < (rental.pool!.limit as number)).toBe(true);
  });

  it('before Div 40 (1 July 2001) is unverified, with no limit, boundary, pool or figure', () => {
    const r = landlord(au, new Date('1999-03-01'));
    expect(r.limit).toBeNull();
    expect(r.verified).toBe(false);
    expect(r.boundary).toBeUndefined();
    expect(r.pool).toBeUndefined();
    expect(r.note).not.toMatch(CURRENCY_FIGURE);
    expect(hostActsOn(r)).toBe(false);
  });

  it('the rules object and the exported function agree; order is derived, not trusted', () => {
    const d = new Date('2026-09-26');
    expect(au.landlordSmallItemDeduction!(d)).toEqual(auLandlordSmallItemDeduction(d));
    const ordered = sortNewestFirst([...AU_LANDLORD_SMALL_ITEM_ROWS].reverse());
    expect(resolveEffectiveDated(ordered, '2026-09-26').limit).toBe(300);
    expect(resolveEffectiveDated(ordered, '2001-06-30').limit).toBeNull();
  });

  it('keys a Date by its LOCAL calendar day, like the write-off resolver', () => {
    // 1 July 2001 00:30 local is inside the row even where UTC is still 30 June.
    expect(auLandlordSmallItemDeduction(new Date(2001, 6, 1, 0, 30)).limit).toBe(300);
    expect(auLandlordSmallItemDeduction(new Date(2001, 5, 30, 23, 30)).limit).toBeNull();
  });
});

// ─── NZ ─────────────────────────────────────────────────────────────────────

describe('NZ landlord — the same s EE 38 threshold, named for rental income (IR264)', () => {
  const nz = NZ_DEPRECIATION_RULES;

  it('$1,000 from 17 March 2021, verified, inclusive', () => {
    const r = landlord(nz, new Date('2026-09-26'));
    expect(r).toMatchObject({ limit: 1000, verified: true, boundary: 'up_to' });
    expect(qualifies(r, 1000)).toBe(true);
    expect(qualifies(r, 1000.01)).toBe(false);
    expect(r.note).toContain('rental');
    expect(r.note).toContain('IR264');
  });

  it('the temporary $5,000 window and the earlier $500, both inclusive', () => {
    expect(nzLandlordSmallItemDeduction('2020-03-17')).toMatchObject({ limit: 5000, verified: true, boundary: 'up_to' });
    expect(nzLandlordSmallItemDeduction('2021-03-16')).toMatchObject({ limit: 5000 });
    expect(nzLandlordSmallItemDeduction('2020-03-16')).toMatchObject({ limit: 500, verified: true, boundary: 'up_to' });
  });

  it('the figures ARE the business figures — derived, so they cannot drift apart', () => {
    for (const d of ['2015-01-01', '2020-06-01', '2026-09-26']) {
      expect(nzLandlordSmallItemDeduction(d).limit).toBe(nz.instantAssetWriteOff(new Date(d)).limit);
    }
    expect(NZ_LANDLORD_SMALL_ITEM_ROWS.map((r) => r.limit)).toEqual(NZ_LOW_VALUE_ASSET_ROWS.map((r) => r.limit));
  });

  it('carries no pool — NZ asset pooling is not a per-item landlord rule', () => {
    expect(landlord(nz, new Date('2026-09-26')).pool).toBeUndefined();
  });
});

// ─── US ─────────────────────────────────────────────────────────────────────

describe('US landlord — the de minimis safe harbor election for a rental activity', () => {
  const us = US_DEPRECIATION_RULES;

  it.each(['2016-01-01', '2025-06-01', '2026-09-26'])('%s is $2,500, verified, inclusive', (date) => {
    const r = landlord(us, new Date(date));
    expect(r).toMatchObject({ limit: 2500, verified: true, boundary: 'up_to' });
  });

  it('the boundary: "up to $2,500" — exactly $2,500 qualifies', () => {
    const r = landlord(us, new Date('2026-09-26'));
    expect(qualifies(r, 2500)).toBe(true);
    expect(qualifies(r, 2500.01)).toBe(false);
  });

  it('the note says it is an annual election covering every qualifying amount, on Schedule E', () => {
    const { note } = landlord(us, new Date('2026-09-26'));
    expect(note).toContain('annual election');
    expect(note).toContain('timely filed return');
    expect(note).toContain('every qualifying amount');
    expect(note).toContain('Schedule E');
  });

  it('agrees with usDeMinimis(false) — one figure, not two', () => {
    expect(landlord(us, new Date('2026-09-26')).limit).toBe(usDeMinimis(false).limit);
  });

  it('a tax year before 2016 is unverified, with no figure', () => {
    const r = landlord(us, new Date('2014-06-01'));
    expect(r.limit).toBeNull();
    expect(r.verified).toBe(false);
    expect(r.boundary).toBeUndefined();
    expect(r.note).not.toMatch(CURRENCY_FIGURE);
    const ordered = sortNewestFirst([...US_LANDLORD_SMALL_ITEM_ROWS].reverse());
    expect(resolveEffectiveDated(ordered, '2015-12-31').limit).toBeNull();
  });
});

// ─── The "no per-item rule" countries ───────────────────────────────────────

describe('GB landlord — no small-item deduction; replacement of domestic items relief only', () => {
  const uk = UK_DEPRECIATION_RULES;

  it('is published, unverified, with no limit — never { limit: 0 }, which a host would read as "over the limit"', () => {
    const r = landlord(uk, new Date('2026-09-26'));
    expect(r.limit).toBeNull();
    expect(r.verified).toBe(false);
    expect(r.boundary).toBeUndefined();
    expect(hostActsOn(r)).toBe(false);
  });

  it('the note states the rule: first purchase not deductible, replacement deductible, the fact not yet asked', () => {
    const { note } = landlord(uk, new Date('2026-09-26'));
    expect(note).toContain('no small-item deduction');
    expect(note).toContain('first time is not deductible');
    expect(note).toContain('REPLACING');
    expect(note).toContain('replacement of domestic items relief');
    expect(note).toContain('does not yet ask whether an item is a replacement');
    expect(note).not.toMatch(CURRENCY_FIGURE);
  });

  it('before 6 April 2016 is a different, "not recorded" note', () => {
    const r = landlord(uk, new Date('2015-06-01'));
    expect(r.verified).toBe(false);
    expect(r.limit).toBeNull();
    expect(r.note).toContain('before 6 April 2016');
    expect(resolveEffectiveDated(sortNewestFirst(UK_LANDLORD_SMALL_ITEM_ROWS), '2016-04-06').note).toContain(
      'REPLACING',
    );
  });

  it('the business AIA is untouched — it still answers for a business', () => {
    expect(uk.instantAssetWriteOff(new Date(2026, 6, 1))).toMatchObject({ limit: 1_000_000, verified: true });
  });
});

describe('CA landlord — no general small-item rule; Class 12 is a category, not a threshold', () => {
  const ca = CA_DEPRECIATION_RULES;

  it('is unverified with no limit, so a $400 chair is never deducted on cost alone', () => {
    const r = landlord(ca, new Date('2026-09-26'));
    expect(r.limit).toBeNull();
    expect(r.verified).toBe(false);
    expect(hostActsOn(r)).toBe(false);
  });

  it('the note names Class 8 for furniture, Class 12 as a category, and the rental-loss rule, without a figure', () => {
    const { note } = landlord(ca, new Date('2026-09-26'));
    expect(note).toContain('Class 8');
    expect(note).toContain('Class 12');
    expect(note).toContain('cannot create or increase a rental loss');
    expect(note).not.toMatch(CURRENCY_FIGURE);
  });
});

describe('IN landlord — house property takes a flat standard deduction, nothing item by item', () => {
  const ind = IN_DEPRECIATION_RULES;

  it('is unverified with no limit, and the note carries no rate (the authority page was not readable)', () => {
    const r = landlord(ind, new Date('2026-09-26'));
    expect(r.limit).toBeNull();
    expect(r.verified).toBe(false);
    expect(hostActsOn(r)).toBe(false);
    expect(r.note).toContain('income from house property');
    expect(r.note).toContain('standard deduction');
    expect(r.note).toContain('not deducted or depreciated item by item');
    expect(r.note).not.toMatch(CURRENCY_FIGURE);
  });
});

describe('SG landlord — passive rental income claims no capital allowances', () => {
  const sg = SG_DEPRECIATION_RULES;

  it('does NOT reuse the s.19A(10A) business figure', () => {
    const onDate = new Date('2026-01-15');
    expect(sg.instantAssetWriteOff(onDate)).toMatchObject({ limit: 5000, verified: true });
    const r = landlord(sg, onDate);
    expect(r.limit).toBeNull();
    expect(r.verified).toBe(false);
    expect(hostActsOn(r)).toBe(false);
  });

  it('the note states the rule without a figure', () => {
    const { note } = landlord(sg, new Date('2026-01-15'));
    expect(note).toContain('not for passive rental income');
    expect(note).toContain('initial purchase and depreciation of furniture and fittings are not deductible');
    expect(note).not.toMatch(CURRENCY_FIGURE);
  });
});

describe('ZA landlord — IN47: no small-item write-off for lessors from 11 November 2009', () => {
  const za = ZA_DEPRECIATION_RULES;

  it('does NOT reuse the R7,000 business figure', () => {
    const onDate = new Date('2026-06-01');
    expect(za.instantAssetWriteOff(onDate)).toMatchObject({ limit: 7000, verified: true });
    const r = landlord(za, onDate);
    expect(r.limit).toBeNull();
    expect(r.verified).toBe(false);
    expect(hostActsOn(r)).toBe(false);
  });

  it('the note cites the lessor exclusion and the wear-and-tear route, without a figure', () => {
    const { note } = landlord(za, new Date('2026-06-01'));
    expect(note).toContain('does not apply to assets a lessor acquires for the purpose of letting');
    expect(note).toContain('Interpretation Note 47');
    expect(note).toContain('wear-and-tear allowance');
    expect(note).not.toMatch(CURRENCY_FIGURE);
  });

  // IN47 (Issue 5) footnote 33: the exclusion "applies to any asset acquired on
  // or after" 11 November 2009; before that, lessors were not prevented from
  // claiming the R7,000 write-off.
  it('the lessor exclusion starts on 11 November 2009, inclusive', () => {
    expect(ZA_LESSOR_SMALL_ITEM_EXCLUDED_FROM).toBe('2009-11-11');
    const r = landlord(za, '2009-11-11');
    expect(r).toMatchObject({ limit: null, verified: false });
    expect(hostActsOn(r)).toBe(false);
  });

  // Between 1 March and 10 November 2009 the figure existed for a lessor, but
  // only in a year of assessment that began on or after 1 January 2009 — and the
  // method is given the acquisition date alone. So it answers "confirm it":
  // unverified, no figure, the condition in words. (CodeRabbit on #50.)
  it('1 March to 10 November 2009: unverified, because it turns on the year-of-assessment start', () => {
    for (const onDate of ['2009-03-01', '2009-07-28', '2009-11-10']) {
      const r = landlord(za, onDate);
      expect(r).toMatchObject({ limit: null, verified: false });
      expect(hostActsOn(r)).toBe(false);
      expect(r.note).not.toMatch(CURRENCY_FIGURE);
    }
  });

  it('that note states the lessor window and its year-of-assessment condition', () => {
    const { note } = landlord(za, '2009-11-10');
    expect(note).toContain('before 11 November 2009');
    expect(note).toContain('year of assessment that began on or after 1 January 2009');
    expect(note).toContain('footnote 33');
    expect(note).toMatch(/confirm it/);
  });

  it('before 1 March 2009 the answer stays unverified, with no figure', () => {
    const r = landlord(za, '2009-02-28');
    expect(r).toMatchObject({ limit: null, verified: false });
    expect(hostActsOn(r)).toBe(false);
    expect(r.note).not.toMatch(CURRENCY_FIGURE);
  });

  it('dates are keyed by the local calendar day', () => {
    expect(landlord(za, new Date(2009, 10, 11))).toMatchObject({ limit: null, verified: false });
    expect(landlord(za, new Date(2009, 10, 10))).toMatchObject({ limit: null, verified: false });
    expect(landlord(za, new Date(2009, 10, 10)).note).toContain('before 11 November 2009');
  });

  it('the rules method and the exported function agree, and each call returns a copy', () => {
    for (const onDate of ['2009-02-28', '2009-11-10', '2009-11-11', '2026-06-01']) {
      expect(za.landlordSmallItemDeduction!(onDate)).toEqual(zaLandlordSmallItemDeduction(onDate));
    }
    // The post-exclusion answer is a shared constant: mutating one result must
    // not change the next.
    const a = zaLandlordSmallItemDeduction('2026-06-01');
    a.limit = 1;
    a.note = 'x';
    expect(zaLandlordSmallItemDeduction('2026-06-01')).toMatchObject({ limit: null, verified: false });
    expect(zaLandlordSmallItemDeduction('2026-06-01').note).not.toBe('x');
  });
});

// ─── The contract across countries ──────────────────────────────────────────

describe('landlordSmallItemDeduction — the contract across countries', () => {
  it('the generic rules do not publish it: absent means "not published", never a guess', () => {
    expect((GENERIC_DEPRECIATION_RULES as DepreciationRules).landlordSmallItemDeduction).toBeUndefined();
  });

  it('only AU, NZ and US publish a figure a host may act on, and each has a boundary', () => {
    const onDate = new Date('2026-06-01');
    const acted = (
      [
        ['AU', AU_DEPRECIATION_RULES],
        ['NZ', NZ_DEPRECIATION_RULES],
        ['US', US_DEPRECIATION_RULES],
        ['GB', UK_DEPRECIATION_RULES],
        ['CA', CA_DEPRECIATION_RULES],
        ['IN', IN_DEPRECIATION_RULES],
        ['SG', SG_DEPRECIATION_RULES],
        ['ZA', ZA_DEPRECIATION_RULES],
      ] as Array<[string, DepreciationRules]>
    )
      .filter(([, rules]) => {
        const r = landlord(rules, onDate);
        if (hostActsOn(r)) expect(r.boundary).toBeDefined();
        return hostActsOn(r);
      })
      .map(([cc]) => cc);
    expect(acted).toEqual(['AU', 'NZ', 'US']);
  });

  it('every note is non-empty and every unverified answer has a null limit', () => {
    const onDate = new Date('2026-06-01');
    for (const rules of [
      AU_DEPRECIATION_RULES,
      NZ_DEPRECIATION_RULES,
      US_DEPRECIATION_RULES,
      UK_DEPRECIATION_RULES,
      CA_DEPRECIATION_RULES,
      IN_DEPRECIATION_RULES,
      SG_DEPRECIATION_RULES,
      ZA_DEPRECIATION_RULES,
    ]) {
      const r = landlord(rules, onDate);
      expect(r.note.length).toBeGreaterThan(40);
      if (!r.verified) expect(r.limit).toBeNull();
    }
  });

  it('returns a copy — a caller mutating the answer cannot change the next one', () => {
    const d = new Date('2026-06-01');
    const a = AU_DEPRECIATION_RULES.landlordSmallItemDeduction!(d);
    a.pool!.limit = 1;
    a.limit = 1;
    expect(AU_DEPRECIATION_RULES.landlordSmallItemDeduction!(d)).toMatchObject({ limit: 300, pool: { limit: 1000 } });
    const g = UK_DEPRECIATION_RULES.landlordSmallItemDeduction!(d);
    g.note = 'x';
    expect(UK_DEPRECIATION_RULES.landlordSmallItemDeduction!(d).note).not.toBe('x');
    const z = ZA_DEPRECIATION_RULES.landlordSmallItemDeduction!(d);
    z.note = 'x';
    expect(ZA_DEPRECIATION_RULES.landlordSmallItemDeduction!(d).note).not.toBe('x');
  });
});
