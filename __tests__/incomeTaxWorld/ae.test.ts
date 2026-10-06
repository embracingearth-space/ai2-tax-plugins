/**
 * United Arab Emirates — no personal income tax on employment income. embracingearth.space
 */
import { calcIncomeTax } from '../../src';

describe('AE — confirmed absence of tax on wages', () => {
  it.each(['2026', '2025'])('%s: tax is nil at any salary, and verified', (year) => {
    for (const g of [0, 50000, 1000000, 100000000]) {
      const r = calcIncomeTax('AE', g, year)!;
      expect(r.totalTax).toBe(0);
      expect(r.verified).toBe(true);
    }
    expect(calcIncomeTax('AE', 100000, year)!.assumptions!.join(' ')).toMatch(/Social contributions are not included/);
  });
});
