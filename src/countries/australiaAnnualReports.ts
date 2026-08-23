/**
 * Australia — annual reports lodged separately from the BAS — ai2fin.com
 * Authority: Australian Taxation Office (ATO)
 *
 * Today that is one report: the Taxable payments annual report (TPAR), which a
 * business in the taxable payments reporting system (TPRS) lodges by 28 August
 * for the financial year just ended, listing what it paid each contractor.
 *
 * WHAT THIS IS AND IS NOT: the definition below describes the report so the
 * host app can build the payee rows, name the columns the way the ATO names
 * them, and warn about missing ABNs before lodgment day. It does NOT produce
 * the ATO's lodgment file — that format needs an accredited SBR channel — so
 * `lodgmentNote` says where the report is actually lodged.
 *
 * Reference: https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/reports-and-returns/taxable-payments-annual-report
 */

import type {
  AnnualReportDefinition,
  AnnualReportQualificationTest,
  AnnualReportQualifyingService,
  AuthorityInfo,
} from '../types';

const ATO_TPAR_HELP =
  'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/reports-and-returns/taxable-payments-annual-report';

const ATO_AUTHORITY: AuthorityInfo = {
  name: 'ATO',
  fullName: 'Australian Taxation Office',
  portalUrl: 'https://www.ato.gov.au',
  helpUrl: ATO_TPAR_HELP,
};

/**
 * 28 August following the end of the financial year. Australian financial years
 * end on 30 June, so the due date falls in the same calendar year as the year
 * end; the guard only matters if a caller passes a non-standard year end, in
 * which case the next 28 August is the one that has not already passed.
 */
export function tparDueDate(financialYearEnd: Date): Date {
  const year = financialYearEnd.getFullYear();
  const afterThisAugust =
    financialYearEnd.getMonth() > 7 ||
    (financialYearEnd.getMonth() === 7 && financialYearEnd.getDate() > 28);
  // Built at UTC NOON, not local midnight. A due date is a calendar date, and
  // consumers serialise it with toISOString().slice(0, 10); a local-midnight
  // Date renders as 27 August for every lodger east of Greenwich — which is
  // every Australian, i.e. everyone who lodges a TPAR. Noon keeps the calendar
  // date intact for both toISOString() and local getters.
  return new Date(Date.UTC(afterThisAugust ? year + 1 : year, 7, 28, 12, 0, 0));
}

/**
 * The due date as a plain calendar date, `YYYY-08-28`. Prefer this wherever the
 * date is stored, compared or rendered — a string cannot drift across a
 * timezone the way a `Date` can.
 */
export function tparDueDateYmd(financialYearEnd: Date): string {
  return tparDueDate(financialYearEnd).toISOString().slice(0, 10);
}

/**
 * The five services that bring a business into the reporting system — and the
 * TWO DIFFERENT TESTS that decide it.
 *
 * Building and construction is NOT exempt from qualification. It has its own
 * test, and modelling it as "always lodge" tells a business with an incidental
 * building payment to lodge a report it does not owe. The ATO's own words, from
 * "Building and construction services" (last updated 23 April 2024):
 *
 *   "You are considered to be a business that primarily operates in building and
 *    construction services if any apply:
 *      • in the current financial year, 50% or more of your business income is
 *        earned from providing building and construction services
 *      • in the current financial year, 50% or more of your business activity
 *        relates to building and construction services
 *      • in the financial year immediately before the current financial year,
 *        50% or more of your business income was earned from providing building
 *        and construction services"
 *
 * The other four use the ordinary TPRS test: 10% or more of business income from
 * providing that service in the current year, with courier and road freight
 * measured together.
 *
 * Reference: https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/reports-and-returns/taxable-payments-annual-report/work-out-if-you-need-to-lodge-a-tpar/building-and-construction-services
 */
