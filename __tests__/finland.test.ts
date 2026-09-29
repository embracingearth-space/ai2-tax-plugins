/**
 * Finland — wage tax, municipalities and capital gains. embracingearth.space
 *
 * THE ANCHORS ARE THE AUTHORITY'S OWN. Verohallinto publishes, each year, what
 * the tax card withholds at eight wage levels for a Helsinki resident aged
 * 17–64 who belongs to the Evangelical Lutheran church ("Esimerkkejä palkan,
 * eläkkeen ja etuuden veroprosenteista"). Every row is reproduced here to the
 * CENT, for 2025 and 2026, together with the published tax-card rate. A model
 * that is right on average but a cent out somewhere is modelling a different
 * rounding convention from the assessment's — that is exactly how the
 * per-component cent rounding in finnishWageTax was found.
 *
 * 2026: https://www.vero.fi/henkiloasiakkaat/verokortti-ja-veroilmoitus/tulot/ansiotulot/palkan-el%C3%A4kkeen-ja-etuuden-veroprosentit/
 * 2025: the same page as published for 2025 (updated 23.11.2024), read from
 *       the Internet Archive snapshot of 3.8.2025 because vero.fi now shows 2026.
 *
 * A SECOND, INDEPENDENT CHECK covers what Vero's examples leave out (the
 * employee pension and unemployment contributions): the Finnish Taxpayers'
 * Association's tables of total tax and contributions, which use its own
 * income-weighted averages (7.57% municipal, 1.38% church for 2026; 7.54% and
 * 1.38% for 2025). Secondary source, so matched to the euro it publishes.
 * https://www.veronmaksajat.fi/tutkimus-ja-tilastot/tuloverot/palkansaajan-veroprosentit/
 */
import {
  calcIncomeTax,
  getIncomeTaxScheme,
  getIncomeTaxYears,
  getCompanyTaxRate,
  finnishWageTax,
  finnishTaxCardRate,
  finnishMunicipalities,
  findFinnishMunicipality,
  finnishCapitalGainTax,
  resolveFinnishYear,
  FI_EARNED_INCOME_YEARS,
  FI_MUNICIPAL_RATES_SOURCE,
  FI_MUNICIPALITY_ALIASES,
  FI_ALAND_MUNICIPALITIES,
} from '../src';

const year = (y: string) => resolveFinnishYear(y)!;
const helsinki = (y: string) => {
  const h = findFinnishMunicipality('Helsinki', y)!;
  return { localTaxRate: h.municipalRate, churchTaxRate: h.evangelicalLutheranRate, age: 40 };
};

describe("Verohallinto's published wage examples, to the cent", () => {
  // [gross, tax on pay (€), tax-card rate (%)]
  const VERO: Record<string, [number, number, number][]> = {
    '2026': [
      [10000, 0, 0], [16000, 2.5, 0.5], [20000, 278.5, 1.5], [30000, 2530.49, 8.5],
      [40000, 5511.99, 14.0], [50000, 9361.96, 19.0], [60000, 13244.84, 22.5], [70000, 17415.6, 25.0],
    ],
    '2025': [
      [10000, 0, 0], [16000, 2.5, 0.5], [20000, 270.5, 1.5], [30000, 2967.23, 10.0],
      [40000, 6183.08, 15.5], [50000, 10009.13, 20.5], [60000, 13950.51, 23.5], [70000, 18159.64, 26.0],
    ],
  };
  for (const [taxYear, rows] of Object.entries(VERO)) {
    for (const [gross, tax, rate] of rows) {
      it(`${taxYear}: ${gross} € in Helsinki → ${tax} € and a ${rate}% tax card`, () => {
        const b = finnishWageTax(gross, year(taxYear), helsinki(taxYear));
        expect(b.taxCardTotal).toBe(tax);
        expect(finnishTaxCardRate(b)).toBe(rate);
      });
    }
  }
});

