# Changelog

## 2.2.0 — Unreleased

Depreciation regimes — New Zealand, the United Kingdom, Canada, the United States, India,
Singapore, Ireland and South Africa. Additive: every new `DepreciationRules`
member has a value on every rules object that ships, `declineInValue` still
accepts `daysHeld` / `daysInYear` exactly as before, and a host on 2.1.0 keeps
working untouched.

### Added — regime machinery (`src/depreciation.ts`)

- `InstantAssetWriteOffInfo.proposed` — an announced-but-unenacted threshold, kept strictly OUT of `limit`, which only ever carries the figure a taxpayer can rely on today. A budget announcement is not a rate: the enabling bill can lapse, change, or commence from another date. AU 2026-27 is the first row to use it: the enacted `limit` is **$1,000** (the standing simplified-depreciation threshold, which is what applies once the 2023-24 to 2025-26 temporary $20,000 ended on 30 June 2026), with **$20,000** carried in `proposed`. Treasury Laws Amendment (Tax Reform No. 2) Bill 2026 passed both Houses on 19 August 2026, but passage is not Royal Assent — as at 26 August 2026 no matching Act appeared on the Federal Register of Legislation, while the sibling Tax Reform No. 1 Act 2026 (No. 49) did. When assent is confirmed, move the figure into `limit` and drop `proposed`.
- `InstantAssetWriteOffInfo.boundary` — `'under' | 'up_to'`, optional. Which side of the
  limit qualifies is country law, not a convention: Australia's write-off is for assets
  costing *less than* the threshold, New Zealand's s EE 38 is *"equal to or less than"*, so
  exactly-at-the-limit is an over-claim in one country and a legitimate deduction in the
  other. Absent where the figure is not a per-asset boundary at all — the UK annual
  investment allowance and the US §179 dollar limit are annual aggregates, and a host must
  not treat absence as either value. The New Zealand notes now quote the statute's
  inclusive wording rather than the summary page's "less than" paraphrase.
- `DepreciationRules.regime` — `'effective_life' | 'rate_per_asset' | 'pooled_allowance' |
  'class_cca' | 'macrs' | 'block_wdv' | 'write_off_elective' | 'straight_line_fixed' |
  'write_off_period' | 'generic'`. The countries do not share a model, and a host branches
  on this rather than printing one country's schedule for every country. Australia is
  `effective_life`, New Zealand `rate_per_asset`, the United Kingdom `pooled_allowance`,
  Canada `class_cca`, the United States `macrs`, India `block_wdv`, Singapore
  `write_off_elective`, Ireland `straight_line_fixed`, South Africa `write_off_period`, the
  fallback `generic`.
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
- `MacrsRules` — `regime: 'macrs'`, `propertyClass(asset)`, `tablePercent(recoveryYears,
  yearIndex, convention)`, `convention(input)`, `section179(taxYear)`,
  `bonusPercent(acquired, placedInService)`, `autoCap(placedInServiceYear, withBonus)`,
  `deMinimis(hasAfs)`, with the `Us*` input and outcome types.
- `computeMacrsYear(input)` — one asset for one recovery year in the IRS's order: the §179
  election off the cost first, the special depreciation allowance as a percentage of what
  §179 left, the Appendix A table figure on the basis left after both, and the §280F cap as
  a ceiling on a passenger automobile's total. Later years deduct the table figure only —
  §179 and bonus are passed in every year purely so the depreciable basis stays reduced.
  Per year only — the host replays.
- `BlockWdvRules` — `regime: 'block_wdv'`, `blockFor(asset)`, `halfRate(putToUseDays)`,
  `additionalDepreciation(asset)`, with the `In*` input and outcome types.
- `computeBlockPeriod(input)` — one block for one tax year in section 33's order: opening
  written down value; additions at actual cost, split by the 180-day test; sale proceeds
  off; depreciation at the block rate — half the rate on the under-180-day additions, sale
  proceeds offsetting the full-rate portion first — never more than the balance; closing
  written down value. Proceeds exceeding the balance, or a block left with nothing in it,
  raise `shortTermCapitalGainReview: true` and depreciate nothing: the short-term capital
  gain or loss is a return item this module flags and never computes.
- `WriteOffElectiveRules` — `regime: 'write_off_elective'`, `methodsFor(asset, ya)`,
  `allowanceForYear(asset, method, yearIndex)`, `lowValueCap(ya)`, `eligibility(asset)`,
  with the `Sg*` input and outcome types.
