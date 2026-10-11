/**
 * The law behind the organisation rules (clubs, PTAs, charities) — ai2fin.com
 *
 * Two kinds of row, both dated the way the home rules are:
 *
 *  - ORG_RULE_SOURCES: what a page says that a rule rests on (a status, a
 *    relief, a report), the page, its own "last updated" date, the day it was
 *    read and the day by which it must be read again.
 *  - ORG_FIGURES: every number the rules use (thresholds, the Gift Aid rate,
 *    claim windows, the CASC limits), as SourcedFigures with the regulator
 *    they belong to, the org types they apply to and the financial years they
 *    cover.
 *
 * READS. Every page was read in full on 11 October 2026 (UTC). GOV.UK pages
 * through the GOV.UK Content API (www.gov.uk/api/content/<path>), whose
 * `public_updated_at` is recorded as `pageLastUpdated`; the Gift Aid schedule
 * headings from the spreadsheet HMRC publishes (sheet R68GAD_V1_00_0_EN, the
 * "Excel" .ods, updated 29 August 2024); ATO and ACNC pages with a browser
 * user agent, with the page's own "Last updated" date where it shows one.
 *
 * THE UK HAS THREE CHARITY REGULATORS. The Charity Commission (England and
 * Wales), OSCR (Scotland) and CCNI (Northern Ireland). The full threshold set
 * here is the Charity Commission's; OSCR and CCNI are recorded only where they
 * differ in a way the app acts on (receipts and payments accounts).
 *
 * THE CHARITY COMMISSION THRESHOLDS CHANGED ON 30 SEPTEMBER 2026, for
 * financial years ending on or after that day (receipts and payments up to
 * £500,000, independent examination over £40,000, audit over £1.5 million).
 * Both sets are kept, keyed by the financial year END, because a charity
 * closing its accounts for a year that ended before then still uses the old
 * ones.
 *
 * Nothing here is a number the app may use without its row: a test holds
 * every figure to an https source, a read date and a review date, and the
 * freshness test fails the build once a review date passes. 2fin
 */

import type { SourcedFigure } from './homeSpaceRates';

/** UTC calendar day of every read below. */
export const ORG_RULES_READ_ON = '2026-10-11';
const R = ORG_RULES_READ_ON;
/** GB rows are re-read before the 2027-28 tax year starts (6 April 2027). */
const GB_REVIEW_BY = '2027-04-05';
/** AU rows are re-read before the 2027-28 income year starts (1 July 2027). */
const AU_REVIEW_BY = '2027-06-30';

/** The day the new Charity Commission thresholds start: financial years ENDING on or after it. */
export const GB_CC_THRESHOLDS_FROM_YEAR_END = '2026-09-30';

