/**
 * Tax Filing Plugin Registry — @ai2/tax-plugins
 * ai2fin.com
 *
 * Provides synchronous + async access to country tax plugins.
 * Official (blessed) plugins are bundled. Community plugins can be registered at runtime.
 *
 * ARCHITECTURE NOTE: This registry is the single entry point for consumers.
 * Core app imports from here — never directly from country files.
 * If you add a country plugin, register it in OFFICIAL_PLUGINS below + re-export from index.ts.
 *
 * COMPOUND KEYS: Countries with both indirect tax AND income tax use compound keys:
 *   'AU' = BAS (GST), 'AU-IT' = Individual Tax Return
 *   'GB' = VAT Return, 'GB-SA' = Self-Assessment (MTD)
 *   'IN' = GSTR-3B (GST), 'IN-IT' = Income Tax (ITR)
 *   'US' = Form 941 (Payroll), 'US-IT' = Schedule C (Income Tax)
 *   'CA' = GST34, 'CA-IT' = T1 General
 * UI groups by 2-letter country prefix for display.
 */

import type { TaxFilingPlugin } from './types';
import { createAdaptiveGenericPlugin } from './adaptiveGeneric';

// ─── Official (blessed) plugin imports ────────────────────────────────────────
// Indirect tax / activity statement plugins
import australiaPlugin from './countries/australia';
import unitedKingdomPlugin from './countries/unitedKingdom';
import newZealandPlugin from './countries/newZealand';
import canadaPlugin from './countries/canada';
import singaporePlugin from './countries/singapore';
import indiaPlugin from './countries/india';
import usaPlugin from './countries/usa';
import madagascarPlugin from './countries/madagascar';
import japanPlugin from './countries/japan';
import southKoreaPlugin from './countries/southKorea';
import chinaPlugin from './countries/china';
import southAfricaPlugin from './countries/southAfrica';
import uaePlugin from './countries/uae';
import saudiArabiaPlugin from './countries/saudiArabia';
import malaysiaPlugin from './countries/malaysia';
import thailandPlugin from './countries/thailand';
import philippinesPlugin from './countries/philippines';
import indonesiaPlugin from './countries/indonesia';
import brazilPlugin from './countries/brazil';
import mexicoPlugin from './countries/mexico';

// Income tax plugins (compound keys)
import ukSelfAssessmentPlugin from './countries/ukSelfAssessment';
import indiaIncomeTaxPlugin from './countries/indiaIncomeTax';
import usIncomeTaxPlugin from './countries/usIncomeTax';
import australiaIncomeTaxPlugin from './countries/australiaIncomeTax';
import canadaIncomeTaxPlugin from './countries/canadaIncomeTax';

// EU/EEA/EFTA template factory
import { createEUPlugin } from './countries/euTemplate';

// ─── Plugin tiers ────────────────────────────────────────────────────────────

export type PluginTier = 'official' | 'community';

export interface RegisteredPlugin {
  plugin: TaxFilingPlugin;
  tier: PluginTier;
  version: string;
}

// ─── In-memory registry ──────────────────────────────────────────────────────

const pluginRegistry = new Map<string, RegisteredPlugin>();

/**
 * Official plugins — pre-registered on first access.
 * Maintained by the core team and covered by integration tests.
 * ai2fin.com — 40+ country coverage
 */
const OFFICIAL_PLUGINS: Record<string, TaxFilingPlugin> = {
  // ── Tier 1: Major economies — full custom plugins ──
  AU: australiaPlugin,
  GB: unitedKingdomPlugin,
  US: usaPlugin,
  CA: canadaPlugin,
  IN: indiaPlugin,
  JP: japanPlugin,
  CN: chinaPlugin,
  BR: brazilPlugin,

  // ── Tier 2: Mid-tier — full custom plugins ──
  NZ: newZealandPlugin,
  SG: singaporePlugin,
  ZA: southAfricaPlugin,
  AE: uaePlugin,
  SA: saudiArabiaPlugin,
  KR: southKoreaPlugin,
  MY: malaysiaPlugin,
  TH: thailandPlugin,
  PH: philippinesPlugin,
  ID: indonesiaPlugin,
  MX: mexicoPlugin,
  MG: madagascarPlugin,

  // ── Income tax plugins (compound keys) ──
  'GB-SA': ukSelfAssessmentPlugin,
  'IN-IT': indiaIncomeTaxPlugin,
  'US-IT': usIncomeTaxPlugin,
  'AU-IT': australiaIncomeTaxPlugin,
  'CA-IT': canadaIncomeTaxPlugin,

  // ── EU/EEA/EFTA — template-based plugins ──
  DE: createEUPlugin('DE'),
  FR: createEUPlugin('FR'),
  IT: createEUPlugin('IT'),
  ES: createEUPlugin('ES'),
  NL: createEUPlugin('NL'),
  IE: createEUPlugin('IE'),
  AT: createEUPlugin('AT'),
  BE: createEUPlugin('BE'),
  PT: createEUPlugin('PT'),
  PL: createEUPlugin('PL'),
  SE: createEUPlugin('SE'),
  FI: createEUPlugin('FI'),
  DK: createEUPlugin('DK'),
  NO: createEUPlugin('NO'),
  CH: createEUPlugin('CH'),
  GR: createEUPlugin('GR'),
  CZ: createEUPlugin('CZ'),
  HU: createEUPlugin('HU'),
  RO: createEUPlugin('RO'),
  HR: createEUPlugin('HR'),
  BG: createEUPlugin('BG'),
  SK: createEUPlugin('SK'),
  LT: createEUPlugin('LT'),
  LV: createEUPlugin('LV'),
  EE: createEUPlugin('EE'),
  SI: createEUPlugin('SI'),
  LU: createEUPlugin('LU'),
  MT: createEUPlugin('MT'),
  CY: createEUPlugin('CY'),
};

