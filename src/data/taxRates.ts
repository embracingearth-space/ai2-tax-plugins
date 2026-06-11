/**
 * Tax Rate Reference Data — @ai2/tax-plugins
 * embracingearth.space
 *
 * Standard and reduced VAT/GST/sales tax rates by country.
 * Contributors: update your country's rate here when it changes.
 * These are reference rates — actual filing uses the plugin's built-in rates.
 */

export type TaxFamily = 'GST' | 'VAT' | 'SALES_TAX' | 'HYBRID' | 'NONE';

export interface CountryTaxRateInfo {
  countryCode: string;
  countryName: string;
  taxFamily: TaxFamily;
  standardRate: number;
  reducedRate?: number;
  localName?: string;
}

export const COUNTRY_TAX_RATES: Record<string, CountryTaxRateInfo> = {
  // ─── GST Countries ─────────────────────────────────────────────────────
  'AU': { countryCode: 'AU', countryName: 'Australia', taxFamily: 'GST', standardRate: 0.10, localName: 'GST' },
  'NZ': { countryCode: 'NZ', countryName: 'New Zealand', taxFamily: 'GST', standardRate: 0.15, localName: 'GST' },
  'SG': { countryCode: 'SG', countryName: 'Singapore', taxFamily: 'GST', standardRate: 0.09, localName: 'GST' },
  'IN': { countryCode: 'IN', countryName: 'India', taxFamily: 'GST', standardRate: 0.18, reducedRate: 0.05, localName: 'GST' },
  'CA': { countryCode: 'CA', countryName: 'Canada', taxFamily: 'GST', standardRate: 0.05, localName: 'GST/HST' },
  'MY': { countryCode: 'MY', countryName: 'Malaysia', taxFamily: 'GST', standardRate: 0.08, localName: 'SST' },
  'MG': { countryCode: 'MG', countryName: 'Madagascar', taxFamily: 'VAT', standardRate: 0.20, localName: 'TVA' },

  // ─── VAT Countries — Europe ─────────────────────────────────────────────
  'GB': { countryCode: 'GB', countryName: 'United Kingdom', taxFamily: 'VAT', standardRate: 0.20, reducedRate: 0.05, localName: 'VAT' },
  'DE': { countryCode: 'DE', countryName: 'Germany', taxFamily: 'VAT', standardRate: 0.19, reducedRate: 0.07, localName: 'Umsatzsteuer' },
  'FR': { countryCode: 'FR', countryName: 'France', taxFamily: 'VAT', standardRate: 0.20, reducedRate: 0.055, localName: 'TVA' },
  'IT': { countryCode: 'IT', countryName: 'Italy', taxFamily: 'VAT', standardRate: 0.22, reducedRate: 0.10, localName: 'IVA' },
  'ES': { countryCode: 'ES', countryName: 'Spain', taxFamily: 'VAT', standardRate: 0.21, reducedRate: 0.10, localName: 'IVA' },
  'NL': { countryCode: 'NL', countryName: 'Netherlands', taxFamily: 'VAT', standardRate: 0.21, reducedRate: 0.09, localName: 'BTW' },
  'IE': { countryCode: 'IE', countryName: 'Ireland', taxFamily: 'VAT', standardRate: 0.23, reducedRate: 0.135, localName: 'VAT' },
  'AT': { countryCode: 'AT', countryName: 'Austria', taxFamily: 'VAT', standardRate: 0.20, reducedRate: 0.10, localName: 'USt' },
  'BE': { countryCode: 'BE', countryName: 'Belgium', taxFamily: 'VAT', standardRate: 0.21, reducedRate: 0.06, localName: 'TVA/BTW' },
  'PT': { countryCode: 'PT', countryName: 'Portugal', taxFamily: 'VAT', standardRate: 0.23, reducedRate: 0.06, localName: 'IVA' },
  'PL': { countryCode: 'PL', countryName: 'Poland', taxFamily: 'VAT', standardRate: 0.23, reducedRate: 0.08, localName: 'VAT' },
  'CH': { countryCode: 'CH', countryName: 'Switzerland', taxFamily: 'VAT', standardRate: 0.081, reducedRate: 0.026, localName: 'MWST/TVA' },
  'NO': { countryCode: 'NO', countryName: 'Norway', taxFamily: 'VAT', standardRate: 0.25, reducedRate: 0.15, localName: 'MVA' },
  'DK': { countryCode: 'DK', countryName: 'Denmark', taxFamily: 'VAT', standardRate: 0.25, localName: 'Moms' },
  'SE': { countryCode: 'SE', countryName: 'Sweden', taxFamily: 'VAT', standardRate: 0.25, reducedRate: 0.12, localName: 'Moms' },
  'FI': { countryCode: 'FI', countryName: 'Finland', taxFamily: 'VAT', standardRate: 0.255, reducedRate: 0.14, localName: 'ALV' },
  'GR': { countryCode: 'GR', countryName: 'Greece', taxFamily: 'VAT', standardRate: 0.24, reducedRate: 0.13, localName: 'ΦΠΑ' },
  'CZ': { countryCode: 'CZ', countryName: 'Czech Republic', taxFamily: 'VAT', standardRate: 0.21, reducedRate: 0.12, localName: 'DPH' },
  'HU': { countryCode: 'HU', countryName: 'Hungary', taxFamily: 'VAT', standardRate: 0.27, reducedRate: 0.05, localName: 'ÁFA' },
  'RO': { countryCode: 'RO', countryName: 'Romania', taxFamily: 'VAT', standardRate: 0.21, reducedRate: 0.11, localName: 'TVA' },
  'BG': { countryCode: 'BG', countryName: 'Bulgaria', taxFamily: 'VAT', standardRate: 0.20, reducedRate: 0.09, localName: 'ДДС' },
  'HR': { countryCode: 'HR', countryName: 'Croatia', taxFamily: 'VAT', standardRate: 0.25, reducedRate: 0.13, localName: 'PDV' },
  'TR': { countryCode: 'TR', countryName: 'Turkey', taxFamily: 'VAT', standardRate: 0.20, reducedRate: 0.10, localName: 'KDV' },

  // ─── VAT Countries — Middle East ────────────────────────────────────────
  'AE': { countryCode: 'AE', countryName: 'UAE', taxFamily: 'VAT', standardRate: 0.05, localName: 'VAT' },
  'SA': { countryCode: 'SA', countryName: 'Saudi Arabia', taxFamily: 'VAT', standardRate: 0.15, localName: 'VAT' },
  'BH': { countryCode: 'BH', countryName: 'Bahrain', taxFamily: 'VAT', standardRate: 0.10, localName: 'VAT' },
  'OM': { countryCode: 'OM', countryName: 'Oman', taxFamily: 'VAT', standardRate: 0.05, localName: 'VAT' },

  // ─── VAT Countries — Africa ─────────────────────────────────────────────
  'ZA': { countryCode: 'ZA', countryName: 'South Africa', taxFamily: 'VAT', standardRate: 0.15, localName: 'VAT' },
  'NG': { countryCode: 'NG', countryName: 'Nigeria', taxFamily: 'VAT', standardRate: 0.075, localName: 'VAT' },
  'KE': { countryCode: 'KE', countryName: 'Kenya', taxFamily: 'VAT', standardRate: 0.16, localName: 'VAT' },
  'GH': { countryCode: 'GH', countryName: 'Ghana', taxFamily: 'VAT', standardRate: 0.20, localName: 'VAT' },
  'EG': { countryCode: 'EG', countryName: 'Egypt', taxFamily: 'VAT', standardRate: 0.14, localName: 'VAT' },

  // ─── Sales Tax / Hybrid ─────────────────────────────────────────────────
  'US': { countryCode: 'US', countryName: 'United States', taxFamily: 'SALES_TAX', standardRate: 0, localName: 'Sales Tax' },
  'JP': { countryCode: 'JP', countryName: 'Japan', taxFamily: 'VAT', standardRate: 0.10, reducedRate: 0.08, localName: '消費税' },
  'KR': { countryCode: 'KR', countryName: 'South Korea', taxFamily: 'VAT', standardRate: 0.10, localName: 'VAT' },
  'CN': { countryCode: 'CN', countryName: 'China', taxFamily: 'VAT', standardRate: 0.13, reducedRate: 0.09, localName: '增值税' },
  'TW': { countryCode: 'TW', countryName: 'Taiwan', taxFamily: 'VAT', standardRate: 0.05, localName: '營業稅' },
  'TH': { countryCode: 'TH', countryName: 'Thailand', taxFamily: 'VAT', standardRate: 0.07, localName: 'VAT' },
  'ID': { countryCode: 'ID', countryName: 'Indonesia', taxFamily: 'VAT', standardRate: 0.12, localName: 'PPN' },
  'PH': { countryCode: 'PH', countryName: 'Philippines', taxFamily: 'VAT', standardRate: 0.12, localName: 'VAT' },
  'VN': { countryCode: 'VN', countryName: 'Vietnam', taxFamily: 'VAT', standardRate: 0.10, reducedRate: 0.05, localName: 'GTGT' },
  'BR': { countryCode: 'BR', countryName: 'Brazil', taxFamily: 'HYBRID', standardRate: 0.17, localName: 'ICMS/IPI' },

  // ─── No VAT/GST ────────────────────────────────────────────────────────
  'HK': { countryCode: 'HK', countryName: 'Hong Kong', taxFamily: 'NONE', standardRate: 0, localName: 'None' },
};

/**
 * Get tax rate info for a country. Returns undefined if not in the list.
 */
export function getTaxRateInfo(countryCode: string): CountryTaxRateInfo | undefined {
  return COUNTRY_TAX_RATES[countryCode.toUpperCase()];
}

/**
 * Get the standard tax rate for a country. Returns 0 if unknown.
 */
export function getStandardTaxRate(countryCode: string): number {
  return COUNTRY_TAX_RATES[countryCode.toUpperCase()]?.standardRate ?? 0;
}

/**
 * Detect tax family for a country code.
 */
export function detectTaxFamily(countryCode: string): TaxFamily {
  return COUNTRY_TAX_RATES[countryCode.toUpperCase()]?.taxFamily ?? 'SALES_TAX';
}
