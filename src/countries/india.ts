/**
 * India GSTR-3B Plugin (Monthly / Quarterly Summary Return) - ai2fin.com
 * GST Network (GSTN) - India's Goods and Services Tax
 * Reference: https://www.gst.gov.in/help/returns
 *
 * The form follows the official GSTR-3B table by table — 3.1, 3.1.1, 3.2,
 * 4(A)–(D), 5, 5.1 and 6.1 — and every tax row carries the official columns:
 * taxable value where the table has one, then Integrated, Central and
 * State/UT tax and Cess. Field ids are `t<table>_<column>` (t31a_txval,
 * t4a5_camt, …), the columns named as GSTN names them (txval, iamt, camt,
 * samt, csamt) so the JSON export reads the same.
 *
 * ARCHITECTURE
 *   - Rates: since 22 September 2025 (GST Council, 56th meeting) the slabs are
 *     5% and 18%, with 40% on a short list of luxury and sin goods; 0.25% and
 *     3% remain for precious stones and metals. Tax on an intra-state supply
 *     is split equally between CGST and SGST/UTGST; an inter-state supply or
 *     an import carries IGST.
 *   - Auto-population: the host's per-treatment totals (treat_<CODE>_*) fill
 *     the taxable values and the tax. The host does not yet record a place of
 *     supply, so tax is filled as INTRA-STATE (half CGST, half SGST/UTGST) —
 *     the common case for a small business — and validateForm says so, so an
 *     inter-state supply's tax can be moved to IGST before filing. Import of
 *     goods is always IGST.
 *   - Credits: table 4 reports eligible ITC in 4(A) the way GSTR-2B shows it,
 *     and reverses blocked (section 17(5)) and exempt-attributable (rules 42
 *     and 43) credit in 4(B)(1), so 4(C) is the credit actually available.
 *   - Payment: table 6.1 is calculated. Credit is set off in the order
 *     section 49(5) and rule 88A require — IGST credit first and in full,
 *     against IGST then CGST and SGST/UTGST; CGST credit against CGST then
 *     IGST; SGST/UTGST credit against SGST/UTGST then IGST; never CGST against
 *     SGST or the reverse; Cess only against Cess. Reverse-charge tax,
 *     interest and late fee are paid in cash.
 *   - Financial year: 1 April to 31 March. Monthly filing, or quarterly under
 *     the QRMP scheme.
 */

import { toCsv } from '../exportUtils';
import { IN_DEPRECIATION_RULES } from './indiaDepreciation';
import type { DepreciationRules } from '../depreciation';

import type {
  TaxFilingPlugin,
  FormSection,
  FormField,
  FieldValues,
  CalculatedFields,
  AggregationMapping,
  ValidationResult,
  RoundingConfig,
  ExportFormat,
  ExportOutput,
  SubJurisdiction,
  TaxTreatmentDefinition,
} from '../types';

// All 28 states + 8 Union Territories with state codes
const INDIAN_STATES: SubJurisdiction[] = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman & Diu' },
  { code: '26', name: 'Dadra & Nagar Haveli' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
];

// ─── Columns ────────────────────────────────────────────────────────────────

type Head = 'iamt' | 'camt' | 'samt' | 'csamt';
const HEADS: readonly Head[] = ['iamt', 'camt', 'samt', 'csamt'];
const HEAD_LABEL: Record<Head, string> = {
  iamt: 'Integrated tax',
  camt: 'Central tax',
  samt: 'State/UT tax',
  csamt: 'Cess',
};
const HEAD_SHORT: Record<Head, string> = { iamt: 'IGST', camt: 'CGST', samt: 'SGST', csamt: 'Cess' };

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const r2 = (n: number): number => Math.round(n * 100) / 100;

/** One currency field. */
function money(id: string, label: string, officialLabel?: string, extra: Partial<FormField> = {}): FormField {
  return {
    id,
    label,
    ...(officialLabel ? { officialLabel } : {}),
    type: 'currency',
    editable: true,
    required: false,
    ...extra,
  };
}

/**
 * A table row: an optional taxable-value column and the tax heads it has.
 * `row` is the official row reference ('3.1(a)', '4(A)(5)'); the taxable
 * value carries it as its officialLabel and each tax column `<row> <HEAD>`.
 */
function rowFields(
  prefix: string,
  row: string,
  label: string,
  opts: { txval?: boolean; heads?: readonly Head[]; helpText?: string; calculated?: boolean } = {},
): FormField[] {
  const heads = opts.heads ?? HEADS;
  const calc = opts.calculated
    ? { calculated: true, editable: false }
    : {};
  const out: FormField[] = [];
  if (opts.txval) {
    out.push(
      money(`${prefix}_txval`, `${label} — taxable value`, row, {
        ...(opts.helpText ? { helpText: opts.helpText } : {}),
        ...calc,
      }),
    );
  }
  heads.forEach((h, i) => {
    out.push(
      money(`${prefix}_${h}`, `${label} — ${HEAD_LABEL[h]}`, `${row} ${HEAD_SHORT[h]}`, {
        ...(!opts.txval && i === 0 && opts.helpText ? { helpText: opts.helpText } : {}),
        ...calc,
      }),
    );
  });
  return out;
}

// ─── Table 6.1: set-off of credit against liability ─────────────────────────

