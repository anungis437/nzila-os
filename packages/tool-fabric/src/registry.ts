/**
 * @nzila/tool-fabric — tool registry and trust state machine
 *
 * `decide()` and `reaffirm()` are the only paths that change trust state, and
 * both require a runtime-verified governance decision (see ./governance.ts):
 * caller-supplied "decidedBy" / "decisionRef" claims are not accepted.
 * Descriptors enter as DISCOVERED and cannot carry trust fields (strict
 * schema). History is append-only; historic descriptors and decisions are
 * retained, never rewritten.
 */
import { z } from 'zod'

import { classifyDrift } from './drift'
import { isVerifiedGovernanceDecision, type VerifiedGovernanceDecision } from './governance'
import { isResolvedAgentAuthority } from './authority'
import {
  TOOL_EVIDENCE_KINDS,
  TOOL_SIDE_EFFECTS,
  TOOL_SOURCE_CLASSES,
  toolKey,
  type DriftFinding,
  type GovernanceDecisionOutcome,
  type ResolvedAgentAuthority,
  type ToolDescriptor,
  type ToolEvidenceKind,
  type ToolEvidenceRef,
  type ToolGrant,
  type ToolKey,
  type ToolRecord,
  type ToolTrustDecision,
  type ToolTrustStatus,
} from './types'

const sideEffectSchema = z.enum(TOOL_SIDE_EFFECTS)
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9:._/@-]{0,159}$/)

export const toolDescriptorSchema: z.ZodType<ToolDescriptor> = z
  .object({
    identity: z
      .object({
        name: identifier,
        version: z.string().min(1).max(64),
        providerId: identifier,
        sourceRepository: z.string().max(512).optional(),
        packageCoordinates: z.string().max(512).optional(),
        license: z.string().max(128).optional(),
        digest: z.string().max(80).optional(),
      })
      .strict(),
    sourceClass: z.enum(TOOL_SOURCE_CLASSES),
    displayName: z.string().max(160).optional(),
    claimedCapabilities: z.array(identifier).max(32),
    commands: z.array(
      z
        .object({
          name: identifier,
          sideEffects: z.array(sideEffectSchema).max(10),
          supportsJsonOutput: z.boolean(),
        })
        .strict(),
    ).max(64),
    declaredSideEffects: z.array(sideEffectSchema).max(10),
    provenance: z
      .object({
        discoveredVia: identifier,
        discoveredAt: z.string().datetime(),
        upstreamRef: z.string().max(160).optional(),
        mutableUpstream: z.boolean(),
        notes: z.array(z.string().max(512)).max(16).optional(),
      })
      .strict(),
  })
  .strict()

export const toolEvidenceRefSchema: z.ZodType<ToolEvidenceRef> = z
  .object({
    kind: z.enum(TOOL_EVIDENCE_KINDS),
    ref: z.string().min(1),
    trustClass: z.enum(['NZILA_VERIFIED', 'EXTERNAL_UNTRUSTED']),
    sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
    capturedAt: z.string().min(1),
  })
  .strict()

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/
const EXACT_VERSION = /^\d+(?:\.\d+)*(?:[-+.][0-9A-Za-z.-]+)?$/

const TRANSITIONS: Readonly<Record<ToolTrustStatus, readonly ToolTrustStatus[]>> = {
  DISCOVERED: ['EVALUATING', 'REJECTED'],
  EVALUATING: ['APPROVED', 'RESTRICTED', 'REJECTED'],
  APPROVED: ['RESTRICTED', 'REVOKED'],
  RESTRICTED: ['APPROVED', 'REVOKED'],
  REJECTED: [],
  REVOKED: [],
}

const OUTCOME_FOR: Readonly<Record<ToolTrustStatus, GovernanceDecisionOutcome | null>> = {
  DISCOVERED: null,
  EVALUATING: 'EVALUATE',
  APPROVED: 'APPROVE',
  RESTRICTED: 'RESTRICT',
  REJECTED: 'REJECT',
  REVOKED: 'REVOKE',
}

const REQUIRED_APPROVAL_EVIDENCE: readonly ToolEvidenceKind[] = ['DIGEST_VERIFICATION', 'LICENSE', 'DEPENDENCY_INSPECTION']
const REQUIRED_GENERATED_EVIDENCE: readonly ToolEvidenceKind[] = [
  'CODE_REVIEW',
  'SECURITY_REVIEW',
  'CAPABILITY_REVIEW',
  'TEST_REPORT',
  'PROVENANCE',
]

function isLive(status: ToolTrustStatus): boolean {
  return status === 'APPROVED' || status === 'RESTRICTED'
}

