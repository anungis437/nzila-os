#!/usr/bin/env node
// One-shot: replace `marketing.home` namespace to match the current homepage design.
// Idempotent — re-running overwrites with canonical values.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), 'apps', 'union-eyes', 'messages');

const en = {
  badge: 'Institutional Governance & Continuity Infrastructure',
  heroHeadingLine1: 'Confidence that',
  heroHeadingLine2: 'institutional memory will outlive any individual.',
  heroDescription:
    'Union Eyes is the operational infrastructure layer for institutional labour continuity — governance-safe cognition, institutional memory, stewardship continuity, and anti-surveillance posture, embodied as one operating environment.',
  ctaPrimary: 'Request Executive Briefing',
  ctaSecondary: 'Explore Solutions',
  proofSectionLabel: 'Built-in platform guarantees',
  pp1Label: 'Explainable decisions',
  pp1Sub: 'Every recommendation auditable',
  pp2Label: 'Worker surveillance paths',
  pp2Sub: 'Anti-surveillance by design',
  pp3Label: 'Data residency',
  pp3Sub: 'Sovereign hosting, no cross-border egress',
  pp4Label: 'Institutional memory',
  pp4Sub: 'Continuity across leadership transitions',
  outcomesHeading: 'Enterprise-grade operations, institution-first design',
  outcomesDescription:
    'Union Eyes is designed for leadership continuity, governance modernization, and democratic trust at scale.',
  outcome1Title: 'Institutional continuity',
  outcome1Desc:
    'Leadership transitions retain strategic memory, governance context, and operational direction.',
  outcome2Title: 'Governance-safe cognition',
  outcome2Desc:
    'Every interpretation is bounded, evidence-anchored, and reviewer-of-record resolved.',
  outcome3Title: 'Operational coherence',
  outcome3Desc:
    'Distributed teams work from one shared operating view instead of fragmented systems.',
  outcome4Title: 'Anti-surveillance posture',
  outcome4Desc:
    'Continuity-safe modernization, anti-surveillance design, and human oversight enforced structurally at every layer.',
  govHeading: 'Explainable intelligence with democratic safeguards',
  govDescription:
    'Intelligence recommends. People decide. Governance controls, labour-safe standards, and auditable evidence are built into every workflow.',
  principle1: 'Human oversight is required, not optional.',
  principle2: 'No black-box outputs: every result is explainable.',
  principle3: 'No worker surveillance capability path.',
  principle4: 'Complete audit trails for governance trust.',
  govImageAlt: 'Union assembly governance session with democratic oversight',
  finalCtaHeading: 'Ready for institutional continuity at executive scale?',
  finalCtaDescription:
    'Start with a guided pilot built around your governance and operations priorities.',
  finalCtaPrimary: 'Request Executive Briefing',
  finalCtaSecondary: 'View Governance & Trust',
};

const fr = {
  badge: 'Gouvernance institutionnelle et infrastructure de continuité',
  heroHeadingLine1: 'La certitude que',
  heroHeadingLine2: 'la mémoire institutionnelle survivra à toute personne.',
  heroDescription:
    "Union Eyes est la couche d\u2019infrastructure op\u00e9rationnelle pour la continuit\u00e9 du travail institutionnel \u2014 cognition respectueuse de la gouvernance, m\u00e9moire institutionnelle, continuit\u00e9 de l\u2019intendance et posture anti-surveillance, incarn\u00e9es en un seul environnement op\u00e9rationnel.",
  ctaPrimary: 'Demander une présentation exécutive',
  ctaSecondary: 'Explorer les solutions',
  proofSectionLabel: 'Garanties intégrées à la plateforme',
  pp1Label: 'Décisions explicables',
  pp1Sub: 'Chaque recommandation vérifiable',
  pp2Label: 'Voies de surveillance des travailleurs',
  pp2Sub: 'Anti-surveillance par conception',
  pp3Label: 'Résidence des données',
  pp3Sub: 'Hébergement souverain, aucune sortie transfrontalière',
  pp4Label: 'Mémoire institutionnelle',
  pp4Sub: 'Continuité à travers les transitions de leadership',
  outcomesHeading: "Opérations de qualité entreprise, conception axée sur l'institution",
  outcomesDescription:
    'Union Eyes est conçu pour la continuité du leadership, la modernisation de la gouvernance et la confiance démocratique à grande échelle.',
  outcome1Title: 'Continuité institutionnelle',
  outcome1Desc:
    'Les transitions de leadership préservent la mémoire stratégique, le contexte de gouvernance et la direction opérationnelle.',
  outcome2Title: 'Cognition respectueuse de la gouvernance',
  outcome2Desc:
    "Chaque interprétation est délimitée, ancrée dans les preuves et résolue par un réviseur attitré.",
  outcome3Title: 'Cohérence opérationnelle',
  outcome3Desc:
    "Les équipes distribuées travaillent à partir d'une vue opérationnelle partagée au lieu de systèmes fragmentés.",
  outcome4Title: 'Posture anti-surveillance',
  outcome4Desc:
    "Modernisation respectueuse de la continuité, conception anti-surveillance et supervision humaine appliquée structurellement à chaque couche.",
  govHeading: 'Intelligence explicable avec des garanties démocratiques',
  govDescription:
    "L'intelligence recommande. Les gens décident. Les contrôles de gouvernance, les normes respectueuses du travail et les preuves vérifiables sont intégrés dans chaque flux de travail.",
  principle1: 'La supervision humaine est requise, non optionnelle.',
  principle2: 'Aucune sortie boîte noire\u00a0: chaque résultat est explicable.',
  principle3: 'Aucune voie de surveillance des travailleurs.',
  principle4: "Pistes d'audit complètes pour la confiance en matière de gouvernance.",
  govImageAlt:
    'Assemblée syndicale — session de gouvernance avec supervision démocratique',
  finalCtaHeading: "Prêt pour la continuité institutionnelle à l'échelle exécutive\u00a0?",
  finalCtaDescription:
    "Commencez par un pilote guidé construit autour de vos priorités en matière de gouvernance et d'opérations.",
  finalCtaPrimary: 'Demander une présentation exécutive',
  finalCtaSecondary: 'Voir la gouvernance et la confiance',
};

function patch(file, newHomeContent) {
  const allowedFiles = new Set(['en-CA.json', 'fr-CA.json']);
  if (!allowedFiles.has(file)) throw new Error(`Disallowed file: ${file}`);

  const filePaths = {
    'en-CA.json': resolve(root, 'en-CA.json'),
    'fr-CA.json': resolve(root, 'fr-CA.json'),
  };
  const filePath = filePaths[file];
  // nosemgrep
  const obj = JSON.parse(readFileSync(filePath, 'utf8'));
  obj.marketing.home = newHomeContent;
  writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  console.log(`patched ${file}`);
}

patch('en-CA.json', en);
patch('fr-CA.json', fr);
