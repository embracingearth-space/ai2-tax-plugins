/**
 * Estonia — flat 22% income tax after the employee contributions and the basic
 * exemption, employee below pensionable age. @ai2/tax-plugins — embracingearth.space
 *
 * The withheld unemployment-insurance premium (1.6%) and mandatory funded
 * (II-pillar) pension contribution (2% by default) are deducted from the
 * income before tax (Income Tax Act § 28¹(1)–(2), § 42(5)–(6)); EMTA's own
 * worked examples do the same: (1,700 − 34 − 27.20 − 700) × 22% = 206.54.
 *
 * 2026: basic exemption 8,400 a year regardless of income (EMTA: the "tax
 * hump" is abolished). 2025: 7,848 a year, tapered to zero between 14,400 and
 * 25,200 of annual income (7,848 − 7,848/10,800 × (income − 14,400)); the
 * taper is fed GROSS income (EMTA TSD example: 654 − 654 ÷ 900 × (1,800 − 1,200)).
 *
 * Read on emta.ee and riigiteataja.ee on 2026-10-11.
 */
import type { CountryIncomeTaxData, DeductionRule } from '../incomeTaxFactory';

/** Employee unemployment-insurance premium 1.6% (RT I, 24.09.2024, 4 for 2025–2028; RT I, 30.09.2025, 3 for 2026–2029). */
const unemployment: DeductionRule = { kind: 'share', name: 'Unemployment insurance premium (töötuskindlustusmakse 1.6%)', rate: 0.016 };
/** II-pillar contribution at the default 2% (Funded Pensions Act § 9(1)); 4% or 6% by election. */
const funded: DeductionRule = { kind: 'share', name: 'Funded pension contribution (II sammas 2%)', rate: 0.02 };

export const EE_INCOME_TAX: CountryIncomeTaxData = {
  code: 'EE',
  country: 'Estonia',
  currency: 'EUR',
  locale: 'et-EE',
  timeZone: 'Europe/Tallinn',
  file: 'src/data/incomeTaxWorld/ee.ts',
  note: 'Resident employee below pensionable age: 22% income tax on wages less the employee unemployment-insurance premium (1.6%), the II-pillar pension contribution (2%) and the basic exemption (flat 8,400 in 2026; 7,848 tapered away between 14,400 and 25,200 of gross income in 2025). Excludes the contributions themselves as a charge.',
  assumptions: [
    'Single, no children, resident, below pensionable age, wage income only.',
    'The employee unemployment-insurance premium (1.6%) and the mandatory funded (II-pillar) pension contribution at the default 2% are deducted from income before tax (Income Tax Act § 28¹), as EMTA does in payroll, but are not included as charges. An employee who chose a 4% or 6% II-pillar rate pays slightly less tax; one who left the II pillar pays slightly more.',
    'No municipal income tax is set locally; no security tax applies to wages (EMTA).',
  ],
  incomeBasis: {
    default: 'any',
    selfEmployed: 'differs',
    selfEmployedNote: 'A sole proprietor (FIE) also pays 33% social tax on profit and can deduct it, so their income tax is lower.',
  },
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: [{ upTo: null, rate: 0.22 }],
      deductions: [unemployment, funded, { kind: 'fixed', name: 'Basic exemption (maksuvaba tulu)', amount: 8400 }],
      source: 'https://www.emta.ee/uudised/maksumuudatused-2026',
      authorityName: 'Estonian Tax and Customs Board (EMTA)',
      citationDate: '2026-10-11',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: [{ upTo: null, rate: 0.22 }],
      deductions: [
        unemployment,
        funded,
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
      source: 'https://www.emta.ee/en/business-client/taxes-and-payment/income-and-social-taxes/submission-declaration-form-tsd/naide-2-tootasu-vahemikus-1200-2100-eurot',
      authorityName: 'Estonian Tax and Customs Board (EMTA), TSD guide example 2 (2025)',
      citationDate: '2026-10-11',
      verified: true,
    },
  ],
};
