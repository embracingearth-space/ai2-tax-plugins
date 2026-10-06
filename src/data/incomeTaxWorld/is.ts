/**
 * Iceland — state income tax and municipal tax (útsvar), single employee.
 * @ai2/tax-plugins — embracingearth.space
 *
 * Skatturinn publishes MONTHLY withholding brackets; the annual band limits
 * here are those × 12 (2026: 498,122 / 1,398,450 a month; 2025: 472,005 /
 * 1,325,127). The base for both taxes is wages less the employee's mandatory
 * pension contribution, deductible up to 4% (Skatturinn, iðgjald í
 * lífeyrissjóði). Útsvar defaults to 14.94%, the national average used for all
 * withholding. The personal tax credit (persónuafsláttur) is set against state
 * tax + útsvar together: here against state tax first, and what is left of it
 * inside the útsvar levy.
 */
import type { CountryIncomeTaxData, IncomeTaxYearData } from '../incomeTaxFactory';

const AVERAGE_UTSVAR = 0.1494;

function year(taxYear: string, bands: IncomeTaxYearData['bands'], credit: number, source: string): IncomeTaxYearData {
  return {
    taxYear,
    effectiveFrom: `${taxYear}-01-01`,
    bands,
    deductions: [{ kind: 'share', name: 'Mandatory pension contribution (4%) deducted', rate: 0.04 }],
    credits: [{ kind: 'fixed', name: 'Personal tax credit (persónuafsláttur), against state tax', amount: credit }],
    levies: [
      {
        kind: 'custom',
        name: 'Municipal income tax (útsvar) after the rest of the personal tax credit',
        amount: ({ taxable, incomeTax, taxAfterCredits, options }) => {
          const creditLeft = credit - (incomeTax - taxAfterCredits);
          return Math.max(0, taxable * (options.localTaxRate ?? AVERAGE_UTSVAR) - creditLeft);
        },
      },
    ],
    source,
    authorityName: 'Skatturinn (Iceland Revenue and Customs)',
    citationDate: '2026-10-06',
    verified: true,
    assumptions: ['Annual band limits are Skatturinn’s monthly withholding limits × 12.'],
  };
}

export const IS_INCOME_TAX: CountryIncomeTaxData = {
  code: 'IS',
  country: 'Iceland',
  currency: 'ISK',
  locale: 'is-IS',
  timeZone: 'Atlantic/Reykjavik',
  file: 'src/data/incomeTaxWorld/is.ts',
  note: 'Single resident employee: state income tax (16.55% / 23.05% / 31.35%) and municipal útsvar at the 14.94% national withholding average (or a passed local rate), on wages less the 4% mandatory pension contribution, less the personal tax credit. Excludes the pension contribution itself, voluntary pension saving, the broadcasting fee and other per-capita levies, and the year-end útsvar settlement for the actual municipality.',
  assumptions: [
    'Single, no children, adult, resident all year, one employer, wage income only; no transfer of a spouse’s credit.',
    'The 4% employee mandatory pension contribution (a pension contribution, not included as a charge) is deducted from the tax base; no voluntary supplementary pension saving.',
    'Útsvar at 14.94%, the national average used for withholding, unless a local rate is passed; the actual rate varies by municipality and is settled at assessment.',
    'Broadcasting fee (útvarpsgjald) and the elderly-facilities levy are not included; employer social-security tax (tryggingagjald) is employer-side.',
  ],
  optionsSupported: ['localTaxRate'],
  defaultLocalTaxRate: () => AVERAGE_UTSVAR,
  years: [
    year(
      '2026',
      [
        { upTo: 5977464, rate: 0.1655 },
        { upTo: 16781400, rate: 0.2305 },
        { upTo: null, rate: 0.3135 },
      ],
      869898,
      'https://www.skatturinn.is/einstaklingar/stadgreidsla/stadgreidsla/2026/stadgreidsla-2026',
    ),
    year(
      '2025',
      [
        { upTo: 5664060, rate: 0.1655 },
        { upTo: 15901524, rate: 0.2305 },
        { upTo: null, rate: 0.3135 },
      ],
      824288,
      'https://www.skatturinn.is/einstaklingar/stadgreidsla/stadgreidsla/2025/stadgreidsla-2025',
    ),
  ],
};
