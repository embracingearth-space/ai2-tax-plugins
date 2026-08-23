# Changelog

## 2.2.0 — 2026-08-24

Depreciation regimes — New Zealand, the United Kingdom and Canada. Additive: every new `DepreciationRules`
member has a value on every rules object that ships, `declineInValue` still
accepts `daysHeld` / `daysInYear` exactly as before, and a host on 2.1.0 keeps
working untouched.

### Added — regime machinery (`src/depreciation.ts`)

- `DepreciationRules.regime` — `'effective_life' | 'rate_per_asset' | 'pooled_allowance' |
  'class_cca' | 'generic'`. The countries do not share a model, and a host branches on this
  rather than printing one country's schedule for every country. Australia is
  `effective_life`, New Zealand `rate_per_asset`, the United Kingdom `pooled_allowance`,
  Canada `class_cca`, the fallback `generic`.
- `explainer()` on every rules object — `whatItIs`, `whenItApplies`, `howItWorks[]`,
  `readMore[]` (official pages only) and a `vocabulary` that drives column labels, so a
  schedule prints "Adjustable value" for the ATO, "Adjusted tax value" for Inland Revenue.
  The generic explainer says plainly that no country-specific rules are loaded and links
  nowhere.
- `firstYearConcessions(onDate)` — effective-dated concessions with their `verified` state
  (AU: the instant asset write-off; NZ: the low value asset threshold and Investment Boost).
- `extraAssetFields()` — what the register must collect beyond the common fields (NZ:
  `isNewAsset`).
- `RatePerAssetRules` — `regime: 'rate_per_asset'`, `partYear: 'months_whole'`,
  `rateFor(categoryKey)`, `lowValueThreshold(onDate)`, `investmentBoost(onDate)`.
- `DeclineInValueInput.partYear` — `{ kind: 'days', daysHeld, daysInYear }` or
  `{ kind: 'months', monthsUsed }`. `monthsUsed` must be a whole number from 0 to 12; a
  part-month is the caller's to round UP (Inland Revenue: "count part-months as whole
  months") and the engine throws on a fraction rather than inventing a denominator.
- `DeclineInValueInput.annualRate` — a published rate as a fraction, applied as-is to prime
  cost and diminishing value with no 200% multiplier and no life. `effectiveLifeYears` is
  ignored when it is given and required when it is not.
- `sortNewestFirst` / `resolveEffectiveDated` — the effective-dated resolver, generic over any
  `{ effectiveFrom }` row.
- `PooledAllowanceRules` — `regime: 'pooled_allowance'`, `poolFor(asset, onDate)`,
  `wdaRate(pool, { periodStart, periodEnd, taxpayer })`, `aia(period)`,
  `firstYearAllowance(asset, onDate)`, `cashBasisRestriction()`, `eligibility(asset)`,
  `smallPoolsAllowance(period)`, with the `Uk*` input and outcome types.
- `computePoolPeriod(input)` — one pool for one period in HMRC's order: additions in; AIA
  (capped at the pro-rated limit, the excess written down this period) and first-year
  allowances against the additions that qualify, the FYA remainder joining the pool for WDA
  from the NEXT period; disposals out, capped at original cost; a balancing charge where
  proceeds exceed the balance; a balancing allowance where the pool is closing; the small
  pools allowance where a main or special rate pool is at or under the limit before the
  allowance is worked out (never a single-asset pool, and either that or WDA, not both);
  otherwise the writing-down allowance; closing written down value. Per period only — the
  host replays.
- `ClassCcaRules` — `regime: 'class_cca'`, `classFor(asset)`, `firstYear(asset, onDate)`,
  `passengerVehicleCap(year)`, `zeroEmissionVehicleCap(year)`, with the `Ca*` input and outcome
  types. `CaFirstYearOutcome.baseMultiplier` is the all-in factor a net addition is multiplied
  by to reach the base amount for CCA (0.5 half-year rule, 1.5 or 1 under the AII, 10/3, 2.5
  or 11/6 for a class 54 zero-emission vehicle), and is what `computeClassPeriod` takes.
- `computeClassPeriod(input)` — one class for one year in the CRA's order (T2125 Area A):
  opening UCC; additions in; dispositions out at the LESSER of proceeds and capital cost;
  column 7 — negative is a recapture, positive with nothing left in the class is a terminal
  loss, and either way no CCA and the class closes at zero; otherwise the first-year
  adjustment on the net additions, with dispositions offsetting the non-eligible additions
  before the eligible ones (the AII page's Example 5); CCA at the class rate, prorated for a
  short fiscal period and never more than the balance; an optional lower claim
  (`claimLimit`); class 10.1's `noRecaptureOrTerminalLoss` and `halfYearOnSale` (base = half
  the opening UCC); closing UCC. Per year only — the host replays. The AII page's Examples 3,
  5 and 6 replay to the cent.

