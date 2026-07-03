/**
 * Student loan (HELP/HECS) + Superannuation Tests — @ai2/tax-plugins
 * ai2fin.com
 *
 * Gold-standard numerical accuracy for the AU study-loan and super estimators.
 * The HELP cases reproduce the ATO's own worked examples verbatim (verified
 * against the ATO threshold tables on 2026-07-03) so any drift fails loudly.
 */

import {
  getStudentLoanRepayment,
  getSuperannuationEstimate,
  listStudentLoanCountries,
  listRetirementCountries,
  australiaIncomeTaxPlugin,
} from '../src';

describe('@ai2/tax-plugins — Student loan (HELP/HECS)', () => {
  describe('AU marginal system — ATO worked examples (2026-27)', () => {
    // Source: ATO "Study and training loan repayment thresholds and rates",
    // Examples 1-3, Table 1 (2026-27). Marginal on income above $69,528.
    it("reproduces Christina's repayment ($86,380 → $2,527.80)", () => {
      const r = getStudentLoanRepayment('AU', { repaymentIncome: 86380, taxYear: '2026-27' });
      expect(r?.repayment).toBeCloseTo(2527.8, 2);
    });

    it("reproduces Barry's repayment ($137,064 → $10,276.99)", () => {
      const r = getStudentLoanRepayment('AU', { repaymentIncome: 137064, taxYear: '2026-27' });
      expect(r?.repayment).toBeCloseTo(10276.99, 2);
    });

    it("reproduces Priya's top-band repayment ($254,780 → 10% of total = $25,478)", () => {
      const r = getStudentLoanRepayment('AU', { repaymentIncome: 254780, taxYear: '2026-27' });
      expect(r?.repayment).toBeCloseTo(25478, 2);
      expect(r?.method).toBe('marginal');
    });
  });

  describe('AU marginal system — 2025-26 thresholds', () => {
    it('is nil at exactly the $67,000 threshold', () => {
      const r = getStudentLoanRepayment('AU', { repaymentIncome: 67000, taxYear: '2025-26' });
      expect(r?.repayment).toBe(0);
      expect(r?.effectiveRate).toBe(0);
    });

    it('charges 15c per $1 over $67,000 in the first band', () => {
      // ($100,000 - $67,000) × 15% = $4,950
      const r = getStudentLoanRepayment('AU', { repaymentIncome: 100000, taxYear: '2025-26' });
      expect(r?.repayment).toBeCloseTo(4950, 2);
    });

    it('applies base + 17c in the middle band', () => {
      // $8,700 + ($150,000 - $125,000) × 17% = $8,700 + $4,250 = $12,950
      const r = getStudentLoanRepayment('AU', { repaymentIncome: 150000, taxYear: '2025-26' });
      expect(r?.repayment).toBeCloseTo(12950, 2);
    });

    it('reverts to 10% of TOTAL income in the top band', () => {
      // $200,000 × 10% = $20,000 (whole-of-income, not marginal)
      const r = getStudentLoanRepayment('AU', { repaymentIncome: 200000, taxYear: '2025-26' });
      expect(r?.repayment).toBeCloseTo(20000, 2);
    });
  });

  describe('effective-dating + guards', () => {
    it('resolves the year by asOf date when no taxYear is given', () => {
      const r = getStudentLoanRepayment('AU', {
        repaymentIncome: 100000,
        asOf: new Date('2025-09-01'),
      });
      expect(r?.taxYearLabel).toBe('2025-26'); // $67k threshold year
      expect(r?.repayment).toBeCloseTo(4950, 2);
    });

    it('picks the 2026-27 schedule for a 2026 date (higher threshold)', () => {
      const r = getStudentLoanRepayment('AU', {
        repaymentIncome: 100000,
        asOf: new Date('2026-09-01'),
      });
      expect(r?.taxYearLabel).toBe('2026-27');
      // ($100,000 - $69,528) × 15% = $4,570.80 — less than the 2025-26 figure
      expect(r?.repayment).toBeCloseTo(4570.8, 2);
    });

    it('returns null for an unsupported country', () => {
      expect(getStudentLoanRepayment('FR', { repaymentIncome: 100000 })).toBeNull();
    });

    it('accepts the compound key AU-IT', () => {
      const r = getStudentLoanRepayment('AU-IT', { repaymentIncome: 100000, taxYear: '2025-26' });
      expect(r?.repayment).toBeCloseTo(4950, 2);
    });

    it('lists AU among supported countries', () => {
      expect(listStudentLoanCountries()).toContain('AU');
    });
  });
});

