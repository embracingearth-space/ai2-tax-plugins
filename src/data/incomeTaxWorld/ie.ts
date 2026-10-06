/**
 * Ireland — income tax and Universal Social Charge, single PAYE employee.
 * @ai2/tax-plugins — embracingearth.space
 *
 * Ireland has no personal allowance: tax is charged on all taxable pay at 20%
 * up to the standard rate cut-off point and 40% above, and non-refundable TAX
 * CREDITS are then deducted (Single Person + Employee (PAYE), €2,000 each).
 *
 * USC is included as a levy: it is a tax on income (Part 18D TCA 1997), not a
 * social-insurance contribution. It has an all-or-nothing exemption — income
 * of €13,000 or less pays none; above that USC is due on ALL of it. PRSI IS a
 * social-insurance contribution and is out of scope (see assumptions).
 *
 * Every figure was read on revenue.ie on 2026-10-06.
 */
import type { CountryIncomeTaxData } from '../incomeTaxFactory';

const RATE_BANDS = 'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/tax-relief-charts/index.aspx';

const credits = [
  { kind: 'fixed', name: 'Single Person Tax Credit', amount: 2000 },
  { kind: 'fixed', name: 'Employee (PAYE) Tax Credit', amount: 2000 },
] as const;

export const IE_INCOME_TAX: CountryIncomeTaxData = {
  code: 'IE',
  country: 'Ireland',
  currency: 'EUR',
  locale: 'en-IE',
  timeZone: 'Europe/Dublin',
  file: 'src/data/incomeTaxWorld/ie.ts',
  note: 'Single PAYE employee: income tax at 20% / 40% less the Single Person and Employee tax credits, plus the Universal Social Charge at standard rates. Excludes PRSI (social insurance), the Rent Tax Credit and other credits, reduced USC rates for over-70s and medical-card holders, and pension contributions.',
  assumptions: [
    'Single person, no qualifying child, PAYE employee, tax-resident in Ireland, under 70 and without a full medical card.',
    'Only the Single Person and Employee (PAYE) tax credits; no pension contributions or benefit-in-kind.',
    'PRSI (Class A employee social insurance) is not included — it is a social-insurance contribution, not income tax.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: [
        { upTo: 44000, rate: 0.2 },
        { upTo: null, rate: 0.4 },
      ],
      credits: [...credits],
      levies: [
        {
          kind: 'bands',
          name: 'Universal Social Charge',
          base: 'gross',
          // Exemption limit €13,000 for 2026; above it USC is due on the full income.
          exemptUpTo: 13000,
          bands: [
            { upTo: 12012, rate: 0.005 },
            { upTo: 28700, rate: 0.02 },
            { upTo: 70044, rate: 0.03 },
            { upTo: null, rate: 0.08 },
          ],
        },
      ],
      source: RATE_BANDS,
      authorityName: 'Revenue Commissioners (revenue.ie)',
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: [
        { upTo: 44000, rate: 0.2 },
        { upTo: null, rate: 0.4 },
      ],
      credits: [...credits],
      levies: [
        {
          kind: 'bands',
          name: 'Universal Social Charge',
          base: 'gross',
          exemptUpTo: 13000,
          bands: [
            { upTo: 12012, rate: 0.005 },
            { upTo: 27382, rate: 0.02 },
            { upTo: 70044, rate: 0.03 },
            { upTo: null, rate: 0.08 },
          ],
        },
      ],
      source: RATE_BANDS,
      authorityName: 'Revenue Commissioners (revenue.ie)',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