describe("the Taxpayers' Association tables, contributions included (secondary)", () => {
  const VMK: Record<string, { municipal: number; church: number; rows: [number, number][] }> = {
    '2026': {
      municipal: 0.0757, church: 0.0138,
      rows: [[16000, 1313], [20000, 2013], [30000, 5684], [40000, 9732], [50000, 14642], [60000, 19585], [70000, 24815], [80000, 30046], [100000, 40508], [150000, 66661]],
    },
    '2025': {
      municipal: 0.0754, church: 0.0138,
      rows: [[20000, 2175], [30000, 5987], [40000, 10218], [50000, 15057], [60000, 20012], [70000, 25235], [100000, 41094]],
    },
  };
  for (const [taxYear, t] of Object.entries(VMK)) {
    for (const [gross, total] of t.rows) {
      it(`${taxYear}: ${gross} € → ${total} € of tax and contributions`, () => {
        const b = finnishWageTax(gross, year(taxYear), { localTaxRate: t.municipal, churchTaxRate: t.church, age: 40 });
        expect(Math.round(b.totalDeductions)).toBe(total);
      });
    }
  }
});

describe('the pieces, against the worked examples in Vero guidance VH/271/00.01.00/2026', () => {
  it('earned-income credit at 42 510 € of net earned income: 3 430 − 150.20 = 3 279.80 €', () => {
    const b = finnishWageTax(43260, year('2026'));
    expect(b.netEarnedIncome).toBe(42510);
    expect(b.workCredit).toBe(3279.8);
  });

  it('2026 credit stops shrinking at 50 550 €: 3 430 − 311 = 3 119 € at any higher income', () => {
    expect(finnishWageTax(60000, year('2026')).workCredit).toBe(3119);
    expect(finnishWageTax(250000, year('2026')).workCredit).toBe(3119);
  });

  it('2025 credit still phased out entirely at high incomes (the second phase-out 2026 removed)', () => {
    expect(finnishWageTax(250000, year('2025')).workCredit).toBe(0);
  });

  it('the daily-allowance contribution is a cliff: nil below the threshold, on ALL wages at it', () => {
    const y = year('2026');
    expect(finnishWageTax(17254, y).dailyAllowance).toBe(0);
    expect(finnishWageTax(17255, y).dailyAllowance).toBe(151.84); // 0.88% of 17 255
  });

  it('YLE tax: nil to 15 150 € of net income, 2.5% above, capped at 160 €', () => {
    const y = year('2026');
    expect(finnishWageTax(15900, y).yleTax).toBe(0); // net 15 150
    expect(finnishWageTax(16900, y).yleTax).toBe(25); // net 16 150
    expect(finnishWageTax(90000, y).yleTax).toBe(160);
  });

  it('the credit reduces state, municipal, church and medical-care tax — never YLE or the daily allowance', () => {
    // At 20 000 € the credit (3 430) exceeds every tax it can reduce, so what
    // is left on the tax card is exactly YLE tax plus the daily allowance.
    const b = finnishWageTax(20000, year('2026'), helsinki('2026'));
    expect(b.workCreditUsed).toBeLessThan(b.workCredit);
    expect(b.taxCardTotal).toBe(Math.round((b.yleTax + b.dailyAllowance) * 100) / 100);
  });
});

