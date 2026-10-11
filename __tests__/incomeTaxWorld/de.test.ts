/**
 * Germany — §32a EStG tariff, Vorsorgepauschale, Soli, church tax. embracingearth.space
 *
 * Tariff expectations call the year's §32a formula directly on a zvE; the
 * wage expectations follow the BMF Programmablaufplan (PAP) step by step:
 * Teilbeträge cut down to cents, the Vorsorgepauschale (VSP) rounded up to
 * whole euros, zvE = wage − 1,230 − 36 − VSP. Own arithmetic from the PAP,
 * not official examples.
 */
import { calcIncomeTax } from '../../src';
import { DE_INCOME_TAX } from '../../src/data/incomeTaxWorld/de';

const whole = { round: Math.round, floor: Math.floor };
const tariff = (year: string) => DE_INCOME_TAX.years.find((y) => y.taxYear === year)!.tariff!;
const wage = (gross: number, year: string, opts?: { churchTaxRate?: number }) => calcIncomeTax('DE', gross, year, opts)!;
const levy = (r: ReturnType<typeof wage>, name: string) => r.levies.find((l) => l.name === name)?.amount ?? 0;
const vsp = (r: ReturnType<typeof wage>) => r.gross - 1266 - r.taxable;

describe('Germany — the §32a formula on a zvE (derived from the official formula — not an official example)', () => {
  it.each([
    ['2026', 30000, 4217],
    ['2026', 50000, 10548],
    ['2026', 100000, 30864],
    ['2025', 30000, 4303],
    ['2025', 50000, 10691],
    ['2025', 100000, 31088],
  ])('%s: zvE %d → income tax %d', (year, zvE, tax) => {
    expect(tariff(year)(zvE, whole)).toBe(tax);
  });

  it.each([
    // 2026: zone 1 to 12,348 → 0; zone 2 end 17,799: y = 0.5451, (914.51y + 1400)y = 1034.87 → 1034
    ['2026', 12348, 0], ['2026', 12349, 0], ['2026', 17799, 1034], ['2026', 17800, 1035],
    // zone 3 end 69,878 → 18,213.x; zone 4: 0.42 × 69,879 − 11,135.63 = 18,213.55
    ['2026', 69878, 18213], ['2026', 69879, 18213],
    // 0.42 × 277,825 − 11,135.63 = 105,550.87; 0.45 × 277,826 − 19,470.38 = 105,551.32
    ['2026', 277825, 105550], ['2026', 277826, 105551],
    ['2025', 12096, 0], ['2025', 17443, 1015], ['2025', 68480, 17849], ['2025', 68481, 17850],
    ['2025', 277825, 105774], ['2025', 277826, 105775],
  ])('zone boundary %s: zvE %d → %d', (year, zvE, tax) => {
    expect(tariff(year as string)(zvE as number, whole)).toBe(tax);
  });
});