export const ORG_URLS = {
  // GOV.UK — HMRC
  charitiesTaxReliefs: 'https://www.gov.uk/charities-and-tax/tax-reliefs',
  charitiesRecognition: 'https://www.gov.uk/charities-and-tax/get-recognition',
  charitiesPayTax: 'https://www.gov.uk/charities-and-tax/pay-tax',
  claimGiftAid: 'https://www.gov.uk/claim-gift-aid',
  giftAidWhatYouCanClaimOn: 'https://www.gov.uk/claim-gift-aid/what-you-can-claim-it-on',
  giftAidDeclarations: 'https://www.gov.uk/claim-gift-aid/gift-aid-declarations',
  giftAidSmallDonations: 'https://www.gov.uk/claim-gift-aid/small-donations-scheme',
  giftAidHowToClaim: 'https://www.gov.uk/claim-gift-aid/how-to-claim',
  giftAidScheduleGuidance: 'https://www.gov.uk/guidance/schedule-spreadsheet-to-claim-back-tax-on-gift-aid-donations',
  giftAidScheduleSpreadsheets: 'https://www.gov.uk/government/publications/gift-aid-schedule-spreadsheets-to-claim-back-tax-on-donations',
  registerCasc: 'https://www.gov.uk/register-a-community-amateur-sports-club',
  cascCorporationTax:
    'https://www.gov.uk/government/publications/community-amateur-sports-clubs-detailed-guidance-notes/annex-1-overview-of-corporation-tax-and-vat-rules-for-community-amateur-sports-clubs',
  corporationTax: 'https://www.gov.uk/corporation-tax',
  membersClubs: 'https://www.gov.uk/hmrc-internal-manuals/business-income-manual/bim24205',
  registerUnincorporatedAssociation: 'https://www.gov.uk/guidance/register-an-unincorporated-association-for-corporation-tax',
  dormantForCorporationTax: 'https://www.gov.uk/dormant-company/dormant-for-corporation-tax',
  registerForVat: 'https://www.gov.uk/register-for-vat',
  // GOV.UK — Charity Commission
  setUpCharityRegister: 'https://www.gov.uk/setting-up-charity/register-your-charity',
  setUpCharityStructures: 'https://www.gov.uk/setting-up-charity/structures',
  ccThresholds: 'https://www.gov.uk/government/publications/charity-accounts/threshold-changes-at-a-glance',
  ccCharitableCompanies: 'https://www.gov.uk/government/publications/charity-accounts/charity-accounts-rules-for-charitable-companies',
  ccCios: 'https://www.gov.uk/government/publications/charity-accounts/charity-accounts-rules-for-charitable-incorporated-organisations-cios',
  charityCommission: 'https://www.gov.uk/government/organisations/charity-commission',
  // OSCR and CCNI
  oscrReceiptsPayments: 'https://www.oscr.org.uk/managing-a-charity/charity-accounting/receipts-payments-accounts/4-external-scrutiny/',
  ccniAnnualReporting: 'https://www.charitycommissionni.org.uk/running-a-charity/annual-reporting/',
  // ATO
  atoIncomeTaxExempt:
    'https://www.ato.gov.au/businesses-and-organisations/not-for-profit-organisations/your-organisation/does-your-not-for-profit-need-to-pay-income-tax/income-tax-exempt-organisations',
  atoSelfAssessing:
    'https://www.ato.gov.au/businesses-and-organisations/not-for-profit-organisations/your-organisation/does-your-not-for-profit-need-to-pay-income-tax/self-assessing-income-tax-exemption',
  atoExemptTypes:
    'https://www.ato.gov.au/businesses-and-organisations/not-for-profit-organisations/your-organisation/does-your-not-for-profit-need-to-pay-income-tax/types-of-income-tax-exempt-organisations',
  atoTaxableNfps:
    'https://www.ato.gov.au/businesses-and-organisations/not-for-profit-organisations/your-organisation/does-your-not-for-profit-need-to-pay-income-tax/taxable-organisations',
  atoMutuality:
    'https://www.ato.gov.au/businesses-and-organisations/not-for-profit-organisations/your-organisation/in-detail/income-tax/mutuality-and-taxable-income-for-not-for-profits/taxable-income-and-mutuality',
  atoEndorsement: 'https://www.ato.gov.au/businesses-and-organisations/not-for-profit-organisations/getting-started/getting-endorsed-for-tax-concessions-or-as-a-dgr',
  atoDgrGifts: 'https://www.ato.gov.au/businesses-and-organisations/not-for-profit-organisations/gifts-and-fundraising/receiving-tax-deductible-gifts',
  atoNfpGst:
    'https://www.ato.gov.au/businesses-and-organisations/not-for-profit-organisations/your-organisation/gst-for-not-for-profits/gst-registration-for-not-for-profits',
  // ACNC
  acncCharitySize: 'https://www.acnc.gov.au/tools/topic-guides/charity-size',
  acncReportingAnnually: 'https://www.acnc.gov.au/for-charities/manage-your-charity/obligations-acnc/reporting-annually-acnc',
  acncIncorporatedAssociations: 'https://www.acnc.gov.au/tools/topic-guides/incorporated-associations',
  acnc: 'https://www.acnc.gov.au',
} as const;

const U = ORG_URLS;

export interface OrgSource {
  /** The key in ORG_RULE_SOURCES. */
  id: string;
  country: 'GB' | 'AU';
  /** What the page says that the rule rests on, in the page's own terms (short quotes in double quotes). */
  claim: string;
  authority: 'HMRC' | 'Charity Commission' | 'OSCR' | 'CCNI' | 'ATO' | 'ACNC';
  sourceUrl: string;
  /** The page's own "last updated" date (YYYY-MM-DD), or null where it shows none. */
  pageLastUpdated: string | null;
  /** YYYY-MM-DD the page was read. */
  readOn: string;
  /** YYYY-MM-DD by which the page must be read again; the freshness test fails past it. */
  reviewBy: string;
}

type SourceRow = Omit<OrgSource, 'id'>;
const gb = (authority: OrgSource['authority'], sourceUrl: string, pageLastUpdated: string | null, claim: string): SourceRow => ({
  country: 'GB',
  claim,
  authority,
  sourceUrl,
  pageLastUpdated,
  readOn: R,
  reviewBy: GB_REVIEW_BY,
});
const au = (authority: OrgSource['authority'], sourceUrl: string, pageLastUpdated: string | null, claim: string): SourceRow => ({
  country: 'AU',
  claim,
  authority,
  sourceUrl,
  pageLastUpdated,
  readOn: R,
  reviewBy: AU_REVIEW_BY,
});

