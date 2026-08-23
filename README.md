# @ai2/tax-plugins

Enterprise-grade tax filing plugin engine for `ai2fin.com`.

`@ai2/tax-plugins` provides modular country plugins for activity statements, VAT/GST returns, and income-tax style filings with a secure, extensible plugin contract.

## Why this package exists

- Standardize tax calculations across many countries with one contract
- Keep jurisdiction logic isolated per country
- Allow safe fallback via adaptive generic templates
- Support enterprise deployments where core app and tax engine are versioned independently

## Features

- Country plugin registry with deterministic lookup
- Support for multiple tax families (`GST`, `VAT`, `INCOME_TAX`, `CONSUMPTION_TAX`, `SST`)
- Strong TypeScript interfaces for inputs/outputs
- Validation and sandbox-friendly plugin shape checks
- Extensible metadata for official form references and filing cadence
- Tax treatment catalogue: canonical transaction codes mapped to each country's official boxes
- Capital allowances: prime cost and diminishing value everywhere, with the AU effective lives, instant asset write-off and small business pool
- Annual reports lodged outside the activity statement (AU Taxable payments annual report)

## Install

```bash
npm install @ai2/tax-plugins
```

## Usage

```ts
import { createTaxPluginRegistry } from '@ai2/tax-plugins';

const registry = createTaxPluginRegistry();

const plugin = registry.getPlugin({
  countryCode: 'AU',
  taxFamily: 'GST',
  formType: 'BAS'
});

if (!plugin) throw new Error('No plugin found');

const result = plugin.calculate({
  period: { start: '2026-01-01', end: '2026-03-31' },
  transactions: []
});
```

## Tax treatments

Every activity statement is a sum of classified transactions, so the package ships a catalogue of **tax treatments**: jurisdiction-neutral codes that a host app stores once per category or transaction, which each country plugin then translates into its own vocabulary and into the official boxes it feeds. The codes are deliberately small in number and mean the same thing everywhere; the plugin supplies the local label, the rate, whether tax is in the price, whether a credit is claimable, and the box list.

| Code | Meaning | AU example (BAS) |
| --- | --- | --- |
| `SALE_STANDARD` | Taxable sale at the standard rate | GST on Income → G1, 1A |
| `SALE_REDUCED` | Taxable sale at a reduced rate (UK 5%, EU reduced, JP 8%) | not used |
| `SALE_ZERO_RATED` | Export / zero-rated: no tax, credits still claimable | Export Sales → G1, G2 |
| `SALE_EXEMPT` | Domestic sale with no tax where credits stay claimable | GST-Free Income → G1, G3 |
| `SALE_INPUT_TAXED` | No tax charged **and** related credits denied (financial supplies incl. interest, residential rent; UK/NZ/EU "exempt") | Input Taxed Income → G1, G4 |
| `PURCHASE_STANDARD` | Non-capital purchase, tax in price, creditable | GST on Expenses → G11, 1B |
| `PURCHASE_CAPITAL` | Capital purchase, tax in price, creditable | GST on Capital → G10, 1B |
| `PURCHASE_REDUCED` | Reduced-rate purchase, creditable | not used |
| `PURCHASE_NO_TAX` | Non-capital purchase with no tax in the price (bank fees, government charges, unregistered suppliers) | GST-Free Expenses → G11, G14 |
| `PURCHASE_CAPITAL_NO_TAX` | Capital purchase with no tax in the price | GST-Free Capital → G10, G14 |
| `PURCHASE_INPUT_TAXED` | Purchase that relates to making input-taxed sales; credit denied | Input Taxed Expenses → G11, G13 |
| `PURCHASE_PRIVATE` | Private-use portion or non-income-tax-deductible purchase | Private / Non-deductible → G11, G15 |
| `PURCHASE_REVERSE_CHARGE` | Imported services you account for yourself | Reverse charge → 1A, 1B |
| `PURCHASE_IMPORT` | Goods imported with tax paid (or deferred) at the border | GST on Imports → G11, 1B |
| `WAGES` | Gross salary and wages (never a purchase) | Wages & salaries → W1 |
| `WITHHOLDING` | Tax withheld from wages | PAYG withheld → W2 |
| `OUT_OF_SCOPE` | Not a supply: transfers, loan principal, drawings, super, dividends, tax payments | BAS Excluded |

