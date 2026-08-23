/**
 * @ai2/tax-plugins — Country-specific tax filing plugins
 * ai2fin.com
 *
 * Public API surface:
 * - Types: TaxFilingPlugin, FormSection, FormField, etc.
 * - Registry: getPluginForCountry, registerCommunityPlugin, getCountryTaxFilingLabel
 * - Validation: validatePlugin, validateCalculatedOutput
 * - Factory: createAdaptiveGenericPlugin (for building new plugins)
 * - EU Factory: createEUPlugin (for adding EU member states)
 * - Treatments: GENERIC_TREATMENTS, getTreatmentsForPlugin (transaction → box mapping)
 * - Depreciation: GENERIC_DEPRECIATION_RULES, getDepreciationRules (capital allowances)
 * - Annual reports: AnnualReportDefinition (AU TPAR)
 */

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  TaxFilingPlugin,
  AuthorityInfo,
  TaxTerminology,
  FormFieldType,
  RoundingMethod,
  FieldValidation,
  FormField,
  FormSection,
  FilingPeriodConfig,
  RoundingConfig,
  FieldValues,
  CalculatedFields,
  AggregationMapping,
  ValidationSeverity,
  ValidationResult,
  ExportFormat,
  ExportOutput,
  PortalInfo,
  SubJurisdiction,
  CustomFieldDefinition,
  CanonicalTreatmentCode,
  TreatmentSide,
  TaxTreatmentDefinition,
  AnnualReportColumnType,
  AnnualReportColumn,
  AnnualReportDefinition,
  AnnualReportQualificationTest,
  AnnualReportQualifyingService,
} from './types';

// ─── Tax treatments (transaction → box mapping catalogue) ────────────────────
export {
  CANONICAL_TREATMENT_CODES,
  GENERIC_TREATMENTS,
  isCanonicalTreatmentCode,
  getTreatmentsForPlugin,
  getTreatmentDefinition,
  resolveTreatmentRate,
} from './treatments';

// ─── Depreciation / capital allowances ───────────────────────────────────────
export {
  GENERIC_DEPRECIATION_RULES,
  getDepreciationRules,
  computeDeclineInValue,
  computeBalancingAdjustment,
  DV_RATE_MULTIPLIER,
  DV_RATE_MULTIPLIER_PRE_10_MAY_2006,
} from './depreciation';

export type {
  DepreciationMethod,
  DepreciationRules,
  DeclineInValueInput,
  DeclineInValueOutcome,
  EffectiveLifeCategory,
  InstantAssetWriteOffInfo,
  BalancingAdjustmentInput,
  BalancingAdjustmentOutcome,
} from './depreciation';

// Australia — the only jurisdiction here with its own capital-allowance rules.
export {
  AU_DEPRECIATION_RULES,
  AU_EFFECTIVE_LIFE_CATEGORIES,
  AU_EFFECTIVE_LIFE_DETERMINATION,
  AU_INSTANT_ASSET_WRITE_OFF_ROWS,
  AU_SMALL_BUSINESS_POOL_RATES,
  AU_DEPRECIATION_AUTHORITY_URLS,
  auInstantAssetWriteOff,
  auSmallBusinessPoolWriteOff,
  resolveWriteOffRow,
  sortWriteOffRowsNewestFirst,
  AU_DAY_FRACTION_DENOMINATOR,
} from './countries/australiaDepreciation';

export type { AuWriteOffRow } from './countries/australiaDepreciation';

// ─── Annual reports (lodged separately from the activity statement) ──────────
export {
  AU_TPAR,
  AU_ANNUAL_REPORTS,
  AU_TPRS_SERVICES,
  auTprsQualifies,
  tparDueDate,
  tparDueDateYmd,
} from './countries/australiaAnnualReports';

export type {
  TprsQualificationInput,
  TprsQualificationLimb,
  TprsQualificationOutcome,
} from './countries/australiaAnnualReports';

// ─── Registry ────────────────────────────────────────────────────────────────
export {
  getPluginForCountry,
  getPluginForCountryAsync,
  registerCommunityPlugin,
  getPluginInfo,
  listRegisteredCountries,
  listOfficialCountries,
  getCountryTaxFilingLabel,
  getPluginsForBaseCountry,
} from './registry';

export type { PluginTier, RegisteredPlugin } from './registry';

// ─── Validation / Sandboxing ─────────────────────────────────────────────────
export {
  validatePlugin,
  validateCalculatedOutput,
} from './validation';

export type { PluginValidationIssue, PluginValidationResult } from './validation';

