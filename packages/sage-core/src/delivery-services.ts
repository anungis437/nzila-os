// ─── @nzila/sage-core — Phase 8A secure recipient delivery services ──────────
// Administrative delivery lifecycle (request → independent approval → invitation
// issuance → revocation/expiry) and recipient access (claim → grant-scoped,
// identity-bound, integrity-verified, durably-receipted download). Every
// administrative mutation is authenticated, tenant-scoped, workspace-authorized,
// permission-authorized, human-attributed, idempotent, CAS-safe, and audited.
// Every recipient access is recipient-authenticated, grant-scoped, identity- and
// package-bound, time/count-bounded, revocable, rate-limited, integrity-verified,
// and receipted BEFORE bytes stream.

import { SAGE_PERMISSIONS } from './permissions'
import {
  SAGE_AUDIT_ACTIONS,
  SAGE_AUDIT_RESOURCES,
  buildSageAuditPayload,
  type SageAuditAction,
  type SageAuditResource,
} from './audit-events'
import {
  authorizeSageWorkspaceAccess,
  dispatchOutboxEvent,
  type SageServiceDeps,
} from './services'
import { contextNow, type SageServiceContext } from './service-context'
import {
  conflict,
  forbidden,
  invalidInput,
  notFound,
  rateLimited,
} from './service-errors'
import { assertDeliveryRequesterCannotApproveOwn } from './invariants'
import { verifySageExportPackageBytes } from './export-package'
import { sha256Hex } from './export-scope'
import {
  generateDeliveryToken,
  hashDeliveryToken,
  hashNormalizedEmail,
  hashRecipientIdentity,
  verifyDeliveryToken,
} from './delivery-identity'
import {
  isSageRecipientAccessContext,
  recipientContextNow,
  type SageRecipientAccessContext,
} from './recipient-context'
import type {
  SageDeliveryApproval,
  SageDeliveryGrant,
  SageDeliveryReceipt,
  SageDeliveryReceiptEventType,
  SageDeliveryRecipient,
  SageDeliveryRequest,
  SageDeliveryRevocationReasonCode,
} from './delivery-types'
import { SAGE_DELIVERY_REVOCATION_REASON_CODES } from './delivery-types'

const DELIVERY_IDENTITY_PROVIDER = 'sage_email_invitation'
/** Default invitation lifetime: short-lived one-time claim window. */
const DEFAULT_INVITATION_TTL_MS = 72 * 60 * 60 * 1000 // 72h
const MAX_ACCESS_WINDOW_MS = 90 * 24 * 60 * 60 * 1000 // 90 days
const MAX_ACCESSES_CAP = 100

// ── Shared helpers ────────────────────────────────────────────────────────────

function assertHuman(ctx: SageServiceContext): void {
  if (ctx.actor.actorKind !== 'human') {
    forbidden('this action requires an authenticated human actor')
  }
}

/** Stable, deterministic delivery event id (same inputs → same id → dedupe). */
function deliveryEventId(kind: string, ...parts: string[]): string {
  return sha256Hex([kind, ...parts].join(':'))
}

/** Best-effort administrative audit (non-outbox) for low-risk reads/creates. */
async function emitDelivery(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  action: SageAuditAction,
  resource: SageAuditResource,
  resourceId: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await deps.audit.record(
    buildSageAuditPayload({
      actorId: ctx.actor.actorId,
      orgId: ctx.actor.orgId,
      action,
      resource,
      resourceId,
      payload,
    }),
  )
}

// ── Recipients ────────────────────────────────────────────────────────────────

export async function createSageDeliveryRecipient(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; displayName: string; email: string },
): Promise<SageDeliveryRecipient> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_DELIVERY_REQUEST,
  })
  assertHuman(ctx)
  if (!input.displayName || !input.displayName.trim()) invalidInput('a recipient name is required')
  if (!input.email || !input.email.includes('@')) invalidInput('a valid recipient email is required')

  const normalizedEmailHash = hashNormalizedEmail(input.email)
  const ts = contextNow(ctx)
  // The email invitation flow provides verification: a subject bound to the
  // deterministic email hash. Plaintext email is used only to derive the hash
  // and is never persisted here.
  const recipient = await deps.repo.createDeliveryRecipient({
    orgId: ws.orgId,
    workspaceId: ws.id,
    displayName: input.displayName.trim(),
    identityProvider: DELIVERY_IDENTITY_PROVIDER,
    identitySubject: normalizedEmailHash,
    normalizedEmailHash,
    verificationStatus: 'verified',
    verifiedAt: ts,
    createdBy: ctx.actor.actorId,
    createdAt: ts,
    updatedAt: ts,
  })
  await emitDelivery(
    deps,
    ctx,
    SAGE_AUDIT_ACTIONS.DELIVERY_RECIPIENT_CREATED,
    SAGE_AUDIT_RESOURCES.DELIVERY_RECIPIENT,
    recipient.id,
    { recipientId: recipient.id, identityProvider: recipient.identityProvider },
  )
  return recipient
}

