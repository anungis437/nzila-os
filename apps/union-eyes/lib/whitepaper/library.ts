import { heroImagery } from '@/lib/marketing-hero-imagery';

export type WhitepaperLocale = 'en-CA' | 'fr-CA';

export type WhitepaperLocalizedContent = {
  readonly title: string;
  readonly subtitle: string;
  readonly format: string;
  readonly readingTime: string;
  readonly heroAlt: string;
  readonly abstract: string;
  readonly abstractCallouts: readonly string[];
  readonly sourceFile?: string;
};

/**
 * Static registry of every whitepaper surfaced in the marketing site.
 *
 * The continuity-gap entry is rendered by its bespoke route at
 * `/whitepaper` (preserved for SEO and theme parity). All other entries
 * are rendered through the shared markdown-driven renderer at
 * `/whitepapers/[slug]` and source their locale-specific content from
 * `docs/oci/whitepapers/`.
 */
export type WhitepaperEntry = {
  readonly slug: string;
  readonly version: string;
  readonly heroImage: string;
  readonly href: string;
  readonly localized: Readonly<Record<WhitepaperLocale, WhitepaperLocalizedContent>>;
};

function normalizeWhitepaperLocale(locale: string): WhitepaperLocale {
  return locale === 'fr-CA' ? 'fr-CA' : 'en-CA';
}

export function getWhitepaperLocaleContent(
  entry: WhitepaperEntry,
  locale: string
): WhitepaperLocalizedContent {
  return entry.localized[normalizeWhitepaperLocale(locale)] ?? entry.localized['en-CA'];
}

export function getWhitepaperSourceFile(
  entry: WhitepaperEntry,
  locale: string
): string | undefined {
  return getWhitepaperLocaleContent(entry, locale).sourceFile;
}

