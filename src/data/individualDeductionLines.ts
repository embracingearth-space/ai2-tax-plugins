/**
 * The deduction lines of each country's individual tax return, in the form's
 * own words and order — ai2fin.com
 *
 * The same idea as the rental form lines (the app's lib/propertyLines): a
 * category can carry the return line it belongs to, so an employee's costs
 * group and export the way the return asks for them — "D1 Work-related car
 * expenses", "D3 Work clothing, laundry and dry-cleaning expenses" — instead
 * of one blanket "Other work-related".
 *
 * Each line says which field of this package's individual return plugin it
 * feeds (AU: the AU-IT plugin's deduction field ids), what it covers in the
 * authority's words, typical category names and keywords for suggesting it,
 * and the page it was read from with the page's own "Last updated" date and
 * the day it was read. Where a line has calculation methods (D1 car: cents per
 * km or logbook; D5 working from home: fixed rate or actual cost), the method
 * names the rate lookup it uses, so no rate is copied here.
 *
 * COUNTRIES. Australia only for now: every AU line below was read on the
 * ATO's 2026 individual and supplementary tax return instructions on
 * 28 September 2026 (UTC). GB (P87 / SA102), US (Schedule A), CA (T777 / line
 * 22900), NZ and IN equivalents have not been verified on the authorities'
 * pages, so `individualDeductionLines` returns null for them rather than a
 * guessed list.
 */

import {
  AU_CENTS_PER_KM_MAX_BUSINESS_KM,
  centsPerKmRate,
  workFromHomeFixedRate,
  type AuDeductionRate,
  type AuIncomeYearInput,
} from '../countries/australiaDeductions';

export const INDIVIDUAL_DEDUCTION_LINES_CHECKED = '2026-09-28';

export interface DeductionLineSource {
  label: string;
  url: string;
  /** The page's own "Last updated" date. */
  pageLastUpdated: string;
  /** YYYY-MM-DD (UTC) the page was read. */
  readOn: string;
}

export type DeductionRateLookup = 'centsPerKmRate' | 'workFromHomeFixedRate';

export interface DeductionMethod {
  key: 'cents_per_km' | 'logbook' | 'fixed_rate' | 'actual_cost';
  label: string;
  description: string;
  /** The rate lookup the method uses (see methodRate); absent where the method uses actual costs. */
  rateLookup?: DeductionRateLookup;
  /** A cap on the quantity the rate applies to. */
  cap?: { amount: number; unit: 'km' };
  /** The individual return field the method's amount feeds, where it differs from the line's. */
  feedsField?: string;
}

export interface IndividualDeductionLine {
  /** Stable, for storing on a category: country prefix and a slug. */
  key: string;
  /** The form's reference: "D1". */
  ref: string;
  /** The form's own words. */
  label: string;
  /** Which return the question is on. */
  form: 'individual' | 'supplementary';
  /** What it covers, in the authority's terms. */
  description: string;
  /** Who incurs it: an employee's work expense, an investor's, or anyone's. */
  expenseType: 'employee' | 'investment' | 'any';
  /** Typical category names that belong on this line. */
  categories: string[];
  /** Lower-case words that suggest this line for a transaction or category. */
  keywords: string[];
  /** The field of this package's individual return plugin (AU-IT) the line feeds; null where the plugin has none. */
  feedsField: string | null;
  /** Parts of the line fed to a more specific plugin field. */
  subFields?: Array<{ field: string; covers: string }>;
  methods?: DeductionMethod[];
  note?: string;
  source: DeductionLineSource;
}

export interface IndividualDeductionForm {
  country: 'AU';
  /** The form, as a sentence would name it. */
  name: string;
  /** The individual return plugin the lines feed. */
  plugin: 'AU-IT';
  source: DeductionLineSource;
  lines: IndividualDeductionLine[];
}

const READ_ON = INDIVIDUAL_DEDUCTION_LINES_CHECKED;
const ITR = 'https://www.ato.gov.au/forms-and-instructions/individual-tax-return-2026-instructions/deduction-questions-d1-d10-individual-tax-return-2026';
const SUPP =
  'https://www.ato.gov.au/forms-and-instructions/individual-supplementary-tax-return-2026-instructions/deduction-questions-d11-d15-supplementary-tax-return-2026';

