import type { PilotApplicationInput } from '@/types/marketing';


export const institutionalRolloutPathway = {
  'en-CA': [
    'Assessment',
    'Continuity Review',
    'Governance Mapping',
    'Pilot Alignment',
    'Operational Adoption',
    'Organizational Stabilization',
    'Long-Term Resilience',
  ],
  'fr-CA': [
    'Évaluation',
    'Revue de continuité',
    'Cartographie de la gouvernance',
    'Alignement du pilote',
    'Adoption opérationnelle',
    'Stabilisation organisationnelle',
    'Résilience à long terme',
  ],
} as const;

export const governanceModernizationJourney = {
  'en-CA': [
    {
      stage: 'Stage 1 - Fragmented Operations',
      detail: 'Governance and operations are active but continuity context is distributed across teams and files.',
    },
    {
      stage: 'Stage 2 - Continuity Visibility',
      detail: 'Organizational memory and continuity risk become visible in one reviewable operating view.',
    },
    {
      stage: 'Stage 3 - Governance Alignment',
      detail: 'Governance reasoning, ownership boundaries, and operating pathways become consistently legible.',
    },
    {
      stage: 'Stage 4 - Explainable Coordination',
      detail: 'Teams coordinate with transparent rationale and clear review pathways for modernization decisions.',
    },
    {
      stage: 'Stage 5 - Organizational Resilience',
      detail: 'The institution sustains continuity through transitions without operational or governance destabilization.',
    },
  ],
  'fr-CA': [
    {
      stage: 'Étape 1 - Opérations fragmentées',
      detail: 'La gouvernance et les opérations sont actives mais le contexte de continuité est dispersé entre équipes et fichiers.',
    },
    {
      stage: 'Étape 2 - Visibilité de la continuité',
      detail: 'La mémoire organisationnelle et le risque de continuité deviennent visibles dans une vue opérationnelle vérifiable.',
    },
    {
      stage: 'Étape 3 - Alignement de la gouvernance',
      detail: 'Le raisonnement de gouvernance, les limites de propriété et les parcours opérationnels deviennent lisibles de façon cohérente.',
    },
    {
      stage: 'Étape 4 - Coordination explicable',
      detail: 'Les équipes se coordonnent avec des justifications transparentes et des parcours de revue clairs pour les décisions de modernisation.',
    },
    {
      stage: 'Étape 5 - Résilience organisationnelle',
      detail: 'L’institution maintient la continuité à travers les transitions sans déstabilisation opérationnelle ou de gouvernance.',
    },
  ],
} as const;

export const operationalMaturityPathway = {
  'en-CA': [
    'Reactive',
    'Coordinated',
    'Explainable',
    'Continuity-Aware',
    'Institutionally Resilient',
  ],
  'fr-CA': [
    'Réactif',
    'Coordonné',
    'Explicable',
    'Conscient de la continuité',
    'Résilient institutionnellement',
  ],
} as const;

export const organizationalTransformationPathway = {
  'en-CA': [
    'Operational Fragmentation',
    'Continuity Visibility',
    'Governance Alignment',
    'Organizational Coherence',
    'Organizational Resilience',
  ],
  'fr-CA': [
    'Fragmentation opérationnelle',
    'Visibilité de la continuité',
    'Alignement de la gouvernance',
    'Cohérence organisationnelle',
    'Résilience organisationnelle',
  ],
} as const;

export const evidenceArchitecture = {
  'en-CA': [
    {
      title: 'Rollout pathways',
      purpose: 'Deployment realism',
      note: 'Shows how activation moves from assessment into controlled adoption.',
    },
    {
      title: 'Governance review flows',
      purpose: 'Explainability',
      note: 'Surfaces the checkpoints where oversight remains visible and documented.',
    },
    {
      title: 'Continuity assessments',
      purpose: 'Operational insight',
      note: 'Keeps continuity risk and resilience direction readable to leadership.',
    },
    {
      title: 'Pilot artifacts',
      purpose: 'Organizational safety',
      note: 'Frames simulation packs, boundaries, and stabilization notes as reviewable outputs.',
    },
    {
      title: 'Readiness summaries',
      purpose: 'Executive confidence',
      note: 'Packages deployment direction in plain language for procurement and leadership.',
    },
    {
      title: 'Trust-center evidence',
      purpose: 'Procurement reassurance',
      note: 'Keeps implementation safeguards, controls, and proof materials centrally visible.',
    },
  ],
  'fr-CA': [
    {
      title: 'Parcours de déploiement',
      purpose: 'Réalité du déploiement',
      note: 'Montre comment l’activation passe de l’évaluation à l’adoption contrôlée.',
    },
    {
      title: 'Flux de revue de gouvernance',
      purpose: 'Explicabilité',
      note: 'Fait ressortir les points de contrôle où la supervision reste visible et documentée.',
    },
    {
      title: 'Évaluations de continuité',
      purpose: 'Aperçu opérationnel',
      note: 'Garde le risque de continuité et la direction de la résilience lisibles pour la direction.',
    },
    {
      title: 'Artefacts pilotes',
      purpose: 'Sécurité organisationnelle',
      note: 'Présente les packs de simulation, les limites et les notes de stabilisation comme résultats vérifiables.',
    },
    {
      title: 'Synthèses de préparation',
      purpose: 'Confiance des dirigeants',
      note: 'Présente la direction du déploiement en langage clair pour l’approvisionnement et la direction.',
    },
    {
      title: 'Preuves du centre de confiance',
      purpose: 'Rassurance pour l’approvisionnement',
      note: 'Garde les garanties de mise en œuvre, les contrôles et les preuves centralisées visibles.',
    },
  ],
} as const;

export const deploymentWalkthrough = [
  {
    stage: 'Continuity Assessment',
    safeguards: 'Review scope, risks, and memory gaps before activation.',
    continuity: 'Sets the baseline for rollout pacing.',
    visibility: 'Shows where the organization is most exposed.',
    stakeholders: 'Executive sponsors, operations leads, and governance owners.',
    checkpoint: 'Confirm the assessment summary and evidence baseline.',
  },
  {
    stage: 'Governance Mapping',
    safeguards: 'Map review owners, sign-off paths, and oversight boundaries.',
    continuity: 'Protects governance continuity during modernization.',
    visibility: 'Shows who reviews what and when.',
    stakeholders: 'Governance teams, legal review, and procurement stakeholders.',
    checkpoint: 'Validate the review path before any pilot work begins.',
  },
  {
    stage: 'Pilot Alignment',
    safeguards: 'Keep pilot scope tight and define what is out of scope.',
    continuity: 'Prevents rollout creep from destabilizing the organization.',
    visibility: 'Creates a bounded operational view for the pilot team.',
    stakeholders: 'Pilot sponsors, implementation leads, and frontline operators.',
    checkpoint: 'Approve pilot boundaries and success indicators.',
  },
  {
    stage: 'Controlled Rollout',
    safeguards: 'Release in phases with review windows and stabilization support.',
    continuity: 'Reduces transition shock and keeps operations stable.',
    visibility: 'Tracks adoption through measurable implementation milestones.',
    stakeholders: 'Change leads, support teams, and governance observers.',
    checkpoint: 'Review the rollout log and readiness status after each step.',
  },
  {
    stage: 'Operational Stabilization',
    safeguards: 'Hold steady while teams settle into new routines.',
    continuity: 'Confirms the new operating pattern is reliable.',
    visibility: 'Shows support demand and exception handling.',
    stakeholders: 'Operations, support, and executive oversight.',
    checkpoint: 'Validate support load, adoption consistency, and issue patterns.',
  },
  {
    stage: 'Organizational Resilience',
    safeguards: 'Document lessons, transfer ownership, and preserve continuity evidence.',
    continuity: 'Helps the organization absorb leadership or process changes safely.',
    visibility: 'Leaves a clear record of what changed and why.',
    stakeholders: 'Executive sponsors and governance custodians.',
    checkpoint: 'Approve the resilience summary and archive the proof pack.',
  },
] as const;

