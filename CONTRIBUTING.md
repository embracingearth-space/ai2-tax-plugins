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
