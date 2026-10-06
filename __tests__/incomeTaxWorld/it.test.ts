/**
 * Italy — national IRPEF. embracingearth.space
 */
import { calcIncomeTax } from '../../src';

/** The gross whose reddito complessivo (gross − INPS) equals `target`. */
const grossFor = (target: number, year: string): number => {
  let lo = 0;
  let hi = target * 2;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (calcIncomeTax('IT', mid, year)!.taxable < target) lo = mid;
    else hi = mid;
  }
  return hi;
};
const at = (r: number, year: string) => calcIncomeTax('IT', grossFor(r, year), year)!;

describe('Italy — official Agenzia delle Entrate figures', () => {
  // https://www.agenziaentrate.gov.it/portale/imposta-sul-reddito-delle-persone-fisiche-irpef-/aliquote-e-calcolo-dell-irpef
  it('official: 2026 imposta lorda on 50,000 taxable is 13,700; detrazioni are nil there', () => {
    const r = at(50000, '2026');
    expect(r.incomeTax).toBe(13700);
    expect(r.totalTax).toBe(13700);
    expect(r.verified).toBe(true);
  });
  it('official: 2025 imposta lorda on 50,000 taxable is 14,140', () => {
    const r = at(50000, '2025');
    expect(r.incomeTax).toBe(14140);
    expect(r.totalTax).toBe(14140);
    expect(r.verified).toBe(true);
  });
});

describe('Italy — bands, detrazioni and INPS', () => {
  it('INPS 9.19% is excluded: gross 30,000 → reddito 27,243', () => {
    expect(calcIncomeTax('IT', 30000, '2026')!.taxable).toBeCloseTo(27243, 6);
  });
  it('1% surcharge above the prima fascia (2026: 56,224): gross 60,000 → 60,000 − 5,514 − 37.76', () => {
    expect(calcIncomeTax('IT', 60000, '2026')!.taxable).toBeCloseTo(60000 - 5514 - 37.76, 6);
  });
  it('R 14,000: 3,220 − 1,955 = 1,265; just above 15,000 the c.1 b) formula gives 1,910 + 1,190 = 3,100 (the statute\'s own step)', () => {
    expect(at(14000, '2026').totalTax).toBe(1265);
    // R 15,000.x: 3,450 − 3,100 = 350
    expect(at(15000, '2026').totalTax).toBe(350);
  });
  it('R 28,000: 6,440 − (1,910 + 65) − 1,000 ulteriore = 3,465 (same in both years)', () => {
    expect(at(28000, '2026').totalTax).toBe(3465);
    expect(at(28000, '2025').totalTax).toBe(3465);
  });
  it('R 40,000: 2026 6,440 + 12,000 × 33% = 10,400; 2025 6,440 + 12,000 × 35% = 10,640; less 1,910 × 10/22 = 868.18', () => {
    expect(at(40000, '2026').totalTax).toBe(10400 - 868);
    expect(at(40000, '2025').totalTax).toBe(10640 - 868);
  });
  it('ulteriore detrazione phases out: R 36,000 → 1,000 × 4,000/8,000 = 500', () => {
    const r = at(36000, '2026');
    expect(r.offsets.find((o) => o.name.startsWith('Ulteriore'))!.amount).toBe(500);
  });
  it('says the addizionali are excluded', () => {
    expect(at(30000, '2026').assumptions!.join(' ')).toMatch(/addizionale regionale/);
  });
});