export interface IndiaGstHeads {
  iamt: number;
  camt: number;
  samt: number;
  csamt: number;
}

export interface IndiaSetOffResult {
  /** Liability other than reverse charge, per head (3.1(a) + 3.1(b)). */
  payable: IndiaGstHeads;
  /** Paid through the electronic credit ledger, per head of LIABILITY. */
  paidByCredit: IndiaGstHeads;
  /** Paid in cash, per head, other than reverse charge. */
  paidInCash: IndiaGstHeads;
  /** Credit left in the ledger after this return, per head of CREDIT. */
  carriedForward: IndiaGstHeads;
}

const zeroHeads = (): IndiaGstHeads => ({ iamt: 0, camt: 0, samt: 0, csamt: 0 });

/**
 * Set credit off against liability in the order the CGST Act requires
 * (section 49(5), sections 49A and 49B, rule 88A). Pure; amounts in rupees.
 *
 * Within what the law leaves open — which of CGST or SGST/UTGST the leftover
 * IGST credit pays — IGST credit goes first to the part of each liability the
 * head's own credit cannot cover, so no own credit is stranded while cash is
 * paid elsewhere.
 */
export function setOffIndiaGst(liability: IndiaGstHeads, credit: IndiaGstHeads): IndiaSetOffResult {
  const due = { ...liability };
  const left = { ...credit };
  const paid = zeroHeads();
  for (const h of HEADS) {
    due[h] = Math.max(0, due[h]);
    left[h] = Math.max(0, left[h]);
  }

  const apply = (from: Head, to: Head, cap = Infinity) => {
    const amt = Math.min(left[from], due[to], cap);
    if (amt <= 0) return;
    left[from] -= amt;
    due[to] -= amt;
    paid[to] += amt;
  };

  // 1. IGST credit, first and in full (rule 88A): IGST, then CGST and SGST/UTGST.
  apply('iamt', 'iamt');
  apply('iamt', 'camt', Math.max(0, due.camt - left.camt)); // the part CGST credit cannot cover
  apply('iamt', 'samt', Math.max(0, due.samt - left.samt)); // the part SGST credit cannot cover
  apply('iamt', 'camt');
  apply('iamt', 'samt');
  // 2. CGST credit: CGST, then IGST. 3. SGST/UTGST credit: SGST/UTGST, then IGST.
  apply('camt', 'camt');
  apply('samt', 'samt');
  apply('camt', 'iamt');
  apply('samt', 'iamt');
  // 4. Cess credit only against Cess.
  apply('csamt', 'csamt');

  const out = (o: IndiaGstHeads): IndiaGstHeads => ({
    iamt: r2(o.iamt),
    camt: r2(o.camt),
    samt: r2(o.samt),
    csamt: r2(o.csamt),
  });
  return {
    payable: out(liability),
    paidByCredit: out(paid),
    paidInCash: out(due),
    carriedForward: out(left),
  };
}

// ─── Legacy (v1) saved values ───────────────────────────────────────────────

/**
 * A GSTR-3B saved before the full form (field ids igst, cgst, itc_igst, …)
 * mapped onto the official tables, so a reopened statement keeps its figures.
 * Values already under a new id win. Pure; returns a new object.
 */
export function migrateIndiaGstr3bValues(values: FieldValues): FieldValues {
  const legacy: Record<string, string> = {
    outward_taxable: 't31a_txval',
    outward_zero_rated: 't31b_txval',
    outward_nil_exempt: 't31c_txval',
    inward_reverse_charge: 't31d_txval',
    non_gst_supplies: 't31e_txval',
    igst: 't31a_iamt',
    cgst: 't31a_camt',
    sgst: 't31a_samt',
    cess: 't31a_csamt',
    itc_igst: 't4a5_iamt',
    itc_cgst: 't4a5_camt',
    itc_sgst: 't4a5_samt',
    itc_cess: 't4a5_csamt',
    interest: 't51_int_iamt',
    late_fee: 't51_fee_camt',
  };
  const out: FieldValues = { ...values };
  const isEmpty = (v: unknown) => v === undefined || v === null || v === '';
  const written = new Set<string>();
  for (const [oldId, newId] of Object.entries(legacy)) {
    if (!(oldId in values)) continue;
    if (isEmpty(out[newId])) {
      out[newId] = values[oldId];
      written.add(newId);
    }
    delete out[oldId];
  }
  // v1 kept one reversal figure with no head. Spread it over the heads in
  // proportion to the migrated 4(A)(5) credit (v1 credit was mostly intra-state,
  // so an all-IGST reversal would go negative and be lost in set-off); IGST
  // only when no credit by head exists. Never overwrite a 4(B)(1) already set.
  if ('itc_reversed' in values) {
    const empty = (k: string) => out[k] === undefined || out[k] === null || out[k] === '';
    if (HEADS.every((h) => empty(`t4b1_${h}`))) {
      const rev = num(values.itc_reversed);
      const base = HEADS.map((h) => Math.max(0, num(out[`t4a5_${h}`])));
      const total = base.reduce((a, b) => a + b, 0);
      if (total <= 0) {
        out.t4b1_iamt = values.itc_reversed;
      } else {
        // Round each share; the last head with credit takes the remainder so
        // the heads add back to the v1 figure exactly.
        const last = base.reduce((acc, b, i) => (b > 0 ? i : acc), -1);
        let given = 0;
        HEADS.forEach((h, i) => {
          if (base[i]! <= 0) return;
          const share = i === last ? r2(rev - given) : r2((rev * base[i]!) / total);
          given = r2(given + share);
          out[`t4b1_${h}`] = share;
        });
      }
    }
    delete out.itc_reversed;
  }
  // v1 split the late fee nowhere; the Act charges it half CGST, half SGST.
  // Only when the v1 figure was just written to t51_fee_camt and no SGST fee is saved.
  if ('late_fee' in values && written.has('t51_fee_camt') && isEmpty(values.t51_fee_samt)) {
    const fee = num(values.late_fee);
    out.t51_fee_camt = r2(fee / 2);
    out.t51_fee_samt = r2(fee - r2(fee / 2));
  }
  delete out.net_itc;
  return out;
}