export async function listSageDeliveryRecipients(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string },
): Promise<SageDeliveryRecipient[]> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_DELIVERY_READ,
  })
  return deps.repo.listDeliveryRecipients(ws.id, ws.orgId)
}

// ── Delivery requests ─────────────────────────────────────────────────────────

export async function requestSageDelivery(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: {
    workspaceId: string
    exportPackageId: string
    recipientId: string
    purpose?: string
    accessExpiresAt: string
    maxAccesses: number
  },
): Promise<SageDeliveryRequest> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_DELIVERY_REQUEST,
  })
  assertHuman(ctx)

  const expiresAtMs = Date.parse(input.accessExpiresAt)
  if (Number.isNaN(expiresAtMs)) invalidInput('a valid access expiry is required')
  const nowMs = Date.parse(contextNow(ctx))
  if (expiresAtMs <= nowMs) invalidInput('the access expiry must be in the future')
  if (expiresAtMs - nowMs > MAX_ACCESS_WINDOW_MS) invalidInput('the access window is too long')
  if (!Number.isInteger(input.maxAccesses) || input.maxAccesses < 1 || input.maxAccesses > MAX_ACCESSES_CAP) {
    invalidInput('the maximum access count is out of range')
  }

  const pkg = await deps.repo.getExportPackage(input.exportPackageId, ws.id, ws.orgId)
  if (!pkg) notFound('export package')
  const recipient = await deps.repo.getDeliveryRecipient(input.recipientId, ws.id, ws.orgId)
  if (!recipient) notFound('delivery recipient')
  if (recipient.verificationStatus !== 'verified') {
    conflict('the recipient is not verified')
  }

  const recipientIdentityHash = hashRecipientIdentity({
    identityProvider: recipient.identityProvider,
    identitySubject: recipient.identitySubject,
    normalizedEmailHash: recipient.normalizedEmailHash,
  })
  const ts = contextNow(ctx)
  const eventId = deliveryEventId('delivery_requested', pkg.id, recipient.id, ctx.actor.actorId, ts)
  const safePayload = {
    exportPackageId: pkg.id,
    recipientId: recipient.id,
    packageContentHash: pkg.contentHash,
    recipientIdentityHash,
    policyVersion: pkg.policyVersion,
    requestedMaxAccesses: input.maxAccesses,
  }
  const req = await deps.repo.createDeliveryRequest({
    request: {
      orgId: ws.orgId,
      workspaceId: ws.id,
      exportPackageId: pkg.id,
      recipientId: recipient.id,
      requestedBy: ctx.actor.actorId,
      purpose: input.purpose?.trim() || null,
      status: 'requested',
      packageContentHash: pkg.contentHash,
      packageManifestHash: pkg.manifestHash,
      recipientIdentityHash,
      policyVersion: pkg.policyVersion,
      requestedAccessExpiresAt: input.accessExpiresAt,
      requestedMaxAccesses: input.maxAccesses,
      requestedAt: ts,
      updatedAt: ts,
    },
    auditEvent: {
      eventId,
      actorId: ctx.actor.actorId,
      action: SAGE_AUDIT_ACTIONS.DELIVERY_REQUESTED,
      resourceType: SAGE_AUDIT_RESOURCES.DELIVERY_REQUEST,
      safePayload,
    },
  })
  await dispatchOutboxEvent(deps, {
    eventId,
    actorId: ctx.actor.actorId,
    orgId: ws.orgId,
    action: SAGE_AUDIT_ACTIONS.DELIVERY_REQUESTED,
    resource: SAGE_AUDIT_RESOURCES.DELIVERY_REQUEST,
    resourceId: req.id,
    payload: safePayload,
    at: ts,
  })
  return req
}

