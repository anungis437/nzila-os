/**
 * @nzila/tool-fabric — trust ledger
 *
 * Event-sourced, append-only trust state persisted through the existing
 * @nzila/audit `AuditStore` port (no Tool-Fabric database). The durability of
 * trust state is exactly the durability of whichever AuditStore the host
 * injects; only InMemoryAuditStore exists in the repo today.
 *
 * Integrity: @nzila/audit's own hash does not cover nested payload fields
 * (computeAuditHash filters nested keys through a top-level replacer list), so
 * the ledger carries its own canonical SHA-256 chain (`seq`, `prevEventHash`,
 * `eventHash`) inside each payload and verifies it on every load. Any gap,
 * fork, reorder, edited body or malformed event fails closed.
 *
 * State is never mutated in place: load() replays every event through the same
 * ToolRegistry state machine used for live decisions.
 */
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { AuditEngine, verifyChain, type AuditEntry, type AuditStore } from '@nzila/audit'

import {
  GovernanceVerificationError,
  governanceSnapshotSchema,
  rehydrateRecordedDecision,
  verifyGovernanceDecision,
  type GovernanceDecisionVerifier,
} from './governance'
import { ToolRegistry, toolDescriptorSchema, toolEvidenceRefSchema } from './registry'
import {
  TOOL_SIDE_EFFECTS,
  toolKey,
  type GovernanceDecisionSnapshot,
  type ToolEvidenceRef,
  type ToolGrant,
  type ToolKey,
  type ToolRecord,
  type ToolTrustStatus,
} from './types'

export const TOOL_TRUST_LEDGER_ORG = 'platform:tool-fabric:trust'
const GENESIS = '0'.repeat(64)
const PAGE = 500

export class LedgerIntegrityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LedgerIntegrityError'
  }
}

const toolGrantSchema: z.ZodType<ToolGrant> = z
  .object({
    allowedAgents: z.array(z.string().min(1)),
    allowedCapabilities: z.array(z.string().min(1)),
    allowedCommands: z.array(z.string().min(1)),
    allowedSideEffects: z.array(z.enum(TOOL_SIDE_EFFECTS)),
    allowNetwork: z.boolean(),
    allowedSecretRefs: z.array(z.string()),
    maxTimeoutMs: z.number(),
  })
  .strict()

const trustStatusSchema = z.enum(['DISCOVERED', 'EVALUATING', 'APPROVED', 'RESTRICTED', 'REJECTED', 'REVOKED'])

const eventBodySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('TOOL_REGISTERED'), descriptor: toolDescriptorSchema }).strict(),
  z
    .object({
      type: z.literal('TRUST_DECISION'),
      toolKey: z.string().min(1),
      to: trustStatusSchema,
      governance: governanceSnapshotSchema,
      rationale: z.string().min(1),
      decidedAt: z.string().min(1),
      evidence: z.array(toolEvidenceRefSchema),
      grant: toolGrantSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('DRIFT_OBSERVED'),
      toolKey: z.string().min(1),
      observed: toolDescriptorSchema.nullable(),
      observedAt: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal('TRUST_REAFFIRMED'),
      toolKey: z.string().min(1),
      observed: toolDescriptorSchema,
      governance: governanceSnapshotSchema,
      rationale: z.string().min(1),
      decidedAt: z.string().min(1),
      evidence: z.array(toolEvidenceRefSchema),
      grant: toolGrantSchema,
    })
    .strict(),
])
type EventBody = z.infer<typeof eventBodySchema>

