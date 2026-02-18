/**
 * Currency Reference Data — @ai2/tax-plugins
 * embracingearth.space
 *
 * Single source of truth for currency codes, symbols, locales, and country→currency mapping.
 * Contributors: add your country's currency here + update COUNTRY_CURRENCY_MAP.
 * Core app imports this data and wraps it with formatting functions (Intl.NumberFormat).
 */

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  locale: string;
  decimalPlaces: number;
}

export const CURRENCY_INFO: Record<string, CurrencyInfo> = {
  // Australia & New Zealand
  'AUD': { code: 'AUD', symbol: '$', name: 'Australian Dollar', locale: 'en-AU', decimalPlaces: 2 },
  'NZD': { code: 'NZD', symbol: '$', name: 'New Zealand Dollar', locale: 'en-NZ', decimalPlaces: 2 },

  // United States
  'USD': { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US', decimalPlaces: 2 },

  // United Kingdom
  'GBP': { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB', decimalPlaces: 2 },

  // European Union
  'EUR': { code: 'EUR', symbol: '€', name: 'Euro', locale: 'en-EU', decimalPlaces: 2 },

  // Canada
  'CAD': { code: 'CAD', symbol: '$', name: 'Canadian Dollar', locale: 'en-CA', decimalPlaces: 2 },

  // India & South Asia
  'INR': { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN', decimalPlaces: 2 },
  'PKR': { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', locale: 'en-PK', decimalPlaces: 2 },
  'BDT': { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', locale: 'en-BD', decimalPlaces: 2 },
  'NPR': { code: 'NPR', symbol: '₨', name: 'Nepalese Rupee', locale: 'en-NP', decimalPlaces: 2 },
  'BTN': { code: 'BTN', symbol: 'Nu.', name: 'Bhutanese Ngultrum', locale: 'en-BT', decimalPlaces: 2 },

  // Southeast Asia
  'SGD': { code: 'SGD', symbol: '$', name: 'Singapore Dollar', locale: 'en-SG', decimalPlaces: 2 },
  'THB': { code: 'THB', symbol: '฿', name: 'Thai Baht', locale: 'th-TH', decimalPlaces: 2 },
  'MMK': { code: 'MMK', symbol: 'K', name: 'Myanmar Kyat', locale: 'my-MM', decimalPlaces: 2 },

  // Japan
  'JPY': { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP', decimalPlaces: 0 },

  // South Africa
  'ZAR': { code: 'ZAR', symbol: 'R', name: 'South African Rand', locale: 'en-ZA', decimalPlaces: 2 },

  // Taiwan
  'TWD': { code: 'TWD', symbol: 'NT$', name: 'Taiwan Dollar', locale: 'zh-TW', decimalPlaces: 2 },

  // Hong Kong
  'HKD': { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', locale: 'en-HK', decimalPlaces: 2 },

  // Malaysia
  'MYR': { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', locale: 'ms-MY', decimalPlaces: 2 },

  // Indonesia
  'IDR': { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', locale: 'id-ID', decimalPlaces: 0 },

  // Philippines
  'PHP': { code: 'PHP', symbol: '₱', name: 'Philippine Peso', locale: 'en-PH', decimalPlaces: 2 },

  // Vietnam
  'VND': { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', locale: 'vi-VN', decimalPlaces: 0 },

  // South Korea
  'KRW': { code: 'KRW', symbol: '₩', name: 'South Korean Won', locale: 'ko-KR', decimalPlaces: 0 },

  // China
  'CNY': { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN', decimalPlaces: 2 },

  // Middle East & Arab Countries
  'AED': { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', locale: 'ar-AE', decimalPlaces: 2 },
  'SAR': { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal', locale: 'ar-SA', decimalPlaces: 2 },
  'QAR': { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal', locale: 'ar-QA', decimalPlaces: 2 },
  'KWD': { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar', locale: 'ar-KW', decimalPlaces: 3 },
  'BHD': { code: 'BHD', symbol: 'د.ب', name: 'Bahraini Dinar', locale: 'ar-BH', decimalPlaces: 3 },
  'OMR': { code: 'OMR', symbol: 'ر.ع.', name: 'Omani Rial', locale: 'ar-OM', decimalPlaces: 3 },
  'JOD': { code: 'JOD', symbol: 'د.ا', name: 'Jordanian Dinar', locale: 'ar-JO', decimalPlaces: 3 },
  'LBP': { code: 'LBP', symbol: 'ل.ل', name: 'Lebanese Pound', locale: 'ar-LB', decimalPlaces: 2 },
  'EGP': { code: 'EGP', symbol: 'ج.م', name: 'Egyptian Pound', locale: 'ar-EG', decimalPlaces: 2 },
  'ILS': { code: 'ILS', symbol: '₪', name: 'Israeli Shekel', locale: 'he-IL', decimalPlaces: 2 },

  // European Countries
  'CHF': { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', locale: 'de-CH', decimalPlaces: 2 },
  'NOK': { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', locale: 'nb-NO', decimalPlaces: 2 },
  'DKK': { code: 'DKK', symbol: 'kr', name: 'Danish Krone', locale: 'da-DK', decimalPlaces: 2 },
  'SEK': { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', locale: 'sv-SE', decimalPlaces: 2 },
  'PLN': { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', locale: 'pl-PL', decimalPlaces: 2 },
  'CZK': { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', locale: 'cs-CZ', decimalPlaces: 2 },
  'HUF': { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', locale: 'hu-HU', decimalPlaces: 2 },
  'RON': { code: 'RON', symbol: 'lei', name: 'Romanian Leu', locale: 'ro-RO', decimalPlaces: 2 },
  'BGN': { code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev', locale: 'bg-BG', decimalPlaces: 2 },
  'HRK': { code: 'HRK', symbol: 'kn', name: 'Croatian Kuna', locale: 'hr-HR', decimalPlaces: 2 },
  'RSD': { code: 'RSD', symbol: 'дин', name: 'Serbian Dinar', locale: 'sr-RS', decimalPlaces: 2 },
  'UAH': { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia', locale: 'uk-UA', decimalPlaces: 2 },
  'RUB': { code: 'RUB', symbol: '₽', name: 'Russian Ruble', locale: 'ru-RU', decimalPlaces: 2 },

  // South American Countries
  'BRL': { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR', decimalPlaces: 2 },
  'ARS': { code: 'ARS', symbol: '$', name: 'Argentine Peso', locale: 'es-AR', decimalPlaces: 2 },
  'CLP': { code: 'CLP', symbol: '$', name: 'Chilean Peso', locale: 'es-CL', decimalPlaces: 0 },
  'COP': { code: 'COP', symbol: '$', name: 'Colombian Peso', locale: 'es-CO', decimalPlaces: 2 },
  'PEN': { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol', locale: 'es-PE', decimalPlaces: 2 },
  'UYU': { code: 'UYU', symbol: '$U', name: 'Uruguayan Peso', locale: 'es-UY', decimalPlaces: 2 },
  'VES': { code: 'VES', symbol: 'Bs.S', name: 'Venezuelan Bolivar', locale: 'es-VE', decimalPlaces: 2 },

  // Iceland
  'ISK': { code: 'ISK', symbol: 'kr', name: 'Icelandic Krona', locale: 'is-IS', decimalPlaces: 0 },

  // Africa & Other
  'TRY': { code: 'TRY', symbol: '₺', name: 'Turkish Lira', locale: 'tr-TR', decimalPlaces: 2 },
  'NGN': { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', locale: 'en-NG', decimalPlaces: 2 },
  'KES': { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', locale: 'en-KE', decimalPlaces: 2 },
  'GHS': { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi', locale: 'en-GH', decimalPlaces: 2 },
  'MAD': { code: 'MAD', symbol: 'د.م.', name: 'Moroccan Dirham', locale: 'ar-MA', decimalPlaces: 2 },
  'TND': { code: 'TND', symbol: 'د.ت', name: 'Tunisian Dinar', locale: 'ar-TN', decimalPlaces: 3 },
  'DZD': { code: 'DZD', symbol: 'د.ج', name: 'Algerian Dinar', locale: 'ar-DZ', decimalPlaces: 2 },
  'MGA': { code: 'MGA', symbol: 'Ar', name: 'Malagasy Ariary', locale: 'fr-MG', decimalPlaces: 0 },
};

/**
 * Country code → currency code mapping.
 * Contributors: add your country here if missing.
 */
export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  'AU': 'AUD',
  'NZ': 'NZD',
  'US': 'USD',
  'GB': 'GBP',
  'UK': 'GBP',
  'CA': 'CAD',
  'IN': 'INR',
  'PK': 'PKR',
  'BD': 'BDT',
  'NP': 'NPR',
  'BT': 'BTN',
  'SG': 'SGD',
  'TH': 'THB',
  'MM': 'MMK',
  'JP': 'JPY',
  'ZA': 'ZAR',
  'VN': 'VND',
  'KR': 'KRW',
  'CN': 'CNY',
  'TW': 'TWD',
  'HK': 'HKD',
  'MY': 'MYR',
  'ID': 'IDR',
  'PH': 'PHP',

  // Middle East & Arab Countries
  'AE': 'AED',
  'SA': 'SAR',
  'QA': 'QAR',
  'KW': 'KWD',
  'BH': 'BHD',
  'OM': 'OMR',
  'JO': 'JOD',
  'LB': 'LBP',
  'EG': 'EGP',
  'IL': 'ILS',
  'MA': 'MAD',
  'TN': 'TND',
  'DZ': 'DZD',

  // European Countries
  'CH': 'CHF',
  'NO': 'NOK',
  'DK': 'DKK',
  'SE': 'SEK',
  'PL': 'PLN',
  'CZ': 'CZK',
  'HU': 'HUF',
  'RO': 'RON',
  'BG': 'BGN',
  'HR': 'HRK',
  'RS': 'RSD',
  'UA': 'UAH',
  'RU': 'RUB',
  'FR': 'EUR',
  'AT': 'EUR',
  'EE': 'EUR',
  'LU': 'EUR',
  'IS': 'ISK',
  'FI': 'EUR',
  'PT': 'EUR',
  'GR': 'EUR',
  'SI': 'EUR',
  'SK': 'EUR',
  'LT': 'EUR',
  'LV': 'EUR',
  'DE': 'EUR',
  'ES': 'EUR',
  'NL': 'EUR',
  'IT': 'EUR',
  'BE': 'EUR',

  // South American Countries
  'BR': 'BRL',
  'AR': 'ARS',
  'CL': 'CLP',
  'CO': 'COP',
  'PE': 'PEN',
  'UY': 'UYU',
  'VE': 'VES',

  // Africa & Other
  'TR': 'TRY',
  'NG': 'NGN',
  'KE': 'KES',
  'GH': 'GHS',
  'MG': 'MGA',

  'IE': 'EUR',
  'CY': 'EUR',
  'MT': 'EUR',
};
