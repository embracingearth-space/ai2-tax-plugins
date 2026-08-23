/**
 * Depreciation and annual-report tests — @ai2/tax-plugins
 * ai2fin.com
 *
 * The numeric cases are the ATO's OWN worked examples from "Prime cost
 * (straight line) and diminishing value methods". If one of these fails, the
 * plugin disagrees with the ATO — do not "fix" the test.
 *
 * The instant-asset-write-off block is an honesty test, not an arithmetic one:
 * the ATO publishes $20,000 for 2023-24 to 2025-26 and publishes nothing for
 * 2026-27, so a 2026-27 date MUST come back null and unverified. A test that
 * passes with $20,000 carried forward would be a test that lets a false
 * statutory number reach a tax return.
 */

import {
  australiaPlugin,
  newZealandPlugin,
  singaporePlugin,
  GENERIC_DEPRECIATION_RULES,
  getDepreciationRules,
  AU_DEPRECIATION_RULES,
  AU_EFFECTIVE_LIFE_CATEGORIES,
  AU_INSTANT_ASSET_WRITE_OFF_ROWS,
  AU_SMALL_BUSINESS_POOL_RATES,
  auSmallBusinessPoolWriteOff,
  AU_TPAR,
  tparDueDate,
  type DepreciationRules,
  AU_DAY_FRACTION_DENOMINATOR,
  tparDueDateYmd,
  auInstantAssetWriteOff,
  auTprsQualifies,
  resolveWriteOffRow,
  sortWriteOffRowsNewestFirst,
  type AuWriteOffRow,
} from '../src';

const au: DepreciationRules = AU_DEPRECIATION_RULES;

/** A full, non-leap income year. */
const FULL_YEAR = { daysHeld: 365, daysInYear: 365 };

// ─── ATO worked examples — prime cost ───────────────────────────────────────

describe('AU depreciation — ATO worked example, prime cost', () => {
  it('$80,000 asset with a 5-year effective life declines $16,000 a year', () => {
    let opening = 80000;
    for (let year = 0; year < 4; year += 1) {
      const r = au.declineInValue({
        method: 'prime_cost',
        cost: 80000,
        openingAdjustableValue: opening,
        effectiveLifeYears: 5,
        ...FULL_YEAR,
      });
      expect(r.rate).toBeCloseTo(0.2, 10);
      expect(r.declineInValue).toBe(16000);
      expect(r.closingAdjustableValue).toBe(80000 - 16000 * (year + 1));
      opening = r.closingAdjustableValue;
    }
  });

  it('prime cost works off cost, so the decline does not shrink as the value falls', () => {
    const late = au.declineInValue({
      method: 'prime_cost',
      cost: 80000,
      openingAdjustableValue: 32000,
      effectiveLifeYears: 5,
      ...FULL_YEAR,
    });
    expect(late.declineInValue).toBe(16000);
  });
});

// ─── ATO worked examples — diminishing value ────────────────────────────────

describe('AU depreciation — ATO worked example, diminishing value', () => {
  it('$80,000 over a 5-year life: 32,000 → 19,200 → 11,520 → 6,912 on a base stepping 80,000 → 48,000 → 28,800 → 17,280', () => {
    const expectedBase = [80000, 48000, 28800, 17280];
    const expectedDecline = [32000, 19200, 11520, 6912];

    let opening = 80000;
    for (let year = 0; year < 4; year += 1) {
      expect(opening).toBe(expectedBase[year]);
      const r = au.declineInValue({
        method: 'diminishing_value',
        cost: 80000,
        openingAdjustableValue: opening,
        effectiveLifeYears: 5,
        ...FULL_YEAR,
      });
      expect(r.rate).toBeCloseTo(0.4, 10); // 200% ÷ 5
      expect(r.declineInValue).toBe(expectedDecline[year]);
      opening = r.closingAdjustableValue;
    }
    expect(opening).toBe(10368);
  });

  it('an asset first held before 10 May 2006 uses 150%, not 200%', () => {
    const r = au.declineInValue({
      method: 'diminishing_value',
      cost: 80000,
      openingAdjustableValue: 80000,
      effectiveLifeYears: 5,
      heldBefore10May2006: true,
      ...FULL_YEAR,
    });
    expect(r.rate).toBeCloseTo(0.3, 10); // 150% ÷ 5
    expect(r.declineInValue).toBe(24000);
    expect(r.closingAdjustableValue).toBe(56000);
  });
});

// ─── ATO worked example — part-year (the fridge) ────────────────────────────

describe('AU depreciation — ATO worked example, part-year apportionment', () => {
  const fridge = {
    method: 'prime_cost' as const,
    cost: 2000,
    openingAdjustableValue: 2000,
    effectiveLifeYears: 10,
    daysInYear: 365,
  };

  it('a $2,000 fridge with a 10-year life held 122 days declines $67', () => {
    const r = au.declineInValue({ ...fridge, daysHeld: 122 });
    expect(Math.round(r.declineInValue)).toBe(67);
    expect(r.declineInValue).toBeCloseTo(66.85, 2);
  });

  it('the same fridge held 243 days declines $133', () => {
    const r = au.declineInValue({ ...fridge, daysHeld: 243 });
    expect(Math.round(r.declineInValue)).toBe(133);
    expect(r.declineInValue).toBeCloseTo(133.15, 2);
  });
});

// ─── Leap income year ───────────────────────────────────────────────────────

