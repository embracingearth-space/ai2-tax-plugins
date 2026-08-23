/**
 * Canada — capital cost allowance — ai2fin.com
 * Authority: Canada Revenue Agency (CRA)
 *
 * Canada is a CLASS regime. Depreciable property is not written down item by
 * item: it is grouped into numbered classes, each with a prescribed rate, and
 * capital cost allowance (CCA) is that rate on the class's undepreciated
 * capital cost (UCC) each year, on a declining-balance basis. An asset in this
 * module is a contribution to a class; the class is the unit of allowance.
 *
 * Everything below was read from canada.ca on 2026-08-24:
 *   CRA › Claiming capital cost allowance › Classes of depreciable property
 *   (page dated 2025); › Accelerated investment incentive (2025-07-21);
 *   › Basic information about capital cost allowance (2025-06-05);
 *   Guide T4002, Chapter 4 – Capital cost allowance (columns 5, 7, 18, 19, 21, 22).
 *
 * Classes shipped, verbatim rates: 1 (4%) buildings; 8 (20%) furniture,
 * appliances, tools costing $500 or more, machinery, photocopiers, phone
 * equipment — the catch-all for "property that is not included in another
 * class"; 10 (30%) motor vehicles and passenger vehicles under the cap;
 * 10.1 (30%) a passenger vehicle that cost more than the prescribed amount
 * before tax — $30,000 before 2022, $34,000 in 2022, $36,000 in 2023, $37,000
 * in 2024, $38,000 in 2025 — each listed separately, no recapture or terminal
 * loss, and the half-year rule on sale; 12 (100%) tools under $500 (no
 * half-year rule) and non-systems software (half-year rule applies); 14.1 (5%)
 * goodwill and unlimited-period licences (7% for pre-2017 property until
 * 2027); 50 (55%) general-purpose computers and systems software acquired
 * after 18 March 2007; 54 (30%) and 55 (40%) zero-emission vehicles with the
 * enhanced first-year allowance of 100% before 2024, 75% in 2024-2025, 55% in
 * 2026-2027, and a $61,000 cap for a class 54 passenger vehicle.
 *
 * THE HALF-YEAR RULE AND THE ACCELERATED INVESTMENT INCENTIVE. "In the year
 * you acquire a depreciable property, you can usually claim CCA only on
 * one-half of your net additions to a class." The AII — property acquired
 * after 20 November 2018 and available for use before 2028 — suspends the
 * half-year rule and, for property available for use before 2024, applies the
 * rate to one-and-a-half times the net addition (three times the normal
 * first-year claim). For property available for use in 2024 to 2027 "the
 * enhanced first-year allowance is reduced to two times the normal first-year
 * CCA deduction. The incentive continues to effectively suspend the half-year
 * rule" — that is, the full class rate on the net addition, nothing added.
 * The AII's general rule does not apply to classes 43.1, 43.2, 53, 54, 55 and
 * 56, nor to non-arm's-length or rollover acquisitions.
 *
 * CCA IS OPTIONAL: "You can claim any amount you like, from zero to the
 * maximum allowed for the year." A fiscal period shorter than 365 days
 * prorates the claim by days over 365.
 *
 * PROPOSED CHANGES. The classes page says "under proposed changes" nineteen
 * times — a reinstated 100% for zero-emission vehicles acquired after 2024, a
 * 100% first-year deduction for class 50 computers acquired after 15 April
 * 2024, a 10% rate for new purpose-built rental buildings, a "reaccelerated
 * investment incentive" for property acquired after 2024. None of these is
 * shipped as a rate: each is a `verified: false` note beside the enacted
 * figure, so the UI can say it exists without printing it as the answer.
 *
 * Reference: https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/sole-proprietorships-partnerships/report-business-income-expenses/claiming-capital-cost-allowance.html
 * Reference: https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/sole-proprietorships-partnerships/report-business-income-expenses/claiming-capital-cost-allowance/classes-depreciable-property.html
 * Reference: https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/sole-proprietorships-partnerships/report-business-income-expenses/claiming-capital-cost-allowance/accelerated-investment-incentive.html
 * Reference: https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/sole-proprietorships-partnerships/report-business-income-expenses/claiming-capital-cost-allowance/basic-information-about-capital-cost-allowance.html
 * Reference: https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4002/t4002-6.html
 */

import { toYmd } from '../data/rateLedger';
import {
  computeBalancingAdjustment,
  computeDeclineInValue,
  type AssetFieldSpec,
  type BalancingAdjustmentInput,
  type BalancingAdjustmentOutcome,
  type CaAssetInput,
  type CaCcaClass,
  type CaClassAssignment,
  type CaFirstYearOutcome,
  type CaVehicleCapOutcome,
  type ClassCcaRules,
  type DeclineInValueInput,
  type DeclineInValueOutcome,
  type DepreciationExplainer,
  type EffectiveLifeCategory,
  type FirstYearConcession,
  type InstantAssetWriteOffInfo,
} from '../depreciation';