const GB_SOURCES = {
  charitiesTaxReliefs: gb(
    'HMRC',
    U.charitiesTaxReliefs,
    '2014-12-08',
    'A charity does not pay tax on most of its income and gains if it uses them for charitable purposes — on donations, trading ' +
      'profits, rental or investment income, gains, and when it buys property. Charities pay tax on profits from developing land ' +
      'or property and on "any money you do not use for charitable purposes".',
  ),
  charitiesRecognition: gb(
    'HMRC',
    U.charitiesRecognition,
    '2014-12-08',
    'To get tax relief a charity must be based in the UK, established for charitable purposes only, registered with the Charity ' +
      'Commission or another regulator if this applies, run by "fit and proper persons" and recognised by HMRC.',
  ),
  charitiesPayTax: gb(
    'HMRC',
    U.charitiesPayTax,
    '2014-12-08',
    'A charity with income that does not qualify for relief completes a tax return (a Company Tax Return for a limited company or ' +
      'unincorporated association, with the charities supplementary pages; a Trust and Estate return for a trust). With no tax ' +
      'to pay, only if HMRC asks. "Limited companies must also send annual accounts to Companies House."',
  ),
  giftAidRate: gb(
    'HMRC',
    U.claimGiftAid,
    '2014-12-08',
    '"You can claim back 25p every time an individual donates £1 to your charity or community amateur sports club (CASC)." The ' +
      'charity or CASC must be recognised for tax purposes; the donor must have paid at least as much Income Tax or Capital Gains ' +
      'Tax in the tax year and make a Gift Aid declaration.',
  ),
  giftAidNotOn: gb(
    'HMRC',
    U.giftAidWhatYouCanClaimOn,
    '2014-12-08',
    'No Gift Aid on donations from limited companies, through Payroll Giving, that pay for goods or services, with a benefit over ' +
      'the limit, of shares, from charity cards or vouchers, "of membership fees to CASCs", or received before recognition.',
  ),
  giftAidDeclarations: gb(
    'HMRC',
    U.giftAidDeclarations,
    '2014-12-08',
    'A declaration names the charity or CASC, the donor\'s full name and home address with postcode, and that the donor agrees to ' +
      'Gift Aid. "You must keep a record of declarations for 6 years after the most recent donation you claimed Gift Aid on."',
  ),
  giftAidClaimDeadline: gb(
    'HMRC',
    U.giftAidHowToClaim,
    '2014-12-08',
    '"You need to claim for a donation within 4 years of the end of the financial period you received it in": the tax year (6 April ' +
      'to 5 April) for a trust; the accounting period for a CASC, a CIO or a limited company. Small donations scheme claims: within ' +
      '2 years of the end of the tax year. Claims of over 1,000 donations must use software.',
  ),
  giftAidSmallDonations: gb(
    'HMRC',
    U.giftAidSmallDonations,
    '2014-12-08',
    'Gift Aid small donations scheme (GASDS): 25% on cash, and contactless card donations from 6 April 2019, of £30 or less, with ' +
      'no declaration; "From 6 April 2016, you can claim up to £2,000 in a tax year"; a GASDS claim cannot be more than 10 times the ' +
      'Gift Aid claim; the charity or CASC must have claimed Gift Aid in the same tax year; not on membership fees.',
  ),
  giftAidScheduleGuidance: gb(
    'HMRC',
    U.giftAidScheduleGuidance,
    '2025-11-28',
    'Donation date "using the format DD/MM/YY" (the latest date for a series); amounts "without using £ signs and showing amounts to ' +
      '2 decimal places"; "a maximum of 1,000 lines" per spreadsheet. Aggregated donations: £20 or less each, no more than £1,000 a ' +
      'line (one bullet on the same page says "under £30"; the 2019 spreadsheet change note says the amount went from £30 to £20).',
  ),
  giftAidScheduleColumns: gb(
    'HMRC',
    U.giftAidScheduleSpreadsheets,
    '2024-08-29',
    'The donations schedule table (sheet R68GAD_V1_00_0_EN) is headed: Item, Title, First name, Last name, House name or number, ' +
      'Postcode, Aggregated donations, Sponsored event, Donation date, Amount. Item is the pre-filled row number. The guidance row ' +
      'says "Donation date (DD/MM/YY) DON\'T use hyphens or full stops" and "Amount DON\'T use a £ sign".',
  ),
  cascReliefs: gb(
    'HMRC',
    U.registerCasc,
    '2016-04-15',
    'A registered CASC gets "tax relief on income, gains and profits from some activities", "Gift Aid repayments on donations" and ' +
      'business rates relief; it must register with HMRC. "A registered CASC cannot be recognised as a charity for tax purposes." ' +
      '"CASCs are not regulated by the Charity Commission."',
  ),
  cascCorporationTax: gb(
    'HMRC',
    U.cascCorporationTax,
    '2026-05-12',
    'CASCs pay Corporation Tax on income or gains that are not exempt. Trading turnover "not more than the limit of £50,000": the ' +
      'whole profit is exempt if applied for qualifying purposes; over it, "no marginal relief" and the whole profit is taxable. ' +
      'Rental income exempt up to "£30,000 per year". Gift Aid and interest exempt without limit; gains exempt if applied and claimed. ' +
      'Membership subscriptions are not trading income; supplies to non-members normally are.',
  ),
  clubsCorporationTax: gb(
    'HMRC',
    U.corporationTax,
    '2014-12-15',
    'Corporation Tax is paid on profits from doing business as a "club, co-operative or other unincorporated association, for ' +
      'example a community group or sports club" — trading profits, investments and chargeable gains.',
  ),
  membersClubSurplus: gb(
    'HMRC',
    U.membersClubs,
    '2016-04-01',
    'A members\' club "is unlikely to be liable to tax on any surplus which arises from transactions with its full members" (it is ' +
      'not trading). Commercial services to outsiders are taxable trading income; "Other income (for example savings and investment ' +
      'income) and gains of members\' clubs are chargeable to tax in the normal way."',
  ),
  registerUnincorporatedAssociation: gb(
    'HMRC',
    U.registerUnincorporatedAssociation,
    '2025-07-11',
    'An unincorporated association registers for Corporation Tax "within 3 months from the date the unincorporated association starts ' +
      'trading or receiving other income such as from investments".',
  ),
  dormantForCorporationTax: gb(
    'HMRC',
    U.dormantForCorporationTax,
    '2016-06-30',
    'An organisation is usually dormant for Corporation Tax if it "is an unincorporated association or club owing less than £100 ' +
      'Corporation Tax"; HMRC may write to say it will treat it as dormant.',
  ),
  vatRegistration: gb(
    'HMRC',
    U.registerForVat,
    '2024-10-10',
    'Register for VAT if taxable turnover for the last 12 months "goes over £90,000 (the VAT threshold)" or is expected to in the next ' +
      '30 days; registration is voluntary below it; not needed for only VAT-exempt or out-of-scope supplies.',
  ),
  charityRegistration: gb(
    'Charity Commission',
    U.setUpCharityRegister,
    '2025-01-28',
    'A charity based in England or Wales must apply to register if "its income is at least £5,000 per year or it\'s a charitable ' +
      'incorporated organisation (CIO)" (the guide\'s first page says "over £5,000"). "The rules are different" in Scotland and ' +
      'Northern Ireland.',
  ),
  charityStructures: gb(
    'Charity Commission',
    U.setUpCharityStructures,
    '2025-01-28',
    'A charitable company registers with Companies House (limited by guarantee). "You create a CIO by registering with the Charity ' +
      'Commission. You do not need to register with Companies House."',
  ),
  ccThresholds: gb(
    'Charity Commission',
    U.ccThresholds,
    '2026-09-16',
    'Thresholds for financial years ending before / on or after 30 September 2026: annual return over £10,000 (both); report and ' +
      'accounts to the Commission over £25,000 (both); independent examination over £25,000 / £40,000; "Unincorporated charity and ' +
      'CIO can prepare receipts and payments accounts" at £250,000 or less / £500,000 or less; professionally qualified examiner ' +
      'over £250,000 / £500,000; audit over £1,000,000 / £1,500,000, or income over £250,000 / £500,000 with assets over ' +
      '£3,260,000 / £5,000,000.',
  ),
  ccCharitableCompanies: gb(
    'Charity Commission',
    U.ccCharitableCompanies,
    '2026-09-16',
    '"All charitable companies must prepare accruals accounts" (Companies Act 2006 s 394, true and fair view s 393(1)) and "must ' +
      'submit information yearly to Companies House" as well as to the Commission.',
  ),
  ccCios: gb(
    'Charity Commission',
    U.ccCios,
    '2026-09-16',
    'For financial years ending on or after 30 September 2026 a CIO "can prepare receipts and payments accounts if its gross income ' +
      'is £500,000 or less" (£250,000 or less for years ending before), unless its governing document says otherwise.',
  ),
  oscrReceiptsPayments: gb(
    'OSCR',
    U.oscrReceiptsPayments,
    '2025-04-22',
    'Scotland: receipts and payments accounts "where their gross income in a financial year is less than £250,000"; independent ' +
      'examination "is available, under the 2006 Regulations, for charities with a gross income under £500,000".',
  ),
  ccniReceiptsPayments: gb(
    'CCNI',
    U.ccniAnnualReporting,
    null,
    'Northern Ireland: "If your income is £250,000 or less and you\'re not a charitable company, you can choose to prepare either" ' +
      'receipts and payments or accruals accounts; "If your income is over £250,000, you must prepare accruals accounts."',
  ),
} satisfies Record<string, SourceRow>;

