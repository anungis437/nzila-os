/**
 * Platform Admin — SAGE governance service layer (server-only)
 *
 * Thin orchestration for the Phase 6 human-governance routes/pages. Composes the
 * SAGE runtime + service context from a *server-verified* actor scope, calls the
 * `@nzila/sage-core` governance services, and maps results to browser-safe
 * shapes. All authorization (workspace membership + active SAGE role), tenant
 * boundary, invariants, evidence-authorization filtering, and audit emission
 * happen inside the SAGE service layer — this module never bypasses it.
 *
 * The named human reviewer / resolver is always the authenticated actor; it is
 * never read from the request body.
 *
 * Server-only: must never be imported into a client bundle.
 */
import 'server-only'
import {
  SageServiceError,
  addSageBoundaryFlag,
  addSageReviewNote,
  createSageDecisionRecord,
  getSageDecisionRecord,
  listSageBoundaryFlags,
  listSageDecisionRecords,
  listSageReviewNotes,
  resolveSageBoundaryFlag,
  type SageAuthorizationLevel,
  type SageBoundaryFlagType,
  type SageBoundaryResolution,
  type SageGovernanceTargetType,
  type SageReviewNoteType,
} from '@nzila/sage-core'
import {
  buildCacheKey,
  hashPayload,
  runIdempotentMutation,
  IdempotencyConflictError,
  IdempotencyInProgressError,
  type AtomicIdempotencyCache,
} from '@nzila/os-core/idempotency'
import { createSageRuntime, createSageServiceContext, type SageActorScope } from './runtime'
import { getSageIdempotencyCache } from './idempotency'
import {
  toBoundaryFlagListResponse,
  toBoundaryFlagResponse,
  toDecisionRecordListResponse,
  toDecisionRecordResponse,
  toReviewNoteListResponse,
  toReviewNoteResponse,
} from './governance-view'
import type {
  SageBoundaryFlagListResponse,
  SageBoundaryFlagResponse,
  SageDecisionRecordListResponse,
  SageDecisionRecordResponse,
  SageReviewNoteListResponse,
  SageReviewNoteResponse,
} from './governance-schemas'

