/**
 * India GSTR-3B — the full return, table by table. ai2fin.com
 *
 * Pins: the official table layout and columns, auto-population from the
 * host's per-treatment totals (intra-state by default), 4(C), the section
 * 49(5) / rule 88A set-off in 6.1, the v1 → full-form migration and the
 * GSTN-named JSON export.
 */

import {
  getPluginForCountry,
  resolveAggregateMapping,
  valuesFromAggregates,
  mappingKeys,
} from '../src';
import inPlugin, { setOffIndiaGst, migrateIndiaGstr3bValues, gstr3bJson } from '../src/countries/india';
import type { FieldValues } from '../src/types';

const fieldIds = () => inPlugin.getFormSchema().flatMap((s) => s.fields).map((f) => f.id);
const field = (id: string) => inPlugin.getFormSchema().flatMap((s) => s.fields).find((f) => f.id === id)!;

describe('GSTR-3B form layout', () => {
  it('is the plugin the registry returns for IN', () => {
    expect(getPluginForCountry('IN')).toBe(inPlugin);
  });

  it('has every official table, in order', () => {
    expect(inPlugin.getFormSchema().map((s) => s.title.split(' — ')[0])).toEqual([
      '3.1', '3.1.1', '3.2', '4', '5', '5.1', '6.1',
    ]);
  });

  it('3.1(a) and 3.1(d) carry taxable value and all four heads; 3.1(b) IGST and cess only; (c) and (e) value only', () => {
    const ids = new Set(fieldIds());
    for (const row of ['t31a', 't31d']) {
      for (const col of ['txval', 'iamt', 'camt', 'samt', 'csamt']) expect(ids.has(`${row}_${col}`)).toBe(true);
    }
    expect(ids.has('t31b_iamt')).toBe(true);
    expect(ids.has('t31b_camt')).toBe(false);
    for (const row of ['t31c', 't31e']) {
      expect(ids.has(`${row}_txval`)).toBe(true);
      expect(ids.has(`${row}_iamt`)).toBe(false);
    }
  });

  it('table 4 has 4(A)(1)–(5), 4(B)(1)–(2), a calculated 4(C) and 4(D)(1)–(2)', () => {
    const ids = new Set(fieldIds());
    for (const row of ['t4a3', 't4a4', 't4a5', 't4b1', 't4b2', 't4c', 't4d1', 't4d2']) {
      for (const h of ['iamt', 'camt', 'samt', 'csamt']) expect(ids.has(`${row}_${h}`)).toBe(true);
    }
    // Imports are IGST (and cess) only.
    expect(ids.has('t4a1_camt')).toBe(false);
    expect(ids.has('t4a2_samt')).toBe(false);
    expect(field('t4c_iamt').calculated).toBe(true);
    expect(field('t4c_iamt').editable).toBe(false);
  });

  it('the late fee is Central and State/UT only (section 47)', () => {
    const ids = new Set(fieldIds());
    expect(ids.has('t51_fee_camt')).toBe(true);
    expect(ids.has('t51_fee_samt')).toBe(true);
    expect(ids.has('t51_fee_iamt')).toBe(false);
  });

  it('field ids are unique and official labels are unique', () => {
    const fields = inPlugin.getFormSchema().flatMap((s) => s.fields);
    expect(new Set(fields.map((f) => f.id)).size).toBe(fields.length);
    const labels = fields.map((f) => f.officialLabel).filter(Boolean);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('quotes the current slabs, not the pre-September-2025 12% and 28%', () => {
    const text = JSON.stringify(inPlugin.getFormSchema()) + JSON.stringify(inPlugin.getTaxTreatments!());
    expect(text).toMatch(/5%, 18% or 40%/);
    expect(text).not.toMatch(/\b12%|\b28%/);
  });
});

describe('setOffIndiaGst — section 49(5) and rule 88A', () => {
  const h = (iamt: number, camt: number, samt: number, csamt = 0) => ({ iamt, camt, samt, csamt });

  it('uses IGST credit first, against IGST', () => {
    const r = setOffIndiaGst(h(1000, 0, 0), h(1500, 0, 0));
    expect(r.paidByCredit).toEqual(h(1000, 0, 0));
    expect(r.paidInCash).toEqual(h(0, 0, 0));
    expect(r.carriedForward).toEqual(h(500, 0, 0));
  });

  it('then uses leftover IGST credit on CGST and SGST before their own credit (rule 88A)', () => {
    // IGST credit 1000 > IGST liability 0: all of it must go to CGST/SGST.
    const r = setOffIndiaGst(h(0, 900, 900), h(1000, 500, 500));
    // Shortfalls beyond own credit are 400 each; IGST covers those first (800),
    // then the remaining 200 goes to CGST; own credit covers the rest.
    expect(r.paidByCredit).toEqual(h(0, 900, 900));
    expect(r.paidInCash).toEqual(h(0, 0, 0));
    expect(r.carriedForward.iamt).toBe(0);
    expect(r.carriedForward.camt + r.carriedForward.samt).toBe(200);
  });

  it('never sets CGST credit off against SGST, or the reverse', () => {
    const r = setOffIndiaGst(h(0, 0, 1000), h(0, 1000, 0));
    expect(r.paidInCash).toEqual(h(0, 0, 1000));
    expect(r.carriedForward).toEqual(h(0, 1000, 0));
  });

  it('sets CGST and SGST credit off against IGST after their own heads', () => {
    const r = setOffIndiaGst(h(1000, 200, 200), h(0, 700, 500));
    expect(r.paidByCredit).toEqual(h(800, 200, 200));
    expect(r.paidInCash).toEqual(h(200, 0, 0));
    expect(r.carriedForward).toEqual(h(0, 0, 0));
  });

  it('cess credit pays cess only', () => {
    const r = setOffIndiaGst(h(500, 0, 0, 0), h(0, 0, 0, 500));
    expect(r.paidInCash).toEqual(h(500, 0, 0, 0));
    expect(r.carriedForward.csamt).toBe(500);
  });

  it('negative inputs are treated as zero', () => {
    const r = setOffIndiaGst(h(-10, 0, 0), h(-5, 0, 0));
    expect(r.paidInCash).toEqual(h(0, 0, 0));
    expect(r.carriedForward).toEqual(h(0, 0, 0));
  });
});

describe('calculateFields', () => {
  it('4(C) is 4(A) less 4(B), per head', () => {
    const c = inPlugin.calculateFields({
      t4a1_iamt: 300,
      t4a5_camt: 900,
      t4a5_samt: 900,
      t4b1_camt: 100,
      t4b1_samt: 100,
      t4b2_iamt: 50,
    });
    expect(c.t4c_iamt).toBe(250);
    expect(c.t4c_camt).toBe(800);
    expect(c.t4c_samt).toBe(800);
  });

  it('6.1 sets credit off, adds reverse charge, interest and late fee in cash', () => {
    const c = inPlugin.calculateFields({
      // 3.1(a): Rs 1,00,000 intra-state at 18%
      t31a_txval: 100000,
      t31a_camt: 9000,
      t31a_samt: 9000,
      // 3.1(d): Rs 10,000 reverse charge at 18%
      t31d_txval: 10000,
      t31d_camt: 900,
      t31d_samt: 900,
      // 4(A): RC credit back, plus Rs 5,000 + 5,000 other credit
      t4a3_camt: 900,
      t4a3_samt: 900,
      t4a5_camt: 5000,
      t4a5_samt: 5000,
      t51_int_camt: 10,
      t51_fee_camt: 25,
      t51_fee_samt: 25,
    });
    expect(c.t61_payable_camt).toBe(9000);
    expect(c.t61_itc_camt).toBe(5900);
    expect(c.t61_cash_camt).toBe(3100);
    expect(c.t61_cash_samt).toBe(3100);
    expect(c.t61_rc_cash_camt).toBe(900);
    // 3100 × 2 + 900 × 2 + 10 + 25 + 25
    expect(c.net_tax).toBe(8060);
  });

  it('opening ledger credit is used too, and what is left is carried forward', () => {
    const c = inPlugin.calculateFields({ t31a_iamt: 1000, t61_open_iamt: 1500 });
    expect(c.t61_cash_iamt).toBe(0);
    expect(c.t61_cf_iamt).toBe(500);
    expect(c.net_tax).toBe(0);
  });

  it('an empty return is all zeros', () => {
    const c = inPlugin.calculateFields({});
    expect(c.net_tax).toBe(0);
    expect(c.t4c_iamt).toBe(0);
  });
});

describe('auto-population from the host aggregates', () => {
  // Shape of TaxFilingService.aggregate(): treat_<CODE>_{gross,tax,net} for every code.
  const aggregates: Record<string, number> = {
    income_standard_excl_tax: 100000,
    treat_SALE_STANDARD_tax: 15000,
    treat_SALE_REDUCED_tax: 3000,
    treat_SALE_ZERO_RATED_gross: 40000,
    treat_SALE_EXEMPT_gross: 2000,
    treat_SALE_INPUT_TAXED_gross: 1000,
    treat_PURCHASE_REVERSE_CHARGE_net: 10000,
    treat_PURCHASE_REVERSE_CHARGE_tax: 1800,
    treat_PURCHASE_IMPORT_tax: 900,
    treat_PURCHASE_STANDARD_tax: 6000,
    treat_PURCHASE_CAPITAL_tax: 2000,
    treat_PURCHASE_REDUCED_tax: 500,
    treat_PURCHASE_PRIVATE_tax: 400,
    treat_PURCHASE_INPUT_TAXED_tax: 100,
    treat_PURCHASE_NO_TAX_gross: 700,
    treat_PURCHASE_CAPITAL_NO_TAX_gross: 300,
  };
  const v = valuesFromAggregates(inPlugin, aggregates);

  it('3.1(a) is the taxable value EXCLUDING tax — not the gross of every sale', () => {
    expect(v.t31a_txval).toBe(100000);
    expect(inPlugin.getAutoPopulateMapping().find((m) => m.fieldId === 't31a_txval')!.aggregateKey).not.toBe(
      'income_taxable',
    );
  });

  it('fills output tax intra-state: half Central, half State/UT, nothing in Integrated', () => {
    expect(v.t31a_camt).toBe(9000);
    expect(v.t31a_samt).toBe(9000);
    expect(v.t31a_iamt).toBeUndefined();
  });

  it('fills 3.1(b), 3.1(c) and 3.1(d)', () => {
    expect(v.t31b_txval).toBe(40000);
    expect(v.t31c_txval).toBe(3000);
    expect(v.t31d_txval).toBe(10000);
    expect(v.t31d_camt).toBe(900);
    expect(v.t31d_samt).toBe(900);
  });

  it('fills 4(A)(1) as IGST, 4(A)(3) from reverse charge, 4(A)(5) as GSTR-2B shows it, and reverses 4(B)(1)', () => {
    expect(v.t4a1_iamt).toBe(900);
    expect(v.t4a3_camt).toBe(900);
    expect(v.t4a5_camt).toBe(4500); // (6000 + 2000 + 500 + 400 + 100) / 2
    expect(v.t4b1_camt).toBe(250); // (400 + 100) / 2
    const c = inPlugin.calculateFields(v);
    // Net credit counts only creditable purchases: (6000 + 2000 + 500) / 2 + RC 900.
    expect(c.t4c_camt).toBe(5150);
  });

  it('fills table 5 from purchases without GST', () => {
    expect(v.t5_gst_intra).toBe(1000);
  });

  it('a field is left empty only when the host produced none of its keys', () => {
    const m = inPlugin.getAutoPopulateMapping().find((x) => x.fieldId === 't4a5_camt')!;
    expect(resolveAggregateMapping(m, {})).toBeUndefined();
    expect(resolveAggregateMapping(m, { treat_PURCHASE_STANDARD_tax: 100 })).toBe(50);
  });

  it('every key it reads is one the core app emits (contract)', () => {
    const CODES = [
      'SALE_STANDARD', 'SALE_REDUCED', 'SALE_ZERO_RATED', 'SALE_EXEMPT', 'SALE_INPUT_TAXED',
      'PURCHASE_STANDARD', 'PURCHASE_CAPITAL', 'PURCHASE_REDUCED', 'PURCHASE_NO_TAX',
      'PURCHASE_CAPITAL_NO_TAX', 'PURCHASE_INPUT_TAXED', 'PURCHASE_PRIVATE',
      'PURCHASE_REVERSE_CHARGE', 'PURCHASE_IMPORT',
    ];
    const hostKeys = new Set([
      'income_standard_excl_tax',
      ...CODES.flatMap((c) => ['gross', 'tax', 'net'].map((p) => `treat_${c}_${p}`)),
    ]);
    for (const m of inPlugin.getAutoPopulateMapping()) {
      for (const k of mappingKeys(m)) expect(hostKeys.has(k)).toBe(true);
      expect(fieldIds()).toContain(m.fieldId);
      expect(m.aggregateKey).toBe(mappingKeys(m)[0]);
    }
  });
});

describe('validateForm', () => {
  it('says auto-filled tax was treated as intra-state', () => {
    const r = inPlugin.validateForm({ t31a_camt: 900, t31a_samt: 900 });
    expect(r.some((x) => x.severity === 'info' && /intra-state/.test(x.message))).toBe(true);
  });

  it('warns when Central and State/UT tax differ', () => {
    const r = inPlugin.validateForm({ t31a_camt: 900, t31a_samt: 100 });
    expect(r.some((x) => x.fieldId === 't31a_camt' && x.severity === 'warning')).toBe(true);
  });

  it('rejects a 3.2 total larger than 3.1(a)', () => {
    const r = inPlugin.validateForm({ t31a_txval: 1000, t32_unreg_txval: 5000 });
    expect(r.some((x) => x.severity === 'error' && x.fieldId === 't32_unreg_txval')).toBe(true);
  });

  it('a clean intra-state return has no warnings or errors', () => {
    const r = inPlugin.validateForm({ t31a_txval: 1000, t31a_camt: 90, t31a_samt: 90, t4a5_camt: 50, t4a5_samt: 50 });
    expect(r.filter((x) => x.severity !== 'info')).toEqual([]);
  });
});

describe('migrateIndiaGstr3bValues (v1 saved statements)', () => {
  it('moves every v1 field to its official table', () => {
    const out = migrateIndiaGstr3bValues({
      outward_taxable: 1000,
      igst: 10,
      cgst: 20,
      sgst: 20,
      itc_igst: 5,
      itc_cgst: 6,
      itc_sgst: 6,
      itc_reversed: 3,
      late_fee: 100,
      net_itc: 14,
    } as FieldValues);
    expect(out).toMatchObject({
      t31a_txval: 1000,
      t31a_iamt: 10,
      t31a_camt: 20,
      t31a_samt: 20,
      t4a5_iamt: 5,
      t4a5_camt: 6,
      t4a5_samt: 6,
      t4b1_iamt: 3,
      t51_fee_camt: 50,
      t51_fee_samt: 50,
    });
    for (const old of ['outward_taxable', 'igst', 'itc_reversed', 'late_fee', 'net_itc']) expect(out).not.toHaveProperty(old);
  });

  it('never overwrites a value already under the new id', () => {
    expect(migrateIndiaGstr3bValues({ igst: 10, t31a_iamt: 99 }).t31a_iamt).toBe(99);
  });
});

describe('exports', () => {
  const values: FieldValues = { t31a_txval: 1000, t31a_camt: 90, t31a_samt: 90, t4a5_camt: 40, t4a5_samt: 40 };

  it('JSON uses the GSTN field names and the calculated 4(C) and 6.1', () => {
    const j = gstr3bJson(values);
    expect(j.sup_details.osup_det).toEqual({ txval: 1000, iamt: 0, camt: 90, samt: 90, csamt: 0 });
    expect(j.itc_elg.itc_avl.map((r) => r.ty)).toEqual(['IMPG', 'IMPS', 'ISRC', 'ISD', 'OTH']);
    expect(j.itc_elg.itc_net.camt).toBe(40);
    expect(j.payment.total_cash).toBe(100);
  });

  it('generateExport returns JSON and CSV', async () => {
    const json = await inPlugin.generateExport(values, 'json');
    expect(JSON.parse(String(json.data)).sup_details.osup_det.txval).toBe(1000);
    const csv = await inPlugin.generateExport(values, 'csv');
    expect(String(csv.data)).toMatch(/t31a_txval,1000/);
  });
});

describe('treatment catalogue', () => {
  const byCode = Object.fromEntries(inPlugin.getTaxTreatments!().map((t) => [t.code, t]));

  it('classifies every canonical code India uses, including exempt sales and capital goods without GST', () => {
    expect(byCode.SALE_EXEMPT.boxes).toEqual(['3.1(c)']);
    expect(byCode.PURCHASE_CAPITAL_NO_TAX.boxes).toContain('5 Exempt intra-state');
  });

  it('blocked and exempt-attributable credit appears in 4(A)(5) and is reversed in 4(B)(1)', () => {
    for (const code of ['PURCHASE_PRIVATE', 'PURCHASE_INPUT_TAXED']) {
      expect(byCode[code].boxes).toEqual(expect.arrayContaining(['4(A)(5) CGST', '4(B)(1) CGST']));
      expect(byCode[code].creditable).toBe(false);
    }
  });

  it('import of goods is 4(A)(1) IGST only', () => {
    expect(byCode.PURCHASE_IMPORT.boxes).toEqual(['4(A)(1) IGST']);
  });
});
