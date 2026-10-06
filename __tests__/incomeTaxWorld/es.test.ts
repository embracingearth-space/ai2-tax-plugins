/**
 * Spain — IRPF state half + autonomous-community half. embracingearth.space
 */
import { calcIncomeTax } from '../../src';
import { ES_STATE_BANDS, ES_STATE_MINIMO } from '../../src/data/incomeTaxWorld/es';
import { progressive } from '../../src/data/incomeTaxMath';

const credits = (r: ReturnType<typeof calcIncomeTax>) => r!.offsets.reduce((s, o) => s + o.amount, 0);
const regional = (r: ReturnType<typeof calcIncomeTax>) => r!.levies.find((l) => l.name.startsWith('IRPF regional half'))?.amount ?? 0;

describe('Spain — official AEAT example', () => {
  it('official: state cuota 2,140.50 on base liquidable 23,900 with mínimo 5,550 (AEAT Manual Renta 2025, cap. 15)', () => {
    // https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c15-calculo-impuesto-determinacion-cuotas-integras/ejemplo-practico-calculo-cuotas-integras-autonomica.html
    // (2,112.75 + 3,700 × 15%) − 5,550 × 9.5% = 2,667.75 − 527.25 = 2,140.50
    expect(progressive(23900, ES_STATE_BANDS) - progressive(ES_STATE_MINIMO, ES_STATE_BANDS)).toBeCloseTo(2140.5, 6);
  });
});

describe('Spain — state half, 2026 (derived from the official formula — not an official example)', () => {
  it('€30,000: SS 6.5% (1,950), no art. 20 reduction, 2,000 otros gastos → base 26,050', () => {
    const r = calcIncomeTax('ES', 30000, '2026')!;
    expect(r.taxable).toBe(26050);
    // 12,450 × 9.5% + 7,750 × 12% + 5,850 × 15% = 1,182.75 + 930 + 877.50 = 2,990.25
    expect(r.incomeTax).toBe(2990);
    // mínimo: 5,550 × 9.5% = 527.25; DA 61 nil above 20,048.45
    expect(credits(r)).toBe(527);
    expect(r.totalTax).toBe(2463);
    expect(r.verified).toBe(true);
  });

  it('€20,000: art. 20 in its second taper and DA 61 almost phased out', () => {
    const r = calcIncomeTax('ES', 20000, '2026')!;
    // SS 1,300; RNT 18,700 → 2,364.34 − 1.14 × 1,026.48 = 1,194.15; base 20,000 − 1,300 − 1,194.15 − 2,000 = 15,505.85
    expect(r.taxable).toBeCloseTo(15505.85, 1);
    // 1,182.75 + 3,055.85 × 12% = 1,549.45
    expect(r.incomeTax).toBe(1549);
    // mínimo 527 + DA 61: 590.89 − 0.2 × (20,000 − 17,094) = 9.69 → 10
    expect(credits(r)).toBe(537);
    expect(r.totalTax).toBe(1012);
  });

  it('€15,000: full art. 20 reduction (7,302) — the mínimo absorbs the whole state cuota', () => {
    const r = calcIncomeTax('ES', 15000, '2026')!;
    // 15,000 − 975 − 7,302 − 2,000 = 4,723 (below the mínimo)
    expect(r.taxable).toBe(4723);
    expect(r.totalTax).toBe(0);
  });

  it('2025 uses SS 6.48% and the 2025 DA 61 (nil above 18,276)', () => {
    const r = calcIncomeTax('ES', 30000, '2025')!;
    // 30,000 − 1,944 − 2,000 = 26,056; 2,990.25 + 6 × 15% = 2,991.15
    expect(r.taxable).toBe(26056);
    expect(r.incomeTax).toBe(2991);
    expect(r.totalTax).toBe(2991 - 527);
  });

  it('top-band edge: tax on base 300,000 and the 24.5% rate above it', () => {
    // 1,182.75 + 930 + 2,250 + 4,588 + 240,000 × 22.5% = 62,950.75
    expect(progressive(300000, ES_STATE_BANDS)).toBeCloseTo(62950.75, 6);
    expect(progressive(300100, ES_STATE_BANDS) - progressive(300000, ES_STATE_BANDS)).toBeCloseTo(24.5, 6);
  });

  it('says it is the state half only and that social contributions are not included', () => {
    const a = calcIncomeTax('ES', 30000, '2026')!.assumptions!.join(' ');
    expect(a).toMatch(/STATE half/);
    expect(a).toMatch(/social-security contributions/);
  });
});

describe('Spain — autonomous communities (derived from the official formula — not an official example)', () => {
  it('Madrid 2026 on base 26,050: scale minus scale on 5,956.65', () => {
    const r = calcIncomeTax('ES', 30000, '2026', { region: 'MD' })!;
    // 13,362.22 × 8.5% + 5,642.41 × 10.7% + 7,045.37 × 12.8% = 2,641.33; − 5,956.65 × 8.5% (506.32) = 2,135.02
    expect(regional(r)).toBe(2135);
    expect(r.totalTax).toBe(2463 + 2135);
    expect(r.region!.verified).toBe(true);
  });

  it('Cataluña and Andalucía 2025 on base 26,056', () => {
    // CT: 12,500 × 9.5% + 9,500 × 12.5% + 4,056 × 16% = 1,187.5 + 1,187.5 + 648.96 = 3,023.96; − 527.25 = 2,496.71
    expect(regional(calcIncomeTax('ES', 30000, '2025', { region: 'CT' }))).toBe(2497);
    // AN: 13,000 × 9.5% + 8,100 × 12% + 4,956 × 15% = 1,235 + 972 + 743.40 = 2,950.40; − 5,790 × 9.5% (550.05) = 2,400.35
    expect(regional(calcIncomeTax('ES', 30000, '2025', { region: 'ES-AN' }))).toBe(2400);
  });

  it('DA 61 that the state half cannot absorb reduces the regional half (€17,094, 2026)', () => {
    // base ≈ 8,659.95; state cuota 822.70 − 527.25 = 295.45; DA 61 590.89 leaves ≈ 295 for the region.
    // Madrid cuota 8,659.95 × 8.5% − 506.32 = 229.78 < 295 → nil.
    const r = calcIncomeTax('ES', 17094, '2026', { region: 'MD' })!;
    expect(r.totalTax).toBe(0);
  });

  it('without a region the result is national-only', () => {
    expect(calcIncomeTax('ES', 30000, '2026')!.region).toBeUndefined();
  });
});
