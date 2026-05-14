import type { PilotApplicationInput } from '@/types/marketing';

export const institutionalRolloutPathway = [
  'Assessment',
  'Continuity Review',
  'Governance Mapping',
  'Pilot Alignment',
  'Operational Adoption',
  'Institutional Stabilization',
  'Long-Term Resilience',
] as const;

export const governanceModernizationJourney = [
  {
    stage: 'Stage 1 - Fragmented Operations',
    detail:
      'Governance and operations are active but continuity context is distributed across teams and files.',
  },
  {
    stage: 'Stage 2 - Continuity Visibility',
    detail:
      'Institutional memory and continuity risk become visible in one reviewable operating view.',
  },
  {
    stage: 'Stage 3 - Governance Alignment',
    detail:
      'Governance reasoning, ownership boundaries, and operating pathways become consistently legible.',
  },
  {
    stage: 'Stage 4 - Explainable Coordination',
    detail:
      'Teams coordinate with transparent rationale and clear review pathways for modernization decisions.',
  },
  {
    stage: 'Stage 5 - Institutional Resilience',
    detail:
      'The institution sustains continuity through transitions without operational or governance destabilization.',
  },
] as const;

export const operationalMaturityPathway = [
  'Reactive',
  'Coordinated',
  'Explainable',
  'Continuity-Aware',
  'Institutionally Resilient',
] as const;

export const organizationalTransformationPathway = [
  'Operational Fragmentation',
  'Continuity Visibility',
  'Governance Alignment',
  'Organizational Coherence',
  'Institutional Resilience',
] as const;

export const evidenceArchitecture = [
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
    purpose: 'Institutional safety',
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
] as const;

export const deploymentWalkthrough = [
  {
    stage: 'Continuity Assessment',
    safeguards: 'Review scope, risks, and institutional memory exposure before activation.',
    continuity: 'Establishes the baseline that informs later rollout pacing.',
    visibility: 'Leadership sees where the organization is most exposed.',
    stakeholders: 'Executive sponsors, operations leads, and governance owners.',
    checkpoint: 'Confirm the assessment summary and evidence baseline.',
  },
  {
    stage: 'Governance Mapping',
    safeguards: 'Map review responsibilities, sign-off paths, and oversight boundaries.',
    continuity: 'Protects governance continuity during modernization decisions.',
    visibility: 'Shows who reviews what and when.',
    stakeholders: 'Governance teams, legal review, and procurement stakeholders.',
    checkpoint: 'Validate the review path before any pilot work begins.',
  },
  {
    stage: 'Pilot Alignment',
    safeguards: 'Scope the pilot tightly and define what is intentionally out of scope.',
    continuity: 'Prevents deployment creep from destabilizing the organization.',
    visibility: 'Creates a bounded operational view for the pilot team.',
    stakeholders: 'Pilot sponsors, implementation leads, and frontline operators.',
    checkpoint: 'Approve pilot boundaries and success indicators.',
  },
  {
    stage: 'Controlled Rollout',
    safeguards: 'Release in phases with review windows and stabilization support.',
    continuity: 'Reduces transition shock and preserves institutional discipline.',
    visibility: 'Tracks adoption through measurable implementation milestones.',
    stakeholders: 'Change leads, support teams, and governance observers.',
    checkpoint: 'Review the rollout log and readiness status after each step.',
  },
  {
    stage: 'Operational Stabilization',
    safeguards: 'Hold steady while teams settle into new operational routines.',
    continuity: 'Confirms the new operating pattern is durable enough to rely on.',
    visibility: 'Makes support demand and exception handling visible.',
    stakeholders: 'Operations, support, and executive oversight.',
    checkpoint: 'Validate support load, adoption consistency, and issue patterns.',
  },
  {
    stage: 'Institutional Resilience',
    safeguards: 'Document lessons, transfer ownership, and preserve continuity evidence.',
    continuity: 'Ensures the organization can absorb leadership or process changes safely.',
    visibility: 'Leaves a reviewable institutional record of what changed and why.',
    stakeholders: 'Executive sponsors and governance custodians.',
    checkpoint: 'Approve the resilience summary and archive the proof pack.',
  },
] as const;

