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
 * INDIA'S INCOME-TAX ACT, 2025 IS IN FORCE FROM 1 APRIL 2026. It replaces the
 * Income-tax Act, 1961 from tax year 2026-27: the old sections 11-13, 12A /
 * 12AB and 80G become Chapter XVII-B (registered non-profit organisations,
 * sections 332-355) and section 133, and Forms 10B / 10BB become Form 112.
 * The IN rows cite the 2025 Act. The section pages on incometaxindia.gov.in
 * were read in a browser (the site refuses plain HTTP clients); their footer
 * "Last reviewed and updated on" is site-wide, so `pageLastUpdated` is null
 * for them. The Form 112 FAQ (a PDF) records its Last-Modified header.
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
/** IN rows are re-read before tax year 2027-28 starts (1 April 2027), after the Finance Act 2027. */
const IN_REVIEW_BY = '2027-03-31';

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
  // India — Income Tax Department (Income-tax Act, 2025 and the Companies Act, 2013 as it hosts them)
  inAct2025Commencement: 'https://www.incometaxindia.gov.in/w/section-1-1',
  inS332Registration: 'https://www.incometaxindia.gov.in/w/section-332-7',
  inS334TaxOnIncome: 'https://www.incometaxindia.gov.in/w/section-334-7',
  inS335RegularIncome: 'https://www.incometaxindia.gov.in/w/section-335-7',
  inS336TaxableRegularIncome: 'https://www.incometaxindia.gov.in/w/section-336-7',
  inS341Application: 'https://www.incometaxindia.gov.in/w/section-341-7',
  inS342Accumulation: 'https://www.incometaxindia.gov.in/w/section-342-7',
  inS345CommercialActivity: 'https://www.incometaxindia.gov.in/w/section-345-7',
  inS347Books: 'https://www.incometaxindia.gov.in/w/section-347-7',
  inS348Audit: 'https://www.incometaxindia.gov.in/w/section-348-7',
  inS349Return: 'https://www.incometaxindia.gov.in/w/section-349-7',
  inS354DonorApproval: 'https://www.incometaxindia.gov.in/w/section-354-7',
  inS355Interpretation: 'https://www.incometaxindia.gov.in/w/section-355-7',
  inS133DonorDeduction: 'https://www.incometaxindia.gov.in/w/section-133-94',
  inForm112Faqs: 'https://www.incometaxindia.gov.in/documents/d/guest/form-112-faqs',
  inIncomeTaxReturns: 'https://www.incometaxindia.gov.in/income-tax-returns',
  inCompaniesActS128: 'https://www.incometaxindia.gov.in/w/section-128-81',
  // India — CBIC (GST) and the Supreme Court
  inCgstS22Registration: 'https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/active/chapter6/section22_v1.00.html',
  inGstRwaCircular: 'https://cbic-gst.gov.in/pdf/circular-cgst-109n.pdf',
  inScSecunderabadClub: 'https://api.sci.gov.in/supremecourt/2011/38510/38510_2011_12_1501_46128_Judgement_17-Aug-2023.pdf',
} as const;

const U = ORG_URLS;

/** The countries with their own organisation rules. */
export type OrgCountry = 'GB' | 'AU' | 'IN';

/** The currencies their figures are in (ISO 4217). */
export type OrgCurrency = 'GBP' | 'AUD' | 'INR';