export const pilotSimulationArtifacts = [
  {
    title: 'Mid-Sized Labour Organization Pilot',
    continuityProfile: 'Moderate continuity risk with strong leadership support and focused scope.',
    fragmentationIndicators: ['Spreadsheet-based case tracking', 'Distributed document storage', 'Manual follow-up across teams'],
    governanceConcerns: ['No shared review pathway', 'Informal ownership boundaries', 'Slow visibility into exceptions'],
    rolloutScope: ['Case intake and tracking', 'Governance review logging', 'Continuity summary reporting'],
    stabilizationOutcomes: ['Cleaner review cadence', 'Less operational duplication', 'More visible transition checkpoints'],
    organizationalImprovements: ['Better continuity handoff', 'Stronger governance visibility', 'Lower implementation friction'],
  },
  {
    title: 'Multi-Jurisdiction Pilot',
    continuityProfile: 'Higher coordination complexity requiring phased rollout and stabilization windows.',
    fragmentationIndicators: ['Different local workflows', 'Inconsistent governance language', 'Multiple approval paths'],
    governanceConcerns: ['Cross-jurisdiction review alignment', 'Change pacing across teams', 'Consistency of implementation evidence'],
    rolloutScope: ['Single jurisdiction first', 'Governance mapping', 'Shared evidence and rollout logs'],
    stabilizationOutcomes: ['Reduced change shock', 'Clearer coordination across jurisdictions', 'Improved operating clarity'],
    organizationalImprovements: ['More coherent governance review', 'Predictable pilot pacing', 'Improved organizational memory capture'],
  },
] as const;

export const operationalContinuitySimulationArtifacts = [
  {
    title: 'Regional Labour Organization Continuity Review',
    continuityPosture: 'Continuity depends on a small group of experienced coordinators with limited handoff documentation.',
    governanceMaturityObservation: 'Governance review is active but uneven across committees.',
    fragmentationVisibility: 'Intake, review, and follow-up are split across multiple tools.',
    institutionalMemoryIndicator: 'High reliance on person-to-person handoffs during onboarding.',
    rolloutGuidance: 'Begin with governance review harmonization and continuity capture checkpoints.',
    resilienceDirection: 'Stabilize committee review cadence before expanding rollout scope.',
  },
  {
    title: 'Cross-Committee Continuity Stabilization Review',
    continuityPosture: 'Continuity is improving but remains vulnerable during leadership transitions.',
    governanceMaturityObservation: 'Approval paths exist but need clearer rationale records.',
    fragmentationVisibility: 'Coordination gaps appear between policy, operations, and procurement review stages.',
    institutionalMemoryIndicator: 'Organizational context is only partly captured and archived.',
    rolloutGuidance: 'Use phased rollout with explicit onboarding and review checkpoints.',
    resilienceDirection: 'Preserve decision rationale logs to support long-term governance continuity.',
  },
] as const;

export const executiveScenarioModels = [
  {
    title: 'Leadership Transition',
    summary: 'Shows how continuity evidence preserves operating knowledge when a senior leader changes roles or retires.',
  },
  {
    title: 'Fragmented Governance Operations',
    summary: 'Shows how clear review paths and ownership reduce uncertainty across teams.',
  },
  {
    title: 'Onboarding Instability',
    summary: 'Shows how controlled rollout artifacts keep new teams aligned early in adoption.',
  },
  {
    title: 'Organizational Memory Loss',
    summary: 'Shows how evidence packs preserve reasoning, precedents, and context that might be lost.',
  },
  {
    title: 'Multi-Committee Coordination',
    summary: 'Shows how coordinated review checkpoints prevent delayed or duplicated decisions.',
  },
  {
    title: 'Governance Drift',
    summary: 'Shows how ongoing proof logs keep modernization decisions aligned to the original operating intent.',
  },
] as const;

export const deploymentTimelines = [
  {
    title: 'Pilot timeline',
    purpose: 'Operational readiness',
    detail: 'Assessment, scoped activation, and stabilization checkpoints for the first deployment window.',
  },
  {
    title: 'Governance rollout',
    purpose: 'Oversight sequencing',
    detail: 'Review path activation, ownership mapping, and approval rhythm across governance stakeholders.',
  },
  {
    title: 'Continuity adoption',
    purpose: 'Organizational stabilization',
    detail: 'Progressive adoption that protects continuity while teams adjust to new routines.',
  },
  {
    title: 'Organizational alignment',
    purpose: 'Change pacing',
    detail: 'The period where leadership, operations, and governance align around the new model.',
  },
  {
    title: 'Maturity progression',
    purpose: 'Long-term resilience',
    detail: 'Sustained evidence practices that preserve resilience as the organization changes over time.',
  },
] as const;

export const institutionalRolloutSimulationFlow = [
  'Assessment',
  'Governance Review',
  'Pilot Stabilization',
  'Controlled Rollout',
  'Organizational Alignment',
  'Long-Term Continuity',
] as const;

export const governanceOperationalWalkthroughs = {
  'en-CA': [
    { type: 'Leadership transition', focus: 'Continuity preservation', narrative: 'Keeps organizational memory and governance continuity during executive or committee turnover.' },
    { type: 'Governance review', focus: 'Explainability', narrative: 'Shows how decisions stay traceable through clear review checkpoints.' },
    { type: 'Committee coordination', focus: 'Operational coherence', narrative: 'Aligns committee roles and handoffs so decisions stay coordinated.' },
    { type: 'Onboarding stabilization', focus: 'Organizational memory', narrative: 'Keeps continuity context visible while new teams inherit active responsibilities.' },
    { type: 'Fragmentation reduction', focus: 'Alignment', narrative: 'Reduces siloed operations through shared governance language and review cadence.' },
    { type: 'Procurement review', focus: 'Governance trust', narrative: 'Supports due diligence with clear safeguards, boundaries, and evidence.' },
  ],
  'fr-CA': [
    { type: 'Transition de leadership', focus: 'Preservation de la continuite', narrative: 'Maintient la memoire organisationnelle et la continuite de gouvernance pendant un roulement de direction ou de comite.' },
    { type: 'Revue de gouvernance', focus: 'Explicabilite', narrative: 'Montre comment les decisions restent tracables avec des points de controle clairs.' },
    { type: 'Coordination des comites', focus: 'Coherence operationnelle', narrative: 'Aligne les roles et les passations pour garder des decisions coordonnees.' },
    { type: 'Stabilisation de l integration', focus: 'Memoire organisationnelle', narrative: 'Preserve le contexte de continuite pendant que de nouvelles equipes heritent de responsabilites actives.' },
    { type: 'Reduction de la fragmentation', focus: 'Alignement', narrative: 'Reduit les operations en silos avec un langage de gouvernance partage et une cadence de revue.' },
    { type: 'Revue d approvisionnement', focus: 'Confiance de gouvernance', narrative: 'Soutient la diligence raisonnable avec des garde-fous clairs, des limites et des preuves.' },
  ],
} as const;

