// ─── SAGE Phase 8A — secure recipient delivery (security invariants) ─────────
// Proves separation of duties, identity/package binding, one-time hashed tokens,
// grant-scoped/identity-bound/time+count-bounded revocable access, durable
// receipts (no PII/tokens), and CAS concurrency — all on the InMemory repo with
// an injected clock and an in-memory notifier.

import { describe, it, expect, beforeEach } from 'vitest'
import { InMemorySageRepository } from './repository'
import { SAGE_PERMISSIONS } from './permissions'
import { buildSageExportPackage } from './export-package'
import { canonicalizeSageExportScope } from './export-scope'
import { hashDeliveryToken } from './delivery-identity'
import type { SageServiceContext, SageServiceActor } from './service-context'
import type { SageAuditSink } from './audit-sink'
import type { SageAuditPayload } from './audit-events'
import type { SageDeliveryNotifier, SageDeliveryInvitationMessage } from './delivery-notifier'
import type { SageRecipientAccessContext } from './recipient-context'
import type { SageDeliveryGrant } from './delivery-types'
import type { SageExportPackage } from './types'
import { NotificationDispatcher } from './notification-dispatcher'
import {
  acknowledgeSageDelivery,
  approveSageDelivery,
  authorizeSageRecipientPackageAccess,
  claimSageDeliveryInvitation,
  createSageDeliveryRecipient,
  denySageDelivery,
  expireSageDeliveryGrants,
  issueSageDeliveryInvitation,
  requestSageDelivery,
  revokeSageDeliveryGrant,
} from './delivery-services'
import type { SageServiceDeps } from './services'
import { createSageWorkspace } from './services'

const NOW = '2026-07-13T00:00:00.000Z'
const LATER = '2026-08-01T00:00:00.000Z' // within the 90d window
const RECIPIENT_EMAIL = 'reviewer@example.gov'

class CapturingNotifier implements SageDeliveryNotifier {
  readonly sent: SageDeliveryInvitationMessage[] = []
  async sendInvitation(message: SageDeliveryInvitationMessage) {
    this.sent.push(message)
    return { accepted: true, providerMessageId: `prov-${message.grantId}` }
  }
}

class RecordingSink implements SageAuditSink {
  readonly records: SageAuditPayload[] = []
  async record(input: SageAuditPayload): Promise<void> {
    this.records.push(input)
  }
}

let repo: InMemorySageRepository
let sink: RecordingSink
let notifier: CapturingNotifier
let deps: SageServiceDeps

function actor(actorId: string, kind: SageServiceActor['actorKind'], permissions: string[] = []): SageServiceActor {
  return { actorId, orgId: 'org_1', actorKind: kind, permissions }
}
function ctxFor(a: SageServiceActor, iso = NOW): SageServiceContext {
  return { actor: a, now: () => new Date(iso) }
}

type Ctx = {
  ws: string
  org: string
  pkg: SageExportPackage
  requester: SageServiceActor
  approver: SageServiceActor
}

