/**
 * Calculation Tests — @ai2/tax-plugins
 * ai2fin.com
 *
 * Verifies: each official country plugin produces correct tax calculations.
 * These are the gold-standard tests for numerical accuracy — critical for compliance.
 */

import {
  australiaPlugin,
  unitedKingdomPlugin,
  newZealandPlugin,
  canadaPlugin,
  singaporePlugin,
  indiaPlugin,
  usaPlugin,
  madagascarPlugin,
  createEUPlugin,
  createAdaptiveGenericPlugin,
} from '../src';

describe('@ai2/tax-plugins — Calculations', () => {
  // ─── Australia BAS ─────────────────────────────────────────────────────────

  describe('Australia (BAS)', () => {
    const plugin = australiaPlugin;

    it('should calculate GST on sales (1A) at 10%', () => {
      const result = plugin.calculateFields({ G1: 110000, G2: 0, G3: 0, G10: 0, G11: 55000 });
      // G1 = 110000 total sales inc GST → 1A = G1 × 1/11 = 10000
      expect(result['1A']).toBe(10000);
    });

    it('should calculate net GST payable/refundable', () => {
      const result = plugin.calculateFields({ G1: 110000, G2: 0, G3: 0, G10: 0, G11: 55000 });
      // 1A (output) - 1B (input) = net
      expect(typeof result['1A']).toBe('number');
      expect(typeof result['1B']).toBe('number');
    });

    it('should round using ATO whole-dollar method', () => {
      const rounding = plugin.getRoundingRules();
      expect(rounding.wholeOnly).toBe(true);
      expect(rounding.method).toBe('down');
    });

    it('should handle zero inputs gracefully', () => {
      const result = plugin.calculateFields({});
      expect(result['1A']).toBe(0);
      expect(result['1B']).toBe(0);
    });

    it('should exclude G4 (input-taxed sales) from GST calculation', () => {
      // G1=110000, G4=10000 (input-taxed) → taxable = 110000 - 0 - 0 - 10000 = 100000
      // 1A = 100000 / 11 = 9090 (truncated)
      const result = plugin.calculateFields({ G1: 110000, G2: 0, G3: 0, G4: 10000, G10: 0, G11: 0 });
      expect(result['1A']).toBe(9090);
    });

    it('should accept $0 PAYG variation (T8=0 means zero instalment)', () => {
      const result = plugin.calculateFields({ G1: 0, G10: 0, G11: 0, T1: 50000, T2: 0.05, T8: '0' });
      // T8 explicitly set to 0 → eightA should be 0, not fall through to T3 (2500)
      expect(result['8A']).toBe(0);
    });

    it('should guard against NaN in 1A/1B override', () => {
      const result = plugin.calculateFields({ G1: 110000, G2: 0, G3: 0, G10: 0, G11: 0, '1A': 'abc' });
      expect(result['9']).not.toBeNaN();
    });
  });

  // ─── United Kingdom VAT ────────────────────────────────────────────────────

  describe('United Kingdom (VAT)', () => {
    const plugin = unitedKingdomPlugin;

    it('should calculate Box 3 = Box 1 + Box 2', () => {
      const result = plugin.calculateFields({ box1: 5000, box2: 1000, box4: 3000, box6: 25000, box7: 15000, box8: 0, box9: 0 });
      expect(result.box3).toBe(6000);
    });

    it('should calculate Box 5 = Box 3 - Box 4', () => {
      const result = plugin.calculateFields({ box1: 5000, box2: 1000, box4: 3000, box6: 25000, box7: 15000, box8: 0, box9: 0 });
      expect(result.box5).toBe(3000); // 6000 - 3000
    });

    it('should handle negative Box 5 (refund scenario)', () => {
      const result = plugin.calculateFields({ box1: 1000, box2: 0, box4: 5000, box6: 5000, box7: 25000, box8: 0, box9: 0 });
      expect(result.box5).toBe(-4000);
    });
  });

  // ─── New Zealand GST ───────────────────────────────────────────────────────

  describe('New Zealand (GST)', () => {
    const plugin = newZealandPlugin;

    it('should use NZ tax fraction 3/23 for 15% GST', () => {
      // box7 = box5 - box6, then box9 = (box7 * 3/23) + box8
      // Total sales 23000, zero-rated 0 → box7 = 23000, box9 = 23000 * 3/23 = 3000
      const result = plugin.calculateFields({ box5: 23000, box6: 0, box8: 0, box11: 0, box12: 0, box14: 0 });
      expect(result.box7).toBe(23000); // box5 - box6
      expect(result.box9).toBeCloseTo(3000, 0); // NZ GST fraction
    });

    it('should calculate net GST payable (box16)', () => {
      const result = plugin.calculateFields({ box5: 23000, box6: 0, box8: 0, box11: 11500, box12: 0, box14: 0 });
      expect(typeof result.box16).toBe('number');
      // box16 = box9 - box15
      expect(result.box16).toBeGreaterThan(0);
    });
  });

  // ─── Canada GST/HST ───────────────────────────────────────────────────────

  describe('Canada (GST/HST)', () => {
    const plugin = canadaPlugin;

    it('should calculate line 105 = line103 + line104', () => {
      // line105 = line103 (GST collected) + line104 (adjustments)
      const result = plugin.calculateFields({ line103: 5000, line104: 200, line106: 0, line107: 0, line110: 0, line111: 0 });
      expect(result.line105).toBe(5200);
    });

    it('should have all 13 provinces/territories as sub-jurisdictions', () => {
      expect(plugin.hasSubJurisdictions()).toBe(true);
      const subs = plugin.getSubJurisdictions!();
      expect(subs.length).toBe(13);
      expect(subs.find(s => s.code === 'ON')?.rate).toBe(0.13);
    });
  });

  // ─── Singapore GST ────────────────────────────────────────────────────────

  describe('Singapore (GST F5)', () => {
    const plugin = singaporePlugin;

    it('should calculate at 9% GST rate', () => {
      const result = plugin.calculateFields({ box1: 100000, box2: 0, box3: 0, box4: 0, box5: 50000 });
      // box6 = (box1 - box2 - box3) * 0.09 = 100000 * 0.09 = 9000
      expect(result.box6).toBe(9000);
    });
  });

  // ─── India GSTR-3B ────────────────────────────────────────────────────────

  describe('India (GSTR-3B)', () => {
    const plugin = indiaPlugin;

    it('should have all 37 states/UTs as sub-jurisdictions', () => {
      expect(plugin.hasSubJurisdictions()).toBe(true);
      const states = plugin.getSubJurisdictions!();
      expect(states.length).toBe(37);
    });

    it('should use April-March financial year', () => {
      const fy = plugin.getFinancialYearBounds(2025);
      expect(fy.start.getMonth()).toBe(3); // April
      expect(fy.end.getMonth()).toBe(2); // March
    });
  });

  // ─── USA Form 941 ─────────────────────────────────────────────────────────

  describe('USA (Form 941)', () => {
    const plugin = usaPlugin;

    it('should have all 51 states as sub-jurisdictions', () => {
      expect(plugin.hasSubJurisdictions()).toBe(true);
      const states = plugin.getSubJurisdictions!();
      expect(states.length).toBe(51);
    });

    it('should use Jan-Dec financial year', () => {
      const fy = plugin.getFinancialYearBounds(2025);
      expect(fy.start.getMonth()).toBe(0); // January
      expect(fy.end.getMonth()).toBe(11); // December
    });

    it('should have quarterly filing as default', () => {
      const periods = plugin.getFilingPeriods();
      expect(periods.quarterly).toBe(true);
      expect(periods.defaultFrequency).toBe('quarterly');
    });

    it('should calculate line6 = line3 + line5e', () => {
      const result = plugin.calculateFields({ line2: 100000, line3: 20000 });
      expect(result.line6).toBeDefined();
      // line5e = SS + Medicare taxes, line6 = line3 + line5e
      expect(result.line6).toBe(20000 + Number(result.line5e));
    });

    it('should calculate line10 = line6 + adjustments', () => {
      const result = plugin.calculateFields({ line2: 100000, line3: 20000, line7: 50, line8: 100, line9: -25 });
      expect(result.line10).toBe(Number(result.line6) + 50 + 100 + (-25));
    });

    it('should include 5b tips in line5e', () => {
      const result = plugin.calculateFields({ line2: 100000, line3: 0, line5b_wages: 10000 });
      // 5b_tax = 10000 * 0.124 = 1240
      expect(result.line5b_tax).toBe(1240);
      // line5e includes 5b
      expect(result.line5e).toBeGreaterThan(0);
    });
  });

  // ─── EU Template ──────────────────────────────────────────────────────────

  describe('EU Template (Germany)', () => {
    const plugin = createEUPlugin('DE');

    it('should have correct German metadata', () => {
      expect(plugin.countryCode).toBe('DE');
      expect(plugin.authority.name).toBe('BZSt');
    });

    it('should calculate output_vat at 19% rate', () => {
      // EU template: output_vat = standard_sales * rate
      const result = plugin.calculateFields({ standard_sales: 100000, reduced_sales: 0, input_vat: 5000 });
      expect(result.output_vat).toBe(19000); // 100000 × 19%
      expect(result.net_vat).toBe(14000); // 19000 - 5000
    });
  });

  // ─── Madagascar TVA ─────────────────────────────────────────────────────

  describe('Madagascar (TVA)', () => {
    const plugin = madagascarPlugin;

    it('should have correct Madagascar metadata', () => {
      expect(plugin.countryCode).toBe('MG');
      expect(plugin.taxFamily).toBe('VAT');
      expect(plugin.isFullPlugin).toBe(true);
      expect(plugin.authority.name).toBe('DGI');
    });

    it('should calculate TVA at 20% (fraction 20/120)', () => {
      // 120000 MGA sales TTC → TVA = 120000 × 20/120 = 20000
      const result = plugin.calculateFields({ ca_taxable: 120000, ca_export: 0, achats_locaux: 0 });
      expect(result.tva_collectee).toBe(20000);
    });

    it('should calculate net TVA payable', () => {
      const result = plugin.calculateFields({
        ca_taxable: 120000,
        ca_export: 0,
        achats_locaux: 60000,
        achats_import: 0,
        achats_investissement: 0,
        credit_anterieur: 0,
      });
      // Output TVA: 120000 × 20/120 = 20000
      // Input TVA: 60000 × 20/120 = 10000
      // Net: 20000 - 10000 = 10000
      expect(result.tva_collectee).toBe(20000);
      expect(result.tva_deductible).toBe(10000);
      expect(result.tva_nette).toBe(10000);
    });

    it('should handle credit carry-forward when input > output', () => {
      const result = plugin.calculateFields({
        ca_taxable: 60000,
        ca_export: 0,
        achats_locaux: 120000,
        achats_import: 5000,
        achats_investissement: 0,
        credit_anterieur: 0,
      });
      // Output: 60000 × 20/120 = 10000
      // Input: 120000 × 20/120 + 5000 = 20000 + 5000 = 25000
      // Net: 10000 - 25000 = -15000
      expect(result.tva_nette).toBe(-15000);
      expect(result.credit_a_reporter).toBe(15000);
    });

    it('should deduct prior period credit', () => {
      const result = plugin.calculateFields({
        ca_taxable: 120000,
        ca_export: 0,
        achats_locaux: 0,
        credit_anterieur: 5000,
      });
      // Output: 20000, Input: 0, Prior credit: 5000
      // Net: 20000 - 0 - 5000 = 15000
      expect(result.tva_nette).toBe(15000);
    });

    it('should use monthly filing only', () => {
      const periods = plugin.getFilingPeriods();
      expect(periods.monthly).toBe(true);
      expect(periods.quarterly).toBe(false);
      expect(periods.defaultFrequency).toBe('monthly');
    });

    it('should use Jan-Dec financial year', () => {
      const fy = plugin.getFinancialYearBounds(2025);
      expect(fy.start.getMonth()).toBe(0); // January
      expect(fy.end.getMonth()).toBe(11); // December
    });

    it('should round to whole Ariary', () => {
      const rounding = plugin.getRoundingRules();
      expect(rounding.wholeOnly).toBe(true);
      expect(rounding.decimals).toBe(0);
    });

    it('should use French terminology', () => {
      const terms = plugin.getTerminology();
      expect(terms.taxName).toBe('TVA');
      expect(terms.outputTaxLabel).toBe('TVA Collectée');
      expect(terms.inputTaxLabel).toBe('TVA Déductible');
    });
  });

  // ─── Adaptive Generic ─────────────────────────────────────────────────────

  describe('Adaptive Generic', () => {
    it('should create a valid plugin for unknown country', () => {
      const plugin = createAdaptiveGenericPlugin('ZA');
      expect(plugin.isFullPlugin).toBe(false);
      expect(plugin.countryCode).toBe('ZA');
    });

    it('should calculate basic tax correctly', () => {
      const plugin = createAdaptiveGenericPlugin('ZA');
      const result = plugin.calculateFields({ totalSales: 110000, exemptSales: 0, totalPurchases: 55000 });
      expect(typeof result.outputTax).toBe('number');
      expect(typeof result.inputTax).toBe('number');
      expect(typeof result.netTax).toBe('number');
      expect(result.outputTax).toBeGreaterThan(0);
    });

    it('should auto-detect VAT family for European countries', () => {
      const plugin = createAdaptiveGenericPlugin('CH');
      const terminology = plugin.getTerminology();
      expect(terminology.taxName).toBe('VAT');
    });

    it('should auto-detect GST family for MY', () => {
      const plugin = createAdaptiveGenericPlugin('MY');
      const terminology = plugin.getTerminology();
      expect(terminology.taxName).toBe('GST');
    });
  });
});