export const institutionalBeforeAfterMap = [
  'Fragmented Governance',
  'Continuity Visibility',
  'Explainable Coordination',
  'Operational Alignment',
  'Organizational Stability',
  'Organizational Resilience',
] as const;

export const organizationalMaturitySnapshots = [
  {
    dimension: 'Continuity',
    focus: 'Stability',
    snapshot: 'Continuity practices are becoming repeatable across transitions and governance cycles.',
  },
  {
    dimension: 'Governance',
    focus: 'Explainability',
    snapshot: 'Governance decisions include visible rationale, ownership, and review checkpoints.',
  },
  {
    dimension: 'Operations',
    focus: 'Coordination',
    snapshot: 'Cross-team coordination is more predictable with fewer handoff ambiguities.',
  },
  {
    dimension: 'Organizational Memory',
    focus: 'Preservation',
    snapshot: 'Critical organizational context is increasingly captured beyond individual team members.',
  },
  {
    dimension: 'Trust',
    focus: 'Reviewability',
    snapshot: 'Evidence and safeguards are reviewable by leadership, governance, and procurement stakeholders.',
  },
] as const;

export const procurementEvidenceBinder = {
  'en-CA': [
    'Implementation safeguards',
    'Governance oversight structures',
    'Explainability philosophy',
    'Rollout sequencing',
    'Operational boundaries',
    'Continuity protection principles',
    'Pilot governance safeguards',
    'Reviewability commitments',
  ],
  'fr-CA': [
    'Garde-fous de mise en œuvre',
    'Structures de supervision de gouvernance',
    'Philosophie d\'explicabilité',
    'Séquençage du déploiement',
    'Limites opérationnelles',
    'Principes de protection de la continuité',
    'Garde-fous de gouvernance pilote',
    'Engagements de révisabilité',
  ],
} as const;

export const governanceReviewSimulationLayers = {
  'en-CA': [
    'Review checkpoints',
    'Explainability pathways',
    'Approval layers',
    'Governance accountability',
    'Operational validation',
  ],
  'fr-CA': [
    'Points de contrôle de revue',
    'Parcours d\'explicabilité',
    'Niveaux d\'approbation',
    'Responsabilité de gouvernance',
    'Validation opérationnelle',
  ],
} as const;

export const executiveDashboardSignals = [
  {
    title: 'Continuity visibility',
    description: 'Shows where continuity context is concentrated and where transfer routines are active.',
  },
  {
    title: 'Governance coherence',
    description: 'Summarizes review cadence reliability and oversight coverage.',
  },
  {
    title: 'Operational alignment',
    description: 'Tracks cross-team alignment across deployment and stabilization stages.',
  },
  {
    title: 'Organizational resilience',
    description: 'Highlights resilience direction during leadership transitions and operating pressure.',
  },
  {
    title: 'Fragmentation awareness',
    description: 'Shows silos, coordination risk, and onboarding fragility in plain language.',
  },
] as const;

export const executiveBriefingFlows = {
  'en-CA': [
    'Continuity risk summaries',
    'Governance resilience observations',
    'Fragmentation visibility',
    'Organizational coherence mapping',
    'Organizational readiness guidance',
  ],
  'fr-CA': [
    'Synthèses des risques de continuité',
    'Observations de résilience de gouvernance',
    'Visibilité de la fragmentation',
    'Cartographie de cohérence organisationnelle',
    'Orientation de préparation organisationnelle',
  ],
} as const;

export const leadershipTransitionContinuityScenarios = {
  'en-CA': [
    {
      scenario: 'Executive departure',
      focus: 'Organizational memory preservation',
      livedSignal: 'Decision rationale and relationship context are often concentrated in a narrow leadership circle.',
      stabilizationMove: 'Convert active decisions and precedent notes into shared continuity records before role transition.',
    },
    {
      scenario: 'Governance turnover',
      focus: 'Continuity stabilization',
      livedSignal: 'Committee rhythm can slip when incoming members inherit implicit rather than documented review pathways.',
      stabilizationMove: 'Run a short governance handoff cycle with explicit ownership and checkpoint cadence.',
    },
    {
      scenario: 'Committee restructuring',
      focus: 'Coordination continuity',
      livedSignal: 'Coordination friction appears when responsibilities shift faster than cross-committee communication patterns.',
      stabilizationMove: 'Re-map decision boundaries and maintain a shared operating language during transition windows.',
    },
    {
      scenario: 'Role concentration',
      focus: 'Knowledge dependency visibility',
      livedSignal: 'Critical continuity context can depend on a small number of coordinators with limited transfer routines.',
      stabilizationMove: 'Surface concentration points and schedule continuity transfer checkpoints before expansion phases.',
    },
    {
      scenario: 'Interim leadership',
      focus: 'Operational resilience',
      livedSignal: 'Interim structures can keep operations moving but leave governance rationale fragmented if not recorded.',
      stabilizationMove: 'Preserve interim decisions as explainable records and align them to long-term governance pathways.',
    },
  ],
  'fr-CA': [
    {
      scenario: 'Départ de direction',
      focus: 'Préservation de la mémoire organisationnelle',
      livedSignal: 'La logique des décisions et le contexte relationnel sont souvent concentrés dans un cercle restreint de dirigeants.',
      stabilizationMove: 'Convertir les décisions actives et les notes de précédents en archives de continuité partagées avant la transition de rôle.',
    },
    {
      scenario: 'Renouvellement de gouvernance',
      focus: 'Stabilisation de la continuité',
      livedSignal: 'Le rythme des comités peut flancher lorsque les nouveaux membres héritent de parcours de révision implicites plutôt que documentés.',
      stabilizationMove: 'Mettre en place un cycle court de passation de gouvernance avec propriété explicite et cadence de points de contrôle.',
    },
    {
      scenario: 'Restructuration de comité',
      focus: 'Continuité de la coordination',
      livedSignal: 'Des frictions de coordination apparaissent lorsque les responsabilités évoluent plus vite que les modes de communication inter-comités.',
      stabilizationMove: 'Redéfinir les frontières décisionnelles et maintenir un langage opérationnel partagé pendant les fenêtres de transition.',
    },
    {
      scenario: 'Concentration des rôles',
      focus: 'Visibilité de la dépendance aux connaissances',
      livedSignal: 'Le contexte de continuité critique peut dépendre d\'un petit nombre de coordinateurs aux routines de transfert limitées.',
      stabilizationMove: 'Identifier les points de concentration et planifier des points de transfert de continuité avant les phases d\'expansion.',
    },
    {
      scenario: 'Leadership intérimaire',
      focus: 'Résilience opérationnelle',
      livedSignal: 'Les structures intérimaires peuvent maintenir les opérations en mouvement tout en laissant le raisonnement de gouvernance fragmenté s\'il n\'est pas consigné.',
      stabilizationMove: 'Préserver les décisions intérimaires comme dossiers explicables et les aligner sur les parcours de gouvernance à long terme.',
    },
  ],
} as const;

