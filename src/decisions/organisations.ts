/**
 * Organisations — clubs, PTAs, charities — as data — ai2fin.com
 *
 * The app asks "what applies to this kind of organisation in this country?"
 * and turns exports, reports and tax behaviour on from the answer:
 *
 *   orgTypesFor(country)         the org types to offer at sign-up
 *   orgRulesFor(country, code)   income tax status, donation relief, reports,
 *                                whether to forecast income tax, which
 *                                accounts are allowed, who regulates it, and
 *                                the sources every statement rests on
 *   orgReportingThresholds(…)    the dated figures (registration, accounts,
 *                                examination, audit, VAT/GST, Gift Aid limits)
 *
 * Every statement cites a row in ./organisationSources (page, read date,
 * review date). The rules are deliberately coarse — a status and a note, not
 * a computation — because the deciding facts (how the money is spent, who the
 * club trades with, which Division 50 category an association fits) are
 * facts the app does not hold. Where the answer genuinely depends on them the
 * status says so ('exempt_if_conditions', 'check_locally') rather than
 * guessing.
 *
 * `reports` vocabulary (the strings the app switches on):
 *   'receipts_payments'  every org type — a working report even where the
 *                        statutory accounts must be accruals (see `accounts`)
 *   'gift_aid_schedule'  GB charities, CIOs, charitable companies and CASCs
 *   'vat'                every GB type (any of them may be VAT registered)
 *   'gst_bas'            every AU type (any of them may be GST registered)
 * No income-tax-return export is listed for any org type.
 *
 * `incomeTaxForecast` is true only where a forecast on the books' surplus
 * would be the right figure: 'taxable'. It is false for 'mutuality' (GB clubs
 * and PTAs), where only non-member and investment income is taxed and the
 * books cannot tell member money from visitor money, so a forecast on the
 * whole surplus would overstate the tax; the note explains the rule instead.
 * It is false for 'exempt' and 'exempt_if_conditions', and for
 * 'check_locally', where the org itself must first establish whether it is
 * exempt. 2fin
 */

import { toYmd } from '../data/rateLedger';
import { parseYmd } from './dates';
import {
  ORG_FIGURES,
  ORG_RULE_SOURCES,
  ORG_URLS,
  type OrgFigure,
  type OrgSource,
  type OrgSourceKey,
} from './organisationSources';

// ─── Shapes ─────────────────────────────────────────────────────────────────

export type OrgKind = 'club' | 'pta' | 'charity' | 'community' | 'association';

export interface OrgType {
  code: string;
  label: string;
  country: string;
  kind: OrgKind;
  /** Who the organisation registers with, in plain words ('Not registered', 'HMRC', 'ACNC', …). */
  registeredWith: string;
  /** Always 'organisation', so the app can group these apart from people and businesses at sign-up. */
  group: 'organisation';
}

export type OrgIncomeTaxStatus = 'exempt' | 'exempt_if_conditions' | 'mutuality' | 'taxable' | 'check_locally';

export type OrgReport = 'receipts_payments' | 'gift_aid_schedule' | 'vat' | 'gst_bas';

/** The report vocabulary, in the order the app lists reports. */
export const ORG_REPORTS: readonly OrgReport[] = ['receipts_payments', 'gift_aid_schedule', 'vat', 'gst_bas'];

export interface OrgDonationRelief {
  /** 'gift_aid': the org claims tax back on donations (GB). 'dgr': donors deduct gifts (AU) — information only, nothing to claim. */
  scheme: 'gift_aid' | 'dgr';
  /** What the org is repaid per £1 donated (Gift Aid: 0.25). */
  ratePerPound?: number;
  /** Whether each donor must give a declaration before the org can claim. */
  declarationRequired: boolean;
  /** Years after the end of the financial period in which a claim must be made. */
  claimWindowYears?: number;
  note: string;
}

export interface OrgAccounts {
  /** Whether receipts and payments (cash) accounts are an allowed statutory format for this org type. */
  receiptsAndPaymentsAllowed: boolean;
  /** Gross income up to which (inclusive) they are allowed, where a regulator sets one. In `currency`. */
  upToGrossIncome?: number;
  currency?: 'GBP' | 'AUD';
  /** The ORG_FIGURES id the limit comes from, where there is one. */
  thresholdId?: string;
  note: string;
}