A `TaxTreatmentDefinition` carries `code`, `label`, `side` (`sale` / `purchase` / `payroll` / `excluded`), `rate` (`null` means "the standard rate at the transaction date", `0` means no tax), `taxApplies`, `creditable`, `boxes`, `help`, an optional `authorityRef` URL and optional `defaultFor` category hints. Plugins that know their form implement `getTaxTreatments()` (AU, NZ, GB, CA, SG, IN, ZA and the EU template today); everything else falls back to the jurisdiction-neutral `GENERIC_TREATMENTS`, which `getTreatmentsForPlugin()` hides from you:

```ts
import {
  getPluginForCountry,
  getTreatmentsForPlugin,
  getTreatmentDefinition,
  resolveTreatmentRate,
  getStandardRateAsOf,
} from '@ai2/tax-plugins';

const plugin = getPluginForCountry('AU');

// 1. Offer the country vocabulary in the category editor.
const options = getTreatmentsForPlugin(plugin).map((t) => ({ value: t.code, label: t.label }));

// 2. When a transaction is posted, find where it lands on the form.
const interest = getTreatmentDefinition(plugin, 'SALE_INPUT_TAXED');
interest?.boxes; // ['G1', 'G4'] — interest income is input-taxed, never "GST-free"

// 3. Resolve the rate for the transaction date (null = standard rate on that date).
const treatment = getTreatmentDefinition(plugin, 'PURCHASE_STANDARD')!;
const rate = resolveTreatmentRate(treatment, getStandardRateAsOf('AU', '2026-03-01') || 0.1);
```

The host is expected to sum each treatment into the aggregate keys the plugins auto-populate from (`getAutoPopulateMapping()`). AU `1A`/`1B` use the accounts method (the GST recorded on each transaction) and fall back to the calculation-worksheet figures `G9`/`G20` when blank, with `1A_worksheet`/`1B_worksheet` returned alongside so the two methods can be cross-checked. Fields declared *excluding* tax read net (`*_excl_tax`) aggregates; a gross figure in those boxes overstates the tax by the rate, so they stay blank until the host emits the net key. The keys in use, with the treatments that feed them (gross = tax-inclusive; purchases business-use weighted):

| Aggregate key | Definition | Used by |
| --- | --- | --- |
| `income_total` | Gross of all sale treatments | AU G1 |
| `income_total_excl_input_taxed` | `income_total` minus `SALE_INPUT_TAXED` gross (Box 5 includes zero-rated but not exempt supplies) | NZ Box 5 |
| `income_export` | `SALE_ZERO_RATED` gross | AU G2 |
| `income_gst_free` | `SALE_EXEMPT` gross | AU G3 |
| `income_input_taxed` | `SALE_INPUT_TAXED` gross | AU G4 |
| `income_zero_rated` | `SALE_ZERO_RATED` gross | NZ Box 6, SG Box 2 |
| `income_standard_excl_tax` | `SALE_STANDARD` net (gross minus tax) | EU `standard_sales`, SG Box 1, JP 課税標準額 |
| `expenses_capital` | `PURCHASE_CAPITAL` + `PURCHASE_CAPITAL_NO_TAX` gross | AU G10, ZA Field 14 |
| `expenses_non_capital` | All other purchase treatments gross except `WAGES` / `OUT_OF_SCOPE` | AU G11 |
| `expenses_input_taxed_related` | `PURCHASE_INPUT_TAXED` gross | AU G13 |
| `expenses_no_tax` | `PURCHASE_NO_TAX` + `PURCHASE_CAPITAL_NO_TAX` gross | AU G14 |
| `expenses_private` | `PURCHASE_PRIVATE` gross + sum of (1 minus business %) x gross of partially-business rows | AU G15 |
| `expenses_taxable_gross` | Gross of purchase treatments where `taxApplies` (tax-invoice purchases only; excludes wages, exempt and no-tax purchases) | NZ Box 11 |
| `expenses_taxable_excl_tax` | Net (gross minus tax) of standard-rated and zero-rated purchases and imports; excludes exempt, out-of-scope and non-registered suppliers | SG Box 5 |
| `expenses_domestic_excl_tax` | Net of domestic purchase treatments where `taxApplies` | EU `domestic_purchases` |
| `expenses_standard` | `PURCHASE_STANDARD` gross (field declared tax-inclusive) | JP purchases |
| `output_tax` / `input_tax` | Sum of tax on sales / sum of claimable tax on purchases (accounts method) | AU 1A/1B, CA 103/106, SG Box 7, ZA Field 17 |
| `payroll_gross` / `payroll_withheld` | `WAGES` gross / `WITHHOLDING` gross | AU W1 / W2 |