// ─── Auto-populate ─────────────────────────────────────────────────────────

const half = (v: number) => v / 2;
/** CGST share rounded to cents; SGST takes the remainder so the two add back to the rounded aggregate. */
const halfFirst = (v: number) => Math.round(half(v) * 100) / 100;
const halfRest = (v: number) => Math.round(v * 100) / 100 - halfFirst(v);

/**
 * Host aggregates → GSTR-3B fields. Tax is filled intra-state (half CGST,
 * half SGST/UTGST) because the host records no place of supply yet; imports
 * of goods are IGST by law.
 */
const MAPPING: AggregationMapping[] = (() => {
  const m: AggregationMapping[] = [];
  const add = (fieldId: string, keys: string[], transform?: (v: number) => number) =>
    m.push({ fieldId, aggregateKey: keys[0], ...(keys.length > 1 ? { aggregateKeys: keys } : {}), ...(transform ? { transform } : {}) });
  const intraTax = (prefix: string, keys: string[]) => {
    add(`${prefix}_camt`, keys, halfFirst);
    add(`${prefix}_samt`, keys, halfRest);
  };

  // 3.1(a) — taxable value excludes the tax; the tax is what the sales carried.
  add('t31a_txval', ['income_standard_excl_tax']);
  intraTax('t31a', ['treat_SALE_STANDARD_tax', 'treat_SALE_REDUCED_tax']);
  // 3.1(b) — zero-rated (exports, SEZ). Under a LUT there is no tax.
  add('t31b_txval', ['treat_SALE_ZERO_RATED_gross']);
  // 3.1(c) — nil-rated and exempt.
  add('t31c_txval', ['treat_SALE_EXEMPT_gross', 'treat_SALE_INPUT_TAXED_gross']);
  // 3.1(d) — inward supplies liable to reverse charge: value and the tax you self-assess.
  add('t31d_txval', ['treat_PURCHASE_REVERSE_CHARGE_net']);
  intraTax('t31d', ['treat_PURCHASE_REVERSE_CHARGE_tax']);

  // 4(A)(1) — import of goods: IGST paid at customs.
  add('t4a1_iamt', ['treat_PURCHASE_IMPORT_tax']);
  // 4(A)(3) — reverse-charge inward supplies: the tax paid in 3.1(d) comes back as credit.
  intraTax('t4a3', ['treat_PURCHASE_REVERSE_CHARGE_tax']);
  // 4(A)(5) — all other ITC, as GSTR-2B shows it: creditable purchases plus
  // the blocked and exempt-attributable credit 4(B)(1) then reverses.
  intraTax('t4a5', [
    'treat_PURCHASE_STANDARD_tax',
    'treat_PURCHASE_CAPITAL_tax',
    'treat_PURCHASE_REDUCED_tax',
    'treat_PURCHASE_PRIVATE_tax',
    'treat_PURCHASE_INPUT_TAXED_tax',
  ]);
  // 4(B)(1) — reversed: section 17(5) blocked credit and rules 38, 42 and 43.
  intraTax('t4b1', ['treat_PURCHASE_PRIVATE_tax', 'treat_PURCHASE_INPUT_TAXED_tax']);

  // 5 — exempt, nil-rated and composition inward supplies (intra-state by default).
  add('t5_gst_intra', ['treat_PURCHASE_NO_TAX_gross', 'treat_PURCHASE_CAPITAL_NO_TAX_gross']);
  return m;
})();

/**
 * Each mapped field names the aggregate it fills from, read off MAPPING so the
 * schema and the mapping cannot drift (hosts use it to mark inferred figures).
 */
function withAutoPopulateFrom(sections: FormSection[]): FormSection[] {
  const from = new Map(MAPPING.map((m) => [m.fieldId, m.aggregateKey]));
  return sections.map((s) => ({
    ...s,
    fields: s.fields.map((fld) => (from.has(fld.id) ? { ...fld, autoPopulateFrom: from.get(fld.id) } : fld)),
  }));
}

// ─── Plugin ─────────────────────────────────────────────────────────────────