- `StraightLineFixedRules` — `regime: 'straight_line_fixed'`, `rate`, `writeOffYears`,
  `allowableCost(asset)`, `wearAndTear(period)`, with the `Ie*` input and outcome types.
- `WriteOffPeriodRules` — `regime: 'write_off_period'`, `writeOffPeriod(categoryKey)`,
  `smallItemThreshold(onDate)`, with `ZaWriteOffPeriodOutcome`.

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

### Added — United States (`src/countries/unitedStatesDepreciation.ts`)

- The table regime. The IRS prints the yearly percentages, so this module ships them
  verbatim rather than re-deriving them: Table A-1 (half-year convention) and Tables A-2 to
  A-5 (mid-quarter, by the quarter placed in service) for 3, 5, 7, 10 and 15-year property,
  every figure read from Publication 946 (2025) pp. 71-73, every column summing to 100%.
  A recovery period the tables do not cover comes back `{ percent: null, verified: false }`
  rather than interpolated.
- Property classes from Table B-1: 00.11 office furniture (7-year), 00.12 information
  systems (5), 00.13 data handling equipment (5), 00.22 automobiles (5), 00.241 light and
  00.242 heavy trucks (5), 00.27 trailers (5), 00.3 land improvements (15). A recorded
  asset class wins over `kind`; an asset nothing describes falls to Pub 946's 7-year
  "no class life" default, unverified.
- The mid-quarter test: more than 40% of the year's depreciable bases placed in service in
  the fourth quarter (bases reflecting the §179 reduction but not bonus, real property
  excluded) forces the mid-quarter convention; exactly 40% does not.
- §179 dollar limits from "What's New": $2,500,000 / $4,000,000 phase-out / $31,300 SUV cap
  for tax years beginning in 2025; $2,560,000 / $4,090,000 / $32,000 for 2026. Any other
  year is `{ limit: null, verified: false }`.
- Bonus depreciation is a cliff, not a phase, and keys on the ACQUISITION date: 100% for
  property acquired and placed in service after 19 January 2025 (P.L. 119-21, with the 40%
  election noted, never applied); 40% for property acquired before 20 January 2025 and
  placed in service in 2025 (60% for long-production-period property and certain aircraft,
  not modelled); any other combination unverified.
- §280F passenger automobile caps, [year 1, year 2, year 3, later]: 2025 with bonus
  $20,200 / $19,600 / $11,800 / $7,060 ($12,200 first year without), 2026 $20,300 /
  $19,800 / $11,900 / $7,160 ($12,300 without), from Rev. Proc. 2025-16 and 2026-15. Other
  years unverified. `computeMacrsYear` applies the cap as a ceiling on the year's total.
- De minimis safe harbor: $2,500 per item or invoice, $5,000 with an applicable financial
  statement — the reason most small purchases never reach the register, and the first line
  of the explainer.
- `extraAssetFields()`: `assetClass` (optional enum of the shipped Table B-1 classes),
  `placedInServiceDate`, `isPassengerAutomobile`, `hasAfs`. Vocabulary: "Depreciable
  property", "Depreciation deduction", "Adjusted basis", "Recovery period". `readMore`
  links are irs.gov pages only.
- `usPlugin.getDepreciationRules()` now returns these rules instead of the generic fallback.

### Added — India (`src/countries/indiaDepreciation.ts`)

- The block regime under the law in force since 1 April 2026: section 33 of the Income-tax
  Act 2025 and Appendix I (rule 25) of the Income-tax Rules 2026. The 1961 Act and 1962
  Rules ceased on 31 March 2026 and are cited nowhere except the note recording their
  replacement.
- Blocks from Appendix I, every rate the Gazette table's own: buildings mainly residential
  5%, other buildings 10%, purely temporary erections 40%; furniture and fittings including
  electrical fittings 10%; machinery and plant general 15%; motor cars not on hire 15%;
  motor buses, lorries and taxis on hire 30%; aeroplanes 40%; computers including computer
  software 40%; books of a professional 40%; ships 20%; Part B intangibles 25%. The closed
  2019-20 uplifted vehicle rates (30% / 45%) are notes, not rates. Goodwill is not a
  depreciable asset.
- The 180-day rule (s. 33(4)): an asset acquired in the tax year (1 April – 31 March) and
  put to use under 180 days earns half the prescribed rate that year; 180 days exactly is
  the full rate.
- Additional depreciation (s. 33(8)-(9)): an extra 20% of actual cost for NEW machinery or
  plant of a manufacturer or power producer — 10% + 10% across two years where used under
  180 days. Never for office appliances, road transport vehicles, ships, aircraft,
  buildings, furniture or intangibles, and every condition is a recorded answer: an
  unanswered `isManufacturer` or `isNewAsset` is a "no".
