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
 * - Depreciation: GENERIC_DEPRECIATION_RULES, getDepreciationRules, computePoolPeriod, computeClassPeriod (capital allowances)
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
  computePoolPeriod,
  computeClassPeriod,
  sortNewestFirst,
  resolveEffectiveDated,
  DV_RATE_MULTIPLIER,
  DV_RATE_MULTIPLIER_PRE_10_MAY_2006,
} from './depreciation';

export type {
  DepreciationMethod,
  DepreciationRegime,
  DepreciationRules,
  RatePerAssetRules,
  PooledAllowanceRules,
  UkPool,
  UkTaxpayerType,
  UkPeriod,
  UkAssetInput,
  UkPoolAssignment,
  UkWdaRateOutcome,
  UkAiaOutcome,
  UkSmallPoolsOutcome,
  UkFirstYearAllowanceKind,
  UkFirstYearAllowanceOutcome,
  UkEligibilityOutcome,
  PoolPeriodAddition,
  PoolPeriodDisposal,
  PoolPeriodInput,
  PoolPeriodOutcome,
  ClassCcaRules,
  CaCcaClass,
  CaAssetKind,
  CaAssetInput,
  CaClassAssignment,
  CaFirstYearOutcome,
  CaVehicleCapOutcome,
  ClassPeriodAddition,
  ClassPeriodDisposal,
  ClassPeriodInput,
  ClassPeriodOutcome,
  WriteOffElectiveRules,
  SgWriteOffMethod,
  SgWorkingLifeYears,
  SgAssetInput,
  SgEligibilityOutcome,
  SgAllowanceOutcome,
  SgLowValueCapOutcome,
  StraightLineFixedRules,
  IeCo2Band,
  IeAssetInput,
  IeAllowableCostOutcome,
  IeWearAndTearInput,
  IeWearAndTearOutcome,
  WriteOffPeriodRules,
  ZaWriteOffPeriodOutcome,
  PartYearInput,
  DepreciationExplainer,
  DepreciationVocabulary,
  FirstYearConcession,
  AssetFieldSpec,
  EffectiveDatedRow,
  DeclineInValueInput,
  DeclineInValueOutcome,
  EffectiveLifeCategory,
  InstantAssetWriteOffInfo,
  BalancingAdjustmentInput,
  BalancingAdjustmentOutcome,
} from './depreciation';

// Australia — the ATO's effective-life regime.
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

// New Zealand — Inland Revenue's rate-per-asset regime (IR265 rates, whole-month part years).
export {
  NZ_DEPRECIATION_RULES,
  NZ_RATE_CATEGORIES,
  NZ_RATE_SOURCE,
  NZ_LOW_VALUE_ASSET_ROWS,
  NZ_INVESTMENT_BOOST_ROWS,
  NZ_INVESTMENT_BOOST_START,
  NZ_POOLING_RULES,
  NZ_DEPRECIATION_AUTHORITY_URLS,
  nzRateFor,
  nzWholeMonthsUsed,
  nzLowValueThreshold,
  nzInvestmentBoost,
  nzInvestmentBoostSplit,
} from './countries/newZealandDepreciation';

export type {
  NzRateCategory,
  NzLowValueRow,
  NzInvestmentBoostRow,
  NzInvestmentBoostInfo,
  NzInvestmentBoostSplit,
} from './countries/newZealandDepreciation';

