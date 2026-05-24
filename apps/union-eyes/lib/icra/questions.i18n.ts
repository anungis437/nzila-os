/**
 * ARTIFACT TYPE: i18n Translation Map
 * DOCTRINE_VERSION: 1.0.0
 *
 * fr-CA translations for the ICRA question bank.
 *
 * Design: the English question bank in ./questions.ts is the canonical
 * source of truth (ids, weights, scoring, observations). This file
 * carries Quebec-French translations of every user-visible string in
 * the assessment flow. Lookups are by question id / option value; any
 * missing key falls back to the canonical English string, so this map
 * can be completed incrementally without breaking the flow.
 *
 * Coverage at v1:
 *   - All section titles + intros
 *   - All five maturity scale labels
 *   - All five metadata questions (prompts + helpText) and ALL options
 *   - All scored question prompts + helpText
 *
 * Not yet translated (server-side narrative, not flow-visible):
 *   - Per-option `observation` strings (used for narrative generation)
 *   - Per-question `rationale` (internal doctrine reference)
 */

import type { SectionId } from './types';
import type { MetadataQuestion } from './questions';

export type SupportedLocale = 'en-CA' | 'fr-CA';

interface SectionStrings {
  title: string;
  intro: string;
}

interface OptionStrings {
  label: string;
  group?: string;
}