- Sales come off the block, not the asset: proceeds reduce the block's written down value,
  and proceeds that swallow the block — or a block left with no assets — end depreciation
  and raise `shortTermCapitalGainReview` instead of computing a gain the return owns.
- No general instant write-off: `instantAssetWriteOff()` is `{ limit: null,
  verified: false }` with a note, because a 40% block rate is a rate, not a threshold.
- `extraAssetFields()`: `blockKey` (optional enum of the shipped blocks), `putToUseDays`,
  `isManufacturer`, `isNewAsset`, `isOfficeAppliance`, `isRoadTransportVehicle`.
  Vocabulary: "Asset in block", "Depreciation", "Written down value of the block", "Block
  of assets". `readMore` links are incometaxindia.gov.in pages only — section 33 and the
  Appendix I table.
- `inPlugin.getDepreciationRules()` now returns these rules instead of the generic fallback.

### Added — Singapore (`src/countries/singaporeDepreciation.ts`)

- The write-off elective regime — `WriteOffElectiveRules` with `SgAssetInput` and the
  `Sg*` outcome types. Book depreciation is not deductible in Singapore; capital allowances
  replace it, and the method is ELECTED PER ASSET under ss.19/19A of the Income Tax Act 1947.
  `methodsFor(asset, ya)` lists the elections open to an asset in a year of assessment;
  `allowanceForYear(asset, method, yearIndex)` is the IRAS arithmetic for one year of one
  method, and where a division leaves a stranded cent the FINAL year absorbs it so the
  allowances always sum to the cost.
- The methods, each from the IRAS Capital Allowances page: s.19A(1) three-year write-off at
  one-third of cost a year (deferrable); s.19A(2) 100% in one year for computers and
  prescribed automation equipment; s.19A(10A) 100% in one year for low-value assets costing
  no more than $5,000 each, capped at $30,000 of such claims per YA — the total runs ACROSS
  assets, so `lowValueCap(ya)` publishes both limits and the HOST enforces the $30,000
  (IRAS's own illustration: seven $4,400 assets are $30,800, so six fit and the seventh is
  written off another way); s.19A(1E) two-year 75%/25%, offered only for the basis periods
  of YAs 2021, 2022 and 2024; and s.19 working life — initial allowance of 20% of cost plus
  an annual allowance of 80% over the streamlined Sixth Schedule election of 6 or 12 years
  (16 for a 16-year asset), offered from YA 2023 because the earlier Sixth Schedule lives
  are not recorded here. A motor vehicle's working life of 6 years is the one Sixth
  Schedule figure shipped.
- There is NO day or month apportionment — an allowance belongs to a year of assessment
  whole — so `declineInValue` forces a full year whatever part-year the caller passed, and
  requires `annualRate` for `prime_cost` rather than deriving a rate from a life.
- `eligibility(asset)`: an S-plated private passenger car gets nothing, with the IRAS
  wording; goods and commercial vehicles qualify. `methodsFor` returns an empty list and
  `allowanceForYear` refuses the asset. Low-value limits for years of assessment before
  2023 come back null and unverified rather than today's numbers backdated.
- `extraAssetFields()`: `isComputerOrAutomation`, `isSPlatedPrivateCar`, `workingLifeYears`
  (enum 6/12/16). Vocabulary: "Qualifying fixed asset", "Capital allowance", "Tax written
  down value (TWDV)", "Write-off method". `readMore` links to iras.gov.sg only.
- `singaporePlugin.getDepreciationRules()` now returns these rules instead of the generic
  fallback.

### Added — Ireland (`src/countries/irelandDepreciation.ts`)

- The straight-line fixed-rate regime — `StraightLineFixedRules` with `IeAssetInput` and the
  `Ie*` outcome types: ONE statutory rate for all plant and machinery, wear and tear at
  12.5% of the allowable cost a year over 8 years (s.284 TCA 1997, the rate since
  4 December 2002), on the net cost after grants and reclaimable VAT. `declineInValue`
  APPLIES the 12.5% whatever `annualRate` or `effectiveLifeYears` the caller passed,
  because the statute leaves no rate to choose.
- `wearAndTear(period)` gates the year's allowance on s.284's own condition: the asset must
  be IN USE for the trade at the END of the accounting period — `inUseAtPeriodEnd` is a
  required input and a required register field, never defaulted, because a field nobody
  filled in must not claim a year's allowance — and a period shorter than 12 months
  pro-rates by months (nine months of a €25,000 machine is €2,343.75). A days-based input
  is refused: Ireland shortens the PERIOD, not the hold.