const itr = (slug: string, title: string, pageLastUpdated = '2026-05-30'): DeductionLineSource => ({
  label: `ATO — ${title} (Individual tax return instructions 2026)`,
  url: `${ITR}/${slug}`,
  pageLastUpdated,
  readOn: READ_ON,
});
const supp = (slug: string, title: string): DeductionLineSource => ({
  label: `ATO — ${title} (Individual supplementary tax return instructions 2026)`,
  url: `${SUPP}/${slug}`,
  pageLastUpdated: '2026-05-30',
  readOn: READ_ON,
});

const AU: IndividualDeductionForm = {
  country: 'AU',
  name: 'ATO individual tax return deductions (D1–D15)',
  plugin: 'AU-IT',
  source: {
    label: 'ATO — Deduction questions D1-D10, Individual tax return 2026',
    url: ITR,
    pageLastUpdated: '2026-05-30',
    readOn: READ_ON,
  },
  lines: [
    {
      key: 'au.d1_car',
      ref: 'D1',
      label: 'Work-related car expenses',
      form: 'individual',
      description:
        'Expenses as an employee for a car you owned, leased or hired under hire purchase, for work-related trips: decline in value, registration, insurance, maintenance and cleaning, repairs, fuel. Not normal trips between home and your regular place of work.',
      expenseType: 'employee',
      categories: ['Car expenses', 'Fuel', 'Car insurance', 'Car registration', 'Car repairs and servicing'],
      keywords: ['fuel', 'petrol', 'diesel', 'rego', 'registration', 'car insurance', 'service', 'tyres', 'car wash', 'logbook'],
      feedsField: 'work_related_car',
      methods: [
        {
          key: 'cents_per_km',
          label: 'Cents per kilometre',
          description: 'A set rate per work kilometre, up to 5,000 work-related kilometres per car per year. No written evidence is needed, but you need a record that shows how you work out your work-related kilometres.',
          rateLookup: 'centsPerKmRate',
          cap: { amount: AU_CENTS_PER_KM_MAX_BUSINESS_KM, unit: 'km' },
        },
        {
          key: 'logbook',
          label: 'Logbook',
          description: 'The work-related use percentage, from your logbook and odometer records, of all your car expenses.',
        },
      ],
      source: itr('d1-work-related-car-expenses-2026', 'D1 Work-related car expenses 2026'),
    },
    {
      key: 'au.d2_travel',
      ref: 'D2',
      label: 'Work-related travel expenses',
      form: 'individual',
      description:
        'Travel in the course of performing your work: taxi, ride-share and public transport fares, airfares, short-term car hire, tolls and parking; overnight travel meals, accommodation and incidentals; expenses for a vehicle that is not yours or not a car (motorcycles, utes of one tonne or more).',
      expenseType: 'employee',
      categories: ['Work travel', 'Parking and tolls', 'Airfares', 'Accommodation (work travel)'],
      keywords: ['uber', 'taxi', 'train', 'bus', 'airfare', 'flight', 'toll', 'parking', 'hotel', 'accommodation', 'car hire'],
      feedsField: 'work_related_travel',
      source: itr('d2-work-related-travel-expenses-2026', 'D2 Work-related travel expenses 2026'),
    },
    {
      key: 'au.d3_clothing',
      ref: 'D3',
      label: 'Work clothing, laundry and dry-cleaning expenses',
      form: 'individual',
      description:
        'Protective clothing and footwear, a compulsory or registered non-compulsory uniform, or occupation-specific clothing, and the cost of laundering, dry-cleaning or repairing it. Not plain clothes, even if your employer requires them.',
      expenseType: 'employee',
      categories: ['Work clothing and uniforms', 'Laundry and dry-cleaning (work clothes)'],
      keywords: ['uniform', 'steel cap', 'boots', 'hi-vis', 'protective', 'dry cleaning', 'laundry', 'overalls', 'scrubs'],
      feedsField: 'work_related_clothing',
      note: 'Laundering work clothes yourself: a reasonable basis is $1 a load of work clothes only, 50c a mixed load.',
      source: itr('d3-work-clothing-laundry-and-dry-cleaning-expenses-2026', 'D3 Work clothing, laundry and dry-cleaning expenses 2026'),
    },
    {
      key: 'au.d4_self_education',
      ref: 'D4',
      label: 'Work-related self-education expenses',
      form: 'individual',
      description:
        'A course, conference, seminar or self-paced learning with a sufficient connection to your current employment — it maintains or improves the skills your job needs, or is likely to increase your income from it. Not for new employment, and not if reimbursed.',
      expenseType: 'employee',
      categories: ['Self-education', 'Courses and training', 'Conferences'],
      keywords: ['course', 'tuition', 'university', 'tafe', 'conference', 'seminar', 'textbook', 'training', 'certification'],
      feedsField: 'self_education',
      source: itr('d4-work-related-self-education-expenses-2026', 'D4 Work-related self-education expenses 2026'),
    },
    {
      key: 'au.d5_other_work',
      ref: 'D5',
      label: 'Other work-related expenses',
      form: 'individual',
      description:
        'Other expenses as an employee: union fees and professional subscriptions, overtime meals (under an award), reference books and journals, the work-related share of tools, equipment, computers and phones, protective items (hard hats, safety glasses, sunscreen), and working from home.',
      expenseType: 'employee',
      categories: ['Union and professional fees', 'Tools and equipment', 'Phone and internet (work)', 'Working from home', 'Subscriptions (work)'],
      keywords: ['union', 'membership', 'subscription', 'tools', 'laptop', 'computer', 'phone', 'internet', 'stationery', 'journal', 'sunscreen', 'hard hat'],
      feedsField: 'other_deductions',
      subFields: [{ field: 'work_from_home', covers: 'working from home expenses (fixed rate or actual cost)' }],
      methods: [
        {
          key: 'fixed_rate',
          label: 'Working from home — fixed rate',
          description:
            'A rate per hour worked from home covering energy, internet and data, phone, stationery and computer consumables; needs a record of all hours worked from home for the year. Decline in value of equipment is claimed separately.',
          rateLookup: 'workFromHomeFixedRate',
          feedsField: 'work_from_home',
        },
        {
          key: 'actual_cost',
          label: 'Working from home — actual cost',
          description: 'The actual additional running expenses from working from home, with records of the costs and the work-related share.',
          feedsField: 'work_from_home',
        },
      ],
      source: itr('d5-other-work-related-expenses-2026', 'D5 Other work-related expenses 2026'),
    },
    {
      key: 'au.d6_low_value_pool',
      ref: 'D6',
      label: 'Low-value pool deduction',
      form: 'individual',
      description:
        'The decline in value of low-cost assets (costing less than $1,000) and low-value assets allocated to a low-value pool and used to produce assessable income. One pool only.',
      expenseType: 'any',
      categories: [],
      keywords: ['low-value pool'],
      feedsField: 'other_deductions',
      note: 'A write-off worked out from the asset register, not a payment category.',
      source: itr('d6-low-value-pool-deduction-2026', 'D6 Low-value pool deduction 2026'),
    },
    {
      key: 'au.d7_interest',
      ref: 'D7',
      label: 'Interest income deductions',
      form: 'individual',
      description:
        'Expenses of earning interest income: account-keeping fees on investment accounts, investment management fees and advice, interest on money borrowed to buy investments.',
      expenseType: 'investment',
      categories: ['Investment fees', 'Investment loan interest'],
      keywords: ['account keeping fee', 'investment advice', 'term deposit fee'],
      feedsField: 'other_deductions',
      source: itr('d7-interest-income-deductions-2026', 'D7 Interest income deductions 2026'),
    },
    {
      key: 'au.d8_dividends',
      ref: 'D8',
      label: 'Dividend deductions',
      form: 'individual',
      description:
        'Expenses of earning dividends and distributions: management fees and advice, interest on money borrowed to buy shares, investment journals and subscriptions; and 50% of a listed investment company capital gain amount.',
      expenseType: 'investment',
      categories: ['Investment fees', 'Margin loan interest', 'Investment subscriptions'],
      keywords: ['brokerage', 'margin loan', 'share advice', 'investment subscription'],
      feedsField: 'other_deductions',
      source: itr('d8-dividend-deductions-2026', 'D8 Dividend deductions 2026'),
    },
    {
      key: 'au.d9_gifts',
      ref: 'D9',
      label: 'Gifts or donations',
      form: 'individual',
      description: 'Gifts or donations to an organisation with deductible gift recipient (DGR) status, with a receipt.',
      expenseType: 'any',
      categories: ['Donations'],
      keywords: ['donation', 'charity', 'dgr', 'appeal', 'fundraiser'],
      feedsField: 'donations',
      source: itr('d9-gifts-or-donations-2026', 'D9 Gifts or donations 2026', '2026-08-03'),
    },
    {
      key: 'au.d10_tax_affairs',
      ref: 'D10',
      label: 'Cost of managing tax affairs',
      form: 'individual',
      description:
        'Preparing and lodging your tax return and activity statements (a registered tax agent, tax reference material, tax return software), tax advice from a recognised tax adviser, and dealing with the ATO.',
      expenseType: 'any',
      categories: ['Tax agent and accounting fees'],
      keywords: ['tax agent', 'accountant', 'tax return', 'tax software', 'h&r block', 'etax'],
      feedsField: 'tax_agent_fee',
      source: itr('d10-cost-of-managing-tax-affairs-2026', 'D10 Cost of managing tax affairs 2026', '2026-07-09'),
    },
    {
      key: 'au.d11_upp',
      ref: 'D11',
      label: 'Deductible amount of undeducted purchase price of a foreign pension or annuity',
      form: 'supplementary',
      description: 'The undeducted purchase price (UPP) of a foreign pension or annuity.',
      expenseType: 'any',
      categories: [],
      keywords: [],
      feedsField: null,
      note: 'Rare; not modelled in the AU-IT return.',
      source: supp('d11-deductible-amount-of-upp-of-a-foreign-pension-or-annuity-2026', 'D11 Deductible UPP amount of a foreign pension or annuity 2026'),
    },
    {
      key: 'au.d12_personal_super',
      ref: 'D12',
      label: 'Personal superannuation contributions',
      form: 'supplementary',
      description: 'A personal super contribution you are claiming a deduction for (after giving your fund a notice of intent and receiving its acknowledgement).',
      expenseType: 'any',
      categories: ['Personal super contributions'],
      keywords: ['super contribution', 'personal contribution', 'bpay super'],
      feedsField: 'other_deductions',
      source: supp('d12-personal-superannuation-contributions-2026', 'D12 Personal superannuation contributions 2026'),
    },
    {
      key: 'au.d13_project_pool',
      ref: 'D13',
      label: 'Deduction for project pool',
      form: 'supplementary',
      description: 'Certain capital expenditure allocated to a project pool.',
      expenseType: 'any',
      categories: [],
      keywords: [],
      feedsField: null,
      note: 'Rare; not modelled in the AU-IT return.',
      source: supp('d13-deduction-for-project-pool-2026', 'D13 Deduction for project pool 2026'),
    },
    {
      key: 'au.d14_forestry_mis',
      ref: 'D14',
      label: 'Forestry managed investment scheme deduction',
      form: 'supplementary',
      description: 'Payments to a forestry managed investment scheme.',
      expenseType: 'investment',
      categories: [],
      keywords: [],
      feedsField: null,
      note: 'Rare; not modelled in the AU-IT return.',
      source: supp('d14-forestry-managed-investment-scheme-deduction-2026', 'D14 Forestry managed investment scheme deduction 2026'),
    },
    {
      key: 'au.d15_other',
      ref: 'D15',
      label: 'Other deductions — not claimable at D1 to D14 or elsewhere',
      form: 'supplementary',
      description: 'Deductions not claimable at D1 to D14 or elsewhere, including income protection, sickness and accident insurance premiums, and election expenses.',
      expenseType: 'any',
      categories: ['Income protection insurance'],
      keywords: ['income protection', 'sickness insurance', 'accident insurance'],
      feedsField: 'other_deductions',
      subFields: [{ field: 'income_protection', covers: 'income protection, sickness and accident insurance premiums' }],
      source: supp('d15-other-deductions-not-claimable-elsewhere-in-your-tax-return-2026', 'D15 Other deductions not claimable elsewhere in your tax return 2026'),
    },
  ],
};

const FORMS: Record<string, IndividualDeductionForm> = { AU };

/**
 * The deduction lines of a country's individual tax return, or null where they
 * have not been verified on the authority's pages. Returns a copy.
 */
export function individualDeductionLines(country: string): IndividualDeductionForm | null {
  const form = FORMS[String(country ?? '').trim().toUpperCase()];
  return form ? (JSON.parse(JSON.stringify(form)) as IndividualDeductionForm) : null;
}

/** The line with this key ('au.d1_car'), or null. */
export function individualDeductionLine(key: string): IndividualDeductionLine | null {
  const country = String(key ?? '').split('.')[0].toUpperCase();
  return individualDeductionLines(country)?.lines.find((l) => l.key === key) ?? null;
}

/**
 * The rate a method uses for an income year — the package's own effective-dated
 * lookup, so a rate is never copied into the line data. null for a method that
 * uses actual costs.
 */
export function methodRate(method: DeductionMethod, incomeYear: AuIncomeYearInput): AuDeductionRate | null {
  if (method.rateLookup === 'centsPerKmRate') return centsPerKmRate(incomeYear);
  if (method.rateLookup === 'workFromHomeFixedRate') return workFromHomeFixedRate(incomeYear);
  return null;
}