describe('AU depreciation — the denominator is 365 in EVERY year, leap or not', () => {
  // The ATO publishes "cost × (days held ÷ 365) × (100% ÷ effective life)" and,
  // on the same page, "Days held can be 366 for a leap year". Both hold at once:
  // the denominator never moves, so a full leap-year hold claims 366/365 of a
  // year. Dividing by 366 instead would quietly shorten every leap-year claim.
  const base = {
    method: 'prime_cost' as const,
    cost: 80000,
    openingAdjustableValue: 80000,
    effectiveLifeYears: 5,
  };

  it('publishes 365 as the day-fraction denominator, leap year or not', () => {
    expect(AU_DAY_FRACTION_DENOMINATOR).toBe(365);
    // The rules answer the same whatever the real length of the income year —
    // a caller must ask rather than counting days for itself.
    expect(au.dayFractionDenominator(365)).toBe(365);
    expect(au.dayFractionDenominator(366)).toBe(365);
  });

  it('the generic rules use the real length of the year instead', () => {
    expect(GENERIC_DEPRECIATION_RULES.dayFractionDenominator(366)).toBe(366);
  });

  it('182 days claims the same whether or not the income year is a leap year', () => {
    // 80,000 × (182 ÷ 365) × 20% = 7,978.08
    const r = au.declineInValue({
      ...base,
      daysHeld: 182,
      daysInYear: AU_DAY_FRACTION_DENOMINATOR,
    });
    expect(r.declineInValue).toBeCloseTo(7978.08, 2);
  });

  it('a full 366-day hold claims 366/365 of a year — the fraction may exceed 1', () => {
    // 80,000 × (366 ÷ 365) × 20% = 16,043.84, NOT 16,000.
    const r = au.declineInValue({
      ...base,
      daysHeld: 366,
      daysInYear: AU_DAY_FRACTION_DENOMINATOR,
    });
    expect(r.declineInValue).toBeCloseTo(16043.84, 2);
    expect(r.declineInValue).toBeGreaterThan(16000);
  });

  it('a full 365-day hold claims exactly one year of decline', () => {
    const r = au.declineInValue({
      ...base,
      daysHeld: 365,
      daysInYear: AU_DAY_FRACTION_DENOMINATOR,
    });
    expect(r.declineInValue).toBe(16000);
  });

  it('caps a nonsensical days-held rather than paying out a bigger deduction', () => {
    // 400 days in one income year is a caller bug (an unclosed range), not a
    // larger claim: it is capped at the longest a year can be.
    const r = au.declineInValue({
      ...base,
      daysHeld: 400,
      daysInYear: AU_DAY_FRACTION_DENOMINATOR,
    });
    expect(r.declineInValue).toBeCloseTo(16043.84, 2);
  });
});

// ─── The AU rules ENFORCE their own denominator ─────────────────────────────

describe('AU depreciation — the plugin applies the 365 denominator, it does not just document it', () => {
  // Documenting "pass 365" and then forwarding whatever the caller passed is not
  // enforcement: a host that counts the real length of a leap income year and
  // passes 366 would silently underclaim by 366/365. The rule lives in the
  // plugin, so the plugin applies it.
  const base = {
    method: 'prime_cost' as const,
    cost: 80000,
    openingAdjustableValue: 80000,
    effectiveLifeYears: 5,
  };

  it('passing 366 gives exactly the same answer as passing 365', () => {
    const asked = au.declineInValue({ ...base, daysHeld: 366, daysInYear: 365 });
    const wrong = au.declineInValue({ ...base, daysHeld: 366, daysInYear: 366 });
    expect(wrong).toEqual(asked);
    // Both are 366/365 of a year, NOT one flat year.
    expect(wrong.declineInValue).toBeCloseTo(16043.84, 2);
    expect(wrong.declineInValue).toBeGreaterThan(16000);
  });

  it('holds for a part-year hold too — the caller cannot move the denominator', () => {
    const over365 = au.declineInValue({ ...base, daysHeld: 182, daysInYear: 365 });
    const over366 = au.declineInValue({ ...base, daysHeld: 182, daysInYear: 366 });
    expect(over366.declineInValue).toBe(over365.declineInValue);
    expect(over366.declineInValue).toBeCloseTo(7978.08, 2);
  });

  it('holds for diminishing value as well as prime cost', () => {
    const dvBase = { ...base, method: 'diminishing_value' as const };
    expect(au.declineInValue({ ...dvBase, daysHeld: 366, daysInYear: 366 })).toEqual(
      au.declineInValue({ ...dvBase, daysHeld: 366, daysInYear: 365 }),
    );
  });

  it('a nonsense denominator cannot break the AU rules either', () => {
    // 1 would otherwise multiply the claim 365-fold.
    const r = au.declineInValue({ ...base, daysHeld: 365, daysInYear: 1 });
    expect(r.declineInValue).toBe(16000);
  });

  it('but the GENERIC rules still honour whatever the caller passes', () => {
    const over365 = GENERIC_DEPRECIATION_RULES.declineInValue({
      ...base,
      daysHeld: 366,
      daysInYear: 365,
    });
    const over366 = GENERIC_DEPRECIATION_RULES.declineInValue({
      ...base,
      daysHeld: 366,
      daysInYear: 366,
    });
    expect(over365.declineInValue).toBeCloseTo(16043.84, 2);
    expect(over366.declineInValue).toBe(16000);
    expect(over366.declineInValue).not.toBe(over365.declineInValue);
  });
});

// ─── Second element of cost (an improvement made during the year) ───────────