### Added — United Kingdom (`src/countries/unitedKingdomDepreciation.ts`)

- The first pooled regime. Main pool WDA 18%, 14% from 1 April 2026 (Corporation Tax) or
  6 April 2026 (Income Tax); a period straddling the change gets a day-weighted hybrid rate
  (a calendar-2026 income-tax period is 95 days at 18% and 270 at 14%). Special rate pool 6%.
- Annual investment allowance £1,000,000 from 1 January 2019, £200,000 for 2016-2018, £500,000
  for April 2014 to December 2015, all verified; earlier dates resolve to an unverified null.
  Pro-rated by period length — whole months over twelve where the period runs from the first
  of a month to the last of a month, days over 365 otherwise — so nine months is £750,000. A
  period that straddles a change in the annual limit comes back `verified: false` because
  HMRC's transitional rules for that case are not modelled.
- Small pools allowance: a main or special rate pool at £1,000 or less before the allowance
  is worked out is claimed in full instead of WDA; pro-rated like the AIA (nine months,
  £750); not for single-asset pools.
- First-year allowances, effective-dated: full expensing (100%) and the 50% special-rate FYA
  for companies from 1 April 2023; the super-deduction (130%) for companies 1 April 2021 to
  31 March 2023; the 40% FYA on new and unused main-rate plant, not a car, bought on or after
  1 January 2026 with the remaining 60% written down from the next period; 100% for a new
  zero-emission car. Where the answer turns on the taxpayer type and it is not recorded, the
  result is `{ percent: null, verified: false }` with a note, not a guess.
- Business cars by CO₂ and purchase date, gov.uk's table: from April 2021 new 0 g/km → 100%
  FYA, ≤50 → main, >50 → special; April 2018-2021 new ≤50 → 100%, ≤110 → main; April
  2015-2018 new ≤75 → 100%, ≤130 → main. The income-tax calendar starts each band on
  6 April. Before April 2015 the pool comes back unverified.
- Cash basis: a sole trader or partnership on the cash basis can claim capital allowances on
  business cars only. `cashBasisRestriction()` and `eligibility(asset)` say so per asset, and
  the explainer's `whenItApplies` leads with it.
- `extraAssetFields()`: `taxpayerType`, `isCar`, `co2GPerKm`, `isNew`. Vocabulary: "Written
  down value", "Writing-down allowance", "Pool". `readMore` links are gov.uk pages only.
- `ukPlugin.getDepreciationRules()` now returns these rules instead of the generic fallback.

### Added — Canada (`src/countries/canadaDepreciation.ts`)

- The class regime. Classes from the CRA's "Classes of depreciable property" page, every rate
  the page's own: 1 (4%) buildings; 8 (20%) furniture, appliances, tools costing $500 or more,
  machinery, photocopiers, phone equipment; 10 (30%) motor vehicles and passenger vehicles
  under the cap; 10.1 (30%) a passenger vehicle over the cap; 12 (100%) tools under $500 and
  non-systems software; 14.1 (5%) goodwill and unlimited-period licences; 50 (55%) computers
  and systems software acquired after 18 March 2007 (on or before it, class 10); 54 (30%) and
  55 (40%) zero-emission vehicles acquired after 18 March 2019. `classFor` routes by a recorded
  class first, then by `kind` and cost; an asset with no kind falls to class 8 unverified, and
  a class not on the list comes back with `rate: null, verified: false`.
- Class 10.1 prescribed amounts by year of acquisition, the page verbatim: $30,000 before 2022,
  $34,000 in 2022, $36,000 in 2023, $37,000 in 2024, $38,000 in 2025. 2026 is NOT on the page
  and resolves `{ cap: null, verified: false }`; a vehicle under the last listed cap is still
  class 10 (the caps have only risen), one over it is class 10.1 unverified. Class 10.1 has no
  recapture or terminal loss and gets the half-year rule on sale (Guide T4002, columns 7 and
  19). Zero-emission passenger vehicle limits $55,000 / $59,000 (2022) / $61,000 (from 2023).
