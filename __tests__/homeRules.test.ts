/**
 * Home rules by country — @ai2/tax-plugins
 * ai2fin.com
 *
 * Figures are asserted as the authority's page states them (read 28 September
 * 2026, UTC). AU is asserted against the app's current behaviour
 * (lib/propertyRules homeTreatmentFor / incomeShareForCgt and the Home use
 * section), so switching the app to this data changes nothing it asks or
 * computes.
 */

import * as pkg from '../src';
import {
  allFigures,
  homeQuestionsFor,
  homeRulesFor,
  shouldAsk,
  GB_RENT_A_ROOM_ROWS,
  NZ_BOARDER_STANDARD_COST_ROWS,
  NZ_SQUARE_METRE_RATE_ROWS,
  US_SIMPLIFIED_METHOD_ROWS,
  type HomeRules,
  type HomeRuleQuestion,
} from '../src';
import { analyzeDeductionRates, shippedDeductionSeries } from '../src/rateWatch';
import { gbTaxYear, nzIncomeYear } from '../src/decisions/homeRuleRates';

const rules = (c: string) => {
  const r = homeRulesFor(c);
  if (!r.supported) throw new Error(`${c} unsupported`);
  return r;
};
const q = (r: HomeRules, id: string) => {
  const found = r.questions.find((x) => x.id === id);
  if (!found) throw new Error(`no question ${id}`);
  return found;
};
const opt = (question: HomeRuleQuestion, id: string) => {
  const found = question.options.find((o) => o.id === id);
  if (!found) throw new Error(`no option ${id}`);
  return found;
};
const amounts = (o: { effects: { deduction: { figures?: Array<{ amount: number }> }; sale: { figures?: Array<{ amount: number }> } } }) => [
  ...(o.effects.deduction.figures ?? []).map((f) => f.amount),
  ...(o.effects.sale.figures ?? []).map((f) => f.amount),
];

const COUNTRIES = ['AU', 'GB', 'US', 'CA', 'NZ', 'IN'];

// ─── Every country ──────────────────────────────────────────────────────────