const CRA_BASE =
  'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/sole-proprietorships-partnerships/report-business-income-expenses/claiming-capital-cost-allowance';
const CRA_OVERVIEW = `${CRA_BASE}.html`;
const CRA_CLASSES = `${CRA_BASE}/classes-depreciable-property.html`;
const CRA_AII = `${CRA_BASE}/accelerated-investment-incentive.html`;
const CRA_BASIC = `${CRA_BASE}/basic-information-about-capital-cost-allowance.html`;
const CRA_T4002_CH4 = 'https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4002/t4002-6.html';

/** The canada.ca pages these rules were read from. */
export const CA_DEPRECIATION_AUTHORITY_URLS = {
  overview: CRA_OVERVIEW,
  classes: CRA_CLASSES,
  acceleratedInvestmentIncentive: CRA_AII,
  basicInformation: CRA_BASIC,
  t4002Chapter4: CRA_T4002_CH4,
} as const;

// ─── Dates ──────────────────────────────────────────────────────────────────

/** The AII applies to property acquired AFTER this date. */
export const CA_AII_ACQUIRED_AFTER = '2018-11-20';
/** ... and available for use BEFORE this year. */
export const CA_AII_AVAILABLE_BEFORE_YEAR = 2028;
/** The phase-out begins for property available for use after 2023. */
export const CA_AII_PHASE_OUT_FROM_YEAR = 2024;
/** Class 50 is for computers acquired after this date; earlier ones are class 10. */
export const CA_CLASS_50_ACQUIRED_AFTER = '2007-03-18';
/** Classes 54 and 55 are for zero-emission vehicles acquired after this date. */
export const CA_ZEV_ACQUIRED_AFTER = '2019-03-18';

function yearOf(ymd: string): number {
  return Number(ymd.slice(0, 4));
}

function ymdOrNull(d: Date | string | null | undefined): string | null {
  return d == null ? null : toYmd(d);
}

// ─── Classes ────────────────────────────────────────────────────────────────

export interface CaCcaClassRow {
  cls: CaCcaClass;
  label: string;
  /** As a fraction. */
  rate: number;
  /** What the classes page puts in this class. */
  includes: string;
  /** Whether the half-year rule ordinarily applies to additions (class 12 small tools: no). */
  halfYearRule: boolean;
  /** The AII's general rule does not apply to classes 54 and 55 (they have their own enhancement). */
  aiiEligible: boolean;
  verified: true;
  note?: string;
}

/**
 * The CRA's "Classes of depreciable property" page, the classes a small
 * business meets. Every rate here is the page's own; the page's "under
 * proposed changes" items are NOT rates here — they are notes, and they
 * surface as `verified: false` concessions.
 */