const AU_SOURCES = {
  charityExemptIfEndorsed: au(
    'ATO',
    U.atoIncomeTaxExempt,
    '2024-07-17',
    'NFPs with only charitable purposes "must be registered with the Australian Charities and Not-for-profits Commission (ACNC) and ' +
      'be endorsed by the ATO to be income tax exempt"; charitable NFPs that do not register "are taxable NFPs".',
  ),
  endorsementTypes: au(
    'ATO',
    U.atoEndorsement,
    '2018-04-26',
    'Two endorsements: charity tax concessions and deductible gift recipient (DGR). "Being endorsed for charity tax concessions does ' +
      'not mean your organisation is automatically endorsed as a DGR. You must seek endorsement for both."',
  ),
  dgrGifts: au(
    'ATO',
    U.atoDgrGifts,
    '2017-07-25',
    '"To be eligible to receive tax-deductible gifts, your organisation must be a deductible gift recipient (DGR)."',
  ),
  selfAssessing: au(
    'ATO',
    U.atoSelfAssessing,
    '2024-07-16',
    'A non-charity NFP may self-assess income tax exemption under one of 8 categories in Division 50 ITAA 1997 (most must pass one ' +
      'of 3 tests, follow their governing rules and apply income and assets solely to their purpose). "From 1 July 2023, ' +
      'non-charitable NFPs with an active Australian business number (ABN) self-assessing as income tax exempt need to lodge an ' +
      'annual NFP self-review return."',
  ),
  exemptCategories: au(
    'ATO',
    U.atoExemptTypes,
    '2024-07-17',
    'The 8 self-assessing categories: community service, cultural, educational, health, employment, resource development, ' +
      'scientific and sporting organisations; "Sporting organisations are established for the encouragement of a game, sport or ' +
      'animal racing."',
  ),
  taxableNfps: au(
    'ATO',
    U.atoTaxableNfps,
    '2025-08-26',
    'Taxable NFPs include "social clubs and fraternal organisations" and "clubs whose main purpose is providing hospitality services ' +
      'for members". "Incorporated associations and unincorporated associations are treated as a company for income tax purposes." ' +
      'An NFP company with taxable income of $416 or less can send a non-lodgment advice.',
  ),
  mutuality: au(
    'ATO',
    U.atoMutuality,
    '2018-12-04',
    '"Receipts derived from mutual dealings with members are not assessable income" and expenses to get them are not deductible; ' +
      'revenue from non-members (for example hiring rooms to the public) and from outside sources (bank interest) is assessable.',
  ),
  gstNfp: au(
    'ATO',
    U.atoNfpGst,
    '2026-07-30',
    'An NFP must register for GST if it carries on an enterprise and its "GST turnover is $150,000 or more"; it lodges a BAS once ' +
      'registered; registration below the threshold is voluntary.',
  ),
  acncCharitySize: au(
    'ACNC',
    U.acncCharitySize,
    null,
    'From the 2022 Annual Information Statement: small "annual revenue under $500,000", medium "$500,000 or more, but under $3 ' +
      'million", large "$3 million or more". Small charities may use cash or accrual accounting; medium and large use accrual; the ' +
      'ACNC requires a medium charity\'s financial report to be reviewed or audited and a large charity\'s to be audited.',
  ),
  acncReportingAnnually: au(
    'ACNC',
    U.acncReportingAnnually,
    null,
    '"All charities are required to submit an Annual Information Statement each year, and medium and large sized charities also need ' +
      'to submit an annual financial report"; a small charity\'s financial report is optional.',
  ),
  incorporatedAssociations: au(
    'ACNC',
    U.acncIncorporatedAssociations,
    null,
    'Incorporated associations are set up under a state or territory law, usually not-for-profit, and "may have obligations to state ' +
      'or territory government regulators, such as providing annual reports or keeping financial records".',
  ),
} satisfies Record<string, SourceRow>;

