/**
 * Egypt — salary tax (Law 91/2005 art. 8 as replaced by Law 7/2024), single employee.
 * @ai2/tax-plugins — embracingearth.space
 *
 * Net income = salary − employee social insurance (Law 148/2019: 9% pensions,
 * art. 19, + 1% sickness, art. 70, on the insurable wage up to the monthly
 * maximum) − the EGP 20,000 personal exemption (art. 13(1)), rounded down to
 * the nearest EGP 10. The scale depends on the level of net income: above EGP
 * 600,000 the lower brackets are lost step by step, and above EGP 1,200,000 a
 * 27.5% bracket applies. That is a statutory formula, so it is a `tariff`.
 */
import type { CountryIncomeTaxData, IncomeTaxYearData } from '../incomeTaxFactory';
import type { IncomeTaxBand, MoneyRounding } from '../incomeTax';
import { progressive } from '../incomeTaxMath';

const LAW_7_2024 = 'https://eta.gov.eg/sites/default/files/2024-03/law_no.7-2024.pdf';

/** Net income ≤ EGP 600,000. */
const BASE: IncomeTaxBand[] = [
  { upTo: 40000, rate: 0 },
  { upTo: 55000, rate: 0.1 },
  { upTo: 70000, rate: 0.15 },
  { upTo: 200000, rate: 0.2 },
  { upTo: 400000, rate: 0.225 },
  { upTo: null, rate: 0.25 },
];

/** Law 7/2024 art. 8: the schedule for each net-income level (each starts from EGP 1). */
function scheduleFor(net: number): IncomeTaxBand[] {
  if (net <= 600000) return BASE;
  if (net <= 700000) return [{ upTo: 55000, rate: 0.1 }, { upTo: 70000, rate: 0.15 }, { upTo: 200000, rate: 0.2 }, { upTo: 400000, rate: 0.225 }, { upTo: null, rate: 0.25 }];
  if (net <= 800000) return [{ upTo: 70000, rate: 0.15 }, { upTo: 200000, rate: 0.2 }, { upTo: 400000, rate: 0.225 }, { upTo: null, rate: 0.25 }];
  if (net <= 900000) return [{ upTo: 200000, rate: 0.2 }, { upTo: 400000, rate: 0.225 }, { upTo: null, rate: 0.25 }];
  if (net <= 1200000) return [{ upTo: 400000, rate: 0.225 }, { upTo: null, rate: 0.25 }];
  return [{ upTo: 1200000, rate: 0.25 }, { upTo: null, rate: 0.275 }];
}

const tariff = (taxable: number, q: MoneyRounding): number => {
  const net = q.floor(taxable / 10) * 10;
  return progressive(net, scheduleFor(net));
};

function year(taxYear: string, effectiveFrom: string, insurableMaxMonthly: number): IncomeTaxYearData {
  return {
    taxYear,
    effectiveFrom,
    bands: BASE.map((b) => ({ ...b })),
    tariff,
    deductions: [
      { kind: 'share', name: 'Employee social insurance (9% + 1%)', rate: 0.1, ceiling: 12 * insurableMaxMonthly },
      { kind: 'fixed', name: 'Personal exemption', amount: 20000 },
    ],
    source: LAW_7_2024,
    authorityName: 'Egyptian Tax Authority (eta.gov.eg)',
    citationDate: '2026-10-06',
    verified: true,
    assumptions: [`Employee social insurance is deducted at 10% of salary up to the maximum insurable wage of EGP ${insurableMaxMonthly.toLocaleString('en-US')} a month.`],
  };
}

export const EG_INCOME_TAX: CountryIncomeTaxData = {
  code: 'EG',
  country: 'Egypt',
  currency: 'EGP',
  locale: 'ar-EG',
  timeZone: 'Africa/Cairo',
  file: 'src/data/incomeTaxWorld/eg.ts',
  note: 'Single resident private-sector employee: salary tax under Law 7/2024 on net salary after employee social insurance and the EGP 20,000 personal exemption, including the loss of the lower brackets above EGP 600,000 and the 27.5% bracket above EGP 1,200,000. Excludes other art. 13 exemptions, allowances and bonuses treated differently, and the minimum insurable wage.',
  assumptions: [
    'Single resident private-sector employee, salary income only; tax year = calendar year.',
    'Social insurance contributions (Law 148/2019) are not included as charges; the employee shares (9% pensions + 1% sickness, up to the maximum insurable wage) are deducted in computing net salary. The commonly quoted 11% total was not found in the law.',
    'Net income is rounded down to the nearest EGP 10 before the scale is applied.',
  ],
  years: [
    year('2026', '2026-01-01', 16700),
    year('2025', '2025-01-01', 14500),
  ],
};