export async function listSageDeliveryRequests(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string },
): Promise<SageDeliveryRequest[]> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_DELIVERY_READ,
  })
  return deps.repo.listDeliveryRequests(ws.id, ws.orgId)
}

export async function getSageDeliveryRequest(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; deliveryRequestId: string },
): Promise<SageDeliveryRequest> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_DELIVERY_READ,
  })
  const req = await deps.repo.getDeliveryRequest(input.deliveryRequestId, ws.id, ws.orgId)
  if (!req) notFound('delivery request')
  return req
}

// ── Independent approval / denial ──────────────────────────────────────────────

async function decideDelivery(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; deliveryRequestId: string; rationale: string },
  decision: 'approved' | 'denied',
): Promise<SageDeliveryApproval> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_DELIVERY_APPROVE,
  })
  // A named-human, independent judgment.
  assertHuman(ctx)
  if (!input.rationale || !input.rationale.trim()) invalidInput('a decision rationale is required')

  const req = await deps.repo.getDeliveryRequest(input.deliveryRequestId, ws.id, ws.orgId)
  if (!req) notFound('delivery request')
  if (req.status !== 'requested') conflict('the delivery request is no longer pending a decision')
  // Separation of duties: the requester can never decide their own request, and
  // service/system actors were already rejected by assertHuman.
  assertDeliveryRequesterCannotApproveOwn({ requestedBy: req.requestedBy, approverId: ctx.actor.actorId })

  // Approval FREEZES a recomputed view of the immutable package + verified
  // recipient. Any drift since the request → CONFLICT (never a silent refresh).
  if (decision === 'approved') {
    const pkg = await deps.repo.getExportPackage(req.exportPackageId, ws.id, ws.orgId)
    if (!pkg) notFound('export package')
    const recipient = await deps.repo.getDeliveryRecipient(req.recipientId, ws.id, ws.orgId)
    if (!recipient) notFound('delivery recipient')
    if (recipient.verificationStatus !== 'verified') conflict('the recipient is no longer verified')
    const recipientIdentityHash = hashRecipientIdentity({
      identityProvider: recipient.identityProvider,
      identitySubject: recipient.identitySubject,
      normalizedEmailHash: recipient.normalizedEmailHash,
    })
    if (
      pkg.contentHash !== req.packageContentHash ||
      pkg.manifestHash !== req.packageManifestHash ||
      pkg.policyVersion !== req.policyVersion ||
      recipientIdentityHash !== req.recipientIdentityHash
    ) {
      conflict('the package or recipient changed; a new delivery request is required')
    }
  }

  const ts = contextNow(ctx)
  const action =
    decision === 'approved' ? SAGE_AUDIT_ACTIONS.DELIVERY_APPROVED : SAGE_AUDIT_ACTIONS.DELIVERY_DENIED
  const eventId = deliveryEventId(`delivery_${decision}`, req.id, ctx.actor.actorId, ts)
  const safePayload = {
    deliveryRequestId: req.id,
    exportPackageId: req.exportPackageId,
    recipientId: req.recipientId,
    packageContentHash: req.packageContentHash,
    recipientIdentityHash: req.recipientIdentityHash,
  }
  const decided = await deps.repo.decideDeliveryRequest({
    deliveryRequestId: req.id,
    workspaceId: ws.id,
    orgId: ws.orgId,
    decision,
    updatedAt: ts,
    approval: {
      orgId: ws.orgId,
      workspaceId: ws.id,
      deliveryRequestId: req.id,
      decision,
      approverId: ctx.actor.actorId,
      rationale: input.rationale.trim(),
      approvedPackageContentHash: req.packageContentHash,
      approvedManifestHash: req.packageManifestHash,
      approvedRecipientIdentityHash: req.recipientIdentityHash,
      approvedPolicyVersion: req.policyVersion,
      approvedAccessExpiresAt: req.requestedAccessExpiresAt,
      approvedMaxAccesses: req.requestedMaxAccesses,
      decidedAt: ts,
    },
    auditEvent: {
      eventId,
      actorId: ctx.actor.actorId,
      action,
      resourceType: SAGE_AUDIT_RESOURCES.DELIVERY_APPROVAL,
      safePayload,
    },
  })
  if (!decided) conflict('the delivery request could not be decided')
  await dispatchOutboxEvent(deps, {
    eventId,
    actorId: ctx.actor.actorId,
    orgId: ws.orgId,
    action,
    resource: SAGE_AUDIT_RESOURCES.DELIVERY_APPROVAL,
    resourceId: decided.approval.id,
    payload: safePayload,
    at: ts,
  })
  return decided.approval
}

