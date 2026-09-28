/**
 * The shared decision contract — @ai2/tax-plugins
 * ai2fin.com
 *
 * scenarioFromYears must date a scenario exactly as the app's adapter did
 * (client/src/utils/homeDecisions.ts), inputSpecs must match the guards'
 * bounds, and the handoff codec must round-trip, stay strict, and never throw
 * on anything a URL can carry.
 */

import {
  INPUT_SPECS,
  HANDOFF_MAX_AMOUNT,
  HANDOFF_MAX_LENGTH,
  MAX_HOURS_PER_YEAR,
  MAX_WEEKS_PER_YEAR,
  decodeHandoff,
  encodeHandoff,
  handoffFields,
  handoffProblemsOf,
  homeBusinessSpaceTradeoff,
  lodgerScenario,
  movingScenario,
  spaceScenario,
  DecisionInputError,
  type HandoffV1,
  type HomeBusinessSpaceResult,
  type InputSpec,
} from '../src';

// ─── scenarioFromYears — parity with the app adapter ────────────────────────

describe('spaceScenario', () => {
  const base = { years: 4, businessSharePct: 35, occupancyCostsPerYear: 9600, expectedGrowth: 50_000, marginalRatePct: 32 };

  it('business use from 1 July of the current income year; sale on 30 June after `years`', () => {
    const { input, problems } = spaceScenario(base, '2023-09-15');
    expect(problems).toEqual([]);
    expect(input).toMatchObject({ incomeYear: '2023-24', businessUseStart: '2023-07-01', saleDate: '2027-06-30', runningCostsPerYear: 0, ownershipPct: 100, country: 'AU' });
  });

  it('a day before 1 July belongs to the previous income year', () => {
    expect(spaceScenario(base, '2024-06-30').input).toMatchObject({ incomeYear: '2023-24', businessUseStart: '2023-07-01', saleDate: '2027-06-30' });
    expect(spaceScenario(base, '2024-07-01').input).toMatchObject({ incomeYear: '2024-25', businessUseStart: '2024-07-01', saleDate: '2028-06-30' });
  });

  it('reads a Date by its local calendar day', () => {
    expect(spaceScenario(base, new Date(2024, 6, 1)).input.businessUseStart).toBe('2024-07-01');
  });

  it('gives the brief\'s worked figures when run', () => {
    const r = homeBusinessSpaceTradeoff(spaceScenario(base, '2023-09-15').input) as HomeBusinessSpaceResult;
    expect(r.extraDeductions.taxValue).toBe(4300.8);
    expect(r.cgt.currentLaw.tax).toBe(2800);
    expect(r.breakEvenGrowth.currentLaw).toBe(76_800);
  });

  it('reports fractional years and guard problems instead of computing', () => {
    expect(spaceScenario({ ...base, years: 2.5 }, '2023-09-15').problems.map((p) => p.field)).toEqual(['years']);
    expect(spaceScenario({ ...base, workHoursPerYear: 1_000_000, runningCostPerHour: 0.7 }, '2023-09-15').problems.map((p) => p.field)).toEqual(['workHoursPerYear']);
  });
});

describe('movingScenario', () => {
  const s = {
    years: 3,
    marginalRatePct: 37,
    leaving: { name: 'Old', growth: 100_000, ownershipPct: 50, producesIncome: true },
    moving: { name: 'New', growth: 80_000 },
  };

  it('moves out and settles today, sells both `years` later, rents the old home from today, applies the ownership share', () => {
    const { input, problems } = movingScenario(s, '2024-02-29');
    expect(problems).toEqual([]);
    expect(input.homes[0]).toEqual({ name: 'Old', ownedFrom: '2024-02-29', movedOut: '2024-02-29', rentedFrom: '2024-02-29', expectedGrowth: 50_000 });
    expect(input.homes[1]).toEqual({ name: 'New', ownedFrom: '2024-02-29', expectedGrowth: 80_000 });
    // 29 February + 3 years is clamped to 28 February, as the app did.
    expect(input.saleDates).toEqual({ Old: '2027-02-28', New: '2027-02-28' });
  });

  it('no rentedFrom when the old home earns nothing', () => {
    expect(movingScenario({ ...s, leaving: { ...s.leaving, producesIncome: false } }, '2024-01-01').input.homes[0].rentedFrom).toBeUndefined();
  });

  it('two homes with one name are a problem, not a silent merge', () => {
    expect(movingScenario({ ...s, moving: { name: 'Old', growth: 1 } }, '2024-01-01').problems.map((p) => p.field)).toContain('homes');
  });
});