- `allowableCost(asset)` — the car cost cap from ss.380K and 380L TCA 1997 (Part 11C),
  against the €24,000 specified amount by CO₂ category. The six categories substituted by
  s.14 Finance Act 2020 for expenditure incurred on or after 1 January 2021 are A up to
  120 g/km, B 121–140, C 141–155, D 156–170, E 171–190 and F above 190. For expenditure
  incurred BEFORE 1 January 2027: categories A and B are DEEMED to cost €24,000 whatever
  the car actually cost, in both directions; category C gets the lesser of €12,000 and half
  the cost; D, E and F get nothing. For expenditure incurred FROM 1 January 2027, s.33
  Finance Act 2024 moves each rung down a category — €24,000 for A only, the lesser of
  €12,000 and half the cost for B, nothing for C through F — so `IeAssetInput` takes
  `expenditureIncurredOn` and the outcome reports which `regime` it applied. A car whose
  emissions cannot be verified is deemed Category F and gets nothing. Commercial vehicles
  are uncapped.
- SOURCE CORRECTION: an earlier draft of this module took the bands from Tax and Duty
  Manual Part 11-00-01, which is still published but is stamped "Document last reviewed
  November 2019" and describes the seven-category A–G regime with 155 g/km and 190 g/km
  thresholds that s.19 Finance Act 2019 and s.14 Finance Act 2020 superseded. The rules and
  the `readMore` link now follow the Notes for Guidance to Part 11C (Finance Act 2025
  Edition) instead.
- The accelerated capital allowance — 100% in year one for energy-efficient equipment on
  the SEAI Triple E register — ships as the one concession, gated on the
  `isEnergyEfficientSeai` field, and `immediate_writeoff` carries its arithmetic. No
  write-off cost threshold is invented.
- Disposals are flagged, not fully modelled: the exact Irish balancing mechanics (TDM
  Part 09-02-03) were not read for this release, so `IE_DISPOSAL_BALANCING` ships
  `verified: false` with the note to render, and `balancingAdjustment` is the generic
  proceeds-less-written-down-value comparison.
- Vocabulary: "Plant and machinery", "Wear and tear allowance", "Tax written down value".
  `readMore` links to revenue.ie only. No country plugin wires these rules yet — Ireland
  has no filing plugin — so hosts reach them as `IE_DEPRECIATION_RULES` directly.

### Added — South Africa (`src/countries/southAfricaDepreciation.ts`)

- The write-off period regime — `WriteOffPeriodRules`: SARS publishes a period in years per
  asset in the schedule to Interpretation Note 47 (Issue 5, 9 February 2021 — Binding
  General Ruling 7 makes it binding), and the taxpayer elects straight line or diminishing
  value over it (IN47 4.3.2) on the cash cost excluding finance charges.
  `writeOffPeriod(categoryKey)` returns the schedule years; twenty rows ship, each read
  from the schedule — personal computers 3, tablets and cellphones and PC software 2,
  furniture 6, passenger cars 5, delivery vehicles 4, heavy trucks 3, standby generators
  15 among them — and an asset not on the list is null, not a guess.
- Straight line runs at 1 ÷ years through `prime_cost`, APPORTIONED BY DAYS for a part year
  (IN47 4.1.6): a R10,000 personal computer claims R3,333.33 in a full year and
  R913.24 over 100 days. Diminishing value is allowed on the income tax value but SARS
  publishes NO DV rate, so `declineInValue` demands the taxpayer's own `annualRate` rather
  than inventing one with the ATO's 200% multiplier.
- `smallItemThreshold(onDate)` — an item costing LESS than R7,000 is written off in full in
  the year acquired and brought into use, for acquisitions on or after 1 March 2009; a set
  bought together is one item. Effective-dated: an earlier date resolves to an unverified
  null rather than R7,000 backdated.
- s.12C (manufacturing plant, 40/20/20/20 new or 20% × 5 used) and s.12E (small business
  corporations, 100% manufacturing or 50/30/20) replace s.11(e) for the assets they cover
  and were NOT read this session, so they ship as `verified: false` notes in
  `firstYearConcessions`, never as rates.
- Vocabulary: "Qualifying asset", "Wear-and-tear allowance", "Income tax value",
  "Write-off period". `readMore` links to sars.gov.za only.
- `southAfricaPlugin.getDepreciationRules()` now returns these rules instead of the generic
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
