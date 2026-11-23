// ─── @nzila/sage-core — transactional CLEAR accountability adoption ──────────
//
// Persists an explicit human adoption decision in the same transaction as
// institutional mandate admission. Never invents spend, acceptance, or cause.
// Never promotes a draft to an institutional conclusion without admission.

import type { SageSqlClient } from './sql-client'
import {
  adoptSageAccountabilityDraft,
  type SageAccountabilityAdoptionChoice,
  type SageAccountabilityAdoptionRecord,
} from './accountability-adoption'
import type { SageAccountabilityDraftOutput } from './accountability-draft'
import {
  executeInstitutionalActionInTransaction,
  type ExecuteInstitutionalActionResult,
  type SageInstitutionalActorFacts,
} from './institutional-mandate-enforcement'
import type { SageInstitutionalCapacityStore } from './institutional-capacity'
import { conflict, invalidInput } from './service-errors'

export type PersistAccountabilityAdoptionInput = {
  sql: SageSqlClient
  actor: SageInstitutionalActorFacts
  mandateId: string
  draft: SageAccountabilityDraftOutput
  choice: SageAccountabilityAdoptionChoice
  rationale: string
  /** ISO-8601 UTC from the trusted server clock. */
  adoptedAt: string
  idempotencyKey: string
  nextDecisionOwnerActorId?: string
  capacityStore?: SageInstitutionalCapacityStore | null
}

export type PersistAccountabilityAdoptionResult =
  | {
      admitted: true
      adoption: SageAccountabilityAdoptionRecord
      actionId: string
      adoptionId: string
      reusedExisting: boolean
      authorizationStatus: 'NEWLY_ADMITTED' | 'HISTORICALLY_RECORDED_NO_NEW_AUTHORIZATION'
    }
  | {
      admitted: false
      decision: Extract<ExecuteInstitutionalActionResult, { admitted: false }>['decision']
    }

async function findExistingAdoption(
  sql: SageSqlClient,
  input: {
    orgId: string
    resourceId: string
    mandateId: string
    actorId: string
    adoptedAt: string
  },
): Promise<{ id: string; institutional_action_id: string } | undefined> {
  const { rows } = await sql.query<{ id: string; institutional_action_id: string }>(
    `select id, institutional_action_id
       from sage_accountability_adoption
      where org_id = $1
        and resource_id = $2
        and mandate_id = $3::uuid
        and adopting_actor_id = $4
        and adopted_at = $5::timestamptz`,
    [input.orgId, input.resourceId, input.mandateId, input.actorId, input.adoptedAt],
  )
  return rows[0]
}

/**
 * Admit `decision.ratify` under the locked mandate and append an accountability
 * adoption row. Call inside an open SQL transaction.
 */
export async function persistSageAccountabilityAdoptionInTransaction(
  input: PersistAccountabilityAdoptionInput,
): Promise<PersistAccountabilityAdoptionResult> {
  const { draft, actor } = input
  if (draft.orgId !== actor.orgId) invalidInput('draft org must match actor org')
  if (draft.workspaceId !== actor.workspaceId) {
    invalidInput('draft workspace must match actor workspace')
  }
  if (!draft.resourceId.trim()) invalidInput('draft resource required')

  const actionResult = await executeInstitutionalActionInTransaction(input.sql, {
    actor,
    mandateId: input.mandateId,
    resourceId: draft.resourceId,
    action: 'decision.ratify',
    evaluatedAt: input.adoptedAt,
    idempotencyKey: input.idempotencyKey,
    capacityStore: input.capacityStore,
    safePayload: {
      accountabilityAdoption: true,
      choice: input.choice,
    },
  })

  if (!actionResult.admitted) {
    return { admitted: false, decision: actionResult.decision }
  }

  const adoption = adoptSageAccountabilityDraft({
    draft,
    choice: input.choice,
    adoptedAt: input.adoptedAt,
    adoptingActorId: actor.actorId,
    adoptingPositionId: actionResult.positionId,
    rationale: input.rationale,
    mandateDecision: actionResult.decision,
    nextDecisionOwnerActorId: input.nextDecisionOwnerActorId,
  })

  if (actionResult.reusedExisting) {
    const existing = await findExistingAdoption(input.sql, {
      orgId: actor.orgId,
      resourceId: draft.resourceId,
      mandateId: input.mandateId,
      actorId: actor.actorId,
      adoptedAt: input.adoptedAt,
    })
    if (!existing) {
      conflict('idempotent adoption replay requires an existing adoption row')
    }
    return {
      admitted: true,
      adoption,
      actionId: actionResult.actionId,
      adoptionId: existing.id,
      reusedExisting: true,
      authorizationStatus: 'HISTORICALLY_RECORDED_NO_NEW_AUTHORIZATION',
    }
  }

  const { rows } = await input.sql.query<{ id: string }>(
    `insert into sage_accountability_adoption (
       org_id, workspace_id, resource_id, status, choice, draft_status_preserved,
       adopting_actor_id, adopting_position_id, rationale,
       mandate_id, instrument_ref, instrument_version, institutional_action_id,
       next_decision_owner_actor_id, preserves_draft_facts, draft_snapshot_json, adopted_at
     ) values (
       $1, $2::uuid, $3, $4, $5, $6,
       $7, $8, $9,
       $10::uuid, $11, $12, $13::uuid,
       $14, true, $15::jsonb, $16::timestamptz
     )
     returning id`,
    [
      adoption.orgId,
      adoption.workspaceId,
      adoption.resourceId,
      adoption.status,
      adoption.choice,
      adoption.draftStatusPreserved,
      adoption.adoptingActorId,
      adoption.adoptingPositionId,
      adoption.rationale,
      adoption.mandateId,
      adoption.instrumentRef,
      adoption.instrumentVersion,
      actionResult.actionId,
      adoption.nextDecisionOwnerActorId,
      JSON.stringify({
        status: draft.status,
        executionDisposition: draft.executionDisposition,
        openEvidenceTasks: draft.openEvidenceTasks,
        commitment: draft.commitment,
        outcome: draft.outcome,
        differingInterpretations: draft.differingInterpretations,
      }),
      adoption.adoptedAt,
    ],
  )
  if (rows.length !== 1) conflict('failed to persist accountability adoption')

  return {
    admitted: true,
    adoption,
    actionId: actionResult.actionId,
    adoptionId: rows[0]!.id,
    reusedExisting: false,
    authorizationStatus: 'NEWLY_ADMITTED',
  }
}