describe('lodgerScenario', () => {
  const s = { years: 5, marginalRatePct: 32, weeklyRent: 250, letSharePct: 35, homeCostsPerYear: 10_000, ownershipPct: 50, expectedGrowth: 100_000 };

  it('lets from today, sells `years` later, grosses your share of costs back up to the whole home', () => {
    const { input, problems } = lodgerScenario(s, '2025-03-10');
    expect(problems).toEqual([]);
    expect(input).toMatchObject({ kind: 'lodger', firstLetDate: '2025-03-10', saleDate: '2030-03-10', homeCostsPerYear: 20_000, ownershipPct: 50, letSharePct: 35 });
  });

  it('room and shared areas: the shared area counts half (the ATO\'s Thomas example: 20% + 30% ÷ 2)', () => {
    const { input } = lodgerScenario({ ...s, letSharePct: undefined, exclusivePct: 20, sharedPct: 30 }, '2025-03-10');
    expect(input).toMatchObject({ exclusivePct: 20, sharedPct: 30, sharedBy: 2 });
  });

  it('no share of the home is a problem, as the app treated it', () => {
    expect(lodgerScenario({ ...s, ownershipPct: 0 }, '2025-03-10').problems.map((p) => p.field)).toContain('ownershipPct');
  });
});

// ─── inputSpecs — parity with the guards ────────────────────────────────────

describe('INPUT_SPECS bounds are the guards\' bounds', () => {
  const at = '2023-09-15';
  const spaceBase = { years: 4, businessSharePct: 35, occupancyCostsPerYear: 9600, expectedGrowth: 50_000, marginalRatePct: 32 };
  const someoneBase = { years: 5, marginalRatePct: 32, weeklyRent: 250, exclusivePct: 20, sharedPct: 30, homeCostsPerYear: 10_000, expectedGrowth: 100_000 };
  const movingBase = { years: 3, marginalRatePct: 37, leaving: { name: 'Old', growth: 1 }, moving: { name: 'New', growth: 1 } };

  /** Run a value through the scenario + guards for one decision field; true when accepted. */
  const accepts: Record<string, (field: string, v: number) => boolean> = {
    space: (field, v) => {
      const extra = field === 'workHoursPerYear' ? { runningCostPerHour: 0.7 } : field === 'runningCostPerHour' ? { workHoursPerYear: 100 } : {};
      return spaceScenario({ ...spaceBase, ...extra, [field]: v }, at).problems.length === 0;
    },
    // With the room at its own bound, leave no shared area: room + shared ÷ 2 must not pass 100% on its own account.
    someone: (field, v) => lodgerScenario({ ...someoneBase, ...(field === 'exclusivePct' ? { sharedPct: 0 } : {}), [field]: v }, at).problems.length === 0,
    moving: (field, v) => {
      if (field === 'leavingGrowth') return movingScenario({ ...movingBase, leaving: { name: 'Old', growth: v } }, at).problems.length === 0;
      if (field === 'movingGrowth') return movingScenario({ ...movingBase, moving: { name: 'New', growth: v } }, at).problems.length === 0;
      return movingScenario({ ...movingBase, [field]: v }, at).problems.length === 0;
    },
  };

  const cases: Array<[string, string, InputSpec]> = [];
  for (const [kind, fields] of Object.entries(INPUT_SPECS)) {
    for (const [field, spec] of Object.entries(fields)) if (spec.unit !== 'boolean') cases.push([kind, field, spec]);
  }

  it.each(cases)('%s.%s', (kind, field, spec) => {
    const ok = (v: number) => accepts[kind](field, v);
    if (spec.min !== null) {
      expect({ v: spec.min, ok: ok(spec.min) }).toEqual({ v: spec.min, ok: true });
      expect({ v: spec.min - 0.5, ok: ok(spec.min - 0.5) }).toEqual({ v: spec.min - 0.5, ok: false });
    }
    if (spec.max !== null) {
      expect({ v: spec.max, ok: ok(spec.max) }).toEqual({ v: spec.max, ok: true });
      expect({ v: spec.max + 0.5, ok: ok(spec.max + 0.5) }).toEqual({ v: spec.max + 0.5, ok: false });
    }
    if (spec.integer) expect(ok((spec.min ?? 1) + 0.5)).toBe(false);
  });

  it('uses the guards\' constants for hours and weeks', () => {
    expect(INPUT_SPECS.space.workHoursPerYear.max).toBe(MAX_HOURS_PER_YEAR);
    expect(INPUT_SPECS.someone.weeksLetPerYear.max).toBe(MAX_WEEKS_PER_YEAR);
  });

  it('every spec has a label, hint and handoff key; rule keys are real rules', () => {
    for (const fields of Object.values(INPUT_SPECS)) {
      for (const spec of Object.values(fields)) {
        expect(spec.label.length).toBeGreaterThan(0);
        expect(spec.hint.length).toBeGreaterThan(0);
        expect(spec.handoffKey).toMatch(/^[a-z]{1,2}$/);
      }
    }
  });
});

