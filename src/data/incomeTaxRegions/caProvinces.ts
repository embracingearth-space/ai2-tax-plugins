/**
 * Canada — provincial and territorial income tax, on top of federal.
 * @ai2/tax-plugins — embracingearth.space
 *
 * Every province and territory charges its own income tax on (broadly) the
 * same taxable income as the federal return, with its own brackets and its own
 * non-refundable credits at its own lowest rate (the "428" form for each
 * jurisdiction; Quebec's own TP-1 return). A caller selects one with
 * `options.region` ('ON', 'QC', …); INCOME_TAX_SCHEMES.CA then adds the
 * provincial charge to the federal tax it already computes.
 *
 * THE ORDER, as on the 428 forms (Ontario's is the longest):
 *   basic provincial tax (brackets on taxable income)
 *   − basic personal amount × the provincial credit rate (non-refundable)
 *   + surtax on that (Ontario only)
 *   − tax reductions (BC; Ontario's tax reduction and LIFT credit; the
 *     low-income reductions of NB, NL, NS and PE where that year's amounts
 *     are published)
 *   + Ontario Health Premium (charged on taxable income, after everything)
 * Quebec: taxable income less the deduction for workers, Quebec brackets, less
 * the basic personal amount at 14% — and on the FEDERAL side the refundable
 * Quebec abatement of 16.5% of basic federal tax, returned as a national offset.
 *
 * WHAT IS NOT HERE, for every province (said in each result's assumptions):
 * the CPP/QPP and EI premium credits, provincial employment or other credits
 * (except Yukon's Canada employment amount, which Yukon applies to every
 * employee), refundable benefits paid outside the return, and Alberta's
 * supplemental credit (it only applies when the credit base exceeds the first
 * bracket, which the basic personal amount alone never does).
 *
 * FIGURES. Every figure was read on 2026-10-06 in the CRA's T4127 Payroll
 * Deductions Formulas (122nd ed., Tables 8.1/8.2 for 2026 and 8.22/8.23 for
 * the final 2025 values after the mid-year changes), the 2025 provincial 428
 * forms, the CRA 2026 bracket page, provincial finance pages, and Revenu
 * Québec. Where payroll used prorated mid-year rates (Alberta, BC, PEI, NL,
 * Nova Scotia, Saskatchewan), the ANNUAL statutory figure is recorded — that is
 * what the return computes.
 *
 * Newest first per province. Append the next year when T4127 for January
 * publishes it (November); never edit a year in place.
 */
import type { IncomeLineItem, IncomeTaxBand, IncomeTaxRegion, IncomeTaxRegionSet, MoneyRounding, RegionalTaxContext } from '../incomeTax';
import { progressive, nonNegative } from '../incomeTaxMath';

const T4127_2026 = 'https://www.canada.ca/content/dam/cra-arc/formspubs/pub/t4127-jan/t4127-01-26e.pdf';
const CRA = 'Canada Revenue Agency (T4127 Payroll Deductions Formulas; provincial/territorial 428 forms)';
const form428 = (n: string) => `https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/${n}/${n}-25e.pdf`;
const READ = '2026-10-06';

/** A linear low-income reduction: `amount` less `rate` × income above `from`. */
interface LinearReduction {
  name: string;
  amount: number;
  from: number;
  rate: number;
}