describe('AU depreciation — the diminishing-value base value includes this year\'s improvement', () => {
  // The ATO: base value is the asset's cost in the year it is first used, and in
  // a later year the opening adjustable value PLUS second-element costs incurred
  // that year. So $5,000 opening improved by $1,000 depreciates from $6,000.
  it('a $5,000 opening value with a $1,000 improvement declines from $6,000, not $5,000', () => {
    const improved = au.declineInValue({
      method: 'diminishing_value',
      cost: 10000,
      openingAdjustableValue: 5000,
      secondElementCostThisYear: 1000,
      effectiveLifeYears: 5,
      ...FULL_YEAR,
    });
    // 6,000 × 40% = 2,400 (not 5,000 × 40% = 2,000).
    expect(improved.rate).toBeCloseTo(0.4, 10);
    expect(improved.declineInValue).toBe(2400);
    // The closing value comes off the base value, so the improvement is carried
    // forward rather than vanishing.
    expect(improved.closingAdjustableValue).toBe(3600);
  });

  it('omitting the improvement is the ordinary case and changes nothing', () => {
    const plain = au.declineInValue({
      method: 'diminishing_value',
      cost: 10000,
      openingAdjustableValue: 5000,
      effectiveLifeYears: 5,
      ...FULL_YEAR,
    });
    expect(plain.declineInValue).toBe(2000);
    expect(plain.closingAdjustableValue).toBe(3000);
    expect(
      au.declineInValue({
        method: 'diminishing_value',
        cost: 10000,
        openingAdjustableValue: 5000,
        secondElementCostThisYear: 0,
        effectiveLifeYears: 5,
        ...FULL_YEAR,
      }),
    ).toEqual(plain);
  });

  it('year one is right without it, because the host seeds the opening value from cost', () => {
    const yearOne = au.declineInValue({
      method: 'diminishing_value',
      cost: 80000,
      openingAdjustableValue: 80000,
      effectiveLifeYears: 5,
      ...FULL_YEAR,
    });
    expect(yearOne.declineInValue).toBe(32000);
  });

  it('the improvement is apportioned by days held like the rest of the base', () => {
    const r = au.declineInValue({
      method: 'diminishing_value',
      cost: 10000,
      openingAdjustableValue: 5000,
      secondElementCostThisYear: 1000,
      effectiveLifeYears: 5,
      daysHeld: 182,
      daysInYear: 365,
    });
    // 6,000 × (182 ÷ 365) × 40% = 1,196.71
    expect(r.declineInValue).toBeCloseTo(1196.71, 2);
  });

  it('the decline is still clamped at the base value, improvement included', () => {
    const r = au.declineInValue({
      method: 'diminishing_value',
      cost: 600,
      openingAdjustableValue: 500,
      secondElementCostThisYear: 100,
      effectiveLifeYears: 1, // 200% would take more than the whole base
      ...FULL_YEAR,
    });
    expect(r.declineInValue).toBe(600);
    expect(r.closingAdjustableValue).toBe(0);
  });

  it('the other three methods REFUSE an improvement rather than ignoring it', () => {
    // Each needs a treatment this module is not given enough to perform, and a
    // silently-ignored input is the same defect as a silently-wrong denominator.
    const base = {
      cost: 5000,
      openingAdjustableValue: 5000,
      secondElementCostThisYear: 1000,
      effectiveLifeYears: 5,
      ...FULL_YEAR,
    };
    expect(() => au.declineInValue({ ...base, method: 'prime_cost' })).toThrow(
      /diminishing value method only/i,
    );
    expect(() => au.declineInValue({ ...base, method: 'prime_cost' })).toThrow(/remaining/i);
    expect(() => au.declineInValue({ ...base, method: 'immediate_writeoff' })).toThrow(
      /diminishing value method only/i,
    );
    expect(() =>
      au.declineInValue({ ...base, method: 'pool', effectiveLifeYears: 0 }),
    ).toThrow(/diminishing value method only/i);
  });

  it('the ATO prime-cost recalculation is reachable by passing the recalculated figures', () => {
    // The message tells the caller what to pass: opening + improvement as the
    // cost, over the REMAINING effective life. Three years left on a five-year
    // life: 6,000 × (100% ÷ 3) = 2,000.
    const r = au.declineInValue({
      method: 'prime_cost',
      cost: 5000 + 1000,
      openingAdjustableValue: 5000,
      effectiveLifeYears: 3,
      ...FULL_YEAR,
    });
    expect(r.declineInValue).toBe(2000);
  });

  it('the generic rules model it the same way', () => {
    const r = GENERIC_DEPRECIATION_RULES.declineInValue({
      method: 'diminishing_value',
      cost: 10000,
      openingAdjustableValue: 5000,
      secondElementCostThisYear: 1000,
      effectiveLifeYears: 5,
      ...FULL_YEAR,
    });
    expect(r.declineInValue).toBe(2400);
    expect(r.closingAdjustableValue).toBe(3600);
  });
});

// ─── Clamping, write-off and pool ───────────────────────────────────────────

