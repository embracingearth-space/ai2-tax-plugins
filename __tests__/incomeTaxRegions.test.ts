/**
 * Sub-national income tax: Canadian provinces and territories, US states, and
 * Scotland. embracingearth.space
 *
 * Every expectation is worked by hand from the published tables in the comment
 * beside it (none of these jurisdictions publishes an absolute worked example
 * for a gross salary in the research), so a wrong digit in a table, a wrong
 * order on a 428 form, or a region that silently drops out shows up here.
 */
import { calcIncomeTax, getIncomeTaxBands, getIncomeTaxRegionBands, listIncomeTaxRegions, INCOME_TAX_SCHEMES } from '../src';

const line = (r: ReturnType<typeof calcIncomeTax>, name: string) => r!.levies.find((l) => l.name === name)?.amount ?? 0;
const offset = (r: ReturnType<typeof calcIncomeTax>, prefix: string) => r!.offsets.find((o) => o.name.startsWith(prefix))?.amount ?? 0;

describe('selecting a region', () => {
  it('accepts the bare code, any case, and the ISO 3166-2 form', () => {
    const a = calcIncomeTax('CA', 50000, '2026', { region: 'ON' })!;
    expect(calcIncomeTax('CA', 50000, '2026', { region: 'on' })!.totalTax).toBe(a.totalTax);
    expect(calcIncomeTax('CA', 50000, '2026', { region: 'CA-ON' })!.totalTax).toBe(a.totalTax);
    expect(a.region).toMatchObject({ code: 'ON', name: 'Ontario', taxYear: '2026', verified: true });
  });

  it('refuses an unknown region loudly rather than answering federal-only', () => {
    expect(() => calcIncomeTax('CA', 50000, '2026', { region: 'ZZ' })).toThrow(RangeError);
    expect(() => calcIncomeTax('US', 50000, '2026', { region: 'XX' })).toThrow(/Unknown region/);
    expect(() => calcIncomeTax('GB', 50000, '2026-27', { region: 'WLS' })).toThrow(RangeError);
  });

  it('ignores a region for a country that has none (a shared multi-country form must not break AU)', () => {
    expect(calcIncomeTax('AU', 90000, '2025-26', { region: 'ON' })!.totalTax).toBe(calcIncomeTax('AU', 90000, '2025-26')!.totalTax);
  });

  it('getIncomeTaxBands ignores a region for a country that has none, as calcIncomeTax does', () => {
    expect(getIncomeTaxBands('AU', '2025-26', 'ON')).toEqual(getIncomeTaxBands('AU', '2025-26'));
  });

  it('without a region, CA and US stay federal only, exactly as before', () => {
    const ca = calcIncomeTax('CA', 50000, '2026')!;
    expect(ca.region).toBeUndefined();
    expect(ca.levies).toEqual([]);
    expect(calcIncomeTax('US', 80000, '2026')!.levies.map((l) => l.name)).toEqual(['Social Security (6.2%)', 'Medicare (1.45%)']);
  });

  it('lists every province and territory, and every state plus DC', () => {
    expect(listIncomeTaxRegions('CA').map((r) => r.code)).toEqual(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']);
    expect(listIncomeTaxRegions('US')).toHaveLength(51);
    expect(listIncomeTaxRegions('GB')).toEqual([{ code: 'SCT', name: 'Scotland', mode: 'replacesBands' }]);
    expect(listIncomeTaxRegions('AU')).toEqual([]);
  });
});

describe('Canada — provinces and territories on top of federal (2026)', () => {
  it('Ontario $50,000: basic tax less BPA credit, no surtax, LIFT fully phased out, Health Premium $600', () => {
    // 50,000 × 5.05% = 2,525.00 − 12,989 × 5.05% (655.94) = 1,869.06; surtax nil (< 5,818);
    // tax reduction 2 × 300 − 1,869 < 0 → nil; LIFT min(875, 2,525) − 5% × 17,500 = 0.
    // OHP: 450 + 25% × 2,000 = 950, capped at 600.
    const r = calcIncomeTax('CA', 50000, '2026', { region: 'ON' })!;
    expect(line(r, 'Ontario income tax')).toBe(1869);
    expect(line(r, 'Ontario Health Premium')).toBe(600);
    expect(r.totalTax).toBe(calcIncomeTax('CA', 50000, '2026')!.totalTax + 1869 + 600);
  });

  it('Ontario $200,000: both surtax tiers apply, Health Premium at its $750 step', () => {
    // basic 18,443.99 − 655.94 = 17,788.05; surtax 20% × 11,970.05 + 36% × 10,342.05 = 6,117.15 → 23,905.
    const r = calcIncomeTax('CA', 200000, '2026', { region: 'ON' })!;
    expect(line(r, 'Ontario income tax')).toBe(23905);
    expect(line(r, 'Ontario Health Premium')).toBe(750);
  });

  it('Ontario low income: the Ontario tax reduction and LIFT clear the tax', () => {
    // 20,000 × 5.05% = 1,010 − 655.94 = 354.06; reduction 600 − 354.06 = 245.94 → 108.12; LIFT 875 → nil.
    expect(line(calcIncomeTax('CA', 20000, '2026', { region: 'ON' }), 'Ontario income tax')).toBe(0);
  });

  it('Quebec $60,000: deduction for workers, Quebec brackets, and the 16.5% abatement of basic federal tax', () => {
    // QC: 60,000 − 1,450 = 58,550; 54,345 × 14% + 4,205 × 19% = 8,407.25 − 18,952 × 14% (2,653.28) = 5,753.97.
    // Federal: 58,523 × 14% + 1,477 × 20.5% = 8,496 − 2,303 BPA credit = 6,193; abatement 16.5% → 1,021.85.
    const r = calcIncomeTax('CA', 60000, '2026', { region: 'QC' })!;
    expect(line(r, 'Quebec income tax')).toBe(5754);
    expect(offset(r, 'Refundable Quebec abatement')).toBe(1022);
    expect(r.totalTax).toBe(6193 - 1022 + 5754);
  });

  it('Quebec bracket arithmetic matches Revenu Québec’s 2026 constant (19% × I − 2,717), within the constant’s rounding', () => {
    // TP-1015.F-V (2026-01): for income in the 19% bracket, tax = 0.19 × I − 2,717 (K rounded to the dollar).
    const bands = getIncomeTaxRegionBands('CA', 'QC', '2026');
    const progressive = (x: number) => bands.reduce((t, b, i) => {
      const lo = i === 0 ? 0 : bands[i - 1]!.upTo!;
      const hi = b.upTo ?? Infinity;
      return t + Math.max(0, Math.min(x, hi) - lo) * b.rate;
    }, 0);
    expect(Math.abs(progressive(96345.08) - (0.19 * 96345.08 - 2717))).toBeLessThan(1);
  });

  it('British Columbia $30,000: the BC tax reduction phases down at 3.56% above $25,570', () => {
    // 30,000 × 5.6% = 1,680 − 13,216 × 5.6% (740.10) = 939.90; reduction 690 − 3.56% × 4,430 = 532.29 → 407.61.
    expect(line(calcIncomeTax('CA', 30000, '2026', { region: 'BC' }), 'British Columbia income tax')).toBe(408);
  });

  it('Alberta $100,000: the new 8% first bracket to $61,200', () => {
    // 61,200 × 8% + 38,800 × 10% = 8,776 − 22,769 × 8% (1,821.52) = 6,954.48.
    expect(line(calcIncomeTax('CA', 100000, '2026', { region: 'AB' }), 'Alberta income tax')).toBe(6954);
  });

  it('Yukon $40,000: BPA credit plus the Canada employment amount credit', () => {
    // 40,000 × 6.4% = 2,560 − 16,452 × 6.4% (1,052.93) − 1,501 × 6.4% (96.06) = 1,411.01.
    expect(line(calcIncomeTax('CA', 40000, '2026', { region: 'YT' }), 'Yukon income tax')).toBe(1411);
  });

  it('New Brunswick 2025 applies the published low-income reduction; 2026 says its amounts are not published', () => {
    // 2025: 30,000 × 9.4% = 2,820 − 13,396 × 9.4% (1,259.22) = 1,560.78; reduction 802 − 3% × 8,080 = 559.60 → 1,001.18.
    // (Federal 2025 has a set, so the national year resolves.)
    expect(line(calcIncomeTax('CA', 30000, '2025', { region: 'NB' }), 'New Brunswick income tax')).toBe(1001);
    expect(calcIncomeTax('CA', 30000, '2026', { region: 'NB' })!.assumptions!.join(' ')).toMatch(/low-income tax reduction for 2026 is not published/);
  });

  it('Manitoba 2026 is unverified (sources conflict) and the result says so; its BPA phases out from $200,000', () => {
    const r = calcIncomeTax('CA', 300000, '2026', { region: 'MB' })!;
    expect(r.verified).toBe(false);
    expect(r.region!.verified).toBe(false);
    expect(r.assumptions!.some((a) => /conflict/i.test(a))).toBe(true);
    // 47,000 × 10.8% + 53,000 × 12.75% + 200,000 × 17.4% = 46,633.5; BPA 15,780 × ½ = 7,890 × 10.8% = 852.12.
    expect(line(r, 'Manitoba income tax')).toBe(Math.round(46633.5 - 852.12));
  });

  it('every province publishes 2025 and 2026 with a source, and the scheme names provincial tax in its scope', () => {
    for (const r of Object.values(INCOME_TAX_SCHEMES.CA!.regions!)) {
      expect(r.sets.map((s) => s.taxYearLabel)).toEqual(['2026', '2025']);
      for (const s of r.sets) expect(s.source).toMatch(/^https:\/\//);
    }
  });
});

describe('United States — states on top of federal (2026, single, federal standard deduction $16,100)', () => {
  it('Texas, Florida and the other no-wage-tax states add nothing, as a cited nil', () => {
    for (const code of ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY']) {
      const r = calcIncomeTax('US', 80000, '2026', { region: code })!;
      expect(r.totalTax).toBe(calcIncomeTax('US', 80000, '2026')!.totalTax);
      expect(r.region!.source).toMatch(/^https:\/\//);
      expect(getIncomeTaxRegionBands('US', code, '2026')).toEqual([]);
    }
    // Tennessee's nil is not re-read on the live page this time.
    expect(calcIncomeTax('US', 80000, '2026', { region: 'TN' })!.region!.verified).toBe(false);
    expect(calcIncomeTax('US', 80000, '2026', { region: 'TX' })!.region!.verified).toBe(true);
  });

  it('California 2026 is not published: the 2025 schedule is used, unverified, and the result says so', () => {
    // 100,000 − 5,706 = 94,294: 110.79 + 303.70 + 607.52 + 965.40 + 1,214.56 + 21,570 × 9.3% (2,006.01) = 5,207.98 − 153 = 5,054.98.
    const r = calcIncomeTax('US', 100000, '2026', { region: 'CA' })!;
    expect(line(r, 'California income tax')).toBe(5055);
    expect(r.region).toMatchObject({ code: 'CA', taxYear: '2025', verified: false });
    expect(r.verified).toBe(false);
    expect(r.assumptions!.some((a) => a.includes('California figures for 2026 are not on file'))).toBe(true);
  });

  it('New York $100,000 on the 2026 rates (standard deduction borrowed from 2025, so unverified)', () => {
    // 92,000: 331.50 + 140.80 + 113.30 + 66,750 × 5.4% (3,604.50) + 11,350 × 5.9% (669.65) = 4,859.75.
    const r = calcIncomeTax('US', 100000, '2026', { region: 'NY' })!;
    expect(line(r, 'New York income tax')).toBe(4860);
    expect(r.region!.verified).toBe(false);
    expect(r.assumptions!.join(' ')).toMatch(/New York City/);
  });

  it('Alabama deducts federal income tax and uses the AGI-based standard deduction', () => {
    // SD: AGI 50,000 → 3,000 − 25 × 49 < 2,500 → 2,500. Federal tax: 12,400 × 10% + 21,500 × 12% = 3,820.
    // 50,000 − 2,500 − 1,500 − 3,820 = 42,180: 10 + 100 + 39,180 × 5% (1,959) = 2,069.
    expect(line(calcIncomeTax('US', 50000, '2026', { region: 'AL' }), 'Alabama income tax')).toBe(2069);
  });

  it('Massachusetts adds the 4% surtax above $1,107,750 as its own line', () => {
    const r = calcIncomeTax('US', 2000000, '2026', { region: 'MA' })!;
    expect(line(r, 'Massachusetts income tax')).toBe(99780);
    expect(line(r, 'Massachusetts 4% surtax (income over $1,107,750)')).toBe(35514);
  });

  it('South Carolina 2026 uses the new 1.99% / 5.21% brackets and the income-adjusted deduction', () => {
    // SCIAD: 15,000 − floor(15,000 × 20,000 / 55,000 / 10) × 10 = 9,550; 50,450: 597 + 20,450 × 5.21% = 1,662.45.
    expect(line(calcIncomeTax('US', 60000, '2026', { region: 'SC' }), 'South Carolina income tax')).toBe(1662);
  });

  it('Wisconsin’s sliding standard deduction', () => {
    // SD 13,960 − 12% × 29,880 = 10,374.40; − 700 → 38,925.60: 528.85 + 23,815.60 × 4.4% = 1,576.74.
    expect(line(calcIncomeTax('US', 50000, '2026', { region: 'WI' }), 'Wisconsin income tax')).toBe(1577);
  });

  it('Connecticut: exemption phase-out and the Table E credit', () => {
    // Exemption 15,000 − 10 × 1,000 = 5,000 → 35,000: 200 + 25,000 × 4.5% = 1,325 × (1 − .10) = 1,192.5.
    expect(line(calcIncomeTax('US', 40000, '2026', { region: 'CT' }), 'Connecticut income tax')).toBe(1193);
  });

  it('Arkansas above $94,700 uses the DFA formula with its stepped adjustment', () => {
    // 100,000 − 2,470 = 97,530: 3.7% × 97,530 − (369.90 − 10 × 28) = 3,518.71 − 29 credit = 3,489.71.
    expect(line(calcIncomeTax('US', 100000, '2026', { region: 'AR' }), 'Arkansas income tax')).toBe(3490);
  });

  it('Iowa starts from federal taxable income', () => {
    // (60,000 − 16,100) × 3.8% = 1,668.20 − 40 = 1,628.20.
    expect(line(calcIncomeTax('US', 60000, '2026', { region: 'IA' }), 'Iowa income tax')).toBe(1628);
  });

  it('Pennsylvania is a flat 3.07% with no deduction, and says local EIT is excluded', () => {
    const r = calcIncomeTax('US', 60000, '2026', { region: 'PA' })!;
    expect(line(r, 'Pennsylvania income tax')).toBe(1842);
    expect(r.assumptions!.join(' ')).toMatch(/Local income taxes are NOT included/);
  });

  it('the marginal rate includes the state rate', () => {
    // Federal 12% bracket (taxable 43,900) + FICA 7.65% + NC 3.99%.
    expect(calcIncomeTax('US', 60000, '2026', { region: 'NC' })!.marginalRate).toBeCloseTo(0.12 + 0.0765 + 0.0399, 6);
  });

  it('Utah 2026 is unverified (credit base borrowed from 2025)', () => {
    // 4.45% × 50,000 = 2,225 − (6% × 16,100 − 1.3% × 31,787) = 2,225 − 552.77 = 1,672.23.
    const r = calcIncomeTax('US', 50000, '2026', { region: 'UT' })!;
    expect(line(r, 'Utah income tax')).toBe(1672);
    expect(r.region!.verified).toBe(false);
  });
});

describe('Scotland — Scottish bands replace the rUK bands, never added to them', () => {
  it('£50,000 in 2026-27: starter to higher bands; NI and the personal allowance unchanged', () => {
    // Taxable 37,430: 3,967 × 19% + 12,989 × 20% + 14,136 × 21% + 6,338 × 42% = 8,982.05.
    const sct = calcIncomeTax('GB', 50000, '2026-27', { region: 'SCT' })!;
    const ruk = calcIncomeTax('GB', 50000, '2026-27')!;
    expect(sct.taxable).toBe(ruk.taxable);
    expect(sct.incomeTax).toBe(8982);
    expect(ruk.incomeTax).toBe(7486);
    expect(line(sct, 'National Insurance')).toBe(line(ruk, 'National Insurance'));
    expect(sct.region).toMatchObject({ code: 'SCT', name: 'Scotland', taxYear: '2026-27', verified: true });
  });

  it('£130,000: the personal allowance is fully tapered and the top 48% rate applies above £125,140', () => {
    // 753.73 + 2,597.80 + 2,968.56 + 31,338 × 42% + 62,710 × 45% + 4,860 × 48% = 50,034.35.
    expect(calcIncomeTax('GB', 130000, '2026-27', { region: 'SCT' })!.incomeTax).toBe(50034);
  });

  it('2025-26 uses the 2025-26 Scottish bands', () => {
    // Taxable 17,430: 2,827 × 19% + 12,094 × 20% + 2,509 × 21% = 3,482.82.
    expect(calcIncomeTax('GB', 30000, '2025-26', { region: 'SCT' })!.incomeTax).toBe(3483);
  });

  it('getIncomeTaxBands returns the Scottish bands for a Scottish taxpayer', () => {
    expect(getIncomeTaxBands('GB', '2026-27', 'SCT').map((b) => b.rate)).toEqual([0.19, 0.2, 0.21, 0.42, 0.45, 0.48]);
    expect(getIncomeTaxBands('GB', '2026-27').map((b) => b.rate)).toEqual([0.2, 0.4, 0.45]);
  });
});
