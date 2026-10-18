/**
 * @nzila/tool-fabric — trust ledger
 *
 * Event-sourced trust state using a host-injected atomic snapshot/CAS contract.
 * A plain AuditStore is insufficient and fails closed. No approved persistent
 * adapter is shipped: in-memory tests prove CONTRACT_ONLY, never durability.
 *
 * Integrity: require full-payload audit v2 coverage plus an independent canonical
 * SHA-256 event chain (`seq`, `prevEventHash`, `eventHash`) binding mutation
 * provenance. Every load rejects gaps, forks, reordering, edited bodies and
 * malformed events. Historical partial-coverage audit v1 is not trust evidence.
 *
 * State is never mutated in place: load() replays every event through the same
 * ToolRegistry state machine used for live decisions.
 */
import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { auditEntrySchema, computeAuditHash, verifyChain, type AuditEntry, type AuditStore } from '@nzila/audit'

import {
  DenyOnlyAtomicTrustLedgerStore,
  LedgerDuplicateError,
  LedgerStoreUnavailableError,
  type AtomicTrustLedgerStore,
  type LedgerSnapshot,
} from './ledger-store'

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
    allowedFilesystemRoots: z.array(z.string()).optional(),
    allowedEnv: z.record(z.array(z.string())).optional(),
    resourceLimits: z.object({
      cpuMs: z.number(),
      memoryBytes: z.number(),
      diskBytes: z.number(),
      outputBytes: z.number(),
      processes: z.number(),
    }).strict().optional(),
  })
  .strict()

const trustStatusSchema = z.enum(['DISCOVERED', 'EVALUATING', 'APPROVED', 'RESTRICTED', 'REJECTED', 'REVOKED'])

const mutationSchema = z.object({
  actorId: z.string().trim().min(1),
  role: z.string().trim().min(1),
  authorityRef: z.string().trim().min(1),
  operation: z.enum(['register', 'decide', 'observe', 'reaffirm']),
}).strict()

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
    mutation: mutationSchema,
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

function computeEventHash(seq: number, prevEventHash: string, body: unknown, mutation: unknown): string {
  return createHash('sha256').update(canonicalJson({ seq, prevEventHash, body, mutation })).digest('hex')
}

function snapshotOf(g: GovernanceDecisionSnapshot): z.infer<typeof governanceSnapshotSchema> {
  return governanceSnapshotSchema.parse({ ...g, evidenceRefs: [...g.evidenceRefs] })
}

export interface LedgerOptions {
  readonly now?: () => Date
  /** Trusted host DI only. Never deserialize either adapter from a request. */
  readonly mutationAuthority?: LedgerMutationAuthority
  readonly governanceVerifier?: GovernanceDecisionVerifier
}

export type LedgerMutationOperation = 'register' | 'decide' | 'observe' | 'reaffirm'

export interface LedgerMutationActor {
  readonly actorId: string
  readonly role: string
  readonly authorityRef: string
  readonly permittedOperations: readonly LedgerMutationOperation[]
}

export interface LedgerMutationAuthority {
  /** Resolves the authenticated host actor and its role-scoped permission, not request claims. */
  authorize(request: {
    readonly operation: LedgerMutationOperation
    readonly resourceId: string
  }): Promise<LedgerMutationActor | null>
}

export class LedgerMutationAuthorizationError extends Error {
  constructor(message = 'No trusted host authority authorizes this ledger mutation') {
    super(message)
    this.name = 'LedgerMutationAuthorizationError'
  }
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
  private readonly now: () => Date
  private readonly options: LedgerOptions

  constructor(
    private readonly store: AtomicTrustLedgerStore | AuditStore = new DenyOnlyAtomicTrustLedgerStore(),
    options: LedgerOptions = {},
  ) {
    this.now = options.now ?? (() => new Date())
    this.options = { ...options }
  }

  /** Replays and verifies the whole ledger. Throws LedgerIntegrityError on any anomaly. */
  async load(): Promise<ToolRegistry> {
    return (await this.loadSnapshot()).registry
  }

  private atomicStore(): AtomicTrustLedgerStore {
    const store = this.store as Partial<AtomicTrustLedgerStore>
    if (
      store.atomicContract !== 'tool-trust-ledger-cas-v1' ||
      typeof store.readSnapshot !== 'function' ||
      typeof store.compareAndAppend !== 'function'
    ) throw new LedgerStoreUnavailableError('A coherent atomic snapshot/CAS store is required; AuditStore alone is unsafe')
    return store as AtomicTrustLedgerStore
  }