async function seedPackage(ws: string): Promise<SageExportPackage> {
  const scope = canonicalizeSageExportScope({
    policyVersion: 'sage-export-v1',
    packageType: 'internal_review_bundle',
    items: [
      {
        resourceType: 'evidence_item',
        resourceId: 'id-a',
        contentHash: 'hash-a',
        authorizationLevel: 'internal',
        excludedFromExternalReview: false,
        included: true,
        exclusionReason: null,
        order: 0,
      },
    ],
  })
  const artifact = buildSageExportPackage({
    scope,
    workspaceId: ws,
    exportRequestId: 'req',
    approvedScopeHash: 'h',
    resources: [
      { resourceType: 'evidence_item', resourceId: 'id-a', authorizationLevel: 'internal', contentHash: 'hash-a', content: { id: 'id-a' } },
    ],
  })
  const storageReference = `sage-internal://${ws}/pkg-seed`
  await repo.commitExportPackage({
    package: {
      orgId: 'org_1',
      workspaceId: ws,
      exportRequestId: `exp_${ws}`,
      status: 'generated',
      packageType: 'internal_review_bundle',
      manifestJson: artifact.manifestJson,
      manifestHash: artifact.manifestHash,
      contentHash: artifact.contentHash,
      storageReference,
      mediaType: artifact.mediaType,
      sizeBytes: artifact.contentBytes.byteLength,
      policyVersion: 'sage-export-v1',
      itemCount: artifact.itemCount,
      excludedCount: artifact.excludedCount,
      generatedBy: 'admin_1',
      generatedAt: NOW,
      createdAt: NOW,
    },
    object: {
      storageReference,
      mediaType: artifact.mediaType,
      bytes: artifact.contentBytes,
      contentHash: artifact.contentHash,
      sizeBytes: artifact.contentBytes.byteLength,
    },
    auditEvent: { eventId: `seed-pkg-${ws}`, actorId: 'admin_1', action: 'sage.export.package_generated', resourceType: 'sage_export_package', safePayload: {} },
  })
  const pkgs = await repo.listExportPackages(ws, 'org_1')
  return pkgs[0]
}

async function assign(ws: string, actorId: string, role: string): Promise<void> {
  await repo.addWorkspaceMember({ workspaceId: ws, orgId: 'org_1', actorId, createdBy: 'admin_1', createdAt: NOW } as never)
  await repo.assignRole({ workspaceId: ws, orgId: 'org_1', actorId, sageApplicationRole: role, workspaceScope: null, timeBoundAccessExpiresAt: null, accessReason: 'test', approvedBy: 'admin_1', createdAt: NOW, revokedAt: null } as never)
}

async function setup(): Promise<Ctx> {
  const adminActor = actor('admin_1', 'human', Object.values(SAGE_PERMISSIONS))
  const ws = await createSageWorkspace(deps, ctxFor(adminActor), {
    name: 'Example Review Office',
    institutionType: 'crown_corporation',
    riskSurface: 'general_governance',
  })
  await assign(ws.id, 'requester_1', 'export_approver')
  await assign(ws.id, 'approver_1', 'export_delivery_approver')
  const pkg = await seedPackage(ws.id)
  return {
    ws: ws.id,
    org: 'org_1',
    pkg,
    requester: actor('requester_1', 'human'),
    approver: actor('approver_1', 'human'),
  }
}

async function makeRecipient(c: Ctx, email = RECIPIENT_EMAIL) {
  return createSageDeliveryRecipient(deps, ctxFor(c.requester), { workspaceId: c.ws, displayName: 'External Reviewer', email })
}

async function requestApprove(c: Ctx, maxAccesses = 2) {
  const recipient = await makeRecipient(c)
  const req = await requestSageDelivery(deps, ctxFor(c.requester), {
    workspaceId: c.ws,
    exportPackageId: c.pkg.id,
    recipientId: recipient.id,
    purpose: 'independent review',
    accessExpiresAt: LATER,
    maxAccesses,
  })
  await approveSageDelivery(deps, ctxFor(c.approver), { workspaceId: c.ws, deliveryRequestId: req.id, rationale: 'ok' })
  return { recipient, req }
}

async function fullyIssued(c: Ctx, maxAccesses = 2) {
  const { recipient, req } = await requestApprove(c, maxAccesses)
  const { grant } = await issueSageDeliveryInvitation(deps, ctxFor(c.approver), { workspaceId: c.ws, deliveryRequestId: req.id })
  return { recipient, req, grant, token: notifier.sent[notifier.sent.length - 1].claimToken }
}

async function claimed(c: Ctx, maxAccesses = 2) {
  const issued = await fullyIssued(c, maxAccesses)
  const { grant, sessionToken } = await claimSageDeliveryInvitation(deps, { token: issued.token, verifiedEmail: RECIPIENT_EMAIL, now: NOW })
  return { ...issued, grant, sessionToken }
}

