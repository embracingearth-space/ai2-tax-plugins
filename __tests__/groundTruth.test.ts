/**
 * Ground-truth tests — @ai2/tax-plugins
 * ai2fin.com
 *
 * Worked examples checked against the authorities' own forms and worksheets
 * (ATO BAS calculation worksheet, IRD GST101A, CRA GST34, HMRC VAT100), plus
 * the structural contract of the tax-treatment catalogue. If one of these
 * fails, the plugin disagrees with the official form — do not "fix" the test.
 */

import {
  australiaPlugin,
  newZealandPlugin,
  canadaPlugin,
  unitedKingdomPlugin,
  singaporePlugin,
  japanPlugin,
  usaPlugin,
  createEUPlugin,
  getPluginForCountry,
  listOfficialCountries,
  getTreatmentsForPlugin,
  getTreatmentDefinition,
  resolveTreatmentRate,
  isCanonicalTreatmentCode,
  CANONICAL_TREATMENT_CODES,
  GENERIC_TREATMENTS,
  type TaxFilingPlugin,
  type TaxTreatmentDefinition,
} from '../src';

// ─── Australia — ATO BAS calculation worksheet ──────────────────────────────

describe('AU BAS — ATO calculation worksheet (steps 2 and 4) and summary', () => {
  const inputs = {
    G1: 110000,
    G2: 5000,
    G3: 10000,
    G4: 2000,
    G10: 22000,
    G11: 55000,
    G13: 0,
    G14: 11000,
    G15: 2200,
    W2: 3000,
    T7: 1500,
  };
  const r = australiaPlugin.calculateFields(inputs);

  it('sales side: G5 = G2+G3+G4, G6 = G1−G5, G8 = G6+G7, G9 = trunc(G8 ÷ 11)', () => {
    expect(r.G5).toBe(17000);
    expect(r.G6).toBe(93000);
    expect(r.G8).toBe(93000);
    expect(r.G9).toBe(8454); // 93000 / 11 = 8454.54 → whole dollars, truncated
  });

  it('purchases side: G12 = G10+G11, G16 = G13+G14+G15, G17 = G12−G16, G19 = G17+G18, G20 = trunc(G19 ÷ 11)', () => {
    expect(r.G12).toBe(77000);
    expect(r.G16).toBe(13200);
    expect(r.G17).toBe(63800);
    expect(r.G19).toBe(63800);
    expect(r.G20).toBe(5800); // (77000 − 13200) / 11
  });

  it('1B no longer ignores G13/G14/G15 (the old (G10+G11)/11 would give 7000)', () => {
    expect(r['1B']).toBe(5800);
    expect(r['1B_worksheet']).toBe(5800);
    expect(r['1A']).toBe(8454);
    expect(r['1A_worksheet']).toBe(8454);
  });

  it('summary: 4 = W5, 5A from T7, 8A = 1A + 4 + 5A, 8B = 1B, 9 = 8A − 8B', () => {
    expect(r.W5).toBe(3000);
    expect(r['4']).toBe(3000);
    expect(r['5A']).toBe(1500);
    expect(r['6A']).toBe(0);
    expect(r['8A']).toBe(8454 + 3000 + 1500);
    expect(r['8B']).toBe(5800);
    expect(r['9']).toBe(8454 + 3000 + 1500 - 5800);
  });

  it('8A/8B include the optional labels 1C/1E/7 and 1D/1F/5B/6B/7D', () => {
    const x = australiaPlugin.calculateFields({
      ...inputs,
      '1C': 100,
      '1E': 200,
      '7': 300,
      '1D': 10,
      '1F': 20,
      '5B': 30,
      '6B': 40,
      '7D': 50,
      F1: 400,
    });
    expect(x['6A']).toBe(400);
    expect(x['8A']).toBe(8454 + 100 + 200 + 3000 + 1500 + 400 + 300);
    expect(x['8B']).toBe(5800 + 10 + 20 + 30 + 40 + 50);
    expect(x['9']).toBe(Number(x['8A']) - Number(x['8B']));
  });

  it('G7 / G18 adjustments flow into G8 / G19 (decreasing adjustments are negative)', () => {
    const x = australiaPlugin.calculateFields({ G1: 11000, G7: -1100, G11: 5500, G18: 550 });
    expect(x.G8).toBe(9900);
    expect(x.G9).toBe(900);
    expect(x.G19).toBe(6050);
    expect(x.G20).toBe(550);
  });

  it('refund: 9 is negative when 8B exceeds 8A', () => {
    const x = australiaPlugin.calculateFields({ G1: 1100, G11: 5500 });
    expect(x['1A']).toBe(100);
    expect(x['1B']).toBe(500);
    expect(x['9']).toBe(-400);
  });

  it('every worksheet field is in the schema with its official label, and G13–G15 auto-populate', () => {
    const fields = australiaPlugin.getFormSchema().flatMap((s) => s.fields);
    const byId = Object.fromEntries(fields.map((f) => [f.id, f]));
    for (const id of ['G5', 'G6', 'G7', 'G8', 'G9', 'G12', 'G13', 'G14', 'G15', 'G16', 'G17', 'G18', 'G19', 'G20', '5A', '6A', '8A', '8B', '9']) {
      expect(byId[id]?.officialLabel).toBe(id);
    }
    for (const id of ['G5', 'G6', 'G8', 'G9', 'G12', 'G16', 'G17', 'G19', 'G20', '1A_worksheet', '1B_worksheet', '5A', '6A', '8A', '8B', '9']) {
      expect(byId[id]?.calculated).toBe(true);
      expect(byId[id]?.editable).toBe(false);
    }
    for (const id of ['G7', 'G13', 'G14', 'G15', 'G18', '1A', '1B']) {
      expect(byId[id]?.editable).toBe(true);
    }
    expect(byId.G4.autoPopulateFrom).toBe('income_input_taxed');
    expect(byId.G13.autoPopulateFrom).toBe('expenses_input_taxed_related');
    expect(byId.G14.autoPopulateFrom).toBe('expenses_no_tax');
    expect(byId.G15.autoPopulateFrom).toBe('expenses_private');
    expect(byId['1A'].autoPopulateFrom).toBe('output_tax');
    expect(byId['1B'].autoPopulateFrom).toBe('input_tax');

    const mapping = Object.fromEntries(australiaPlugin.getAutoPopulateMapping().map((m) => [m.fieldId, m.aggregateKey]));
    expect(mapping).toMatchObject({
      G4: 'income_input_taxed',
      G13: 'expenses_input_taxed_related',
      G14: 'expenses_no_tax',
      G15: 'expenses_private',
      '1A': 'output_tax',
      '1B': 'input_tax',
      W2: 'payroll_withheld',
    });
  });

  it('help text: G3 no longer claims input-taxed sales; 1A/1B help matches the code', () => {
    expect(australiaPlugin.getFieldHelp('G3')).not.toMatch(/input-taxed sales,/);
    expect(australiaPlugin.getFieldHelp('G3')).toMatch(/G4/);
    expect(australiaPlugin.getFieldHelp('G4')).toMatch(/interest/i);
    expect(australiaPlugin.getFieldHelp('1A')).toMatch(/G9/);
    expect(australiaPlugin.getFieldHelp('1B')).toMatch(/G20/);
    expect(australiaPlugin.getFieldHelp('8A')).toMatch(/1A \+ 1C \+ 1E \+ 4 \+ 5A \+ 6A \+ 7/);
  });
});

