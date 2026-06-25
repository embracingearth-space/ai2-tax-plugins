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
} from './types';

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
} from './data';

export type {
  CurrencyInfo,
  FinancialYearConfig,
  TaxFamily,
  CountryTaxRateInfo,
  RateLedgerRow,
  RateSource,
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
export { default as canadaIncomeTaxPlugin } from './countries/canadaIncomeTax';
