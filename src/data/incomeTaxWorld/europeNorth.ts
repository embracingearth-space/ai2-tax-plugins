/**
 * Data-built income-tax countries: DK SE NO IS EE LV LT. @ai2/tax-plugins — embracingearth.space
 * One file per country beside this one; this list only registers them.
 * LT is not registered: neither year can be computed without the euro value
 * of VDU (band thresholds), which the research could not verify.
 */
import type { CountryIncomeTaxData } from '../incomeTaxFactory';
import { DK_INCOME_TAX } from './dk';
import { SE_INCOME_TAX } from './se';
import { NO_INCOME_TAX } from './no';
import { IS_INCOME_TAX } from './is';
import { EE_INCOME_TAX } from './ee';
import { LV_INCOME_TAX } from './lv';

export const EUROPE_NORTH: CountryIncomeTaxData[] = [DK_INCOME_TAX, SE_INCOME_TAX, NO_INCOME_TAX, IS_INCOME_TAX, EE_INCOME_TAX, LV_INCOME_TAX];