describe('AU BAS — accounts method (1A/1B supplied) vs worksheet cross-check', () => {
  const base = { G1: 110000, G2: 5000, G3: 10000, G4: 2000, G10: 22000, G11: 55000, G14: 11000, G15: 2200 };

  it('keeps the supplied 1A/1B and still reports the worksheet figures separately', () => {
    const r = australiaPlugin.calculateFields({ ...base, '1A': 9000, '1B': 6100 });
    expect(r['1A']).toBe(9000);
    expect(r['1B']).toBe(6100);
    expect(r['1A_worksheet']).toBe(8454);
    expect(r['1B_worksheet']).toBe(5800);
    expect(r['8A']).toBe(9000);
    expect(r['8B']).toBe(6100);
    expect(r['9']).toBe(2900);
  });

  it('warns when the accounts-method figure diverges from the worksheet by more than max($1, 2%)', () => {
    const results = australiaPlugin.validateForm({ ...base, '1A': 9000, '1B': 6100 });
    const warn1A = results.find((x) => x.fieldId === '1A');
    const warn1B = results.find((x) => x.fieldId === '1B');
    expect(warn1A?.severity).toBe('warning');
    expect(warn1A?.message).toMatch(/G9 \(8454\)/);
    expect(warn1B?.severity).toBe('warning');
    expect(warn1B?.message).toMatch(/G20 \(5800\)/);
  });

  it('does not warn inside the tolerance, or when 1A/1B are left blank', () => {
    const within = australiaPlugin.validateForm({ ...base, '1A': 8460, '1B': 5790 }); // Δ6 / Δ10 ≤ 2%
    expect(within.some((x) => x.fieldId === '1A' || x.fieldId === '1B')).toBe(false);
    const blank = australiaPlugin.validateForm({ ...base, '1A': '', '1B': null });
    expect(blank.some((x) => x.fieldId === '1A' || x.fieldId === '1B')).toBe(false);
    const small = australiaPlugin.validateForm({ G1: 33, '1A': 4 }); // G9 = 3, Δ1 ≤ $1 floor
    expect(small.some((x) => x.fieldId === '1A')).toBe(false);
  });

  it('validation: G2+G3+G4 > G1 warns, G13+G14+G15 > G10+G11 errors', () => {
    const sales = australiaPlugin.validateForm({ G1: 10000, G2: 5000, G3: 3000, G4: 3000 });
    expect(sales.find((x) => x.fieldId === 'G2')?.severity).toBe('warning');
    const ok = australiaPlugin.validateForm({ G1: 10000, G2: 5000, G3: 3000, G4: 2000 });
    expect(ok.some((x) => x.fieldId === 'G2')).toBe(false);

    const purchases = australiaPlugin.validateForm({ G10: 1000, G11: 2000, G13: 500, G14: 2000, G15: 600 });
    expect(purchases.find((x) => x.fieldId === 'G13')?.severity).toBe('error');
    const fine = australiaPlugin.validateForm({ G10: 1000, G11: 2000, G13: 500, G14: 2000, G15: 500 });
    expect(fine.some((x) => x.fieldId === 'G13')).toBe(false);
  });
});

