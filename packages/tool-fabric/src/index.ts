/**
 * @nzila/tool-fabric — barrel exports
 *
 * Test fixtures live in ./testing and are intentionally not exported here.
 */
export * from './types'
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
export {
  NullGovernanceDecisionVerifier,
  GovernanceVerificationError,
  verifyGovernanceDecision,
  isVerifiedGovernanceDecision,
} from './governance'
export type { GovernanceDecisionVerifier, VerifiedGovernanceDecision } from './governance'
export { ToolPolicy, DEFAULT_MAX_AUTHORITY_AGE_MS } from './policy'
export type { ToolPolicyOptions, ExecutionPolicyContext, InstallPolicyContext } from './policy'
export { ToolTrustLedger, LedgerIntegrityError, TOOL_TRUST_LEDGER_ORG } from './ledger'
export type { DecideArgs, ReaffirmArgs } from './ledger'
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
