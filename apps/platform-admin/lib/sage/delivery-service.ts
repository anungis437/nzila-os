/**
 * Platform Admin — SAGE Phase 8A secure delivery service layer (server-only)
 *
 * Thin orchestration for the delivery routes/pages. Composes the SAGE runtime +
 * service context from a server-verified actor scope, calls the sage-core
 * delivery services, and maps results to browser-safe shapes. All authorization,
 * tenant boundary, human-actor assurance, freeze/CAS, integrity, rate limiting,
 * receipts, and audit happen inside the SAGE service layer.
 *
 * Server-only: must never be imported into a client bundle.
 */
import 'server-only'
import {
  SageServiceError,
  acknowledgeSageDelivery,
  approveSageDelivery,
  authorizeSageRecipientPackageAccess,
  claimSageDeliveryInvitation,
  createSageDeliveryRecipient,
  denySageDelivery,
  getSageDeliveryRequest,
  issueSageDeliveryInvitation,
  listSageDeliveryGrants,
  listSageDeliveryReceipts,
  listSageDeliveryRecipients,
  listSageDeliveryRequests,
  requestSageDelivery,
  revokeSageDeliveryGrant,
  type SageDeliveryNotifier,
  type SageDeliveryRateLimiter,
  type SageDeliveryRevocationReasonCode,
  type SageRecipientAccessContext,
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
import { getSageDeliveryNotifier } from './delivery-notifier-adapter'
import {
  toDeliveryGrantResponse,
  toDeliveryReceiptResponse,
  toDeliveryRecipientResponse,
  toDeliveryRequestResponse,
} from './delivery-view'
import type {
  SageDeliveryGrantResponse,
  SageDeliveryReceiptResponse,
  SageDeliveryRecipientResponse,
  SageDeliveryRequestResponse,
} from './delivery-schemas'

// ── Runtime deps (adds notifier + rate limiter) ────────────────────────────────

const rateBuckets = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60_000

function defaultRateLimiter(): SageDeliveryRateLimiter {
  return {
    async check(key: string) {
      const now = Date.now()
      const bucket = rateBuckets.get(key)
      if (!bucket || now > bucket.resetAt) {
        rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
        return { allowed: true }
      }
      if (bucket.count >= RATE_LIMIT) {
        return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }
      }
      bucket.count += 1
      return { allowed: true }
    },
  }
}

export interface DeliveryDepsOverrides {
  notifier?: SageDeliveryNotifier
  rateLimiter?: SageDeliveryRateLimiter
  cache?: AtomicIdempotencyCache
}

function deliveryDeps(scope: SageActorScope, overrides?: DeliveryDepsOverrides): SageServiceDeps {
  return {
    ...createSageRuntime(scope),
    deliveryNotifier: overrides?.notifier ?? getSageDeliveryNotifier(),
    deliveryRateLimiter: overrides?.rateLimiter ?? defaultRateLimiter(),
  }
}

/** Recipient-side deps (no org scope; recipient never gets a SageServiceContext). */
function recipientDeps(overrides?: DeliveryDepsOverrides): SageServiceDeps {
  const scope: SageActorScope = { actorId: 'sage-recipient', orgId: 'sage-recipient', orgRole: 'none', authenticationType: 'internal_system' }
  return {
    ...createSageRuntime(scope),
    deliveryNotifier: overrides?.notifier ?? getSageDeliveryNotifier(),
    deliveryRateLimiter: overrides?.rateLimiter ?? defaultRateLimiter(),
  }
}

