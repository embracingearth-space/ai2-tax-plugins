/**
 * Chile — Impuesto Único de Segunda Categoría, annualised UTA scale, after deductible contributions.
 * No official SII worked example captured.
 * embracingearth.space
 */
import { calcIncomeTax } from '../../src';

describe('Chile 2026 (October 2026 UTA — unverified)', () => {
  it('zero band: gross 14,264,659 × (1 − 18.06%) = 11,688,461.6 ≤ 11,688,462', () => {
    expect(calcIncomeTax('CL', 14264659, '2026')!.incomeTax).toBe(0);
  });

  it('CLP 20,000,000 → taxable 16,388,000 (17.46% + 0.6%) → (16,388,000 − 11,688,462) × 4% = 187,981.52', () => {
    const r = calcIncomeTax('CL', 20000000, '2026')!;
    expect(r.taxable).toBe(16388000);
    expect(r.incomeTax).toBe(187982);
    expect(r.verified).toBe(false);
  });

  it('CLP 40,000,000 → taxable 32,776,000: 571,435.92 + 6,801,640 × 8% (544,131.20) = 1,115,567.12', () => {
    expect(calcIncomeTax('CL', 40000000, '2026')!.incomeTax).toBe(1115567);
  });

  it('contributions stop at the 90 UF / 135.2 UF ceilings: 100,000,000 → taxable 91,848,512.14', () => {
    // 100,000,000 − 17.46% × 44,394,858 (7,751,342.21) − 0.6% × 66,690,942.24 (400,145.65)
    const r = calcIncomeTax('CL', 100000000, '2026')!;
    expect(r.taxable).toBeCloseTo(91848512.14, 0);
    // 571,435.92 + 1,385,299.20 + 2,337,692.40 + 3,982,735.20 + 13,925,432.14 × 30.4% (4,233,331.37) = 12,510,494.09
    expect(r.incomeTax).toBe(12510494);
    expect(r.marginalRate).toBeCloseTo(0.304, 6);
  });
});

describe('Chile 2025 (SII table AT 2026)', () => {
  it('CLP 20,000,000 → taxable 16,480,000 (17% + 0.6%) → (16,480,000 − 11,265,804) × 4% = 208,567.84', () => {
    const r = calcIncomeTax('CL', 20000000, '2025')!;
    expect(r.taxable).toBe(16480000);
    expect(r.incomeTax).toBe(208568);
    expect(r.verified).toBe(true);
  });

  it('CLP 40,000,000 → taxable 32,960,000: 550,772.64 + 7,924,880 × 8% (633,990.40) = 1,184,763.04', () => {
    expect(calcIncomeTax('CL', 40000000, '2025')!.incomeTax).toBe(1184763);
  });
});
