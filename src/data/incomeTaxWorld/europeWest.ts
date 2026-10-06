/**
 * Data-built income-tax countries: DE NL FR IT. @ai2/tax-plugins — embracingearth.space
 * One file per country beside this one; this list only registers them.
 */
import type { CountryIncomeTaxData } from '../incomeTaxFactory';
import { DE_INCOME_TAX } from './de';
import { NL_INCOME_TAX } from './nl';
import { FR_INCOME_TAX } from './fr';
import { IT_INCOME_TAX } from './it';

export const EUROPE_WEST: CountryIncomeTaxData[] = [DE_INCOME_TAX, NL_INCOME_TAX, FR_INCOME_TAX, IT_INCOME_TAX];
