/**
 * Data Module Tests — @ai2/tax-plugins
 * ai2fin.com
 *
 * Validates that all exported reference data is internally consistent.
 */
import {
  CURRENCY_INFO,
  COUNTRY_CURRENCY_MAP,
  FINANCIAL_YEAR_CONFIGS,
  DEFAULT_FINANCIAL_YEAR_CONFIG,
  COUNTRY_TAX_RATES,
  getTaxRateInfo,
  getStandardTaxRate,
  detectTaxFamily,
} from '../src/data';

describe('Currency data', () => {
  it('has at least 50 currencies', () => {
    expect(Object.keys(CURRENCY_INFO).length).toBeGreaterThanOrEqual(50);
  });

  it('every COUNTRY_CURRENCY_MAP value resolves to a valid currency', () => {
    for (const [cc, code] of Object.entries(COUNTRY_CURRENCY_MAP)) {
      expect(CURRENCY_INFO).toHaveProperty(code);
    }
  });

  it('has known currencies for major countries', () => {
    expect(COUNTRY_CURRENCY_MAP['AU']).toBe('AUD');
    expect(COUNTRY_CURRENCY_MAP['US']).toBe('USD');
    expect(COUNTRY_CURRENCY_MAP['GB']).toBe('GBP');
    expect(COUNTRY_CURRENCY_MAP['IN']).toBe('INR');
    expect(COUNTRY_CURRENCY_MAP['MG']).toBe('MGA');
    expect(COUNTRY_CURRENCY_MAP['CA']).toBe('CAD');
  });

  it('MGA (Madagascar) has 0 decimal places', () => {
    expect(CURRENCY_INFO['MGA'].decimalPlaces).toBe(0);
    expect(CURRENCY_INFO['MGA'].symbol).toBe('Ar');
  });

  it('KWD has 3 decimal places', () => {
    expect(CURRENCY_INFO['KWD'].decimalPlaces).toBe(3);
  });

  /**
   * The 2026-08 currency-map completion, and the two eurozone changeovers,
   * asserted exactly. 'resolves to SOME currency' cannot catch a wrong-but-
   * valid code — Bulgaria mapping to BGN instead of EUR would have passed
   * that check for the eight months it was live and wrong.
   */
  it('the 2026-08 currency-map completion resolves every added country exactly', () => {
    const added: Record<string, string> = {
      MX: 'MXN', BY: 'BYN', BO: 'BOB', KH: 'KHR', EC: 'USD', KZ: 'KZT',
      LA: 'LAK', MN: 'MNT', PY: 'PYG', LK: 'LKR', UZ: 'UZS',
    };
    for (const [country, currency] of Object.entries(added)) {
      expect(COUNTRY_CURRENCY_MAP[country]).toBe(currency);
    }
  });

  it('EC resolves to USD — dollarized since 2000, not its own currency', () => {
    expect(COUNTRY_CURRENCY_MAP['EC']).toBe('USD');
  });

  it('PYG has 0 decimal places', () => {
    expect(CURRENCY_INFO['PYG'].decimalPlaces).toBe(0);
    expect(CURRENCY_INFO['PYG'].symbol).toBe('₲');
  });

  it('the other 2026-08 currencies keep the ordinary 2 decimal places', () => {
    for (const code of ['MXN', 'BYN', 'BOB', 'KHR', 'KZT', 'LAK', 'MNT', 'LKR', 'UZS']) {
      expect(CURRENCY_INFO[code].decimalPlaces).toBe(2);
    }
  });

  it('Croatia (2023) and Bulgaria (2026) resolve to EUR live, with the historical currency kept', () => {
    expect(COUNTRY_CURRENCY_MAP['HR']).toBe('EUR');
    expect(COUNTRY_CURRENCY_MAP['BG']).toBe('EUR');
    // The pre-changeover currencies stay in CURRENCY_INFO for historical amounts.
    expect(CURRENCY_INFO).toHaveProperty('HRK');
    expect(CURRENCY_INFO).toHaveProperty('BGN');
  });
});

describe('Financial year data', () => {
  it('has at least 60 country configs', () => {
    expect(Object.keys(FINANCIAL_YEAR_CONFIGS).length).toBeGreaterThanOrEqual(60);
  });

  it('Australia FY is July–June', () => {
    const au = FINANCIAL_YEAR_CONFIGS['AU'];
    expect(au.yearStart.month).toBe(6);
    expect(au.yearEnd.month).toBe(5);
  });

  it('UK FY is April 6–April 5', () => {
    const gb = FINANCIAL_YEAR_CONFIGS['GB'];
    expect(gb.yearStart.month).toBe(3);
    expect(gb.yearStart.day).toBe(6);
    expect(gb.yearEnd.day).toBe(5);
  });

  it('US is calendar year', () => {
    const us = FINANCIAL_YEAR_CONFIGS['US'];
    expect(us.yearStart.month).toBe(0);
    expect(us.yearEnd.month).toBe(11);
  });

  it('default config is calendar year', () => {
    expect(DEFAULT_FINANCIAL_YEAR_CONFIG.yearStart.month).toBe(0);
    expect(DEFAULT_FINANCIAL_YEAR_CONFIG.yearEnd.month).toBe(11);
  });

  it('Madagascar (MG) is calendar year', () => {
    const mg = FINANCIAL_YEAR_CONFIGS['MG'];
    expect(mg).toBeDefined();
    expect(mg.yearStart.month).toBe(0);
  });

  it('Canada (CA) is April–March', () => {
    const ca = FINANCIAL_YEAR_CONFIGS['CA'];
    expect(ca.yearStart.month).toBe(3);
    expect(ca.yearEnd.month).toBe(2);
  });
});

describe('Tax rates data', () => {
  it('has at least 40 country tax rate entries', () => {
    expect(Object.keys(COUNTRY_TAX_RATES).length).toBeGreaterThanOrEqual(40);
  });

  it('AU GST is 10%', () => {
    const au = getTaxRateInfo('AU');
    expect(au?.standardRate).toBe(0.10);
    expect(au?.taxFamily).toBe('GST');
  });

  it('GB VAT is 20%', () => {
    expect(getStandardTaxRate('GB')).toBe(0.20);
  });

  it('US has SALES_TAX family with 0% federal', () => {
    expect(detectTaxFamily('US')).toBe('SALES_TAX');
    expect(getStandardTaxRate('US')).toBe(0);
  });

  it('Madagascar TVA is 20%', () => {
    const mg = getTaxRateInfo('MG');
    expect(mg?.standardRate).toBe(0.20);
    expect(mg?.localName).toBe('TVA');
  });

  it('unknown country returns default', () => {
    expect(getStandardTaxRate('XX')).toBe(0);
    expect(detectTaxFamily('XX')).toBe('SALES_TAX');
  });

  it('Canada GST/HST is 5%', () => {
    const ca = getTaxRateInfo('CA');
    expect(ca?.standardRate).toBe(0.05);
    expect(ca?.localName).toBe('GST/HST');
  });
});