interface ProvinceYear {
  taxYear: string;
  effectiveFrom: string;
  bands: IncomeTaxBand[];
  /** Basic personal amount and the rate the credits are computed at. */
  bpa: number;
  creditRate: number;
  /** BPA reduced on a straight line to `min` between net income `from` and `to` (Yukon mirrors federal; Manitoba phases to 0). */
  bpaPhase?: { min: number; from: number; to: number };
  /** Yukon: credit at creditRate on the Canada employment amount (lesser of employment income and this). */
  canadaEmploymentAmount?: number;
  /** Ontario surtax tiers on provincial tax after credits. */
  surtax?: { threshold: number; rate: number }[];
  /** Ontario tax reduction basic amount (single, no dependants). */
  ontarioTaxReduction?: number;
  /** Ontario LIFT credit. */
  lift?: { max: number; rate: number; threshold: number; phaseOutRate: number };
  ontarioHealthPremium?: boolean;
  /** BC tax reduction and the NB/NL/NS/PE low-income reductions. */
  reduction?: LinearReduction;
  /** Quebec deduction for workers: rate × employment income, capped. */
  workersDeduction?: { rate: number; max: number };
  /** Quebec abatement of basic federal tax. */
  federalAbatement?: number;
  source: string;
  authorityName: string;
  verified: boolean;
  verificationNote?: string;
  assumptions?: string[];
}

/** Ontario Health Premium on taxable income (ON428 line 89; not indexed). */
function ontarioHealthPremium(a: number): number {
  if (a <= 20000) return 0;
  if (a <= 36000) return Math.min(300, 0.06 * (a - 20000));
  if (a <= 48000) return Math.min(450, 300 + 0.06 * (a - 36000));
  if (a <= 72000) return Math.min(600, 450 + 0.25 * (a - 48000));
  if (a <= 200000) return Math.min(750, 600 + 0.25 * (a - 72000));
  return Math.min(900, 750 + 0.25 * (a - 200000));
}

function basicPersonalAmount(y: ProvinceYear, netIncome: number): number {
  if (!y.bpaPhase) return y.bpa;
  const { min, from, to } = y.bpaPhase;
  if (netIncome <= from) return y.bpa;
  if (netIncome >= to) return min;
  return y.bpa - ((y.bpa - min) * (netIncome - from)) / (to - from);
}

/** The provincial charge for one year: the 428 order in the module header. */
function provincialTax(name: string, y: ProvinceYear, ctx: RegionalTaxContext, q: MoneyRounding) {
  const gross = ctx.gross;
  // No federal deductions are modelled, so net income = taxable income = gross.
  const workers = y.workersDeduction ? Math.min(gross * y.workersDeduction.rate, y.workersDeduction.max) : 0;
  const taxable = nonNegative(gross - workers);
  const basic = progressive(taxable, y.bands);
  let credits = y.creditRate * basicPersonalAmount(y, gross);
  if (y.canadaEmploymentAmount) credits += y.creditRate * Math.min(gross, y.canadaEmploymentAmount);
  const afterCredits = nonNegative(basic - credits);
  const surtax = (y.surtax ?? []).reduce((s, t) => s + t.rate * nonNegative(afterCredits - t.threshold), 0);
  let tax = afterCredits + surtax;
  if (y.ontarioTaxReduction !== undefined) tax -= Math.min(tax, nonNegative(2 * y.ontarioTaxReduction - tax));
  if (y.lift) {
    const lift = nonNegative(Math.min(y.lift.max, y.lift.rate * gross) - y.lift.phaseOutRate * nonNegative(gross - y.lift.threshold));
    tax -= Math.min(tax, lift);
  }
  if (y.reduction) {
    const r = nonNegative(y.reduction.amount - y.reduction.rate * nonNegative(gross - y.reduction.from));
    tax -= Math.min(tax, r);
  }
  const levies: IncomeLineItem[] = [];
  const provincial = q.round(nonNegative(tax));
  if (provincial > 0) levies.push({ name: `${name} income tax`, amount: provincial });
  if (y.ontarioHealthPremium) {
    const ohp = q.round(ontarioHealthPremium(taxable));
    if (ohp > 0) levies.push({ name: 'Ontario Health Premium', amount: ohp });
  }
  const nationalOffsets: IncomeLineItem[] = [];
  if (y.federalAbatement) {
    const abatement = q.round(y.federalAbatement * ctx.nationalTaxAfterCredits);
    if (abatement > 0) nationalOffsets.push({ name: `Refundable Quebec abatement (${y.federalAbatement * 100}% of basic federal tax)`, amount: abatement });
  }
  return { levies, nationalOffsets };
}

