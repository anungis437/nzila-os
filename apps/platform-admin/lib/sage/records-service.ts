/**
 * Platform Admin — SAGE Phase 8B records-lifecycle service layer (server-only)
 *
 * Thin orchestration for the records-lifecycle routes. Composes the SAGE runtime
 * + service context from a server-verified actor scope, calls the sage-core
 * records services, and maps results to browser-safe shapes. All authorization,
 * human-actor assurance, separation of duties, retention/hold enforcement,
 * freeze/recompute, storage verification, and audit happen inside sage-core.
 *
 * Server-only: must never be imported into a client bundle.
 */
import 'server-only'
import {
  SageServiceError,
  approveSageExportDestruction,
  assignSageExportRetentionPolicy,
  denySageExportDestruction,
  executeSageExportDestruction,
  getSageExportDestructionEligibility,
  getSageExportDestructionEvidence,
  getSageExportRetentionAssignment,
  listSageExportDestructionRequests,
  listSageExportLegalHolds,
  placeSageExportLegalHold,
  releaseSageExportLegalHold,
  requestSageExportDestruction,
  SAGE_PERMISSIONS,
  type SageServiceContext,
  type SageServiceDeps,
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
import { createSageExportPackageStorage } from './records-storage-adapter'
import {
  toDestructionEvidenceResponse,
  toDestructionRequestResponse,
  toLegalHoldResponse,
  toRetentionAssignmentResponse,
} from './records-view'
import type {
  SageDestructionEligibilityResponse,
  SageDestructionEvidenceResponse,
  SageDestructionRequestResponse,
  SageLegalHoldResponse,
  SageRetentionAssignmentResponse,
} from './records-schemas'

export interface RecordsDepsOverrides {
  cache?: AtomicIdempotencyCache
  deps?: SageServiceDeps
}

function recordsDeps(scope: SageActorScope, overrides?: RecordsDepsOverrides): SageServiceDeps {
  if (overrides?.deps) return overrides.deps
  const runtime = createSageRuntime(scope)
  return { ...runtime, exportPackageStorage: createSageExportPackageStorage() }
}

function isAccessDenied(error: unknown): boolean {
  return error instanceof SageServiceError && (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN')
}

interface MutationOptions {
  idempotencyKey: string
  cache?: AtomicIdempotencyCache
}

async function withRecordsIdempotency<T>(
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
    if (error instanceof IdempotencyConflictError) {
      throw new SageServiceError('CONFLICT', 'Idempotency-Key was reused with a different request')
    }
    if (error instanceof IdempotencyInProgressError) {
      throw new SageServiceError('CONFLICT', 'a concurrent request with this Idempotency-Key is in progress')
    }
    throw error
  }
}

// ── Retention ────────────────────────────────────────────────────────────────
export async function assignRetentionForScope(
  scope: SageActorScope,
  input: { workspaceId: string; packageId: string; policyCode: string; eventDate?: string; firstDeliveredAt?: string },
  options: MutationOptions,
  overrides?: RecordsDepsOverrides,
): Promise<{ response: SageRetentionAssignmentResponse; replayed: boolean }> {
  const deps = recordsDeps(scope, overrides)
  const ctx = createSageServiceContext(scope)
  return withRecordsIdempotency(
    scope,
    `/api/sage/workspaces/${input.workspaceId}/exports/${input.packageId}/retention`,
    { packageId: input.packageId, policyCode: input.policyCode, eventDate: input.eventDate ?? null },
    options,
    201,
    async () => {
      const assignment = await assignSageExportRetentionPolicy(deps, ctx, input)
      return toRetentionAssignmentResponse(assignment)
    },
  )
}

export async function getRetentionForScope(
  scope: SageActorScope,
  input: { workspaceId: string; packageId: string },
  overrides?: RecordsDepsOverrides,
): Promise<SageRetentionAssignmentResponse | null> {
  const deps = recordsDeps(scope, overrides)
  const ctx = createSageServiceContext(scope)
  try {
    const assignment = await getSageExportRetentionAssignment(deps, ctx, input)
    return assignment ? toRetentionAssignmentResponse(assignment) : null
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

// ── Legal holds ──────────────────────────────────────────────────────────────
export async function placeLegalHoldForScope(
  scope: SageActorScope,
  input: { workspaceId: string; packageId: string; reason: string },
  options: MutationOptions,
  overrides?: RecordsDepsOverrides,
): Promise<{ response: SageLegalHoldResponse; replayed: boolean }> {
  const deps = recordsDeps(scope, overrides)
  const ctx = createSageServiceContext(scope)
  return withRecordsIdempotency(
    scope,
    `/api/sage/workspaces/${input.workspaceId}/exports/${input.packageId}/legal-holds`,
    { packageId: input.packageId },
    options,
    201,
    async () => toLegalHoldResponse(await placeSageExportLegalHold(deps, ctx, input)),
  )
}

export async function releaseLegalHoldForScope(
  scope: SageActorScope,
  input: { workspaceId: string; holdId: string; releaseReason: string },
  options: MutationOptions,
  overrides?: RecordsDepsOverrides,
): Promise<{ response: SageLegalHoldResponse; replayed: boolean }> {
  const deps = recordsDeps(scope, overrides)
  const ctx = createSageServiceContext(scope)
  return withRecordsIdempotency(
    scope,
    `/api/sage/workspaces/${input.workspaceId}/legal-holds/${input.holdId}/release`,
    { holdId: input.holdId },
    options,
    200,
    async () => toLegalHoldResponse(await releaseSageExportLegalHold(deps, ctx, input)),
  )
}

export async function listLegalHoldsForScope(
  scope: SageActorScope,
  input: { workspaceId: string; packageId: string },
  overrides?: RecordsDepsOverrides,
): Promise<SageLegalHoldResponse[] | null> {
  const deps = recordsDeps(scope, overrides)
  const ctx = createSageServiceContext(scope)
  try {
    const holds = await listSageExportLegalHolds(deps, ctx, input)
    return holds.map(toLegalHoldResponse)
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

// ── Eligibility ──────────────────────────────────────────────────────────────
export async function getEligibilityForScope(
  scope: SageActorScope,
  input: { workspaceId: string; packageId: string },
  overrides?: RecordsDepsOverrides,
): Promise<SageDestructionEligibilityResponse | null> {
  const deps = recordsDeps(scope, overrides)
  const ctx = createSageServiceContext(scope)
  try {
    const e = await getSageExportDestructionEligibility(deps, ctx, input)
    return { eligible: e.eligible, reasonCodes: e.reasonCodes, retainUntil: e.retainUntil, activeHoldCount: e.activeHoldCount }
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

// ── Destruction request / approval ───────────────────────────────────────────
export async function requestDestructionForScope(
  scope: SageActorScope,
  input: { workspaceId: string; packageId: string; reason: string },
  options: MutationOptions,
  overrides?: RecordsDepsOverrides,
): Promise<{ response: SageDestructionRequestResponse; replayed: boolean }> {
  const deps = recordsDeps(scope, overrides)
  const ctx = createSageServiceContext(scope)
  return withRecordsIdempotency(
    scope,
    `/api/sage/workspaces/${input.workspaceId}/exports/${input.packageId}/destruction-requests`,
    { packageId: input.packageId },
    options,
    201,
    async () => toDestructionRequestResponse(await requestSageExportDestruction(deps, ctx, input), scope.actorId),
  )
}

export async function decideDestructionForScope(
  scope: SageActorScope,
  input: { workspaceId: string; requestId: string; decision: 'approved' | 'denied'; rationale?: string },
  options: MutationOptions,
  overrides?: RecordsDepsOverrides,
): Promise<{ response: SageDestructionRequestResponse; replayed: boolean }> {
  const deps = recordsDeps(scope, overrides)
  const ctx = createSageServiceContext(scope)
  return withRecordsIdempotency(
    scope,
    `/api/sage/workspaces/${input.workspaceId}/destruction-requests/${input.requestId}/${input.decision === 'approved' ? 'approve' : 'deny'}`,
    { requestId: input.requestId, decision: input.decision },
    options,
    200,
    async () => {
      const result =
        input.decision === 'approved'
          ? await approveSageExportDestruction(deps, ctx, input)
          : await denySageExportDestruction(deps, ctx, input)
      return toDestructionRequestResponse(result.request, scope.actorId)
    },
  )
}

export async function listDestructionRequestsForScope(
  scope: SageActorScope,
  input: { workspaceId: string },
  overrides?: RecordsDepsOverrides,
): Promise<SageDestructionRequestResponse[] | null> {
  const deps = recordsDeps(scope, overrides)
  const ctx = createSageServiceContext(scope)
  try {
    const requests = await listSageExportDestructionRequests(deps, ctx, input)
    return requests.map((r) => toDestructionRequestResponse(r, scope.actorId))
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

export async function getDestructionEvidenceForScope(
  scope: SageActorScope,
  input: { workspaceId: string; requestId: string },
  overrides?: RecordsDepsOverrides,
): Promise<SageDestructionEvidenceResponse | null> {
  const deps = recordsDeps(scope, overrides)
  const ctx = createSageServiceContext(scope)
  try {
    const evidence = await getSageExportDestructionEvidence(deps, ctx, input)
    return evidence ? toDestructionEvidenceResponse(evidence) : null
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

// ── Internal execution (service-authenticated; system actor with execute grant) ─
export async function executeDestructionInternal(
  input: { orgId: string; workspaceId: string; requestId: string },
  overrides?: RecordsDepsOverrides,
): Promise<SageDestructionEvidenceResponse> {
  // Trusted internal system actor: carries ONLY the execute permission — never
  // request/approve authority.
  const scope: SageActorScope = {
    actorId: 'sage-destruction-executor',
    orgId: input.orgId,
    orgRole: 'none',
    authenticationType: 'internal_system',
  }
  const deps = recordsDeps(scope, overrides)
  const ctx: SageServiceContext = {
    actor: {
      actorId: scope.actorId,
      orgId: input.orgId,
      actorKind: 'system',
      permissions: [SAGE_PERMISSIONS.EXPORT_DESTRUCTION_EXECUTE],
    },
  }
  const result = await executeSageExportDestruction(deps, ctx, {
    workspaceId: input.workspaceId,
    requestId: input.requestId,
  })
  return toDestructionEvidenceResponse(result.evidence)
}

export { SageServiceError }
