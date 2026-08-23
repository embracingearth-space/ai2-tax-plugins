/**
 * Tax Filing Plugin Types - ai2fin.com
 * Core interfaces for multi-country BAS/VAT/GST activity statement filing.
 * Architecture: Plugin-based per country, shared framework for periods, drafts, export, audit.
 */

// Type-only import: the depreciation contract lives with its arithmetic in
// ./depreciation, and this reference is erased at compile time, so the two
// modules do not form a runtime cycle.
import type { DepreciationRules } from './depreciation';

// ─── Identity & Authority ───────────────────────────────────────────────────

export interface AuthorityInfo {
  name: string;
  fullName: string;
  portalUrl: string;
  helpUrl?: string;
  logo?: string;
}

export interface TaxTerminology {
  taxName: string;
  taxAbbrev: string;
  salesLabel: string;
  purchasesLabel: string;
  outputTaxLabel?: string;
  inputTaxLabel?: string;
}

// ─── Form Schema ────────────────────────────────────────────────────────────

export type FormFieldType = 'currency' | 'integer' | 'percentage' | 'boolean' | 'text' | 'select';

export type RoundingMethod = 'down' | 'up' | 'nearest' | 'truncate';

export interface FieldValidation {
  min?: number;
  max?: number;
  noNegatives?: boolean;
  wholeNumbersOnly?: boolean;
  required?: boolean;
}

export interface FormField {
  id: string;
  label: string;
  officialLabel?: string;
  helpText?: string;
  type: FormFieldType;
  calculated?: boolean;
  calculationFormula?: string;
  dependsOn?: string[];
  autoPopulateFrom?: string;
  editable: boolean;
  required: boolean;
  validationRules?: FieldValidation[];
  section?: string;
  selectOptions?: { value: string; label: string }[];
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  collapsed?: boolean;
  fields: FormField[];
}

// ─── Filing Periods & Financial Year ─────────────────────────────────────────

export interface FilingPeriodConfig {
  monthly: boolean;
  quarterly: boolean;
  annual: boolean;
  defaultFrequency: 'monthly' | 'quarterly' | 'annual';
}

export interface RoundingConfig {
  method: RoundingMethod;
  decimals: number;
  wholeOnly?: boolean;
  noNegatives?: boolean;
}

// ─── Field Values & Calculations ────────────────────────────────────────────

export type FieldValues = Record<string, string | number | boolean | null>;

export interface CalculatedFields {
  [fieldId: string]: number | string | boolean;
}

export interface AggregationMapping {
  fieldId: string;
  aggregateKey: string;
  transform?: (value: number) => number;
}

// ─── Validation ─────────────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationResult {
  fieldId?: string;
  message: string;
  severity: ValidationSeverity;
}

// ─── Export ─────────────────────────────────────────────────────────────────

export interface ExportFormat {
  id: string;
  label: string;
  mimeType: string;
  fileExtension: string;
}

/**
 * ExportOutput — uses generic binary representation for Node/browser portability.
 * Core app should convert `data` to Blob for frontend download, or Buffer for server-side.
 * ai2fin.com
 */
export interface ExportOutput {
  data: string | Uint8Array;
  filename: string;
  mimeType: string;
}

export interface PortalInfo {
  portalUrl: string;
  submissionMethod: 'manual_upload' | 'api' | 'portal_form';
  apiReady?: boolean;
}

// ─── State/Province (for US, India, Canada, etc.) ────────────────────────────

export interface SubJurisdiction {
  code: string;
  name: string;
  rate?: number;
}

// ─── Custom Fields (generic template) ───────────────────────────────────────

export interface CustomFieldDefinition {
  id: string;
  label: string;
  type: FormFieldType;
  defaultValue?: number | string;
  optional?: boolean;
}

// ─── Tax treatments (transaction → box mapping contract) ─────────────────────

/**
 * Canonical, jurisdiction-neutral tax treatment codes.
 * A host app stores ONE of these on each category / transaction; the country
 * plugin's `getTaxTreatments()` says which official boxes that code feeds.
 * See src/treatments.ts for the catalogue and README "Tax treatments".
 */
export type CanonicalTreatmentCode =
  // Sales side
  | 'SALE_STANDARD'
  | 'SALE_REDUCED'
  | 'SALE_ZERO_RATED'
  | 'SALE_EXEMPT'
  | 'SALE_INPUT_TAXED'
  // Purchase side
  | 'PURCHASE_STANDARD'
  | 'PURCHASE_CAPITAL'
  | 'PURCHASE_REDUCED'
  | 'PURCHASE_NO_TAX'
  | 'PURCHASE_CAPITAL_NO_TAX'
  | 'PURCHASE_INPUT_TAXED'
  | 'PURCHASE_PRIVATE'
  | 'PURCHASE_REVERSE_CHARGE'
  | 'PURCHASE_IMPORT'
  // Payroll / other
  | 'WAGES'
  | 'WITHHOLDING'
  | 'OUT_OF_SCOPE';

