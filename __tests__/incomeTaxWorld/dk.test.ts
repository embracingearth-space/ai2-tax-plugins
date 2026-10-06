/**
 * Denmark — state tax, AM-bidrag and municipal tax. The research found no
 * official worked example; every expectation is own arithmetic from the
 * published rates (svmn.dk / skat.dk). embracingearth.space
 */
import { calcIncomeTax } from '../../src';

const levy = (r: ReturnType<typeof calcIncomeTax>, prefix: string) => r!.levies.find((l) => l.name.startsWith(prefix))?.amount ?? 0;

describe('Denmark 2026 — state-tax band edges (taxable = 92% of gross, after AM-bidrag)', () => {
  it('bundskat 12.01% up to 641,200, 19.51% just above', () => {
    // 696,950 × 0.92 = 641,194 → × 12.01% = 77,007.40
    expect(calcIncomeTax('DK', 696950, '2026')!.incomeTax).toBe(77007);
    // 697,000 × 0.92 = 641,240 → 77,008.12 + 40 × 19.51% (7.80) = 77,015.92
    expect(calcIncomeTax('DK', 697000, '2026')!.incomeTax).toBe(77016);
  });
  it('topskat and toptopskat bands', () => {
    // taxable 2,576,000: 641,200×12.01% 77,008.12 + 136,700×19.51% 26,670.17 + 1,798,100×27.01% 485,666.81 = 589,345.10
    expect(calcIncomeTax('DK', 2800000, '2026')!.incomeTax).toBe(589345);
    // above 2,592,700 taxable the state marginal rate is 32.01% of 92% of gross, plus 8% AM-bidrag
    expect(calcIncomeTax('DK', 3000000, '2026')!.marginalRate).toBeGreaterThan(0.08 + 0.3201 * 0.92);
  });
  it('700,000 gross: personfradrag credit, AM-bidrag and municipal tax at the 25.049% average', () => {
    const r = calcIncomeTax('DK', 700000, '2026')!;
    // 641,200×12.01% + 2,800×19.51% = 77,554.40
    expect(r.incomeTax).toBe(77554);
    // 54,100 × 12.01% = 6,497.41
    expect(r.offsets.reduce((s, o) => s + o.amount, 0)).toBe(6497);
    expect(levy(r, 'Labour-market')).toBe(56000);
    // 644,000 − 63,300 (employment, capped) − 3,100 (job, capped) − 54,100 = 523,500 × 25.049% = 131,131.52
    expect(levy(r, 'Municipal')).toBe(131132);
    expect(levy(r, 'Church')).toBe(0);
    expect(r.verified).toBe(true);
  });
  it('employment and job allowances below their caps (300,000 gross)', () => {
    // taxable 276,000; employment 12.75% = 35,190; job 4.5% × 40,800 = 1,836
    // 276,000 − 35,190 − 1,836 − 54,100 = 184,874 × 25.049% = 46,309.09
    expect(levy(calcIncomeTax('DK', 300000, '2026'), 'Municipal')).toBe(46309);
  });
  it('local and church rates can be passed', () => {
    const r = calcIncomeTax('DK', 700000, '2026', { localTaxRate: 0.25, churchTaxRate: 0.00867 })!;
    expect(levy(r, 'Municipal')).toBe(130875); // 523,500 × 25%
    expect(levy(r, 'Church')).toBe(4539); // 523,500 × 0.867% = 4,538.75
  });
});

describe('Denmark 2025', () => {
  it('topskat edge at 611,800 and municipal tax at the 25.068% average', () => {
    const r = calcIncomeTax('DK', 700000, '2025')!;
    // 611,800×12.01% 73,477.18 + 32,200×27.01% 8,697.22 = 82,174.40
    expect(r.incomeTax).toBe(82174);
    // 644,000 − 55,600 − 2,900 − 51,600 = 533,900 × 25.068% = 133,838.05
    expect(levy(r, 'Municipal')).toBe(133838);
    // 51,600 × 12.01% = 6,197.16 (matches the OECD credit figure)
    expect(r.offsets.reduce((s, o) => s + o.amount, 0)).toBe(6197);
    expect(r.verified).toBe(true);
  });
  it('says ATP and other contributions are not included', () => {
    expect(calcIncomeTax('DK', 400000, '2025')!.assumptions!.join(' ')).toMatch(/ATP/);
  });
});