export type GbOrgSourceKey = keyof typeof GB_SOURCES;
export type AuOrgSourceKey = keyof typeof AU_SOURCES;
export type OrgSourceKey = GbOrgSourceKey | AuOrgSourceKey;

const withIds = <K extends string>(rows: Record<K, SourceRow>): Record<K, OrgSource> =>
  Object.fromEntries(Object.entries<SourceRow>(rows).map(([id, r]) => [id, { id, ...r }])) as Record<K, OrgSource>;

/** Every rule source, by key. GB and AU keys do not overlap. */
export const ORG_RULE_SOURCES: Record<OrgSourceKey, OrgSource> = { ...withIds(GB_SOURCES), ...withIds(AU_SOURCES) };

// ─── Figures ────────────────────────────────────────────────────────────────

/**
 * How a figure is compared with the organisation's own number: 'over' (more than), 'at_least', 'or_less', 'under'
 * (less than), or 'is' for a rate, a count or a number of years.
 */
export type OrgFigureTest = 'over' | 'at_least' | 'or_less' | 'under' | 'is';

export interface OrgFigure extends SourcedFigure {
  /** 'GB.cc.receiptsAndPaymentsUpTo', 'AU.acnc.smallUnder', … */
  id: string;
  country: 'GB' | 'AU';
  label: string;
  /** 'GBP' / 'AUD', or null for a rate, a count or a number of years. */
  currency: 'GBP' | 'AUD' | null;
  test: OrgFigureTest;
  /** Whose rule it is — the thresholds differ between the three UK charity regulators. */
  regulator: string;
  /** The org type codes it applies to. */
  appliesTo: string[];
  /** Financial years ENDING on or after this day (YYYY-MM-DD), or null for no lower bound. */
  yearsEndingFrom: string | null;
  /** Financial years ENDING before this day, or null for no upper bound. */
  yearsEndingBefore: string | null;
  /** The ORG_RULE_SOURCES key the figure was read under. */
  source: OrgSourceKey;
}