function isAccessDenied(error: unknown): boolean {
  return error instanceof SageServiceError && (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN')
}

interface MutationOptions {
  idempotencyKey: string
  cache?: AtomicIdempotencyCache
}

async function withDeliveryIdempotency<T>(
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

// ── Administrative reads ───────────────────────────────────────────────────────

export async function listDeliveryRecipientsForScope(
  scope: SageActorScope,
  workspaceId: string,
): Promise<SageDeliveryRecipientResponse[] | null> {
  const deps = deliveryDeps(scope)
  const ctx = createSageServiceContext(scope)
  try {
    return (await listSageDeliveryRecipients(deps, ctx, { workspaceId })).map(toDeliveryRecipientResponse)
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

export async function listDeliveryRequestsForScope(
  scope: SageActorScope,
  workspaceId: string,
): Promise<SageDeliveryRequestResponse[] | null> {
  const deps = deliveryDeps(scope)
  const ctx = createSageServiceContext(scope)
  try {
    return (await listSageDeliveryRequests(deps, ctx, { workspaceId })).map(toDeliveryRequestResponse)
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

export async function getDeliveryRequestForScope(
  scope: SageActorScope,
  workspaceId: string,
  deliveryRequestId: string,
): Promise<SageDeliveryRequestResponse | null> {
  const deps = deliveryDeps(scope)
  const ctx = createSageServiceContext(scope)
  try {
    return toDeliveryRequestResponse(await getSageDeliveryRequest(deps, ctx, { workspaceId, deliveryRequestId }))
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

export async function listDeliveryGrantsForScope(
  scope: SageActorScope,
  workspaceId: string,
): Promise<SageDeliveryGrantResponse[] | null> {
  const deps = deliveryDeps(scope)
  const ctx = createSageServiceContext(scope)
  try {
    return (await listSageDeliveryGrants(deps, ctx, { workspaceId })).map(toDeliveryGrantResponse)
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

export async function listDeliveryReceiptsForScope(
  scope: SageActorScope,
  workspaceId: string,
  grantId: string,
): Promise<SageDeliveryReceiptResponse[] | null> {
  const deps = deliveryDeps(scope)
  const ctx = createSageServiceContext(scope)
  try {
    return (await listSageDeliveryReceipts(deps, ctx, { workspaceId, grantId })).map(toDeliveryReceiptResponse)
  } catch (error) {
    if (isAccessDenied(error)) return null
    throw error
  }
}

// ── Administrative mutations ───────────────────────────────────────────────────

export async function createDeliveryRecipientForScope(
  scope: SageActorScope,
  workspaceId: string,
  input: { displayName: string; email: string },
  options: MutationOptions,
): Promise<{ response: SageDeliveryRecipientResponse; replayed: boolean }> {
  const deps = deliveryDeps(scope, { cache: options.cache })
  const ctx = createSageServiceContext(scope)
  return withDeliveryIdempotency(scope, 'delivery.recipient.create', { workspaceId, displayName: input.displayName }, options, 201, async () =>
    toDeliveryRecipientResponse(await createSageDeliveryRecipient(deps, ctx, { workspaceId, ...input })),
  )
}

export async function createDeliveryRequestForScope(
  scope: SageActorScope,
  workspaceId: string,
  input: { exportPackageId: string; recipientId: string; purpose?: string; accessExpiresAt: string; maxAccesses: number },
  options: MutationOptions,
): Promise<{ response: SageDeliveryRequestResponse; replayed: boolean }> {
  const deps = deliveryDeps(scope, { cache: options.cache })
  const ctx = createSageServiceContext(scope)
  return withDeliveryIdempotency(scope, 'delivery.request.create', { workspaceId, ...input }, options, 201, async () =>
    toDeliveryRequestResponse(await requestSageDelivery(deps, ctx, { workspaceId, ...input })),
  )
}

export async function approveDeliveryRequestForScope(
  scope: SageActorScope,
  workspaceId: string,
  deliveryRequestId: string,
  rationale: string,
  options: MutationOptions,
): Promise<{ response: { id: string; decision: string }; replayed: boolean }> {
  const deps = deliveryDeps(scope, { cache: options.cache })
  const ctx = createSageServiceContext(scope)
  return withDeliveryIdempotency(scope, 'delivery.request.approve', { workspaceId, deliveryRequestId }, options, 200, async () => {
    const a = await approveSageDelivery(deps, ctx, { workspaceId, deliveryRequestId, rationale })
    return { id: a.id, decision: a.decision }
  })
}

export async function denyDeliveryRequestForScope(
  scope: SageActorScope,
  workspaceId: string,
  deliveryRequestId: string,
  rationale: string,
  options: MutationOptions,
): Promise<{ response: { id: string; decision: string }; replayed: boolean }> {
  const deps = deliveryDeps(scope, { cache: options.cache })
  const ctx = createSageServiceContext(scope)
  return withDeliveryIdempotency(scope, 'delivery.request.deny', { workspaceId, deliveryRequestId }, options, 200, async () => {
    const a = await denySageDelivery(deps, ctx, { workspaceId, deliveryRequestId, rationale })
    return { id: a.id, decision: a.decision }
  })
}

export async function issueDeliveryInvitationForScope(
  scope: SageActorScope,
  workspaceId: string,
  deliveryRequestId: string,
  options: MutationOptions,
): Promise<{ response: SageDeliveryGrantResponse; replayed: boolean }> {
  const deps = deliveryDeps(scope, { cache: options.cache })
  const ctx = createSageServiceContext(scope)
  return withDeliveryIdempotency(scope, 'delivery.invitation.issue', { workspaceId, deliveryRequestId }, options, 201, async () => {
    const { grant } = await issueSageDeliveryInvitation(deps, ctx, { workspaceId, deliveryRequestId })
    return toDeliveryGrantResponse(grant)
  })
}

export async function revokeDeliveryGrantForScope(
  scope: SageActorScope,
  workspaceId: string,
  grantId: string,
  revocationReasonCode: SageDeliveryRevocationReasonCode,
  options: MutationOptions,
): Promise<{ response: SageDeliveryGrantResponse; replayed: boolean }> {
  const deps = deliveryDeps(scope, { cache: options.cache })
  const ctx = createSageServiceContext(scope)
  return withDeliveryIdempotency(scope, 'delivery.grant.revoke', { workspaceId, grantId, revocationReasonCode }, options, 200, async () =>
    toDeliveryGrantResponse(await revokeSageDeliveryGrant(deps, ctx, { workspaceId, grantId, revocationReasonCode })),
  )
}

// ── Recipient flows (no org scope) ─────────────────────────────────────────────

export async function claimDeliveryInvitation(
  input: { token: string; verifiedEmail: string; rateLimitKey?: string },
  overrides?: DeliveryDepsOverrides,
): Promise<{ grantId: string; sessionToken: string; accessExpiresAt: string; maxAccesses: number; accessCount: number }> {
  const deps = recipientDeps(overrides)
  const { grant, sessionToken } = await claimSageDeliveryInvitation(deps, {
    token: input.token,
    verifiedEmail: input.verifiedEmail,
    rateLimitKey: input.rateLimitKey,
  })
  return {
    grantId: grant.id,
    sessionToken,
    accessExpiresAt: grant.accessExpiresAt,
    maxAccesses: grant.maxAccesses,
    accessCount: grant.accessCount,
  }
}

async function buildRecipientContext(
  deps: SageServiceDeps,
  grantId: string,
): Promise<SageRecipientAccessContext | null> {
  const grant = await deps.repo.getDeliveryGrantById(grantId)
  if (!grant || !grant.claimedIdentityProvider || !grant.claimedIdentitySubject) return null
  return {
    kind: 'sage_recipient_access',
    actor: {
      actorKind: 'human',
      authenticationType: 'external_recipient',
      identityProvider: grant.claimedIdentityProvider,
      identitySubject: grant.claimedIdentitySubject,
    },
    recipientId: grant.recipientId,
    grantId: grant.id,
  }
}

export async function authorizeRecipientDownload(
  input: { grantId: string; sessionToken: string; intent: 'access' | 'download' },
  overrides?: DeliveryDepsOverrides,
): Promise<{ mediaType: string; bytes: Uint8Array; contentHash: string } | null> {
  const deps = recipientDeps(overrides)
  const ctx = await buildRecipientContext(deps, input.grantId)
  if (!ctx) return null
  const res = await authorizeSageRecipientPackageAccess(deps, ctx, { sessionToken: input.sessionToken, intent: input.intent })
  return { mediaType: res.mediaType, bytes: res.bytes, contentHash: res.package.contentHash }
}

export async function acknowledgeRecipientDelivery(
  input: { grantId: string; sessionToken: string },
  overrides?: DeliveryDepsOverrides,
): Promise<{ acknowledged: boolean } | null> {
  const deps = recipientDeps(overrides)
  const ctx = await buildRecipientContext(deps, input.grantId)
  if (!ctx) return null
  return acknowledgeSageDelivery(deps, ctx, { sessionToken: input.sessionToken })
}