// ─── New Zealand — IRD GST101A ──────────────────────────────────────────────

describe('NZ GST101A — official box numbering and formulas', () => {
  it('Box 5 23000, Box 6 0 → Box 7 23000, Box 8 3000; Box 11 11500 → Box 12 1500; Box 15 = 1500', () => {
    const r = newZealandPlugin.calculateFields({ box5: 23000, box6: 0, box11: 11500 });
    expect(r.box7).toBe(23000);
    expect(r.box8).toBe(3000);
    expect(r.box10).toBe(3000);
    expect(r.box12).toBe(1500);
    expect(r.box14).toBe(1500);
    expect(r.box15).toBe(1500);
  });

  it('Box 9 / Box 13 adjustments are added at Box 10 / Box 14', () => {
    const r = newZealandPlugin.calculateFields({ box5: 23000, box6: 4600, box9: 100, box11: 11500, box13: 50 });
    expect(r.box7).toBe(18400);
    expect(r.box8).toBe(2400);
    expect(r.box10).toBe(2500);
    expect(r.box14).toBe(1550);
    expect(r.box15).toBe(950);
  });

  it('refund: Box 15 negative when credits exceed GST collected', () => {
    const r = newZealandPlugin.calculateFields({ box5: 2300, box11: 11500 });
    expect(r.box15).toBe(300 - 1500);
  });

  it('schema has exactly Box 5–15 with official labels and no Box 16', () => {
    const fields = newZealandPlugin.getFormSchema().flatMap((s) => s.fields);
    expect(fields.map((f) => f.id)).toEqual([
      'box5', 'box6', 'box7', 'box8', 'box9', 'box10', 'box11', 'box12', 'box13', 'box14', 'box15',
    ]);
    for (const f of fields) expect(f.officialLabel).toBe(`Box ${f.id.slice(3)}`);
    const byId = Object.fromEntries(fields.map((f) => [f.id, f]));
    expect(byId.box9.editable).toBe(true);
    expect(byId.box13.editable).toBe(true);
    for (const id of ['box7', 'box8', 'box10', 'box12', 'box14', 'box15']) expect(byId[id].calculated).toBe(true);
    expect(byId.box11.label).toMatch(/tax invoicing requirements/);
    const mapping = Object.fromEntries(newZealandPlugin.getAutoPopulateMapping().map((m) => [m.fieldId, m.aggregateKey]));
    // Box 5 excludes exempt supplies; Box 11 is only purchases with GST in the price.
    expect(mapping).toEqual({
      box5: 'income_total_excl_input_taxed',
      box6: 'income_zero_rated',
      box11: 'expenses_taxable_gross',
    });
    expect(byId.box5.autoPopulateFrom).toBe('income_total_excl_input_taxed');
    expect(byId.box11.autoPopulateFrom).toBe('expenses_taxable_gross');
  });
});

