/**
 * Governed Policy Service — Lifecycle-aware, fail-closed policy management.
 *
 * All policy state changes flow through this service. No direct DB writes
 * are permitted outside this module. Every state change is:
 *  1. Validated against the FSM
 *  2. Committed to the DB
 *  3. Recorded as an immutable governance event
 *
 * Policies are IMMUTABLE governed artifacts.
 * New version = new row. Never mutate existing rows (except allowed status fields).
 * The superseded_by FK chains the lineage.
 */
import 'server-only'

import { createLogger } from '@nzila/os-core'
import {
  governedPolicies,
  policyGovernanceEvents,
  type GovernedPolicyRow,
  type NewGovernedPolicyRow,
  type NewPolicyGovernanceEventRow,
} from '@nzila/db/schema'
import { eq, and, isNull, desc, sql } from 'drizzle-orm'

import {
  validateTransition,
  type PolicyLifecycleState,
} from './policy-lifecycle'
import {
  computeContentHash,
  assertIntegrityOrThrow,
  type PolicyCanonicalPayload,
} from './policy-integrity'
import { recordGovernanceEvent } from './policy-governance-events-service'

const logger = createLogger('control-plane:authority:governed-policy-service')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDB = any

// ── Create ────────────────────────────────────────────────────────────────────

export interface CreatePolicyDraftInput {
  policyFamilyId: string
  semver: string
  name: string
  domain: string
  orgId?: string | null
  workflowBindings?: unknown
  operationalScope?: unknown
  authorId: string
  authorRole: string
  governanceRationale: string
  riskClassification?: NewGovernedPolicyRow['riskClassification']
  reviewCadenceDays?: number
  replayCompatibilityVersion?: string
  effectiveFrom?: Date | null
  effectiveUntil?: Date | null
}

/**
 * Create a new policy draft.
 * The new row starts in `draft` state with no content hash.
 */
export async function createPolicyDraft(
  input: CreatePolicyDraftInput,
  actorId: string,
  db: AnyDB,
  correlationId?: string,
): Promise<GovernedPolicyRow> {
  const [row] = await db
    .insert(governedPolicies)
    .values({
      policyFamilyId: input.policyFamilyId,
      semver: input.semver,
      name: input.name,
      domain: input.domain,
      orgId: input.orgId ?? null,
      workflowBindings: input.workflowBindings ?? [],
      operationalScope: input.operationalScope ?? {},
      authorId: input.authorId,
      authorRole: input.authorRole,
      governanceRationale: input.governanceRationale,
      riskClassification: input.riskClassification ?? 'medium',
      reviewCadenceDays: input.reviewCadenceDays ?? 365,
      replayCompatibilityVersion: input.replayCompatibilityVersion ?? '1',
      lifecycleStatus: 'draft',
      effectiveFrom: input.effectiveFrom ?? null,
      effectiveUntil: input.effectiveUntil ?? null,
    } satisfies NewGovernedPolicyRow)
    .returning()

  await recordGovernanceEvent(
    {
      policyId: row.id,
      policyVersion: row.semver,
      domain: row.domain,
      orgId: row.orgId,
      eventType: 'policy.created',
      actorUserId: actorId,
      actorRole: input.authorRole,
      previousState: null,
      nextState: 'draft',
      correlationId,
    },
    db,
  )

  logger.info('policy draft created', { policyId: row.id, semver: row.semver })
  return row as GovernedPolicyRow
}

// ── Version lineage ───────────────────────────────────────────────────────────

export interface PublishNewVersionInput extends CreatePolicyDraftInput {
  /** ID of the policy row being superseded by this new version. */
  supersededPolicyId: string
}

/**
 * Publish a new version of an existing policy family, superseding the current head.
 *
 * This creates a NEW ROW (the new version) and updates `superseded_by` on the
 * previous head row to point at the new version.
 */