const STANDING = [
  'Provincial/territorial tax is computed on the same income as the federal estimate (no RRSP, union-dues or other deductions).',
  'Only the provincial basic personal amount credit and the reductions named in the note are applied: the CPP/QPP and EI premium credits and other provincial credits are not included, so tax may be slightly overstated.',
];

function province(code: string, name: string, years: ProvinceYear[], extra: { note?: string; assumptions?: string[] } = {}): IncomeTaxRegion {
  const sets: IncomeTaxRegionSet[] = years.map((y) => ({
    effectiveFrom: y.effectiveFrom,
    taxYearLabel: y.taxYear,
    bands: y.bands,
    compute: (ctx) => provincialTax(name, y, ctx, ctx.q),
    ...(y.assumptions ? { assumptions: y.assumptions } : {}),
    source: y.source,
    authorityName: y.authorityName,
    citationDate: READ,
    verified: y.verified,
    ...(y.verificationNote ? { verificationNote: y.verificationNote } : {}),
  }));
  return {
    code,
    name,
    mode: 'additional',
    sets,
    file: 'src/data/incomeTaxRegions/caProvinces.ts',
    note: extra.note ?? `${name} income tax added to the federal tax: ${name} brackets less the ${name} basic personal amount credit.`,
    assumptions: [...STANDING, ...(extra.assumptions ?? [])],
  };
}

const LIR_2026_UNPUBLISHED = (name: string, amounts: string) =>
  `The ${name} low-income tax reduction for 2026 is not published yet (2025: ${amounts}); it is not applied for 2026, so tax at low incomes may be overstated.`;