// ─── The handoff codec ──────────────────────────────────────────────────────

const space: HandoffV1 = { v: 1, t: 'space', mr: 32, s: { sh: 35, oc: 9600, hr: 1000, y: 4, g: 50_000, co: 0.7, os: 100 } };
const moving: HandoffV1 = { v: 1, t: 'moving', mr: 37, m: { y: 3, r: 1, og: 100_000, ng: 80_000 } };
const someone: HandoffV1 = { v: 1, t: 'someone', mr: 30, o: { wk: 250, rm: 20, cm: 30, wh: 52, hc: 10_000, y: 5, g: 100_000 } };

describe('handoff: round trip', () => {
  it.each([space, moving, someone])('$t', (p) => {
    const token = encodeHandoff(p);
    expect(token.startsWith('1.')).toBe(true);
    expect(token).toMatch(/^1\.[A-Za-z0-9_-]+$/); // URL-safe, no padding
    expect(token.length).toBeLessThanOrEqual(HANDOFF_MAX_LENGTH);
    expect(decodeHandoff(token)).toEqual({ ok: true, payload: p, problems: [] });
  });

  it('maps a payload to the scenario fields a form pre-fills', () => {
    expect(handoffFields(space)).toEqual({ marginalRatePct: 32, businessSharePct: 35, occupancyCostsPerYear: 9600, workHoursPerYear: 1000, runningCostPerHour: 0.7, years: 4, expectedGrowth: 50_000, ownershipPct: 100 });
    expect(handoffFields(moving)).toEqual({ marginalRatePct: 37, years: 3, producesIncome: true, leavingGrowth: 100_000, movingGrowth: 80_000 });
  });

  it('a decoded space payload runs through spaceScenario without problems', () => {
    const d = decodeHandoff(encodeHandoff(space));
    if (!d.ok) throw new Error('decode failed');
    const f = handoffFields(d.payload) as Record<string, number>;
    const { problems } = spaceScenario(f as never, '2023-09-15');
    expect(problems).toEqual([]);
  });
});

