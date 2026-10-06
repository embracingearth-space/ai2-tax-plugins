/**
 * Brazil — IRPF on salary, annual adjustment (Declaração de Ajuste Anual),
 * single resident employee. @ai2/tax-plugins — embracingearth.space
 *
 * Base = gross − the larger of (a) the employee INSS contributions (legal
 * deduction) and (b) the simplified discount (20% of taxable income, capped:
 * BRL 17,640.00 for ano-calendário 2026, BRL 16,754.34 for 2025 — Lei 9.250
 * art. 10). The annual table is applied to that base.
 *
 * 2026 (Lei 15.270/2025, art. 11-A): an annual tax REDUCTION on taxable income
 * (rendimentos tributáveis, i.e. gross — not the base after deductions): up to
 * BRL 2,694.15 (so the tax is zero) up to BRL 60,000; BRL 8,429.73 − 0.095575 ×
 * income from 60,000.01 to 88,200; nothing above. Limited to the table tax.
 *
 * 2025: INSS 2025 rests on a private reproduction of the DOU (not verified), so
 * it is NOT deducted; only the simplified discount is applied.
 */
import type { CountryIncomeTaxData, DeductionRule } from '../incomeTaxFactory';

/** Monthly INSS employee contribution, progressive per band, nothing above the teto. */
const inssMonthly2026 = (m: number): number => {
  const edges: readonly (readonly [number, number])[] = [
    [1621.0, 0.075],
    [2902.84, 0.09],
    [4354.27, 0.12],
    [8475.55, 0.14],
  ];
  let lower = 0;
  let total = 0;
  for (const [upTo, rate] of edges) {
    if (m <= lower) break;
    total += (Math.min(m, upTo) - lower) * rate;
    lower = upTo;
  }
  return total;
};

const simplified = (gross: number, cap: number): number => Math.min(gross * 0.2, cap);

export const BR_INCOME_TAX: CountryIncomeTaxData = {
  code: 'BR',
  country: 'Brazil',
  currency: 'BRL',
  locale: 'pt-BR',
  timeZone: 'America/Sao_Paulo',
  file: 'src/data/incomeTaxWorld/br.ts',
  note: 'Single resident employee: federal IRPF on the annual adjustment table after the larger of the INSS employee contributions (2026 only) and the simplified discount, less the 2026 Lei 15.270 reduction. Excludes the 13th salary (taxed separately), dependants and itemised deductions, the high-income minimum tax (IRPFM), and INSS itself as a charge.',
  assumptions: [
    'Single resident employee, no dependants, wage income only, paid the same salary in each of 12 months; the 13th salary (exclusive taxation) is not part of the input.',
    'The annual adjustment result is shown; monthly withholding (IRRF) uses the monthly table and monthly reduction and can differ.',
    'INSS employee social-security contributions are not included as a charge.',
    'The minimum tax on high incomes (IRPFM, Lei 15.270/2025) for income above BRL 600,000 is not modelled.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: [
        { upTo: 29145.6, rate: 0 },
        { upTo: 33919.8, rate: 0.075 },
        { upTo: 45012.6, rate: 0.15 },
        { upTo: 55976.16, rate: 0.225 },
        { upTo: null, rate: 0.275 },
      ],
      deductions: [
        {
          kind: 'custom',
          name: 'INSS contributions or simplified discount (the larger)',
          amount: ({ gross }) => Math.max(12 * inssMonthly2026(gross / 12), simplified(gross, 17640)),
        } satisfies DeductionRule,
      ],
      credits: [
        {
          kind: 'custom',
          name: 'Redução do imposto (Lei 15.270/2025)',
          amount: ({ gross, incomeTax }) => {
            if (gross <= 60000) return Math.min(2694.15, incomeTax);
            if (gross <= 88200) return Math.max(0, 8429.73 - 0.095575 * gross);
            return 0;
          },
        },
      ],
      source: 'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026',
      authorityName: 'Receita Federal do Brasil',
      citationDate: '2026-10-06',
      verified: true,
      assumptions: ['INSS employee contributions (2026 INSS table, monthly, up to the teto of BRL 8,475.55) are deducted when larger than the simplified discount.'],
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: [
        { upTo: 28467.2, rate: 0 },
        { upTo: 33919.8, rate: 0.075 },
        { upTo: 45012.6, rate: 0.15 },
        { upTo: 55976.16, rate: 0.225 },
        { upTo: null, rate: 0.275 },
      ],
      deductions: [{ kind: 'custom', name: 'Simplified discount (20%, capped)', amount: ({ gross }) => simplified(gross, 16754.34) }],
      source: 'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2025',
      authorityName: 'Receita Federal do Brasil',
      citationDate: '2026-10-06',
      verified: true,
      assumptions: [
        'Only the simplified discount is applied for 2025: the 2025 INSS table could not be confirmed on an official page, so INSS contributions are not deducted and the tax may be overstated where they exceed the simplified discount.',
      ],
    },
  ],
};
