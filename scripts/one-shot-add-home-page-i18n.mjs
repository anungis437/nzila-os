#!/usr/bin/env node
// One-shot: add `homePage` namespace to en-CA.json and fr-CA.json (Union Eyes).
// Idempotent: re-running overwrites the homePage namespace with the canonical values.
/* eslint-disable security/detect-non-literal-fs-filename */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), 'apps', 'union-eyes', 'messages');

const en = {
  meta: {
    title: 'Union Eyes | Institutional Continuity & Governance Infrastructure',
    description:
      'Union Eyes is the continuity layer for federated institutions — preserving institutional memory, strengthening governance coordination, and modernizing operational trust through non-disruptive implementation alongside existing systems. Canadian-hosted, bilingual-first, sovereignty-conscious.',
  },
  jsonLd: {
    name: 'Union Eyes',
    description:
      'Institutional continuity layer and governance infrastructure for federated organizations. Canadian-hosted, bilingual-first, sovereignty-conscious.',
  },
  hero: {
    eyebrow: 'Institutional Governance & Continuity Infrastructure',
    headlineLine1: 'Confidence that institutional memory',
    headlineLine2: 'will outlive any individual.',
    imageAlt: 'Institutional governance and continuity infrastructure',
    subhead:
      'Union Eyes helps federated institutions preserve institutional memory, strengthen governance coordination, and modernize procedural trust through non-disruptive implementation alongside existing systems.',
    ctaPrimary: 'Book Strategic Discovery',
    ctaSecondary: 'Explore Continuity Infrastructure',
  },
  posture: {
    eyebrow: 'Institutional posture',
    points: [
      { metric: 'Canadian-hosted', label: 'Sovereignty-conscious residency', sub: 'Bilingual-first, no cross-border egress' },
      { metric: 'Non-disruptive', label: 'Coexistence by design', sub: 'Augments existing systems alongside current tooling' },
      { metric: 'Audit-grade', label: 'Procedural transparency', sub: 'Every decision evidence-backed and reviewable' },
      { metric: 'Human-led', label: 'Reviewability & oversight', sub: 'Assistive intelligence, never autonomous' },
    ],
  },
  continuity: {
    eyebrow: 'Institutional continuity',
    heading: 'Stewardship that outlives leadership turnover.',
    lede:
      'Continuity is not a feature. It is the institutional discipline of preserving procedural context, decisions, and reasoning across every handoff.',
    pillars: [
      {
        title: 'Institutional memory preservation',
        desc: 'Retain governance context, decisions, and reasoning through every leadership succession and handoff. Stewardship continuity outlives any individual.',
      },
      {
        title: 'Federated governance coordination',
        desc: 'Strengthen procedural coordination across locals, councils, and federations without disrupting existing chains of authority or bylaw structures.',
      },
      {
        title: 'Procedural trust & auditability',
        desc: 'Audit-grade evidence, transparency, and explainability anchor every case management and representation decision.',
      },
      {
        title: 'Non-disruptive implementation',
        desc: 'Overlay infrastructure that augments existing systems — a continuity layer your institution can adopt alongside current tooling.',
      },
    ],
  },
  federation: {
    eyebrow: 'Federated coordination',
    heading: 'Governance-safe coordination across locals, councils, and federations.',
    body1:
      'Federations are not org charts. They are layered institutions with distinct procedural authority, bylaws, and committee structures.',
    body2:
      'Union Eyes provides operational alignment and institutional visibility across the federation without collapsing it into a single hierarchy or bypassing local authority.',
  },
  procedural: {
    eyebrow: 'Procedural trust',
    heading: 'Every decision is traceable, reviewable, and accountable.',
    body1:
      'Procedural traceability is the foundation of institutional trust. Each case, recommendation, and governance action is anchored to evidence and a named reviewer of record.',
    body2:
      'Audit-grade transparency, explainability, and operational accountability are structural — not bolted on.',
  },
  coexistence: {
    eyebrow: 'Non-disruptive modernization',
    heading: 'An overlay infrastructure — not a replacement.',
    lede:
      'Institutions modernize at institutional pace. Union Eyes deploys as a continuity layer alongside existing systems.',
    points: [
      'Overlay infrastructure that augments existing systems — no replacement required.',
      'Modular adoption: deploy a continuity layer one workflow at a time.',
      'Layered modernization runs alongside existing systems with full coexistence.',
      'Institutional evolution proceeds without disrupting current procedural chains.',
    ],
  },
  labourSafeAi: {
    eyebrow: 'Labour-safe AI',
    heading: 'Assistive intelligence under structural human oversight.',
    body1:
      'Intelligence recommends. Stewards and representatives decide. Reviewability, explainability, and procedural transparency are required — not optional.',
    body2:
      'No individual performance ranking. No behavioural profiling. No autonomous procedural action. Governance-safe AI by design.',
    principles: [
      'Human oversight is structural, not optional — every recommendation routes to a named reviewer of record.',
      'Explainability and reviewability are required for every assistive intelligence output.',
      'Governance-safe AI: assistive intelligence supports stewards and representatives, never substitutes for them.',
      'Procedural transparency: complete evidence chains for every governance interaction.',
    ],
  },
  canadian: {
    eyebrow: 'Canadian institutional infrastructure',
    heading: 'Canadian-hosted, bilingual-first, sovereignty-conscious.',
    lede: 'Democratic infrastructure built for the institutions that shape Canadian working life.',
    pillars: [
      { title: 'Canadian-hosted infrastructure', desc: 'Sovereignty-conscious residency with no cross-border data egress.' },
      { title: 'Bilingual-first by design', desc: 'English and French institutional surfaces from day one — never an afterthought.' },
      { title: 'Institutional trust posture', desc: 'Democratic infrastructure for federations, councils, and member-driven institutions.' },
      { title: 'Governance-safe operations', desc: 'Procedural neutrality, explainability, and stewardship continuity in every workflow.' },
    ],
  },
  finalCta: {
    heading: 'Discuss continuity infrastructure for your institution.',
    body:
      'A consultative conversation about institutional continuity, governance coordination, and procedural trust — paced to your federation, not to a sales cycle.',
    ctaPrimary: 'Book Strategic Discovery',
    ctaSecondary: 'View Trust & Stewardship',
  },
  svg: {
    continuity: {
      ariaLabel: 'Institutional continuity timeline across leadership succession',
      stewardA: 'Steward A',
      handoff: 'Handoff',
      stewardB: 'Steward B',
      stewardC: 'Steward C',
      caption: 'Institutional memory preserved across succession',
    },
    federation: {
      ariaLabel: 'Federated coordination topology',
      federation: 'Federation',
      council: 'Council',
    },
    evidence: {
      ariaLabel: 'Evidence chain and procedural lineage',
      evidence: 'Evidence',
      stepPrefix: 'Step',
      caption: 'Each decision linked to reviewable evidence and a named reviewer of record.',
    },
    coexistence: {
      ariaLabel: 'Overlay continuity layer alongside existing systems',
      existingCrm: 'Existing CRM',
      existingCase: 'Existing case tools',
      existingRecords: 'Existing records',
      layerTitle: 'Union Eyes continuity layer (overlay infrastructure)',
      layerSubtitle: 'Augments existing systems · non-disruptive implementation',
    },
  },
};

