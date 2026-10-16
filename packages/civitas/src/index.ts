export {
  ADVISORY_ACTS,
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
  findFaultyDoctrine,
  proposeDoctrine,
  rejectFaultyDoctrine,
} from './pseudolaw'
export type { DoctrineProposal, DoctrineRecognition, DoctrineRejection } from './pseudolaw'

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
