export type SearchEntry = {
  href: string;
  group: 'product' | 'trust' | 'company' | 'learn' | 'contact';
  title: { en: string; fr: string };
  description: { en: string; fr: string };
  keywords: { en: string; fr: string };
};

export const searchGroups: Record<SearchEntry['group'], { en: string; fr: string }> = {
  product: { en: 'Products', fr: 'Produits' },
  trust: { en: 'Trust', fr: 'Confiance' },
  company: { en: 'Company', fr: 'Entreprise' },
  learn: { en: 'Learn', fr: 'Apprendre' },
  contact: { en: 'Contact', fr: 'Contact' },
};

export const siteSearchIndex: readonly SearchEntry[] = [
  {
    href: '/union-eyes',
    group: 'product',
    title: { en: 'Union Eyes', fr: 'Union Eyes' },
    description: {
      en: 'Case continuity, representative handoffs and operational memory for labour organizations.',
      fr: 'Continuité des dossiers, transferts de représentation et mémoire opérationnelle pour les syndicats.',
    },
    keywords: { en: 'union labour grievance case steward member pilot', fr: 'syndicat grief dossier délégué membre pilote' },
  },
  {
    href: '/public-service',
    group: 'product',
    title: { en: 'CIVIC for public institutions', fr: 'CIVIC pour les institutions publiques' },
    description: {
      en: 'Make commitments, owners and evidence visible across public-sector modernization.',
      fr: 'Rendre visibles les engagements, les responsables et les preuves dans la modernisation du secteur public.',
    },
    keywords: { en: 'civic public service government modernization commitments briefing', fr: 'civic service public gouvernement modernisation engagements présentation' },
  },
  {
    href: '/platform',
    group: 'product',
    title: { en: 'Nzila OS platform', fr: 'Plateforme Nzila OS' },
    description: {
      en: 'The governed foundation: identity, data isolation, policy, evidence and observability.',
      fr: 'La fondation gouvernée : identité, isolation des données, politiques, preuves et observabilité.',
    },
    keywords: { en: 'platform nzila os infrastructure identity isolation evidence', fr: 'plateforme nzila os infrastructure identité isolation preuves' },
  },
  {
    href: '/products',
    group: 'product',
    title: { en: 'All products', fr: 'Tous les produits' },
    description: {
      en: 'Every Nzila product with its current maturity: concept, pilot or available.',
      fr: 'Chaque produit Nzila avec sa maturité actuelle : concept, pilote ou disponible.',
    },
    keywords: { en: 'products portfolio maturity pilot concept', fr: 'produits portefeuille maturité pilote concept' },
  },
  {
    href: '/portfolio',
    group: 'product',
    title: { en: 'Portfolio and sectors', fr: 'Portefeuille et secteurs' },
    description: {
      en: 'The sectors and initiatives we are exploring, clearly separated from live products.',
      fr: 'Les secteurs et initiatives que nous explorons, clairement distincts des produits actifs.',
    },
    keywords: { en: 'portfolio sectors fintech agrotech legaltech healthtech', fr: 'portefeuille secteurs fintech agrotech legaltech santé' },
  },
  {
    href: '/continuity-assessment',
    group: 'learn',
    title: { en: 'Continuity assessment', fr: 'Évaluation de continuité' },
    description: {
      en: 'Find where institutional knowledge, decisions and handoffs are fragile.',
      fr: 'Repérer où le savoir institutionnel, les décisions et les transferts sont fragiles.',
    },
    keywords: { en: 'continuity assessment risk knowledge handoff turnover', fr: 'continuité évaluation risque savoir transfert roulement' },
  },
  {
    href: '/organizational-continuity',
    group: 'learn',
    title: { en: 'Organizational continuity', fr: 'Continuité organisationnelle' },
    description: {
      en: 'Why institutions lose context when people leave, and what to preserve.',
      fr: 'Pourquoi les institutions perdent du contexte quand des personnes partent, et que préserver.',
    },
    keywords: { en: 'organizational continuity operational memory succession', fr: 'continuité organisationnelle mémoire opérationnelle relève' },
  },
  {
    href: '/starter-kit',
    group: 'learn',
    title: { en: 'Starter kit', fr: 'Kit de démarrage' },
    description: {
      en: 'A practical starting point for evaluating continuity risk and operational memory exposure.',
      fr: 'Un point de départ concret pour évaluer le risque de continuité et l’exposition de la mémoire opérationnelle.',
    },
    keywords: { en: 'starter kit evaluate continuity risk governance guide', fr: 'kit de démarrage évaluer risque de continuité gouvernance guide' },
  },
  {
    href: '/insights',
    group: 'learn',
    title: { en: 'Insights', fr: 'Analyses' },
    description: {
      en: 'Briefs and perspectives on continuity, trust stewardship and public-service delivery.',
      fr: 'Notes et perspectives sur la continuité, l’intendance de la confiance et les services publics.',
    },
    keywords: { en: 'insights articles briefs news blog perspectives', fr: 'analyses articles notes nouvelles blogue perspectives' },
  },
  {
    href: '/resources',
    group: 'learn',
    title: { en: 'Resources', fr: 'Ressources' },
    description: {
      en: 'Public documentation, doctrine explainers and operational resources.',
      fr: 'Documentation publique, explications de doctrine et ressources opérationnelles.',
    },
    keywords: { en: 'resources documentation doctrine guides documents', fr: 'ressources documentation doctrine guides documents' },
  },
  {
    href: '/case-studies',
    group: 'learn',
    title: { en: 'Case studies', fr: 'Études de cas' },
    description: {
      en: 'Pilot and deployment evidence, without invented logos.',
      fr: 'Preuves de pilotes et de déploiements, sans logos inventés.',
    },
    keywords: { en: 'case studies pilots evidence customers', fr: 'études de cas pilotes preuves clients' },
  },
  {
    href: '/trust',
    group: 'trust',
    title: { en: 'Trust Center', fr: 'Centre de confiance' },
    description: {
      en: 'Anti-surveillance, security, privacy, reliability, governance and sovereignty commitments.',
      fr: 'Engagements en matière d’anti-surveillance, de sécurité, de vie privée, de fiabilité, de gouvernance et de souveraineté.',
    },
    keywords: { en: 'trust governance privacy sovereignty data residency ai human review', fr: 'confiance gouvernance vie privée souveraineté résidence données ia examen humain' },
  },
  {
    href: '/security',
    group: 'trust',
    title: { en: 'Security controls', fr: 'Contrôles de sécurité' },
    description: {
      en: 'Published authentication, isolation, audit and supply-chain controls, plus how to report a vulnerability.',
      fr: 'Contrôles publiés d’authentification, d’isolation, d’audit et de chaîne d’approvisionnement, et signalement de vulnérabilités.',
    },
    keywords: { en: 'security mfa sso audit vulnerability soc2 encryption', fr: 'sécurité mfa sso audit vulnérabilité soc2 chiffrement' },
  },
  {
    href: '/status',
    group: 'trust',
    title: { en: 'System status', fr: 'État du système' },
    description: {
      en: 'Live health checks for our public services, refreshed every 30 seconds.',
      fr: 'Vérifications de santé en direct de nos services publics, actualisées toutes les 30 secondes.',
    },
    keywords: { en: 'status uptime outage health availability', fr: 'état disponibilité panne santé' },
  },
  {
    href: '/reliability',
    group: 'trust',
    title: { en: 'Reliability', fr: 'Fiabilité' },
    description: {
      en: 'Uptime targets, SLOs, incident response and change management.',
      fr: 'Cibles de disponibilité, SLO, réponse aux incidents et gestion des changements.',
    },
    keywords: { en: 'reliability uptime slo incident response change management availability', fr: 'fiabilité disponibilité slo réponse aux incidents gestion des changements' },
  },
  {
    href: '/anti-surveillance',
    group: 'trust',
    title: { en: 'Anti-surveillance commitments', fr: 'Engagements anti-surveillance' },
    description: {
      en: 'Nzila systems preserve organizational continuity. They are not worker surveillance systems.',
      fr: 'Les systèmes Nzila préservent la continuité organisationnelle. Ce ne sont pas des systèmes de surveillance des travailleurs.',
    },
    keywords: { en: 'surveillance ethics commitments privacy workers members', fr: 'surveillance éthique engagements vie privée travailleurs membres' },
  },
  {
    href: '/legal/privacy',
    group: 'trust',
    title: { en: 'Privacy policy', fr: 'Politique de confidentialité' },
    description: {
      en: 'How we collect, use and protect your personal information.',
      fr: 'Comment nous recueillons, utilisons et protégeons vos renseignements personnels.',
    },
    keywords: { en: 'privacy policy personal information data protection', fr: 'confidentialité politique renseignements personnels protection des données' },
  },
  {
    href: '/about',
    group: 'company',
    title: { en: 'About Nzila Ventures', fr: 'À propos de Nzila Ventures' },
    description: {
      en: 'Our mission, principles and the team behind the software.',
      fr: 'Notre mission, nos principes et l’équipe derrière le logiciel.',
    },
    keywords: { en: 'about company mission team values', fr: 'à propos entreprise mission équipe valeurs' },
  },
  {
    href: '/careers',
    group: 'company',
    title: { en: 'Careers', fr: 'Carrières' },
    description: {
      en: 'How we work, and how to tell us you would like to contribute.',
      fr: 'Notre façon de travailler, et comment nous dire que vous souhaitez contribuer.',
    },
    keywords: { en: 'careers jobs hiring work join team remote', fr: 'carrières emplois embauche travail équipe télétravail' },
  },
  {
    href: '/partners',
    group: 'company',
    title: { en: 'Partners', fr: 'Partenaires' },
    description: {
      en: 'Request or access the partner workspace through a governed sign-in experience.',
      fr: 'Demander ou accéder à l’espace partenaire par une connexion gouvernée.',
    },
    keywords: { en: 'partners partner workspace sign in access', fr: 'partenaires espace partenaire connexion accès' },
  },
  {
    href: '/investors',
    group: 'company',
    title: { en: 'Investors', fr: 'Investisseurs' },
    description: {
      en: 'Investment context: continuity infrastructure, Union Eyes validation and Nzila OS.',
      fr: 'Contexte d’investissement : infrastructure de continuité, validation d’Union Eyes et Nzila OS.',
    },
    keywords: { en: 'investors investment funding strategy', fr: 'investisseurs investissement financement stratégie' },
  },
  {
    href: '/contact',
    group: 'contact',
    title: { en: 'Talk to us', fr: 'Nous joindre' },
    description: {
      en: 'Start a conversation about a Union Eyes pilot, a CIVIC briefing or anything else.',
      fr: 'Lancer une conversation sur un pilote Union Eyes, une présentation CIVIC ou autre chose.',
    },
    keywords: { en: 'contact email demo pilot briefing inquiry talk', fr: 'contact courriel démo pilote présentation demande' },
  },
];

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ');

/** Ranks entries by weighted token matches; every query token must match somewhere.
 * Both languages are searched so a French term finds an English page and vice versa. */
export function searchSite(query: string, locale: 'en' | 'fr', limit = 8): SearchEntry[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const other = locale === 'en' ? 'fr' : 'en';

  const scoreToken = (entry: SearchEntry, token: string, language: 'en' | 'fr'): number => {
    if (normalize(entry.title[language]).startsWith(token)) return 12;
    if (normalize(entry.title[language]).includes(token)) return 9;
    if (normalize(entry.keywords[language]).includes(token)) return 5;
    if (normalize(entry.description[language]).includes(token)) return 2;
    return 0;
  };

  const scored: Array<{ entry: SearchEntry; score: number }> = [];
  for (const entry of siteSearchIndex) {
    let score = 0;
    let matchedAll = true;
    for (const token of tokens) {
      const tokenScore = Math.max(scoreToken(entry, token, locale), Math.floor(scoreToken(entry, token, other) * 0.8));
      if (tokenScore === 0) {
        matchedAll = false;
        break;
      }
      score += tokenScore;
    }
    if (matchedAll) scored.push({ entry, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((item) => item.entry);
}