export const governanceFrictionSimulationFlows = {
  'en-CA': [
    { friction: 'Committee misalignment', continuityImpact: 'Decision pacing becomes uneven across governance groups.', managementPath: 'Align review cadence and shared checkpoint definitions.' },
    { friction: 'Fragmented approvals', continuityImpact: 'Implementation slows because sign-off pathways are not synchronized.', managementPath: 'Consolidate approval windows and preserve explicit owner accountability.' },
    { friction: 'Duplicated governance pathways', continuityImpact: 'Teams repeat reviews with inconsistent rationale capture.', managementPath: 'Unify pathways around one review record and one evidence trail.' },
    { friction: 'Operational silo conflicts', continuityImpact: 'Cross-team handoffs lose context and increase stabilization effort.', managementPath: 'Use shared transition logs between operational and governance groups.' },
    { friction: 'Onboarding inconsistency', continuityImpact: 'New leaders inherit uneven continuity expectations.', managementPath: 'Standardize onboarding checkpoints tied to current continuity priorities.' },
    { friction: 'Continuity drift across leadership cycles', continuityImpact: 'Organizational priorities become less coherent over successive transitions.', managementPath: 'Anchor each cycle to prior rationale records and active resilience goals.' },
  ],
  'fr-CA': [
    { friction: 'Désalignement de comité', continuityImpact: 'Le rythme décisionnel devient irrégulier entre les groupes de gouvernance.', managementPath: 'Aligner la cadence de révision et les définitions de points de contrôle partagés.' },
    { friction: 'Approbations fragmentées', continuityImpact: 'La mise en œuvre ralentit car les parcours d\'approbation ne sont pas synchronisés.', managementPath: 'Consolider les fenêtres d\'approbation et préserver la responsabilité explicite des propriétaires.' },
    { friction: 'Parcours de gouvernance dupliqués', continuityImpact: 'Les équipes répètent les révisions avec une capture de raisonnement incohérente.', managementPath: 'Unifier les parcours autour d\'un seul dossier de révision et d\'une piste de preuve.' },
    { friction: 'Conflits de silos opérationnels', continuityImpact: 'Les transferts inter-équipes perdent le contexte et augmentent l\'effort de stabilisation.', managementPath: 'Utiliser des journaux de transition partagés entre les groupes opérationnels et de gouvernance.' },
    { friction: 'Incohérence de l\'intégration', continuityImpact: 'Les nouveaux dirigeants héritent d\'attentes de continuité inégales.', managementPath: 'Standardiser les points de contrôle d\'intégration liés aux priorités de continuité actuelles.' },
    { friction: 'Dérive de continuité entre cycles de leadership', continuityImpact: 'Les priorités organisationnelles deviennent moins cohérentes au fil des transitions successives.', managementPath: 'Ancrer chaque cycle aux archives de raisonnement antérieures et aux objectifs de résilience actifs.' },
  ],
} as const;

export const institutionalContinuityEventWalkthroughs = {
  'en-CA': [
    {
      event: 'Leadership change',
      continuityFocus: 'Organizational memory',
      livedWalkthrough:
        'Teams re-open prior decisions to recover context unless rationale archives are carried forward during transition.',
    },
    {
      event: 'Multi-board transition',
      continuityFocus: 'Governance alignment',
      livedWalkthrough:
        'Alignment pressure rises when multiple boards inherit partially different interpretations of the same policy intent.',
    },
    {
      event: 'Staff turnover',
      continuityFocus: 'Operational stabilization',
      livedWalkthrough:
        'Operational continuity weakens when handoffs occur through informal channels rather than recorded pathways.',
    },
    {
      event: 'Committee expansion',
      continuityFocus: 'Coordination continuity',
      livedWalkthrough:
        'Expansion increases coordination load and requires explicit synchronization checkpoints to remain calm.',
    },
    {
      event: 'Federation growth',
      continuityFocus: 'Organizational coherence',
      livedWalkthrough:
        'Regional variation can dilute coherence unless national and regional pathways share review language.',
    },
    {
      event: 'Policy transition',
      continuityFocus: 'Explainability continuity',
      livedWalkthrough:
        'Policy updates remain trusted when historical rationale stays visible during implementation handoffs.',
    },
  ],
  'fr-CA': [
    {
      event: 'Changement de leadership',
      continuityFocus: 'Memoire organisationnelle',
      livedWalkthrough:
        'Les equipes reouvrent les decisions anterieures pour recuperer le contexte, sauf si les archives de justification sont transmises lors des transitions.',
    },
    {
      event: 'Transition multi-conseil',
      continuityFocus: 'Alignement de gouvernance',
      livedWalkthrough:
        'La pression d alignement augmente quand plusieurs conseils heritent d interpretations partiellement differentes d une meme intention politique.',
    },
    {
      event: 'Rotation du personnel',
      continuityFocus: 'Stabilisation operationnelle',
      livedWalkthrough:
        'La continuite operationnelle s affaiblit quand les passations se font par des canaux informels plutot que par des parcours documentes.',
    },
    {
      event: 'Expansion de comite',
      continuityFocus: 'Continuite de la coordination',
      livedWalkthrough:
        'L expansion accroit la charge de coordination et necessite des points de synchronisation explicites pour rester stable.',
    },
    {
      event: 'Croissance federale',
      continuityFocus: 'Coherence organisationnelle',
      livedWalkthrough:
        'La variation regionale peut diluer la coherence si les parcours nationaux et regionaux ne partagent pas un langage de revision commun.',
    },
    {
      event: 'Transition de politique',
      continuityFocus: 'Continuite de l explicabilite',
      livedWalkthrough:
        'Les mises a jour de politique restent fiables quand le raisonnement historique reste visible lors des passations de mise en oeuvre.',
    },
  ],
} as const;

export const operationalDisruptionModels = {
  'en-CA': [
    { area: 'Knowledge concentration', focus: 'Dependency risk', signal: 'Critical continuity context is held by a limited set of organizational actors.', mitigation: 'Create transfer routines tied to active governance checkpoints.' },
    { area: 'Approval fragmentation', focus: 'Governance slowdown', signal: 'Parallel approval paths create pacing uncertainty and delayed execution.', mitigation: 'Converge review layers into explicit sequence maps.' },
    { area: 'Onboarding inconsistency', focus: 'Organizational drift', signal: 'Incoming leaders receive uneven continuity guidance across committees.', mitigation: 'Use one continuity briefing template and phased onboarding checkpoints.' },
    { area: 'Informal workflows', focus: 'Visibility loss', signal: 'Key decisions progress through channels that do not preserve rationale.', mitigation: 'Promote lightweight decision logs attached to formal review moments.' },
    { area: 'Committee silos', focus: 'Coordination breakdown', signal: 'Cross-functional dependencies are recognized late in the decision cycle.', mitigation: 'Introduce shared dependency visibility before approval milestones.' },
  ],
  'fr-CA': [
    { area: 'Concentration des connaissances', focus: 'Risque de dépendance', signal: 'Le contexte de continuité critique est détenu par un nombre limité d\'acteurs organisationnels.', mitigation: 'Créer des routines de transfert liées aux points de contrôle de gouvernance actifs.' },
    { area: 'Fragmentation des approbations', focus: 'Ralentissement de la gouvernance', signal: 'Des parcours d\'approbation parallèles créent une incertitude de rythme et retardent l\'exécution.', mitigation: 'Fusionner les niveaux de révision en cartes de séquences explicites.' },
    { area: 'Incohérence de l\'intégration', focus: 'Dérive organisationnelle', signal: 'Les nouveaux dirigeants reçoivent des orientations de continuité inégales entre les comités.', mitigation: 'Utiliser un modèle de breffage de continuité unique et des points de contrôle d\'intégration par phases.' },
    { area: 'Flux de travail informels', focus: 'Perte de visibilité', signal: 'Les décisions clés progressent via des canaux qui ne préservent pas le raisonnement.', mitigation: 'Promouvoir des journaux décisionnels légers liés aux moments de révision formels.' },
    { area: 'Silos de comités', focus: 'Rupture de coordination', signal: 'Les dépendances inter-fonctionnelles sont identifiées tardivement dans le cycle décisionnel.', mitigation: 'Introduire une visibilité partagée des dépendances avant les jalons d\'approbation.' },
  ],
} as const;

