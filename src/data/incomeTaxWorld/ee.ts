/**
 * Estonia — flat 22% income tax after the basic exemption, employee below
 * pensionable age. @ai2/tax-plugins — embracingearth.space
 *
 * 2026: basic exemption 8,400 a year regardless of income (EMTA: the "tax
 * hump" is abolished). 2025: 7,848 a year, tapered to zero between 14,400 and
 * 25,200 of annual income (7,848 − 7,848/10,800 × (income − 14,400)).
 */
import type { CountryIncomeTaxData } from '../incomeTaxFactory';

export const EE_INCOME_TAX: CountryIncomeTaxData = {
  code: 'EE',
  country: 'Estonia',
  currency: 'EUR',
  locale: 'et-EE',
  timeZone: 'Europe/Tallinn',
  file: 'src/data/incomeTaxWorld/ee.ts',
  note: 'Resident employee below pensionable age: 22% income tax on wages above the basic exemption (flat 8,400 in 2026; 7,848 tapered away between 14,400 and 25,200 in 2025). Excludes the employee unemployment-insurance premium and II-pillar pension contribution, and any deduction of them from the tax base.',
  assumptions: [
    'Single, no children, resident, below pensionable age, wage income only.',
    'Employee unemployment insurance (1.6%) and the II-pillar funded pension contribution are social contributions and are not included. Whether they reduce the income-tax base was not confirmed from an official source, so they are not deducted and the tax may be slightly overstated.',
    'No municipal income tax is set locally; no security tax applies to wages (EMTA).',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: [{ upTo: null, rate: 0.22 }],
      deductions: [{ kind: 'fixed', name: 'Basic exemption (maksuvaba tulu)', amount: 8400 }],
      source: 'https://www.emta.ee/uudised/maksumuudatused-2026',
      authorityName: 'Estonian Tax and Customs Board (EMTA)',
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: [{ upTo: null, rate: 0.22 }],
      deductions: [
        {
          kind: 'schedule',
          name: 'Basic exemption (maksuvaba tulu), income-tapered',
          points: [
            [0, 7848],
            [14400, 7848],
            [25200, 0],
          ],
        },
      ],
      source: 'https://emta.ee/uudised/2025-aasta-maksumuudatused',
      authorityName: 'Estonian Tax and Customs Board (EMTA)',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