export interface OrgSource {
  /** The key in ORG_RULE_SOURCES. */
  id: string;
  country: OrgCountry;
  /** What the page says that the rule rests on, in the page's own terms (short quotes in double quotes). */
  claim: string;
  authority:
    | 'HMRC'
    | 'Charity Commission'
    | 'OSCR'
    | 'CCNI'
    | 'ATO'
    | 'ACNC'
    | 'Income Tax Department (India)'
    | 'CBIC (India)'
    | 'Supreme Court of India';
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
const inr = (authority: OrgSource['authority'], sourceUrl: string, pageLastUpdated: string | null, claim: string): SourceRow => ({
  country: 'IN',
  claim,
  authority,
  sourceUrl,
  pageLastUpdated,
  readOn: R,
  reviewBy: IN_REVIEW_BY,
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

const ITD = 'Income Tax Department (India)';
const IN_SOURCES = {
  inAct2025InForce: inr(
    ITD,
    U.inAct2025Commencement,
    null,
    'Income-tax Act, 2025 (Act No. 30 of 2025), section 1: "Save as otherwise provided in this Act, it shall come into force on the 1st ' +
      'April, 2026."',
  ),
  inRegistration: inr(
    ITD,
    U.inS332Registration,
    null,
    'Section 332: "a public trust", "a society registered under the Societies Registration Act, 1860 ... or under any law in force in ' +
      'India" and "a company registered under section 8 of the Companies Act, 2013" may apply to the Principal Commissioner or ' +
      'Commissioner for registration "as a registered non-profit organisation", if constituted in India for charitable purposes or ' +
      'public religious purposes with property held under an irrevocable trust. Registration: 3 tax years (provisional, activities not ' +
      'begun) or 5 tax years; 10 where total income was at most five crore rupees in each of the two preceding tax years.',
  ),
  inOldRegistrationsCount: inr(
    ITD,
    U.inS355Interpretation,
    null,
    'Section 355: "registration" includes approval under section 10(23C) or 12AB(1) of the Income-tax Act, 1961 and under section 332, ' +
      'but not approval under section 80G(5) or section 354; "registered non-profit organisation" means any person having a valid ' +
      'registration under any specified provision that has not been cancelled; "donation" means any voluntary contribution it receives.',
  ),
  inTaxOnIncome: inr(
    ITD,
    U.inS334TaxOnIncome,
    null,
    'Section 334: a registered non-profit organisation pays tax "at the rate of 30% on specified income" and at the applicable rate ' +
      'on taxable regular income and any residual income.',
  ),
  inRegularIncome: inr(
    ITD,
    U.inS335RegularIncome,
    null,
    'Section 335: regular income is income from the charitable or religious activity it is registered for, income from property, ' +
      'deposits or investments held for those purposes, "voluntary contributions", and gains of permitted commercial activity.',
  ),
  inEightyFivePercent: inr(
    ITD,
    U.inS336TaxableRegularIncome,
    null,
    'Section 336: taxable regular income is "nil, where 85% or more of the regular income of such tax year has been applied as per ' +
      'provisions of section 341 or accumulated under section 342"; otherwise 85% of regular income less what was applied or accumulated.',
  ),
  inApplication: inr(
    ITD,
    U.inS341Application,
    null,
    'Section 341: application of income is a sum applied for the registered charitable or religious purpose in India and "paid during ' +
      'the tax year", and "85% of the sum paid by way of donation made to any other registered non-profit organisation"; a corpus ' +
      'donation to another one does not count; a shortfall below 85% may be treated as deemed application if applied the next year.',
  ),
  inAccumulation: inr(
    ITD,
    U.inS342Accumulation,
    null,
    'Section 342: part of regular income may be accumulated or set apart by a statement to the Assessing Officer by the return due ' +
      'date, for a stated purpose and a period "not exceeding five years", invested in the permitted modes.',
  ),
  inCommercialActivity: inr(
    ITD,
    U.inS345CommercialActivity,
    null,
    'Section 345: a registered non-profit organisation "shall not carry out any commercial activity" unless it is incidental to its ' +
      'objectives and "separate books of account are maintained for such activities".',
  ),
  inBooks: inr(
    ITD,
    U.inS347Books,
    null,
    'Section 347: where total income, before this Part, exceeds "the maximum amount which is not chargeable to income-tax", the ' +
      'registered non-profit organisation keeps books of account and other documents in the prescribed form, manner and place.',
  ),
  inAudit: inr(
    ITD,
    U.inS348Audit,
    null,
    'Section 348: above the same limit, the accounts "shall be audited by an accountant" and the audit report furnished in the ' +
      'prescribed form by the prescribed date.',
  ),
  inReturn: inr(
    ITD,
    U.inS349Return,
    null,
    'Section 349: above the same limit, it furnishes a return of income under section 263(1)(a)(iii) within the time allowed by ' +
      'section 263(1)(c) or 263(4).',
  ),
  inForm112: inr(
    ITD,
    U.inForm112Faqs,
    '2026-03-20',
    'Form 112 FAQ: Form No. 112 is the audit report under section 348 (Form 10B and 10BB under the 1961 rules; rule 186 of the ' +
      'Income-tax Rules, 2026), filed online "one month prior to the due date of furnishing the return of income under section ' +
      '263(1)". A "small registered NPO" has regular income not exceeding ₹5 crores, has not received foreign contribution exceeding ' +
      '₹10 lakhs and has not applied income exceeding ₹10 lakhs outside India in the tax year; foreign contribution as defined in ' +
      'section 2(1)(h) of the Foreign Contribution (Regulation) Act, 2010.',
  ),
  inItr7: inr(
    ITD,
    U.inIncomeTaxReturns,
    '2026-09-16',
    'Income Tax Returns (year 2026): "ITR-7 For persons including companies required to furnish return under sections 139(4A) or ' +
      '139(4B) or 139(4C) or 139(4D) only" — the 1961 Act return for years before tax year 2026-27.',
  ),
  inDonorDeduction: inr(
    ITD,
    U.inS133DonorDeduction,
    null,
    'Section 133(1)(b)(ii): a donor deducts "50% of the aggregate of the sums paid as donation" to a fund or institution established ' +
      'in India for a charitable purpose that is a registered non-profit organisation "approved under section 354". Qualifying sums ' +
      'over 10% of adjusted gross total income are ignored; only "a sum of money"; over Rs. 2000 only if not paid in cash.',
  ),
  inDonorApproval: inr(
    ITD,
    U.inS354DonorApproval,
    null,
    'Section 354: a registered non-profit organisation applies for approval for section 133(1)(b)(ii) if it is not for a particular ' +
      'religious community or caste, spends at most 5% of total income on religious purposes, "maintains regular accounts of its ' +
      'receipts and expenditure", delivers a prescribed statement to the income-tax authority and "furnishes a ' +
      'certificate to the donor specifying the amount of donation".',
  ),
  inCompanyAccruals: inr(
    ITD,
    U.inCompaniesActS128,
    null,
    'Companies Act, 2013, section 128(1): every company keeps books of account and financial statements giving a true and fair view, ' +
      'and "such books shall be kept on accrual basis and according to the double entry system of accounting".',
  ),
  inGstRegistration: inr(
    'CBIC (India)',
    U.inCgstS22Registration,
    null,
    'CGST Act, 2017, section 22(1): a supplier registers "if his aggregate turnover in a financial year exceeds twenty lakh rupees"; ' +
      'from a special category State (Arunachal Pradesh, Assam, Himachal Pradesh, Meghalaya, Sikkim, Uttarakhand), "ten lakh rupees", ' +
      'which the Government may raise up to twenty lakh; up to forty lakh for a supplier of goods only.',
  ),
  inGstRwa: inr(
    'CBIC (India)',
    U.inGstRwaCircular,
    '2019-07-22',
    'Circular No. 109/28/2019-GST: an RWA\'s supply to its own members "up to an amount of Rs. 7500 per month per member" for common ' +
      'use is exempt; "If aggregate turnover of an RWA does not exceed Rs.20 Lakh in a financial year, it shall not be required to take ' +
      'registration and pay GST" even above Rs. 7500 a member.',
  ),
  inClubMutuality: inr(
    'Supreme Court of India',
    U.inScSecunderabadClub,
    '2023-08-17',
    'Secundrabad Club v. C.I.T.-V (2023 INSC 736), decided under the Income-tax Act, 1961: interest earned by clubs on fixed deposits ' +
      '"has to be treated like any other income from other sources"; income earned "from persons who are not members of the Clubs" is ' +
      '"not covered under the principle of mutuality"; no liability on profits from members using members\' facilities.',
  ),
} satisfies Record<string, SourceRow>;

export type GbOrgSourceKey = keyof typeof GB_SOURCES;
export type AuOrgSourceKey = keyof typeof AU_SOURCES;
export type InOrgSourceKey = keyof typeof IN_SOURCES;
export type OrgSourceKey = GbOrgSourceKey | AuOrgSourceKey | InOrgSourceKey;

const withIds = <K extends string>(rows: Record<K, SourceRow>): Record<K, OrgSource> =>
  Object.fromEntries(Object.entries<SourceRow>(rows).map(([id, r]) => [id, { id, ...r }])) as Record<K, OrgSource>;

/** Every rule source, by key. Keys do not overlap between countries. */
export const ORG_RULE_SOURCES: Record<OrgSourceKey, OrgSource> = { ...withIds(GB_SOURCES), ...withIds(AU_SOURCES), ...withIds(IN_SOURCES) };

// ─── Figures ────────────────────────────────────────────────────────────────

/**
 * How a figure is compared with the organisation's own number: 'over' (more than), 'at_least', 'or_less', 'under'
 * (less than), or 'is' for a rate, a count or a number of years.
 */
export type OrgFigureTest = 'over' | 'at_least' | 'or_less' | 'under' | 'is';

export interface OrgFigure extends SourcedFigure {
  /** 'GB.cc.receiptsAndPaymentsUpTo', 'AU.acnc.smallUnder', … */
  id: string;
  country: OrgCountry;
  label: string;
  /** The country's currency, or null for a rate, a share, a count or a number of years. */
  currency: OrgCurrency | null;
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
const IN_NPOS = ['IN_PUBLIC_TRUST', 'IN_SOCIETY', 'IN_SECTION8_COMPANY'];
const IN_ALL = [...IN_NPOS, 'IN_CLUB'];

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
  // ─── IN — Income-tax Act, 2025 (tax year 2026-27 onwards) ───
  fig({ id: 'IN.ita.applicationShareAtLeast', country: 'IN', label: 'Regular income applied or accumulated for taxable regular income to be nil: at least', value: 0.85, taxYear: 'tax years from 2026-27 (Income-tax Act, 2025)', currency: null, test: 'at_least', regulator: ITD, appliesTo: IN_NPOS, yearsEndingFrom: null, yearsEndingBefore: null, source: 'inEightyFivePercent', note: 'Taxable regular income is nil where 85% or more of regular income is applied (section 341) or accumulated (section 342) in the tax year; otherwise 85% of regular income less what was applied or accumulated is taxed.' }),
  fig({ id: 'IN.ita.specifiedIncomeRate', country: 'IN', label: 'Tax rate on specified income of a registered non-profit organisation', value: 0.3, taxYear: 'tax years from 2026-27 (Income-tax Act, 2025)', currency: null, test: 'is', regulator: ITD, appliesTo: IN_NPOS, yearsEndingFrom: null, yearsEndingBefore: null, source: 'inTaxOnIncome', note: 'Section 334: 30% on specified income (section 337); taxable regular income and residual income at the rates that otherwise apply.' }),
  fig({ id: 'IN.ita.accumulationMaxYears', country: 'IN', label: 'Accumulated or set-apart income: period up to (years)', value: 5, taxYear: 'tax years from 2026-27 (Income-tax Act, 2025)', currency: null, test: 'or_less', regulator: ITD, appliesTo: IN_NPOS, yearsEndingFrom: null, yearsEndingBefore: null, source: 'inAccumulation', note: 'Regular income may be accumulated for a stated purpose for up to five years, by a statement filed by the return due date, and invested in the permitted modes.' }),
  fig({ id: 'IN.ita.donorDeductionShare', country: 'IN', label: 'Donor deduction for a donation to an approved organisation: share of the donation', value: 0.5, taxYear: 'tax years from 2026-27 (Income-tax Act, 2025)', currency: null, test: 'is', regulator: ITD, appliesTo: IN_NPOS, yearsEndingFrom: null, yearsEndingBefore: null, source: 'inDonorDeduction', note: 'Information only: a donor deducts 50% of donations to an organisation approved under section 354 (section 133(1)(b)(ii)), within the 10% limit below.' }),
  fig({ id: 'IN.ita.donorDeductionIncomeCap', country: 'IN', label: 'Donor deduction: qualifying donations counted up to this share of adjusted gross total income', value: 0.1, taxYear: 'tax years from 2026-27 (Income-tax Act, 2025)', currency: null, test: 'or_less', regulator: ITD, appliesTo: IN_NPOS, yearsEndingFrom: null, yearsEndingBefore: null, source: 'inDonorDeduction', note: 'Section 133(2): qualifying donations over 10% of the donor\'s adjusted gross total income are ignored.' }),
  fig({ id: 'IN.ita.donationCashUpTo', country: 'IN', label: 'Donor deduction: a cash donation qualifies only up to', value: 2000, taxYear: 'tax years from 2026-27 (Income-tax Act, 2025)', currency: 'INR', test: 'or_less', regulator: ITD, appliesTo: IN_NPOS, yearsEndingFrom: null, yearsEndingBefore: null, source: 'inDonorDeduction', note: 'Section 133(5): a deduction for a donation over Rs. 2000 is allowed only if it is paid other than in cash. Donations in kind never qualify.' }),
  fig({ id: 'IN.ita.smallNpoRegularIncomeUpTo', country: 'IN', label: 'Form 112 small registered NPO: regular income up to', value: 50000000, taxYear: 'tax years from 2026-27 (Income-tax Rules, 2026)', currency: 'INR', test: 'or_less', regulator: ITD, appliesTo: IN_NPOS, yearsEndingFrom: null, yearsEndingBefore: null, source: 'inForm112', note: 'A small registered NPO (regular income not over ₹5 crore, foreign contribution not over ₹10 lakh, income applied outside India not over ₹10 lakh) fills fewer schedules of Form 112.' }),
  fig({ id: 'IN.ita.smallNpoForeignContributionUpTo', country: 'IN', label: 'Form 112 small registered NPO: foreign contribution received up to', value: 1000000, taxYear: 'tax years from 2026-27 (Income-tax Rules, 2026)', currency: 'INR', test: 'or_less', regulator: ITD, appliesTo: IN_NPOS, yearsEndingFrom: null, yearsEndingBefore: null, source: 'inForm112', note: 'Foreign contribution as the Foreign Contribution (Regulation) Act, 2010 defines it (section 2(1)(h)).' }),
  // ─── IN — GST (CBIC) ───
  fig({ id: 'IN.gst.registrationOver', country: 'IN', label: 'GST registration: aggregate turnover in a financial year over', value: 2000000, taxYear: 'current', currency: 'INR', test: 'over', regulator: 'CBIC (India)', appliesTo: IN_ALL, yearsEndingFrom: null, yearsEndingBefore: null, source: 'inGstRegistration', note: 'Twenty lakh rupees (CGST Act section 22(1)), for a supplier of services. A State may have it raised to forty lakh for a supplier of goods only.' }),
  fig({ id: 'IN.gst.registrationSpecialCategoryOver', country: 'IN', label: 'GST registration from a special category State: aggregate turnover over', value: 1000000, taxYear: 'current', currency: 'INR', test: 'over', regulator: 'CBIC (India)', appliesTo: IN_ALL, yearsEndingFrom: null, yearsEndingBefore: null, source: 'inGstRegistration', note: 'Ten lakh rupees for supplies from Arunachal Pradesh, Assam, Himachal Pradesh, Meghalaya, Sikkim or Uttarakhand; the Government may raise it to up to twenty lakh on the State\'s request.' }),
  fig({ id: 'IN.gst.rwaMemberContributionExemptUpTo', country: 'IN', label: 'RWA: member contribution exempt from GST up to (per member, per month)', value: 7500, taxYear: 'from 25 January 2018 (Circular 109/28/2019-GST)', currency: 'INR', test: 'or_less', regulator: 'CBIC (India)', appliesTo: ['IN_SOCIETY', 'IN_CLUB'], yearsEndingFrom: null, yearsEndingBefore: null, source: 'inGstRwa', note: 'A resident welfare association\'s charges to its own members for common use are exempt up to Rs. 7,500 a member a month; with aggregate turnover of Rs. 20 lakh or less it need not register at all.' }),
];