  private async loadSnapshot(): Promise<{ registry: ToolRegistry; snapshot: LedgerSnapshot }> {
    const snapshot = structuredClone(await this.atomicStore().readSnapshot(TOOL_TRUST_LEDGER_ORG))
    if (
      !snapshot || !Array.isArray(snapshot.entries) ||
      !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0 ||
      snapshot.revision !== snapshot.entries.length ||
      snapshot.headHash !== (snapshot.entries.at(-1)?.hash ?? GENESIS)
    ) throw new LedgerIntegrityError('Incomplete or incoherent trust ledger snapshot')
    const entries = snapshot.entries
    const ids = new Set<string>()
    for (const entry of entries) {
      if (!auditEntrySchema.safeParse(entry).success || entry.orgId !== TOOL_TRUST_LEDGER_ORG || ids.has(entry.id)) {
        throw new LedgerIntegrityError('Malformed, duplicate or cross-stream audit entry')
      }
      ids.add(entry.id)
    }
    const chain = verifyChain(entries, { requireFullCoverage: true })
    if (!chain.valid) throw new LedgerIntegrityError(`audit chain invalid: ${chain.error ?? 'unknown'}`)

    const registry = new ToolRegistry()
    const decisions = new Set<string>()
    let prev = GENESIS
    let expectedSeq = 1
    for (const entry of entries) {
      const parsed = payloadSchema.safeParse(entry.payload)
      if (!parsed.success) throw new LedgerIntegrityError(`entry ${entry.id} has a malformed payload`)
      const { seq, prevEventHash, eventHash, body, mutation } = parsed.data
      if (seq !== expectedSeq) throw new LedgerIntegrityError(`sequence gap or fork at entry ${entry.id}`)
      if (prevEventHash !== prev) throw new LedgerIntegrityError(`event chain broken at entry ${entry.id}`)
      if (eventHash !== computeEventHash(seq, prevEventHash, body, mutation)) {
        throw new LedgerIntegrityError(`event body altered at entry ${entry.id}`)
      }
      const operation = this.operationFor(body)
      const resourceId = body.type === 'TOOL_REGISTERED' ? toolKey(body.descriptor.identity) : body.toolKey
      if (
        mutation.operation !== operation || mutation.actorId !== entry.actorId ||
        entry.action !== `tool_fabric.ledger.${body.type.toLowerCase()}` ||
        entry.resource !== 'tool-fabric-tool' || entry.resourceId !== resourceId ||
        (('governance' in body) && (
          mutation.role !== body.governance.decidedByRole ||
          (body.governance.actorId !== undefined && mutation.actorId !== body.governance.actorId)
        ))
      ) throw new LedgerIntegrityError(`Mutation provenance mismatch at entry ${entry.id}`)
      if ('governance' in body) {
        if (decisions.has(body.governance.decisionRef)) {
          throw new LedgerIntegrityError(`Replayed governance decision at entry ${entry.id}`)
        }
        decisions.add(body.governance.decisionRef)
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
    return { registry, snapshot }
  }

  async register(descriptor: unknown): Promise<ToolRecord> {
    const parsed = toolDescriptorSchema.parse(descriptor)
    const resourceId = toolKey(parsed.identity)
    const mutation = await this.authorize('register', resourceId)
    const { registry, snapshot } = await this.loadSnapshot()
    const record = registry.register(parsed)
    await this.append({ type: 'TOOL_REGISTERED', descriptor: record.descriptor }, mutation, resourceId, snapshot)
    return record
  }

  /** Verifies the governance decision with the authoritative verifier, then records it. */
  async decide(args: DecideArgs, verifier?: GovernanceDecisionVerifier): Promise<ToolRecord> {
    args = structuredClone({
      toolKey: args.toolKey, to: args.to, decisionRef: args.decisionRef,
      rationale: args.rationale, evidence: args.evidence, grant: args.grant,
    })
    const mutation = await this.authorize('decide', args.toolKey)
    const trustedVerifier = this.trustedVerifier(verifier)
    const { registry, snapshot } = await this.loadSnapshot()
    this.requireUnusedDecision(registry, args.decisionRef)
    const governance = await verifyGovernanceDecision(trustedVerifier, args.decisionRef, this.now())
    this.requireDecisionRole(mutation, governance)
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
      mutation,
      args.toolKey,
      snapshot,
    )
    return record
  }

  /** Records an upstream observation; material drift suspends execution eligibility. */
  async observeUpstream(key: ToolKey, observed: unknown | null): Promise<ToolRecord> {
    observed = structuredClone(observed)
    const mutation = await this.authorize('observe', key)
    const { registry, snapshot } = await this.loadSnapshot()
    const observedAt = this.now().toISOString()
    const record = registry.recordDrift(key, observed, observedAt)
    const body: EventBody = {
      type: 'DRIFT_OBSERVED',
      toolKey: key,
      observed: observed === null ? null : toolDescriptorSchema.parse(observed),
      observedAt,
    }
    await this.append(body, mutation, key, snapshot)
    return record
  }

  async reaffirm(args: ReaffirmArgs, verifier?: GovernanceDecisionVerifier): Promise<ToolRecord> {
    args = structuredClone({
      toolKey: args.toolKey, observed: args.observed, decisionRef: args.decisionRef,
      rationale: args.rationale, evidence: args.evidence, grant: args.grant,
    })
    const mutation = await this.authorize('reaffirm', args.toolKey)
    const trustedVerifier = this.trustedVerifier(verifier)
    const { registry, snapshot } = await this.loadSnapshot()
    this.requireUnusedDecision(registry, args.decisionRef)
    const governance = await verifyGovernanceDecision(trustedVerifier, args.decisionRef, this.now())
    this.requireDecisionRole(mutation, governance)
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
      mutation,
      args.toolKey,
      snapshot,
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

  private operationFor(body: EventBody): LedgerMutationOperation {
    switch (body.type) {
      case 'TOOL_REGISTERED': return 'register'
      case 'TRUST_DECISION': return 'decide'
      case 'DRIFT_OBSERVED': return 'observe'
      case 'TRUST_REAFFIRMED': return 'reaffirm'
    }
  }

  private async authorize(operation: LedgerMutationOperation, resourceId: string): Promise<z.infer<typeof mutationSchema>> {
    const actor = await this.options.mutationAuthority?.authorize({ operation, resourceId })
    const parsed = mutationSchema.safeParse(actor && {
      actorId: actor.actorId, role: actor.role, authorityRef: actor.authorityRef, operation,
    })
    if (!parsed.success || !Array.isArray(actor?.permittedOperations) || !actor.permittedOperations.includes(operation)) {
      throw new LedgerMutationAuthorizationError()
    }
    return parsed.data
  }

  private trustedVerifier(candidate?: GovernanceDecisionVerifier): GovernanceDecisionVerifier {
    const verifier = this.options.governanceVerifier
    if (!verifier || (candidate !== undefined && candidate !== verifier)) {
      throw new LedgerMutationAuthorizationError('Governance verifier must be the adapter configured by the trusted host')
    }
    return verifier
  }

  private requireDecisionRole(mutation: z.infer<typeof mutationSchema>, governance: GovernanceDecisionSnapshot): void {
    if (mutation.role !== governance.decidedByRole) {
      throw new LedgerMutationAuthorizationError('Authenticated mutation role does not match governance decision role')
    }
    if (governance.actorId !== undefined && mutation.actorId !== governance.actorId) {
      throw new LedgerMutationAuthorizationError('Authenticated mutation actor does not match governance decision actor')
    }
  }

  private requireUnusedDecision(registry: ToolRegistry, decisionRef: string): void {
    if (registry.list().some((record) => record.decisions.some((decision) => decision.governance.decisionRef === decisionRef))) {
      throw new LedgerDuplicateError()
    }
  }

  private async append(
    body: EventBody,
    mutation: z.infer<typeof mutationSchema>,
    resourceId: string,
    snapshot: LedgerSnapshot,
  ): Promise<AuditEntry> {
    const seq = snapshot.revision + 1
    const last = snapshot.entries.at(-1)
    const prevEventHash = last ? payloadSchema.parse(last.payload).eventHash : GENESIS
    const eventHash = computeEventHash(seq, prevEventHash, body, mutation)
    const hashable = {
      id: randomUUID(),
      timestamp: this.now().toISOString(),
      actorId: mutation.actorId,
      orgId: TOOL_TRUST_LEDGER_ORG,
      action: `tool_fabric.ledger.${body.type.toLowerCase()}`,
      resource: 'tool-fabric-tool',
      resourceId,
      payload: { seq, prevEventHash, eventHash, body, mutation } as unknown as Record<string, unknown>,
    }
    const entry: AuditEntry = {
      ...hashable,
      prevHash: snapshot.headHash,
      hash: computeAuditHash(snapshot.headHash, hashable),
      hashVersion: 2,
    }
    const committed = await this.atomicStore().compareAndAppend(
      TOOL_TRUST_LEDGER_ORG,
      { revision: snapshot.revision, headHash: snapshot.headHash },
      entry,
    )
    if (committed.revision !== seq || committed.headHash !== entry.hash) {
      throw new LedgerIntegrityError('Atomic store returned an invalid commit receipt')
    }
    return entry
  }
}

export { GovernanceVerificationError }