export const AU_TPRS_SERVICES: AnnualReportQualifyingService[] = [
  {
    key: 'building_and_construction',
    label: 'Building and construction services',
    test: 'primarily_in_industry',
    thresholdPercent: 50,
    activityLimb: true,
    priorYearLimb: true,
  },
  { key: 'cleaning', label: 'Cleaning services', test: 'income_share', thresholdPercent: 10 },
  {
    key: 'courier_and_road_freight',
    label: 'Courier and road freight services',
    test: 'income_share',
    thresholdPercent: 10,
    combines: ['Courier services', 'Road freight services'],
  },
  {
    key: 'information_technology',
    label: 'Information technology services',
    test: 'income_share',
    thresholdPercent: 10,
  },
  {
    key: 'security_investigation_surveillance',
    label: 'Security, investigation or surveillance services',
    test: 'income_share',
    thresholdPercent: 10,
  },
];

const TPRS_SERVICE_BY_KEY = new Map(AU_TPRS_SERVICES.map((s) => [s.key, s] as const));

/** Which limb of a test was satisfied. */
export type TprsQualificationLimb =
  | 'current_year_income'
  | 'current_year_activity'
  | 'prior_year_income';

export interface TprsQualificationInput {
  /** One of the `AU_TPRS_SERVICES` keys. An unknown key throws rather than answering "no". */
  service: string;
  /** 0-100: share of CURRENT-year business income earned from providing that service. */
  currentYearIncomePercent?: number;
  /**
   * 0-100: share of CURRENT-year business ACTIVITY relating to that service.
   * Only the primarily-in-industry test has this limb; it is ignored elsewhere.
   */
  currentYearActivityPercent?: number;
  /**
   * 0-100: share of the IMMEDIATELY PRECEDING year's business income.
   * Only the primarily-in-industry test has this limb; it is ignored elsewhere.
   */
  priorYearIncomePercent?: number;
  /**
   * Whether the business paid contractors for this service during the year.
   * The threshold test says whether the business is IN the reporting system;
   * this says whether there is anything to report. A TPAR is owed only when
   * both hold — a cleaning business above 10% that paid no contractors owes
   * nothing. Omit it and `mustLodge` is `null`: the question is unanswered,
   * not answered "no".
   */
  paidContractorsForService?: boolean;
  /**
   * Whether the business has an ABN. The ATO lists this as a lodging
   * condition in its own right ("You must lodge a TPAR if ALL conditions are
   * met: … your business has an Australian business number"). Omit it and a
   * business that clears the other two conditions gets `mustLodge: null`, not
   * `true` — the same discipline as the payment fact.
   */
  hasAbn?: boolean;
}

/** A condition that is met, not met, or simply not known. */
export type TriState = boolean | null;

export interface TprsQualificationOutcome {
  /**
   * Whether a TPAR is owed. `true` / `false` only when BOTH conditions are
   * known; `null` when the threshold test is met but it is not known whether
   * contractors were paid — the question is unanswered, and a host must not
   * collapse that to "no".
   */
  mustLodge: TriState;
  /**
   * The threshold test on its own: is the business inside the reporting
   * system? `true` when any supplied limb clears the line. `false` ONLY when
   * every limb the service has was supplied and none clears it. `null` when
   * no supplied limb clears it but an applicable limb was not supplied — a
   * business at 49% income whose prior year was never given may still
   * qualify on that prior year, and saying "no" would be a guess.
   */
  thresholdMet: TriState;
  /** Limbs of the applicable test that were NOT supplied. Empty when complete. */
  limbsUnknown: TprsQualificationLimb[];
  test: AnnualReportQualificationTest;
  thresholdPercent: number;
  /** The limbs that were met. Empty when the test is not satisfied. */
  limbsMet: TprsQualificationLimb[];
  note: string;
}

/**
 * Whether payments for a reportable service oblige a business to lodge a TPAR.
 *
 * The test is "or", not "and": ANY limb reaching the threshold qualifies. The
 * boundary is inclusive — the ATO says "50% or more" and "10% or more", so 50 is
 * in and 49 is out.
 *
 * Supplying no figure at all throws rather than returning `false`. A confident
 * "you do not need to lodge" on no evidence is exactly the kind of answer a tax
 * product should not give.
 */
