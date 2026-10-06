/**
 * Hungary — személyi jövedelemadó (SZJA), single employee.
 * @ai2/tax-plugins — embracingearth.space
 *
 * Flat 15% on gross wages. No general allowance; the conditional tax-base
 * allowances (under-25, mothers, severely disabled, newly married, family)
 * do not apply to the default profile.
 */
import type { CountryIncomeTaxData } from '../incomeTaxFactory';

const AUTHORITY = 'Nemzeti Adó- és Vámhivatal (NAV)';

export const HU_INCOME_TAX: CountryIncomeTaxData = {
  code: 'HU',
  country: 'Hungary',
  currency: 'HUF',
  locale: 'hu-HU',
  timeZone: 'Europe/Budapest',
  file: 'src/data/incomeTaxWorld/hu.ts',
  note: 'Single resident employee aged 25 or over: flat 15% personal income tax on gross wages. Excludes the 18.5% social security contribution and the conditional allowances (under-25 youth, mothers, severely disabled, first marriage, family).',
  assumptions: [
    'Single, no children, aged 25 or over, not a qualifying mother, not severely disabled, not newly married.',
    'The 18.5% employee social security contribution (társadalombiztosítási járulék) is not included and is not deducted from the tax base.',
  ],
  years: [
    {
      taxYear: '2026',
      effectiveFrom: '2026-01-01',
      bands: [{ upTo: null, rate: 0.15 }],
      source: 'https://nav.gov.hu/pfile/file?path=%2Fugyfeliranytu%2Fnezzen-utana%2Finf_fuz%2Frejtett%2FInformacios-fuzetek---Aktualis%2F72_A_diakok_munkavallalasa',
      authorityName: AUTHORITY,
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      taxYear: '2025',
      effectiveFrom: '2025-01-01',
      bands: [{ upTo: null, rate: 0.15 }],
      source: 'https://nav.gov.hu/pfile/file?path=/ugyfeliranytu/nezzen-utana/inf_fuz/2025/72.-A-diakok-munkavallalasa-2025.-01.-21',
      authorityName: AUTHORITY,
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
