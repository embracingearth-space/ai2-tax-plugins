/**
 * Company tax — the rest of the world. @ai2/tax-plugins — embracingearth.space
 *
 * Built from the 2026-10-06 company-tax research (197 jurisdictions) and merged
 * into COMPANY_TAX_RATES by companyTax.ts. AU, US, GB, IN, CA and FI live in
 * companyTax.ts and are not repeated here.
 *
 * WHAT `verified` MEANS HERE. TRUE only where the figure was read on the
 * country's own tax authority, finance ministry or legislation page that day.
 * A figure taken from OECD Corporate Tax Statistics (Table II.1, 2026) is an
 * intergovernmental compilation, not the national authority: those sets are
 * `verified: false`, carry the OECD URL as `source`, and their note tells the
 * reader to confirm with the national authority. Countries with no figure from
 * either are NOT given a set: they are listed in COMPANY_TAX_NOT_COVERED and
 * coverage() reports them as not covered. No figure here is estimated.
 *
 * `standardRate` is the central-government standard rate for ordinary resident
 * companies, EXCLUDING surtaxes, cesses and state/municipal taxes; the combined
 * figure, where known, is in the note. A reduced rate is a `smallCompanyRate`
 * only where it was confirmed on the national page AND applies to all profit of
 * a company meeting a clear threshold (HR, PH, PL). Profit bands (the first X
 * taxed lower) are described in the note instead, because the estimator applies
 * one rate to the whole profit.
 *
 * EFFECTIVE DATES. Where the source states when the rate started, that is
 * `effectiveFrom`. Where it does not, the set is anchored at 2026-01-01 as "in
 * force at least since", the year the rate was read for, and the
 * verificationNote says so. Germany's enacted cuts (KStG § 23: 14% in 2028 down
 * to 10% from 2032) are future-dated sets; Finland's proposed 18% is a bill and
 * is not encoded (see companyTax.ts).
 *
 * To change a rate, add a new set above the old one; never edit a set in place.
 */
import type { CompanyTaxInfo } from './companyTax';

