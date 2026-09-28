/**
 * Home rules by country, as data — ai2fin.com
 *
 * `homeRulesFor(country)` says which questions about a home change a filer's
 * figures in that country, when to ask each one, and what each answer does:
 * the deduction basis now and the effect on the home when it is sold. The app
 * asks only those questions, and a website or the Tax MCP can read the same
 * data, so every surface asks the same thing and reaches the same answer.
 *
 * WHAT DRIVES A QUESTION OR A NUMBER. Only claims verified on the authority's
 * own page (read 28 September 2026, UTC). A claim seen only in an
 * official-domain search excerpt, or not found at all, is a `notes` entry
 * with `forAccountant: true` — never a number and never a branch. Every
 * numeric figure carries a citation (a test enforces it).
 *
 * AUSTRALIA is encoded as the app behaves today (lib/propertyRules
 * homeTreatmentFor and incomeShareForCgt, and the Home use section), so the
 * app can read this instead without any change in what it asks or computes.
 *
 * TAXPAYER ROLE is a question only where it changes the answer: GB, US, CA and
 * NZ, where an employee mostly cannot claim. In AU an employee and a sole
 * trader reach the same two outcomes; in IN the verified rules on the home
 * are about letting, not the role.
 */

import {
  GB_RENT_A_ROOM_ROWS,
  HOME_RATE_URLS,
  HOME_RULES_READ_ON,
  NZ_BOARDER_STANDARD_COST_ROWS,
  NZ_SQUARE_METRE_RATE_ROWS,
  US_SIMPLIFIED_METHOD_ROWS,
  verifiedRow,
  type HomeRateRow,
} from './homeRuleRates';

// ─── Shapes ─────────────────────────────────────────────────────────────────

export type TaxpayerRole = 'employee' | 'self_employed' | 'company';

export interface Citation {
  url: string;
  /** YYYY-MM-DD (UTC) the page was read. */
  readOn: string;
}

/** Facts about a place (and its owner) that decide whether a question is asked. All conditions must hold. */
export interface AskWhen {
  /** Ask only for these place kinds (lib/placeKinds in the app: 'home', 'rental', …). */
  kinds?: string[];
  /** Never ask for these kinds. */
  notKinds?: string[];
  businessPercentAboveZero?: boolean;
  rentalPercentAboveZero?: boolean;
  /** Ask only when the taxpayer role (the answer to `taxpayerRole`) is one of these. */
  roles?: TaxpayerRole[];
  /**
   * Keep asking when the question already has an answer even though the other
   * conditions no longer hold — the app's AU Home use section shows a business
   * use answer on a place that is not a home once it has been given.
   */
  alsoWhenAnswered?: boolean;
}

export interface Figure {
  label: string;
  amount: number;
  /** ISO currency, or null for a percentage. */
  currency: string | null;
  per: 'work_hour' | 'week' | 'month' | 'year' | 'sq_ft' | 'sq_m' | 'percent_of_value' | null;
  /** The tax year(s) the figure is for, in the authority's terms. */
  appliesTo: string;
  citation: Citation;
}

export type DeductionBasis = 'running_only' | 'occupancy_at_share' | 'flat_rate' | 'none';
export type SaleEffect =
  | 'exemption_unaffected'
  | 'reduced_by_share'
  | 'reduced_by_value_share'
  | 'not_applicable'
  | 'depreciation_recaptured';

export interface Effects {
  deduction: { basis: DeductionBasis; citation: Citation; figures?: Figure[]; note?: string };
  sale: { effect: SaleEffect; citation: Citation; figures?: Figure[]; note?: string };
}

export interface QuestionOption {
  id: string;
  label: string;
  effects: Effects;
}

export interface Question {
  id: string;
  /** The place (or profile) field the answer is stored in. Two questions may share one field, for different kinds. */
  field: string;
  prompt: string;
  askWhen: AskWhen;
  options: QuestionOption[];
}

export interface HomeRuleNote {
  id: string;
  text: string;
  /** true: an accountant's call — the claim was only in a search excerpt, not found, or needs judgement. */
  forAccountant: boolean;
  status: 'verified' | 'search-excerpt' | 'unverified' | 'judgement';
  citation?: Citation;
}

export interface HomeRules {
  supported: true;
  country: string;
  /** The tax year, in the authority's terms. */
  taxYear: string;
  questions: Question[];
  notes: HomeRuleNote[];
}

export interface HomeRulesUnsupported {
  supported: false;
  country: string;
}

const cite = (url: string, readOn = HOME_RULES_READ_ON): Citation => ({ url, readOn });

/** A Figure from a verified rate row, so the number cannot drift from the row Rate Watch watches. */
function fromRow(rows: readonly HomeRateRow[], effectiveFrom: string, f: Omit<Figure, 'amount' | 'citation'>, factor = 1): Figure {
  const row = verifiedRow(rows, effectiveFrom);
  return { ...f, amount: row.value * factor, citation: cite(row.sourceUrl, row.readOn) };
}

// ─── Australia — as the app behaves today ───────────────────────────────────