// ─── Canada — CRA GST34 ─────────────────────────────────────────────────────

describe('CA GST34 — line 107 is added to ITCs', () => {
  it('108 = 106 + 107; 109 = 105 − 108; 113 = 109 − 112', () => {
    const r = canadaPlugin.calculateFields({
      line103: 5000, line104: 100, line106: 1000, line107: 200, line110: 500, line111: 0,
    });
    expect(r.line105).toBe(5100);
    expect(r.line108).toBe(1200);
    expect(r.line109).toBe(3900);
    expect(r.line112).toBe(500);
    expect(r.line113).toBe(3400);
  });

  it('labels describe 107 as a deduction from net tax, not "ITCs you overclaimed"', () => {
    const f = canadaPlugin.getFormSchema().flatMap((s) => s.fields).find((x) => x.id === 'line107')!;
    expect(f.label).toMatch(/deducted/i);
    expect(f.label).not.toMatch(/overclaimed/i);
    expect(f.helpText).toMatch(/ADDED to your ITCs/);
    const l108 = canadaPlugin.getFormSchema().flatMap((s) => s.fields).find((x) => x.id === 'line108')!;
    expect(l108.label).toMatch(/106 \+ 107/);
  });
});

// ─── United Kingdom — HMRC VAT100 (post-2021 wording) ───────────────────────

describe('GB VAT100 — boxes 2, 8, 9 use the Northern Ireland wording', () => {
  const byId = Object.fromEntries(unitedKingdomPlugin.getFormSchema().flatMap((s) => s.fields).map((f) => [f.id, f]));

  it('box 2', () => {
    expect(byId.box2.label).toBe(
      'VAT due in the period on acquisitions of goods made in Northern Ireland from EU Member States',
    );
  });
  it('box 8', () => {
    expect(byId.box8.label).toBe(
      'Total value of dispatches of goods and related costs (excluding VAT) from Northern Ireland to EU Member States',
    );
  });
  it('box 9', () => {
    expect(byId.box9.label).toBe(
      'Total value of acquisitions of goods and related costs (excluding VAT) made in Northern Ireland from EU Member States',
    );
  });
  it('no "EC" anywhere in labels or help, formulas unchanged', () => {
    for (const f of Object.values(byId)) {
      expect(`${f.label} ${f.helpText ?? ''}`).not.toMatch(/\bEC\b/);
    }
    expect(unitedKingdomPlugin.calculateFields({ box1: 5000, box2: 1000, box4: 3000 })).toEqual({ box3: 6000, box5: 3000 });
  });
});

// ─── Gross vs net auto-population (EU / SG / JP) ────────────────────────────

