/**
 * Organizational Positioning Manifest (UnionEyes marketing surface)
 *
 * Narrative pillars: governance, continuity (organizational memory, succession, stewardship),
 * coordination (operational workflow, intake, case management, representation),
 * trust (audit, transparency, evidence, oversight, explainability).
 *
 * Posture: continuity layer and overlay infrastructure — non-displacing and additive,
 * not replacing. Operates alongside existing systems and respects existing tools.
 *
 * AI policy: assistive intelligence with human oversight, explainability, reviewability,
 * and procedural transparency. Governance-safe AI by default — every action remains operator-initiated and operator-reviewable.
 *
 * Canadian positioning: Canadian-hosted, bilingual-first, sovereignty-conscious
 * organizational trust for democratic infrastructure.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, FileText, ShieldCheck, ClipboardList, Clock3, GitBranch, Layers3 } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { parseInstitutionalMode, withInstitutionalContext } from '@/lib/institutional-context';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import {
  committeeCoordinationSimulations,
  deploymentTimelines,
  deploymentWalkthrough,
  evidenceArchitecture,
  executiveDecisionPathwaySystems,
  executiveDashboardSignals,
  executiveBriefingFlows,
  executiveScenarioModels,
  federationScaleContinuityScenarios,
  governanceFrictionSimulationFlows,
  governanceOperationalWalkthroughs,
  governanceReviewSimulationLayers,
  institutionalContinuityEventWalkthroughs,
  institutionalBeforeAfterMap,
  institutionalMemoryDisruptionModels,
  institutionalRolloutSimulationFlow,
  leadershipTransitionContinuityScenarios,
  longitudinalContinuityEvolutionStories,
  multiStakeholderGovernanceNarratives,
  onboardingContinuityIntelligenceScenarios,
  operationalDisruptionModels,
  operationalContinuitySimulationArtifacts,
  organizationalStabilizationSimulationFlow,
  organizationalMaturitySnapshots,
  pilotSimulationArtifacts,
  procurementEvidenceBinder,
} from '@/lib/institutional-legitimacy';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

const PROOF_COPY = {
  'en-CA': {
    title: 'Proof | UnionEyes',
    description:
      'Clear proof for rollout: walkthroughs, pilot simulations, executive scenarios, and governance evidence.',
    badge: 'Proof',
    heroHeading: 'Proof you can review before rollout.',
    heroDescription:
      'UnionEyes shows clear evidence, walkthroughs, and simulations so teams can review modernization as a real governance change.',
    pilotCta: 'Request a Pilot',
    trustCta: 'Review Trust Center',
    tabOverview: 'Overview',
    tabSimulation: 'Simulations',
    tabScenario: 'Scenarios',
    tabContinuity: 'Continuity',
    tabProcurement: 'Procurement',
    briefingLabel: 'Executive continuity notes',
    briefingTitle: 'Continuity briefings leaders can use',
    walkthroughLabel: 'Governance walkthroughs',
    walkthroughTitle: 'How modernization works in practice',
    beforeAfterLabel: 'Before/after map',
    beforeAfterTitle: 'How things improve over time',
    binderTitle: 'Procurement Evidence Binder',
    briefingIntro:
      'These briefings are practical, easy to review, and built for leadership and governance teams.',
    continuityOverviewTitle: 'Continuity Overview',
    continuityOverviewDesc:
      'Summarizes continuity status, governance alignment, operational stability, and memory health.',
    fragmentationVisibilityTitle: 'Fragmentation Visibility',
    fragmentationVisibilityDesc:
      'Shows silos, transition risks, coordination gaps, and onboarding weak points in plain language.',
    governanceAlignmentTitle: 'Governance Alignment',
    governanceAlignmentDesc:
      'Shows clear reasoning, oversight readiness, governance continuity, and review paths.',
    resilienceDirectionTitle: 'Organizational Resilience Direction',
    resilienceDirectionDesc:
      'Gives phased recommendations and rollout order to stabilize continuity.',
    evidenceLabel: 'Evidence architecture',
    evidenceTitle: 'Proof for leadership and procurement review',
    evidenceDesc:
      'Each proof type supports a clear review step so teams can assess rollout risk.',
    deploymentLabel: 'Deployment walkthrough',
    deploymentTitle: 'What deployment actually looks like',
    phaseLabel: 'Phase',
    safeguardLabel: 'Safeguard',
    continuityLabel: 'Continuity',
    visibilityLabel: 'Visibility',
    stakeholdersLabel: 'Stakeholders',
    checkpointLabel: 'Checkpoint',
    pilotLabel: 'Pilot simulation artifacts',
    pilotTitle: 'Real pilot examples',
    continuityProfileLabel: 'Continuity profile',
    fragmentationIndicatorsLabel: 'Fragmentation indicators',
    governanceConcernsLabel: 'Governance concerns',
    rolloutScopeLabel: 'Rollout scope',
    stabilizationOutcomesLabel: 'Stabilization outcomes',
    organizationalImprovementsLabel: 'Organizational improvements',
    operationalSimulationLabel: 'Continuity simulation artifacts',
    operationalSimulationTitle: 'Simulation outputs for leadership',
    continuityPostureLabel: 'Continuity status',
    governanceObservationLabel: 'Governance maturity note',
    fragmentationOperationalLabel: 'Fragmentation visibility',
    memoryIndicatorLabel: 'Memory indicator',
    rolloutGuidanceLabel: 'Rollout guidance',
    resilienceDirectionLabel: 'Resilience direction',
    scenarioLabel: 'Executive scenario modeling',
    scenarioTitle: 'How this works in a real organization',
    stepWord: 'Step',
    maturityLabel: 'Maturity Snapshots',
    maturityTitle: 'Progress view without scoring people',
    timelineLabel: 'Phased timeline',
    timelineTitle: 'A phased timeline leaders can follow',
    rolloutSimulationTitle: 'Rollout simulation flow',
    briefingFlowsLabel: 'Executive briefing flows',
    briefingFlowsTitle: 'Briefings written as practical guidance',
    riskNarrativesTitle: 'Continuity risk narratives',
    riskNarrativeOne:
      'Continuity depends too much on a small number of people and handoff paths.',
    riskNarrativeTwo:
      'Governance gets stronger when review reasons and owners are clear at each checkpoint.',
    riskNarrativeThree:
      'Onboarding is more stable when transfer routines are documented before expansion starts.',
    reviewLayersTitle: 'Governance review layers',
    binderIntro: 'This binder is for due diligence, not sales language.',
    dashboardTitle: 'Executive continuity signals',
    proofPackLabel: 'Proof pack orientation',
    proofPackTitle: 'Evidence that helps teams make a real decision',
    proofPackDesc:
      'This page is practical. It shows evidence, rollout sequence, and review checkpoints so teams can decide on facts.',
    sectionTransitionPressure: 'Transition pressure points and continuity responses',
    sectionFrictionFlows: 'Governance friction simulation flows',
    sectionEventWalkthroughs: 'Continuity event walkthroughs',
    sectionContinuityStress: 'Continuity stress modeling',
    sectionOrgStabilization: 'Stabilization simulation',
    sectionOnboardingIntel: 'Onboarding continuity guidance',
    sectionFederationScale: 'Federation-scale continuity scenarios',
    sectionCommitteeCoord: 'Committee coordination simulations',
    sectionMemoryStress: 'Memory stress models',
    sectionDecisionPathways: 'Executive decision pathways',
    sectionMultiStakeholder: 'Multi-stakeholder governance narratives',
    sectionLongitudinal: 'Long-term continuity stories',
    stabilizationMoveLabel: 'Stabilization move',
    manageThroughLabel: 'Manage through',
    stabilizeWithLabel: 'Stabilize with',
  },
  'fr-CA': {
    title: 'Preuves organisationnelles | UnionEyes',
    description:
      'Architecture de preuve organisationnelle pour les parcours de deploiement, les artefacts de simulation pilote et les revues de gouvernance.',
    badge: 'Preuves organisationnelles',
    heroHeading: 'Des systemes de preuve organisationnelle pour un examen reel du deploiement.',
    heroDescription:
      'UnionEyes presente une architecture de preuves, des parcours organisationnels et des simulations afin que la modernisation soit examinee comme un changement reel de gouvernance.',
    pilotCta: 'Demander un pilote',
    trustCta: 'Voir le centre de confiance',
    tabOverview: 'Apercu',
    tabSimulation: 'Simulations',
    tabScenario: 'Scenarios',
    tabContinuity: 'Continuite',
    tabProcurement: 'Achats',
    briefingLabel: 'Briefings de continuite executive',
    briefingTitle: 'Briefings de continuite utiles a la direction',
    walkthroughLabel: 'Parcours de gouvernance',
    walkthroughTitle: 'Comment la modernisation fonctionne en pratique',
    beforeAfterLabel: 'Carte avant/apres',
    beforeAfterTitle: 'Comment la situation evolue dans le temps',
    binderTitle: 'Dossier de preuve pour les achats',
    briefingIntro:
      'Ces briefings sont pratiques, faciles a revoir, et faits pour les equipes de direction et de gouvernance.',
    continuityOverviewTitle: 'Apercu de continuite',
    continuityOverviewDesc:
      'Resume la continuite, l alignement de gouvernance, la stabilite operationnelle et la sante de la memoire.',
    fragmentationVisibilityTitle: 'Visibilite de la fragmentation',
    fragmentationVisibilityDesc:
      'Montre les silos, les risques de transition, les ecarts de coordination et les points faibles d integration.',
    governanceAlignmentTitle: 'Alignement de gouvernance',
    governanceAlignmentDesc:
      'Montre le raisonnement clair, la preparation de supervision, la continuite de gouvernance et les parcours de revue.',
    resilienceDirectionTitle: 'Orientation de resilience organisationnelle',
    resilienceDirectionDesc:
      'Propose des recommandations par phase et un ordre de modernisation pour stabiliser la continuite.',
    evidenceLabel: 'Architecture de preuve',
    evidenceTitle: 'Ensemble de preuves pour la direction et les achats',
    evidenceDesc:
      'Chaque type de preuve soutient une etape de revue pour evaluer clairement le risque de deploiement.',
    deploymentLabel: 'Parcours de deploiement',
    deploymentTitle: 'A quoi ressemble concretement le deploiement',
    phaseLabel: 'Phase',
    safeguardLabel: 'Garde-fou',
    continuityLabel: 'Continuite',
    visibilityLabel: 'Visibilite',
    stakeholdersLabel: 'Parties prenantes',
    checkpointLabel: 'Point de controle',
    pilotLabel: 'Artefacts de simulation pilote',
    pilotTitle: 'Exemples de pilotes reels',
    continuityProfileLabel: 'Profil de continuite',
    fragmentationIndicatorsLabel: 'Indicateurs de fragmentation',
    governanceConcernsLabel: 'Enjeux de gouvernance',
    rolloutScopeLabel: 'Perimetre de deploiement',
    stabilizationOutcomesLabel: 'Resultats de stabilisation',
    organizationalImprovementsLabel: 'Ameliorations organisationnelles',
    operationalSimulationLabel: 'Artefacts de simulation de continuite',
    operationalSimulationTitle: 'Sorties de simulation pour la direction',
    continuityPostureLabel: 'Etat de continuite',
    governanceObservationLabel: 'Note de maturite de gouvernance',
    fragmentationOperationalLabel: 'Visibilite de la fragmentation',
    memoryIndicatorLabel: 'Indicateur de memoire',
    rolloutGuidanceLabel: 'Orientation de deploiement',
    resilienceDirectionLabel: 'Orientation de resilience',
    scenarioLabel: 'Modelisation de scenarios executives',
    scenarioTitle: 'Comment l infrastructure organisationnelle agit dans une organisation reelle',
    stepWord: 'Etape',
    maturityLabel: 'Instantanes de maturite',
    maturityTitle: 'Vue de progression sans classement de personnes',
    timelineLabel: 'Calendrier par phases',
    timelineTitle: 'Un calendrier par phases facile a suivre',
    rolloutSimulationTitle: 'Flux de simulation de deploiement',
    briefingFlowsLabel: 'Flux de briefing executif',
    briefingFlowsTitle: 'Des briefings qui se lisent comme des orientations operationnelles',
    riskNarrativesTitle: 'Recits de risque de continuite',
    riskNarrativeOne:
      'La continuite depend trop de quelques personnes et de quelques parcours de coordination.',
    riskNarrativeTwo:
      'La gouvernance devient plus solide quand les raisons de revue et les responsables sont clairs a chaque etape.',
    riskNarrativeThree:
      'L integration est plus stable quand les routines de transfert sont documentees avant l expansion.',
    reviewLayersTitle: 'Couches de revue de gouvernance',
    binderIntro: 'Ce dossier est concu pour la diligence raisonnable, pas comme support commercial.',
    dashboardTitle: 'Signaux de continuite executive',
    proofPackLabel: 'Orientation du dossier de preuves',
    proofPackTitle: 'Des preuves qui aident a prendre une vraie decision',
    proofPackDesc:
      'Cette page reste pratique. Elle montre les preuves, la sequence de deploiement et les points de revue pour decider sur des faits.',
    sectionTransitionPressure: 'Points de pression en transition et reponses concretes',
    sectionFrictionFlows: 'Flux de simulation de friction de gouvernance',
    sectionEventWalkthroughs: 'Parcours d evenements de continuite',
    sectionContinuityStress: 'Modelisation du stress de continuite',
    sectionOrgStabilization: 'Simulation de stabilisation',
    sectionOnboardingIntel: 'Guidage de continuite pour l integration',
    sectionFederationScale: 'Scenarios de continuite a l echelle federale',
    sectionCommitteeCoord: 'Simulations de coordination de comites',
    sectionMemoryStress: 'Modeles de stress de memoire',
    sectionDecisionPathways: 'Parcours de decision executive',
    sectionMultiStakeholder: 'Recits de gouvernance multi-parties prenantes',
    sectionLongitudinal: 'Histoires de continuite dans le temps',
    stabilizationMoveLabel: 'Geste de stabilisation',
    manageThroughLabel: 'Gerer via',
    stabilizeWithLabel: 'Stabiliser avec',
  },
  it: {
    title: 'Prove istituzionali | UnionEyes',
    description:
      'Architettura di prove operative per walkthrough di deployment, artefatti pilota e simulazioni di governance.',
    badge: 'Prove istituzionali',
    heroHeading: 'Sistemi di prova operativa per una revisione reale del deployment.',
    heroDescription:
      'UnionEyes rende visibili architettura delle prove, walkthrough e simulazioni per revisioni esecutive e di procurement.',
    pilotCta: 'Richiedi un pilota',
    trustCta: 'Rivedi il Trust Center',
    tabOverview: 'Panoramica',
    tabSimulation: 'Simulazioni',
    tabScenario: 'Intelligenza scenari',
    tabContinuity: 'Continuita',
    tabProcurement: 'Procurement',
    briefingLabel: 'Sistema briefing continuita esecutiva',
    briefingTitle: 'Briefing di continuita di livello esecutivo',
    walkthroughLabel: 'Walkthrough operativi di governance',
    walkthroughTitle: 'Come opera la modernizzazione della governance',
    beforeAfterLabel: 'Mappa istituzionale prima/dopo',
    beforeAfterTitle: 'Trasformazione operativa nel tempo',
    binderTitle: 'Binder di evidenze procurement',
    briefingIntro:
      'I briefing sono materiali strategici operativi: calmi, orientati al deployment e revisionabili da leadership e governance.',
    continuityOverviewTitle: 'Panoramica continuita',
    continuityOverviewDesc:
      'Riassume postura di continuita, coerenza di governance, stabilita operativa e salute della memoria istituzionale.',
    fragmentationVisibilityTitle: 'Visibilita frammentazione',
    fragmentationVisibilityDesc:
      'Rende visibili silos, vulnerabilita di transizione, gap di coordinamento e fragilita di onboarding.',
    governanceAlignmentTitle: 'Allineamento governance',
    governanceAlignmentDesc:
      'Documenta spiegabilita, readiness di oversight, continuita di governance e percorsi di review.',
    resilienceDirectionTitle: 'Direzione resilienza istituzionale',
    resilienceDirectionDesc:
      'Fornisce raccomandazioni per fasi e sequenziamento di modernizzazione per stabilizzare la continuita.',
    evidenceLabel: 'Architettura prove istituzionali',
    evidenceTitle: 'Densita di prova operativa per review executive e procurement',
    evidenceDesc:
      'Le prove sono organizzate per essere calme, revisionabili e mature. Ogni tipo supporta una parte reale della conversazione di deployment.',
    deploymentLabel: 'Walkthrough operativo di deployment',
    deploymentTitle: 'Come appare realmente il deployment',
    phaseLabel: 'Fase',
    safeguardLabel: 'Salvaguardia',
    continuityLabel: 'Continuita',
    visibilityLabel: 'Visibilita',
    stakeholdersLabel: 'Stakeholder',
    checkpointLabel: 'Checkpoint',
    pilotLabel: 'Artefatti simulazione pilota',
    pilotTitle: 'Esempi realistici di pilota istituzionale',
    continuityProfileLabel: 'Profilo continuita',
    fragmentationIndicatorsLabel: 'Indicatori di frammentazione',
    governanceConcernsLabel: 'Rischi di governance',
    rolloutScopeLabel: 'Perimetro rollout',
    stabilizationOutcomesLabel: 'Esiti di stabilizzazione',
    organizationalImprovementsLabel: 'Miglioramenti organizzativi',
    operationalSimulationLabel: 'Artefatti simulazione operativa della continuita',
    operationalSimulationTitle: 'Output di simulazione continuita per review executive',
    continuityPostureLabel: 'Postura di continuita',
    governanceObservationLabel: 'Osservazione maturita governance',
    fragmentationOperationalLabel: 'Visibilita frammentazione operativa',
    memoryIndicatorLabel: 'Indicatore memoria istituzionale',
    rolloutGuidanceLabel: 'Guida rollout',
    resilienceDirectionLabel: 'Direzione resilienza',
    scenarioLabel: 'Modeling scenari executive',
    scenarioTitle: 'Come la piattaforma si comporta in una organizzazione reale',
    stepWord: 'Step',
    maturityLabel: 'Snapshot di maturita',
    maturityTitle: 'Maturita direzionale senza ranking',
    timelineLabel: 'Sistemi timeline di deployment',
    timelineTitle: 'Ritmo per fasi per fiducia di leadership e procurement',
    rolloutSimulationTitle: 'Flusso di simulazione rollout istituzionale',
    briefingFlowsLabel: 'Flussi briefing continuita executive',
    briefingFlowsTitle: 'Briefing che leggono come guida operativa',
    riskNarrativesTitle: 'Narrazioni di rischio continuita',
    riskNarrativeOne:
      'La continuita operativa appare dipendente da conoscenza istituzionale concentrata in un numero limitato di percorsi di coordinamento.',
    riskNarrativeTwo:
      'La coerenza di governance aumenta quando razionale di review e ownership dei checkpoint sono espliciti.',
    riskNarrativeThree:
      'La stabilita di onboarding migliora quando i rituali di trasferimento continuita sono documentati prima dell espansione.',
    reviewLayersTitle: 'Layer di simulazione review governance',
    binderIntro: 'Il binder e strutturato per due diligence, non come collateral commerciale.',
    dashboardTitle: 'Segnali dashboard operativa executive',
    proofPackLabel: 'Orientamento proof pack',
    proofPackTitle: 'Le prove servono per prendere decisioni reali',
    proofPackDesc:
      'Questa pagina e intenzionalmente pratica. Mostra superfici di prova, sequenza di implementazione e strutture di review che rendono credibile il deployment.',
    sectionTransitionPressure: 'Punti di pressione della transizione e risposte di continuita',
    sectionFrictionFlows: 'Flussi di simulazione di attrito nella governance',
    sectionEventWalkthroughs: 'Walkthrough eventi di continuita istituzionale',
    sectionContinuityStress: 'Modellazione dello stress di continuita',
    sectionOrgStabilization: 'Simulazione di stabilizzazione organizzativa',
    sectionOnboardingIntel: 'Intelligenza di continuita per l onboarding',
    sectionFederationScale: 'Scenari di continuita su scala federale',
    sectionCommitteeCoord: 'Simulazioni di coordinamento dei comitati',
    sectionMemoryStress: 'Modelli di stress della memoria istituzionale',
    sectionDecisionPathways: 'Sistemi di percorso decisionale esecutivo',
    sectionMultiStakeholder: 'Narrazioni di governance multi-stakeholder',
    sectionLongitudinal: 'Storie di evoluzione longitudinale della continuita',
    stabilizationMoveLabel: 'Mossa di stabilizzazione',
    manageThroughLabel: 'Gestire attraverso',
    stabilizeWithLabel: 'Stabilizzare con',
  },
  pt: {
    title: 'Provas institucionais | UnionEyes',
    description:
      'Arquitetura de prova operacional para walkthroughs de implantacao, artefatos de piloto e simulacoes de governanca.',
    badge: 'Provas institucionais',
    heroHeading: 'Sistemas de prova operacional para revisao real de implantacao.',
    heroDescription:
      'O UnionEyes exibe arquitetura de evidencia, walkthroughs e simulacoes para revisao executiva e de compras.',
    pilotCta: 'Solicitar piloto',
    trustCta: 'Revisar centro de confianca',
    tabOverview: 'Visao geral',
    tabSimulation: 'Simulacoes',
    tabScenario: 'Inteligencia de cenarios',
    tabContinuity: 'Continuidade',
    tabProcurement: 'Compras',
    briefingLabel: 'Sistema de briefing de continuidade executiva',
    briefingTitle: 'Briefings de continuidade de nivel executivo',
    walkthroughLabel: 'Walkthroughs operacionais de governanca',
    walkthroughTitle: 'Como a modernizacao de governanca opera na pratica',
    beforeAfterLabel: 'Mapa institucional antes/depois',
    beforeAfterTitle: 'Transformacao operacional ao longo do tempo',
    binderTitle: 'Dossie de evidencias para compras',
    briefingIntro:
      'Os briefings sao materiais estrategicos operacionais: calmos, orientados a implantacao e revisaveis por lideranca e governanca.',
    continuityOverviewTitle: 'Visao geral de continuidade',
    continuityOverviewDesc:
      'Resume postura de continuidade, coerencia de governanca, estabilidade operacional e saude da memoria institucional.',
    fragmentationVisibilityTitle: 'Visibilidade de fragmentacao',
    fragmentationVisibilityDesc:
      'Evidencia silos operacionais, vulnerabilidades de transicao, lacunas de coordenacao e fragilidade de onboarding.',
    governanceAlignmentTitle: 'Alinhamento de governanca',
    governanceAlignmentDesc:
      'Documenta explicabilidade, prontidao de supervisao, continuidade de governanca e caminhos de revisao.',
    resilienceDirectionTitle: 'Direcao de resiliencia institucional',
    resilienceDirectionDesc:
      'Fornece recomendacoes faseadas e sequenciamento de modernizacao para estabilizar a continuidade.',
    evidenceLabel: 'Arquitetura de evidencia institucional',
    evidenceTitle: 'Densidade de prova operacional para revisao executiva e compras',
    evidenceDesc:
      'A evidencia e organizada para ser calma, revisavel e institucionalmente madura. Cada tipo apoia uma parte concreta da implantacao.',
    deploymentLabel: 'Walkthrough operacional de implantacao',
    deploymentTitle: 'Como a implantacao realmente acontece',
    phaseLabel: 'Fase',
    safeguardLabel: 'Salvaguarda',
    continuityLabel: 'Continuidade',
    visibilityLabel: 'Visibilidade',
    stakeholdersLabel: 'Partes interessadas',
    checkpointLabel: 'Ponto de controle',
    pilotLabel: 'Artefatos de simulacao de piloto',
    pilotTitle: 'Exemplos realistas de piloto institucional',
    continuityProfileLabel: 'Perfil de continuidade',
    fragmentationIndicatorsLabel: 'Indicadores de fragmentacao',
    governanceConcernsLabel: 'Preocupacoes de governanca',
    rolloutScopeLabel: 'Escopo de rollout',
    stabilizationOutcomesLabel: 'Resultados de estabilizacao',
    organizationalImprovementsLabel: 'Melhorias organizacionais',
    operationalSimulationLabel: 'Artefatos de simulacao operacional de continuidade',
    operationalSimulationTitle: 'Saidas de simulacao de continuidade para revisao executiva',
    continuityPostureLabel: 'Postura de continuidade',
    governanceObservationLabel: 'Observacao de maturidade de governanca',
    fragmentationOperationalLabel: 'Visibilidade de fragmentacao operacional',
    memoryIndicatorLabel: 'Indicador de memoria institucional',
    rolloutGuidanceLabel: 'Orientacao de rollout',
    resilienceDirectionLabel: 'Direcao de resiliencia',
    scenarioLabel: 'Modelagem de cenarios executivos',
    scenarioTitle: 'Como a plataforma se comporta dentro de uma organizacao',
    stepWord: 'Etapa',
    maturityLabel: 'Snapshots de maturidade',
    maturityTitle: 'Maturidade direcional sem ranking',
    timelineLabel: 'Sistemas de cronograma de implantacao',
    timelineTitle: 'Ritmo faseado para confianca de lideranca e compras',
    rolloutSimulationTitle: 'Fluxo de simulacao de rollout institucional',
    briefingFlowsLabel: 'Fluxos de briefing de continuidade executiva',
    briefingFlowsTitle: 'Briefings com leitura de orientacao operacional',
    riskNarrativesTitle: 'Narrativas de risco de continuidade',
    riskNarrativeOne:
      'A continuidade operacional parece depender de conhecimento institucional concentrado em um numero limitado de caminhos de coordenacao.',
    riskNarrativeTwo:
      'A coerencia de governanca aumenta quando a justificativa de revisao e a responsabilidade pelos checkpoints sao explicitas.',
    riskNarrativeThree:
      'A estabilidade de onboarding melhora quando rotinas de transferencia de continuidade sao documentadas antes da expansao.',
    reviewLayersTitle: 'Camadas de simulacao de revisao de governanca',
    binderIntro: 'O dossie e estruturado para diligencia tecnica, nao como material comercial.',
    dashboardTitle: 'Sinais de painel operacional executivo',
    proofPackLabel: 'Orientacao do pacote de prova',
    proofPackTitle: 'A evidencia existe para apoiar decisoes reais',
    proofPackDesc:
      'Esta pagina e intencionalmente pratica. Ela mostra superficies de evidencia, sequencia de implementacao e estruturas de revisao que tornam a implantacao credvel.',
    sectionTransitionPressure: 'Pontos de pressao de transicao e respostas calmas de continuidade',
    sectionFrictionFlows: 'Fluxos de simulacao de atrito na governanca',
    sectionEventWalkthroughs: 'Walkthroughs de eventos de continuidade institucional',
    sectionContinuityStress: 'Modelagem de estresse de continuidade',
    sectionOrgStabilization: 'Simulacao de estabilizacao organizacional',
    sectionOnboardingIntel: 'Inteligencia de continuidade para onboarding',
    sectionFederationScale: 'Cenarios de continuidade em escala federal',
    sectionCommitteeCoord: 'Simulacoes de coordenacao de comites',
    sectionMemoryStress: 'Modelos de estresse de memoria institucional',
    sectionDecisionPathways: 'Sistemas de caminho de decisao executiva',
    sectionMultiStakeholder: 'Narrativas de governanca multi-partes interessadas',
    sectionLongitudinal: 'Historias de evolucao longitudinal da continuidade',
    stabilizationMoveLabel: 'Movimento de estabilizacao',
    manageThroughLabel: 'Gerenciar por meio de',
    stabilizeWithLabel: 'Estabilizar com',
  },
} as const;

/**
 * Anonymized proof narratives.
 *
 * These are anonymized examples based on the
 * scenario archetypes already modeled in `@/lib/institutional-legitimacy`
 * (leadership transition, fragmented governance, onboarding instability).
 * They contain no real organization names, no real people, and no claims of
 * outcomes that have not been delivered. The disclaimer is rendered with
 * the section so readers see the framing up front.
 */