export function approveSageDelivery(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; deliveryRequestId: string; rationale: string },
): Promise<SageDeliveryApproval> {
  return decideDelivery(deps, ctx, input, 'approved')
}

export function denySageDelivery(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; deliveryRequestId: string; rationale: string },
): Promise<SageDeliveryApproval> {
  return decideDelivery(deps, ctx, input, 'denied')
}

// ── Invitation issuance ─────────────────────────────────────────────────────

export async function issueSageDeliveryInvitation(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; deliveryRequestId: string; invitationTtlMs?: number },
): Promise<{ grant: SageDeliveryGrant }> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    // Issuing an invitation is part of the approval authority.
    requiredPermission: SAGE_PERMISSIONS.EXPORT_DELIVERY_APPROVE,
  })
  assertHuman(ctx)

  const req = await deps.repo.getDeliveryRequest(input.deliveryRequestId, ws.id, ws.orgId)
  if (!req) notFound('delivery request')
  if (req.status !== 'approved') conflict('only an approved delivery request can be issued')
  const approval = await deps.repo.getDeliveryApproval(req.id, ws.id, ws.orgId)
  if (!approval || approval.decision !== 'approved') conflict('the delivery approval is missing')
  const recipient = await deps.repo.getDeliveryRecipient(req.recipientId, ws.id, ws.orgId)
  if (!recipient) notFound('delivery recipient')

  // Re-verify the immutable package still matches the approved hashes before
  // minting an invitation.
  const pkg = await deps.repo.getExportPackage(req.exportPackageId, ws.id, ws.orgId)
  if (!pkg) notFound('export package')
  if (
    pkg.contentHash !== approval.approvedPackageContentHash ||
    pkg.manifestHash !== approval.approvedManifestHash
  ) {
    conflict('the package changed after approval; issuance is blocked')
  }

  // Fail closed: without a configured notifier we do NOT reveal the token.
  if (!deps.deliveryNotifier) {
    forbidden('the delivery notification provider is not configured')
  }

  const ts = contextNow(ctx)
  const ttl = input.invitationTtlMs ?? DEFAULT_INVITATION_TTL_MS
  const invitationExpiresAt = new Date(Date.parse(ts) + ttl).toISOString()
  const { token, tokenHash } = generateDeliveryToken()

  const issueEventId = deliveryEventId('delivery_issued', req.id, ts)
  const receiptEventId = deliveryEventId('invitation_issued', req.id, ts)
  const issued = await deps.repo.issueDeliveryGrant({
    grant: {
      orgId: ws.orgId,
      workspaceId: ws.id,
      deliveryRequestId: req.id,
      exportPackageId: req.exportPackageId,
      recipientId: req.recipientId,
      status: 'issued',
      invitationTokenHash: tokenHash,
      invitationExpiresAt,
      accessExpiresAt: approval.approvedAccessExpiresAt,
      maxAccesses: approval.approvedMaxAccesses,
      accessCount: 0,
      issuedBy: ctx.actor.actorId,
      issuedAt: ts,
      updatedAt: ts,
    },
    updatedAt: ts,
    auditEvent: {
      eventId: issueEventId,
      actorId: ctx.actor.actorId,
      action: SAGE_AUDIT_ACTIONS.DELIVERY_INVITATION_ISSUED,
      resourceType: SAGE_AUDIT_RESOURCES.DELIVERY_GRANT,
      safePayload: { deliveryRequestId: req.id, recipientId: req.recipientId },
    },
    receipt: {
      eventId: receiptEventId,
      deliveryRequestId: req.id,
      grantId: null,
      packageId: req.exportPackageId,
      recipientId: req.recipientId,
      eventType: 'invitation_issued',
      safeReasonCode: 'issued',
      occurredAt: ts,
    },
  })
  if (!issued) conflict('the delivery invitation could not be issued')
  if (!issued.created) {
    // Idempotent: an invitation already exists — never mint or resend a token.
    return { grant: issued.grant }
  }

  // Deliver the invitation. AT-LEAST-ONCE with a stable messageId; the token
  // flows ONLY to the notifier to build the secure claim URL — never returned to
  // the browser, logged, or audited.
  await deps.deliveryNotifier.sendInvitation({
    grantId: issued.grant.id,
    recipientId: recipient.id,
    recipientEmailHash: recipient.normalizedEmailHash,
    organizationSafeName: ws.name,
    purposeSummary: req.purpose ?? null,
    invitationExpiresAt,
    claimToken: token,
    messageId: issued.grant.id,
    idempotencyKey: `sage-delivery-invitation:${issued.grant.id}`,
  })
  await dispatchOutboxEvent(deps, {
    eventId: issueEventId,
    actorId: ctx.actor.actorId,
    orgId: ws.orgId,
    action: SAGE_AUDIT_ACTIONS.DELIVERY_INVITATION_ISSUED,
    resource: SAGE_AUDIT_RESOURCES.DELIVERY_GRANT,
    resourceId: issued.grant.id,
    payload: { deliveryRequestId: req.id, recipientId: req.recipientId },
    at: ts,
  })
  return { grant: issued.grant }
}