function immutable<T>(value: T): T {
  const copy = structuredClone(value)
  const freeze = (item: unknown): void => {
    if (item === null || typeof item !== 'object') return
    for (const nested of Object.values(item)) freeze(nested)
    Object.freeze(item)
  }
  freeze(copy)
  return copy
}

export interface TrustDecisionInput {
  readonly toolKey: ToolKey
  readonly to: ToolTrustStatus
  readonly governance: VerifiedGovernanceDecision
  readonly rationale: string
  readonly decidedAt: string
  readonly evidence: readonly ToolEvidenceRef[]
  readonly grant?: ToolGrant
}

export interface ReaffirmInput {
  readonly toolKey: ToolKey
  /** The artifact now being approved; replaces the descriptor, old one is retained. */
  readonly observed: unknown
  readonly governance: VerifiedGovernanceDecision
  readonly rationale: string
  readonly decidedAt: string
  readonly evidence: readonly ToolEvidenceRef[]
  readonly grant: ToolGrant
}

export type CapabilityPlan =
  | { readonly path: 'A_APPROVED'; readonly tools: readonly ToolKey[] }
  | { readonly path: 'B_UNAPPROVED_CANDIDATE'; readonly candidates: readonly ToolKey[] }
  | { readonly path: 'C_NO_CANDIDATE'; readonly harnessGenerationMayBeRequested: true }

export interface DiscoveryCandidate {
  readonly toolKey: ToolKey
  readonly status: ToolTrustStatus
  readonly suspended: boolean
  readonly executableByAgent: boolean
}

export class ToolRegistry {
  private readonly records = new Map<ToolKey, ToolRecord>()

  /** Registers an observed tool. Always enters as DISCOVERED with no grant. */
  register(input: unknown): ToolRecord {
    const descriptor = toolDescriptorSchema.parse(input)
    const key = toolKey(descriptor.identity)
    if (this.records.has(key)) {
      throw new Error(`Tool "${key}" is already registered`)
    }
    const record: ToolRecord = {
      descriptor,
      status: 'DISCOVERED',
      grant: null,
      decisions: [],
      suspension: null,
      driftHistory: [],
      descriptorHistory: [],
    }
    const frozen = immutable(record)
    this.records.set(key, frozen)
    return frozen
  }

  get(key: ToolKey): ToolRecord | undefined {
    return this.records.get(key)
  }

  list(): readonly ToolRecord[] {
    return Array.from(this.records.values())
  }

  /** Execution eligibility at the state level: live status, a grant, and not suspended. */
  isEligible(key: ToolKey): boolean {
    const r = this.records.get(key)
    return !!r && isLive(r.status) && r.grant !== null && r.suspension === null
  }

  decide(input: TrustDecisionInput): ToolRecord {
    const record = this.records.get(input.toolKey)
    if (!record) throw new Error(`Unknown tool "${input.toolKey}"`)

    const g = this.requireGovernance(input.governance, input.toolKey)
    if (!TRANSITIONS[record.status].includes(input.to)) {
      throw new Error(`Illegal trust transition ${record.status} -> ${input.to}`)
    }
    if (!input.rationale.trim()) throw new Error('Trust decisions require a rationale')
    if (g.kind !== (input.to === 'REVOKED' ? 'TOOL_REVOCATION' : 'TOOL_TRUST')) {
      throw new Error(`Governance decision kind ${g.kind} cannot authorise ${input.to}`)
    }
    if (g.outcome !== OUTCOME_FOR[input.to]) {
      throw new Error(`Governance decision outcome ${g.outcome} does not authorise ${input.to}`)
    }

    let grant: ToolGrant | null = record.grant
    if (input.to === 'APPROVED' || input.to === 'RESTRICTED') {
      if (record.suspension) {
        throw new Error('Tool is suspended by upstream drift; a reaffirmation is required')
      }
      grant = this.validateApproval(record.descriptor, g, input.evidence, input.grant)
    } else if (input.to === 'REVOKED' || input.to === 'REJECTED') {
      grant = null
    }

    const decision: ToolTrustDecision = {
      toolKey: input.toolKey,
      from: record.status,
      to: input.to,
      governance: g,
      rationale: input.rationale,
      decidedAt: input.decidedAt,
      grant: grant ?? undefined,
      evidence: input.evidence.map((e) => toolEvidenceRefSchema.parse(e)),
    }
    const next: ToolRecord = {
      ...record,
      status: input.to,
      grant,
      suspension: input.to === 'REVOKED' || input.to === 'REJECTED' ? null : record.suspension,
      decisions: [...record.decisions, decision],
    }
    const frozen = immutable(next)
    this.records.set(input.toolKey, frozen)
    return frozen
  }

