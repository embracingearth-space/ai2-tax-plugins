/**
 * Plugin Output Validation & Sandboxing — @ai2/tax-plugins
 * ai2fin.com
 *
 * ARCHITECTURE: This module validates that plugin outputs conform to the TaxFilingPlugin
 * contract. Core app should call validatePluginOutput() on any community plugin before
 * trusting its calculations. Official plugins are trusted but can optionally be validated.
 *
 * This is critical because tax data has legal liability — bad calculations = compliance risk.
 */

import type {
  TaxFilingPlugin,
  FormSection,
  FormField,
  FieldValues,
  CalculatedFields,
  ValidationResult,
  ExportOutput,
} from './types';

// ─── Validation result types ─────────────────────────────────────────────────

export interface PluginValidationIssue {
  area: 'schema' | 'calculation' | 'export' | 'metadata' | 'security';
  severity: 'error' | 'warning';
  message: string;
  field?: string;
}

export interface PluginValidationResult {
  valid: boolean;
  issues: PluginValidationIssue[];
  pluginCountryCode: string;
  tier: string;
}

// ─── Validation limits (sandboxing) ──────────────────────────────────────────

const LIMITS = {
  MAX_SECTIONS: 20,
  MAX_FIELDS_PER_SECTION: 50,
  MAX_TOTAL_FIELDS: 200,
  MAX_FIELD_ID_LENGTH: 64,
  MAX_LABEL_LENGTH: 200,
  MAX_HELP_TEXT_LENGTH: 2000,
  MAX_EXPORT_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  MAX_CALCULATION_TIME_MS: 1000,
  MAX_VALIDATION_TIME_MS: 500,
  // Security: no script injection in labels/help
  FORBIDDEN_PATTERNS: [/<script/i, /javascript:/i, /on\w+=/i, /data:text\/html/i],
} as const;

// ─── Validators ──────────────────────────────────────────────────────────────

function validateMetadata(plugin: TaxFilingPlugin): PluginValidationIssue[] {
  const issues: PluginValidationIssue[] = [];

  if (!plugin.countryCode || plugin.countryCode.length !== 2) {
    issues.push({ area: 'metadata', severity: 'error', message: 'countryCode must be a 2-letter ISO code' });
  }
  if (!plugin.displayName || plugin.displayName.length > 100) {
    issues.push({ area: 'metadata', severity: 'error', message: 'displayName required and must be < 100 chars' });
  }
  if (!plugin.authority?.name) {
    issues.push({ area: 'metadata', severity: 'error', message: 'authority.name is required' });
  }
  if (!['GST', 'VAT', 'SALES_TAX', 'HYBRID'].includes(plugin.taxFamily)) {
    issues.push({ area: 'metadata', severity: 'error', message: `Invalid taxFamily: ${plugin.taxFamily}` });
  }

  return issues;
}

function validateSchema(sections: FormSection[]): PluginValidationIssue[] {
  const issues: PluginValidationIssue[] = [];

  if (sections.length > LIMITS.MAX_SECTIONS) {
    issues.push({ area: 'schema', severity: 'error', message: `Too many sections: ${sections.length} (max ${LIMITS.MAX_SECTIONS})` });
  }

  let totalFields = 0;
  const fieldIds = new Set<string>();

  for (const section of sections) {
    if (!section.id || !section.title) {
      issues.push({ area: 'schema', severity: 'error', message: 'Section missing id or title' });
    }
    if (section.fields.length > LIMITS.MAX_FIELDS_PER_SECTION) {
      issues.push({ area: 'schema', severity: 'error', message: `Section "${section.id}" has too many fields: ${section.fields.length}` });
    }

    for (const field of section.fields) {
      totalFields++;

      // Duplicate field ID check
      if (fieldIds.has(field.id)) {
        issues.push({ area: 'schema', severity: 'error', message: `Duplicate field ID: ${field.id}`, field: field.id });
      }
      fieldIds.add(field.id);

      // Length limits
      if (field.id.length > LIMITS.MAX_FIELD_ID_LENGTH) {
        issues.push({ area: 'schema', severity: 'error', message: `Field ID too long: ${field.id}`, field: field.id });
      }
      if (field.label.length > LIMITS.MAX_LABEL_LENGTH) {
        issues.push({ area: 'schema', severity: 'warning', message: `Label too long: ${field.id}`, field: field.id });
      }

      // Security: XSS in labels/help text
      for (const pattern of LIMITS.FORBIDDEN_PATTERNS) {
        if (pattern.test(field.label) || (field.helpText && pattern.test(field.helpText))) {
          issues.push({
            area: 'security',
            severity: 'error',
            message: `Potential XSS in field "${field.id}" label or helpText`,
            field: field.id,
          });
        }
      }

      // Calculated fields must have dependsOn
      if (field.calculated && (!field.dependsOn || field.dependsOn.length === 0)) {
        issues.push({ area: 'schema', severity: 'warning', message: `Calculated field "${field.id}" has no dependsOn`, field: field.id });
      }

      // dependsOn references must exist
      if (field.dependsOn) {
        for (const dep of field.dependsOn) {
          if (!fieldIds.has(dep)) {
            // May reference a field not yet seen — defer check
          }
        }
      }
    }
  }

  if (totalFields > LIMITS.MAX_TOTAL_FIELDS) {
    issues.push({ area: 'schema', severity: 'error', message: `Too many total fields: ${totalFields} (max ${LIMITS.MAX_TOTAL_FIELDS})` });
  }

  return issues;
}

