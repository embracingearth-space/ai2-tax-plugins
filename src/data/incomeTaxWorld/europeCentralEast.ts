/**
 * Data-built income-tax countries: PL CZ SK SI HU GR TR. @ai2/tax-plugins — embracingearth.space
 * One file per country beside this one; this list only registers them.
 */
import type { CountryIncomeTaxData } from '../incomeTaxFactory';
import { PL_INCOME_TAX } from './pl';
import { CZ_INCOME_TAX } from './cz';
import { SK_INCOME_TAX } from './sk';
import { SI_INCOME_TAX } from './si';
import { HU_INCOME_TAX } from './hu';
import { GR_INCOME_TAX } from './gr';
import { TR_INCOME_TAX } from './tr';

export const EUROPE_CENTRAL_EAST: CountryIncomeTaxData[] = [
  PL_INCOME_TAX,
  CZ_INCOME_TAX,
  SK_INCOME_TAX,
  SI_INCOME_TAX,
  HU_INCOME_TAX,
  GR_INCOME_TAX,
  TR_INCOME_TAX,
];