  /** Records an upstream observation. Material drift on a live tool suspends it. */
  recordDrift(key: ToolKey, observedInput: unknown | null, observedAt: string): ToolRecord {
    const record = this.records.get(key)
    if (!record) throw new Error(`Unknown tool "${key}"`)
    const observed = observedInput === null ? null : toolDescriptorSchema.parse(observedInput)
    const finding: DriftFinding = classifyDrift(record.descriptor, observed)
    const suspend = finding.material && isLive(record.status) && record.suspension === null
    const next: ToolRecord = {
      ...record,
      suspension: suspend
        ? { kind: finding.kind, since: observedAt, changedFields: finding.changedFields }
        : record.suspension,
      driftHistory: [...record.driftHistory, { ...finding, observedAt }],
    }
    const frozen = immutable(next)
    this.records.set(key, frozen)
    return frozen
  }

  /** The only way out of a suspension short of revocation: a new verified decision. */
  reaffirm(input: ReaffirmInput): ToolRecord {
    const record = this.records.get(input.toolKey)
    if (!record) throw new Error(`Unknown tool "${input.toolKey}"`)
    if (!record.suspension || !isLive(record.status)) {
      throw new Error('Reaffirmation applies only to a suspended approved tool')
    }
    const observed = toolDescriptorSchema.parse(input.observed)
    if (toolKey(observed.identity) !== input.toolKey) {
      throw new Error('Reaffirmed artifact must keep the same tool identity')
    }
    const g = this.requireGovernance(input.governance, input.toolKey)
    if (g.kind !== 'TOOL_TRUST' || (g.outcome !== 'APPROVE' && g.outcome !== 'RESTRICT')) {
      throw new Error('Reaffirmation requires a TOOL_TRUST decision with outcome APPROVE or RESTRICT')
    }
    if (!input.rationale.trim()) throw new Error('Reaffirmation requires a rationale')

    const grant = this.validateApproval(observed, g, input.evidence, input.grant)
    const to: ToolTrustStatus = g.outcome === 'APPROVE' ? 'APPROVED' : 'RESTRICTED'
    const decision: ToolTrustDecision = {
      toolKey: input.toolKey,
      from: record.status,
      to,
      governance: g,
      rationale: input.rationale,
      decidedAt: input.decidedAt,
      grant,
      evidence: input.evidence.map((e) => toolEvidenceRefSchema.parse(e)),
    }
    const next: ToolRecord = {
      descriptor: observed,
      status: to,
      grant,
      suspension: null,
      decisions: [...record.decisions, decision],
      driftHistory: record.driftHistory,
      descriptorHistory: [...record.descriptorHistory, record.descriptor],
    }
    const frozen = immutable(next)
    this.records.set(input.toolKey, frozen)
    return frozen
  }

  private requireGovernance(value: unknown, key: ToolKey): VerifiedGovernanceDecision {
    if (!isVerifiedGovernanceDecision(value)) {
      throw new Error('Trust decisions require a verified governance decision')
    }
    if (value.status !== 'ACTIVE') throw new Error(`Governance decision is ${value.status}`)
    if (value.subject !== key) throw new Error('Governance decision applies to a different tool')
    return value
  }

