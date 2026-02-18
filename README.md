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
- `ai2-core-app` should pin `@ai2/tax-plugins` with a bounded range (for example `^1.0.0`).

## Security and data handling

- This package is pure computation and metadata.
- It must not contain secrets, API keys, or tenant/user PII.
- Consumer services are responsible for authentication, authorization, and tenant isolation.

## Repository

- GitHub: https://github.com/embracingearth-space/ai2-tax-plugins
- Product: https://ai2fin.com

## License

MIT
