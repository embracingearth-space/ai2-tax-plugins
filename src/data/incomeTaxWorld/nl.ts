/**
 * Netherlands — box 1 income tax and national-insurance premiums, single
 * employee below AOW age. @ai2/tax-plugins — embracingearth.space
 *
 * The bands are the Belastingdienst's combined box 1 rates: bracket 1 includes
 * the premie volksverzekeringen (AOW 17.90% + Anw 0.10% + Wlz 9.65% = 27.65%),
 * because the Belastingdienst levies the premium together with the tax on the
 * same income. The heffingskortingen are deducted from that combined amount.
 *
 * Credits follow the official tables (art. 8.10 / 8.11 Wet IB 2001) segment by
 * segment, including the published base amounts at each segment start.
 *
 * Every figure was read on belastingdienst.nl / wetten.overheid.nl on 2026-10-06.
 */
import type { CountryIncomeTaxData, CreditRule } from '../incomeTaxFactory';

/** One row of an official credit table: from `from` (exclusive) the credit is base + rate × (A − from). */
type Row = { from: number; base: number; rate: number };

/** A credit from an official table of rows; nil from `nilFrom`, never negative. */
const tableCredit = (name: string, rows: Row[], nilFrom: number): CreditRule => ({
  kind: 'custom',
  name,
  amount: ({ gross }) => {
    if (gross >= nilFrom) return 0;
    let row = rows[0]!;
    for (const r of rows) if (gross > r.from) row = r;
    return Math.max(0, row.base + row.rate * (gross - row.from));
  },
});

const assumptionPremium =
  'The first-bracket rate includes the national-insurance premium (premie volksverzekeringen: AOW, Anw, Wlz), as the Belastingdienst publishes and levies them together; it is income tax plus that premium, not income tax alone.';

export const NL_INCOME_TAX: CountryIncomeTaxData = {
  code: 'NL',
  country: 'Netherlands',
  currency: 'EUR',
  locale: 'nl-NL',
  timeZone: 'Europe/Amsterdam',
  file: 'src/data/incomeTaxWorld/nl.ts',
  note: 'Single resident employee below AOW age: box 1 tax at the official combined rates (bracket 1 includes the 27.65% national-insurance premium, which the Belastingdienst levies together with the tax), less the algemene heffingskorting and arbeidskorting. Excludes the employee pension-fund contribution, the private health-insurance premium, boxes 2 and 3, and all other credits and deductions.',
  assumptions: [
    'Single, below AOW age for the whole year, resident; arbeidsinkomen = verzamelinkomen = gross wage (no other income, no deductions).',
    assumptionPremium,
    'Employee pension-fund contributions are not deducted and the nominal health-insurance premium is not included; the Zvw income-related contribution and the werknemersverzekeringen are paid by the employer and are not included.',
    'Only the algemene heffingskorting and arbeidskorting; credits are not refunded below nil.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: [
        { upTo: 38883, rate: 0.3575 }, // 8.10% tax + 27.65% premie volksverzekeringen
        { upTo: 78426, rate: 0.3756 },
        { upTo: null, rate: 0.495 },
      ],
      credits: [
        tableCredit('Algemene heffingskorting', [{ from: 0, base: 3115, rate: 0 }, { from: 29736, base: 3115, rate: -0.06398 }], 78427),
        tableCredit(
          'Arbeidskorting',
          [
            { from: 0, base: 0, rate: 0.08324 },
            { from: 11965, base: 996, rate: 0.31009 },
            { from: 25845, base: 5300, rate: 0.0195 },
            { from: 45592, base: 5685, rate: -0.0651 },
          ],
          132921,
        ),
      ],
      source: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/inkomstenbelasting/heffingskortingen_boxen_tarieven/boxen_en_tarieven/box_1/box_1',
      authorityName: 'Belastingdienst',
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: [
        { upTo: 38441, rate: 0.3582 }, // 8.17% tax + 27.65% premie volksverzekeringen
        { upTo: 76817, rate: 0.3748 },
        { upTo: null, rate: 0.495 },
      ],
      credits: [
        tableCredit('Algemene heffingskorting', [{ from: 0, base: 3068, rate: 0 }, { from: 28406, base: 3068, rate: -0.06337 }], 76818),
        tableCredit(
          'Arbeidskorting',
          [
            { from: 0, base: 0, rate: 0.08053 },
            { from: 12169, base: 980, rate: 0.3003 },
            { from: 26288, base: 5220, rate: 0.02258 },
            { from: 43071, base: 5599, rate: -0.0651 },
          ],
          129079,
        ),
      ],
      source: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/inkomstenbelasting/heffingskortingen_boxen_tarieven/boxen_en_tarieven/box_1/box_1',
      authorityName: 'Belastingdienst',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