describe('AU depreciation — the decline never exceeds the opening value', () => {
  it('diminishing value at a 1-year life would take 200% and is clamped to the opening value', () => {
    const r = au.declineInValue({
      method: 'diminishing_value',
      cost: 500,
      openingAdjustableValue: 500,
      effectiveLifeYears: 1,
      ...FULL_YEAR,
    });
    expect(r.rate).toBeCloseTo(2, 10);
    expect(r.declineInValue).toBe(500);
    expect(r.closingAdjustableValue).toBe(0);
  });

  it('an already written-off asset declines nothing more', () => {
    const r = au.declineInValue({
      method: 'diminishing_value',
      cost: 500,
      openingAdjustableValue: 0,
      effectiveLifeYears: 5,
      ...FULL_YEAR,
    });
    expect(r.declineInValue).toBe(0);
    expect(r.closingAdjustableValue).toBe(0);
  });

  it('immediate write-off takes the whole opening value in year one, with no day apportionment', () => {
    const r = au.declineInValue({
      method: 'immediate_writeoff',
      cost: 15000,
      openingAdjustableValue: 15000,
      effectiveLifeYears: 5,
      daysHeld: 30,
      daysInYear: 365,
    });
    expect(r.rate).toBe(1);
    expect(r.declineInValue).toBe(15000);
    expect(r.closingAdjustableValue).toBe(0);
  });

  it('the small business pool is 15% in the allocation year and 30% after', () => {
    expect(AU_SMALL_BUSINESS_POOL_RATES).toEqual({ allocationYear: 0.15, ongoing: 0.3 });

    const first = au.declineInValue({
      method: 'pool',
      cost: 20000,
      openingAdjustableValue: 20000,
      effectiveLifeYears: 0, // not used by the pool method
      poolAllocationYear: true,
      ...FULL_YEAR,
    });
    expect(first.rate).toBe(0.15);
    expect(first.declineInValue).toBe(3000);

    const later = au.declineInValue({
      method: 'pool',
      cost: 20000,
      openingAdjustableValue: 17000,
      effectiveLifeYears: 0,
      ...FULL_YEAR,
    });
    expect(later.rate).toBe(0.3);
    expect(later.declineInValue).toBe(5100);
  });

  it('the low-pool-balance write-off is a separate call, never applied inside declineInValue', () => {
    const declining = au.declineInValue({
      method: 'pool',
      cost: 20000,
      openingAdjustableValue: 900,
      effectiveLifeYears: 0,
      ...FULL_YEAR,
    });
    expect(declining.declineInValue).toBe(270); // 30% of 900, not the whole balance

    const low = auSmallBusinessPoolWriteOff(900, '2025-03-01');
    expect(low.deductWholeBalance).toBe(true);
    expect(low.amount).toBe(900);
    expect(low.limit).toBe(20000);

    const high = auSmallBusinessPoolWriteOff(45000, '2025-03-01');
    expect(high.deductWholeBalance).toBe(false);
    expect(high.amount).toBe(0);
  });

  it('with no verified limit the pool question is unanswered, not answered "no"', () => {
    const unknown = auSmallBusinessPoolWriteOff(900, '2026-09-01');
    expect(unknown.deductWholeBalance).toBeNull();
    expect(unknown.amount).toBeNull();
    expect(unknown.verified).toBe(false);
  });
});

// ─── Private use ────────────────────────────────────────────────────────────

describe('AU depreciation — private use reduces the deduction, not the base value', () => {
  it('a 60%-business asset still declines on the full base; only the claim is apportioned', () => {
    const r = au.declineInValue({
      method: 'diminishing_value',
      cost: 10000,
      openingAdjustableValue: 10000,
      effectiveLifeYears: 5,
      ...FULL_YEAR,
    });

    const taxableUsePercent = 60;
    const deductible = (r.declineInValue * taxableUsePercent) / 100;

    expect(r.declineInValue).toBe(4000);
    expect(deductible).toBe(2400);
    expect(deductible).not.toBe(r.declineInValue);
    // The carried-forward base is the full decline, not the deductible portion.
    expect(r.closingAdjustableValue).toBe(6000);
  });
});

// ─── Instant asset write-off — the honesty invariant ────────────────────────