export const organizationalStabilizationSimulationFlow = {
  'en-CA': ['Fragmentation', 'Visibility', 'Alignment', 'Coordination', 'Continuity Stabilization', 'Organizational Resilience'],
  'fr-CA': ['Fragmentation', 'Visibilité', 'Alignement', 'Coordination', 'Stabilisation de continuité', 'Résilience organisationnelle'],
} as const;

export const onboardingContinuityIntelligenceScenarios = {
  'en-CA': [
    {
      scenario: 'New executive onboarding',
      focus: 'Organizational memory',
      continuityGuide:
        'Prioritize active decision context, ongoing commitments, and rationale carry-forward in first-cycle briefings.',
    },
    {
      scenario: 'Committee onboarding',
      focus: 'Governance continuity',
      continuityGuide:
        'Orient incoming committee members to current review cadence and unresolved governance dependencies.',
    },
    {
      scenario: 'Regional leadership onboarding',
      focus: 'Federation alignment',
      continuityGuide:
        'Translate national continuity priorities into region-level implementation checkpoints.',
    },
    {
      scenario: 'Policy onboarding',
      focus: 'Explainability continuity',
      continuityGuide:
        'Connect new policy stewards to prior rationale records and change constraints.',
    },
    {
      scenario: 'Operational onboarding',
      focus: 'Coordination stability',
      continuityGuide:
        'Pair new operators with cross-team dependency maps for early-cycle stability.',
    },
  ],
  'fr-CA': [
    {
      scenario: 'Integration d un nouveau dirigeant',
      focus: 'Memoire organisationnelle',
      continuityGuide:
        'Prioriser le contexte des decisions actives, les engagements en cours et la transmission du raisonnement dans les breffages du premier cycle.',
    },
    {
      scenario: 'Integration de comite',
      focus: 'Continuite de la gouvernance',
      continuityGuide:
        'Orienter les nouveaux membres du comite vers la cadence de revision actuelle et les dependances de gouvernance non resolues.',
    },
    {
      scenario: 'Integration de leadership regional',
      focus: 'Alignement federal',
      continuityGuide:
        'Traduire les priorites de continuite nationales en points de controle de mise en oeuvre au niveau regional.',
    },
    {
      scenario: 'Integration de politique',
      focus: 'Continuite de l explicabilite',
      continuityGuide:
        'Connecter les nouveaux gestionnaires de politique aux archives de raisonnement anterieures et aux contraintes de changement.',
    },
    {
      scenario: 'Integration operationnelle',
      focus: 'Stabilite de la coordination',
      continuityGuide:
        'Jumeler les nouveaux operateurs avec des cartes de dependances inter-equipes pour la stabilite du premier cycle.',
    },
  ],
} as const;

export const federationScaleContinuityScenarios = {
  'en-CA': [
    {
      area: 'National and regional alignment',
      focus: 'Governance coherence',
      realism:
        'Alignment requires preserving local operating realities while maintaining shared review principles.',
    },
    {
      area: 'Multi-committee coordination',
      focus: 'Operational visibility',
      realism:
        'Coordination confidence improves when committee dependencies are visible before decision windows.',
    },
    {
      area: 'Shared continuity frameworks',
      focus: 'Organizational stability',
      realism:
        'Frameworks reduce transition risk when they are practical enough for local adoption.',
    },
    {
      area: 'Distributed governance',
      focus: 'Explainability',
      realism:
        'Distributed structures remain trustworthy when rationale records travel across governance layers.',
    },
    {
      area: 'Organizational scaling',
      focus: 'Continuity preservation',
      realism:
        'Scaling remains calm when expansion stages keep continuity safeguards visible and reviewable.',
    },
  ],
  'fr-CA': [
    {
      area: 'Alignement national et regional',
      focus: 'Coherence de gouvernance',
      realism:
        'L alignement necessite de preserver les realites operationnelles locales tout en maintenant des principes de revision partages.',
    },
    {
      area: 'Coordination multi-comites',
      focus: 'Visibilite operationnelle',
      realism:
        'La confiance dans la coordination s ameliore quand les dependances des comites sont visibles avant les fenetres de decision.',
    },
    {
      area: 'Cadres de continuite partages',
      focus: 'Stabilite organisationnelle',
      realism:
        'Les cadres reduisent le risque de transition quand ils sont suffisamment pratiques pour etre adoptes localement.',
    },
    {
      area: 'Gouvernance distribuee',
      focus: 'Explicabilite',
      realism:
        'Les structures distribuees restent fiables quand les archives de raisonnement circulent entre les niveaux de gouvernance.',
    },
    {
      area: 'Croissance organisationnelle',
      focus: 'Preservation de la continuite',
      realism:
        'La croissance reste calme quand les etapes d expansion maintiennent les garde-fous de continuite visibles et revisables.',
    },
  ],
} as const;

export const committeeCoordinationSimulations = {
  'en-CA': [
    { simulation: 'Overlapping governance responsibilities', coordinationSignal: 'Ownership ambiguity appears at handoff boundaries.', stabilizationApproach: 'Clarify owner of record per decision stage.' },
    { simulation: 'Fragmented decision pathways', coordinationSignal: 'Pathways diverge by committee and slow synchronization.', stabilizationApproach: 'Introduce one shared pathway map for active initiatives.' },
    { simulation: 'Organizational memory fragmentation', coordinationSignal: 'Historic rationale is unevenly distributed among committees.', stabilizationApproach: 'Consolidate precedent references inside review briefings.' },
    { simulation: 'Cross-functional continuity drift', coordinationSignal: 'Operational and governance language diverge over time.', stabilizationApproach: 'Run periodic cross-functional alignment checkpoints.' },
    { simulation: 'Approval synchronization', coordinationSignal: 'Approvals arrive in inconsistent sequence under pressure.', stabilizationApproach: 'Sequence dependencies before opening final approval windows.' },
  ],
  'fr-CA': [
    { simulation: 'Responsabilités de gouvernance qui se chevauchent', coordinationSignal: 'L\'ambiguïté de propriété apparaît aux frontières de passation.', stabilizationApproach: 'Clarifier le responsable de dossier pour chaque étape décisionnelle.' },
    { simulation: 'Parcours décisionnels fragmentés', coordinationSignal: 'Les parcours divergent par comité et ralentissent la synchronisation.', stabilizationApproach: 'Introduire une carte de parcours partagée unique pour les initiatives actives.' },
    { simulation: 'Fragmentation de la mémoire organisationnelle', coordinationSignal: 'Le raisonnement historique est inégalement réparti entre les comités.', stabilizationApproach: 'Consolider les références de précédents dans les breffages de révision.' },
    { simulation: 'Dérive de continuité inter-fonctionnelle', coordinationSignal: 'Le langage opérationnel et de gouvernance diverge avec le temps.', stabilizationApproach: 'Organiser des points de contrôle d\'alignement inter-fonctionnel périodiques.' },
    { simulation: 'Synchronisation des approbations', coordinationSignal: 'Les approbations arrivent dans une séquence incohérente sous pression.', stabilizationApproach: 'Séquencer les dépendances avant l\'ouverture des fenêtres d\'approbation finale.' },
  ],
} as const;