export async function publishNewVersion(
  input: PublishNewVersionInput,
  actorId: string,
  db: AnyDB,
  correlationId?: string,
): Promise<GovernedPolicyRow> {
  // Verify the superseded policy exists
  const [previous] = await db
    .select()
    .from(governedPolicies)
    .where(eq(governedPolicies.id, input.supersededPolicyId))
    .limit(1)

  if (!previous) {
    throw new Error(
      `[governed-policy-service] Cannot supersede: policy ${input.supersededPolicyId} not found.`,
    )
  }

  // Create the new version as a draft (lifecycle will proceed through FSM)
  const newRow = await createPolicyDraft(
    { ...input, orgId: input.orgId ?? (previous as GovernedPolicyRow).orgId },
    actorId,
    db,
    correlationId,
  )

  // Update the superseded_by FK on the previous version
  await db
    .update(governedPolicies)
    .set({ supersededBy: newRow.id })
    .where(eq(governedPolicies.id, input.supersededPolicyId))

  logger.info('new policy version created', {
    supersededId: input.supersededPolicyId,
    newId: newRow.id,
    semver: newRow.semver,
  })

  return newRow
}

// ── State transitions ─────────────────────────────────────────────────────────

/**
 * Transition a policy to a new lifecycle state.
 *
 * Validates the FSM, computes the content hash on publish, verifies integrity
 * before activation, and always records a governance event.
 *
 * FAIL-CLOSED:
 *  - If the transition is invalid, throws immediately
 *  - If content_hash is missing at publish, throws
 *  - If integrity check fails at activation, throws
 *  - If governance event recording fails, rethrows
 */
