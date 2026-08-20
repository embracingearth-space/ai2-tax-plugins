/**
 * Personal income-tax estimator — anchor + regression tests. embracingearth.space
 *
 * These anchors are the same ones already pinned in the website's
 * lib/incomeTaxCalc.test.ts, independently re-derived against authority
 * schedules there. Reproducing them here proves this implementation is a
 * faithful port, not a rewrite that happens to look similar — a single wrong
 * digit anywhere in the composition (deduction → progressive tax → offsets →
 * levies) would show up as a mismatch against a number someone already
 * checked against the ATO/HMRC/IRS/Income Tax Dept by hand.
 */
import {
  calcIncomeTax,
  getIncomeTaxYears,
  getIncomeTaxScheme,
  listIncomeTaxCountries,
  getIncomeTaxBands,
  INCOME_TAX_SCHEMES,
} from '../src';

const sum = (items: { amount: number }[]) => items.reduce((s, i) => s + i.amount, 0);

describe('income-tax take-home anchors', () => {
  it('AU $90k FY2025-26 → $70,412 take-home (regression guard)', () => {
    const r = calcIncomeTax('AU', 90000, '2025-26')!;
    expect(r.incomeTax).toBe(17788);
    expect(sum(r.levies)).toBe(1800);
    expect(r.totalTax).toBe(19588);
    expect(r.takeHome).toBe(70412);
  });

  it('UK £60k → £11,432 income tax + £3,211 NI (England/Wales/NI)', () => {
    const r = calcIncomeTax('GB', 60000, '2025-26')!;
    expect(r.taxable).toBe(47430);
    expect(r.incomeTax).toBe(11432);
    expect(r.levies.find((l) => l.name === 'National Insurance')?.amount).toBe(3211);
    expect(r.takeHome).toBe(45357);
  });

  it('IN ₹12.75L (new regime) → ₹0 tax via the s.87A rebate', () => {
    const r = calcIncomeTax('IN', 1275000, '2025-26 (AY 2026-27)')!;
    expect(r.taxable).toBe(1200000);
    expect(r.incomeTax).toBe(60000);
    expect(r.offsets.find((o) => o.name === 'Section 87A rebate')?.amount).toBe(60000);
    expect(r.totalTax).toBe(0);
  });

  it('IN ₹16L (new regime) → ₹113,100 (slab tax + 4% cess)', () => {
    const r = calcIncomeTax('IN', 1600000, '2025-26 (AY 2026-27)')!;
    expect(r.incomeTax).toBe(108750);
    expect(r.levies.find((l) => l.name.startsWith('Health'))?.amount).toBe(4350);
    expect(r.totalTax).toBe(113100);
  });

  it('IN s.87A marginal relief just above ₹12L caps the cliff', () => {
    const r = calcIncomeTax('IN', 1285000, '2025-26 (AY 2026-27)')!;
    expect(r.taxable).toBe(1210000);
    expect(r.totalTax).toBe(10400);
  });

  it('NZ stays income-tax-only (no levies/offsets)', () => {
    const r = calcIncomeTax('NZ', 80000, '2025-26')!;
    expect(r.levies).toHaveLength(0);
    expect(r.offsets).toHaveLength(0);
  });

  it('US $100k → federal $13,170 on $83,900 taxable', () => {
    const r = calcIncomeTax('US', 100000, '2026')!;
    expect(r.taxable).toBe(83900);
    expect(r.incomeTax).toBe(13170);
  });
});

/**
 * The specific bug this whole module exists to have fixed exactly once, in
 * exactly one place: AU's LITO must survive zeroing out income tax and go on
 * to offset the Medicare levy too — the ATO nets LITO against the combined
 * liability. Both figures are the live taxmcp.ai2fin.com response, not
 * hand-derived (see the website's PR history for the incident this was).
 */
