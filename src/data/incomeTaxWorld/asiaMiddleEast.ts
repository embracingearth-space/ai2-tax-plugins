/**
 * Data-built income-tax countries: JP KR IL AE SA PK BD. @ai2/tax-plugins — embracingearth.space
 * One file per country beside this one; this list only registers them.
 */
import type { CountryIncomeTaxData } from '../incomeTaxFactory';
import { JP_INCOME_TAX } from './jp';
import { KR_INCOME_TAX } from './kr';
import { IL_INCOME_TAX } from './il';
import { AE_INCOME_TAX } from './ae';
import { SA_INCOME_TAX } from './sa';
import { PK_INCOME_TAX } from './pk';
import { BD_INCOME_TAX } from './bd';

export const ASIA_MIDDLE_EAST: CountryIncomeTaxData[] = [JP_INCOME_TAX, KR_INCOME_TAX, IL_INCOME_TAX, AE_INCOME_TAX, SA_INCOME_TAX, PK_INCOME_TAX, BD_INCOME_TAX];