## Depreciation and annual reports

A depreciation schedule is arithmetic over one income year — an opening adjustable value, a rate, the days the asset was held — and the arithmetic is the same shape everywhere; only the rates, the effective lives and the write-off concessions are jurisdictional. `getDepreciationRules(plugin)` hands back the country's own rules where it has them and `GENERIC_DEPRECIATION_RULES` otherwise, so every country gets a schedule and no country is given another country's numbers.

The formulas are the ATO's, from *Prime cost (straight line) and diminishing value methods*:

```text
Prime cost        = cost       × (days held ÷ denominator) × (100% ÷ effective life)
Diminishing value = base value × (days held ÷ denominator) × (200% ÷ effective life)
```

150% replaces 200% for an asset first held before 10 May 2006, and `base value` is the opening adjustable value for the year plus any second-element (improvement) cost incurred during it — pass that as `secondElementCostThisYear` and a $5,000 opening value improved by $1,000 declines from $6,000, carrying the improvement into the closing value. The three other methods refuse a second-element cost instead of quietly ignoring it, because each needs something the module is not told; the error says what to pass instead.

The denominator is the one the jurisdiction publishes, and it is not always the length of the income year. The ATO fixes it at 365 in every year while stating on the same page that days held can be 366 in a leap year, so a full leap-year hold legitimately claims 366/365 of a year — dividing by 366 instead would shorten every leap-year claim by about a quarter of a percent, small on one asset and systematic across a register. Ask `rules.dayFractionDenominator(daysInIncomeYear)` rather than counting days yourself, and note that the Australian rules do not merely document the 365: `declineInValue` applies it, overriding whatever `daysInYear` you passed, so passing 366 returns exactly what passing 365 returns. `GENERIC_DEPRECIATION_RULES` honours your value, since with no jurisdiction there is no published convention to override it with.

Private use is not applied to the decline at all: it is computed on the full base and only the taxable-use portion is deductible, which is why a schedule carries separate *decline in value* and *deductible* columns and why the value carried into the next year is the full decline. The decline is clamped at the base value so an asset cannot depreciate below zero, and `balancingAdjustment` on disposal returns termination value less adjustable value weighted by taxable use — positive is assessable income, negative is a deduction.

| Method | Available in | Rate |
| --- | --- | --- |
| `prime_cost` | every country | 100% ÷ effective life, applied to cost — or a published `annualRate` as-is (NZ straight line) |
| `diminishing_value` | every country | 200% ÷ effective life (150% before 10 May 2006), applied to the opening value — or a published `annualRate` as-is (NZ) |
| `immediate_writeoff` | AU, NZ | the whole opening value, in year one, with no day or month apportionment (NZ: a low value asset) |
| `pool` | AU | 15% in the allocation year, 30% each year after |
| `pool` | GB | the writing-down allowance rate on the pool's written down value — `annualRate` from `wdaRate()`, or the whole HMRC order through `computePoolPeriod()` |

Australia's effective lives are read from Table B of the Income Tax Assessment (Effective Life of Depreciating Assets) Determination 2025 (F2025L01097), which commenced on 16 September 2025 and replaced the withdrawn TR 2022/1 line of rulings; fifteen common categories ship, each carrying the exact Table B wording it came from. The list is short on purpose — an asset that could not be read straight out of the determination is left out for you to look up or self-assess, because a wrong effective life is a wrong deduction every year for the life of the asset. Everywhere else `effectiveLife()` returns null and `effectiveLifeCategories()` returns an empty list rather than a guess.

