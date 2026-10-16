/**
 * @nzila/tool-fabric — tool registry and trust state machine
 *
 * The registry is the ONLY place trust status and grants are held, and
 * `decide()` is the only mutation path. Descriptors (including anything
 * parsed from registries, SKILL.md or tool output) enter as DISCOVERED and
 * cannot carry trust fields: the descriptor schema is strict.
 */
import { z } from 'zod'

import {
  TOOL_SIDE_EFFECTS,
  TOOL_SOURCE_CLASSES,
  toolKey,
  type AgentAuthority,
  type PrincipalRef,
  type ToolDescriptor,
  type ToolGrant,
  type ToolKey,
  type ToolRecord,
  type ToolTrustDecision,
  type ToolTrustStatus,
} from './types'

const sideEffectSchema = z.enum(TOOL_SIDE_EFFECTS)

export const toolDescriptorSchema: z.ZodType<ToolDescriptor> = z
  .object({
    identity: z
      .object({
        name: z.string().min(1),
        version: z.string().min(1),
        providerId: z.string().min(1),
        sourceRepository: z.string().optional(),
        packageCoordinates: z.string().optional(),
        license: z.string().optional(),
        digest: z.string().optional(),
      })
      .strict(),
    sourceClass: z.enum(TOOL_SOURCE_CLASSES),
    displayName: z.string().optional(),
    claimedCapabilities: z.array(z.string().min(1)),
    commands: z.array(
      z
        .object({
          name: z.string().min(1),
          sideEffects: z.array(sideEffectSchema),
          supportsJsonOutput: z.boolean(),
        })
        .strict(),
    ),
    declaredSideEffects: z.array(sideEffectSchema),
    provenance: z
      .object({
        discoveredVia: z.string().min(1),
        discoveredAt: z.string().min(1),
        upstreamRef: z.string().optional(),
        mutableUpstream: z.boolean(),
        notes: z.array(z.string()).optional(),
      })
      .strict(),
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

const GENERATED_EVIDENCE_PREFIXES = [
  'code-review:',
  'security-review:',
  'capability-review:',
  'tests:',
  'provenance:',
] as const

export interface TrustDecisionInput {
  readonly toolKey: ToolKey
  readonly to: ToolTrustStatus
  readonly decidedBy: PrincipalRef
  readonly decisionRef: string
  readonly rationale: string
  readonly decidedAt: string
  readonly evidence: readonly string[]
  readonly grant?: ToolGrant
}

export type CapabilityPlan =
  | { readonly path: 'A_APPROVED'; readonly tools: readonly ToolKey[] }
  | { readonly path: 'B_UNAPPROVED_CANDIDATE'; readonly candidates: readonly ToolKey[] }
  | { readonly path: 'C_NO_CANDIDATE'; readonly harnessGenerationMayBeRequested: true }

export interface DiscoveryCandidate {
  readonly toolKey: ToolKey
  readonly status: ToolTrustStatus
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
    const record: ToolRecord = { descriptor, status: 'DISCOVERED', grant: null, decisions: [] }
    this.records.set(key, record)
    return record
  }

  get(key: ToolKey): ToolRecord | undefined {
    return this.records.get(key)
  }

  list(): readonly ToolRecord[] {
    return Array.from(this.records.values())
  }

  decide(input: TrustDecisionInput): ToolRecord {
    const record = this.records.get(input.toolKey)
    if (!record) throw new Error(`Unknown tool "${input.toolKey}"`)

    if (!TRANSITIONS[record.status].includes(input.to)) {
      throw new Error(`Illegal trust transition ${record.status} -> ${input.to}`)
    }
    if (input.decidedBy.kind !== 'HUMAN_REVIEWER' && input.decidedBy.kind !== 'GOVERNANCE_BODY') {
      throw new Error('Trust decisions require a human reviewer or governance body')
    }
    if (!input.decidedBy.id.trim() || !input.decisionRef.trim() || !input.rationale.trim()) {
      throw new Error('Trust decisions require decidedBy, decisionRef and rationale')
    }

    let grant: ToolGrant | null = record.grant
    if (input.to === 'APPROVED' || input.to === 'RESTRICTED') {
      grant = this.validateApproval(record, input)
    } else if (input.to === 'REVOKED' || input.to === 'REJECTED') {
      grant = null
    }

    const decision: ToolTrustDecision = {
      toolKey: input.toolKey,
      from: record.status,
      to: input.to,
      decidedBy: input.decidedBy,
      decisionRef: input.decisionRef,
      rationale: input.rationale,
      decidedAt: input.decidedAt,
      grant: grant ?? undefined,
      evidence: input.evidence,
    }
    const next: ToolRecord = {
      descriptor: record.descriptor,
      status: input.to,
      grant,
      decisions: [...record.decisions, decision],
    }
    this.records.set(input.toolKey, next)
    return next
  }

  private validateApproval(record: ToolRecord, input: TrustDecisionInput): ToolGrant {
    const { identity, provenance, commands, declaredSideEffects, sourceClass } = record.descriptor
    const problems: string[] = []

    if (!identity.digest || !DIGEST_PATTERN.test(identity.digest)) {
      problems.push('approval requires a pinned sha256 digest')
    }
    if (!EXACT_VERSION.test(identity.version)) {
      problems.push('approval requires an exact version')
    }
    if (!identity.license?.trim()) problems.push('approval requires a reviewed licence')
    if (provenance.mutableUpstream) problems.push('approval refused: upstream is a mutable ref')
    if (input.evidence.length === 0) problems.push('approval requires evidence')

    const grant = input.grant
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

    if (sourceClass === 'GENERATED_HARNESS') {
      for (const prefix of GENERATED_EVIDENCE_PREFIXES) {
        if (!input.evidence.some((e) => e.startsWith(prefix))) {
          problems.push(`generated harness approval requires "${prefix}" evidence`)
        }
      }
    }

    if (problems.length > 0 || !grant) {
      throw new Error(`Approval rejected: ${problems.join('; ')}`)
    }
    return grant
  }

  /** True when an agent holds a live grant for the capability on this tool. */
  isGrantedTo(key: ToolKey, agent: AgentAuthority, capability: string): boolean {
    const r = this.records.get(key)
    if (!r || (r.status !== 'APPROVED' && r.status !== 'RESTRICTED') || !r.grant) return false
    return (
      agent.permittedCapabilities.includes(capability) &&
      r.grant.allowedAgents.includes(agent.agentId) &&
      r.grant.allowedCapabilities.includes(capability)
    )
  }

  /** Discovery never confers execution; `executableByAgent` is informational. */
  discover(agent: AgentAuthority, capability: string): readonly DiscoveryCandidate[] {
    const out: DiscoveryCandidate[] = []
    for (const [key, r] of this.records) {
      const claimed = r.descriptor.claimedCapabilities.includes(capability)
      const granted = r.grant?.allowedCapabilities.includes(capability) ?? false
      if (!claimed && !granted) continue
      out.push({
        toolKey: key,
        status: r.status,
        executableByAgent: this.isGrantedTo(key, agent, capability),
      })
    }
    return out
  }

  planCapability(agent: AgentAuthority, capability: string): CapabilityPlan {
    const found = this.discover(agent, capability)
    const usable = found.filter((c) => c.executableByAgent).map((c) => c.toolKey)
    if (usable.length > 0) return { path: 'A_APPROVED', tools: usable }
    const live = found.filter((c) => c.status !== 'REJECTED' && c.status !== 'REVOKED')
    if (live.length > 0) return { path: 'B_UNAPPROVED_CANDIDATE', candidates: live.map((c) => c.toolKey) }
    return { path: 'C_NO_CANDIDATE', harnessGenerationMayBeRequested: true }
  }

  /** Reports why an observed descriptor no longer matches what was approved. */
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
