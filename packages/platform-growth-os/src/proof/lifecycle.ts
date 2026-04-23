/**
 * Proof-capture lifecycle.
 *
 * State machine:
 *   requested
 *     → awaiting_permission
 *         → permission_granted
 *         → declined / cancelled
 *     → awaiting_quote
 *     → awaiting_kpi
 *     → awaiting_legal
 *         → ready_to_publish → published
 *         → declined / cancelled
 *
 * Publishing requires:
 *   - permission record present
 *   - all KPI baselines have observedValue
 *   - quoteText present (for testimonial / case_study / reference_call)
 */
import { proofRequestSchema } from '../schemas'
import { listRecords, readRecord, writeRecord } from '../store'
import type {
  GrowthScope,
  ProofKpiBaseline,
  ProofPermission,
  ProofRequest,
  ProofRequestStatus,
} from '../types'
import { makeId, nowISO, scopeKey } from '../utils'

const ENTITY = 'proof-request'

const ALLOWED: Record<ProofRequestStatus, ReadonlyArray<ProofRequestStatus>> = {
  requested: ['awaiting_permission', 'cancelled'],
  awaiting_permission: ['permission_granted', 'declined', 'cancelled'],
  permission_granted: ['awaiting_quote', 'awaiting_kpi', 'cancelled'],
  awaiting_quote: ['awaiting_kpi', 'awaiting_legal', 'ready_to_publish', 'cancelled'],
  awaiting_kpi: ['awaiting_legal', 'ready_to_publish', 'cancelled'],
  awaiting_legal: ['ready_to_publish', 'declined', 'cancelled'],
  ready_to_publish: ['published', 'cancelled'],
  published: [],
  declined: [],
  cancelled: [],
}

export class IllegalProofTransitionError extends Error {
  constructor(from: ProofRequestStatus, to: ProofRequestStatus) {
    super(`Cannot transition proof from "${from}" to "${to}"`)
    this.name = 'IllegalProofTransitionError'
  }
}

export class ProofPublicationGuardError extends Error {
  constructor(reason: string) {
    super(`Cannot publish proof: ${reason}`)
    this.name = 'ProofPublicationGuardError'
  }
}

export interface CreateProofRequestInput {
  scope: GrowthScope
  subjectKind: ProofRequest['subjectKind']
  subjectId: string
  proofKind: ProofRequest['proofKind']
  customerLabel?: string
  kpiBaselines?: ProofKpiBaseline[]
  id?: string
}

export function createProofRequest(input: CreateProofRequestInput): ProofRequest {
  const now = nowISO()
  const record: ProofRequest = {
    id: input.id ?? makeId('proof'),
    scope: input.scope,
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
    proofKind: input.proofKind,
    customerLabel: input.customerLabel,
    status: 'requested',
    kpiBaselines: input.kpiBaselines ?? [],
    createdAt: now,
    updatedAt: now,
  }
  return writeRecord(ENTITY, record.id, record, proofRequestSchema)
}

export function getProofRequest(id: string): ProofRequest | null {
  return readRecord(ENTITY, id, proofRequestSchema)
}

export function listProofRequests(
  scope?: GrowthScope,
  status?: ProofRequestStatus,
): ProofRequest[] {
  return listRecords(ENTITY, proofRequestSchema).filter((p) => {
    if (scope && scopeKey(p.scope) !== scopeKey(scope)) return false
    if (status && p.status !== status) return false
    return true
  })
}

export function transitionProofStatus(id: string, to: ProofRequestStatus): ProofRequest {
  const cur = readRecord(ENTITY, id, proofRequestSchema)
  if (!cur) throw new Error(`Proof request not found: ${id}`)
  if (cur.status === to) return cur
  if (!ALLOWED[cur.status].includes(to)) {
    throw new IllegalProofTransitionError(cur.status, to)
  }
  const updated: ProofRequest = { ...cur, status: to, updatedAt: nowISO() }
  return writeRecord(ENTITY, id, updated, proofRequestSchema)
}

export function recordPermission(id: string, permission: ProofPermission): ProofRequest {
  const cur = readRecord(ENTITY, id, proofRequestSchema)
  if (!cur) throw new Error(`Proof request not found: ${id}`)
  const updated: ProofRequest = {
    ...cur,
    permission,
    updatedAt: nowISO(),
  }
  return writeRecord(ENTITY, id, updated, proofRequestSchema)
}

export function recordQuote(id: string, text: string, attribution: string): ProofRequest {
  const cur = readRecord(ENTITY, id, proofRequestSchema)
  if (!cur) throw new Error(`Proof request not found: ${id}`)
  if (!text.trim()) throw new Error('Quote text cannot be empty')
  const updated: ProofRequest = {
    ...cur,
    quoteText: text,
    quoteAttribution: attribution,
    updatedAt: nowISO(),
  }
  return writeRecord(ENTITY, id, updated, proofRequestSchema)
}

export function recordKpiObservation(
  id: string,
  metric: string,
  observedValue: number,
): ProofRequest {
  const cur = readRecord(ENTITY, id, proofRequestSchema)
  if (!cur) throw new Error(`Proof request not found: ${id}`)
  const baselines = cur.kpiBaselines.map((b) =>
    b.metric === metric ? { ...b, observedValue, capturedAt: nowISO() } : b,
  )
  if (!baselines.some((b) => b.metric === metric)) {
    throw new Error(`No KPI baseline named "${metric}" on proof ${id}`)
  }
  const updated: ProofRequest = { ...cur, kpiBaselines: baselines, updatedAt: nowISO() }
  return writeRecord(ENTITY, id, updated, proofRequestSchema)
}

export function publishProof(id: string, ref: string): ProofRequest {
  const cur = readRecord(ENTITY, id, proofRequestSchema)
  if (!cur) throw new Error(`Proof request not found: ${id}`)
  if (cur.status !== 'ready_to_publish') {
    throw new IllegalProofTransitionError(cur.status, 'published')
  }
  if (!cur.permission) {
    throw new ProofPublicationGuardError('missing permission record')
  }
  const requiresQuote = ['testimonial', 'case_study', 'reference_call'].includes(cur.proofKind)
  if (requiresQuote && !cur.quoteText) {
    throw new ProofPublicationGuardError(`${cur.proofKind} requires a captured quote`)
  }
  const incompleteBaselines = cur.kpiBaselines.filter((b) => b.observedValue === undefined)
  if (cur.proofKind === 'case_study' && incompleteBaselines.length > 0) {
    throw new ProofPublicationGuardError(
      `case_study requires every KPI to have observedValue (${incompleteBaselines.length} missing)`,
    )
  }
  const now = nowISO()
  const updated: ProofRequest = {
    ...cur,
    status: 'published',
    publishedAt: now,
    publishedRef: ref,
    updatedAt: now,
  }
  return writeRecord(ENTITY, id, updated, proofRequestSchema)
}

/**
 * A subject is "proof-ready" if it has a published case_study OR testimonial.
 */
export function subjectProofReadiness(scope: GrowthScope, subjectId: string): {
  ready: boolean
  publishedKinds: Array<ProofRequest['proofKind']>
} {
  const published = listProofRequests(scope, 'published').filter((p) => p.subjectId === subjectId)
  const publishedKinds = published.map((p) => p.proofKind)
  const ready = publishedKinds.some((k) => k === 'testimonial' || k === 'case_study')
  return { ready, publishedKinds }
}
