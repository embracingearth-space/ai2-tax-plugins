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

// Personal Income Tax (take-home estimator — AU, NZ, GB, IN, US)
export type {
  IncomeTaxBand,
  IncomeLineItem,
  IncomeBracketSet,
  IncomeTaxResult,
  IncomeOffsetContext,
  IncomeLevyContext,
  IncomeTaxScheme,
} from './incomeTax';
export {
  INCOME_TAX_SCHEMES,
  listIncomeTaxCountries,
  getIncomeTaxScheme,
  getIncomeTaxYears,
  calcIncomeTax,
  getIncomeTaxBands,
  localToday,
} from './incomeTax';

// Company / Corporate Income Tax (headline rates for the CompanyFlatRate forecast strategy)
export type { CompanyTaxRateSet, CompanyTaxInfo, ResolvedCompanyRate } from './companyTax';
export {
  COMPANY_TAX_RATES,
  listCompanyTaxCountries,
  getCompanyTaxInfo,
  getCompanyTaxRate,
} from './companyTax';

// Student / Training Loan compulsory repayments (AU HELP/HECS; generic per-country)
export type {
  StudentLoanBand,
  StudentLoanScheme,
  StudentLoanInfo,
  ResolvedStudentLoanRepayment,
} from './studentLoan';
export {
  STUDENT_LOAN_SCHEMES,
  listStudentLoanCountries,
  getStudentLoanInfo,
  getStudentLoanRepayment,
} from './studentLoan';

// Retirement / Pension contributions (AU Superannuation Guarantee; generic per-country)
export type {
  RetirementScheme,
  RetirementInfo,
  ResolvedSuperannuationEstimate,
} from './superannuation';
export {
  RETIREMENT_SCHEMES,
  listRetirementCountries,
  getRetirementInfo,
  getSuperannuationEstimate,
} from './superannuation';