describe('AU instant asset write-off — effective-dated, and null where the ATO says nothing', () => {
  it.each([
    ['2023-07-01', '2023-24 starts'],
    ['2024-11-15', 'mid 2024-25'],
    ['2025-07-01', '2025-26 starts'],
    ['2026-06-30', '2025-26 ends'],
  ])('%s (%s) is $20,000 and verified', (date) => {
    const r = au.instantAssetWriteOff(new Date(date));
    expect(r.limit).toBe(20000);
    expect(r.verified).toBe(true);
  });

  it('2026-27 has no published limit: null, verified false, and a note telling you to confirm it', () => {
    const r = au.instantAssetWriteOff(new Date('2026-07-01'));
    expect(r.limit).toBeNull();
    expect(r.verified).toBe(false);
    expect(r.note).toMatch(/confirm/i);
    expect(r.note).not.toMatch(/20,?000/);
  });

  it('a date well into 2026-27 is still null — $20,000 does not carry forward', () => {
    const r = au.instantAssetWriteOff(new Date('2027-03-01'));
    expect(r.limit).toBeNull();
    expect(r.verified).toBe(false);
  });

  it('the temporary full expensing window carries no threshold', () => {
    const r = au.instantAssetWriteOff(new Date('2022-01-01'));
    expect(r.limit).toBeNull();
    expect(r.verified).toBe(false);
    expect(r.note).toMatch(/temporary full expensing/i);
  });

  it('a date before the earliest row falls back to an unverified row, never to a number', () => {
    const r = au.instantAssetWriteOff(new Date('1995-01-01'));
    expect(r.limit).toBeNull();
    expect(r.verified).toBe(false);
  });

  it('every row that claims a limit is verified, and every unverified row has no number', () => {
    for (const row of AU_INSTANT_ASSET_WRITE_OFF_ROWS) {
      if (row.limit !== null) expect(row.verified).toBe(true);
      if (!row.verified) expect(row.limit).toBeNull();
      expect(row.note.length).toBeGreaterThan(20);
    }
  });

  it('rows are ordered newest-first so the first match is the one in force', () => {
    const dates = AU_INSTANT_ASSET_WRITE_OFF_ROWS.map((r) => r.effectiveFrom);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});

describe('AU instant asset write-off — the resolver derives the order, it does not trust it', () => {
  // The literal is written newest-first, but nothing stops an editor inserting a
  // new row at the bottom. If the resolver relied on literal order it would then
  // return a STALE limit with verified: true, and no test on an existing date
  // would fail — the worst kind of regression for a tax figure.
  const OUT_OF_ORDER: AuWriteOffRow[] = [
    {
      effectiveFrom: '2000-07-01',
      limit: null,
      verified: false,
      note: 'Oldest row, deliberately placed first.',
    },
    {
      effectiveFrom: '2023-07-01',
      limit: 20000,
      verified: true,
      note: 'The $20,000 window, deliberately placed in the middle.',
    },
    {
      effectiveFrom: '2028-07-01',
      limit: 12345,
      verified: true,
      note: 'A future row, deliberately appended last.',
    },
  ];

  it('an out-of-order literal still resolves to the row in force', () => {
    expect(resolveWriteOffRow(OUT_OF_ORDER, '2024-11-15').limit).toBe(20000);
    expect(resolveWriteOffRow(OUT_OF_ORDER, '2029-01-01').limit).toBe(12345);
    expect(resolveWriteOffRow(OUT_OF_ORDER, '2001-01-01').limit).toBeNull();
  });

  it('a future row appended at the bottom does not leak into an earlier date', () => {
    // The bug this guards: taking the FIRST literal element that has started.
    expect(resolveWriteOffRow(OUT_OF_ORDER, '2024-11-15').limit).not.toBe(12345);
    expect(resolveWriteOffRow(OUT_OF_ORDER, '2024-11-15').verified).toBe(true);
  });

  it('a date before every row falls back to the OLDEST row, not the last literal one', () => {
    const r = resolveWriteOffRow(OUT_OF_ORDER, '1995-01-01');
    expect(r.note).toMatch(/Oldest row/);
    expect(r.limit).toBeNull();
  });

  it('sorting is newest-first and does not mutate the caller\'s array', () => {
    const before = OUT_OF_ORDER.map((r) => r.effectiveFrom);
    expect(sortWriteOffRowsNewestFirst(OUT_OF_ORDER).map((r) => r.effectiveFrom)).toEqual([
      '2028-07-01',
      '2023-07-01',
      '2000-07-01',
    ]);
    expect(OUT_OF_ORDER.map((r) => r.effectiveFrom)).toEqual(before);
  });

  it('the shipped rows resolve identically whatever order they are handed over in', () => {
    const shuffled = [...AU_INSTANT_ASSET_WRITE_OFF_ROWS].reverse();
    for (const date of ['1995-01-01', '2022-01-01', '2024-11-15', '2026-06-30', '2027-03-01']) {
      expect(resolveWriteOffRow(shuffled, date)).toEqual(au.instantAssetWriteOff(new Date(date)));
    }
  });
});

// ─── Balancing adjustment ───────────────────────────────────────────────────

describe('AU depreciation — balancing adjustment on disposal', () => {
  it('selling above the written-down value is assessable income', () => {
    const r = au.balancingAdjustment({
      terminationValue: 5000,
      adjustableValue: 3000,
      taxableUsePercent: 100,
    });
    expect(r.amount).toBe(2000);
    expect(r.assessable).toBe(true);
  });

  it('selling below the written-down value is a deduction', () => {
    const r = au.balancingAdjustment({
      terminationValue: 1000,
      adjustableValue: 3000,
      taxableUsePercent: 100,
    });
    expect(r.amount).toBe(-2000);
    expect(r.assessable).toBe(false);
  });

  it('the adjustment is scaled by taxable use', () => {
    const r = au.balancingAdjustment({
      terminationValue: 5000,
      adjustableValue: 3000,
      taxableUsePercent: 50,
    });
    expect(r.amount).toBe(1000);
    expect(r.assessable).toBe(true);
  });

  it('selling at exactly the written-down value assesses nothing', () => {
    const r = au.balancingAdjustment({
      terminationValue: 3000,
      adjustableValue: 3000,
      taxableUsePercent: 100,
    });
    expect(r.amount).toBe(0);
    expect(r.assessable).toBe(false);
  });
});

// ─── Effective lives ────────────────────────────────────────────────────────

describe('AU effective lives — the Commissioner\'s Table B, short and sourced', () => {
  it('looks up a known category and returns null for anything else', () => {
    expect(au.effectiveLife('computer_laptop')).toBe(2);
    expect(au.effectiveLife('computer_desktop')).toBe(4);
    expect(au.effectiveLife('mobile_phone')).toBe(3);
    expect(au.effectiveLife('motor_vehicle_car')).toBe(8);
    expect(au.effectiveLife('office_desk')).toBe(20);
    expect(au.effectiveLife('photocopier')).toBe(5);
    expect(au.effectiveLife('espresso_machine')).toBeNull();
  });

  it('every shipped category cites the determination it was read from', () => {
    expect(AU_EFFECTIVE_LIFE_CATEGORIES.length).toBeGreaterThan(0);
    for (const c of AU_EFFECTIVE_LIFE_CATEGORIES) {
      expect(c.years).toBeGreaterThan(0);
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.source).toMatch(/Effective Life of Depreciating Assets\) Determination 2025/);
    }
  });

  it('category keys are unique and the list is returned by copy', () => {
    const keys = AU_EFFECTIVE_LIFE_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    const copy = au.effectiveLifeCategories();
    copy.pop();
    expect(au.effectiveLifeCategories().length).toBe(AU_EFFECTIVE_LIFE_CATEGORIES.length);
  });
});

// ─── Generic rules ──────────────────────────────────────────────────────────