export const pilotSimulationArtifacts = [
  {
    title: 'Mid-Sized Labour Organization Pilot',
    continuityProfile: 'Moderate continuity exposure with strong leadership sponsorship and a focused operational scope.',
    fragmentationIndicators: ['Spreadsheet-based case tracking', 'Distributed document storage', 'Manual follow-up across teams'],
    governanceConcerns: ['No shared review pathway', 'Informal ownership boundaries', 'Slow visibility into exceptions'],
    rolloutScope: ['Case intake and tracking', 'Governance review logging', 'Continuity summary reporting'],
    stabilizationOutcomes: ['Cleaner review cadence', 'Less operational duplication', 'More visible transition checkpoints'],
    organizationalImprovements: ['Better continuity handoff', 'Stronger governance visibility', 'Lower implementation friction'],
  },
  {
    title: 'Multi-Jurisdiction Pilot',
    continuityProfile: 'Higher coordination complexity with a need for phased rollout sequencing and stabilization windows.',
    fragmentationIndicators: ['Different local workflows', 'Inconsistent governance language', 'Multiple approval paths'],
    governanceConcerns: ['Cross-jurisdiction review alignment', 'Change pacing across teams', 'Consistency of implementation evidence'],
    rolloutScope: ['Single jurisdiction first', 'Governance mapping', 'Shared evidence and rollout logs'],
    stabilizationOutcomes: ['Reduced change shock', 'Clearer coordination across jurisdictions', 'Improved operating clarity'],
    organizationalImprovements: ['More coherent governance review', 'Predictable pilot pacing', 'Improved institutional memory capture'],
  },
] as const;

export const operationalContinuitySimulationArtifacts = [
  {
    title: 'Regional Labour Organization Continuity Review',
    continuityPosture: 'Continuity depends on a small group of experienced coordinators with limited transfer documentation.',
    governanceMaturityObservation: 'Governance review is active but unevenly documented across committees.',
    fragmentationVisibility: 'Intake, review, and follow-up pathways are split across multiple tools.',
    institutionalMemoryIndicator: 'High reliance on person-to-person handoffs during onboarding periods.',
    rolloutGuidance: 'Begin with governance review harmonization and continuity capture checkpoints.',
    resilienceDirection: 'Stabilize committee review cadence before expanding rollout scope.',
  },
  {
    title: 'Cross-Committee Continuity Stabilization Review',
    continuityPosture: 'Continuity posture is improving but remains vulnerable during leadership transitions.',
    governanceMaturityObservation: 'Approval paths exist yet require clearer rationale documentation.',
    fragmentationVisibility: 'Coordination gaps appear between policy, operations, and procurement review stages.',
    institutionalMemoryIndicator: 'Institutional context is partially captured with inconsistent archive discipline.',
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
    summary: 'Shows how review paths and ownership clarity reduce uncertainty when governance is spread across teams.',
  },
  {
    title: 'Onboarding Instability',
    summary: 'Shows how controlled rollout artifacts keep new teams aligned during the first weeks of adoption.',
  },
  {
    title: 'Institutional Memory Loss',
    summary: 'Shows how evidence packs preserve reasoning, precedents, and context that would otherwise disappear.',
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
    detail: 'Assessment, scoped activation, and stabilization checkpoints for the initial deployment window.',
  },
  {
    title: 'Governance rollout',
    purpose: 'Oversight sequencing',
    detail: 'Review path activation, ownership mapping, and approval rhythm across governance stakeholders.',
  },
  {
    title: 'Continuity adoption',
    purpose: 'Organizational stabilization',
    detail: 'Progressive adoption that protects continuity while teams adjust to new operating routines.',
  },
  {
    title: 'Institutional alignment',
    purpose: 'Change pacing',
    detail: 'The period where leadership, operations, and governance language converge around the new model.',
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
  'Institutional Alignment',
  'Long-Term Continuity',
] as const;

export const governanceOperationalWalkthroughs = [
  {
    type: 'Leadership transition',
    focus: 'Continuity preservation',
    narrative: 'Maintains institutional memory and governance continuity during executive or committee turnover.',
  },
  {
    type: 'Governance review',
    focus: 'Explainability',
    narrative: 'Shows how decisions remain traceable through review checkpoints and rationale pathways.',
  },
  {
    type: 'Committee coordination',
    focus: 'Operational coherence',
    narrative: 'Aligns committee roles and handoffs so operational decisions remain coordinated.',
  },
  {
    type: 'Onboarding stabilization',
    focus: 'Institutional memory',
    narrative: 'Preserves continuity context while new teams inherit active operating responsibilities.',
  },
  {
    type: 'Fragmentation reduction',
    focus: 'Alignment',
    narrative: 'Reduces siloed operations through shared governance language and review cadence.',
  },
  {
    type: 'Procurement review',
    focus: 'Governance trust',
    narrative: 'Supports due diligence with implementation safeguards, boundaries, and evidence commitments.',
  },
] as const;

export const institutionalBeforeAfterMap = [
  'Fragmented Governance',
  'Continuity Visibility',
  'Explainable Coordination',
  'Operational Alignment',
  'Institutional Stability',
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
    dimension: 'Institutional Memory',
    focus: 'Preservation',
    snapshot: 'Critical institutional context is increasingly captured beyond individual team members.',
  },
  {
    dimension: 'Trust',
    focus: 'Reviewability',
    snapshot: 'Evidence and safeguards are reviewable by leadership, governance, and procurement stakeholders.',
  },
] as const;

