export type MarketingCopy = {
  nav: {
    product: string
    features: string
    pricing: string
    about: string
    contact: string
    trial: string
  }
  hero: {
    eyebrow: string
    title: string
    subtitle: string
    primaryCta: string
    secondaryCta: string
  }
  stats: Array<{ value: string; label: string; note: string }>
  modulesTitle: string
  modulesSubtitle: string
  mission: {
    eyebrow: string
    title: string
    body: string
    bullets: string[]
  }
  cta: {
    title: string
    subtitle: string
    primary: string
    secondary: string
  }
}

export const featureCards = [
  {
    titleEn: 'Executive command center',
    titleFr: 'Centre de commande executif',
    descriptionEn: 'Owner-grade visibility on margin, campaign ROI, bottlenecks, and conversion health in one board.',
    descriptionFr: 'Visibilite direction sur la marge, le ROI campagne, les goulots et la conversion dans un seul tableau.',
  },
  {
    titleEn: 'Quote to cash orchestration',
    titleFr: 'Orchestration devis a encaissement',
    descriptionEn: 'From quote to deposit to fulfillment, every gate is enforced with auditable transitions.',
    descriptionFr: 'Du devis au depot puis a la livraison, chaque etape est appliquee avec transitions auditables.',
  },
  {
    titleEn: 'Shop Moi Ca buyer journeys',
    titleFr: 'Parcours acheteurs Shop Moi Ca',
    descriptionEn: 'Guided gifting, trusted delivery tracking, and premium proposal packaging for high-value clients.',
    descriptionFr: 'Cadeaux guides, suivi de livraison fiable et propositions premium pour clients a forte valeur.',
  },
  {
    titleEn: 'Connector resilience',
    titleFr: 'Resilience des connecteurs',
    descriptionEn: 'Shopify, Google Ads, and Zoho synchronization with health states and fallback operations.',
    descriptionFr: 'Synchronisation Shopify, Google Ads et Zoho avec etats de sante et plans de repli.',
  },
  {
    titleEn: 'Role-safe collaboration',
    titleFr: 'Collaboration securisee par role',
    descriptionEn: 'Public pages, internal operations, and buyer portals coexist without policy leaks.',
    descriptionFr: 'Pages publiques, operations internes et portails clients coexistent sans fuite de politique.',
  },
  {
    titleEn: 'Investor-ready proof packs',
    titleFr: 'Dossiers de preuve prets investisseurs',
    descriptionEn: 'Live demos, ROI narratives, and operating evidence packaged for fundraising confidence.',
    descriptionFr: 'Demos live, narratif ROI et preuves operationnelles emballes pour lever des fonds avec confiance.',
  },
]

export const pricingPlans = [
  {
    name: 'Launch',
    monthly: '$79',
    featuresEn: ['Up to 5 team members', 'Shop Moi Ca starter playbook', 'Core quote + deposit workflow'],
    featuresFr: ['Jusqu a 5 membres', 'Playbook de demarrage Shop Moi Ca', 'Workflow de base devis + depot'],
  },
  {
    name: 'Growth',
    monthly: '$249',
    featuresEn: ['Unlimited workflows', 'Campaign and CRM command surfaces', 'Priority onboarding and support'],
    featuresFr: ['Workflows illimites', 'Surfaces de commande marketing et CRM', 'Onboarding prioritaire et support'],
  },
  {
    name: 'Scale',
    monthly: '$499',
    featuresEn: ['Advanced governance and audit exports', 'Executive intelligence suite', 'Dedicated operating partner'],
    featuresFr: ['Gouvernance avancee et exports audit', 'Suite intelligence executive', 'Partenaire operationnel dedie'],
  },
]

