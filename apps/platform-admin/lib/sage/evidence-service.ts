/**
 * Platform Admin — SAGE evidence service layer (server-only)
 *
 * Thin orchestration used by the SAGE evidence pages and API routes. Composes
 * the SAGE runtime (SQL repository + audit sink) and the service context from a
 * *server-verified* actor scope, calls the `@nzila/sage-core` evidence service
 * functions, and maps results to browser-safe response shapes.
 *
 * All authorization (workspace membership + active SAGE role), tenant-boundary
 * enforcement, invariants, and audit emission happen inside the SAGE service
 * layer — this module never bypasses it and never calls the repository directly.
 *
 * Reads that resolve to a denied/missing workspace or an inaccessible evidence
 * item are surfaced as `null`, so the caller can render a non-disclosing 404.
 *
 * Server-only: must never be imported into a client bundle.
 */
import 'server-only'
import {
  SageServiceError,
  classifySageEvidenceSource,
  createSageEvidenceItem,
  createSageEvidenceSource,
  getSageEvidenceItem,
  getSageEvidenceSource,
  linkSageEvidenceItem,
  listSageEvidenceItems,
  listSageEvidenceSources,
  type SageAuthorizationLevel,
  type SageConfidenceLevel,
  type SageSourceQuality,
  type SageSourceType,
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
  toEvidenceItemListResponse,
  toEvidenceItemResponse,
  toEvidenceSourceListResponse,
  toEvidenceSourceResponse,
} from './evidence-view'
import type {
  SageEvidenceItemListResponse,
  SageEvidenceItemResponse,
  SageEvidenceSourceListResponse,
  SageEvidenceSourceResponse,
} from './evidence-schemas'