describe('Generic depreciation rules — every other country', () => {
  it('a country with no rules of its own falls back to the generic set', () => {
    expect(newZealandPlugin.getDepreciationRules).toBeUndefined();
    expect(getDepreciationRules(newZealandPlugin)).toBe(GENERIC_DEPRECIATION_RULES);
    expect(getDepreciationRules(singaporePlugin)).toBe(GENERIC_DEPRECIATION_RULES);
  });

  it('Australia gets its own', () => {
    expect(getDepreciationRules(australiaPlugin)).toBe(AU_DEPRECIATION_RULES);
    expect(getDepreciationRules(australiaPlugin).countryCode).toBe('AU');
  });

  it('offers prime cost and diminishing value only', () => {
    expect(GENERIC_DEPRECIATION_RULES.methods).toEqual(['prime_cost', 'diminishing_value']);
    expect(GENERIC_DEPRECIATION_RULES.defaultMethod).toBe('prime_cost');
  });

  it('computes the same prime cost and 200% diminishing value arithmetic', () => {
    const pc = GENERIC_DEPRECIATION_RULES.declineInValue({
      method: 'prime_cost',
      cost: 80000,
      openingAdjustableValue: 80000,
      effectiveLifeYears: 5,
      ...FULL_YEAR,
    });
    expect(pc.declineInValue).toBe(16000);

    const dv = GENERIC_DEPRECIATION_RULES.declineInValue({
      method: 'diminishing_value',
      cost: 80000,
      openingAdjustableValue: 80000,
      effectiveLifeYears: 5,
      ...FULL_YEAR,
    });
    expect(dv.rate).toBeCloseTo(0.4, 10);
    expect(dv.declineInValue).toBe(32000);
  });

  it('refuses the write-off and pool methods rather than inventing a rate', () => {
    const base = {
      cost: 1000,
      openingAdjustableValue: 1000,
      effectiveLifeYears: 5,
      ...FULL_YEAR,
    };
    expect(() =>
      GENERIC_DEPRECIATION_RULES.declineInValue({ ...base, method: 'immediate_writeoff' }),
    ).toThrow(/not available/i);
    expect(() => GENERIC_DEPRECIATION_RULES.declineInValue({ ...base, method: 'pool' })).toThrow(
      /not available/i,
    );
  });

  it('invents no effective lives and no write-off threshold', () => {
    expect(GENERIC_DEPRECIATION_RULES.effectiveLife('computer_laptop')).toBeNull();
    expect(GENERIC_DEPRECIATION_RULES.effectiveLifeCategories()).toEqual([]);
    const w = GENERIC_DEPRECIATION_RULES.instantAssetWriteOff(new Date('2025-01-01'));
    expect(w.limit).toBeNull();
    expect(w.verified).toBe(false);
  });

  it('rejects a non-positive effective life instead of dividing by zero', () => {
    expect(() =>
      GENERIC_DEPRECIATION_RULES.declineInValue({
        method: 'prime_cost',
        cost: 1000,
        openingAdjustableValue: 1000,
        effectiveLifeYears: 0,
        ...FULL_YEAR,
      }),
    ).toThrow(/effectiveLifeYears/);
  });
});

// ─── TPAR ───────────────────────────────────────────────────────────────────

describe('AU annual reports — Taxable payments annual report (TPAR)', () => {
  const reports = australiaPlugin.getAnnualReports?.();

  it('Australia declares exactly one annual report and it is the TPAR', () => {
    expect(reports).toBeDefined();
    expect(reports).toHaveLength(1);
    expect(reports?.[0].id).toBe('tpar');
    expect(reports?.[0].label).toBe('Taxable payments annual report (TPAR)');
    expect(reports?.[0].authority.name).toBe('ATO');
  });

  it('no other country declares one', () => {
    expect(newZealandPlugin.getAnnualReports).toBeUndefined();
    expect(singaporePlugin.getAnnualReports).toBeUndefined();
  });

  it('is due 28 August 2027 for the financial year ending 30 June 2027', () => {
    const due = AU_TPAR.dueDate(new Date(2027, 5, 30));
    expect(due.getFullYear()).toBe(2027);
    expect(due.getMonth()).toBe(7); // August
    expect(due.getDate()).toBe(28);
  });

  it('is due 28 August 2026 for the financial year ending 30 June 2026', () => {
    const due = tparDueDate(new Date(2026, 5, 30));
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(7);
    expect(due.getDate()).toBe(28);
  });

  it('reports the columns the ATO asks for, in order', () => {
    expect(AU_TPAR.columns.map((c) => c.id)).toEqual([
      'abn',
      'name',
      'address',
      'grossPaidInclGst',
      'totalGst',
      'taxWithheldNoAbn',
    ]);
    expect(AU_TPAR.columns.map((c) => c.label)).toEqual([
      'ABN',
      'Name',
      'Address',
      'Gross amount paid',
      'Total GST',
      'Tax withheld',
    ]);
    expect(AU_TPAR.columns.find((c) => c.id === 'abn')?.type).toBe('abn');
    expect(AU_TPAR.columns.find((c) => c.id === 'grossPaidInclGst')?.officialLabel).toMatch(
      /including GST and any tax withheld/i,
    );
    expect(AU_TPAR.columns.find((c) => c.id === 'taxWithheldNoAbn')?.officialLabel).toMatch(
      /ABN was not quoted/i,
    );
    for (const c of AU_TPAR.columns) {
      expect(['text', 'currency', 'abn']).toContain(c.type);
    }
  });

  it('payee amounts are whole dollars, no cents', () => {
    expect(AU_TPAR.wholeDollarsOnly).toBe(true);
  });

  it('lists the five TPRS services, and building and construction has a DIFFERENT test, not none', () => {
    const services = AU_TPAR.qualifyingServices ?? [];
    expect(services.map((s) => s.key)).toEqual([
      'building_and_construction',
      'cleaning',
      'courier_and_road_freight',
      'information_technology',
      'security_investigation_surveillance',
    ]);

    const bc = services.find((s) => s.key === 'building_and_construction');
    expect(bc?.test).toBe('primarily_in_industry');
    expect(bc?.thresholdPercent).toBe(50);
    expect(bc?.activityLimb).toBe(true);
    expect(bc?.priorYearLimb).toBe(true);

    // The other four use the ordinary 10% share test, on current-year income only.
    for (const s of services.filter((x) => x.key !== 'building_and_construction')) {
      expect(s.test).toBe('income_share');
      expect(s.thresholdPercent).toBe(10);
      expect(s.activityLimb).toBeUndefined();
      expect(s.priorYearLimb).toBeUndefined();
    }

    // Courier and road freight are one entry because the ATO measures them as one.
    expect(services.find((s) => s.key === 'courier_and_road_freight')?.combines).toEqual([
      'Courier services',
      'Road freight services',
    ]);
  });

  it('states the 10% threshold and that courier and road freight are combined', () => {
    expect(AU_TPAR.thresholdNote).toMatch(/10%/);
    expect(AU_TPAR.thresholdNote).toMatch(/courier and road freight are combined/i);
    expect(AU_TPAR.thresholdNote).toMatch(/building and construction/i);
  });

  it('the threshold note gives building and construction its own 50% test, not an exemption', () => {
    const note = AU_TPAR.thresholdNote ?? '';
    expect(note).toMatch(/50% or more/);
    expect(note).toMatch(/business activity/i);
    expect(note).toMatch(/immediately before/i);
    // The old, wrong model said the test simply did not apply to B&C.
    expect(note).not.toMatch(/lodge regardless/i);
    expect(note).not.toMatch(/does not apply to building/i);
  });

  it('carries the ATO contractor columns and NOT the follow-up-request fields', () => {
    // Phone, email and bank details are what the ATO "may ask for" separately —
    // they are not columns of the TPAR, so collecting them here would tell a
    // user to send the ATO data this report does not carry.
    const ids = AU_TPAR.columns.map((c) => c.id);
    expect(ids).not.toContain('phone');
    expect(ids).not.toContain('email');
    expect(ids).not.toContain('bankAccount');
    expect(AU_TPAR.columns).toHaveLength(6);
  });

  it('says plainly that the report is prepared here and lodged through the ATO', () => {
    expect(AU_TPAR.lodgmentNote).toMatch(/prepared here/i);
    expect(AU_TPAR.lodgmentNote).toMatch(/not the ATO lodgment file/i);
    expect(AU_TPAR.lodgmentNote).toMatch(/28 August/);
  });
});
// ─── TPRS qualification — two tests, not one test and an exemption ──────────