const EN: MarketingCopy = {
  nav: {
    product: 'Product',
    features: 'Features',
    pricing: 'Pricing',
    about: 'About',
    contact: 'Contact',
    trial: 'Start trial',
  },
  hero: {
    eyebrow: 'Maestria Commerce Edition',
    title: 'The marketing and commerce operating system built around Shop Moi Ca.',
    subtitle:
      'Maestria combines public growth pages, operator-grade execution, and buyer-safe experiences powered by Flow Engine. One platform, no workflow drift.',
    primaryCta: 'Start 14-day trial',
    secondaryCta: 'Open Shop Moi Ca demo',
  },
  stats: [
    { value: '-62%', label: 'Quote cycle time', note: 'After replacing fragmented manual workflows.' },
    { value: '+38%', label: 'Invoice throughput', note: 'Faster quote-to-cash with enforced transitions.' },
    { value: '0', label: 'Payment gate bypasses', note: 'Rules are applied in code, not in memory.' },
    { value: '14', label: 'Commerce states', note: 'No illegal state transitions in production.' },
  ],
  modulesTitle: 'From public acquisition to internal operations',
  modulesSubtitle:
    'The same product powers marketing conversion, sales precision, and fulfillment confidence without duplicating logic across tools.',
  mission: {
    eyebrow: 'Why Maestria',
    title: 'Operational clarity without enterprise overhead.',
    body:
      'Maestria was designed for teams that have outgrown spreadsheets but still need speed. Shop Moi Ca is the flagship proving ground: premium UX outside, rigorous workflow controls inside.',
    bullets: ['Owner mission control by default', 'Client-safe surfaces with no policy leaks', 'Evidence-ready operations for investor conversations'],
  },
  cta: {
    title: 'Launch your premium commerce lane in days, not quarters.',
    subtitle: 'Use the Shop Moi Ca blueprint, then adapt modules to your catalog, market, and operating model.',
    primary: 'Start Trial',
    secondary: 'Talk to Maestria team',
  },
}

const FR: MarketingCopy = {
  nav: {
    product: 'Produit',
    features: 'Fonctionnalites',
    pricing: 'Tarification',
    about: 'A propos',
    contact: 'Contact',
    trial: 'Demarrer essai',
  },
  hero: {
    eyebrow: 'Edition Commerce Maestria',
    title: 'Le systeme marketing et commerce construit autour de Shop Moi Ca.',
    subtitle:
      'Maestria combine pages de croissance publiques, execution operationnelle et experiences clients securisees, propulsees par Flow Engine. Une plateforme, sans derive de workflow.',
    primaryCta: 'Demarrer essai 14 jours',
    secondaryCta: 'Ouvrir la demo Shop Moi Ca',
  },
  stats: [
    { value: '-62%', label: 'Cycle de devis', note: 'Apres remplacement des workflows manuels fragmentes.' },
    { value: '+38%', label: 'Debit facturation', note: 'Devis vers encaissement plus rapide et controle.' },
    { value: '0', label: 'Contournement paiements', note: 'Les regles sont appliquees dans le code, pas en memoire.' },
    { value: '14', label: 'Etats commerce', note: 'Aucune transition illegale en production.' },
  ],
  modulesTitle: 'De l acquisition publique aux operations internes',
  modulesSubtitle:
    'Le meme produit alimente conversion marketing, precision commerciale et execution logistique sans dupliquer la logique.',
  mission: {
    eyebrow: 'Pourquoi Maestria',
    title: 'Clarte operationnelle sans surcharge enterprise.',
    body:
      'Maestria est concu pour les equipes qui depassent les feuilles de calcul mais gardent le besoin de vitesse. Shop Moi Ca est le terrain phare: UX premium a l exterieur, controles stricts a l interieur.',
    bullets: ['Mission control direction par defaut', 'Surfaces client sans fuite de politique', 'Operations prouvees pour les discussions investisseurs'],
  },
  cta: {
    title: 'Lancez votre corridor commerce premium en quelques jours, pas en trimestres.',
    subtitle: 'Utilisez le blueprint Shop Moi Ca puis adaptez les modules a votre catalogue, marche et mode operatoire.',
    primary: 'Demarrer essai',
    secondary: 'Parler a l equipe Maestria',
  },
}

export function getMarketingCopy(locale: string): MarketingCopy {
  return locale === 'fr-CA' ? FR : EN
}
