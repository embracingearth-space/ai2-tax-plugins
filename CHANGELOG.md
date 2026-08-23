# Changelog

## 2.1.0 — 2026-08-23

Depreciation schedules and annual reports. Additive: every new plugin method is
optional, no existing field, id or aggregate key changed, and a host on 2.0.0
keeps working untouched.

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
- The formulas are the ATO's: cost (or base value) × days held ÷ days in year ×
  100% (or 200%) ÷ effective life, with 150% for an asset first held before
  10 May 2006. `daysInYear` is a parameter, so a leap income year passes 366;
  the decline is clamped at the opening adjustable value; private use is left to
  the caller because it reduces the deduction, not the value carried forward.
- Australia: all four methods, `diminishing_value` as the default, fifteen
  effective-life categories read from Table B of the Income Tax Assessment
  (Effective Life of Depreciating Assets) Determination 2025 (F2025L01097,
  commenced 16 September 2025), and the general small business pool at 15% in
  the allocation year and 30% after. `auSmallBusinessPoolWriteOff()` exposes the
  low-pool-balance rule rather than applying it inside `declineInValue()`.

### Added — annual reports
- `AnnualReportDefinition` and the optional `TaxFilingPlugin.getAnnualReports?()`.
- Australia declares the Taxable payments annual report: due 28 August after the
  financial year end, whole dollars with no cents, the six ATO contractor
  columns, and the five reportable services with building and construction
  flagged as lodging regardless of the 10% threshold (courier and road freight
  combined for that test). The definition describes the report; it does not
  produce the ATO lodgment file, and `lodgmentNote` says so.

### Honesty
- The AU instant asset write-off is $20,000 for 2023-24, 2024-25 and 2025-26 and
  **null with `verified: false` for 2026-27 onwards**, because the ATO publishes
  nothing for that year. $20,000 is not carried forward and the $1,000 statutory
  reversion is not assumed — render the note, not a number. A test asserts this
  directly, since a test that passed with the threshold carried forward would be
  a test that let a false statutory figure reach a tax return.
- Effective lives outside Australia are not invented; the category list is empty
  and `effectiveLife()` returns null so the user enters their own.

## 2.1.0 — 2026-08-23 (continued)

### Fixed
- **The day fraction follows the ATO's published formula.** The denominator is
  fixed at 365 in every income year — `cost × (days held ÷ 365) × (100% ÷ life)`
  — while the same ATO page states "days held can be 366 for a leap year". Both
  hold at once: a full leap-year hold claims 366/365 of a year. The first cut
  divided by the actual length of the year and clamped the fraction at 1, which
  silently shortened every leap-year claim. `AU_DAY_FRACTION_DENOMINATOR` now
  publishes the 365, and `daysHeld` is capped only at 366 (a longer hold inside
  one income year is a caller bug, not a bigger deduction).
- **The TPAR due date no longer drifts a day.** `tparDueDate` built a local-
  midnight `Date`, which `toISOString()` renders as 27 August for anyone east of
  Greenwich — i.e. every Australian, i.e. everyone who lodges a TPAR. It is now
  built at UTC noon so both `toISOString()` and local getters read 28 August, and
  `tparDueDateYmd()` returns the calendar date as a string for storage and
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