// ── Grants + receipts (administrative reads) ───────────────────────────────────

export async function listSageDeliveryGrants(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string },
): Promise<SageDeliveryGrant[]> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_DELIVERY_READ,
  })
  return deps.repo.listDeliveryGrants(ws.id, ws.orgId)
}

export async function getSageDeliveryGrant(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; grantId: string },
): Promise<SageDeliveryGrant> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_DELIVERY_READ,
  })
  const grant = await deps.repo.getDeliveryGrant(input.grantId, ws.id, ws.orgId)
  if (!grant) notFound('delivery grant')
  return grant
}

export async function listSageDeliveryReceipts(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; grantId: string },
): Promise<SageDeliveryReceipt[]> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_DELIVERY_READ,
  })
  const grant = await deps.repo.getDeliveryGrant(input.grantId, ws.id, ws.orgId)
  if (!grant) notFound('delivery grant')
  return deps.repo.listDeliveryReceipts(grant.id, ws.id, ws.orgId)
}

// ── Revocation ─────────────────────────────────────────────────────────────

export async function revokeSageDeliveryGrant(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: {
    workspaceId: string
    grantId: string
    revocationReasonCode: SageDeliveryRevocationReasonCode
  },
): Promise<SageDeliveryGrant> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_DELIVERY_REVOKE,
  })
  assertHuman(ctx)
  if (!SAGE_DELIVERY_REVOCATION_REASON_CODES.includes(input.revocationReasonCode)) {
    invalidInput('a valid revocation reason is required')
  }
  const grant = await deps.repo.getDeliveryGrant(input.grantId, ws.id, ws.orgId)
  if (!grant) notFound('delivery grant')
  if (grant.status !== 'issued' && grant.status !== 'active') {
    conflict('only an issued or active grant can be revoked')
  }

  const ts = contextNow(ctx)
  const eventId = deliveryEventId('grant_revoked', grant.id, ts)
  const revoked = await deps.repo.revokeDeliveryGrant({
    grantId: grant.id,
    workspaceId: ws.id,
    orgId: ws.orgId,
    revokedBy: ctx.actor.actorId,
    revocationReasonCode: input.revocationReasonCode,
    revokedAt: ts,
    auditEvent: {
      eventId,
      actorId: ctx.actor.actorId,
      action: SAGE_AUDIT_ACTIONS.DELIVERY_GRANT_REVOKED,
      resourceType: SAGE_AUDIT_RESOURCES.DELIVERY_GRANT,
      safePayload: { grantId: grant.id, revocationReasonCode: input.revocationReasonCode },
    },
    receipt: {
      eventId: `${grant.id}:grant_revoked`,
      deliveryRequestId: grant.deliveryRequestId,
      grantId: grant.id,
      packageId: grant.exportPackageId,
      recipientId: grant.recipientId,
      eventType: 'grant_revoked',
      safeReasonCode: input.revocationReasonCode,
      occurredAt: ts,
    },
  })
  if (!revoked) conflict('the grant could not be revoked')
  await dispatchOutboxEvent(deps, {
    eventId,
    actorId: ctx.actor.actorId,
    orgId: ws.orgId,
    action: SAGE_AUDIT_ACTIONS.DELIVERY_GRANT_REVOKED,
    resource: SAGE_AUDIT_RESOURCES.DELIVERY_GRANT,
    resourceId: grant.id,
    payload: { grantId: grant.id, revocationReasonCode: input.revocationReasonCode },
    at: ts,
  })
  return revoked
}

