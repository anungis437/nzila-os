/**
 * Public-facing portfolio catalog.
 *
 * This is editorial positioning, not a release/readiness registry. Deliberately
 * avoid unverifiable market-size claims, progress percentages and "production
 * ready" status labels here. Real release gates belong in product governance.
 */
export type PublicPortfolioEntry = {
  name: string;
  sector: string;
  en: string;
  fr: string;
};

export const publicPortfolio: readonly PublicPortfolioEntry[] = [
  {
    name: 'The House',
    sector: 'Sport',
    en: 'Institutional operations for sport organizations, clubs, affiliations and administration.',
    fr: 'Opérations institutionnelles pour les organismes sportifs, les clubs, les affiliations et leur administration.',
  },
  {
    name: 'CourtLens',
    sector: 'Justice',
    en: 'Access-to-justice workflows, triage and structured case context.',
    fr: 'Parcours d’accès à la justice, orientation et contexte structuré des dossiers.',
  },
  {
    name: 'MISSION',
    sector: 'Research',
    en: 'Institutional funding design and research-program workflows.',
    fr: 'Conception de financement institutionnel et parcours liés aux programmes de recherche.',
  },
  {
    name: 'Zonga',
    sector: 'Creator economy',
    en: 'Digital experiences for artists, events, catalogues and creative operations.',
    fr: 'Expériences numériques pour les artistes, les événements, les catalogues et les opérations créatives.',
  },
  {
    name: 'TrustCore',
    sector: 'Governance',
    en: 'Privacy and governance workflows for organizations managing operational risk.',
    fr: 'Parcours de confidentialité et de gouvernance pour gérer les risques opérationnels.',
  },
  {
    name: 'Memora',
    sector: 'Care',
    en: 'Staff-led reminiscence and meaningful engagement experiences in senior care.',
    fr: 'Réminiscence animée par le personnel et activités significatives en milieu de soins aux aînés.',
  },
  {
    name: 'Veridian Care',
    sector: 'Healthcare',
    en: 'Continuity-oriented coordination concepts for care teams and institutions.',
    fr: 'Concepts de coordination axés sur la continuité pour les équipes et les établissements de soins.',
  },
  {
    name: 'Flow',
    sector: 'Commerce',
    en: 'Connected commercial operations across customer requests, quoting and fulfillment.',
    fr: 'Opérations commerciales reliées, de la demande client au devis et à l’exécution.',
  },
  {
    name: 'CORA',
    sector: 'Agriculture',
    en: 'Agricultural operations, coordination and market-oriented decision support.',
    fr: 'Opérations agricoles, coordination et soutien aux décisions commerciales.',
  },
  {
    name: 'Agrimo',
    sector: 'Supply chain',
    en: 'Agricultural logistics, lot traceability and operational coordination.',
    fr: 'Logistique agricole, traçabilité des lots et coordination opérationnelle.',
  },
  {
    name: 'FAIRCASE',
    sector: 'Justice and equity',
    en: 'Evidence-oriented governance and review workflows in justice and equity contexts.',
    fr: 'Parcours de gouvernance et d’examen fondés sur les preuves en justice et équité.',
  },
  {
    name: 'Insight CFO',
    sector: 'Finance',
    en: 'Finance planning, reporting and decision-support concepts.',
    fr: 'Concepts de planification financière, de reddition de comptes et d’aide à la décision.',
  },
  {
    name: '3CUO / DiasporaCore',
    sector: 'Financial services',
    en: 'Financial-service concepts for cross-border and diaspora communities.',
    fr: 'Concepts de services financiers destinés aux communautés transfrontalières et de la diaspora.',
  },
  {
    name: 'SentryIQ360',
    sector: 'Insurance',
    en: 'Insurance operations, policy lifecycle and review-oriented intelligence concepts.',
    fr: 'Concepts d’opérations d’assurance, de cycle de vie des polices et d’analyse.',
  },
  {
    name: 'Trade OS',
    sector: 'Trade',
    en: 'Trade operations and document-led logistics coordination.',
    fr: 'Opérations de commerce et coordination logistique documentaire.',
  },
] as const;
