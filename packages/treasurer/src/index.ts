export {
  ANALYSIS_STATES,
  CONFIDENCE_CEILING_BPS,
  EPISTEMIC_CLASSES,
  FLEET_PEERS,
  IMPOSSIBLE_RETURN_ABS_BPS,
  LIFECYCLE_STAGES,
  PERMITTED_AUTHORITIES,
  PRICE_MAX_AGE_DAYS,
  PROHIBITED_AUTHORITIES,
  REFUSAL_CODES,
  TREASURER_IDENTITY,
  addDays,
  assertNotConflated,
  assertPerformanceClaim,
  assertSafeInt,
  canonicalJson,
  deriveEpistemicClass,
  fail,
  hasAuthority,
  isProhibited,
  isStale,
  makeClaim,
  mulDivRound,
  ok,
  parseIsoDate,
  rationalToBps,
  scanInjection,
  sha256,
} from './kernel'
export type {
  AnalysisState,
  Claim,
  EpistemicClass,
  FleetPeer,
  LifecycleStage,
  PermittedAuthority,
  ProhibitedAuthority,
  Refusal,
  RefusalCode,
  Result,
  Success,
} from './kernel'

export * from './schemas'
export {
  assertCurrentMarketValue,
  buildEvidence,
  validateSnapshot,
  verifyEvidence,
} from './integrity'
export type { ValidatedSnapshot, WeightRow } from './integrity'
export {
  acceptScenarioForDecision,
  allocateMinor,
  applyScenario,
  benchmarkExcess,
  envelopeUnreleased,
  holdingPeriodReturnBps,
  maxDrawdownBps,
  opportunityCostBps,
} from './calculations'
export {
  createEnvelope,
  releaseEnvelope,
  treatEnvelopeAsAuthorization,
  treatEnvelopeAsCommitted,
} from './envelope'
export type { EnvelopeDraft } from './envelope'
export {
  ANALYSIS_INDEPENDENCE,
  advanceDecision,
  assumeAuthorization,
  benchmarkHash,
  changeRiskConstraints,
  committedCapitalMinor,
  markProposedTradeExecuted,
  mutateThesis,
  openIdea,
  recordExternalConfirmation,
  requestTransaction,
  reviseThesis,
  rewriteBenchmark,
  riskConstraintsHash,
  sealRiskConstraints,
  sealThesis,
  thesisHash,
} from './decision'
export type { AdvanceInput } from './decision'
export {
  capacityFromNorthstarAmbition,
  decideDreamShouldExist,
  reportToNorthstar,
} from './northstar'
export type { NorthstarCapitalReport } from './northstar'
export {
  BOUNDARY_STATEMENTS,
  assertPersonalDomain,
  bindAgentAsTreasurerProxy,
  dispatchCommand,
  ingestCorporateCapitalCatalog,
  ingestCorporateTreasurySignal,
  inheritPeerAuthority,
  isCorporateAgentKey,
  peerBoundaryReport,
} from './boundaries'
export {
  authorizationAttacks,
  authorityPosture,
  exercise,
  refuseReturnOnlyOptimization,
} from './authority'
export type { AuthorityPosture } from './authority'
export { treasurerAgent, refusedBuyStillUnauthorized } from './agent'
export type { TreasurerIntent, TreasurerRunResult } from './agent'
export { ACCEPTED_LIMITATIONS, RED_TEAM_ATTACKS, renderRedTeamReport, runRedTeam } from './red-team'
export type { AcceptedLimitation, RedTeamAttack } from './red-team'
export {
  DOCTRINE_MARKERS,
  certificationFromGates,
  evaluateGates,
  renderCertificationMarkdown,
  repoRootFromHere,
} from './verifier'
export type { CertificationRecord, GateResults } from './verifier'