export const CA_CCA_CLASSES: readonly CaCcaClassRow[] = [
  {
    cls: '1',
    label: 'Class 1 — buildings (4%)',
    rate: 0.04,
    includes:
      'Most buildings acquired after 1987, and their wiring, lighting, plumbing, sprinklers, heating, ' +
      'air-conditioning, elevators and escalators. Land is not depreciable.',
    halfYearRule: true,
    aiiEligible: true,
    verified: true,
    note:
      'An eligible non-residential building acquired after 18 March 2007 can get an additional 6% ' +
      '(manufacturing) or 2% (other) by election; under proposed changes, new purpose-built rental ' +
      'buildings may get 10%. Neither is applied here.',
  },
  {
    cls: '8',
    label: 'Class 8 — furniture, equipment, tools $500 and over (20%)',
    rate: 0.2,
    includes:
      'Furniture, appliances, tools costing $500 or more per tool, some fixtures, machinery, outdoor ' +
      'advertising signs, refrigeration equipment, photocopiers, fax machines and electronic telephone ' +
      'equipment, and other equipment not included in another class.',
    halfYearRule: true,
    aiiEligible: true,
    verified: true,
    note:
      'Equipment costing $1,000 or more can be put in a separate class by election (a letter with the ' +
      'return for the year it was acquired): the rate is unchanged, but when everything in that class ' +
      'is disposed of the remaining UCC is a terminal loss, and any balance left after five years goes ' +
      'back to class 8. The election is yours to make; it is not applied here.',
  },
  {
    cls: '10',
    label: 'Class 10 — motor vehicles and passenger vehicles under the cap (30%)',
    rate: 0.3,
    includes:
      'Motor vehicles, and passenger vehicles that cost no more than the prescribed amount before tax. ' +
      'Also computers acquired before 23 March 2004.',
    halfYearRule: true,
    aiiEligible: true,
    verified: true,
  },
  {
    cls: '10.1',
    label: 'Class 10.1 — passenger vehicle over the cap (30%)',
    rate: 0.3,
    includes:
      'A passenger vehicle that cost more than the prescribed amount before GST/HST and PST. Each ' +
      'class 10.1 vehicle is listed in its own class, and the capital cost is capped at the prescribed ' +
      'amount plus the sales tax on it.',
    halfYearRule: true,
    aiiEligible: true,
    verified: true,
    note:
      'The recapture and terminal loss rules do not apply to a class 10.1 vehicle. In the year it is ' +
      'sold, if it was owned at the end of the previous year, 50% of the CCA that would have been ' +
      'allowed can be claimed — the half-year rule on sale.',
  },
  {
    cls: '12',
    label: 'Class 12 — tools under $500, software (100%)',
    rate: 1,
    includes:
      'Tools, medical or dental instruments and kitchen utensils costing less than $500; china, ' +
      'cutlery, linen and uniforms; computer software that is not systems software.',
    halfYearRule: false,
    aiiEligible: true,
    verified: true,
    note:
      'Most class 12 small tools are not subject to the half-year rule and are fully deductible in the ' +
      'year of purchase. Software in class 12 IS subject to the half-year rule (the AII suspends it).',
  },
  {
    cls: '14.1',
    label: 'Class 14.1 — goodwill and unlimited-period licences (5%)',
    rate: 0.05,
    includes:
      'Goodwill, and franchises, concessions or licences for an unlimited period acquired after 2016 ' +
      '(before 2017, eligible capital property).',
    halfYearRule: true,
    aiiEligible: true,
    verified: true,
    note: 'Property in this class acquired before 1 January 2017 depreciates at 7% rather than 5% for tax years ending before 2027; that transition is not applied here.',
  },
  {
    cls: '50',
    label: 'Class 50 — computers and systems software (55%)',
    rate: 0.55,
    includes:
      'General-purpose electronic data processing equipment and systems software for it, including ' +
      'ancillary equipment, acquired after 18 March 2007. Not process-control, communications-control ' +
      'or stand-alone data handling equipment.',
    halfYearRule: true,
    aiiEligible: true,
    verified: true,
    note:
      'Under proposed changes, class 50 property acquired after 15 April 2024 and available for use ' +
      'before 2027 gets a 100% first-year deduction. Proposed, so not applied here.',
  },
  {
    cls: '54',
    label: 'Class 54 — zero-emission vehicles (30%)',
    rate: 0.3,
    includes:
      'Zero-emission vehicles acquired after 18 March 2019 that would otherwise be in class 10 or ' +
      '10.1. A zero-emission passenger vehicle is capped at the prescribed amount ($61,000 from 2023) ' +
      'plus sales tax, but unlike class 10.1 it does not get a class of its own.',
    halfYearRule: true,
    aiiEligible: false,
    verified: true,
  },
  {
    cls: '55',
    label: 'Class 55 — zero-emission taxis, rental and heavy vehicles (40%)',
    rate: 0.4,
    includes: 'Zero-emission vehicles acquired after 18 March 2019 that would otherwise be in class 16 (taxis, daily-rental vehicles, freight trucks over 11,788 kg).',
    halfYearRule: true,
    aiiEligible: false,
    verified: true,
  },
];

const CLASS_BY_KEY: ReadonlyMap<string, CaCcaClassRow> = new Map(CA_CCA_CLASSES.map((c) => [c.cls, c]));

/** The row for a class, or null where the class is not on the list shipped here. */
export function caClassRow(cls: string): CaCcaClassRow | null {
  return CLASS_BY_KEY.get(String(cls).trim()) ?? null;
}

// ─── Vehicle caps — by calendar year of acquisition ─────────────────────────

export interface CaVehicleCapRow {
  /** The first calendar year this amount applies to. */
  fromYear: number;
  cap: number;
}

/**
 * Class 10.1 prescribed amounts, the classes page verbatim: "$30,000 for
 * vehicles acquired before 2022 ... $38,000 for vehicles acquired in 2025".
 * A year after the last row is NOT on the page and resolves unverified.
 */
export const CA_PASSENGER_VEHICLE_CAP_ROWS: readonly CaVehicleCapRow[] = [
  { fromYear: 0, cap: 30_000 },
  { fromYear: 2022, cap: 34_000 },
  { fromYear: 2023, cap: 36_000 },
  { fromYear: 2024, cap: 37_000 },
  { fromYear: 2025, cap: 38_000 },
];
/** The last year the classes page lists a class 10.1 amount for. */
export const CA_PASSENGER_VEHICLE_CAP_LAST_VERIFIED_YEAR = 2025;

/**
 * Class 54 zero-emission passenger vehicle limits: "$55,000 for vehicles
 * acquired after March 18, 2019, and before January 1, 2022; $59,000 ... in
 * 2022; or $61,000 for vehicles acquired after December 31, 2022".
 */
export const CA_ZEV_CAP_ROWS: readonly CaVehicleCapRow[] = [
  { fromYear: 2019, cap: 55_000 },
  { fromYear: 2022, cap: 59_000 },
  { fromYear: 2023, cap: 61_000 },
];
/** The page gives $61,000 as "after December 31, 2022" with no end: treated as verified for 2023 and later. */
export const CA_ZEV_CAP_OPEN_ENDED = true;