const ATO = {
  occupancy:
    'https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions/working-from-home-expenses/occupancy-expenses',
  homeBusinessCgt:
    'https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/income-and-deductions-for-business/deductions/deductions-for-home-based-business-expenses/home-based-business-and-cgt-implications',
  usingHome:
    'https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/property-and-capital-gains-tax/your-main-residence-home/using-your-home-for-rental-or-business',
  rentalIncome:
    'https://www.ato.gov.au/individuals-and-families/investments-and-assets/property-and-land/residential-rental-properties/rental-income-you-must-declare',
};

const AU: HomeRules = {
  supported: true,
  country: 'AU',
  taxYear: '1 July to 30 June',
  questions: [
    {
      id: 'businessUse',
      field: 'businessUse',
      prompt: 'How is the business part of this home used?',
      askWhen: { businessPercentAboveZero: true, kinds: ['home'], alsoWhenAnswered: true },
      options: [
        {
          id: 'home_office',
          label: 'A home office — a desk or room that is also used privately',
          effects: {
            deduction: {
              basis: 'running_only',
              citation: cite(ATO.occupancy),
              note: 'Running costs only (or the fixed rate per work hour — workFromHomeFixedRate). Occupancy costs need a place of business.',
            },
            sale: { effect: 'exemption_unaffected', citation: cite(ATO.occupancy), note: '"There are no CGT implications if you only claim running expenses."' },
          },
        },
        {
          id: 'place_of_business',
          label: 'A place of business — set aside and used only for the business',
          effects: {
            deduction: { basis: 'occupancy_at_share', citation: cite(ATO.occupancy), note: 'Occupancy costs (interest or rent, rates, insurance) at the floor-area share, for the time used.' },
            sale: {
              effect: 'reduced_by_share',
              citation: cite(ATO.homeBusinessCgt),
              note: 'The main residence exemption is reduced by the interest-deductible share, whether or not you claim it (interest deductibility test).',
            },
          },
        },
      ],
    },
    {
      id: 'homeRentalArrangement',
      field: 'rentalArrangement',
      prompt: 'Who pays you to live in part of this home?',
      askWhen: { rentalPercentAboveZero: true, kinds: ['home'] },
      options: [
        {
          id: 'domestic',
          label: 'A partner or family member sharing the household costs',
          effects: {
            deduction: { basis: 'none', citation: cite(ATO.rentalIncome), note: 'Shared household expenses are domestic: not rent, and nothing is deductible.' },
            sale: { effect: 'exemption_unaffected', citation: cite(ATO.usingHome) },
          },
        },
        {
          id: 'commercial',
          label: 'A tenant or lodger paying rent',
          effects: {
            deduction: { basis: 'occupancy_at_share', citation: cite(ATO.usingHome), note: 'Rent is income; the let share of costs (exclusive rooms plus half of shared areas) is deductible.' },
            sale: { effect: 'reduced_by_share', citation: cite(ATO.usingHome) },
          },
        },
      ],
    },
    {
      id: 'propertyRentalArrangement',
      field: 'rentalArrangement',
      prompt: 'Who rents this property?',
      askWhen: { rentalPercentAboveZero: true, notKinds: ['home'] },
      options: [
        {
          id: 'commercial',
          label: 'A tenant at market rent',
          effects: {
            deduction: { basis: 'occupancy_at_share', citation: cite(ATO.rentalIncome) },
            sale: { effect: 'not_applicable', citation: cite(ATO.usingHome), note: 'Not a main residence, so there is no exemption to reduce.' },
          },
        },
        {
          id: 'below_market',
          label: 'Family or friends at less than market rent',
          effects: {
            deduction: {
              basis: 'occupancy_at_share',
              citation: cite(ATO.rentalIncome),
              note: 'Deductions are apportioned to exclude the private use; the ATO accepts capping them at the rent received.',
            },
            sale: { effect: 'not_applicable', citation: cite(ATO.usingHome) },
          },
        },
      ],
    },
  ],
  notes: [
    { id: 'au-fixed-rate-2026-27', text: 'The working from home fixed rate for 2026-27 has not been published (workFromHomeFixedRate returns none).', forAccountant: false, status: 'verified', citation: cite('https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions/working-from-home-expenses/fixed-rate-method') },
    { id: 'au-employee-place-of-business', text: 'An employee can reach occupancy costs only with an area that is a place of business and no alternative place provided by the employer.', forAccountant: true, status: 'judgement', citation: cite(ATO.occupancy) },
    { id: 'au-small-business-concessions', text: 'The small business CGT concessions rarely apply to a home: the active asset test is applied to the whole home.', forAccountant: true, status: 'verified', citation: cite(ATO.homeBusinessCgt) },
  ],
};

// ─── United Kingdom ─────────────────────────────────────────────────────────

const GOVUK = {
  employeeWfh: 'https://www.gov.uk/tax-relief-for-employees/working-at-home',
  eim32759: 'https://www.gov.uk/hmrc-internal-manuals/employment-income-manual/eim32759',
  simplifiedWfh: 'https://www.gov.uk/simpler-income-tax-simplified-expenses/working-from-home',
  bim47820: 'https://www.gov.uk/hmrc-internal-manuals/business-income-manual/bim47820',
  rentARoom: 'https://www.gov.uk/rent-room-in-your-home/the-rent-a-room-scheme',
  sellWorkFromHome: 'https://www.gov.uk/tax-sell-home/work-from-home',
  sellLetPart: 'https://www.gov.uk/tax-sell-home/let-out-part-of-home',
  hs283: 'https://www.gov.uk/government/publications/private-residence-relief-hs283-self-assessment-helpsheet/hs283-private-residence-relief-2025',
  cg64663: 'https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg64663',
  cg64702: 'https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg64702',
  cg64710: 'https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg64710',
};

