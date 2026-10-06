/**
 * United States — state income tax on wages, on top of federal.
 * @ai2/tax-plugins — embracingearth.space
 *
 * A caller selects a state (or DC) with `options.region` ('CA', 'NY', 'TX', …);
 * INCOME_TAX_SCHEMES.US then adds the state's income tax on wages to the
 * federal tax and FICA it already computes. Single filer, wages only, the
 * state's own standard deduction and personal exemption or credit — or, for the
 * states whose return starts from FEDERAL taxable income (CO, IA, MT, ND, NM,
 * SC 2025), the federal standard deduction the federal estimate used.
 *
 * NINE STATES HAVE NO TAX ON WAGES and are listed as a confirmed nil, not left
 * out, so "no state tax" is an answer with a source: AK, FL, NV, NH (whose
 * interest-and-dividends tax was repealed from 1 January 2025), SD, TN (Hall
 * tax repealed 2021), TX, WA (capital-gains excise only; its 2028 income tax
 * is not in force) and WY.
 *
 * LOCAL INCOME TAXES ARE NEVER INCLUDED — city, county and school-district
 * taxes (Maryland counties, New York City and Yonkers, Ohio municipalities,
 * Pennsylvania EIT and Philadelphia, Michigan cities, Indiana counties,
 * Kentucky occupational taxes, St. Louis and Kansas City, Wilmington,
 * Alabama occupational taxes, Denver OPT, Iowa school surtax, Portland-area
 * Metro/Multnomah taxes). Each state that has them says so in its assumptions.
 * Nor are state payroll contributions (SDI, paid leave, UI).
 *
 * A YEAR THAT IS NOT PUBLISHED IS NOT INVENTED. California, Idaho, Rhode Island
 * and Vermont had not published their 2026 figures on 2026-10-06, so they hold
 * 2025 only and the engine says it is using 2025 (and the rate watch flags the
 * gap). Where 2026 is published except one figure, the year is encoded with
 * `verified: false` and the note names the borrowed figure.
 *
 * Every figure was read on 2026-10-06 on the page named as each year's source
 * (state revenue departments, statutes, or the state's withholding formula
 * where the 2026 return instructions are not out yet — said where so).
 */
import type { IncomeLineItem, IncomeTaxBand, IncomeTaxRegion, IncomeTaxRegionSet, RegionalTaxContext } from '../incomeTax';
import { progressive, nonNegative } from '../incomeTaxMath';

const READ = '2026-10-06';

type ByAgi = number | ((agi: number) => number);

interface StateYear {
  taxYear: string;
  /** No tax on wages this year. */
  none?: true;
  /** Brackets on state taxable income. */
  bands?: IncomeTaxBand[];
  /** The state's own amount, an AGI-dependent schedule, or 'federal' (the federal standard deduction). */
  standardDeduction?: ByAgi | 'federal';
  /** Personal exemption (a deduction), single filer. */
  exemption?: ByAgi;
  /** Personal credit (non-refundable), single filer. */
  credit?: number | ((c: { agi: number; taxable: number; tax: number; federalStandardDeduction: number }) => number);
  /** Alabama: federal income tax is deductible. */
  deductFederalTax?: true;
  /** A surtax on state taxable income above `over`, shown as its own line. */
  surtax?: { name: string; rate: number; over: number };
  /** A statutory tax computation used instead of the brackets. */
  tariff?: (taxable: number, agi: number) => number;
  source: string;
  authorityName: string;
  verified: boolean;
  verificationNote?: string;
  assumptions?: string[];
}

const amount = (a: ByAgi | undefined, agi: number) => (a === undefined ? 0 : typeof a === 'number' ? a : a(agi));

function stateTax(name: string, y: StateYear, ctx: RegionalTaxContext): { levies: IncomeLineItem[] } {
  if (y.none) return { levies: [] };
  const agi = ctx.gross;
  const sd = y.standardDeduction === 'federal' ? ctx.nationalDeduction : amount(y.standardDeduction, agi);
  const fedTax = y.deductFederalTax ? ctx.nationalTaxAfterCredits : 0;
  const taxable = nonNegative(agi - sd - amount(y.exemption, agi) - fedTax);
  const tax = y.tariff ? y.tariff(taxable, agi) : progressive(taxable, y.bands ?? []);
  const rawCredit = typeof y.credit === 'function' ? y.credit({ agi, taxable, tax, federalStandardDeduction: ctx.nationalDeduction }) : (y.credit ?? 0);
  const net = nonNegative(tax - Math.min(tax, nonNegative(rawCredit)));
  const levies: IncomeLineItem[] = [];
  const main = ctx.q.round(net);
  if (main > 0) levies.push({ name: `${name} income tax`, amount: main });
  if (y.surtax) {
    const s = ctx.q.round(y.surtax.rate * nonNegative(taxable - y.surtax.over));
    if (s > 0) levies.push({ name: y.surtax.name, amount: s });
  }
  return { levies };
}

const STANDING = [
  'State tax is on wages for a single filer taking the state standard deduction (or the federal one, where the state starts from federal taxable income); itemized deductions and state credits other than the personal credit are not included.',
  'State payroll contributions (disability insurance, paid family leave, unemployment) are not included.',
];

const EFFECTIVE: Record<string, string> = { '2026': '2026-01-01', '2025': '2025-01-01' };

function state(code: string, name: string, years: StateYear[], extra: { note?: string; local?: string; assumptions?: string[] } = {}): IncomeTaxRegion {
  const sets: IncomeTaxRegionSet[] = years.map((y) => ({
    effectiveFrom: EFFECTIVE[y.taxYear]!,
    taxYearLabel: y.taxYear,
    bands: y.none ? [] : (y.bands ?? []),
    compute: (ctx) => stateTax(name, y, ctx),
    ...(y.assumptions ? { assumptions: y.assumptions } : {}),
    source: y.source,
    authorityName: y.authorityName,
    citationDate: READ,
    verified: y.verified,
    ...(y.verificationNote ? { verificationNote: y.verificationNote } : {}),
  }));
  const allNone = years.every((y) => y.none);
  return {
    code,
    name,
    mode: 'additional',
    sets,
    file: 'src/data/incomeTaxRegions/usStates.ts',
    note: extra.note ?? (allNone ? `${name} has no state income tax on wages.` : `${name} state income tax on wages, added to the federal tax.`),
    assumptions: [
      ...(allNone ? [] : STANDING),
      extra.local ? `Local income taxes are NOT included: ${extra.local}` : 'No local income tax on wages applies in this state as far as the research found.',
      ...(extra.assumptions ?? []),
    ],
  };
}

/** A state with no tax on wages in either year. */
function noTax(code: string, name: string, source: string, authorityName: string, why: string, verified = true, verificationNote?: string): IncomeTaxRegion {
  const y = (taxYear: string): StateYear => ({ taxYear, none: true, source, authorityName, verified, ...(verificationNote ? { verificationNote } : {}) });
  return state(code, name, [y('2026'), y('2025')], { note: `${name} has no state income tax on wages: ${why}` });
}