describe('Fields declared excl. tax auto-populate from *_excl_tax aggregates', () => {
  const mappingOf = (p: TaxFilingPlugin) =>
    Object.fromEntries(p.getAutoPopulateMapping().map((m) => [m.fieldId, m.aggregateKey]));
  const autoOf = (p: TaxFilingPlugin) =>
    Object.fromEntries(p.getFormSchema().flatMap((s) => s.fields).map((f) => [f.id, f.autoPopulateFrom]));

  it('EU template: standard_sales and domestic_purchases', () => {
    for (const code of ['DE', 'FR', 'IE']) {
      const p = createEUPlugin(code);
      expect(mappingOf(p).standard_sales).toBe('income_standard_excl_tax');
      expect(mappingOf(p).domestic_purchases).toBe('expenses_domestic_excl_tax');
      expect(autoOf(p).standard_sales).toBe('income_standard_excl_tax');
      expect(autoOf(p).domestic_purchases).toBe('expenses_domestic_excl_tax');
    }
  });
  it('SG: box 1 (net standard-rated supplies) and box 5 (net taxable purchases incl. zero-rated and imports)', () => {
    expect(mappingOf(singaporePlugin).box1).toBe('income_standard_excl_tax');
    expect(mappingOf(singaporePlugin).box5).toBe('expenses_taxable_excl_tax');
    expect(autoOf(singaporePlugin).box1).toBe('income_standard_excl_tax');
    expect(autoOf(singaporePlugin).box5).toBe('expenses_taxable_excl_tax');
  });

  it('the aggregate keys a host must emit are exactly these (contract with the core app)', () => {
    const keysOf = (p: TaxFilingPlugin) => new Set(p.getAutoPopulateMapping().map((m) => m.aggregateKey));
    expect([...keysOf(australiaPlugin)].sort()).toEqual([
      'expenses_capital', 'expenses_input_taxed_related', 'expenses_no_tax', 'expenses_non_capital', 'expenses_private',
      'income_export', 'income_gst_free', 'income_input_taxed', 'income_total', 'input_tax', 'output_tax',
      'payroll_gross', 'payroll_withheld',
    ]);
    expect([...keysOf(newZealandPlugin)].sort()).toEqual([
      'expenses_taxable_gross', 'income_total_excl_input_taxed', 'income_zero_rated',
    ]);
    expect([...keysOf(singaporePlugin)].sort()).toEqual([
      'expenses_taxable_excl_tax', 'income_standard_excl_tax', 'income_zero_rated', 'input_tax', 'revenue_total',
    ]);
    expect([...keysOf(createEUPlugin('DE'))].sort()).toEqual([
      'expenses_domestic_excl_tax', 'income_standard_excl_tax', 'input_vat',
    ]);
    expect([...keysOf(japanPlugin)].sort()).toEqual(['expenses_standard', 'income_standard_excl_tax']);
  });
  it('JP: sales_standard (excl. tax) only — purchases_standard is declared tax-inclusive', () => {
    expect(mappingOf(japanPlugin).sales_standard).toBe('income_standard_excl_tax');
    expect(mappingOf(japanPlugin).purchases_standard).toBe('expenses_standard');
  });
});

// ─── Treatment catalogue — structural contract ──────────────────────────────