const gbSelfEmployedFlat = (amount: number, hours: string): Figure => ({
  label: `Flat rate, ${hours} hours a month at home`,
  amount,
  currency: 'GBP',
  per: 'month',
  appliesTo: 'current (gov.uk simplified expenses)',
  citation: cite(GOVUK.simplifiedWfh),
});

const GB: HomeRules = {
  supported: true,
  country: 'GB',
  taxYear: '6 April to 5 April',
  questions: [
    {
      id: 'taxpayerRole',
      field: 'taxpayerRole',
      prompt: 'How do you earn money from home?',
      askWhen: { businessPercentAboveZero: true },
      options: [
        {
          id: 'employee',
          label: 'As an employee',
          effects: {
            deduction: {
              basis: 'none',
              citation: cite(GOVUK.eim32759),
              figures: [{ label: 'Flat rate if your employer required you to work from home', amount: 6, currency: 'GBP', per: 'week', appliesTo: '2025-26 and earlier', citation: cite(GOVUK.employeeWfh) }],
              note: 'From 6 April 2026 a deduction from earnings is no longer permitted (s360B ITEPA). Up to 2025-26, £6 a week (or actual additional costs) if required to work from home.',
            },
            sale: { effect: 'exemption_unaffected', citation: cite(GOVUK.sellWorkFromHome) },
          },
        },
        {
          id: 'self_employed',
          label: 'Self-employed or in a partnership',
          effects: {
            deduction: {
              basis: 'flat_rate',
              citation: cite(GOVUK.simplifiedWfh),
              figures: [gbSelfEmployedFlat(10, '25 to 50'), gbSelfEmployedFlat(18, '51 to 100'), gbSelfEmployedFlat(26, '101 or more')],
              note: 'A flat rate by hours worked at home (under 25 hours a month: actual costs only), or actual costs instead. Phone and internet are claimed separately.',
            },
            sale: { effect: 'exemption_unaffected', citation: cite(GOVUK.sellWorkFromHome), note: 'Unless a room is used only for the business — see the next question.' },
          },
        },
      ],
    },
    {
      id: 'exclusiveBusinessUse',
      field: 'businessUse',
      prompt: 'Is any room used only for the business, with no regular personal use?',
      askWhen: { businessPercentAboveZero: true, roles: ['self_employed'] },
      options: [
        {
          id: 'exclusive',
          label: 'Yes — a room used only for the business',
          effects: {
            deduction: { basis: 'occupancy_at_share', citation: cite(GOVUK.bim47820), note: 'Fixed costs (mortgage interest, council tax, insurance, rent) in proportion for the part set aside solely for the trade.' },
            sale: {
              effect: 'reduced_by_value_share',
              citation: cite(GOVUK.cg64663),
              note: 'Private Residence Relief is lost on that part, apportioned by value rather than floor area. The test is stringent: a room with regular personal use is not restricted.',
            },
          },
        },
        {
          id: 'not_exclusive',
          label: 'No — the space is also used personally',
          effects: {
            deduction: { basis: 'running_only', citation: cite(GOVUK.bim47820) },
            sale: { effect: 'exemption_unaffected', citation: cite(GOVUK.cg64663) },
          },
        },
      ],
    },
    {
      id: 'homeLodgers',
      field: 'rentalArrangement',
      prompt: 'Who lives in your home and pays you?',
      askWhen: { rentalPercentAboveZero: true, kinds: ['home'] },
      options: [
        {
          id: 'single_lodger',
          label: 'One lodger in a furnished room, sharing your living space',
          effects: {
            deduction: {
              basis: 'flat_rate',
              citation: cite(GOVUK.rentARoom),
              figures: [
                fromRow(GB_RENT_A_ROOM_ROWS, '2026-04-06', { label: 'Rent a Room tax-free amount', currency: 'GBP', per: 'year', appliesTo: '2026-27' }),
                // gov.uk: £3,750 if you share the income — half the limit, so derived from the row and never a second literal.
                fromRow(GB_RENT_A_ROOM_ROWS, '2026-04-06', { label: 'Rent a Room tax-free amount if the income is shared', currency: 'GBP', per: 'year', appliesTo: '2026-27' }, 0.5),
              ],
              note: 'Up to the Rent a Room amount the income is tax-free automatically; above it, choose the allowance or actual expenses.',
            },
            sale: { effect: 'exemption_unaffected', citation: cite(GOVUK.cg64702), note: 'A single lodger living as part of the family does not restrict Private Residence Relief.' },
          },
        },
        {
          id: 'several_lodgers',
          label: 'Two or more lodgers',
          effects: {
            deduction: { basis: 'flat_rate', citation: cite(GOVUK.rentARoom), figures: [fromRow(GB_RENT_A_ROOM_ROWS, '2026-04-06', { label: 'Rent a Room tax-free amount', currency: 'GBP', per: 'year', appliesTo: '2026-27' })] },
            sale: {
              effect: 'reduced_by_share',
              citation: cite(GOVUK.sellLetPart),
              figures: [{ label: 'Lettings relief cap (only if you lived there at the same time as the tenants)', amount: 40000, currency: 'GBP', per: null, appliesTo: 'disposals from 6 April 2020', citation: cite(GOVUK.cg64710) }],
              note: 'Relief covers the part you live in; lettings relief is the lowest of the relief, £40,000 and the gain on the let part.',
            },
          },
        },
        {
          id: 'self_contained_let',
          label: 'A self-contained part or separate flat',
          effects: {
            deduction: { basis: 'occupancy_at_share', citation: cite(GOVUK.rentARoom), note: 'Ordinary property income: Rent a Room does not cover a home converted into separate flats.' },
            sale: { effect: 'reduced_by_share', citation: cite(GOVUK.sellLetPart) },
          },
        },
      ],
    },
  ],
  notes: [
    { id: 'gb-final-9-months', text: 'The final 9 months of ownership always qualify for Private Residence Relief (36 months if disabled or in a care home).', forAccountant: false, status: 'verified', citation: cite(GOVUK.hs283) },
    { id: 'gb-director', text: 'A company director: a homeworking allowance from the company (s316A, £6 a week in a search excerpt) or rent under an agreement — for an accountant.', forAccountant: true, status: 'search-excerpt' },
    { id: 'gb-family-costs', text: 'Whether family members paying toward bills is income: no HMRC page found.', forAccountant: true, status: 'unverified' },
    { id: 'gb-flat-rate-scope', text: 'Whether simplified flat rates are limited to sole traders and partnerships was not stated on the page read.', forAccountant: true, status: 'unverified' },
    { id: 'gb-value-apportionment', text: 'A Private Residence Relief restriction is apportioned by value (the Valuation Office may apportion); the amount is for an accountant.', forAccountant: true, status: 'judgement', citation: cite(GOVUK.cg64663) },
    { id: 'gb-60-day', text: 'The 60-day CGT reporting rule for residential property was not verified.', forAccountant: true, status: 'unverified' },
  ],
};

