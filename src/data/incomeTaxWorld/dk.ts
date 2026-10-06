/**
 * Denmark — state income tax, labour-market contribution (AM-bidrag) and
 * municipal tax, single employee. @ai2/tax-plugins — embracingearth.space
 *
 * AM-bidrag (8% of gross pay) is included as a levy: under arbejdsmarkeds-
 * bidragsloven it is a gross TAX on earned income paid to the state, not an
 * insurance contribution, and it is deducted before every other income tax
 * (svmn.dk arbejdsmarkedsbidragsloven page; skat.dk states the state-tax
 * thresholds "after labour market contribution"). ATP IS a pension
 * contribution and is out of scope.
 *
 * State tax (personskatteloven) is cumulative on personal income after
 * AM-bidrag: 2026 bundskat 12.01% + mellemskat 7.5% above 641,200 + topskat
 * 7.5% above 777,900 + toptopskat 5% above 2,592,700; 2025 bundskat 12.01% +
 * topskat 15% above 611,800. The personfradrag is not a zero band: its value
 * at the bundskat rate is credited against state tax, and it is deducted
 * again from the municipal (and church) tax base.
 *
 * Municipal tax is flat per municipality and charged on taxable income, i.e.
 * personal income less the beskæftigelsesfradrag and jobfradrag (municipal
 * and church tax only) and less the personfradrag. The default is the
 * Ministry of Taxation's published national average (svmn.dk).
 */
import type { CountryIncomeTaxData, IncomeTaxYearData, LevyRule } from '../incomeTaxFactory';

const SVMN_PSL = 'https://svmn.dk/tal-og-metode/satser/satser-og-beloebsgraenser-i-lovgivningen/personskatteloven';
const SKAT_RATES = 'https://skat.dk/en-us/help/tax-rates';

/** Average kommuneskat (svmn.dk "Kommuneskatter - gennemsnitsprocenter 2007-2026"). */
const AVERAGE_MUNICIPAL: Record<string, number> = { '2026': 0.25049, '2025': 0.25068 };

interface Allowances {
  personfradrag: number;
  employmentRate: number;
  employmentMax: number;
  jobRate: number;
  jobFloor: number;
  jobMax: number;
}

/** Taxable income for municipal and church tax, from personal income (after AM-bidrag). */
function municipalBase(personalIncome: number, a: Allowances): number {
  const employment = Math.min(personalIncome * a.employmentRate, a.employmentMax);
  const job = Math.min(Math.max(0, personalIncome - a.jobFloor) * a.jobRate, a.jobMax);
  return Math.max(0, personalIncome - employment - job - a.personfradrag);
}

function levies(a: Allowances): LevyRule[] {
  return [
    { kind: 'bands', name: 'Labour-market contribution (AM-bidrag)', base: 'gross', bands: [{ upTo: null, rate: 0.08 }] },
    {
      kind: 'custom',
      name: 'Municipal income tax (kommuneskat)',
      amount: ({ taxable, year, options }) => municipalBase(taxable, a) * (options.localTaxRate ?? AVERAGE_MUNICIPAL[year.taxYear]!),
    },
    {
      kind: 'custom',
      name: 'Church tax (kirkeskat)',
      amount: ({ taxable, options }) => municipalBase(taxable, a) * (options.churchTaxRate ?? 0),
    },
  ];
}

function year(
  taxYear: string,
  bands: IncomeTaxYearData['bands'],
  a: Allowances,
  source: string,
  authorityName: string,
): IncomeTaxYearData {
  return {
    taxYear,
    effectiveFrom: `${taxYear}-01-01`,
    bands,
    // AM-bidrag is deducted before every income tax; the bands apply to what is left.
    deductions: [{ kind: 'share', name: 'Labour-market contribution (AM-bidrag) deducted', rate: 0.08 }],
    // Personfradrag at the bundskat rate (12.01%), against state tax.
    credits: [{ kind: 'taxOnAmount', name: 'Personal allowance (personfradrag), state-tax value', amount: a.personfradrag }],
    levies: levies(a),
    source,
    authorityName,
    citationDate: '2026-10-06',
    verified: true,
  };
}

export const DK_INCOME_TAX: CountryIncomeTaxData = {
  code: 'DK',
  country: 'Denmark',
  currency: 'DKK',
  locale: 'da-DK',
  timeZone: 'Europe/Copenhagen',
  file: 'src/data/incomeTaxWorld/dk.ts',
  note: 'Single employee aged 18+: AM-bidrag (8% labour-market contribution, a tax), state tax (bundskat, and from 2026 mellemskat, topskat and toptopskat; topskat in 2025) with the personfradrag, and municipal tax at the national average rate after the employment and job allowances. Church tax only if a rate is passed. Excludes ATP and other contributions, the tax ceiling (skatteloft) reduction, the senior employment allowance, and capital income.',
  assumptions: [
    'Single, no children, aged 18 or over and below the age for the senior employment allowance, resident, wage income only.',
    'Municipal tax at the national average rate published by the Ministry of Taxation (25.049% for 2026, 25.068% for 2025) unless a local rate is passed; no church tax unless a church-tax rate is passed.',
    'AM-bidrag is included as a tax (8% of gross pay). ATP and other social or pension contributions are not included, and the small ATP deduction from the AM-bidrag base is ignored.',
    'The employment allowance (beskæftigelsesfradrag) and job allowance (jobfradrag) are computed on pay after AM-bidrag.',
    'The tax ceiling (skatteloft) is not applied; for 2025 at the average municipal rate it would reduce top-bracket tax by about 0.008 percentage points.',
  ],
  optionsSupported: ['localTaxRate', 'churchTaxRate'],
  defaultLocalTaxRate: (label) => AVERAGE_MUNICIPAL[label] ?? AVERAGE_MUNICIPAL['2026']!,
  years: [
    year(
      '2026',
      [
        { upTo: 641200, rate: 0.1201 },
        { upTo: 777900, rate: 0.1951 },
        { upTo: 2592700, rate: 0.2701 },
        { upTo: null, rate: 0.3201 },
      ],
      // Ligningsloven page: 12.75% max 63,300; 4.5% above 235,200 max 3,100.
      { personfradrag: 54100, employmentRate: 0.1275, employmentMax: 63300, jobRate: 0.045, jobFloor: 235200, jobMax: 3100 },
      SVMN_PSL,
      'Skatte- og Vækstministeriet (svmn.dk)',
    ),
    year(
      '2025',
      [
        { upTo: 611800, rate: 0.1201 },
        { upTo: null, rate: 0.2701 },
      ],
      { personfradrag: 51600, employmentRate: 0.123, employmentMax: 55600, jobRate: 0.045, jobFloor: 224500, jobMax: 2900 },
      SKAT_RATES,
      'Skattestyrelsen (skat.dk)',
    ),
  ],
};