export const procurementEvidenceBinder = [
  'Implementation safeguards',
  'Governance oversight structures',
  'Explainability philosophy',
  'Rollout sequencing',
  'Operational boundaries',
  'Continuity protection principles',
  'Pilot governance safeguards',
  'Reviewability commitments',
] as const;

export const governanceReviewSimulationLayers = [
  'Review checkpoints',
  'Explainability pathways',
  'Approval layers',
  'Governance accountability',
  'Operational validation',
] as const;

export const executiveDashboardSignals = [
  {
    title: 'Continuity visibility',
    description: 'Shows where continuity context is concentrated and where transfer routines are active.',
  },
  {
    title: 'Governance coherence',
    description: 'Summarizes review cadence reliability and oversight pathway completeness.',
  },
  {
    title: 'Operational alignment',
    description: 'Tracks cross-team alignment through deployment stages and stabilization periods.',
  },
  {
    title: 'Institutional resilience',
    description: 'Highlights resilience direction under leadership transitions and operating pressure.',
  },
  {
    title: 'Fragmentation awareness',
    description: 'Surfaces silos, coordination risk, and onboarding fragility in narrative form.',
  },
] as const;

export const executiveBriefingFlows = [
  'Continuity risk summaries',
  'Governance resilience observations',
  'Fragmentation visibility',
  'Organizational coherence mapping',
  'Institutional readiness guidance',
] as const;

export const leadershipTransitionContinuityScenarios = [
  {
    scenario: 'Executive departure',
    focus: 'Institutional memory preservation',
    livedSignal:
      'Decision rationale and relationship context are often concentrated in a narrow leadership circle.',
    stabilizationMove:
      'Convert active decisions and precedent notes into shared continuity records before role transition.',
  },
  {
    scenario: 'Governance turnover',
    focus: 'Continuity stabilization',
    livedSignal:
      'Committee rhythm can slip when incoming members inherit implicit rather than documented review pathways.',
    stabilizationMove:
      'Run a short governance handoff cycle with explicit ownership and checkpoint cadence.',
  },
  {
    scenario: 'Committee restructuring',
    focus: 'Coordination continuity',
    livedSignal:
      'Coordination friction appears when responsibilities shift faster than cross-committee communication patterns.',
    stabilizationMove:
      'Re-map decision boundaries and maintain a shared operating language during transition windows.',
  },
  {
    scenario: 'Role concentration',
    focus: 'Knowledge dependency visibility',
    livedSignal:
      'Critical continuity context can depend on a small number of coordinators with limited transfer routines.',
    stabilizationMove:
      'Surface concentration points and schedule continuity transfer checkpoints before expansion phases.',
  },
  {
    scenario: 'Interim leadership',
    focus: 'Operational resilience',
    livedSignal:
      'Interim structures can keep operations moving but leave governance rationale fragmented if not recorded.',
    stabilizationMove:
      'Preserve interim decisions as explainable records and align them to long-term governance pathways.',
  },
] as const;

