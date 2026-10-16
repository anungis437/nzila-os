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

export interface ToolTrustDecision {
  readonly toolKey: ToolKey
  readonly from: ToolTrustStatus
  readonly to: ToolTrustStatus
  readonly decidedBy: PrincipalRef
  /** Reference to the governance decision / review record. */
  readonly decisionRef: string
  readonly rationale: string
  readonly decidedAt: string
  readonly grant?: ToolGrant
  readonly evidence: readonly string[]
}

export interface ToolRecord {
  readonly descriptor: ToolDescriptor
  readonly status: ToolTrustStatus
  readonly grant: ToolGrant | null
  readonly decisions: readonly ToolTrustDecision[]
}

export interface AgentAuthority {
  readonly agentId: string
  /** Capabilities the platform has already authorised this agent to request. */
  readonly permittedCapabilities: readonly string[]
}

export type NetworkPolicy = 'NONE' | 'ALLOWLIST'

export interface EnvPolicy {
  /** Explicit allowlist. There is no inherit-all option. */
  readonly allow: Readonly<Record<string, string>>
}

export type ApprovalState = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'DENIED'

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

export interface ToolExecutionRequest {
  readonly requestedBy: AgentAuthority
  readonly capability: string
  readonly toolKey: ToolKey
  readonly command: string
  readonly args: readonly string[]
  readonly workingDirectory: string
  readonly allowedFilesystemRoots: readonly string[]
  readonly network: NetworkPolicy
  readonly env: EnvPolicy
  readonly secretRefs: readonly string[]
  readonly timeoutMs: number
  readonly expectedOutputs: readonly string[]
  readonly sideEffects: readonly ToolSideEffect[]
  readonly approvalState: ApprovalState
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