`instantAssetWriteOff(date)` is effective-dated and stops at 30 June 2026 deliberately. The ATO states $20,000 per asset for the 2023-24, 2024-25 and 2025-26 income years and states nothing at all for 2026-27, so a 2026-27 date comes back as `{ limit: null, verified: false }` with a note asking you to confirm the current limit. $20,000 is not carried forward and the $1,000 statutory reversion is not assumed, because an unverified statutory threshold that looks confident is worse than a blank — nobody checks a number that looks sure of itself. Show the note, not a figure. The related low-pool-balance rule, which deducts the whole pool where the balance before deductions sits under the write-off limit, is exposed as `auSmallBusinessPoolWriteOff()` instead of being applied quietly inside `declineInValue`, and it answers `null` rather than `false` for a date whose limit is unverified.

```ts
import { getPluginForCountry, getDepreciationRules } from '@ai2/tax-plugins';

const rules = getDepreciationRules(getPluginForCountry('AU'));

rules.defaultMethod;                       // 'diminishing_value'
rules.effectiveLife('computer_laptop');    // 2 — Table B, "Mobile/portable computers"
rules.effectiveLife('espresso_machine');   // null — not shipped, so self-assess it

// One income year for a $2,000 fridge held 122 days (the ATO's own worked example).
rules.declineInValue({
  method: 'prime_cost',
  cost: 2000,
  openingAdjustableValue: 2000,
  effectiveLifeYears: 10,
  daysHeld: 122,     // may be 366 in a leap income year
  daysInYear: 365,   // AU fixes the denominator at 365; the rules enforce it
}); // → { declineInValue: 66.85, closingAdjustableValue: 1933.15, rate: 0.1 }

const writeOff = rules.instantAssetWriteOff(new Date('2026-07-01'));
writeOff.limit;      // null
writeOff.verified;   // false — render writeOff.note, never a number
```

### Depreciation regimes