function resolveCap(rows: readonly CaVehicleCapRow[], year: number): CaVehicleCapRow | null {
  let found: CaVehicleCapRow | null = null;
  for (const r of rows) if (r.fromYear <= year) found = r;
  return found;
}

export function caPassengerVehicleCap(year: number): CaVehicleCapOutcome {
  const y = Number(year);
  if (!Number.isInteger(y)) throw new RangeError(`year must be a calendar year (received ${String(year)})`);
  if (y > CA_PASSENGER_VEHICLE_CAP_LAST_VERIFIED_YEAR) {
    return {
      cap: null,
      verified: false,
      note:
        `The class 10.1 prescribed amount for a passenger vehicle bought in ${y} is not on the CRA's classes ` +
        `page yet; the latest listed is $38,000 before tax for ${CA_PASSENGER_VEHICLE_CAP_LAST_VERIFIED_YEAR}. ` +
        'Check the page or ask your accountant before deciding between class 10 and 10.1.',
    };
  }
  const row = resolveCap(CA_PASSENGER_VEHICLE_CAP_ROWS, y) as CaVehicleCapRow;
  return {
    cap: row.cap,
    verified: true,
    note:
      `A passenger vehicle bought in ${y} goes in class 10.1 if it cost more than $${row.cap.toLocaleString('en-CA')} ` +
      'before GST/HST and PST; otherwise class 10. The class 10.1 capital cost is capped at that amount plus the sales tax on it.',
  };
}

export function caZeroEmissionVehicleCap(year: number): CaVehicleCapOutcome {
  const y = Number(year);
  if (!Number.isInteger(y)) throw new RangeError(`year must be a calendar year (received ${String(year)})`);
  const row = resolveCap(CA_ZEV_CAP_ROWS, y);
  if (!row) {
    return {
      cap: null,
      verified: false,
      note: 'Classes 54 and 55 are for zero-emission vehicles acquired after 18 March 2019; there is no limit for an earlier year.',
    };
  }
  return {
    cap: row.cap,
    verified: true,
    note:
      `A zero-emission passenger vehicle in class 54 bought in ${y} has its capital cost capped at ` +
      `$${row.cap.toLocaleString('en-CA')} plus federal and provincial sales taxes. It stays in class 54 with the other vehicles.`,
  };
}

// ─── Class routing ──────────────────────────────────────────────────────────

function assignment(row: CaCcaClassRow, verified = true, note?: string): CaClassAssignment {
  return {
    cls: row.cls,
    rate: row.rate,
    source: CRA_CLASSES,
    verified,
    note: note ?? row.note,
  };
}

/**
 * Which class an asset joins. A class already on the register wins; otherwise
 * the asset's `kind` and cost route it by the page's own words. Every
 * answer the page does not fully determine is `verified: false` with a note
 * — a passenger vehicle over $38,000 bought in a year the page has no cap
 * for, an asset with no kind at all.
 */