// ─── Factories (for building new plugins) ────────────────────────────────────
export { createAdaptiveGenericPlugin } from './adaptiveGeneric';
export { createEUPlugin } from './countries/euTemplate';

// ─── Country Reference Data ──────────────────────────────────────────────────
export {
  CURRENCY_INFO,
  COUNTRY_CURRENCY_MAP,
  FINANCIAL_YEAR_CONFIGS,
  DEFAULT_FINANCIAL_YEAR_CONFIG,
  // Personal income tax (take-home estimator)
  INCOME_TAX_SCHEMES,
  listIncomeTaxCountries,
  getIncomeTaxScheme,
  getIncomeTaxYears,
  calcIncomeTax,
  getIncomeTaxBands,
  localToday,
  COUNTRY_TAX_RATES,
  getTaxRateInfo,
  getStandardTaxRate,
  detectTaxFamily,
  // Effective-dated rate ledger (single source of truth) + date-aware resolver
  RATE_LEDGER,
  RATE_FLOOR,
  resolveRateRow,
  getStandardRateAsOf,
  activeNationalRows,
  toYmd,
  // Company / corporate income tax (headline rates for the forecast engine)
  COMPANY_TAX_RATES,
  listCompanyTaxCountries,
  getCompanyTaxInfo,
  getCompanyTaxRate,
  // Student / training loan compulsory repayments (AU HELP/HECS; generic)
  STUDENT_LOAN_SCHEMES,
  listStudentLoanCountries,
  getStudentLoanInfo,
  getStudentLoanRepayment,
  // Retirement / pension contributions (AU Superannuation Guarantee; generic)
  RETIREMENT_SCHEMES,
  listRetirementCountries,
  getRetirementInfo,
  getSuperannuationEstimate,
} from './data';

export type {
  CurrencyInfo,
  FinancialYearConfig,
  IncomeTaxBand,
  IncomeLineItem,
  IncomeBracketSet,
  IncomeTaxResult,
  IncomeOffsetContext,
  IncomeLevyContext,
  IncomeDeductionContext,
  IncomeYearContext,
  IncomeTaxYearOption,
  IncomeTaxScheme,
  MoneyRounding,
  TaxFamily,
  CountryTaxRateInfo,
  RateLedgerRow,
  RateSource,
  CompanyTaxRateSet,
  CompanyTaxInfo,
  ResolvedCompanyRate,
  StudentLoanBand,
  StudentLoanScheme,
  StudentLoanInfo,
  ResolvedStudentLoanRepayment,
  RetirementScheme,
  RetirementInfo,
  ResolvedSuperannuationEstimate,
} from './data';

// ─── Direct country plugin access (for testing / advanced use) ───────────────
// Tier 1: Major economies
export { default as australiaPlugin } from './countries/australia';
export { default as unitedKingdomPlugin } from './countries/unitedKingdom';
export { default as usaPlugin } from './countries/usa';
export { default as canadaPlugin } from './countries/canada';
export { default as indiaPlugin } from './countries/india';
export { default as japanPlugin } from './countries/japan';
export { default as chinaPlugin } from './countries/china';
export { default as brazilPlugin } from './countries/brazil';

// Tier 2: Mid-tier economies
export { default as newZealandPlugin } from './countries/newZealand';
export { default as singaporePlugin } from './countries/singapore';
export { default as southAfricaPlugin } from './countries/southAfrica';
export { default as uaePlugin } from './countries/uae';
export { default as saudiArabiaPlugin } from './countries/saudiArabia';
export { default as southKoreaPlugin } from './countries/southKorea';
export { default as malaysiaPlugin } from './countries/malaysia';
export { default as thailandPlugin } from './countries/thailand';
export { default as philippinesPlugin } from './countries/philippines';
export { default as indonesiaPlugin } from './countries/indonesia';
export { default as mexicoPlugin } from './countries/mexico';
export { default as madagascarPlugin } from './countries/madagascar';
export { default as ghanaPlugin } from './countries/ghana';

// Income tax plugins (compound keys)
export { default as ukSelfAssessmentPlugin } from './countries/ukSelfAssessment';
export { default as indiaIncomeTaxPlugin } from './countries/indiaIncomeTax';
export { default as usIncomeTaxPlugin } from './countries/usIncomeTax';
export { default as australiaIncomeTaxPlugin } from './countries/australiaIncomeTax';
// Ground truth for the AU-IT legislated first-bracket-rate cuts — exported so
// tests assert against real logic instead of re-deriving it inline.
export { calcAuTax, currentFyStartYear, firstBracketRate } from './countries/australiaIncomeTax';
export { default as canadaIncomeTaxPlugin } from './countries/canadaIncomeTax';