export const institutionalMemoryDisruptionModels = {
  'en-CA': [
    {
      area: 'Knowledge concentration',
      focus: 'Continuity dependency',
      awareness:
        'Continuity risk rises when critical operational history is held by a small set of individuals.',
    },
    {
      area: 'Informal processes',
      focus: 'Visibility loss',
      awareness:
        'Informal workflows reduce explainability during leadership and committee transitions.',
    },
    {
      area: 'Transition gaps',
      focus: 'Operational fragility',
      awareness:
        'Unstructured handoffs create temporary stability gaps in active operations.',
    },
    {
      area: 'Committee memory loss',
      focus: 'Governance drift',
      awareness:
        'Committees can drift from prior organizational commitments when rationale lineage is thin.',
    },
    {
      area: 'Historical continuity erosion',
      focus: 'Organizational instability',
      awareness:
        'Loss of historical context weakens confidence in modernization sequencing over time.',
    },
  ],
  'fr-CA': [
    {
      area: 'Concentration des connaissances',
      focus: 'Dependance de continuite',
      awareness:
        'Le risque de continuite augmente quand l historique operationnel critique est detenu par un petit groupe d individus.',
    },
    {
      area: 'Processus informels',
      focus: 'Perte de visibilite',
      awareness:
        'Les flux de travail informels reduisent l explicabilite lors des transitions de leadership et de comites.',
    },
    {
      area: 'Lacunes de transition',
      focus: 'Fragilite operationnelle',
      awareness:
        'Les passations non structurees creent des ecarts de stabilite temporaires dans les operations actives.',
    },
    {
      area: 'Perte de memoire de comite',
      focus: 'Derive de gouvernance',
      awareness:
        'Les comites peuvent deriver des engagements organisationnels passes quand la lignee du raisonnement est mince.',
    },
    {
      area: 'Erosion de la continuite historique',
      focus: 'Instabilite organisationnelle',
      awareness:
        'La perte du contexte historique affaiblit la confiance dans le sequencement de modernisation au fil du temps.',
    },
  ],
} as const;

export const executiveDecisionPathwaySystems = {
  'en-CA': [
    {
      decision: 'Pilot adoption',
      continuityFocus: 'Governance safety',
      pathway:
        'Confirm scope boundaries, review accountability, and stabilization commitments before activation.',
    },
    {
      decision: 'Rollout pacing',
      continuityFocus: 'Organizational stability',
      pathway:
        'Expand only after each phase demonstrates continuity clarity and governance reliability.',
    },
    {
      decision: 'Governance review',
      continuityFocus: 'Explainability',
      pathway:
        'Validate rationale lineage and oversight traceability before major implementation decisions.',
    },
    {
      decision: 'Transition support',
      continuityFocus: 'Organizational continuity',
      pathway:
        'Prioritize transfer routines where leadership turnover intersects active modernization work.',
    },
    {
      decision: 'Committee alignment',
      continuityFocus: 'Operational coherence',
      pathway:
        'Synchronize committee dependencies and shared timing before final approvals.',
    },
  ],
  'fr-CA': [
    {
      decision: 'Adoption du pilote',
      continuityFocus: 'Securite de gouvernance',
      pathway:
        'Confirmer les limites de portee, la responsabilite de revision et les engagements de stabilisation avant l activation.',
    },
    {
      decision: 'Rythme de deploiement',
      continuityFocus: 'Stabilite organisationnelle',
      pathway:
        'Etendre seulement apres que chaque phase demontre une clarte de continuite et une fiabilite de gouvernance.',
    },
    {
      decision: 'Revue de gouvernance',
      continuityFocus: 'Explicabilite',
      pathway:
        'Valider la lignee du raisonnement et la tracabilite de la supervision avant les decisions majeures de mise en oeuvre.',
    },
    {
      decision: 'Soutien a la transition',
      continuityFocus: 'Continuite organisationnelle',
      pathway:
        'Prioriser les routines de transfert la ou le roulement de leadership croise le travail de modernisation actif.',
    },
    {
      decision: 'Alignement des comites',
      continuityFocus: 'Coherence operationnelle',
      pathway:
        'Synchroniser les dependances des comites et le calendrier partage avant les approbations finales.',
    },
  ],
} as const;

export const multiStakeholderGovernanceNarratives = {
  'en-CA': [
    {
      stakeholders: 'Executive leadership, governance chairs, operations leads',
      narrative:
        'Continuity confidence improves when strategy, oversight, and implementation use one explainable operating storyline.',
    },
    {
      stakeholders: 'Procurement reviewers, legal teams, governance observers',
      narrative:
        'Review readiness strengthens when safeguards and rationale are visible in operational context.',
    },
    {
      stakeholders: 'Regional leaders, committee coordinators, transition stewards',
      narrative:
        'Distributed modernization remains stable when local realities are integrated into shared continuity frameworks.',
    },
  ],
  'fr-CA': [
    {
      stakeholders: 'Direction executive, presidents de gouvernance, responsables operationnels',
      narrative:
        'La confiance dans la continuite s ameliore quand strategie, supervision et mise en oeuvre utilisent un recit operationnel explicable commun.',
    },
    {
      stakeholders: 'Examinateurs d approvisionnement, equipes juridiques, observateurs de gouvernance',
      narrative:
        'La preparation a la revision se renforce quand les garde-fous et le raisonnement sont visibles en contexte operationnel.',
    },
    {
      stakeholders: 'Leaders regionaux, coordinateurs de comites, gestionnaires de transition',
      narrative:
        'La modernisation distribuee reste stable quand les realites locales sont integrees dans des cadres de continuite partages.',
    },
  ],
} as const;

export const longitudinalContinuityEvolutionStories = {
  'en-CA': [
    {
      stage: 'Cycle 1 - Visibility',
      storyline:
        'Organization identifies concentration points and begins continuity-focused evidence capture.',
    },
    {
      stage: 'Cycle 2 - Alignment',
      storyline:
        'Governance pathways and operational handoffs are synchronized with explainable checkpoints.',
    },
    {
      stage: 'Cycle 3 - Stabilization',
      storyline:
        'Onboarding routines and transition safeguards become repeatable under normal operating pressure.',
    },
    {
      stage: 'Cycle 4 - Resilience',
      storyline:
        'Institution handles leadership changes with continuity confidence and preserved rationale lineage.',
    },
  ],
  'fr-CA': [
    {
      stage: 'Cycle 1 - Visibilite',
      storyline:
        'L organisation identifie les points de concentration et commence la capture de preuves axee sur la continuite.',
    },
    {
      stage: 'Cycle 2 - Alignement',
      storyline:
        'Les parcours de gouvernance et les passations operationnelles sont synchronises avec des points de controle explicables.',
    },
    {
      stage: 'Cycle 3 - Stabilisation',
      storyline:
        'Les routines d integration et les garde-fous de transition deviennent repetables sous pression operationnelle normale.',
    },
    {
      stage: 'Cycle 4 - Resilience',
      storyline:
        'L institution gere les changements de leadership avec confiance dans la continuite et une lignee de raisonnement preservee.',
    },
  ],
} as const;

export const clcBoothNarrativeSystem = [
  'Organizational Fragmentation',
  'Hidden Continuity Risk',
  'Governance Visibility',
  'Explainable Alignment',
  'Operational Trust',
  'Organizational Resilience',
] as const;

