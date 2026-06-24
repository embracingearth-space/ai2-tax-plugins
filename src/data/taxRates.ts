/**
 * Tax Rate Reference Data — @ai2/tax-plugins
 * embracingearth.space
 *
 * COUNTRY_TAX_RATES is a FLAT, as-of-today view DERIVED from the effective-dated
 * RATE_LEDGER — the single source of truth (see ./rateLedger). DO NOT hand-edit
 * rates here: change a rate in the ledger and this view follows automatically.
 * The back-compat API (getTaxRateInfo / getStandardTaxRate / detectTaxFamily) and
 * the CountryTaxRateInfo / TaxFamily types are unchanged for existing consumers.
 */
import { activeNationalRows, getStandardRateAsOf } from './rateLedger';
import type { TaxFamily } from './rateLedger';

export type { TaxFamily } from './rateLedger';

export interface CountryTaxRateInfo {
  countryCode: string;
  countryName: string;
  taxFamily: TaxFamily;
  standardRate: number;
  reducedRate?: number;
  localName?: string;
}

/** Build the flat current-rate table from the ledger's active national rows. */
function buildCountryTaxRates(): Record<string, CountryTaxRateInfo> {
  const out: Record<string, CountryTaxRateInfo> = {};
  for (const r of activeNationalRows()) {
    const info: CountryTaxRateInfo = {
      countryCode: r.countryCode,
      countryName: r.countryName,
      taxFamily: r.taxFamily,
      standardRate: r.standardRate,
      localName: r.localName,
    };
    if (r.reducedRate != null) info.reducedRate = r.reducedRate;
    out[r.countryCode] = info;
  }
  return out;
}

/**
 * Standard and reduced VAT/GST/sales-tax rates by country, as in force today.
 * Derived from RATE_LEDGER — to change a rate, edit the ledger, not this object.
 */
export const COUNTRY_TAX_RATES: Record<string, CountryTaxRateInfo> = buildCountryTaxRates();

/**
 * Get tax rate info for a country (as in force today). Returns undefined if unknown.
 */
export function getTaxRateInfo(countryCode: string): CountryTaxRateInfo | undefined {
  return COUNTRY_TAX_RATES[countryCode.toUpperCase()];
}

/**
 * Get the standard tax rate for a country. Returns 0 if unknown.
 * Pass `asOf` (YYYY-MM-DD or Date) to resolve the rate in force on a past/future
 * date — e.g. the rate that applied during a transaction's tax period.
 */
export function getStandardTaxRate(countryCode: string, asOf?: string | Date): number {
  if (asOf !== undefined) return getStandardRateAsOf(countryCode, asOf);
  return COUNTRY_TAX_RATES[countryCode.toUpperCase()]?.standardRate ?? 0;
}

/**
 * Detect tax family for a country code.
 */
export function detectTaxFamily(countryCode: string): TaxFamily {
  return COUNTRY_TAX_RATES[countryCode.toUpperCase()]?.taxFamily ?? 'SALES_TAX';
}