// United Kingdom — HMRC's pooled capital allowances (pools, WDA, AIA, FYAs, CO₂ cars, cash basis).
export {
  UK_DEPRECIATION_RULES,
  UK_AIA_ROWS,
  UK_CAR_BAND_ROWS,
  UK_CASH_BASIS_RESTRICTION,
  UK_DEPRECIATION_AUTHORITY_URLS,
  UK_MAIN_POOL_WDA_BEFORE_APRIL_2026,
  UK_MAIN_POOL_WDA_FROM_APRIL_2026,
  UK_SPECIAL_RATE_POOL_WDA,
  UK_MAIN_POOL_WDA_CHANGE_YEAR,
  UK_SMALL_POOLS_ANNUAL_LIMIT,
  UK_FYA_40_START,
  UK_FULL_EXPENSING_START,
  UK_SUPER_DEDUCTION_START,
  UK_SUPER_DEDUCTION_END,
  ukPeriodYearFraction,
  ukWdaRate,
  ukAia,
  ukAiaOnDate,
  ukSmallPoolsAllowance,
  ukCarBand,
  ukPoolFor,
  ukFirstYearAllowance,
  ukCashBasisRestriction,
  ukEligibility,
} from './countries/unitedKingdomDepreciation';

export type { UkAiaRow, UkCarBandRow } from './countries/unitedKingdomDepreciation';

// Canada — the CRA's class-based capital cost allowance regime.
export {
  CA_DEPRECIATION_RULES,
  CA_CCA_CLASSES,
  CA_PASSENGER_VEHICLE_CAP_ROWS,
  CA_PASSENGER_VEHICLE_CAP_LAST_VERIFIED_YEAR,
  CA_ZEV_CAP_ROWS,
  CA_DEPRECIATION_AUTHORITY_URLS,
  CA_AII_ACQUIRED_AFTER,
  CA_AII_AVAILABLE_BEFORE_YEAR,
  CA_AII_PHASE_OUT_FROM_YEAR,
  CA_CLASS_50_ACQUIRED_AFTER,
  CA_ZEV_ACQUIRED_AFTER,
  caClassRow,
  caClassFor,
  caFirstYear,
  caPassengerVehicleCap,
  caZeroEmissionVehicleCap,
} from './countries/canadaDepreciation';

export type { CaCcaClassRow, CaVehicleCapRow } from './countries/canadaDepreciation';

// Singapore — IRAS's write-off elective capital allowances (ss.19/19A elections per asset).
export {
  SG_DEPRECIATION_RULES,
  SG_DEPRECIATION_AUTHORITY_URLS,
  SG_LOW_VALUE_PER_ITEM_LIMIT,
  SG_LOW_VALUE_TOTAL_PER_YA,
  SG_TWO_YEAR_YAS,
  SG_WORKING_LIFE_ELECTION_FROM_YA,
  SG_INITIAL_ALLOWANCE_RATE,
  SG_MOTOR_VEHICLE_WORKING_LIFE,
  sgEligibility,
  sgMethodsFor,
  sgAllowanceForYear,
  sgLowValueCap,
} from './countries/singaporeDepreciation';

// Ireland — Revenue's fixed 12.5% straight-line wear and tear (car cost cap by CO₂ band).
export {
  IE_DEPRECIATION_RULES,
  IE_DEPRECIATION_AUTHORITY_URLS,
  IE_DISPOSAL_BALANCING,
  IE_WEAR_AND_TEAR_RATE,
  IE_WEAR_AND_TEAR_YEARS,
  IE_CAR_SPECIFIED_LIMIT,
  IE_CAR_CO2_BAND_AC_MAX,
  IE_CAR_CO2_BAND_DE_MAX,
  ieAllowableCost,
  ieWearAndTear,
} from './countries/irelandDepreciation';

// South Africa — SARS's write-off period regime (IN47 schedule, SL/DV election, day apportionment).
export {
  ZA_DEPRECIATION_RULES,
  ZA_DEPRECIATION_AUTHORITY_URLS,
  ZA_WRITE_OFF_CATEGORIES,
  ZA_WRITE_OFF_SOURCE,
  ZA_SMALL_ITEM_ROWS,
  ZA_SMALL_ITEM_LIMIT,
  ZA_SMALL_ITEM_LIMIT_FROM,
  zaWriteOffPeriod,
  zaSmallItemThreshold,
} from './countries/southAfricaDepreciation';

export type { ZaSmallItemRow } from './countries/southAfricaDepreciation';

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
