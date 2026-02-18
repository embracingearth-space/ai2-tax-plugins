/**
 * Financial Year Reference Data — @ai2/tax-plugins
 * embracingearth.space
 *
 * Single source of truth for financial year start/end dates by country.
 * Eliminates frontend/backend duplication — both import from here.
 * Contributors: add/correct your country's FY dates here.
 *
 * Month values are 0-based (0=Jan, 11=Dec) to match JavaScript Date constructor.
 */

export interface FinancialYearConfig {
  yearEnd: { month: number; day: number };
  yearStart: { month: number; day: number };
  description: string;
}

export const FINANCIAL_YEAR_CONFIGS: Record<string, FinancialYearConfig> = {
  // ─── July 1 – June 30 ───────────────────────────────────────────────────
  'AU': { yearEnd: { month: 5, day: 30 }, yearStart: { month: 6, day: 1 }, description: 'Australian Financial Year (July 1 - June 30)' },
  'NZ': { yearEnd: { month: 5, day: 30 }, yearStart: { month: 6, day: 1 }, description: 'New Zealand Financial Year (July 1 - June 30)' },
  'BD': { yearEnd: { month: 5, day: 30 }, yearStart: { month: 6, day: 1 }, description: 'Bangladesh Financial Year (July 1 - June 30)' },
  'MM': { yearEnd: { month: 5, day: 30 }, yearStart: { month: 6, day: 1 }, description: 'Myanmar Financial Year (July 1 - June 30)' },
  'PK': { yearEnd: { month: 5, day: 30 }, yearStart: { month: 6, day: 1 }, description: 'Pakistan Financial Year (July 1 - June 30)' },
  'NP': { yearEnd: { month: 5, day: 30 }, yearStart: { month: 6, day: 1 }, description: 'Nepal Financial Year (July 1 - June 30)' },
  'EG': { yearEnd: { month: 5, day: 30 }, yearStart: { month: 6, day: 1 }, description: 'Egypt Financial Year (July 1 - June 30)' },
  'KE': { yearEnd: { month: 5, day: 30 }, yearStart: { month: 6, day: 1 }, description: 'Kenya Financial Year (July 1 - June 30)' },

  // ─── April 1 – March 31 ─────────────────────────────────────────────────
  'IN': { yearEnd: { month: 2, day: 31 }, yearStart: { month: 3, day: 1 }, description: 'India Financial Year (April 1 - March 31)' },
  'JP': { yearEnd: { month: 2, day: 31 }, yearStart: { month: 3, day: 1 }, description: 'Japan Financial Year (April 1 - March 31)' },
  'HK': { yearEnd: { month: 2, day: 31 }, yearStart: { month: 3, day: 1 }, description: 'Hong Kong Financial Year (April 1 - March 31)' },
  'CA': { yearEnd: { month: 2, day: 31 }, yearStart: { month: 3, day: 1 }, description: 'Canada Financial Year (April 1 - March 31)' },
  'SG': { yearEnd: { month: 2, day: 31 }, yearStart: { month: 3, day: 1 }, description: 'Singapore Financial Year (April 1 - March 31)' },
  'BT': { yearEnd: { month: 2, day: 31 }, yearStart: { month: 3, day: 1 }, description: 'Bhutan Financial Year (April 1 - March 31)' },

  // ─── April 6 – April 5 (UK) ─────────────────────────────────────────────
  'UK': { yearEnd: { month: 3, day: 5 }, yearStart: { month: 3, day: 6 }, description: 'UK Financial Year (April 6 - April 5)' },
  'GB': { yearEnd: { month: 3, day: 5 }, yearStart: { month: 3, day: 6 }, description: 'UK Financial Year (April 6 - April 5)' },

  // ─── March 1 – February 28/29 (South Africa) ───────────────────────────
  'ZA': { yearEnd: { month: 1, day: 28 }, yearStart: { month: 2, day: 1 }, description: 'South Africa Financial Year (March 1 - February 28/29)' },

  // ─── October 1 – September 30 (Thailand) ───────────────────────────────
  'TH': { yearEnd: { month: 8, day: 30 }, yearStart: { month: 9, day: 1 }, description: 'Thailand Financial Year (October 1 - September 30)' },

  // ─── January 1 – December 31 (calendar year) ───────────────────────────
  'US': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'US Financial Year (January 1 - December 31)' },
  'VN': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Vietnam Financial Year (January 1 - December 31)' },
  'CN': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'China Financial Year (January 1 - December 31)' },
  'KR': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'South Korea Financial Year (January 1 - December 31)' },
  'TW': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Taiwan Financial Year (January 1 - December 31)' },
  'MY': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Malaysia Financial Year (January 1 - December 31)' },
  'ID': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Indonesia Financial Year (January 1 - December 31)' },
  'PH': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Philippines Financial Year (January 1 - December 31)' },
  'AE': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'UAE Financial Year (January 1 - December 31)' },
  'SA': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Saudi Arabia Financial Year (January 1 - December 31)' },
  'QA': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Qatar Financial Year (January 1 - December 31)' },
  'KW': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Kuwait Financial Year (January 1 - December 31)' },
  'BH': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Bahrain Financial Year (January 1 - December 31)' },
  'OM': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Oman Financial Year (January 1 - December 31)' },
  'JO': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Jordan Financial Year (January 1 - December 31)' },
  'LB': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Lebanon Financial Year (January 1 - December 31)' },
  'IL': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Israel Financial Year (January 1 - December 31)' },
  'MA': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Morocco Financial Year (January 1 - December 31)' },
  'TN': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Tunisia Financial Year (January 1 - December 31)' },
  'DZ': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Algeria Financial Year (January 1 - December 31)' },
  'MG': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Madagascar Financial Year (January 1 - December 31)' },
  'CH': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Switzerland Financial Year (January 1 - December 31)' },
  'NO': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Norway Financial Year (January 1 - December 31)' },
  'DK': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Denmark Financial Year (January 1 - December 31)' },
  'SE': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Sweden Financial Year (January 1 - December 31)' },
  'PL': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Poland Financial Year (January 1 - December 31)' },
  'CZ': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Czech Republic Financial Year (January 1 - December 31)' },
  'HU': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Hungary Financial Year (January 1 - December 31)' },
  'RO': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Romania Financial Year (January 1 - December 31)' },
  'BG': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Bulgaria Financial Year (January 1 - December 31)' },
  'HR': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Croatia Financial Year (January 1 - December 31)' },
  'RS': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Serbia Financial Year (January 1 - December 31)' },
  'UA': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Ukraine Financial Year (January 1 - December 31)' },
  'RU': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Russia Financial Year (January 1 - December 31)' },
  'FR': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'France Financial Year (January 1 - December 31)' },
  'AT': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Austria Financial Year (January 1 - December 31)' },
  'EE': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Estonia Financial Year (January 1 - December 31)' },
  'LU': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Luxembourg Financial Year (January 1 - December 31)' },
  'IS': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Iceland Financial Year (January 1 - December 31)' },
  'FI': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Finland Financial Year (January 1 - December 31)' },
  'PT': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Portugal Financial Year (January 1 - December 31)' },
  'GR': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Greece Financial Year (January 1 - December 31)' },
  'SI': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Slovenia Financial Year (January 1 - December 31)' },
  'SK': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Slovakia Financial Year (January 1 - December 31)' },
  'LT': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Lithuania Financial Year (January 1 - December 31)' },
  'LV': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Latvia Financial Year (January 1 - December 31)' },
  'IE': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Ireland Financial Year (January 1 - December 31)' },
  'CY': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Cyprus Financial Year (January 1 - December 31)' },
  'MT': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Malta Financial Year (January 1 - December 31)' },
  'DE': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Germany Financial Year (January 1 - December 31)' },
  'ES': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Spain Financial Year (January 1 - December 31)' },
  'NL': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Netherlands Financial Year (January 1 - December 31)' },
  'IT': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Italy Financial Year (January 1 - December 31)' },
  'BE': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Belgium Financial Year (January 1 - December 31)' },
  'BR': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Brazil Financial Year (January 1 - December 31)' },
  'AR': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Argentina Financial Year (January 1 - December 31)' },
  'CL': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Chile Financial Year (January 1 - December 31)' },
  'CO': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Colombia Financial Year (January 1 - December 31)' },
  'PE': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Peru Financial Year (January 1 - December 31)' },
  'UY': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Uruguay Financial Year (January 1 - December 31)' },
  'VE': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Venezuela Financial Year (January 1 - December 31)' },
  'TR': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Turkey Financial Year (January 1 - December 31)' },
  'NG': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Nigeria Financial Year (January 1 - December 31)' },
  'GH': { yearEnd: { month: 11, day: 31 }, yearStart: { month: 0, day: 1 }, description: 'Ghana Financial Year (January 1 - December 31)' },
};

/**
 * Default config for countries not in the list — calendar year.
 */
export const DEFAULT_FINANCIAL_YEAR_CONFIG: FinancialYearConfig = {
  yearEnd: { month: 11, day: 31 },
  yearStart: { month: 0, day: 1 },
  description: 'Calendar Year (January 1 - December 31)',
};