describe('AU TPAR — building and construction has its own 50% test', () => {
  // ATO, "Building and construction services" (last updated 23 April 2024):
  // "You are considered to be a business that primarily operates in building and
  //  construction services if any apply: in the current financial year, 50% or
  //  more of your business income is earned from providing building and
  //  construction services; in the current financial year, 50% or more of your
  //  business activity relates to building and construction services; in the
  //  financial year immediately before the current financial year, 50% or more
  //  of your business income was earned from providing building and
  //  construction services."
  const bc = 'building_and_construction';

  it('50% of current-year income is in — the threshold is inclusive', () => {
    const r = auTprsQualifies({ service: bc, currentYearIncomePercent: 50 });
    expect(r.thresholdMet).toBe(true);
    expect(r.mustLodge).toBeNull(); // in the system — but did it pay contractors? unknown
    expect(r.test).toBe('primarily_in_industry');
    expect(r.thresholdPercent).toBe(50);
    expect(r.limbsMet).toEqual(['current_year_income']);
  });

  it('49% of current-year income is out — it is not "always lodge"', () => {
    const r = auTprsQualifies({ service: bc, currentYearIncomePercent: 49 });
    expect(r.thresholdMet).toBe(false);
    expect(r.mustLodge).toBe(false); // below the line: a clean "no", whatever was paid
    expect(r.limbsMet).toEqual([]);
  });

  it('50% of current-year ACTIVITY qualifies even where the income share does not', () => {
    const r = auTprsQualifies({
      service: bc,
      currentYearIncomePercent: 20,
      currentYearActivityPercent: 50,
    });
    expect(r.thresholdMet).toBe(true);
    expect(r.limbsMet).toEqual(['current_year_activity']);
  });

  it('the PRIOR-year limb catches a year that is itself below 50% — Sascha\'s Cabinet Makers', () => {
    // The ATO's own example: a year under the threshold still qualifies on the
    // back of the year immediately before it.
    const r = auTprsQualifies({
      service: bc,
      currentYearIncomePercent: 30,
      currentYearActivityPercent: 30,
      priorYearIncomePercent: 60,
    });
    expect(r.thresholdMet).toBe(true);
    expect(r.limbsMet).toEqual(['prior_year_income']);
  });

  it('49% on every limb qualifies on none of them', () => {
    const r = auTprsQualifies({
      service: bc,
      currentYearIncomePercent: 49,
      currentYearActivityPercent: 49,
      priorYearIncomePercent: 49,
    });
    expect(r.mustLodge).toBe(false);
    expect(r.note).toMatch(/50%/);
  });

  it('every limb over the line is reported, not just the first', () => {
    const r = auTprsQualifies({
      service: bc,
      currentYearIncomePercent: 80,
      currentYearActivityPercent: 75,
      priorYearIncomePercent: 90,
    });
    expect(r.limbsMet).toEqual([
      'current_year_income',
      'current_year_activity',
      'prior_year_income',
    ]);
  });
});

