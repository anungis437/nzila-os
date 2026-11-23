// ─── @nzila/sage-core — transactional institutional mandate enforcement ──────
//
// Wires evaluateSageInstitutionalMandate into the SAME authoritative SQL
// transaction as the consequential mutation and append-only action evidence.
// Browser may supply mandateId + requested amount + idempotency key only.
// Verification status, ledger totals, issuer, and dates come from the store.

import type { SageSqlClient } from './sql-client'
import {
  evaluateSageInstitutionalMandate,
  type SageInstitutionalAction,
  type SageInstitutionalMandateDecision,
  type SageVerifiedInstitutionalMandate,
} from './institutional-authority'
import {
  lockInstitutionalMandateForUpdate,
  sumResourceCommitmentsMinor,
  type SageInstitutionalActionRow,
  type SageResourceCommitmentRow,
} from './institutional-mandate-store'
import {
  resolveInstitutionalCapacityForAdmission,
  type SageInstitutionalCapacityStore,
} from './institutional-capacity'
import { conflict, forbidden, invalidInput } from './service-errors'

export type SageInstitutionalActorFacts = {
  orgId: string
  workspaceId: string
  actorId: string
  actorKind: 'human' | 'service' | 'system'
  authenticated: boolean
  activeWorkspaceMembership: boolean
  applicationPermissionGranted: boolean
  /**
   * Optional browser-claimed position. Never authoritative — must match the
   * locked mandate office after server capacity resolution.
   */
  claimedPositionId?: string | null
  /**
   * Pre-verified conflict/recusal when no capacity store is supplied.
   * `null` fails closed. Prefer `capacityStore` for live HTTP paths.
   */
  conflictOrRecusal?: boolean | null
}

export type ExecuteInstitutionalActionInput = {
  actor: SageInstitutionalActorFacts
  mandateId: string
  resourceId: string
  action: SageInstitutionalAction
  /** ISO-8601 UTC from the trusted server clock. */
  evaluatedAt: string
  idempotencyKey: string
  /** Client-requested commitment increment for resource.commit only. */
  requestedCommitMinor?: number
  safePayload?: Record<string, unknown>
  /**
   * Server capacity/recusal store. When provided, position and conflict are
   * resolved from it (fail closed if unavailable). When omitted, callers must
   * pass a non-null `actor.conflictOrRecusal` that was already server-verified.
   */
  capacityStore?: SageInstitutionalCapacityStore | null
}

export type ExecuteInstitutionalActionResult =
  | {
      admitted: true
      decision: Extract<SageInstitutionalMandateDecision, { allowed: true }>
      /** Server-resolved office used for admission (never browser-authoritative). */
      positionId: string
      actionId: string
      commitmentId: string | null
      totalCommittedMinorAfterAction: number | null
      reusedExisting: boolean
      /** Explicit: replay does not grant fresh authority. */
      authorizationStatus: 'NEWLY_ADMITTED' | 'HISTORICALLY_RECORDED_NO_NEW_AUTHORIZATION'
    }
  | {
      admitted: false
      decision: Extract<SageInstitutionalMandateDecision, { allowed: false }>
    }

function requireIdempotencyKey(value: string): string {
  if (!value.trim() || value.length > 200) invalidInput('idempotency key required')
  return value.trim()
}

async function findExistingAction(
  sql: SageSqlClient,
  input: {
    orgId: string
    resourceId: string
    action: SageInstitutionalAction
    idempotencyKey: string
  },
): Promise<SageInstitutionalActionRow | undefined> {
  const { rows } = await sql.query<SageInstitutionalActionRow>(
    `select *
       from sage_institutional_action
      where org_id = $1
        and resource_id = $2
        and action = $3::sage_institutional_action_kind
        and idempotency_key = $4`,
    [input.orgId, input.resourceId, input.action, input.idempotencyKey],
  )
  return rows[0]
}

/**
 * Admit and execute a consequential institutional action under a locked mandate.
 *
 * Callers must invoke this inside an open SQL transaction (BEGIN … COMMIT) so
 * the FOR UPDATE lock, ledger read, commitment insert and action insert share
 * one atomic boundary. Revocation mid-flight is serialized by the lock.
 */
