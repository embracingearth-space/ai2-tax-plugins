/**
 * EU VAT Return Template - ai2fin.com
 * Covers EU + EEA + EFTA countries: DE, FR, IT, ES, NL, IE, AT, BE, PT, PL, SE, FI, DK, NO, CH
 * Reference: EU Council Directive 2006/112/EC
 * ARCHITECTURE: Factory function creates country-specific plugin with correct rates,
 *   local terminology, authority URLs, and financial year.
 *   All EU countries: Jan-Dec FY, quarterly or monthly filing.
 *   NO (EEA) and CH (EFTA) are included as their VAT systems are structurally identical.
 */

import type {
  TaxFilingPlugin,
  FormSection,
  FieldValues,
  CalculatedFields,
  AggregationMapping,
  ValidationResult,
  RoundingConfig,
  ExportFormat,
  ExportOutput,
} from '../types';
import { getStandardRateAsOf } from '../data/rateLedger';

// Local tax names + a FALLBACK standard rate per country. The authoritative,
// effective-dated standard rate is resolved from the single-source rate ledger
// (getStandardRateAsOf); these rates are only used when a country has no ledger
// row yet.
const EU_CONFIG: Record<
  string,
  {
    taxName: string;
    rate: number;
    authority: string;
    authorityFull: string;
    portalUrl: string;
  }
> = {
  DE: {
    taxName: 'Umsatzsteuer (USt)',
    rate: 0.19,
    authority: 'BZSt',
    authorityFull: 'Bundeszentralamt für Steuern',
    portalUrl: 'https://www.elster.de',
  },
  FR: {
    taxName: 'TVA',
    rate: 0.2,
    authority: 'DGFiP',
    authorityFull: 'Direction Générale des Finances Publiques',
    portalUrl: 'https://www.impots.gouv.fr',
  },
  IT: {
    taxName: 'IVA',
    rate: 0.22,
    authority: 'AdE',
    authorityFull: 'Agenzia delle Entrate',
    portalUrl: 'https://www.agenziaentrate.gov.it',
  },
  ES: {
    taxName: 'IVA',
    rate: 0.21,
    authority: 'AEAT',
    authorityFull: 'Agencia Estatal de Administración Tributaria',
    portalUrl: 'https://www.agenciatributaria.es',
  },
  NL: {
    taxName: 'BTW',
    rate: 0.21,
    authority: 'Belastingdienst',
    authorityFull: 'Belastingdienst',
    portalUrl: 'https://www.belastingdienst.nl',
  },
  IE: {
    taxName: 'VAT',
    rate: 0.23,
    authority: 'Revenue',
    authorityFull: 'Revenue Commissioners',
    portalUrl: 'https://www.revenue.ie',
  },
  AT: {
    taxName: 'USt',
    rate: 0.2,
    authority: 'BMF',
    authorityFull: 'Bundesministerium für Finanzen',
    portalUrl: 'https://finanzonline.bmf.gv.at',
  },
  BE: {
    taxName: 'TVA/BTW',
    rate: 0.21,
    authority: 'SPF',
    authorityFull: 'Service Public Fédéral Finances',
    portalUrl: 'https://finances.belgium.be',
  },
  PT: {
    taxName: 'IVA',
    rate: 0.23,
    authority: 'AT',
    authorityFull: 'Autoridade Tributária e Aduaneira',
    portalUrl: 'https://www.portaldasfinancas.gov.pt',
  },
  PL: {
    taxName: 'VAT',
    rate: 0.23,
    authority: 'KAS',
    authorityFull: 'Krajowa Administracja Skarbowa',
    portalUrl: 'https://www.podatki.gov.pl',
  },
  SE: {
    taxName: 'Moms',
    rate: 0.25,
    authority: 'Skatteverket',
    authorityFull: 'Skatteverket (Swedish Tax Agency)',
    portalUrl: 'https://www.skatteverket.se',
  },
  FI: {
    taxName: 'ALV (Arvonlisävero)',
    rate: 0.255,
    authority: 'Vero',
    authorityFull: 'Verohallinto (Finnish Tax Administration)',
    portalUrl: 'https://www.vero.fi',
  },
  DK: {
    taxName: 'Moms',
    rate: 0.25,
    authority: 'Skattestyrelsen',
    authorityFull: 'Skattestyrelsen (Danish Tax Agency)',
    portalUrl: 'https://skat.dk',
  },
  NO: {
    taxName: 'MVA (Merverdiavgift)',
    rate: 0.25,
    authority: 'Skatteetaten',
    authorityFull: 'Skatteetaten (Norwegian Tax Administration)',
    portalUrl: 'https://www.skatteetaten.no',
  },
  CH: {
    taxName: 'MWST/TVA/IVA',
    rate: 0.081,
    authority: 'FTA/AFC',
    authorityFull: 'Federal Tax Administration (Eidgenössische Steuerverwaltung)',
    portalUrl: 'https://www.estv.admin.ch',
  },
  GR: {
    taxName: 'ΦΠΑ (FPA)',
    rate: 0.24,
    authority: 'AADE',
    authorityFull: 'Independent Authority for Public Revenue (ΑΑΔΕ)',
    portalUrl: 'https://www.aade.gr',
  },
  CZ: {
    taxName: 'DPH',
    rate: 0.21,
    authority: 'FS',
    authorityFull: 'Finanční správa České republiky',
    portalUrl: 'https://www.financnisprava.cz',
  },
  HU: {
    taxName: 'ÁFA',
    rate: 0.27,
    authority: 'NAV',
    authorityFull: 'Nemzeti Adó- és Vámhivatal',
    portalUrl: 'https://nav.gov.hu',
  },
  RO: {
    taxName: 'TVA',
    rate: 0.21, // 21% from 1 Aug 2025 (Law 141/2025); was 19%
    authority: 'ANAF',
    authorityFull: 'Agenția Națională de Administrare Fiscală',
    portalUrl: 'https://www.anaf.ro',
  },
  HR: {
    taxName: 'PDV',
    rate: 0.25,
    authority: 'PU',
    authorityFull: 'Porezna uprava',
    portalUrl: 'https://www.porezna-uprava.hr',
  },
  BG: {
    taxName: 'ДДС (DDS)',
    rate: 0.20,
    authority: 'NRA',
    authorityFull: 'National Revenue Agency (НАП)',
    portalUrl: 'https://nra.bg',
  },
  SK: {
    taxName: 'DPH',
    rate: 0.23,
    authority: 'FS',
    authorityFull: 'Finančná správa Slovenskej republiky',
    portalUrl: 'https://www.financnasprava.sk',
  },
  LT: {
    taxName: 'PVM',
    rate: 0.21,
    authority: 'VMI',
    authorityFull: 'Valstybinė mokesčių inspekcija',
    portalUrl: 'https://www.vmi.lt',
  },
  LV: {
    taxName: 'PVN',
    rate: 0.21,
    authority: 'VID',
    authorityFull: 'Valsts ieņēmumu dienests',
    portalUrl: 'https://www.vid.gov.lv',
  },
  EE: {
    taxName: 'KM (Käibemaks)',
    rate: 0.24, // 24% from 1 Jul 2025 (permanent); was 22%
    authority: 'EMTA',
    authorityFull: 'Maksu- ja Tolliamet',
    portalUrl: 'https://www.emta.ee',
  },
  SI: {
    taxName: 'DDV',
    rate: 0.22,
    authority: 'FURS',
    authorityFull: 'Finančna uprava Republike Slovenije',
    portalUrl: 'https://www.fu.gov.si',
  },
  LU: {
    taxName: 'TVA',
    rate: 0.17,
    authority: 'ACD',
    authorityFull: 'Administration des contributions directes',
    portalUrl: 'https://impotsdirects.public.lu',
  },
  MT: {
    taxName: 'VAT',
    rate: 0.18,
    authority: 'CFR',
    authorityFull: 'Commissioner for Revenue',
    portalUrl: 'https://cfr.gov.mt',
  },
  CY: {
    taxName: 'ΦΠΑ (VAT)',
    rate: 0.19,
    authority: 'Tax Department',
    authorityFull: 'Tax Department (Τμήμα Φορολογίας)',
    portalUrl: 'https://www.mof.gov.cy/tax',
  },
};