export const governanceFrictionSimulationFlows = [
  {
    friction: 'Committee misalignment',
    continuityImpact: 'Decision pacing becomes uneven across governance groups.',
    managementPath: 'Align review cadence and shared checkpoint definitions.',
  },
  {
    friction: 'Fragmented approvals',
    continuityImpact: 'Implementation slows because sign-off pathways are not synchronized.',
    managementPath: 'Consolidate approval windows and preserve explicit owner accountability.',
  },
  {
    friction: 'Duplicated governance pathways',
    continuityImpact: 'Teams repeat reviews with inconsistent rationale capture.',
    managementPath: 'Unify pathways around one review record and one evidence trail.',
  },
  {
    friction: 'Operational silo conflicts',
    continuityImpact: 'Cross-team handoffs lose context and increase stabilization effort.',
    managementPath: 'Use shared transition logs between operational and governance groups.',
  },
  {
    friction: 'Onboarding inconsistency',
    continuityImpact: 'New leaders inherit uneven continuity expectations.',
    managementPath: 'Standardize onboarding checkpoints tied to current continuity priorities.',
  },
  {
    friction: 'Continuity drift across leadership cycles',
    continuityImpact: 'Institutional priorities become less coherent over successive transitions.',
    managementPath: 'Anchor each cycle to prior rationale records and active resilience goals.',
  },
] as const;

export const institutionalContinuityEventWalkthroughs = [
  {
    event: 'Leadership change',
    continuityFocus: 'Institutional memory',
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
] as const;

export const operationalDisruptionModels = [
  {
    area: 'Knowledge concentration',
    focus: 'Dependency risk',
    signal: 'Critical continuity context is held by a limited set of institutional actors.',
    mitigation: 'Create transfer routines tied to active governance checkpoints.',
  },
  {
    area: 'Approval fragmentation',
    focus: 'Governance slowdown',
    signal: 'Parallel approval paths create pacing uncertainty and delayed execution.',
    mitigation: 'Converge review layers into explicit sequence maps.',
  },
  {
    area: 'Onboarding inconsistency',
    focus: 'Institutional drift',
    signal: 'Incoming leaders receive uneven continuity guidance across committees.',
    mitigation: 'Use one continuity briefing template and phased onboarding checkpoints.',
  },
  {
    area: 'Informal workflows',
    focus: 'Visibility loss',
    signal: 'Key decisions progress through channels that do not preserve rationale.',
    mitigation: 'Promote lightweight decision logs attached to formal review moments.',
  },
  {
    area: 'Committee silos',
    focus: 'Coordination breakdown',
    signal: 'Cross-functional dependencies are recognized late in the decision cycle.',
    mitigation: 'Introduce shared dependency visibility before approval milestones.',
  },
] as const;

export const organizationalStabilizationSimulationFlow = [
  'Fragmentation',
  'Visibility',
  'Alignment',
  'Coordination',
  'Continuity Stabilization',
  'Institutional Resilience',
] as const;

export const onboardingContinuityIntelligenceScenarios = [
  {
    scenario: 'New executive onboarding',
    focus: 'Institutional memory',
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
] as const;

export const federationScaleContinuityScenarios = [
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
    focus: 'Institutional stability',
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
] as const;

export const committeeCoordinationSimulations = [
  {
    simulation: 'Overlapping governance responsibilities',
    coordinationSignal: 'Ownership ambiguity appears at handoff boundaries.',
    stabilizationApproach: 'Clarify owner of record per decision stage.',
  },
  {
    simulation: 'Fragmented decision pathways',
    coordinationSignal: 'Pathways diverge by committee and slow synchronization.',
    stabilizationApproach: 'Introduce one shared pathway map for active initiatives.',
  },
  {
    simulation: 'Institutional memory fragmentation',
    coordinationSignal: 'Historic rationale is unevenly distributed among committees.',
    stabilizationApproach: 'Consolidate precedent references inside review briefings.',
  },
  {
    simulation: 'Cross-functional continuity drift',
    coordinationSignal: 'Operational and governance language diverge over time.',
    stabilizationApproach: 'Run periodic cross-functional alignment checkpoints.',
  },
  {
    simulation: 'Approval synchronization',
    coordinationSignal: 'Approvals arrive in inconsistent sequence under pressure.',
    stabilizationApproach: 'Sequence dependencies before opening final approval windows.',
  },
] as const;

export const institutionalMemoryDisruptionModels = [
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
      'Committees can drift from prior institutional commitments when rationale lineage is thin.',
  },
  {
    area: 'Historical continuity erosion',
    focus: 'Institutional instability',
    awareness:
      'Loss of historical context weakens confidence in modernization sequencing over time.',
  },
] as const;

export const executiveDecisionPathwaySystems = [
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
    continuityFocus: 'Institutional continuity',
    pathway:
      'Prioritize transfer routines where leadership turnover intersects active modernization work.',
  },
  {
    decision: 'Committee alignment',
    continuityFocus: 'Operational coherence',
    pathway:
      'Synchronize committee dependencies and shared timing before final approvals.',
  },
] as const;