describe('Tax treatment catalogue', () => {
  const VALID_SIDES = ['sale', 'purchase', 'payroll', 'excluded'];

  function boxTargets(plugin: TaxFilingPlugin): Set<string> {
    const targets = new Set<string>();
    for (const s of plugin.getFormSchema()) {
      for (const f of s.fields) {
        targets.add(f.id);
        if (f.officialLabel) targets.add(f.officialLabel);
      }
    }
    return targets;
  }

  function assertWellFormed(plugin: TaxFilingPlugin, treatments: TaxTreatmentDefinition[], label: string) {
    const targets = boxTargets(plugin);
    const seen = new Set<string>();
    for (const t of treatments) {
      expect(isCanonicalTreatmentCode(t.code)).toBe(true);
      expect(seen.has(t.code)).toBe(false);
      seen.add(t.code);
      expect(VALID_SIDES).toContain(t.side);
      expect(typeof t.label).toBe('string');
      expect(t.label.length).toBeGreaterThan(0);
      expect(typeof t.help).toBe('string');
      expect(t.help.length).toBeGreaterThan(0);
      if (t.rate !== null) {
        expect(t.rate).toBeGreaterThanOrEqual(0);
        expect(t.rate).toBeLessThan(1);
      }
      // rate 0 ⇔ no tax in the price
      if (t.rate === 0) expect(t.taxApplies).toBe(false);
      if (!t.taxApplies) expect(t.rate).toBe(0);
      if (t.authorityRef) expect(t.authorityRef).toMatch(/^https:\/\//);
      for (const box of t.boxes) {
        if (!targets.has(box)) {
          throw new Error(`${label}: treatment ${t.code} references box "${box}" which is not a field id or officialLabel of the schema`);
        }
      }
    }
  }

  it('GENERIC_TREATMENTS covers every canonical code exactly once, with no boxes', () => {
    expect(GENERIC_TREATMENTS.map((t) => t.code).sort()).toEqual([...CANONICAL_TREATMENT_CODES].sort());
    for (const t of GENERIC_TREATMENTS) expect(t.boxes).toEqual([]);
    assertWellFormed(usaPlugin, [...GENERIC_TREATMENTS], 'GENERIC');
  });

  it('every official plugin with getTaxTreatments() returns valid, unique codes whose boxes exist in its schema', () => {
    const withCatalogue: string[] = [];
    for (const code of listOfficialCountries()) {
      const plugin = getPluginForCountry(code);
      if (!plugin.getTaxTreatments) continue;
      withCatalogue.push(code);
      const treatments = plugin.getTaxTreatments();
      expect(treatments.length).toBeGreaterThan(0);
      assertWellFormed(plugin, treatments, code);
      // Every catalogue must at least classify the core sale/purchase/out-of-scope cases.
      const codes = new Set(treatments.map((t) => t.code));
      for (const required of ['SALE_STANDARD', 'SALE_ZERO_RATED', 'PURCHASE_STANDARD', 'OUT_OF_SCOPE']) {
        expect(codes.has(required as never)).toBe(true);
      }
    }
    expect(withCatalogue).toEqual(expect.arrayContaining(['AU', 'NZ', 'GB', 'CA', 'SG', 'IN', 'ZA', 'DE', 'FR']));
  });

  it('AU catalogue uses the ATO/Xero vocabulary and the worksheet boxes', () => {
    const byCode = Object.fromEntries(australiaPlugin.getTaxTreatments!().map((t) => [t.code, t]));
    expect(byCode.SALE_STANDARD.label).toBe('GST on Income');
    expect(byCode.SALE_STANDARD.boxes).toEqual(['G1', '1A']);
    expect(byCode.SALE_ZERO_RATED.boxes).toEqual(['G1', 'G2']);
    expect(byCode.SALE_EXEMPT.label).toBe('GST-Free Income');
    expect(byCode.SALE_EXEMPT.boxes).toEqual(['G1', 'G3']);
    expect(byCode.SALE_INPUT_TAXED.label).toBe('Input Taxed Income');
    expect(byCode.SALE_INPUT_TAXED.boxes).toEqual(['G1', 'G4']);
    expect(byCode.SALE_INPUT_TAXED.help).toMatch(/interest/i);
    expect(byCode.PURCHASE_STANDARD.boxes).toEqual(['G11', '1B']);
    expect(byCode.PURCHASE_CAPITAL.boxes).toEqual(['G10', '1B']);
    expect(byCode.PURCHASE_NO_TAX.boxes).toEqual(['G11', 'G14']);
    expect(byCode.PURCHASE_CAPITAL_NO_TAX.boxes).toEqual(['G10', 'G14']);
    expect(byCode.PURCHASE_INPUT_TAXED.boxes).toEqual(['G11', 'G13']);
    expect(byCode.PURCHASE_INPUT_TAXED.help).toMatch(/G14/);
    expect(byCode.PURCHASE_PRIVATE.boxes).toEqual(['G11', 'G15']);
    expect(byCode.PURCHASE_REVERSE_CHARGE.boxes).toEqual(['1A', '1B']);
    expect(byCode.PURCHASE_REVERSE_CHARGE.help).toMatch(/Division 84/);
    expect(byCode.WAGES.boxes).toEqual(['W1']);
    expect(byCode.WITHHOLDING.boxes).toEqual(['W2']);
    expect(byCode.OUT_OF_SCOPE.label).toBe('BAS Excluded');
    expect(byCode.OUT_OF_SCOPE.boxes).toEqual([]);
    for (const t of Object.values(byCode)) {
      if (t.code === 'OUT_OF_SCOPE') continue;
      expect(t.authorityRef).toMatch(/^https:\/\/www\.ato\.gov\.au\//);
    }
    expect(byCode.SALE_STANDARD.authorityRef).toMatch(/step-2-calculating-sales-using-the-calculation-worksheet$/);
    expect(byCode.PURCHASE_STANDARD.authorityRef).toMatch(/step-4-calculating-purchases-using-the-calculation-worksheet$/);
  });

  it('NZ / GB / CA / SG catalogues point at their official boxes', () => {
    const nz = Object.fromEntries(newZealandPlugin.getTaxTreatments!().map((t) => [t.code, t]));
    expect(nz.SALE_ZERO_RATED.boxes).toEqual(['Box 5', 'Box 6']);
    expect(nz.SALE_INPUT_TAXED.label).toBe('Exempt supplies');
    expect(nz.PURCHASE_STANDARD.boxes).toEqual(['Box 11']);

    const gb = Object.fromEntries(unitedKingdomPlugin.getTaxTreatments!().map((t) => [t.code, t]));
    expect(gb.SALE_STANDARD.rate).toBe(0.2);
    expect(gb.SALE_REDUCED.rate).toBe(0.05);
    expect(gb.SALE_ZERO_RATED.boxes).toEqual(['Box 6']);
    expect(gb.SALE_INPUT_TAXED.boxes).toEqual(['Box 6']);
    expect(gb.PURCHASE_STANDARD.boxes).toEqual(['Box 4', 'Box 7']);
    expect(gb.PURCHASE_REVERSE_CHARGE.boxes).toEqual(expect.arrayContaining(['Box 1', 'Box 4']));

    const ca = Object.fromEntries(canadaPlugin.getTaxTreatments!().map((t) => [t.code, t]));
    expect(ca.SALE_STANDARD.rate).toBeNull();
    expect(ca.PURCHASE_STANDARD.boxes).toEqual(['Line 106']);

    const sg = Object.fromEntries(singaporePlugin.getTaxTreatments!().map((t) => [t.code, t]));
    expect(sg.SALE_STANDARD.boxes).toEqual(['Box 1', 'Box 6']);
    expect(sg.SALE_ZERO_RATED.boxes).toEqual(['Box 2']);
    expect(sg.SALE_INPUT_TAXED.boxes).toEqual(['Box 3']);
    expect(sg.PURCHASE_STANDARD.boxes).toEqual(['Box 5', 'Box 7']);
    expect(sg.PURCHASE_REVERSE_CHARGE.boxes).toEqual(['Box 14', 'Box 15', 'Box 16']);
  });

  it('getTreatmentsForPlugin falls back to GENERIC_TREATMENTS for a plugin without the method', () => {
    expect(usaPlugin.getTaxTreatments).toBeUndefined();
    expect(getTreatmentsForPlugin(usaPlugin)).toEqual(GENERIC_TREATMENTS);
    expect(getTreatmentsForPlugin(japanPlugin)).toEqual(GENERIC_TREATMENTS);
    expect(getTreatmentsForPlugin(australiaPlugin)).toEqual(australiaPlugin.getTaxTreatments!());
    expect(getTreatmentDefinition(usaPlugin, 'SALE_STANDARD')?.label).toBe('Taxable sale');
    expect(getTreatmentDefinition(australiaPlugin, 'SALE_STANDARD')?.label).toBe('GST on Income');
  });

  it('rate === null stays null (standard rate at the transaction date) until resolved', () => {
    const generic = getTreatmentDefinition(usaPlugin, 'SALE_STANDARD')!;
    expect(generic.rate).toBeNull();
    expect(resolveTreatmentRate(generic, 0.07)).toBe(0.07);
    const au = getTreatmentDefinition(australiaPlugin, 'SALE_STANDARD')!;
    expect(resolveTreatmentRate(au, 0.07)).toBe(0.1); // explicit rate wins
    const zero = getTreatmentDefinition(australiaPlugin, 'SALE_ZERO_RATED')!;
    expect(resolveTreatmentRate(zero, 0.07)).toBe(0);
  });
});