export const executiveEngagementChoreography = [
  {
    stakeholder: 'Executives',
    emotionalEntry: 'Continuity resilience',
    openingMove:
      'Frame the conversation around leadership transition safety and organizational memory continuity.',
    engagementOutcome: 'Strategic interest in modernization as resilience infrastructure.',
  },
  {
    stakeholder: 'Governance leaders',
    emotionalEntry: 'Explainability',
    openingMove:
      'Lead with reviewability, rationale lineage, and governance-safe modernization checkpoints.',
    engagementOutcome: 'Confidence that modernization reinforces, not replaces, oversight.',
  },
  {
    stakeholder: 'Operations',
    emotionalEntry: 'Fragmentation reduction',
    openingMove:
      'Show how coordination friction, onboarding inconsistency, and silo drift become visible and manageable.',
    engagementOutcome: 'Operational curiosity around stabilization and continuity workflows.',
  },
  {
    stakeholder: 'Procurement',
    emotionalEntry: 'Trust and deployment safety',
    openingMove:
      'Use proof surfaces, phased pacing, and governance controls to reduce perceived deployment risk.',
    engagementOutcome: 'Structured procurement review readiness.',
  },
  {
    stakeholder: 'Policy leaders',
    emotionalEntry: 'Organizational coherence',
    openingMove:
      'Connect policy continuity to explainable implementation pathways across leadership cycles.',
    engagementOutcome: 'Interest in continuity-aware policy modernization sequencing.',
  },
] as const;

export const qrJourneyArchitecture = [
  {
    journey: 'Executive continuity',
    destination: '/proof?context=executive',
    purpose: 'Strategic resilience and transition confidence.',
  },
  {
    journey: 'Governance trust',
    destination: '/trust?context=governance',
    purpose: 'Explainability, oversight, and governance reassurance.',
  },
  {
    journey: 'Procurement review',
    destination: '/proof?context=procurement',
    purpose: 'Proof-driven deployment safety and review discipline.',
  },
  {
    journey: 'Pilot exploration',
    destination: '/pilot-request?context=conference',
    purpose: 'Low-pressure organizational exploration pathway.',
  },
  {
    journey: 'Thought leadership',
    destination: '/insights?context=conference',
    purpose: 'Doctrine depth and continuity-first thought leadership.',
  },
] as const;

export const stakeholderTalkTrackSystem = [
  {
    stakeholder: 'Executive',
    focusAreas: [
      'Leadership continuity',
      'Organizational resilience',
      'Organizational memory',
      'Governance modernization',
    ],
  },
  {
    stakeholder: 'Governance',
    focusAreas: [
      'Explainability',
      'Oversight',
      'Accountability',
      'Modernization safety',
    ],
  },
  {
    stakeholder: 'Operations',
    focusAreas: [
      'Fragmentation reduction',
      'Onboarding continuity',
      'Coordination stabilization',
      'Operational coherence',
    ],
  },
  {
    stakeholder: 'Procurement',
    focusAreas: [
      'Deployment safety',
      'Governance reviewability',
      'Implementation realism',
      'Operational maturity',
    ],
  },
] as const;

export const objectionHandlingFramework = [
  {
    concern: 'Is this AI surveillance?',
    handling: 'Labor-safe explainability',
    response:
      'UnionEyes does not score or monitor workers. Intelligence remains organizational, explainable, and human-governed.',
  },
  {
    concern: 'Will this replace governance?',
    handling: 'Governance reinforcement',
    response:
      'The system strengthens governance by making rationale, checkpoints, and accountability easier to review.',
  },
  {
    concern: 'How disruptive is deployment?',
    handling: 'Phased stabilization',
    response:
      'Deployment is phased with explicit stabilization windows, bounded scope, and review gates.',
  },
  {
    concern: 'How mature is this?',
    handling: 'Operational proof systems',
    response:
      'Maturity is shown through proof packs, simulations, and review paths.',
  },
  {
    concern: 'How is continuity measured?',
    handling: 'Directional continuity intelligence',
    response:
      'Continuity is measured through resilience, coherence, onboarding stability, and memory transfer signals.',
  },
  {
    concern: 'How does this scale?',
    handling: 'Federation continuity architecture',
    response:
      'Scaling uses shared frameworks, regional alignment, and federation-aware review paths.',
  },
] as const;

export const pilotConversationPathway = [
  'Continuity Concern',
  'Governance Conversation',
  'Operational Realization',
  'Pilot Curiosity',
  'Executive Follow-Up',
  'Structured Exploration',
] as const;

export const executiveBriefingPacks = [
  'Continuity modernization overview',
  'Modernization principles',
  'Pilot pathway summary',
  'Operational legitimacy highlights',
  'Scenario examples',
  'Deployment philosophy',
  'Trust-center orientation',
] as const;

export const procurementFollowUpInfrastructure = [
  'Summary pages',
  'Deployment reassurance sequences',
  'Proof follow-ups',
  'Review paths',
  'Continuity assessment orientation',
  'Trust-center progression',
] as const;

export const leadClassificationSystem = [
  {
    segment: 'Executive continuity interest',
    meaning: 'Strategic leadership',
  },
  {
    segment: 'Governance modernization',
    meaning: 'Oversight interest',
  },
  {
    segment: 'Procurement review',
    meaning: 'Deployment evaluation',
  },
  {
    segment: 'Pilot exploration',
    meaning: 'Operational curiosity',
  },
  {
    segment: 'Thought leadership engagement',
    meaning: 'Long-term nurture',
  },
] as const;

export const postConferenceContinuityCampaigns = [
  'Governance modernization',
  'Organizational continuity',
  'Organizational resilience',
  'Continuity intelligence',
  'Explainable modernization',
  'Leadership transition stability',
] as const;

export const organizationalTransformationExamples = [
  'Fragmented',
  'Visibility',
  'Alignment',
  'Continuity',
  'Operational Trust',
  'Organizational Resilience',
] as const;

export const pilotFramework = {
  scopeDefinition: [
    'What is evaluated: continuity workflows, governance coordination, onboarding resilience, and clear reasoning.',
    'What is not evaluated: worker behavior, workforce productivity, or individual performance analytics.',
    'Governance boundaries: human oversight stays mandatory and review paths stay active during the pilot.',
    'Operational expectations: phased adoption with checkpoints and stabilization windows.',
  ],
  safetyLayer: [
    'Explainability for all operational recommendations.',
    'Reviewability through governance checkpoints and records.',
    'Human oversight retained for organizational decisions.',
    'Operational transparency for implementation boundaries and handoffs.',
  ],
  successIndicators: [
    'Continuity stabilization',
    'Governance coherence',
    'Fragmentation reduction',
    'Onboarding resilience',
    'Organizational visibility',
  ],
} as const;

export const governanceMaturityDimensions = [
  {
    key: 'continuity',
    label: 'Continuity',
    focus: 'Organizational resilience',
  },
  {
    key: 'governance',
    label: 'Governance',
    focus: 'Explainability and oversight',
  },
  {
    key: 'operations',
    label: 'Operations',
    focus: 'Coordination and coherence',
  },
  {
    key: 'memory',
    label: 'Organizational Memory',
    focus: 'Preservation and transfer',
  },
  {
    key: 'trust',
    label: 'Trust',
    focus: 'Reviewability and transparency',
  },
] as const;