const ANONYMIZED_PROOF_NARRATIVES: Record<
  'en-CA' | 'fr-CA',
  {
    label: string;
    title: string;
    intro: string;
    disclaimer: string;
    items: Array<{
      archetype: string;
      situation: string;
      response: string;
      observable: string;
    }>;
  }
> = {
  'en-CA': {
    label: 'Anonymized proof narratives',
    title: 'How organizational continuity reads on the ground',
    intro:
      'Three anonymized examples based on real continuity patterns seen in institutional reviews.',
    disclaimer:
      'These are anonymized composites for organizational review. They are not testimonials or claims about one specific organization. Real engagement evidence is shared under NDA in the proof pack.',
    items: [
      {
        archetype: 'Regional labour federation — mid-term executive transition',
        situation:
          'Two long-serving officers left within six months. New officers inherited active grievances, an in-flight bargaining file, and a board calendar with little handoff context.',
        response:
          'A continuity review was run before new tooling. OCRA showed the main risk was lost decision reasoning on three active files, not the leadership change itself.',
        observable:
          'Within sixty days, reasoning for those files was rebuilt from existing records and reviewed with the new officers in one briefing. No new committee was needed.',
      },
      {
        archetype: 'Mid-sized local — fragmented governance operations',
        situation:
          'Decisions were split across four channels: an executive thread, a finance subcommittee, a steward chat, and personal email. Members could not tell which channel was authoritative.',
        response:
          'The review focused on coordination, not tools. The recommendation was one decisions-of-record surface with clear review checkpoints, without removing existing channels.',
        observable:
          'Within one quarter, decision confusion dropped in tracked categories and two new stewards onboarded without the usual six-week ambiguity window.',
      },
      {
        archetype: 'Public-sector bargaining unit — onboarding instability',
        situation:
          'High executive turnover meant new members spent months rebuilding context that already existed but was hard to read. Organizational memory faded each rotation.',
        response:
          'Memory lineage was mapped to the active responsibilities new members inherited. The diagnostic produced a continuity handoff routine, not a training curriculum.',
        observable:
          'The next two intakes finished without re-litigating settled decisions. Risk signals on three dependencies stayed within thresholds in both cycles.',
      },
    ],
  },
  'fr-CA': {
    label: 'Recits de preuve anonymises',
    title: 'A quoi ressemble la continuite institutionnelle sur le terrain',
    intro:
      'Trois exemples anonymises bases sur des modeles reels observes dans les revues de continuite.',
    disclaimer:
      'Ces recits sont des composites anonymises pour la revue organisationnelle. Ce ne sont pas des temoignages ni des affirmations sur une organisation precise. Les preuves reelles sont remises sous NDA dans le dossier de preuves.',
    items: [
      {
        archetype: 'Federation syndicale regionale — transition executive en cours de mandat',
        situation:
          'Deux dirigeants de longue date sont partis en six mois. Les successeurs ont herite de griefs actifs, d un dossier de negociation en cours et d un calendrier avec peu de contexte de transfert.',
        response:
          'Une revue de continuite a ete faite avant tout nouvel outillage. L OCRA a montre que le risque principal etait la perte du raisonnement decisionnel sur trois dossiers actifs.',
        observable:
          'En soixante jours, le raisonnement de ces dossiers a ete reconstruit a partir des dossiers existants puis revise avec les nouveaux dirigeants dans un briefing unique. Aucun nouveau comite n a ete cree.',
      },
      {
        archetype: 'Section locale de taille moyenne — operations de gouvernance fragmentees',
        situation:
          'Les decisions operationnelles passaient par quatre canaux paralleles : fil executif, sous-comite finances, discussion de delegues et courriel personnel. Les membres ne savaient pas quel canal faisait foi.',
        response:
          'La revue a cible la coordination, pas les outils. Recommandation : une seule surface de decisions de reference avec des points de revue clairs, sans supprimer les canaux existants.',
        observable:
          'En un trimestre, la confusion sur les decisions suivies a baisse et deux nouveaux delegues ont ete integres sans la fenetre habituelle de six semaines d ambiguite.',
      },
      {
        archetype: 'Unite de negociation du secteur public — instabilite a l integration',
        situation:
          'Le roulement eleve au comite executif faisait que chaque nouveau membre passait des mois a reconstruire un contexte deja present mais peu lisible. La memoire organisationnelle se perdait a chaque rotation.',
        response:
          'La lignee de memoire a ete cartographiee selon les responsabilites actives heritees. Le diagnostic a produit une routine de transfert de continuite, pas un programme de formation.',
        observable:
          'Les deux cycles suivants se sont termines sans rejouer des decisions deja reglees. Les signaux de risque sur trois dependances sont restes dans les seuils.',
      },
    ],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const copy = PROOF_COPY[locale as keyof typeof PROOF_COPY] ?? PROOF_COPY['en-CA'];
  return {
    title: copy.title,
    description: copy.description,
    alternates: buildLocaleAlternates(locale, '/proof'),
  };
}

const iconByTitle: Record<string, typeof FileText> = {
  'Rollout pathways': ClipboardList,
  'Governance review flows': ShieldCheck,
  'Continuity assessments': FileText,
  'Pilot artifacts': Layers3,
  'Readiness summaries': FileText,
  'Trust-center evidence': ShieldCheck,
};

const DATA_TRANSLATIONS = {
  'fr-CA': {
    'Rollout pathways': 'Parcours de deploiement',
    'Deployment realism': 'Realisme de deploiement',
    'Shows how activation moves from assessment into controlled adoption.':
      "Montre comment l activation passe de l evaluation a une adoption controlee.",
    'Governance review flows': 'Flux de revue de gouvernance',
    Explainability: 'Explicabilite',
    'Surfaces the checkpoints where oversight remains visible and documented.':
      'Met en evidence les points de controle ou la supervision reste visible et documentee.',
    'Continuity assessments': 'Evaluations de continuite',
    'Operational insight': 'Vision operationnelle',
    'Keeps continuity risk and resilience direction readable to leadership.':
      'Maintient la lisibilite des risques de continuite et de la direction de resilience pour la direction.',
    'Pilot artifacts': 'Artefacts de pilote',
    'Organizational safety': 'Securite organisationnelle',
    'Frames simulation packs, boundaries, and stabilization notes as reviewable outputs.':
      'Presente les simulations, limites et notes de stabilisation comme des livrables revisables.',
    'Readiness summaries': 'Syntheses de preparation',
    'Executive confidence': 'Confiance executive',
    'Packages deployment direction in plain language for procurement and leadership.':
      'Presente la direction de deploiement en langage clair pour les achats et la direction.',
    'Trust-center evidence': 'Preuves du centre de confiance',
    'Procurement reassurance': 'Assurance pour les achats',
    'Keeps implementation safeguards, controls, and proof materials centrally visible.':
      'Maintient visibles de facon centrale les garde-fous, controles et preuves d implementation.',
    'Leadership transition': 'Transition de leadership',
    'Continuity preservation': 'Preservation de la continuite',
    'Maintains organizational memory and governance continuity during executive or committee turnover.':
      'Maintient la memoire organisationnelle et la continuite de gouvernance pendant les transitions de leadership.',
    'Governance review': 'Revue de gouvernance',
    'Shows how decisions remain traceable through review checkpoints and rationale pathways.':
      'Montre comment les decisions restent tracables via des points de controle et des parcours de justification.',
    'Committee coordination': 'Coordination des comites',
    'Operational coherence': 'Coherence operationnelle',
    'Aligns committee roles and handoffs so operational decisions remain coordinated.':
      'Aligne les roles des comites et les relais pour garder des decisions operationnelles coherentes.',
    'Onboarding stabilization': 'Stabilisation de l integration',
    'Organizational memory': 'Memoire organisationnelle',
    'Preserves continuity context while new teams inherit active operating responsibilities.':
      'Preserve le contexte de continuite pendant que de nouvelles equipes reprennent des responsabilites actives.',
    'Fragmentation reduction': 'Reduction de la fragmentation',
    Alignment: 'Alignement',
    'Reduces siloed operations through shared governance language and review cadence.':
      'Reduit les operations en silos grace a un langage de gouvernance partage et une cadence de revue.',
    'Procurement review': 'Revue des achats',
    'Governance trust': 'Confiance de gouvernance',
    'Supports due diligence with implementation safeguards, boundaries, and evidence commitments.':
      'Soutient la diligence raisonnable avec des garde-fous, limites et engagements de preuve.',
    'Continuity Assessment': 'Evaluation de continuite',
    'Governance Mapping': 'Cartographie de gouvernance',
    'Pilot Alignment': 'Alignement du pilote',
    'Controlled Rollout': 'Deploiement controle',
    'Operational Stabilization': 'Stabilisation operationnelle',
    'Mid-Sized Labour Organization Pilot': 'Pilote d organisation syndicale de taille moyenne',
    'Multi-Jurisdiction Pilot': 'Pilote multi-juridiction',
    'Regional Labour Organization Continuity Review': 'Revue de continuite d organisation syndicale regionale',
    'Cross-Committee Continuity Stabilization Review': 'Revue inter-comites de stabilisation de continuite',
    'Leadership Transition': 'Transition du leadership',
    'Fragmented Governance Operations': 'Operations de gouvernance fragmentees',
    'Onboarding Instability': 'Instabilite de l integration',
    'Organizational Memory Loss': 'Perte de memoire organisationnelle',
    'Multi-Committee Coordination': 'Coordination multi-comites',
    'Governance Drift': 'Derive de gouvernance',
    'Pilot timeline': 'Calendrier du pilote',
    'Operational readiness': 'Preparation operationnelle',
    'Governance rollout': 'Deploiement de gouvernance',
    'Oversight sequencing': 'Sequencement de supervision',
    'Continuity adoption': 'Adoption de la continuite',
    'Organizational stabilization': 'Stabilisation organisationnelle',
    'Organizational alignment': 'Alignement organisationnel',
    'Change pacing': 'Rythme du changement',
    'Maturity progression': 'Progression de maturite',
    'Long-term resilience': 'Resilience a long terme',
    Assessment: 'Evaluation',
    'Governance Review': 'Revue de gouvernance',
    'Pilot Stabilization': 'Stabilisation du pilote',
    'Organizational Alignment': 'Alignement organisationnel',
    'Long-Term Continuity': 'Continuite a long terme',
    'Fragmented Governance': 'Gouvernance fragmentee',
    'Continuity Visibility': 'Visibilite de la continuite',
    'Explainable Coordination': 'Coordination explicable',
    'Operational Alignment': 'Alignement operationnel',
    'Organizational Stability': 'Stabilite organisationnelle',
    'Organizational Resilience': 'Resilience organisationnelle',
    Continuity: 'Continuite',
    Stability: 'Stabilite',
    Governance: 'Gouvernance',
    Operations: 'Operations',
    Coordination: 'Coordination',
    Trust: 'Confiance',
    Reviewability: 'Revisabilite',
    'Organizational Memory': 'Memoire organisationnelle',
    Preservation: 'Preservation',
    'Implementation safeguards': "Garde-fous d implementation",
    'Governance oversight structures': 'Structures de supervision de gouvernance',
    'Explainability philosophy': 'Philosophie d explicabilite',
    'Rollout sequencing': 'Sequencement du deploiement',
    'Operational boundaries': 'Limites operationnelles',
    'Continuity protection principles': 'Principes de protection de la continuite',
    'Pilot governance safeguards': 'Garde-fous de gouvernance du pilote',
    'Reviewability commitments': 'Engagements de revisabilite',
    'Review checkpoints': 'Points de controle de revue',
    'Explainability pathways': 'Parcours d explicabilite',
    'Approval layers': 'Niveaux d approbation',
    'Governance accountability': 'Responsabilite de gouvernance',
    'Operational validation': 'Validation operationnelle',
    'Continuity visibility': 'Visibilite de la continuite',
    'Governance coherence': 'Coherence de gouvernance',
    'Operational alignment': 'Alignement operationnel',
    'Fragmentation awareness': 'Conscience de la fragmentation',
    'Continuity risk summaries': 'Syntheses des risques de continuite',
    'Governance resilience observations': 'Observations de resilience de gouvernance',
    'Organizational coherence mapping': 'Cartographie de coherence organisationnelle',
    'Organizational readiness guidance': 'Orientation de preparation organisationnelle',
  },
  it: {
    'Rollout pathways': 'Percorsi di rollout',
    'Deployment realism': 'Realismo del deployment',
    'Governance review flows': 'Flussi di review governance',
    Explainability: 'Spiegabilita',
    'Continuity assessments': 'Valutazioni di continuita',
    'Operational insight': 'Insight operativo',
    'Pilot artifacts': 'Artefatti pilota',
    'Organizational safety': 'Sicurezza istituzionale',
    'Readiness summaries': 'Sintesi di readiness',
    'Executive confidence': 'Fiducia executive',
    'Trust-center evidence': 'Evidenze trust center',
    'Procurement reassurance': 'Affidabilita procurement',
    'Leadership transition': 'Transizione leadership',
    'Continuity preservation': 'Preservazione continuita',
    'Governance review': 'Review governance',
    'Committee coordination': 'Coordinamento comitati',
    'Operational coherence': 'Coerenza operativa',
    'Onboarding stabilization': 'Stabilizzazione onboarding',
    'Organizational memory': 'Memoria istituzionale',
    'Fragmentation reduction': 'Riduzione frammentazione',
    Alignment: 'Allineamento',
    'Procurement review': 'Review procurement',
    'Governance trust': 'Fiducia governance',
    'Continuity Assessment': 'Valutazione continuita',
    'Governance Mapping': 'Mappatura governance',
    'Pilot Alignment': 'Allineamento pilota',
    'Controlled Rollout': 'Rollout controllato',
    'Operational Stabilization': 'Stabilizzazione operativa',
    'Mid-Sized Labour Organization Pilot': 'Pilota organizzazione sindacale di medie dimensioni',
    'Multi-Jurisdiction Pilot': 'Pilota multi-giurisdizione',
    'Regional Labour Organization Continuity Review': 'Review continuita organizzazione sindacale regionale',
    'Cross-Committee Continuity Stabilization Review': 'Review stabilizzazione continuita inter-comitati',
    'Leadership Transition': 'Transizione della leadership',
    'Fragmented Governance Operations': 'Operazioni di governance frammentate',
    'Onboarding Instability': 'Instabilita onboarding',
    'Organizational Memory Loss': 'Perdita memoria istituzionale',
    'Multi-Committee Coordination': 'Coordinamento multi-comitati',
    'Governance Drift': 'Deriva della governance',
    'Pilot timeline': 'Timeline pilota',
    'Operational readiness': 'Readiness operativa',
    'Governance rollout': 'Rollout governance',
    'Oversight sequencing': 'Sequenziamento oversight',
    'Continuity adoption': 'Adozione continuita',
    'Organizational stabilization': 'Stabilizzazione organizzativa',
    'Organizational alignment': 'Allineamento istituzionale',
    'Change pacing': 'Ritmo del cambiamento',
    'Maturity progression': 'Progressione maturita',
    'Long-term resilience': 'Resilienza a lungo termine',
    Assessment: 'Valutazione',
    'Governance Review': 'Review governance',
    'Pilot Stabilization': 'Stabilizzazione pilota',
    'Organizational Alignment': 'Allineamento istituzionale',
    'Long-Term Continuity': 'Continuita di lungo periodo',
    'Fragmented Governance': 'Governance frammentata',
    'Continuity Visibility': 'Visibilita continuita',
    'Explainable Coordination': 'Coordinamento spiegabile',
    'Operational Alignment': 'Allineamento operativo',
    'Organizational Stability': 'Stabilita istituzionale',
    'Organizational Resilience': 'Resilienza organizzativa',
    Continuity: 'Continuita',
    Stability: 'Stabilita',
    Governance: 'Governance',
    Operations: 'Operazioni',
    Coordination: 'Coordinamento',
    Trust: 'Fiducia',
    Reviewability: 'Revisionabilita',
    'Organizational Memory': 'Memoria istituzionale',
    Preservation: 'Preservazione',
    'Implementation safeguards': 'Salvaguardie di implementazione',
    'Governance oversight structures': 'Strutture di oversight governance',
    'Explainability philosophy': 'Filosofia di spiegabilita',
    'Rollout sequencing': 'Sequenziamento rollout',
    'Operational boundaries': 'Confini operativi',
    'Continuity protection principles': 'Principi di protezione continuita',
    'Pilot governance safeguards': 'Salvaguardie governance pilota',
    'Reviewability commitments': 'Impegni di revisionabilita',
    'Review checkpoints': 'Checkpoint di review',
    'Explainability pathways': 'Percorsi di spiegabilita',
    'Approval layers': 'Layer di approvazione',
    'Governance accountability': 'Accountability governance',
    'Operational validation': 'Validazione operativa',
    'Continuity visibility': 'Visibilita continuita',
    'Governance coherence': 'Coerenza governance',
    'Operational alignment': 'Allineamento operativo',
    'Fragmentation awareness': 'Consapevolezza frammentazione',
    'Continuity risk summaries': 'Sintesi rischi continuita',
    'Governance resilience observations': 'Osservazioni resilienza governance',
    'Organizational coherence mapping': 'Mappatura coerenza organizzativa',
    'Organizational readiness guidance': 'Guida readiness istituzionale',
  },
  pt: {
    'Rollout pathways': 'Caminhos de rollout',
    'Deployment realism': 'Realismo de implantacao',
    'Governance review flows': 'Fluxos de revisao de governanca',
    Explainability: 'Explicabilidade',
    'Continuity assessments': 'Avaliacoes de continuidade',
    'Operational insight': 'Visao operacional',
    'Pilot artifacts': 'Artefatos de piloto',
    'Organizational safety': 'Seguranca institucional',
    'Readiness summaries': 'Sumarios de prontidao',
    'Executive confidence': 'Confianca executiva',
    'Trust-center evidence': 'Evidencias do centro de confianca',
    'Procurement reassurance': 'Confianca para compras',
    'Leadership transition': 'Transicao de lideranca',
    'Continuity preservation': 'Preservacao da continuidade',
    'Governance review': 'Revisao de governanca',
    'Committee coordination': 'Coordenacao de comites',
    'Operational coherence': 'Coerencia operacional',
    'Onboarding stabilization': 'Estabilizacao de onboarding',
    'Organizational memory': 'Memoria institucional',
    'Fragmentation reduction': 'Reducao da fragmentacao',
    Alignment: 'Alinhamento',
    'Procurement review': 'Revisao de compras',
    'Governance trust': 'Confianca de governanca',
    'Continuity Assessment': 'Avaliacao de continuidade',
    'Governance Mapping': 'Mapeamento de governanca',
    'Pilot Alignment': 'Alinhamento de piloto',
    'Controlled Rollout': 'Rollout controlado',
    'Operational Stabilization': 'Estabilizacao operacional',
    'Mid-Sized Labour Organization Pilot': 'Piloto de organizacao trabalhista de medio porte',
    'Multi-Jurisdiction Pilot': 'Piloto multijurisdicao',
    'Regional Labour Organization Continuity Review': 'Revisao regional de continuidade de organizacao trabalhista',
    'Cross-Committee Continuity Stabilization Review': 'Revisao intercomites de estabilizacao de continuidade',
    'Leadership Transition': 'Transicao de lideranca',
    'Fragmented Governance Operations': 'Operacoes de governanca fragmentadas',
    'Onboarding Instability': 'Instabilidade de onboarding',
    'Organizational Memory Loss': 'Perda de memoria institucional',
    'Multi-Committee Coordination': 'Coordenacao de multiplos comites',
    'Governance Drift': 'Deriva de governanca',
    'Pilot timeline': 'Cronograma do piloto',
    'Operational readiness': 'Prontidao operacional',
    'Governance rollout': 'Rollout de governanca',
    'Oversight sequencing': 'Sequenciamento de supervisao',
    'Continuity adoption': 'Adocao de continuidade',
    'Organizational stabilization': 'Estabilizacao organizacional',
    'Organizational alignment': 'Alinhamento institucional',
    'Change pacing': 'Ritmo de mudanca',
    'Maturity progression': 'Progressao de maturidade',
    'Long-term resilience': 'Resiliencia de longo prazo',
    Assessment: 'Avaliacao',
    'Governance Review': 'Revisao de governanca',
    'Pilot Stabilization': 'Estabilizacao do piloto',
    'Organizational Alignment': 'Alinhamento institucional',
    'Long-Term Continuity': 'Continuidade de longo prazo',
    'Fragmented Governance': 'Governanca fragmentada',
    'Continuity Visibility': 'Visibilidade de continuidade',
    'Explainable Coordination': 'Coordenacao explicavel',
    'Operational Alignment': 'Alinhamento operacional',
    'Organizational Stability': 'Estabilidade institucional',
    'Organizational Resilience': 'Resiliencia organizacional',
    Continuity: 'Continuidade',
    Stability: 'Estabilidade',
    Governance: 'Governanca',
    Operations: 'Operacoes',
    Coordination: 'Coordenacao',
    Trust: 'Confianca',
    Reviewability: 'Revisabilidade',
    'Organizational Memory': 'Memoria institucional',
    Preservation: 'Preservacao',
    'Implementation safeguards': 'Salvaguardas de implementacao',
    'Governance oversight structures': 'Estruturas de supervisao de governanca',
    'Explainability philosophy': 'Filosofia de explicabilidade',
    'Rollout sequencing': 'Sequenciamento do rollout',
    'Operational boundaries': 'Limites operacionais',
    'Continuity protection principles': 'Principios de protecao da continuidade',
    'Pilot governance safeguards': 'Salvaguardas de governanca do piloto',
    'Reviewability commitments': 'Compromissos de revisabilidade',
    'Review checkpoints': 'Pontos de controle de revisao',
    'Explainability pathways': 'Caminhos de explicabilidade',
    'Approval layers': 'Camadas de aprovacao',
    'Governance accountability': 'Responsabilidade de governanca',
    'Operational validation': 'Validacao operacional',
    'Continuity visibility': 'Visibilidade de continuidade',
    'Governance coherence': 'Coerencia de governanca',
    'Operational alignment': 'Alinhamento operacional',
    'Fragmentation awareness': 'Consciencia de fragmentacao',
    'Continuity risk summaries': 'Sumarios de risco de continuidade',
    'Governance resilience observations': 'Observacoes de resiliencia de governanca',
    'Organizational coherence mapping': 'Mapeamento de coerencia organizacional',
    'Organizational readiness guidance': 'Orientacao de prontidao institucional',
  },
} as const;

type DataLocale = keyof typeof DATA_TRANSLATIONS;

function translateOperationalString(locale: keyof typeof PROOF_COPY, value: string): string {
  if (locale === 'en-CA') {
    return value;
  }

  const dict = DATA_TRANSLATIONS[locale as DataLocale];
  return dict[value as keyof typeof dict] ?? value;
}

export default async function ProofPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ context?: string }>;
}) {
  const { locale } = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const contextMode = parseInstitutionalMode(resolvedSearch?.context);
  const localeKey: keyof typeof PROOF_COPY =
    locale in PROOF_COPY ? (locale as keyof typeof PROOF_COPY) : 'en-CA';
  const copy = PROOF_COPY[localeKey];
  const evidenceArchitectureArr =
    evidenceArchitecture[localeKey as keyof typeof evidenceArchitecture] ?? evidenceArchitecture['en-CA'];

  const localizedEvidenceArchitecture = evidenceArchitectureArr.map((item) => ({
    ...item,
    title: translateOperationalString(localeKey, item.title),
    purpose: translateOperationalString(localeKey, item.purpose),
    note: translateOperationalString(localeKey, item.note),
  }));
  const localizedGovernanceOperationalWalkthroughs = (
    governanceOperationalWalkthroughs[localeKey as keyof typeof governanceOperationalWalkthroughs] ??
    governanceOperationalWalkthroughs['en-CA']
  );
  const localizedDeploymentWalkthrough = deploymentWalkthrough.map((item) => ({
    ...item,
    stage: translateOperationalString(localeKey, item.stage),
  }));
  const localizedPilotSimulationArtifacts = pilotSimulationArtifacts.map((item) => ({
    ...item,
    title: translateOperationalString(localeKey, item.title),
  }));
  const localizedOperationalContinuitySimulationArtifacts = operationalContinuitySimulationArtifacts.map((item) => ({
    ...item,
    title: translateOperationalString(localeKey, item.title),
  }));
  const localizedExecutiveScenarioModels = executiveScenarioModels.map((item) => ({
    ...item,
    title: translateOperationalString(localeKey, item.title),
  }));
  const localizedInstitutionalBeforeAfterMap = institutionalBeforeAfterMap.map((item) =>
    translateOperationalString(localeKey, item)
  );
  const localizedOrganizationalMaturitySnapshots = organizationalMaturitySnapshots.map((item) => ({
    ...item,
    focus: translateOperationalString(localeKey, item.focus),
    dimension: translateOperationalString(localeKey, item.dimension),
  }));
  const localizedDeploymentTimelines = deploymentTimelines.map((item) => ({
    ...item,
    title: translateOperationalString(localeKey, item.title),
    purpose: translateOperationalString(localeKey, item.purpose),
  }));
  const localizedInstitutionalRolloutSimulationFlow = institutionalRolloutSimulationFlow.map((item) =>
    translateOperationalString(localeKey, item)
  );
  const localizedExecutiveBriefingFlows = (
    executiveBriefingFlows[localeKey as keyof typeof executiveBriefingFlows] ??
    executiveBriefingFlows['en-CA']
  );
  const localizedGovernanceReviewSimulationLayers = (
    governanceReviewSimulationLayers[localeKey as keyof typeof governanceReviewSimulationLayers] ??
    governanceReviewSimulationLayers['en-CA']
  );
  const localizedProcurementEvidenceBinder = (
    procurementEvidenceBinder[localeKey as keyof typeof procurementEvidenceBinder] ??
    procurementEvidenceBinder['en-CA']
  );
  const localizedExecutiveDashboardSignals = executiveDashboardSignals.map((item) => ({
    ...item,
    title: translateOperationalString(localeKey, item.title),
  }));
  const localizedLeadershipTransitionContinuityScenarios = (
    leadershipTransitionContinuityScenarios[localeKey as keyof typeof leadershipTransitionContinuityScenarios] ??
    leadershipTransitionContinuityScenarios['en-CA']
  );
  const localizedGovernanceFrictionSimulationFlows = (
    governanceFrictionSimulationFlows[localeKey as keyof typeof governanceFrictionSimulationFlows] ??
    governanceFrictionSimulationFlows['en-CA']
  );
  const localizedInstitutionalContinuityEventWalkthroughs = (
    institutionalContinuityEventWalkthroughs[localeKey as keyof typeof institutionalContinuityEventWalkthroughs] ??
    institutionalContinuityEventWalkthroughs['en-CA']
  );
  const localizedOperationalDisruptionModels = (
    operationalDisruptionModels[localeKey as keyof typeof operationalDisruptionModels] ??
    operationalDisruptionModels['en-CA']
  );
  const localizedOrganizationalStabilizationSimulationFlow = (
    organizationalStabilizationSimulationFlow[localeKey as keyof typeof organizationalStabilizationSimulationFlow] ??
    organizationalStabilizationSimulationFlow['en-CA']
  );
  const localizedOnboardingContinuityIntelligenceScenarios = (
    onboardingContinuityIntelligenceScenarios[localeKey as keyof typeof onboardingContinuityIntelligenceScenarios] ??
    onboardingContinuityIntelligenceScenarios['en-CA']
  );
  const localizedFederationScaleContinuityScenarios = (
    federationScaleContinuityScenarios[localeKey as keyof typeof federationScaleContinuityScenarios] ??
    federationScaleContinuityScenarios['en-CA']
  );
  const localizedCommitteeCoordinationSimulations = (
    committeeCoordinationSimulations[localeKey as keyof typeof committeeCoordinationSimulations] ??
    committeeCoordinationSimulations['en-CA']
  );
  const localizedInstitutionalMemoryDisruptionModels = (
    institutionalMemoryDisruptionModels[localeKey as keyof typeof institutionalMemoryDisruptionModels] ??
    institutionalMemoryDisruptionModels['en-CA']
  );
  const localizedExecutiveDecisionPathwaySystems = (
    executiveDecisionPathwaySystems[localeKey as keyof typeof executiveDecisionPathwaySystems] ??
    executiveDecisionPathwaySystems['en-CA']
  );
  const localizedMultiStakeholderGovernanceNarratives = (
    multiStakeholderGovernanceNarratives[localeKey as keyof typeof multiStakeholderGovernanceNarratives] ??
    multiStakeholderGovernanceNarratives['en-CA']
  );
  const localizedLongitudinalContinuityEvolutionStories = (
    longitudinalContinuityEvolutionStories[localeKey as keyof typeof longitudinalContinuityEvolutionStories] ??
    longitudinalContinuityEvolutionStories['en-CA']
  );

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeroSection
        imageUrl={heroImagery.governance}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            {copy.badge}
          </span>
        }
        heading={<>{copy.heroHeading}</>}
        description={copy.heroDescription}
        cta={
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href={withInstitutionalContext(`/${locale}/organizational-continuity-risk`, contextMode)} className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30">
              {copy.pilotCta}
            </Link>
            <Link href={withInstitutionalContext(`/${locale}/trust`, contextMode)} className="inline-flex items-center justify-center px-7 py-3.5 bg-white/90 text-navy font-semibold rounded-xl border border-white hover:bg-white transition-all">
              {copy.trustCta}
            </Link>
          </div>
        }
      />

      {(localeKey === 'en-CA' || localeKey === 'fr-CA') ? (
        (() => {
          const narratives = ANONYMIZED_PROOF_NARRATIVES[localeKey];
          return (
            <section aria-labelledby="anonymized-proof-narratives" className="border-b border-slate-200 bg-slate-50">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric">
                    {narratives.label}
                  </p>
                  <h2 id="anonymized-proof-narratives" className="mt-2 text-2xl sm:text-3xl font-semibold text-navy">
                    {narratives.title}
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-slate-700">{narratives.intro}</p>
                </div>
                <ol className="mt-8 grid gap-5 md:grid-cols-3">
                  {narratives.items.map((item, idx) => (
                    <li
                      key={item.archetype}
                      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                          {idx + 1}
                        </span>
                        <h3 className="text-sm font-semibold text-navy leading-snug">{item.archetype}</h3>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-700">{item.situation}</p>
                      <p className="text-sm leading-relaxed text-slate-700">
                        <span className="font-semibold text-navy">{localeKey === 'fr-CA' ? 'Reponse. ' : 'Response. '}</span>
                        {item.response}
                      </p>
                      <p className="text-sm leading-relaxed text-slate-700">
                        <span className="font-semibold text-navy">{localeKey === 'fr-CA' ? 'Observable. ' : 'Observable. '}</span>
                        {item.observable}
                      </p>
                    </li>
                  ))}
                </ol>
                <p className="mt-6 max-w-3xl text-xs italic leading-relaxed text-slate-500">
                  {narratives.disclaimer}
                </p>
              </div>
            </section>
          );
        })()
      ) : null}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Tabs defaultValue="overview" className="space-y-8">
          <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/95 backdrop-blur-sm">
            <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-5 gap-2 bg-transparent p-0 my-3">
              <TabsTrigger value="overview" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                {copy.tabOverview}
              </TabsTrigger>
              <TabsTrigger value="simulation" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                {copy.tabSimulation}
              </TabsTrigger>
              <TabsTrigger value="scenario" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                {copy.tabScenario}
              </TabsTrigger>
              <TabsTrigger value="continuity" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                {copy.tabContinuity}
              </TabsTrigger>
              <TabsTrigger value="procurement" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                {copy.tabProcurement}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-12">
            <section>              <h2 className="text-3xl font-bold text-navy mb-3">{copy.briefingTitle}</h2>
              <p className="text-gray-600 max-w-3xl mb-8">{copy.briefingIntro}</p>
              <div className="grid lg:grid-cols-2 gap-4">
                <article className="p-5 rounded-2xl bg-gray-50 border border-gray-100">
                  <h3 className="text-base font-bold text-navy mb-2">{copy.continuityOverviewTitle}</h3>
                  <p className="text-sm text-gray-600">{copy.continuityOverviewDesc}</p>
                </article>
                <article className="p-5 rounded-2xl bg-gray-50 border border-gray-100">
                  <h3 className="text-base font-bold text-navy mb-2">{copy.fragmentationVisibilityTitle}</h3>
                  <p className="text-sm text-gray-600">{copy.fragmentationVisibilityDesc}</p>
                </article>
                <article className="p-5 rounded-2xl bg-gray-50 border border-gray-100">
                  <h3 className="text-base font-bold text-navy mb-2">{copy.governanceAlignmentTitle}</h3>
                  <p className="text-sm text-gray-600">{copy.governanceAlignmentDesc}</p>
                </article>
                <article className="p-5 rounded-2xl bg-gray-50 border border-gray-100">
                  <h3 className="text-base font-bold text-navy mb-2">{copy.resilienceDirectionTitle}</h3>
                  <p className="text-sm text-gray-600">{copy.resilienceDirectionDesc}</p>
                </article>
              </div>
            </section>

            <section>              <h2 className="text-3xl font-bold text-navy mb-3">{copy.evidenceTitle}</h2>
              <p className="text-gray-600 max-w-3xl mb-8">{copy.evidenceDesc}</p>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {localizedEvidenceArchitecture.map((item, index) => {
                  const Icon = iconByTitle[evidenceArchitectureArr[index]?.title ?? ''] ?? FileText;
                  return (
                    <article key={item.title} className="p-5 rounded-2xl border border-gray-100 bg-gray-50">
                      <div className="w-10 h-10 rounded-xl bg-electric/10 flex items-center justify-center mb-4">
                        <Icon className="h-5 w-5 text-electric" />
                      </div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">{item.purpose}</p>
                      <h3 className="text-base font-bold text-navy mb-2">{item.title}</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{item.note}</p>
                    </article>
                  );
                })}
              </div>
            </section>

            <section>              <h2 className="text-3xl font-bold text-navy mb-3">{copy.walkthroughTitle}</h2>
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                {localizedGovernanceOperationalWalkthroughs.map((walkthrough) => (
                  <article key={walkthrough.type} className="p-5 rounded-2xl border border-gray-100 bg-white">
                    <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-2">{walkthrough.focus}</p>
                    <h3 className="text-base font-bold text-navy mb-2">{walkthrough.type}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{walkthrough.narrative}</p>
                  </article>
                ))}
              </div>
            </section>

            <section>              <h2 className="text-3xl font-bold text-navy mb-4">{copy.deploymentTitle}</h2>
              <div className="relative">
                <div className="hidden xl:block absolute top-7 left-10 right-10 h-px bg-electric/25" aria-hidden="true" />
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {localizedDeploymentWalkthrough.map((stage, index) => (
                    <article key={stage.stage} className="relative p-5 rounded-2xl border border-gray-100 bg-white shadow-sm">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-electric/10 text-electric text-xs font-bold">
                          {index + 1}
                        </span>
                        <p className="text-[11px] uppercase tracking-widest text-gray-400">{copy.phaseLabel}</p>
                      </div>
                      <h3 className="text-sm font-bold text-navy mb-3 leading-tight">{stage.stage}</h3>
                      <div className="space-y-2 text-sm text-gray-600">
                        <p><span className="font-semibold text-navy">{copy.safeguardLabel}: </span>{stage.safeguards}</p>
                        <p><span className="font-semibold text-navy">{copy.continuityLabel}: </span>{stage.continuity}</p>
                        <p><span className="font-semibold text-navy">{copy.visibilityLabel}: </span>{stage.visibility}</p>
                        <p><span className="font-semibold text-navy">{copy.stakeholdersLabel}: </span>{stage.stakeholders}</p>
                        <p><span className="font-semibold text-navy">{copy.checkpointLabel}: </span>{stage.checkpoint}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="simulation" className="space-y-12">
            <section>          <h2 className="text-3xl font-bold text-navy mb-3">{copy.pilotTitle}</h2>
          <div className="grid lg:grid-cols-2 gap-6">
            {localizedPilotSimulationArtifacts.map((artifact) => (
              <article key={artifact.title} className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
                <h3 className="text-lg font-bold text-navy mb-3">{artifact.title}</h3>
                <div className="space-y-4 text-sm text-gray-600">
                  <p><span className="font-semibold text-navy">{copy.continuityProfileLabel}: </span>{artifact.continuityProfile}</p>
                  <div>
                    <p className="font-semibold text-navy mb-1">{copy.fragmentationIndicatorsLabel}</p>
                    <ul className="space-y-1">
                      {artifact.fragmentationIndicators.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-navy mb-1">{copy.governanceConcernsLabel}</p>
                    <ul className="space-y-1">
                      {artifact.governanceConcerns.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-navy mb-1">{copy.rolloutScopeLabel}</p>
                    <ul className="space-y-1">
                      {artifact.rolloutScope.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-navy mb-1">{copy.stabilizationOutcomesLabel}</p>
                    <ul className="space-y-1">
                      {artifact.stabilizationOutcomes.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-navy mb-1">{copy.organizationalImprovementsLabel}</p>
                    <ul className="space-y-1">
                      {artifact.organizationalImprovements.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
            </section>

            <section>          <h2 className="text-3xl font-bold text-navy mb-3">{copy.operationalSimulationTitle}</h2>
          <div className="grid lg:grid-cols-2 gap-6">
            {localizedOperationalContinuitySimulationArtifacts.map((artifact) => (
              <article key={artifact.title} className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
                <h3 className="text-lg font-bold text-navy mb-3">{artifact.title}</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p><span className="font-semibold text-navy">{copy.continuityPostureLabel}: </span>{artifact.continuityPosture}</p>
                  <p><span className="font-semibold text-navy">{copy.governanceObservationLabel}: </span>{artifact.governanceMaturityObservation}</p>
                  <p><span className="font-semibold text-navy">{copy.fragmentationOperationalLabel}: </span>{artifact.fragmentationVisibility}</p>
                  <p><span className="font-semibold text-navy">{copy.memoryIndicatorLabel}: </span>{artifact.institutionalMemoryIndicator}</p>
                  <p><span className="font-semibold text-navy">{copy.rolloutGuidanceLabel}: </span>{artifact.rolloutGuidance}</p>
                  <p><span className="font-semibold text-navy">{copy.resilienceDirectionLabel}: </span>{artifact.resilienceDirection}</p>
                </div>
              </article>
            ))}
          </div>
            </section>

            <section>          <h2 className="text-3xl font-bold text-navy mb-3">{copy.scenarioTitle}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {localizedExecutiveScenarioModels.map((scenario) => (
              <article key={scenario.title} className="p-5 rounded-2xl border border-gray-100 bg-white">
                <h3 className="text-base font-bold text-navy mb-2">{scenario.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{scenario.summary}</p>
              </article>
            ))}
          </div>
            </section>
          </TabsContent>

          <TabsContent value="scenario" className="space-y-12">
            <section>              <h2 className="text-3xl font-bold text-navy mb-3">{copy.sectionTransitionPressure}</h2>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {localizedLeadershipTransitionContinuityScenarios.map((item) => (
                  <article key={item.scenario} className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">{item.focus}</p>
                    <h3 className="text-base font-bold text-navy mb-2">{item.scenario}</h3>
                    <p className="text-sm text-gray-600 mb-2">{item.livedSignal}</p>
                    <p className="text-sm text-navy"><span className="font-semibold">{copy.stabilizationMoveLabel}: </span>{item.stabilizationMove}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="grid lg:grid-cols-2 gap-8">
              <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
                <h3 className="text-xl font-bold text-navy mb-3">{copy.sectionFrictionFlows}</h3>
                <div className="space-y-3">
                  {localizedGovernanceFrictionSimulationFlows.map((item) => (
                    <article key={item.friction} className="p-4 rounded-xl border border-gray-100 bg-white">
                      <h4 className="text-sm font-bold text-navy mb-1">{item.friction}</h4>
                      <p className="text-sm text-gray-600 mb-1">{item.continuityImpact}</p>
                      <p className="text-xs text-gray-700"><span className="font-semibold">{copy.manageThroughLabel}: </span>{item.managementPath}</p>
                    </article>
                  ))}
                </div>
              </div>
              <div className="p-6 rounded-2xl bg-white border border-gray-100">
                <h3 className="text-xl font-bold text-navy mb-3">{copy.sectionEventWalkthroughs}</h3>
                <div className="space-y-3">
                  {localizedInstitutionalContinuityEventWalkthroughs.map((item) => (
                    <article key={item.event} className="p-4 rounded-xl border border-gray-100 bg-gray-50">
                      <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">{item.continuityFocus}</p>
                      <h4 className="text-sm font-bold text-navy mb-1">{item.event}</h4>
                      <p className="text-sm text-gray-600">{item.livedWalkthrough}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-bold text-navy mb-3">{copy.sectionContinuityStress}</h3>
                <div className="space-y-3">
                  {localizedOperationalDisruptionModels.map((item) => (
                    <article key={item.area} className="p-4 rounded-xl border border-gray-100 bg-white">
                      <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">{item.focus}</p>
                      <h4 className="text-sm font-bold text-navy mb-1">{item.area}</h4>
                      <p className="text-sm text-gray-600 mb-1">{item.signal}</p>
                      <p className="text-xs text-gray-700"><span className="font-semibold">{copy.stabilizeWithLabel}: </span>{item.mitigation}</p>
                    </article>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-navy mb-3">{copy.sectionOrgStabilization}</h3>
                <div className="p-5 rounded-2xl border border-gray-100 bg-gray-50">
                  <div className="grid sm:grid-cols-2 gap-2">
                    {localizedOrganizationalStabilizationSimulationFlow.map((stage, index) => (
                      <div key={stage} className="p-3 rounded border border-gray-100 bg-white text-sm font-semibold text-navy">
                        {index + 1}. {stage}
                      </div>
                    ))}
                  </div>
                </div>

                <h3 className="text-xl font-bold text-navy mt-6 mb-3">{copy.sectionOnboardingIntel}</h3>
                <div className="space-y-3">
                  {localizedOnboardingContinuityIntelligenceScenarios.map((item) => (
                    <article key={item.scenario} className="p-4 rounded-xl border border-gray-100 bg-white">
                      <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">{item.focus}</p>
                      <h4 className="text-sm font-bold text-navy mb-1">{item.scenario}</h4>
                      <p className="text-sm text-gray-600">{item.continuityGuide}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-bold text-navy mb-3">{copy.sectionFederationScale}</h3>
                <div className="space-y-3">
                  {localizedFederationScaleContinuityScenarios.map((item) => (
                    <article key={item.area} className="p-4 rounded-xl border border-gray-100 bg-white">
                      <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">{item.focus}</p>
                      <h4 className="text-sm font-bold text-navy mb-1">{item.area}</h4>
                      <p className="text-sm text-gray-600">{item.realism}</p>
                    </article>
                  ))}
                </div>

                <h3 className="text-xl font-bold text-navy mt-6 mb-3">{copy.sectionCommitteeCoord}</h3>
                <div className="space-y-3">
                  {localizedCommitteeCoordinationSimulations.map((item) => (
                    <article key={item.simulation} className="p-4 rounded-xl border border-gray-100 bg-gray-50">
                      <h4 className="text-sm font-bold text-navy mb-1">{item.simulation}</h4>
                      <p className="text-sm text-gray-600 mb-1">{item.coordinationSignal}</p>
                      <p className="text-xs text-gray-700"><span className="font-semibold">{copy.stabilizeWithLabel}: </span>{item.stabilizationApproach}</p>
                    </article>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-navy mb-3">{copy.sectionMemoryStress}</h3>
                <div className="space-y-3">
                  {localizedInstitutionalMemoryDisruptionModels.map((item) => (
                    <article key={item.area} className="p-4 rounded-xl border border-gray-100 bg-white">
                      <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">{item.focus}</p>
                      <h4 className="text-sm font-bold text-navy mb-1">{item.area}</h4>
                      <p className="text-sm text-gray-600">{item.awareness}</p>
                    </article>
                  ))}
                </div>

                <h3 className="text-xl font-bold text-navy mt-6 mb-3">{copy.sectionDecisionPathways}</h3>
                <div className="space-y-3">
                  {localizedExecutiveDecisionPathwaySystems.map((item) => (
                    <article key={item.decision} className="p-4 rounded-xl border border-gray-100 bg-gray-50">
                      <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">{item.continuityFocus}</p>
                      <h4 className="text-sm font-bold text-navy mb-1">{item.decision}</h4>
                      <p className="text-sm text-gray-600">{item.pathway}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid lg:grid-cols-2 gap-8">
              <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
                <h3 className="text-xl font-bold text-navy mb-3">{copy.sectionMultiStakeholder}</h3>
                <div className="space-y-3">
                  {localizedMultiStakeholderGovernanceNarratives.map((item) => (
                    <article key={item.stakeholders} className="p-4 rounded-xl border border-gray-100 bg-white">
                      <h4 className="text-sm font-bold text-navy mb-1">{item.stakeholders}</h4>
                      <p className="text-sm text-gray-600">{item.narrative}</p>
                    </article>
                  ))}
                </div>
              </div>
              <div className="p-6 rounded-2xl bg-white border border-gray-100">
                <h3 className="text-xl font-bold text-navy mb-3">{copy.sectionLongitudinal}</h3>
                <div className="space-y-3">
                  {localizedLongitudinalContinuityEvolutionStories.map((item) => (
                    <article key={item.stage} className="p-4 rounded-xl border border-gray-100 bg-gray-50">
                      <h4 className="text-sm font-bold text-navy mb-1">{item.stage}</h4>
                      <p className="text-sm text-gray-600">{item.storyline}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="continuity" className="space-y-12">
            <section className="grid lg:grid-cols-2 gap-8">
          <div>            <h2 className="text-2xl font-bold text-navy mb-3">{copy.beforeAfterTitle}</h2>
            <div className="space-y-2">
              {localizedInstitutionalBeforeAfterMap.map((item, index) => (
                <div key={item} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <span className="text-sm font-semibold text-navy">{item}</span>
                  <span className="text-xs text-gray-400">{copy.stepWord} {index + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <div>            <h2 className="text-2xl font-bold text-navy mb-3">{copy.maturityTitle}</h2>
            <div className="space-y-3">
              {localizedOrganizationalMaturitySnapshots.map((snapshot) => (
                <article key={snapshot.dimension} className="p-4 rounded-xl border border-gray-100 bg-white">
                  <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-1">{snapshot.focus}</p>
                  <h3 className="text-sm font-bold text-navy mb-1">{snapshot.dimension}</h3>
                  <p className="text-sm text-gray-600">{snapshot.snapshot}</p>
                </article>
              ))}
            </div>
          </div>
            </section>

            <section className="grid lg:grid-cols-2 gap-8">
          <div>            <h2 className="text-2xl font-bold text-navy mb-3">{copy.timelineTitle}</h2>
            <div className="space-y-3">
              {localizedDeploymentTimelines.map((timeline) => (
                <article key={timeline.title} className="p-4 rounded-xl border border-gray-100 bg-gray-50">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-navy mb-1">{timeline.title}</h3>
                      <p className="text-xs uppercase tracking-widest text-gray-400">{timeline.purpose}</p>
                    </div>
                    <Clock3 className="h-4 w-4 text-gray-300 shrink-0" />
                  </div>
                  <p className="text-sm text-gray-600 mt-2 leading-relaxed">{timeline.detail}</p>
                </article>
              ))}
            </div>

            <div className="mt-6 p-5 rounded-2xl bg-white border border-gray-100">
              <h3 className="text-sm font-bold text-navy mb-3">{copy.rolloutSimulationTitle}</h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {localizedInstitutionalRolloutSimulationFlow.map((stage, index) => (
                  <div key={stage} className="text-xs text-gray-700 p-2 rounded border border-gray-100 bg-gray-50">
                    {index + 1}. {stage}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>            <h2 className="text-2xl font-bold text-navy mb-3">{copy.briefingFlowsTitle}</h2>
            <div className="space-y-3 mb-6">
              {localizedExecutiveBriefingFlows.map((item) => (
                <article key={item} className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <GitBranch className="h-4 w-4 text-electric shrink-0" />
                  <span className="text-sm text-gray-700">{item}</span>
                </article>
              ))}
            </div>
            <div className="p-5 rounded-2xl bg-navy text-white mb-6">
              <h3 className="text-lg font-bold mb-3">{copy.riskNarrativesTitle}</h3>
              <div className="space-y-2 text-sm text-white/80">
                <p>{copy.riskNarrativeOne}</p>
                <p>{copy.riskNarrativeTwo}</p>
                <p>{copy.riskNarrativeThree}</p>
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-gray-100">
              <h3 className="text-sm font-bold text-navy mb-3">{copy.reviewLayersTitle}</h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {localizedGovernanceReviewSimulationLayers.map((layer) => (
                  <div key={layer} className="text-xs text-gray-700 p-2 rounded border border-gray-100 bg-gray-50">{layer}</div>
                ))}
              </div>
            </div>
          </div>
            </section>
          </TabsContent>

          <TabsContent value="procurement" className="space-y-12">
            <section className="grid lg:grid-cols-2 gap-8">
          <div className="p-6 rounded-2xl border border-gray-100 bg-gray-50">
            <h2 className="text-2xl font-bold text-navy mb-3">{copy.binderTitle}</h2>
            <p className="text-sm text-gray-600 mb-4">
              {copy.binderIntro}
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {localizedProcurementEvidenceBinder.map((item) => (
                <div key={item} className="text-sm text-gray-700 p-3 rounded bg-white border border-gray-100">{item}</div>
              ))}
            </div>
          </div>
          <div className="p-6 rounded-2xl border border-gray-100 bg-white">
            <h2 className="text-2xl font-bold text-navy mb-3">{copy.dashboardTitle}</h2>
            <div className="space-y-3">
              {localizedExecutiveDashboardSignals.map((signal) => (
                <article key={signal.title} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <h3 className="text-sm font-bold text-navy mb-1">{signal.title}</h3>
                  <p className="text-sm text-gray-600">{signal.description}</p>
                </article>
              ))}
            </div>
          </div>
            </section>

            <section className="bg-gray-50 border border-gray-100 rounded-3xl p-8 md:p-10">
              <div className="max-w-3xl">                <h2 className="text-3xl font-bold text-navy mb-3">{copy.proofPackTitle}</h2>
                <p className="text-gray-600 leading-relaxed mb-6">
                  {copy.proofPackDesc}
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href={`/${locale}/organizational-continuity-risk`} className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-electric text-white font-semibold rounded-xl hover:bg-blue-700 transition-all">
                    {copy.pilotCta} <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href={`/${locale}/trust`} className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-navy font-semibold rounded-xl border border-gray-200 hover:border-gray-300 transition-all">
                    {copy.trustCta} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <p className="mt-5 text-sm text-slate-600">
                  <Link
                    href={`/${locale}/whitepaper`}
                    className="inline-flex items-center gap-1 text-electric underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-electric rounded"
                  >
                    {locale === 'fr-CA'
                      ? 'Lire le livre blanc UnionEyes (~25 min)'
                      : 'Read the UnionEyes whitepaper (~25 min read)'}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </p>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