describe('handoff: strict', () => {
  it('encode refuses out-of-bounds values, unknown keys, other sections and free text', () => {
    const refuse = (p: unknown) => {
      try {
        encodeHandoff(p as HandoffV1);
      } catch (e) {
        expect(e).toBeInstanceOf(DecisionInputError);
        return (e as DecisionInputError).problems.map((x) => x.field);
      }
      throw new Error('expected a refusal');
    };
    expect(refuse({ ...space, s: { ...space.s, hr: 1_000_000 } })).toEqual(['s.hr']);
    expect(refuse({ ...space, mr: 120 })).toEqual(['mr']);
    expect(refuse({ ...space, s: { ...space.s, y: 2.5 } })).toEqual(['s.y']);
    expect(refuse({ ...someone, o: { ...someone.o, wh: 53 } })).toEqual(['o.wh']);
    expect(refuse({ ...space, s: { ...space.s, oc: HANDOFF_MAX_AMOUNT + 1 } })).toEqual(['s.oc']);
    expect(refuse({ ...space, s: { ...space.s, note: 'my address' } })).toEqual(['s.note']);
    expect(refuse({ ...space, name: 'Jane' })).toEqual(['name']);
    expect(refuse({ ...space, m: moving.m })).toEqual(['m']);
    expect(refuse({ ...moving, m: { ...moving.m, r: true } })).toEqual(['m.r']);
    expect(handoffProblemsOf(space)).toEqual([]);
  });

  it('decode drops unknown keys and other sections silently, drops invalid fields and reports them', () => {
    const raw = { v: 1, t: 'space', mr: 32, extra: 'x', m: { y: 3 }, s: { sh: 35, hr: 9000, zz: 1, g: -5 } };
    const token = '1.' + Buffer.from(JSON.stringify(raw)).toString('base64url');
    const d = decodeHandoff(token);
    expect(d).toEqual({
      ok: true,
      payload: { v: 1, t: 'space', mr: 32, s: { sh: 35 } },
      problems: [expect.objectContaining({ field: 's.hr' }), expect.objectContaining({ field: 's.g' })],
    });
  });

  it('decode rejects a wrong version, tag, prefix, length, base64 or JSON', () => {
    const b64 = (o: unknown) => '1.' + Buffer.from(JSON.stringify(o)).toString('base64url');
    expect(decodeHandoff(b64({ v: 2, t: 'space' }))).toMatchObject({ ok: false, problems: [{ field: 'v' }] });
    expect(decodeHandoff(b64({ v: 1, t: 'lottery' }))).toMatchObject({ ok: false, problems: [{ field: 't' }] });
    expect(decodeHandoff(b64([1, 2]))).toMatchObject({ ok: false });
    expect(decodeHandoff('2.' + b64({ v: 1, t: 'space' }).slice(2))).toMatchObject({ ok: false, problems: [{ field: 'token' }] });
    expect(decodeHandoff('1.' + 'A'.repeat(HANDOFF_MAX_LENGTH))).toMatchObject({ ok: false, problems: [{ field: 'token' }] });
    expect(decodeHandoff('1.***')).toMatchObject({ ok: false, problems: [{ field: 'token', message: 'not base64url' }] });
    expect(decodeHandoff('1.' + Buffer.from('{not json').toString('base64url'))).toMatchObject({ ok: false, problems: [{ message: 'not JSON' }] });
    expect(decodeHandoff(undefined)).toMatchObject({ ok: false });
  });

  it('the codec\'s base64url agrees with Node\'s', () => {
    const json = JSON.stringify(someone);
    expect(encodeHandoff(someone)).toBe('1.' + Buffer.from(json).toString('base64url'));
  });
});

describe('handoff: fuzzed decode never throws', () => {
  // A small deterministic PRNG so a failure reproduces.
  let seed = 20260928;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const value = (depth = 0): unknown => {
    const r = rnd();
    if (depth > 2 || r < 0.3) return pick([0, 1, -1, 1e308, -1e308, NaN, 2.5, 8761, 53, 'x', '', null, true, false]);
    if (r < 0.6) return Array.from({ length: Math.floor(rnd() * 4) }, () => value(depth + 1));
    const o: Record<string, unknown> = {};
    for (let i = 0; i < Math.floor(rnd() * 6); i++) o[pick(['v', 't', 'mr', 's', 'm', 'o', 'sh', 'hr', 'y', 'r', 'wk', '__proto__', 'constructor', 'zz'])] = value(depth + 1);
    return o;
  };

  it('3,000 random tokens and payloads', () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.=+/%*é\u{1F600}';
    for (let i = 0; i < 1500; i++) {
      const junk = '1.' + Array.from({ length: Math.floor(rnd() * 80) }, () => pick([...chars])).join('');
      expect(() => decodeHandoff(junk)).not.toThrow();
      const obj = { v: pick([1, 1, 1, 2, '1']), t: pick(['space', 'moving', 'someone', 'x', 1]), ...(value() as object) };
      const token = '1.' + Buffer.from(JSON.stringify(obj) ?? 'null').toString('base64url');
      const d = decodeHandoff(token);
      if (d.ok) {
        // Whatever survives decoding is itself a valid payload that re-encodes.
        expect(handoffProblemsOf(d.payload)).toEqual([]);
        expect(() => encodeHandoff(d.payload)).not.toThrow();
      }
    }
    for (const weird of [null, 0, {}, [], '1.', '1', '', '1.=', '1.A', '1.AA', '1.AAA=']) expect(() => decodeHandoff(weird)).not.toThrow();
  });
});