export const WHITEPAPER_LIBRARY: readonly WhitepaperEntry[] = [
  {
    slug: 'the-continuity-gap',
    version: 'v3.0',
    heroImage: heroImagery.organizationalMemoryModule,
    href: '/whitepaper',
    localized: {
      'en-CA': {
        title: 'The Continuity Gap',
        subtitle:
          'Organizational Memory, Organizational Resilience, and the Future of Operational Trust',
        format: 'Evidence-Enhanced Whitepaper',
        readingTime: '~25 minute read',
        heroAlt: 'Organizational memory and continuity infrastructure',
        abstract:
          'Canadian organizations face a generational continuity gap: 5.2 million boomers have already exited the workforce, another 2.7 million are projected to exit within five years, and labour-force participation is forecast to decline by more than two percentage points by 2030. This whitepaper introduces Organizational Continuity Infrastructure (OCI) and Organizational Continuity Risk Analysis (OCRA) as a distinct discipline for preserving organizational memory, governance lineage, and decision trust across time.',
        abstractCallouts: [
          'Defines OCI and OCRA as organizational continuity primitives.',
          'Articulates deterministic-AI doctrine and governance boundaries.',
          'Maps deployment, evidence, and legal alignment for labour organizations.',
        ],
      },
      'fr-CA': {
        title: 'L’écart de continuité',
        subtitle:
          'Mémoire organisationnelle, résilience organisationnelle et avenir de la confiance opérationnelle',
        format: 'Livre blanc enrichi de preuves',
        readingTime: 'Lecture d’environ 25 minutes',
        heroAlt: 'Mémoire organisationnelle et infrastructure de continuité',
        abstract:
          'Les organisations canadiennes font face à un écart générationnel de continuité : 5,2 millions de baby-boomers ont déjà quitté la population active, 2,7 millions supplémentaires devraient partir d’ici cinq ans et le taux d’activité devrait reculer de plus de deux points de pourcentage d’ici 2030. Ce livre blanc présente l’Infrastructure de continuité organisationnelle (OCI) et l’Analyse du risque de continuité organisationnelle (OCRA) comme une discipline distincte visant à préserver la mémoire organisationnelle, la lignée de gouvernance et la confiance décisionnelle dans le temps.',
        abstractCallouts: [
          'Définit OCI et OCRA comme des primitives de continuité organisationnelle.',
          'Présente la doctrine d’IA déterministe et les limites de gouvernance.',
          'Explique le déploiement, la preuve et l’alignement juridique pour les organisations syndicales.',
        ],
      },
    },
  },
  {
    slug: 'operational-reality-edition',
    version: 'Ops Edition',
    heroImage: heroImagery.operationalCoherenceModule,
    href: '/whitepapers/operational-reality-edition',
    localized: {
      'en-CA': {
        title: 'The Continuity Gap — Ops Edition',
        subtitle:
          'How operational labour systems revealed the continuity category — and why OCI / OCRA emerged from work, not from theory.',
        format: 'Executive Whitepaper',
        readingTime: '~22 minute read',
        heroAlt: 'Operational continuity in labour and federated organizations',
        abstract:
          'A companion to the Evidence-Enhanced edition, this whitepaper begins from the operational surface rather than the demographic argument. It walks through the lived realities — grievance transitions, executive turnover, modernization fragmentation — that made the continuity category visible inside UnionEyes deployments, and reconstructs the discovery path that produced OCI and OCRA as the structural answer.',
        abstractCallouts: [
          'Operational-first framing: continuity discovered through work, not theory.',
          'Three worked scenarios (grievance, executive, modernization).',
          'Dual-entry GTM and continuity-aware operations doctrine.',
        ],
        sourceFile: 'THE_CONTINUITY_GAP_OPERATIONAL_REALITY_EDITION.md',
      },
      'fr-CA': {
        title: 'L’écart de continuité — Édition opérationnelle',
        subtitle:
          'Comment les systèmes syndicaux opérationnels ont révélé la catégorie de continuité — et pourquoi OCI / OCRA sont nés du travail, pas d’une théorie abstraite.',
        format: 'Livre blanc exécutif',
        readingTime: 'Lecture d’environ 22 minutes',
        heroAlt: 'Continuité opérationnelle dans les organisations syndicales et fédérées',
        abstract:
          'Complémentaire à l’édition enrichie de preuves, ce livre blanc part de la surface opérationnelle plutôt que de l’argument démographique. Il traverse les réalités vécues — transitions de griefs, roulement de direction, fragmentation de la modernisation — qui ont rendu visible la catégorie de continuité dans les déploiements UnionEyes et reconstitue le chemin qui a mené à OCI et OCRA comme réponse structurelle.',
        abstractCallouts: [
          'Cadre centré sur l’opérationnel : la continuité est découverte dans le travail, non dans l’abstraction.',
          'Trois scénarios concrets : grief, relève exécutive et modernisation.',
          'Doctrine d’opérations sensibles à la continuité et voie d’entrée double.',
        ],
        sourceFile: 'THE_CONTINUITY_GAP_OPERATIONAL_REALITY_EDITION_fr-CA.md',
      },
    },
  },
  {
    slug: 'oci-method-companion',
    version: 'v1.0',
    heroImage: heroImagery.explainableIntelligenceModule,
    href: '/whitepapers/oci-method-companion',
    localized: {
      'en-CA': {
        title: 'The OCI Method — Companion Whitepaper',
        subtitle:
          'The procurement-grade methodology companion: scaffolding, confidence doctrine, reviewer workflow, and conformance checklist.',
        format: 'Methodology Companion',
        readingTime: '~18 minute read',
        heroAlt: 'OCI methodology and reviewer-led interpretation',
        abstract:
          'Written for procurement officers, governance bodies, legal reviewers, and methodology auditors, the companion whitepaper explains the methodological scaffolding behind the OCI Method: ontology, confidence states, evidence sufficiency, small-sample honesty, reviewer reproducibility, anti-surveillance posture, standards positioning, the reviewer workflow, and a twelve-point procurement evaluation checklist.',
        abstractCallouts: [
          'Worked confidence reading and small-sample honesty examples.',
          'Reviewer reproducibility and two-reviewer divergence doctrine.',
          'Twelve-item procurement evaluation checklist (every "no" disqualifying).',
        ],
        sourceFile: 'OCI_METHOD_COMPANION_WHITEPAPER.md',
      },
      'fr-CA': {
        title: 'La méthode OCI — Livre blanc compagnon',
        subtitle:
          'Le compagnon méthodologique prêt pour l’approvisionnement : structure, doctrine de confiance, flux de revue et liste de conformité.',
        format: 'Compagnon méthodologique',
        readingTime: 'Lecture d’environ 18 minutes',
        heroAlt: 'Méthode OCI et interprétation guidée par des réviseurs',
        abstract:
          'Rédigé pour les responsables de l’approvisionnement, les instances de gouvernance, les réviseurs juridiques et les auditeurs méthodologiques, ce document explique l’ossature de la méthode OCI : l’ontologie, les états de confiance, la suffisance de preuve, l’honnêteté en petit échantillon, la reproductibilité des réviseurs, la posture anti-surveillance, le positionnement normatif, le flux de revue et une liste d’évaluation en douze points.',
        abstractCallouts: [
          'Exemples concrets de lecture de confiance et d’honnêteté en petit échantillon.',
          'Doctrine de reproductibilité des réviseurs et de divergence entre deux lectures.',
          'Liste d’évaluation d’approvisionnement en douze points.',
        ],
        sourceFile: 'OCI_METHOD_COMPANION_WHITEPAPER_fr-CA.md',
      },
    },
  },
  {
    slug: 'oci-method-canonical',
    version: 'v1.2',
    heroImage: heroImagery.executiveIntelligenceModule,
    href: '/whitepapers/oci-method-canonical',
    localized: {
      'en-CA': {
        title: 'The OCI Method — Canonical Authority',
        subtitle:
          'The canonical methodology authority: definitions, ontology, layer separation, enforcement, and brand integrity doctrine.',
        format: 'Methodology Authority',
        readingTime: '~10 minute read',
        heroAlt: 'OCI Method canonical authority',
        abstract:
          'The authoritative reference document for the OCI Method. Establishes canonical definitions, the OCI / OCRA layer ontology, reviewer accountability, confidence and evidence doctrine, anti-surveillance posture, standards positioning, brand and enforcement doctrine, and version governance. All public-facing OCI materials must remain consistent with this authority.',
        abstractCallouts: [
          'Canonical definitions and OCI / OCRA layer ontology.',
          'Brand and enforcement doctrine: disqualifying conditions for OCI / OCRA branding.',
          'Governance, versioning, and conformance to the canonical five-phase OCI Method™.',
        ],
        sourceFile: 'OCI_METHOD_WHITEPAPER_v1.md',
      },
      'fr-CA': {
        title: 'La méthode OCI — Autorité canonique',
        subtitle:
          'L’autorité méthodologique canonique : définitions, ontologie, séparation des couches, doctrine d’application et intégrité de marque.',
        format: 'Autorité méthodologique',
        readingTime: 'Lecture d’environ 10 minutes',
        heroAlt: 'Autorité canonique de la méthode OCI',
        abstract:
          'Document de référence faisant autorité pour la méthode OCI. Il établit les définitions canoniques, l’ontologie des couches OCI / OCRA, la responsabilité des réviseurs, la doctrine de confiance et de preuve, la posture anti-surveillance, le positionnement vis-à-vis des normes, la doctrine de marque et d’application ainsi que la gouvernance de version. Tout document OCI public doit rester conforme à cette autorité.',
        abstractCallouts: [
          'Définitions canoniques et ontologie des couches OCI / OCRA.',
          'Doctrine de marque et d’application avec critères disqualifiants.',
          'Gouvernance, versionnement et conformité à la méthode OCI™ en cinq phases.',
        ],
        sourceFile: 'OCI_METHOD_WHITEPAPER_v1_fr-CA.md',
      },
    },
  },
] as const;

export function getWhitepaperBySlug(slug: string): WhitepaperEntry | undefined {
  return WHITEPAPER_LIBRARY.find((entry) => entry.slug === slug);
}
