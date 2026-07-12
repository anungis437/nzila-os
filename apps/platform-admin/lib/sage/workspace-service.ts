/**
 * Platform Admin — SAGE workspace service layer (server-only)
 *
 * Thin orchestration used by both the SAGE pages and the SAGE API routes.
 * Composes the SAGE runtime (SQL repository + audit sink) and the service
 * context from a *server-verified* actor scope, calls the `@nzila/sage-core`
 * service functions, and maps results to browser-safe response shapes.
 *
 * All authorization, org-boundary enforcement, invariants, and audit emission
 * happen inside the SAGE service layer — this module never bypasses it and never
 * calls the repository directly for mutations.
 *
 * Server-only: must never be imported into a client bundle.
 */
import 'server-only'
import {
  SageServiceError,
  createSageWorkspace,
  getSageWorkspace,
  getSageWorkspaceSummary,
  listSageWorkspaces,
  type SageInstitutionType,
  type SageRiskSurface,
} from '@nzila/sage-core'
import {
  checkIdempotency,
  type IdempotencyCache,
} from '@nzila/os-core/idempotency'
import { createSageRuntime, createSageServiceContext, type SageActorScope } from './runtime'
import { getSageIdempotencyCache } from './idempotency'
import {
  toSummaryResponse,
  toWorkspaceDetailResponse,
  toWorkspaceListResponse,
  toWorkspaceResponse,
} from './view'
import type {
  SageWorkspaceDetailResponse,
  SageWorkspaceListResponse,
  SageWorkspaceResponse,
  SageWorkspaceSummaryResponse,
} from './schemas'

function isAccessDenied(error: unknown): boolean {
  // Both cross-org (NOT_FOUND) and same-org-unauthorized (FORBIDDEN) resolve to
  // a non-disclosing 404 so workspace existence is never leaked.
  return (
    error instanceof SageServiceError &&
    (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN')
  )
}

export interface CreateSageWorkspaceInput {
  name: string
  institutionType: SageInstitutionType
  riskSurface: SageRiskSurface
}

export interface CreateSageWorkspaceResult {
  response: SageWorkspaceResponse
  /** True when this response was replayed from a prior idempotent request. */
  replayed: boolean
}

/** List the organization's workspaces (read permission enforced in-service). */
export async function listSageWorkspacesForScope(
  scope: SageActorScope,
): Promise<SageWorkspaceListResponse> {
  const deps = createSageRuntime(scope)
  const ctx = createSageServiceContext(scope)
  const workspaces = await listSageWorkspaces(deps, ctx)
  return toWorkspaceListResponse(workspaces)
}

/**
 * Create a workspace with real idempotency. orgId/createdBy/boundaryProfile are
 * derived server-side; the caller supplies only name/institutionType/riskSurface
 * plus the request's Idempotency-Key.
 *
 * Idempotency scope is (orgId + route + actorId + idempotencyKey) with a payload
 * hash: an identical retry returns the recorded result and performs no second
 * create or audit mutation; the same key with a different payload is a conflict;
 * keys are isolated per organization.
 */
export async function createSageWorkspaceForScope(
  scope: SageActorScope,
  input: CreateSageWorkspaceInput,
  options: { idempotencyKey: string; cache?: IdempotencyCache },
): Promise<CreateSageWorkspaceResult> {
  const cache = options.cache ?? getSageIdempotencyCache()
  const body = JSON.stringify({
    name: input.name,
    institutionType: input.institutionType,
    riskSurface: input.riskSurface,
  })

  const check = await checkIdempotency({
    method: 'POST',
    // actorId is folded into the route segment so the key scope is
    // org + route + actor + idempotencyKey (payload hash handled internally).
    pathname: `/api/sage/workspaces#${scope.actorId}`,
    idempotencyKey: options.idempotencyKey,
    orgId: scope.orgId,
    body,
    cache,
    strict: true,
  })

  if (!check.proceed) {
    if (check.error) {
      if (check.error.status === 409) {
        throw new SageServiceError('CONFLICT', 'Idempotency-Key was used with a different payload')
      }
      throw new SageServiceError('INVALID_INPUT', 'Idempotency-Key header is required')
    }
    // Replay: return the recorded result without creating a second workspace.
    const cached = JSON.parse(check.cachedResponse!.body) as SageWorkspaceResponse
    return { response: cached, replayed: true }
  }

  const deps = createSageRuntime(scope)
  const ctx = createSageServiceContext(scope)
  const ws = await createSageWorkspace(deps, ctx, {
    name: input.name,
    institutionType: input.institutionType,
    riskSurface: input.riskSurface,
  })
  const response = toWorkspaceResponse(ws)

  await cache.set(check.cacheKey!, {
    payloadHash: check.payloadHash!,
    status: 201,
    body: JSON.stringify(response),
    headers: {},
    createdAt: Date.now(),
  })

  return { response, replayed: false }
}

/** Load a single workspace (with boundary posture); null if missing/cross-org. */
export async function getSageWorkspaceForScope(
  scope: SageActorScope,
  workspaceId: string,
): Promise<SageWorkspaceDetailResponse | null> {
  const deps = createSageRuntime(scope)
  const ctx = createSageServiceContext(scope)
  try {
    const ws = await getSageWorkspace(deps, ctx, { workspaceId })
    return toWorkspaceDetailResponse(ws)
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

/** Load a workspace's counts-only summary; null if missing/cross-org. */
export async function getSageWorkspaceSummaryForScope(
  scope: SageActorScope,
  workspaceId: string,
): Promise<SageWorkspaceSummaryResponse | null> {
  const deps = createSageRuntime(scope)
  const ctx = createSageServiceContext(scope)
  try {
    const summary = await getSageWorkspaceSummary(deps, ctx, { workspaceId })
    return toSummaryResponse(summary)
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}
