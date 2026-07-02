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
<<<<<<< HEAD
  readonly heroAlt: string;
  readonly abstract: string;
  readonly abstractCallouts: readonly string[];
  /**
   * When set, the entry is rendered by the shared markdown renderer using
   * the file at `docs/oci/whitepapers/<sourceFile>`.
   * When omitted, the entry is rendered by a bespoke route (currently
   * only `the-continuity-gap`).
   */
  readonly sourceFile?: string;
  readonly localizedSourceFile?: Partial<Record<'fr-CA', string>>;
  /**
   * Public route (relative to `/{locale}`) the hub card should link to.
   */
=======
>>>>>>> 882361cc6388040b7ed229c4839502b8b3f2d233
  readonly href: string;
<<<<<<< HEAD
  readonly localized?: Partial<
    Record<
      'fr-CA',
      {
        title: string;
        subtitle: string;
        format: string;
        readingTime: string;
        abstract: string;
        abstractCallouts: readonly string[];
      }
    >
  >;
=======
  readonly localized: Readonly<Record<WhitepaperLocale, WhitepaperLocalizedContent>>;
>>>>>>> 882361cc6388040b7ed229c4839502b8b3f2d233
};

<<<<<<< HEAD
export type LocalizedWhitepaperEntry = Omit<WhitepaperEntry, 'localized'>;

const DOCS_RELATIVE = ['..', '..', 'docs', 'oci', 'whitepapers'] as const;
=======
function normalizeWhitepaperLocale(locale: string): WhitepaperLocale {
  return locale === 'fr-CA' ? 'fr-CA' : 'en-CA';
}
>>>>>>> 882361cc6388040b7ed229c4839502b8b3f2d233

export function getWhitepaperLocaleContent(
  entry: WhitepaperEntry,
  locale: string
): WhitepaperLocalizedContent {
  return entry.localized[normalizeWhitepaperLocale(locale)] ?? entry.localized['en-CA'];
}

<<<<<<< HEAD
export function resolveWhitepaperSourcePathForLocale(
  entry: WhitepaperEntry,
  locale: string,
): string {
  if (!entry.sourceFile) {
    throw new Error(`Whitepaper ${entry.slug} does not define a markdown source file`);
  }

  const localizedSource = locale === 'fr-CA' ? entry.localizedSourceFile?.['fr-CA'] : undefined;
  return resolveWhitepaperSourcePath(localizedSource ?? entry.sourceFile);
}

=======
export function getWhitepaperSourceFile(
  entry: WhitepaperEntry,
  locale: string
): string | undefined {
  return getWhitepaperLocaleContent(entry, locale).sourceFile;
}

>>>>>>> 882361cc6388040b7ed229c4839502b8b3f2d233
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
<<<<<<< HEAD
    heroAlt: 'Operational continuity in labour and federated organizations',
    abstract:
      'A companion to the Evidence-Enhanced edition, this whitepaper begins from the operational surface rather than the demographic argument. It walks through the lived realities — grievance transitions, executive turnover, modernization fragmentation — that made the continuity category visible inside Union Eyes deployments, and reconstructs the discovery path that produced OCI and OCRA as the structural answer.',
    abstractCallouts: [
      'Operational-first framing: continuity discovered through work, not theory.',
      'Three worked scenarios (grievance, executive, modernization).',
      'Dual-entry GTM and continuity-aware operations doctrine.',
    ],
    sourceFile: 'THE_CONTINUITY_GAP_OPERATIONAL_REALITY_EDITION.md',
    localizedSourceFile: {
      'fr-CA': 'THE_CONTINUITY_GAP_OPERATIONAL_REALITY_EDITION.fr-CA.md',
    },
=======
>>>>>>> 882361cc6388040b7ed229c4839502b8b3f2d233
    href: '/whitepapers/operational-reality-edition',
<<<<<<< HEAD
    localized: {
      'fr-CA': {
        title: 'Le deficit de continuite - Edition realite operationnelle',
        subtitle:
          'Comment les systemes operationnels du travail ont revele la categorie de continuite, et pourquoi OCI / OCRA emerge du travail vecu.',
        format: 'Livre blanc executif',
        readingTime: '~22 minutes de lecture',
        abstract:
          'Compagnon de l edition renforcee par preuves, ce document part de la realite operationnelle. Il retrace les dynamiques vecues qui ont rendu visible la categorie de continuite dans les deployments Union Eyes et reconstruit le chemin qui a mene a OCI et OCRA.',
        abstractCallouts: [
          'Cadre operationnel d abord: la continuite emerge du terrain, pas de la theorie.',
          'Trois scenarios pratiques: griefs, transitions executives et modernisation.',
          'Doctrine GTM double entree et operations conscientes de la continuite.',
        ],
      },
    },
