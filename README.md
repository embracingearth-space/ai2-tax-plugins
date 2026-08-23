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
| `prime_cost` | every country | 100% ÷ effective life, applied to cost |
| `diminishing_value` | every country | 200% ÷ effective life (150% before 10 May 2006), applied to the opening value |
| `immediate_writeoff` | AU | the whole opening value, in year one, with no day apportionment |
| `pool` | AU | 15% in the allocation year, 30% each year after |

Australia is the only jurisdiction with rules of its own today. Its effective lives are read from Table B of the Income Tax Assessment (Effective Life of Depreciating Assets) Determination 2025 (F2025L01097), which commenced on 16 September 2025 and replaced the withdrawn TR 2022/1 line of rulings; fifteen common categories ship, each carrying the exact Table B wording it came from. The list is short on purpose — an asset that could not be read straight out of the determination is left out for you to look up or self-assess, because a wrong effective life is a wrong deduction every year for the life of the asset. Everywhere else `effectiveLife()` returns null and `effectiveLifeCategories()` returns an empty list rather than a guess.

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
