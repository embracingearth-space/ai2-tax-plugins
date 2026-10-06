/**
 * Data-built income-tax countries: ES BE LU AT CH PT. @ai2/tax-plugins — embracingearth.space
 * One file per country beside this one; this list only registers them.
 */
import type { CountryIncomeTaxData } from '../incomeTaxFactory';
import { ES_INCOME_TAX } from './es';
import { BE_INCOME_TAX } from './be';
import { LU_INCOME_TAX } from './lu';
import { AT_INCOME_TAX } from './at';
import { CH_INCOME_TAX } from './ch';
import { PT_INCOME_TAX } from './pt';

export const EUROPE_SOUTH_WEST: CountryIncomeTaxData[] = [ES_INCOME_TAX, BE_INCOME_TAX, LU_INCOME_TAX, AT_INCOME_TAX, CH_INCOME_TAX, PT_INCOME_TAX];