const inPlugin: TaxFilingPlugin = {
  countryCode: 'IN',
  displayName: 'GSTR-3B (Summary Return)',
  shortName: 'GSTR-3B',
  authority: {
    name: 'GSTN',
    fullName: 'Goods and Services Tax Network',
    portalUrl: 'https://www.gst.gov.in',
    helpUrl: 'https://www.gst.gov.in/help/returns',
  },
  taxFamily: 'GST',
  isFullPlugin: true,

  getFormSchema() {
    return withAutoPopulateFrom([
      {
        id: 'outward',
        title: '3.1 — Outward supplies and inward supplies liable to reverse charge',
        description:
          'Taxable value and tax for each kind of supply. Fin fills tax as intra-state (Central + State/UT); move the tax on an inter-state supply to Integrated tax.',
        fields: [
          ...rowFields('t31a', '3.1(a)', 'Outward taxable supplies (other than zero rated, nil rated and exempted)', {
            txval: true,
            helpText: 'Taxable value of supplies at 5%, 18% or 40% (and the 0.25% and 3% rates), net of credit and debit notes, excluding the tax.',
          }),
          ...rowFields('t31b', '3.1(b)', 'Outward taxable supplies (zero rated)', {
            txval: true,
            heads: ['iamt', 'csamt'],
            helpText: 'Exports and supplies to SEZ units or developers. Tax only when supplied with payment of IGST; under a LUT the tax is nil.',
          }),
          ...rowFields('t31c', '3.1(c)', 'Other outward supplies (nil rated, exempted)', {
            txval: true,
            heads: [],
          }),
          ...rowFields('t31d', '3.1(d)', 'Inward supplies (liable to reverse charge)', {
            txval: true,
            helpText: 'Purchases on which you pay the GST yourself — notified goods and services, and import of services (IGST). Paid in cash, then claimed back in 4(A).',
          }),
          ...rowFields('t31e', '3.1(e)', 'Non-GST outward supplies', {
            txval: true,
            heads: [],
            helpText: 'Alcohol for human consumption and the five petroleum products outside GST.',
          }),
        ],
      },
      {
        id: 'eco',
        title: '3.1.1 — Supplies through e-commerce operators (section 9(5))',
        collapsed: true,
        fields: [
          ...rowFields('t311i', '3.1.1(i)', 'Taxable supplies on which an e-commerce operator pays tax (filed by the operator)', {
            txval: true,
          }),
          ...rowFields('t311ii', '3.1.1(ii)', 'Taxable supplies made through an e-commerce operator that pays the tax (filed by the supplier)', {
            txval: true,
            heads: [],
          }),
        ],
      },
      {
        id: 'inter_state',
        title: '3.2 — Inter-state supplies to unregistered persons, composition dealers and UIN holders',
        description: 'Totals of the inter-state supplies already in 3.1(a). The portal asks for these by place of supply.',
        collapsed: true,
        fields: [
          ...rowFields('t32_unreg', '3.2 Unregistered', 'Supplies to unregistered persons', { txval: true, heads: ['iamt'] }),
          ...rowFields('t32_comp', '3.2 Composition', 'Supplies to composition taxable persons', { txval: true, heads: ['iamt'] }),
          ...rowFields('t32_uin', '3.2 UIN', 'Supplies to UIN holders', { txval: true, heads: ['iamt'] }),
        ],
      },
      {
        id: 'itc',
        title: '4 — Eligible ITC',
        description: 'Credit as GSTR-2B shows it in 4(A), what has to be reversed in 4(B), and the credit you can use in 4(C).',
        fields: [
          ...rowFields('t4a1', '4(A)(1)', 'Import of goods', { heads: ['iamt', 'csamt'], helpText: 'IGST and cess paid at customs on the bill of entry.' }),
          ...rowFields('t4a2', '4(A)(2)', 'Import of services', { heads: ['iamt', 'csamt'] }),
          ...rowFields('t4a3', '4(A)(3)', 'Inward supplies liable to reverse charge (other than 1 and 2 above)'),
          ...rowFields('t4a4', '4(A)(4)', 'Inward supplies from ISD'),
          ...rowFields('t4a5', '4(A)(5)', 'All other ITC', {
            helpText: 'Tax on purchases from registered suppliers, including blocked credit that 4(B)(1) reverses — so it matches GSTR-2B.',
          }),
          ...rowFields('t4b1', '4(B)(1)', 'ITC reversed — as per rules 38, 42 and 43 of CGST Rules and section 17(5)', {
            helpText: 'Blocked credit (food, club memberships, personal vehicles), personal use, and credit attributable to exempt supplies.',
          }),
          ...rowFields('t4b2', '4(B)(2)', 'ITC reversed — others', {
            helpText: 'Temporary reversals, such as rule 37 (supplier not paid in 180 days). Reclaim them later in 4(A)(5) and disclose the reclaim in 4(D)(1).',
          }),
          ...rowFields('t4c', '4(C)', 'Net ITC available (A) − (B)', { calculated: true }),
          ...rowFields('t4d1', '4(D)(1)', 'ITC reclaimed which was reversed under 4(B)(2) in an earlier tax period'),
          ...rowFields('t4d2', '4(D)(2)', 'Ineligible ITC under section 16(4) and ITC restricted due to place-of-supply rules', {
            helpText: 'Disclosure only — not part of 4(C).',
          }),
        ],
      },
      {
        id: 'inward_exempt',
        title: '5 — Values of exempt, nil-rated and non-GST inward supplies',
        collapsed: true,
        fields: [
          money('t5_gst_inter', 'From a supplier under composition scheme, exempt and nil rated supply — inter-state', '5 Exempt inter-state'),
          money('t5_gst_intra', 'From a supplier under composition scheme, exempt and nil rated supply — intra-state', '5 Exempt intra-state', {
            helpText: 'Fin fills purchases that carried no GST here; move inter-state ones to the line above.',
          }),
          money('t5_nongst_inter', 'Non-GST supply — inter-state', '5 Non-GST inter-state'),
          money('t5_nongst_intra', 'Non-GST supply — intra-state', '5 Non-GST intra-state'),
        ],
      },
      {
        id: 'interest_late',
        title: '5.1 — Interest and late fee',
        collapsed: true,
        fields: [
          ...rowFields('t51_int', '5.1 Interest', 'Interest', {
            helpText: 'Section 50: 18% a year on tax paid late in cash, from the day after the due date.',
          }),
          ...rowFields('t51_fee', '5.1 Late fee', 'Late fee', {
            heads: ['camt', 'samt'],
            helpText: 'Section 47, half Central and half State/UT: Rs 50 a day (Rs 20 for a nil return), capped by turnover.',
          }),
        ],
      },
      {
        id: 'payment',
        title: '6.1 — Payment of tax',
        description:
          'Credit set off in the order the law requires: IGST credit first, then Central and State/UT credit, never Central against State/UT, Cess only against Cess. Reverse-charge tax, interest and late fee are paid in cash.',
        fields: [
          ...rowFields('t61_open', '6.1 Opening credit', 'Balance in your electronic credit ledger before this return', {
            helpText: 'Optional. Credit carried forward from earlier periods, from the portal.',
          }),
          ...rowFields('t61_payable', '6.1 Tax payable', 'Tax payable (other than reverse charge)', { calculated: true }),
          ...rowFields('t61_itc', '6.1 Paid through ITC', 'Paid through ITC', { calculated: true }),
          ...rowFields('t61_cash', '6.1 Paid in cash', 'Tax paid in cash (other than reverse charge)', { calculated: true }),
          ...rowFields('t61_rc_cash', '6.1 Reverse charge', 'Reverse-charge tax paid in cash', { calculated: true }),
          ...rowFields('t61_cf', '6.1 Credit carried forward', 'Credit left in the ledger after this return', { calculated: true }),
          {
            id: 'net_tax',
            label: 'Total cash to pay (tax, reverse charge, interest and late fee)',
            officialLabel: '6.1 Total cash',
            type: 'currency',
            calculated: true,
            editable: false,
            required: true,
            helpText: 'What you pay through the electronic cash ledger for this return.',
          },
        ],
      },
    ]);
  },

  getFilingPeriods: () => ({
    monthly: true,
    quarterly: true, // QRMP scheme for small taxpayers
    annual: false,
    defaultFrequency: 'monthly',
  }),

  getFinancialYearBounds: (y) => ({
    // India: 1 April to 31 March
    start: new Date(y, 3, 1),
    end: new Date(y + 1, 2, 31),
  }),

  getTerminology: () => ({
    taxName: 'GST',
    taxAbbrev: 'GST',
    salesLabel: 'Outward supplies',
    purchasesLabel: 'Inward supplies',
    outputTaxLabel: 'Output GST',
    inputTaxLabel: 'Input Tax Credit (ITC)',
  }),

  calculateFields(v: FieldValues): CalculatedFields {
    const g = (id: string) => num(v[id]);
    const out: CalculatedFields = {};

    // 4(C) = 4(A) − 4(B), per head.
    const netItc = zeroHeads();
    for (const h of HEADS) {
      const avail = g(`t4a1_${h}`) + g(`t4a2_${h}`) + g(`t4a3_${h}`) + g(`t4a4_${h}`) + g(`t4a5_${h}`);
      const reversed = g(`t4b1_${h}`) + g(`t4b2_${h}`);
      netItc[h] = r2(avail - reversed);
      out[`t4c_${h}`] = netItc[h];
    }

    // 6.1 — liability other than reverse charge is 3.1(a) + 3.1(b).
    const liability = zeroHeads();
    const credit = zeroHeads();
    for (const h of HEADS) {
      liability[h] = r2(g(`t31a_${h}`) + g(`t31b_${h}`));
      credit[h] = r2(netItc[h] + g(`t61_open_${h}`));
    }
    const s = setOffIndiaGst(liability, credit);

    let cash = 0;
    for (const h of HEADS) {
      out[`t61_payable_${h}`] = s.payable[h];
      out[`t61_itc_${h}`] = s.paidByCredit[h];
      out[`t61_cash_${h}`] = s.paidInCash[h];
      out[`t61_cf_${h}`] = s.carriedForward[h];
      const rc = r2(Math.max(0, g(`t31d_${h}`)));
      out[`t61_rc_cash_${h}`] = rc;
      // 3.1.1(i): tax the e-commerce operator pays under s 9(5) is cash only —
      // never set off against ITC, so it stays out of `liability` above.
      const eco = r2(Math.max(0, g(`t311i_${h}`)));
      cash += s.paidInCash[h] + rc + eco + g(`t51_int_${h}`);
    }
    cash += g('t51_fee_camt') + g('t51_fee_samt');
    out.net_tax = r2(cash);
    return out;
  },

  getAutoPopulateMapping: (): AggregationMapping[] => MAPPING.map((m) => ({ ...m })),

  migrateSavedValues: (values: FieldValues): FieldValues => migrateIndiaGstr3bValues(values),

  getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

  validateForm(v: FieldValues): ValidationResult[] {
    const results: ValidationResult[] = [];
    const g = (id: string) => num(v[id]);

    // Intra-state tax is split equally: CGST and SGST/UTGST should match on every row.
    for (const row of ['t31a', 't31d', 't4a3', 't4a4', 't4a5', 't4b1', 't4b2']) {
      const c = g(`${row}_camt`);
      const s = g(`${row}_samt`);
      if (Math.abs(c - s) > 1) {
        results.push({
          fieldId: `${row}_camt`,
          message: 'Central tax and State/UT tax should be equal — an intra-state supply splits the tax in half',
          severity: 'warning',
        });
      }
    }

    // Auto-filled tax is intra-state until the app records a place of supply.
    if (g('t31a_camt') + g('t31a_samt') > 0 && g('t31a_iamt') === 0) {
      results.push({
        fieldId: 't31a_iamt',
        message:
          'Fin filled this tax as intra-state (Central + State/UT). If any of these supplies went to another state, move that tax to Integrated tax.',
        severity: 'info',
      });
    }

    // Imports of goods carry IGST only.
    if (g('t4a1_camt') !== 0 || g('t4a1_samt') !== 0) {
      results.push({
        fieldId: 't4a1_iamt',
        message: 'Import of goods carries Integrated tax only',
        severity: 'warning',
      });
    }

    // 3.2 is a breakdown of inter-state supplies already in 3.1(a).
    const t32 = g('t32_unreg_txval') + g('t32_comp_txval') + g('t32_uin_txval');
    if (t32 > g('t31a_txval') + 1) {
      results.push({
        fieldId: 't32_unreg_txval',
        message: 'Table 3.2 is part of 3.1(a), so its taxable value cannot exceed 3.1(a)',
        severity: 'error',
      });
    }
    const t32i = g('t32_unreg_iamt') + g('t32_comp_iamt') + g('t32_uin_iamt');
    if (t32i > g('t31a_iamt') + 1) {
      results.push({
        fieldId: 't32_unreg_iamt',
        message: 'Integrated tax in table 3.2 cannot exceed the Integrated tax in 3.1(a)',
        severity: 'error',
      });
    }

    // A negative net credit means more was reversed than claimed.
    for (const h of HEADS) {
      const avail = g(`t4a1_${h}`) + g(`t4a2_${h}`) + g(`t4a3_${h}`) + g(`t4a4_${h}`) + g(`t4a5_${h}`);
      const reversed = g(`t4b1_${h}`) + g(`t4b2_${h}`);
      if (reversed > avail + 1) {
        results.push({
          fieldId: `t4b1_${h}`,
          message: `${HEAD_LABEL[h]} reversed in 4(B) is more than the credit in 4(A) — the extra reversal is paid in cash, through table 5.1 or DRC-03`,
          severity: 'warning',
        });
      }
    }
    return results;
  },

  getFieldHelp: (fieldId) => {
    const help: Record<string, string> = {
      t31a_iamt: 'Integrated tax applies to inter-state supplies. Its rate is the Central and State/UT rates combined.',
      t31a_camt: 'Central tax on intra-state supplies — half of the GST rate.',
      t31a_samt: 'State or Union Territory tax on intra-state supplies — the other half.',
      t4c_iamt: 'Credit you can use this period after reversals.',
      net_tax: 'Pay this through the electronic cash ledger (PMT-06 challan) by the due date.',
    };
    return help[fieldId] ?? null;
  },

  getSupportedExportFormats: (): ExportFormat[] => [
    {
      id: 'json',
      label: 'JSON (by table)',
      mimeType: 'application/json',
      fileExtension: 'json',
    },
    { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
  ],

  async generateExport(v: FieldValues, format: string): Promise<ExportOutput> {
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'csv') return toCsv(v, `GSTR3B-IN-${stamp}`);
    return {
      data: JSON.stringify(gstr3bJson(v), null, 2),
      filename: `GSTR3B-IN-${stamp}.json`,
      mimeType: 'application/json',
    };
  },

  getPortalSubmissionInfo: () => ({
    portalUrl: 'https://gst.gov.in',
    submissionMethod: 'manual_upload' as const,
    apiReady: false,
  }),

  hasSubJurisdictions: () => true,
  getSubJurisdictions: () => INDIAN_STATES,
  supportsCustomFields: () => false,

  /**
   * IN treatment catalogue mapped to GSTR-3B tables. `rate: null` where the
   * GST slab (5 / 18 / 40%) depends on the HSN/SAC of the item.
   */
  getTaxTreatments(): TaxTreatmentDefinition[] {
    const ref = 'https://www.gst.gov.in/help/returns';
    const intra = (row: string) => [`${row} CGST`, `${row} SGST`];
    return [
      {
        code: 'SALE_STANDARD',
        label: 'Outward taxable supplies',
        side: 'sale',
        rate: null,
        taxApplies: true,
        creditable: true,
        boxes: ['3.1(a)', '3.1(a) IGST', ...intra('3.1(a)')],
        help: 'Taxable outward supplies at the applicable slab (5%, 18% or 40%). Taxable value in 3.1(a); tax as Integrated tax (inter-state) or Central + State/UT tax (intra-state).',
        authorityRef: ref,
        defaultFor: ['sales', 'services_income'],
      },
      {
        code: 'SALE_REDUCED',
        label: 'Outward taxable supplies (concessional rate)',
        side: 'sale',
        rate: null,
        taxApplies: true,
        creditable: true,
        boxes: ['3.1(a)', '3.1(a) IGST', ...intra('3.1(a)')],
        help: 'Supplies at a lower rate (5%, or 0.25% and 3% for precious stones and metals). Reported with other taxable supplies in 3.1(a).',
        authorityRef: ref,
      },
      {
        code: 'SALE_ZERO_RATED',
        label: 'Zero-rated supplies (exports / SEZ)',
        side: 'sale',
        rate: 0,
        taxApplies: false,
        creditable: true,
        boxes: ['3.1(b)'],
        help: 'Exports and supplies to SEZ units/developers. Value in 3.1(b); ITC remains available (refund route).',
        authorityRef: ref,
        defaultFor: ['export_sales'],
      },
      {
        code: 'SALE_EXEMPT',
        label: 'Exempt supplies',
        side: 'sale',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: ['3.1(c)'],
        help: 'Supplies exempt by notification (for example healthcare and education services). Value in 3.1(c); credit attributable to them is reversed under rules 42/43 in 4(B)(1).',
        authorityRef: ref,
      },
      {
        code: 'SALE_INPUT_TAXED',
        label: 'Nil-rated / exempt supplies',
        side: 'sale',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: ['3.1(c)'],
        help: 'Nil-rated and exempted outward supplies (including interest on deposits and residential renting). Value in 3.1(c); proportionate ITC reversal under rules 42/43.',
        authorityRef: ref,
        defaultFor: ['interest_income', 'residential_rent'],
      },
      {
        code: 'PURCHASE_STANDARD',
        label: 'Inward supplies with ITC',
        side: 'purchase',
        rate: null,
        taxApplies: true,
        creditable: true,
        boxes: ['4(A)(5) IGST', ...intra('4(A)(5)')],
        help: 'Purchases from registered suppliers with GST charged; credit claimed in 4(A)(5) (Integrated tax, or Central + State/UT tax).',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_CAPITAL',
        label: 'Capital goods with ITC',
        side: 'purchase',
        rate: null,
        taxApplies: true,
        creditable: true,
        boxes: ['4(A)(5) IGST', ...intra('4(A)(5)')],
        help: 'Capital goods used for business; credit claimed in 4(A)(5) (subject to rule 43 for mixed use).',
        authorityRef: ref,
        defaultFor: ['equipment', 'vehicles'],
      },
      {
        code: 'PURCHASE_REDUCED',
        label: 'Inward supplies at a concessional rate',
        side: 'purchase',
        rate: null,
        taxApplies: true,
        creditable: true,
        boxes: ['4(A)(5) IGST', ...intra('4(A)(5)')],
        help: 'Purchases taxed at a lower rate; credit claimed in 4(A)(5).',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_NO_TAX',
        label: 'Inward supplies without GST',
        side: 'purchase',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: ['5 Exempt intra-state', '5 Exempt inter-state'],
        help: 'Purchases from composition suppliers, and nil-rated and exempt inward supplies (bank charges, interest). No ITC; value disclosed in table 5.',
        authorityRef: ref,
        defaultFor: ['bank_fees', 'government_fees'],
      },
      {
        code: 'PURCHASE_CAPITAL_NO_TAX',
        label: 'Capital goods without GST',
        side: 'purchase',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: ['5 Exempt intra-state', '5 Exempt inter-state'],
        help: 'Capital goods bought from a composition or unregistered supplier, or exempt. No ITC; value disclosed in table 5.',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_INPUT_TAXED',
        label: 'Inward supplies for exempt outward supplies',
        side: 'purchase',
        rate: null,
        taxApplies: true,
        creditable: false,
        boxes: ['4(A)(5) IGST', ...intra('4(A)(5)'), '4(B)(1) IGST', ...intra('4(B)(1)')],
        help: 'Credit attributable to exempt supplies: shown in 4(A)(5) as GSTR-2B has it, then reversed under rules 42/43 in 4(B)(1).',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_PRIVATE',
        label: 'Blocked credit / personal use',
        side: 'purchase',
        rate: null,
        taxApplies: true,
        creditable: false,
        boxes: ['4(A)(5) IGST', ...intra('4(A)(5)'), '4(B)(1) IGST', ...intra('4(B)(1)')],
        help: 'Blocked credits under section 17(5) (food and beverages, club memberships, personal vehicles) and personal-use portions: shown in 4(A)(5) as GSTR-2B has it, then reversed in 4(B)(1).',
        authorityRef: ref,
        defaultFor: ['entertainment', 'fines_penalties'],
      },
      {
        code: 'PURCHASE_REVERSE_CHARGE',
        label: 'Inward supplies liable to reverse charge',
        side: 'purchase',
        rate: null,
        taxApplies: true,
        creditable: true,
        boxes: ['3.1(d)', '3.1(d) IGST', ...intra('3.1(d)'), '4(A)(3) IGST', ...intra('4(A)(3)')],
        help: 'Purchases on which you pay GST under reverse charge (notified goods and services, unregistered suppliers where notified). Value and tax in 3.1(d), paid in cash; credit claimed in 4(A)(3), or 4(A)(2) for import of services.',
        authorityRef: ref,
      },
      {
        code: 'PURCHASE_IMPORT',
        label: 'Import of goods (IGST paid at customs)',
        side: 'purchase',
        rate: null,
        taxApplies: true,
        creditable: true,
        boxes: ['4(A)(1) IGST'],
        help: 'IGST paid on imported goods is claimed as ITC in table 4(A)(1).',
        authorityRef: ref,
      },
      {
        code: 'WAGES',
        label: 'Salaries and wages',
        side: 'payroll',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: [],
        help: 'Services by an employee to the employer are neither goods nor services (Schedule III); not reported.',
        defaultFor: ['wages', 'salaries'],
      },
      {
        code: 'WITHHOLDING',
        label: 'TDS on salary',
        side: 'payroll',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: [],
        help: 'Income-tax TDS is reported on Form 24Q, not GSTR-3B.',
        defaultFor: ['payg_withholding'],
      },
      {
        code: 'OUT_OF_SCOPE',
        label: 'Non-GST / not a supply',
        side: 'excluded',
        rate: 0,
        taxApplies: false,
        creditable: false,
        boxes: ['3.1(e)'],
        help: 'Non-GST outward supplies (alcohol, petroleum) go in 3.1(e); transfers, loan principal, drawings, dividends and tax payments are not reported at all.',
        defaultFor: ['transfers', 'loan_principal', 'owner_drawings', 'dividends', 'tax_payments'],
      },
    ];
  },

  /** The CBDT's block-of-assets regime under the Income-tax Act 2025 — see ./indiaDepreciation. */
  getDepreciationRules(): DepreciationRules {
    return IN_DEPRECIATION_RULES;
  },
};