The countries do not share one model, and `rules.regime` says which one a plugin implements so a host can branch instead of printing one country's schedule everywhere. Australia is `effective_life`: the ATO publishes a life in years, the rate is 100% or 200% divided by that life, and a part year is days held over a fixed 365. New Zealand is `rate_per_asset`: Inland Revenue publishes the diminishing value and straight line rate for each asset in IR265, the rate is applied as-is with no multiplier and no life, and a part year is whole months over twelve with a part-month counted as a whole month — bought on 20 May in an April year is eleven months, so the IRD's $10,000 espresso machine at 30% claims $2,750 in year one rather than $3,000, and the rules refuse a days-based input rather than compute an ATO number for an IRD return. The United Kingdom is `pooled_allowance`, where the pool is the unit rather than the asset: HMRC groups plant and machinery into a main pool, a special rate pool and single-asset pools, and the writing-down allowance is a rate on each pool's written down value every accounting period — 18% on the main pool, falling to 14% from 1 April 2026 for Corporation Tax and 6 April 2026 for Income Tax with a day-weighted hybrid rate across a straddling period, and 6% on the special rate pool. The annual investment allowance (£1,000,000 from 1 January 2019, earlier rows effective-dated) and the £1,000 small pools allowance are both pro-rated by period length, nine months being nine twelfths, and the first-year allowances are effective-dated: full expensing and the 50% special-rate allowance for companies from 1 April 2023, the super-deduction for 2021–2023, the 40% allowance on new main-rate plant bought from 1 January 2026 with the remaining 60% written down from the following period, and 100% for new zero-emission cars. Cars are routed to a pool by CO₂ and purchase date from gov.uk's own table, so the same 120 g/km car is main rate in 2019 and special rate in 2026, and a sole trader on the cash basis can claim capital allowances on business cars and nothing else, which is the first line of the UK explainer because for most UK users it is the whole story. `computePoolPeriod` does one pool for one period in HMRC's order — additions, AIA and first-year allowances, disposals capped at cost, balancing charge, small pools allowance or writing-down allowance, closing written down value — and the host replays it period by period. Canada is `class_cca`, the class being the unit: the CRA groups depreciable property into numbered classes, each with a prescribed rate — 4% for class 1 buildings, 20% for class 8 furniture and equipment, 30% for class 10 vehicles, 100% for class 12 tools under $500 and software, 5% for class 14.1 goodwill, 55% for class 50 computers acquired after 18 March 2007, 30% and 40% for the class 54 and 55 zero-emission vehicles — and capital cost allowance is that rate on the class's undepreciated capital cost each year. A passenger vehicle that cost more than the prescribed amount before tax ($30,000 before 2022 rising to $38,000 for 2025, each year's figure read from the page and 2026 unverified because the page does not list it) goes in class 10.1 on its own with its cost capped, no recapture or terminal loss, and the half-year rule on sale. In the year of purchase the half-year rule normally allows CCA on half the net additions; the accelerated investment incentive, for property acquired after 20 November 2018 and available for use before 2028, suspends that rule and applies the rate to one-and-a-half times the net addition before 2024 and to the whole net addition with nothing added for 2024 to 2027, which is the page's own wording for the phase-out, while a zero-emission vehicle gets 100%, 75% or 55% of its cost in the first year by the year it becomes available for use. Claiming CCA is optional, any amount from zero to the maximum, and a short first fiscal period prorates the claim by days over 365. `computeClassPeriod` does one class for one year in the order of T2125 Area A — opening UCC, additions, dispositions at the lesser of proceeds and capital cost, recapture where the balance goes negative, terminal loss where the class empties, the first-year adjustment with dispositions offsetting the non-eligible additions first, CCA capped at the balance, closing UCC — and the host replays it year by year. Everything the classes page marks "under proposed changes" (a reinstated 100% for zero-emission vehicles acquired after 2024, a 100% first-year deduction for class 50 computers acquired after 15 April 2024) ships as a `verified: false` note beside the enacted figure, never as the rate.

Every rules object carries an `explainer()` in the authority's own vocabulary, with `readMore` links to official pages only and a `vocabulary` that drives the schedule's column labels, so the carried value prints as "Adjustable value" for the ATO and "Adjusted tax value" for Inland Revenue. `firstYearConcessions(date)` lists the concessions in force on a date with their `verified` state, and `extraAssetFields()` lists what the register must collect beyond the common fields — New Zealand needs `isNewAsset`, because Investment Boost (20% of the cost as an immediate expense for new assets bought from 22 May 2025, the remaining 80% depreciated) applies to new assets only and an unanswered field is not new. The low value asset threshold is effective-dated the way the Australian write-off is, $1,000 from 17 March 2021 with the temporary $5,000 window and the earlier $500 behind it, and seventeen IR265 rates ship with their page, heading and asset description as printed.

```ts
import {
  getPluginForCountry,
  getDepreciationRules,
  nzWholeMonthsUsed,
  nzInvestmentBoostSplit,
  type RatePerAssetRules,
} from '@ai2/tax-plugins';

const nz = getDepreciationRules(getPluginForCountry('NZ')) as RatePerAssetRules;
nz.regime;                               // 'rate_per_asset'
nz.explainer().vocabulary.writtenDown;   // 'Adjusted tax value'

const rate = nz.rateFor('coffee_maker');   // { dv: 0.3, sl: 0.21, source: 'IR265 … p.20 …' }
const split = nzInvestmentBoostSplit({ cost: 10000, acquiredOn: '2025-06-01', isNewAsset: true });
// → { applied: true, expensedNow: 2000, depreciableCost: 8000, percent: 20, verified: true }

nz.declineInValue({
  method: 'diminishing_value',
  cost: split.depreciableCost,
  openingAdjustableValue: split.depreciableCost,
  annualRate: rate!.dv,
  partYear: { kind: 'months', monthsUsed: nzWholeMonthsUsed('2025-06-01', '2026-03-31') }, // 10
}); // → { declineInValue: 2000, closingAdjustableValue: 6000, rate: 0.3 }
```

```ts
import { getPluginForCountry, getDepreciationRules, computeClassPeriod, type ClassCcaRules } from '@ai2/tax-plugins';

const ca = getDepreciationRules(getPluginForCountry('CA')) as ClassCcaRules;
ca.regime;                               // 'class_cca'
ca.explainer().vocabulary.writtenDown;   // 'Undepreciated capital cost'

const laptop = { cost: 3000, kind: 'computer' as const, acquiredDate: '2026-02-01' };
const cls = ca.classFor(laptop);         // { cls: '50', rate: 0.55, verified: true, source: 'https://www.canada.ca/…' }
const fy = ca.firstYear(laptop, '2026-02-01');
// → { halfYear: false, aiiMultiplier: 1, baseMultiplier: 1, verified: true, note: 'Accelerated investment incentive, phase-out period: …' }

computeClassPeriod({ openingUcc: 0, rate: cls.rate!, additions: [{ cost: 3000, baseMultiplier: fy.baseMultiplier }] });
// → { baseAmount: 3000, maxCca: 1650, ccaClaimed: 1650, closingUcc: 1350, recapture: 0, terminalLoss: 0, … }

ca.passengerVehicleCap(2025);            // { cap: 38000, verified: true, … }
ca.passengerVehicleCap(2026);            // { cap: null, verified: false, note: '… not on the CRA's classes page yet …' }
```

Annual reports are the ones lodged separately from the activity statement, and Australia declares the only one so far: the Taxable payments annual report, due 28 August for the financial year just ended. `getAnnualReports()` is absent on every other plugin, so a country-aware UI simply does not show the report.

| Column | Type | The ATO's wording |
| --- | --- | --- |
| `abn` | `abn` | Contractor's Australian business number (ABN), if known |
| `name` | `text` | Contractor's name (business name or individual's name) |
| `address` | `text` | Contractor's address |
| `grossPaidInclGst` | `currency` | Gross amount paid for the financial year, including GST and any tax withheld |
| `totalGst` | `currency` | Total GST included in the gross amount paid |
| `taxWithheldNoAbn` | `currency` | Total tax withheld where an ABN was not quoted |

