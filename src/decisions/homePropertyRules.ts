/**
 * Australian home-and-property rules the decision helpers apply — ai2fin.com
 *
 * One row per rule, in the same shape as the package's rate rows: what the
 * rule says, the page or instrument it was read from, the page's own "last
 * updated" date, the day it was read, and whether it was verified against that
 * text. Every note a decision returns points at one of these keys, so a reader
 * (or the app, or the website) can show where a number comes from.
 *
 * All ATO pages below were read in full on 27 September 2026 (ato.gov.au
 * refuses WebFetch but serves a browser user agent), and the Act through the
 * Federal Register of Legislation API the same day. Where a rule is only
 * paraphrased from a page's own worked example, the example is named.
 */

export interface HomePropertyRule {
  /** What the rule says, in the source's terms. */
  rule: string;
  authority: 'ATO' | 'Federal Register of Legislation';
  /** The page or instrument the rule was read from. */
  sourceUrl: string;
  /** The page's own "Last updated" date (YYYY-MM-DD), where it shows one. */
  pageLastUpdated: string | null;
  /** YYYY-MM-DD the source was read. */
  readOn: string;
  /** true only where the rule was confirmed against the source's text on `readOn`. */
  verified: boolean;
}

const READ_ON = '2026-09-27';

export const AU_HOME_PROPERTY_URLS = {
  homeBusinessExpenses:
    'https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/income-and-deductions-for-business/deductions/deductions-for-home-based-business-expenses',
  homeBusinessCgt:
    'https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/income-and-deductions-for-business/deductions/deductions-for-home-based-business-expenses/home-based-business-and-cgt-implications',
  usingHomeForRentalOrBusiness:
    'https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/property-and-capital-gains-tax/your-main-residence-home/using-your-home-for-rental-or-business',
  cgtDiscount: 'https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/cgt-discount',
  formerHome:
    'https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/property-and-capital-gains-tax/your-main-residence-home/treating-former-home-as-main-residence',
  movingHouse:
    'https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/property-and-capital-gains-tax/your-main-residence-home/moving-to-a-new-main-residence',
  spouse:
    'https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/property-and-capital-gains-tax/your-main-residence-home/living-separately-to-your-spouse-or-children',
  rentalIncome:
    'https://www.ato.gov.au/individuals-and-families/investments-and-assets/property-and-land/residential-rental-properties/rental-income-you-must-declare',
  taxReform2027:
    'https://www.ato.gov.au/about-ato/new-legislation/in-detail/individuals/tax-reform-boosting-home-ownership-reforming-negative-gearing-and-capital-gains-tax',
  taxReformAct: 'https://www.legislation.gov.au/C2026A00049/latest',
} as const;

const U = AU_HOME_PROPERTY_URLS;

export type HomePropertyRuleKey =
  | 'runningExpensesAnyWorkArea'
  | 'occupancyOnlyPlaceOfBusiness'
  | 'occupancyByFloorAreaAndTime'
  | 'personalServicesIncome'
  | 'partialExemptionFollowsInterest'
  | 'coOwnerNotInBusiness'
  | 'smallBusinessConcessionsRare'
  | 'homeFirstUsedToProduceIncome'
  | 'floorAreaAndDaysApportionment'
  | 'cgtDiscount'
  | 'noDiscountWithin12MonthsOfFirstUse'
  | 'sixYearRule'
  | 'oneMainResidence'
  | 'movingHouseSixMonths'
  | 'spouseDifferentHomes'
  | 'domesticArrangement'
  | 'noIncomeFromOccupierNoCgt'
  | 'lodgerLetShare'
  | 'cgtFrom1July2027'
  | 'minimumTax30'
  | 'negativeGearingNewBuilds';

