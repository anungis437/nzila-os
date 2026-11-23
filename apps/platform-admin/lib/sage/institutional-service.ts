/**
 * Platform Admin — SAGE institutional mandate action orchestration (server-only)
 *
 * Runs consequential institutional mutations inside one SQL transaction with
 * FOR UPDATE mandate locking. Browser never supplies verification status,
 * ledger totals, currency, or instrument authority.
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
import type { CreateInstitutionalResourceCommitRequest } from './institutional-schemas'

export interface InstitutionalCommitResponse {
  actionId: string
  commitmentId: string | null
  totalCommittedMinorAfterAction: number | null
  instrumentRef: string
  instrumentVersion: string
  reusedExisting: boolean
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
  return withInstitutionalIdempotency(
    scope,
    `/api/sage/workspaces/${workspaceId}/institutional-actions/resource-commit`,
    {
      mandateId: input.mandateId,
      positionId: input.positionId,
      resourceId: input.resourceId,
      requestedCommitMinor: input.requestedCommitMinor,
    },
    options,
    201,
    async () => {
      const deps = createSageRuntime(scope)
      const ctx = createSageServiceContext(scope)
      const actorKind = ctx.actor.actorKind
      if (actorKind !== 'human' && actorKind !== 'service' && actorKind !== 'system') {
        throw new SageServiceError('FORBIDDEN', 'Authenticated SAGE actor kind is required')
      }
      // Application permission gate — institutional mandate is still required.
      await authorizeSageWorkspaceAccess(deps, ctx, {
        workspaceId,
        requiredPermission: SAGE_PERMISSIONS.DECISION_RECORD,
      })

      const result = await withSagePlatformTransaction(async (sql: SageSqlClient) => {
        // Bind tenant for RLS before mandate lock.
        await sql.query(`select set_config('app.tenant_id', $1, true)`, [scope.orgId])
        return executeInstitutionalActionInTransaction(sql, {
          actor: {
            orgId: scope.orgId,
            workspaceId,
            actorId: scope.actorId,
            actorKind,
            currentPositionId: input.positionId,
            authenticated: true,
            activeWorkspaceMembership: true,
            applicationPermissionGranted: true,
            // Recusal is never browser-supplied; server defaults to false until
            // a dedicated recusal store is wired.
            conflictOrRecusal: false,
          },
          mandateId: input.mandateId,
          resourceId: input.resourceId,
          action: 'resource.commit',
          evaluatedAt: new Date().toISOString(),
          idempotencyKey: options.idempotencyKey,
          requestedCommitMinor: input.requestedCommitMinor,
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
      }
    },
  )
}
