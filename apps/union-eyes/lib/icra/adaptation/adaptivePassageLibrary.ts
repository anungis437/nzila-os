/**
 * ARTIFACT TYPE: Bilingual Passage Library
 * MODULE: OCRA Dynamic Questionnaire Adaptation
 * DOCTRINE: OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md §6 (dignity rules)
 *
 * Every adaptive passage exists in both `en-CA` and `fr-CA`. The library is
 * the single source of truth for adaptive narrative language. No string
 * interpolation of respondent-supplied data. No free text. Every passage is
 * version-locked to the doctrine version.
 *
 * Dignity discipline:
 *  - Never shame a small organization.
 *  - Never flatter a large one.
 *  - Never patronize a federated one.
 *  - Never profile a respondent.
 *
 * To revise a passage: bump ADAPTATION_DOCTRINE_VERSION, update both
 * locales, and refresh the narrative snapshot tests.
 */

import type {
  ContinuityExposure,
  GovernanceComplexity,
  InstitutionalScale,
  RespondentLens,
} from './types';

export type SupportedLocale = 'en-CA' | 'fr-CA';

export interface BilingualPassage {
  readonly 'en-CA': string;
  readonly 'fr-CA': string;
}

// ── Scale openers ──────────────────────────────────────────────────────────

const SCALE_OPENERS: Record<InstitutionalScale, BilingualPassage> = {
  micro: {
    'en-CA':
      'In smaller institutions, continuity risk often concentrates in trusted individuals rather than formal systems. The concern is not lack of care; it is the absence of structural relief for the people carrying continuity.',
    'fr-CA':
      "Dans les institutions de plus petite taille, le risque de continuité se concentre souvent autour de personnes de confiance plutôt que de systèmes formels. La préoccupation n'est pas le manque d'attention ; c'est l'absence de relève structurelle pour celles et ceux qui portent la continuité.",
  },
  small: {
    'en-CA':
      'In small institutions, continuity often depends on a few key people who know how things actually work. This reading focuses on the structural support those people receive, not on their personal capability.',
    'fr-CA':
      "Dans les petites institutions, la continuité repose souvent sur quelques personnes clés qui savent comment les choses fonctionnent réellement. Cette lecture porte sur le soutien structurel dont ces personnes bénéficient, et non sur leurs capacités personnelles.",
  },
  mid_sized: {
    'en-CA':
      'In mid-sized institutions, continuity risk typically appears at the seams — between functions, between leadership transitions, and between formal process and informal practice.',
    'fr-CA':
      "Dans les institutions de taille moyenne, le risque de continuité apparaît généralement aux jointures — entre les fonctions, entre les transitions de leadership, et entre les processus formels et les pratiques informelles.",
  },
  large: {
    'en-CA':
      'In institutions of this scale, continuity is rarely the work of one person. Risk concentrates in coordination across functions and in the loss of memory that comes with normal turnover.',
    'fr-CA':
      "Dans les institutions de cette envergure, la continuité est rarement le fait d'une seule personne. Le risque se concentre dans la coordination entre les fonctions et dans la perte de mémoire qui accompagne le roulement normal.",
  },
  enterprise: {
    'en-CA':
      'At enterprise scale, continuity is institutional infrastructure rather than individual practice. The reading below focuses on whether that infrastructure is observable, replayable, and trusted across the organization.',
    'fr-CA':
      "À l'échelle d'une grande entreprise, la continuité relève de l'infrastructure institutionnelle plutôt que de la pratique individuelle. La lecture ci-dessous porte sur le caractère observable, rejouable et fiable de cette infrastructure dans l'ensemble de l'organisation.",
  },
  federated_complex: {
    'en-CA':
      'In federated environments, continuity risk often appears as uneven interpretation across units, regions, committees, or affiliated bodies. The central question is whether institutional memory survives across the federation, not only within one office.',
    'fr-CA':
      "Dans les environnements fédérés, le risque de continuité se manifeste souvent par une interprétation inégale entre unités, régions, comités ou organismes affiliés. La question centrale est de savoir si la mémoire institutionnelle survit à travers la fédération, et non seulement au sein d'un seul bureau.",
  },
};

// ── Governance framings ────────────────────────────────────────────────────

const GOVERNANCE_FRAMINGS: Record<GovernanceComplexity, BilingualPassage> = {
  simple: {
    'en-CA':
      'Governance here is read at face value: the institution operates without layered oversight structures, so continuity rests on direct stewardship.',
    'fr-CA':
      "La gouvernance est lue au premier degré : l'institution fonctionne sans structures de surveillance superposées, de sorte que la continuité repose sur une intendance directe.",
  },
  structured: {
    'en-CA':
      'Governance is structured around an elected or appointed body, which creates predictable transitions but also predictable interpretive gaps when stewardship changes hands.',
    'fr-CA':
      "La gouvernance s'organise autour d'un organe élu ou nommé, ce qui produit des transitions prévisibles mais aussi des écarts d'interprétation prévisibles lorsque l'intendance change de mains.",
  },
  multi_layer: {
    'en-CA':
      'Multi-layer governance creates multiple points where continuity decisions are made and multiple points where they can drift. The reading attends to alignment between layers, not only within each layer.',
    'fr-CA':
      "Une gouvernance à plusieurs paliers crée de multiples points où les décisions de continuité sont prises et de multiples points où elles peuvent dériver. La lecture porte sur l'alignement entre les paliers, et non seulement au sein de chaque palier.",
  },
  federated: {
    'en-CA':
      'Federated governance distributes authority across affiliated units. Continuity reads through coordination quality, not through any single unit\u2019s posture.',
    'fr-CA':
      "Une gouvernance fédérée répartit l'autorité entre des unités affiliées. La continuité se lit à travers la qualité de la coordination, et non à travers la posture d'une unité particulière.",
  },
  public_accountability: {
    'en-CA':
      'Public-accountability governance carries obligations to constituencies beyond the institution itself. Continuity must remain explainable to those constituencies, not only to internal stewards.',
    'fr-CA':
      "Une gouvernance assortie d'une reddition de comptes publique comporte des obligations envers des publics au-delà de l'institution elle-même. La continuité doit demeurer explicable à ces publics, et pas seulement aux intendants internes.",
  },
};