export const multiStakeholderGovernanceNarratives = [
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
] as const;

export const longitudinalContinuityEvolutionStories = [
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
] as const;

export const clcBoothNarrativeSystem = [
  'Institutional Fragmentation',
  'Hidden Continuity Risk',
  'Governance Visibility',
  'Explainable Alignment',
  'Operational Trust',
  'Institutional Resilience',
] as const;

export const executiveEngagementChoreography = [
  {
    stakeholder: 'Executives',
    emotionalEntry: 'Continuity resilience',
    openingMove:
      'Frame the conversation around leadership transition safety and institutional memory continuity.',
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
    emotionalEntry: 'Institutional coherence',
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
    purpose: 'Low-pressure institutional exploration pathway.',
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
      'Institutional resilience',
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
      'UnionEyes does not score or monitor workers. Intelligence remains institutional, explainable, and human-governed.',
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
      'Maturity is demonstrated through proof packs, simulation artifacts, and governance review pathways.',
  },
  {
    concern: 'How is continuity measured?',
    handling: 'Directional continuity intelligence',
    response:
      'Continuity is measured directionally through resilience, coherence, onboarding stability, and memory transfer signals.',
  },
  {
    concern: 'How does this scale?',
    handling: 'Federation continuity architecture',
    response:
      'Scaling is managed through federation-aware governance pathways, shared frameworks, and regional alignment controls.',
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
  'Governance-safe modernization principles',
  'Pilot pathway summary',
  'Operational legitimacy highlights',
  'Institutional scenario intelligence examples',
  'Deployment philosophy',
  'Trust-center orientation',
] as const;

export const procurementFollowUpInfrastructure = [
  'Procurement-safe summary pages',
  'Deployment reassurance sequences',
  'Operational proof follow-ups',
  'Governance review pathways',
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
  'Institutional continuity',
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
  'Institutional Resilience',
] as const;

export const pilotFramework = {
  scopeDefinition: [
    'What is evaluated: continuity workflows, governance coordination, onboarding resilience, and explainability quality.',
    'What is not evaluated: worker behavior, workforce productivity, or individual performance analytics.',
    'Governance boundaries: human oversight remains mandatory and review pathways remain active throughout pilot operation.',
    'Operational expectations: phased adoption with documented checkpoints and stabilization windows.',
  ],
  safetyLayer: [
    'Explainability for all operational recommendations.',
    'Reviewability through governance checkpoints and audit-ready records.',
    'Human oversight retained for institutional decisions.',
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
    label: 'Institutional Memory',
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
      label: 'Institutional Memory Risk',
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
    profile.dimensions.find((dimension) => dimension.label === 'Institutional Memory Risk')?.summary ??
    'Institutional memory health should be reinforced through documented transfer routines.';

  const continuityRiskNarratives = [
    'Operational continuity appears influenced by concentrated institutional knowledge across a limited set of coordination pathways.',
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
      ? 'Leadership sponsorship and operating patterns suggest a strong governance alignment baseline.'
      : profile.level === 'Stabilizing'
        ? 'Governance alignment is present, with a need to maintain explicit review checkpoints during rollout.'
        : 'Governance alignment should be strengthened before broader deployment proceeds.';

  const institutionalResilienceDirection =
    profile.level === 'Operationally Mature'
      ? 'Proceed with phased adoption and preserve evidence packs as part of the operating record.'
      : 'Use a constrained pilot to deepen continuity discipline and capture implementation proof.';

  const rolloutRecommendation =
    profile.level === 'Foundational'
      ? 'Begin with continuity assessment and governance mapping before any broader activation.'
      : profile.level === 'Developing'
        ? 'Run a bounded pilot with explicit stabilization checkpoints.'
        : profile.level === 'Stabilizing'
          ? 'Proceed with controlled rollout and maintain executive review windows.'
          : 'Advance to institutional stabilization and preserve the proof trail for future transitions.';

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
