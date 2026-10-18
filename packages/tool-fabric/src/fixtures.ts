/**
 * Shared test fixtures (not a test file; not exported from the package).
 */
import {
  hashIntent,
  resolveAgentAuthority,
  verifyGovernanceDecision,
  type GovernanceDecisionSnapshot,
  type ResolvedAgentAuthority,
  type ToolDescriptor,
  type ToolEvidenceKind,
  type ToolEvidenceRef,
  type ToolExecutionIntent,
  type ToolGrant,
  type ToolRecord,
  type ToolRegistry,
  type VerifiedGovernanceDecision,
} from './index'
import { StaticAgentAuthorityResolver, StaticGovernanceDecisionVerifier } from './testing'
import { authenticateInvocation, type AuthenticatedInvocation } from './invocation'

export const NOW = '2026-10-16T00:00:00.000Z'
export const NOW_DATE = new Date(NOW)
export const DIGEST = `sha256:${'a'.repeat(64)}`
export const KEY = 'internal/imgtool@2.1.0'

export function pinned(overrides: Partial<ToolDescriptor> = {}): ToolDescriptor {
  return {
    identity: {
      name: 'internal/imgtool',
      version: '2.1.0',
      providerId: 'nzila-internal',
      license: 'Apache-2.0',
      digest: DIGEST,
      packageCoordinates: 'pypi:imgtool==2.1.0',
    },
    sourceClass: 'NZILA_INTERNAL',
    claimedCapabilities: ['image.convert'],
    commands: [{ name: 'imgtool', sideEffects: ['FILESYSTEM_READ', 'FILESYSTEM_WRITE'], supportsJsonOutput: true }],
    declaredSideEffects: ['FILESYSTEM_READ', 'FILESYSTEM_WRITE', 'NETWORK_ACCESS'],
    provenance: { discoveredVia: 'test', discoveredAt: NOW, mutableUpstream: false },
    ...overrides,
  }
}

export const grant: ToolGrant = {
  allowedAgents: ['agent-a'],
  allowedCapabilities: ['image.convert'],
  allowedCommands: ['imgtool'],
  allowedSideEffects: ['FILESYSTEM_READ', 'FILESYSTEM_WRITE'],
  allowNetwork: false,
  allowedSecretRefs: [],
  maxTimeoutMs: 60_000,
  allowedFilesystemRoots: ['/work/job1'],
  allowedEnv: {},
  resourceLimits: { cpuMs: 30_000, memoryBytes: 268_435_456, diskBytes: 10_485_760, outputBytes: 1_048_576, processes: 1 },
}

export const GENERATED_KINDS: readonly ToolEvidenceKind[] = [
  'CODE_REVIEW',
  'SECURITY_REVIEW',
  'CAPABILITY_REVIEW',
  'TEST_REPORT',
  'PROVENANCE',
]

export function evidence(kinds: readonly ToolEvidenceKind[], trustClass: ToolEvidenceRef['trustClass'] = 'NZILA_VERIFIED'): ToolEvidenceRef[] {
  return kinds.map((kind) => ({ kind, ref: `ev:${kind.toLowerCase()}`, trustClass, capturedAt: NOW, sha256: 'a'.repeat(64) }))
}

export const BASE_EVIDENCE: readonly ToolEvidenceKind[] = ['DIGEST_VERIFICATION', 'LICENSE', 'DEPENDENCY_INSPECTION']
export const evidenceRefsFor = (kinds: readonly ToolEvidenceKind[]) => kinds.map((k) => `ev:${k.toLowerCase()}`)

export function snapshot(over: Partial<GovernanceDecisionSnapshot> & Pick<GovernanceDecisionSnapshot, 'decisionRef'>): GovernanceDecisionSnapshot {
  return {
    kind: 'TOOL_TRUST',
    subject: KEY,
    subjectDigest: DIGEST,
    outcome: 'APPROVE',
    decidedByRole: 'platform-governance-board',
    authorityBasis: 'POLICY-TF-1',
    evidenceRefs: evidenceRefsFor([...BASE_EVIDENCE, ...GENERATED_KINDS]),
    source: 'test-verifier',
    verifiedAt: NOW,
    status: 'ACTIVE',
    organizationId: 'org-a',
    missionId: 'mission-a',
    actorId: 'approver-a',
    authorId: 'author-a',
    reviewerId: 'reviewer-a',
    ...over,
  }
}

export interface TestWorld {
  readonly resolver: StaticAgentAuthorityResolver
  readonly verifier: StaticGovernanceDecisionVerifier
}

export function world(): TestWorld {
  return {
    resolver: new StaticAgentAuthorityResolver([
      { ...authorityRecord, agentId: 'agent-a', capabilities: ['image.convert'], source: 'test-authority', authorityRef: 'AUTH-agent-a' },
      { ...authorityRecord, agentId: 'agent-b', capabilities: ['image.convert'], source: 'test-authority', authorityRef: 'AUTH-agent-b' },
    ]),
    verifier: new StaticGovernanceDecisionVerifier(),
  }
}

