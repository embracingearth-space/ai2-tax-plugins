/**
 * Madagascar TVA (Taxe sur la Valeur Ajoutée) Plugin — @ai2/tax-plugins
 * ai2fin.com
 *
 * AUTHORITY: Direction Générale des Impôts (DGI) — www.impots.mg
 * RATE: 20% standard (no reduced rate)
 * FILING: Monthly, due by 15th of following month
 * FY: January 1 – December 31
 *
 * Madagascar requires VAT registration for all businesses (no threshold).
 * B2B reverse charge applies when buyer has valid VAT number.
 * E-invoicing mandate rolling out 2025 (SAFI platform).
 *
 * Reference: Code Général des Impôts de Madagascar
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
  PortalInfo,
  TaxTerminology,
  FilingPeriodConfig,
} from '../types';

const TVA_RATE = 0.20;

/**
 * Madagascar TVA fraction: 20/120 = 1/6
 * Used to extract TVA from TVA-inclusive amounts.
 */
function roundMG(n: number): number {
  return Math.round(n);
}

const madagascarPlugin: TaxFilingPlugin = {
  countryCode: 'MG',
  displayName: 'Déclaration de TVA (Madagascar)',
  shortName: 'TVA Return',
  authority: {
    name: 'DGI',
    fullName: 'Direction Générale des Impôts',
    portalUrl: 'https://www.impots.mg',
    helpUrl: 'https://www.impots.mg/accueil',
  },
  taxFamily: 'VAT',
  isFullPlugin: true,

  getFormSchema(): FormSection[] {
    return [
      {
        id: 'sales',
        title: 'Chiffre d\'Affaires / Ventes (Turnover / Sales)',
        description: 'Total des ventes et prestations de services soumises à la TVA',
        fields: [
          {
            id: 'ca_taxable',
            label: 'Chiffre d\'affaires taxable (Taxable turnover incl. TVA)',
            officialLabel: 'CA Taxable',
            helpText: 'Total des ventes taxables TTC — toutes ventes locales de biens et services soumises à la TVA à 20%.',
            type: 'currency',
            editable: true,
            required: true,
            autoPopulateFrom: 'income_total',
          },
          {
            id: 'ca_export',
            label: 'Exportations et ventes exonérées (Exports & exempt sales)',
            officialLabel: 'CA Export/Exonéré',
            helpText: 'Ventes à l\'exportation (taux zéro) et ventes exonérées par la loi.',
            type: 'currency',
            editable: true,
            required: false,
            autoPopulateFrom: 'income_export',
          },
          {
            id: 'ca_net',
            label: 'Chiffre d\'affaires taxable net (Net taxable turnover)',
            officialLabel: 'CA Net',
            type: 'currency',
            calculated: true,
            calculationFormula: 'ca_taxable - ca_export',
            dependsOn: ['ca_taxable', 'ca_export'],
            editable: false,
            required: true,
          },
          {
            id: 'tva_collectee',
            label: 'TVA collectée (TVA on sales)',
            officialLabel: 'TVA Collectée',
            helpText: 'TVA collectée sur les ventes taxables: montant TTC × 20/120 (fraction TVA).',
            type: 'currency',
            calculated: true,
            calculationFormula: 'ca_net × 20/120',
            dependsOn: ['ca_net'],
            editable: false,
            required: true,
          },
        ],
      },
      {
        id: 'purchases',
        title: 'Achats et TVA Déductible (Purchases & Input TVA)',
        description: 'TVA payée sur les achats et charges déductibles',
        fields: [
          {
            id: 'achats_locaux',
            label: 'Achats locaux TTC (Local purchases incl. TVA)',
            officialLabel: 'Achats Locaux',
            helpText: 'Total des achats de biens et services auprès de fournisseurs malgaches, TVA comprise.',
            type: 'currency',
            editable: true,
            required: true,
            autoPopulateFrom: 'expenses_total',
          },
          {
            id: 'achats_import',
            label: 'Importations — TVA payée en douane (Import TVA)',
            officialLabel: 'TVA Import',
            helpText: 'TVA payée à la douane sur les importations de biens.',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: 'achats_investissement',
            label: 'TVA sur immobilisations (TVA on capital goods)',
            officialLabel: 'TVA Immobilisations',
            helpText: 'TVA sur les achats d\'équipements, véhicules et immobilisations.',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: 'tva_deductible',
            label: 'Total TVA déductible (Total input TVA)',
            officialLabel: 'TVA Déductible',
            helpText: 'Somme de la TVA récupérable: achats locaux × 20/120 + TVA import + TVA immobilisations.',
            type: 'currency',
            calculated: true,
            calculationFormula: '(achats_locaux × 20/120) + achats_import + achats_investissement',
            dependsOn: ['achats_locaux', 'achats_import', 'achats_investissement'],
            editable: true,
            required: true,
            autoPopulateFrom: 'expenses_tax_credits',
          },
        ],
      },
      {
        id: 'adjustments',
        title: 'Régularisations (Adjustments)',
        fields: [
          {
            id: 'credit_anterieur',
            label: 'Crédit de TVA reporté du mois précédent (Prior period credit)',
            officialLabel: 'Crédit Antérieur',
            helpText: 'Si la déclaration du mois précédent a donné un crédit de TVA, reportez-le ici.',
            type: 'currency',
            editable: true,
            required: false,
          },
          {
            id: 'autres_ajustements',
            label: 'Autres régularisations (Other adjustments)',
            officialLabel: 'Régularisations',
            type: 'currency',
            editable: true,
            required: false,
          },
        ],
      },
      {
        id: 'summary',
        title: 'Résumé — TVA Nette (Summary — Net TVA)',
        fields: [
          {
            id: 'tva_nette',
            label: 'TVA nette à payer ou crédit (Net TVA payable or credit)',
            officialLabel: 'TVA Nette',
            helpText: 'Positif = TVA à verser au DGI avant le 15 du mois suivant. Négatif = crédit à reporter.',
            type: 'currency',
            calculated: true,
            calculationFormula: 'tva_collectee - tva_deductible - credit_anterieur + autres_ajustements',
            dependsOn: ['tva_collectee', 'tva_deductible', 'credit_anterieur', 'autres_ajustements'],
            editable: false,
            required: true,
          },
          {
            id: 'credit_a_reporter',
            label: 'Crédit à reporter au mois suivant (Credit to carry forward)',
            officialLabel: 'Crédit à Reporter',
            helpText: 'Si TVA nette est négative, ce montant sera reporté sur la prochaine déclaration.',
            type: 'currency',
            calculated: true,
            calculationFormula: 'abs(min(0, tva_nette))',
            dependsOn: ['tva_nette'],
            editable: false,
            required: false,
          },
        ],
      },
    ];
  },

  getFilingPeriods(): FilingPeriodConfig {
    return {
      monthly: true,
      quarterly: false,
      annual: false,
      defaultFrequency: 'monthly',
    };
  },

  getFinancialYearBounds(year: number) {
    return {
      start: new Date(year, 0, 1),  // January 1
      end: new Date(year, 11, 31),  // December 31
    };
  },

  getTerminology(): TaxTerminology {
    return {
      taxName: 'TVA',
      taxAbbrev: 'TVA',
      salesLabel: 'Ventes / Chiffre d\'Affaires',
      purchasesLabel: 'Achats',
      outputTaxLabel: 'TVA Collectée',
      inputTaxLabel: 'TVA Déductible',
    };
  },

  calculateFields(v: FieldValues): CalculatedFields {
    const caTaxable = Number(v.ca_taxable) || 0;
    const caExport = Number(v.ca_export) || 0;
    const achatsLocaux = Number(v.achats_locaux) || 0;
    const achatsImport = Number(v.achats_import) || 0;
    const achatsInvestissement = Number(v.achats_investissement) || 0;
    const creditAnterieur = Number(v.credit_anterieur) || 0;
    const autresAjustements = Number(v.autres_ajustements) || 0;

    const caNet = caTaxable - caExport;
    // TVA fraction for 20%: amount × 20/120 = amount × 1/6
    const tvaCollectee = roundMG((caNet * TVA_RATE) / (1 + TVA_RATE));

    // Input TVA: extract from local purchases + direct import/investment TVA
    const tvaDeductibleCalc = roundMG((achatsLocaux * TVA_RATE) / (1 + TVA_RATE)) + achatsImport + achatsInvestissement;
    // Allow manual override
    const tvaDeductible = (v.tva_deductible !== undefined && v.tva_deductible !== '' && v.tva_deductible !== null)
      ? Number(v.tva_deductible)
      : tvaDeductibleCalc;

    const tvaNette = roundMG(tvaCollectee - tvaDeductible - creditAnterieur + autresAjustements);
    const creditAReporter = tvaNette < 0 ? Math.abs(tvaNette) : 0;

    return {
      ca_net: caNet,
      tva_collectee: tvaCollectee,
      tva_deductible: roundMG(tvaDeductible),
      tva_nette: tvaNette,
      credit_a_reporter: creditAReporter,
    };
  },

  getAutoPopulateMapping(): AggregationMapping[] {
    return [
      { fieldId: 'ca_taxable', aggregateKey: 'income_total' },
      { fieldId: 'ca_export', aggregateKey: 'income_export' },
      { fieldId: 'achats_locaux', aggregateKey: 'expenses_total' },
      { fieldId: 'tva_deductible', aggregateKey: 'expenses_tax_credits' },
    ];
  },

  getRoundingRules(): RoundingConfig {
    // Madagascar rounds to whole Ariary (MGA has no common subdivision)
    return { method: 'nearest', decimals: 0, wholeOnly: true };
  },

  validateForm(v: FieldValues): ValidationResult[] {
    const results: ValidationResult[] = [];
    if (Number(v.ca_taxable) < 0) {
      results.push({ fieldId: 'ca_taxable', message: 'Le chiffre d\'affaires ne peut pas être négatif', severity: 'error' });
    }
    if (Number(v.ca_export) > Number(v.ca_taxable)) {
      results.push({ fieldId: 'ca_export', message: 'Les exportations dépassent le CA total', severity: 'warning' });
    }
    if (Number(v.achats_locaux) < 0) {
      results.push({ fieldId: 'achats_locaux', message: 'Les achats ne peuvent pas être négatifs', severity: 'error' });
    }
    return results;
  },

  getFieldHelp(fieldId: string): string | null {
    const help: Record<string, string> = {
      ca_taxable: 'Toutes les ventes et prestations soumises à la TVA, TVA comprise (TTC). Inclut les ventes de biens, services, et prestations.',
      ca_export: 'Ventes à l\'exportation bénéficiant du taux zéro et autres ventes exonérées par le Code Général des Impôts.',
      tva_collectee: 'TVA collectée sur vos ventes: montant TTC × 20/120. Calculé automatiquement.',
      achats_locaux: 'Total de vos achats auprès de fournisseurs enregistrés à Madagascar, TVA comprise.',
      achats_import: 'TVA payée aux douanes sur les importations — montant figurant sur la quittance douanière.',
      achats_investissement: 'TVA sur les achats d\'immobilisations (équipements, véhicules utilitaires, machines).',
      tva_deductible: 'Total de la TVA récupérable. Vous pouvez modifier ce montant si des achats ne sont pas déductibles.',
      credit_anterieur: 'Crédit de TVA du mois précédent — reportez le montant de la ligne "Crédit à reporter" de votre dernière déclaration.',
      tva_nette: 'Montant positif = TVA à payer au DGI avant le 15 du mois suivant. Montant négatif = crédit reportable.',
      credit_a_reporter: 'Ce montant sera reporté sur votre prochaine déclaration mensuelle.',
    };
    return help[fieldId] ?? null;
  },

  getSupportedExportFormats(): ExportFormat[] {
    return [
      { id: 'json', label: 'JSON', mimeType: 'application/json', fileExtension: 'json' },
      { id: 'csv', label: 'CSV', mimeType: 'text/csv', fileExtension: 'csv' },
    ];
  },

  async generateExport(values: FieldValues): Promise<ExportOutput> {
    return {
      data: JSON.stringify(values, null, 2),
      filename: `TVA-MG-${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/json',
    };
  },

  getPortalSubmissionInfo(): PortalInfo {
    return {
      portalUrl: 'https://www.impots.mg',
      submissionMethod: 'manual_upload',
      apiReady: false,
    };
  },

  hasSubJurisdictions() { return false; },
  supportsCustomFields() { return false; },
};

export default madagascarPlugin;