// ─── United States ──────────────────────────────────────────────────────────

const IRS = {
  p587: 'https://www.irs.gov/publications/p587',
  p523: 'https://www.irs.gov/publications/p523',
  tc509: 'https://www.irs.gov/taxtopics/tc509',
  tc415: 'https://www.irs.gov/taxtopics/tc415',
  p527: 'https://www.irs.gov/publications/p527',
  i2106: 'https://www.irs.gov/pub/irs-pdf/i2106.pdf',
};

const US_121: Figure[] = [
  { label: 'Home sale exclusion', amount: 250000, currency: 'USD', per: null, appliesTo: '2025 (Pub 523)', citation: cite(IRS.p523) },
  { label: 'Home sale exclusion, married filing jointly', amount: 500000, currency: 'USD', per: null, appliesTo: '2025 (Pub 523)', citation: cite(IRS.p523) },
];

const US: HomeRules = {
  supported: true,
  country: 'US',
  taxYear: 'calendar year',
  questions: [
    {
      id: 'taxpayerRole',
      field: 'taxpayerRole',
      prompt: 'Are you an employee, or self-employed (Schedule C or a partner)?',
      askWhen: { businessPercentAboveZero: true },
      options: [
        {
          id: 'employee',
          label: 'An employee',
          effects: {
            deduction: { basis: 'none', citation: cite(IRS.i2106), note: 'Miscellaneous itemized deductions were eliminated for tax years after 2017; employees cannot claim a home office.' },
            sale: { effect: 'exemption_unaffected', citation: cite(IRS.p587), figures: US_121 },
          },
        },
        {
          id: 'self_employed',
          label: 'Self-employed or a partner',
          effects: {
            deduction: { basis: 'none', citation: cite(IRS.p587), note: 'Only if the area is used regularly and exclusively — see the next question.' },
            sale: { effect: 'exemption_unaffected', citation: cite(IRS.p587), figures: US_121 },
          },
        },
      ],
    },
    {
      id: 'regularExclusiveUse',
      field: 'businessUse',
      prompt: 'Is the area used regularly and only for the business, as your principal place of business or where you meet clients?',
      askWhen: { businessPercentAboveZero: true, roles: ['self_employed'] },
      options: [
        {
          id: 'yes_simplified',
          label: 'Yes — claim with the simplified method',
          effects: {
            deduction: {
              basis: 'flat_rate',
              citation: cite(IRS.tc509),
              figures: [
                fromRow(US_SIMPLIFIED_METHOD_ROWS, '2025-01-01', { label: 'Simplified method, per square foot', currency: 'USD', per: 'sq_ft', appliesTo: '2025' }),
                { label: 'Simplified method, maximum area (square feet)', amount: 300, currency: null, per: null, appliesTo: '2025', citation: cite(IRS.tc509) },
              ],
              note: 'Depreciation is treated as zero; no carryforward.',
            },
            sale: { effect: 'exemption_unaffected', citation: cite(IRS.p587), figures: US_121, note: 'No depreciation for those years, so nothing to recapture.' },
          },
        },
        {
          id: 'yes_regular',
          label: 'Yes — claim actual costs (Form 8829)',
          effects: {
            deduction: { basis: 'occupancy_at_share', citation: cite(IRS.p587), note: 'Business share of mortgage interest, taxes, insurance, utilities and repairs, plus 39-year depreciation; capped at business income.' },
            sale: {
              effect: 'depreciation_recaptured',
              citation: cite(IRS.p523),
              figures: US_121,
              note: 'An office inside the home needs no allocation of gain, but depreciation allowed or allowable after 6 May 1997 is not excludable.',
            },
          },
        },
        {
          id: 'no',
          label: 'No — it is also used personally',
          effects: {
            deduction: { basis: 'none', citation: cite(IRS.p587) },
            sale: { effect: 'exemption_unaffected', citation: cite(IRS.p587), figures: US_121 },
          },
        },
      ],
    },
    {
      id: 'homeLodgers',
      field: 'rentalArrangement',
      prompt: 'Does someone pay you to live in part of your home?',
      askWhen: { rentalPercentAboveZero: true, kinds: ['home'] },
      options: [
        {
          id: 'lodger',
          label: 'A roommate or lodger',
          effects: {
            deduction: { basis: 'occupancy_at_share', citation: cite(IRS.p527), note: 'Rental income on Schedule E; expenses split by area; depreciate the rented part.' },
            sale: { effect: 'depreciation_recaptured', citation: cite(IRS.p523), figures: US_121 },
          },
        },
        {
          id: 'under_15_days',
          label: 'Rented for fewer than 15 days in the year',
          effects: {
            deduction: { basis: 'none', citation: cite(IRS.tc415), note: 'Do not report the income, and do not deduct the expenses.' },
            sale: { effect: 'exemption_unaffected', citation: cite(IRS.p523), figures: US_121 },
          },
        },
      ],
    },
  ],
  notes: [
    { id: 'us-separate-structure', text: 'A separate structure used for the business: the gain is allocated and reported on Form 4797 unless you also lived in that part for 2 of the 5 years.', forAccountant: true, status: 'verified', citation: cite(IRS.p587) },
    { id: 'us-relative-below-rent', text: 'Days a relative pays less than fair rent count as personal-use days, which limits expenses.', forAccountant: true, status: 'verified', citation: cite(IRS.tc415) },
    { id: 'us-recapture-rate', text: 'The rate on the depreciation portion at sale (a summary said "potentially 25%") was not quoted from the page.', forAccountant: true, status: 'unverified' },
    { id: 'us-employee-permanent', text: 'That the employee disallowance is permanent (P.L. 119-21) was not confirmed in IRS text.', forAccountant: true, status: 'unverified' },
    { id: 'us-owner-employee', text: 'S-corp or C-corp owner-employees (accountable plans) and renting a home office to your employer are for an accountant.', forAccountant: true, status: 'judgement' },
    { id: 'us-cost-sharing', text: 'Whether housemates sharing costs is rental income: Pub 527 has no cost-sharing carve-out.', forAccountant: true, status: 'unverified' },
  ],
};