function isAccessDenied(error: unknown): boolean {
  // Cross-org (NOT_FOUND) and same-org-unauthorized (FORBIDDEN) both resolve to
  // a non-disclosing 404 so evidence existence is never leaked.
  return (
    error instanceof SageServiceError &&
    (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN')
  )
}

interface MutationOptions {
  idempotencyKey: string
  cache?: AtomicIdempotencyCache
}

/**
 * Shared, ATOMIC durable-idempotency wrapper for evidence mutations.
 *
 * The key scope is (orgId + route + actorId + idempotencyKey) with a payload
 * hash. `runIdempotentMutation` performs an atomic first-writer acquisition so
 * that under CONCURRENT identical requests exactly one mutation runs; the others
 * wait for and replay its result (never a second mutation or a second audit
 * event). A reused key with a different payload is a CONFLICT; a failed mutation
 * releases the reservation so a later retry can proceed.
 */
async function withEvidenceIdempotency<T>(
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
  // actorId is folded into the route so the key scope is org + route + actor.
  const cacheKey = buildCacheKey(scope.orgId, `${route}#${scope.actorId}`, options.idempotencyKey)
  const payloadHash = hashPayload(JSON.stringify(payload))

  try {
    return await runIdempotentMutation<T>({ cache, cacheKey, payloadHash, status, run })
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      throw new SageServiceError('CONFLICT', error.message)
    }
    if (error instanceof IdempotencyInProgressError) {
      // A concurrent request with this key is still running — surface a
      // retryable conflict rather than risk a duplicate mutation.
      throw new SageServiceError('CONFLICT', error.message)
    }
    throw error
  }
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/** List a workspace's authorization-filtered evidence sources; null if denied. */
export async function listSageEvidenceSourcesForScope(
  scope: SageActorScope,
  workspaceId: string,
): Promise<SageEvidenceSourceListResponse | null> {
  const deps = createSageRuntime(scope)
  const ctx = createSageServiceContext(scope)
  try {
    const sources = await listSageEvidenceSources(deps, ctx, { workspaceId })
    return toEvidenceSourceListResponse(sources)
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

/** List a workspace's authorization-filtered evidence items; null if denied. */
export async function listSageEvidenceItemsForScope(
  scope: SageActorScope,
  workspaceId: string,
  sourceId?: string,
): Promise<SageEvidenceItemListResponse | null> {
  const deps = createSageRuntime(scope)
  const ctx = createSageServiceContext(scope)
  try {
    const items = await listSageEvidenceItems(deps, ctx, { workspaceId, sourceId })
    return toEvidenceItemListResponse(items)
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

/** Load one evidence source if accessible; null otherwise (non-disclosure). */
export async function getSageEvidenceSourceForScope(
  scope: SageActorScope,
  workspaceId: string,
  sourceId: string,
): Promise<SageEvidenceSourceResponse | null> {
  const deps = createSageRuntime(scope)
  const ctx = createSageServiceContext(scope)
  try {
    const src = await getSageEvidenceSource(deps, ctx, { workspaceId, sourceId })
    return toEvidenceSourceResponse(src)
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

/** Load one evidence item if accessible; null otherwise (non-disclosure). */
export async function getSageEvidenceItemForScope(
  scope: SageActorScope,
  workspaceId: string,
  itemId: string,
): Promise<SageEvidenceItemResponse | null> {
  const deps = createSageRuntime(scope)
  const ctx = createSageServiceContext(scope)
  try {
    const item = await getSageEvidenceItem(deps, ctx, { workspaceId, itemId })
    return toEvidenceItemResponse(item)
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

// ─── Mutations (durable idempotency) ─────────────────────────────────────────

export interface CreateEvidenceSourceInput {
  sourceType: SageSourceType
  containsPersonalInformation?: boolean
  containsSensitiveInformation?: boolean
}

export async function createSageEvidenceSourceForScope(
  scope: SageActorScope,
  workspaceId: string,
  input: CreateEvidenceSourceInput,
  options: MutationOptions,
): Promise<{ response: SageEvidenceSourceResponse; replayed: boolean }> {
  return withEvidenceIdempotency(
    scope,
    `/api/sage/workspaces/${workspaceId}/evidence-sources`,
    {
      sourceType: input.sourceType,
      containsPersonalInformation: input.containsPersonalInformation ?? false,
      containsSensitiveInformation: input.containsSensitiveInformation ?? false,
    },
    options,
    201,
    async () => {
      const deps = createSageRuntime(scope)
      const ctx = createSageServiceContext(scope)
      const src = await createSageEvidenceSource(deps, ctx, {
        workspaceId,
        sourceType: input.sourceType,
        containsPersonalInformation: input.containsPersonalInformation,
        containsSensitiveInformation: input.containsSensitiveInformation,
      })
      return toEvidenceSourceResponse(src)
    },
  )
}

export interface ClassifyEvidenceSourceInput {
  sourceQuality: SageSourceQuality
  authorizationLevel: SageAuthorizationLevel
}

export async function classifySageEvidenceSourceForScope(
  scope: SageActorScope,
  workspaceId: string,
  sourceId: string,
  input: ClassifyEvidenceSourceInput,
  options: MutationOptions,
): Promise<{ response: SageEvidenceSourceResponse; replayed: boolean }> {
  return withEvidenceIdempotency(
    scope,
    `/api/sage/workspaces/${workspaceId}/evidence-sources/${sourceId}/classify`,
    { sourceQuality: input.sourceQuality, authorizationLevel: input.authorizationLevel },
    options,
    200,
    async () => {
      const deps = createSageRuntime(scope)
      const ctx = createSageServiceContext(scope)
      const src = await classifySageEvidenceSource(deps, ctx, {
        workspaceId,
        sourceId,
        sourceQuality: input.sourceQuality,
        authorizationLevel: input.authorizationLevel,
      })
      return toEvidenceSourceResponse(src)
    },
  )
}

export interface CreateEvidenceItemInput {
  sourceId: string
  confidenceLevel: SageConfidenceLevel
}

export async function createSageEvidenceItemForScope(
  scope: SageActorScope,
  workspaceId: string,
  input: CreateEvidenceItemInput,
  options: MutationOptions,
): Promise<{ response: SageEvidenceItemResponse; replayed: boolean }> {
  return withEvidenceIdempotency(
    scope,
    `/api/sage/workspaces/${workspaceId}/evidence-items`,
    { sourceId: input.sourceId, confidenceLevel: input.confidenceLevel },
    options,
    201,
    async () => {
      const deps = createSageRuntime(scope)
      const ctx = createSageServiceContext(scope)
      const item = await createSageEvidenceItem(deps, ctx, {
        workspaceId,
        sourceId: input.sourceId,
        confidenceLevel: input.confidenceLevel,
      })
      return toEvidenceItemResponse(item)
    },
  )
}

export async function linkSageEvidenceItemForScope(
  scope: SageActorScope,
  workspaceId: string,
  itemId: string,
  options: MutationOptions,
): Promise<{ response: SageEvidenceItemResponse; replayed: boolean }> {
  return withEvidenceIdempotency(
    scope,
    `/api/sage/workspaces/${workspaceId}/evidence-items/${itemId}/link`,
    { itemId },
    options,
    200,
    async () => {
      const deps = createSageRuntime(scope)
      const ctx = createSageServiceContext(scope)
      const item = await linkSageEvidenceItem(deps, ctx, { workspaceId, itemId })
      return toEvidenceItemResponse(item)
    },
  )
}
