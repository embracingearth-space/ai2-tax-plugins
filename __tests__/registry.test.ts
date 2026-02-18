/**
 * Registry Tests — @ai2/tax-plugins
 * ai2fin.com
 *
 * Verifies: plugin loading, caching, community registration, label generation,
 * adaptive generic fallback, official plugin protection.
 */

import {
  getPluginForCountry,
  getPluginForCountryAsync,
  registerCommunityPlugin,
  getPluginInfo,
  listRegisteredCountries,
  listOfficialCountries,
  getCountryTaxFilingLabel,
  createAdaptiveGenericPlugin,
} from '../src';

describe('@ai2/tax-plugins — Registry', () => {
  // ─── Official plugin loading ───────────────────────────────────────────────

  it('should return AU plugin with correct metadata', () => {
    const plugin = getPluginForCountry('AU');
    expect(plugin.countryCode).toBe('AU');
    expect(plugin.displayName).toContain('BAS');
    expect(plugin.isFullPlugin).toBe(true);
    expect(plugin.taxFamily).toBe('GST');
  });

  it('should return GB plugin', () => {
    const plugin = getPluginForCountry('GB');
    expect(plugin.countryCode).toBe('GB');
    expect(plugin.taxFamily).toBe('VAT');
    expect(plugin.isFullPlugin).toBe(true);
  });

  it('should return all official countries (49+ after global expansion)', () => {
    const officials = listOfficialCountries();
    // Original 14
    expect(officials).toContain('AU');
    expect(officials).toContain('GB');
    expect(officials).toContain('NZ');
    expect(officials).toContain('CA');
    expect(officials).toContain('SG');
    expect(officials).toContain('IN');
    expect(officials).toContain('US');
    expect(officials).toContain('MG');
    expect(officials).toContain('DE');
    expect(officials).toContain('FR');
    expect(officials).toContain('IT');
    expect(officials).toContain('ES');
    expect(officials).toContain('NL');
    expect(officials).toContain('IE');
    // New countries
    expect(officials).toContain('JP');
    expect(officials).toContain('KR');
    expect(officials).toContain('CN');
    expect(officials).toContain('ZA');
    expect(officials).toContain('AE');
    expect(officials).toContain('SA');
    expect(officials).toContain('MY');
    expect(officials).toContain('TH');
    expect(officials).toContain('PH');
    expect(officials).toContain('ID');
    expect(officials).toContain('BR');
    expect(officials).toContain('MX');
    // Income tax compound keys
    expect(officials).toContain('GB-SA');
    expect(officials).toContain('IN-IT');
    expect(officials).toContain('US-IT');
    expect(officials).toContain('AU-IT');
    expect(officials).toContain('CA-IT');
    // EU expansion
    expect(officials).toContain('AT');
    expect(officials).toContain('BE');
    expect(officials).toContain('PT');
    expect(officials).toContain('PL');
    expect(officials).toContain('SE');
    expect(officials).toContain('FI');
    expect(officials).toContain('DK');
    expect(officials).toContain('NO');
    expect(officials).toContain('CH');
    expect(officials.length).toBeGreaterThanOrEqual(49);
  });

  // ─── Case insensitivity ────────────────────────────────────────────────────

  it('should handle lowercase country codes', () => {
    const plugin = getPluginForCountry('au');
    expect(plugin.countryCode).toBe('AU');
  });

  // ─── Async variant ─────────────────────────────────────────────────────────

  it('should return same plugin via async variant', async () => {
    const sync = getPluginForCountry('NZ');
    const async_ = await getPluginForCountryAsync('NZ');
    expect(sync).toBe(async_);
  });

  // ─── Adaptive generic fallback ─────────────────────────────────────────────

  it('should return adaptive generic for unsupported country', () => {
    const plugin = getPluginForCountry('ZW'); // Zimbabwe — not an official plugin
    expect(plugin.isFullPlugin).toBe(false);
    expect(plugin.countryCode).toBe('ZW');
  });

  it('should default to AU when empty code provided', () => {
    const plugin = getPluginForCountry('');
    expect(plugin.countryCode).toBe('AU');
    expect(plugin.isFullPlugin).toBe(true);
  });

  // ─── Plugin info ───────────────────────────────────────────────────────────

  it('should return plugin info with tier for official plugin', () => {
    const info = getPluginInfo('AU');
    expect(info).not.toBeNull();
    expect(info!.tier).toBe('official');
    expect(info!.version).toBe('1.0.0');
  });

  it('should return null for non-registered code', () => {
    const info = getPluginInfo('XX');
    expect(info).toBeNull();
  });

  // ─── Community plugin registration ─────────────────────────────────────────

  it('should allow registering community plugins', () => {
    const customPlugin = createAdaptiveGenericPlugin('ZW');
    registerCommunityPlugin('ZW', customPlugin, '0.5.0');
    const info = getPluginInfo('ZW');
    expect(info).not.toBeNull();
    expect(info!.tier).toBe('community');
    expect(info!.version).toBe('0.5.0');
  });

  it('should reject overwriting official plugins', () => {
    const fakePlugin = createAdaptiveGenericPlugin('AU');
    expect(() => registerCommunityPlugin('AU', fakePlugin)).toThrow('Cannot overwrite official plugin');
  });

  // ─── Sidebar labels ───────────────────────────────────────────────────────

  it('should return correct sidebar labels for official countries', () => {
    expect(getCountryTaxFilingLabel('AU')).toBe('Activity Statement (BAS)');
    expect(getCountryTaxFilingLabel('GB')).toBe('VAT Return (MTD)');
    expect(getCountryTaxFilingLabel('NZ')).toBe('GST Return');
    expect(getCountryTaxFilingLabel('IN')).toBe('GST Filing (GSTR-3B)');
    expect(getCountryTaxFilingLabel('US')).toBe('Tax Filing (941)');
  });

  it('should return generic label for unsupported country', () => {
    expect(getCountryTaxFilingLabel('ZZ')).toBe('Tax Activity Statement');
  });

  it('should handle undefined/empty country code for label', () => {
    expect(getCountryTaxFilingLabel(undefined)).toBe('Tax Activity Statement');
    expect(getCountryTaxFilingLabel('')).toBe('Tax Activity Statement');
  });

  // ─── List all registered ──────────────────────────────────────────────────

  it('should list all registered countries including generics', () => {
    const all = listRegisteredCountries();
    expect(all.length).toBeGreaterThanOrEqual(13);
    // Should include any generics we triggered above (BR, ZW)
    expect(all).toContain('BR');
  });
});