export function caClassFor(asset: CaAssetInput): CaClassAssignment {
  const cost = Math.max(0, Number(asset.cost) || 0);
  const acquired = ymdOrNull(asset.acquiredDate);
  const year = acquired ? yearOf(acquired) : null;

  if (asset.ccaClass != null && String(asset.ccaClass).trim() !== '') {
    const row = caClassRow(asset.ccaClass);
    if (row) return assignment(row);
    return {
      cls: String(asset.ccaClass).trim(),
      rate: null,
      source: CRA_CLASSES,
      verified: false,
      note:
        `Class ${String(asset.ccaClass).trim()} is not one of the classes recorded here, so its rate is not ` +
        'known to these rules. Find it on the CRA\'s classes page or the full CCA rates list.',
    };
  }

  const kind = asset.kind ?? 'other';

  if (asset.isZeroEmissionVehicle === true) {
    if (acquired && acquired <= CA_ZEV_ACQUIRED_AFTER) {
      return assignment(
        CLASS_BY_KEY.get('10') as CaCcaClassRow,
        true,
        'Classes 54 and 55 are for zero-emission vehicles acquired after 18 March 2019; an earlier one is an ordinary class 10 vehicle.',
      );
    }
    return assignment(CLASS_BY_KEY.get(kind === 'taxi_or_rental_vehicle' ? '55' : '54') as CaCcaClassRow);
  }

  switch (kind) {
    case 'building':
      return assignment(CLASS_BY_KEY.get('1') as CaCcaClassRow);
    case 'furniture':
    case 'appliance':
    case 'machinery':
    case 'equipment':
    case 'photocopier':
    case 'phone_equipment':
      return assignment(CLASS_BY_KEY.get('8') as CaCcaClassRow);
    case 'tool':
      return cost < 500
        ? assignment(CLASS_BY_KEY.get('12') as CaCcaClassRow, true, 'A tool costing less than $500: class 12 at 100%, fully deductible in the year of purchase with no half-year rule.')
        : assignment(CLASS_BY_KEY.get('8') as CaCcaClassRow, true, 'A tool costing $500 or more is class 8 at 20%, not class 12.');
    case 'software':
      return assignment(CLASS_BY_KEY.get('12') as CaCcaClassRow, true, 'Computer software that is not systems software: class 12 at 100%, subject to the half-year rule unless the AII applies.');
    case 'computer':
    case 'systems_software':
      if (acquired && acquired <= CA_CLASS_50_ACQUIRED_AFTER) {
        return assignment(
          CLASS_BY_KEY.get('10') as CaCcaClassRow,
          true,
          'Computers acquired on or before 18 March 2007 are class 10 at 30%; class 50 at 55% is for those acquired after that date.',
        );
      }
      return assignment(CLASS_BY_KEY.get('50') as CaCcaClassRow);
    case 'motor_vehicle':
      return assignment(CLASS_BY_KEY.get('10') as CaCcaClassRow);
    case 'taxi_or_rental_vehicle':
      return {
        cls: '16',
        rate: 0.4,
        source: CRA_CLASSES,
        verified: true,
        note: 'Taxis, daily-rental vehicles and freight trucks over 11,788 kg are class 16 at 40%. Class 16 is routed here but not otherwise modelled.',
      };
    case 'passenger_vehicle': {
      if (year == null) {
        return assignment(
          CLASS_BY_KEY.get('10') as CaCcaClassRow,
          false,
          'A passenger vehicle is class 10 or class 10.1 depending on its cost before tax against the cap for the year it was bought. Record the acquisition date to resolve it.',
        );
      }
      const cap = caPassengerVehicleCap(year);
      if (cap.cap == null) {
        // The caps have only ever risen, so a vehicle under the last listed cap is safely class 10.
        const lastCap = CA_PASSENGER_VEHICLE_CAP_ROWS[CA_PASSENGER_VEHICLE_CAP_ROWS.length - 1].cap;
        return cost <= lastCap
          ? assignment(CLASS_BY_KEY.get('10') as CaCcaClassRow, true, `Under the latest listed cap ($${lastCap.toLocaleString('en-CA')} for ${CA_PASSENGER_VEHICLE_CAP_LAST_VERIFIED_YEAR}), so class 10. ${cap.note}`)
          : assignment(CLASS_BY_KEY.get('10.1') as CaCcaClassRow, false, cap.note);
      }
      return cost > cap.cap
        ? assignment(CLASS_BY_KEY.get('10.1') as CaCcaClassRow, true, `${cap.note} ${(CLASS_BY_KEY.get('10.1') as CaCcaClassRow).note ?? ''}`.trim())
        : assignment(CLASS_BY_KEY.get('10') as CaCcaClassRow, true, cap.note);
    }
    case 'goodwill':
    case 'licence_unlimited':
      return assignment(CLASS_BY_KEY.get('14.1') as CaCcaClassRow);
    default:
      return assignment(
        CLASS_BY_KEY.get('8') as CaCcaClassRow,
        false,
        'Class 8 is the CRA\'s class for equipment "not included in another class", but nothing here says what this asset is. Record its kind or its class.',
      );
  }
}

// ─── First-year treatment ───────────────────────────────────────────────────

/** Class 54 base multipliers: "increase the capital cost addition by ... times the net addition", plus the addition itself. */
const ZEV_54_UPLIFT: Record<'100' | '75' | '55', number> = { '100': 1 + 7 / 3, '75': 1 + 3 / 2, '55': 1 + 5 / 6 };
/** Class 55: 1 1/2, 7/8 and 3/8 times the net addition, so that 40% of the result is 100%, 75%, 55%. */
const ZEV_55_UPLIFT: Record<'100' | '75' | '55', number> = { '100': 1 + 3 / 2, '75': 1 + 7 / 8, '55': 1 + 3 / 8 };

const ZEV_PROPOSED_NOTE =
  ' Under proposed changes, a zero-emission vehicle acquired after 2024 and available for use before 2034 would ' +
  'get a reinstated 100% (before 2030). Proposed, so the enacted phase-out figure is shown.';

function halfYear(note: string): CaFirstYearOutcome {
  return { halfYear: true, aiiMultiplier: null, baseMultiplier: 0.5, enhancedPercent: null, verified: true, note };
}

/**
 * How an addition enters the base amount for CCA in its first year: the
 * half-year rule (half the net addition), the AII (one-and-a-half times the
 * net addition before 2024; the whole net addition, half-year rule suspended,
 * for 2024-2027), the zero-emission vehicle uplift (100% / 75% / 55%), or no
 * adjustment at all (class 12 small tools). `onDate` is the date the property
 * became available for use; the acquisition date (for the AII's "acquired
 * after 20 November 2018") is the asset's.
 */