describe('age rules', () => {
  it('2025 applied the higher 8.65% pension rate from 53 to 62; 2026 has one rate', () => {
    expect(finnishWageTax(50000, year('2025'), { age: 55 }).pensionRate).toBe(0.0865);
    expect(finnishWageTax(50000, year('2025'), { age: 40 }).pensionRate).toBe(0.0715);
    expect(finnishWageTax(50000, year('2026'), { age: 55 }).pensionRate).toBe(0.073);
  });

  it('no unemployment contribution after 64, and a 1 200 € larger credit once 65 before the year', () => {
    const at66 = finnishWageTax(40000, year('2026'), { age: 66 });
    expect(at66.unemployment).toBe(0);
    expect(at66.workCredit).toBe(finnishWageTax(40000, year('2026'), { age: 40 }).workCredit + 1200);
    // 65 at year end means 64 when the year began — no increase yet.
    expect(finnishWageTax(40000, year('2026'), { age: 65 }).workCredit).toBe(finnishWageTax(40000, year('2026'), { age: 40 }).workCredit);
  });

  it('the pension obligation ends at 70 for someone born in 1962 or later', () => {
    expect(finnishWageTax(40000, year('2026'), { age: 64 }).pension).toBeGreaterThan(0);
    // born 1956 → upper age 68
    expect(finnishWageTax(40000, year('2026'), { age: 70 }).pension).toBe(0);
  });
});

describe('municipalities', () => {
  it('holds all 308 municipalities for both years, from the decisions it cites', () => {
    expect(finnishMunicipalities('2026')).toHaveLength(308);
    expect(finnishMunicipalities('2025')).toHaveLength(308);
    expect(FI_MUNICIPAL_RATES_SOURCE['2026']!.decision).toBe('VH/6585/00.01.00/2025');
    expect(finnishMunicipalities('2027')).toEqual([]);
  });

  it('has the published rates for the big cities', () => {
    const r = (n: string) => findFinnishMunicipality(n, '2026')!.municipalRate;
    expect(r('Helsinki')).toBe(0.053);
    expect(r('Espoo')).toBe(0.053);
    expect(r('Vantaa')).toBe(0.064);
    expect(r('Tampere')).toBe(0.076);
    expect(r('Turku')).toBe(0.071);
    expect(r('Oulu')).toBe(0.081);
    expect(r('Kauniainen')).toBe(0.047); // the lowest in mainland Finland
  });

  it('every Swedish-name alias points at a municipality that exists in both years', () => {
    for (const [alias, target] of Object.entries(FI_MUNICIPALITY_ALIASES)) {
      for (const y of ['2025', '2026']) {
        expect(finnishMunicipalities(y).some((m) => m.name === target)).toBe(true);
        expect(findFinnishMunicipality(alias, y)!.name).toBe(target);
      }
    }
    expect(FI_ALAND_MUNICIPALITIES.every((a) => finnishMunicipalities('2026').some((m) => m.name === a))).toBe(true);
  });

  it('finds a municipality by its Swedish name, and without diacritics', () => {
    expect(findFinnishMunicipality('Helsingfors', '2026')!.name).toBe('Helsinki');
    expect(findFinnishMunicipality('Åbo', '2026')!.name).toBe('Turku');
    expect(findFinnishMunicipality('Pargas', '2026')!.name).toBe('Parainen');
    expect(findFinnishMunicipality('Närpes', '2026')!.name).toBe('Närpiö');
    expect(findFinnishMunicipality('jyvaskyla', '2026')!.name).toBe('Jyväskylä');
    expect(findFinnishMunicipality('  HÄMEENLINNA ', '2026')!.name).toBe('Hämeenlinna');
    expect(findFinnishMunicipality('Atlantis', '2026')).toBeNull();
  });

  it('marks the sixteen Åland municipalities, and refuses to apply mainland arithmetic to them', () => {
    const aland = finnishMunicipalities('2026').filter((m) => m.aland);
    expect(aland).toHaveLength(16);
    expect(aland.every((m) => m.municipalRate > 0.15)).toBe(true);
    expect(finnishMunicipalities('2026').filter((m) => !m.aland).every((m) => m.municipalRate < 0.12)).toBe(true);
    expect(() => finnishWageTax(40000, year('2026'), { localTaxRate: findFinnishMunicipality('Mariehamn', '2026')!.municipalRate })).toThrow(/Åland/);
  });
});