export function auTprsQualifies(input: TprsQualificationInput): TprsQualificationOutcome {
  const service = TPRS_SERVICE_BY_KEY.get(input.service);
  if (!service) {
    throw new RangeError(
      `"${String(input.service)}" is not a TPRS reportable service. Expected one of: ` +
        `${AU_TPRS_SERVICES.map((s) => s.key).join(', ')}.`,
    );
  }

  const currentIncome = toPercentOrNull(input.currentYearIncomePercent);
  // Limbs the selected service does not have are not evidence for it. A
  // cleaning business handing over `currentYearActivityPercent: 100` has told
  // us nothing the 10% income test can use, and treating that as "tested, not
  // met" would return a confident "no" on zero applicable evidence.
  const currentActivity = service.activityLimb
    ? toPercentOrNull(input.currentYearActivityPercent)
    : null;
  const priorIncome = service.priorYearLimb ? toPercentOrNull(input.priorYearIncomePercent) : null;
  if (currentIncome === null && currentActivity === null && priorIncome === null) {
    const applicable = ['currentYearIncomePercent'];
    if (service.activityLimb) applicable.push('currentYearActivityPercent');
    if (service.priorYearLimb) applicable.push('priorYearIncomePercent');
    throw new RangeError(
      `auTprsQualifies(${service.key}) needs at least one of ${applicable.join(', ')} — ` +
        'with none of them there is nothing to test, and answering "no" would be a guess.',
    );
  }

  const threshold = service.thresholdPercent;
  const limbsMet: TprsQualificationLimb[] = [];
  const limbsUnknown: TprsQualificationLimb[] = [];
  if (currentIncome === null) limbsUnknown.push('current_year_income');
  else if (currentIncome >= threshold) limbsMet.push('current_year_income');
  if (service.activityLimb) {
    if (currentActivity === null) limbsUnknown.push('current_year_activity');
    else if (currentActivity >= threshold) limbsMet.push('current_year_activity');
  }
  if (service.priorYearLimb) {
    if (priorIncome === null) limbsUnknown.push('prior_year_income');
    else if (priorIncome >= threshold) limbsMet.push('prior_year_income');
  }

  // The test is "or": one limb over the line settles it as met. It is settled
  // as NOT met only once every limb the service has was supplied and none
  // clears it. In between — nothing met, something not supplied — it is
  // unknown, because the missing limb might be the one that qualifies.
  const thresholdMet: TriState =
    limbsMet.length > 0 ? true : limbsUnknown.length === 0 ? false : null;

  // Three conditions, all required (the ATO's own framing: "if ALL conditions
  // are met"). Tri-state AND: any known false decides "no"; all known true
  // decides "yes"; otherwise the question is still open and stays open.
  const conditions: Array<[string, TriState]> = [
    ['threshold', thresholdMet],
    ['paid', input.paidContractorsForService ?? null],
    ['abn', input.hasAbn ?? null],
  ];
  const mustLodge: TriState = conditions.some(([, v]) => v === false)
    ? false
    : conditions.every(([, v]) => v === true)
      ? true
      : null;

  const note = buildQualificationNote(service.label, threshold, thresholdMet, limbsUnknown, {
    paid: input.paidContractorsForService ?? null,
    abn: input.hasAbn ?? null,
  });

  return {
    mustLodge,
    thresholdMet,
    test: service.test,
    thresholdPercent: threshold,
    limbsMet,
    limbsUnknown,
    note,
  };
}

/** One sentence that says which condition decided the answer, or what is still open. */
function buildQualificationNote(
  label: string,
  threshold: number,
  thresholdMet: TriState,
  limbsUnknown: TprsQualificationLimb[],
  facts: { paid: TriState; abn: TriState },
): string {
  if (thresholdMet === false) {
    return (
      `${label}: no limb of the ${threshold}% test is met on the figures given, so no TPAR is ` +
      'due for this service. Check the other reportable services separately.'
    );
  }
  if (facts.abn === false) {
    return `${label}: a TPAR is lodged by a business with an ABN; without one there is nothing to lodge.`;
  }
  if (facts.paid === false) {
    return (
      `${label}: the ${threshold}% test is met, but no contractors were paid for this service ` +
      'this year, so there is nothing to report.'
    );
  }
  if (thresholdMet === null) {
    const missing = limbsUnknown.map((l) => l.replace(/_/g, ' ')).join(', ');
    return (
      `${label}: no supplied limb meets the ${threshold}% test, but ${missing} was not supplied ` +
      'and could still qualify. Supply it before treating this as "no TPAR due".'
    );
  }
  const open: string[] = [];
  if (facts.paid === null) open.push('whether contractors were paid for this service this year');
  if (facts.abn === null) open.push('whether the business has an ABN');
  if (open.length > 0) {
    return (
      `${label}: the ${threshold}% test is met. Whether a TPAR is due also depends on ` +
      `${open.join(' and ')} — confirm before lodging or skipping.`
    );
  }
  return `${label}: the ${threshold}% test is met, contractors were paid and the business has an ABN, so a TPAR is due for this year.`;
}