// ── Expiry (maintenance; also enforced read-time in claim/access) ──────────────

export async function expireSageDeliveryGrants(
  deps: SageServiceDeps,
  opts: { now?: string; limit?: number; workspaceId?: string; orgId?: string } = {},
): Promise<{ expired: number }> {
  const now = opts.now ?? new Date().toISOString()
  const limit = opts.limit ?? 100
  const expired = await deps.repo.expireDeliveryGrants({
    now,
    limit,
    auditAction: SAGE_AUDIT_ACTIONS.DELIVERY_GRANT_EXPIRED,
    workspaceId: opts.workspaceId,
    orgId: opts.orgId,
  })
  for (const grant of expired) {
    await dispatchOutboxEvent(deps, {
      eventId: `${grant.id}:grant_expired`,
      actorId: 'system',
      orgId: grant.orgId,
      action: SAGE_AUDIT_ACTIONS.DELIVERY_GRANT_EXPIRED,
      resource: SAGE_AUDIT_RESOURCES.DELIVERY_GRANT,
      resourceId: grant.id,
      payload: { grantId: grant.id, deliveryRequestId: grant.deliveryRequestId },
      at: now,
    })
  }
  return { expired: expired.length }
}

// ── Recipient: claim ───────────────────────────────────────────────────────

export async function claimSageDeliveryInvitation(
  deps: SageServiceDeps,
  input: {
    token: string
    verifiedEmail: string
    rateLimitKey?: string
    now?: string
  },
): Promise<{ grant: SageDeliveryGrant; sessionToken: string }> {
  if (!input.token) invalidInput('an invitation token is required')
  if (!input.verifiedEmail || !input.verifiedEmail.includes('@')) {
    invalidInput('a verified recipient email is required')
  }
  const now = input.now ?? new Date().toISOString()

  if (deps.deliveryRateLimiter && input.rateLimitKey) {
    const { allowed } = await deps.deliveryRateLimiter.check(input.rateLimitKey)
    if (!allowed) rateLimited('too many claim attempts')
  }

  const tokenHash = hashDeliveryToken(input.token)
  const grant = await deps.repo.getDeliveryGrantByInvitationHash(tokenHash)
  // Non-disclosing: an unknown/expired/already-claimed token looks identical.
  if (!grant || grant.status !== 'issued' || grant.invitationExpiresAt <= now) {
    forbidden('the invitation is invalid or has expired')
  }

  const recipient = await deps.repo.getDeliveryRecipient(
    grant.recipientId,
    grant.workspaceId,
    grant.orgId,
  )
  if (!recipient) forbidden('the invitation is invalid or has expired')

  // Identity binding: the claimer must control the recipient's verified email.
  // A different verified recipient's email cannot claim this grant.
  const normalizedEmailHash = hashNormalizedEmail(input.verifiedEmail)
  const claimerIdentityHash = hashRecipientIdentity({
    identityProvider: recipient.identityProvider,
    identitySubject: recipient.identitySubject,
    normalizedEmailHash,
  })
  const req = await deps.repo.getDeliveryRequest(grant.deliveryRequestId, grant.workspaceId, grant.orgId)
  if (!req || normalizedEmailHash !== recipient.normalizedEmailHash) {
    forbidden('the invitation is invalid or has expired')
  }
  if (claimerIdentityHash !== req.recipientIdentityHash) {
    forbidden('the recipient identity does not match the approved recipient')
  }

  const { token: sessionToken, tokenHash: sessionTokenHash } = generateDeliveryToken()
  const eventId = deliveryEventId('invitation_claimed', grant.id, now)
  const claimed = await deps.repo.claimDeliveryGrant({
    grantId: grant.id,
    invitationTokenHash: tokenHash,
    claimedIdentityProvider: recipient.identityProvider,
    claimedIdentitySubject: recipient.identitySubject,
    sessionTokenHash,
    claimedAt: now,
    now,
    auditEvent: {
      eventId,
      actorId: recipient.identitySubject,
      action: SAGE_AUDIT_ACTIONS.DELIVERY_INVITATION_CLAIMED,
      resourceType: SAGE_AUDIT_RESOURCES.DELIVERY_GRANT,
      safePayload: { grantId: grant.id, recipientId: recipient.id },
    },
    receipt: {
      eventId: `${grant.id}:invitation_claimed`,
      deliveryRequestId: grant.deliveryRequestId,
      grantId: grant.id,
      packageId: grant.exportPackageId,
      recipientId: grant.recipientId,
      eventType: 'invitation_claimed',
      safeReasonCode: 'claimed',
      occurredAt: now,
    },
  })
  // Concurrency: a second claim (or replay) finds status != 'issued' → conflict.
  if (!claimed) conflict('the invitation has already been claimed')
  await dispatchOutboxEvent(deps, {
    eventId,
    actorId: recipient.identitySubject,
    orgId: grant.orgId,
    action: SAGE_AUDIT_ACTIONS.DELIVERY_INVITATION_CLAIMED,
    resource: SAGE_AUDIT_RESOURCES.DELIVERY_GRANT,
    resourceId: grant.id,
    payload: { grantId: grant.id, recipientId: recipient.id },
    at: now,
  })
  return { grant: claimed, sessionToken }
}