// Effective-dated VAT rates (incl. RO 19→21%, EE 20→22→24%) live in the shared
// single-source ledger (src/data/rateLedger.data.ts), resolved by date via
// getStandardRateAsOf — so this template never keeps a duplicate history table.

function createEUPlugin(code: string): TaxFilingPlugin {
  const config = EU_CONFIG[code] || {
    taxName: 'VAT',
    rate: 0.2,
    authority: 'Tax Authority',
    authorityFull: `${code} Tax Authority`,
    portalUrl: 'https://europa.eu/youreurope/business/taxation/vat/index_en.htm',
  };

  const { taxName, rate, authority, authorityFull, portalUrl } = config;
  // Single source of truth: resolve the current standard rate from the dated
  // ledger, falling back to the EU_CONFIG value if a country has no ledger row.
  const currentRate = getStandardRateAsOf(code) || rate;
  const ratePercent = (currentRate * 100).toFixed(0);

  return {
    countryCode: code,
    displayName: `${taxName} Return`,
    shortName: 'VAT Return',
    authority: {
      name: authority,
      fullName: authorityFull,
      portalUrl,
      helpUrl: 'https://europa.eu/youreurope/business/taxation/vat/index_en.htm',
    },
    taxFamily: 'VAT',
    isFullPlugin: true,

    getFormSchema() {
      return [
        {
          id: 'output',
          title: `${taxName} on Sales (Output)`,
          description: `Report your sales and ${taxName} charged at ${ratePercent}%.`,
          fields: [
            {
              id: 'standard_sales',
              label: `Standard-rated sales (excl. ${taxName})`,
              type: 'currency',
              editable: true,
              required: true,
              autoPopulateFrom: 'income_standard',
              helpText: `Sales at the standard ${ratePercent}% rate`,
            },
            {
              id: 'reduced_sales',
              label: 'Reduced-rate sales',
              type: 'currency',
              editable: true,
              required: false,
              helpText: 'Sales at reduced rates (varies by country)',
            },
            {
              id: 'zero_rated_sales',
              label: 'Zero-rated / exempt sales',
              type: 'currency',
              editable: true,
              required: false,
              helpText: 'Exports, exempt supplies',
            },
            {
              id: 'intra_community_sales',
              label: 'Intra-community supplies',
              type: 'currency',
              editable: true,
              required: false,
              helpText: 'Goods sold to VAT-registered businesses in other EU countries',
            },
            {
              id: 'output_vat',
              label: `${taxName} on sales`,
              type: 'currency',
              calculated: true,
              editable: true,
              required: true,
              helpText: `Standard sales × ${ratePercent}% + reduced rate amounts. Override if needed.`,
            },
          ],
        },
        {
          id: 'input',
          title: `${taxName} on Purchases (Input)`,
          fields: [
            {
              id: 'domestic_purchases',
              label: 'Domestic purchases (excl. VAT)',
              type: 'currency',
              editable: true,
              required: true,
              helpText: 'Business purchases from within the country',
            },
            {
              id: 'intra_community_purchases',
              label: 'Intra-community acquisitions',
              type: 'currency',
              editable: true,
              required: false,
              helpText: 'Goods purchased from EU suppliers (reverse charge applies)',
            },
            {
              id: 'input_vat',
              label: `${taxName} deductible on purchases`,
              type: 'currency',
              editable: true,
              required: true,
              autoPopulateFrom: 'input_vat',
              helpText: `${taxName} paid on eligible business purchases you can reclaim`,
            },
          ],
        },
        {
          id: 'summary',
          title: `Net ${taxName}`,
          fields: [
            {
              id: 'net_vat',
              label: `Net ${taxName} payable / refundable`,
              type: 'currency',
              calculated: true,
              editable: false,
              required: true,
              helpText: 'Output VAT − Input VAT. Positive = pay. Negative = refund.',
            },
          ],
        },
      ];
    },

    getFilingPeriods: () => ({
      monthly: true,
      quarterly: true,
      annual: true,
      defaultFrequency: 'quarterly',
    }),

    getFinancialYearBounds: (y) => ({
      start: new Date(y, 0, 1),
      end: new Date(y, 11, 31),
    }),

    getTerminology: () => ({
      taxName,
      taxAbbrev: taxName.split(' ')[0] || 'VAT',
      salesLabel: 'Sales',
      purchasesLabel: 'Purchases',
      outputTaxLabel: `${taxName} on sales`,
      inputTaxLabel: `${taxName} on purchases`,
    }),

    calculateFields(v: FieldValues) {
      const standardSales = Number(v.standard_sales) || 0;
      const reducedSales = Number(v.reduced_sales) || 0;
      const inputVat = Number(v.input_vat) || 0;

      // Output VAT at the standard rate (reduced rate varies by country, entered
      // manually). The rate is resolved from the single-source effective-dated
      // ledger as of today, so a mid-life change (e.g. RO 19→21%, EE 22→24%)
      // applies from its effective date rather than retroactively.
      const effectiveRate = getStandardRateAsOf(code) || rate;
      const output_vat_calc = Math.round(standardSales * effectiveRate * 100) / 100;

      // Allow override
      const output_vat =
        v.output_vat !== '' && v.output_vat !== undefined && v.output_vat !== null
          ? Math.round(Number(v.output_vat) * 100) / 100
          : output_vat_calc;

      const net_vat = Math.round((output_vat - inputVat) * 100) / 100;

      return { output_vat: output_vat_calc, net_vat };
    },

    getAutoPopulateMapping: (): AggregationMapping[] => [
      { fieldId: 'standard_sales', aggregateKey: 'income_standard' },
      { fieldId: 'input_vat', aggregateKey: 'input_vat' },
      { fieldId: 'domestic_purchases', aggregateKey: 'expenses_domestic' },
    ],

    getRoundingRules: (): RoundingConfig => ({ method: 'nearest', decimals: 2 }),

    validateForm(v: FieldValues): ValidationResult[] {
      const results: ValidationResult[] = [];
      if (Number(v.standard_sales) < 0) {
        results.push({
          fieldId: 'standard_sales',
          message: 'Sales cannot be negative',
          severity: 'error',
        });
      }
      return results;
    },

    getFieldHelp: () => null,

    getSupportedExportFormats: (): ExportFormat[] => [
      { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
      { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
    ],

    async generateExport(v) {
      return {
        data: JSON.stringify(v, null, 2),
        filename: `VAT-${code}-${new Date().toISOString().slice(0, 10)}.json`,
        mimeType: 'application/json',
      };
    },

    getPortalSubmissionInfo: () => ({
      portalUrl,
      submissionMethod: 'manual_upload' as const,
      apiReady: false,
    }),

    hasSubJurisdictions: () => false,
    supportsCustomFields: () => false,
  };
}

export { createEUPlugin };