export interface OrgRegulator {
  name: string;
  /** Where, or for what, it is the regulator. */
  covers: string;
  url: string;
  note: string;
}

export interface OrgRules {
  country: string;
  code: string;
  incomeTax: { status: OrgIncomeTaxStatus; note: string };
  donationRelief: OrgDonationRelief | null;
  reports: OrgReport[];
  incomeTaxForecast: boolean;
  accounts: OrgAccounts;
  /** Regulators and registers that apply; empty where none is modelled. */
  regulators: OrgRegulator[];
  /** Every source the statements above rest on, with its read and review dates. Empty for the generic types. */
  sources: OrgSource[];
}

// ─── Org types ──────────────────────────────────────────────────────────────

const t = (code: string, label: string, country: string, kind: OrgKind, registeredWith: string): OrgType => ({
  code,
  label,
  country,
  kind,
  registeredWith,
  group: 'organisation',
});

const GB_TYPES: OrgType[] = [
  t('GB_CLUB', 'Club or society', 'GB', 'club', 'Not registered'),
  t('GB_PTA', "PTA or parents' association", 'GB', 'pta', 'Not registered'),
  t('GB_CASC', 'Community amateur sports club', 'GB', 'club', 'HMRC'),
  t('GB_CHARITY', 'Registered charity', 'GB', 'charity', 'Charity Commission, OSCR or CCNI'),
  t('GB_CIO', 'Charitable incorporated organisation', 'GB', 'charity', 'Charity Commission'),
  t('GB_CHARITABLE_COMPANY', 'Charitable company', 'GB', 'charity', 'Companies House and the Charity Commission'),
];

const AU_TYPES: OrgType[] = [
  t('AU_INCORPORATED_ASSOCIATION', 'Incorporated association', 'AU', 'association', 'The state or territory regulator it is incorporated with'),
  t('AU_ACNC_CHARITY', 'Registered charity (ACNC)', 'AU', 'charity', 'ACNC'),
  t('AU_CLUB', 'Club or community group', 'AU', 'community', 'Not registered'),
];

const GENERIC_CODES = ['CLUB', 'CHARITY'] as const;
const genericTypes = (country: string): OrgType[] => [
  t('CLUB', 'Club or community group', country, 'community', 'Check locally'),
  t('CHARITY', 'Charity or nonprofit', country, 'charity', 'Check locally'),
];

/** 'UK' is accepted for GB, as elsewhere in the package. */
const ALIASES: Record<string, string> = { UK: 'GB' };