describe('through the shared income-tax interface', () => {
  it('lists 2026 and 2025, current by the Helsinki calendar', () => {
    expect(getIncomeTaxYears('FI').map((y) => y.value)).toEqual(['2026', '2025']);
  });

  it('defaults to the published average municipal rate and says so', () => {
    const r = calcIncomeTax('FI', 50000, '2026')!;
    expect(r.levies.find((l) => l.name.startsWith('Municipal tax'))!.name).toContain('7.6%');
    expect(r.assumptions!.join(' ')).toMatch(/national average of 7\.6%/);
    expect(r.levies.some((l) => l.name.startsWith('Church tax'))).toBe(false);
  });

  it('whole-euro totals agree with the cent-exact breakdown', () => {
    for (const gross of [0, 12000, 17255, 30000, 50550, 75000, 150000]) {
      const opts = helsinki('2026');
      const r = calcIncomeTax('FI', gross, '2026', opts)!;
      const b = finnishWageTax(gross, year('2026'), opts);
      expect(Math.abs(r.totalTax - b.totalDeductions)).toBeLessThanOrEqual(3); // seven whole-euro line items
      expect(r.incomeTax).toBe(Math.round(b.stateTax));
    }
  });

  it('the marginal rate at 50 000 € in Helsinki is about 48%, and never exceeds the official ~52% cap region', () => {
    const r = calcIncomeTax('FI', 50000, '2026', helsinki('2026'))!;
    expect(r.marginalRate).toBeCloseTo(0.4803, 3);
    const top = calcIncomeTax('FI', 200000, '2026', { localTaxRate: 0.076, churchTaxRate: 0.0138 })!;
    expect(top.marginalRate).toBeGreaterThan(0.5);
    expect(top.marginalRate).toBeLessThan(0.54);
  });

  it('rejects a rate written as a percentage instead of a fraction', () => {
    expect(() => calcIncomeTax('FI', 50000, '2026', { localTaxRate: 5.3 })).toThrow(RangeError);
    expect(() => calcIncomeTax('FI', 50000, '2026', { age: 40.5 })).toThrow(RangeError);
  });

  it('finnishWageTax validates its own options when called directly', () => {
    const y = resolveFinnishYear('2026')!;
    expect(() => finnishWageTax(50000, y, { churchTaxRate: 1.8 })).toThrow(/churchTaxRate must be a fraction/);
    expect(() => finnishWageTax(50000, y, { localTaxRate: 5.3 })).toThrow(/localTaxRate must be a fraction/);
    expect(() => finnishWageTax(50000, y, { localTaxRate: NaN })).toThrow(RangeError);
    expect(() => finnishWageTax(50000, y, { localTaxRate: -0.05 })).toThrow(RangeError);
    expect(() => finnishWageTax(50000, y, { age: 40.5 })).toThrow(/age/);
  });

  it('ignores options for a country that does not read them', () => {
    expect(calcIncomeTax('AU', 90000, '2025-26', { localTaxRate: 5.3 })!.totalTax).toBe(calcIncomeTax('AU', 90000, '2025-26')!.totalTax);
  });

  it('offers every mainland municipality as a preset, and no Åland one', () => {
    const presets = getIncomeTaxScheme('FI')!.localTaxRates!['2026']!;
    expect(presets).toHaveLength(292);
    expect(presets.find((p) => p.name === 'Helsinki')!.rate).toBe(0.053);
    expect(presets.some((p) => p.name === 'Maarianhamina')).toBe(false);
  });

  it('holds no 2027 year until its scale is enacted', () => {
    expect(FI_EARNED_INCOME_YEARS.map((y) => y.taxYear)).not.toContain('2027');
    expect(calcIncomeTax('FI', 50000, '2027')).toBeNull();
  });
});

