/**
 * @nzila/tool-fabric — domain types
 *
 * Provider-neutral vocabulary for the Agent Tool Fabric. Nothing here is
 * specific to CLI-Anything or CLI-Hub; those appear only as provider
 * descriptors in ./providers.ts.
 */

export const TOOL_SOURCE_CLASSES = [
  'NZILA_INTERNAL',
  'VENDORED_APPROVED',
  'REGISTRY_LISTED',
  'GENERATED_HARNESS',
  'SYSTEM_BINARY',
  'EXTERNAL_UNREVIEWED',
] as const
export type ToolSourceClass = (typeof TOOL_SOURCE_CLASSES)[number]

export const TOOL_TRUST_STATUSES = [
  'DISCOVERED',
  'EVALUATING',
  'APPROVED',
  'RESTRICTED',
  'REJECTED',
  'REVOKED',
] as const
export type ToolTrustStatus = (typeof TOOL_TRUST_STATUSES)[number]

export const TOOL_SIDE_EFFECTS = [
  'FILESYSTEM_READ',
  'FILESYSTEM_WRITE',
  'SUBPROCESS_EXECUTION',
  'NETWORK_ACCESS',
  'CREDENTIAL_ACCESS',
  'DATABASE_ACCESS',
  'BROWSER_CONTROL',
  'GUI_CONTROL',
  'EXTERNAL_PUBLICATION',
  'DESTRUCTIVE_OPERATION',
] as const
export type ToolSideEffect = (typeof TOOL_SIDE_EFFECTS)[number]

/** Side effects that always require an explicit per-request approval. */
export const HIGH_RISK_SIDE_EFFECTS: readonly ToolSideEffect[] = [
  'CREDENTIAL_ACCESS',
  'EXTERNAL_PUBLICATION',
  'DESTRUCTIVE_OPERATION',
]

export interface ToolIdentity {
  /** Canonical, provider-qualified name, e.g. "cli-hub/gimp". */
  readonly name: string
  /** Exact version. Ranges, "latest" and branch names are not versions. */
  readonly version: string
  readonly providerId: string
  readonly sourceRepository?: string
  /** Package coordinates, e.g. "pypi:cli-anything-gimp==1.0.0". */
  readonly packageCoordinates?: string
  readonly license?: string
  /** Content digest, "sha256:<64 hex>". Required for approval. */
  readonly digest?: string
}

export interface ToolCommandDescriptor {
  readonly name: string
  readonly sideEffects: readonly ToolSideEffect[]
  readonly supportsJsonOutput: boolean
}

export interface ToolProvenance {
  readonly discoveredVia: string
  readonly discoveredAt: string
  /** Upstream reference as observed at discovery, e.g. a git ref or registry date. */
  readonly upstreamRef?: string
  /** True when the install coordinates resolve to a mutable ref (branch, unpinned). */
  readonly mutableUpstream: boolean
  readonly notes?: readonly string[]
}

/**
 * Descriptor of a tool as *observed*. Carries no trust or authority: every
 * field is a claim made by a source and must be treated as untrusted data.
 */
export interface ToolDescriptor {
  readonly identity: ToolIdentity
  readonly sourceClass: ToolSourceClass
  readonly displayName?: string
  /** Claimed capability identifiers. Advisory only; never a grant. */
  readonly claimedCapabilities: readonly string[]
  readonly commands: readonly ToolCommandDescriptor[]
  readonly declaredSideEffects: readonly ToolSideEffect[]
  readonly provenance: ToolProvenance
}

export type ToolKey = string

export function toolKey(identity: Pick<ToolIdentity, 'name' | 'version'>): ToolKey {
  return `${identity.name}@${identity.version}`
}

export interface PrincipalRef {
  readonly kind: 'HUMAN_REVIEWER' | 'GOVERNANCE_BODY'
  readonly id: string
}

/** Scoped authority granted by a trust decision. The only source of grants. */
export interface ToolGrant {
  readonly allowedAgents: readonly string[]
  readonly allowedCapabilities: readonly string[]
  readonly allowedCommands: readonly string[]
  readonly allowedSideEffects: readonly ToolSideEffect[]
  readonly allowNetwork: boolean
  readonly allowedSecretRefs: readonly string[]
  readonly maxTimeoutMs: number
}

// ── Evidence ────────────────────────────────────────────────────────────────

export const TOOL_EVIDENCE_KINDS = [
  'SOURCE_REPOSITORY',
  'LICENSE',
  'PACKAGE_METADATA',
  'DIGEST_VERIFICATION',
  'DEPENDENCY_INSPECTION',
  'CODE_REVIEW',
  'SECURITY_REVIEW',
  'CAPABILITY_REVIEW',
  'GENERATED_HARNESS_VALIDATION',
  'TEST_REPORT',
  'PROVENANCE',
] as const
export type ToolEvidenceKind = (typeof TOOL_EVIDENCE_KINDS)[number]

/**
 * NZILA_VERIFIED evidence only counts when the verified governance decision
 * itself attests the reference (see GovernanceDecisionSnapshot.evidenceRefs).
 * EXTERNAL_UNTRUSTED marks material taken from READMEs, SKILL.md, registries
 * or tool output; it is retained for review but never satisfies a requirement.
 */