// ─── Canada ─────────────────────────────────────────────────────────────────

const CRA = {
  t4044: 'https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4044/employment-expenses.html',
  workSpace:
    'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-22900-other-employment-expenses/work-space-home-expenses.html',
  t2125:
    'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/sole-proprietorships-partnerships/report-business-income-expenses/completing-form-t2125/business-use-home-expenses.html',
  folio:
    'https://www.canada.ca/en/revenue-agency/services/tax/technical-information/income-tax/income-tax-folios-index/series-1-individuals/folio-3-family-unit-issues/income-tax-folio-s1-f3-c2-principal-residence.html',
  t4036: 'https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4036/rental-income.html',
};

const CA: HomeRules = {
  supported: true,
  country: 'CA',
  taxYear: 'calendar year',
  questions: [
    {
      id: 'taxpayerRole',
      field: 'taxpayerRole',
      prompt: 'Are you an employee or self-employed?',
      askWhen: { businessPercentAboveZero: true },
      options: [
        {
          id: 'employee',
          label: 'An employee',
          effects: {
            deduction: { basis: 'none', citation: cite(CRA.t4044), note: 'Only with a signed T2200 and the work-space conditions — see the next question. The temporary flat rate does not apply from 2023.' },
            sale: { effect: 'exemption_unaffected', citation: cite(CRA.folio) },
          },
        },
        {
          id: 'self_employed',
          label: 'Self-employed',
          effects: {
            deduction: { basis: 'none', citation: cite(CRA.t2125), note: 'Only if a condition is met — see the next question.' },
            sale: { effect: 'exemption_unaffected', citation: cite(CRA.folio) },
          },
        },
      ],
    },
    {
      id: 'employeeWorkSpace',
      field: 'businessUse',
      prompt: 'Did your employer sign a T2200, and did you work from home more than half the time for 4 weeks in a row (or use the space only for work and meet clients there)?',
      askWhen: { businessPercentAboveZero: true, roles: ['employee'] },
      options: [
        {
          id: 't2200_salaried',
          label: 'Yes — salaried',
          effects: {
            deduction: { basis: 'running_only', citation: cite(CRA.t4044), note: 'Electricity, heating, maintenance and rent at the work-space share; never mortgage interest or CCA; limited to employment income.' },
            sale: { effect: 'exemption_unaffected', citation: cite(CRA.folio) },
          },
        },
        {
          id: 't2200_commission',
          label: 'Yes — paid by commission',
          effects: {
            deduction: { basis: 'occupancy_at_share', citation: cite(CRA.t4044), note: 'As salaried, plus property taxes and home insurance at the share; still never mortgage interest or CCA.' },
            sale: { effect: 'exemption_unaffected', citation: cite(CRA.folio) },
          },
        },
        {
          id: 'not_met',
          label: 'No',
          effects: {
            deduction: { basis: 'none', citation: cite(CRA.workSpace) },
            sale: { effect: 'exemption_unaffected', citation: cite(CRA.folio) },
          },
        },
      ],
    },
    {
      id: 'selfEmployedWorkSpace',
      field: 'businessUse',
      prompt: 'Is it your principal place of business, or used only for the business and regularly to meet clients?',
      askWhen: { businessPercentAboveZero: true, roles: ['self_employed'] },
      options: [
        {
          id: 'yes_no_cca',
          label: 'Yes — claim expenses, no CCA on the house',
          effects: {
            deduction: { basis: 'occupancy_at_share', citation: cite(CRA.t2125), note: 'Area share of heat, power, insurance, maintenance, property tax and mortgage interest; cannot create or increase a loss.' },
            sale: { effect: 'exemption_unaffected', citation: cite(CRA.folio), note: 'Ancillary use, no structural change and no CCA: no change in use, the full principal residence exemption stays available.' },
          },
        },
        {
          id: 'yes_with_cca',
          label: 'Yes — and claim CCA on the house',
          effects: {
            deduction: { basis: 'occupancy_at_share', citation: cite(CRA.t2125) },
            sale: { effect: 'reduced_by_share', citation: cite(CRA.t2125), note: '"If you claim CCA… capital gain and recapture rules will apply" to that part.' },
          },
        },
        {
          id: 'not_met',
          label: 'No',
          effects: {
            deduction: { basis: 'none', citation: cite(CRA.t2125) },
            sale: { effect: 'exemption_unaffected', citation: cite(CRA.folio) },
          },
        },
      ],
    },
    {
      id: 'homeLodgers',
      field: 'rentalArrangement',
      prompt: 'Who lives with you and pays you?',
      askWhen: { rentalPercentAboveZero: true, kinds: ['home'] },
      options: [
        {
          id: 'family_upkeep',
          label: 'Family, or anyone paying a small amount toward upkeep or groceries',
          effects: {
            deduction: { basis: 'none', citation: cite(CRA.t4036), note: '"You do not report this amount in your income, and you cannot claim rental expenses."' },
            sale: { effect: 'exemption_unaffected', citation: cite(CRA.folio) },
          },
        },
        {
          id: 'room_tenants',
          label: 'Room tenants, with no structural change and no CCA',
          effects: {
            deduction: { basis: 'occupancy_at_share', citation: cite(CRA.t4036), note: 'Rental income (T776); expenses by rooms or area.' },
            sale: { effect: 'exemption_unaffected', citation: cite(CRA.folio) },
          },
        },
        {
          id: 'structural_or_cca',
          label: 'A separate suite or other structural change, or CCA claimed',
          effects: {
            deduction: { basis: 'occupancy_at_share', citation: cite(CRA.t4036) },
            sale: { effect: 'reduced_by_share', citation: cite(CRA.folio), note: 'A deemed disposition of that part at fair market value, unless the s45(2) election is made.' },
          },
        },
      ],
    },
  ],
  notes: [
    { id: 'ca-ancillary', text: 'Whether rental or business use is "ancillary", and the timing of s45(2)/(3) elections, are for an accountant.', forAccountant: true, status: 'judgement', citation: cite(CRA.folio) },
    { id: 'ca-flipping', text: 'A home owned under 365 days is business income unless a listed life event applies.', forAccountant: true, status: 'verified', citation: cite('https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/personal-income/line-12700-capital-gains/principal-residence-other-real-estate.html') },
    { id: 'ca-inclusion-rate', text: 'The capital gains inclusion rate stays one half (the increase was cancelled) — seen in a search excerpt only.', forAccountant: true, status: 'search-excerpt' },
    { id: 'ca-ccpc-rent', text: 'Shareholder-employees of a CCPC charging rent to their company are for an accountant.', forAccountant: true, status: 'judgement' },
  ],
};