describe('@ai2/tax-plugins — Superannuation', () => {
  describe('AU Superannuation Guarantee', () => {
    it('applies the 12% SG rate for 2025-26', () => {
      const s = getSuperannuationEstimate('AU', { ordinaryEarnings: 100000, taxYear: '2025-26' });
      expect(s?.guaranteeRate).toBe(0.12);
      expect(s?.guaranteeAmount).toBe(12000);
      // Contributions tax: 15% of $12,000 concessional
      expect(s?.contributionsTax).toBe(1800);
      expect(s?.highEarnerSurchargeApplies).toBe(false);
    });

    it('applies the 11.5% SG rate for 2024-25 (effective-dating)', () => {
      const s = getSuperannuationEstimate('AU', { ordinaryEarnings: 100000, taxYear: '2024-25' });
      expect(s?.guaranteeRate).toBe(0.115);
      expect(s?.guaranteeAmount).toBe(11500);
    });

    it('flags excess concessional contributions over the $30,000 cap (2025-26)', () => {
      // SG $12,000 + $20,000 salary sacrifice = $32,000 → $2,000 over cap
      const s = getSuperannuationEstimate('AU', {
        ordinaryEarnings: 100000,
        salarySacrifice: 20000,
        taxYear: '2025-26',
      });
      expect(s?.concessionalContributions).toBe(32000);
      expect(s?.excessConcessional).toBe(2000);
      // Contributions tax charged on the capped $30,000 only
      expect(s?.contributionsTax).toBe(4500);
    });

    it('lifts the concessional cap to $32,500 for 2026-27', () => {
      const s = getSuperannuationEstimate('AU', { ordinaryEarnings: 100000, taxYear: '2026-27' });
      expect(s?.concessionalCap).toBe(32500);
    });

    it('caps SG at the maximum quarterly contribution base (2025-26)', () => {
      // MCB $62,500/qtr → $250,000/yr. OTE $300,000 → SG on $250,000 only.
      const s = getSuperannuationEstimate('AU', { ordinaryEarnings: 300000, taxYear: '2025-26' });
      expect(s?.guaranteeableEarnings).toBe(250000);
      expect(s?.guaranteeAmount).toBe(30000); // not 12% × $300,000 = $36,000
    });

    it('applies Division 293 for combined income over $250,000', () => {
      // Other income $250,000 + SG $6,000 = $256,000 combined → $6,000 over threshold.
      // Div 293 = 15% × min($6,000 excess, $6,000 contributions) = $900.
      const s = getSuperannuationEstimate('AU', {
        ordinaryEarnings: 50000,
        otherTaxableIncome: 250000,
        taxYear: '2025-26',
      });
      expect(s?.highEarnerSurchargeApplies).toBe(true);
      expect(s?.highEarnerSurchargeTax).toBe(900);
    });

    it('returns null for an unsupported country and lists AU', () => {
      expect(getSuperannuationEstimate('FR', { ordinaryEarnings: 100000 })).toBeNull();
      expect(listRetirementCountries()).toContain('AU');
    });
  });
});

describe('@ai2/tax-plugins — AU-IT plugin HELP integration', () => {
  it('adds the compulsory repayment to balance due when a study loan is flagged', () => {
    const withLoan = australiaIncomeTaxPlugin.calculateFields({
      salary_wages: 90000,
      has_study_loan: true,
    });
    const withoutLoan = australiaIncomeTaxPlugin.calculateFields({
      salary_wages: 90000,
      has_study_loan: false,
    });

    expect(Number(withLoan.study_loan_repayment)).toBeGreaterThan(0);
    expect(Number(withoutLoan.study_loan_repayment)).toBe(0);
    // The repayment lifts the amount payable by exactly the repayment figure.
    expect(Number(withLoan.balance_due) - Number(withoutLoan.balance_due)).toBe(
      Number(withLoan.study_loan_repayment),
    );
    // It is NOT folded into income-tax liability.
    expect(withLoan.total_tax).toBe(withoutLoan.total_tax);
  });

  it('counts reportable super in repayment income (raises the repayment)', () => {
    const base = australiaIncomeTaxPlugin.calculateFields({
      salary_wages: 90000,
      has_study_loan: true,
    });
    const withSuper = australiaIncomeTaxPlugin.calculateFields({
      salary_wages: 90000,
      reportable_super: 15000,
      has_study_loan: true,
    });
    expect(Number(withSuper.study_loan_repayment)).toBeGreaterThan(
      Number(base.study_loan_repayment),
    );
  });
});
