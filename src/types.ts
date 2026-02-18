/**
 * Tax Filing Plugin Types - ai2fin.com
 * Core interfaces for multi-country BAS/VAT/GST activity statement filing.
 * Architecture: Plugin-based per country, shared framework for periods, drafts, export, audit.
 */

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
}
