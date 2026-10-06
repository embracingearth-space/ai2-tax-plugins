/**
 * Data-built income-tax countries: MX GT JM AR BR CL CO CR. @ai2/tax-plugins — embracingearth.space
 * One file per country beside this one; this list only registers them.
 */
import type { CountryIncomeTaxData } from '../incomeTaxFactory';
import { MX_INCOME_TAX } from './mx';
import { GT_INCOME_TAX } from './gt';
import { JM_INCOME_TAX } from './jm';
import { AR_INCOME_TAX } from './ar';
import { BR_INCOME_TAX } from './br';
import { CL_INCOME_TAX } from './cl';
import { CO_INCOME_TAX } from './co';
import { CR_INCOME_TAX } from './cr';

export const AMERICAS: CountryIncomeTaxData[] = [
  MX_INCOME_TAX,
  GT_INCOME_TAX,
  JM_INCOME_TAX,
  AR_INCOME_TAX,
  BR_INCOME_TAX,
  CL_INCOME_TAX,
  CO_INCOME_TAX,
  CR_INCOME_TAX,
];