export async function executeInstitutionalActionInTransaction(
  sql: SageSqlClient,
  input: ExecuteInstitutionalActionInput,
): Promise<ExecuteInstitutionalActionResult> {
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey)
  const actor = input.actor

  if (!actor.orgId.trim() || !actor.workspaceId.trim() || !input.resourceId.trim()) {
    invalidInput('institutional action requires org, workspace and resource')
  }

  const existing = await findExistingAction(sql, {
    orgId: actor.orgId,
    resourceId: input.resourceId,
    action: input.action,
    idempotencyKey,
  })
  if (existing && (existing.mandate_id !== input.mandateId || existing.actor_id !== actor.actorId)) {
    conflict('idempotency key already used for a different institutional action')
  }

  // Always lock + re-evaluate current authority — including idempotent replay —
  // so a revoked/suspended actor cannot retrieve a fresh "admitted" result.
  const mandate = await lockInstitutionalMandateForUpdate(sql, {
    orgId: actor.orgId,
    workspaceId: actor.workspaceId,
    mandateId: input.mandateId,
  })

  let conflictOrRecusal: boolean | null
  let currentPositionId: string

  if (input.capacityStore !== undefined) {
    const capacity = await resolveInstitutionalCapacityForAdmission(input.capacityStore, {
      orgId: actor.orgId,
      workspaceId: actor.workspaceId,
      actorId: actor.actorId,
      resourceId: input.resourceId,
      action: input.action,
      mandateId: input.mandateId,
      mandatePositionId: mandate.positionId,
      claimedPositionId: actor.claimedPositionId,
    })
    if (!capacity.resolved) {
      const reason =
        capacity.reason === 'CONFLICT_DATA_UNAVAILABLE' ||
        capacity.reason === 'CAPACITY_DATA_UNAVAILABLE'
          ? 'CONFLICT_DATA_UNAVAILABLE'
          : 'MANDATE_SCOPE_MISMATCH'
      return { admitted: false, decision: { allowed: false, reason } }
    }
    conflictOrRecusal = capacity.conflictOrRecusal
    currentPositionId = capacity.currentPositionId
  } else {
    if (actor.conflictOrRecusal === undefined || actor.conflictOrRecusal === null) {
      return {
        admitted: false,
        decision: { allowed: false, reason: 'CONFLICT_DATA_UNAVAILABLE' },
      }
    }
    if (
      actor.claimedPositionId != null &&
      actor.claimedPositionId.trim() !== '' &&
      actor.claimedPositionId !== mandate.positionId
    ) {
      return {
        admitted: false,
        decision: { allowed: false, reason: 'MANDATE_SCOPE_MISMATCH' },
      }
    }
    conflictOrRecusal = actor.conflictOrRecusal
    // Office/position is bound to the locked mandate — never a free browser choice.
    currentPositionId = mandate.positionId
  }

  let commitment:
    | { currency: string; totalCommittedMinorAfterAction: number }
    | undefined
  let requestedCommitMinor: number | undefined

  if (input.action === 'resource.commit') {
    requestedCommitMinor = input.requestedCommitMinor
    if (
      requestedCommitMinor === undefined ||
      !Number.isSafeInteger(requestedCommitMinor) ||
      requestedCommitMinor <= 0
    ) {
      invalidInput('resource.commit requires a positive server-checked amount')
    }
    if (!mandate.currency) {
      return {
        admitted: false,
        decision: { allowed: false, reason: 'FINANCIAL_SCOPE_INVALID' },
      }
    }
    const prior = await sumResourceCommitmentsMinor(sql, {
      orgId: actor.orgId,
      resourceId: input.resourceId,
      currency: mandate.currency,
    })
    commitment = {
      currency: mandate.currency,
      totalCommittedMinorAfterAction: prior + requestedCommitMinor,
    }
  } else if (input.requestedCommitMinor !== undefined) {
    invalidInput('commitment amount is only valid for resource.commit')
  }

  const decision = evaluateSageInstitutionalMandate(
    {
      orgId: actor.orgId,
      actorId: actor.actorId,
      actorKind: actor.actorKind,
      currentPositionId,
      resourceId: input.resourceId,
      action: input.action,
      mandateId: input.mandateId,
      evaluatedAt: input.evaluatedAt,
      commitment,
      authenticated: actor.authenticated,
      activeWorkspaceMembership: actor.activeWorkspaceMembership,
      applicationPermissionGranted: actor.applicationPermissionGranted,
      conflictOrRecusal,
    },
    [mandate],
  )

  if (!decision.allowed) {
    // Do not disclose historic action ids to a currently unauthorized actor.
    return { admitted: false, decision }
  }

  if (existing) {
    return {
      admitted: true,
      reusedExisting: true,
      authorizationStatus: 'HISTORICALLY_RECORDED_NO_NEW_AUTHORIZATION',
      positionId: currentPositionId,
      actionId: existing.id,
      commitmentId: existing.commitment_id,
      totalCommittedMinorAfterAction: null,
      decision,
    }
  }

  let commitmentId: string | null = null
  if (input.action === 'resource.commit' && commitment && requestedCommitMinor !== undefined) {
    const { rows } = await sql.query<SageResourceCommitmentRow>(
      `insert into sage_resource_commitment (
         org_id, workspace_id, resource_id, mandate_id, currency, amount_minor,
         idempotency_key, committed_by_actor_id, committed_at, instrument_ref, instrument_version
       ) values (
         $1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10, $11
       )
       returning *`,
      [
        actor.orgId,
        actor.workspaceId,
        input.resourceId,
        mandate.id,
        commitment.currency,
        requestedCommitMinor,
        idempotencyKey,
        actor.actorId,
        input.evaluatedAt,
        decision.instrumentRef,
        decision.instrumentVersion,
      ],
    )
    if (rows.length !== 1) conflict('failed to record resource commitment')
    commitmentId = rows[0]!.id
  }

  const { rows: actionRows } = await sql.query<SageInstitutionalActionRow>(
    `insert into sage_institutional_action (
       org_id, workspace_id, mandate_id, action, resource_id, actor_id, position_id,
       instrument_ref, instrument_version, idempotency_key, decision_reason,
       commitment_id, safe_payload_json, occurred_at
     ) values (
       $1, $2, $3, $4::sage_institutional_action_kind, $5, $6, $7,
       $8, $9, $10, $11, $12, $13::jsonb, $14::timestamptz
     )
     returning *`,
    [
      actor.orgId,
      actor.workspaceId,
      mandate.id,
      input.action,
      input.resourceId,
      actor.actorId,
      currentPositionId,
      decision.instrumentRef,
      decision.instrumentVersion,
      idempotencyKey,
      decision.reason,
      commitmentId,
      JSON.stringify(input.safePayload ?? {}),
      input.evaluatedAt,
    ],
  )
  if (actionRows.length !== 1) conflict('failed to record institutional action')

  return {
    admitted: true,
    reusedExisting: false,
    authorizationStatus: 'NEWLY_ADMITTED',
    positionId: currentPositionId,
    actionId: actionRows[0]!.id,
    commitmentId,
    totalCommittedMinorAfterAction: commitment?.totalCommittedMinorAfterAction ?? null,
    decision,
  }
}

/**
 * Governed refusal helper: maps internal denial reasons to a stable public code
 * without leaking instrument internals to unauthorized callers.
 */
export function publicInstitutionalRefusal(
  decision: Extract<SageInstitutionalMandateDecision, { allowed: false }>,
): { code: 'INSTITUTIONAL_AUTHORITY_DENIED'; reason: typeof decision.reason } {
  return { code: 'INSTITUTIONAL_AUTHORITY_DENIED', reason: decision.reason }
}

/** Convenience: refuse when a loaded mandate fails admission before mutation. */
export function assertMandateAdmitted(
  decision: SageInstitutionalMandateDecision,
  mandate: SageVerifiedInstitutionalMandate,
): asserts decision is Extract<SageInstitutionalMandateDecision, { allowed: true }> {
  if (!decision.allowed) {
    forbidden(`institutional authority denied: ${decision.reason}`)
  }
  if (decision.mandateId !== mandate.id) {
    conflict('mandate admission mismatch')
  }
}
