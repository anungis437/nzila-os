/**
 * Platform Admin — SAGE institutional mandate action orchestration (server-only)
 *
 * Runs consequential institutional mutations inside one SQL transaction with
 * FOR UPDATE mandate locking. Browser never supplies verification status,
 * ledger totals, currency, instrument authority, or authoritative
 * conflict/recusal facts. Position claims are optional and must match the
 * locked mandate office after server capacity resolution.
 */
import 'server-only'
import {
  SageServiceError,
  SAGE_PERMISSIONS,
  authorizeSageWorkspaceAccess,
  executeInstitutionalActionInTransaction,
  publicInstitutionalRefusal,
  type SageSqlClient,
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
import { withSagePlatformTransaction } from './sql-adapter'
import { getSageIdempotencyCache } from './idempotency'
import { getSageInstitutionalCapacityStore } from './institutional-capacity-adapter'
import type { CreateInstitutionalResourceCommitRequest } from './institutional-schemas'

export interface InstitutionalCommitResponse {
  actionId: string
  commitmentId: string | null
  totalCommittedMinorAfterAction: number | null
  instrumentRef: string
  instrumentVersion: string
  reusedExisting: boolean
  authorizationStatus: 'NEWLY_ADMITTED' | 'HISTORICALLY_RECORDED_NO_NEW_AUTHORIZATION'
}

interface MutationOptions {
  idempotencyKey: string
  cache?: AtomicIdempotencyCache
}

async function withInstitutionalIdempotency<T>(
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
      throw new SageServiceError('CONFLICT', error.message)
    }
    if (error instanceof IdempotencyInProgressError) {
      throw new SageServiceError('CONFLICT', error.message)
    }
    throw error
  }
}

export async function commitSageResourceUnderMandateForScope(
  scope: SageActorScope,
  workspaceId: string,
  input: CreateInstitutionalResourceCommitRequest,
  options: MutationOptions,
): Promise<{ response: InstitutionalCommitResponse; replayed: boolean }> {
  const deps = createSageRuntime(scope)
  const ctx = createSageServiceContext(scope)
  const actorKind = ctx.actor.actorKind
  if (actorKind !== 'human' && actorKind !== 'service' && actorKind !== 'system') {
    throw new SageServiceError('FORBIDDEN', 'Authenticated SAGE actor kind is required')
  }

  // Current workspace permission is checked BEFORE idempotent cache replay so a
  // revoked/suspended actor cannot retrieve a cached "admitted" body.
  await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId,
    requiredPermission: SAGE_PERMISSIONS.DECISION_RECORD,
  })

  return withInstitutionalIdempotency(
    scope,
    `/api/sage/workspaces/${workspaceId}/institutional-actions/resource-commit`,
    {
      mandateId: input.mandateId,
      claimedPositionId: input.claimedPositionId ?? null,
      resourceId: input.resourceId,
      requestedCommitMinor: input.requestedCommitMinor,
    },
    options,
    201,
    async () => {
      // Re-check permission inside the mutation as well (defence in depth).
      await authorizeSageWorkspaceAccess(deps, ctx, {
        workspaceId,
        requiredPermission: SAGE_PERMISSIONS.DECISION_RECORD,
      })

      const result = await withSagePlatformTransaction(async (sql: SageSqlClient) => {
        await sql.query(`select set_config('app.tenant_id', $1, true)`, [scope.orgId])
        return executeInstitutionalActionInTransaction(sql, {
          actor: {
            orgId: scope.orgId,
            workspaceId,
            actorId: scope.actorId,
            actorKind,
            claimedPositionId: input.claimedPositionId ?? null,
            authenticated: true,
            activeWorkspaceMembership: true,
            applicationPermissionGranted: true,
          },
          mandateId: input.mandateId,
          resourceId: input.resourceId,
          action: 'resource.commit',
          evaluatedAt: new Date().toISOString(),
          idempotencyKey: options.idempotencyKey,
          requestedCommitMinor: input.requestedCommitMinor,
          // Fail closed until a durable capacity/recusal store is attached.
          capacityStore: getSageInstitutionalCapacityStore(),
        })
      })

      if (!result.admitted) {
        const refusal = publicInstitutionalRefusal(result.decision)
        throw new SageServiceError('FORBIDDEN', `Institutional authority refused (${refusal.reason})`)
      }

      return {
        actionId: result.actionId,
        commitmentId: result.commitmentId,
        totalCommittedMinorAfterAction: result.totalCommittedMinorAfterAction,
        instrumentRef: result.decision.instrumentRef,
        instrumentVersion: result.decision.instrumentVersion,
        reusedExisting: result.reusedExisting,
        authorizationStatus: result.authorizationStatus,
      }
    },
  )
}