// ── Recipient: package access + download ────────────────────────────────────

async function loadValidatedRecipientGrant(
  deps: SageServiceDeps,
  ctx: SageRecipientAccessContext,
  sessionToken: string,
): Promise<SageDeliveryGrant> {
  if (!isSageRecipientAccessContext(ctx)) {
    forbidden('a valid recipient access context is required')
  }
  if (!sessionToken) forbidden('a recipient session credential is required')
  const grant = await deps.repo.getDeliveryGrantById(ctx.grantId)
  if (
    !grant ||
    grant.id !== ctx.grantId ||
    grant.recipientId !== ctx.recipientId ||
    grant.claimedIdentitySubject !== ctx.actor.identitySubject ||
    grant.claimedIdentityProvider !== ctx.actor.identityProvider ||
    !grant.sessionTokenHash ||
    !verifyDeliveryToken(sessionToken, grant.sessionTokenHash)
  ) {
    forbidden('the recipient session is invalid')
  }
  return grant
}

async function denyRecipientAccess(
  deps: SageServiceDeps,
  grant: SageDeliveryGrant,
  now: string,
  reasonCode: string,
): Promise<never> {
  await deps.repo
    .createDeliveryReceipt({
      orgId: grant.orgId,
      workspaceId: grant.workspaceId,
      receipt: {
        eventId: deliveryEventId('access_denied', grant.id, now, reasonCode),
        deliveryRequestId: grant.deliveryRequestId,
        grantId: grant.id,
        packageId: grant.exportPackageId,
        recipientId: grant.recipientId,
        eventType: 'access_denied',
        safeReasonCode: reasonCode,
        occurredAt: now,
      },
    })
    .catch(() => undefined)
  forbidden('recipient access is not available')
}