const GB_CHARITIES = ['GB_CHARITY', 'GB_CIO', 'GB_CHARITABLE_COMPANY'];
const GB_NON_COMPANY_CHARITIES = ['GB_CHARITY', 'GB_CIO'];
const GB_GIFT_AID = [...GB_CHARITIES, 'GB_CASC'];
const GB_ALL = ['GB_CLUB', 'GB_PTA', 'GB_CASC', ...GB_CHARITIES];
const AU_ALL = ['AU_INCORPORATED_ASSOCIATION', 'AU_ACNC_CHARITY', 'AU_CLUB'];

const CC = 'Charity Commission (England and Wales)';
const NEW = GB_CC_THRESHOLDS_FROM_YEAR_END;

type FigureInput = Omit<OrgFigure, 'kind' | 'readOn' | 'reviewBy' | 'sourceUrl'>;
const fig = (f: FigureInput): OrgFigure => {
  const src = ORG_RULE_SOURCES[f.source];
  return { ...f, kind: 'law', sourceUrl: src.sourceUrl, readOn: src.readOn, reviewBy: src.reviewBy };
};
/** A Charity Commission threshold in its two periods: before and from financial years ending 30 September 2026. */
const ccPair = (
  base: Omit<FigureInput, 'value' | 'taxYear' | 'yearsEndingFrom' | 'yearsEndingBefore' | 'note'>,
  before: number,
  from: number,
  note: (amount: number) => string,
): OrgFigure[] => [
  fig({ ...base, value: from, taxYear: 'financial years ending on or after 30 September 2026', yearsEndingFrom: NEW, yearsEndingBefore: null, note: note(from) }),
  fig({ ...base, value: before, taxYear: 'financial years ending before 30 September 2026', yearsEndingFrom: null, yearsEndingBefore: NEW, note: note(before) }),
];
const gbp = (n: number) => `£${n.toLocaleString('en-GB')}`;

