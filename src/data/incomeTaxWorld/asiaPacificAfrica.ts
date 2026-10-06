/**
 * Data-built income-tax countries: TH MY PH EG KE NG ZA SG ID VN CN. @ai2/tax-plugins — embracingearth.space
 * One file per country beside this one; this list only registers them.
 */
import type { CountryIncomeTaxData } from '../incomeTaxFactory';
import { TH_INCOME_TAX } from './th';
import { MY_INCOME_TAX } from './my';
import { PH_INCOME_TAX } from './ph';
import { EG_INCOME_TAX } from './eg';
import { KE_INCOME_TAX } from './ke';
import { NG_INCOME_TAX } from './ng';
import { ZA_INCOME_TAX } from './za';
import { SG_INCOME_TAX } from './sg';
import { ID_INCOME_TAX } from './id';
import { VN_INCOME_TAX } from './vn';
import { CN_INCOME_TAX } from './cn';

export const ASIA_PACIFIC_AFRICA: CountryIncomeTaxData[] = [
  TH_INCOME_TAX,
  MY_INCOME_TAX,
  PH_INCOME_TAX,
  EG_INCOME_TAX,
  KE_INCOME_TAX,
  NG_INCOME_TAX,
  ZA_INCOME_TAX,
  SG_INCOME_TAX,
  ID_INCOME_TAX,
  VN_INCOME_TAX,
  CN_INCOME_TAX,
];