describe('homeRulesFor — shape and citations', () => {
  it.each(COUNTRIES)('%s: every figure and every effect has a citation with a read date', (c) => {
    const r = rules(c);
    expect(r.questions.length).toBeGreaterThan(0);
    for (const { path, figure } of allFigures(r)) {
      expect({ path, url: figure.citation.url }).toEqual({ path, url: expect.stringMatching(/^https:\/\//) });
      expect({ path, readOn: figure.citation.readOn }).toEqual({ path, readOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
      expect(Number.isFinite(figure.amount)).toBe(true);
    }
    for (const question of r.questions) {
      expect(question.options.length).toBeGreaterThan(0);
      for (const o of question.options) {
        expect(o.effects.deduction.citation.url).toMatch(/^https:\/\//);
        expect(o.effects.sale.citation.url).toMatch(/^https:\/\//);
      }
    }
  });

  it.each(COUNTRIES)('%s: a note that is not verified is always for an accountant and has no number in a question', (c) => {
    for (const n of rules(c).notes) {
      if (n.status !== 'verified') expect({ id: n.id, forAccountant: n.forAccountant }).toEqual({ id: n.id, forAccountant: true });
    }
  });

  it('unknown countries are unsupported; UK is accepted for GB; results are copies', () => {
    expect(homeRulesFor('ZZ')).toEqual({ supported: false, country: 'ZZ' });
    expect(rules('uk').country).toBe('GB');
    const a = rules('AU');
    a.questions.length = 0;
    expect(rules('AU').questions.length).toBeGreaterThan(0);
  });

  it('is exported from the package index', () => {
    expect(pkg.homeRulesFor).toBe(homeRulesFor);
    expect(pkg.homeQuestionsFor).toBe(homeQuestionsFor);
  });
});

// ─── AU: the app's behaviour today ──────────────────────────────────────────

describe('AU — encoded as the app behaves today', () => {
  const au = rules('AU');

  it('no taxpayer-role question: it does not change the answer in AU', () => {
    expect(au.questions.map((x) => x.id)).not.toContain('taxpayerRole');
  });

  it('asks business use for a home with a business share, and keeps showing an answer given on another kind', () => {
    const bu = q(au, 'businessUse');
    expect(bu.field).toBe('businessUse');
    expect(bu.options.map((o) => o.id)).toEqual(['home_office', 'place_of_business']); // BUSINESS_USES
    expect(shouldAsk(bu, { kind: 'home', businessPercent: 20 })).toBe(true);
    expect(shouldAsk(bu, { kind: 'home', businessPercent: 0 })).toBe(false);
    expect(shouldAsk(bu, { kind: 'rental', businessPercent: 20 })).toBe(false);
    expect(shouldAsk(bu, { kind: 'rental', businessPercent: 20 }, true)).toBe(true); // isHome || Boolean(place.businessUse)
  });

  it('home office: running costs only, exemption unaffected; place of business: occupancy at share, reduced by share', () => {
    const bu = q(au, 'businessUse');
    expect(opt(bu, 'home_office').effects.deduction.basis).toBe('running_only'); // businessShareRunningOnly
    expect(opt(bu, 'home_office').effects.sale.effect).toBe('exemption_unaffected'); // incomeShareForCgt: business not counted
    expect(opt(bu, 'place_of_business').effects.deduction.basis).toBe('occupancy_at_share');
    expect(opt(bu, 'place_of_business').effects.sale.effect).toBe('reduced_by_share');
  });

  it('rental arrangement: home → domestic | commercial; other kinds → commercial | below_market (same field)', () => {
    const home = q(au, 'homeRentalArrangement');
    const other = q(au, 'propertyRentalArrangement');
    expect(home.field).toBe('rentalArrangement');
    expect(other.field).toBe('rentalArrangement');
    expect(home.options.map((o) => o.id)).toEqual(['domestic', 'commercial']);
    expect(other.options.map((o) => o.id)).toEqual(['commercial', 'below_market']);
    expect(homeQuestionsFor('AU', { kind: 'home', rentalPercent: 30 }).map((x) => x.id)).toEqual(['homeRentalArrangement']);
    expect(homeQuestionsFor('AU', { kind: 'rental', rentalPercent: 100 }).map((x) => x.id)).toEqual(['propertyRentalArrangement']);
    expect(homeQuestionsFor('AU', { kind: null, rentalPercent: 100 }).map((x) => x.id)).toEqual(['propertyRentalArrangement']);
    // Domestic is not rent and leaves the exemption whole (rentalIsDomestic); commercial reduces it by the share.
    expect(opt(home, 'domestic').effects).toMatchObject({ deduction: { basis: 'none' }, sale: { effect: 'exemption_unaffected' } });
    expect(opt(home, 'commercial').effects).toMatchObject({ deduction: { basis: 'occupancy_at_share' }, sale: { effect: 'reduced_by_share' } });
  });

  it('carries no numbers: the fixed rate lives in workFromHomeFixedRate', () => {
    expect(allFigures(au)).toEqual([]);
  });
});

// ─── GB ─────────────────────────────────────────────────────────────────────

describe('GB', () => {
  const gb = rules('GB');

  it('asks the taxpayer role, then exclusive use only of the self-employed', () => {
    expect(homeQuestionsFor('GB', { kind: 'home', businessPercent: 10 }).map((x) => x.id)).toEqual(['taxpayerRole']);
    expect(homeQuestionsFor('GB', { kind: 'home', businessPercent: 10, taxpayerRole: 'self_employed' }).map((x) => x.id)).toEqual(['taxpayerRole', 'exclusiveBusinessUse']);
    expect(homeQuestionsFor('GB', { kind: 'home', businessPercent: 10, taxpayerRole: 'employee' }).map((x) => x.id)).toEqual(['taxpayerRole']);
  });

  it('employee: no deduction from 2026-27 (s360B), £6 a week up to 2025-26', () => {
    const e = opt(q(gb, 'taxpayerRole'), 'employee');
    expect(e.effects.deduction.basis).toBe('none');
    expect(e.effects.deduction.figures).toEqual([expect.objectContaining({ amount: 6, currency: 'GBP', per: 'week', appliesTo: '2025-26 and earlier' })]);
  });

  it('self-employed flat rates £10 / £18 / £26 a month', () => {
    expect(amounts(opt(q(gb, 'taxpayerRole'), 'self_employed'))).toEqual([10, 18, 26]);
  });

  it('exclusive business room: fixed costs at share, PRR reduced by VALUE share; not exclusive: running only, PRR intact', () => {
    const ex = q(gb, 'exclusiveBusinessUse');
    expect(opt(ex, 'exclusive').effects).toMatchObject({ deduction: { basis: 'occupancy_at_share' }, sale: { effect: 'reduced_by_value_share' } });
    expect(opt(ex, 'not_exclusive').effects).toMatchObject({ deduction: { basis: 'running_only' }, sale: { effect: 'exemption_unaffected' } });
  });

  it('Rent a Room £7,500 (£3,750 shared); one lodger leaves PRR intact; several lodgers: lettings relief cap £40,000', () => {
    const l = q(gb, 'homeLodgers');
    expect(amounts(opt(l, 'single_lodger'))).toEqual([7500, 3750]);
    expect(opt(l, 'single_lodger').effects.sale.effect).toBe('exemption_unaffected');
    expect(amounts(opt(l, 'several_lodgers'))).toEqual([7500, 40000]);
    expect(opt(l, 'several_lodgers').effects.sale.effect).toBe('reduced_by_share');
    expect(opt(l, 'self_contained_let').effects.deduction.figures).toBeUndefined(); // no Rent a Room for a separate flat
  });

  it('the Rent a Room figures come from the verified rate row: the limit, and half of it when shared', () => {
    const row = GB_RENT_A_ROOM_ROWS.find((r) => r.verified)!;
    expect(row.value).toBe(7500);
    const [full, shared] = opt(q(gb, 'homeLodgers'), 'single_lodger').effects.deduction.figures!;
    expect(full).toMatchObject({ amount: row.value, citation: { url: row.sourceUrl, readOn: row.readOn } });
    expect(shared).toMatchObject({ amount: (row.value as number) / 2, citation: { url: row.sourceUrl, readOn: row.readOn } });
  });

  it('no director branch: that is an accountant note (search excerpt)', () => {
    expect(q(gb, 'taxpayerRole').options.map((o) => o.id)).not.toContain('company');
    expect(gb.notes.find((n) => n.id === 'gb-director')).toMatchObject({ forAccountant: true, status: 'search-excerpt' });
  });
});

// ─── US ─────────────────────────────────────────────────────────────────────

describe('US', () => {
  const us = rules('US');

  it('employee: no home office deduction', () => {
    expect(opt(q(us, 'taxpayerRole'), 'employee').effects.deduction.basis).toBe('none');
  });

  it('regular and exclusive use: $5 per sq ft up to 300 sq ft (simplified) or actual costs with depreciation recaptured', () => {
    const r = q(us, 'regularExclusiveUse');
    expect(r.askWhen.roles).toEqual(['self_employed']);
    const simple = opt(r, 'yes_simplified');
    expect(simple.effects.deduction.basis).toBe('flat_rate');
    expect(simple.effects.deduction.figures!.map((f) => [f.amount, f.per])).toEqual([[5, 'sq_ft'], [300, null]]);
    expect(simple.effects.sale.effect).toBe('exemption_unaffected'); // depreciation treated as zero
    const regular = opt(r, 'yes_regular');
    expect(regular.effects).toMatchObject({ deduction: { basis: 'occupancy_at_share' }, sale: { effect: 'depreciation_recaptured' } });
    expect(opt(r, 'no').effects.deduction.basis).toBe('none');
  });

  it('§121: $250,000, or $500,000 married filing jointly — not reduced for an in-home office, only depreciation is taxed', () => {
    expect(opt(q(us, 'regularExclusiveUse'), 'yes_regular').effects.sale.figures!.map((f) => f.amount)).toEqual([250000, 500000]);
  });

  it('a lodger: rental income with depreciation recaptured; under 15 days: ignored', () => {
    const l = q(us, 'homeLodgers');
    expect(opt(l, 'lodger').effects.sale.effect).toBe('depreciation_recaptured');
    expect(opt(l, 'under_15_days').effects.deduction.basis).toBe('none');
  });
});

// ─── CA ─────────────────────────────────────────────────────────────────────

describe('CA', () => {
  const ca = rules('CA');

  it('employee → the T2200 question; self-employed → the principal-place question', () => {
    expect(homeQuestionsFor('CA', { kind: 'home', businessPercent: 10, taxpayerRole: 'employee' }).map((x) => x.id)).toEqual(['taxpayerRole', 'employeeWorkSpace']);
    expect(homeQuestionsFor('CA', { kind: 'home', businessPercent: 10, taxpayerRole: 'self_employed' }).map((x) => x.id)).toEqual(['taxpayerRole', 'selfEmployedWorkSpace']);
  });

  it('T2200: salaried running costs, commission adds tax and insurance; the principal residence exemption stays intact', () => {
    const e = q(ca, 'employeeWorkSpace');
    expect(opt(e, 't2200_salaried').effects).toMatchObject({ deduction: { basis: 'running_only' }, sale: { effect: 'exemption_unaffected' } });
    expect(opt(e, 't2200_commission').effects.deduction.basis).toBe('occupancy_at_share');
    expect(opt(e, 'not_met').effects.deduction.basis).toBe('none');
  });

  it('minor (ancillary) use without CCA leaves the PRE intact; CCA or a structural change reduces it', () => {
    const s = q(ca, 'selfEmployedWorkSpace');
    expect(opt(s, 'yes_no_cca').effects.sale.effect).toBe('exemption_unaffected');
    expect(opt(s, 'yes_with_cca').effects.sale.effect).toBe('reduced_by_share');
    const l = q(ca, 'homeLodgers');
    expect(opt(l, 'family_upkeep').effects).toMatchObject({ deduction: { basis: 'none' }, sale: { effect: 'exemption_unaffected' } });
    expect(opt(l, 'room_tenants').effects.sale.effect).toBe('exemption_unaffected');
    expect(opt(l, 'structural_or_cca').effects.sale.effect).toBe('reduced_by_share');
  });

  it('no flat rate: the temporary method ended with 2022', () => {
    expect(allFigures(ca)).toEqual([]);
  });
});

// ─── NZ ─────────────────────────────────────────────────────────────────────

describe('NZ', () => {
  const nz = rules('NZ');

  it('no capital gains tax outside the bright-line: every sale effect is not applicable', () => {
    for (const question of nz.questions) for (const o of question.options) expect(o.effects.sale.effect).toBe('not_applicable');
  });

  it('employee: nothing; company: a fair reimbursement, exempt to you', () => {
    const r = q(nz, 'taxpayerRole');
    expect(opt(r, 'employee').effects.deduction.basis).toBe('none');
    expect(opt(r, 'company').effects.deduction.note).toMatch(/fair reimbursement/);
  });

  it('square-metre rate $57.30 for the 2026 income year', () => {
    const f = opt(q(nz, 'homeOfficeMethod'), 'square_metre_rate').effects.deduction.figures!;
    expect(f).toEqual([expect.objectContaining({ amount: 57.3, currency: 'NZD', per: 'sq_m', appliesTo: expect.stringMatching(/2026 income year/) })]);
  });

  it('boarders: standard cost $245 per boarder per week for 1 to 4', () => {
    expect(amounts(opt(q(nz, 'homeLodgers'), 'boarders_1_to_4'))).toEqual([245]);
    expect(opt(q(nz, 'homeLodgers'), 'boarders_5_plus').effects.deduction.figures).toBeUndefined();
  });

  it('the $55.60 2025 rate from a search excerpt is not a number anywhere', () => {
    expect(NZ_SQUARE_METRE_RATE_ROWS.find((r) => r.effectiveFrom === '2024-04-01')).toMatchObject({ value: null, verified: false });
    expect(JSON.stringify(nz)).not.toMatch(/55\.6/);
  });
});

// ─── IN ─────────────────────────────────────────────────────────────────────

describe('IN', () => {
  const inr = rules('IN');

  it('only the let-out question: 30% standard deduction, no main-residence exemption to reduce', () => {
    expect(inr.questions.map((x) => x.id)).toEqual(['homeLetOut']);
    const o = opt(q(inr, 'homeLetOut'), 'let_out');
    expect(o.effects.deduction.figures!.map((f) => [f.amount, f.per])).toEqual([[30, 'percent_of_value']]);
    expect(o.effects.sale.effect).toBe('not_applicable');
  });

  it('salaried: no home office; sale: no exemption, s54 reinvestment noted', () => {
    expect(inr.notes.find((n) => n.id === 'in-no-home-office')).toMatchObject({ status: 'verified' });
    expect(inr.notes.find((n) => n.id === 'in-no-main-residence-exemption')!.text).toMatch(/s54/);
  });

  it('the 2025 Act renumbering: only s202 and s58 are named as confirmed', () => {
    const t = inr.notes.find((n) => n.id === 'in-new-act')!.text;
    expect(t).toMatch(/s115BAC → s202/);
    expect(t).toMatch(/s58/);
    expect(t).toMatch(/not confirmed/);
  });

  it('business use of the home is an accountant note, not a branch', () => {
    expect(inr.notes.find((n) => n.id === 'in-business-use')).toMatchObject({ forAccountant: true, status: 'search-excerpt' });
  });
});

// ─── Rate Watch ─────────────────────────────────────────────────────────────

describe('Rate Watch — the home-rule figures', () => {
  const home = () => shippedDeductionSeries().filter((s) => s.countryCode !== 'AU');

  it('as of 28 September 2026: flags the years with no verified figure, and nothing is stale', () => {
    const f = analyzeDeductionRates('2026-09-28', {}, home());
    expect(f.unverifiedCurrent.map((u) => `${u.series}:${u.incomeYear}`).sort()).toEqual([
      'NZ.boarderStandardCost:2027 income year',
      'NZ.homeOfficeSquareMetreRate:2027 income year',
      'US.homeOfficeSimplifiedMethod:2026',
    ]);
    expect(f.staleCitations).toEqual([]);
  });

  it('GB Rent a Room is current and verified for 2026-27', () => {
    const f = analyzeDeductionRates('2026-09-28', {}, home().filter((s) => s.series === 'GB.rentARoom'));
    expect(f.unverifiedCurrent).toEqual([]);
  });

  it('year labels follow each country\'s tax year', () => {
    expect(gbTaxYear('2026-04-05')).toBe('2025-26');
    expect(gbTaxYear('2026-04-06')).toBe('2026-27');
    expect(nzIncomeYear('2026-03-31')).toBe('2026 income year');
    expect(nzIncomeYear('2026-04-01')).toBe('2027 income year');
  });

  it('every verified home rate row carries a source and read date; unverified rows carry no number', () => {
    for (const rows of [GB_RENT_A_ROOM_ROWS, US_SIMPLIFIED_METHOD_ROWS, NZ_SQUARE_METRE_RATE_ROWS, NZ_BOARDER_STANDARD_COST_ROWS]) {
      for (const r of rows) {
        if (r.verified) expect(r.sourceUrl && r.readOn && r.value !== null).toBeTruthy();
        else expect(r.value).toBeNull();
      }
    }
  });
});