export const CA_PROVINCES: Record<string, IncomeTaxRegion> = {
  AB: province('AB', 'Alberta', [
    {
      taxYear: '2026', effectiveFrom: '2026-01-01',
      bands: [{ upTo: 61200, rate: 0.08 }, { upTo: 154259, rate: 0.1 }, { upTo: 185111, rate: 0.12 }, { upTo: 246813, rate: 0.13 }, { upTo: 370220, rate: 0.14 }, { upTo: null, rate: 0.15 }],
      bpa: 22769, creditRate: 0.08, source: T4127_2026, authorityName: CRA, verified: true,
    },
    {
      // New 8% bracket on the first $60,000, announced 2025-02-27, retroactive to 1 January 2025.
      taxYear: '2025', effectiveFrom: '2025-01-01',
      bands: [{ upTo: 60000, rate: 0.08 }, { upTo: 151234, rate: 0.1 }, { upTo: 181481, rate: 0.12 }, { upTo: 241974, rate: 0.13 }, { upTo: 362961, rate: 0.14 }, { upTo: null, rate: 0.15 }],
      bpa: 22323, creditRate: 0.08, source: form428('5009-c'), authorityName: CRA, verified: true,
    },
  ], { assumptions: ['The Alberta supplemental tax credit is not applied: it only arises when the non-refundable credit base exceeds the first bracket, which the basic personal amount alone does not.'] }),

  BC: province('BC', 'British Columbia', [
    {
      // BC Budget 2026: lowest rate 5.06% → 5.60%, tax reduction $562 → $690 (annual statutory values).
      taxYear: '2026', effectiveFrom: '2026-01-01',
      bands: [{ upTo: 50363, rate: 0.056 }, { upTo: 100728, rate: 0.077 }, { upTo: 115648, rate: 0.105 }, { upTo: 140430, rate: 0.1229 }, { upTo: 190405, rate: 0.147 }, { upTo: 265545, rate: 0.168 }, { upTo: null, rate: 0.205 }],
      bpa: 13216, creditRate: 0.056,
      reduction: { name: 'BC tax reduction', amount: 690, from: 25570, rate: 0.0356 },
      source: 'https://www2.gov.bc.ca/gov/content/taxes/income-taxes/personal/tax-rates', authorityName: 'Government of British Columbia; CRA T4127', verified: true,
    },
    {
      taxYear: '2025', effectiveFrom: '2025-01-01',
      bands: [{ upTo: 49279, rate: 0.0506 }, { upTo: 98560, rate: 0.077 }, { upTo: 113158, rate: 0.105 }, { upTo: 137407, rate: 0.1229 }, { upTo: 186306, rate: 0.147 }, { upTo: 259829, rate: 0.168 }, { upTo: null, rate: 0.205 }],
      bpa: 12932, creditRate: 0.0506,
      reduction: { name: 'BC tax reduction', amount: 562, from: 25020, rate: 0.0356 },
      source: form428('5010-c'), authorityName: CRA, verified: true,
    },
  ], { note: 'British Columbia income tax added to the federal tax: BC brackets less the BC basic personal amount credit and the BC tax reduction for low incomes.' }),

  MB: province('MB', 'Manitoba', [
    {
      taxYear: '2026', effectiveFrom: '2026-01-01',
      bands: [{ upTo: 47000, rate: 0.108 }, { upTo: 100000, rate: 0.1275 }, { upTo: null, rate: 0.174 }],
      bpa: 15780, creditRate: 0.108, bpaPhase: { min: 0, from: 200000, to: 400000 },
      source: T4127_2026, authorityName: CRA, verified: false,
      verificationNote: 'Official sources conflict for 2026: T4127 (January and July 2026) and Manitoba Budget 2026 keep the brackets frozen at $47,000 / $100,000 and the basic personal amount at $15,780 (used here), but the CRA 2026 bracket page shows $47,564 / $101,200. Recheck against the 2026 MB428 when it is published',
    },
    {
      // Indexation paused from 2025: brackets and BPA frozen at the 2024 values.
      taxYear: '2025', effectiveFrom: '2025-01-01',
      bands: [{ upTo: 47000, rate: 0.108 }, { upTo: 100000, rate: 0.1275 }, { upTo: null, rate: 0.174 }],
      bpa: 15780, creditRate: 0.108, bpaPhase: { min: 0, from: 200000, to: 400000 },
      source: form428('5007-c'), authorityName: CRA, verified: true,
    },
  ], { note: 'Manitoba income tax added to the federal tax: Manitoba brackets less the Manitoba basic personal amount credit, which phases out between $200,000 and $400,000 of net income.' }),

  NB: province('NB', 'New Brunswick', [
    {
      taxYear: '2026', effectiveFrom: '2026-01-01',
      bands: [{ upTo: 52333, rate: 0.094 }, { upTo: 104666, rate: 0.14 }, { upTo: 193861, rate: 0.16 }, { upTo: null, rate: 0.195 }],
      bpa: 13664, creditRate: 0.094, source: T4127_2026, authorityName: CRA, verified: true,
      assumptions: [LIR_2026_UNPUBLISHED('New Brunswick', '$802 less 3% of net income over $21,920')],
    },
    {
      taxYear: '2025', effectiveFrom: '2025-01-01',
      bands: [{ upTo: 51306, rate: 0.094 }, { upTo: 102614, rate: 0.14 }, { upTo: 190060, rate: 0.16 }, { upTo: null, rate: 0.195 }],
      bpa: 13396, creditRate: 0.094,
      reduction: { name: 'New Brunswick low-income tax reduction', amount: 802, from: 21920, rate: 0.03 },
      source: form428('5004-c'), authorityName: CRA, verified: true,
    },
  ]),

  NL: province('NL', 'Newfoundland and Labrador', [
    {
      // BPA raised to $13,094 for 2026 (announced 2026-04-29; annual statutory amount).
      taxYear: '2026', effectiveFrom: '2026-01-01',
      bands: [{ upTo: 44678, rate: 0.087 }, { upTo: 89354, rate: 0.145 }, { upTo: 159528, rate: 0.158 }, { upTo: 223340, rate: 0.178 }, { upTo: 285319, rate: 0.198 }, { upTo: 570638, rate: 0.208 }, { upTo: 1141275, rate: 0.213 }, { upTo: null, rate: 0.218 }],
      bpa: 13094, creditRate: 0.087,
      source: 'https://www.gov.nl.ca/fin/tax-programs-incentives/personal/personalincometax/', authorityName: 'Government of Newfoundland and Labrador; CRA T4127', verified: true,
      assumptions: [LIR_2026_UNPUBLISHED('Newfoundland and Labrador', '$997 less 16% of net income over $23,928')],
    },
    {
      taxYear: '2025', effectiveFrom: '2025-01-01',
      bands: [{ upTo: 44192, rate: 0.087 }, { upTo: 88382, rate: 0.145 }, { upTo: 157792, rate: 0.158 }, { upTo: 220910, rate: 0.178 }, { upTo: 282214, rate: 0.198 }, { upTo: 564429, rate: 0.208 }, { upTo: 1128858, rate: 0.213 }, { upTo: null, rate: 0.218 }],
      bpa: 11067, creditRate: 0.087,
      reduction: { name: 'Newfoundland and Labrador low-income tax reduction', amount: 997, from: 23928, rate: 0.16 },
      source: form428('5001-c'), authorityName: CRA, verified: true,
    },
  ]),

  NS: province('NS', 'Nova Scotia', [
    {
      taxYear: '2026', effectiveFrom: '2026-01-01',
      bands: [{ upTo: 30995, rate: 0.0879 }, { upTo: 61991, rate: 0.1495 }, { upTo: 97417, rate: 0.1667 }, { upTo: 157124, rate: 0.175 }, { upTo: null, rate: 0.21 }],
      bpa: 11932, creditRate: 0.0879, source: T4127_2026, authorityName: CRA, verified: true,
      assumptions: [LIR_2026_UNPUBLISHED('Nova Scotia', '$300 less 5% of net income over $15,000')],
    },
    {
      // From 2025 the BPA is the flat maximum $11,744 for everyone (the income-tested supplement is gone).
      taxYear: '2025', effectiveFrom: '2025-01-01',
      bands: [{ upTo: 30507, rate: 0.0879 }, { upTo: 61015, rate: 0.1495 }, { upTo: 95883, rate: 0.1667 }, { upTo: 154650, rate: 0.175 }, { upTo: null, rate: 0.21 }],
      bpa: 11744, creditRate: 0.0879,
      reduction: { name: 'Nova Scotia low-income tax reduction', amount: 300, from: 15000, rate: 0.05 },
      source: form428('5003-c'), authorityName: CRA, verified: true,
    },
  ]),

  NT: province('NT', 'Northwest Territories', [
    {
      taxYear: '2026', effectiveFrom: '2026-01-01',
      bands: [{ upTo: 53003, rate: 0.059 }, { upTo: 106009, rate: 0.086 }, { upTo: 172346, rate: 0.122 }, { upTo: null, rate: 0.1405 }],
      bpa: 18198, creditRate: 0.059, source: T4127_2026, authorityName: CRA, verified: true,
    },
    {
      taxYear: '2025', effectiveFrom: '2025-01-01',
      bands: [{ upTo: 51964, rate: 0.059 }, { upTo: 103930, rate: 0.086 }, { upTo: 168967, rate: 0.122 }, { upTo: null, rate: 0.1405 }],
      bpa: 17842, creditRate: 0.059, source: form428('5012-c'), authorityName: CRA, verified: true,
    },
  ]),

  NU: province('NU', 'Nunavut', [
    {
      taxYear: '2026', effectiveFrom: '2026-01-01',
      bands: [{ upTo: 55801, rate: 0.04 }, { upTo: 111602, rate: 0.07 }, { upTo: 181439, rate: 0.09 }, { upTo: null, rate: 0.115 }],
      bpa: 19659, creditRate: 0.04, source: T4127_2026, authorityName: CRA, verified: true,
    },
    {
      taxYear: '2025', effectiveFrom: '2025-01-01',
      bands: [{ upTo: 54707, rate: 0.04 }, { upTo: 109413, rate: 0.07 }, { upTo: 177881, rate: 0.09 }, { upTo: null, rate: 0.115 }],
      bpa: 19274, creditRate: 0.04, source: form428('5014-c'), authorityName: CRA, verified: true,
    },
  ]),

  ON: province('ON', 'Ontario', [
    {
      // $150,000 and $220,000 thresholds are not indexed. 2026 ON428 not yet published; T4127 Ontario formulas.
      taxYear: '2026', effectiveFrom: '2026-01-01',
      bands: [{ upTo: 53891, rate: 0.0505 }, { upTo: 107785, rate: 0.0915 }, { upTo: 150000, rate: 0.1116 }, { upTo: 220000, rate: 0.1216 }, { upTo: null, rate: 0.1316 }],
      bpa: 12989, creditRate: 0.0505,
      surtax: [{ threshold: 5818, rate: 0.2 }, { threshold: 7446, rate: 0.36 }],
      ontarioTaxReduction: 300,
      lift: { max: 875, rate: 0.0505, threshold: 32500, phaseOutRate: 0.05 },
      ontarioHealthPremium: true,
      source: T4127_2026, authorityName: CRA, verified: true,
    },
    {
      taxYear: '2025', effectiveFrom: '2025-01-01',
      bands: [{ upTo: 52886, rate: 0.0505 }, { upTo: 105775, rate: 0.0915 }, { upTo: 150000, rate: 0.1116 }, { upTo: 220000, rate: 0.1216 }, { upTo: null, rate: 0.1316 }],
      bpa: 12747, creditRate: 0.0505,
      surtax: [{ threshold: 5710, rate: 0.2 }, { threshold: 7307, rate: 0.36 }],
      ontarioTaxReduction: 294,
      lift: { max: 875, rate: 0.0505, threshold: 32500, phaseOutRate: 0.05 },
      ontarioHealthPremium: true,
      source: form428('5006-c'), authorityName: CRA, verified: true,
    },
  ], { note: 'Ontario income tax added to the federal tax, in the ON428 order: Ontario brackets less the basic personal amount credit, plus the Ontario surtax, less the Ontario tax reduction and the LIFT credit, plus the Ontario Health Premium.' }),

  PE: province('PE', 'Prince Edward Island', [
    {
      // New 20% bracket over $200,000 from 2026 (announced 2026-04-14; annual statutory rate). PEI does not auto-index.
      taxYear: '2026', effectiveFrom: '2026-01-01',
      bands: [{ upTo: 33928, rate: 0.095 }, { upTo: 65820, rate: 0.1347 }, { upTo: 106890, rate: 0.166 }, { upTo: 142520, rate: 0.1762 }, { upTo: 200000, rate: 0.19 }, { upTo: null, rate: 0.2 }],
      bpa: 15000, creditRate: 0.095, source: T4127_2026, authorityName: CRA, verified: true,
      assumptions: [LIR_2026_UNPUBLISHED('Prince Edward Island', '$350 less 5% of net income over $22,650')],
    },
    {
      taxYear: '2025', effectiveFrom: '2025-01-01',
      bands: [{ upTo: 33328, rate: 0.095 }, { upTo: 64656, rate: 0.1347 }, { upTo: 105000, rate: 0.166 }, { upTo: 140000, rate: 0.1762 }, { upTo: null, rate: 0.19 }],
      bpa: 14650, creditRate: 0.095,
      reduction: { name: 'Prince Edward Island low-income tax reduction', amount: 350, from: 22650, rate: 0.05 },
      source: form428('5002-c'), authorityName: CRA, verified: true,
    },
  ]),

  QC: province('QC', 'Quebec', [
    {
      taxYear: '2026', effectiveFrom: '2026-01-01',
      bands: [{ upTo: 54345, rate: 0.14 }, { upTo: 108680, rate: 0.19 }, { upTo: 132245, rate: 0.24 }, { upTo: null, rate: 0.2575 }],
      bpa: 18952, creditRate: 0.14, workersDeduction: { rate: 0.06, max: 1450 }, federalAbatement: 0.165,
      source: 'https://www.revenuquebec.ca/en/citizens/income-tax-return/completing-your-income-tax-return/income-tax-rates/', authorityName: 'Revenu Québec; Ministère des Finances du Québec', verified: true,
    },
    {
      taxYear: '2025', effectiveFrom: '2025-01-01',
      bands: [{ upTo: 53255, rate: 0.14 }, { upTo: 106495, rate: 0.19 }, { upTo: 129590, rate: 0.24 }, { upTo: null, rate: 0.2575 }],
      bpa: 18571, creditRate: 0.14, workersDeduction: { rate: 0.06, max: 1420 }, federalAbatement: 0.165,
      source: 'https://www.revenuquebec.ca/en/citizens/income-tax-return/completing-your-income-tax-return/income-tax-rates/', authorityName: 'Revenu Québec; Ministère des Finances du Québec', verified: true,
    },
  ], {
    note: 'Quebec income tax (Revenu Québec TP-1) added to the federal tax: Quebec brackets on income less the deduction for workers, less the basic personal amount at 14%; the federal tax is reduced by the refundable Quebec abatement of 16.5% of basic federal tax.',
    assumptions: ['Quebec residents file a separate Revenu Québec return; QPP, QPIP and EI premiums are not included, and Quebec gives no credit for them in its own calculation.'],
  }),

  SK: province('SK', 'Saskatchewan', [
    {
      // BPA includes the second $500 Affordability Act step plus 2.0% indexation.
      taxYear: '2026', effectiveFrom: '2026-01-01',
      bands: [{ upTo: 54532, rate: 0.105 }, { upTo: 155805, rate: 0.125 }, { upTo: null, rate: 0.145 }],
      bpa: 20381, creditRate: 0.105, source: T4127_2026, authorityName: CRA, verified: true,
    },
    {
      taxYear: '2025', effectiveFrom: '2025-01-01',
      bands: [{ upTo: 53463, rate: 0.105 }, { upTo: 152750, rate: 0.125 }, { upTo: null, rate: 0.145 }],
      bpa: 19491, creditRate: 0.105, source: form428('5008-c'), authorityName: CRA, verified: true,
    },
  ], { assumptions: ['The Saskatchewan low-income tax credit is a refundable benefit paid outside the return and is not included.'] }),

  YT: province('YT', 'Yukon', [
    {
      taxYear: '2026', effectiveFrom: '2026-01-01',
      bands: [{ upTo: 58523, rate: 0.064 }, { upTo: 117045, rate: 0.09 }, { upTo: 181440, rate: 0.109 }, { upTo: 500000, rate: 0.128 }, { upTo: null, rate: 0.15 }],
      bpa: 16452, creditRate: 0.064, bpaPhase: { min: 14829, from: 181440, to: 258482 }, canadaEmploymentAmount: 1501,
      source: T4127_2026, authorityName: CRA, verified: true,
    },
    {
      taxYear: '2025', effectiveFrom: '2025-01-01',
      bands: [{ upTo: 57375, rate: 0.064 }, { upTo: 114750, rate: 0.09 }, { upTo: 177882, rate: 0.109 }, { upTo: 500000, rate: 0.128 }, { upTo: null, rate: 0.15 }],
      bpa: 16129, creditRate: 0.064, bpaPhase: { min: 14538, from: 177882, to: 253414 }, canadaEmploymentAmount: 1471,
      source: form428('5011-c'), authorityName: CRA, verified: true,
    },
  ], { note: 'Yukon income tax added to the federal tax: Yukon brackets less the Yukon basic personal amount credit (which mirrors the federal reduction above the 29% bracket) and the Canada employment amount credit Yukon gives every employee.' }),
};
