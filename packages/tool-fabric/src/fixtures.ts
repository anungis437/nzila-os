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
}

export const GENERATED_KINDS: readonly ToolEvidenceKind[] = [
  'CODE_REVIEW',
  'SECURITY_REVIEW',
  'CAPABILITY_REVIEW',
  'TEST_REPORT',
  'PROVENANCE',
]

export function evidence(kinds: readonly ToolEvidenceKind[], trustClass: ToolEvidenceRef['trustClass'] = 'NZILA_VERIFIED'): ToolEvidenceRef[] {
  return kinds.map((kind) => ({ kind, ref: `ev:${kind.toLowerCase()}`, trustClass, capturedAt: NOW }))
}

export const BASE_EVIDENCE: readonly ToolEvidenceKind[] = ['DIGEST_VERIFICATION', 'LICENSE']
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
      { agentId: 'agent-a', capabilities: ['image.convert'], source: 'test-authority', authorityRef: 'AUTH-A' },
      { agentId: 'agent-b', capabilities: ['image.convert'], source: 'test-authority', authorityRef: 'AUTH-B' },
    ]),
    verifier: new StaticGovernanceDecisionVerifier(),
  }
}

export async function authorityFor(
  agentId: string,
  capabilities: readonly string[],
  now: Date = NOW_DATE,
): Promise<ResolvedAgentAuthority> {
  const w = new StaticAgentAuthorityResolver([{ agentId, capabilities, source: 'test-authority', authorityRef: `AUTH-${agentId}` }])
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
    capability: 'image.convert',
    toolKey: KEY,
    command: 'imgtool',
    args: ['convert', 'in.png'],
    workingDirectory: '/work/job1',
    allowedFilesystemRoots: ['/work/job1'],
    network: 'NONE',
    env: { allow: {} },
    secretRefs: [],
    timeoutMs: 30_000,
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
    decisionRef: `GOV-X-${i.auditCorrelationId}`,
    kind: 'TOOL_EXECUTION_APPROVAL',
    subject: i.toolKey,
    boundIntentHash: hashIntent(i),
    ...over,
  })
}