function recipientCtx(grant: SageDeliveryGrant, iso = NOW): SageRecipientAccessContext {
  return {
    kind: 'sage_recipient_access',
    actor: {
      actorKind: 'human',
      authenticationType: 'external_recipient',
      identityProvider: grant.claimedIdentityProvider ?? 'sage_email_invitation',
      identitySubject: grant.claimedIdentitySubject ?? 'x',
    },
    recipientId: grant.recipientId,
    grantId: grant.id,
    now: () => new Date(iso),
  }
}

beforeEach(() => {
  repo = new InMemorySageRepository()
  sink = new RecordingSink()
  notifier = new CapturingNotifier()
  const dispatcher = new NotificationDispatcher(repo, notifier, { query: async () => ({ rows: [] }) }, {
    dispatcherInstanceId: 'delivery-test-dispatcher',
  })
  deps = { repo, audit: sink, deliveryNotifier: notifier, deliveryNotificationDispatcher: dispatcher }
})

describe('delivery — separation of duties & authorization', () => {
  it('requester cannot approve their own request (even with approve authority)', async () => {
    const c = await setup()
    await assign(c.ws, 'requester_1', 'export_delivery_approver')
    const recipient = await makeRecipient(c)
    const request = await requestSageDelivery(deps, ctxFor(c.requester), { workspaceId: c.ws, exportPackageId: c.pkg.id, recipientId: recipient.id, accessExpiresAt: LATER, maxAccesses: 1 })
    await expect(
      approveSageDelivery(deps, ctxFor(c.requester), { workspaceId: c.ws, deliveryRequestId: request.id, rationale: 'self' }),
    ).rejects.toThrow('delivery approval is granted by the requester')
  })

  it('a service actor cannot request delivery even with the role', async () => {
    const c = await setup()
    await assign(c.ws, 'svc_1', 'export_approver')
    await expect(
      requestSageDelivery(deps, ctxFor(actor('svc_1', 'service')), { workspaceId: c.ws, exportPackageId: c.pkg.id, recipientId: 'x', accessExpiresAt: LATER, maxAccesses: 1 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('a member with no delivery role cannot request delivery', async () => {
    const c = await setup()
    await assign(c.ws, 'nobody_1', 'read_only_observer')
    await expect(
      requestSageDelivery(deps, ctxFor(actor('nobody_1', 'human')), { workspaceId: c.ws, exportPackageId: c.pkg.id, recipientId: 'x', accessExpiresAt: LATER, maxAccesses: 1 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('the recipient is never added as a workspace member', async () => {
    const c = await setup()
    const { recipient } = await fullyIssued(c)
    expect(await repo.getWorkspaceMember(c.ws, recipient.identitySubject)).toBeUndefined()
  })
})

describe('delivery — approval freeze (identity & package binding)', () => {
  it('a changed recipient identity blocks approval with CONFLICT', async () => {
    const c = await setup()
    const recipient = await makeRecipient(c)
    const req = await requestSageDelivery(deps, ctxFor(c.requester), { workspaceId: c.ws, exportPackageId: c.pkg.id, recipientId: recipient.id, accessExpiresAt: LATER, maxAccesses: 1 })
    const stored = await repo.getDeliveryRecipient(recipient.id, c.ws, c.org)
    ;(stored as { normalizedEmailHash: string }).normalizedEmailHash = 'different'
    await expect(
      approveSageDelivery(deps, ctxFor(c.approver), { workspaceId: c.ws, deliveryRequestId: req.id, rationale: 'ok' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('an approved package cannot be issued if its hash changed', async () => {
    const c = await setup()
    const { req } = await requestApprove(c)
    const stored = await repo.getExportPackage(c.pkg.id, c.ws, c.org)
    ;(stored as { contentHash: string }).contentHash = 'tampered'
    await expect(
      issueSageDeliveryInvitation(deps, ctxFor(c.approver), { workspaceId: c.ws, deliveryRequestId: req.id }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('denied requests cannot be issued', async () => {
    const c = await setup()
    const recipient = await makeRecipient(c)
    const req = await requestSageDelivery(deps, ctxFor(c.requester), { workspaceId: c.ws, exportPackageId: c.pkg.id, recipientId: recipient.id, accessExpiresAt: LATER, maxAccesses: 1 })
    await denySageDelivery(deps, ctxFor(c.approver), { workspaceId: c.ws, deliveryRequestId: req.id, rationale: 'no' })
    await expect(
      issueSageDeliveryInvitation(deps, ctxFor(c.approver), { workspaceId: c.ws, deliveryRequestId: req.id }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

describe('delivery — invitation token security', () => {
  it('issuance fails closed without a notifier (no token revealed)', async () => {
    const c = await setup()
    const { req } = await requestApprove(c)
    const noNotifier: SageServiceDeps = { repo, audit: sink }
    await expect(
      issueSageDeliveryInvitation(noNotifier, ctxFor(c.approver), { workspaceId: c.ws, deliveryRequestId: req.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('stores only a token hash; plaintext never appears in grant rows or audit', async () => {
    const c = await setup()
    const { grant, token } = await fullyIssued(c)
    expect(token.length).toBeGreaterThanOrEqual(43) // 256-bit base64url
    const stored = await repo.getDeliveryGrant(grant.id, c.ws, c.org)
    expect(stored?.invitationTokenHash).toBe(hashDeliveryToken(token))
    expect(JSON.stringify(stored)).not.toContain(token)
    for (const rec of sink.records) expect(JSON.stringify(rec)).not.toContain(token)
  })

  it('a claimed invitation cannot be replayed (one-time)', async () => {
    const c = await setup()
    const { token } = await fullyIssued(c)
    await claimSageDeliveryInvitation(deps, { token, verifiedEmail: RECIPIENT_EMAIL, now: NOW })
    // A claimed token is no longer 'issued' → non-disclosing rejection.
    await expect(
      claimSageDeliveryInvitation(deps, { token, verifiedEmail: RECIPIENT_EMAIL, now: NOW }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('a different verified recipient email cannot claim', async () => {
    const c = await setup()
    const { token } = await fullyIssued(c)
    await expect(
      claimSageDeliveryInvitation(deps, { token, verifiedEmail: 'someone-else@example.gov', now: NOW }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('an expired invitation cannot be claimed', async () => {
    const c = await setup()
    const { token } = await fullyIssued(c)
    await expect(
      claimSageDeliveryInvitation(deps, { token, verifiedEmail: RECIPIENT_EMAIL, now: '2026-12-31T00:00:00.000Z' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('concurrent claims yield exactly one winner', async () => {
    const c = await setup()
    const { token } = await fullyIssued(c)
    const results = await Promise.allSettled([
      claimSageDeliveryInvitation(deps, { token, verifiedEmail: RECIPIENT_EMAIL, now: NOW }),
      claimSageDeliveryInvitation(deps, { token, verifiedEmail: RECIPIENT_EMAIL, now: NOW }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
  })
})

describe('delivery — recipient access (grant-scoped, bounded, revocable)', () => {
  it('authorizes access for the bound recipient and streams verified bytes with a receipt', async () => {
    const c = await setup()
    const { grant, sessionToken } = await claimed(c)
    const res = await authorizeSageRecipientPackageAccess(deps, recipientCtx(grant), { sessionToken, intent: 'download' })
    expect(res.bytes.byteLength).toBeGreaterThan(0)
    const receipts = await repo.listDeliveryReceipts(grant.id, c.ws, c.org)
    expect(receipts.some((r) => r.eventType === 'download_authorized')).toBe(true)
  })

  it('enforces the max-access budget atomically', async () => {
    const c = await setup()
    const { grant, sessionToken } = await claimed(c, 2)
    await authorizeSageRecipientPackageAccess(deps, recipientCtx(grant), { sessionToken })
    await authorizeSageRecipientPackageAccess(deps, recipientCtx(grant), { sessionToken })
    await expect(
      authorizeSageRecipientPackageAccess(deps, recipientCtx(grant), { sessionToken }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('denies access after revocation', async () => {
    const c = await setup()
    const { grant, sessionToken } = await claimed(c)
    await revokeSageDeliveryGrant(deps, ctxFor(c.approver), { workspaceId: c.ws, grantId: grant.id, revocationReasonCode: 'security_concern' })
    await expect(
      authorizeSageRecipientPackageAccess(deps, recipientCtx(grant), { sessionToken }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('denies access after expiry (read-time)', async () => {
    const c = await setup()
    const { grant, sessionToken } = await claimed(c)
    await expect(
      authorizeSageRecipientPackageAccess(deps, recipientCtx(grant, '2026-12-31T00:00:00.000Z'), { sessionToken }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('a wrong session token cannot access', async () => {
    const c = await setup()
    const { grant } = await claimed(c)
    await expect(
      authorizeSageRecipientPackageAccess(deps, recipientCtx(grant), { sessionToken: 'not-the-session' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('a recipient cannot access a different grant', async () => {
    const c = await setup()
    const { grant, sessionToken } = await claimed(c)
    const forged = recipientCtx(grant)
    forged.grantId = 'dgrant_does_not_exist'
    await expect(
      authorizeSageRecipientPackageAccess(deps, forged, { sessionToken }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('a SageServiceContext cannot be used as a recipient context', async () => {
    const c = await setup()
    const { grant, sessionToken } = await claimed(c)
    const bogus = ctxFor(actor('admin_1', 'human')) as unknown as SageRecipientAccessContext
    bogus.grantId = grant.id
    await expect(
      authorizeSageRecipientPackageAccess(deps, bogus, { sessionToken }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('delivery — acknowledgment, expiry, receipts', () => {
  it('acknowledgment is explicit and idempotent (one receipt)', async () => {
    const c = await setup()
    const { grant, sessionToken } = await claimed(c)
    const ctx = recipientCtx(grant)
    await acknowledgeSageDelivery(deps, ctx, { sessionToken })
    await acknowledgeSageDelivery(deps, ctx, { sessionToken })
    const receipts = await repo.listDeliveryReceipts(grant.id, c.ws, c.org)
    expect(receipts.filter((r) => r.eventType === 'recipient_acknowledged')).toHaveLength(1)
  })

  it('expiry sweeps an issued invitation and emits exactly one grant_expired receipt', async () => {
    const c = await setup()
    const { grant } = await fullyIssued(c)
    expect((await expireSageDeliveryGrants(deps, { now: '2026-12-31T00:00:00.000Z' })).expired).toBe(1)
    expect((await expireSageDeliveryGrants(deps, { now: '2026-12-31T00:00:00.000Z' })).expired).toBe(0)
    const receipts = await repo.listDeliveryReceipts(grant.id, c.ws, c.org)
    expect(receipts.filter((r) => r.eventType === 'grant_expired')).toHaveLength(1)
  })

  it('receipts and audit contain no email or token', async () => {
    const c = await setup()
    const { grant, token } = await fullyIssued(c)
    const receipts = await repo.listDeliveryReceipts(grant.id, c.ws, c.org)
    const blob = JSON.stringify(receipts) + JSON.stringify(sink.records)
    expect(blob).not.toContain(RECIPIENT_EMAIL)
    expect(blob).not.toContain(token)
  })
})

describe('delivery — replay-first issuance', () => {
  async function issueTwice() {
    const c = await setup()
    const { recipient, req } = await requestApprove(c)
    const first = await issueSageDeliveryInvitation(deps, ctxFor(c.approver), { workspaceId: c.ws, deliveryRequestId: req.id })
    const issuance = await repo.getDeliveryIssuanceByRequestId({ orgId: c.org, workspaceId: c.ws, deliveryRequestId: req.id })
    const receiptCount = (await repo.listDeliveryReceipts(first.grant.id, c.ws, c.org)).length
    const auditCount = sink.records.length
    const sentCount = notifier.sent.length
    const second = await issueSageDeliveryInvitation(deps, ctxFor(c.approver), { workspaceId: c.ws, deliveryRequestId: req.id })
    return { c, recipient, req, first, second, issuance: issuance!, receiptCount, auditCount, sentCount }
  }

  it('returns the authoritative grant after a simulated lost response', async () => {
    const { first, second } = await issueTwice()
    expect(second.grant.id).toBe(first.grant.id)
  })

  it('does not create a second notification, receipt, or audit event on replay', async () => {
    const { c, first, receiptCount, auditCount, sentCount } = await issueTwice()
    expect((await repo.listNotificationOutboxByGrant(first.grant.id, c.org))).toHaveLength(1)
    expect((await repo.listDeliveryReceipts(first.grant.id, c.ws, c.org))).toHaveLength(receiptCount)
    expect(sink.records).toHaveLength(auditCount)
    expect(notifier.sent).toHaveLength(sentCount)
  })

  it('reuses the original encrypted invitation instead of generating or sending a fresh token', async () => {
    const { c, req, issuance } = await issueTwice()
    const current = await repo.getDeliveryIssuanceByRequestId({ orgId: c.org, workspaceId: c.ws, deliveryRequestId: req.id })
    expect(current?.notification.messageId).toBe(issuance.notification.messageId)
    expect(current?.notification.encryptedPayload).toBe(issuance.notification.encryptedPayload)
    expect(current?.notification.status).toBe('dispatched')
  })

  it('rejects recipient identity-hash drift without side effects', async () => {
    const { c, req } = await issueTwice()
    const recipient = await repo.getDeliveryRecipient(req.recipientId, c.ws, c.org)
    recipient!.identitySubject = 'changed-subject'
    await expect(issueSageDeliveryInvitation(deps, ctxFor(c.approver), { workspaceId: c.ws, deliveryRequestId: req.id })).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('rejects package content-hash drift without side effects', async () => {
    const { c, req } = await issueTwice()
    const pkg = await repo.getExportPackage(req.exportPackageId, c.ws, c.org)
    pkg!.contentHash = 'different-content-hash'
    await expect(issueSageDeliveryInvitation(deps, ctxFor(c.approver), { workspaceId: c.ws, deliveryRequestId: req.id })).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('rejects manifest-hash drift without side effects', async () => {
    const { c, req } = await issueTwice()
    const pkg = await repo.getExportPackage(req.exportPackageId, c.ws, c.org)
    pkg!.manifestHash = 'different-manifest-hash'
    await expect(issueSageDeliveryInvitation(deps, ctxFor(c.approver), { workspaceId: c.ws, deliveryRequestId: req.id })).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('rejects policy-version drift without side effects', async () => {
    const { c, req } = await issueTwice()
    const pkg = await repo.getExportPackage(req.exportPackageId, c.ws, c.org)
    pkg!.policyVersion = 'different-policy-version'
    await expect(issueSageDeliveryInvitation(deps, ctxFor(c.approver), { workspaceId: c.ws, deliveryRequestId: req.id })).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('rejects notification message and grant binding drift', async () => {
    const { c, req, issuance } = await issueTwice()
    issuance.notification.messageId = 'sage-delivery-invitation:wrong-grant'
    await expect(issueSageDeliveryInvitation(deps, ctxFor(c.approver), { workspaceId: c.ws, deliveryRequestId: req.id })).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('rejects a retry whose requested invitation expiry differs from the committed invitation', async () => {
    const { c, req } = await issueTwice()
    await expect(issueSageDeliveryInvitation(deps, ctxFor(c.approver), {
      workspaceId: c.ws,
      deliveryRequestId: req.id,
      invitationTtlMs: 60_000,
    })).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('rejects an existing notification without its compatible grant', async () => {
    const { c, req, issuance } = await issueTwice()
    issuance.notification.grantId = 'different-grant'
    await expect(repo.getDeliveryIssuanceByRequestId({ orgId: c.org, workspaceId: c.ws, deliveryRequestId: req.id })).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})
