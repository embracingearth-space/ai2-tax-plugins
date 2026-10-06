/**
 * Every country whose income tax is built from DATA by incomeTaxFactory.ts.
 * @ai2/tax-plugins — embracingearth.space
 *
 * One file per country (src/data/incomeTaxWorld/<cc>.ts), each exporting a
 * CountryIncomeTaxData record. Adding a country is: write its file, add it to
 * WORLD_INCOME_TAX_DATA below, add its tests. INCOME_TAX_SCHEMES, coverage()
 * and the rate watch pick it up from here with no other change.
 */
import { buildIncomeTaxScheme, type CountryIncomeTaxData } from '../incomeTaxFactory';
import type { IncomeTaxScheme } from '../incomeTax';
import { IE_INCOME_TAX } from './ie';
import { EUROPE_WEST } from './europeWest';
import { EUROPE_SOUTH_WEST } from './europeSouthWest';
import { EUROPE_NORTH } from './europeNorth';
import { EUROPE_CENTRAL_EAST } from './europeCentralEast';
import { ASIA_MIDDLE_EAST } from './asiaMiddleEast';
import { ASIA_PACIFIC_AFRICA } from './asiaPacificAfrica';
import { AMERICAS } from './americas';

/** The records, in code order. Exported for tests and tooling. */
export const WORLD_INCOME_TAX_DATA: readonly CountryIncomeTaxData[] = [
  IE_INCOME_TAX,
  ...EUROPE_WEST,
  ...EUROPE_SOUTH_WEST,
  ...EUROPE_NORTH,
  ...EUROPE_CENTRAL_EAST,
  ...ASIA_MIDDLE_EAST,
  ...ASIA_PACIFIC_AFRICA,
  ...AMERICAS,
].sort((a, b) => a.code.localeCompare(b.code));

export const WORLD_INCOME_TAX_SCHEMES: Record<string, IncomeTaxScheme> = Object.fromEntries(
  WORLD_INCOME_TAX_DATA.map((d) => [d.code, buildIncomeTaxScheme(d)]),
);

if (Object.keys(WORLD_INCOME_TAX_SCHEMES).length !== WORLD_INCOME_TAX_DATA.length) {
  throw new Error('Duplicate country code in WORLD_INCOME_TAX_DATA');
}