/** Upper-cased ISO alpha-2 with the UK alias resolved, or null for anything that is not two letters. */
function countryOf(country: string): string | null {
  const c = String(country ?? '').trim().toUpperCase();
  const code = ALIASES[c] ?? c;
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/**
 * The organisation types to offer in a country. GB (or 'UK') and AU have their own; any other country gets the
 * generic CLUB and CHARITY, whose rules say to check locally. Not a two-letter code: an empty list. Returns copies.
 */
export function orgTypesFor(country: string): OrgType[] {
  const c = countryOf(country);
  if (!c) return [];
  const list = c === 'GB' ? GB_TYPES : c === 'AU' ? AU_TYPES : genericTypes(c);
  return list.map((x) => ({ ...x }));
}

// ─── Rules ──────────────────────────────────────────────────────────────────

const src = (...keys: OrgSourceKey[]): OrgSource[] => keys.map((k) => ({ ...ORG_RULE_SOURCES[k] }));

const REGULATORS = {
  hmrcCharities: {
    name: 'HMRC',
    covers: 'Tax: recognition for tax relief and Gift Aid',
    url: ORG_URLS.charitiesRecognition,
    note: 'A charity must be recognised by HMRC to get tax relief and claim Gift Aid — registering with a charity regulator is not enough.',
  },
  charityCommission: {
    name: 'Charity Commission',
    covers: 'Charities based in England and Wales',
    url: ORG_URLS.charityCommission,
    note: 'Registration at £5,000 income (CIOs always); the accounts, examination and audit thresholds in orgReportingThresholds are the Commission\'s.',
  },
  oscr: {
    name: 'OSCR (Office of the Scottish Charity Regulator)',
    covers: 'Charities based in Scotland',
    url: 'https://www.oscr.org.uk',
    note: 'Different rules: receipts and payments accounts only while gross income is under £250,000 (not the Commission\'s £500,000); independent examination is available under £500,000.',
  },
  ccni: {
    name: 'CCNI (Charity Commission for Northern Ireland)',
    covers: 'Charities based in Northern Ireland',
    url: 'https://www.charitycommissionni.org.uk',
    note: 'Different rules: receipts and payments accounts at £250,000 or less for a charity that is not a company (not the Commission\'s £500,000).',
  },
  companiesHouse: {
    name: 'Companies House',
    covers: 'Charitable companies (limited by guarantee)',
    url: ORG_URLS.ccCharitableCompanies,
    note: 'A charitable company files accounts with Companies House every year as well as with the charity regulator.',
  },
  hmrcCasc: {
    name: 'HMRC',
    covers: 'Registered community amateur sports clubs',
    url: ORG_URLS.registerCasc,
    note: 'A CASC registers with HMRC; it is not regulated by the Charity Commission and cannot also be recognised as a charity for tax.',
  },
  acnc: {
    name: 'ACNC (Australian Charities and Not-for-profits Commission)',
    covers: 'Registered charities in Australia',
    url: ORG_URLS.acnc,
    note: 'Annual Information Statement every year; a financial report for medium and large charities (see orgReportingThresholds).',
  },
  atoEndorsement: {
    name: 'ATO',
    covers: 'Charity tax concessions and DGR endorsement',
    url: ORG_URLS.atoEndorsement,
    note: 'Income tax exemption needs ATO endorsement as well as ACNC registration; DGR status is a separate endorsement.',
  },
  stateRegulator: {
    name: 'State or territory regulator',
    covers: 'Incorporated associations, under the Associations Incorporation law where incorporated',
    url: ORG_URLS.acncIncorporatedAssociations,
    note: 'May require annual reports or financial records; the requirements differ by state and territory.',
  },
} satisfies Record<string, OrgRegulator>;

const reg = (...keys: Array<keyof typeof REGULATORS>): OrgRegulator[] => keys.map((k) => ({ ...REGULATORS[k] }));

/** The figure in force for a financial year ending on `yearEnd` (YYYY-MM-DD), or the only row of an undated figure. */
function figureFor(id: string, yearEnd = '9999-12-31'): OrgFigure {
  const f = ORG_FIGURES.find((x) => x.id === id && inYear(x, yearEnd));
  if (!f) throw new Error(`organisations: no figure ${id} for a year ending ${yearEnd}`);
  return f;
}

function inYear(f: OrgFigure, yearEnd: string): boolean {
  return (f.yearsEndingFrom === null || yearEnd >= f.yearsEndingFrom) && (f.yearsEndingBefore === null || yearEnd < f.yearsEndingBefore);
}

function giftAid(note: string): OrgDonationRelief {
  return {
    scheme: 'gift_aid',
    ratePerPound: figureFor('GB.hmrc.giftAidRatePerPound').value,
    declarationRequired: true,
    claimWindowYears: figureFor('GB.hmrc.giftAidClaimWindowYears').value,
    note,
  };
}

const GIFT_AID_NOTE =
  'Claim 25p per £1 an individual donates, once recognised by HMRC, with a Gift Aid declaration from the donor (kept for 6 years ' +
  'after the latest donation claimed). Claim within 4 years of the end of the financial period the donation was received in — the ' +
  'tax year for a trust, the accounting period for a CIO, a limited company or a CASC. Small donations scheme (GASDS): cash and ' +
  'contactless donations of £30 or less with no declaration, up to £2,000 a tax year (on £8,000 of donations), no more than 10 ' +
  'times the Gift Aid claim, claimed within 2 years of the end of the tax year.';

const CHARITY_TAX_NOTE =
  'Charities do not pay tax on most income and gains (donations, trading profits, rent and investment income, gains) as long as ' +
  'they use them for charitable purposes and are recognised by HMRC. Tax is due on profits from developing land or property and on ' +
  'money not used for charitable purposes; a tax return is needed only when there is tax to pay or HMRC asks.';

function gbRules(code: string, yearEnd: string): OrgRules | null {
  const rp = figureFor('GB.cc.receiptsAndPaymentsUpTo', yearEnd);
  const rpNote =
    `The Charity Commission allows receipts and payments accounts at gross income of £${rp.value.toLocaleString('en-GB')} or less ` +
    `(${rp.taxYear}). Scotland (OSCR): under £250,000; Northern Ireland (CCNI): £250,000 or less.`;
  const base = { country: 'GB', code };
  switch (code) {
    case 'GB_CLUB':
      return {
        ...base,
        incomeTax: {
          status: 'mutuality',
          note:
            'An unincorporated club pays Corporation Tax on profits from trading with non-members (visitors, the public), on ' +
            'investment income such as bank interest, and on gains. A surplus from dealings with its own full members is not taxed. ' +
            'Register for Corporation Tax within 3 months of starting to trade or receive other income; a club owing less than £100 ' +
            'Corporation Tax is usually treated as dormant. Keep member and non-member income apart.',
        },
        donationRelief: null,
        reports: ['receipts_payments', 'vat'],
        incomeTaxForecast: false,
        accounts: { receiptsAndPaymentsAllowed: true, note: 'No statutory accounts format for an unincorporated club: its own rules decide. Receipts and payments accounts are the usual choice.' },
        regulators: [],
        sources: src('clubsCorporationTax', 'membersClubSurplus', 'registerUnincorporatedAssociation', 'dormantForCorporationTax', 'vatRegistration'),
      };
    case 'GB_PTA':
      return {
        ...base,
        incomeTax: {
          status: 'mutuality',
          note:
            'A PTA that is not a registered charity is an unincorporated association: Corporation Tax applies to profits from ' +
            'trading with non-members (a fair or sale open to the public) and to investment income; money from its own members is ' +
            'not taxed. If the PTA is a registered charity, choose "Registered charity" instead — it then gets the charity reliefs ' +
            'and can claim Gift Aid. A PTA with charitable purposes based in England or Wales must register once its income reaches ' +
            '£5,000 a year.',
        },
        donationRelief: null,
        reports: ['receipts_payments', 'vat'],
        incomeTaxForecast: false,
        accounts: { receiptsAndPaymentsAllowed: true, note: 'No statutory accounts format while the PTA is not a charity: its own rules decide.' },
        regulators: [],
        sources: src('clubsCorporationTax', 'membersClubSurplus', 'registerUnincorporatedAssociation', 'dormantForCorporationTax', 'charityRegistration', 'vatRegistration'),
      };
    case 'GB_CASC':
      return {
        ...base,
        incomeTax: {
          status: 'exempt_if_conditions',
          note:
            'A registered CASC pays no Corporation Tax on trading profits while its turnover from trading (supplies to non-members) ' +
            'is £50,000 or less, or on rental income up to £30,000 a year, if applied for qualifying purposes. Over £50,000 the whole ' +
            'trading profit is taxable (no marginal relief). Gift Aid and interest are exempt without limit; gains are exempt if ' +
            'applied for qualifying purposes and claimed. Membership subscriptions are not trading income.',
        },
        donationRelief: giftAid(`${GIFT_AID_NOTE} A CASC cannot claim Gift Aid on membership fees, or on donations made before it was registered.`),
        reports: ['receipts_payments', 'gift_aid_schedule', 'vat'],
        incomeTaxForecast: false,
        accounts: {
          receiptsAndPaymentsAllowed: true,
          note: 'A CASC is not under the Charity Commission accounts regime. An unincorporated CASC\'s own rules decide its accounts; a CASC that is a company prepares Companies Act accruals accounts.',
        },
        regulators: reg('hmrcCasc'),
        sources: src('cascReliefs', 'cascCorporationTax', 'giftAidRate', 'giftAidNotOn', 'giftAidDeclarations', 'giftAidClaimDeadline', 'giftAidSmallDonations', 'giftAidScheduleGuidance', 'giftAidScheduleColumns', 'vatRegistration'),
      };
    case 'GB_CHARITY':
    case 'GB_CIO':
      return {
        ...base,
        incomeTax: { status: 'exempt_if_conditions', note: CHARITY_TAX_NOTE },
        donationRelief: giftAid(GIFT_AID_NOTE),
        reports: ['receipts_payments', 'gift_aid_schedule', 'vat'],
        incomeTaxForecast: false,
        accounts: {
          receiptsAndPaymentsAllowed: true,
          upToGrossIncome: rp.value,
          currency: 'GBP',
          thresholdId: rp.id,
          note:
            `${rpNote} Above the limit, or if the governing document says so, accruals accounts under the Charities SORP. ` +
            'A charity that is a company always prepares accruals accounts: choose "Charitable company".',
        },
        regulators:
          code === 'GB_CIO'
            ? reg('charityCommission', 'hmrcCharities')
            : reg('charityCommission', 'oscr', 'ccni', 'hmrcCharities'),
        sources: src(
          'charitiesTaxReliefs',
          'charitiesRecognition',
          'charitiesPayTax',
          'charityRegistration',
          ...(code === 'GB_CIO' ? (['charityStructures', 'ccCios'] as OrgSourceKey[]) : (['oscrReceiptsPayments', 'ccniReceiptsPayments'] as OrgSourceKey[])),
          'ccThresholds',
          'giftAidRate',
          'giftAidNotOn',
          'giftAidDeclarations',
          'giftAidClaimDeadline',
          'giftAidSmallDonations',
          'giftAidScheduleGuidance',
          'giftAidScheduleColumns',
          'vatRegistration',
        ),
      };
    case 'GB_CHARITABLE_COMPANY':
      return {
        ...base,
        incomeTax: { status: 'exempt_if_conditions', note: `${CHARITY_TAX_NOTE} A charitable company's return is a Company Tax Return with the charities supplementary pages.` },
        donationRelief: giftAid(GIFT_AID_NOTE),
        reports: ['receipts_payments', 'gift_aid_schedule', 'vat'],
        incomeTaxForecast: false,
        accounts: {
          receiptsAndPaymentsAllowed: false,
          note:
            'A charitable company must prepare accruals accounts under the Companies Act whatever its size, and file them with ' +
            'Companies House as well as the charity regulator — receipts and payments accounts are not an allowed statutory format. ' +
            'The receipts and payments report is a working record: the independent examiner or accountant prepares the accruals ' +
            'accounts from its figures.',
        },
        regulators: reg('charityCommission', 'companiesHouse', 'hmrcCharities'),
        sources: src(
          'charitiesTaxReliefs',
          'charitiesRecognition',
          'charitiesPayTax',
          'charityStructures',
          'ccCharitableCompanies',
          'ccThresholds',
          'giftAidRate',
          'giftAidNotOn',
          'giftAidDeclarations',
          'giftAidClaimDeadline',
          'giftAidSmallDonations',
          'giftAidScheduleGuidance',
          'giftAidScheduleColumns',
          'vatRegistration',
        ),
      };
    default:
      return null;
  }
}

const AU_SELF_ASSESS_NOTE =
  'A not-for-profit that is not a charity is either exempt or taxable. It may self-assess as exempt if it fits one of the 8 ' +
  'categories in Division 50 ITAA 1997 (community service, cultural, educational, health, employment, resource development, ' +
  'scientific or sporting — "established for the encouragement of a game, sport or animal racing") and meets their conditions; ' +
  'with an active ABN it then lodges an NFP self-review return every year. Otherwise it is taxable, treated as a company: dealings ' +
  'with members are not assessable under the mutuality principle, but non-member trading and outside income such as bank interest ' +
  'are. The ATO\'s examples of taxable NFPs include social clubs and clubs whose main purpose is hospitality for members.';

function auRules(code: string): OrgRules | null {
  const base = { country: 'AU', code };
  switch (code) {
    case 'AU_ACNC_CHARITY':
      return {
        ...base,
        incomeTax: {
          status: 'exempt_if_conditions',
          note:
            'A charity is income tax exempt only when it is registered with the ACNC AND endorsed by the ATO for charity tax ' +
            'concessions. A charity that is not registered and endorsed is taxable.',
        },
        donationRelief: {
          scheme: 'dgr',
          declarationRequired: false,
          note:
            'Information only: donors can deduct gifts only if the charity is endorsed as a deductible gift recipient (DGR). DGR ' +
            'endorsement is separate from charity tax concession endorsement — being endorsed for one does not give the other.',
        },
        reports: ['receipts_payments', 'gst_bas'],
        incomeTaxForecast: false,
        accounts: {
          receiptsAndPaymentsAllowed: true,
          currency: 'AUD',
          thresholdId: 'AU.acnc.smallUnder',
          note:
            'A small charity (annual revenue under $500,000) can use cash or accrual accounting and needs only the Annual Information ' +
            'Statement. Medium and large charities use accrual accounting and also submit a financial report (reviewed or audited ' +
            'for medium, audited for large).',
        },
        regulators: reg('acnc', 'atoEndorsement'),
        sources: src('charityExemptIfEndorsed', 'endorsementTypes', 'dgrGifts', 'acncCharitySize', 'acncReportingAnnually', 'gstNfp'),
      };
    case 'AU_INCORPORATED_ASSOCIATION':
      return {
        ...base,
        incomeTax: {
          status: 'check_locally',
          note: `${AU_SELF_ASSESS_NOTE} An association whose purposes are only charitable must register with the ACNC and be endorsed to be exempt — choose "Registered charity (ACNC)" instead.`,
        },
        donationRelief: null,
        reports: ['receipts_payments', 'gst_bas'],
        incomeTaxForecast: false,
        accounts: {
          receiptsAndPaymentsAllowed: true,
          note: 'Set by the state or territory where it is incorporated (and its rules); not modelled here.',
        },
        regulators: reg('stateRegulator'),
        sources: src('incorporatedAssociations', 'selfAssessing', 'exemptCategories', 'taxableNfps', 'mutuality', 'charityExemptIfEndorsed', 'gstNfp'),
      };
    case 'AU_CLUB':
      return {
        ...base,
        incomeTax: { status: 'check_locally', note: AU_SELF_ASSESS_NOTE },
        donationRelief: null,
        reports: ['receipts_payments', 'gst_bas'],
        incomeTaxForecast: false,
        accounts: { receiptsAndPaymentsAllowed: true, note: 'No statutory accounts format for an unincorporated club or group: its own rules decide.' },
        regulators: [],
        sources: src('selfAssessing', 'exemptCategories', 'taxableNfps', 'mutuality', 'gstNfp'),
      };
    default:
      return null;
  }
}

function genericRules(country: string, code: string): OrgRules | null {
  if (!(GENERIC_CODES as readonly string[]).includes(code)) return null;
  return {
    country,
    code,
    incomeTax: {
      status: 'check_locally',
      note: `Organisation rules for ${country} are not modelled: whether a ${code === 'CLUB' ? 'club or community group' : 'charity or nonprofit'} pays income tax, and on what, depends on local law. Check with the tax authority or an accountant.`,
    },
    donationRelief: null,
    reports: ['receipts_payments'],
    incomeTaxForecast: false,
    accounts: { receiptsAndPaymentsAllowed: true, note: 'Not modelled: check what the local regulator requires.' },
    regulators: [],
    sources: [],
  };
}

/**
 * What applies to an org type in a country, or null when the code is not one `orgTypesFor(country)` offers.
 * `yearEnd` (default today) is the day the financial year ends: the Charity Commission thresholds changed for years
 * ending on or after 30 September 2026, and `accounts.upToGrossIncome` follows it. Returns a copy — safe to mutate.
 */
export function orgRulesFor(country: string, code: string, yearEnd?: string | Date): OrgRules | null {
  const c = countryOf(country);
  if (!c) return null;
  const k = String(code ?? '').trim().toUpperCase();
  if (c === 'GB') return gbRules(k, yearEndOf(yearEnd));
  if (c === 'AU') return auRules(k);
  return genericRules(c, k);
}

function yearEndOf(yearEnd?: string | Date): string {
  if (yearEnd instanceof Date && Number.isNaN(yearEnd.getTime())) throw new RangeError('yearEnd: invalid Date');
  const ymd = toYmd(yearEnd ?? new Date());
  parseYmd(ymd, 'yearEnd');
  return ymd;
}

/**
 * The dated figures for a country's organisations (GB: Charity Commission, OSCR, CCNI and HMRC; AU: ACNC and ATO),
 * for a financial year ending on `yearEnd` (default today). One row per figure id; empty for other countries.
 */
export function orgReportingThresholds(country: string, yearEnd?: string | Date): OrgFigure[] {
  const c = countryOf(country);
  if (c !== 'GB' && c !== 'AU') return [];
  const ymd = yearEndOf(yearEnd);
  return ORG_FIGURES.filter((f) => f.country === c && inYear(f, ymd)).map((f) => ({ ...f, appliesTo: [...f.appliesTo] }));
}

// ─── Gift Aid schedule ──────────────────────────────────────────────────────

/**
 * The column headings of HMRC's Gift Aid donations schedule (Charities Online, sheet R68GAD_V1_00_0_EN), in order,
 * as the spreadsheet's table heads them. HMRC's table starts with "Item", the row number it pre-fills; rows the app
 * produces are pasted from Title onwards, so Item is not listed. Dates are DD/MM/YY (formatGiftAidDate); amounts
 * have two decimals and no £ sign; at most 1,000 rows per schedule.
 */
export function giftAidScheduleColumns(): string[] {
  return ['Title', 'First name', 'Last name', 'House name or number', 'Postcode', 'Aggregated donations', 'Sponsored event', 'Donation date', 'Amount'];
}

/**
 * A donation date as the schedule wants it: DD/MM/YY, no hyphens or full stops. The calendar day is read in local
 * time, the package's convention for a Date (see toYmd): new Date(2026, 3, 5) is 05/04/26 in any time zone.
 */
export function formatGiftAidDate(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) throw new RangeError('formatGiftAidDate: expected a valid Date');
  const [y, m, day] = toYmd(d).split('-');
  return `${day}/${m}/${y.slice(-2)}`;
}