  private validateApproval(
    descriptor: ToolDescriptor,
    g: VerifiedGovernanceDecision,
    evidenceInput: readonly ToolEvidenceRef[],
    grant: ToolGrant | undefined,
  ): ToolGrant {
    const { identity, provenance, commands, declaredSideEffects, sourceClass } = descriptor
    const problems: string[] = []

    if (!identity.digest || !DIGEST_PATTERN.test(identity.digest)) {
      problems.push('approval requires a pinned sha256 digest')
    } else if (g.subjectDigest !== identity.digest) {
      problems.push('governance decision is not bound to this artifact digest')
    }
    if (!EXACT_VERSION.test(identity.version)) problems.push('approval requires an exact version')
    if (!identity.license?.trim()) problems.push('approval requires a reviewed licence')
    if (provenance.mutableUpstream) problems.push('approval refused: upstream is a mutable ref')
    if (g.decidedByRole !== 'platform-governance-board' || !g.authorId || !g.reviewerId ||
        !g.actorId || g.authorId === g.reviewerId || g.actorId === g.authorId || g.actorId === g.reviewerId) {
      problems.push('approval requires separated author reviewer and authorized approver')
    }
    if (new Set(commands.map((c) => c.name)).size !== commands.length) problems.push('duplicate command declarations')
    if (commands.some((c) => c.sideEffects.some((effect) => !declaredSideEffects.includes(effect)))) {
      problems.push('command effects contradict tool-wide effects')
    }

    const evidence = evidenceInput.map((e) => toolEvidenceRefSchema.safeParse(e))
    if (evidence.some((e) => !e.success)) problems.push('evidence references are malformed')
    const attested = new Set(g.evidenceRefs)
    const countable = new Set<ToolEvidenceKind>()
    for (const e of evidence) {
      if (e.success && e.data.trustClass === 'NZILA_VERIFIED' && attested.has(e.data.ref) && e.data.sha256) {
        countable.add(e.data.kind)
      }

    }
    const required =
      sourceClass === 'GENERATED_HARNESS'
        ? [...REQUIRED_APPROVAL_EVIDENCE, ...REQUIRED_GENERATED_EVIDENCE]
        : REQUIRED_APPROVAL_EVIDENCE
    for (const kind of required) {
      if (!countable.has(kind)) problems.push(`approval requires governance-attested ${kind} evidence`)
    }

    if (!grant) {
      problems.push('approval requires an explicit grant')
    } else {
      if (grant.allowedAgents.length === 0) problems.push('grant must name at least one agent')
      if (grant.allowedCapabilities.length === 0) problems.push('grant must name at least one capability')
      if (grant.allowedCommands.length === 0) problems.push('grant must name at least one command')
      if (grant.allowedAgents.includes('*') || grant.allowedCapabilities.includes('*')) {
        problems.push('wildcard grants are not permitted')
      }
      const known = new Set(commands.map((c) => c.name))
      for (const c of grant.allowedCommands) {
        if (!known.has(c)) problems.push(`granted command "${c}" is not declared by the tool`)
      }
      const declared = new Set(declaredSideEffects)
      for (const s of grant.allowedSideEffects) {
        if (!declared.has(s)) problems.push(`granted side effect ${s} is not declared by the tool`)
      }
      if (grant.allowNetwork && !declared.has('NETWORK_ACCESS')) {
        problems.push('network granted to a tool that does not declare network access')
      }
      if (!(grant.maxTimeoutMs > 0)) problems.push('grant requires a positive maxTimeoutMs')
    }

    if (problems.length > 0 || !grant) {
      throw new Error(`Approval rejected: ${problems.join('; ')}`)
    }
    return grant
  }

  /** True when the resolved authority holds a live, unsuspended grant for the capability. */
  isGrantedTo(key: ToolKey, agent: ResolvedAgentAuthority, capability: string): boolean {
    if (!isResolvedAgentAuthority(agent)) return false
    const r = this.records.get(key)
    if (!r || !this.isEligible(key) || !r.grant) return false
    return (
      agent.capabilities.includes(capability) &&
      r.grant.allowedAgents.includes(agent.agentId) &&
      r.grant.allowedCapabilities.includes(capability)
    )
  }

  /** Discovery never confers execution; `executableByAgent` is informational. */
  discover(agent: ResolvedAgentAuthority, capability: string): readonly DiscoveryCandidate[] {
    const out: DiscoveryCandidate[] = []
    for (const [key, r] of this.records) {
      const claimed = r.descriptor.claimedCapabilities.includes(capability)
      const granted = r.grant?.allowedCapabilities.includes(capability) ?? false
      if (!claimed && !granted) continue
      out.push({
        toolKey: key,
        status: r.status,
        suspended: r.suspension !== null,
        executableByAgent: this.isGrantedTo(key, agent, capability),
      })
    }
    return out
  }

  planCapability(agent: ResolvedAgentAuthority, capability: string): CapabilityPlan {
    const found = this.discover(agent, capability)
    const usable = found.filter((c) => c.executableByAgent).map((c) => c.toolKey)
    if (usable.length > 0) return { path: 'A_APPROVED', tools: usable }
    const live = found.filter((c) => c.status !== 'REJECTED' && c.status !== 'REVOKED')
    if (live.length > 0) return { path: 'B_UNAPPROVED_CANDIDATE', candidates: live.map((c) => c.toolKey) }
    return { path: 'C_NO_CANDIDATE', harnessGenerationMayBeRequested: true }
  }

  /** Legacy string-reason drift report (Phase 1). Prefer recordDrift/classifyDrift. */
  detectDrift(observed: ToolDescriptor): readonly string[] {
    const record = this.records.get(toolKey(observed.identity))
    if (!record) return ['tool is not registered']
    const before = record.descriptor
    const reasons: string[] = []
    if (before.identity.digest !== observed.identity.digest) reasons.push('digest changed')
    if (before.identity.packageCoordinates !== observed.identity.packageCoordinates) {
      reasons.push('package coordinates changed')
    }
    const prev = new Set(before.declaredSideEffects)
    if (observed.declaredSideEffects.some((s) => !prev.has(s))) reasons.push('side effects widened')
    return reasons
  }
}