export type ContinuityReadinessDimension = {
  label: string;
  score: number;
  summary: string;
};

export type ContinuityReadinessProfile = {
  level: 'Foundational' | 'Developing' | 'Stabilizing' | 'Operationally Mature';
  summary: string;
  dimensions: ContinuityReadinessDimension[];
};

export type ExecutiveReadinessOutputs = {
  continuityProfile: string;
  continuityOverview: {
    continuityPosture: string;
    governanceCoherence: string;
    operationalStability: string;
    institutionalMemoryHealth: string;
  };
  continuityRiskNarratives: string[];
  governanceAlignmentSummary: string;
  fragmentationObservations: string[];
  institutionalResilienceDirection: string;
  rolloutRecommendation: string;
};

function scoreBand(score: number): 'Foundational' | 'Developing' | 'Stabilizing' | 'Operationally Mature' {
  if (score <= 2) return 'Foundational';
  if (score <= 3) return 'Developing';
  if (score <= 4) return 'Stabilizing';
  return 'Operationally Mature';
}

export function buildContinuityReadinessProfile(
  application: Partial<PilotApplicationInput>,
): ContinuityReadinessProfile {
  const challengeCount = application.challenges?.length ?? 0;
  const jurisdictions = application.jurisdictions?.length ?? 0;
  const goals = application.goals?.length ?? 0;
  const modules = ((application.responses as Record<string, unknown> | undefined)?.modules as string[] | undefined) ?? [];
  const leadership = (application.responses as Record<string, unknown> | undefined)?.leadershipSupport;

  const continuityFragilityScore = Math.max(1, 5 - Math.min(4, Math.floor(challengeCount / 2)));
  const governanceCoherenceScore = leadership === 'yes' ? 4 : leadership === 'unsure' ? 3 : 2;
  const onboardingResilienceScore = goals >= 3 ? 4 : goals >= 1 ? 3 : 2;
  const fragmentationScore = jurisdictions <= 1 ? 4 : jurisdictions <= 2 ? 3 : 2;
  const memoryRiskScore = modules.length >= 3 ? 4 : modules.length >= 1 ? 3 : 2;

  const dimensions: ContinuityReadinessDimension[] = [
    {
      label: 'Continuity Fragility',
      score: continuityFragilityScore,
      summary:
        continuityFragilityScore >= 4
          ? 'Current context supports a stable continuity pilot start.'
          : 'Pilot should include explicit continuity safeguards in early phases.',
    },
    {
      label: 'Governance Coherence',
      score: governanceCoherenceScore,
      summary:
        governanceCoherenceScore >= 4
          ? 'Leadership sponsorship supports governed pilot decision cadence.'
          : 'Governance alignment should be reinforced before expansion phases.',
    },
    {
      label: 'Onboarding Resilience',
      score: onboardingResilienceScore,
      summary:
        onboardingResilienceScore >= 4
          ? 'Pilot goals are clear enough to support reliable onboarding protocols.'
          : 'Refine onboarding expectations and success boundaries for pilot teams.',
    },
    {
      label: 'Operational Fragmentation',
      score: fragmentationScore,
      summary:
        fragmentationScore >= 4
          ? 'Operational surface is focused, supporting controlled rollout pacing.'
          : 'Use phased activation to avoid cross-jurisdiction coordination strain.',
    },
    {
      label: 'Organizational Memory Risk',
      score: memoryRiskScore,
      summary:
        memoryRiskScore >= 4
          ? 'Initial scope supports practical memory capture and transfer routines.'
          : 'Add explicit memory capture checkpoints to pilot operating plans.',
    },
  ];

  const average = dimensions.reduce((acc, d) => acc + d.score, 0) / dimensions.length;
  const level = scoreBand(Math.round(average));

  const summaryByLevel: Record<ContinuityReadinessProfile['level'], string> = {
    Foundational:
      'Foundational readiness: begin with assessment and continuity review before broad pilot activation.',
    Developing:
      'Developing readiness: proceed with a constrained pilot scope and governance-mapped checkpoints.',
    Stabilizing:
      'Stabilizing readiness: organization is positioned for controlled pilot alignment and operational adoption.',
    'Operationally Mature':
      'Operationally mature readiness: organization can proceed with phased adoption and stabilization planning.',
  };

  return {
    level,
    summary: summaryByLevel[level],
    dimensions,
  };
}

export function buildExecutiveReadinessOutputs(
  profile: ContinuityReadinessProfile,
  application: Partial<PilotApplicationInput>,
): ExecutiveReadinessOutputs {
  const continuityPosture =
    profile.level === 'Operationally Mature'
      ? 'Continuity posture appears durable across planned transitions.'
      : profile.level === 'Stabilizing'
        ? 'Continuity posture is stabilizing with clear safeguards in place.'
        : 'Continuity posture is emerging and should remain scoped during early rollout.';

  const governanceCoherence =
    profile.dimensions.find((dimension) => dimension.label === 'Governance Coherence')?.summary ??
    'Governance coherence is being established through explicit review pathways.';

  const operationalStability =
    profile.dimensions.find((dimension) => dimension.label === 'Operational Fragmentation')?.summary ??
    'Operational stability should be reviewed through phased activation checkpoints.';

  const institutionalMemoryHealth =
    profile.dimensions.find((dimension) => dimension.label === 'Organizational Memory Risk')?.summary ??
    'Organizational memory health should be reinforced through documented transfer routines.';

  const continuityRiskNarratives = [
    'Operational continuity appears influenced by concentrated organizational knowledge across a limited set of coordination pathways.',
    'Governance resilience is strongest when review pathways remain explicit during pilot and rollout transitions.',
    'Onboarding stability improves when continuity expectations are documented before expansion phases begin.',
  ];

  const fragmentationObservations = [
    application.currentSystem ? `Current system noted: ${application.currentSystem}` : 'Current operating system is not fully specified.',
    `Scope spans ${application.jurisdictions?.length ?? 0} jurisdiction(s) and ${application.sectors?.length ?? 0} sector(s).`,
    profile.dimensions.find((dimension) => dimension.label === 'Operational Fragmentation')?.summary ?? 'Fragmentation indicators are being reviewed.',
  ];

  const governanceAlignmentSummary =
    profile.level === 'Operationally Mature'
      ? 'Leadership support and operating patterns show strong governance alignment.'
      : profile.level === 'Stabilizing'
        ? 'Governance alignment is present, but review checkpoints must stay explicit during rollout.'
        : 'Governance alignment should be strengthened before broader deployment.';

  const institutionalResilienceDirection =
    profile.level === 'Operationally Mature'
      ? 'Proceed with phased adoption and keep evidence packs in the operating record.'
      : 'Use a constrained pilot to build continuity discipline and capture proof.';

  const rolloutRecommendation =
    profile.level === 'Foundational'
      ? 'Start with continuity assessment and governance mapping before broader activation.'
      : profile.level === 'Developing'
        ? 'Run a bounded pilot with clear stabilization checkpoints.'
        : profile.level === 'Stabilizing'
          ? 'Proceed with rollout and keep review windows open.'
          : 'Move to organizational stabilization and keep the proof trail for future transitions.';

  return {
    continuityProfile: profile.summary,
    continuityOverview: {
      continuityPosture,
      governanceCoherence,
      operationalStability,
      institutionalMemoryHealth,
    },
    continuityRiskNarratives,
    governanceAlignmentSummary,
    fragmentationObservations,
    institutionalResilienceDirection,
    rolloutRecommendation,
  };
}