export function caFirstYear(asset: CaAssetInput, onDate: Date | string): CaFirstYearOutcome {
  const available = toYmd(onDate);
  const availYear = yearOf(available);
  const acquired = ymdOrNull(asset.acquiredDate) ?? ymdOrNull(asset.availableForUseDate) ?? available;
  const acquiredYear = yearOf(acquired);
  const cls = caClassFor(asset);
  const row = caClassRow(cls.cls);

  if (row && !row.halfYearRule && asset.kind !== 'software') {
    return {
      halfYear: false,
      aiiMultiplier: null,
      baseMultiplier: 1,
      enhancedPercent: 100,
      verified: true,
      note: 'Class 12 small tools are not subject to the half-year rule: the whole cost is deductible in the year of purchase.',
    };
  }

  if (cls.cls === '54' || cls.cls === '55') {
    const table = cls.cls === '54' ? ZEV_54_UPLIFT : ZEV_55_UPLIFT;
    const proposed = acquiredYear >= 2025 ? ZEV_PROPOSED_NOTE : '';
    let band: '100' | '75' | '55' | null = null;
    if (availYear < 2024) band = '100';
    else if (availYear <= 2025) band = '75';
    else if (availYear <= 2027) band = '55';
    if (band == null || acquired <= CA_ZEV_ACQUIRED_AFTER) {
      return halfYear(
        `The zero-emission vehicle enhanced first-year allowance is for vehicles acquired after 18 March 2019 and available for use before 2028; outside that, the half-year rule applies to class ${cls.cls}.${proposed}`,
      );
    }
    return {
      halfYear: false,
      aiiMultiplier: null,
      baseMultiplier: table[band],
      enhancedPercent: Number(band),
      verified: true,
      note:
        `Zero-emission vehicle in class ${cls.cls} available for use in ${availYear}: enhanced first-year CCA of ${band}% ` +
        '(100% before 2024, 75% in 2024-2025, 55% in 2026-2027), half-year rule suspended. The class rate applies to the ' +
        `remaining balance from the next year.${proposed}`,
    };
  }

  if (asset.nonArmsLength === true) {
    return halfYear('Property acquired from a non-arm\'s-length person or on a rollover is not eligible for the accelerated investment incentive: the half-year rule applies.');
  }
  if (row && !row.aiiEligible) {
    return halfYear(`The accelerated investment incentive does not apply to class ${row.cls}: the half-year rule applies.`);
  }
  if (acquired <= CA_AII_ACQUIRED_AFTER) {
    return halfYear('Acquired on or before 20 November 2018, so the accelerated investment incentive does not apply: CCA on half the net additions in the first year.');
  }
  if (availYear >= CA_AII_AVAILABLE_BEFORE_YEAR) {
    return halfYear('Available for use in 2028 or later, after the accelerated investment incentive ends: CCA on half the net additions in the first year.');
  }
  const class50Proposed =
    cls.cls === '50' && acquired > '2024-04-15' && availYear < 2027
      ? ' Under proposed changes, class 50 computers acquired after 15 April 2024 and available for use before 2027 would get a 100% first-year deduction; proposed, so not applied.'
      : '';
  if (availYear < CA_AII_PHASE_OUT_FROM_YEAR) {
    return {
      halfYear: false,
      aiiMultiplier: 1.5,
      baseMultiplier: 1.5,
      enhancedPercent: null,
      verified: true,
      note:
        'Accelerated investment incentive: available for use before 2024, so the class rate applies to one-and-a-half ' +
        'times the net addition and the half-year rule is suspended — three times the normal first-year claim.',
    };
  }
  return {
    halfYear: false,
    aiiMultiplier: 1,
    baseMultiplier: 1,
    enhancedPercent: null,
    verified: true,
    note:
      `Accelerated investment incentive, phase-out period: available for use in ${availYear}, so the half-year rule ` +
      'is suspended and the class rate applies to the whole net addition — twice the normal first-year claim, with ' +
      `nothing added on top.${class50Proposed}`,
  };
}

// ─── Explainer ──────────────────────────────────────────────────────────────

