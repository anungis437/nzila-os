/**
 * Platform Admin — SAGE export service layer (server-only)
 *
 * Thin orchestration for the Phase 7 controlled export routes/pages. Composes
 * the SAGE runtime + service context from a server-verified actor scope, calls
 * the `@nzila/sage-core` export services, and maps results to browser-safe
 * shapes. All authorization, tenant boundary, human-actor assurance, scope
 * hashing/freezing, CAS transitions, and audit emission happen inside the SAGE
 * service layer — this module never bypasses it.
 *
 * External delivery is DISABLED: the only retrieval path is authenticated,
 * server-side, internal byte streaming.
 *
 * Server-only: must never be imported into a client bundle.
 */
import 'server-only'
import {
  SageServiceError,
  approveSageExport,
  denySageExport,
  generateSageExportPackage,
  getSageExportPackage,
  getSageExportPackageContent,
  getSageExportRequest,
  listSageExportApprovals,
  listSageExportPackages,
  listSageExportRequests,
  requestSageExport,
  type SageExportPackageType,
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
  toExportApprovalListResponse,
  toExportPackageListResponse,
  toExportPackageResponse,
  toExportRequestListResponse,
  toExportRequestResponse,
} from './export-view'
import type {
  SageExportApprovalListResponse,
  SageExportPackageListResponse,
  SageExportPackageResponse,
  SageExportRequestListResponse,
  SageExportRequestResponse,
} from './export-schemas'

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

async function withExportIdempotency<T>(
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

// ─── Reads (null when the workspace/resource is inaccessible) ─────────────────

export async function listSageExportRequestsForScope(
  scope: SageActorScope,
  workspaceId: string,
): Promise<SageExportRequestListResponse | null> {
  const deps = createSageRuntime(scope)
  const ctx = createSageServiceContext(scope)
  try {
    return toExportRequestListResponse(await listSageExportRequests(deps, ctx, { workspaceId }))
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

export async function listSageExportApprovalsForScope(
  scope: SageActorScope,
  workspaceId: string,
  exportRequestId: string,
): Promise<SageExportApprovalListResponse | null> {
  const deps = createSageRuntime(scope)
  const ctx = createSageServiceContext(scope)
  try {
    return toExportApprovalListResponse(
      await listSageExportApprovals(deps, ctx, { workspaceId, exportRequestId }),
    )
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

export async function getSageExportRequestForScope(
  scope: SageActorScope,
  workspaceId: string,
  exportRequestId: string,
): Promise<SageExportRequestResponse | null> {
  const deps = createSageRuntime(scope)
  const ctx = createSageServiceContext(scope)
  try {
    return toExportRequestResponse(await getSageExportRequest(deps, ctx, { workspaceId, exportRequestId }))
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

export async function listSageExportPackagesForScope(
  scope: SageActorScope,
  workspaceId: string,
): Promise<SageExportPackageListResponse | null> {
  const deps = createSageRuntime(scope)
  const ctx = createSageServiceContext(scope)
  try {
    return toExportPackageListResponse(await listSageExportPackages(deps, ctx, { workspaceId }))
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

export async function getSageExportPackageForScope(
  scope: SageActorScope,
  workspaceId: string,
  packageId: string,
): Promise<SageExportPackageResponse | null> {
  const deps = createSageRuntime(scope)
  const ctx = createSageServiceContext(scope)
  try {
    return toExportPackageResponse(await getSageExportPackage(deps, ctx, { workspaceId, packageId }))
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

/** Authenticated internal byte retrieval — no public URL, streamed server-side. */
export async function downloadSageExportPackageForScope(
  scope: SageActorScope,
  workspaceId: string,
  packageId: string,
): Promise<{ mediaType: string; bytes: Uint8Array; contentHash: string; filename: string } | null> {
  const deps = createSageRuntime(scope)
  const ctx = createSageServiceContext(scope)
  try {
    const result = await getSageExportPackageContent(deps, ctx, { workspaceId, packageId })
    return {
      mediaType: result.mediaType,
      bytes: result.bytes,
      contentHash: result.package.contentHash,
      filename: `sage-export-${result.package.id}.json`,
    }
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

// ─── Mutations (durable, leased, fenced idempotency) ─────────────────────────

export interface CreateExportRequestInput {
  purpose: string
  packageType?: SageExportPackageType
  evidenceItemIds?: string[]
  boundaryFlagIds?: string[]
  reviewNoteIds?: string[]
  decisionRecordIds?: string[]
}

export async function createSageExportRequestForScope(
  scope: SageActorScope,
  workspaceId: string,
  input: CreateExportRequestInput,
  options: MutationOptions,
): Promise<{ response: SageExportRequestResponse; replayed: boolean }> {
  return withExportIdempotency(
    scope,
    `/api/sage/workspaces/${workspaceId}/export-requests`,
    {
      purpose: input.purpose,
      packageType: input.packageType ?? null,
      evidenceItemIds: input.evidenceItemIds ?? [],
      boundaryFlagIds: input.boundaryFlagIds ?? [],
      reviewNoteIds: input.reviewNoteIds ?? [],
      decisionRecordIds: input.decisionRecordIds ?? [],
    },
    options,
    201,
    async () => {
      const deps = createSageRuntime(scope)
      const ctx = createSageServiceContext(scope)
      return toExportRequestResponse(await requestSageExport(deps, ctx, { workspaceId, ...input }))
    },
  )
}

export async function approveSageExportRequestForScope(
  scope: SageActorScope,
  workspaceId: string,
  exportRequestId: string,
  rationale: string,
  options: MutationOptions,
): Promise<{ response: { ok: true }; replayed: boolean }> {
  return withExportIdempotency(
    scope,
    `/api/sage/workspaces/${workspaceId}/export-requests/${exportRequestId}/approve`,
    { rationale },
    options,
    200,
    async () => {
      const deps = createSageRuntime(scope)
      const ctx = createSageServiceContext(scope)
      await approveSageExport(deps, ctx, { workspaceId, exportRequestId, rationale })
      return { ok: true } as const
    },
  )
}

export async function denySageExportRequestForScope(
  scope: SageActorScope,
  workspaceId: string,
  exportRequestId: string,
  rationale: string,
  options: MutationOptions,
): Promise<{ response: { ok: true }; replayed: boolean }> {
  return withExportIdempotency(
    scope,
    `/api/sage/workspaces/${workspaceId}/export-requests/${exportRequestId}/deny`,
    { rationale },
    options,
    200,
    async () => {
      const deps = createSageRuntime(scope)
      const ctx = createSageServiceContext(scope)
      await denySageExport(deps, ctx, { workspaceId, exportRequestId, rationale })
      return { ok: true } as const
    },
  )
}

export async function generateSageExportPackageForScope(
  scope: SageActorScope,
  workspaceId: string,
  exportRequestId: string,
  options: MutationOptions,
): Promise<{ response: SageExportPackageResponse; replayed: boolean }> {
  return withExportIdempotency(
    scope,
    `/api/sage/workspaces/${workspaceId}/export-requests/${exportRequestId}/generate`,
    { exportRequestId },
    options,
    201,
    async () => {
      const deps = createSageRuntime(scope)
      const ctx = createSageServiceContext(scope)
      return toExportPackageResponse(
        await generateSageExportPackage(deps, ctx, { workspaceId, exportRequestId }),
      )
    },
  )
}
