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

import type { AnnualReportDefinition, AuthorityInfo } from '../types';

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
 * The five services that bring a business into the reporting system. Building
 * and construction is the one with no threshold test: a business that pays
 * contractors for building and construction services lodges regardless of what
 * share of its income those services are.
 */
export const AU_TPRS_SERVICES = [
  { key: 'building_and_construction', label: 'Building and construction services', alwaysLodge: true },
  { key: 'cleaning', label: 'Cleaning services' },
  { key: 'courier_and_road_freight', label: 'Courier and road freight services' },
  { key: 'information_technology', label: 'Information technology services' },
  {
    key: 'security_investigation_surveillance',
    label: 'Security, investigation or surveillance services',
  },
];

export const AU_TPAR: AnnualReportDefinition = {
  id: 'tpar',
  label: 'Taxable payments annual report (TPAR)',
  authority: ATO_AUTHORITY,
  dueDate: tparDueDate,
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
    'Lodge a TPAR if you paid contractors for a reportable service and the payments you ' +
    'received for that service are 10% or more of your business income. Courier and road ' +
    'freight are combined for the 10% test. The test does not apply to building and ' +
    'construction services — if you paid contractors for those, you lodge regardless.',
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
