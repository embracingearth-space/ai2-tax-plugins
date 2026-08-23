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

## Authority URLs (`portalUrl` / `helpUrl`)

Every plugin names its tax authority's lodgement portal and guidance page, and cites a
`Reference:` URL in its file header. All three rot without any code change — agencies
reorganise their sites and the old path starts returning 404 — so they need periodic
re-checking (the checker covers comment URLs too, not just the fields):

```bash
npm run check:urls
```

The checker reports; it never edits a URL. It classifies each result three ways, and
the distinction matters:

- **dead** — 404/410, or a 200 whose page body says "page not found" (a soft 404).
  Actionable: find the authority's current page and replace it.
- **login-wall** — redirects to an auth page. A defect on anything that must be publicly
  readable (`helpUrl`, `Reference:`); a `portalUrl` is *supposed* to require a login to lodge.
- **inconclusive** — 403 or a timeout. **Not actionable on its own.** Government sites
  routinely bot-block or geo-fence scripted clients while working fine for a person.

**Always confirm in a real browser before changing a URL.** A plain HTTP client cannot
tell "blocked" from "broken", and several of these URLs return 403 to a script and 200
to a browser (canada.ca, aade.gr, myir.ird.govt.nz). Check the page actually covers the
topic too — a 200 is not enough, as some sites serve a soft-404 or a login redirect with
a success status.

Some sites answer **200 for every path**. `bir.gov.ph` serves its SPA shell for any URL
and renders a blank body for routes that do not exist, so `/vat` and `/tax-information`
look alive to any checker. Judge by what the page actually *renders*, not by its status:
an empty body is a broken page, and shipping one is worse than shipping no link at all —
a 404 at least tells the reader the page is gone.

If an authority has genuinely removed a guidance page and published nothing equivalent,
**omit `helpUrl`** (it is optional) rather than substituting a homepage. The app labels
that link as guidance on the return; a homepage under that label is a false promise.

When replacing a dead URL, find the **equivalent page**, not merely a page that loads.
An authority that reorganises usually keeps the same document at a new path (IRD moved
`filing-and-paying-gst-and-provisional-tax` → `filing-and-paying-gst-and-refunds`), so
navigate the site to the successor rather than settling for a parent index — the app
labels these links by what they should contain ("GSTN guidance on GSTR-3B"), and a
generic landing page makes that label a lie.

Date-stamp any "verified/checked" comment in **UTC** and say so — contributors and CI
read timestamps in UTC, so a local-timezone stamp can look like a future date to a
reviewer.

Known **unverifiable from outside the country** (leave them alone unless you can check
locally): `nra.bg` (Bulgaria), `cfr.gov.mt` (Malta, Cloudflare), `sat.gob.mx` (Mexico).

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