describe('AU TPAR — the other four services use the ordinary 10% test', () => {
  it('10% of business income is in, 9% is out', () => {
    expect(auTprsQualifies({ service: 'cleaning', currentYearIncomePercent: 10 }).thresholdMet).toBe(
      true,
    );
    expect(auTprsQualifies({ service: 'cleaning', currentYearIncomePercent: 9 }).thresholdMet).toBe(
      false,
    );
  });

  it('reports the 10% test and the income-share shape', () => {
    const r = auTprsQualifies({ service: 'information_technology', currentYearIncomePercent: 12 });
    expect(r.test).toBe('income_share');
    expect(r.thresholdPercent).toBe(10);
  });

  it('courier and road freight are one entry, measured together', () => {
    const r = auTprsQualifies({
      service: 'courier_and_road_freight',
      currentYearIncomePercent: 10,
    });
    expect(r.thresholdMet).toBe(true);
  });

  it('has no activity limb and no prior-year limb — those belong to the 50% test', () => {
    const r = auTprsQualifies({
      service: 'security_investigation_surveillance',
      currentYearIncomePercent: 5,
      currentYearActivityPercent: 90,
      priorYearIncomePercent: 90,
    });
    // 90% on limbs this service does not have is not evidence; only the 5%
    // income share counts, and 5% is out.
    expect(r.thresholdMet).toBe(false);
    expect(r.limbsMet).toEqual([]);
  });

  it('evidence for a limb the service does not have is no evidence at all', () => {
    // A cleaning business offering ONLY an activity share has given the 10%
    // income test nothing to work with. Returning false here would be a
    // confident "no" on zero applicable evidence — so it throws instead.
    expect(() =>
      auTprsQualifies({ service: 'cleaning', currentYearActivityPercent: 100 }),
    ).toThrow(/currentYearIncomePercent/);
  });
});

describe('AU TPAR — lodgment needs BOTH the threshold and contractor payments', () => {
  // The threshold puts a business inside the reporting system. Contractor
  // payments are what there is to report. A TPAR is owed only when both hold.
  it('above the threshold but no contractors paid: nothing to report', () => {
    const r = auTprsQualifies({
      service: 'cleaning',
      currentYearIncomePercent: 40,
      paidContractorsForService: false,
    });
    expect(r.thresholdMet).toBe(true);
    expect(r.mustLodge).toBe(false);
    expect(r.note).toMatch(/no contractors were paid/);
  });

  it('above the threshold and contractors paid: a TPAR is due', () => {
    const r = auTprsQualifies({
      service: 'cleaning',
      currentYearIncomePercent: 40,
      paidContractorsForService: true,
    });
    expect(r.mustLodge).toBe(true);
  });

  it('above the threshold with the payment fact unknown: the answer is unknown, not "no"', () => {
    const r = auTprsQualifies({ service: 'cleaning', currentYearIncomePercent: 40 });
    expect(r.thresholdMet).toBe(true);
    expect(r.mustLodge).toBeNull();
    expect(r.note).toMatch(/confirm/i);
  });

  it('below the threshold: "no" regardless of payments — the business is outside the system', () => {
    const r = auTprsQualifies({
      service: 'cleaning',
      currentYearIncomePercent: 5,
      paidContractorsForService: true,
    });
    expect(r.thresholdMet).toBe(false);
    expect(r.mustLodge).toBe(false);
  });
});

describe('AU TPAR — the qualification test refuses to guess', () => {
  it('an unknown service throws rather than answering "no"', () => {
    expect(() =>
      auTprsQualifies({ service: 'landscaping', currentYearIncomePercent: 90 }),
    ).toThrow(/not a TPRS reportable service/i);
  });

  it('no figures at all throws rather than returning a confident false', () => {
    expect(() => auTprsQualifies({ service: 'cleaning' })).toThrow(/at least one/i);
  });
});

describe('the write-off resolver keys a Date by its LOCAL calendar day', () => {
  // new Date(2023, 6, 1) is "1 July 2023" on the caller's calendar. Under
  // toISOString() it is 2023-06-30T14:00Z in Sydney — keyed as 30 June, the
  // wrong side of the boundary the $20,000 row starts on. The resolver must
  // read the day the caller meant. This is the same bug class already fixed
  // in the client, the due date, and the schedule formatter.
  it('1 July 2023, built from local parts, selects the row that STARTS that day', () => {
    const r = auInstantAssetWriteOff(new Date(2023, 6, 1));
    expect(r.verified).toBe(true);
    expect(r.limit).toBe(20000);
  });

  it('30 June 2023, built from local parts, is still the previous regime', () => {
    const r = auInstantAssetWriteOff(new Date(2023, 5, 30));
    expect(r.verified).toBe(false);
  });

  it('the canary: toISOString would have keyed 1 July as the wrong day in this zone', () => {
    // Keeps this suite honest in any non-UTC runner. If the zone offset is
    // zero the two agree and the above tests prove nothing about the class —
    // so this case documents that and skips rather than claiming coverage.
    const d = new Date(2023, 6, 1);
    const isoDay = d.toISOString().slice(0, 10);
    if (d.getTimezoneOffset() === 0) {
      expect(isoDay).toBe('2023-07-01'); // UTC runner: no discrimination possible here
      return;
    }
    expect(isoDay).not.toBe('2023-07-01'); // any other zone: the old code was wrong
  });
});

describe('AU TPAR — the due date is a calendar date and must not drift', () => {
  it('is 28 August following the financial year end', () => {
    expect(tparDueDateYmd(new Date(2027, 5, 30))).toBe('2027-08-28');
    expect(tparDueDateYmd(new Date(2026, 5, 30))).toBe('2026-08-28');
  });

  it('serialises as 28 August via toISOString, not 27 August', () => {
    // A local-midnight Date renders as the PREVIOUS day under toISOString for
    // every lodger east of Greenwich — which is every Australian.
    expect(tparDueDate(new Date(2027, 5, 30)).toISOString().slice(0, 10)).toBe('2027-08-28');
  });

  it('reads as 28 August from local getters too', () => {
    const d = tparDueDate(new Date(2027, 5, 30));
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(28);
  });
});