let officialRegistered = false;

function ensureOfficialRegistered(): void {
  if (officialRegistered) return;
  for (const [code, plugin] of Object.entries(OFFICIAL_PLUGINS)) {
    pluginRegistry.set(code, {
      plugin,
      tier: 'official',
      version: '1.0.0',
    });
  }
  officialRegistered = true;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get the tax filing plugin for a country code.
 * Returns official plugin if available, then community, then adaptive generic.
 */
export function getPluginForCountry(countryCode: string): TaxFilingPlugin {
  ensureOfficialRegistered();
  const code = (countryCode || 'AU').toUpperCase();
  const registered = pluginRegistry.get(code);
  if (registered) return registered.plugin;

  // Adaptive generic for unsupported countries — ai2fin.com fallback
  const generic = createAdaptiveGenericPlugin(code);
  pluginRegistry.set(code, { plugin: generic, tier: 'community', version: '0.0.0' });
  return generic;
}

/**
 * Async variant for frontend lazy-loading compatibility.
 * Same result as synchronous version but matches the original async signature
 * so core app migration is a one-line import change.
 */
export async function getPluginForCountryAsync(countryCode: string): Promise<TaxFilingPlugin> {
  return getPluginForCountry(countryCode);
}

/**
 * Register a community plugin at runtime.
 * Core app should validate plugin output before trusting it (see validatePluginOutput).
 */
export function registerCommunityPlugin(
  countryCode: string,
  plugin: TaxFilingPlugin,
  version: string = '0.1.0',
): void {
  const code = countryCode.toUpperCase();
  const existing = pluginRegistry.get(code);
  if (existing && existing.tier === 'official') {
    throw new Error(
      `Cannot overwrite official plugin for ${code}. Use a different country code or fork the official plugin.`,
    );
  }
  pluginRegistry.set(code, { plugin, tier: 'community', version });
}

/**
 * Get metadata about a registered plugin.
 */
export function getPluginInfo(countryCode: string): RegisteredPlugin | null {
  ensureOfficialRegistered();
  return pluginRegistry.get(countryCode.toUpperCase()) ?? null;
}

/**
 * List all registered country codes.
 */
export function listRegisteredCountries(): string[] {
  ensureOfficialRegistered();
  return Array.from(pluginRegistry.keys());
}

/**
 * List only official (blessed) country codes.
 */
export function listOfficialCountries(): string[] {
  ensureOfficialRegistered();
  return Array.from(pluginRegistry.entries())
    .filter(([, info]) => info.tier === 'official')
    .map(([code]) => code);
}

/**
 * Get all plugins for a given base country (e.g., 'AU' returns AU + AU-IT).
 * Used by frontend to show all available forms for a user's country.
 */
export function getPluginsForBaseCountry(baseCode: string): Array<{ key: string; plugin: TaxFilingPlugin }> {
  ensureOfficialRegistered();
  const code = baseCode.toUpperCase();
  const results: Array<{ key: string; plugin: TaxFilingPlugin }> = [];
  for (const [key, reg] of pluginRegistry.entries()) {
    if (key === code || key.startsWith(`${code}-`)) {
      results.push({ key, plugin: reg.plugin });
    }
  }
  return results;
}

/**
 * Get country-adaptive sidebar label for Tax Filing.
 * ai2fin.com — UX: Show familiar local terminology
 */
export function getCountryTaxFilingLabel(countryCode?: string): string {
  const code = (countryCode || '').toUpperCase();
  const labels: Record<string, string> = {
    // Indirect tax / activity statements
    AU: 'Activity Statement (BAS)',
    GB: 'VAT Return (MTD)',
    NZ: 'GST Return',
    CA: 'GST/HST Return',
    SG: 'GST Return (F5)',
    IN: 'GST Filing (GSTR-3B)',
    US: 'Tax Filing (941)',
    MG: 'Déclaration TVA',
    JP: 'Consumption Tax (消費税)',
    KR: 'VAT Return (부가세)',
    CN: 'VAT Return (增值税)',
    ZA: 'VAT201 Return',
    AE: 'VAT Return (Form 201)',
    SA: 'VAT Return (ZATCA)',
    MY: 'SST Return (SST-02)',
    TH: 'VAT Return (PP30)',
    PH: 'VAT Return (BIR 2550)',
    ID: 'SPT PPN',
    BR: 'PIS/COFINS',
    MX: 'IVA Declaration',
    // EU countries — local terminology
    DE: 'USt-Voranmeldung',
    FR: 'Déclaration CA3',
    IT: 'Liquidazione IVA',
    ES: 'Modelo 303',
    NL: 'BTW Aangifte (OB69)',
    IE: 'VAT3 Return',
    AT: 'USt-Voranmeldung (U1)',
    BE: 'TVA/BTW Return',
    PT: 'IVA Periódica',
    PL: 'JPK_V7M',
    SE: 'Momsdeklaration',
    FI: 'ALV-ilmoitus',
    DK: 'Momsangivelse',
    NO: 'MVA-melding',
    CH: 'MWST-Abrechnung',
    // Income tax (compound keys)
    'GB-SA': 'Self-Assessment (MTD)',
    'IN-IT': 'Income Tax (ITR)',
    'US-IT': 'Schedule C / 1040',
    'AU-IT': 'Individual Tax Return',
    'CA-IT': 'T1 Income Tax',
  };
  return labels[code] || 'Tax Activity Statement';
}
