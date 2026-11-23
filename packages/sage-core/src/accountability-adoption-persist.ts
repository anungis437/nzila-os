// ─── @nzila/sage-core — transactional CLEAR accountability adoption ──────────
//
// Persists an explicit human adoption decision in the same transaction as
// institutional mandate admission. Never invents spend, acceptance, or cause.
// Never promotes a draft to an institutional conclusion without admission.
// Idempotent replay returns the persisted original or CONFLICT — never a
// reconstructed decision from a mutated request.

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
import { institutionalActionPayloadFingerprint } from './institutional-action-fingerprint'
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

type AdoptionRow = {
  id: string
  org_id: string
  workspace_id: string
  resource_id: string
  status: SageAccountabilityAdoptionRecord['status']
  choice: SageAccountabilityAdoptionChoice
  draft_status_preserved: 'DRAFT_REQUIRES_HUMAN_ADOPTION'
  adopting_actor_id: string
  adopting_position_id: string
  rationale: string
  mandate_id: string
  instrument_ref: string
  instrument_version: string
  institutional_action_id: string
  next_decision_owner_actor_id: string | null
  preserves_draft_facts: boolean
  draft_snapshot_json: unknown
  adopted_at: string | Date
  request_fingerprint: string | null
}

function draftFingerprint(draft: SageAccountabilityDraftOutput): string {
  return institutionalActionPayloadFingerprint({
    action: 'accountability.draft',
    mandateId: 'n/a',
    resourceId: draft.resourceId,
    requestedCommitMinor: null,
    durablePayload: {
      status: draft.status,
      orgId: draft.orgId,
      workspaceId: draft.workspaceId,
      executionDisposition: draft.executionDisposition,
      openEvidenceTasks: draft.openEvidenceTasks,
      commitment: draft.commitment,
      outcome: draft.outcome,
      differingInterpretations: draft.differingInterpretations,
      nextDecisionOwnerActorId: draft.nextDecisionOwnerActorId,
    },
  })
}

function adoptionDurablePayload(input: {
  choice: SageAccountabilityAdoptionChoice
  rationale: string
  draft: SageAccountabilityDraftOutput
  nextDecisionOwnerActorId?: string
}): Record<string, unknown> {
  return {
    accountabilityAdoption: true,
    choice: input.choice,
    rationale: input.rationale.trim(),
    draftFingerprint: draftFingerprint(input.draft),
    nextDecisionOwnerActorId: input.nextDecisionOwnerActorId?.trim() || null,
  }
}

function mapAdoptionRow(row: AdoptionRow): SageAccountabilityAdoptionRecord {
  const adoptedAt =
    row.adopted_at instanceof Date ? row.adopted_at.toISOString() : String(row.adopted_at)
  return {
    status: row.status,
    orgId: row.org_id,
    workspaceId: row.workspace_id,
    resourceId: row.resource_id,
    draftStatusPreserved: 'DRAFT_REQUIRES_HUMAN_ADOPTION',
    choice: row.choice,
    adoptedAt: adoptedAt.includes('.') ? adoptedAt : adoptedAt.replace('Z', '.000Z'),
    adoptingActorId: row.adopting_actor_id,
    adoptingPositionId: row.adopting_position_id,
    rationale: row.rationale,
    mandateId: row.mandate_id,
    instrumentRef: row.instrument_ref,
    instrumentVersion: row.instrument_version,
    nextDecisionOwnerActorId: row.next_decision_owner_actor_id,
    preservesDraftFacts: true,
  }
}

async function loadAdoptionByActionId(
  sql: SageSqlClient,
  input: { orgId: string; actionId: string },
): Promise<AdoptionRow | undefined> {
  const { rows } = await sql.query<AdoptionRow>(
    `select *
       from sage_accountability_adoption
      where org_id = $1
        and institutional_action_id = $2::uuid`,
    [input.orgId, input.actionId],
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

  const durablePayload = adoptionDurablePayload({
    choice: input.choice,
    rationale: input.rationale,
    draft,
    nextDecisionOwnerActorId: input.nextDecisionOwnerActorId,
  })
  const requestFingerprint = institutionalActionPayloadFingerprint({
    action: 'decision.ratify',
    mandateId: input.mandateId,
    resourceId: draft.resourceId,
    requestedCommitMinor: null,
    durablePayload,
  })

  const actionResult = await executeInstitutionalActionInTransaction(input.sql, {
    actor,
    mandateId: input.mandateId,
    resourceId: draft.resourceId,
    action: 'decision.ratify',
    evaluatedAt: input.adoptedAt,
    idempotencyKey: input.idempotencyKey,
    capacityStore: input.capacityStore,
    safePayload: durablePayload,
  })

  if (!actionResult.admitted) {
    return { admitted: false, decision: actionResult.decision }
  }

  if (actionResult.reusedExisting) {
    const existing = await loadAdoptionByActionId(input.sql, {
      orgId: actor.orgId,
      actionId: actionResult.actionId,
    })
    if (!existing) {
      conflict('idempotent adoption replay requires an existing adoption row')
    }
    if (
      existing.request_fingerprint &&
      existing.request_fingerprint !== requestFingerprint
    ) {
      conflict('idempotency key replay payload does not match the original adoption')
    }
    // Always return the persisted original — never a reconstructed mutated request.
    return {
      admitted: true,
      adoption: mapAdoptionRow(existing),
      actionId: actionResult.actionId,
      adoptionId: existing.id,
      reusedExisting: true,
      authorizationStatus: 'HISTORICALLY_RECORDED_NO_NEW_AUTHORIZATION',
    }
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

  const { rows } = await input.sql.query<{ id: string }>(
    `insert into sage_accountability_adoption (
       org_id, workspace_id, resource_id, status, choice, draft_status_preserved,
       adopting_actor_id, adopting_position_id, rationale,
       mandate_id, instrument_ref, instrument_version, institutional_action_id,
       next_decision_owner_actor_id, preserves_draft_facts, draft_snapshot_json,
       adopted_at, request_fingerprint
     ) values (
       $1, $2::uuid, $3, $4, $5, $6,
       $7, $8, $9,
       $10::uuid, $11, $12, $13::uuid,
       $14, true, $15::jsonb,
       $16::timestamptz, $17
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
      requestFingerprint,
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