const b = (...pairs: [number | null, number][]): IncomeTaxBand[] => pairs.map(([upTo, rate]) => ({ upTo, rate }));

/** Alabama standard deduction, single: $3,000 to AGI $25,999, less $25 per $500 (or part) above, floor $2,500. */
const alabamaSD = (agi: number) => (agi <= 25999 ? 3000 : Math.max(2500, 3000 - 25 * Math.ceil((agi - 25999) / 500)));

/**
 * Arkansas: the standard table up to $94,700; above it the DFA formula —
 * top rate × income less a "minus adjustment" that steps down $10 per $100
 * from `high` at $94,701 to `low` (where it equals the upper-income table).
 */
const arkansas = (bands: IncomeTaxBand[], top: number, high: number, low: number) => (t: number) =>
  t <= 94700 ? progressive(t, bands) : top * t - Math.max(low, high - 10 * Math.floor((t - 94701) / 100));

/**
 * Connecticut, single (CT-1040 Tables A–E, unchanged 2025→2026):
 *  A  personal exemption $15,000, less $1,000 per $1,000 (or part) of CT AGI over $30,000
 *  B  the rate schedule on CT taxable income
 *  C  2% phase-out add-back: $25 per $5,000 (or part) of AGI over $56,500, max $250
 *  D  recapture: $25 per $5,000 over $105,000 to $250; then $90 per $5,000 over $200,000 to $2,950;
 *     then $50 per $5,000 over $500,000 to $3,400
 *  E  personal tax credit, a decimal of the tax: .75 at AGI $15,000–$18,800, .10 at $33,300–$60,000,
 *     .00 above $64,500. The research gives no other rows, so between $18,800 and $33,300 the lower
 *     bound .10 is used and between $60,000 and $64,500 none — never more credit than the table gives.
 */
const ctExemption = (agi: number) => (agi <= 30000 ? 15000 : Math.max(0, 15000 - 1000 * Math.ceil((agi - 30000) / 1000)));
const steps = (over: number, per: number, each: number, cap: number) => (agi: number) => (agi <= over ? 0 : Math.min(cap, each * Math.ceil((agi - over) / per)));
const ctTableC = steps(56500, 5000, 25, 250);
function ctTableD(agi: number): number {
  if (agi <= 105000) return 0;
  let d = Math.min(250, 25 * Math.ceil((agi - 105000) / 5000));
  if (agi > 200000) d = Math.min(2950, 250 + 90 * Math.ceil((agi - 200000) / 5000));
  if (agi > 500000) d = Math.min(3400, 2950 + 50 * Math.ceil((agi - 500000) / 5000));
  return d;
}
function ctTableE(agi: number): number {
  if (agi < 15000) return 0;
  if (agi <= 18800) return 0.75;
  if (agi <= 60000) return 0.1;
  return 0;
}
const CT_BANDS = b([10000, 0.02], [50000, 0.045], [100000, 0.055], [200000, 0.06], [250000, 0.065], [500000, 0.069], [null, 0.0699]);
const connecticut = (taxable: number, agi: number) => (progressive(taxable, CT_BANDS) + ctTableC(agi) + ctTableD(agi)) * (1 - ctTableE(agi));

/** Maryland personal exemption, single: $3,200 to FAGI $100,000; $1,600 to $125,000; $800 to $150,000; nil above. */
const marylandExemption = (agi: number) => (agi <= 100000 ? 3200 : agi <= 125000 ? 1600 : agi <= 150000 ? 800 : 0);
const MD_BANDS = b([1000, 0.02], [2000, 0.03], [3000, 0.04], [100000, 0.0475], [125000, 0.05], [150000, 0.0525], [250000, 0.055], [500000, 0.0575], [1000000, 0.0625], [null, 0.065]);

/** A linear phase-out of `full` over `range` once AGI passes `from`. */
const phaseOut = (full: number, from: number, range: number) => (agi: number) => (agi <= from ? full : Math.max(0, full * (1 - (agi - from) / range)));

/** South Carolina Income Adjusted Deduction (2026): $15,000 less the fraction (FAGI − $40,000)/$55,000, the reduction rounded down to $10. */
const scIncomeAdjustedDeduction = (agi: number) => {
  if (agi <= 40000) return 15000;
  if (agi >= 95000) return 0;
  return 15000 - Math.floor((15000 * (agi - 40000)) / 55000 / 10) * 10;
};

/** Utah taxpayer tax credit: 6% of the federal standard deduction, less 1.3% of income over the base phase-out amount. */
const utahCredit = (base: number) => (c: { agi: number; federalStandardDeduction: number }) =>
  nonNegative(0.06 * c.federalStandardDeduction - 0.013 * nonNegative(c.agi - base));

/** Wisconsin sliding-scale standard deduction, single (2026): $13,960 to $20,119; less 12% over $20,120; nil from $136,453. */
const wisconsinSD = (agi: number) => (agi <= 20119 ? 13960 : agi >= 136453 ? 0 : Math.max(0, 13960 - 0.12 * (agi - 20120)));