// ─── JSON export (GSTN field names) ─────────────────────────────────────────

/**
 * The return in the shape and field names of the GSTN GSTR-3B JSON
 * (sup_details, itc_elg, inward_sup, intr_ltfee). A reference copy to review
 * or hand to a practitioner — GSTIN, period and the place-of-supply rows of
 * table 3.2 are added on the portal.
 */
export function gstr3bJson(v: FieldValues) {
  const g = (id: string) => r2(num(v[id]));
  const row = (prefix: string, heads: readonly Head[] = HEADS, txval = true) => {
    const o: Record<string, number> = {};
    if (txval) o.txval = g(`${prefix}_txval`);
    for (const h of heads) o[h] = g(`${prefix}_${h}`);
    return o;
  };
  const calc = inPlugin.calculateFields(v);
  const c = (id: string) => r2(num(calc[id]));
  return {
    sup_details: {
      osup_det: row('t31a'),
      osup_zero: row('t31b', ['iamt', 'csamt']),
      osup_nil_exmp: { txval: g('t31c_txval') },
      isup_rev: row('t31d'),
      osup_nongst: { txval: g('t31e_txval') },
    },
    eco_dtls: {
      eco_sup: row('t311i'),
      eco_reg_sup: { txval: g('t311ii_txval') },
    },
    inter_sup_totals: {
      unreg: row('t32_unreg', ['iamt']),
      comp: row('t32_comp', ['iamt']),
      uin: row('t32_uin', ['iamt']),
    },
    itc_elg: {
      itc_avl: [
        { ty: 'IMPG', ...row('t4a1', HEADS, false) },
        { ty: 'IMPS', ...row('t4a2', HEADS, false) },
        { ty: 'ISRC', ...row('t4a3', HEADS, false) },
        { ty: 'ISD', ...row('t4a4', HEADS, false) },
        { ty: 'OTH', ...row('t4a5', HEADS, false) },
      ],
      itc_rev: [
        { ty: 'RUL', ...row('t4b1', HEADS, false) },
        { ty: 'OTH', ...row('t4b2', HEADS, false) },
      ],
      itc_net: { iamt: c('t4c_iamt'), camt: c('t4c_camt'), samt: c('t4c_samt'), csamt: c('t4c_csamt') },
      itc_inelg: [
        { ty: 'RUL', ...row('t4d1', HEADS, false) },
        { ty: 'OTH', ...row('t4d2', HEADS, false) },
      ],
    },
    inward_sup: {
      isup_details: [
        { ty: 'GST', inter: g('t5_gst_inter'), intra: g('t5_gst_intra') },
        { ty: 'NONGST', inter: g('t5_nongst_inter'), intra: g('t5_nongst_intra') },
      ],
    },
    intr_ltfee: {
      intr_details: row('t51_int', HEADS, false),
      ltfee_details: { camt: g('t51_fee_camt'), samt: g('t51_fee_samt') },
    },
    payment: {
      payable: { iamt: c('t61_payable_iamt'), camt: c('t61_payable_camt'), samt: c('t61_payable_samt'), csamt: c('t61_payable_csamt') },
      paid_itc: { iamt: c('t61_itc_iamt'), camt: c('t61_itc_camt'), samt: c('t61_itc_samt'), csamt: c('t61_itc_csamt') },
      paid_cash: { iamt: c('t61_cash_iamt'), camt: c('t61_cash_camt'), samt: c('t61_cash_samt'), csamt: c('t61_cash_csamt') },
      total_cash: c('net_tax'),
    },
  };
}

export default inPlugin;