const CA_EXPLAINER: DepreciationExplainer = {
  whatItIs:
    'The CRA groups assets into numbered classes, each with its own rate. You claim on the class balance, ' +
    'not on each item.',
  whenItApplies:
    'Anything you buy to earn business income and keep for more than a year — a building, furniture, a ' +
    'computer, a vehicle. In the year you buy it you normally claim on half the net additions to the class ' +
    '(the half-year rule); for property bought after 20 November 2018 and in use before 2028 the accelerated ' +
    'investment incentive sets that aside, so you claim the full rate on the whole addition (one-and-a-half ' +
    'times it before 2024). A passenger vehicle that cost more than the prescribed amount before tax ' +
    '($38,000 for 2025) goes in class 10.1 on its own, with its cost capped. Claiming CCA is optional: you can ' +
    'claim any amount from zero up to the maximum, and what you leave stays in the class for later.',
  howItWorks: [
    'Start each class with its undepreciated capital cost (UCC) from last year, add what you bought this year, and take off what you sold at the lesser of the proceeds and what it cost.',
    'If that balance goes below zero, the difference is a recapture you add to income. If it is positive but nothing is left in the class, it is a terminal loss you deduct. Either way the class closes at zero.',
    'Otherwise work out the base amount: the balance, less half the net additions under the half-year rule — or, under the accelerated investment incentive, the whole net addition (plus another half of it before 2024). A zero-emission vehicle gets its own uplift (100%, 75% or 55% of cost in the first year).',
    'Claim CCA at the class rate on that base — 4% buildings, 20% equipment, 30% vehicles, 55% computers, 100% small tools and software — up to the maximum, prorated by days over 365 for a short first fiscal period. The balance less what you claimed is next year\'s opening UCC.',
  ],
  readMore: [
    { label: 'Claiming capital cost allowance (CCA)', url: CRA_OVERVIEW, authority: 'CRA' },
    { label: 'Classes of depreciable property', url: CRA_CLASSES, authority: 'CRA' },
    { label: 'Accelerated investment incentive', url: CRA_AII, authority: 'CRA' },
    { label: 'Basic information about capital cost allowance', url: CRA_BASIC, authority: 'CRA' },
    { label: 'Guide T4002 — Chapter 4, Capital cost allowance', url: CRA_T4002_CH4, authority: 'CRA' },
  ],
  vocabulary: {
    asset: 'Depreciable property',
    decline: 'Capital cost allowance',
    writtenDown: 'Undepreciated capital cost',
    rate: 'Rate',
    rateBasis: 'Class',
  },
};

const CA_EXTRA_ASSET_FIELDS: AssetFieldSpec[] = [
  {
    key: 'ccaClass',
    label: 'CCA class',
    type: 'enum',
    required: false,
    options: CA_CCA_CLASSES.map((c) => ({ value: c.cls, label: c.label })),
    help:
      'The CRA class this property belongs to. Leave it blank and Fin suggests one from what the asset is ' +
      'and what it cost; set it where you know better.',
  },
  {
    key: 'isZeroEmissionVehicle',
    label: 'Zero-emission vehicle',
    type: 'boolean',
    required: false,
    help:
      'Fully electric, plug-in hybrid (battery of at least 7 kWh) or hydrogen fuel cell, bought after ' +
      '18 March 2019. Goes in class 54 (or 55 for a taxi or rental vehicle) with an enhanced first-year claim.',
  },
  {
    key: 'availableForUseDate',
    label: 'Available for use',
    type: 'text',
    required: false,
    help:
      'The date the property was first used to earn income, if later than the purchase date. The half-year ' +
      'rule, the accelerated investment incentive and the zero-emission vehicle phase-out all key on this year.',
  },
];

// ─── Rules object ───────────────────────────────────────────────────────────

const CA_NO_GENERAL_WRITE_OFF: InstantAssetWriteOffInfo = {
  limit: null,
  verified: false,
  note:
    'Canada has no general instant write-off threshold. Tools under $500 and non-systems software are ' +
    'class 12 at 100%, which is a class rather than a threshold, and the immediate expensing incentive ' +
    'for designated property is not modelled here. Check with the CRA or your accountant.',
};