export const COMPANY_TAX_WORLD: Record<string, CompanyTaxInfo> = {
  AD: {
    countryCode: 'AD',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.1,
        note: "Indicative only: confirm with Andorra's national tax authority. OECD 2026: central statutory CIT 10%, combined (central+sub-central) 10%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Andorra's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  AE: {
    countryCode: 'AE',
    authorityName: "UAE Government portal (u.ae)",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2023-06-01',
        standardRate: 0.09,
        note: "Federal Corporate Tax (Federal Decree-Law No. 47 of 2022) for financial years starting on or after 1 June 2023. Qualifying Free Zone Persons: 0% on qualifying income. The u.ae page still says a different rate 'not yet specified' for large MNEs; the UAE has since introduced a 15% Domestic Minimum Top-up Tax from 2025 (not read on an official page this session). Emirate-level taxes on oil/gas and foreign bank branches are separate. | Cross-check: OECD 2026: central statutory CIT 9%, combined (central+sub-central) 9% Reduced rate 0%, not modelled as a small-company rate: 0% on the first AED 375,000 of taxable income (a band available to all taxable persons, not only small businesses). Separately, Small Business Relief (revenue <= AED 3m) treats eligible persons as having no taxable income (not read this session)..",
        // UAE Government portal (u.ae): 'As per Ministry of Finance, CT rates are: 0 per cent for taxable income up to AED 375,000; 9 per cent for taxable income above AED 375,000'
        // also UAE Ministry of Finance (https://mof.gov.ae/en/public-finance/tax/corporate-tax-in-the-uae/): Qualifying Free Zone Person 'can benefit from a Corporate Tax rate of 0% on their Qualifying Income'; overview of CT regime (headline 9% rate not on this page)
        // also OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0) (https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023): OECD Table II.1 2026; national source not read
        source: "https://u.ae/en/information-and-services/finance-and-investment/taxation/corporate-tax",
        sourceAuthority: "UAE Government portal (u.ae)",
        citationDate: '2026-10-06',
        verified: true,
      },
    ],
  },
  AG: {
    countryCode: 'AG',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Antigua and Barbuda's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Antigua and Barbuda's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  AL: {
    countryCode: 'AL',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.15,
        note: "Indicative only: confirm with Albania's national tax authority. OECD 2026: central statutory CIT 15%, combined (central+sub-central) 15%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Albania's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  AM: {
    countryCode: 'AM',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.18,
        note: "Indicative only: confirm with Armenia's national tax authority. OECD 2026: central statutory CIT 18%, combined (central+sub-central) 18%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Armenia's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  AO: {
    countryCode: 'AO',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Angola's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Angola's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  AR: {
    countryCode: 'AR',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.35,
        note: "Indicative only: confirm with Argentina's national tax authority. OECD 2026: central statutory CIT 35%, combined (central+sub-central) 35%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Argentina's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  AT: {
    countryCode: 'AT',
    authorityName: "Unternehmensserviceportal (USP, Austrian federal government / BMF)",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2024-01-01',
        standardRate: 0.23,
        note: "Flat 23% on taxable income regardless of amount (25% until 2022, 24% in 2023). Minimum corporation tax applies to corporations (not read this session). Austria applies the Mindestbesteuerungsgesetz (Pillar Two) from 2024 - not read this session. | Cross-check: OECD 2026: central statutory CIT 23%, combined (central+sub-central) 23%",
        // Unternehmensserviceportal (USP, Austrian federal government / BMF): 'Die Körperschaftsteuer beträgt 23 Prozent (bis zum Jahr 2022: 25 Prozent, im Jahr 2023: 24 Prozent) vom steuerpflichtigen Einkommen, unabhängig von der Höhe des Einkommens.' (reached via redirect from bmf.gv.at)
        // also OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0) (https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023): OECD Table II.1 2026; national source not read
        source: "https://www.usp.gv.at/themen/steuern-finanzen/koerperschaftsteuer-ueberblick.html",
        sourceAuthority: "Unternehmensserviceportal (USP, Austrian federal government / BMF)",
        citationDate: '2026-10-06',
        verified: true,
      },
    ],
  },
  AZ: {
    countryCode: 'AZ',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.2,
        note: "Indicative only: confirm with Azerbaijan's national tax authority. OECD 2026: central statutory CIT 20%, combined (central+sub-central) 20%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Azerbaijan's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  BA: {
    countryCode: 'BA',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.1,
        note: "Indicative only: confirm with Bosnia and Herzegovina's national tax authority. OECD 2026: central statutory CIT 10%, combined (central+sub-central) 10%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Bosnia and Herzegovina's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  BB: {
    countryCode: 'BB',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.09,
        note: "Indicative only: confirm with Barbados's national tax authority. OECD 2026: central statutory CIT 9%, combined (central+sub-central) 9%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Barbados's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  BE: {
    countryCode: 'BE',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Belgium's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%; central rate excluding surtax 25%; small-business combined 20% Reduced rate 20%, not modelled as a small-company rate: OECD 'targeted at small business' central rate; qualifying conditions not stated in OECD data.",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Belgium's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  BF: {
    countryCode: 'BF',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.275,
        note: "Indicative only: confirm with Burkina Faso's national tax authority. OECD 2026: central statutory CIT 27.5%, combined (central+sub-central) 27.5%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Burkina Faso's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  BG: {
    countryCode: 'BG',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.1,
        note: "Indicative only: confirm with Bulgaria's national tax authority. OECD 2026: central statutory CIT 10%, combined (central+sub-central) 10%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Bulgaria's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  BH: {
    countryCode: 'BH',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.0,
        note: "Indicative only: confirm with Bahrain's national tax authority. OECD 2026: central statutory CIT 0%, combined (central+sub-central) 0%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Bahrain's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  BJ: {
    countryCode: 'BJ',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.3,
        note: "Indicative only: confirm with Benin's national tax authority. OECD 2026: central statutory CIT 30%, combined (central+sub-central) 30%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Benin's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  BN: {
    countryCode: 'BN',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.185,
        note: "Indicative only: confirm with Brunei Darussalam's national tax authority. OECD 2026: central statutory CIT 18.5%, combined (central+sub-central) 18.5%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Brunei Darussalam's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  BR: {
    countryCode: 'BR',
    authorityName: "Receita Federal do Brasil - IRPJ",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '1996-01-01',
        standardRate: 0.15,
        note: "IRPJ basic rate 15% on real/presumed/arbitrated profit, plus a 10% IRPJ additional on profit exceeding BRL 20,000 per month (BRL 240,000/yr), plus CSLL (social contribution on net profit) 9% for companies in general (15% financial institutions/insurers; 20% for some banks). Typical combined rate 34% (OECD 2026: 34%). Simples Nacional regime for micro/small enterprises replaces these with a unified turnover-based tax (rates not read). Brazil enacted a 15% Additional CSLL (Pillar Two QDMTT, 'AdCSLL') from 2025 - listed on Receita site, not read in detail. | Cross-check: OECD 2026: central statutory CIT 34%, combined (central+sub-central) 34%",
        // Receita Federal do Brasil - IRPJ: 'A alíquota do IRPJ é de 15% (quinze por cento) sobre o lucro apurado, com adicional de 10% sobre a parcela do lucro que exceder R$ 20.000,00 / mês.' Rates 'em vigor desde o ano-calendário 1996'
        // also Receita Federal do Brasil - CSLL (https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/tributos/CSLL): 'A alíquota da CSLL é de 9% (nove por cento) para as pessoas jurídicas em geral, e de 15% ... instituições financeiras, de seguros privados e de capitalização'
        // also OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0) (https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023): OECD Table II.1 2026; national source not read
        source: "https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/tributos/IRPJ",
        sourceAuthority: "Receita Federal do Brasil - IRPJ",
        citationDate: '2026-10-06',
        verified: true,
      },
    ],
  },
  BS: {
    countryCode: 'BS',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.0,
        note: "Indicative only: confirm with Bahamas's national tax authority. OECD 2026: central statutory CIT 0%, combined (central+sub-central) 0%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Bahamas's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  BT: {
    countryCode: 'BT',
    authorityName: "Department of Revenue and Customs, Ministry of Finance, Bhutan",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Bhutan's national tax authority. Department of Revenue and Customs page: 25% of net profit for companies other than state enterprises, 30% for state-enterprise companies. Caveat: the page is undated and references the Companies Act 2000; the new Income Tax Act of Bhutan 2025 (Rules issued Dec 2025; a public notification on tax rates exists only as an image) may have changed rates from income year 2026 - not confirmed. Not covered by OECD Table II.1.",
        // Department of Revenue and Customs, Ministry of Finance, Bhutan: 'CIT ... is levied @ of 30% on net profit for state enterprise companies and @ of 25% on net profit for other companies.' (page undated)
        source: "https://www.drc.gov.bt/corporate-income-tax-cit/",
        sourceAuthority: "Department of Revenue and Customs, Ministry of Finance, Bhutan",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "The Department of Revenue and Customs page is undated and cites the Companies Act 2000; the Income Tax Act of Bhutan 2025 (Rules issued December 2025) may have changed company rates from income year 2026. Not confirmed, so not verified. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  BW: {
    countryCode: 'BW',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.22,
        note: "Indicative only: confirm with Botswana's national tax authority. OECD 2026: central statutory CIT 22%, combined (central+sub-central) 22%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Botswana's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  BZ: {
    countryCode: 'BZ',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.0,
        note: "Indicative only: confirm with Belize's national tax authority. OECD 2026: central statutory CIT 0%, combined (central+sub-central) 0%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Belize's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  CD: {
    countryCode: 'CD',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.3,
        note: "Indicative only: confirm with Democratic Republic of the Congo's national tax authority. OECD 2026: central statutory CIT 30%, combined (central+sub-central) 30%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Democratic Republic of the Congo's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  CG: {
    countryCode: 'CG',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.28,
        note: "Indicative only: confirm with Congo's national tax authority. OECD 2026: central statutory CIT 28%, combined (central+sub-central) 28%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Congo's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  CH: {
    countryCode: 'CH',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.085,
        note: "Indicative only: confirm with Switzerland's national tax authority. OECD 2026: central statutory CIT 8.5%, combined (central+sub-central) 19.471871%; sub-central CIT 12.62698%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Switzerland's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  CI: {
    countryCode: 'CI',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Cote d'Ivoire's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Cote d'Ivoire's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  CL: {
    countryCode: 'CL',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.27,
        note: "Indicative only: confirm with Chile's national tax authority. OECD 2026: central statutory CIT 27%, combined (central+sub-central) 27%; small-business combined 12.5% Reduced rate 12.5%, not modelled as a small-company rate: OECD 'targeted at small business' central rate; qualifying conditions not stated in OECD data.",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Chile's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  CM: {
    countryCode: 'CM',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.33,
        note: "Indicative only: confirm with Cameroon's national tax authority. OECD 2026: central statutory CIT 33%, combined (central+sub-central) 33%; sub-central CIT 3%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Cameroon's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  CN: {
    countryCode: 'CN',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with China's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with China's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  CO: {
    countryCode: 'CO',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.35,
        note: "Indicative only: confirm with Colombia's national tax authority. OECD-only (latest OECD year 2025): 35%; OECD's small-business series also shows 35%, i.e. no reduced rate recorded. 2026 not yet in OECD data for Colombia. | Cross-check: OECD 2025: central statutory CIT 35%, combined (central+sub-central) 35%; central rate excluding surtax 35%; small-business combined 35%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2025; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Colombia's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  CR: {
    countryCode: 'CR',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.3,
        note: "Indicative only: confirm with Costa Rica's national tax authority. OECD 2026: central statutory CIT 30%, combined (central+sub-central) 30%; small-business combined 5% Reduced rate 5%, not modelled as a small-company rate: OECD 'targeted at small business' central rate; qualifying conditions not stated in OECD data.",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Costa Rica's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  CV: {
    countryCode: 'CV',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.2,
        note: "Indicative only: confirm with Cabo Verde's national tax authority. OECD 2026: central statutory CIT 20%, combined (central+sub-central) 20.4%; sub-central CIT 0.4%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Cabo Verde's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  CY: {
    countryCode: 'CY',
    authorityName: "Cyprus Tax Department (Ministry of Finance) - Tax Reform 2026 income tax presentation",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.15,
        note: "Corporate income tax raised from 12.5% to 15% from 1 January 2026 under the 2026 tax reform. Cyprus has enacted Pillar Two (IIR/UTPR and domestic top-up) per the same presentation (not detailed here). Special Defence Contribution on deemed/actual dividends is separate. Not covered by OECD Table II.1.",
        // Cyprus Tax Department (Ministry of Finance) - Tax Reform 2026 income tax presentation: 'Από την 1/1/2026, οι εταιρείες υπόκεινται σε εταιρικό φόρο με συντελεστή ύψους 15%.' (From 1/1/2026 companies are subject to corporate tax at a rate of 15%.) Linked from https://www.gov.cy/mof-tax/documents/forologiki-metarrythmisi-2026/
        source: "https://www.gov.cy/media/sites/167/2026/03/2026-ΦορΜεταρρύθμιση-Φόρος-Εισοδήματος.pdf",
        sourceAuthority: "Cyprus Tax Department (Ministry of Finance) - Tax Reform 2026 income tax presentation",
        citationDate: '2026-10-06',
        verified: true,
      },
    ],
  },
  CZ: {
    countryCode: 'CZ',
    authorityName: "Financial Administration of the Czech Republic (Finanční správa)",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2024-01-01',
        standardRate: 0.21,
        note: "Corporate income tax 21% (Act No. 586/1992 Coll., s.21) unless s.21(2)-(3) provide otherwise; 5% for basic investment funds, 0% for pension funds. Rate effective from the first day of the tax period. No small-business rate. Pillar Two (top-up tax) not checked. | Cross-check: OECD 2026: central statutory CIT 21%, combined (central+sub-central) 21%",
        // Financial Administration of the Czech Republic (Finanční správa): 'Sazba daně činí 21 %, pokud v § 21 odst. 2 a 3 zákona o daních z příjmů není stanoveno jinak.' (The tax rate is 21% ...). effectiveFrom 2024-01-01 (increase from 19%) is not stated on the page.
        // also OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0) (https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023): OECD Table II.1 2026; national source not read
        source: "https://financnisprava.gov.cz/cs/dane/dane/dan-z-prijmu/pravnicke-osoby/obecne-informace",
        sourceAuthority: "Financial Administration of the Czech Republic (Finanční správa)",
        citationDate: '2026-10-06',
        verified: true,
      },
    ],
  },
  DE: {
    countryCode: 'DE',
    authorityName: "Federal Ministry of Justice - Gesetze im Internet: KStG § 23",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2032-01-01',
        standardRate: 0.1,
        note: "Enacted: KStG § 23 sets 10% for assessment periods from 2032. Solidarity surcharge (5.5% of the tax) and municipal trade tax are additional and not included.",
        // Federal Ministry of Justice - Gesetze im Internet: KStG § 23: 'Die Körperschaftsteuer beträgt für 1. Veranlagungszeiträume bis 2027 15 Prozent, 2. ... 2028 14 Prozent, ... 6. Veranlagungszeiträume ab 2032 10 Prozent des zu versteuernden Einkommens.'
        // also Federal Ministry of Justice - Gesetze im Internet: SolZG 1995 § 4 (https://www.gesetze-im-internet.de/solzg_1995/__4.html): 'Der Solidaritätszuschlag beträgt 5,5 Prozent der Bemessungsgrundlage.'
        // also OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0) (https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023): OECD Table II.1 2026; national source not read
        source: "https://www.gesetze-im-internet.de/kstg_1977/__23.html",
        sourceAuthority: "Federal Ministry of Justice - Gesetze im Internet: KStG § 23",
        citationDate: '2026-10-06',
        verified: true,
      },
      {
        effectiveFrom: '2031-01-01',
        standardRate: 0.11,
        note: "Enacted: KStG § 23 sets 11% for the 2031 assessment period. Solidarity surcharge (5.5% of the tax) and municipal trade tax are additional and not included.",
        source: "https://www.gesetze-im-internet.de/kstg_1977/__23.html",
        sourceAuthority: "Federal Ministry of Justice - Gesetze im Internet: KStG § 23",
        citationDate: '2026-10-06',
        verified: true,
      },
      {
        effectiveFrom: '2030-01-01',
        standardRate: 0.12,
        note: "Enacted: KStG § 23 sets 12% for the 2030 assessment period. Solidarity surcharge (5.5% of the tax) and municipal trade tax are additional and not included.",
        source: "https://www.gesetze-im-internet.de/kstg_1977/__23.html",
        sourceAuthority: "Federal Ministry of Justice - Gesetze im Internet: KStG § 23",
        citationDate: '2026-10-06',
        verified: true,
      },
      {
        effectiveFrom: '2029-01-01',
        standardRate: 0.13,
        note: "Enacted: KStG § 23 sets 13% for the 2029 assessment period. Solidarity surcharge (5.5% of the tax) and municipal trade tax are additional and not included.",
        source: "https://www.gesetze-im-internet.de/kstg_1977/__23.html",
        sourceAuthority: "Federal Ministry of Justice - Gesetze im Internet: KStG § 23",
        citationDate: '2026-10-06',
        verified: true,
      },
      {
        effectiveFrom: '2028-01-01',
        standardRate: 0.14,
        note: "Enacted: KStG § 23 sets 14% for the 2028 assessment period. Solidarity surcharge (5.5% of the tax) and municipal trade tax are additional and not included.",
        source: "https://www.gesetze-im-internet.de/kstg_1977/__23.html",
        sourceAuthority: "Federal Ministry of Justice - Gesetze im Internet: KStG § 23",
        citationDate: '2026-10-06',
        verified: true,
      },
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.15,
        note: "KStG § 23: 15% for assessment periods up to 2027, then enacted cuts of one point a year to 10% from 2032. Federal corporation tax 15% for assessment periods up to 2027, then enacted cuts: 14% (2028), 13% (2029), 12% (2030), 11% (2031), 10% from 2032. Solidarity surcharge 5.5% of CIT (15% x 1.055 = 15.825%). Municipal trade tax (Gewerbesteuer) additional, 3.5% base rate x municipal multiplier (OECD sub-central 2026: 14.31%; OECD combined 30.13%). No small-business CIT rate. Germany applies the Minimum Tax Act (MinStG, IIR/QDMTT) from 2024 - not read this session. | Cross-check: OECD 2026: central statutory CIT 15.825%, combined (central+sub-central) 30.133026%; sub-central CIT 14.308026%; central rate excluding surtax 15%",
        // Federal Ministry of Justice - Gesetze im Internet: KStG § 23: 'Die Körperschaftsteuer beträgt für 1. Veranlagungszeiträume bis 2027 15 Prozent, 2. ... 2028 14 Prozent, ... 6. Veranlagungszeiträume ab 2032 10 Prozent des zu versteuernden Einkommens.'
        // also Federal Ministry of Justice - Gesetze im Internet: SolZG 1995 § 4 (https://www.gesetze-im-internet.de/solzg_1995/__4.html): 'Der Solidaritätszuschlag beträgt 5,5 Prozent der Bemessungsgrundlage.'
        // also OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0) (https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023): OECD Table II.1 2026; national source not read
        source: "https://www.gesetze-im-internet.de/kstg_1977/__23.html",
        sourceAuthority: "Federal Ministry of Justice - Gesetze im Internet: KStG § 23",
        citationDate: '2026-10-06',
        verified: true,
        verificationNote: "Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  DJ: {
    countryCode: 'DJ',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Djibouti's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Djibouti's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  DK: {
    countryCode: 'DK',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.22,
        note: "Indicative only: confirm with Denmark's national tax authority. OECD 2026: central statutory CIT 22%, combined (central+sub-central) 22%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Denmark's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  DM: {
    countryCode: 'DM',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Dominica's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Dominica's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  DO: {
    countryCode: 'DO',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.27,
        note: "Indicative only: confirm with Dominican Republic's national tax authority. OECD 2026: central statutory CIT 27%, combined (central+sub-central) 27%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Dominican Republic's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  EC: {
    countryCode: 'EC',
    authorityName: "Servicio de Rentas Internas (SRI), Ecuador",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Companies, branches and PEs apply 25% on taxable base. +3 points where a tax-haven owner in the chain has an Ecuadorian-resident beneficial owner or ownership is not reported (pro-rata if under 50%); +2 points under the tax stability regime; a reduced rate (22% example) for reinvestment in new investment. Small businesses may fall under the RIMPE simplified regime taxed on gross income (rates not read). Not covered by OECD Table II.1.",
        // Servicio de Rentas Internas (SRI), Ecuador: 'Las sociedades constituidas en el Ecuador, así como las sucursales de sociedades extranjeras ... aplicarán la tarifa del 25% sobre su base imponible.' (Companies ... apply the 25% rate on their taxable base.)
        source: "https://www.sri.gob.ec/impuesto-renta",
        sourceAuthority: "Servicio de Rentas Internas (SRI), Ecuador",
        citationDate: '2026-10-06',
        verified: true,
        verificationNote: "Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  EE: {
    countryCode: 'EE',
    authorityName: "Estonian Tax and Customs Board (EMTA) - Tax rates 2026",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2025-01-01',
        standardRate: 0.22,
        note: "Distribution-based system: retained profits are not taxed; distributed profits (dividends, deemed distributions) taxed at 22/78 of the net distribution (= 22% of the gross amount). The lower 14/86 rate for regular dividends was abolished from 1 January 2025. No small-business rate. | Cross-check: OECD 2026: central statutory CIT 22%, combined (central+sub-central) 22%",
        // Estonian Tax and Customs Board (EMTA) - Tax rates 2026: 2026: 'Corporate income tax is 22/78. From 1 January 2025, the tax calculation of regularly distributed dividends, i.e. the lower tax rate of 14/86, was abolished and only the standard rate of 22/78 applies.'
        // also OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0) (https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023): OECD Table II.1 2026; national source not read
        source: "https://www.emta.ee/en/private-client/taxes-and-payment/declaration-income/tax-rates",
        sourceAuthority: "Estonian Tax and Customs Board (EMTA) - Tax rates 2026",
        citationDate: '2026-10-06',
        verified: true,
      },
    ],
  },
  EG: {
    countryCode: 'EG',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.225,
        note: "Indicative only: confirm with Egypt's national tax authority. OECD 2026: central statutory CIT 22.5%, combined (central+sub-central) 22.5%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Egypt's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  ES: {
    countryCode: 'ES',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Spain's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%; small-business combined 19% Reduced rate 19%, not modelled as a small-company rate: OECD 'targeted at small business' central rate; qualifying conditions not stated in OECD data.",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Spain's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  FJ: {
    countryCode: 'FJ',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Fiji's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Fiji's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  FR: {
    countryCode: 'FR',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with France's national tax authority. OECD 2026: central statutory CIT 36.13%, combined (central+sub-central) 36.13%; central rate excluding surtax 25%; small-business combined 15% Reduced rate 15%, not modelled as a small-company rate: OECD 'targeted at small business' central rate; qualifying conditions not stated in OECD data.",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with France's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  GA: {
    countryCode: 'GA',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.3,
        note: "Indicative only: confirm with Gabon's national tax authority. OECD 2026: central statutory CIT 30%, combined (central+sub-central) 30%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Gabon's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  GD: {
    countryCode: 'GD',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.28,
        note: "Indicative only: confirm with Grenada's national tax authority. OECD 2026: central statutory CIT 28%, combined (central+sub-central) 28%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Grenada's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  GE: {
    countryCode: 'GE',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.15,
        note: "Indicative only: confirm with Georgia's national tax authority. OECD 2026: central statutory CIT 15%, combined (central+sub-central) 15%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Georgia's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  GH: {
    countryCode: 'GH',
    authorityName: "Ghana Revenue Authority",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "General CIT 25%; sector/location rates differ (e.g. 35% petroleum and mineral income; reduced/holiday rates for agro-processing, free zones (15% on exports after holiday), low-cost housing, young entrepreneurs). Ghana's Growth and Sustainability Levy and the 15% minimum tax are not covered on this page (not read). Not covered by OECD Table II.1.",
        // Ghana Revenue Authority: 'Tax Rate: The general Corporate Income Tax rate is 25%. However, there are contemporary rates depending on the nature of business ...'
        source: "https://gra.gov.gh/domestic-tax/tax-types/corporate-income-tax/",
        sourceAuthority: "Ghana Revenue Authority",
        citationDate: '2026-10-06',
        verified: true,
        verificationNote: "Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  GR: {
    countryCode: 'GR',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.22,
        note: "Indicative only: confirm with Greece's national tax authority. OECD 2026: central statutory CIT 22%, combined (central+sub-central) 22%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Greece's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  GT: {
    countryCode: 'GT',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Guatemala's national tax authority. OECD-only: 25% (régimen sobre las utilidades de actividades lucrativas). Guatemala also has an optional simplified regime taxing gross revenue (secondary sources: 5% on first Q30,000 monthly, 7% above) - not confirmed; SAT, Congress and MINFIN sites returned 403/Cloudflare blocks. | Cross-check: OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Guatemala's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  HK: {
    countryCode: 'HK',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.165,
        note: "Indicative only: confirm with Hong Kong (China)'s national tax authority. OECD 2026: central statutory CIT 16.5%, combined (central+sub-central) 16.5%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Hong Kong (China)'s national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  HN: {
    countryCode: 'HN',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Honduras's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Honduras's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  HR: {
    countryCode: 'HR',
    authorityName: "Ministry of Finance - Tax Administration (Porezna uprava), Croatia",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.18,
        smallCompanyRate: 0.1,
        note: "Two-rate profit tax: 10% where annual revenue is up to EUR 1,000,000, 18% where revenue exceeds EUR 1,000,000. Profit Tax Act amendments listed up to OG 151/25. Pillar Two status not checked. | Cross-check: OECD 2026: central statutory CIT 18%, combined (central+sub-central) 18% Small-company rate 10%: Taxpayers whose revenue in the tax period is up to EUR 1,000,000.",
        // Ministry of Finance - Tax Administration (Porezna uprava), Croatia: 'PROFIT TAX: 10% if, during the taxation period, revenue has been generated up to EUR 1.000.000,00, or 18% if ... greater than EUR 1.000.000,00'
        // also OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0) (https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023): OECD Table II.1 2026; national source not read
        source: "https://porezna-uprava.gov.hr/en/profit-tax/7365",
        sourceAuthority: "Ministry of Finance - Tax Administration (Porezna uprava), Croatia",
        citationDate: '2026-10-06',
        verified: true,
        verificationNote: "Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  HT: {
    countryCode: 'HT',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.3,
        note: "Indicative only: confirm with Haiti's national tax authority. OECD 2026: central statutory CIT 30%, combined (central+sub-central) 30%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Haiti's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  HU: {
    countryCode: 'HU',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.09,
        note: "Indicative only: confirm with Hungary's national tax authority. OECD-only: 9% flat; OECD's small-business series also shows 9%, i.e. no reduced CIT rate (Hungary's KIVA/KATA small-business regimes are separate turnover/payroll-based taxes, not checked). Local business tax (HIPA, up to 2% of adjusted turnover) not included. | Cross-check: OECD 2026: central statutory CIT 9%, combined (central+sub-central) 9%; small-business combined 9%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Hungary's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  ID: {
    countryCode: 'ID',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.22,
        note: "Indicative only: confirm with Indonesia's national tax authority. OECD 2026: central statutory CIT 22%, combined (central+sub-central) 22%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Indonesia's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  IE: {
    countryCode: 'IE',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.125,
        note: "Indicative only: confirm with Ireland's national tax authority. OECD 2026: central statutory CIT 12.5%, combined (central+sub-central) 12.5%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Ireland's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  IL: {
    countryCode: 'IL',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.23,
        note: "Indicative only: confirm with Israel's national tax authority. OECD 2025: central statutory CIT 23%, combined (central+sub-central) 23%; sub-central CIT 0%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2025; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Israel's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  IS: {
    countryCode: 'IS',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.2,
        note: "Indicative only: confirm with Iceland's national tax authority. OECD 2026: central statutory CIT 20%, combined (central+sub-central) 20%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Iceland's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  IT: {
    countryCode: 'IT',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.24,
        note: "Indicative only: confirm with Italy's national tax authority. OECD 2026: central statutory CIT 24%, combined (central+sub-central) 27.81%; sub-central CIT 3.9%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Italy's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  JM: {
    countryCode: 'JM',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Jamaica's national tax authority. OECD-only: 25% (applies to unregulated companies; secondary sources indicate 33 1/3% for regulated companies such as banks/insurers - not confirmed). TAJ site publications read only covered individual rates. | Cross-check: OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Jamaica's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  JO: {
    countryCode: 'JO',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.2,
        note: "Indicative only: confirm with Jordan's national tax authority. OECD 2026: central statutory CIT 20%, combined (central+sub-central) 20%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Jordan's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  JP: {
    countryCode: 'JP',
    authorityName: "National Tax Agency Japan - Tax Answer No.5759 (法人税の税率)",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2018-04-01',
        standardRate: 0.232,
        note: "National corporation tax 23.2% (fiscal years beginning on/after 2018-04-01). Additional local corporation tax (10.3% of CIT), inhabitants and enterprise taxes raise the combined rate (OECD combined 2026: 29.74%). A 4% Defence Special Corporation Tax surtax for fiscal years beginning on/after 2026-04-01 was enacted in the 2025 tax reform (not read on an official page this session). Japan applies an IIR from 2024 (not read). | Cross-check: OECD 2026: central statutory CIT 23.2%, combined (central+sub-central) 29.74%; sub-central CIT 7.35%; small-business combined 21.37% Reduced rate 15%, not modelled as a small-company rate: Ordinary corporations with share capital of JPY 100 million or less (other than excluded large-group subsidiaries, 'tekiyo jogai jigyosha' at 19%): 15% on the first JPY 8 million of annual income; for fiscal years from 2025-04-01 the 15% becomes 17% where annual income exceeds JPY 1 billion (note 7).",
        // National Tax Agency Japan - Tax Answer No.5759 (法人税の税率): Rate table by fiscal year start: ordinary corporations other than SMEs 23.20% (H30.4.1 onwards through R7.4.1 onwards); SMEs (capital <= JPY 100m) 15% on the portion up to JPY 8m per year (17% per note 7 from R7.4.1)
        // also OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0) (https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023): OECD Table II.1 2026; national source not read
        source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/hojin/5759.htm",
        sourceAuthority: "National Tax Agency Japan - Tax Answer No.5759 (法人税の税率)",
        citationDate: '2026-10-06',
        verified: true,
      },
    ],
  },
  KE: {
    countryCode: 'KE',
    authorityName: "Kenya Law (National Council for Law Reporting) - Income Tax Act Cap. 470, consolidated to 2026-07-01",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2021-01-01',
        standardRate: 0.3,
        note: "Resident companies 30% (6.00 shillings in each 20 shillings for 2021 and later years); non-resident companies with a PE 30% from 2024 (previously 37.5%). Reduced rates for EPZ/SEZ enterprises, local vehicle assemblers, affordable housing developers etc. Turnover Tax (s.12C) applies to resident persons with gross turnover above KES 1m and not above KES 25m (rate not read this session). Section 12G minimum top-up tax: covered persons pay top-up to a 15% combined effective tax rate (Pillar Two-style QDMTT). | Cross-check: OECD 2026: central statutory CIT 30%, combined (central+sub-central) 30%",
        // Kenya Law (National Council for Law Reporting) - Income Tax Act Cap. 470, consolidated to 2026-07-01: Third Schedule Head B para 2(a): resident company corporation rate 'for the year of income 2021 and each subsequent year of income' 6.00 per twenty shillings (=30%); 2(b) non-resident PE 6.00 from 2024; s.12G minimum top-up tax at fifteen per cent
        // also Kenya Revenue Authority (https://www.kra.go.ke/business/companies-partnerships/companies-partnerships-pin-taxes/company-partnerships-types-of-taxes): Describes Corporation Tax and Turnover Tax eligibility (gross turnover more than KES 1,000,000 but not exceeding KES 25,000,000); no rate figure on this page
        // also OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0) (https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023): OECD Table II.1 2026; national source not read
        source: "https://new.kenyalaw.org/akn/ke/act/1973/16/eng",
        sourceAuthority: "Kenya Law (National Council for Law Reporting) - Income Tax Act Cap. 470, consolidated to 2026-07-01",
        citationDate: '2026-10-06',
        verified: true,
      },
    ],
  },
  KN: {
    countryCode: 'KN',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Saint Kitts and Nevis's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Saint Kitts and Nevis's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  KR: {
    countryCode: 'KR',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Korea (Republic of)'s national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 27.5%; sub-central CIT 2.5%; small-business combined 11% Reduced rate 10%, not modelled as a small-company rate: OECD 'targeted at small business' central rate; qualifying conditions not stated in OECD data.",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Korea (Republic of)'s national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  KW: {
    countryCode: 'KW',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.15,
        note: "Indicative only: confirm with Kuwait's national tax authority. OECD 2026: central statutory CIT 15%, combined (central+sub-central) 15%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Kuwait's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  KZ: {
    countryCode: 'KZ',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.2,
        note: "Indicative only: confirm with Kazakhstan's national tax authority. OECD 2026: central statutory CIT 20%, combined (central+sub-central) 20%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Kazakhstan's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  LC: {
    countryCode: 'LC',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.3,
        note: "Indicative only: confirm with Saint Lucia's national tax authority. OECD 2026: central statutory CIT 30%, combined (central+sub-central) 30%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Saint Lucia's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  LI: {
    countryCode: 'LI',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.125,
        note: "Indicative only: confirm with Liechtenstein's national tax authority. OECD 2026: central statutory CIT 12.5%, combined (central+sub-central) 12.5%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Liechtenstein's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  LK: {
    countryCode: 'LK',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.3,
        note: "Indicative only: confirm with Sri Lanka's national tax authority. OECD 2026: central statutory CIT 30%, combined (central+sub-central) 30%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Sri Lanka's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  LR: {
    countryCode: 'LR',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Liberia's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Liberia's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  LT: {
    countryCode: 'LT',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.17,
        note: "Indicative only: confirm with Lithuania's national tax authority. OECD-only: 17% for 2026 (16% in 2025; increase from 2026-01-01 per OECD series). National sources (vmi.lt, finmin.lrv.lt) were blocked by a Cloudflare challenge; e-seimas consolidated law not located. | Cross-check: OECD 2026: central statutory CIT 17%, combined (central+sub-central) 17%; small-business combined 7% Reduced rate 7%, not modelled as a small-company rate: OECD 'targeted at small business' rate; Lithuanian small-entity conditions (employee and revenue thresholds, 0% in first period) not read on an official source.",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Lithuania's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  LU: {
    countryCode: 'LU',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.16,
        note: "Indicative only: confirm with Luxembourg's national tax authority. OECD 2026: central statutory CIT 17.12%, combined (central+sub-central) 23.87%; sub-central CIT 6.75%; central rate excluding surtax 16%; small-business combined 21.73% Reduced rate 14.98%, not modelled as a small-company rate: OECD 'targeted at small business' central rate; qualifying conditions not stated in OECD data.",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Luxembourg's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  LV: {
    countryCode: 'LV',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.2,
        note: "Indicative only: confirm with Latvia's national tax authority. OECD-only: 20% (Latvia taxes distributed profits; 20% of gross distribution = 20/80 of net). OECD's 'targeted at small business' series shows 25% for Latvia, which is higher than the general rate and probably reflects a separate small-business regime; not recorded as a reduced rate. National source (vid.gov.lv) unreachable. | Cross-check: OECD 2026: central statutory CIT 20%, combined (central+sub-central) 20%; small-business combined 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Latvia's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  MA: {
    countryCode: 'MA',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.35,
        note: "Indicative only: confirm with Morocco's national tax authority. OECD 2026: central statutory CIT 35%, combined (central+sub-central) 35%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Morocco's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  MC: {
    countryCode: 'MC',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Monaco's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Monaco's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  MD: {
    countryCode: 'MD',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.12,
        note: "Indicative only: confirm with Moldova's national tax authority. OECD 2026: central statutory CIT 12%, combined (central+sub-central) 12%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Moldova's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  ME: {
    countryCode: 'ME',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.15,
        note: "Indicative only: confirm with Montenegro's national tax authority. OECD 2026: central statutory CIT 15%, combined (central+sub-central) 15%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Montenegro's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  MK: {
    countryCode: 'MK',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.1,
        note: "Indicative only: confirm with North Macedonia's national tax authority. OECD 2026: central statutory CIT 10%, combined (central+sub-central) 10%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with North Macedonia's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  MN: {
    countryCode: 'MN',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Mongolia's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Mongolia's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  MO: {
    countryCode: 'MO',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.12,
        note: "Indicative only: confirm with Macao (China)'s national tax authority. OECD 2026: central statutory CIT 12%, combined (central+sub-central) 12%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Macao (China)'s national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  MR: {
    countryCode: 'MR',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Mauritania's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Mauritania's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  MT: {
    countryCode: 'MT',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.35,
        note: "Indicative only: confirm with Malta's national tax authority. OECD 2026: central statutory CIT 35%, combined (central+sub-central) 35%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Malta's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  MU: {
    countryCode: 'MU',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.15,
        note: "Indicative only: confirm with Mauritius's national tax authority. OECD 2026: central statutory CIT 15%, combined (central+sub-central) 15%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Mauritius's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  MV: {
    countryCode: 'MV',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.15,
        note: "Indicative only: confirm with Maldives's national tax authority. OECD 2026: central statutory CIT 15%, combined (central+sub-central) 15%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Maldives's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  MX: {
    countryCode: 'MX',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.3,
        note: "Indicative only: confirm with Mexico's national tax authority. OECD 2026: central statutory CIT 30%, combined (central+sub-central) 30%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Mexico's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  MY: {
    countryCode: 'MY',
    authorityName: "Inland Revenue Board of Malaysia (LHDN / HASiL)",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.24,
        note: "24% for companies other than qualifying SMEs. LHDN page lists rates only up to YA 2023-2024; OECD 2026 also shows 24%, so no change is indicated, but the YA 2025/2026 rate table was not read on an official page. Malaysia has enacted Pillar Two (IIR and DTT) from 2025 (not read this session). | Cross-check: OECD 2026: central statutory CIT 24%, combined (central+sub-central) 24% Reduced rate 15%, not modelled as a small-company rate: Resident company with paid-up capital not more than RM2.5 million and gross business income not more than RM50 million: 15% on first RM150,000, 17% on RM150,001-RM600,000, 24% on the balance (table shown for YA 2023-2024).",
        // Inland Revenue Board of Malaysia (LHDN / HASiL): 'Year Assessment 2023 - 2024: Company with paid up capital not more than RM2.5 million and gross business income of not more than RM50 million On first RM150,000 (15%), RM150,001 to RM600,000 (17%), RM600,001 and Subsequent Balance (24%); Company other than the above category (24%)'
        // also OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0) (https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023): OECD Table II.1 2026; national source not read
        source: "https://www.hasil.gov.my/en/syarikat/kadar-cukai-syarikat/",
        sourceAuthority: "Inland Revenue Board of Malaysia (LHDN / HASiL)",
        citationDate: '2026-10-06',
        verified: true,
        verificationNote: "Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  NA: {
    countryCode: 'NA',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.32,
        note: "Indicative only: confirm with Namibia's national tax authority. OECD 2026: central statutory CIT 32%, combined (central+sub-central) 32%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Namibia's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  NG: {
    countryCode: 'NG',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.3,
        note: "Indicative only: confirm with Nigeria's national tax authority. 30% general rate from OECD Table II.1 2026 only; the Nigeria Tax Act 2025 (effective 2026-01-01) text could not be read (NRS site is client-rendered). Small companies are also exempt from the new 4% development levy (applies to other companies) per the Committee. NTA 2025 also introduced a 15% minimum effective tax rate for large companies/MNE group members (secondary sources; not confirmed). | Cross-check: OECD 2026: central statutory CIT 30%, combined (central+sub-central) 30% Reduced rate 0%, not modelled as a small-company rate: Small companies: turnover not more than NGN 100 million and total fixed assets not more than NGN 250 million (professional-services firms excluded), from 1 January 2026 under the Nigeria Tax Act 2025 - per Presidential Fiscal Policy and Tax Reforms Committee; some secondary sources cite a NGN 50m threshold in the Act text - not confirmed on the Act itself.",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        // also Presidential Fiscal Policy and Tax Reforms Committee (Nigeria) (https://www.fiscalreforms.ng/news/fifty-50-tax-exemptions-and-reliefs-that-will-benefit-the-masses-under-the-new-tax-reform-laws-effective-from-1-january-2026): 'Small companies (turnover not more than ₦100 million and total fixed assets not more than ₦250 million) pay 0% tax'; 'Small companies are exempt from 4% development levy'. Government reform committee, not the tax authority or the Act itself, so not marked verified.
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "Headline rate from OECD Corporate Tax Statistics (Table II.1, 2026); national source not read. The small-company detail is from Presidential Fiscal Policy and Tax Reforms Committee (Nigeria), not the tax authority or the law itself. Confirm with Nigeria's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  NL: {
    countryCode: 'NL',
    authorityName: "Belastingdienst (Netherlands Tax Administration)",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2022-01-01',
        standardRate: 0.258,
        note: "Two brackets: 19.0% up to EUR 200,000 and 25.8% above, identical for 2023-2026. Netherlands applies Pillar Two (Wet minimumbelasting 2024) - not read this session. | Cross-check: OECD 2026: central statutory CIT 25.8%, combined (central+sub-central) 25.8%; small-business combined 19% Reduced rate 19%, not modelled as a small-company rate: First EUR 200,000 of taxable amount (band applies to all companies).",
        // Belastingdienst (Netherlands Tax Administration): 'De tarieven voor de vennootschapsbelasting in 2026, 2025, 2024 en 2023 zijn: tot en met € 200.000 19,0%; boven € 200.000 25,8%'. effectiveFrom 2022-01-01 is when 25.8% was introduced (not stated on page).
        // also OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0) (https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023): OECD Table II.1 2026; national source not read
        source: "https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/winst/vennootschapsbelasting/tarieven_vennootschapsbelasting",
        sourceAuthority: "Belastingdienst (Netherlands Tax Administration)",
        citationDate: '2026-10-06',
        verified: true,
      },
    ],
  },
  NO: {
    countryCode: 'NO',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.22,
        note: "Indicative only: confirm with Norway's national tax authority. OECD 2026: central statutory CIT 22%, combined (central+sub-central) 22%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Norway's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  NZ: {
    countryCode: 'NZ',
    authorityName: "Inland Revenue (Te Tari Taake)",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.28,
        note: "Flat 28% for most companies; Māori authorities 17.5%. No small-business company rate. | Cross-check: OECD 2026: central statutory CIT 28%, combined (central+sub-central) 28%",
        // Inland Revenue (Te Tari Taake): Rate table: 'Most companies | 28%'; Māori authorities 17.5%. Effective date not stated on page.
        // also OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0) (https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023): OECD Table II.1 2026; national source not read
        source: "https://www.ird.govt.nz/income-tax/income-tax-for-businesses-and-organisations/tax-rates-for-businesses",
        sourceAuthority: "Inland Revenue (Te Tari Taake)",
        citationDate: '2026-10-06',
        verified: true,
        verificationNote: "Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  OM: {
    countryCode: 'OM',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.15,
        note: "Indicative only: confirm with Oman's national tax authority. OECD 2026: central statutory CIT 15%, combined (central+sub-central) 15%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Oman's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  PA: {
    countryCode: 'PA',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Panama's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Panama's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  PE: {
    countryCode: 'PE',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.295,
        note: "Indicative only: confirm with Peru's national tax authority. OECD 2026: central statutory CIT 29.5%, combined (central+sub-central) 29.5%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Peru's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  PG: {
    countryCode: 'PG',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.3,
        note: "Indicative only: confirm with Papua New Guinea's national tax authority. OECD 2026: central statutory CIT 30%, combined (central+sub-central) 30%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Papua New Guinea's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  PH: {
    countryCode: 'PH',
    authorityName: "Bureau of Internal Revenue - Revenue Regulations No. 5-2021",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2020-07-01',
        standardRate: 0.25,
        smallCompanyRate: 0.2,
        note: "CREATE Act (RA 11534) rates effective 1 July 2020. Minimum Corporate Income Tax 2% of gross income from 1 July 2023 (1% from July 2020 to June 2023), payable from the 4th taxable year if higher than regular tax. Resident foreign corporations 25%. CREATE MORE (RA 12066, 2024) did not change the regular rate (not read this session). | Cross-check: OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25% Small-company rate 20%: Domestic corporations with net taxable income not exceeding PHP 5,000,000 AND total assets not exceeding PHP 100,000,000 (excluding land on which office, plant and equipment are situated).",
        // Bureau of Internal Revenue - Revenue Regulations No. 5-2021: Matrix: Domestic corporations in general 25% effective July 1, 2020; corporations with NTI not exceeding P5,000,000 and total assets not exceeding P100,000,000 - 20% effective July 1, 2020; MCIT 2% from July 1, 2023
        // also OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0) (https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023): OECD Table II.1 2026; national source not read
        source: "https://bir-cdn.bir.gov.ph/local/pdf/RR%20No.%205-2021.pdf",
        sourceAuthority: "Bureau of Internal Revenue - Revenue Regulations No. 5-2021",
        citationDate: '2026-10-06',
        verified: true,
      },
    ],
  },
  PK: {
    countryCode: 'PK',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.29,
        note: "Indicative only: confirm with Pakistan's national tax authority. OECD 2026: central statutory CIT 29%, combined (central+sub-central) 29%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Pakistan's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  PL: {
    countryCode: 'PL',
    authorityName: "Ministry of Finance Poland - podatki.gov.pl (Stawki i limity, CIT klasyczny)",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.19,
        smallCompanyRate: 0.09,
        note: "Basic CIT 19%; 9% preferential rate as per condition (excluding capital gains, taxed at 19%). Other: 10% minimum tax, 5% IP Box, special bank rates from 2026, optional 'Estonian CIT' (tax on distributed profits). Pillar Two status not checked. | Cross-check: OECD 2026: central statutory CIT 19%, combined (central+sub-central) 19% Small-company rate 9%: Small taxpayers (sales revenue not above EUR 2m equivalent) and taxpayers starting a business, where revenue in the tax year does not exceed EUR 2 million; not available to some restructured entities.",
        // Ministry of Finance Poland - podatki.gov.pl (Stawki i limity, CIT klasyczny): Updated 24.06.2026: 'Podstawowe stawki wynoszą: 19% podstawy opodatkowania, 9% podstawy opodatkowania - w przypadku gdy osiągasz przychody, które nie przekroczyły w roku podatkowym 2 mln euro oraz jesteś małym podatnikiem lub rozpoczynającym działalność'; '10% - podatek minimalny'
        // also OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0) (https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023): OECD Table II.1 2026; national source not read
        source: "https://www.podatki.gov.pl/podatki-firmowe/cit/cit-klasyczny/stawki-i-limity",
        sourceAuthority: "Ministry of Finance Poland - podatki.gov.pl (Stawki i limity, CIT klasyczny)",
        citationDate: '2026-10-06',
        verified: true,
        verificationNote: "Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  PT: {
    countryCode: 'PT',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.19,
        note: "Indicative only: confirm with Portugal's national tax authority. OECD 2026: central statutory CIT 28%, combined (central+sub-central) 29.5%; sub-central CIT 1.5%; central rate excluding surtax 19%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Portugal's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  PY: {
    countryCode: 'PY',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.1,
        note: "Indicative only: confirm with Paraguay's national tax authority. OECD 2026: central statutory CIT 10%, combined (central+sub-central) 10%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Paraguay's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  QA: {
    countryCode: 'QA',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.1,
        note: "Indicative only: confirm with Qatar's national tax authority. OECD 2026: central statutory CIT 10%, combined (central+sub-central) 10%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Qatar's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  RO: {
    countryCode: 'RO',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.16,
        note: "Indicative only: confirm with Romania's national tax authority. OECD 2026: central statutory CIT 16%, combined (central+sub-central) 16%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Romania's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  RS: {
    countryCode: 'RS',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.15,
        note: "Indicative only: confirm with Serbia's national tax authority. OECD 2026: central statutory CIT 15%, combined (central+sub-central) 15%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Serbia's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  RU: {
    countryCode: 'RU',
    authorityName: "Federal Tax Service of Russia (nalog.gov.ru)",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2025-01-01',
        standardRate: 0.25,
        note: "Basic profit tax rate 25% (from 2025): 8% to the federal budget in 2025-2030 and 17% to regional budgets in 2025-2030 (statutory split 7%/18% otherwise). Although part is credited to regions, it is a single federal tax under Tax Code art. 284, so generalRate is the full 25%. Regions may reduce their part for certain taxpayers; special rates for SEZ residents, IT companies, securities income (30%) etc.",
        // Federal Tax Service of Russia (nalog.gov.ru): 'Основная ставка 25%: 7% в федеральный бюджет (8% в 2025-2030 годах); 18% в бюджет субъекта РФ (17% в 2017-2030 годах)' (basic rate 25%: federal 8% in 2025-2030, regional 17%)
        source: "https://www.nalog.gov.ru/rn77/taxation/taxes/profitul/",
        sourceAuthority: "Federal Tax Service of Russia (nalog.gov.ru)",
        citationDate: '2026-10-06',
        verified: true,
      },
    ],
  },
  SA: {
    countryCode: 'SA',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.2,
        note: "Indicative only: confirm with Saudi Arabia's national tax authority. OECD 2026: central statutory CIT 20%, combined (central+sub-central) 20%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Saudi Arabia's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  SC: {
    countryCode: 'SC',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Seychelles's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Seychelles's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  SE: {
    countryCode: 'SE',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.206,
        note: "Indicative only: confirm with Sweden's national tax authority. OECD 2026: central statutory CIT 20.6%, combined (central+sub-central) 20.6%; sub-central CIT 20.6%; central rate excluding surtax 20.6%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Sweden's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  SG: {
    countryCode: 'SG',
    authorityName: "Inland Revenue Authority of Singapore",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.17,
        note: "Flat 17% on chargeable income for local and foreign companies. No reduced rate, but partial tax exemption (75% of first S$10,000 and 50% of next S$190,000 of normal chargeable income) and start-up exemption (75% of first S$100,000 and 50% of next S$100,000 for first 3 YAs). Budget 2026: CIT Rebate of 40% of tax payable for YA 2026 (with cash-grant minimum S$1,500, cap S$30,000; IRAS page notes a later update). Pillar Two (MTT/DTT) not checked on an official page this session. | Cross-check: OECD 2026: central statutory CIT 17%, combined (central+sub-central) 17%",
        // Inland Revenue Authority of Singapore: 'Your company is taxed at a flat rate of 17% of its chargeable income. This applies to both local and foreign companies.' Partial and start-up exemption tables on same page.
        // also OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0) (https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023): OECD Table II.1 2026; national source not read
        source: "https://www.iras.gov.sg/taxes/corporate-income-tax/basics-of-corporate-income-tax/corporate-income-tax-rate-rebates-and-tax-exemption-schemes",
        sourceAuthority: "Inland Revenue Authority of Singapore",
        citationDate: '2026-10-06',
        verified: true,
        verificationNote: "Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  SI: {
    countryCode: 'SI',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.22,
        note: "Indicative only: confirm with Slovenia's national tax authority. OECD 2026: central statutory CIT 22%, combined (central+sub-central) 22%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Slovenia's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  SK: {
    countryCode: 'SK',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.24,
        note: "Indicative only: confirm with Slovakia's national tax authority. OECD 2026: central statutory CIT 24%, combined (central+sub-central) 24%; small-business combined 10% Reduced rate 10%, not modelled as a small-company rate: OECD 'targeted at small business' central rate; qualifying conditions not stated in OECD data.",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Slovakia's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  SL: {
    countryCode: 'SL',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Sierra Leone's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Sierra Leone's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  SM: {
    countryCode: 'SM',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.18,
        note: "Indicative only: confirm with San Marino's national tax authority. OECD 2026: central statutory CIT 18%, combined (central+sub-central) 18%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with San Marino's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  SN: {
    countryCode: 'SN',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.3,
        note: "Indicative only: confirm with Senegal's national tax authority. OECD 2026: central statutory CIT 30%, combined (central+sub-central) 30%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Senegal's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  SZ: {
    countryCode: 'SZ',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Eswatini's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Eswatini's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  TG: {
    countryCode: 'TG',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.27,
        note: "Indicative only: confirm with Togo's national tax authority. OECD 2026: central statutory CIT 27%, combined (central+sub-central) 27%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Togo's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  TH: {
    countryCode: 'TH',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.2,
        note: "Indicative only: confirm with Thailand's national tax authority. OECD 2026: central statutory CIT 20%, combined (central+sub-central) 20%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Thailand's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  TN: {
    countryCode: 'TN',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.2,
        note: "Indicative only: confirm with Tunisia's national tax authority. OECD 2026: central statutory CIT 20%, combined (central+sub-central) 20%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Tunisia's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  TR: {
    countryCode: 'TR',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Turkiye's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) n/a%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Turkiye's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  TT: {
    countryCode: 'TT',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.3,
        note: "Indicative only: confirm with Trinidad and Tobago's national tax authority. OECD 2026: central statutory CIT 30%, combined (central+sub-central) 30%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Trinidad and Tobago's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  TW: {
    countryCode: 'TW',
    authorityName: "Laws & Regulations Database of the ROC (Ministry of Justice) - Income Tax Act art. 5",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2018-01-01',
        standardRate: 0.2,
        note: "Profit-seeking enterprise income tax 20% from taxable year 2018 onward (Income Tax Act art. 5; transitional 18%/19% in 2018-2019 for income NT$120,001-500,000). A 5% surtax on undistributed earnings (art. 66-9) and an alternative minimum tax (Income Basic Tax Act) also apply - not read this session. Not covered by OECD Table II.1. Reduced rate 0%, not modelled as a small-company rate: Total taxable income of NT$120,000 or less is exempt; above NT$120,000 the 20% rate applies but tax payable may not exceed half of the taxable income above NT$120,000.",
        // Laws & Regulations Database of the ROC (Ministry of Justice) - Income Tax Act art. 5: '1. If the total taxable income of a profit-seeking enterprise is NT$120,000 or less, the profit-seeking enterprise is exempt from tax. 2. If ... more than NT$120,000, the income tax rate shall be 20%. However, the income tax payable shall not exceed one half of the portion of taxable income more than NT$120,000.'
        source: "https://law.moj.gov.tw/ENG/LawClass/LawAll.aspx?pcode=G0340003",
        sourceAuthority: "Laws & Regulations Database of the ROC (Ministry of Justice) - Income Tax Act art. 5",
        citationDate: '2026-10-06',
        verified: true,
      },
    ],
  },
  UA: {
    countryCode: 'UA',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.18,
        note: "Indicative only: confirm with Ukraine's national tax authority. OECD 2026: central statutory CIT 18%, combined (central+sub-central) 18%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Ukraine's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  UG: {
    countryCode: 'UG',
    authorityName: "Uganda Revenue Authority",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.3,
        note: "Companies (resident and non-resident) taxed at 30% of chargeable income. Small businesses below the presumptive-tax turnover threshold may be taxed on turnover instead (thresholds/rates not read). Not covered by OECD Table II.1.",
        // Uganda Revenue Authority: 'The current rate of tax applicable to companies is 30% charged on the profits from business (Chargeable Income). The chargeable income for both resident and non-resident companies is taxed at this rate.'
        source: "https://ura.go.ug/en/corporation-tax/",
        sourceAuthority: "Uganda Revenue Authority",
        citationDate: '2026-10-06',
        verified: true,
        verificationNote: "Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  UY: {
    countryCode: 'UY',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Uruguay's national tax authority. OECD 2026: central statutory CIT 25%, combined (central+sub-central) 25%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Uruguay's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  UZ: {
    countryCode: 'UZ',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.15,
        note: "Indicative only: confirm with Uzbekistan's national tax authority. OECD 2026: central statutory CIT 15%, combined (central+sub-central) 15%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Uzbekistan's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  VC: {
    countryCode: 'VC',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.28,
        note: "Indicative only: confirm with Saint Vincent and the Grenadines's national tax authority. OECD 2026: central statutory CIT 28%, combined (central+sub-central) 28%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Saint Vincent and the Grenadines's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  VN: {
    countryCode: 'VN',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.2,
        note: "Indicative only: confirm with Viet Nam's national tax authority. OECD 2026: central statutory CIT 20%, combined (central+sub-central) 20%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Viet Nam's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  WS: {
    countryCode: 'WS',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.27,
        note: "Indicative only: confirm with Samoa's national tax authority. OECD 2026: central statutory CIT 27%, combined (central+sub-central) 27%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Samoa's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  ZA: {
    countryCode: 'ZA',
    authorityName: "South African Revenue Service",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.27,
        note: "27% for years of assessment ending on or after 31 March 2023 (previously 28%). Budget 25 February 2026: no change for YAs ending 1 April 2026 - 31 March 2027. smallBusiness.rate shows the main reduced band (21%); lower bands 0% and 7%. | Cross-check: OECD 2026: central statutory CIT 27%, combined (central+sub-central) 27% Reduced rate 21%, not modelled as a small-company rate: Small business corporations (qualifying SBC): progressive scale for years of assessment ending 1 Apr 2026 - 31 Mar 2027: 0% up to R99,000; 7% of R99,001-R365,000; R18,620 + 21% of R365,001-R550,000; R57,470 + 27% above R550,000.",
        // South African Revenue Service: Companies: years of assessment ending 1 April 2026 to 31 March 2027 - 27%; 31 March 2023 to 31 March 2024 - 27%; SBC table for 2026-27 quoted in smallBusiness
        // also OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0) (https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023): OECD Table II.1 2026; national source not read
        source: "https://www.sars.gov.za/tax-rates/income-tax/companies-trusts-and-small-business-corporations-sbc/",
        sourceAuthority: "South African Revenue Service",
        citationDate: '2026-10-06',
        verified: true,
        verificationNote: "Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  ZM: {
    countryCode: 'ZM',
    authorityName: "OECD Corporate Tax Statistics",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.3,
        note: "Indicative only: confirm with Zambia's national tax authority. OECD 2026: central statutory CIT 30%, combined (central+sub-central) 30%",
        // OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0): OECD Table II.1 2026; national source not read
        source: "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT,2.0/all?startPeriod=2023",
        sourceAuthority: "OECD Corporate Tax Statistics, Table II.1 (dataflow DSD_TAX_CIT@DF_CIT v2.0)",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "OECD Corporate Tax Statistics (Table II.1, 2026) only; national source not read. Confirm with Zambia's national tax authority. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
  ZW: {
    countryCode: 'ZW',
    authorityName: "Zimbabwe Revenue Authority (ZIMRA) - Corporate tax rates",
    label: 'Corporate income tax',
    rates: [
      {
        effectiveFrom: '2026-01-01',
        standardRate: 0.25,
        note: "Indicative only: confirm with Zimbabwe's national tax authority. ZIMRA's corporate 'Tax Rates' page (undated) lists 25% for income of a company or trust (Finance Act s.14(2)(c)) and 0% for licensed investors in their first five years. Treat as UNCERTAIN: the page carries no date and Zimbabwe also levies a 3% AIDS levy on company tax; secondary sources indicate the rate was cut to 24% (24.72% with AIDS levy) from 2020 - not confirmed on an official dated source. Not covered by OECD Table II.1.",
        // Zimbabwe Revenue Authority (ZIMRA) - Corporate tax rates: Official page, read: 'Income of company or trust | 14(2c) | 25%'. Marked verified:false because the page is undated and may be stale for 2026.
        source: "https://www.zimra.co.zw/domestic-taxes/corporate/tax-rates",
        sourceAuthority: "Zimbabwe Revenue Authority (ZIMRA) - Corporate tax rates",
        citationDate: '2026-10-06',
        verified: false,
        verificationNote: "Read on Zimbabwe Revenue Authority (ZIMRA) - Corporate tax rates but not verified: Official page, read: 'Income of company or trust | 14(2c) | 25%'. Marked verified:false because the page is undated and may be stale for 2026. Start date not stated in the source; set anchored at 2026-01-01 as \"in force at least since\" (the rate was read for 2026).",
      },
    ],
  },
};

/**
 * Jurisdictions researched on 2026-10-06 for which no company-tax figure could
 * be read on a national source or in OECD Table II.1. Deliberately given no
 * rate set: coverage() reports them as not covered rather than guessing.
 */
export const COMPANY_TAX_NOT_COVERED: Readonly<Record<string, string>> = {
  AF: "Afghanistan",
  BD: "Bangladesh",
  BI: "Burundi",
  BO: "Bolivia",
  BY: "Belarus",
  CF: "Central African Republic",
  CU: "Cuba",
  DZ: "Algeria",
  ER: "Eritrea",
  ET: "Ethiopia",
  FM: "Micronesia (Federated States of)",
  GM: "Gambia",
  GN: "Guinea",
  GQ: "Equatorial Guinea",
  GW: "Guinea-Bissau",
  GY: "Guyana",
  IQ: "Iraq",
  IR: "Iran",
  KG: "Kyrgyzstan",
  KH: "Cambodia",
  KI: "Kiribati",
  KM: "Comoros",
  KP: "Korea (Democratic People's Republic of)",
  LA: "Lao People's Democratic Republic",
  LB: "Lebanon",
  LS: "Lesotho",
  LY: "Libya",
  MG: "Madagascar",
  MH: "Marshall Islands",
  ML: "Mali",
  MM: "Myanmar",
  MW: "Malawi",
  MZ: "Mozambique",
  NE: "Niger",
  NI: "Nicaragua",
  NP: "Nepal",
  NR: "Nauru",
  PW: "Palau",
  RW: "Rwanda",
  SB: "Solomon Islands",
  SD: "Sudan",
  SO: "Somalia",
  SR: "Suriname",
  SS: "South Sudan",
  ST: "Sao Tome and Principe",
  SV: "El Salvador",
  SY: "Syrian Arab Republic",
  TD: "Chad",
  TJ: "Tajikistan",
  TL: "Timor-Leste",
  TM: "Turkmenistan",
  TO: "Tonga",
  TV: "Tuvalu",
  TZ: "Tanzania",
  VE: "Venezuela",
  VU: "Vanuatu",
  XK: "Kosovo",
  YE: "Yemen",
};