describe('capital gains', () => {
  it('uses the deemed acquisition cost when it beats the actual cost (20% under 10 years)', () => {
    const r = finnishCapitalGainTax({ proceeds: 10000, acquisitionCost: 1000, taxYear: '2026' })!;
    expect(r.method).toBe('deemed');
    expect(r.costDeducted).toBe(2000);
    expect(r.gain).toBe(8000);
    expect(r.tax).toBeCloseTo(2400, 6); // 30%
  });

  it('40% deemed cost after 10 years', () => {
    const r = finnishCapitalGainTax({ proceeds: 10000, acquisitionCost: 1000, yearsHeld: 12, taxYear: '2026' })!;
    expect(r.costDeducted).toBe(4000);
    expect(r.tax).toBeCloseTo(1800, 6);
  });

  it('actual cost plus expenses when that is larger', () => {
    const r = finnishCapitalGainTax({ proceeds: 10000, acquisitionCost: 7000, saleExpenses: 100, taxYear: '2026' })!;
    expect(r.method).toBe('actual');
    expect(r.gain).toBe(2900);
  });

  it('34% on the part of capital income above 30 000 €', () => {
    const r = finnishCapitalGainTax({ proceeds: 100000, acquisitionCost: 60000, otherCapitalIncome: 10000, taxYear: '2026' })!;
    // 40 000 gain on top of 10 000 → 20 000 at 30% + 20 000 at 34%
    expect(r.tax).toBeCloseTo(6000 + 6800, 6);
  });

  it('the 1 000 € rule: gains are tax-free when the year’s sale prices total 1 000 € or less', () => {
    expect(finnishCapitalGainTax({ proceeds: 1000, acquisitionCost: 100, taxYear: '2026' })!.tax).toBe(0);
    expect(finnishCapitalGainTax({ proceeds: 1000, acquisitionCost: 100, totalProceedsThisYear: 1500, taxYear: '2026' })!.tax).toBeGreaterThan(0);
  });

  it('a loss only ever comes from the actual cost, and is not deductible inside the 1 000 € rule', () => {
    const small = finnishCapitalGainTax({ proceeds: 500, acquisitionCost: 900, taxYear: '2026' })!;
    expect(small.loss).toBe(400);
    expect(small.lossDeductible).toBe(false);
    const big = finnishCapitalGainTax({ proceeds: 5000, acquisitionCost: 9000, taxYear: '2026' })!;
    expect(big.loss).toBe(4000);
    expect(big.lossDeductible).toBe(true);
    expect(big.tax).toBe(0);
  });

  it('applies losses before tax, and refuses nonsense', () => {
    const r = finnishCapitalGainTax({ proceeds: 20000, acquisitionCost: 10000, capitalLosses: 3000, taxYear: '2026' })!;
    expect(r.lossesApplied).toBe(3000);
    expect(r.taxableGain).toBe(7000);
    expect(() => finnishCapitalGainTax({ proceeds: -1, acquisitionCost: 0 })).toThrow(RangeError);
    // Required fields left out by a JS or MCP caller must throw, not return NaN.
    expect(() => finnishCapitalGainTax({ proceeds: 5000 } as never)).toThrow(/acquisitionCost/);
    expect(() => finnishCapitalGainTax({ acquisitionCost: 5000 } as never)).toThrow(/proceeds/);
    expect(() => finnishCapitalGainTax({ proceeds: 5000, acquisitionCost: 0, totalProceedsThisYear: 100 })).toThrow(RangeError);
    expect(finnishCapitalGainTax({ proceeds: 5000, acquisitionCost: 0, taxYear: '2019' })).toBeNull();
  });
});

describe('company tax', () => {
  it('is a flat 20%, with no small-company rate', () => {
    const r = getCompanyTaxRate('FI', new Date('2026-06-30'), { preferSmallRate: true })!;
    expect(r.rate).toBe(0.2);
    expect(r.usedSmallRate).toBe(false);
    expect(r.note).toMatch(/proposed.*18%/);
  });

  it('was 24.5% in 2013, before the cut to 20%', () => {
    expect(getCompanyTaxRate('FI', new Date('2013-12-31'))!.rate).toBe(0.245);
    expect(getCompanyTaxRate('FI', new Date('2014-01-01'))!.rate).toBe(0.2);
  });
});
