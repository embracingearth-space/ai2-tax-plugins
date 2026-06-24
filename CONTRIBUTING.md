# Contributing to @ai2/tax-plugins

Thanks for contributing to `@ai2/tax-plugins` for `ai2fin.com`.

## Scope

This package is for:

- Tax plugin contracts/types
- Country plugin implementations
- Validation helpers for plugin output
- Public fiscal metadata (rates, filing calendars, form mappings)

This package is **not** for:

- Secrets or credentials
- User-specific data
- Authentication/authorization logic
- Service-side database access

## Standards

- TypeScript only
- Deterministic calculations (no randomness)
- No network calls inside plugin calculations
- Backward-compatible shape changes for minor/patch versions

## Setup

```bash
npm install
npm run typecheck
npm run test
npm run build
```

## Updating a tax rate (the rate ledger)

`src/data/rateLedger.data.ts` is the **single source of truth** for consumption-tax
rates. The flat `COUNTRY_TAX_RATES` view and downstream consumers (the core-app DB
seed, the client fallback) all derive from it, so edit rates here and nowhere else.

Rates are **effective-dated** — a row is valid over `[effectiveFrom, effectiveTo)`:

- **To change a rate**, never edit a number in place. Set `effectiveTo` on the
  current row to the change date, and append a **new** row with
  `effectiveFrom` = that date, the new rate, and a verified `source`.
- **For an announced future change**, add the new row now with a future
  `effectiveFrom`. The resolver activates it automatically on that date — no redeploy.
- Always fill `source` (`authority` + official `url` + `citationDate`) and set
  `verified: true` only when you have checked the rate against that authority.

The test suite (`__tests__/rateLedger.test.ts`, run by the CI Quality Gate) fails the
PR on overlapping/duplicate effective windows, out-of-range rates, or missing
provenance. Use `getStandardTaxRate(country, asOf)` / `resolveRateRow(country, asOf)`
to resolve the rate that applied during a given tax period.

## Adding a country plugin

1. Add implementation under `src/countries/`
2. Register it in `src/registry.ts`
3. Add tests in `__tests__/`
4. Ensure fallback/adaptive generic behavior remains intact
5. Verify no hardcoded secrets or private documents are referenced

## Pull request checklist

- [ ] Typecheck passes
- [ ] Tests pass
- [ ] Registry wiring added/updated
- [ ] README usage stays accurate
- [ ] No breaking changes without major version bump
