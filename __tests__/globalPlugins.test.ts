/**
 * Global Plugin Tests — @ai2/tax-plugins
 * ai2fin.com
 *
 * Tests ALL new country plugins: indirect tax, income tax, EU template, registry.
 * Each test verifies: calculation accuracy, form schema validity, plugin interface compliance.
 */

import {
  japanPlugin, southKoreaPlugin, chinaPlugin, southAfricaPlugin,
  uaePlugin, saudiArabiaPlugin, malaysiaPlugin, thailandPlugin,
  philippinesPlugin, indonesiaPlugin, brazilPlugin, mexicoPlugin,
  ukSelfAssessmentPlugin, indiaIncomeTaxPlugin, usIncomeTaxPlugin,
  australiaIncomeTaxPlugin, canadaIncomeTaxPlugin,
  createEUPlugin, getPluginForCountry, listOfficialCountries,
  getPluginsForBaseCountry, getCountryTaxFilingLabel,
} from '../src';
import type { TaxFilingPlugin } from '../src';

// ─── Helper: Validate plugin interface compliance ────────────────────────────
function validatePluginInterface(plugin: TaxFilingPlugin, code: string) {
  expect(plugin.countryCode).toBe(code);
  expect(plugin.displayName).toBeTruthy();
  expect(plugin.shortName).toBeTruthy();
  expect(plugin.authority.name).toBeTruthy();
  expect(plugin.authority.portalUrl).toMatch(/^https?:\/\//);
  expect(typeof plugin.isFullPlugin).toBe('boolean');

  const schema = plugin.getFormSchema();
  expect(schema.length).toBeGreaterThan(0);
  for (const section of schema) {
    expect(section.id).toBeTruthy();
    expect(section.title).toBeTruthy();
    expect(section.fields.length).toBeGreaterThan(0);
  }

  const periods = plugin.getFilingPeriods();
  expect(typeof periods.monthly).toBe('boolean');
  expect(typeof periods.quarterly).toBe('boolean');
  expect(typeof periods.annual).toBe('boolean');
  expect(['monthly', 'quarterly', 'annual']).toContain(periods.defaultFrequency);

  const fy = plugin.getFinancialYearBounds(2025);
  expect(fy.start).toBeInstanceOf(Date);
  expect(fy.end).toBeInstanceOf(Date);
  expect(fy.end.getTime()).toBeGreaterThan(fy.start.getTime());

  const formats = plugin.getSupportedExportFormats();
  expect(formats.length).toBeGreaterThan(0);

  const portal = plugin.getPortalSubmissionInfo();
  expect(portal.portalUrl).toMatch(/^https?:\/\//);
}

// ─── EAST ASIA ──────────────────────────────────────────────────────────────

describe('Japan (Consumption Tax)', () => {
  const p = japanPlugin;
  it('passes interface check', () => validatePluginInterface(p, 'JP'));
  it('calculates national tax at 7.8% on standard sales', () => {
    const r = p.calculateFields({ sales_standard: 1000000, sales_reduced: 0, purchases_standard: 500000, purchases_reduced: 0 });
    expect(Number(r.output_national_standard)).toBe(Math.floor(1000000 * 0.078));
    expect(Number(r.output_national_total)).toBe(78000);
  });
  it('calculates local tax as national × 22/78', () => {
    const r = p.calculateFields({ sales_standard: 1000000, purchases_standard: 0 });
    const netNational = Number(r.net_national);
    expect(Number(r.local_tax)).toBe(Math.floor(netNational * 22 / 78));
  });
  it('handles reduced rate at 6.24%', () => {
    const r = p.calculateFields({ sales_standard: 0, sales_reduced: 1000000, purchases_standard: 0 });
    expect(Number(r.output_national_reduced)).toBe(Math.floor(1000000 * 0.0624));
  });
});

describe('South Korea (VAT)', () => {
  const p = southKoreaPlugin;
  it('passes interface check', () => validatePluginInterface(p, 'KR'));
  it('calculates 10% VAT on sales', () => {
    const r = p.calculateFields({ taxable_sales: 50000000, taxable_purchases: 20000000 });
    expect(Number(r.output_vat)).toBe(5000000);
    expect(Number(r.input_vat)).toBe(2000000);
    expect(Number(r.net_vat)).toBe(3000000);
  });
});

describe('China (VAT)', () => {
  const p = chinaPlugin;
  it('passes interface check', () => validatePluginInterface(p, 'CN'));
  it('calculates multi-rate VAT correctly', () => {
    const r = p.calculateFields({ sales_13: 100000, sales_9: 50000, sales_6: 30000 });
    const expected = Math.round((100000 * 0.13 + 50000 * 0.09 + 30000 * 0.06) * 100) / 100;
    expect(Number(r.output_vat_total)).toBe(expected);
  });
  it('handles input VAT transferred out', () => {
    const r = p.calculateFields({ sales_13: 100000, input_vat_invoiced: 5000, input_vat_transferred_out: 1000 });
    expect(Number(r.net_input_vat)).toBe(4000);
  });
});

// ─── MIDDLE EAST & AFRICA ────────────────────────────────────────────────────

describe('South Africa (VAT201)', () => {
  const p = southAfricaPlugin;
  it('passes interface check', () => validatePluginInterface(p, 'ZA'));
  it('calculates VAT-inclusive output at 15/115', () => {
    const r = p.calculateFields({ standard_supplies: 115000, other_goods: 57500 });
    expect(Number(r.output_vat)).toBe(Math.round(115000 * 0.15 / 1.15 * 100) / 100);
  });
});

describe('UAE (VAT Form 201)', () => {
  const p = uaePlugin;
  it('passes interface check', () => validatePluginInterface(p, 'AE'));
  it('calculates 5% VAT', () => {
    const r = p.calculateFields({ standard_rated_supplies: 100000, standard_rated_expenses: 50000 });
    expect(Number(r.output_vat)).toBe(5000);
    expect(Number(r.input_vat)).toBe(2500);
    expect(Number(r.net_vat)).toBe(2500);
  });
});

describe('Saudi Arabia (VAT)', () => {
  const p = saudiArabiaPlugin;
  it('passes interface check', () => validatePluginInterface(p, 'SA'));
  it('calculates 15% VAT', () => {
    const r = p.calculateFields({ standard_sales: 100000, standard_purchases: 40000 });
    expect(Number(r.output_vat)).toBe(15000);
    expect(Number(r.input_vat)).toBe(6000);
    expect(Number(r.net_vat)).toBe(9000);
  });
});

// ─── SOUTHEAST ASIA ─────────────────────────────────────────────────────────

describe('Malaysia (SST-02)', () => {
  const p = malaysiaPlugin;
  it('passes interface check', () => validatePluginInterface(p, 'MY'));
  it('calculates sales tax 10% + service tax 8%', () => {
    const r = p.calculateFields({ taxable_sales_10: 100000, taxable_sales_5: 50000, taxable_services: 80000 });
    expect(Number(r.sales_tax_payable)).toBe(12500); // 100000*0.10 + 50000*0.05
    expect(Number(r.service_tax_payable)).toBe(6400); // 80000*0.08
    expect(Number(r.total_sst)).toBe(18900);
  });
});

describe('Thailand (PP30)', () => {
  const p = thailandPlugin;
  it('passes interface check', () => validatePluginInterface(p, 'TH'));
  it('calculates 7% VAT', () => {
    const r = p.calculateFields({ taxable_sales: 1000000, taxable_purchases: 400000 });
    expect(Number(r.output_vat)).toBe(70000);
    expect(Number(r.input_vat)).toBe(28000);
    expect(Number(r.net_vat)).toBe(42000);
  });
});

describe('Philippines (2550)', () => {
  const p = philippinesPlugin;
  it('passes interface check', () => validatePluginInterface(p, 'PH'));
  it('calculates 12% VAT', () => {
    const r = p.calculateFields({ vatable_sales: 1000000, domestic_purchases_goods: 500000 });
    expect(Number(r.output_vat)).toBe(120000);
    expect(Number(r.input_vat)).toBe(60000);
    expect(Number(r.net_vat)).toBe(60000);
  });
});

describe('Indonesia (SPT PPN)', () => {
  const p = indonesiaPlugin;
  it('passes interface check', () => validatePluginInterface(p, 'ID'));
  it('calculates 11% PPN', () => {
    const r = p.calculateFields({ domestic_delivery: 100000000, domestic_acquisition: 50000000 });
    expect(Number(r.output_vat)).toBe(11000000);
    expect(Number(r.input_vat)).toBe(5500000);
    expect(Number(r.net_vat)).toBe(5500000);
  });
});

// ─── LATIN AMERICA ──────────────────────────────────────────────────────────

describe('Brazil (PIS/COFINS)', () => {
  const p = brazilPlugin;
  it('passes interface check', () => validatePluginInterface(p, 'BR'));
  it('calculates PIS 1.65% + COFINS 7.6% on revenue', () => {
    const r = p.calculateFields({ revenue_taxable: 1000000, revenue_non_cumulative: 1000000, goods_purchased: 400000 });
    expect(Number(r.pis_output)).toBe(Math.round(1000000 * 0.0165 * 100) / 100);
    expect(Number(r.cofins_output)).toBe(Math.round(1000000 * 0.076 * 100) / 100);
    expect(Number(r.total_payable)).toBeGreaterThan(0);
  });
});

describe('Mexico (IVA)', () => {
  const p = mexicoPlugin;
  it('passes interface check', () => validatePluginInterface(p, 'MX'));
  it('calculates 16% IVA', () => {
    const r = p.calculateFields({ sales_16: 500000, purchases_16: 200000 });
    expect(Number(r.iva_causado)).toBe(80000);
    expect(Number(r.iva_acreditable)).toBe(32000);
    expect(Number(r.net_iva)).toBe(48000);
  });
});

// ─── INCOME TAX PLUGINS ─────────────────────────────────────────────────────

describe('UK Self-Assessment (GB-SA)', () => {
  const p = ukSelfAssessmentPlugin;
  it('passes interface check', () => validatePluginInterface(p, 'GB-SA'));
  it('calculates basic rate tax correctly', () => {
    const r = p.calculateFields({ turnover: 40000, allowable_expenses: 5000 });
    // Net profit: 35000. Taxable: 35000. PA: 12570. Tax: (35000-12570)*0.20
    expect(Number(r.net_profit)).toBe(35000);
    expect(Number(r.income_tax)).toBe(Math.round((35000 - 12570) * 0.20 * 100) / 100);
  });
  it('tapers personal allowance above £100K', () => {
    const r = p.calculateFields({ turnover: 130000, allowable_expenses: 5000 });
    // Net profit: 125000. PA taper: 12570 - (125000-100000)/2 = 12570 - 12500 = 70
    expect(Number(r.taxable_income)).toBe(125000);
    const tax = Number(r.income_tax);
    expect(tax).toBeGreaterThan(30000); // Should be well above basic rate
  });
  it('calculates Class 4 NICs', () => {
    const r = p.calculateFields({ turnover: 60000, allowable_expenses: 10000 });
    // Net profit: 50000. Class 4: 6% on (50000-12570) = 37430 * 0.06 = 2245.80
    expect(Number(r.class4_nics)).toBeCloseTo(2245.80, 0);
  });
});

describe('India Income Tax (IN-IT)', () => {
  const p = indiaIncomeTaxPlugin;
  it('passes interface check', () => validatePluginInterface(p, 'IN-IT'));
  it('calculates new regime tax with ₹75K standard deduction', () => {
    // Income above the ₹12L §87A threshold so the slab math is actually exercised.
    const r = p.calculateFields({ tax_regime: 'new', salary_income: 1575000 });
    expect(Number(r.standard_deduction)).toBe(75000);
    expect(Number(r.taxable_income)).toBe(1500000);
    // FY2025-26 new regime: 0-4L=0, 4-8L×5%=20000, 8-12L×10%=40000,
    // 12-15L×15%=45000 → 105000 (>₹12L, so no §87A rebate).
    expect(Number(r.tax_on_income)).toBe(105000);
  });
  it('applies 87A rebate (zero tax up to ₹12L taxable, new regime)', () => {
    const r = p.calculateFields({ tax_regime: 'new', salary_income: 700000 });
    // Taxable 625000 ≤ ₹12L → fully rebated under §87A (FY2025-26): net 0.
    expect(Number(r.tax_on_income)).toBe(0);
  });
  it('applies 80C deduction in old regime', () => {
    const r = p.calculateFields({ tax_regime: 'old', salary_income: 1000000, sec_80c: 150000 });
    expect(Number(r.total_deductions)).toBe(150000);
    expect(Number(r.taxable_income)).toBe(1000000 - 50000 - 150000);
  });
  it('calculates 4% cess', () => {
    const r = p.calculateFields({ tax_regime: 'new', salary_income: 2000000 });
    const taxOnIncome = Number(r.tax_on_income);
    expect(Number(r.cess)).toBe(Math.round(taxOnIncome * 0.04));
  });
});

describe('US Income Tax (US-IT / Schedule C)', () => {
  const p = usIncomeTaxPlugin;
  it('passes interface check', () => validatePluginInterface(p, 'US-IT'));
  it('calculates Schedule C net profit', () => {
    const r = p.calculateFields({ gross_receipts: 200000, cost_of_goods_sold: 50000, office_expense: 10000, rent_lease: 12000 });
    expect(Number(r.gross_income)).toBe(150000);
    expect(Number(r.total_expenses)).toBe(22000);
    expect(Number(r.net_profit_loss)).toBe(128000);
  });
  it('calculates self-employment tax', () => {
    const r = p.calculateFields({ gross_receipts: 100000 });
    expect(Number(r.self_employment_tax)).toBeGreaterThan(0);
    expect(Number(r.self_employment_tax)).toBeLessThan(20000);
  });
  it('applies home office deduction (simplified)', () => {
    const r = p.calculateFields({ gross_receipts: 100000, home_office_sqft: 200 });
    expect(Number(r.home_office_deduction)).toBe(1000); // 200 sqft × $5
  });
});

describe('Australia Income Tax (AU-IT)', () => {
  const p = australiaIncomeTaxPlugin;
  it('passes interface check', () => validatePluginInterface(p, 'AU-IT'));
  it('calculates 0% on income under $18,200', () => {
    const r = p.calculateFields({ salary_wages: 15000 });
    expect(Number(r.income_tax)).toBe(0);
  });
  it('calculates tax on $100K salary', () => {
    const r = p.calculateFields({ salary_wages: 100000 });
    // $18,200 tax-free. $18,201-$45,000 at 16%. $45,001-$100,000 at 30%.
    const expected = (45000 - 18200) * 0.16 + (100000 - 45000) * 0.30;
    expect(Number(r.income_tax)).toBe(Math.round(expected));
  });
  it('calculates LITO for low income', () => {
    const r = p.calculateFields({ salary_wages: 40000 });
    expect(Number(r.lito)).toBe(700);
  });
  it('applies 2% Medicare levy', () => {
    const r = p.calculateFields({ salary_wages: 100000 });
    expect(Number(r.medicare_levy)).toBe(2000);
  });
});

describe('Canada Income Tax (CA-IT / T1)', () => {
  const p = canadaIncomeTaxPlugin;
  it('passes interface check', () => validatePluginInterface(p, 'CA-IT'));
  it('calculates federal tax with BPA credit', () => {
    const r = p.calculateFields({ self_employment_net: 80000 });
    const fedTax = Number(r.federal_tax);
    expect(fedTax).toBeGreaterThan(0);
  });
  it('calculates CPP on self-employment income', () => {
    const r = p.calculateFields({ self_employment_net: 80000 });
    const cpp = Number(r.cpp_contributions);
    // CPP 2026: (min(80000, YMPE 74600) - 3500) * 0.0595 * 2 = 71100 * 0.119 = 8460.90
    expect(cpp).toBeCloseTo(8460.90, 0);
  });
  it('warns on RRSP over limit', () => {
    const warnings = p.validateForm({ rrsp_deduction: 50000 });
    expect(warnings.some(w => w.fieldId === 'rrsp_deduction')).toBe(true);
  });
});

// ─── EU TEMPLATE ────────────────────────────────────────────────────────────

describe('EU Template — Extended Countries', () => {
  const newEU = ['SE', 'FI', 'DK', 'NO', 'CH', 'GR', 'CZ', 'HU', 'RO', 'HR', 'BG',
    'SK', 'LT', 'LV', 'EE', 'SI', 'LU', 'MT', 'CY'];

  for (const code of newEU) {
    it(`${code} passes interface check`, () => {
      const plugin = createEUPlugin(code);
      validatePluginInterface(plugin, code);
    });
    it(`${code} calculates net VAT`, () => {
      const plugin = createEUPlugin(code);
      const r = plugin.calculateFields({ standard_sales: 100000 });
      expect(Number(r.output_vat)).toBeGreaterThan(0);
      expect(Number(r.net_vat)).toBeGreaterThan(0);
    });
  }

  it('Hungary has highest EU VAT at 27%', () => {
    const hu = createEUPlugin('HU');
    const r = hu.calculateFields({ standard_sales: 100000 });
    expect(Number(r.output_vat)).toBe(27000);
  });

  it('Switzerland has 8.1% VAT', () => {
    const ch = createEUPlugin('CH');
    const r = ch.calculateFields({ standard_sales: 100000 });
    expect(Number(r.output_vat)).toBe(8100);
  });
});

// ─── REGISTRY ───────────────────────────────────────────────────────────────

describe('Registry — Global Coverage', () => {
  it('lists 49+ official countries', () => {
    const countries = listOfficialCountries();
    expect(countries.length).toBeGreaterThanOrEqual(49);
  });

  it('retrieves compound-key plugins', () => {
    const gbSa = getPluginForCountry('GB-SA');
    expect(gbSa.countryCode).toBe('GB-SA');
    expect(gbSa.taxFamily).toBe('INCOME_TAX');

    const inIt = getPluginForCountry('IN-IT');
    expect(inIt.countryCode).toBe('IN-IT');
    expect(inIt.taxFamily).toBe('INCOME_TAX');
  });

  it('getPluginsForBaseCountry returns both indirect and income tax', () => {
    const auPlugins = getPluginsForBaseCountry('AU');
    expect(auPlugins.length).toBe(2);
    expect(auPlugins.map(p => p.key).sort()).toEqual(['AU', 'AU-IT']);

    const gbPlugins = getPluginsForBaseCountry('GB');
    expect(gbPlugins.length).toBe(2);
    expect(gbPlugins.map(p => p.key).sort()).toEqual(['GB', 'GB-SA']);
  });

  it('falls back to adaptive generic for unknown countries', () => {
    const plugin = getPluginForCountry('XX');
    expect(plugin.isFullPlugin).toBe(false);
    expect(plugin.countryCode).toBe('XX');
  });

  it('getCountryTaxFilingLabel returns localized labels', () => {
    expect(getCountryTaxFilingLabel('JP')).toContain('消費税');
    expect(getCountryTaxFilingLabel('KR')).toContain('부가세');
    expect(getCountryTaxFilingLabel('DE')).toContain('USt');
    expect(getCountryTaxFilingLabel('GB-SA')).toContain('Self-Assessment');
    expect(getCountryTaxFilingLabel('IN-IT')).toContain('ITR');
  });
});