/**
 * What HMRC repays on `totalDonations` of Gift Aid donations: 25p per £1, rounded to the nearest penny (HMRC's pages
 * state the rate, not a rounding rule). 0 for 0; a negative or non-finite total throws.
 */
export function giftAidClaimValue(totalDonations: number): number {
  if (typeof totalDonations !== 'number' || !Number.isFinite(totalDonations) || totalDonations < 0) {
    throw new RangeError(`giftAidClaimValue: expected a total of 0 or more, got ${totalDonations}`);
  }
  const rate = figureFor('GB.hmrc.giftAidRatePerPound').value;
  const pence = Math.round(totalDonations * 100);
  return Math.round(pence * rate) / 100;
}

// ─── Keeping the organisation rules up to date ──────────────────────────────

export interface OrgRuleInventoryItem {
  /** 'ORG.GB.source.giftAidRate', 'ORG.GB.cc.auditIncome@2026-09-30', … */
  series: string;
  country: string;
  label: string;
  /** The figure, or null for a source row (text, not a number). */
  value: number | null;
  taxYear: string;
  sourceUrl: string;
  readOn: string;
  reviewBy: string;
  /** The file a person edits after re-reading the source. */
  file: string;
}

const SOURCES_FILE = 'src/decisions/organisationSources.ts';