// ─── New Zealand ────────────────────────────────────────────────────────────

const IRD = {
  homeOffice: 'https://www.ird.govt.nz/home-office-expenses',
  room: 'https://www.ird.govt.nz/property/renting-out-residential-property/tax-by-rental-property-type/renting-out-a-room-in-my-main-home',
  brightline: 'https://www.ird.govt.nz/property/buying-and-selling/when-you-need-to-pay/the-brightline-test',
  qb2402: 'https://www.taxtechnical.ird.govt.nz/-/media/project/ir/tt/pdfs/questions-we-ve-been-asked/2024/qb-24-02.pdf',
};

const nzSale = (note?: string): Effects['sale'] => ({
  effect: 'not_applicable',
  citation: cite(IRD.brightline),
  note: note ?? 'No general capital gains tax: a sale is taxed only inside the 2-year bright-line or under other land rules.',
});

const NZ_SQM = fromRow(NZ_SQUARE_METRE_RATE_ROWS, '2025-04-01', { label: 'Home office square-metre rate (utilities)', currency: 'NZD', per: 'sq_m', appliesTo: '2026 income year (1 April 2025 – 31 March 2026)' });

const NZ: HomeRules = {
  supported: true,
  country: 'NZ',
  taxYear: '1 April to 31 March (named for the year it ends)',
  questions: [
    {
      id: 'taxpayerRole',
      field: 'taxpayerRole',
      prompt: 'Are you an employee, self-employed, or do you own a company that uses your home?',
      askWhen: { businessPercentAboveZero: true },
      options: [
        {
          id: 'employee',
          label: 'An employee',
          effects: { deduction: { basis: 'none', citation: cite(IRD.homeOffice), note: 'Only a tax-free reimbursement from your employer.' }, sale: nzSale() },
        },
        {
          id: 'self_employed',
          label: 'Self-employed',
          effects: { deduction: { basis: 'occupancy_at_share', citation: cite(IRD.homeOffice), note: 'See the next question for the method.' }, sale: nzSale() },
        },
        {
          id: 'company',
          label: 'I own a company that uses my home',
          effects: {
            deduction: { basis: 'none', citation: cite(IRD.homeOffice), note: 'The company pays you a fair reimbursement for the use of your home: exempt to you, deductible to the company.' },
            sale: nzSale(),
          },
        },
      ],
    },
    {
      id: 'homeOfficeMethod',
      field: 'businessUse',
      prompt: 'Square-metre rate for utilities, or actual utility costs?',
      askWhen: { businessPercentAboveZero: true, roles: ['self_employed'] },
      options: [
        {
          id: 'square_metre_rate',
          label: 'The square-metre rate',
          effects: {
            deduction: {
              basis: 'occupancy_at_share',
              citation: cite(IRD.homeOffice),
              figures: [NZ_SQM],
              note: 'The rate × office area for utilities, plus the area share of rates, insurance and mortgage interest (not principal). No depreciation on the home itself.',
            },
            sale: nzSale(),
          },
        },
        {
          id: 'actual_costs',
          label: 'Actual costs',
          effects: {
            deduction: { basis: 'occupancy_at_share', citation: cite(IRD.homeOffice), note: 'Area share of utilities, rates, insurance and mortgage interest (not principal).' },
            sale: nzSale(),
          },
        },
      ],
    },
    {
      id: 'homeLodgers',
      field: 'rentalArrangement',
      prompt: 'Who lives with you and pays?',
      askWhen: { rentalPercentAboveZero: true, kinds: ['home'] },
      options: [
        {
          id: 'flatmates',
          label: 'Flatmates paying you (you own the home)',
          effects: {
            deduction: { basis: 'occupancy_at_share', citation: cite(IRD.room), note: 'Rent is income; split the shared expenses.' },
            sale: nzSale('A flatmate does not stop the home being your main home for the bright-line test.'),
          },
        },
        {
          id: 'boarders_1_to_4',
          label: 'One to four boarders or home-stay students',
          effects: {
            deduction: {
              basis: 'flat_rate',
              citation: cite(HOME_RATE_URLS.nzBoarderStandardCost),
              figures: [fromRow(NZ_BOARDER_STANDARD_COST_ROWS, '2025-04-01', { label: 'Standard cost per boarder', currency: 'NZD', per: 'week', appliesTo: '2025–2026 income year' })],
              note: 'If the income per boarder is at or under the standard cost, no tax and no return.',
            },
            sale: nzSale(),
          },
        },
        {
          id: 'boarders_5_plus',
          label: 'Five or more boarders',
          effects: { deduction: { basis: 'occupancy_at_share', citation: cite(HOME_RATE_URLS.nzBoarderStandardCost), note: 'Actual costs.' }, sale: nzSale() },
        },
        {
          id: 'passed_to_landlord',
          label: 'I collect flatmates\' rent and pass it to my landlord',
          effects: { deduction: { basis: 'none', citation: cite(IRD.room), note: 'Not income.' }, sale: nzSale() },
        },
      ],
    },
  ],
  notes: [
    { id: 'nz-brightline', text: 'Selling within 2 years of title transfer (from 1 July 2024): the main home exclusion needs over half the area used as your main home for over half the time.', forAccountant: true, status: 'verified', citation: cite(IRD.qb2402) },
    { id: 'nz-2027-rates', text: 'The 2027 income year square-metre rate and boarder standard cost were not found.', forAccountant: true, status: 'unverified' },
    { id: 'nz-dedicated-area', text: 'Whether the square-metre method needs a dedicated area was implied, not quoted.', forAccountant: true, status: 'unverified' },
    { id: 'nz-family-costs', text: 'Whether family members contributing to household costs is income: no IRD page found.', forAccountant: true, status: 'unverified' },
    { id: 'nz-company-sale', text: 'The effect at sale of a company paying for the use of your home was not verified.', forAccountant: true, status: 'unverified' },
  ],
};