export async function authorityFor(
  agentId: string,
  capabilities: readonly string[],
  now: Date = NOW_DATE,
): Promise<ResolvedAgentAuthority> {
  const w = new StaticAgentAuthorityResolver([{ ...authorityRecord, agentId, capabilities, source: 'test-authority', authorityRef: `AUTH-${agentId}` }])
  return resolveAgentAuthority(w, agentId, now)
}

export async function verified(
  verifier: StaticGovernanceDecisionVerifier,
  over: Partial<GovernanceDecisionSnapshot> & Pick<GovernanceDecisionSnapshot, 'decisionRef'>,
): Promise<VerifiedGovernanceDecision> {
  verifier.add(snapshot(over))
  return verifyGovernanceDecision(verifier, over.decisionRef, NOW_DATE)
}

/** Walks DISCOVERED -> EVALUATING -> target using verified decisions. */
export async function approve(
  reg: ToolRegistry,
  key: string,
  to: 'APPROVED' | 'RESTRICTED' = 'APPROVED',
  g: ToolGrant = grant,
  opts: { evidenceKinds?: readonly ToolEvidenceKind[]; digest?: string | null } = {},
): Promise<ToolRecord> {
  const v = new StaticGovernanceDecisionVerifier()
  const kinds = opts.evidenceKinds ?? [...BASE_EVIDENCE, ...GENERATED_KINDS]
  const sub = { subject: key }
  const evaluating = await verified(v, { decisionRef: `GOV-E-${key}`, outcome: 'EVALUATE', ...sub })
  reg.decide({ toolKey: key, to: 'EVALUATING', governance: evaluating, rationale: 'start', decidedAt: NOW, evidence: [] })
  const decision = await verified(v, {
    decisionRef: `GOV-A-${key}`,
    outcome: to === 'APPROVED' ? 'APPROVE' : 'RESTRICT',
    subjectDigest: opts.digest === undefined ? DIGEST : opts.digest,
    evidenceRefs: evidenceRefsFor(kinds),
    ...sub,
  })
  return reg.decide({ toolKey: key, to, governance: decision, rationale: 'reviewed', decidedAt: NOW, evidence: evidence(kinds), grant: g })
}

export function intent(over: Partial<ToolExecutionIntent> = {}): ToolExecutionIntent {
  return {
    requestingAgentId: 'agent-a',
    organizationId: 'org-a',
    missionId: 'mission-a',
    invocationRef: 'invocation-a',
    authorityRef: 'AUTH-agent-a',
    artifactDigest: DIGEST,
    nonce: 'nonce_synthetic_0001',
    decisionVersion: 2,
    capability: 'image.convert',
    toolKey: KEY,
    command: 'imgtool',
    args: ['convert', 'in.png'],
    workingDirectory: '/work/job1',
    allowedFilesystemRoots: ['/work/job1'],
    network: 'NONE',
    networkDestinations: [],
    env: { allow: {} },
    secretRefs: [],
    timeoutMs: 30_000,
    resources: { cpuMs: 1000, memoryBytes: 67_108_864, diskBytes: 1_048_576, outputBytes: 65_536, processes: 1 },
    expectedOutputs: ['/work/job1/out.png'],
    sideEffects: ['FILESYSTEM_READ', 'FILESYSTEM_WRITE'],
    auditCorrelationId: 'corr-1',
    ...over,
  }
}

/** A verified per-request approval bound to exactly this intent. */
export async function approvalFor(i: ToolExecutionIntent, over: Partial<GovernanceDecisionSnapshot> = {}): Promise<VerifiedGovernanceDecision> {
  const v = new StaticGovernanceDecisionVerifier()
  return verified(v, {
    decisionRef: i.approvalRef ?? `GOV-X-${i.auditCorrelationId}`,
    kind: 'TOOL_EXECUTION_APPROVAL',
    decidedByRole: 'tool-execution-approver',
    actorId: i.requestingAgentId,
    approverId: 'execution-approver-a',
    organizationId: i.organizationId,
    missionId: i.missionId,
    nonce: i.nonce,
    decisionVersion: 2,
    validUntil: '2026-10-16T00:01:00.000Z',
    subject: i.toolKey,
    boundIntentHash: hashIntent(i),
    ...over,
  })
}

export const authorityRecord = {
  organizationId: 'org-a', missionId: 'mission-a', status: 'ACTIVE' as const,
  expiresAt: '2026-10-16T00:05:00.000Z', filesystemRoots: ['/work/job1'],
}

export async function invocationFor(over: Partial<{
  subject: string; organizationId: string; missionId: string; invocationRef: string
}> = {}): Promise<AuthenticatedInvocation> {
  return authenticateInvocation({
    async authenticate() {
      return {
        subject: 'agent-a', organizationId: 'org-a', missionId: 'mission-a',
        invocationRef: 'invocation-a', source: 'test-host', status: 'ACTIVE',
        issuedAt: NOW, expiresAt: '2026-10-16T00:05:00.000Z', roles: ['agent'],
        ...over,
      }
    },
  }, {}, NOW_DATE)
}