- Half-year rule and the accelerated investment incentive. Property acquired after
  20 November 2018 and available for use before 2028: before 2024 the rate applies to
  one-and-a-half times the net addition with the half-year rule suspended; for 2024-2027 the
  page's wording is "reduced to two times the normal first-year CCA deduction. The incentive
  continues to effectively suspend the half-year rule" — so the whole net addition at the
  class rate, nothing added. Not for non-arm's-length or rollover acquisitions, nor classes
  54, 55, 56, 43.1, 43.2, 53. Class 12 small tools have no half-year rule; class 12 software
  does. Claiming CCA is optional ("any amount you like, from zero to the maximum") and a
  fiscal period under 365 days prorates by days over 365 — both from "Basic information about
  CCA".
- Zero-emission vehicles: the enacted enhanced first-year CCA of 100% before 2024, 75% in
  2024-2025, 55% in 2026-2027 by the year the vehicle becomes available for use, as the class
  54 uplift of 2 1/3, 1 1/2 and 5/6 times the net addition (1 1/2, 7/8, 3/8 for class 55).
- Proposed changes ship as `verified: false` concessions, never as the rate: the reinstated
  100% for zero-emission vehicles acquired after 2024; the 100% first-year deduction for class
  50 computers acquired after 15 April 2024; the 10% rate for purpose-built rental buildings
  and the class 8 separate-class election are notes on their class rows. No general instant
  write-off: `instantAssetWriteOff()` is `{ limit: null, verified: false }` with a note.
- `extraAssetFields()`: `ccaClass` (optional enum of the shipped classes — `classFor`
  suggests), `isZeroEmissionVehicle`, `availableForUseDate`. Vocabulary: "Depreciable
  property", "Capital cost allowance", "Undepreciated capital cost", "Class". `readMore`
  links are canada.ca pages only.
- `caPlugin.getDepreciationRules()` now returns these rules instead of the generic fallback.

### Added — New Zealand (`src/countries/newZealandDepreciation.ts`)

- Diminishing value is `cost × rate` in year one and `adjusted tax value × rate` after;
  straight line is `cost × SL rate` every year. Pinned to Inland Revenue's own example: a
  $10,000 espresso machine at 30% DV claims $3,000, carries $7,000, and bought 20 May in an
  April year claims 11 months — $2,750 — not 10 and not a day fraction.
- `nzWholeMonthsUsed(acquired, yearEnd)` — whole months inclusive of the month of purchase;
  the 1st and the 31st of a month both count it. The NZ rules REFUSE a days-based input
  rather than computing an ATO number for an IRD return.
- Low value asset threshold, effective-dated and verified on all three rows: $500 up to
  16 March 2020, $5,000 from 17 March 2020 to 16 March 2021, $1,000 from 17 March 2021.
- Investment Boost: for NEW assets bought from 22 May 2025, 20% of the cost is an expense
  and the remaining 80% is depreciated. `nzInvestmentBoostSplit` models it as a reduction
  of the depreciable base; before that date the answer is `{ percent: null, verified: false }`,
  and an unanswered `isNewAsset` is not new.
- Seventeen IR265 (March 2026) rates, each with its page, category heading and asset
  description as printed. GST-registered taxpayers depreciate the GST-exclusive cost;
  business-use % applies to the claim, not the adjusted tax value.
- Pooling is exposed as `NZ_POOLING_RULES` metadata (DV only, lowest rate, no buildings, no
  removal) and the `pool` method throws; pool arithmetic is not built.
- `newZealandPlugin.getDepreciationRules()` now returns these rules instead of the generic
  fallback.

## 2.1.0 — 2026-08-23

Depreciation schedules and annual reports. Additive: every new plugin method is
optional, no existing field, id or aggregate key changed, and a host on 2.0.0
keeps working untouched.

- **`toYmd` reads a `Date` by its LOCAL calendar day, not `toISOString()`.** `new Date(2023, 6, 1)`
  — 1 July on the caller's calendar — serialised as `2023-06-30` in Sydney and selected the
  wrong side of every 1-July boundary: the rate row, the write-off limit, the financial year.
  This keyed the whole effective-dated ledger, not only the write-off resolver.
- **TPAR lodgment is three conditions, all tri-state.** `auTprsQualifies` returns
  `thresholdMet`, and `mustLodge` is a tri-state AND over the threshold,
  `paidContractorsForService` and `hasAbn` (the ATO: "if ALL conditions are met"). Any known
  `false` decides "no"; all known `true` decides "yes"; otherwise `null` — unknown, never a
  default. `thresholdMet` itself is `null` when no supplied limb clears the line but an
  applicable limb was not supplied (`limbsUnknown` lists which): a building business at 49%
  this year may still qualify on last year's income. Evidence for a limb the service does not
  have is no longer counted; offering only such evidence throws.

### Added — depreciation (capital allowances)