export type TreatmentSide = 'sale' | 'purchase' | 'payroll' | 'excluded';

export interface TaxTreatmentDefinition {
  code: CanonicalTreatmentCode;
  /** Country vocabulary, e.g. AU "GST on Income", NZ "Zero-rated supplies". */
  label: string;
  shortLabel?: string;
  side: TreatmentSide;
  /**
   * Tax rate applied to the net amount. `null` = the jurisdiction's standard
   * rate at the transaction date (resolve via the rate ledger); `0` = no tax.
   */
  rate: number | null;
  /** Tax is in the price. */
  taxApplies: boolean;
  /** Purchase side: the input tax credit is claimable. */
  creditable: boolean;
  /** Official labels (officialLabel or field id of this plugin's schema) the treatment feeds. */
  boxes: string[];
  /** One-liner in the authority's wording. */
  help: string;
  /** URL of the authority page defining the treatment. */
  authorityRef?: string;
  /** Category hints a host app may use as defaults: 'interest_income', 'bank_fees', 'wages', ... */
  defaultFor?: string[];
}

// ─── Annual reports (lodged separately from the activity statement) ─────────

export type AnnualReportColumnType = 'text' | 'currency' | 'abn';

export interface AnnualReportColumn {
  id: string;
  /** Sentence-case label for the screen. */
  label: string;
  type: AnnualReportColumnType;
  /** The authority's own wording for the same column, where it differs. */
  officialLabel?: string;
}

/**
 * A report a business lodges once a year, separately from its activity
 * statement — the AU Taxable payments annual report (TPAR) is the first.
 *
 * A definition describes the report; it does not produce the lodgment file.
 * Those formats are authority-specific and usually need an accredited channel
 * (SBR for the ATO), so `lodgmentNote` says plainly where the report is
 * actually lodged.
 */
export interface AnnualReportDefinition {
  id: 'tpar' | string;
  label: string;
  authority: AuthorityInfo;
  /** The lodgment due date for a financial year ending on this date. */
  dueDate(financialYearEnd: Date): Date;
  columns: AnnualReportColumn[];
  /** The authority requires whole dollars with no cents. */
  wholeDollarsOnly: boolean;
  /** The services that bring a business into the reporting system. */
  qualifyingServices?: Array<{ key: string; label: string; alwaysLodge?: boolean }>;
  /** How the reporting threshold works, in the authority's terms. */
  thresholdNote?: string;
  lodgmentNote: string;
}

// ─── Main Plugin Interface ──────────────────────────────────────────────────

export interface TaxFilingPlugin {
  countryCode: string;
  displayName: string;
  shortName: string;
  authority: AuthorityInfo;
  taxFamily: 'GST' | 'VAT' | 'SALES_TAX' | 'HYBRID' | 'INCOME_TAX' | 'CONSUMPTION_TAX' | 'SST';
  isFullPlugin: boolean;

  getFormSchema(opts?: { stateProvince?: string }): FormSection[];
  getFilingPeriods(): FilingPeriodConfig;
  getFinancialYearBounds(year: number): { start: Date; end: Date };
  getTerminology(): TaxTerminology;

  calculateFields(inputs: FieldValues): CalculatedFields;
  getAutoPopulateMapping(): AggregationMapping[];
  getRoundingRules(): RoundingConfig;

  validateForm(values: FieldValues): ValidationResult[];
  getFieldHelp(fieldId: string): string | null;

  getSupportedExportFormats(): ExportFormat[];
  generateExport(values: FieldValues, format: string): Promise<ExportOutput>;
  getPortalSubmissionInfo(): PortalInfo;

  hasSubJurisdictions(): boolean;
  getSubJurisdictions?(): SubJurisdiction[];

  supportsCustomFields(): boolean;
  getCustomFieldSchema?(): CustomFieldDefinition[];

  /**
   * Country-specific tax treatment catalogue (labels, rates, boxes). Optional:
   * plugins without one fall back to GENERIC_TREATMENTS via getTreatmentsForPlugin().
   */
  getTaxTreatments?(): TaxTreatmentDefinition[];

  /**
   * Capital allowance rules (methods, effective lives, write-off thresholds).
   * Optional: plugins without one fall back to GENERIC_DEPRECIATION_RULES via
   * getDepreciationRules(), so every country still gets a schedule.
   */
  getDepreciationRules?(): DepreciationRules;

  /**
   * Annual reports lodged separately from the activity statement. Optional and
   * rare — only a country that actually has one declares it (AU: TPAR).
   */
  getAnnualReports?(): AnnualReportDefinition[];
}
