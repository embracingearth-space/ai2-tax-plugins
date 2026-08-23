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