- `DepreciationRules` on `src/depreciation.ts`, reached with
  `getDepreciationRules(plugin)`: `declineInValue()` for one income year,
  `effectiveLife()` / `effectiveLifeCategories()`, an effective-dated
  `instantAssetWriteOff()` and `balancingAdjustment()` for disposals.
  `TaxFilingPlugin.getDepreciationRules?()` is optional.
- `GENERIC_DEPRECIATION_RULES` — prime cost and diminishing value at 200% for
  every country, no write-off, no pool, `effectiveLife()` null. It refuses the
  write-off and pool methods rather than inventing a rate, and invents no other
  country's effective lives.
- The formulas are the ATO's: cost (or base value) × days held ÷ denominator ×
  100% (or 200%) ÷ effective life, with 150% for an asset first held before
  10 May 2006. The decline is clamped at the base value; private use is left to
  the caller because it reduces the deduction, not the value carried forward.
- **`daysInYear` is the DENOMINATOR the jurisdiction prescribes, not the length
  of the income year.** The ATO fixes it at 365 in every year — `cost × (days
  held ÷ 365) × (100% ÷ life)` — while the same page states "days held can be
  366 for a leap year", so a full leap-year hold claims 366/365 of a year, and
  `daysHeld` is capped only at 366. `AU_DAY_FRACTION_DENOMINATOR` publishes the
  365 and `AU_DEPRECIATION_RULES.declineInValue` **applies** it, overriding
  whatever a caller passed: passing 366 to the AU rules returns exactly what
  passing 365 returns. `dayFractionDenominator(daysInIncomeYear)` answers the
  same question without computing a schedule. `GENERIC_DEPRECIATION_RULES`
  honours the caller's value, since with no jurisdiction there is no published
  convention to override it with.
- `secondElementCostThisYear` — an improvement incurred during the income year.
  The ATO's base value in a year after the first is the opening adjustable value
  plus that cost, so a $5,000 opening value improved by $1,000 declines from
  $6,000 and carries the improvement into the closing value. Modelled for
  `diminishing_value`; the other three methods **throw** rather than ignore it,
  because each needs something the module is not given (prime cost needs the
  asset's remaining effective life, a pooled improvement takes the
  allocation-year rate while the rest of the pool takes the ongoing one, and an
  improvement to a written-off asset is its own write-off decision). The error
  says what to pass instead.
- Australia: all four methods, `diminishing_value` as the default, fifteen
  effective-life categories read from Table B of the Income Tax Assessment
  (Effective Life of Depreciating Assets) Determination 2025 (F2025L01097,
  commenced 16 September 2025), and the general small business pool at 15% in
  the allocation year and 30% after. `auSmallBusinessPoolWriteOff()` exposes the
  low-pool-balance rule rather than applying it inside `declineInValue()`.
- The instant-asset-write-off resolver derives its newest-first order with
  `sortWriteOffRowsNewestFirst()` instead of trusting the literal's order, so a
  row inserted out of order cannot make an earlier date resolve to a stale limit
  with `verified: true`. `resolveWriteOffRow(rows, date)` is exported so the
  guarantee is testable against any set of rows.

### Added — annual reports

- `AnnualReportDefinition` and the optional `TaxFilingPlugin.getAnnualReports?()`.
- Australia declares the Taxable payments annual report: due 28 August after the
  financial year end, whole dollars with no cents, and the six contractor columns
  the ATO's *TPAR contractor details to report* says the report must include —
  ABN if known, name, address and the three totals. Contractor phone, email and
  bank details are **not** columns: the ATO lists those separately as extra
  information it *may ask for*, so they are not data this report carries.
  The definition describes the report; it does not produce the ATO lodgment file,
  and `lodgmentNote` says so.
- **Two qualification tests, not one test and an exemption.** Each entry in
  `qualifyingServices` now carries the `test` that applies to it
  (`AnnualReportQualifyingService`). Cleaning, courier and road freight,
  information technology, and security/investigation/surveillance use the 10%
  `income_share` test, courier and road freight measured together. Building and
  construction uses the ATO's three-limb 50% `primarily_in_industry` test —
  current-year income share, current-year business activity share, **or** the
  immediately preceding year's income share. `auTprsQualifies()` evaluates it,
  inclusive at the boundary (50% is in, 49% is out) and throwing rather than
  answering "no" when given no figures or an unknown service.

### Honesty

- The AU instant asset write-off is $20,000 for 2023-24, 2024-25 and 2025-26 and
  **null with `verified: false` for 2026-27 onwards**, because the ATO publishes
  nothing for that year. $20,000 is not carried forward and the $1,000 statutory
  reversion is not assumed — render the note, not a number. A test asserts this
  directly, since a test that passed with the threshold carried forward would be
  a test that let a false statutory figure reach a tax return.
