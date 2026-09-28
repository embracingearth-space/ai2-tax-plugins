/**
 * Input specs for the home and property decisions — ai2fin.com
 *
 * One description per decision and field: the label and hint a form shows,
 * the unit, the bounds, and the rules (HomePropertyRuleKey) that explain why
 * the field matters. The app, the website and the Tax MCP render the same
 * form from this, and the bounds are the guards' own (./inputGuards), so a
 * form can never accept a value the decision will refuse.
 *
 * Field names are the scenario inputs (./scenarioFromYears); `handoffKey` is
 * the short key the website → app payload uses (./handoff).
 */

import { MAX_HOURS_PER_YEAR, MAX_WEEKS_PER_YEAR } from './inputGuards';
import type { HomePropertyRuleKey } from './homePropertyRules';

export type DecisionKind = 'space' | 'moving' | 'someone';

export type InputUnit =
  | 'percent'
  | 'money'
  | 'money_per_year'
  | 'money_per_week'
  | 'money_per_hour'
  | 'hours_per_year'
  | 'weeks_per_year'
  | 'years'
  | 'boolean';

export interface InputSpec {
  label: string;
  hint: string;
  unit: InputUnit;
  /** Inclusive; null = no bound. Booleans have neither. */
  min: number | null;
  max: number | null;
  integer: boolean;
  /** Required by the decision (a form must ask for it). */
  required: boolean;
  /** The rules that explain why this field changes the answer. */
  rules: HomePropertyRuleKey[];
  handoffKey: string;
}

/** 0–100, as the guards' `percent`. */
const PCT = { min: 0, max: 100, integer: false } as const;
/** ≥ 0 with no upper bound, as the guards' `amount`. */
const AMOUNT = { min: 0, max: null, integer: false } as const;
/** Whole years 1–50, as the guards' `years`. */
const YEARS = { min: 1, max: 50, integer: true } as const;

const marginalRate: InputSpec = {
  label: 'Your marginal tax rate',
  hint: 'The rate on your next dollar of income, including the Medicare levy if you want it counted. Every figure uses this one rate.',
  unit: 'percent',
  ...PCT,
  required: true,
  rules: [],
  handoffKey: 'mr',
};

const years = (hint: string): InputSpec => ({ label: 'Years', hint, unit: 'years', ...YEARS, required: true, rules: ['cgtDiscount'], handoffKey: 'y' });