const payloadSchema = z
  .object({
    seq: z.number().int().positive(),
    prevEventHash: z.string().length(64),
    eventHash: z.string().length(64),
    body: eventBodySchema,
  })
  .strict()

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`
}

function computeEventHash(seq: number, prevEventHash: string, body: unknown): string {
  return createHash('sha256').update(canonicalJson({ seq, prevEventHash, body })).digest('hex')
}

function snapshotOf(g: GovernanceDecisionSnapshot): z.infer<typeof governanceSnapshotSchema> {
  return governanceSnapshotSchema.parse({ ...g, evidenceRefs: [...g.evidenceRefs] })
}

export interface LedgerOptions {
  readonly now?: () => Date
}

export interface DecideArgs {
  readonly toolKey: ToolKey
  readonly to: ToolTrustStatus
  readonly decisionRef: string
  readonly rationale: string
  readonly evidence: readonly ToolEvidenceRef[]
  readonly grant?: ToolGrant
}

export interface ReaffirmArgs {
  readonly toolKey: ToolKey
  readonly observed: unknown
  readonly decisionRef: string
  readonly rationale: string
  readonly evidence: readonly ToolEvidenceRef[]
  readonly grant: ToolGrant
}

export class ToolTrustLedger {
  private readonly engine: AuditEngine
  private readonly now: () => Date

  constructor(
    private readonly store: AuditStore,
    options: LedgerOptions = {},
  ) {
    this.engine = new AuditEngine(store)
    this.now = options.now ?? (() => new Date())
  }

  /** Replays and verifies the whole ledger. Throws LedgerIntegrityError on any anomaly. */
  async load(): Promise<ToolRegistry> {
    const entries = await this.readAll()
    const chain = verifyChain(entries)
    if (!chain.valid) throw new LedgerIntegrityError(`audit chain invalid: ${chain.error ?? 'unknown'}`)

    const registry = new ToolRegistry()
    let prev = GENESIS
    let expectedSeq = 1
    for (const entry of entries) {
      const parsed = payloadSchema.safeParse(entry.payload)
      if (!parsed.success) throw new LedgerIntegrityError(`entry ${entry.id} has a malformed payload`)
      const { seq, prevEventHash, eventHash, body } = parsed.data
      if (seq !== expectedSeq) throw new LedgerIntegrityError(`sequence gap or fork at entry ${entry.id}`)
      if (prevEventHash !== prev) throw new LedgerIntegrityError(`event chain broken at entry ${entry.id}`)
      if (eventHash !== computeEventHash(seq, prevEventHash, body)) {
        throw new LedgerIntegrityError(`event body altered at entry ${entry.id}`)
      }
      try {
        this.apply(registry, body)
      } catch (err) {
        throw new LedgerIntegrityError(
          `entry ${entry.id} does not replay: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
      prev = eventHash
      expectedSeq += 1
    }
    return registry
  }

  async register(descriptor: unknown): Promise<ToolRecord> {
    const registry = await this.load()
    const record = registry.register(descriptor)
    await this.append({ type: 'TOOL_REGISTERED', descriptor: record.descriptor }, 'system:tool-fabric', toolKey(record.descriptor.identity))
    return record
  }

  /** Verifies the governance decision with the authoritative verifier, then records it. */
  async decide(args: DecideArgs, verifier: GovernanceDecisionVerifier): Promise<ToolRecord> {
    const registry = await this.load()
    const governance = await verifyGovernanceDecision(verifier, args.decisionRef, this.now())
    const decidedAt = this.now().toISOString()
    const record = registry.decide({
      toolKey: args.toolKey,
      to: args.to,
      governance,
      rationale: args.rationale,
      decidedAt,
      evidence: args.evidence,
      grant: args.grant,
    })
    const last = record.decisions[record.decisions.length - 1]
    await this.append(
      {
        type: 'TRUST_DECISION',
        toolKey: args.toolKey,
        to: args.to,
        governance: snapshotOf(governance),
        rationale: args.rationale,
        decidedAt,
        evidence: [...args.evidence],
        grant: last?.grant,
      },
      `role:${governance.decidedByRole}`,
      args.toolKey,
    )
    return record
  }

  /** Records an upstream observation; material drift suspends execution eligibility. */
  async observeUpstream(key: ToolKey, observed: unknown | null): Promise<ToolRecord> {
    const registry = await this.load()
    const observedAt = this.now().toISOString()
    const record = registry.recordDrift(key, observed, observedAt)
    const body: EventBody = {
      type: 'DRIFT_OBSERVED',
      toolKey: key,
      observed: observed === null ? null : toolDescriptorSchema.parse(observed),
      observedAt,
    }
    await this.append(body, 'system:tool-fabric', key)
    return record
  }

  async reaffirm(args: ReaffirmArgs, verifier: GovernanceDecisionVerifier): Promise<ToolRecord> {
    const registry = await this.load()
    const governance = await verifyGovernanceDecision(verifier, args.decisionRef, this.now())
    const decidedAt = this.now().toISOString()
    const observed = toolDescriptorSchema.parse(args.observed)
    const record = registry.reaffirm({
      toolKey: args.toolKey,
      observed,
      governance,
      rationale: args.rationale,
      decidedAt,
      evidence: args.evidence,
      grant: args.grant,
    })
    await this.append(
      {
        type: 'TRUST_REAFFIRMED',
        toolKey: args.toolKey,
        observed,
        governance: snapshotOf(governance),
        rationale: args.rationale,
        decidedAt,
        evidence: [...args.evidence],
        grant: args.grant,
      },
      `role:${governance.decidedByRole}`,
      args.toolKey,
    )
    return record
  }

  private apply(registry: ToolRegistry, body: EventBody): void {
    switch (body.type) {
      case 'TOOL_REGISTERED':
        registry.register(body.descriptor)
        return
      case 'TRUST_DECISION':
        registry.decide({
          toolKey: body.toolKey,
          to: body.to,
          governance: rehydrateRecordedDecision(body.governance as GovernanceDecisionSnapshot),
          rationale: body.rationale,
          decidedAt: body.decidedAt,
          evidence: body.evidence,
          grant: body.grant,
        })
        return
      case 'DRIFT_OBSERVED':
        registry.recordDrift(body.toolKey, body.observed, body.observedAt)
        return
      case 'TRUST_REAFFIRMED':
        registry.reaffirm({
          toolKey: body.toolKey,
          observed: body.observed,
          governance: rehydrateRecordedDecision(body.governance as GovernanceDecisionSnapshot),
          rationale: body.rationale,
          decidedAt: body.decidedAt,
          evidence: body.evidence,
          grant: body.grant,
        })
        return
    }
  }

  private async append(body: EventBody, actorId: string, resourceId: string): Promise<AuditEntry> {
    const last = await this.store.getLastEntry(TOOL_TRUST_LEDGER_ORG)
    let seq = 1
    let prevEventHash = GENESIS
    if (last) {
      const parsed = payloadSchema.safeParse(last.payload)
      if (!parsed.success) throw new LedgerIntegrityError('ledger head is malformed')
      seq = parsed.data.seq + 1
      prevEventHash = parsed.data.eventHash
    }
    const eventHash = computeEventHash(seq, prevEventHash, body)
    return this.engine.record({
      actorId,
      orgId: TOOL_TRUST_LEDGER_ORG,
      action: `tool_fabric.ledger.${body.type.toLowerCase()}`,
      resource: 'tool-fabric-tool',
      resourceId,
      payload: { seq, prevEventHash, eventHash, body } as unknown as Record<string, unknown>,
    })
  }

  private async readAll(): Promise<AuditEntry[]> {
    const out: AuditEntry[] = []
    for (let offset = 0; ; offset += PAGE) {
      const page = await this.store.getEntries(TOOL_TRUST_LEDGER_ORG, { limit: PAGE, offset })
      out.push(...page)
      if (page.length < PAGE) break
    }
    return out
  }
}

export { GovernanceVerificationError }
