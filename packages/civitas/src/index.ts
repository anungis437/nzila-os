export {
  ADVISORY_ACTS,
  CIVITAS_FOUNDATION_PHASE,
  CIVITAS_IDENTITY,
  CIVITAS_PHASE,
  DEFAULT_JURISDICTION,
  FORBIDDEN_EXECUTION,
  exerciseAuthorities,
  exerciseAuthority,
} from './identity'
export type { AdvisoryAct, AuthorityExercise, ForbiddenExecution } from './identity'

export { DOCTRINE_RULES, FIRST_PRINCIPLE, GOVERNING_MAXIM, isCanonicalDoctrine, listDoctrine } from './doctrine'
export type { DoctrineRule, DoctrineRuleId } from './doctrine'

export {
  BLACK_MECHANISM_IDS,
  FAULTY_DOCTRINES,
  KNOWN_PSEUDOLAW_INDICATORS,
  MECHANISM_DISPOSITIONS,
  evaluateMechanism,
  findFaultyDoctrine,
  indicatorAbsenceIsLawfulEvidence,
  indicatorsAreExhaustive,
  proposeDoctrine,
  rejectFaultyDoctrine,
  rejectProhibitedMechanism,
} from './pseudolaw'
export type {
  DoctrineProposal,
  DoctrineRecognition,
  DoctrineRejection,
  MechanismDisposition,
  MechanismEvaluation,
  ProhibitedMechanismId,
} from './pseudolaw'

export { EVIDENCE_TIER_RULES, supportForProposition } from './evidence'
export type {
  CivitasEvidence,
  Currentness,
  EpistemicLabel,
  EvidenceTier,
  PropositionSupport,
  TemporalValidity,
} from './evidence'

export {
  AMBER_MATTERS,
  AUTONOMY_BENEFIT_DIMENSIONS,
  EXPOSURE_DIMENSIONS,
  GREEN_MATTERS,
  PROFESSIONAL_GATE_FOR_RED,
  PROFESSIONAL_ROLES,
  RED_MATTERS,
  SCORING_STATUS,
  classifyMatter,
  scoreCannotOverrideProhibition,
} from './decisions'
export type {
  AmberMatter,
  ClassAssessment,
  DecisionClass,
  GreenMatter,
  MatterKind,
  ProfessionalRole,
  RedMatter,
} from './decisions'

export { analyze } from './analysis'
export type { AdvisoryDecisionProjection, AnalysisInput, AnalysisResult, ControlEffects } from './analysis'

export {
  FLEET_INTERACTION,
  PEER_ROLES,
  grantPeerPermission,
  suppressRedTeamChallenge,
  treatScoutDiscovery,
} from './interaction'
export type { PeerGrantRefusal, PeerObligation, PeerRole, ScoutAcceptance } from './interaction'

export { FUTURE_DOMAIN_CONCEPTS, LEVEL_8_TARGET } from './concepts'
export type { ConceptPhase, FutureConcept } from './concepts'

export { PERSONAL_DATA_CONTROLS, PERSONAL_DATA_GATE, personalDataWorkAllowed } from './security'
export type { ControlEvaluation, PersonalDataControl } from './security'

export {
  CIVITAS_TIER_MAPPING,
  CREDENTIAL_REFERENCE_FIELDS,
  PHASE_3_ENTRY_CONDITIONS,
  PHASE_3_STATUS,
  PLATFORM_DATA_TIERS,
  PRIVACY_READINESS,
  PRIVACY_READINESS_DISPOSITION,
  REDTEAM_FINDINGS,
  SECRET_MATERIAL_KINDS,
  SYNTHETIC_GRAPH_PREVIEW,
  acceptCredentialRecord,
  acceptEvidencePayload,
  authorizeAgentPersonalAccess,
  authorizeFamilyRead,
  civitasLogMeta,
  grantIncapacityAccess,
  personalDataMayEnterModelContext,
  phase3Open,
  readCivitasPersonalData,
  syntheticPrincipalRead,
} from './privacy-readiness'
export type { AgentAccessDecision, PlatformDataTier, SecretMaterialKind, SyntheticReadDecision } from './privacy-readiness'

export { FLEET_ARCHITECTURE_DEBT } from './fleet-debt'

export {
  AUTHORITY_RELATIONS,
  AUTHORITY_WEIGHTS,
  CLAIM_STATES,
  IMPLEMENTED_JURISDICTION_CODES,
  JURISDICTION_CEILING,
  LEGAL_AUTHORITY_GRAPH,
  LEGAL_SOURCE_CLASSES,
  LEGAL_STATUSES,
  STARE_DECISIS_CEILING,
  assessBinding,
  assessProposition,
  assessTemporal,
  defineLegalSource,
  jurisdictionImplemented,
  recordCurrentness,
  recordLegalStatus,
  separateRuleFromFacts,
  surfaceConflict,
  tierForSourceClass,
} from './legal-authority'
export type {
  AuthorityConflict,
  AuthorityRelation,
  AuthorityRelationLink,
  AuthorityWeight,
  BindingAssessment,
  ClaimState,
  CurrentnessContract,
  FactualPredicate,
  ImplementedJurisdiction,
  LegalAuthoritySource,
  LegalProposition,
  LegalSourceClass,
  LegalStatus,
  PropositionAssessment,
  SourceTemporal,
  StatusAssertion,
  TemporalAssessment,
} from './legal-authority'

export {
  INSTRUCTION_TRUST_PRIMITIVE,
  decisionAuthorityGrantsCivitasExecution,
  readSourceAsEvidence,
  sourceGrantsExecution,
  sourceTextControlEffect,
} from './source-boundary'
export type { SourceControlEffect, SourceTextEnvelope } from './source-boundary'