export async function authorizeSageRecipientPackageAccess(
  deps: SageServiceDeps,
  ctx: SageRecipientAccessContext,
  input: { sessionToken: string; intent?: 'access' | 'download' },
): Promise<{ package: { id: string; contentHash: string }; mediaType: string; bytes: Uint8Array }> {
  const now = recipientContextNow(ctx)
  const grant = await loadValidatedRecipientGrant(deps, ctx, input.sessionToken)

  if (deps.deliveryRateLimiter) {
    const { allowed } = await deps.deliveryRateLimiter.check(`access:${grant.id}`)
    if (!allowed) rateLimited('too many access attempts')
  }

  // Read-time enforcement independent of any sweeper.
  if (grant.status !== 'active') await denyRecipientAccess(deps, grant, now, 'not_active')
  if (grant.accessExpiresAt <= now) await denyRecipientAccess(deps, grant, now, 'expired')
  if (grant.accessCount >= grant.maxAccesses) await denyRecipientAccess(deps, grant, now, 'access_limit')

  const pkg = await deps.repo.getExportPackage(grant.exportPackageId, grant.workspaceId, grant.orgId)
  if (!pkg) await denyRecipientAccess(deps, grant, now, 'package_unavailable')
  const request = await deps.repo.getDeliveryRequest(
    grant.deliveryRequestId,
    grant.workspaceId,
    grant.orgId,
  )
  if (!request) await denyRecipientAccess(deps, grant, now, 'request_unavailable')
  // Package must still match the approved (frozen) hashes.
  if (
    pkg!.contentHash !== request!.packageContentHash ||
    pkg!.manifestHash !== request!.packageManifestHash
  ) {
    await denyRecipientAccess(deps, grant, now, 'package_changed')
  }

  const object = await deps.repo.getExportPackageObject(pkg!.storageReference)
  if (!object || object.contentHash !== pkg!.contentHash) {
    await denyRecipientAccess(deps, grant, now, 'object_integrity')
  }
  const verified = verifySageExportPackageBytes(object!.bytes, {
    contentHash: pkg!.contentHash,
    manifestHash: pkg!.manifestHash,
  })
  if (!verified.ok) {
    // Integrity failure: deny + record, stream nothing.
    await denyRecipientAccess(deps, grant, now, `integrity_${verified.reason}`)
  }

  // Atomic authorization: increment access_count on the active/in-window/in-budget
  // grant AND write the durable access receipt + audit — BEFORE any bytes stream.
  const eventType: SageDeliveryReceiptEventType =
    input.intent === 'download' ? 'download_authorized' : 'access_authorized'
  const action =
    input.intent === 'download'
      ? SAGE_AUDIT_ACTIONS.DELIVERY_DOWNLOAD_AUTHORIZED
      : SAGE_AUDIT_ACTIONS.DELIVERY_ACCESS_AUTHORIZED
  const eventId = deliveryEventId(eventType, grant.id, now)
  const authorized = await deps.repo.authorizeDeliveryAccess({
    grantId: grant.id,
    identitySubject: ctx.actor.identitySubject,
    now,
    auditEvent: {
      eventId,
      actorId: ctx.actor.identitySubject,
      action,
      resourceType: SAGE_AUDIT_RESOURCES.DELIVERY_GRANT,
      safePayload: { grantId: grant.id, packageContentHash: pkg!.contentHash },
    },
    receipt: {
      eventId: `${grant.id}:${eventType}:${grant.accessCount + 1}`,
      deliveryRequestId: grant.deliveryRequestId,
      grantId: grant.id,
      packageId: grant.exportPackageId,
      recipientId: grant.recipientId,
      eventType,
      safeReasonCode: 'authorized',
      occurredAt: now,
    },
  })
  // Lost a race with revocation/expiry/limit → denied (deterministic).
  if (!authorized) await denyRecipientAccess(deps, grant, now, 'authorization_lost')

  await dispatchOutboxEvent(deps, {
    eventId,
    actorId: ctx.actor.identitySubject,
    orgId: grant.orgId,
    action,
    resource: SAGE_AUDIT_RESOURCES.DELIVERY_GRANT,
    resourceId: grant.id,
    payload: { grantId: grant.id, packageContentHash: pkg!.contentHash },
    at: now,
  })

  return {
    package: { id: pkg!.id, contentHash: pkg!.contentHash },
    mediaType: object!.mediaType,
    bytes: object!.bytes,
  }
}

// ── Recipient: acknowledgment (explicit; idempotent) ───────────────────────────

export async function acknowledgeSageDelivery(
  deps: SageServiceDeps,
  ctx: SageRecipientAccessContext,
  input: { sessionToken: string },
): Promise<{ acknowledged: boolean }> {
  const now = recipientContextNow(ctx)
  const grant = await loadValidatedRecipientGrant(deps, ctx, input.sessionToken)
  if (grant.status !== 'active' && grant.status !== 'expired' && grant.status !== 'revoked') {
    forbidden('the grant cannot be acknowledged')
  }
  // Idempotent: unique event_id → at most one acknowledgment receipt.
  const receipt = await deps.repo.createDeliveryReceipt({
    orgId: grant.orgId,
    workspaceId: grant.workspaceId,
    receipt: {
      eventId: `${grant.id}:recipient_acknowledged`,
      deliveryRequestId: grant.deliveryRequestId,
      grantId: grant.id,
      packageId: grant.exportPackageId,
      recipientId: grant.recipientId,
      eventType: 'recipient_acknowledged',
      safeReasonCode: 'acknowledged',
      occurredAt: now,
    },
  })
  return { acknowledged: Boolean(receipt) }
}
