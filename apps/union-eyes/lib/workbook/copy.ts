/**
 * ARTIFACT TYPE: Marketing Copy
 * DOCTRINE_VERSION: 1.0.0
 *
 * Governance Entropy Workbook\u2122 \u2014 editorial copy. EN-CA default, FR-CA via
 * locale. Inline ternary, no i18n framework. Mirrors lib/icra/copy.ts.
 *
 * Tone: editorial, institutional, unhurried, dignified. Mapping work, not
 * dashboard work. Anchored on the Institutional Memory Holders module \u2014
 * the people who carry the institution.
 */

import { WORKBOOK_TIERS } from '@/lib/icra/tiers';

export type Locale = 'en-CA' | 'fr-CA';

export function isFrench(locale: string): boolean {
  return locale === 'fr-CA';
}

export const WORKBOOK_COPY = {
  hero: {
    eyebrow: {
      'en-CA': 'Governance Entropy Workbook\u2122',
      'fr-CA': 'Cahier d\u2019entropie de gouvernance\u2122',
    },
    title: {
      'en-CA': 'Map the people who carry your institution.',
      'fr-CA': 'Cartographier les personnes qui portent votre institution.',
    },
    lede: {
      'en-CA':
        'Most continuity loss does not happen in transitions. It happens quietly, in the years before, while the institutional carriers are still in their roles. This workbook helps you see them before you need to.',
      'fr-CA':
        'La plupart des pertes de continuité ne surviennent pas lors des transitions. Elles se produisent silencieusement, dans les ann\u00e9es qui pr\u00e9c\u00e8dent, pendant que les porteurs institutionnels sont encore en poste. Ce cahier vous aide \u00e0 les reconna\u00eetre avant d\u2019en avoir besoin.',
    },
    primaryCta: {
      'en-CA': 'Begin the Workbook',
      'fr-CA': 'Commencer le cahier',
    },
    secondaryCta: {
      'en-CA': 'Discuss a facilitated edition',
      'fr-CA': 'Discuter d\u2019une \u00e9dition facilit\u00e9e',
    },
  },
  positioning: {
    title: {
      'en-CA': 'A mapping instrument, not a dashboard.',
      'fr-CA': 'Un instrument de cartographie, pas un tableau de bord.',
    },
    body: {
      'en-CA':
        'The Governance Entropy Workbook is the second layer of Organizational Continuity Infrastructure. Where the Institutional Continuity Risk Assessment helps you recognise what your institution is carrying, this Workbook helps you map it: the carriers, the lineage, the breakpoints, and the moves required to keep continuity intact across the next transition arc.',
      'fr-CA':
        'Le Cahier d\u2019entropie de gouvernance constitue la deuxi\u00e8me couche de l\u2019Infrastructure de continuit\u00e9 organisationnelle. L\u00e0 o\u00f9 l\u2019\u00c9valuation du risque de continuit\u00e9 institutionnelle vous aide \u00e0 reconna\u00eetre ce que votre institution porte, ce cahier vous aide \u00e0 le cartographier : les porteurs, la filiation, les points de rupture et les mouvements requis pour pr\u00e9server la continuit\u00e9 \u00e0 travers le prochain arc de transition.',
    },
  },
  modules: {
    title: {
      'en-CA': 'Six continuity mapping modules.',
      'fr-CA': 'Six modules de cartographie de la continuit\u00e9.',
    },
    intro: {
      'en-CA':
        'The Self-Guided Edition unlocks the Institutional Memory Holders module fully. The other five modules are visible and reserved for the Facilitated Edition. Continuity work is sequenced; you do not need to do all of it at once.',
      'fr-CA':
        'L\u2019\u00e9dition autonome d\u00e9verrouille enti\u00e8rement le module des Porteurs de m\u00e9moire institutionnelle. Les cinq autres modules sont visibles et r\u00e9serv\u00e9s \u00e0 l\u2019\u00e9dition facilit\u00e9e. Le travail de continuit\u00e9 est s\u00e9quenc\u00e9; vous n\u2019avez pas besoin de tout faire en m\u00eame temps.',
    },
    items: [
      {
        id: 'continuity_landscape' as const,
        unlockedInSelfGuided: false,
        title: { 'en-CA': 'Continuity Landscape', 'fr-CA': 'Paysage de continuit\u00e9' },
        body: {
          'en-CA':
            'The institutional continuity terrain: operational coherence, governance posture, modernization surface, stewardship terrain. The map your other modules sit on.',
          'fr-CA':
            'Le terrain de continuit\u00e9 institutionnelle : coh\u00e9rence op\u00e9rationnelle, posture de gouvernance, surface de modernisation, terrain de g\u00e9rance. La carte sur laquelle reposent vos autres modules.',
        },
      },
      {
        id: 'memory_holders' as const,
        unlockedInSelfGuided: true,
        title: {
          'en-CA': 'Institutional Memory Holders',
          'fr-CA': 'Porteurs de m\u00e9moire institutionnelle',
        },
        body: {
          'en-CA':
            'The people who carry the institution. Their roles, tenure, criticality, and whether a successor has been identified. Produces the Stewardship Density Index\u2122 and the continuity carrier map.',
          'fr-CA':
            'Les personnes qui portent l\u2019institution. Leurs r\u00f4les, leur anciennet\u00e9, leur criticit\u00e9 et la pr\u00e9sence ou non d\u2019un successeur identifi\u00e9. Produit l\u2019Indice de densit\u00e9 de g\u00e9rance\u2122 et la carte des porteurs de continuit\u00e9.',
        },
      },
      {
        id: 'governance_lineage' as const,
        unlockedInSelfGuided: false,
        title: { 'en-CA': 'Governance Lineage', 'fr-CA': 'Filiation de gouvernance' },
        body: {
          'en-CA':
            'The decisions, conventions, and rationales that bind today\u2019s operations to yesterday\u2019s commitments. Classified along the Governance Entropy Scale\u2122.',
          'fr-CA':
            'Les d\u00e9cisions, conventions et rationnels qui lient les op\u00e9rations d\u2019aujourd\u2019hui aux engagements d\u2019hier. Class\u00e9s selon l\u2019\u00c9chelle d\u2019entropie de gouvernance\u2122.',
        },
      },
      {
        id: 'continuity_breakpoints' as const,
        unlockedInSelfGuided: false,
        title: { 'en-CA': 'Continuity Breakpoints', 'fr-CA': 'Points de rupture de continuit\u00e9' },
        body: {
          'en-CA':
            'The institutional points at which a continuity break would have the greatest blast radius. Plotted against the Continuity Survivability Matrix\u2122.',
          'fr-CA':
            'Les points institutionnels o\u00f9 une rupture de continuit\u00e9 aurait la plus grande port\u00e9e. Trac\u00e9s contre la Matrice de survivabilit\u00e9 de continuit\u00e9\u2122.',
        },
      },
      {
        id: 'modernization_alignment' as const,
        unlockedInSelfGuided: false,
        title: { 'en-CA': 'Modernization Alignment', 'fr-CA': 'Alignement de modernisation' },
        body: {
          'en-CA':
            'Aligning continuity, governance, and modernization arcs so modernization does not erase institutional memory.',
          'fr-CA':
            'Aligner les arcs de continuit\u00e9, de gouvernance et de modernisation pour que la modernisation n\u2019efface pas la m\u00e9moire institutionnelle.',
        },
      },
      {
        id: 'transformation_roadmap' as const,
        unlockedInSelfGuided: false,
        title: { 'en-CA': 'Transformation Roadmap', 'fr-CA': 'Feuille de route de transformation' },
        body: {
          'en-CA':
            'Sequencing continuity, governance, and modernization moves into a continuity-preserving transformation arc across the five phases of the OCI Method\u2122.',
          'fr-CA':
            'Ordonnancement des mouvements de continuit\u00e9, de gouvernance et de modernisation en un arc de transformation pr\u00e9servant la continuit\u00e9, \u00e0 travers les cinq phases de la M\u00e9thode OCI\u2122.',
        },
      },
    ],
  },
  frameworks: {
    title: {
      'en-CA': 'Five signature continuity frameworks.',
      'fr-CA': 'Cinq cadres de continuit\u00e9 signature.',
    },
    items: [
      {
        id: 'stewardship_density_index',
        title: {
          'en-CA': 'Stewardship Density Index\u2122',
          'fr-CA': 'Indice de densit\u00e9 de g\u00e9rance\u2122',
        },
        body: {
          'en-CA':
            'Quantifies how concentrated institutional knowledge is in too few continuity carriers.',
          'fr-CA':
            'Quantifie \u00e0 quel point la connaissance institutionnelle est concentr\u00e9e chez trop peu de porteurs de continuit\u00e9.',
        },
      },
      {
        id: 'continuity_burden_map',
        title: {
          'en-CA': 'Continuity Burden Map\u2122',
          'fr-CA': 'Carte du fardeau de continuit\u00e9\u2122',
        },
        body: {
          'en-CA':
            'Visualises the composite continuity burden across stewardship, governance, and reconstruction risk.',
          'fr-CA':
            'Visualise le fardeau composite de continuit\u00e9 \u00e0 travers la g\u00e9rance, la gouvernance et le risque de reconstruction.',
        },
      },
      {
        id: 'governance_entropy_scale',
        title: {
          'en-CA': 'Governance Entropy Scale\u2122',
          'fr-CA': '\u00c9chelle d\u2019entropie de gouvernance\u2122',
        },
        body: {
          'en-CA':
            'A five-point scale measuring drift between governance design and governance practice.',
          'fr-CA':
            'Une \u00e9chelle \u00e0 cinq niveaux mesurant la d\u00e9rive entre la conception et la pratique de la gouvernance.',
        },
      },
      {
        id: 'continuity_survivability_matrix',
        title: {
          'en-CA': 'Continuity Survivability Matrix\u2122',
          'fr-CA': 'Matrice de survivabilit\u00e9 de continuit\u00e9\u2122',
        },
        body: {
          'en-CA':
            'Plots institutional dependencies against successor identification to surface survivability gaps.',
          'fr-CA':
            'Trace les d\u00e9pendances institutionnelles contre l\u2019identification des successeurs pour faire \u00e9merger les \u00e9carts de survivabilit\u00e9.',
        },
      },
      {
        id: 'reconstruction_burden_index',
        title: {
          'en-CA': 'Reconstruction Burden Index\u2122',
          'fr-CA': 'Indice de fardeau de reconstruction\u2122',
        },
        body: {
          'en-CA':
            'Estimates the cost of reconstructing institutional knowledge after a continuity break.',
          'fr-CA':
            'Estime le co\u00fbt de reconstruction de la connaissance institutionnelle apr\u00e8s une rupture de continuit\u00e9.',
        },
      },
    ],
  },
  pricing: {
    title: {
      'en-CA': 'Three editions, sequenced by institutional posture.',
      'fr-CA': 'Trois \u00e9ditions, ordonn\u00e9es selon la posture institutionnelle.',
    },
    tiers: WORKBOOK_TIERS,
  },
  closing: {
    title: {
      'en-CA': 'Begin with the people.',
      'fr-CA': 'Commencer par les personnes.',
    },
    body: {
      'en-CA':
        'The Memory Holders module is the emotional centre of the Workbook. It is also the first place where continuity becomes visible. You can begin in twenty minutes; the institution will recognise itself in what surfaces.',
      'fr-CA':
        'Le module des Porteurs de m\u00e9moire est le centre \u00e9motionnel du cahier. C\u2019est aussi le premier endroit o\u00f9 la continuit\u00e9 devient visible. Vous pouvez commencer en vingt minutes; l\u2019institution se reconna\u00eetra dans ce qui \u00e9merge.',
    },
  },
} as const;

export type WorkbookCopy = typeof WORKBOOK_COPY;