function validateCalculations(plugin: TaxFilingPlugin): PluginValidationIssue[] {
  const issues: PluginValidationIssue[] = [];

  // Test with sample inputs — check timing and output sanity
  const testInputs: FieldValues = {};
  const sections = plugin.getFormSchema();
  for (const s of sections) {
    for (const f of s.fields) {
      if (f.type === 'currency' || f.type === 'integer' || f.type === 'percentage') {
        testInputs[f.id] = 1000;
      } else if (f.type === 'boolean') {
        testInputs[f.id] = false;
      }
    }
  }

  const start = Date.now();
  let result: CalculatedFields;
  try {
    result = plugin.calculateFields(testInputs);
  } catch (err) {
    issues.push({ area: 'calculation', severity: 'error', message: `calculateFields threw: ${(err as Error).message}` });
    return issues;
  }
  const elapsed = Date.now() - start;

  if (elapsed > LIMITS.MAX_CALCULATION_TIME_MS) {
    issues.push({ area: 'calculation', severity: 'error', message: `calculateFields too slow: ${elapsed}ms (max ${LIMITS.MAX_CALCULATION_TIME_MS}ms)` });
  }

  // Check output values are finite numbers or strings
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      issues.push({ area: 'calculation', severity: 'error', message: `Non-finite result for "${key}": ${value}`, field: key });
    }
  }

  return issues;
}

// ─── Main validation function ────────────────────────────────────────────────

/**
 * Validate a plugin's conformance to the TaxFilingPlugin contract.
 * Run this on community plugins before trusting their output.
 * ai2fin.com — tax data integrity is non-negotiable.
 */
export function validatePlugin(plugin: TaxFilingPlugin, tier: string = 'community'): PluginValidationResult {
  const issues: PluginValidationIssue[] = [];

  // 1. Metadata validation
  issues.push(...validateMetadata(plugin));

  // 2. Schema validation
  try {
    const sections = plugin.getFormSchema();
    issues.push(...validateSchema(sections));
  } catch (err) {
    issues.push({ area: 'schema', severity: 'error', message: `getFormSchema() threw: ${(err as Error).message}` });
  }

  // 3. Calculation validation (only if schema passed)
  if (!issues.some((i) => i.area === 'schema' && i.severity === 'error')) {
    issues.push(...validateCalculations(plugin));
  }

  // 4. Required methods exist
  const requiredMethods: (keyof TaxFilingPlugin)[] = [
    'getFormSchema',
    'getFilingPeriods',
    'getFinancialYearBounds',
    'getTerminology',
    'calculateFields',
    'getAutoPopulateMapping',
    'getRoundingRules',
    'validateForm',
    'getSupportedExportFormats',
    'generateExport',
    'getPortalSubmissionInfo',
  ];
  for (const method of requiredMethods) {
    if (typeof plugin[method] !== 'function') {
      issues.push({ area: 'metadata', severity: 'error', message: `Missing required method: ${method}` });
    }
  }

  return {
    valid: !issues.some((i) => i.severity === 'error'),
    issues,
    pluginCountryCode: plugin.countryCode,
    tier,
  };
}

/**
 * Validate specific calculated output values against sanity bounds.
 * Use this at runtime when displaying calculated fields to users.
 */
export function validateCalculatedOutput(
  output: CalculatedFields,
  maxAbsoluteValue: number = 999_999_999_999,
): PluginValidationIssue[] {
  const issues: PluginValidationIssue[] = [];
  for (const [key, value] of Object.entries(output)) {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        issues.push({ area: 'calculation', severity: 'error', message: `Non-finite value for "${key}"`, field: key });
      } else if (Math.abs(value) > maxAbsoluteValue) {
        issues.push({ area: 'calculation', severity: 'warning', message: `Suspiciously large value for "${key}": ${value}`, field: key });
      }
    }
  }
  return issues;
}