// ─── India ──────────────────────────────────────────────────────────────────

const INCOME_TAX_IN = {
  houseProperty: 'https://www.incometaxindia.gov.in/w/income-from-house-property%E2%80%8B',
  s54: 'https://www.incometaxindia.gov.in/w/section-54-exemption-to-capital-gains-arising-on-transfer-of-residential-house-property',
  salaried: 'https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable-1',
  newAct: 'https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/objective-and-scope-new-act-faq',
};

const IN: HomeRules = {
  supported: true,
  country: 'IN',
  taxYear: '1 April to 31 March (Tax Year 2026-27 onward under the Income-tax Act, 2025)',
  questions: [
    {
      id: 'homeLetOut',
      field: 'rentalArrangement',
      prompt: 'Is part of the home let out?',
      askWhen: { rentalPercentAboveZero: true },
      options: [
        {
          id: 'let_out',
          label: 'Yes — part of the home is let out',
          effects: {
            deduction: {
              basis: 'flat_rate',
              citation: cite(INCOME_TAX_IN.houseProperty),
              figures: [{ label: 'Standard deduction on the let unit\'s net annual value', amount: 30, currency: null, per: 'percent_of_value', appliesTo: 'Finance Act 2026 text', citation: cite(INCOME_TAX_IN.houseProperty) }],
              note: 'Each unit is a separate property: the let part is income from house property (net annual value less 30%, less interest); the part you live in is self-occupied.',
            },
            sale: { effect: 'not_applicable', citation: cite(INCOME_TAX_IN.s54), note: 'There is no main-residence exemption to reduce.' },
          },
        },
      ],
    },
  ],
  notes: [
    { id: 'in-no-home-office', text: 'No working-from-home deduction for salaried people appears in the official salaried deduction list (an absence finding).', forAccountant: false, status: 'verified', citation: cite(INCOME_TAX_IN.salaried) },
    { id: 'in-no-main-residence-exemption', text: 'There is no main-residence exemption: a gain on selling a home is taxable unless reinvested in a residential house (s54 of the 1961 Act).', forAccountant: false, status: 'verified', citation: cite(INCOME_TAX_IN.s54) },
    { id: 'in-new-act', text: 'The Income-tax Act, 2025 applies from 1 April 2026. Section numbers here are 1961 Act numbers; the only confirmed mappings are s115BAC → s202 and s44AD/44ADA/44AE → s58. The mapping for s54 and the house-property sections is not confirmed.', forAccountant: true, status: 'verified', citation: cite(INCOME_TAX_IN.newAct) },
    { id: 'in-business-use', text: 'Business or professional use of the home (a fair proportionate part of rent, repairs and taxes; depreciation; s50 and s54 treatment of that part) is for an accountant — seen only in a search excerpt.', forAccountant: true, status: 'search-excerpt' },
    { id: 'in-family-costs', text: 'Whether family members sharing costs, or paying guests, is income: no CBDT page found.', forAccountant: true, status: 'unverified' },
  ],
};

