/**
 * Plugin Validation/Sandboxing Tests — @ai2/tax-plugins
 * ai2fin.com
 *
 * Verifies: the validation layer catches bad plugins, passes good ones,
 * and enforces security constraints on field labels.
 */

import {
  validatePlugin,
  validateCalculatedOutput,
  australiaPlugin,
  createAdaptiveGenericPlugin,
  type TaxFilingPlugin,
} from '../src';

describe('@ai2/tax-plugins — Validation', () => {
  // ─── Official plugins should pass validation ──────────────────────────────

  it('should validate Australia plugin as valid', () => {
    const result = validatePlugin(australiaPlugin, 'official');
    expect(result.valid).toBe(true);
    expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0);
  });

  it('should validate adaptive generic plugin as valid', () => {
    const generic = createAdaptiveGenericPlugin('ZA');
    const result = validatePlugin(generic, 'community');
    expect(result.valid).toBe(true);
  });

  // ─── Bad plugin detection ─────────────────────────────────────────────────

  it('should catch plugin with invalid country code', () => {
    const bad = {
      ...createAdaptiveGenericPlugin('XX'),
      countryCode: 'INVALID',
    } as TaxFilingPlugin;
    const result = validatePlugin(bad);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.message.includes('2-letter ISO'))).toBe(true);
  });

  it('should catch plugin with empty displayName', () => {
    const bad = {
      ...createAdaptiveGenericPlugin('XX'),
      displayName: '',
    } as TaxFilingPlugin;
    const result = validatePlugin(bad);
    expect(result.valid).toBe(false);
  });

  it('should catch plugin with invalid taxFamily', () => {
    const bad = {
      ...createAdaptiveGenericPlugin('XX'),
      taxFamily: 'EXCISE' as any,
    } as TaxFilingPlugin;
    const result = validatePlugin(bad);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.message.includes('Invalid taxFamily'))).toBe(true);
  });

  // ─── XSS detection in field labels ────────────────────────────────────────

  it('should catch XSS in field labels', () => {
    const xssPlugin = createAdaptiveGenericPlugin('XX');
    const originalGetFormSchema = xssPlugin.getFormSchema;
    xssPlugin.getFormSchema = () => {
      const sections = originalGetFormSchema.call(xssPlugin);
      sections[0].fields[0].label = '<script>alert("xss")</script>';
      return sections;
    };

    const result = validatePlugin(xssPlugin);
    expect(result.issues.some(i => i.area === 'security')).toBe(true);
  });

  // ─── Calculated output validation ─────────────────────────────────────────

  it('should pass valid calculated output', () => {
    const issues = validateCalculatedOutput({ tax: 5000, total: 100000 });
    expect(issues).toHaveLength(0);
  });

  it('should catch NaN in calculated output', () => {
    const issues = validateCalculatedOutput({ tax: NaN, total: 100000 });
    expect(issues.some(i => i.message.includes('Non-finite'))).toBe(true);
  });

  it('should catch Infinity in calculated output', () => {
    const issues = validateCalculatedOutput({ tax: Infinity });
    expect(issues.some(i => i.message.includes('Non-finite'))).toBe(true);
  });

  it('should warn on suspiciously large values', () => {
    const issues = validateCalculatedOutput({ tax: 999_999_999_999_999 });
    expect(issues.some(i => i.message.includes('Suspiciously large'))).toBe(true);
  });
});