describe('Germany — Vorsorgepauschale per the BMF Programmablaufplan (own arithmetic from the PAP — not an official example)', () => {
  it('2026 €50,000: RV 4,650 + KV/PV 5,425 → VSP 10,075; zvE 38,659 → 6,788 (was 10,106 without it)', () => {
    // RV 50,000 × 9.3% = 4,650.00; KV/PV 50,000 × (7% + 1.45% + 2.4%) = 5,425.00
    // AV route: 4,650 + min(5,425 + 650, 1,900) = 6,550 < 10,075, so it does not apply
    const r = wage(50000, '2026');
    expect(vsp(r)).toBe(10075);
    expect(r.taxable).toBe(38659);
    // z = 2.086: (173.1z + 2,397)z + 1,034.87 = 6,788.25
    expect(r.incomeTax).toBe(6788);
    expect(r.totalTax).toBe(6788);
    expect(r.verified).toBe(true);
  });

  it('2025 €50,000: RV 4,650 + KV/PV 5,325 → VSP 9,975; zvE 38,759 → 6,927', () => {
    // KV/PV 50,000 × (7% + 1.25% + 2.4%) = 5,325.00; Mindestvorsorgepauschale 4,650 + 1,900 = 6,550 is smaller
    const r = wage(50000, '2025');
    expect(vsp(r)).toBe(9975);
    expect(r.taxable).toBe(38759);
    // z = 2.1316: (176.64z + 2,397)z + 1,015.13 = 6,927.18
    expect(r.incomeTax).toBe(6927);
  });

  it('2026 €120,000: both parts capped — RV 101,400 × 9.3% = 9,430.20, KV/PV 69,750 × 10.85% = 7,567.87 → VSP 16,999', () => {
    const r = wage(120000, '2026');
    expect(vsp(r)).toBe(16999);
    expect(r.taxable).toBe(101735);
    // 0.42 × 101,735 − 11,135.63 = 31,593.07
    expect(r.incomeTax).toBe(31593);
  });

  it('2025 €120,000: RV 96,600 × 9.3% = 8,983.80, KV/PV 66,150 × 10.65% = 7,044.97 → VSP 16,029', () => {
    const r = wage(120000, '2025');
    expect(vsp(r)).toBe(16029);
    // 0.42 × 102,705 − 10,911.92 = 32,224.18
    expect(r.incomeTax).toBe(32224);
  });

  it('2026 €16,000: unemployment insurance counts inside the 1,900 Höchstbetrag', () => {
    // RV 1,488.00; KV/PV 16,000 × 10.85% = 1,736.00 → ⌈3,224.00⌉ = 3,224
    // AV 16,000 × 1.3% = 208.00; min(1,736 + 208, 1,900) = 1,900 → ⌈1,488 + 1,900⌉ = 3,388 wins
    const r = wage(16000, '2026');
    expect(vsp(r)).toBe(3388);
    expect(r.taxable).toBe(11346);
  });

  it('2025 €17,000: the Mindestvorsorgepauschale (12%, max 1,900) wins over KV/PV', () => {
    // RV 1,581.00; KV/PV 17,000 × 10.65% = 1,810.50 → 3,392; 12% = 2,040 → 1,900 → ⌈1,581 + 1,900⌉ = 3,481
    const r = wage(17000, '2025');
    expect(vsp(r)).toBe(3481);
    expect(r.taxable).toBe(12253);
    // y = (12,253 − 12,096) / 10,000 = 0.0157: (932.3y + 1,400)y = 22.21
    expect(r.incomeTax).toBe(22);
  });

  it('2026 has no Mindestvorsorgepauschale: €14,000 deducts the AV route, not 12%', () => {
    // RV 1,302.00; KV/PV 14,000 × 10.85% = 1,519.00; AV 182.00 → min(1,701.00, 1,900) = 1,701.00
    // → ⌈1,302 + 1,701⌉ = 3,003 (the 2025 rule would have given ⌈1,302 + 12% × 14,000⌉ = 2,982)
    expect(vsp(wage(14000, '2026'))).toBe(3003);
  });
});

describe('Germany — solidarity surcharge and church tax', () => {
  it('no Soli while income tax is within the Freigrenze: 2026 €80,000 → tax 15,694 ≤ 20,350', () => {
    // VSP 7,440.00 + 7,567.87 → 15,008; zvE 63,726
    const r = wage(80000, '2026');
    expect(r.taxable).toBe(63726);
    expect(r.incomeTax).toBe(15694);
    expect(levy(r, 'Solidaritätszuschlag')).toBe(0);
  });
  it('Milderungszone 2026 €120,000: 11.9% × (31,593 − 20,350) = 1,337.92', () => {
    expect(levy(wage(120000, '2026'), 'Solidaritätszuschlag')).toBe(1338);
  });
  it('Milderungszone 2025 uses the 19,950 Freigrenze: 11.9% × (32,224 − 19,950) = 1,460.61', () => {
    expect(levy(wage(120000, '2025'), 'Solidaritätszuschlag')).toBe(1461);
  });
  it('full 5.5% above the transition: 2026 €320,000 → zvE 301,735, tax 116,310 → 6,397.05', () => {
    const r = wage(320000, '2026');
    expect(r.taxable).toBe(301735);
    expect(r.incomeTax).toBe(116310);
    expect(levy(r, 'Solidaritätszuschlag')).toBe(6397);
  });
  it('church tax only with churchTaxRate: 9% × 31,593 = 2,843.37', () => {
    expect(levy(wage(120000, '2026'), 'Kirchensteuer')).toBe(0);
    expect(levy(wage(120000, '2026', { churchTaxRate: 0.09 }), 'Kirchensteuer')).toBe(2843);
  });
});

describe('Germany — provenance and what the estimate assumes', () => {
  it('each year cites the BMF Programmablaufplan of that year, read 2026-10-11', () => {
    for (const year of ['2026', '2025']) {
      const r = wage(50000, year);
      expect(r.source).toContain(`Lohnsteuer${year}.xml`);
      expect(r.citationDate).toBe('2026-10-11');
      expect(r.verified).toBe(true);
    }
  });
  it('says it uses the AVERAGE additional health rate and is the wage-tax figure', () => {
    const a = wage(50000, '2026').assumptions!.join(' ');
    expect(a).toMatch(/Vorsorgepauschale/);
    expect(a).toMatch(/AVERAGE \(2026: 2\.9%, 2025: 2\.5%\)/);
    expect(a).toMatch(/§10 EStG/);
    expect(a).not.toMatch(/OVERSTATES/);
  });
});