describe('AU LITO offsets the Medicare levy, not just income tax', () => {
  it('$9,100 → $0 total tax, and the levy is NOT charged in the first place', () => {
    const r = calcIncomeTax('AU', 9100, '2026-27')!;
    expect(r.incomeTax).toBe(0);
    // This assertion used to expect a $182 levy here, offset back to zero by
    // LITO — which matched the live MCP at the time and gave the right TOTAL,
    // but by the wrong route. $9,100 is far below the $28,011 low-income
    // threshold, so under Medicare Levy Act s 7 no levy arises at all. Same
    // answer for the taxpayer, honest arithmetic underneath.
    expect(sum(r.levies)).toBe(0);
    expect(r.levies).toHaveLength(0);
    expect(sum(r.offsets)).toBe(700);
    expect(r.totalTax).toBe(0);
    expect(r.takeHome).toBe(9100);
  });

  it('$18,200 (tax-free threshold) → $0 total tax, not $364', () => {
    const r = calcIncomeTax('AU', 18200, '2026-27')!;
    expect(r.totalTax).toBe(0);
    expect(r.takeHome).toBe(18200);
  });

  it('$20,000 → $0 total tax (the exact case that once diverged between the website and the MCP)', () => {
    const r = calcIncomeTax('AU', 20000, '2026-27')!;
    expect(r.totalTax).toBe(0);
  });
});

/**
 * The Medicare levy low-income reduction (Medicare Levy Act 1986 s 7). Nil to
 * $28,011, shaded in at 10% of the excess, meeting the ordinary 2% at $35,013.
 * Charging a flat 2% here — as this file did until the reduction landed —
 * overstates the liability of every Australian earning under $35,013.
 */
describe('AU Medicare levy low-income reduction', () => {
  const levy = (gross: number, year = '2025-26') => sum(calcIncomeTax('AU', gross, year)!.levies);

  it('charges nothing at or below the lower threshold', () => {
    expect(levy(28011)).toBe(0);
    expect(levy(25000)).toBe(0);
    expect(levy(18200)).toBe(0);
  });

  it('shades in at 10% of the excess above it', () => {
    // $1 over rounds to nothing; the taper is real but starts from zero.
    expect(levy(28012)).toBe(0);
    expect(levy(30000)).toBe(199); // 10% of 1,989
    expect(levy(32000)).toBe(399); // 10% of 3,989
  });

  it('converges on the ordinary 2% at the upper threshold and never exceeds it', () => {
    expect(levy(35013)).toBe(700); // 2% of 35,013 = 700.26, shaded = 700.20
    expect(levy(35100)).toBe(Math.round(35100 * 0.02));
    expect(levy(40000)).toBe(800);
    expect(levy(90000)).toBe(1800);
  });

  it('is never more than the flat 2% anywhere across the band', () => {
    for (let g = 27000; g <= 36000; g += 250) {
      expect(levy(g)).toBeLessThanOrEqual(Math.round(g * 0.02));
    }
  });

  it('leaves a year with no verified thresholds on the flat 2%', () => {
    // 2024-25 used different thresholds and 2027-28's are not announced.
    // Borrowing another year's indexed figures would be inventing them.
    expect(levy(30000, '2024-25')).toBe(600);
    expect(levy(30000, '2027-28')).toBe(600);
  });
});

describe('tax-year resolution', () => {
  it('resolves an explicit year label', () => {
    expect(calcIncomeTax('AU', 90000, '2024-25')!.taxYear).toBe('2024-25');
  });

  it('an explicit unknown year returns null, never a silently-substituted current year', () => {
    expect(calcIncomeTax('AU', 90000, '1999-00')).toBeNull();
    expect(calcIncomeTax('GB', 90000, '2019-20')).toBeNull();
  });

  it('an unsupported country returns null, never a guessed figure', () => {
    expect(calcIncomeTax('ZZ', 90000)).toBeNull();
    expect(calcIncomeTax('FR', 90000)).toBeNull();
  });

  it('every scheme resolves to a year that has actually started', () => {
    for (const code of listIncomeTaxCountries()) {
      const scheme = getIncomeTaxScheme(code)!;
      const current = calcIncomeTax(code, 50000)!.taxYear;
      const years = getIncomeTaxYears(code);
      const currentEntry = years.find((y) => y.value === current)!;
      expect(currentEntry).toBeDefined();
      expect(currentEntry.isCurrent).toBe(true);
    }
  });

  it('exactly one year is flagged current per country', () => {
    for (const code of listIncomeTaxCountries()) {
      const flagged = getIncomeTaxYears(code).filter((y) => y.isCurrent);
      expect(flagged).toHaveLength(1);
    }
  });
});