interface QuestionStrings {
  prompt: string;
  helpText?: string;
  options?: Record<string, OptionStrings>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section labels
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_FR: Record<SectionId, SectionStrings> = {
  organizational_context: {
    title: 'Contexte organisationnel',
    intro:
      "Quelques éléments de contexte pour que le profil obtenu puisse être interprété correctement. Rien ici ne permet d'identifier une personne.",
  },
  operational_dependency: {
    title: 'Dépendance opérationnelle',
    intro:
      'Là où le fonctionnement organisationnel repose sur des personnes précises plutôt que sur des procédures organisationnelles.',
  },
  governance_visibility: {
    title: 'Visibilité de la gouvernance',
    intro:
      "Si les instances de gouvernance peuvent voir la réalité opérationnelle sans qu'un effort de signalement héroïque soit nécessaire.",
  },
  institutional_memory: {
    title: 'Mémoire organisationnelle',
    intro:
      'Si les décisions, les précédents et le savoir opérationnel survivent aux personnes qui les ont façonnés.',
  },
  transition_readiness: {
    title: 'Préparation aux transitions',
    intro:
      "Comment l'institution absorbe les changements de rôles et de direction sans perturbation opérationnelle.",
  },
  operational_coordination: {
    title: 'Coordination opérationnelle',
    intro:
      "Comment l'activité opérationnelle est coordonnée entre équipes, unités ou structures fédérées.",
  },
  explainability_trust: {
    title: 'Explicabilité et confiance',
    intro:
      "Si les décisions peuvent être expliquées à partir de preuves \u2014 aux membres, aux organes de surveillance et aux personnes qui prendront la relève.",
  },
  sovereignty_governance: {
    title: 'Souveraineté et contrôle de la gouvernance',
    intro:
      "Si l'institution maîtrise ses propres données, infrastructures et orientations organisationnelles.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Maturity scale labels (shared across all scored maturity_select questions)
// ─────────────────────────────────────────────────────────────────────────────

const MATURITY_LABEL_FR: Record<string, string> = {
  '0': 'Inexistant',
  '1': 'Informel',
  '2': 'Partiel',
  '3': 'Structuré',
  '4': 'Institutionnalisé',
};

// ─────────────────────────────────────────────────────────────────────────────
// Likert (continuity confidence) scale labels
// ─────────────────────────────────────────────────────────────────────────────

const LIKERT_SCALE_FR = {
  minLabel: "Pas du tout vrai pour notre organisation",
  maxLabel: "Constamment vrai pour notre organisation",
};

// ─────────────────────────────────────────────────────────────────────────────
// Metadata question translations (full coverage)
// ─────────────────────────────────────────────────────────────────────────────

const METADATA_FR: Record<string, QuestionStrings> = {
  ctx_org_type: {
    prompt: "Quel type d'organisation représentez-vous?",
    options: {
      local_union:          { label: 'Syndicat local',                                group: 'Travail et associations de membres' },
      national_union:       { label: 'Syndicat national ou international',            group: 'Travail et associations de membres' },
      federation:           { label: 'Fédération ou conseil syndical',                group: 'Travail et associations de membres' },
      guild:                { label: 'Ordre ou association professionnelle',          group: 'Travail et associations de membres' },
      clc_affiliate:        { label: 'Affilié au CTC ou département',                 group: 'Travail et associations de membres' },
      industry_association: { label: "Association sectorielle ou chambre",            group: 'Travail et associations de membres' },
      government_agency:    { label: 'Agence ou ministère gouvernemental',            group: 'Secteur public et civique' },
      crown_corp:           { label: "Société d'État",                                group: 'Secteur public et civique' },
      municipality:         { label: 'Municipalité ou autorité régionale',            group: 'Secteur public et civique' },
      school_board:         { label: 'Conseil scolaire ou organisme éducatif public', group: 'Secteur public et civique' },
      health_authority:     { label: 'Autorité de santé publique',                    group: 'Secteur public et civique' },
      indigenous_gov:       { label: 'Gouvernement autochtone ou conseil de bande',   group: 'Secteur public et civique' },
      nonprofit:            { label: 'Organisme à but non lucratif ou de bienfaisance', group: 'Mission et communauté' },
      foundation:           { label: 'Fondation communautaire',                       group: 'Mission et communauté' },
      faith_based:          { label: "Organisation confessionnelle",                  group: 'Mission et communauté' },
      cooperative:          { label: 'Coopérative ou mutuelle',                       group: 'Mission et communauté' },
      family_business:      { label: 'Entreprise familiale',                          group: 'Privé et professionnel' },
      professional_firm:    { label: 'Cabinet de services professionnels',            group: 'Privé et professionnel' },
      owner_operated_sme:   { label: 'PME exploitée par son propriétaire',            group: 'Privé et professionnel' },
      private_enterprise:   { label: 'Autre entreprise privée',                       group: 'Privé et professionnel' },
      other:                { label: 'Autre institution',                             group: 'Autre' },
    },
  },
  ctx_sector: {
    prompt: 'Dans quel secteur principal votre organisation évolue-t-elle?',
    options: {
      public_sector:        { label: 'Secteur public' },
      private_sector:       { label: 'Secteur privé' },
      healthcare:           { label: 'Santé et services sociaux' },
      education:            { label: 'Éducation' },
      construction:         { label: 'Construction et métiers spécialisés' },
      transportation:       { label: 'Transport et logistique' },
      retail_hospitality:   { label: 'Commerce de détail et hôtellerie' },
      media_communications: { label: 'Médias et communications' },
      financial_services:   { label: 'Services financiers' },
      other:                { label: 'Autre / secteur mixte' },
    },
  },
  ctx_membership_size: {
    prompt: 'Combien de membres votre organisation représente-t-elle, approximativement?',
    options: {
      under_100:   { label: 'Moins de 100' },
      '100_499':   { label: '100 à 499' },
      '500_1999':  { label: '500 à 1 999' },
      '2000_9999': { label: '2 000 à 9 999' },
      '10000_49999': { label: '10 000 à 49 999' },
      '50000_plus': { label: '50 000 ou plus' },
    },
  },
  ctx_years_operating: {
    prompt: 'Depuis combien de temps cette organisation est-elle en activité?',
    options: {
      under_5: { label: 'Moins de 5 ans' },
      '5_14':  { label: '5 à 14 ans' },
      '15_29': { label: '15 à 29 ans' },
      '30_plus': { label: '30 ans ou plus' },
    },
  },
  ctx_respondent_role: {
    prompt: 'À quel titre remplissez-vous cette évaluation?',
    helpText:
      "Cela ajuste la formulation de votre rapport \u2014 par exemple, les narratifs s'adressent différemment à un cadre supérieur, à un membre du conseil ou à un conseiller externe préparant un dossier pour le compte d'un client.",
    options: {
      self_senior_leader:   { label: 'Je suis cadre supérieur de cette organisation' },
      self_board_member:    { label: 'Je suis membre du conseil ou du comité exécutif' },
      self_staff:           { label: 'Je suis membre du personnel de cette organisation' },
      on_behalf_consultant: { label: "Je suis conseiller externe ou consultant et je prépare ceci pour un client" },
      on_behalf_counsel:    { label: "Je suis conseiller juridique et je prépare ceci pour le compte d'un client" },
      on_behalf_other:      { label: "Je remplis ceci au nom de l'organisation à un autre titre" },
    },
  },
  ctx_primary_challenge: {
    prompt: "Y a-t-il un défi précis de continuité ou de gouvernance qui a motivé cette évaluation? (Facultatif)",
    helpText:
      "Veuillez décrire en termes organisationnels généraux \u2014 n'incluez pas de noms de personnes, de noms d'employeurs, d'identifiants de membres ou de faits précis d'un dossier. Ce champ est conservé avec votre évaluation. Limite de 500 caractères.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Scored question translations (prompts + helpText only; observations
// remain EN for the narrative engine until that layer is localized).
// ─────────────────────────────────────────────────────────────────────────────

const SCORED_FR: Record<string, QuestionStrings> = {
  // Operational dependency
  od_01: {
    prompt:
      "Dans quelle mesure votre organisation peut-elle poursuivre ses opérations courantes si une ou deux personnes clés deviennent indisponibles sans préavis?",
    helpText:
      "Imaginez ce qui se passerait si votre directeur général, votre responsable des opérations ou l'équivalent partait aujourd'hui sans transfert.",
  },
  od_02: {
    prompt:
      "Dans quelle mesure le savoir organisationnel critique est-il documenté dans des systèmes auxquels d'autres personnes ont accès?",
    helpText:
      "Cela inclut les procédures, les contacts, l'historique des décisions et le contexte opérationnel \u2014 pas les fichiers personnels ou les boîtes courriel.",
  },
  od_03: {
    prompt:
      "Avec quelle constance le personnel qui part ou les dirigeants en transition réalisent-ils des transferts de connaissances formels?",
    helpText:
      "Un transfert de connaissances comprend les décisions documentées, les dossiers en cours, les relations clés et le contexte opérationnel transmis aux successeurs ou à l'organisation.",
  },
  od_04: {
    prompt:
      "Dans quelle mesure le savoir opérationnel est-il largement distribué \u2014 c.-à-d. plus d'une personne comprend-elle chaque fonction critique assez bien pour la remplir?",
    helpText:
      "Pensez à vos fonctions opérationnelles les plus critiques : adhésion des membres, paie, suivi des griefs, communications.",
  },
  od_05: {
    prompt:
      "Dans quelle mesure votre organisation est-elle prête à intégrer un nouveau cadre supérieur ou responsable des opérations sans un long apprentissage informel?",
    helpText:
      "Une nouvelle personne trouverait-elle du contexte documenté, un historique des décisions et un guide opérationnel \u2014 ou dépendrait-elle surtout de la mémoire organisationnelle du personnel en place?",
  },
  icb_01: {
    prompt:
      "Dans quelle mesure votre organisation reconnaît-elle et tient-elle compte du travail informel de continuité que certains membres du personnel ou dirigeants portent au nom de l'institution?",
    helpText:
      "Pensez au temps consacré à compenser l'absence de mémoire organisationnelle \u2014 traduire le contexte, expliquer l'historique, entretenir les relations \u2014 et à sa visibilité pour la direction, ou à son absorption silencieuse dans des rôles individuels.",
  },
  icb_02: {
    prompt:
      "Avec quel niveau d'intention votre organisation répartit-elle les responsabilités de continuité \u2014 de sorte que la mémoire organisationnelle ne se concentre pas discrètement chez un petit nombre de personnes?",
    helpText:
      "Plutôt que de laisser le savoir de continuité s'accumuler chez les personnes les plus anciennes ou les plus engagées.",
  },

  // Governance visibility
  gv_01: {
    prompt:
      "Avec quelle constance les décisions de gouvernance sont-elles consignées avec le raisonnement, le contexte et les preuves nécessaires pour les comprendre plus tard?",
    helpText:
      "Cela inclut les décisions du conseil, les décisions de la direction et les changements de politique \u2014 et non seulement les procès-verbaux formels.",
  },
  gv_02: {
    prompt:
      "Dans quelle mesure vos processus de gouvernance sont-ils visibles pour les instances de surveillance, les nouveaux dirigeants et les personnes touchées par les décisions?",
    helpText:
      "La visibilité signifie que les processus de gouvernance sont accessibles, compréhensibles et vérifiables \u2014 pas seulement qu'ils existent.",
  },
  gv_03: {
    prompt:
      "Dans quelle mesure votre surveillance de la gouvernance dépend-elle de ce que des personnes clés choisissent de soumettre au conseil ou à l'instance dirigeante?",
    helpText:
      "Considérez si votre instance de gouvernance peut vérifier de façon indépendante la réalité opérationnelle, ou si elle dépend de rapports filtrés par le personnel.",
  },
  gv_04: {
    prompt:
      "Avec quelle constance votre organisation suit-elle les procédures de gouvernance documentées plutôt que les précédents informels?",
    helpText:
      "Comparez la manière dont les décisions sont prises en pratique à la manière dont elles sont décrites dans les politiques \u2014 pour la gouvernance courante comme pour les situations exceptionnelles.",
  },
  gis_01: {
    prompt:
      "Avec quelle constance les interprétations de gouvernance \u2014 comment les politiques sont appliquées, comment les différends sont résolus, comment la discrétion est exercée \u2014 survivent-elles aux transitions de direction?",
    helpText:
      "Les nouveaux dirigeants héritent-ils typiquement d'orientations interprétatives documentées, ou développent-ils leurs propres interprétations de façon indépendante, parfois en renversant ce qui précédait?",
  },

  // Organizational memory
  im_01: {
    prompt:
      "Dans quelle mesure votre organisation préserve-t-elle et rend-elle accessible l'historique des décisions, des négociations et des événements opérationnels importants?",
    helpText:
      "Un nouveau dirigeant dans cinq ans pourrait-il comprendre pourquoi une politique actuelle existe, qui l'a négociée et quelles étaient les solutions de rechange?",
  },
  im_02: {
    prompt:
      "Dans quelle mesure votre organisation saisit-elle et maintient-elle le contexte relationnel qui façonne votre travail \u2014 relations avec les employeurs, les fédérations, les organismes de réglementation et les partenaires communautaires?",
    helpText:
      "Le contexte relationnel inclut l'historique des communications, la dynamique relationnelle, la posture de négociation et le savoir organisationnel nécessaire pour entretenir les relations clés.",
  },
  im_03: {
    prompt:
      "Dans quelle mesure le savoir de votre organisation sur sa propre évolution est-il préservé \u2014 changements de politique, décisions structurelles et choix de gouvernance dans le temps?",
    helpText:
      "Cela inclut par exemple pourquoi certaines dispositions figurent dans vos statuts, comment votre structure de cotisations a évolué, ou quand et pourquoi certaines pratiques opérationnelles ont été adoptées.",
  },
  im_04: {
    prompt:
      "Avec quelle constance la mémoire organisationnelle est-elle traitée comme un actif organisationnel \u2014 activement entretenue, structurée et protégée contre la perte?",
    helpText:
      "Plutôt que de la traiter comme quelque chose qui vit chez le personnel de longue date, à reconstituer de zéro lorsque ces personnes partent.",
  },
  orl_01: {
    prompt:
      "À quelle fréquence votre organisation se retrouve-t-elle à résoudre les mêmes problèmes opérationnels déjà résolus auparavant \u2014 parce que la solution antérieure n'a pas été préservée?",
    helpText:
      "Cela inclut le rétablissement de relations fournisseurs, la renégociation de modalités déjà réglées, la reconstruction de procédures qui existaient déjà ou le réapprentissage de contexte organisationnel déjà connu d'anciens employés.",
  },
  orl_02: {
    prompt:
      "Dans quelle mesure votre organisation préserve-t-elle le contexte derrière les décisions \u2014 non seulement ce qui a été décidé, mais pourquoi, ce qui a été envisagé et ce qui a été rejeté?",
    helpText:
      "Le contexte décisionnel permet aux successeurs de comprendre le raisonnement derrière les pratiques actuelles plutôt que d'hériter de résultats sans explication.",
  },
  if_01: {
    prompt:
      "Dans quelle mesure votre organisation retient-elle le savoir opérationnel acquis pendant des périodes difficiles \u2014 restructurations, conflits, crises ou transitions importantes?",
    helpText:
      "L'apprentissage organisationnel issu des périodes difficiles est-il préservé et accessible, ou est-il absorbé dans la mémoire informelle de ceux qui étaient présents et perdu lorsqu'ils partent?",
  },

  // Transition readiness
  tr_01: {
    prompt:
      "Dans quelle mesure votre organisation est-elle prête pour une transition de direction planifiée \u2014 directeur général, président élu ou équivalent?",
    helpText:
      "Existe-t-il des plans de relève documentés, du développement de candidatures et des processus de transfert de connaissances à jour?",
  },
  tr_02: {
    prompt:
      "Dans quelle mesure votre organisation est-elle prête pour un départ imprévu d'un dirigeant \u2014 démission soudaine, congé médical ou destitution?",
    helpText:
      "Pensez à ce qui se passerait dans les 90 premiers jours suivant un départ imprévu d'un cadre supérieur, et à la manière dont la cohérence opérationnelle serait maintenue.",
  },
  tr_03: {
    prompt:
      "Avec quel niveau de formalité votre organisation gère-t-elle les transitions de rôle et de direction \u2014 y compris transfert documenté, périodes de chevauchement et intégration structurée?",
    helpText:
      "Plutôt qu'un transfert informel par observation ou compagnonnage.",
  },
  tr_04: {
    prompt:
      "Avec quel niveau d'engagement votre organisation identifie-t-elle et développe-t-elle une capacité interne pour les futurs rôles de direction?",
    helpText:
      "Inclut le développement de délégués, la direction de comités, le mentorat ou des filières de relève \u2014 pas seulement les formations formelles.",
  },
  tr_05: {
    prompt:
      "Dans quelle mesure votre organisation maintient-elle la continuité de l'orientation stratégique à travers les changements de direction?",
    helpText:
      "Les nouveaux dirigeants héritent-ils d'un contexte stratégique documenté \u2014 décisions prises, raisonnement, options rejetées \u2014 ou reconstruisent-ils l'orientation par leur propre interprétation?",
  },
  onb_01: {
    prompt:
      "Dans quelle mesure votre processus d'intégration transmet-il l'intelligence organisationnelle \u2014 pas seulement les responsabilités du rôle, mais le contexte opérationnel, l'historique relationnel et la compréhension de la gouvernance qui permettent à une nouvelle personne d'agir efficacement?",
    helpText:
      "Plutôt qu'une intégration qui couvre les procédures et outils formels mais laisse le nouveau personnel absorber le contexte organisationnel par observation et conversation informelle pendant des mois ou des années.",
  },

  // Operational coordination
  oc_01: {
    prompt:
      "Dans quelle mesure votre organisation coordonne-t-elle le travail opérationnel entre équipes, services ou sections locales au moyen de mécanismes partagés et documentés?",
    helpText:
      "Plutôt que par des relations personnelles, des communications informelles ou qui que ce soit qui connaît les deux parties.",
  },
  oc_02: {
    prompt:
      "Avec quelle constance les décisions opérationnelles et leurs résultats sont-ils consignés dans des systèmes organisationnels accessibles?",
    helpText:
      "Pas seulement les décisions formelles \u2014 incluez aussi les jugements opérationnels, les exceptions de processus et les choix de prestation de service qui pourraient toucher les opérations futures.",
  },
  oc_03: {
    prompt:
      "Dans quelle mesure votre organisation suit-elle et gère-t-elle les responsabilités et imputabilités interfonctionnelles?",
    helpText:
      "Y compris qui est responsable de quoi, comment le travail est transmis entre rôles ou équipes, et comment les écarts ou conflits de responsabilité sont identifiés et résolus.",
  },
  oc_04: {
    prompt:
      "Dans quelle mesure votre organisation gère-t-elle les relations avec les fournisseurs, prestataires de services et partenaires \u2014 y compris la surveillance des contrats et le contexte organisationnel?",
    helpText:
      "Le personnel ou la direction entrante trouverait-il le contexte nécessaire pour gérer ces relations sans dépendre du savoir de son prédécesseur?",
  },
  oc_05: {
    prompt:
      "Avec quelle constance votre organisation rend-elle compte de la performance opérationnelle à partir d'informations vérifiables et documentées plutôt que par un récit informel?",
    helpText:
      "Cela inclut la reddition de comptes aux conseils, comités, membres ou bailleurs de fonds \u2014 la réalité opérationnelle est-elle étayée ou communiquée surtout par des personnes de confiance?",
  },
  cf_01: {
    prompt:
      "Dans quelle mesure la responsabilité de continuité est-elle répartie équitablement dans votre organisation \u2014 plutôt que concentrée chez un petit nombre de personnes qui portent silencieusement un fardeau organisationnel disproportionné?",
    helpText:
      "Le travail de maintien de la continuité organisationnelle \u2014 garder le contexte, traduire entre les équipes, préserver les relations \u2014 est-il reconnu et partagé, ou retombe-t-il à répétition sur les mêmes personnes?",
  },

  // Explainability & trust
  et_01: {
    prompt:
      "Dans quelle mesure votre organisation peut-elle expliquer ses décisions de gouvernance \u2014 y compris raisonnement, preuves et options envisagées \u2014 aux personnes qu'elles touchent?",
    helpText:
      "L'explicabilité signifie que le raisonnement derrière les décisions est accessible et compréhensible pour les membres, le personnel et les instances de surveillance, et non seulement pour celles et ceux qui les ont prises.",
  },
  et_02: {
    prompt:
      "Quelle dette de confiance organisationnelle accumulée votre organisation porte-t-elle \u2014 griefs non résolus, décisions inexpliquées ou conduite de gouvernance qui n'a pas été suffisamment assumée?",
    helpText:
      "La dette de confiance, c'est l'écart entre la conduite de gouvernance que votre organisation projette et la mémoire organisationnelle de celles et ceux qui l'ont vécue autrement.",
  },
  et_03: {
    prompt:
      "Avec quelle constance votre organisation offre-t-elle aux parties touchées \u2014 membres, personnel, unités de négociation \u2014 un avis et une explication significatifs des décisions qui les concernent?",
    helpText:
      "« Significatif » veut dire substantiel, pas seulement conforme à la procédure \u2014 le type de communication qui permet aux gens de comprendre, d'évaluer et de répondre.",
  },
  et_04: {
    prompt:
      "Dans quelle mesure votre organisation gère-t-elle les différends, plaintes ou préoccupations internes au moyen de processus documentés et appliqués de façon cohérente?",
    helpText:
      "Plutôt que de s'en remettre au jugement et à l'autorité informelle de dirigeants précis pour résoudre les tensions internes.",
  },
  et_05: {
    prompt:
      "Avec quelle confiance votre organisation pourrait-elle produire une piste d'audit de gouvernance \u2014 décisions, preuves, approbations et imputabilité \u2014 sous examen externe?",
    helpText:
      "Pensez à ce que vous présenteriez à une commission des relations de travail, un auditeur, une fédération ou un organisme de réglementation examinant votre conduite de gouvernance.",
  },

  // Sovereignty & governance
  sg_01: {
    prompt:
      "Dans quelle mesure votre organisation maintient-elle le contrôle sur ses propres données, dossiers et historique de décisions organisationnels \u2014 indépendamment de tout fournisseur, plateforme ou tiers?",
    helpText:
      "Cela inclut la portabilité de vos dossiers, la possibilité de changer de systèmes sans perdre l'historique organisationnel, et le fait de détenir la copie primaire de votre propre registre de gouvernance.",
  },
  sg_02: {
    prompt:
      "Avec quelle clarté votre organisation distingue-t-elle les décisions de gouvernance qui exigent le consentement des membres, l'approbation du conseil ou l'autorité de la direction?",
    helpText:
      "Une clarté d'autorité signifie que le bon niveau de consentement est demandé et documenté \u2014 pas que les décisions soient remontées au niveau le plus élevé par défaut.",
  },
  sg_03: {
    prompt:
      "Dans quelle mesure votre organisation protège-t-elle les données relatives aux membres contre des usages non explicitement autorisés \u2014 y compris la production de rapports, l'analytique et le partage externe?",
    helpText:
      "Les données collectées à une fin (p. ex. administration des cotisations) sont-elles parfois utilisées à une autre fin (p. ex. suivi de productivité, évaluation de rendement) sans consentement explicite?",
  },
  sg_04: {
    prompt:
      "Avec quel niveau d'engagement votre organisation gouverne-t-elle ses relations avec les fournisseurs de technologies, plateformes et outils numériques \u2014 y compris l'examen des conditions, du traitement des données et des options de sortie?",
    helpText:
      "Une gouvernance active suppose un examen périodique, des préoccupations documentées et la capacité organisationnelle de prendre des décisions éclairées sur les dépendances numériques \u2014 pas une acceptation passive des paramètres par défaut du fournisseur.",
  },
  mt_01: {
    prompt:
      "Dans quelle mesure votre organisation préserve-t-elle le contexte organisationnel et la mémoire opérationnelle lors des transitions entre systèmes, plateformes ou approches technologiques?",
    helpText:
      "Les transitions passées \u2014 changement de système de gestion des dossiers, de plateforme financière, d'outils de communication \u2014 ont-elles entraîné une perte de mémoire organisationnelle, ou le contexte a-t-il été préservé et transféré?",
  },
  mt_02: {
    prompt:
      "Avec quel niveau d'intention votre organisation évalue-t-elle si les efforts de modernisation préservent \u2014 plutôt que remplacent \u2014 la continuité organisationnelle?",
    helpText:
      "Les décisions de modernisation tiennent-elles compte du savoir organisationnel intégré aux pratiques, relations et systèmes actuels, ou privilégient-elles les gains de capacité sans évaluer le risque de continuité?",
  },

  // Continuity confidence signals (likert_5)
  ccs_01: {
    prompt:
      "Le savoir opérationnel est constamment récupérable lorsque des personnes clés sont indisponibles.",
    helpText:
      "Considérez à la fois les absences planifiées et les départs imprévus. La récupérabilité signifie que l'institution peut continuer à fonctionner sans la présence de cette personne.",
  },
  ccs_02: {
    prompt:
      "Les décisions de gouvernance peuvent être retracées depuis les résultats actuels jusqu'au raisonnement documenté.",
  },
  ccs_03: {
    prompt:
      "L'orientation stratégique reste cohérente d'une transition de direction à l'autre.",
  },
  ccs_04: {
    prompt:
      "Les nouveaux membres du personnel peuvent agir avec efficacité dans un délai raisonnable parce que le contexte organisationnel leur est transféré.",
  },
  ccs_05: {
    prompt:
      "Les explications des décisions sont disponibles pour les personnes touchées, sans qu'elles aient à les demander.",
  },
  ccs_06: {
    prompt:
      "Notre organisation peut produire une piste d'audit de gouvernance à la demande, sans efforts héroïques.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Lookups
// ─────────────────────────────────────────────────────────────────────────────

export function localizeSection(
  id: SectionId,
  fallback: SectionStrings,
  locale: SupportedLocale,
): SectionStrings {
  if (locale === 'en-CA') return fallback;
  const fr = SECTION_FR[id];
  return fr ?? fallback;
}

export function localizeMaturityLabel(
  value: string,
  fallback: string,
  locale: SupportedLocale,
): string {
  if (locale === 'en-CA') return fallback;
  return MATURITY_LABEL_FR[value] ?? fallback;
}

export function localizeLikertScaleLabel(
  bound: 'minLabel' | 'maxLabel',
  fallback: string,
  locale: SupportedLocale,
): string {
  if (locale === 'en-CA') return fallback;
  return LIKERT_SCALE_FR[bound] ?? fallback;
}

interface LocalizedQuestionView {
  prompt: string;
  helpText?: string;
  /** Map of option value -> localized label. Empty when the question
   *  has no options or no overrides exist. */
  optionLabel: (value: string, fallback: string) => string;
  /** Map of option value -> localized group. Empty when the question
   *  has no options or no overrides exist. */
  optionGroup: (value: string, fallback: string | undefined) => string | undefined;
}

function pickQuestionEntry(id: string): QuestionStrings | undefined {
  return METADATA_FR[id] ?? SCORED_FR[id];
}

export function localizeQuestion<
  Q extends { id: string; prompt: string; helpText?: string },
>(q: Q, locale: SupportedLocale): LocalizedQuestionView {
  if (locale === 'en-CA') {
    return {
      prompt: q.prompt,
      helpText: q.helpText,
      optionLabel: (_v, fb) => fb,
      optionGroup: (_v, fb) => fb,
    };
  }
  const entry = pickQuestionEntry(q.id);
  return {
    prompt: entry?.prompt ?? q.prompt,
    helpText: entry?.helpText ?? q.helpText,
    optionLabel: (value, fallback) => entry?.options?.[value]?.label ?? fallback,
    optionGroup: (value, fallback) => entry?.options?.[value]?.group ?? fallback,
  };
}

/** Convenience: localize a metadata question's option label (used by the
 *  select dropdown which iterates options externally). */
export function localizeOptionLabel(
  questionId: string,
  optionValue: string,
  fallback: string,
  locale: SupportedLocale,
): string {
  if (locale === 'en-CA') return fallback;
  const entry = pickQuestionEntry(questionId);
  return entry?.options?.[optionValue]?.label ?? fallback;
}

export function localizeOptionGroup(
  questionId: string,
  optionValue: string,
  fallback: string | undefined,
  locale: SupportedLocale,
): string | undefined {
  if (locale === 'en-CA') return fallback;
  const entry = pickQuestionEntry(questionId);
  return entry?.options?.[optionValue]?.group ?? fallback;
}

/** Re-export so consumers don't need to import MetadataQuestion separately. */
export type { MetadataQuestion };
