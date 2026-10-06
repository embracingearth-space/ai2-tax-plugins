/**
 * Sweden — municipal and state income tax on earned income, employee under 66.
 * @ai2/tax-plugins — embracingearth.space
 *
 * Only 2026 is encoded. Skatteverket's 2026 technical description (SKV 433,
 * utgåva 36) gives the grundavdrag and jobbskatteavdrag FORMULAS; for 2025 the
 * research has only the published end-points (max/min), not the formulas, and
 * SKV 433 says the 2026 calculation changed, so 2025 is left out rather than
 * borrowed.
 *
 * Order (SKV 433, 2026; PBB = prisbasbelopp 59,200):
 *   taxable = earned income − grundavdrag (rounded UP to 100, never > income)
 *   state tax = 20% of taxable above the skiktgräns 643,000 (the bands)
 *   municipal tax = KI × taxable, KI = municipal + regional rate (default:
 *     Skatteverket's national average 32.38%)
 *   tax reductions: jobbskatteavdrag and the reduction for earned income
 *     (against municipal tax), taken off inside the municipal levy because
 *     the engine cannot credit against a levy.
 * The 7% general pension fee and the equal tax reduction that offsets it are
 * BOTH left out: they cancel for normal earners and the fee is a social
 * contribution (out of scope), so the result matches payslip withholding net
 * of the fee. At very low incomes, where the statutory reduction order would
 * leave less room for the jobbskatteavdrag, this can show a little tax that
 * the fee's reduction would have absorbed.
 */
import type { CountryIncomeTaxData, IncomeTaxYearData } from '../incomeTaxFactory';
import type { MoneyRounding } from '../incomeTax';

const PBB = 59200;
const AVERAGE_MUNICIPAL_2026 = 0.3238;

const ceil100 = (n: number, q: MoneyRounding) => -q.floor(-n / 100) * 100;

/** Grundavdrag, under 66 (SKV 433 2026 §5). */
export function grundavdrag2026(ffi: number, q: MoneyRounding): number {
  let ga: number;
  if (ffi <= 0.99 * PBB) ga = 0.423 * PBB;
  else if (ffi <= 2.72 * PBB) ga = 0.423 * PBB + 0.2 * (ffi - 0.99 * PBB);
  else if (ffi <= 3.11 * PBB) ga = 0.77 * PBB;
  else if (ffi <= 7.88 * PBB) ga = 0.77 * PBB - 0.1 * (ffi - 3.11 * PBB);
  else ga = 0.293 * PBB;
  return Math.min(Math.max(0, ffi), ceil100(ga, q));
}

/** Jobbskatteavdrag, under 66 (SKV 433 2026). ki = municipal rate excl. burial/church fee. */
export function jobbskatteavdrag2026(ai: number, ga: number, ki: number): number {
  let x: number;
  if (ai <= 0.91 * PBB) x = ai;
  else if (ai <= 3.24 * PBB) x = 0.91 * PBB + 0.3874 * (ai - 0.91 * PBB);
  else if (ai <= 8.08 * PBB) x = 1.813 * PBB + 0.251 * (ai - 3.24 * PBB);
  else x = 3.027 * PBB;
  return Math.max(0, x - ga) * ki;
}

/** Skattereduktion för förvärvsinkomst: 0.75% of taxable earned income over 40,000, max 1,500. */
const earnedIncomeReduction = (taxable: number) => Math.min(Math.max(0, taxable - 40000) * 0.0075, 1500);


const Y2026: IncomeTaxYearData = {
  taxYear: '2026',
  effectiveFrom: '2026-01-01',
  bands: [
    { upTo: 643000, rate: 0 },
    { upTo: null, rate: 0.2 },
  ],
  deductions: [{ kind: 'custom', name: 'Basic deduction (grundavdrag)', amount: ({ gross, q }) => grundavdrag2026(gross, q) }],
  levies: [
    {
      kind: 'custom',
      name: 'Municipal income tax (kommunalskatt) after tax reductions',
      amount: ({ gross, taxable, q, options }) => {
        const ki = options.localTaxRate ?? AVERAGE_MUNICIPAL_2026;
        const municipal = q.round(ki * taxable);
        const ga = gross - taxable;
        return Math.max(0, municipal - jobbskatteavdrag2026(gross, ga, ki) - earnedIncomeReduction(taxable));
      },
    },
  ],
  source: 'https://www.skatteverket.se/privat/skatter/beloppochprocent/2026.4.1522bf3f19aea8075ba21.html',
  authorityName: 'Skatteverket',
  citationDate: '2026-10-06',
  verified: true,
};

export const SE_INCOME_TAX: CountryIncomeTaxData = {
  code: 'SE',
  country: 'Sweden',
  currency: 'SEK',
  locale: 'sv-SE',
  timeZone: 'Europe/Stockholm',
  file: 'src/data/incomeTaxWorld/se.ts',
  note: 'Employee under 66: municipal + regional income tax at the national average rate (or a passed local rate) and 20% state tax above the skiktgräns, after the grundavdrag, less the jobbskatteavdrag and the reduction for earned income. Excludes the 7% general pension contribution together with the equal tax reduction that offsets it, the burial fee, the Church of Sweden fee and the public service fee. 2026 only.',
  assumptions: [
    'Single, no children, under 66 at the start of the year, resident, wage income only.',
    'Municipal + regional tax at the 2026 national average of 32.38% published by Skatteverket unless a local rate is passed.',
    'The general pension contribution (allmän pensionsavgift, 7%) is a social contribution and is not included, and neither is the equal tax reduction that offsets it; for normal earners the two cancel, so the tax shown matches withholding net of the fee.',
    'Burial fee (begravningsavgift), Church of Sweden fee and public service fee are not included; employer contributions are employer-side.',
    'Municipal tax is shown net of the jobbskatteavdrag and the reduction for earned income.',
  ],
  optionsSupported: ['localTaxRate'],
  defaultLocalTaxRate: () => AVERAGE_MUNICIPAL_2026,
  years: [Y2026],
};