- Effective lives outside Australia are not invented; the category list is empty
  and `effectiveLife()` returns null so the user enters their own.
- Every AU effective-life `source` quotes Table B in full rather than in
  summary — a shortened quote reads as a citation while being something the
  determination does not actually say.
- The TPAR due date is built at UTC noon, so both `toISOString()` and local
  getters read 28 August. A local-midnight `Date` serialises as 27 August for
  anyone east of Greenwich — i.e. every Australian, i.e. everyone who lodges a
  TPAR. `tparDueDateYmd()` returns the calendar date as a string for storage and
  comparison.

## 2.0.0 — 2026-08-23

Activity statements re-verified against the authorities' own forms, plus the
canonical tax-treatment catalogue. **Major** because the host contract changed
(new aggregate keys a host must emit; NZ field ids renumbered).

### Breaking — host contract

- **New Zealand (GST101A)** — field ids now follow the official form exactly
  (`box5`…`box15`; the fabricated `box16` and the old meaning of `box12` are
  gone). `box5` auto-fills from `income_total_excl_input_taxed` (exempt supplies
  are not on the return) and `box11` from `expenses_taxable_gross` (purchases with
  GST in the price only) instead of `income_total` / `expenses_total`. Statements
  saved under 1.x with `box16` / old `box12` values must be re-keyed:
  `box12 (old "purchases not subject to GST")` → drop; `box13 (old 11−12)` → drop;
  `box14 (old adjustments)` → `box13`; `box15 (old total credit)` → `box14`;
  `box16` → `box15`.
- **Tax-exclusive bases** — plugins whose output tax is *field × rate* now
  auto-fill those fields from `income_standard_excl_tax`,
  `expenses_standard_excl_tax`, `expenses_taxable_excl_tax` and
  `expenses_domestic_excl_tax` (EU template, Singapore, Japan, Mexico, Saudi
  Arabia, UAE, Indonesia, Thailand, South Korea, Philippines). A host that still
  emits only the gross keys leaves those fields blank rather than overstating tax.
- **Australia (BAS)** — new fields G4, G13, G14, G15, G7/G18 adjustments, the
  full calculation worksheet (G5–G20, read-only), `1A_worksheet`/`1B_worksheet`,
  `4`, `5A`, `6A`; `8A`/`8B` are now the true BAS totals (they previously held
  the PAYG-instalment and FBT amounts). Section ids changed (`gst` →
  `gst_sales`/`gst_purchases`/`gst_amounts`, plus `other_amounts`). New
  aggregate keys: `income_input_taxed`, `expenses_input_taxed_related`,
  `expenses_no_tax`, `expenses_private`, `output_tax`, `input_tax`.

### Fixed

- AU `1B` no longer `(G10+G11)÷11`: G16 (= G13+G14+G15) is subtracted per the
  ATO worksheet; 1A/1B default to the accounts method with the worksheet as a
  cross-check warning.
- Canada GST34: line 108 = 106 **+** 107 (adjustments that reduce net tax).
- UK VAT100: boxes 2, 8, 9 use the post-2021 Northern Ireland wording.
- Overrides are returned (not the pre-override calc) across 15 plugins and
  normalised to 2 dp where the form is decimal (Brazil); refunds are no longer
  clamped to zero (folded in from #22).
- EU template: rate percentages keep their decimals (FI 25.5 %, CH 8.1 %).

- **Auto-populate contract** — a field a host auto-fills is no longer allowed to
  be silently overwritten by `calculateFields`. Two cases fixed: UAE
  `total_standard_supplies` (a by-Emirate sum; the mapping is removed, since a
  host with no Emirate attribution has nothing correct to put there) and South
  Korea `input_vat` (editable and auto-filled, but always returned as the
  recomputed figure — both the auto-fill and a manual edit were discarded).
  A generic test now asserts this across every plugin.

### Added

- `src/treatments.ts`: `CanonicalTreatmentCode`, `TaxTreatmentDefinition`,
  `GENERIC_TREATMENTS`, `getTreatmentsForPlugin`, `getTreatmentDefinition`,
  `resolveTreatmentRate`; per-country `getTaxTreatments()` for AU, NZ, GB, CA,
  SG, IN, ZA and the EU template. See README → Tax treatments.
- `__tests__/groundTruth.test.ts`: worked examples from the ATO / IRD / CRA pages.

## 1.0.0

Initial public release.