describe('every scheme carries real provenance', () => {
  it('names an authority, a source URL, and a citation date for every country', () => {
    for (const code of listIncomeTaxCountries()) {
      const scheme = INCOME_TAX_SCHEMES[code]!;
      expect(scheme.authorityName.length).toBeGreaterThan(0);
      expect(scheme.source).toMatch(/^https:\/\//);
      expect(scheme.citationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(scheme.verified).toBe(true);
    }
  });

  it('covers the five countries the website and the MCP both need', () => {
    expect(listIncomeTaxCountries().sort()).toEqual(['AU', 'GB', 'IN', 'NZ', 'US']);
  });
});

describe('marginal rate is differenced from liability, not read off the bands', () => {
  const mr = (code: string, gross: number, year: string) =>
    calcIncomeTax(code, gross, year)!.marginalRate;

  /**
   * The regressions that motivated differencing. Each was wrong by more than a
   * rounding artefact under the hand-written hooks, and each was wrong for a
   * DIFFERENT reason — which is the argument against hand-writing them.
   */
  it('below a deduction, reports the gross-based levy — not the top band', () => {
    // $10,000 is under the $16,100 standard deduction, so taxable is 0 and no
    // band applies. The old marginalBand() fell through its loop and returned
    // the LAST band's rate, reporting 44.65% (37% + FICA) for a taxpayer who
    // owes no federal income tax at all. The truth is FICA alone: 6.2% + 1.45%.
    expect(mr('US', 10000, '2026')).toBeCloseTo(0.0765, 6);
    expect(calcIncomeTax('US', 10000, '2026')!.taxable).toBe(0);
  });

  it('inside an offset phase-out, adds the withdrawal rate', () => {
    // AU LITO sheds 5c/$ from $37,500 and 1.5c/$ from $45,000. Reading the band
    // table alone reported a flat 18% across both zones.
    expect(mr('AU', 40000, '2025-26')).toBeCloseTo(0.16 + 0.05 + 0.02, 6);
    expect(mr('AU', 50000, '2025-26')).toBeCloseTo(0.30 + 0.015 + 0.02, 6);
  });

  it('inside a levy shade-in, uses the shading rate, not the headline rate', () => {
    // Medicare shades in at 10c/$ between $28,011 and $35,013 — five times its
    // 2% headline. A flat flatLevyRate could not express this.
    expect(mr('AU', 30000, '2025-26')).toBeCloseTo(0.16 + 0.10, 6);
    expect(mr('AU', 34000, '2025-26')).toBeCloseTo(0.16 + 0.10, 6);
  });

  it('is nil where no tax is payable at all', () => {
    expect(mr('AU', 15000, '2026-27')).toBe(0); // under the tax-free threshold
    expect(calcIncomeTax('AU', 0, '2026-27')!.marginalRate).toBe(0);
  });

  /**
   * Band endpoints. The rate must be the band the NEXT unit falls in, so at an
   * exact threshold the taxpayer is still on the lower band and one unit past
   * it they are on the higher one. Checked either side of every AU/NZ/US
   * boundary rather than at hand-picked incomes.
   */
  it('equals the band rate exactly, at and around every endpoint, where nothing else moves', () => {
    // NZ is the clean case: no deduction, no offsets, no levies, so the
    // differenced rate must equal the band rate to the last decimal — not
    // merely be monotonic. Any drift between the differencing and the table
    // shows up here with nothing else to hide behind.
    const bands = getIncomeTaxBands('NZ', '2025-26');
    for (let i = 0; i < bands.length; i++) {
      const edge = bands[i].upTo;
      if (edge == null) continue;
      // AT the endpoint the taxpayer is still in this band: the next dollar is
      // the first dollar of the band above.
      expect(mr('NZ', edge - 1, '2025-26')).toBeCloseTo(bands[i].rate, 9);
      expect(mr('NZ', edge, '2025-26')).toBeCloseTo(bands[i + 1].rate, 9);
      expect(mr('NZ', edge + 1, '2025-26')).toBeCloseTo(bands[i + 1].rate, 9);
    }
  });

  it('steps by the band delta at each AU endpoint, net of anything else changing there', () => {
    const bands = getIncomeTaxBands('AU', '2025-26');
    const step = (edge: number) => mr('AU', edge + 1, '2025-26') - mr('AU', edge - 1, '2025-26');

    // $18,200 — the tax-free threshold. Nothing steps at all: LITO ($700) still
    // covers the whole liability just above it, and the Medicare levy has not
    // started, so the taxpayer keeps every extra dollar.
    expect(step(18200)).toBeCloseTo(0, 9);

    // $45,000 — the band rises 16% → 30% (+14pp), but the LITO withdrawal
    // simultaneously EASES from 5c/$ to 1.5c/$ (−3.5pp). The net step is 10.5pp,
    // not the 14pp the band table alone would predict. This interaction is
    // precisely what a hand-written hook has to remember and differencing
    // cannot forget.
    expect(step(45000)).toBeCloseTo(bands[2].rate - bands[1].rate - 0.035, 9);
    expect(step(45000)).toBeCloseTo(0.105, 9);

    // Above $66,667 LITO is exhausted and Medicare is flat, so the remaining
    // endpoints step by the band delta exactly.
    expect(step(135000)).toBeCloseTo(bands[3].rate - bands[2].rate, 9); // 37% − 30%
    expect(step(190000)).toBeCloseTo(bands[4].rate - bands[3].rate, 9); // 45% − 37%
  });

  it('matches the band rate plus the flat levy wherever nothing else is moving', () => {
    // Away from deductions, phase-outs and shade-ins the differenced rate must
    // agree with the naive reading — otherwise differencing would be changing
    // answers that were already right.
    expect(mr('AU', 90000, '2025-26')).toBeCloseTo(0.32, 6);   // 30% + 2%
    expect(mr('AU', 200000, '2025-26')).toBeCloseTo(0.47, 6);  // 45% + 2%
    expect(mr('NZ', 80000, '2025-26')).toBeCloseTo(0.33, 6);   // no levies at all
  });

  it('UK marginal rate includes National Insurance', () => {
    expect(mr('GB', 40000, '2025-26')).toBeCloseTo(0.28, 6);
    expect(mr('GB', 60000, '2025-26')).toBeCloseTo(0.42, 6);
  });

  it('UK taper zone (£100k–£125,140) shows the 60%+ effective marginal', () => {
    // The taper sheds £1 of allowance per WHOLE £2 over £100,000 — a step
    // function with a £2 period. Differencing over £1 with the statutory floor
    // still applied lands on a flat tread and reports 42%; lifting the floor
    // for the marginal pass recovers the real 60% + 2% trap.
    expect(mr('GB', 110000, '2025-26')).toBeCloseTo(0.62, 6);
    expect(mr('GB', 110001, '2025-26')).toBeCloseTo(0.62, 6);
  });

  it('India marginal rate includes the 4% cess', () => {
    // ₹100 of extra slab tax carries only ₹0.6 of cess — invisible to a window
    // narrower than the rounding, which is why the window is not the fix.
    expect(mr('IN', 1500000, '2025-26 (AY 2026-27)')).toBeCloseTo(0.156, 6);
  });

  /**
   * India's Section 87A marginal relief produces a genuine ABOVE-100% marginal
   * band, and the rate is deliberately not clamped: relief caps total tax at
   * the taxable income over ₹12L, so every extra rupee inside the relief window
   * is taken in full, and the 4% cess is charged on top of it. Take-home
   * actually FALLS across this window. Clamping to 100% would report a cliff
   * the Income Tax Act does not have.
   */
  it('reports India s.87A marginal relief as the 104% band it actually is', () => {
    const inYear = '2025-26 (AY 2026-27)';
    expect(mr('IN', 1270000, inYear)).toBeCloseTo(0, 9);     // relief still fully absorbing
    expect(mr('IN', 1275000, inYear)).toBeCloseTo(1.04, 9);  // 100% + 4% cess
    expect(mr('IN', 1300000, inYear)).toBeCloseTo(1.04, 9);
    expect(mr('IN', 1350000, inYear)).toBeCloseTo(0.156, 9); // relief exhausted, ordinary slab

    // The cliff is real, not a display artefact: take-home goes DOWN.
    const before = calcIncomeTax('IN', 1275000, inYear)!.takeHome;
    const after = calcIncomeTax('IN', 1280000, inYear)!.takeHome;
    expect(after).toBeLessThan(before);
  });

  it('is never negative — swept across every band edge and every India surcharge threshold', () => {
    // Deliberately NOT an upper bound: see the India relief test above. A
    // negative rate would mean an extra unit of income CUT the tax bill, which
    // no schedule here does.
    //
    // The probe set is derived from the schedules rather than picked, so it
    // cannot quietly stop short of a threshold the way a bare `g <= 400000`
    // loop did — that loop never reached India's relief window at all.
    const expectNonNegative = (code: string, gross: number, year?: string) => {
      const rate = calcIncomeTax(code, gross, year)!.marginalRate;
      if (rate < 0) throw new Error(`${code} @ ${gross}${year ? ` (${year})` : ''}: ${rate}`);
    };

    for (const code of listIncomeTaxCountries()) {
      for (const year of getIncomeTaxYears(code)) {
        // A coarse sweep for the ordinary range...
        for (let g = 0; g <= 2000000; g += 2500) expectNonNegative(code, g, year.value);

        // ...and dense probes either side of every band edge, where a
        // discontinuity would live if one existed.
        const deduction = 500000 - calcIncomeTax(code, 500000, year.value)!.taxable;
        for (const b of getIncomeTaxBands(code, year.value)) {
          if (b.upTo == null) continue;
          for (const d of [-2, -1, 0, 1, 2]) expectNonNegative(code, b.upTo + deduction + d, year.value);
        }
      }
    }

    // India's surcharge steps at ₹50L / ₹1Cr / ₹2Cr of TAXABLE income, each
    // with its own marginal-relief window — far outside the coarse sweep and
    // not band edges, so they need naming explicitly.
    const inYear = '2025-26 (AY 2026-27)';
    const inDeduction = 75000;
    for (const threshold of [5000000, 10000000, 20000000]) {
      for (let g = threshold + inDeduction - 5000; g <= threshold + inDeduction + 300000; g += 1000) {
        expectNonNegative('IN', g, inYear);
      }
    }
  });

  it('India surcharge thresholds each open their own marginal-relief window', () => {
    // Same mechanism as the s.87A window: relief caps the surcharge step at the
    // income that triggered it, so the rate is 104% until the relief is spent.
    const inYear = '2025-26 (AY 2026-27)';
    for (const threshold of [5000000, 10000000, 20000000]) {
      expect(calcIncomeTax('IN', threshold + 75000, inYear)!.taxable).toBe(threshold);
      expect(mr('IN', threshold + 75000, inYear)).toBeCloseTo(1.04, 9);
    }
  });
});
