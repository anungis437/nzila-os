/**
 * @nzila/tool-fabric — barrel exports
 *
 * Test fixtures live in ./testing and are intentionally not exported here.
 */
export * from './types'
export { TOOL_FABRIC_AUTHORIZATION, DenyApprovalLeaseStore } from './broker-boundary'
export type { ApprovalConsumption, ApprovalLeaseStore } from './broker-boundary'
export {
  CLI_HUB_PROVIDER,
  CLI_ANYTHING_GENERATOR_PROVIDER,
  ToolProviderRegistry,
  isMutableInstall,
  normalizeCliHubEntry,
} from './providers'
export type { ToolProviderDescriptor, CliHubRegistryEntry } from './providers'
export { ToolRegistry, toolDescriptorSchema, toolEvidenceRefSchema } from './registry'
export type {
  TrustDecisionInput,
  ReaffirmInput,
  CapabilityPlan,
  DiscoveryCandidate,
} from './registry'
export { classifyDrift } from './drift'
export {
  NullAgentAuthorityResolver,
  AuthorityResolutionError,
  resolveAgentAuthority,
  isResolvedAgentAuthority,
  toolExecutionIntentSchema,
  hashIntent,
} from './authority'
export type { AgentAuthorityResolver, AgentAuthorityRecord, ToolExecutionIntent } from './authority'
export { authenticateInvocation, DenyInvocationAuthenticator, isAuthenticatedInvocation } from './invocation'
export type { InvocationAuthenticator, InvocationRecord, AuthenticatedInvocation } from './invocation'
export {
  NullGovernanceDecisionVerifier,
  GovernanceVerificationError,
  verifyGovernanceDecision,
  isVerifiedGovernanceDecision,
} from './governance'
export type { GovernanceDecisionVerifier, VerifiedGovernanceDecision } from './governance'
export { ToolPolicy, DEFAULT_MAX_AUTHORITY_AGE_MS } from './policy'
export type { ToolPolicyOptions, ExecutionPolicyContext, InstallPolicyContext } from './policy'
export {
  ToolTrustLedger,
  LedgerIntegrityError,
  LedgerMutationAuthorizationError,
  TOOL_TRUST_LEDGER_ORG,
} from './ledger'
export type {
  DecideArgs,
  ReaffirmArgs,
  LedgerOptions,
  LedgerMutationOperation,
  LedgerMutationActor,
  LedgerMutationAuthority,
} from './ledger'
export {
  DenyOnlyAtomicTrustLedgerStore,
  LedgerStoreUnavailableError,
  LedgerConflictError,
  LedgerDuplicateError,
} from './ledger-store'
export type { AtomicTrustLedgerStore, LedgerHead, LedgerSnapshot, TrustLedgerHeadWitness } from './ledger-store'
export { PostgresAtomicTrustLedgerStore, TOOL_FABRIC_PG_STREAM } from './postgres-ledger-store'
export type { PostgresTrustQuery, PostgresTrustConnection } from './postgres-ledger-store'
export { AuditEngineToolAuditSink, TOOL_AUDIT_ORG, scrubReason } from './audit'
export type { ToolAuditEvent, ToolAuditSink } from './audit'
export { GovernedToolGate } from './gate'
export type { GovernedToolGateDeps, GateDecision } from './gate'
export { parseSkillDocument, requiresHumanReview, MAX_SKILL_BYTES } from './skill'
export type { SkillDescriptor, SkillFlag, SkillFlagCode } from './skill'
export {
  HarnessLifecycle,
  harnessGenerationRequestSchema,
  HARNESS_REVIEW_GATES,
  HARNESS_STATES,
} from './harness'
export type { HarnessGenerationRequest, HarnessLifecycleRecord, HarnessReviewGate, HarnessState } from './harness'
