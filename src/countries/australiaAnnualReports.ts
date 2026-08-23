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
}

export interface TprsQualificationOutcome {
  /** True where any limb of the applicable test is met. */
  mustLodge: boolean;
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
  const currentActivity = toPercentOrNull(input.currentYearActivityPercent);
  const priorIncome = toPercentOrNull(input.priorYearIncomePercent);
  if (currentIncome === null && currentActivity === null && priorIncome === null) {
    throw new RangeError(
      'auTprsQualifies needs at least one of currentYearIncomePercent, ' +
        'currentYearActivityPercent or priorYearIncomePercent — with none of them there is ' +
        'nothing to test, and answering "no" would be a guess.',
    );
  }

  const threshold = service.thresholdPercent;
  const limbsMet: TprsQualificationLimb[] = [];
  if (currentIncome !== null && currentIncome >= threshold) limbsMet.push('current_year_income');
  if (service.activityLimb && currentActivity !== null && currentActivity >= threshold) {
    limbsMet.push('current_year_activity');
  }
  if (service.priorYearLimb && priorIncome !== null && priorIncome >= threshold) {
    limbsMet.push('prior_year_income');
  }

  const mustLodge = limbsMet.length > 0;
  const note = mustLodge
    ? `${service.label}: the ${threshold}% test is met, so a TPAR is due for this year.`
    : `${service.label}: no limb of the ${threshold}% test is met on the figures given, so no ` +
      'TPAR is due for this service. Check the other reportable services separately.';

  return { mustLodge, test: service.test, thresholdPercent: threshold, limbsMet, note };
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