export const AU_HOME_PROPERTY_RULES: Record<HomePropertyRuleKey, HomePropertyRule> = {
  runningExpensesAnyWorkArea: {
    rule:
      'Running expenses (electricity, phone, decline in value of equipment, repairs, cleaning) can be claimed for the ' +
      'business use of "a separate study or a desk in a lounge room, even if it doesn\'t have the character of a place of business".',
    authority: 'ATO',
    sourceUrl: U.homeBusinessExpenses,
    pageLastUpdated: '2026-06-18',
    readOn: READ_ON,
    verified: true,
  },
  occupancyOnlyPlaceOfBusiness: {
    rule:
      'Occupancy expenses (mortgage interest or rent, council rates, land tax, house insurance) can only be claimed if the ' +
      'area set aside has the character of a "place of business" — identifiable as such, not easily adapted for private ' +
      'use, used exclusively or almost exclusively for the business, or used regularly for client visits.',
    authority: 'ATO',
    sourceUrl: U.homeBusinessExpenses,
    pageLastUpdated: '2026-06-18',
    readOn: READ_ON,
    verified: true,
  },
  occupancyByFloorAreaAndTime: {
    rule: 'Occupancy expenses are usually apportioned by the floor area that is a place of business and the part of the year it was used for business.',
    authority: 'ATO',
    sourceUrl: U.homeBusinessExpenses,
    pageLastUpdated: '2026-06-18',
    readOn: READ_ON,
    verified: true,
  },
  personalServicesIncome: {
    rule: 'If you earn personal services income (PSI), you may not be able to deduct some occupancy expenses.',
    authority: 'ATO',
    sourceUrl: U.homeBusinessExpenses,
    pageLastUpdated: '2026-06-18',
    readOn: READ_ON,
    verified: true,
  },
  partialExemptionFollowsInterest: {
    rule:
      'Where an area is set aside exclusively as a place of business, the main residence exemption does not apply to the ' +
      'part of the gain referable to it — the same percentage as the mortgage interest you could deduct, generally the floor area.',
    authority: 'ATO',
    sourceUrl: U.homeBusinessCgt,
    pageLastUpdated: '2026-02-03',
    readOn: READ_ON,
    verified: true,
  },
  coOwnerNotInBusiness: {
    rule:
      'A co-owner who does not use the home to produce income keeps the full main residence exemption on their share ' +
      '(the ATO\'s Elena and Mathew example).',
    authority: 'ATO',
    sourceUrl: U.homeBusinessCgt,
    pageLastUpdated: '2026-02-03',
    readOn: READ_ON,
    verified: true,
  },
  smallBusinessConcessionsRare: {
    rule:
      'The small business CGT concessions need the home to be an active asset, tested on the whole asset; for a home that ' +
      'is mainly private this will rarely be met (the ATO\'s Harriet example).',
    authority: 'ATO',
    sourceUrl: U.homeBusinessCgt,
    pageLastUpdated: '2026-02-03',
    readOn: READ_ON,
    verified: true,
  },
  homeFirstUsedToProduceIncome: {
    rule:
      'If you first use your home to produce income after 20 August 1996 (and it was fully exempt until then), you are taken ' +
      'to have acquired it at that time for its market value.',
    authority: 'ATO',
    sourceUrl: U.usingHomeForRentalOrBusiness,
    pageLastUpdated: '2026-06-22',
    readOn: READ_ON,
    verified: true,
  },
  floorAreaAndDaysApportionment: {
    rule:
      'Assessable gain = gain from the value when first used to produce income × floor-area share × (days used to produce ' +
      'income ÷ days from first use to sale); the last factor only if use stopped before the sale (the ATO\'s steps 1 to 6).',
    authority: 'ATO',
    sourceUrl: U.usingHomeForRentalOrBusiness,
    pageLastUpdated: '2026-06-22',
    readOn: READ_ON,
    verified: true,
  },
  cgtDiscount: {
    rule:
      '50% CGT discount for an Australian resident who owned the asset for at least 12 months, excluding the day of ' +
      'acquisition and the day of the CGT event (the contract date for property).',
    authority: 'ATO',
    sourceUrl: U.cgtDiscount,
    pageLastUpdated: '2026-06-29',
    readOn: READ_ON,
    verified: true,
  },
  noDiscountWithin12MonthsOfFirstUse: {
    rule: 'If you first started using your home for rental or business less than 12 months before disposing of it, you cannot use the CGT discount.',
    authority: 'ATO',
    sourceUrl: U.cgtDiscount,
    pageLastUpdated: '2026-06-29',
    readOn: READ_ON,
    verified: true,
  },
  sixYearRule: {
    rule:
      'After you stop living in a home you can keep treating it as your main residence — indefinitely if it is not used to ' +
      'produce income, for up to 6 years for each absence if it is. Beyond 6 years the days are taxable, from a cost base of ' +
      'the market value when first used to produce income.',
    authority: 'ATO',
    sourceUrl: U.formerHome,
    pageLastUpdated: '2026-06-22',
    readOn: READ_ON,
    verified: true,
  },
  oneMainResidence: {
    rule: 'While you treat a former home as your main residence you cannot treat any other property as your main residence, except for up to 6 months when moving house.',
    authority: 'ATO',
    sourceUrl: U.formerHome,
    pageLastUpdated: '2026-06-22',
    readOn: READ_ON,
    verified: true,
  },
  movingHouseSixMonths: {
    rule:
      'Both homes are exempt for up to 6 months before the old one is disposed of, if you lived in the old home for a ' +
      'continuous 3 months in the 12 months before disposal, did not use it to produce income in any part of those 12 months ' +
      'when it was not your main residence, and the new home becomes your main residence.',
    authority: 'ATO',
    sourceUrl: U.movingHouse,
    pageLastUpdated: '2026-06-22',
    readOn: READ_ON,
    verified: true,
  },
  spouseDifferentHomes: {
    rule:
      'Spouses with different homes must choose one home for both, or each nominate their own; if you nominate different ' +
      'homes and own more than 50% of yours, your share is exempt for half the period.',
    authority: 'ATO',
    sourceUrl: U.spouse,
    pageLastUpdated: '2026-06-22',
    readOn: READ_ON,
    verified: true,
  },
  domesticArrangement: {
    rule:
      'Payments from householders or family members for family care or shared household expenses are domestic: not ' +
      'rental income, and nothing is deductible against them.',
    authority: 'ATO',
    sourceUrl: U.rentalIncome,
    pageLastUpdated: '2026-05-21',
    readOn: READ_ON,
    verified: true,
  },
  noIncomeFromOccupierNoCgt: {
    rule: 'You keep the full main residence exemption if someone else uses part of your home and you receive no assessable income from them for it.',
    authority: 'ATO',
    sourceUrl: U.usingHomeForRentalOrBusiness,
    pageLastUpdated: '2026-06-22',
    readOn: READ_ON,
    verified: true,
  },
  lodgerLetShare: {
    rule:
      'Renting out part of your home: the rent is assessable, you deduct the let share of expenses (interest included), and ' +
      'the gain on that share for the rental period is assessable. The share is the let area plus a part of shared areas ' +
      '(the ATO\'s Thomas example: 20% + 30% × 50% = 35%).',
    authority: 'ATO',
    sourceUrl: U.usingHomeForRentalOrBusiness,
    pageLastUpdated: '2026-06-22',
    readOn: READ_ON,
    verified: true,
  },
  cgtFrom1July2027: {
    rule:
      'LAW, not announced: Treasury Laws Amendment (Tax Reform No. 1) Act 2026 (No. 49, assented 26 June 2026). The 50% ' +
      'discount is replaced by cost-base indexation and a 30% minimum tax for gains accruing after 1 July 2027; the gain to ' +
      '30 June 2027 keeps the discount. An individual is taken to sell just before, and reacquire on, 1 July 2027 at market ' +
      'value or under an apportioning method the Commissioner determines (s 112-155, s 112-185). No such method is ' +
      'published — none is on the Federal Register of Legislation as at the read date — so the portion after 30 June 2027 ' +
      'is not computed.',
    authority: 'Federal Register of Legislation',
    sourceUrl: U.taxReformAct,
    pageLastUpdated: null,
    readOn: READ_ON,
    verified: true,
  },
  minimumTax30: {
    rule:
      'Division 119: extra income tax so that residential and non-residential capital gains (not deferred pre-2027 gains) bear ' +
      'at least 30% before offsets — 30% of the gain less the income tax attributable to it, rounded down, if positive. Does ' +
      'not apply to recipients of listed support payments (e.g. age pension, JobSeeker).',
    authority: 'Federal Register of Legislation',
    sourceUrl: U.taxReformAct,
    pageLastUpdated: null,
    readOn: READ_ON,
    verified: true,
  },
  negativeGearingNewBuilds: {
    rule:
      'From 1 July 2027 negative gearing for residential property is limited to new builds; properties held at 7:30pm AEST ' +
      '12 May 2026 are exempt. The ATO states "These measures are now law."',
    authority: 'ATO',
    sourceUrl: U.taxReform2027,
    pageLastUpdated: '2026-06-29',
    readOn: READ_ON,
    verified: true,
  },
};

/** A note a decision returns: plain words plus the rule it rests on. */
export interface DecisionNote {
  text: string;
  rule: HomePropertyRuleKey;
  sourceUrl: string;
  readOn: string;
}

export function note(rule: HomePropertyRuleKey, text: string): DecisionNote {
  const r = AU_HOME_PROPERTY_RULES[rule];
  return { text, rule, sourceUrl: r.sourceUrl, readOn: r.readOn };
}