/** Every organisation source and figure, with its read and review dates — the inventory the freshness test checks. */
export function orgRulesInventory(): OrgRuleInventoryItem[] {
  const items: OrgRuleInventoryItem[] = [];
  for (const s of Object.values(ORG_RULE_SOURCES)) {
    items.push({
      series: `ORG.${s.country}.source.${s.id}`,
      country: s.country,
      label: `source: ${s.id} (${s.authority})`,
      value: null,
      taxYear: 'current',
      sourceUrl: s.sourceUrl,
      readOn: s.readOn,
      reviewBy: s.reviewBy,
      file: SOURCES_FILE,
    });
  }
  for (const f of ORG_FIGURES) {
    const period = f.yearsEndingFrom ? `@${f.yearsEndingFrom}` : f.yearsEndingBefore ? `@before-${f.yearsEndingBefore}` : '';
    items.push({
      series: `ORG.${f.id}${period}`,
      country: f.country,
      label: f.label,
      value: f.value,
      taxYear: f.taxYear,
      sourceUrl: f.sourceUrl,
      readOn: f.readOn,
      reviewBy: f.reviewBy,
      file: SOURCES_FILE,
    });
  }
  return items;
}

/** Items whose review date has passed on `asOf` (default today). Empty means every organisation rule is within review. */
export function orgRulesPastReview(asOf?: string | Date): OrgRuleInventoryItem[] {
  const today = toYmd(asOf ?? new Date());
  return orgRulesInventory().filter((i) => i.reviewBy < today);
}