function isAccessDenied(error: unknown): boolean {
  return (
    error instanceof SageServiceError &&
    (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN')
  )
}

interface MutationOptions {
  idempotencyKey: string
  cache?: AtomicIdempotencyCache
}

async function withGovernanceIdempotency<T>(
  scope: SageActorScope,
  route: string,
  payload: Record<string, unknown>,
  options: MutationOptions,
  status: number,
  run: () => Promise<T>,
): Promise<{ response: T; replayed: boolean }> {
  if (!options.idempotencyKey || options.idempotencyKey.trim().length === 0) {
    throw new SageServiceError('INVALID_INPUT', 'Idempotency-Key header is required')
  }
  const cache = options.cache ?? getSageIdempotencyCache()
  const cacheKey = buildCacheKey(scope.orgId, `${route}#${scope.actorId}`, options.idempotencyKey)
  const payloadHash = hashPayload(JSON.stringify(payload))
  try {
    return await runIdempotentMutation<T>({ cache, cacheKey, payloadHash, status, run })
  } catch (error) {
    if (error instanceof IdempotencyConflictError) throw new SageServiceError('CONFLICT', error.message)
    if (error instanceof IdempotencyInProgressError) throw new SageServiceError('CONFLICT', error.message)
    throw error
  }
}

// ─── Reads (null when the workspace/target is inaccessible) ───────────────────

export async function listSageBoundaryFlagsForScope(
  scope: SageActorScope,
  workspaceId: string,
  filters?: { status?: string },
): Promise<SageBoundaryFlagListResponse | null> {
  const deps = createSageRuntime(scope)
  const ctx = createSageServiceContext(scope)
  try {
    const flags = await listSageBoundaryFlags(deps, ctx, { workspaceId, filters })
    return toBoundaryFlagListResponse(flags)
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

export async function listSageReviewNotesForScope(
  scope: SageActorScope,
  workspaceId: string,
  filters?: { targetType?: string; targetId?: string },
): Promise<SageReviewNoteListResponse | null> {
  const deps = createSageRuntime(scope)
  const ctx = createSageServiceContext(scope)
  try {
    const notes = await listSageReviewNotes(deps, ctx, { workspaceId, filters })
    return toReviewNoteListResponse(notes)
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

export async function listSageDecisionRecordsForScope(
  scope: SageActorScope,
  workspaceId: string,
): Promise<SageDecisionRecordListResponse | null> {
  const deps = createSageRuntime(scope)
  const ctx = createSageServiceContext(scope)
  try {
    const records = await listSageDecisionRecords(deps, ctx, { workspaceId })
    return toDecisionRecordListResponse(records)
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

export async function getSageDecisionRecordForScope(
  scope: SageActorScope,
  workspaceId: string,
  decisionId: string,
): Promise<SageDecisionRecordResponse | null> {
  const deps = createSageRuntime(scope)
  const ctx = createSageServiceContext(scope)
  try {
    const record = await getSageDecisionRecord(deps, ctx, { workspaceId, decisionId })
    return toDecisionRecordResponse(record)
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

// ─── Mutations (durable, leased, fenced idempotency) ─────────────────────────

export interface CreateBoundaryFlagInput {
  flagType: SageBoundaryFlagType
  targetType: SageGovernanceTargetType
  targetId?: string
  note?: string
  requestedAuthorizationLevel?: SageAuthorizationLevel
}

export async function createSageBoundaryFlagForScope(
  scope: SageActorScope,
  workspaceId: string,
  input: CreateBoundaryFlagInput,
  options: MutationOptions,
): Promise<{ response: SageBoundaryFlagResponse; replayed: boolean }> {
  return withGovernanceIdempotency(
    scope,
    `/api/sage/workspaces/${workspaceId}/boundary-flags`,
    {
      flagType: input.flagType,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      note: input.note ?? null,
      requestedAuthorizationLevel: input.requestedAuthorizationLevel ?? null,
    },
    options,
    201,
    async () => {
      const deps = createSageRuntime(scope)
      const ctx = createSageServiceContext(scope)
      const flag = await addSageBoundaryFlag(deps, ctx, { workspaceId, ...input })
      return toBoundaryFlagResponse(flag)
    },
  )
}

export interface ResolveBoundaryFlagInput {
  resolution: SageBoundaryResolution
  resolutionNote: string
  requestedAuthorizationLevel?: SageAuthorizationLevel
}

export async function resolveSageBoundaryFlagForScope(
  scope: SageActorScope,
  workspaceId: string,
  flagId: string,
  input: ResolveBoundaryFlagInput,
  options: MutationOptions,
): Promise<{ response: SageBoundaryFlagResponse; replayed: boolean }> {
  return withGovernanceIdempotency(
    scope,
    `/api/sage/workspaces/${workspaceId}/boundary-flags/${flagId}/resolve`,
    {
      resolution: input.resolution,
      resolutionNote: input.resolutionNote,
      requestedAuthorizationLevel: input.requestedAuthorizationLevel ?? null,
    },
    options,
    200,
    async () => {
      const deps = createSageRuntime(scope)
      const ctx = createSageServiceContext(scope)
      const flag = await resolveSageBoundaryFlag(deps, ctx, {
        workspaceId,
        flagId,
        resolution: input.resolution,
        resolutionNote: input.resolutionNote,
        requestedAuthorizationLevel: input.requestedAuthorizationLevel,
      })
      return toBoundaryFlagResponse(flag)
    },
  )
}

export interface CreateReviewNoteInput {
  note: string
  noteType: SageReviewNoteType
  targetType: SageGovernanceTargetType
  targetId?: string
  requestedAuthorizationLevel?: SageAuthorizationLevel
}

export async function createSageReviewNoteForScope(
  scope: SageActorScope,
  workspaceId: string,
  input: CreateReviewNoteInput,
  options: MutationOptions,
): Promise<{ response: SageReviewNoteResponse; replayed: boolean }> {
  return withGovernanceIdempotency(
    scope,
    `/api/sage/workspaces/${workspaceId}/review-notes`,
    {
      noteType: input.noteType,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      note: input.note,
      requestedAuthorizationLevel: input.requestedAuthorizationLevel ?? null,
    },
    options,
    201,
    async () => {
      const deps = createSageRuntime(scope)
      const ctx = createSageServiceContext(scope)
      const note = await addSageReviewNote(deps, ctx, { workspaceId, ...input })
      return toReviewNoteResponse(note)
    },
  )
}

export interface CreateDecisionRecordInput {
  decision: string
  rationale?: string
  uncertainty: string
  referencedEvidenceItemIds?: string[]
  referencedBoundaryFlagIds?: string[]
  requestedAuthorizationLevel?: SageAuthorizationLevel
}

export async function createSageDecisionRecordForScope(
  scope: SageActorScope,
  workspaceId: string,
  input: CreateDecisionRecordInput,
  options: MutationOptions,
): Promise<{ response: SageDecisionRecordResponse; replayed: boolean }> {
  return withGovernanceIdempotency(
    scope,
    `/api/sage/workspaces/${workspaceId}/decisions`,
    {
      decision: input.decision,
      rationale: input.rationale ?? null,
      uncertainty: input.uncertainty,
      referencedEvidenceItemIds: input.referencedEvidenceItemIds ?? [],
      referencedBoundaryFlagIds: input.referencedBoundaryFlagIds ?? [],
      requestedAuthorizationLevel: input.requestedAuthorizationLevel ?? null,
    },
    options,
    201,
    async () => {
      const deps = createSageRuntime(scope)
      const ctx = createSageServiceContext(scope)
      const record = await createSageDecisionRecord(deps, ctx, { workspaceId, ...input })
      return toDecisionRecordResponse(record)
    },
  )
}