export type ToolEvidenceTrustClass = 'NZILA_VERIFIED' | 'EXTERNAL_UNTRUSTED'

export interface ToolEvidenceRef {
  readonly kind: ToolEvidenceKind
  readonly ref: string
  readonly trustClass: ToolEvidenceTrustClass
  readonly sha256?: string
  readonly capturedAt: string
}

// ── Governance decision binding ─────────────────────────────────────────────

export const GOVERNANCE_DECISION_KINDS = [
  'TOOL_TRUST',
  'TOOL_REVOCATION',
  'TOOL_EXECUTION_APPROVAL',
  'TOOL_INSTALL',
] as const
export type GovernanceDecisionKind = (typeof GOVERNANCE_DECISION_KINDS)[number]

export const GOVERNANCE_DECISION_OUTCOMES = ['EVALUATE', 'APPROVE', 'RESTRICT', 'REJECT', 'REVOKE'] as const
export type GovernanceDecisionOutcome = (typeof GOVERNANCE_DECISION_OUTCOMES)[number]

/**
 * What an authoritative governance system reports about a decision. Produced
 * only by a GovernanceDecisionVerifier; Tool Fabric never accepts caller
 * claims such as "decidedBy: some-human".
 */
export interface GovernanceDecisionSnapshot {
  readonly decisionRef: string
  readonly kind: GovernanceDecisionKind
  /** Tool key the decision applies to. */
  readonly subject: string
  /** Artifact digest the decision is bound to (required for approvals/installs). */
  readonly subjectDigest: string | null
  readonly outcome: GovernanceDecisionOutcome
  /** Role (never a person identifier) the authoritative system confirmed. */
  readonly decidedByRole: string
  /** Why that role was entitled to decide (policy / delegation reference). */
  readonly authorityBasis: string
  /** Evidence references the decision attests. */
  readonly evidenceRefs: readonly string[]
  /** Identifier of the verifier / backing system that vouched for this snapshot. */
  readonly source: string
  readonly verifiedAt: string
  readonly status: 'ACTIVE' | 'REVOKED' | 'SUPERSEDED'
  /** Execution approvals only: hash of the single intent this approval covers. */
  readonly boundIntentHash?: string
  readonly validUntil?: string
}

export interface ToolTrustDecision {
  readonly toolKey: ToolKey
  readonly from: ToolTrustStatus
  readonly to: ToolTrustStatus
  readonly governance: GovernanceDecisionSnapshot
  readonly rationale: string
  readonly decidedAt: string
  readonly grant?: ToolGrant
  readonly evidence: readonly ToolEvidenceRef[]
}

// ── Drift ───────────────────────────────────────────────────────────────────

export const DRIFT_KINDS = [
  'UNCHANGED',
  'METADATA_CHANGED',
  'DIGEST_CHANGED',
  'SIDE_EFFECTS_WIDENED',
  'SOURCE_BECAME_MUTABLE',
  'VERSION_MISSING',
  'PROVENANCE_UNVERIFIABLE',
] as const
export type DriftKind = (typeof DRIFT_KINDS)[number]

export interface DriftFinding {
  readonly kind: DriftKind
  /** Material drift suspends execution eligibility pending a new trust decision. */
  readonly material: boolean
  readonly changedFields: readonly string[]
}

export interface ToolSuspension {
  readonly kind: DriftKind
  readonly since: string
  readonly changedFields: readonly string[]
}

export interface ToolRecord {
  readonly descriptor: ToolDescriptor
  readonly status: ToolTrustStatus
  readonly grant: ToolGrant | null
  /** Append-only: never rewritten, only extended. */
  readonly decisions: readonly ToolTrustDecision[]
  readonly suspension: ToolSuspension | null
  readonly driftHistory: readonly (DriftFinding & { readonly observedAt: string })[]
  /** Previously approved descriptors, retained as historic evidence. */
  readonly descriptorHistory: readonly ToolDescriptor[]
}

/**
 * Resolved (trusted) agent authority. This is an INTERNAL representation: it
 * is only ever produced by resolveAgentAuthority() from a trusted resolver
 * and is never accepted from a request. See ./authority.ts.
 */
export interface ResolvedAgentAuthority {
  readonly agentId: string
  readonly capabilities: readonly string[]
  readonly source: string
  readonly authorityRef: string
  readonly resolvedAt: string
}

export type NetworkPolicy = 'NONE' | 'ALLOWLIST'

export interface EnvPolicy {
  /** Explicit allowlist. There is no inherit-all option. */
  readonly allow: Readonly<Record<string, string>>
}

export interface ToolInstallRequest {
  readonly requestedBy: { readonly kind: 'AGENT' | 'GOVERNED_INSTALLER'; readonly id: string }
  readonly toolKey: ToolKey
  readonly digest: string | undefined
  readonly packageCoordinates: string | undefined
  readonly isolatedEnvironment: boolean
  readonly licenseAccepted: boolean
  readonly dependencyInspectionRef: string | undefined
  readonly auditCorrelationId: string
}

export interface PolicyDecision {
  readonly allowed: boolean
  readonly reasons: readonly string[]
  readonly auditCorrelationId: string
  /** Directives the broker MUST apply. Populated only when allowed. */
  readonly brokerDirectives: {
    readonly forcedEnv: Readonly<Record<string, string>>
    readonly network: NetworkPolicy
  } | null
}