export const CA_DEPRECIATION_RULES: ClassCcaRules = {
  countryCode: 'CA',
  regime: 'class_cca',
  // The unit is the class: there is no per-asset prime cost or diminishing value here.
  methods: ['pool', 'immediate_writeoff'],
  defaultMethod: 'pool',

  /** "Base your CCA claim on the number of days in your fiscal period compared to 365 days." */
  dayFractionDenominator(): number {
    return 365;
  },

  /**
   * One year's CCA on a class balance, for a host that only has the
   * per-asset interface: pass the class's UCC as `openingAdjustableValue`
   * and the class rate as `annualRate`. No first-year adjustment, no
   * dispositions — for those use `computeClassPeriod`.
   */
  declineInValue(input: DeclineInValueInput): DeclineInValueOutcome {
    if (input.method === 'immediate_writeoff') {
      return computeDeclineInValue({ ...input, partYear: { kind: 'months', monthsUsed: 12 } });
    }
    if (input.method !== 'pool') {
      throw new RangeError(
        `Canada claims capital cost allowance by CLASS, not per asset: method "${String(input.method)}" ` +
          'is not available. Use `pool` with `annualRate` from classFor(), or computeClassPeriod().',
      );
    }
    if (input.annualRate == null) {
      throw new RangeError('Pass `annualRate` — the class rate from classFor(asset) — for a Canadian class.');
    }
    const rate = input.annualRate;
    return computeDeclineInValue(
      { ...input, method: 'pool', partYear: { kind: 'months', monthsUsed: 12 } },
      { allocationYear: rate, ongoing: rate },
    );
  },

  /** The CRA publishes class rates, not effective lives. */
  effectiveLife(): number | null {
    return null;
  },

  effectiveLifeCategories(): EffectiveLifeCategory[] {
    return [];
  },

  instantAssetWriteOff(): InstantAssetWriteOffInfo {
    return { ...CA_NO_GENERAL_WRITE_OFF };
  },

  classFor(asset: CaAssetInput): CaClassAssignment {
    return caClassFor(asset);
  },

  firstYear(asset: CaAssetInput, onDate: Date | string): CaFirstYearOutcome {
    return caFirstYear(asset, onDate);
  },

  passengerVehicleCap(year: number): CaVehicleCapOutcome {
    return caPassengerVehicleCap(year);
  },

  zeroEmissionVehicleCap(year: number): CaVehicleCapOutcome {
    return caZeroEmissionVehicleCap(year);
  },

  /** Proceeds (the lesser of proceeds and cost) less UCC: a recapture or a terminal loss, weighted by business use. */
  balancingAdjustment(input: BalancingAdjustmentInput): BalancingAdjustmentOutcome {
    return computeBalancingAdjustment(input);
  },

  explainer(): DepreciationExplainer {
    return {
      ...CA_EXPLAINER,
      howItWorks: [...CA_EXPLAINER.howItWorks],
      readMore: CA_EXPLAINER.readMore.map((r) => ({ ...r })),
      vocabulary: { ...CA_EXPLAINER.vocabulary },
    };
  },

  firstYearConcessions(onDate: Date | string): FirstYearConcession[] {
    const ymd = toYmd(onDate);
    const year = yearOf(ymd);
    const out: FirstYearConcession[] = [
      {
        key: 'class_12_small_tools',
        label: 'Class 12 — tools under $500',
        kind: 'threshold_write_off',
        limit: 500,
        percent: null,
        verified: true,
        note: 'Tools, instruments and utensils costing less than $500 are class 12 at 100% with no half-year rule: fully deductible in the year of purchase.',
      },
    ];
    if (ymd > CA_AII_ACQUIRED_AFTER && year < CA_AII_AVAILABLE_BEFORE_YEAR) {
      out.push({
        key: 'accelerated_investment_incentive',
        label: 'Accelerated investment incentive',
        kind: 'upfront_percent',
        limit: null,
        percent: null,
        verified: true,
        note:
          year < CA_AII_PHASE_OUT_FROM_YEAR
            ? 'Half-year rule suspended and the class rate applied to one-and-a-half times the net addition — three times the normal first-year claim. Not for non-arm\'s-length purchases or classes 54, 55, 56, 43.1, 43.2, 53.'
            : 'Phase-out period (2024-2027): half-year rule suspended, so the class rate applies to the whole net addition — twice the normal first-year claim. Not for non-arm\'s-length purchases or classes 54, 55, 56, 43.1, 43.2, 53.',
        requiresField: 'availableForUseDate',
      });
    }
    if (ymd > CA_ZEV_ACQUIRED_AFTER && year < 2028) {
      const pct = year < 2024 ? 100 : year <= 2025 ? 75 : 55;
      out.push({
        key: 'zero_emission_vehicle',
        label: 'Zero-emission vehicle enhanced first-year CCA',
        kind: 'upfront_percent',
        limit: null,
        percent: pct,
        verified: true,
        note: `${pct}% of the capital cost in the year a class 54 or 55 zero-emission vehicle becomes available for use (100% before 2024, 75% in 2024-2025, 55% in 2026-2027), half-year rule suspended.`,
        requiresField: 'isZeroEmissionVehicle',
      });
      if (year >= 2025) {
        out.push({
          key: 'zero_emission_vehicle_reinstated_proposed',
          label: 'Zero-emission vehicle 100% — proposed',
          kind: 'upfront_percent',
          limit: null,
          percent: null,
          verified: false,
          note:
            'Under proposed changes, a zero-emission vehicle acquired after 2024 and available for use before 2030 would get 100% in its first year (75% for 2030-2031, 55% for 2032-2033). Proposed, not enacted when this was read: the enacted figure is shown instead.',
          requiresField: 'isZeroEmissionVehicle',
        });
      }
    }
    if (ymd > '2024-04-15' && year < 2027) {
      out.push({
        key: 'class_50_full_expensing_proposed',
        label: 'Class 50 computers 100% — proposed',
        kind: 'upfront_percent',
        limit: null,
        percent: null,
        verified: false,
        note:
          'Under proposed changes, class 50 computers and systems software acquired after 15 April 2024 and available for use before 2027 would get a 100% first-year deduction. Proposed, not enacted when this was read: the 55% rate under the accelerated investment incentive is shown instead.',
      });
    }
    return out;
  },

  extraAssetFields(): AssetFieldSpec[] {
    return CA_EXTRA_ASSET_FIELDS.map((f) => ({ ...f, options: f.options?.map((o) => ({ ...o })) }));
  },
};

export default CA_DEPRECIATION_RULES;