export const ORG_FIGURES: readonly OrgFigure[] = [
  // ─── GB — Charity Commission (England and Wales) ───
  fig({
    id: 'GB.cc.registration',
    country: 'GB',
    label: 'Charity registration: income per year',
    value: 5000,
    taxYear: 'current',
    currency: 'GBP',
    test: 'at_least',
    regulator: CC,
    appliesTo: GB_CHARITIES,
    yearsEndingFrom: null,
    yearsEndingBefore: null,
    source: 'charityRegistration',
    note: 'A charity based in England or Wales applies to register once its income is £5,000 a year (the guide also says "over £5,000"). A CIO registers whatever its income — registering is how it is created.',
  }),
  ...ccPair(
    { id: 'GB.cc.annualReturn', country: 'GB', label: 'Annual return to the Charity Commission: income over', currency: 'GBP', test: 'over', regulator: CC, appliesTo: GB_CHARITIES, source: 'ccThresholds' },
    10000,
    10000,
    (n) => `A registered charity with income over ${gbp(n)} prepares an annual return and sends it to the Commission.`,
  ),
  ...ccPair(
    { id: 'GB.cc.independentExamination', country: 'GB', label: 'Accounts independently examined (or audited): income over', currency: 'GBP', test: 'over', regulator: CC, appliesTo: GB_CHARITIES, source: 'ccThresholds' },
    25000,
    40000,
    (n) => `Income over ${gbp(n)}: the accounts must be independently examined (or audited). At ${gbp(n)} or less no examination is required unless the governing document or a funder says so.`,
  ),
  ...ccPair(
    { id: 'GB.cc.receiptsAndPaymentsUpTo', country: 'GB', label: 'Receipts and payments accounts allowed: gross income up to', currency: 'GBP', test: 'or_less', regulator: CC, appliesTo: GB_NON_COMPANY_CHARITIES, source: 'ccThresholds' },
    250000,
    500000,
    (n) => `A non-company charity or CIO with gross income of ${gbp(n)} or less can prepare receipts and payments accounts; over it, accruals accounts. A charitable company always prepares accruals accounts.`,
  ),
  ...ccPair(
    { id: 'GB.cc.qualifiedExaminer', country: 'GB', label: 'Professionally qualified independent examiner: income over', currency: 'GBP', test: 'over', regulator: CC, appliesTo: GB_CHARITIES, source: 'ccThresholds' },
    250000,
    500000,
    (n) => `Income over ${gbp(n)}: an independent examination must be by a member of a body listed in the Charities Act 2011.`,
  ),
  ...ccPair(
    { id: 'GB.cc.auditIncome', country: 'GB', label: 'Audit required: income over', currency: 'GBP', test: 'over', regulator: CC, appliesTo: GB_CHARITIES, source: 'ccThresholds' },
    1000000,
    1500000,
    (n) => `Income over ${gbp(n)}: the accounts must be audited by a registered auditor.`,
  ),
  ...ccPair(
    { id: 'GB.cc.auditAssets', country: 'GB', label: 'Audit required: gross assets over (with income over the qualified-examiner threshold)', currency: 'GBP', test: 'over', regulator: CC, appliesTo: GB_CHARITIES, source: 'ccThresholds' },
    3260000,
    5000000,
    (n) => `Gross assets over ${gbp(n)} with income over ${n === 5000000 ? '£500,000' : '£250,000'}: the accounts must be audited.`,
  ),
  // ─── GB — OSCR and CCNI: only where they differ on receipts and payments ───
  fig({
    id: 'GB.oscr.receiptsAndPaymentsUnder',
    country: 'GB',
    label: 'Scotland (OSCR): receipts and payments accounts for gross income under',
    value: 250000,
    taxYear: 'current',
    currency: 'GBP',
    test: 'under',
    regulator: 'OSCR (Scotland)',
    appliesTo: GB_NON_COMPANY_CHARITIES,
    yearsEndingFrom: null,
    yearsEndingBefore: null,
    source: 'oscrReceiptsPayments',
    note: 'A Scottish charity that is not a company can prepare receipts and payments accounts while gross income is less than £250,000. Independent examination is available under £500,000.',
  }),
  fig({
    id: 'GB.ccni.receiptsAndPaymentsUpTo',
    country: 'GB',
    label: 'Northern Ireland (CCNI): receipts and payments accounts for income up to',
    value: 250000,
    taxYear: 'current',
    currency: 'GBP',
    test: 'or_less',
    regulator: 'CCNI (Northern Ireland)',
    appliesTo: GB_NON_COMPANY_CHARITIES,
    yearsEndingFrom: null,
    yearsEndingBefore: null,
    source: 'ccniReceiptsPayments',
    note: 'A Northern Ireland charity that is not a charitable company can choose receipts and payments accounts at £250,000 or less; over it, accruals accounts.',
  }),
  // ─── GB — HMRC ───
  fig({ id: 'GB.hmrc.giftAidRatePerPound', country: 'GB', label: 'Gift Aid repayment per £1 donated', value: 0.25, taxYear: 'current', currency: 'GBP', test: 'is', regulator: 'HMRC', appliesTo: GB_GIFT_AID, yearsEndingFrom: null, yearsEndingBefore: null, source: 'giftAidRate', note: '25p for every £1 an individual donates, with a declaration.' }),
  fig({ id: 'GB.hmrc.giftAidClaimWindowYears', country: 'GB', label: 'Gift Aid claim window (years after the financial period)', value: 4, taxYear: 'current', currency: null, test: 'is', regulator: 'HMRC', appliesTo: GB_GIFT_AID, yearsEndingFrom: null, yearsEndingBefore: null, source: 'giftAidClaimDeadline', note: 'Within 4 years of the end of the financial period the donation was received in: the tax year for a trust; the accounting period for a CASC, a CIO or a limited company.' }),
  fig({ id: 'GB.hmrc.giftAidDeclarationRecordYears', country: 'GB', label: 'Keep Gift Aid declarations for (years after the latest donation claimed)', value: 6, taxYear: 'current', currency: null, test: 'is', regulator: 'HMRC', appliesTo: GB_GIFT_AID, yearsEndingFrom: null, yearsEndingBefore: null, source: 'giftAidDeclarations', note: 'Declarations are kept for 6 years after the most recent donation Gift Aid was claimed on.' }),
  fig({ id: 'GB.hmrc.giftAidScheduleMaxRows', country: 'GB', label: 'Donations per Gift Aid schedule spreadsheet (maximum)', value: 1000, taxYear: 'current', currency: null, test: 'or_less', regulator: 'HMRC', appliesTo: GB_GIFT_AID, yearsEndingFrom: null, yearsEndingBefore: null, source: 'giftAidScheduleGuidance', note: 'A schedule holds at most 1,000 donation lines; a larger claim is split across several online claims, or made with software.' }),
  fig({ id: 'GB.hmrc.giftAidAggregateDonationMax', country: 'GB', label: 'Aggregated donations: each donation up to', value: 20, taxYear: 'current', currency: 'GBP', test: 'or_less', regulator: 'HMRC', appliesTo: GB_GIFT_AID, yearsEndingFrom: null, yearsEndingBefore: null, source: 'giftAidScheduleGuidance', note: 'Donations of £20 or less from different donors can be added together on one line (no more than £1,000 a line). One bullet on the same page says "under £30"; the spreadsheet change note of April 2019 moved it from £30 to £20.' }),
  fig({ id: 'GB.hmrc.giftAidAggregateLineMax', country: 'GB', label: 'Aggregated donations: total on one line up to', value: 1000, taxYear: 'current', currency: 'GBP', test: 'or_less', regulator: 'HMRC', appliesTo: GB_GIFT_AID, yearsEndingFrom: null, yearsEndingBefore: null, source: 'giftAidScheduleGuidance', note: 'One aggregated line cannot be higher than £1,000.' }),
  fig({ id: 'GB.hmrc.gasdsDonationMax', country: 'GB', label: 'Small donations scheme: each cash or contactless donation up to', value: 30, taxYear: 'current', currency: 'GBP', test: 'or_less', regulator: 'HMRC', appliesTo: GB_GIFT_AID, yearsEndingFrom: null, yearsEndingBefore: null, source: 'giftAidSmallDonations', note: 'Cash donations of £30 or less, and contactless card donations of £30 or less from 6 April 2019, with no declaration.' }),
  fig({ id: 'GB.hmrc.gasdsTopUpMax', country: 'GB', label: 'Small donations scheme: top-up per tax year up to', value: 2000, taxYear: 'tax years from 6 April 2016', currency: 'GBP', test: 'or_less', regulator: 'HMRC', appliesTo: GB_GIFT_AID, yearsEndingFrom: null, yearsEndingBefore: null, source: 'giftAidSmallDonations', note: 'Up to £2,000 a tax year (25% of £8,000 of small donations), and no more than 10 times the Gift Aid claim. Connected charities share one £8,000 limit unless one has a community building.' }),
  fig({ id: 'GB.hmrc.gasdsClaimWindowYears', country: 'GB', label: 'Small donations scheme claim window (years after the tax year)', value: 2, taxYear: 'current', currency: null, test: 'is', regulator: 'HMRC', appliesTo: GB_GIFT_AID, yearsEndingFrom: null, yearsEndingBefore: null, source: 'giftAidClaimDeadline', note: 'Within 2 years of the end of the tax year the donations were collected in.' }),
  fig({ id: 'GB.hmrc.cascTradingTurnoverMax', country: 'GB', label: 'CASC trading exemption: turnover from trading up to', value: 50000, taxYear: 'a 12-month accounting period', currency: 'GBP', test: 'or_less', regulator: 'HMRC', appliesTo: ['GB_CASC'], yearsEndingFrom: null, yearsEndingBefore: null, source: 'cascCorporationTax', note: 'Turnover from trading (supplies to non-members) not more than £50,000: the whole profit is exempt if applied for qualifying purposes. Over it there is no marginal relief — the whole profit is taxable. Reduced pro rata for a part period.' }),
  fig({ id: 'GB.hmrc.cascPropertyIncomeMax', country: 'GB', label: 'CASC property income exemption: rental income up to', value: 30000, taxYear: 'a 12-month accounting period', currency: 'GBP', test: 'or_less', regulator: 'HMRC', appliesTo: ['GB_CASC'], yearsEndingFrom: null, yearsEndingBefore: null, source: 'cascCorporationTax', note: 'Rental income (land or property only, from members and non-members) exempt up to £30,000 a year; claimed in the Company Tax Return.' }),
  fig({ id: 'GB.hmrc.clubDormantCorporationTaxUnder', country: 'GB', label: 'Club usually dormant for Corporation Tax: tax owed under', value: 100, taxYear: 'current', currency: 'GBP', test: 'under', regulator: 'HMRC', appliesTo: ['GB_CLUB', 'GB_PTA'], yearsEndingFrom: null, yearsEndingBefore: null, source: 'dormantForCorporationTax', note: 'An unincorporated association or club owing less than £100 Corporation Tax is usually dormant; HMRC may write to say so.' }),
  fig({ id: 'GB.hmrc.vatRegistrationOver', country: 'GB', label: 'VAT registration: taxable turnover in the last 12 months over', value: 90000, taxYear: 'current', currency: 'GBP', test: 'over', regulator: 'HMRC', appliesTo: GB_ALL, yearsEndingFrom: null, yearsEndingBefore: null, source: 'vatRegistration', note: 'Register when taxable turnover for the last 12 months goes over £90,000, or will in the next 30 days. Voluntary below it.' }),
  // ─── AU ───
  fig({ id: 'AU.acnc.smallUnder', country: 'AU', label: 'ACNC small charity: annual revenue under', value: 500000, taxYear: 'from the 2022 Annual Information Statement', currency: 'AUD', test: 'under', regulator: 'ACNC', appliesTo: ['AU_ACNC_CHARITY'], yearsEndingFrom: null, yearsEndingBefore: null, source: 'acncCharitySize', note: 'Small: Annual Information Statement only (a financial report is optional); cash or accrual accounting.' }),
  fig({ id: 'AU.acnc.largeAtLeast', country: 'AU', label: 'ACNC large charity: annual revenue of at least', value: 3000000, taxYear: 'from the 2022 Annual Information Statement', currency: 'AUD', test: 'at_least', regulator: 'ACNC', appliesTo: ['AU_ACNC_CHARITY'], yearsEndingFrom: null, yearsEndingBefore: null, source: 'acncCharitySize', note: 'Large ($3 million or more): Annual Information Statement and an audited financial report. Medium ($500,000 to under $3 million): a reviewed or audited financial report. Both use accrual accounting.' }),
  fig({ id: 'AU.ato.nfpGstRegistrationAtLeast', country: 'AU', label: 'NFP GST registration: GST turnover of at least', value: 150000, taxYear: 'current', currency: 'AUD', test: 'at_least', regulator: 'ATO', appliesTo: AU_ALL, yearsEndingFrom: null, yearsEndingBefore: null, source: 'gstNfp', note: 'An NFP carrying on an enterprise registers for GST (and lodges a BAS) when its GST turnover is $150,000 or more; voluntary below it.' }),
];