export async function transitionState(
  policyId: string,
  targetState: PolicyLifecycleState,
  actorId: string,
  actorRole: string,
  db: AnyDB,
  options?: {
    correlationId?: string
    traceId?: string
    payload?: Record<string, unknown>
  },
): Promise<GovernedPolicyRow> {
  const [current] = await db
    .select()
    .from(governedPolicies)
    .where(eq(governedPolicies.id, policyId))
    .limit(1)

  if (!current) {
    throw new Error(`[governed-policy-service] Policy ${policyId} not found.`)
  }

  const currentState = (current as GovernedPolicyRow).lifecycleStatus as PolicyLifecycleState

  // FSM validation — throws descriptively if invalid
  validateTransition(currentState, targetState)

  // Pre-flight checks for specific transitions
  const updates: Partial<GovernedPolicyRow> & { lifecycleStatus: PolicyLifecycleState } = {
    lifecycleStatus: targetState,
  }

  if (targetState === 'published') {
    // Compute and freeze the content hash at publish time
    const hash = computeAndFreezeHash(current as GovernedPolicyRow)
    updates.contentHash = hash
    updates.integrityVerified = true
    updates.publishedAt = new Date()
    logger.info('content hash computed at publish', { policyId, hash: hash.slice(0, 16) })
  }

  if (targetState === 'active') {
    // Fail-closed: require valid hash before activation
    const policy = current as GovernedPolicyRow
    const payload = buildCanonicalPayload(policy)
    assertIntegrityOrThrow(payload, policy.contentHash)
    updates.activatedAt = new Date()
  }

  if (targetState === 'deprecated') updates.deprecatedAt = new Date()
  if (targetState === 'revoked')     updates.revokedAt = new Date()
  if (targetState === 'archived')    updates.archivedAt = new Date()

  // Apply update
  const [updated] = await db
    .update(governedPolicies)
    .set(updates)
    .where(eq(governedPolicies.id, policyId))
    .returning()

  // Record governance event (FAIL-CLOSED — rethrows on failure)
  await recordGovernanceEvent(
    {
      policyId,
      policyVersion: (current as GovernedPolicyRow).semver,
      domain: (current as GovernedPolicyRow).domain,
      orgId: (current as GovernedPolicyRow).orgId,
      eventType: stateToEventType(targetState),
      actorUserId: actorId,
      actorRole,
      previousState: currentState,
      nextState: targetState,
      contentHash: (updated as GovernedPolicyRow).contentHash,
      payload: options?.payload,
      correlationId: options?.correlationId,
      traceId: options?.traceId,
    },
    db,
  )

  logger.info('policy state transitioned', {
    policyId,
    from: currentState,
    to: targetState,
  })

  return updated as GovernedPolicyRow
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function getActivePolicy(
  policyId: string,
  db: AnyDB,
): Promise<GovernedPolicyRow | null> {
  const [row] = await db
    .select()
    .from(governedPolicies)
    .where(
      and(
        eq(governedPolicies.id, policyId),
        eq(governedPolicies.lifecycleStatus, 'active'),
      ),
    )
    .limit(1)
  return (row ?? null) as GovernedPolicyRow | null
}

export async function getPolicyById(policyId: string, db: AnyDB): Promise<GovernedPolicyRow | null> {
  const [row] = await db
    .select()
    .from(governedPolicies)
    .where(eq(governedPolicies.id, policyId))
    .limit(1)
  return (row ?? null) as GovernedPolicyRow | null
}

/**
 * Get the full version history for a policy family, ordered from newest to oldest.
 */
export async function getPolicyVersionHistory(
  policyFamilyId: string,
  db: AnyDB,
): Promise<GovernedPolicyRow[]> {
  const rows = await db
    .select()
    .from(governedPolicies)
    .where(eq(governedPolicies.policyFamilyId, policyFamilyId))
    .orderBy(desc(governedPolicies.createdAt))
  return rows as GovernedPolicyRow[]
}

/**
 * Get all active policies for a given domain.
 */
export async function getActivePoliciesForDomain(
  domain: string,
  db: AnyDB,
): Promise<GovernedPolicyRow[]> {
  const rows = await db
    .select()
    .from(governedPolicies)
    .where(
      and(
        eq(governedPolicies.domain, domain),
        eq(governedPolicies.lifecycleStatus, 'active'),
      ),
    )
    .orderBy(desc(governedPolicies.createdAt))
  return rows as GovernedPolicyRow[]
}

/**
 * Get all policies in a lifecycle status that match a given workflow binding.
 * Used by policy-registry bootstrapFromDB.
 */
export async function getPoliciesForWorkflow(
  workflowId: string,
  statuses: PolicyLifecycleState[],
  db: AnyDB,
): Promise<GovernedPolicyRow[]> {
  const rows = await db
    .select()
    .from(governedPolicies)
    .where(
      sql`${governedPolicies.workflowBindings} @> ${JSON.stringify([workflowId])}::jsonb
          AND ${governedPolicies.lifecycleStatus} = ANY(${statuses})`
    )
  return rows as GovernedPolicyRow[]
}

// ── Hash computation ──────────────────────────────────────────────────────────

/**
 * Compute the content hash for a policy row and return it.
 * Does NOT persist the hash — call transitionState('published') to freeze it.
 */
export function computeAndFreezeHash(policy: GovernedPolicyRow): string {
  const payload = buildCanonicalPayload(policy)
  return computeContentHash(payload)
}

function buildCanonicalPayload(policy: GovernedPolicyRow): PolicyCanonicalPayload {
  return {
    policyFamilyId: policy.policyFamilyId,
    semver: policy.semver,
    name: policy.name,
    domain: policy.domain,
    workflowBindings: policy.workflowBindings,
    operationalScope: policy.operationalScope,
    governanceRationale: policy.governanceRationale,
    riskClassification: policy.riskClassification,
    reviewCadenceDays: policy.reviewCadenceDays,
    replayCompatibilityVersion: policy.replayCompatibilityVersion,
    effectiveFrom: policy.effectiveFrom?.toISOString() ?? null,
    effectiveUntil: policy.effectiveUntil?.toISOString() ?? null,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stateToEventType(
  state: PolicyLifecycleState,
): NewPolicyGovernanceEventRow['eventType'] {
  const map: Record<PolicyLifecycleState, NewPolicyGovernanceEventRow['eventType']> = {
    draft:              'policy.created',
    review_pending:     'policy.submitted_for_review',
    approval_required:  'policy.approval_requested',
    approved:           'policy.approved',
    published:          'policy.published',
    active:             'policy.activated',
    superseded:         'policy.superseded',
    deprecated:         'policy.deprecated',
    revoked:            'policy.revoked',
    archived:           'policy.archived',
  }
  return map[state] ?? 'policy.created'
}