function toPercentOrNull(value: number | undefined): number | null {
  if (value === undefined || value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
}

export const AU_TPAR: AnnualReportDefinition = {
  id: 'tpar',
  label: 'Taxable payments annual report (TPAR)',
  authority: ATO_AUTHORITY,
  dueDate: tparDueDate,
  /**
   * EXACTLY the fields the TPAR carries, and deliberately no more.
   *
   * "TPAR contractor details to report" (last updated 23 April 2024) lists what
   * "you must include in your TPAR": the contractor's ABN if known, name and
   * address, and the three totals below. Phone number, email address and bank
   * account details appear on the same page in a SEPARATE sentence — "We may ask
   * for extra information about your contractors, including their: phone number,
   * email address, bank account details (if they are paid by electronic bank
   * transfer)" — which is a possible follow-up REQUEST from the ATO, not a
   * column of the report.
   *
   * So they are not columns here. Adding them would tell a user to hand the ATO
   * contractor banking details the annual report does not carry, and a tax
   * product that over-collects on a guess is worse than one that collects what
   * the form asks for. Keep them out unless the ATO's list of what the report
   * must include changes.
   *
   * Reference: https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/reports-and-returns/taxable-payments-annual-report/tpar-contractor-details-to-report
   */
  columns: [
    {
      id: 'abn',
      label: 'ABN',
      type: 'abn',
      officialLabel: "Contractor's Australian business number (ABN), if known",
    },
    {
      id: 'name',
      label: 'Name',
      type: 'text',
      officialLabel: "Contractor's name (business name or individual's name)",
    },
    { id: 'address', label: 'Address', type: 'text', officialLabel: "Contractor's address" },
    {
      id: 'grossPaidInclGst',
      label: 'Gross amount paid',
      type: 'currency',
      officialLabel:
        'Gross amount paid for the financial year, including GST and any tax withheld',
    },
    {
      id: 'totalGst',
      label: 'Total GST',
      type: 'currency',
      officialLabel: 'Total GST included in the gross amount paid',
    },
    {
      id: 'taxWithheldNoAbn',
      label: 'Tax withheld',
      type: 'currency',
      officialLabel: 'Total tax withheld where an ABN was not quoted',
    },
  ],
  // Payee information statement amounts are whole dollars, no cents.
  wholeDollarsOnly: true,
  qualifyingServices: AU_TPRS_SERVICES,
  thresholdNote:
    'Two different tests decide this. For cleaning, courier and road freight, information ' +
    'technology, and security, investigation or surveillance services: lodge a TPAR if the ' +
    'payments you received for that service are 10% or more of your business income, and note ' +
    'that courier and road freight are combined for that 10% test. Building and construction ' +
    'is not exempt from a test — it has a different one. You primarily operate in building ' +
    'and construction services, and so lodge, if ANY of these apply: in the current financial ' +
    'year, 50% or more of your business income is earned from providing building and ' +
    'construction services; in the current financial year, 50% or more of your business ' +
    'activity relates to building and construction services; or in the financial year ' +
    'immediately before the current one, 50% or more of your business income was earned from ' +
    'providing building and construction services.',
  lodgmentNote:
    'This report is prepared here so you can check it before you lodge. It is not the ATO ' +
    'lodgment file: lodge your TPAR through ATO online services, compatible business ' +
    'software, or your registered tax or BAS agent, by 28 August.',
};

/**
 * A contractor whose ABN changed during the year gets one row per ABN, so payee
 * identity for the report is the ABN, not the business name.
 */
export const AU_ANNUAL_REPORTS: AnnualReportDefinition[] = [AU_TPAR];

export default AU_ANNUAL_REPORTS;