const fr = {
  meta: {
    title: 'Union Eyes | Continuité institutionnelle et infrastructure de gouvernance',
    description:
      'Union Eyes est la couche de continuité pour les institutions fédérées — préservant la mémoire institutionnelle, renforçant la coordination de gouvernance et modernisant la confiance opérationnelle par une mise en œuvre non perturbatrice aux côtés des systèmes existants. Hébergé au Canada, bilingue d’abord, respectueux de la souveraineté.',
  },
  jsonLd: {
    name: 'Union Eyes',
    description:
      'Couche de continuité institutionnelle et infrastructure de gouvernance pour les organisations fédérées. Hébergé au Canada, bilingue d’abord, respectueux de la souveraineté.',
  },
  hero: {
    eyebrow: 'Gouvernance institutionnelle et infrastructure de continuité',
    headlineLine1: 'La certitude que la mémoire institutionnelle',
    headlineLine2: 'survivra à toute personne.',
    imageAlt: 'Gouvernance institutionnelle et infrastructure de continuité',
    subhead:
      'Union Eyes aide les institutions fédérées à préserver la mémoire institutionnelle, à renforcer la coordination de gouvernance et à moderniser la confiance procédurale par une mise en œuvre non perturbatrice aux côtés des systèmes existants.',
    ctaPrimary: 'Planifier une découverte stratégique',
    ctaSecondary: 'Découvrir l’infrastructure de continuité',
  },
  posture: {
    eyebrow: 'Posture institutionnelle',
    points: [
      { metric: 'Hébergé au Canada', label: 'Résidence respectueuse de la souveraineté', sub: 'Bilingue d’abord, aucune sortie de données transfrontalière' },
      { metric: 'Non perturbateur', label: 'Coexistence par conception', sub: 'Renforce les systèmes existants aux côtés de l’outillage actuel' },
      { metric: 'Qualité d’audit', label: 'Transparence procédurale', sub: 'Chaque décision étayée par des preuves et révisable' },
      { metric: 'Dirigé par l’humain', label: 'Révisabilité et supervision', sub: 'Intelligence d’assistance, jamais autonome' },
    ],
  },
  continuity: {
    eyebrow: 'Continuité institutionnelle',
    heading: 'Une intendance qui survit aux changements de leadership.',
    lede:
      'La continuité n’est pas une fonctionnalité. C’est la discipline institutionnelle qui consiste à préserver le contexte procédural, les décisions et le raisonnement à chaque transition.',
    pillars: [
      {
        title: 'Préservation de la mémoire institutionnelle',
        desc: 'Conserver le contexte de gouvernance, les décisions et le raisonnement à travers chaque succession de leadership et chaque transition. La continuité de l’intendance survit à toute personne.',
      },
      {
        title: 'Coordination de gouvernance fédérée',
        desc: 'Renforcer la coordination procédurale entre sections locales, conseils et fédérations sans perturber les chaînes d’autorité ni les structures de règlements existantes.',
      },
      {
        title: 'Confiance procédurale et auditabilité',
        desc: 'Des preuves de qualité d’audit, la transparence et l’explicabilité ancrent chaque décision de gestion de dossiers et de représentation.',
      },
      {
        title: 'Mise en œuvre non perturbatrice',
        desc: 'Une infrastructure de superposition qui renforce les systèmes existants — une couche de continuité que votre institution peut adopter aux côtés de son outillage actuel.',
      },
    ],
  },
  federation: {
    eyebrow: 'Coordination fédérée',
    heading: 'Une coordination respectueuse de la gouvernance entre sections locales, conseils et fédérations.',
    body1:
      'Les fédérations ne sont pas des organigrammes. Ce sont des institutions à plusieurs niveaux, avec une autorité procédurale, des règlements et des structures de comités distincts.',
    body2:
      'Union Eyes assure l’alignement opérationnel et la visibilité institutionnelle au sein de la fédération, sans la réduire à une hiérarchie unique ni contourner l’autorité locale.',
  },
  procedural: {
    eyebrow: 'Confiance procédurale',
    heading: 'Chaque décision est traçable, révisable et redevable.',
    body1:
      'La traçabilité procédurale est le fondement de la confiance institutionnelle. Chaque dossier, recommandation et action de gouvernance est ancré à des preuves et à un réviseur attitré.',
    body2:
      'La transparence de qualité d’audit, l’explicabilité et la responsabilité opérationnelle sont structurelles — non ajoutées après coup.',
  },
  coexistence: {
    eyebrow: 'Modernisation non perturbatrice',
    heading: 'Une infrastructure de superposition — non un remplacement.',
    lede:
      'Les institutions se modernisent au rythme institutionnel. Union Eyes se déploie comme couche de continuité aux côtés des systèmes existants.',
    points: [
      'Une infrastructure de superposition qui renforce les systèmes existants — aucun remplacement requis.',
      'Adoption modulaire : déployez une couche de continuité un flux de travail à la fois.',
      'La modernisation par couches s’exécute aux côtés des systèmes existants en pleine coexistence.',
      'L’évolution institutionnelle se poursuit sans perturber les chaînes procédurales actuelles.',
    ],
  },
  labourSafeAi: {
    eyebrow: 'IA respectueuse du travail',
    heading: 'Une intelligence d’assistance sous supervision humaine structurelle.',
    body1:
      'L’intelligence recommande. Les intendants et les représentants décident. La révisabilité, l’explicabilité et la transparence procédurale sont requises — non optionnelles.',
    body2:
      'Aucun classement individuel de performance. Aucun profilage comportemental. Aucune action procédurale autonome. Une IA respectueuse de la gouvernance par conception.',
    principles: [
      'La supervision humaine est structurelle, non optionnelle — chaque recommandation est dirigée vers un réviseur attitré.',
      'L’explicabilité et la révisabilité sont requises pour chaque résultat d’intelligence d’assistance.',
      'IA respectueuse de la gouvernance : l’intelligence d’assistance soutient les intendants et les représentants, sans jamais s’y substituer.',
      'Transparence procédurale : des chaînes de preuves complètes pour chaque interaction de gouvernance.',
    ],
  },
  canadian: {
    eyebrow: 'Infrastructure institutionnelle canadienne',
    heading: 'Hébergé au Canada, bilingue d’abord, respectueux de la souveraineté.',
    lede: 'Une infrastructure démocratique conçue pour les institutions qui façonnent la vie au travail au Canada.',
    pillars: [
      { title: 'Infrastructure hébergée au Canada', desc: 'Résidence respectueuse de la souveraineté, sans sortie de données transfrontalière.' },
      { title: 'Bilingue d’abord par conception', desc: 'Surfaces institutionnelles en français et en anglais dès le premier jour — jamais après coup.' },
      { title: 'Posture de confiance institutionnelle', desc: 'Une infrastructure démocratique pour les fédérations, les conseils et les institutions dirigées par leurs membres.' },
      { title: 'Opérations respectueuses de la gouvernance', desc: 'Neutralité procédurale, explicabilité et continuité de l’intendance dans chaque flux de travail.' },
    ],
  },
  finalCta: {
    heading: 'Discutons d’une infrastructure de continuité pour votre institution.',
    body:
      'Une conversation consultative sur la continuité institutionnelle, la coordination de gouvernance et la confiance procédurale — au rythme de votre fédération, et non d’un cycle de vente.',
    ctaPrimary: 'Planifier une découverte stratégique',
    ctaSecondary: 'Voir la confiance et l’intendance',
  },
  svg: {
    continuity: {
      ariaLabel: 'Chronologie de continuité institutionnelle à travers la succession du leadership',
      stewardA: 'Intendant·e A',
      handoff: 'Transition',
      stewardB: 'Intendant·e B',
      stewardC: 'Intendant·e C',
      caption: 'Mémoire institutionnelle préservée à travers la succession',
    },
    federation: {
      ariaLabel: 'Topologie de coordination fédérée',
      federation: 'Fédération',
      council: 'Conseil',
    },
    evidence: {
      ariaLabel: 'Chaîne de preuves et lignée procédurale',
      evidence: 'Preuve',
      stepPrefix: 'Étape',
      caption: 'Chaque décision liée à une preuve révisable et à un réviseur attitré.',
    },
    coexistence: {
      ariaLabel: 'Couche de continuité superposée aux systèmes existants',
      existingCrm: 'CRM existant',
      existingCase: 'Outils de dossiers existants',
      existingRecords: 'Archives existantes',
      layerTitle: 'Couche de continuité Union Eyes (infrastructure de superposition)',
      layerSubtitle: 'Renforce les systèmes existants · mise en œuvre non perturbatrice',
    },
  },
};

function patch(file, namespace) {
  const allowedFiles = new Set(['en-CA.json', 'fr-CA.json']);
  if (!allowedFiles.has(file)) {
    throw new Error(`Disallowed file argument: ${file}`);
  }

  const filePaths = {
    'en-CA.json': resolve(root, 'en-CA.json'),
    'fr-CA.json': resolve(root, 'fr-CA.json'),
  };

  const filePath = filePaths[file];
  // nosemgrep
  const obj = JSON.parse(readFileSync(filePath, 'utf8'));
  obj.homePage = namespace;
  writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  console.log(`patched ${file}`);
}

patch('en-CA.json', en);
patch('fr-CA.json', fr);
// it/pt rely on en-CA fallback merge in i18n.ts — no explicit copy needed
// (and they are hidden from the public picker via visibleLocales).