=======
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
>>>>>>> 882361cc6388040b7ed229c4839502b8b3f2d233
  },
  {
    slug: 'oci-method-companion',
    version: 'v1.0',
    heroImage: heroImagery.explainableIntelligenceModule,
<<<<<<< HEAD
    heroAlt: 'OCI methodology and reviewer-led interpretation',
    abstract:
      'Written for procurement officers, governance bodies, legal reviewers, and methodology auditors, the companion whitepaper explains the methodological scaffolding behind the OCI Method: ontology, confidence states, evidence sufficiency, small-sample honesty, reviewer reproducibility, anti-surveillance posture, standards positioning, the reviewer workflow, and a twelve-point procurement evaluation checklist.',
    abstractCallouts: [
      'Worked confidence reading and small-sample honesty examples.',
      'Reviewer reproducibility and two-reviewer divergence doctrine.',
      'Twelve-item procurement evaluation checklist (every "no" disqualifying).',
    ],
    sourceFile: 'OCI_METHOD_COMPANION_WHITEPAPER.md',
    localizedSourceFile: {
      'fr-CA': 'OCI_METHOD_COMPANION_WHITEPAPER.fr-CA.md',
    },
=======
>>>>>>> 882361cc6388040b7ed229c4839502b8b3f2d233
    href: '/whitepapers/oci-method-companion',
<<<<<<< HEAD
    localized: {
      'fr-CA': {
        title: 'La methode OCI - Livre blanc compagnon',
        subtitle:
          'Compagnon methodologique qualifie approvisionnement: echafaudage, doctrine de confiance, flux de revision et verification de conformite.',
        format: 'Compagnon methodologique',
        readingTime: '~18 minutes de lecture',
        abstract:
          'Destine aux responsables d approvisionnement, aux organes de gouvernance et aux revisrices/reviseurs, ce document explique l echafaudage de la methode OCI: ontologie, etats de confiance, suffisance de preuve, reproductibilite et posture anti-surveillance.',
        abstractCallouts: [
          'Lecture de confiance appliquee et honnetete face aux petits echantillons.',
          'Reproductibilite des reviseurs et doctrine de divergence entre evaluateurs.',
          'Liste de verification d approvisionnement en douze criteres.',
        ],
      },
    },
=======
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
>>>>>>> 882361cc6388040b7ed229c4839502b8b3f2d233
  },
  {
    slug: 'oci-method-canonical',
    version: 'v1.2',
    heroImage: heroImagery.executiveIntelligenceModule,
<<<<<<< HEAD
    heroAlt: 'OCI Method canonical authority',
    abstract:
      'The authoritative reference document for the OCI Method. Establishes canonical definitions, the OCI / OCRA layer ontology, reviewer accountability, confidence and evidence doctrine, anti-surveillance posture, standards positioning, brand and enforcement doctrine, and version governance. All public-facing OCI materials must remain consistent with this authority.',
    abstractCallouts: [
      'Canonical definitions and OCI / OCRA layer ontology.',
      'Brand and enforcement doctrine: disqualifying conditions for OCI / OCRA branding.',
      'Governance, versioning, and conformance to the canonical five-phase OCI Method™.',
    ],
    sourceFile: 'OCI_METHOD_WHITEPAPER_v1.md',
    localizedSourceFile: {
      'fr-CA': 'OCI_METHOD_WHITEPAPER_v1.fr-CA.md',
    },
=======
>>>>>>> 882361cc6388040b7ed229c4839502b8b3f2d233
    href: '/whitepapers/oci-method-canonical',
<<<<<<< HEAD
    localized: {
      'fr-CA': {
        title: 'La methode OCI - Autorite canonique',
        subtitle:
          'Autorite methodologique: definitions, ontologie, separation des couches, enforcement et doctrine d integrite de marque.',
        format: 'Autorite methodologique',
        readingTime: '~10 minutes de lecture',
        abstract:
          'Reference autoritative de la methode OCI. Etablit les definitions canoniques, l ontologie OCI / OCRA, la responsabilite des reviseurs, la doctrine de preuve et de confiance, et la gouvernance de version.',
        abstractCallouts: [
          'Definitions canoniques et ontologie des couches OCI / OCRA.',
          'Doctrine de marque et enforcement: conditions disqualifiantes.',
          'Conformite a la methode OCI en cinq phases.',
        ],
      },
    },
=======
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
>>>>>>> 882361cc6388040b7ed229c4839502b8b3f2d233
  },
] as const;

export function getWhitepaperBySlug(slug: string): WhitepaperEntry | undefined {
  return WHITEPAPER_LIBRARY.find((entry) => entry.slug === slug);
}

export function localizeWhitepaperEntry(
  entry: WhitepaperEntry,
  locale: string,
): LocalizedWhitepaperEntry {
  const localized = locale === 'fr-CA' ? entry.localized?.['fr-CA'] : undefined;

  return {
    slug: entry.slug,
    title: localized?.title ?? entry.title,
    subtitle: localized?.subtitle ?? entry.subtitle,
    format: localized?.format ?? entry.format,
    version: entry.version,
    readingTime: localized?.readingTime ?? entry.readingTime,
    heroImage: entry.heroImage,
    heroAlt: entry.heroAlt,
    abstract: localized?.abstract ?? entry.abstract,
    abstractCallouts: localized?.abstractCallouts ?? entry.abstractCallouts,
    sourceFile: entry.sourceFile,
    localizedSourceFile: entry.localizedSourceFile,
    href: entry.href,
  };
}
