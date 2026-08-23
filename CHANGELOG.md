# Changelog

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