export const INPUT_SPECS: Record<DecisionKind, Record<string, InputSpec>> = {
  space: {
    marginalRatePct: marginalRate,
    businessSharePct: {
      label: 'Business share of the home',
      hint: 'The floor area set aside for the business, as a percent of the whole home.',
      unit: 'percent',
      ...PCT,
      required: true,
      rules: ['occupancyByFloorAreaAndTime', 'partialExemptionFollowsInterest'],
      handoffKey: 'sh',
    },
    occupancyCostsPerYear: {
      label: 'Occupancy costs a year',
      hint: 'Mortgage interest or rent, council rates, land tax and home insurance for the whole home.',
      unit: 'money_per_year',
      ...AMOUNT,
      required: true,
      rules: ['occupancyOnlyPlaceOfBusiness'],
      handoffKey: 'oc',
    },
    workHoursPerYear: {
      label: 'Hours worked from home a year',
      hint: `At most ${MAX_HOURS_PER_YEAR.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}, the hours in a year.`,
      unit: 'hours_per_year',
      min: 0,
      max: MAX_HOURS_PER_YEAR,
      integer: false,
      required: false,
      rules: ['runningExpensesAnyWorkArea'],
      handoffKey: 'hr',
    },
    runningCostPerHour: {
      label: 'Running costs per hour',
      hint: 'For example the ATO fixed rate per work hour. Running costs are claimable either way.',
      unit: 'money_per_hour',
      ...AMOUNT,
      required: false,
      rules: ['runningExpensesAnyWorkArea'],
      handoffKey: 'co',
    },
    years: years('Income years of claims; the home is taken to be sold at the end of the last one.'),
    expectedGrowth: {
      label: 'Expected growth in the home\'s value',
      hint: 'Over those years, for the whole home.',
      unit: 'money',
      ...AMOUNT,
      required: true,
      rules: ['homeFirstUsedToProduceIncome', 'cgtDiscount'],
      handoffKey: 'g',
    },
    ownershipPct: {
      label: 'Your share of the home',
      hint: 'A co-owner who does not run the business keeps the full exemption on their share.',
      unit: 'percent',
      ...PCT,
      required: false,
      rules: ['coOwnerNotInBusiness'],
      handoffKey: 'os',
    },
  },
  moving: {
    marginalRatePct: marginalRate,
    years: years('Until both homes are sold.'),
    producesIncome: {
      label: 'The home you are leaving will be rented out',
      hint: 'A rented former home can stay your main residence for up to 6 years of each absence.',
      unit: 'boolean',
      min: null,
      max: null,
      integer: false,
      required: false,
      rules: ['sixYearRule'],
      handoffKey: 'r',
    },
    leavingGrowth: {
      label: 'Growth in the home you are leaving',
      hint: 'Over those years, for the whole home.',
      unit: 'money',
      ...AMOUNT,
      required: true,
      rules: ['sixYearRule', 'oneMainResidence'],
      handoffKey: 'og',
    },
    movingGrowth: {
      label: 'Growth in the home you are moving to',
      hint: 'Over those years, for the whole home.',
      unit: 'money',
      ...AMOUNT,
      required: true,
      rules: ['oneMainResidence'],
      handoffKey: 'ng',
    },
  },
  someone: {
    marginalRatePct: marginalRate,
    weeklyRent: {
      label: 'Rent a week',
      hint: 'What a lodger would pay at market rent.',
      unit: 'money_per_week',
      ...AMOUNT,
      required: true,
      rules: ['lodgerLetShare'],
      handoffKey: 'wk',
    },
    exclusivePct: {
      label: 'Their room',
      hint: 'Floor area only they use, as a percent of the home.',
      unit: 'percent',
      ...PCT,
      required: true,
      rules: ['lodgerLetShare', 'floorAreaAndDaysApportionment'],
      handoffKey: 'rm',
    },
    sharedPct: {
      label: 'Shared areas',
      hint: 'Kitchen, living room and bathroom you both use; half of it counts as theirs.',
      unit: 'percent',
      ...PCT,
      required: false,
      rules: ['lodgerLetShare'],
      handoffKey: 'cm',
    },
    weeksLetPerYear: {
      label: 'Weeks let a year',
      hint: `At most ${MAX_WEEKS_PER_YEAR}.`,
      unit: 'weeks_per_year',
      min: 0,
      max: MAX_WEEKS_PER_YEAR,
      integer: false,
      required: false,
      rules: ['lodgerLetShare'],
      handoffKey: 'wh',
    },
    homeCostsPerYear: {
      label: 'Home costs a year (your share)',
      hint: 'Interest, rates, insurance and repairs: your share of the whole home\'s costs.',
      unit: 'money_per_year',
      ...AMOUNT,
      required: true,
      rules: ['lodgerLetShare'],
      handoffKey: 'hc',
    },
    years: years('Letting until the home is sold.'),
    expectedGrowth: {
      label: 'Expected growth in the home\'s value',
      hint: 'Over those years, for the whole home.',
      unit: 'money',
      ...AMOUNT,
      required: true,
      rules: ['homeFirstUsedToProduceIncome', 'cgtDiscount'],
      handoffKey: 'g',
    },
  },
};

/** Whether a value is within a spec's bounds (the same test the guards apply). Booleans: true/false only. */
export function withinSpec(spec: InputSpec, value: unknown): boolean {
  if (spec.unit === 'boolean') return value === true || value === false;
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (spec.integer && !Number.isInteger(value)) return false;
  if (spec.min !== null && value < spec.min) return false;
  if (spec.max !== null && value > spec.max) return false;
  return true;
}