export const US_STATES: Record<string, IncomeTaxRegion> = {
  AK: noTax('AK', 'Alaska', 'https://tax.alaska.gov/programs/programs/index.aspx?10001', 'Alaska Department of Revenue, Tax Division', 'the State does not have an individual income tax.'),

  AL: state('AL', 'Alabama', [
    {
      taxYear: '2026', bands: b([500, 0.02], [3000, 0.04], [null, 0.05]), standardDeduction: alabamaSD, exemption: 1500, deductFederalTax: true,
      source: 'https://www.revenue.alabama.gov/wp-content/uploads/2026/01/whbooklet_0126.pdf', authorityName: 'Alabama Department of Revenue', verified: true,
      assumptions: ['2026 figures are from the 2026 withholding booklet and Form 40ES; the 2026 Form 40 instructions were not yet published.'],
    },
    {
      taxYear: '2025', bands: b([500, 0.02], [3000, 0.04], [null, 0.05]), standardDeduction: alabamaSD, exemption: 1500, deductFederalTax: true,
      source: 'https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40abk.pdf', authorityName: 'Alabama Department of Revenue', verified: true,
    },
  ], {
    note: 'Alabama income tax added to the federal tax: 2%/4%/5% on income less the AGI-based standard deduction, the $1,500 personal exemption and the federal income tax (deductible in Alabama).',
    local: 'municipal and county occupational license taxes on wages (e.g. Birmingham, Auburn).',
  }),

  AR: state('AR', 'Arkansas', [
    {
      // Top rate cut 3.9% → 3.7% for 2026 (Act 2 of the 2026 Extraordinary Session); DFA withholding formula posted 2026-05-29.
      taxYear: '2026', bands: b([5599, 0], [11199, 0.02], [15999, 0.03], [26399, 0.034], [null, 0.037]), standardDeduction: 2470, credit: 29,
      tariff: arkansas(b([5599, 0], [11199, 0.02], [15999, 0.03], [26399, 0.034], [null, 0.037]), 0.037, 369.9, 79.9),
      source: 'https://www.dfa.arkansas.gov/wp-content/uploads/Withholding-Tax-Formula.pdf', authorityName: 'Arkansas Department of Finance and Administration', verified: true,
      assumptions: ['Above $94,700 of taxable income the DFA formula (top rate less a stepped "minus adjustment") is used; the 2026 AR1000F instructions and low-income tables were not yet published.'],
    },
    {
      taxYear: '2025', bands: b([5599, 0], [11199, 0.02], [15999, 0.03], [26399, 0.034], [null, 0.039]), standardDeduction: 2470, credit: 29,
      tariff: arkansas(b([5599, 0], [11199, 0.02], [15999, 0.03], [26399, 0.034], [null, 0.039]), 0.039, 399.3, 89.3),
      source: 'https://www.dfa.arkansas.gov/wp-content/uploads/2025_TaxBrackets.pdf', authorityName: 'Arkansas Department of Finance and Administration', verified: true,
    },
  ], { assumptions: ['The low-income tax tables and the additional credit for qualified individuals (up to $60) are not applied, so tax may be overstated below about $29,000.'] }),

  AZ: state('AZ', 'Arizona', [
    {
      taxYear: '2026', bands: b([null, 0.025]), standardDeduction: 15750,
      source: 'https://www.azleg.gov/ars/43/01011.01.htm', authorityName: 'Arizona Legislature (ARS 43-1011, 43-1041)', verified: false,
      verificationNote: 'The 2.5% rate is confirmed, but the inflation-adjusted 2026 standard deduction was not published on an accessible page (azdor.gov blocked automated access); the statutory base of $15,750 is used, which may slightly overstate tax',
    },
    {
      taxYear: '2025', bands: b([null, 0.025]), standardDeduction: 15750,
      source: 'https://www.azleg.gov/ars/43/01041.htm', authorityName: 'Arizona Legislature (ARS 43-1011, 43-1041; Laws 2026 ch. 140)', verified: true,
    },
  ]),

  CA: state('CA', 'California', [
    {
      // 2026 figures not published by the FTB on 2026-10-06 (its 2026 540-ES tells filers to use the 2025 amounts), so 2025 only.
      taxYear: '2025', bands: b([11079, 0.01], [26264, 0.02], [41452, 0.04], [57542, 0.06], [72724, 0.08], [371479, 0.093], [445771, 0.103], [742953, 0.113], [null, 0.123]),
      standardDeduction: 5706, credit: 153,
      surtax: { name: 'California Behavioral Health Services Tax (1% over $1,000,000)', rate: 0.01, over: 1000000 },
      source: 'https://www.ftb.ca.gov/forms/2025/2025-540-booklet.pdf', authorityName: 'California Franchise Tax Board', verified: true,
    },
  ], { assumptions: ['The personal exemption credit ($153) is not reduced for federal AGI above $252,203, so tax at those incomes may be slightly understated.', 'California SDI (an employee payroll contribution) is not included.'] }),

  CO: state('CO', 'Colorado', [
    {
      taxYear: '2026', bands: b([null, 0.044]), standardDeduction: 'federal',
      source: 'https://leg.colorado.gov/bills/sb24-228', authorityName: 'Colorado General Assembly (SB24-228)', verified: false,
      verificationNote: 'The Colorado Department of Revenue pages blocked automated access; the 4.40% statutory rate is used, and a TABOR-triggered temporary rate reduction under SB24-228 (as in 2024, 4.25%) was not confirmed either way',
    },
    {
      taxYear: '2025', bands: b([null, 0.044]), standardDeduction: 'federal',
      source: 'https://leg.colorado.gov/bills/sb24-228', authorityName: 'Colorado General Assembly (SB24-228)', verified: false,
      verificationNote: 'The Colorado Department of Revenue pages blocked automated access; the 4.40% statutory rate is used, and a TABOR-triggered temporary rate reduction under SB24-228 was not confirmed either way',
    },
  ], { note: 'Colorado income tax added to the federal tax: a flat rate on federal taxable income.', local: 'occupational privilege taxes (Denver: $5.75 a month per employee).' }),

  CT: state('CT', 'Connecticut', [
    {
      taxYear: '2026', bands: CT_BANDS, exemption: ctExemption, tariff: connecticut,
      source: 'https://portal.ct.gov/-/media/drs/forms/2025/income/ct1040es-flat0126.pdf', authorityName: 'Connecticut Department of Revenue Services (2026 CT-1040ES)', verified: true,
    },
    {
      taxYear: '2025', bands: CT_BANDS, exemption: ctExemption, tariff: connecticut,
      source: 'https://portal.ct.gov/-/media/drs/forms/2025/income/ct-1040-tcs_1225.pdf', authorityName: 'Connecticut Department of Revenue Services (CT-1040 TCS)', verified: true,
    },
  ], {
    note: 'Connecticut income tax added to the federal tax: the personal exemption (Table A), the rate schedule (Table B), the 2% phase-out add-back and recapture (Tables C and D), less the personal tax credit (Table E).',
    assumptions: ['Tables C, D and E are step tables; between the rows the research records, the personal tax credit uses the lower adjacent decimal (.10 between $18,800 and $33,300, none between $60,000 and $64,500), so tax there may be slightly overstated.'],
  }),

  DC: state('DC', 'District of Columbia', [
    {
      taxYear: '2026', bands: b([10000, 0.04], [40000, 0.06], [60000, 0.065], [250000, 0.085], [500000, 0.0925], [1000000, 0.0975], [null, 0.1075]), standardDeduction: 16100,
      source: 'https://otr.cfo.dc.gov/sites/default/files/dc/sites/otr/publication/attachments/2026_D40ES_Book_wLinks04012026.pdf', authorityName: 'DC Office of Tax and Revenue (2026 D-40ES)', verified: true,
      assumptions: ['The 2026 standard deduction ($16,100) is as printed in the 2026 D-40ES; the 2026 D-40 booklet was not yet published.'],
    },
    {
      // DC decoupled from the OBBBA federal standard deduction for 2025 and set $15,000.
      taxYear: '2025', bands: b([10000, 0.04], [40000, 0.06], [60000, 0.065], [250000, 0.085], [500000, 0.0925], [1000000, 0.0975], [null, 0.1075]), standardDeduction: 15000,
      source: 'https://otr.cfo.dc.gov/sites/default/files/dc/sites/otr/publication/attachments/2025_D40_Book_082026_v1.pdf', authorityName: 'DC Office of Tax and Revenue', verified: true,
    },
  ]),

  DE: state('DE', 'Delaware', [
    {
      taxYear: '2026', bands: b([2000, 0], [5000, 0.022], [10000, 0.039], [20000, 0.048], [25000, 0.052], [60000, 0.0555], [null, 0.066]), standardDeduction: 3250, credit: 110,
      source: 'https://revenuefiles.delaware.gov/2025/PITForms_Instructions/Instructions/PIT-EST_Instructions_2026-01.pdf', authorityName: 'Delaware Division of Revenue (TY2026 PIT-EST instructions)', verified: true,
    },
    {
      taxYear: '2025', bands: b([2000, 0], [5000, 0.022], [10000, 0.039], [20000, 0.048], [25000, 0.052], [60000, 0.0555], [null, 0.066]), standardDeduction: 3250, credit: 110,
      source: 'https://revenuefiles.delaware.gov/2025/PITForms_Instructions/Instructions/PIT-RES_Instructions_2025-01.pdf', authorityName: 'Delaware Division of Revenue', verified: true,
    },
  ], { local: 'the City of Wilmington wage tax (1.25%).' }),

  FL: noTax('FL', 'Florida', 'https://floridarevenue.com/faq/Pages/FAQDetails.aspx?FAQID=1466', 'Florida Department of Revenue', 'Florida does not impose a personal income tax (Art. VII s.5, Florida Constitution).'),

  GA: state('GA', 'Georgia', [
    {
      // HB 463 (signed 2026-05-11): 4.99% and a $15,000 single standard deduction for 2026.
      taxYear: '2026', bands: b([null, 0.0499]), standardDeduction: 15000,
      source: 'https://gov.georgia.gov/document/2026-signed-legislation/hb-463/download', authorityName: 'Georgia General Assembly / Office of the Governor (HB 463)', verified: true,
    },
    {
      taxYear: '2025', bands: b([null, 0.0519]), standardDeduction: 12000,
      source: 'https://dor.georgia.gov/document/document/2025-it-511-individual-income-tax-booklet/download', authorityName: 'Georgia Department of Revenue', verified: true,
    },
  ]),

  HI: state('HI', 'Hawaii', [
    {
      taxYear: '2026', bands: b([9600, 0.014], [14400, 0.032], [19200, 0.055], [24000, 0.064], [36000, 0.068], [48000, 0.072], [125000, 0.076], [175000, 0.079], [225000, 0.0825], [275000, 0.09], [325000, 0.1], [null, 0.11]),
      standardDeduction: 8000, exemption: 1144,
      source: 'https://files.hawaii.gov/tax/news/announce/ann24-03.pdf', authorityName: 'Hawaii Department of Taxation (Act 46, SLH 2024)', verified: true,
    },
    {
      taxYear: '2025', bands: b([9600, 0.014], [14400, 0.032], [19200, 0.055], [24000, 0.064], [36000, 0.068], [48000, 0.072], [125000, 0.076], [175000, 0.079], [225000, 0.0825], [275000, 0.09], [325000, 0.1], [null, 0.11]),
      standardDeduction: 4400, exemption: 1144,
      source: 'https://tax.hawaii.gov/tax-year-information/', authorityName: 'Hawaii Department of Taxation', verified: true,
    },
  ]),

  IA: state('IA', 'Iowa', [
    {
      taxYear: '2026', bands: b([null, 0.038]), standardDeduction: 'federal', credit: 40,
      source: 'https://revenue.iowa.gov/media/53/download?inline', authorityName: 'Iowa Department of Revenue', verified: true,
    },
    {
      taxYear: '2025', bands: b([null, 0.038]), standardDeduction: 'federal', credit: 40,
      source: 'https://revenue.iowa.gov/media/4400/download?inline=', authorityName: 'Iowa Department of Revenue', verified: true,
    },
  ], { note: 'Iowa income tax added to the federal tax: 3.8% of federal taxable income less the $40 personal exemption credit.', local: 'school district surtaxes (a percentage of state tax set by each district) and the EMS surtax in some counties.' }),

  ID: state('ID', 'Idaho', [
    {
      // 2026: the indexed 0% threshold is not published yet, so 2025 only.
      taxYear: '2025', bands: b([4811, 0], [null, 0.053]), standardDeduction: 15750,
      source: 'https://tax.idaho.gov/wp-content/uploads/forms/EIN00046/EIN00046_03-02-2026.pdf', authorityName: 'Idaho State Tax Commission (2025 Form 40 instructions)', verified: false,
      verificationNote: 'Idaho government sites were unreachable from the research environment; the official 2025 Form 40 instructions were read from an Internet Archive copy, so the figures are not verified on the live page',
    },
  ]),

  IL: state('IL', 'Illinois', [
    {
      taxYear: '2026', bands: b([null, 0.0495]), exemption: (agi) => (agi > 250000 ? 0 : 2925),
      source: 'https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/withholding/documents/currentyear/il-700-t.pdf', authorityName: 'Illinois Department of Revenue (IL-700-T 2026)', verified: true,
    },
    {
      taxYear: '2025', bands: b([null, 0.0495]), exemption: (agi) => (agi > 250000 ? 0 : 2850),
      source: 'https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/incometax/documents/currentyear/individual/il-1040-instr.pdf', authorityName: 'Illinois Department of Revenue', verified: true,
    },
  ], { note: 'Illinois income tax added to the federal tax: 4.95% of income less the personal exemption allowance (not allowed above $250,000 of federal AGI).' }),

  IN: state('IN', 'Indiana', [
    {
      taxYear: '2026', bands: b([null, 0.0295]), exemption: 1000,
      source: 'https://www.in.gov/dor/files/dn01.pdf', authorityName: 'Indiana Department of Revenue', verified: true,
    },
    {
      taxYear: '2025', bands: b([null, 0.03]), exemption: 1000,
      source: 'https://www.in.gov/dor/files/tax-chapter.pdf', authorityName: 'Indiana Department of Revenue', verified: true,
    },
  ], { local: 'county local income taxes, levied in all 92 counties at rates each county sets.' }),

  KS: state('KS', 'Kansas', [
    {
      taxYear: '2026', bands: b([23000, 0.052], [null, 0.0558]), standardDeduction: 3605, exemption: 9160,
      source: 'https://ksrevisor.gov/statutes/chapters/ch79/079_032_0110.html', authorityName: 'Kansas Statutes (K.S.A. 79-32,110; 79-32,119; 79-32,121)', verified: true,
      assumptions: ['Whether the automatic rate reduction under K.S.A. 79-32,110c applies to 2026 could not be confirmed on the Kansas Department of Revenue site; an archived 2026 K-40ES shows the unchanged schedule.'],
    },
    {
      taxYear: '2025', bands: b([23000, 0.052], [null, 0.0558]), standardDeduction: 3605, exemption: 9160,
      source: 'https://ksrevisor.gov/statutes/chapters/ch79/079_032_0110.html', authorityName: 'Kansas Statutes (K.S.A. 79-32,110; 79-32,119; 79-32,121)', verified: true,
    },
  ]),

  KY: state('KY', 'Kentucky', [
    {
      taxYear: '2026', bands: b([null, 0.035]), standardDeduction: 3360,
      source: 'https://revenue.ky.gov/Business/Pages/Employer-Payroll-Withholding.aspx', authorityName: 'Kentucky Department of Revenue', verified: true,
      assumptions: ['The 2026 standard deduction ($3,360) is from the Department of Revenue 2026 withholding materials; the 2026 Form 740 instructions were not yet published.'],
    },
    {
      taxYear: '2025', bands: b([null, 0.04]), standardDeduction: 3270,
      source: 'https://revenue.ky.gov/Individual/Individual-Income-Tax/Pages/default.aspx', authorityName: 'Kentucky Department of Revenue', verified: true,
    },
  ], { local: 'city, county and school-district occupational license taxes on wages (e.g. Lexington-Fayette 2.25%, Louisville Metro).' }),

  LA: state('LA', 'Louisiana', [
    {
      taxYear: '2026', bands: b([null, 0.03]), standardDeduction: 12875,
      source: 'https://dam.ldr.la.gov/taxforms/IT540ESi-2026.pdf', authorityName: 'Louisiana Department of Revenue (2026 IT-540ES)', verified: true,
    },
    {
      taxYear: '2025', bands: b([null, 0.03]), standardDeduction: 12500,
      source: 'https://dam.ldr.la.gov/taxforms/IT540i-WEB-2025-Revised-7-26.pdf', authorityName: 'Louisiana Department of Revenue', verified: true,
    },
  ]),

  MA: state('MA', 'Massachusetts', [
    {
      taxYear: '2026', bands: b([null, 0.05]), exemption: 4400,
      surtax: { name: 'Massachusetts 4% surtax (income over $1,107,750)', rate: 0.04, over: 1107750 },
      source: 'https://www.mass.gov/info-details/tax-rates', authorityName: 'Massachusetts Department of Revenue', verified: true,
    },
    {
      taxYear: '2025', bands: b([null, 0.05]), exemption: 4400,
      surtax: { name: 'Massachusetts 4% surtax (income over $1,083,150)', rate: 0.04, over: 1083150 },
      source: 'https://www.mass.gov/info-details/tax-rates', authorityName: 'Massachusetts Department of Revenue', verified: true,
    },
  ]),

  MD: state('MD', 'Maryland', [
    {
      taxYear: '2026', bands: MD_BANDS, standardDeduction: 3350, exemption: marylandExemption,
      source: 'https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/legal-publications/facts/withholding-tax-facts-2026.pdf', authorityName: 'Comptroller of Maryland', verified: false,
      verificationNote: 'The 2026 brackets and exemption are confirmed, but the inflation-indexed 2026 standard deduction has not been published (the 2026 withholding guide uses $3,400 for withholding only); the 2025 amount of $3,350 is used',
    },
    {
      taxYear: '2025', bands: MD_BANDS, standardDeduction: 3350, exemption: marylandExemption,
      source: 'https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/legal-publications/alerts/tax-alert-changes-to-standard-and-itemized-deductions-and-to-state-and-local-income-tax-rates-from-the-2025-legislative-session.pdf', authorityName: 'Comptroller of Maryland', verified: true,
    },
  ], { local: 'the county or Baltimore City income tax (up to 3.30% of Maryland taxable income), which every Maryland resident pays.' }),

  ME: state('ME', 'Maine', [
    {
      taxYear: '2026', bands: b([27400, 0.058], [64850, 0.0675], [null, 0.0715]), standardDeduction: 15700, exemption: 5300,
      surtax: { name: 'Maine 2% income tax surcharge (taxable income over $1,000,000)', rate: 0.02, over: 1000000 },
      source: 'https://www.maine.gov/revenue/sites/maine.gov.revenue/files/2026-05/ind_tax_rate_sched_2026_rev.pdf', authorityName: 'Maine Revenue Services', verified: true,
      assumptions: ['The 2026 phase-outs of the standard deduction (above $102,250) and the personal exemption are not applied, because their ranges were not recorded in the research; tax at high incomes may be understated.'],
    },
    {
      taxYear: '2025', bands: b([26800, 0.058], [63450, 0.0675], [null, 0.0715]),
      standardDeduction: phaseOut(15000, 100000, 75000), exemption: phaseOut(5150, 333450, 125000),
      source: 'https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/ind_tax_rate_sched_2025.pdf', authorityName: 'Maine Revenue Services', verified: true,
    },
  ]),

  MI: state('MI', 'Michigan', [
    {
      taxYear: '2026', bands: b([null, 0.0425]), exemption: 5900,
      source: 'https://www.michigan.gov/taxes/-/media/Project/Websites/taxes/Forms/SUW/TY2026/446_Withholding-Guide_2026.pdf', authorityName: 'Michigan Department of Treasury (Form 446, 2026)', verified: true,
    },
    {
      taxYear: '2025', bands: b([null, 0.0425]), exemption: 5800,
      source: 'https://www.michigan.gov/taxes/business-taxes/withholding/calendar-year-tax-information', authorityName: 'Michigan Department of Treasury', verified: true,
    },
  ], { local: 'city income taxes in 24 cities (Detroit 2.4% resident / 1.2% non-resident; most others 1% / 0.5%).' }),

  MN: state('MN', 'Minnesota', [
    {
      taxYear: '2026', bands: b([33310, 0.0535], [109430, 0.068], [203150, 0.0785], [null, 0.0985]), standardDeduction: 15300,
      source: 'https://www.revenue.state.mn.us/minnesota-income-tax-rates-and-brackets', authorityName: 'Minnesota Department of Revenue', verified: true,
    },
    {
      taxYear: '2025', bands: b([32570, 0.0535], [106990, 0.068], [198630, 0.0785], [null, 0.0985]), standardDeduction: 14950,
      source: 'https://www.revenue.state.mn.us/minnesota-income-tax-rates-and-brackets', authorityName: 'Minnesota Department of Revenue', verified: true,
    },
  ], { assumptions: ['The standard deduction limitation at high incomes (from about $244,000) is not applied, so tax at those incomes may be slightly understated.', 'Minnesota Paid Leave premiums (from 2026) are a payroll contribution and not included.'] }),

  MO: state('MO', 'Missouri', [
    {
      taxYear: '2026', bands: b([1348, 0], [2696, 0.02], [4044, 0.025], [5392, 0.03], [6740, 0.035], [8088, 0.04], [9436, 0.045], [null, 0.047]), standardDeduction: 16100,
      source: 'https://dor.mo.gov/forms/Withholding%20Formula_2026.pdf', authorityName: 'Missouri Department of Revenue (2026 withholding formula)', verified: true,
      assumptions: ['The 2026 brackets and standard deduction are from the 2026 withholding formula, which uses the annual bracket structure; the 2026 tax chart was not yet published.'],
    },
    {
      taxYear: '2025', bands: b([1313, 0], [2626, 0.02], [3939, 0.025], [5252, 0.03], [6565, 0.035], [7878, 0.04], [9191, 0.045], [null, 0.047]), standardDeduction: 15750,
      source: 'https://dor.mo.gov/forms/2025%20Tax%20Chart_2025.pdf', authorityName: 'Missouri Department of Revenue', verified: true,
    },
  ], { local: 'the City of St. Louis and Kansas City 1% earnings taxes.' }),

  MS: state('MS', 'Mississippi', [
    {
      taxYear: '2026', bands: b([10000, 0], [null, 0.04]), standardDeduction: 2300, exemption: 6000,
      source: 'https://www.dor.ms.gov/individual/tax-rates', authorityName: 'Mississippi Department of Revenue', verified: true,
    },
    {
      taxYear: '2025', bands: b([10000, 0], [null, 0.044]), standardDeduction: 2300, exemption: 6000,
      source: 'https://www.dor.ms.gov/individual/tax-rates', authorityName: 'Mississippi Department of Revenue', verified: true,
    },
  ]),

  MT: state('MT', 'Montana', [
    {
      taxYear: '2026', bands: b([47500, 0.047], [null, 0.0565]), standardDeduction: 'federal',
      source: 'https://revenue.mt.gov/news/recent-news/HB-337', authorityName: 'Montana Department of Revenue (HB 337)', verified: true,
    },
    {
      taxYear: '2025', bands: b([21100, 0.047], [null, 0.059]), standardDeduction: 'federal',
      source: 'https://revenue.mt.gov/taxes/tax-tables-and-deductions/2025', authorityName: 'Montana Department of Revenue', verified: true,
    },
  ], { note: 'Montana income tax added to the federal tax: brackets on federal taxable income (Montana starts from federal taxable income).' }),

  NC: state('NC', 'North Carolina', [
    {
      taxYear: '2026', bands: b([null, 0.0399]), standardDeduction: 12750,
      source: 'https://www.ncdor.gov/taxes-forms/individual-income-tax/tax-rate-schedules', authorityName: 'North Carolina Department of Revenue', verified: true,
    },
    {
      taxYear: '2025', bands: b([null, 0.0425]), standardDeduction: 12750,
      source: 'https://www.ncdor.gov/taxes-forms/individual-income-tax/tax-rate-schedules', authorityName: 'North Carolina Department of Revenue', verified: true,
    },
  ]),

  ND: state('ND', 'North Dakota', [
    {
      taxYear: '2026', bands: b([49575, 0], [250400, 0.0195], [null, 0.025]), standardDeduction: 'federal',
      source: 'https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/28709-form-nd-1es-2026.pdf', authorityName: 'North Dakota Office of State Tax Commissioner (2026 ND-1ES)', verified: true,
    },
    {
      taxYear: '2025', bands: b([48475, 0], [244825, 0.0195], [null, 0.025]), standardDeduction: 'federal',
      source: 'https://www.tax.nd.gov/sites/www/files/documents/forms/software-developer/individual-income-forms/2025-iit-instructions.pdf', authorityName: 'North Dakota Office of State Tax Commissioner', verified: true,
    },
  ], { note: 'North Dakota income tax added to the federal tax: brackets on federal taxable income.' }),

  NE: state('NE', 'Nebraska', [
    {
      // Third and fourth brackets both 4.55% for 2026 (Neb. Rev. Stat. 77-2715.03, LB 754).
      taxYear: '2026', bands: b([4130, 0.0246], [24760, 0.0351], [39900, 0.0455], [null, 0.0455]), standardDeduction: 8850, credit: 176,
      source: 'https://revenue.nebraska.gov/sites/default/files/doc/research/chronology/4-607table1.pdf', authorityName: 'Nebraska Department of Revenue', verified: true,
    },
    {
      taxYear: '2025', bands: b([4030, 0.0246], [24120, 0.0351], [38870, 0.0501], [null, 0.052]), standardDeduction: 8600, credit: 171,
      source: 'https://revenue.nebraska.gov/sites/default/files/doc/research/chronology/4-607table1.pdf', authorityName: 'Nebraska Department of Revenue', verified: true,
    },
  ]),

  NH: noTax('NH', 'New Hampshire', 'https://www.revenue.nh.gov/news-and-media/repeal-nh-interest-and-dividends-tax-now-effect', 'New Hampshire Department of Revenue Administration', 'New Hampshire has never taxed wages, and its Interest and Dividends Tax was repealed for tax periods beginning on or after 1 January 2025.'),

  NJ: state('NJ', 'New Jersey', [
    {
      taxYear: '2026', bands: b([20000, 0.014], [35000, 0.0175], [40000, 0.035], [75000, 0.05525], [500000, 0.0637], [1000000, 0.0897], [null, 0.1075]), exemption: 1000,
      source: 'https://www.nj.gov/treasury/taxation/pdf/current/njtaxratesch.pdf', authorityName: 'New Jersey Division of Taxation (Tax Rate Schedules 2020 and after)', verified: true,
    },
    {
      taxYear: '2025', bands: b([20000, 0.014], [35000, 0.0175], [40000, 0.035], [75000, 0.05525], [500000, 0.0637], [1000000, 0.0897], [null, 0.1075]), exemption: 1000,
      source: 'https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf', authorityName: 'New Jersey Division of Taxation', verified: true,
    },
  ], { assumptions: ['New Jersey UI, workforce, TDI and FLI employee contributions are payroll contributions and not included.'] }),

  NM: state('NM', 'New Mexico', [
    {
      taxYear: '2026', bands: b([5500, 0.015], [16500, 0.032], [33500, 0.043], [66500, 0.047], [210000, 0.049], [null, 0.059]), standardDeduction: 'federal',
      source: 'https://www.tax.newmexico.gov/businesses/withholding-tax-and-workers-compensation/', authorityName: 'New Mexico Taxation and Revenue Department', verified: false,
      verificationNote: 'The brackets were reconstructed from the Department’s 2026 withholding table (FYI-104), not read from an official income-tax rate table, which was not yet published',
    },
    {
      taxYear: '2025', bands: b([5500, 0.015], [16500, 0.032], [33500, 0.043], [66500, 0.047], [210000, 0.049], [null, 0.059]), standardDeduction: 'federal',
      source: 'https://realfile.tax.newmexico.gov/2025pit-1-ins.pdf', authorityName: 'New Mexico Taxation and Revenue Department', verified: false,
      verificationNote: 'The brackets were reconstructed from the Department’s withholding table (FYI-104); the PIT-1 rate tables could not be located, so they are not confirmed on an official income-tax rate table',
    },
  ], { note: 'New Mexico income tax added to the federal tax: brackets on income less the federal standard deduction.', assumptions: ['The New Mexico low- and middle-income exemption is not applied, so tax at lower incomes may be overstated.'] }),

  NV: noTax('NV', 'Nevada', 'https://tax.nv.gov/about-nevada-department-of-taxation/income-tax-in-nevada/', 'Nevada Department of Taxation', 'Nevada residents do not pay state tax on income from salaries or wages.'),

  NY: state('NY', 'New York', [
    {
      // Tax Law s.601(c)(1)(vii): first five rates cut 0.1 point for 2026.
      taxYear: '2026', bands: b([8500, 0.039], [11700, 0.044], [13900, 0.0515], [80650, 0.054], [215400, 0.059], [1077550, 0.0685], [5000000, 0.0965], [25000000, 0.103], [null, 0.109]), standardDeduction: 8000,
      source: 'https://www.nysenate.gov/legislation/laws/TAX/601', authorityName: 'New York State Tax Law s.601 (NYS Senate)', verified: false,
      verificationNote: 'The 2026 rates and brackets are confirmed in Tax Law s.601, but the 2026 standard deduction has not been published (the 2026 IT-201 instructions are not out); the 2025 amount of $8,000 is used',
    },
    {
      taxYear: '2025', bands: b([8500, 0.04], [11700, 0.045], [13900, 0.0525], [80650, 0.055], [215400, 0.06], [1077550, 0.0685], [5000000, 0.0965], [25000000, 0.103], [null, 0.109]), standardDeduction: 8000,
      source: 'https://www.tax.ny.gov/forms/html-instructions/2025/it/it201i-2025.htm', authorityName: 'New York State Department of Taxation and Finance', verified: true,
    },
  ], {
    local: 'New York City resident income tax and the Yonkers surcharge.',
    assumptions: ['The supplemental tax (tax benefit recapture) that applies above New York AGI of $107,650 is not applied, so tax above that income is understated.', 'NY disability and paid family leave contributions are not included.'],
  }),

  OH: state('OH', 'Ohio', [
    {
      taxYear: '2026', bands: b([26050, 0], [null, 0.0275]),
      source: 'https://tax.ohio.gov/individual/resources/annual-tax-rates', authorityName: 'Ohio Department of Taxation; Ohio Legislative Service Commission (HB 96)', verified: false,
      verificationNote: 'Ohio Department of Taxation pages blocked automated access; the rates come from search-result extracts of the Department and Legislative Service Commission pages, not the pages themselves',
    },
    {
      taxYear: '2025', bands: b([26050, 0], [100000, 0.0275], [null, 0.03125]),
      source: 'https://tax.ohio.gov/individual/resources/annual-tax-rates', authorityName: 'Ohio Department of Taxation', verified: false,
      verificationNote: 'Ohio Department of Taxation pages blocked automated access; the rates come from a search-result extract of the Department’s annual tax rates page, not the page itself',
    },
  ], {
    local: 'municipal income taxes (typically 1%–2.5%; Cleveland 2.5%) and school-district income taxes.',
    assumptions: ['Ohio personal exemptions and the $20 exemption credit are not applied (their amounts were not confirmed), so tax may be slightly overstated.'],
  }),

  OK: state('OK', 'Oklahoma', [
    {
      // 68 O.S. s.2355(D) (HB 2764, 2025) for 2026: 0% / 2.5% / 3.5% / 4.5%.
      taxYear: '2026', bands: b([3750, 0], [4900, 0.025], [7200, 0.035], [null, 0.045]), standardDeduction: 6350, exemption: 1000,
      source: 'https://oklahoma.gov/content/dam/ok/en/tax/documents/resources/publications/businesses/withholding-tables/WHTables-2026.pdf', authorityName: 'Oklahoma Tax Commission (2026 withholding tables); 68 O.S. s.2355', verified: false,
      verificationNote: 'The 2026 rates and the $1,000 exemption are confirmed, but the 2026 standard deduction is not stated anywhere yet (the 2026 Form 511 is not out); the 2025 amount of $6,350 is used, which the 2026 withholding tables are consistent with',
    },
    {
      taxYear: '2025', bands: b([1000, 0.0025], [2500, 0.0075], [3750, 0.0175], [4900, 0.0275], [7200, 0.0375], [null, 0.0475]), standardDeduction: 6350, exemption: 1000,
      source: 'https://oklahoma.gov/content/dam/ok/en/tax/documents/forms/individuals/current/511-Pkt.pdf', authorityName: 'Oklahoma Tax Commission (2025 Form 511 packet)', verified: true,
    },
  ]),

  OR: state('OR', 'Oregon', [
    {
      taxYear: '2026', bands: b([4550, 0.0475], [11400, 0.0675], [125000, 0.0875], [null, 0.099]), standardDeduction: 2910, credit: 263,
      source: 'https://www.oregon.gov/dor/forms/FormsPubs/withholding-tax-formulas_206-436_2026.pdf', authorityName: 'Oregon Department of Revenue (2026 withholding tax formulas)', verified: true,
      assumptions: ['The 2026 income limit on the exemption credit was not yet published, so the $263 credit is applied at every income.'],
    },
    {
      taxYear: '2025', bands: b([4400, 0.0475], [11100, 0.0675], [125000, 0.0875], [null, 0.099]), standardDeduction: 2835,
      credit: (c) => (c.agi > 100000 ? 0 : 256),
      source: 'https://www.oregon.gov/dor/forms/FormsPubs/publication-or-17_101-431_2025.pdf', authorityName: 'Oregon Department of Revenue (OR-17)', verified: true,
    },
  ], {
    local: 'the Portland-area Metro supportive housing tax (1% over $128,000) and Multnomah County preschool tax (1.5% over $125,000).',
    assumptions: ['The Oregon subtraction for federal income tax paid (up to $8,500 for 2025) is not applied, so tax is overstated by up to about $800.'],
  }),

  PA: state('PA', 'Pennsylvania', [
    {
      taxYear: '2026', bands: b([null, 0.0307]),
      source: 'https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/personal-income-tax', authorityName: 'Pennsylvania Department of Revenue', verified: true,
    },
    {
      taxYear: '2025', bands: b([null, 0.0307]),
      source: 'https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/personal-income-tax', authorityName: 'Pennsylvania Department of Revenue', verified: true,
    },
  ], {
    note: 'Pennsylvania income tax added to the federal tax: a flat 3.07% on compensation, with no standard deduction or personal exemption.',
    local: 'local earned income taxes (typically 1%), the local services tax and the Philadelphia wage tax.',
    assumptions: ['Tax forgiveness for low incomes (Schedule SP) is not applied.'],
  }),

  RI: state('RI', 'Rhode Island', [
    {
      // 2026 bracket thresholds not captured, so 2025 only.
      taxYear: '2025', bands: b([79900, 0.0375], [181650, 0.0475], [null, 0.0599]), standardDeduction: 10900, exemption: 5100,
      source: 'https://tax.ri.gov/sites/g/files/xkgbur541/files/2024-10/ADV_2024_26_Inflation_Adjustments.pdf', authorityName: 'Rhode Island Division of Taxation (ADV 2024-26)', verified: false,
      verificationNote: 'Rhode Island Division of Taxation pages blocked automated access; the figures come from search-result extracts of its official inflation-adjustment advisory, not the advisory itself',
    },
  ], { assumptions: ['The phase-out of the standard deduction and exemption above about $254,000 of income is not applied.', 'Rhode Island TDI is a payroll contribution and not included.'] }),

  SC: state('SC', 'South Carolina', [
    {
      // Act 110 of 2026 (H.4216), tax years beginning after 2025: 1.99% to $30,000; 5.21% above. Federal deductions replaced by the SCIAD.
      taxYear: '2026', bands: b([30000, 0.0199], [null, 0.0521]), standardDeduction: scIncomeAdjustedDeduction,
      source: 'https://www.scstatehouse.gov/sess126_2025-2026/bills/4216.htm', authorityName: 'South Carolina General Assembly (Act 110 of 2026, H.4216)', verified: true,
      assumptions: ['Whether the $30,000 bracket threshold is inflation-indexed for 2026 was not confirmed (the 2026 tax tables were not yet published).'],
    },
    {
      taxYear: '2025', bands: b([3560, 0], [17830, 0.03], [null, 0.06]), standardDeduction: 'federal',
      source: 'https://dor.sc.gov/forms-site/Forms/SC1040TT_2025.pdf', authorityName: 'South Carolina Department of Revenue (2025 SC1040 tax tables)', verified: true,
    },
  ]),

  SD: noTax('SD', 'South Dakota', 'https://dor.sd.gov/individuals/taxes/', 'South Dakota Department of Revenue', 'South Dakota does not impose a state income tax.'),

  TN: noTax('TN', 'Tennessee', 'https://www.tn.gov/revenue/taxes/hall-income-tax.html', 'Tennessee Department of Revenue', 'Tennessee has never taxed wages, and the Hall income tax on interest and dividends was repealed for tax years beginning on or after 1 January 2021.', false,
    'Tennessee government pages blocked automated access, so the absence of a wage tax was not re-read on the official page this time'),

  TX: noTax('TX', 'Texas', 'https://tcss.legis.texas.gov/resources/CN/htm/CN.8.htm', 'Texas Constitution Art. 8, Sec. 24-a (Texas Legislature)', 'the Texas Constitution prohibits a tax on the net incomes of individuals.'),

  UT: state('UT', 'Utah', [
    {
      taxYear: '2026', bands: b([null, 0.0445]), credit: utahCredit(18213),
      source: 'https://le.utah.gov/xcode/Title59/Chapter10/C59-10-S104_2026050620260506.html', authorityName: 'Utah Code 59-10-104 (Utah State Legislature)', verified: false,
      verificationNote: 'The 4.45% rate is confirmed in the Utah Code, but the inflation-indexed 2026 base phase-out amount for the taxpayer tax credit was not found on an accessible official page; the 2025 amount of $18,213 is used',
    },
    {
      taxYear: '2025', bands: b([null, 0.045]), credit: utahCredit(18213),
      source: 'https://incometax.utah.gov/credits/taxpayer-tax-credit', authorityName: 'Utah State Tax Commission', verified: true,
    },
  ], { note: 'Utah income tax added to the federal tax: a flat rate on income, less the taxpayer tax credit (6% of the federal standard deduction, phased out at 1.3% of income above the base amount).' }),

  VA: state('VA', 'Virginia', [
    {
      taxYear: '2026', bands: b([3000, 0.02], [5000, 0.03], [17000, 0.05], [null, 0.0575]), standardDeduction: 8750, exemption: 930,
      source: 'https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-320/', authorityName: 'Code of Virginia 58.1-320; Virginia Department of Taxation', verified: true,
    },
    {
      taxYear: '2025', bands: b([3000, 0.02], [5000, 0.03], [17000, 0.05], [null, 0.0575]), standardDeduction: 8750, exemption: 930,
      source: 'https://www.tax.virginia.gov/sites/default/files/vatax-pdf/tax-table-2025.pdf', authorityName: 'Virginia Department of Taxation', verified: true,
    },
  ]),

  VT: state('VT', 'Vermont', [
    {
      // 2026 tax-year rate schedule not published, so 2025 only.
      taxYear: '2025', bands: b([49400, 0.0335], [119700, 0.066], [249700, 0.076], [null, 0.0875]), standardDeduction: 7650, exemption: 5300,
      source: 'https://tax.vermont.gov/sites/tax/files/documents/Income-Booklet-2025.pdf', authorityName: 'Vermont Department of Taxes', verified: true,
    },
  ]),

  WA: noTax('WA', 'Washington', 'https://dor.wa.gov/taxes-rates/income-tax', 'Washington Department of Revenue', 'Washington has no individual income tax (its capital-gains excise is not a tax on wages, and the income tax enacted for 2028 is not yet in force).'),

  WI: state('WI', 'Wisconsin', [
    {
      // 2025 is not encoded: its sliding-scale standard deduction formula was not stated in text form in the research.
      taxYear: '2026', bands: b([15110, 0.035], [51950, 0.044], [332720, 0.053], [null, 0.0765]), standardDeduction: wisconsinSD, exemption: 700,
      source: 'https://www.revenue.wi.gov/TaxForms2026/2026-Form1-ES-Inst.pdf', authorityName: 'Wisconsin Department of Revenue (2026 Form 1-ES)', verified: true,
    },
  ], { note: 'Wisconsin income tax added to the federal tax: brackets on income less the sliding-scale standard deduction and the $700 exemption.' }),

  WV: state('WV', 'West Virginia', [
    {
      // SB 392 (2026), retroactive to 1 January 2026: W. Va. Code 11-21-4j.
      taxYear: '2026', bands: b([10000, 0.0211], [25000, 0.0281], [40000, 0.0316], [60000, 0.0422], [null, 0.0458]), exemption: 2000,
      source: 'https://tax.wv.gov/Individuals/Pages/PersonalIncomeTaxReductionBill.aspx', authorityName: 'West Virginia Tax Division', verified: true,
    },
    {
      taxYear: '2025', bands: b([10000, 0.0222], [25000, 0.0296], [40000, 0.0333], [60000, 0.0444], [null, 0.0482]), exemption: 2000,
      source: 'https://code.wvlegislature.gov/11-21-4i/', authorityName: 'West Virginia Code 11-21-4i', verified: true,
    },
  ]),

  WY: noTax('WY', 'Wyoming', 'https://www.wyo.gov/about-wyoming', 'State of Wyoming', 'Wyoming has no individual income tax.'),
};
