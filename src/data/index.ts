/**
 * Country Reference Data — @ai2/tax-plugins
 * embracingearth.space
 *
 * Single source of truth for all country-specific reference data.
 * Core app imports from here; contributors update here.
 */

// Currencies
export type { CurrencyInfo } from './currencies';
export { CURRENCY_INFO, COUNTRY_CURRENCY_MAP } from './currencies';

// Financial Years
export type { FinancialYearConfig } from './financialYears';
export { FINANCIAL_YEAR_CONFIGS, DEFAULT_FINANCIAL_YEAR_CONFIG } from './financialYears';

// Tax Rates — flat as-of-today view (derived from the ledger)
export type { TaxFamily, CountryTaxRateInfo } from './taxRates';
export { COUNTRY_TAX_RATES, getTaxRateInfo, getStandardTaxRate, detectTaxFamily } from './taxRates';

// Tax Rate Ledger — effective-dated single source of truth + date-aware resolver
export type { RateLedgerRow, RateSource } from './rateLedger';
export {
  RATE_LEDGER,
  RATE_FLOOR,
  resolveRateRow,
  getStandardRateAsOf,
  activeNationalRows,
  toYmd,
} from './rateLedger';

// Company / Corporate Income Tax (headline rates for the CompanyFlatRate forecast strategy)
export type { CompanyTaxRateSet, CompanyTaxInfo, ResolvedCompanyRate } from './companyTax';
export {
  COMPANY_TAX_RATES,
  listCompanyTaxCountries,
  getCompanyTaxInfo,
  getCompanyTaxRate,
} from './companyTax';