// ── Exposure framings ──────────────────────────────────────────────────────

const EXPOSURE_FRAMINGS: Record<ContinuityExposure, BilingualPassage> = {
  localized: {
    'en-CA':
      'Continuity exposure is localized: a continuity gap here affects this institution and its immediate participants, without rippling outward.',
    'fr-CA':
      "L'exposition à la continuité est localisée : une lacune ici touche cette institution et ses participants immédiats, sans se propager au-delà.",
  },
  cross_functional: {
    'en-CA':
      'Continuity exposure is cross-functional: a gap in one area can quickly become a gap in another, because the institution\u2019s work depends on connections between functions.',
    'fr-CA':
      "L'exposition à la continuité est interfonctionnelle : une lacune dans un domaine peut rapidement en devenir une dans un autre, parce que le travail de l'institution repose sur les liens entre les fonctions.",
  },
  multi_site: {
    'en-CA':
      'Continuity exposure is multi-site: practice may vary between locations, and a gap in one location does not necessarily indicate the same gap elsewhere.',
    'fr-CA':
      "L'exposition à la continuité couvre plusieurs sites : les pratiques peuvent varier d'un endroit à l'autre, et une lacune dans un site n'indique pas nécessairement la même lacune ailleurs.",
  },
  public_trust: {
    'en-CA':
      'Continuity exposure carries a public-trust dimension: failures here are visible beyond the institution, and recovery takes longer than the technical fix would suggest.',
    'fr-CA':
      "L'exposition à la continuité comporte une dimension de confiance publique : les défaillances ici sont visibles au-delà de l'institution, et la reprise prend plus de temps que ce que la correction technique pourrait laisser croire.",
  },
  mission_critical: {
    'en-CA':
      'Continuity exposure is mission-critical: a gap here translates directly into harm or service interruption for the people the institution exists to serve.',
    'fr-CA':
      "L'exposition à la continuité est essentielle à la mission : une lacune ici se traduit directement par un préjudice ou une interruption de service pour les personnes que l'institution dessert.",
  },
};

// ── Respondent caveats ─────────────────────────────────────────────────────

const RESPONDENT_CAVEATS: Record<RespondentLens, BilingualPassage | null> = {
  inside_operator: null,
  senior_decision_maker: null,
  board_governance: {
    'en-CA':
      'This assessment was completed from a board-governance perspective. Findings should be validated with operational stewards before being used to direct operational change.',
    'fr-CA':
      "Cette évaluation a été complétée dans une perspective de gouvernance par le conseil. Les constats doivent être validés avec les intendants opérationnels avant d'orienter des changements opérationnels.",
  },
  external_advisor: {
    'en-CA':
      'Because this assessment was completed from an advisory perspective, findings should be treated as an external continuity reading and validated with internal stewards before operational decisions are made.',
    'fr-CA':
      "Comme cette évaluation a été réalisée dans une perspective consultative, les constats doivent être considérés comme une lecture externe de la continuité et validés avec les intendants internes avant toute décision opérationnelle.",
  },
  legal_or_counsel: {
    'en-CA':
      'This assessment was completed from a legal/counsel perspective. Continuity findings here are not legal advice; they should be paired with operational and governance review.',
    'fr-CA':
      "Cette évaluation a été complétée dans une perspective juridique. Les constats de continuité ne constituent pas un avis juridique ; ils devraient être accompagnés d'une revue opérationnelle et de gouvernance.",
  },
  unknown: {
    'en-CA':
      'Respondent capacity was not declared. This reading should be treated as a baseline continuity sensing rather than a stewardship-validated assessment.',
    'fr-CA':
      "La qualité du répondant n'a pas été déclarée. Cette lecture doit être traitée comme une perception de référence de la continuité plutôt que comme une évaluation validée par l'intendance.",
  },
};

// ── Public accessors ──────────────────────────────────────────────────────

export function scaleOpener(scale: InstitutionalScale, locale: SupportedLocale): string {
  return SCALE_OPENERS[scale][locale];
}

export function governanceFraming(
  complexity: GovernanceComplexity,
  locale: SupportedLocale,
): string {
  return GOVERNANCE_FRAMINGS[complexity][locale];
}

export function exposureFraming(
  exposure: ContinuityExposure,
  locale: SupportedLocale,
): string {
  return EXPOSURE_FRAMINGS[exposure][locale];
}

export function respondentCaveat(
  lens: RespondentLens,
  locale: SupportedLocale,
): string | null {
  const passage = RESPONDENT_CAVEATS[lens];
  return passage ? passage[locale] : null;
}

/** Exposed for parity tests — every dimension must carry both locales. */
export const _PASSAGE_TABLES = Object.freeze({
  SCALE_OPENERS,
  GOVERNANCE_FRAMINGS,
  EXPOSURE_FRAMINGS,
  RESPONDENT_CAVEATS,
});
