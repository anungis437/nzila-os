/**
 * Policy Governance Events Service — Durable, fail-closed event recording.
 *
 * Every policy lifecycle action MUST produce a governance event.
 * Failure to record the event is treated as a transaction failure — the
 * caller must not proceed as if the transition succeeded.
 *
 * This is the institutional chronology layer:
 *  "What happened to this policy, in what order, by whom, with what rationale?"
 *
 * Events are append-only (UPDATE/DELETE blocked by DB trigger).
 * Reconstruction of historical governance state is performed by
 * replaying events forward from the earliest recorded event.
 */
import 'server-only'

import { createLogger } from '@nzila/os-core'
import {
  policyGovernanceEvents,
  type NewPolicyGovernanceEventRow,
  type PolicyGovernanceEventRow,
} from '@nzila/db/schema'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'

import type { PolicyLifecycleState } from './policy-lifecycle'

const logger = createLogger('control-plane:authority:policy-governance-events')

// ── DB type ───────────────────────────────────────────────────────────────────
// The caller provides the Drizzle DB instance. This service has no module-level
// state.

type AnyDB = any

// ── Recording ────────────────────────────────────────────────────────────────

export interface RecordGovernanceEventInput {
  orgId?: string | null
  policyId: string
  policyVersion: string
  domain: string
  eventType: NewPolicyGovernanceEventRow['eventType']
  actorUserId?: string | null
  actorRole?: string | null
  previousState?: PolicyLifecycleState | null
  nextState?: PolicyLifecycleState | null
  contentHash?: string | null
  payload?: Record<string, unknown>
  correlationId?: string | null
  traceId?: string | null
}

/**
 * Record a policy governance event.
 *
 * FAIL-CLOSED: if the INSERT fails for any reason, this function rethrows.
 * The caller must treat event recording failure as a state transition failure.
 * Never swallow this error.
 */
export async function recordGovernanceEvent(
  input: RecordGovernanceEventInput,
  db: AnyDB,
): Promise<PolicyGovernanceEventRow> {
  const row: NewPolicyGovernanceEventRow = {
    orgId: input.orgId ?? null,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    domain: input.domain,
    eventType: input.eventType,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    previousState: input.previousState ?? null,
    nextState: input.nextState ?? null,
    contentHash: input.contentHash ?? null,
    payload: input.payload ?? {},
    correlationId: input.correlationId ?? null,
    traceId: input.traceId ?? null,
  }

  try {
    const [inserted] = await db
      .insert(policyGovernanceEvents)
      .values(row)
      .returning()
    logger.info('governance event recorded', {
      eventType: row.eventType,
      policyId: row.policyId,
      policyVersion: row.policyVersion,
    })
    return inserted as PolicyGovernanceEventRow
  } catch (err) {
    logger.error('FAIL-CLOSED: governance event recording failed', {
      eventType: row.eventType,
      policyId: row.policyId,
      error: err,
    })
    throw err
  }
}

// ── Querying ──────────────────────────────────────────────────────────────────

export interface GovernanceEventFilter {
  policyId?: string
  orgId?: string | null
  domain?: string
  eventType?: NewPolicyGovernanceEventRow['eventType']
  fromDate?: Date
  toDate?: Date
  limit?: number
  offset?: number
}

export interface PaginatedGovernanceEvents {
  events: PolicyGovernanceEventRow[]
  total: number
}

export async function queryGovernanceEvents(
  filter: GovernanceEventFilter,
  db: AnyDB,
): Promise<PaginatedGovernanceEvents> {
  const conditions = []
  if (filter.policyId) conditions.push(eq(policyGovernanceEvents.policyId, filter.policyId))
  if (filter.orgId !== undefined) {
    conditions.push(filter.orgId === null
      ? sql`${policyGovernanceEvents.orgId} IS NULL`
      : eq(policyGovernanceEvents.orgId, filter.orgId))
  }
  if (filter.domain) conditions.push(eq(policyGovernanceEvents.domain, filter.domain))
  if (filter.eventType) conditions.push(eq(policyGovernanceEvents.eventType, filter.eventType))
  if (filter.fromDate) conditions.push(gte(policyGovernanceEvents.createdAt, filter.fromDate))
  if (filter.toDate) conditions.push(lte(policyGovernanceEvents.createdAt, filter.toDate))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [events, countResult] = await Promise.all([
    db
      .select()
      .from(policyGovernanceEvents)
      .where(where)
      .orderBy(desc(policyGovernanceEvents.createdAt))
      .limit(filter.limit ?? 50)
      .offset(filter.offset ?? 0),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(policyGovernanceEvents)
      .where(where),
  ])

  return {
    events: events as PolicyGovernanceEventRow[],
    total: Number(countResult[0]?.count ?? 0),
  }
}

/**
 * Get the full chronological event history for a single policy.
 * Returns events in ascending order (oldest first) for chronological replay.
 */
export async function getEventsByPolicy(
  policyId: string,
  db: AnyDB,
): Promise<PolicyGovernanceEventRow[]> {
  const events = await db
    .select()
    .from(policyGovernanceEvents)
    .where(eq(policyGovernanceEvents.policyId, policyId))
    .orderBy(policyGovernanceEvents.createdAt)
  return events as PolicyGovernanceEventRow[]
}

/**
 * Reconstruct the policy lifecycle state at a specific historical timestamp
 * by replaying governance events forward from the earliest recorded event.
 *
 * This is the event-replay fallback. Use getSnapshotAt() from
 * policy-snapshot-service for O(1) lookup when sub-second precision is
 * not required.
 */
export async function reconstructPolicyStateAt(
  policyId: string,
  at: Date,
  db: AnyDB,
): Promise<PolicyLifecycleState | null> {
  const events = await db
    .select()
    .from(policyGovernanceEvents)
    .where(
      and(
        eq(policyGovernanceEvents.policyId, policyId),
        lte(policyGovernanceEvents.createdAt, at),
      ),
    )
    .orderBy(policyGovernanceEvents.createdAt)

  let state: PolicyLifecycleState | null = null
  for (const event of events as PolicyGovernanceEventRow[]) {
    if (event.nextState) {
      state = event.nextState as PolicyLifecycleState
    }
  }
  return state
}
