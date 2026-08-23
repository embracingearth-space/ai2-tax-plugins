/**
 * Regression tests — override-preservation & refund/credit surfacing
 * ai2fin.com
 *
 * Locks in the 2026-07 global logic audit fixes. Two bug classes had been
 * copy-pasted across many country plugins and were previously UNTESTED:
 *
 *  (A) calculateFields returned the PRE-OVERRIDE `*_calc` figure for an
 *      editable calculated field. Because the client merges calculatedFields
 *      OVER user input on save, a user's manual override was silently discarded
 *      and the summary disagreed with the net figure it was computed from.
 *  (B) a net/payable clamped with `Math.max(0, …)` silently discarded a
 *      taxpayer's credit/refund balance.
 */

import {
  australiaPlugin,
  singaporePlugin,
  brazilPlugin,
  mexicoPlugin,
  japanPlugin,
} from '../src';

describe('Regression — user overrides are preserved in calculateFields output', () => {
  it('AU: an overridden 1A/1B is returned (not the pre-override calc)', () => {
    // G1 alone would calc 1A = 110000/11 = 10000. User overrides 1A to 5000.
    const r = australiaPlugin.calculateFields({ G1: 110000, '1A': 5000, '1B': 300 });
    expect(r['1A']).toBe(5000); // was 10000 (pre-override) before the fix
    expect(r['1B']).toBe(300);
    // Label 9 must be consistent with the returned 1A/1B: 5000 − 300 = 4700
    expect(r['9']).toBe(4700);
  });

  it('Singapore: an overridden output tax (box6) is returned, not box6_calc', () => {
    // box1 × 9% would calc box6 = 9000. User overrides to 5000.
    const r = singaporePlugin.calculateFields({ box1: 100000, box6: 5000, box7: 0 });
    expect(r.box6).toBe(5000); // was 9000 before the fix
  });

  it('Brazil: overridden PIS/COFINS figures are returned and totals stay consistent', () => {
    const r = brazilPlugin.calculateFields({
      pis_output: 100,
      cofins_output: 200,
      pis_credits: 0,
      cofins_credits: 0,
    });
    expect(r.pis_output).toBe(100);
    expect(r.cofins_output).toBe(200);
    expect(r.total_output).toBe(300); // override-aware total, not the calc total
  });
});

describe('Regression — credit/refund balances surface instead of being clamped to 0', () => {
  it('Brazil: credits exceeding output produce a NEGATIVE net (carry-forward), not 0', () => {
    const r = brazilPlugin.calculateFields({
      pis_output: 100,
      cofins_output: 0,
      pis_credits: 300,
      cofins_credits: 0,
    });
    expect(r.net_pis).toBe(-200); // was clamped to 0 before the fix
    expect(r.total_payable).toBeLessThan(0);
  });

  it('Mexico: IVA acreditable exceeding causado gives a saldo a favor (negative), not 0', () => {
    const r = mexicoPlugin.calculateFields({ iva_causado: 100, iva_acreditable: 300 });
    expect(r.net_iva).toBe(-200); // was clamped to 0 before the fix
    expect(r.balance_due).toBeLessThan(0);
  });

  it('Japan: input tax exceeding output surfaces a refund, with whole-yen truncation', () => {
    const r = japanPlugin.calculateFields({ sales_standard: 10000, purchases_standard: 500000 });
    const net = Number(r.net_national);
    expect(net).toBeLessThan(0); // refund surfaces (was Math.max(0,…))
    expect(Number(r.total_payable)).toBeLessThan(0);
    // local_tax truncates toward zero (切り捨て), not floor — so total_payable is
    // net_national + trunc(net_national × 22/78), not the 1-yen-lower floored value.
    expect(Number(r.total_payable)).toBe(net + Math.trunc((net * 22) / 78));
  });
});