Those six are exactly what the ATO's *TPAR contractor details to report* says the report must include. Contractor phone number, email address and bank account details are deliberately absent: the ATO lists those separately as extra information it *may ask for* about a contractor, not as data the annual report carries, so collecting them here would tell you to send the ATO something the TPAR does not report.

Amounts are whole dollars with no cents, and a contractor whose ABN changed during the year gets one row per ABN, so payee identity for the report is the ABN rather than the name. Two different tests decide whether you lodge, and each service carries the one that applies to it. Cleaning, courier and road freight, information technology, and security, investigation or surveillance use the ordinary 10% test — payments received for that service are 10% or more of your business income, with courier and road freight counted together. Building and construction is not exempt from a test; it has a different one. You primarily operate in building and construction services, and so lodge, if 50% or more of your current-year business income is earned from providing them, **or** 50% or more of your current-year business activity relates to them, **or** 50% or more of the immediately preceding year's business income was earned from providing them — that last limb catching a year that is itself under the threshold. `auTprsQualifies()` evaluates the applicable test, inclusive at the boundary, and throws rather than answering "no" when it is given nothing to test. The report is prepared here for you to check before lodging — it is not the ATO lodgment file, which needs an accredited SBR channel — so lodge it through ATO online services, compatible business software, or your registered tax or BAS agent.

## Development

```bash
npm install
npm run typecheck
npm run test
npm run build
```

## Versioning and compatibility

- SemVer is used for releases.
- Breaking contract changes are major versions only.
- `ai2-core-app` should pin `@ai2/tax-plugins` with a bounded range (for example `^2.0.0`).
- **2.0.0 migration** (from 1.x): the host must emit the new aggregate keys listed
  under *Tax treatments* (notably `income_total_excl_input_taxed`,
  `expenses_taxable_gross` and the `*_excl_tax` family), and New Zealand
  statements saved under 1.x must be re-keyed to the official GST101A box numbers.
  The exact field-id mapping is in `CHANGELOG.md`.

## Security and data handling

- This package is pure computation and metadata.
- It must not contain secrets, API keys, or tenant/user PII.
- Consumer services are responsible for authentication, authorization, and tenant isolation.

## Repository

- GitHub: https://github.com/embracingearth-space/ai2-tax-plugins
- Product: https://ai2fin.com

## License

MIT