// ─── Lookup ─────────────────────────────────────────────────────────────────

const RULES: Record<string, HomeRules> = { AU, GB, US, CA, NZ, IN };

/** 'UK' is accepted for GB, as elsewhere in the package. */
const ALIASES: Record<string, string> = { UK: 'GB' };

/** The home rules for a country, or `{ supported: false }` where none are modelled. Returns a copy — safe to mutate. */
export function homeRulesFor(country: string): HomeRules | HomeRulesUnsupported {
  const code = String(country ?? '').trim().toUpperCase();
  const rules = RULES[ALIASES[code] ?? code];
  if (!rules) return { supported: false, country: code };
  return JSON.parse(JSON.stringify(rules)) as HomeRules;
}

export interface PlaceFactsForQuestions {
  kind?: string | null;
  businessPercent?: number | null;
  rentalPercent?: number | null;
  taxpayerRole?: TaxpayerRole | null;
}

/** Whether a question should be asked for a place, given its facts and whether it already has an answer. */
export function shouldAsk(q: Question, facts: PlaceFactsForQuestions, answered = false): boolean {
  const w = q.askWhen;
  const conditions =
    (!w.kinds || (facts.kind != null && w.kinds.includes(facts.kind))) &&
    (!w.notKinds || facts.kind == null || !w.notKinds.includes(facts.kind)) &&
    (!w.businessPercentAboveZero || (facts.businessPercent ?? 0) > 0) &&
    (!w.rentalPercentAboveZero || (facts.rentalPercent ?? 0) > 0) &&
    (!w.roles || (facts.taxpayerRole != null && w.roles.includes(facts.taxpayerRole)));
  if (conditions) return true;
  // The app keeps showing an answered business-use question (see AskWhen.alsoWhenAnswered) while the share is above zero.
  return Boolean(w.alsoWhenAnswered && answered && (!w.businessPercentAboveZero || (facts.businessPercent ?? 0) > 0));
}

/** The questions to ask for a place, in order. `answered` lists question ids that already have an answer. */
export function homeQuestionsFor(country: string, facts: PlaceFactsForQuestions, answered: string[] = []): Question[] {
  const rules = homeRulesFor(country);
  if (!rules.supported) return [];
  return rules.questions.filter((q) => shouldAsk(q, facts, answered.includes(q.id)));
}

/** Every figure in a rules object, with where it sits — used by the citation test and by Rate Watch consumers. */
export function allFigures(rules: HomeRules): Array<{ path: string; figure: Figure }> {
  const out: Array<{ path: string; figure: Figure }> = [];
  for (const q of rules.questions) {
    for (const o of q.options) {
      for (const side of ['deduction', 'sale'] as const) {
        (o.effects[side].figures ?? []).forEach((figure, i) => out.push({ path: `${q.id}.${o.id}.${side}.figures[${i}]`, figure }));
      }
    }
  }
  return out;
}
