// ─── @nzila/sage-core — repository port + in-memory implementation ───────────
// Port interface can be backed by SQL later (migration 0032). The in-memory
// implementation mirrors the same operations for executable, testable services.

import type {
  SageAuthorizationLevel,
  SageAuditOutboxEvent,
  SageAuditOutboxIntent,
  SageBoundaryFlag,
  SageDecisionRecord,
  SageEvidenceAuthorization,
  SageEvidenceItem,
  SageEvidenceSource,
  SageExportApproval,
  SageExportPackage,
  SageExportPackageObject,
  SageExportRequest,
  SageReviewNote,
  SageRoleAssignment,
  SageSourceQuality,
  SageWorkspace,
  SageWorkspaceMember,
} from './types'
import type {
  SageDeliveryApproval,
  SageDeliveryDecision,
  SageDeliveryGrant,
  SageDeliveryIssuance,
  SageDeliveryReceipt,
  SageDeliveryReceiptIntent,
  SageDeliveryRecipient,
  SageDeliveryRequest,
  SageDeliveryRevocationReasonCode,
  SageNotificationOutbox,
  SageNotificationOutboxIntent,
} from './delivery-types'
import { conflict } from './service-errors'

export interface SageRepository {
  createWorkspace(input: Omit<SageWorkspace, 'id'>): Promise<SageWorkspace>
  getWorkspace(workspaceId: string, orgId: string): Promise<SageWorkspace | undefined>
  listWorkspaces(orgId: string): Promise<SageWorkspace[]>

  addWorkspaceMember(input: Omit<SageWorkspaceMember, 'id'>): Promise<SageWorkspaceMember>
  getWorkspaceMember(
    workspaceId: string,
    actorId: string,
  ): Promise<SageWorkspaceMember | undefined>

  listRoleAssignments(workspaceId: string, actorId: string): Promise<SageRoleAssignment[]>
  assignRole(input: Omit<SageRoleAssignment, 'id'>): Promise<SageRoleAssignment>
  revokeRole(roleAssignmentId: string, revokedAt: string): Promise<void>

  listEvidenceAuthorizations(
    workspaceId: string,
    actorId: string,
  ): Promise<SageEvidenceAuthorization[]>
  grantEvidenceAuthorization(
    input: Omit<SageEvidenceAuthorization, 'id'>,
  ): Promise<SageEvidenceAuthorization>
  revokeEvidenceAuthorization(authorizationId: string, revokedAt: string): Promise<void>

  createEvidenceSource(input: Omit<SageEvidenceSource, 'id'>): Promise<SageEvidenceSource>
  getEvidenceSource(
    sourceId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageEvidenceSource | undefined>
  listEvidenceSources(workspaceId: string, orgId: string): Promise<SageEvidenceSource[]>
  classifyEvidenceSource(
    sourceId: string,
    update: { sourceQuality: SageSourceQuality; authorizationLevel: SageAuthorizationLevel },
  ): Promise<SageEvidenceSource>

  createEvidenceItem(input: Omit<SageEvidenceItem, 'id'>): Promise<SageEvidenceItem>
  getEvidenceItem(
    itemId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageEvidenceItem | undefined>
  listEvidenceItems(
    workspaceId: string,
    orgId: string,
    sourceId?: string,
  ): Promise<SageEvidenceItem[]>
  linkEvidenceItem(itemId: string, linkedAt: string): Promise<SageEvidenceItem>

  addBoundaryFlag(input: Omit<SageBoundaryFlag, 'id'>): Promise<SageBoundaryFlag>
  getBoundaryFlag(
    flagId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageBoundaryFlag | undefined>
  listBoundaryFlags(
    workspaceId: string,
    orgId: string,
    filters?: { targetType?: string; targetId?: string; status?: string },
  ): Promise<SageBoundaryFlag[]>
  /** Compare-and-set: 'open' → 'under_review'. Conflict if not currently 'open'. */
  reviewBoundaryFlag(
    flagId: string,
    workspaceId: string,
    orgId: string,
    updatedAt: string,
  ): Promise<SageBoundaryFlag>
  /** Compare-and-set: 'open'|'under_review' → resolution. Conflict otherwise. */
  resolveBoundaryFlag(
    flagId: string,
    workspaceId: string,
    orgId: string,
    update: {
      status: 'resolved' | 'retained'
      resolvedBy: string
      resolutionNote: string
      resolvedAt: string
      updatedAt: string
      authorizationLevel?: SageAuthorizationLevel
    },
  ): Promise<SageBoundaryFlag>

  addReviewNote(input: Omit<SageReviewNote, 'id'>): Promise<SageReviewNote>
  getReviewNote(
    reviewNoteId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageReviewNote | undefined>
  listReviewNotes(
    workspaceId: string,
    orgId: string,
    filters?: { targetType?: string; targetId?: string },
  ): Promise<SageReviewNote[]>

  createDecisionRecord(input: Omit<SageDecisionRecord, 'id'>): Promise<SageDecisionRecord>
  listDecisionRecords(workspaceId: string, orgId: string): Promise<SageDecisionRecord[]>
  getDecisionRecord(
    decisionId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageDecisionRecord | undefined>

  createExportRequest(input: Omit<SageExportRequest, 'id'>): Promise<SageExportRequest>
  getExportRequest(
    exportRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportRequest | undefined>
  listExportRequests(workspaceId: string, orgId: string): Promise<SageExportRequest[]>
  listExportApprovals(
    exportRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportApproval[]>
  /**
   * Atomically decide an export request: compare-and-set the request status
   * 'requested' → approved|denied, record the approval, AND enqueue the decision
   * audit event in the durable outbox — all in one operation. Returns undefined
   * when the request is not in 'requested' state (conflict).
   */
  decideExportRequest(input: {
    exportRequestId: string
    workspaceId: string
    orgId: string
    decision: 'approved' | 'denied'
    updatedAt: string
    approval: Omit<SageExportApproval, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<{ request: SageExportRequest; approval: SageExportApproval } | undefined>

  /**
   * Atomically commit a generated package: insert the immutable object bytes,
   * insert the package metadata (idempotent, one per request), AND enqueue the
   * package-generated audit event in the durable outbox — as ONE operation. No
   * window can leave an orphaned object, a package pointing at absent bytes, or
   * a committed package without durable audit evidence.
   */
  commitExportPackage(input: {
    package: Omit<SageExportPackage, 'id'>
    object: SageExportPackageObject
    auditEvent: SageAuditOutboxIntent
  }): Promise<{ package: SageExportPackage; created: boolean }>

  getExportPackageByRequest(
    exportRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportPackage | undefined>
  listExportPackages(workspaceId: string, orgId: string): Promise<SageExportPackage[]>
  getExportPackage(
    packageId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportPackage | undefined>
  /** Read the immutable private package bytes by storage reference. */
  getExportPackageObject(storageReference: string): Promise<SageExportPackageObject | undefined>

  // ── Durable audit outbox — AT-LEAST-ONCE delivery, leased+fenced claims ──────
  // The downstream sink does not deduplicate by event_id, so delivery is
  // at-least-once with a stable event_id preserved across retries. A live event
  // is owned by exactly one dispatcher via a lease; stale leases are reclaimable.

  /** Enqueue a durable audit event (pending) outside a domain transaction. */
  enqueueAuditOutbox(input: {
    intent: SageAuditOutboxIntent
    orgId: string
    workspaceId: string
    resourceId: string
    createdAt: string
  }): Promise<void>
  /** Read pending events without claiming (tests / observability). */
  listPendingAuditOutbox(limit: number): Promise<SageAuditOutboxEvent[]>
  /** Atomically claim up to `limit` pending/stale events for one dispatch owner. */
  claimPendingAuditOutbox(input: {
    owner: string
    leaseExpiresAt: string
    limit: number
    now: string
  }): Promise<SageAuditOutboxEvent[]>
  /** Atomically claim ONE event by id (inline after-commit dispatch). */
  claimAuditOutboxEvent(input: {
    eventId: string
    owner: string
    leaseExpiresAt: string
    now: string
  }): Promise<SageAuditOutboxEvent | undefined>
  /** Fenced: mark dispatched only if the caller still owns the lease. */
  markAuditOutboxDispatched(eventId: string, owner: string, dispatchedAt: string): Promise<boolean>
  /** Fenced: release a claim back to pending (retry) only if the caller owns it. */
  releaseAuditOutbox(eventId: string, owner: string, errorCode: string): Promise<boolean>

  // Read models for the workspace summary (counts only).
  countWorkspaceEvidenceSources(workspaceId: string): Promise<number>
  countWorkspaceEvidenceItems(workspaceId: string): Promise<number>
  countWorkspaceBoundaryFlags(workspaceId: string): Promise<number>
  countWorkspaceDecisionRecords(workspaceId: string): Promise<number>
  countWorkspaceOpenExportRequests(workspaceId: string): Promise<number>

  // ── Phase 8A: secure recipient delivery ────────────────────────────────────
  createDeliveryRecipient(input: Omit<SageDeliveryRecipient, 'id'>): Promise<SageDeliveryRecipient>
  getDeliveryRecipient(
    recipientId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageDeliveryRecipient | undefined>
  listDeliveryRecipients(workspaceId: string, orgId: string): Promise<SageDeliveryRecipient[]>

  createDeliveryRequest(input: {
    request: Omit<SageDeliveryRequest, 'id'>
    auditEvent: SageAuditOutboxIntent
    receipt?: SageDeliveryReceiptIntent
  }): Promise<SageDeliveryRequest>
  getDeliveryRequest(
    requestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageDeliveryRequest | undefined>
  listDeliveryRequests(workspaceId: string, orgId: string): Promise<SageDeliveryRequest[]>

  /** CAS approve/deny of a 'requested' delivery request + frozen approval + durable receipt/audit. */
  decideDeliveryRequest(input: {
    deliveryRequestId: string
    workspaceId: string
    orgId: string
    decision: SageDeliveryDecision
    updatedAt: string
    approval: Omit<SageDeliveryApproval, 'id'>
    auditEvent: SageAuditOutboxIntent
    receipt?: SageDeliveryReceiptIntent
  }): Promise<{ request: SageDeliveryRequest; approval: SageDeliveryApproval } | undefined>

  getDeliveryApproval(
    deliveryRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageDeliveryApproval | undefined>

  /**
   * Load the authoritative grant and durable notification together. Implementations
   * must reject a partial issuance rather than returning a grant without its
   * recoverable invitation message (or vice versa).
   */
  getDeliveryIssuanceByRequestId(input: {
    orgId: string
    workspaceId: string
    deliveryRequestId: string
  }): Promise<SageDeliveryIssuance | undefined>

  /** Issue exactly one grant for an approved request (flips request → 'issued'). */
  issueDeliveryGrant(input: {
    grant: Omit<SageDeliveryGrant, 'id'> & { id?: string }
    updatedAt: string
    auditEvent: SageAuditOutboxIntent
    receipt: SageDeliveryReceiptIntent
    notification: SageNotificationOutboxIntent
  }): Promise<{ grant: SageDeliveryGrant; created: boolean } | undefined>

  getDeliveryGrant(
    grantId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageDeliveryGrant | undefined>
  getDeliveryGrantByInvitationHash(
    invitationTokenHash: string,
  ): Promise<SageDeliveryGrant | undefined>
  /** Load a grant by id only (recipient access has no org/workspace scope). */
  getDeliveryGrantById(grantId: string): Promise<SageDeliveryGrant | undefined>
  listDeliveryGrants(workspaceId: string, orgId: string): Promise<SageDeliveryGrant[]>

  /** CAS claim of an 'issued' grant → 'active', binding the recipient identity + session. */
  claimDeliveryGrant(input: {
    grantId: string
    invitationTokenHash: string
    claimedIdentityProvider: string
    claimedIdentitySubject: string
    sessionTokenHash: string
    claimedAt: string
    now: string
    auditEvent: SageAuditOutboxIntent
    receipt: SageDeliveryReceiptIntent
  }): Promise<SageDeliveryGrant | undefined>

  /** Atomic access authorization: CAS access_count++ on an active, in-window, in-budget grant. */
  authorizeDeliveryAccess(input: {
    grantId: string
    identitySubject: string
    now: string
    auditEvent: SageAuditOutboxIntent
    receipt: SageDeliveryReceiptIntent
  }): Promise<SageDeliveryGrant | undefined>

  /** CAS revoke of an issued/active grant. */
  revokeDeliveryGrant(input: {
    grantId: string
    workspaceId: string
    orgId: string
    revokedBy: string
    revocationReasonCode: SageDeliveryRevocationReasonCode
    revokedAt: string
    auditEvent: SageAuditOutboxIntent
    receipt: SageDeliveryReceiptIntent
  }): Promise<SageDeliveryGrant | undefined>

  /** CAS-expire issued invitations / active grants past their clocks; one receipt each. */
  expireDeliveryGrants(input: {
    now: string
    limit: number
    auditAction: string
    workspaceId?: string
    orgId?: string
  }): Promise<SageDeliveryGrant[]>

  createDeliveryReceipt(input: {
    orgId: string
    workspaceId: string
    receipt: SageDeliveryReceiptIntent
  }): Promise<SageDeliveryReceipt | undefined>
  listDeliveryReceipts(
    grantId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageDeliveryReceipt[]>

  // ── Notification Outbox (Phase 8A.1) ──────────────────────────────────────
  enqueueNotificationOutbox(input: {
    intent: SageNotificationOutboxIntent
    orgId: string
    workspaceId: string
    recipientId: string
  }): Promise<SageNotificationOutbox | undefined>
  getNotificationOutboxByMessageId(messageId: string): Promise<SageNotificationOutbox | undefined>
  getNotificationOutboxById(id: string): Promise<SageNotificationOutbox | undefined>
  claimPendingNotificationForDispatch(input: {
    maxAttempts?: number
    dispatchOwner: string
    leaseMs?: number
  }): Promise<SageNotificationOutbox | undefined>
  markNotificationDispatched(input: {
    id: string
    dispatchOwner: string
    providerMessageId?: string
    providerRequestId?: string
  }): Promise<{ success: boolean }>
  markNotificationDeadLetter(input: {
    id: string
    dispatchOwner: string
    errorCode?: string
    errorMessage?: string
  }): Promise<{ success: boolean }>
  releaseNotificationOutboxToPending(input: {
    id: string
    dispatchOwner: string
    nextAttemptAt: string
    errorCode?: string
  }): Promise<{ success: boolean }>
  listPendingNotificationOutbox(
    workspaceId: string,
    orgId: string,
  ): Promise<SageNotificationOutbox[]>
  listNotificationOutboxByGrant(
    grantId: string,
    orgId: string,
  ): Promise<SageNotificationOutbox[]>
}

let counter = 0
function nextId(prefix: string): string {
  counter += 1
  return `${prefix}_${counter}`
}

/** In-memory repository for tests/development (mirrors the audit package's InMemory* pattern). */
export class InMemorySageRepository implements SageRepository {
  private workspaces = new Map<string, SageWorkspace>()
  private members: SageWorkspaceMember[] = []
  private roles: SageRoleAssignment[] = []
  private evidenceAuthorizations: SageEvidenceAuthorization[] = []
  private sources = new Map<string, SageEvidenceSource>()
  private items = new Map<string, SageEvidenceItem>()
  private boundaryFlags: SageBoundaryFlag[] = []
  private reviewNotes: SageReviewNote[] = []
  private decisionRecords: SageDecisionRecord[] = []
  private exportRequests = new Map<string, SageExportRequest>()
  private exportApprovals: SageExportApproval[] = []
  private exportPackages = new Map<string, SageExportPackage>()
  private exportPackageObjects = new Map<string, SageExportPackageObject>()
  private auditOutbox: SageAuditOutboxEvent[] = []
  // Phase 8A — secure delivery
  private deliveryRecipients = new Map<string, SageDeliveryRecipient>()
  private deliveryRequests = new Map<string, SageDeliveryRequest>()
  private deliveryApprovals: SageDeliveryApproval[] = []
  private deliveryGrants = new Map<string, SageDeliveryGrant>()
  private deliveryReceipts: SageDeliveryReceipt[] = []
  // Phase 8A.1 — notification outbox
  private notificationOutbox: SageNotificationOutbox[] = []

  async createWorkspace(input: Omit<SageWorkspace, 'id'>): Promise<SageWorkspace> {
    const ws: SageWorkspace = { ...input, id: nextId('ws') }
    this.workspaces.set(ws.id, ws)
    return ws
  }

  async getWorkspace(workspaceId: string, orgId: string): Promise<SageWorkspace | undefined> {
    // Tenant-scoped: a workspace is only visible within its own org.
    const ws = this.workspaces.get(workspaceId)
    return ws && ws.orgId === orgId ? ws : undefined
  }

  async listWorkspaces(orgId: string): Promise<SageWorkspace[]> {
    // Organization-scoped; most-recently-updated first (tie-break on created).
    return [...this.workspaces.values()]
      .filter((ws) => ws.orgId === orgId)
      .sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt),
      )
  }

  async addWorkspaceMember(
    input: Omit<SageWorkspaceMember, 'id'>,
  ): Promise<SageWorkspaceMember> {
    const existing = await this.getWorkspaceMember(input.workspaceId, input.actorId)
    if (existing) return existing
    const member: SageWorkspaceMember = { ...input, id: nextId('mem') }
    this.members.push(member)
    return member
  }

  async getWorkspaceMember(
    workspaceId: string,
    actorId: string,
  ): Promise<SageWorkspaceMember | undefined> {
    return this.members.find((m) => m.workspaceId === workspaceId && m.actorId === actorId)
  }

  async listRoleAssignments(
    workspaceId: string,
    actorId: string,
  ): Promise<SageRoleAssignment[]> {
    return this.roles.filter((r) => r.workspaceId === workspaceId && r.actorId === actorId)
  }

  async assignRole(input: Omit<SageRoleAssignment, 'id'>): Promise<SageRoleAssignment> {
    const role: SageRoleAssignment = { ...input, id: nextId('role') }
    this.roles.push(role)
    return role
  }

  async revokeRole(roleAssignmentId: string, revokedAt: string): Promise<void> {
    const role = this.roles.find((r) => r.id === roleAssignmentId)
    if (role) role.revokedAt = revokedAt
  }

  async listEvidenceAuthorizations(
    workspaceId: string,
    actorId: string,
  ): Promise<SageEvidenceAuthorization[]> {
    return this.evidenceAuthorizations.filter(
      (a) => a.workspaceId === workspaceId && a.actorId === actorId,
    )
  }

  async grantEvidenceAuthorization(
    input: Omit<SageEvidenceAuthorization, 'id'>,
  ): Promise<SageEvidenceAuthorization> {
    const grant: SageEvidenceAuthorization = { ...input, id: nextId('evauth') }
    this.evidenceAuthorizations.push(grant)
    return grant
  }

  async revokeEvidenceAuthorization(authorizationId: string, revokedAt: string): Promise<void> {
    const grant = this.evidenceAuthorizations.find((a) => a.id === authorizationId)
    if (grant) grant.revokedAt = revokedAt
  }

  async createEvidenceSource(
    input: Omit<SageEvidenceSource, 'id'>,
  ): Promise<SageEvidenceSource> {
    const src: SageEvidenceSource = { ...input, id: nextId('src') }
    this.sources.set(src.id, src)
    return src
  }

  async getEvidenceSource(
    sourceId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageEvidenceSource | undefined> {
    const src = this.sources.get(sourceId)
    return src && src.workspaceId === workspaceId && src.orgId === orgId ? src : undefined
  }

  async listEvidenceSources(
    workspaceId: string,
    orgId: string,
  ): Promise<SageEvidenceSource[]> {
    return [...this.sources.values()]
      .filter((s) => s.workspaceId === workspaceId && s.orgId === orgId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async classifyEvidenceSource(
    sourceId: string,
    update: { sourceQuality: SageSourceQuality; authorizationLevel: SageAuthorizationLevel },
  ): Promise<SageEvidenceSource> {
    const src = this.sources.get(sourceId)
    if (!src) throw new Error('source not found')
    // Compare-and-set: only a not-yet-classified source may be classified. This
    // mirrors the SQL guard (`source_quality is null`) so concurrent
    // classifications cannot both succeed.
    if (src.classified) {
      conflict('evidence source is already classified or was concurrently modified')
    }
    src.sourceQuality = update.sourceQuality
    src.authorizationLevel = update.authorizationLevel
    src.classified = true
    return src
  }

  async createEvidenceItem(input: Omit<SageEvidenceItem, 'id'>): Promise<SageEvidenceItem> {
    const item: SageEvidenceItem = { ...input, id: nextId('item') }
    this.items.set(item.id, item)
    return item
  }

  async getEvidenceItem(
    itemId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageEvidenceItem | undefined> {
    const item = this.items.get(itemId)
    return item && item.workspaceId === workspaceId && item.orgId === orgId ? item : undefined
  }

  async listEvidenceItems(
    workspaceId: string,
    orgId: string,
    sourceId?: string,
  ): Promise<SageEvidenceItem[]> {
    return [...this.items.values()]
      .filter(
        (i) =>
          i.workspaceId === workspaceId &&
          i.orgId === orgId &&
          (sourceId === undefined || i.sourceId === sourceId),
      )
      .sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt),
      )
  }

  async linkEvidenceItem(itemId: string, linkedAt: string): Promise<SageEvidenceItem> {
    const item = this.items.get(itemId)
    if (!item) throw new Error('item not found')
    // Compare-and-set: only a 'registered' item may transition to 'linked',
    // mirroring the SQL guard so concurrent links cannot both succeed.
    if (item.lifecycleState !== 'registered') {
      conflict('evidence item is not in a linkable state or was concurrently modified')
    }
    item.lifecycleState = 'linked'
    item.updatedAt = linkedAt
    return item
  }

  async addBoundaryFlag(input: Omit<SageBoundaryFlag, 'id'>): Promise<SageBoundaryFlag> {
    const flag: SageBoundaryFlag = { ...input, id: nextId('flag') }
    this.boundaryFlags.push(flag)
    return flag
  }

  async getBoundaryFlag(
    flagId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageBoundaryFlag | undefined> {
    return this.boundaryFlags.find(
      (f) => f.id === flagId && f.workspaceId === workspaceId && f.orgId === orgId,
    )
  }

  async listBoundaryFlags(
    workspaceId: string,
    orgId: string,
    filters?: { targetType?: string; targetId?: string; status?: string },
  ): Promise<SageBoundaryFlag[]> {
    return this.boundaryFlags
      .filter(
        (f) =>
          f.workspaceId === workspaceId &&
          f.orgId === orgId &&
          (filters?.targetType === undefined || f.targetType === filters.targetType) &&
          (filters?.targetId === undefined || f.targetId === filters.targetId) &&
          (filters?.status === undefined || f.status === filters.status),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
  }

  async reviewBoundaryFlag(
    flagId: string,
    workspaceId: string,
    orgId: string,
    updatedAt: string,
  ): Promise<SageBoundaryFlag> {
    // Compare-and-set: only an 'open' flag may transition to 'under_review'.
    const flag = this.boundaryFlags.find(
      (f) =>
        f.id === flagId &&
        f.workspaceId === workspaceId &&
        f.orgId === orgId &&
        f.status === 'open',
    )
    if (!flag) conflict('boundary flag is not open or was concurrently modified')
    flag.status = 'under_review'
    flag.updatedAt = updatedAt
    return flag
  }

  async resolveBoundaryFlag(
    flagId: string,
    workspaceId: string,
    orgId: string,
    update: {
      status: 'resolved' | 'retained'
      resolvedBy: string
      resolutionNote: string
      resolvedAt: string
      updatedAt: string
      authorizationLevel?: SageAuthorizationLevel
    },
  ): Promise<SageBoundaryFlag> {
    // Compare-and-set: only an open/under_review flag may be resolved/retained.
    const flag = this.boundaryFlags.find(
      (f) =>
        f.id === flagId &&
        f.workspaceId === workspaceId &&
        f.orgId === orgId &&
        (f.status === 'open' || f.status === 'under_review'),
    )
    if (!flag) conflict('boundary flag is already resolved or was concurrently modified')
    flag.status = update.status
    flag.resolvedBy = update.resolvedBy
    flag.resolutionNote = update.resolutionNote
    flag.resolvedAt = update.resolvedAt
    flag.updatedAt = update.updatedAt
    // Authorization may only be raised by the resolver; the service floors it.
    if (update.authorizationLevel) flag.authorizationLevel = update.authorizationLevel
    return flag
  }

  async addReviewNote(input: Omit<SageReviewNote, 'id'>): Promise<SageReviewNote> {
    const note: SageReviewNote = { ...input, id: nextId('note') }
    this.reviewNotes.push(note)
    return note
  }

  async getReviewNote(
    reviewNoteId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageReviewNote | undefined> {
    return this.reviewNotes.find(
      (n) => n.id === reviewNoteId && n.workspaceId === workspaceId && n.orgId === orgId,
    )
  }

  async listReviewNotes(
    workspaceId: string,
    orgId: string,
    filters?: { targetType?: string; targetId?: string },
  ): Promise<SageReviewNote[]> {
    return this.reviewNotes
      .filter(
        (n) =>
          n.workspaceId === workspaceId &&
          n.orgId === orgId &&
          (filters?.targetType === undefined || n.targetType === filters.targetType) &&
          (filters?.targetId === undefined || n.targetId === filters.targetId),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
  }

  async createDecisionRecord(
    input: Omit<SageDecisionRecord, 'id'>,
  ): Promise<SageDecisionRecord> {
    const record: SageDecisionRecord = { ...input, id: nextId('dec') }
    this.decisionRecords.push(record)
    return record
  }

  async listDecisionRecords(
    workspaceId: string,
    orgId: string,
  ): Promise<SageDecisionRecord[]> {
    return this.decisionRecords
      .filter((d) => d.workspaceId === workspaceId && d.orgId === orgId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
  }

  async getDecisionRecord(
    decisionId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageDecisionRecord | undefined> {
    return this.decisionRecords.find(
      (d) => d.id === decisionId && d.workspaceId === workspaceId && d.orgId === orgId,
    )
  }

  async createExportRequest(
    input: Omit<SageExportRequest, 'id'>,
  ): Promise<SageExportRequest> {
    const req: SageExportRequest = { ...input, id: nextId('exp') }
    this.exportRequests.set(req.id, req)
    return req
  }

  async getExportRequest(
    exportRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportRequest | undefined> {
    const req = this.exportRequests.get(exportRequestId)
    if (!req || req.workspaceId !== workspaceId || req.orgId !== orgId) return undefined
    return req
  }

  async listExportRequests(workspaceId: string, orgId: string): Promise<SageExportRequest[]> {
    return [...this.exportRequests.values()]
      .filter((r) => r.workspaceId === workspaceId && r.orgId === orgId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
  }

  async listExportApprovals(
    exportRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportApproval[]> {
    const req = this.exportRequests.get(exportRequestId)
    if (!req || req.workspaceId !== workspaceId || req.orgId !== orgId) return []
    return this.exportApprovals
      .filter((a) => a.exportRequestId === exportRequestId && a.orgId === orgId)
      .sort((a, b) => b.decisionAt.localeCompare(a.decisionAt) || b.id.localeCompare(a.id))
  }

  async decideExportRequest(input: {
    exportRequestId: string
    workspaceId: string
    orgId: string
    decision: 'approved' | 'denied'
    updatedAt: string
    approval: Omit<SageExportApproval, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<{ request: SageExportRequest; approval: SageExportApproval } | undefined> {
    const req = this.exportRequests.get(input.exportRequestId)
    // Compare-and-set: only a 'requested' request in this tenant may be decided.
    if (
      !req ||
      req.workspaceId !== input.workspaceId ||
      req.orgId !== input.orgId ||
      req.status !== 'requested'
    ) {
      return undefined
    }
    // Atomic (single-threaded JS): status flip + approval insert + outbox enqueue.
    req.status = input.decision
    req.updatedAt = input.updatedAt
    const approval: SageExportApproval = { ...input.approval, id: nextId('appr') }
    this.exportApprovals.push(approval)
    this.enqueueAuditOutboxInternal(input.auditEvent, {
      orgId: input.orgId,
      workspaceId: input.workspaceId,
      resourceId: approval.id,
      createdAt: input.updatedAt,
    })
    return { request: req, approval }
  }

  async commitExportPackage(input: {
    package: Omit<SageExportPackage, 'id'>
    object: SageExportPackageObject
    auditEvent: SageAuditOutboxIntent
  }): Promise<{ package: SageExportPackage; created: boolean }> {
    // Idempotent: one finalized package per export request.
    const existing = [...this.exportPackages.values()].find(
      (p) => p.exportRequestId === input.package.exportRequestId,
    )
    if (existing) return { package: existing, created: false }

    // Content-addressed, insert-only object: same reference must carry the same
    // content hash; a differing hash at the same reference is a CONFLICT.
    const priorObject = this.exportPackageObjects.get(input.object.storageReference)
    if (priorObject && priorObject.contentHash !== input.object.contentHash) {
      conflict('package object storage reference already holds different content')
    }

    // Atomic (single-threaded JS): object + package + outbox commit together.
    if (!priorObject) {
      this.exportPackageObjects.set(input.object.storageReference, { ...input.object })
    }
    const pkg: SageExportPackage = { ...input.package, id: nextId('pkg') }
    this.exportPackages.set(pkg.id, pkg)
    this.enqueueAuditOutboxInternal(input.auditEvent, {
      orgId: pkg.orgId,
      workspaceId: pkg.workspaceId,
      resourceId: pkg.id,
      createdAt: pkg.createdAt,
    })
    return { package: pkg, created: true }
  }

  private enqueueAuditOutboxInternal(
    intent: SageAuditOutboxIntent,
    ctx: { orgId: string; workspaceId: string; resourceId: string; createdAt: string },
  ): void {
    if (this.auditOutbox.some((e) => e.eventId === intent.eventId)) return // unique(event_id)
    this.auditOutbox.push({
      id: nextId('outbox'),
      eventId: intent.eventId,
      orgId: ctx.orgId,
      workspaceId: ctx.workspaceId,
      actorId: intent.actorId,
      action: intent.action,
      resourceType: intent.resourceType,
      resourceId: ctx.resourceId,
      safePayloadJson: JSON.stringify(intent.safePayload),
      status: 'pending',
      attemptCount: 0,
      createdAt: ctx.createdAt,
      dispatchedAt: null,
      lastErrorCode: null,
      dispatchOwner: null,
      leaseExpiresAt: null,
    })
  }

  async enqueueAuditOutbox(input: {
    intent: SageAuditOutboxIntent
    orgId: string
    workspaceId: string
    resourceId: string
    createdAt: string
  }): Promise<void> {
    this.enqueueAuditOutboxInternal(input.intent, {
      orgId: input.orgId,
      workspaceId: input.workspaceId,
      resourceId: input.resourceId,
      createdAt: input.createdAt,
    })
  }

  private isClaimable(e: SageAuditOutboxEvent, now: string): boolean {
    if (e.status === 'pending') return true
    if (e.status === 'dispatching' && e.leaseExpiresAt && e.leaseExpiresAt < now) return true
    return false
  }

  async claimPendingAuditOutbox(input: {
    owner: string
    leaseExpiresAt: string
    limit: number
    now: string
  }): Promise<SageAuditOutboxEvent[]> {
    const claimed = this.auditOutbox
      .filter((e) => this.isClaimable(e, input.now))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .slice(0, input.limit)
    for (const e of claimed) {
      e.status = 'dispatching'
      e.dispatchOwner = input.owner
      e.leaseExpiresAt = input.leaseExpiresAt
      e.attemptCount += 1
    }
    return claimed.map((e) => ({ ...e }))
  }

  async claimAuditOutboxEvent(input: {
    eventId: string
    owner: string
    leaseExpiresAt: string
    now: string
  }): Promise<SageAuditOutboxEvent | undefined> {
    const e = this.auditOutbox.find((x) => x.eventId === input.eventId)
    if (!e || !this.isClaimable(e, input.now)) return undefined
    e.status = 'dispatching'
    e.dispatchOwner = input.owner
    e.leaseExpiresAt = input.leaseExpiresAt
    e.attemptCount += 1
    return { ...e }
  }

  async markAuditOutboxDispatched(
    eventId: string,
    owner: string,
    dispatchedAt: string,
  ): Promise<boolean> {
    const e = this.auditOutbox.find((x) => x.eventId === eventId)
    // Fenced: only the current lease owner of a 'dispatching' claim may finalize.
    if (!e || e.status !== 'dispatching' || e.dispatchOwner !== owner) return false
    e.status = 'dispatched'
    e.dispatchedAt = dispatchedAt
    e.lastErrorCode = null
    e.dispatchOwner = null
    e.leaseExpiresAt = null
    return true
  }

  async releaseAuditOutbox(eventId: string, owner: string, errorCode: string): Promise<boolean> {
    const e = this.auditOutbox.find((x) => x.eventId === eventId)
    if (!e || e.status !== 'dispatching' || e.dispatchOwner !== owner) return false
    e.status = 'pending'
    e.dispatchOwner = null
    e.leaseExpiresAt = null
    e.lastErrorCode = errorCode
    return true
  }

  async getExportPackageByRequest(
    exportRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportPackage | undefined> {
    return [...this.exportPackages.values()].find(
      (p) =>
        p.exportRequestId === exportRequestId &&
        p.workspaceId === workspaceId &&
        p.orgId === orgId,
    )
  }

  async listExportPackages(workspaceId: string, orgId: string): Promise<SageExportPackage[]> {
    return [...this.exportPackages.values()]
      .filter((p) => p.workspaceId === workspaceId && p.orgId === orgId)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt) || b.id.localeCompare(a.id))
  }

  async getExportPackage(
    packageId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportPackage | undefined> {
    const pkg = this.exportPackages.get(packageId)
    if (!pkg || pkg.workspaceId !== workspaceId || pkg.orgId !== orgId) return undefined
    return pkg
  }

  async getExportPackageObject(
    storageReference: string,
  ): Promise<SageExportPackageObject | undefined> {
    const obj = this.exportPackageObjects.get(storageReference)
    return obj ? { ...obj, bytes: obj.bytes } : undefined
  }

  async listPendingAuditOutbox(limit: number): Promise<SageAuditOutboxEvent[]> {
    return this.auditOutbox
      .filter((e) => e.status === 'pending')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .slice(0, limit)
      .map((e) => ({ ...e }))
  }

  async countWorkspaceEvidenceSources(workspaceId: string): Promise<number> {
    return [...this.sources.values()].filter((s) => s.workspaceId === workspaceId).length
  }

  async countWorkspaceEvidenceItems(workspaceId: string): Promise<number> {
    return [...this.items.values()].filter((i) => i.workspaceId === workspaceId).length
  }

  async countWorkspaceBoundaryFlags(workspaceId: string): Promise<number> {
    return this.boundaryFlags.filter((f) => f.workspaceId === workspaceId).length
  }

  async countWorkspaceDecisionRecords(workspaceId: string): Promise<number> {
    return this.decisionRecords.filter((d) => d.workspaceId === workspaceId).length
  }

  async countWorkspaceOpenExportRequests(workspaceId: string): Promise<number> {
    return [...this.exportRequests.values()].filter(
      (r) => r.workspaceId === workspaceId && r.status === 'requested',
    ).length
  }

  // ── Phase 8A: secure recipient delivery ────────────────────────────────────

  private appendDeliveryReceipt(
    orgId: string,
    workspaceId: string,
    intent: SageDeliveryReceiptIntent,
  ): void {
    if (this.deliveryReceipts.some((r) => r.eventId === intent.eventId)) return // unique(event_id)
    this.deliveryReceipts.push({
      id: nextId('drcpt'),
      eventId: intent.eventId,
      orgId,
      workspaceId,
      deliveryRequestId: intent.deliveryRequestId ?? null,
      grantId: intent.grantId ?? null,
      packageId: intent.packageId ?? null,
      recipientId: intent.recipientId ?? null,
      eventType: intent.eventType,
      safeReasonCode: intent.safeReasonCode ?? null,
      occurredAt: intent.occurredAt,
      createdAt: intent.occurredAt,
    })
  }

  async createDeliveryRecipient(
    input: Omit<SageDeliveryRecipient, 'id'>,
  ): Promise<SageDeliveryRecipient> {
    // One verified identity per (workspace, provider, subject).
    const existing = [...this.deliveryRecipients.values()].find(
      (r) =>
        r.workspaceId === input.workspaceId &&
        r.identityProvider === input.identityProvider &&
        r.identitySubject === input.identitySubject,
    )
    if (existing) conflict('a recipient with this verified identity already exists')
    const recipient: SageDeliveryRecipient = { ...input, id: nextId('drecip') }
    this.deliveryRecipients.set(recipient.id, recipient)
    return recipient
  }

  async getDeliveryRecipient(
    recipientId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageDeliveryRecipient | undefined> {
    const r = this.deliveryRecipients.get(recipientId)
    if (!r || r.workspaceId !== workspaceId || r.orgId !== orgId) return undefined
    return r
  }

  async listDeliveryRecipients(
    workspaceId: string,
    orgId: string,
  ): Promise<SageDeliveryRecipient[]> {
    return [...this.deliveryRecipients.values()]
      .filter((r) => r.workspaceId === workspaceId && r.orgId === orgId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  }

  async createDeliveryRequest(input: {
    request: Omit<SageDeliveryRequest, 'id'>
    auditEvent: SageAuditOutboxIntent
    receipt?: SageDeliveryReceiptIntent
  }): Promise<SageDeliveryRequest> {
    const req: SageDeliveryRequest = { ...input.request, id: nextId('dreq') }
    this.deliveryRequests.set(req.id, req)
    this.enqueueAuditOutboxInternal(input.auditEvent, {
      orgId: req.orgId,
      workspaceId: req.workspaceId,
      resourceId: req.id,
      createdAt: req.requestedAt,
    })
    if (input.receipt) this.appendDeliveryReceipt(req.orgId, req.workspaceId, input.receipt)
    return req
  }

  async getDeliveryRequest(
    requestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageDeliveryRequest | undefined> {
    const r = this.deliveryRequests.get(requestId)
    if (!r || r.workspaceId !== workspaceId || r.orgId !== orgId) return undefined
    return r
  }

  async listDeliveryRequests(
    workspaceId: string,
    orgId: string,
  ): Promise<SageDeliveryRequest[]> {
    return [...this.deliveryRequests.values()]
      .filter((r) => r.workspaceId === workspaceId && r.orgId === orgId)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt) || b.id.localeCompare(a.id))
  }

  async decideDeliveryRequest(input: {
    deliveryRequestId: string
    workspaceId: string
    orgId: string
    decision: SageDeliveryDecision
    updatedAt: string
    approval: Omit<SageDeliveryApproval, 'id'>
    auditEvent: SageAuditOutboxIntent
    receipt: SageDeliveryReceiptIntent
  }): Promise<{ request: SageDeliveryRequest; approval: SageDeliveryApproval } | undefined> {
    const req = this.deliveryRequests.get(input.deliveryRequestId)
    // CAS: only a still-'requested' row in the same tenant may be decided.
    if (
      !req ||
      req.workspaceId !== input.workspaceId ||
      req.orgId !== input.orgId ||
      req.status !== 'requested'
    ) {
      return undefined
    }
    req.status = input.decision
    req.updatedAt = input.updatedAt
    const approval: SageDeliveryApproval = { ...input.approval, id: nextId('dappr') }
    this.deliveryApprovals.push(approval)
    this.enqueueAuditOutboxInternal(input.auditEvent, {
      orgId: input.orgId,
      workspaceId: input.workspaceId,
      resourceId: approval.id,
      createdAt: input.updatedAt,
    })
    if (input.receipt) this.appendDeliveryReceipt(input.orgId, input.workspaceId, input.receipt)
    return { request: req, approval }
  }

  async getDeliveryApproval(
    deliveryRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageDeliveryApproval | undefined> {
    return this.deliveryApprovals.find(
      (a) =>
        a.deliveryRequestId === deliveryRequestId &&
        a.workspaceId === workspaceId &&
        a.orgId === orgId,
    )
  }

  async getDeliveryIssuanceByRequestId(input: {
    orgId: string
    workspaceId: string
    deliveryRequestId: string
  }): Promise<SageDeliveryIssuance | undefined> {
    const grant = [...this.deliveryGrants.values()].find(
      (candidate) =>
        candidate.deliveryRequestId === input.deliveryRequestId &&
        candidate.workspaceId === input.workspaceId &&
        candidate.orgId === input.orgId,
    )
    const notification = this.notificationOutbox.find(
      (candidate) =>
        candidate.deliveryRequestId === input.deliveryRequestId &&
        candidate.workspaceId === input.workspaceId &&
        candidate.orgId === input.orgId,
    )
    if (!grant && !notification) return undefined
    if (!grant || !notification || notification.grantId !== grant.id) {
      conflict('delivery issuance integrity failure: grant and notification must be committed together')
    }
    return { grant, notification }
  }

  async issueDeliveryGrant(input: {
    grant: Omit<SageDeliveryGrant, 'id'> & { id?: string }
    updatedAt: string
    auditEvent: SageAuditOutboxIntent
    receipt: SageDeliveryReceiptIntent
    notification: SageNotificationOutboxIntent
  }): Promise<{ grant: SageDeliveryGrant; created: boolean } | undefined> {
    if (input.grant.id && input.notification.grantId !== input.grant.id) {
      conflict('delivery issuance integrity failure: notification grant binding does not match grant id')
    }
    // Idempotent: exactly one grant per request.
    const existing = await this.getDeliveryIssuanceByRequestId({
      orgId: input.grant.orgId,
      workspaceId: input.grant.workspaceId,
      deliveryRequestId: input.grant.deliveryRequestId,
    })
    if (existing) return { grant: existing.grant, created: false }
    const req = this.deliveryRequests.get(input.grant.deliveryRequestId)
    // CAS: issue only from an approved request in the same tenant.
    if (
      !req ||
      req.workspaceId !== input.grant.workspaceId ||
      req.orgId !== input.grant.orgId ||
      req.status !== 'approved'
    ) {
      return undefined
    }
    req.status = 'issued'
    req.updatedAt = input.updatedAt
    const grant: SageDeliveryGrant = { ...input.grant, id: input.grant.id ?? nextId('dgrant') }
    this.deliveryGrants.set(grant.id, grant)
    this.enqueueAuditOutboxInternal(input.auditEvent, {
      orgId: grant.orgId,
      workspaceId: grant.workspaceId,
      resourceId: grant.id,
      createdAt: grant.issuedAt,
    })
    this.appendDeliveryReceipt(grant.orgId, grant.workspaceId, input.receipt)
    // Enqueue notification message in the same logical transaction
    // The grant is now created, so fill in the grantId
    const notification = await this.enqueueNotificationOutbox({
      intent: { ...input.notification, grantId: grant.id },
      orgId: grant.orgId,
      workspaceId: grant.workspaceId,
      recipientId: grant.recipientId,
    })
    if (!notification || notification.grantId !== grant.id) {
      conflict('delivery issuance integrity failure: notification was not committed with grant')
    }
    return { grant, created: true }
  }

  async getDeliveryGrant(
    grantId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageDeliveryGrant | undefined> {
    const g = this.deliveryGrants.get(grantId)
    if (!g || g.workspaceId !== workspaceId || g.orgId !== orgId) return undefined
    return g
  }

  async getDeliveryGrantByInvitationHash(
    invitationTokenHash: string,
  ): Promise<SageDeliveryGrant | undefined> {
    return [...this.deliveryGrants.values()].find(
      (g) => g.invitationTokenHash === invitationTokenHash,
    )
  }

  async getDeliveryGrantById(grantId: string): Promise<SageDeliveryGrant | undefined> {
    return this.deliveryGrants.get(grantId)
  }

  async listDeliveryGrants(workspaceId: string, orgId: string): Promise<SageDeliveryGrant[]> {
    return [...this.deliveryGrants.values()]
      .filter((g) => g.workspaceId === workspaceId && g.orgId === orgId)
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.id.localeCompare(a.id))
  }

  async claimDeliveryGrant(input: {
    grantId: string
    invitationTokenHash: string
    claimedIdentityProvider: string
    claimedIdentitySubject: string
    sessionTokenHash: string
    claimedAt: string
    now: string
    auditEvent: SageAuditOutboxIntent
    receipt: SageDeliveryReceiptIntent
  }): Promise<SageDeliveryGrant | undefined> {
    const g = this.deliveryGrants.get(input.grantId)
    // CAS: issued, unexpired invitation, matching invitation hash.
    if (
      !g ||
      g.status !== 'issued' ||
      g.invitationTokenHash !== input.invitationTokenHash ||
      g.invitationExpiresAt <= input.now
    ) {
      return undefined
    }
    g.status = 'active'
    g.claimedIdentityProvider = input.claimedIdentityProvider
    g.claimedIdentitySubject = input.claimedIdentitySubject
    g.sessionTokenHash = input.sessionTokenHash
    g.claimedAt = input.claimedAt
    g.updatedAt = input.claimedAt
    this.enqueueAuditOutboxInternal(input.auditEvent, {
      orgId: g.orgId,
      workspaceId: g.workspaceId,
      resourceId: g.id,
      createdAt: input.claimedAt,
    })
    this.appendDeliveryReceipt(g.orgId, g.workspaceId, input.receipt)
    return { ...g }
  }

  async authorizeDeliveryAccess(input: {
    grantId: string
    identitySubject: string
    now: string
    auditEvent: SageAuditOutboxIntent
    receipt: SageDeliveryReceiptIntent
  }): Promise<SageDeliveryGrant | undefined> {
    const g = this.deliveryGrants.get(input.grantId)
    // CAS: active, in-window, in-budget, identity-bound. Atomic count increment.
    if (
      !g ||
      g.status !== 'active' ||
      g.accessExpiresAt <= input.now ||
      g.accessCount >= g.maxAccesses ||
      g.claimedIdentitySubject !== input.identitySubject
    ) {
      return undefined
    }
    g.accessCount += 1
    g.updatedAt = input.now
    this.enqueueAuditOutboxInternal(input.auditEvent, {
      orgId: g.orgId,
      workspaceId: g.workspaceId,
      resourceId: g.id,
      createdAt: input.now,
    })
    this.appendDeliveryReceipt(g.orgId, g.workspaceId, input.receipt)
    return { ...g }
  }

  async revokeDeliveryGrant(input: {
    grantId: string
    workspaceId: string
    orgId: string
    revokedBy: string
    revocationReasonCode: SageDeliveryRevocationReasonCode
    revokedAt: string
    auditEvent: SageAuditOutboxIntent
    receipt: SageDeliveryReceiptIntent
  }): Promise<SageDeliveryGrant | undefined> {
    const g = this.deliveryGrants.get(input.grantId)
    // CAS: only an issued/active grant in the same tenant may be revoked.
    if (
      !g ||
      g.workspaceId !== input.workspaceId ||
      g.orgId !== input.orgId ||
      (g.status !== 'issued' && g.status !== 'active')
    ) {
      return undefined
    }
    g.status = 'revoked'
    g.revokedBy = input.revokedBy
    g.revokedAt = input.revokedAt
    g.revocationReasonCode = input.revocationReasonCode
    g.updatedAt = input.revokedAt
    this.enqueueAuditOutboxInternal(input.auditEvent, {
      orgId: g.orgId,
      workspaceId: g.workspaceId,
      resourceId: g.id,
      createdAt: input.revokedAt,
    })
    this.appendDeliveryReceipt(g.orgId, g.workspaceId, input.receipt)
    return { ...g }
  }

  async expireDeliveryGrants(input: {
    now: string
    limit: number
    auditAction: string
    workspaceId?: string
    orgId?: string
  }): Promise<SageDeliveryGrant[]> {
    const expired: SageDeliveryGrant[] = []
    const candidates = [...this.deliveryGrants.values()]
      .filter((g) => !input.workspaceId || g.workspaceId === input.workspaceId)
      .filter((g) => !input.orgId || g.orgId === input.orgId)
      .filter(
        (g) =>
          (g.status === 'issued' && g.invitationExpiresAt <= input.now) ||
          (g.status === 'active' && g.accessExpiresAt <= input.now),
      )
      .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt) || a.id.localeCompare(b.id))
      .slice(0, input.limit)
    for (const g of candidates) {
      g.status = 'expired'
      g.updatedAt = input.now
      const eventId = `${g.id}:grant_expired`
      this.enqueueAuditOutboxInternal(
        {
          eventId,
          actorId: 'system',
          action: input.auditAction,
          resourceType: 'sage_delivery_grant',
          safePayload: { grantId: g.id, deliveryRequestId: g.deliveryRequestId },
        },
        { orgId: g.orgId, workspaceId: g.workspaceId, resourceId: g.id, createdAt: input.now },
      )
      this.appendDeliveryReceipt(g.orgId, g.workspaceId, {
        eventId,
        deliveryRequestId: g.deliveryRequestId,
        grantId: g.id,
        packageId: g.exportPackageId,
        recipientId: g.recipientId,
        eventType: 'grant_expired',
        safeReasonCode: 'expired',
        occurredAt: input.now,
      })
      expired.push({ ...g })
    }
    return expired
  }

  async createDeliveryReceipt(input: {
    orgId: string
    workspaceId: string
    receipt: SageDeliveryReceiptIntent
  }): Promise<SageDeliveryReceipt | undefined> {
    const before = this.deliveryReceipts.length
    this.appendDeliveryReceipt(input.orgId, input.workspaceId, input.receipt)
    if (this.deliveryReceipts.length === before) return undefined // duplicate event_id
    return this.deliveryReceipts[this.deliveryReceipts.length - 1]
  }

  async listDeliveryReceipts(
    grantId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageDeliveryReceipt[]> {
    return this.deliveryReceipts
      .filter((r) => r.grantId === grantId && r.workspaceId === workspaceId && r.orgId === orgId)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id))
  }

  // ── Notification Outbox (Phase 8A.1, in-memory) ──────────────────────────
  async enqueueNotificationOutbox(input: {
    intent: SageNotificationOutboxIntent
    orgId: string
    workspaceId: string
    recipientId: string
  }): Promise<SageNotificationOutbox | undefined> {
    const existing = this.notificationOutbox.find((n) => n.messageId === input.intent.messageId)
    if (existing) return existing
    const msg: SageNotificationOutbox = {
      id: nextId('notif'),
      messageId: input.intent.messageId,
      orgId: input.orgId,
      workspaceId: input.workspaceId,
      deliveryRequestId: input.intent.deliveryRequestId,
      grantId: input.intent.grantId,
      recipientId: input.recipientId,
      provider: input.intent.provider,
      template: input.intent.template,
      recipientAddressHash: input.intent.recipientAddressHash,
      encryptedPayload: input.intent.encryptedPayload,
      encryptionKeyReference: input.intent.encryptionKeyReference || 'sage-notification:v1',
      status: 'pending',
      attemptCount: 0,
      maxRetries: 5,
      createdAt: input.intent.createdAt,
    }
    this.notificationOutbox.push(msg)
    return msg
  }

  async getNotificationOutboxByMessageId(messageId: string): Promise<SageNotificationOutbox | undefined> {
    return this.notificationOutbox.find((n) => n.messageId === messageId)
  }

  async getNotificationOutboxById(id: string): Promise<SageNotificationOutbox | undefined> {
    return this.notificationOutbox.find((n) => n.id === id)
  }

  async claimPendingNotificationForDispatch(input: {
    maxAttempts?: number
    dispatchOwner: string
    leaseMs?: number
  }): Promise<SageNotificationOutbox | undefined> {
    const maxAttempts = input.maxAttempts ?? 1
    const leaseMs = input.leaseMs ?? 5 * 60 * 1000
    const now = new Date()
    const pending = this.notificationOutbox.find(
      (n) =>
        (n.status === 'pending' || (n.status === 'dispatching' && n.leaseExpiresAt && new Date(n.leaseExpiresAt) < now)) &&
        (!n.nextAttemptAt || new Date(n.nextAttemptAt) <= now) &&
        n.attemptCount < maxAttempts,
    )
    if (!pending) return undefined
    pending.status = 'dispatching'
    pending.dispatchOwner = input.dispatchOwner
    pending.leaseExpiresAt = new Date(now.getTime() + leaseMs).toISOString()
    pending.attemptCount += 1
    return pending
  }

  async markNotificationDispatched(input: {
    id: string
    dispatchOwner: string
    providerMessageId?: string
    providerRequestId?: string
  }): Promise<{ success: boolean }> {
    const msg = this.notificationOutbox.find((n) => n.id === input.id && n.dispatchOwner === input.dispatchOwner)
    if (!msg) return { success: false }
    msg.status = 'dispatched'
    msg.dispatchedAt = new Date().toISOString()
    msg.encryptedPayload = ''
    msg.payloadDestroyedAt = msg.dispatchedAt
    if (input.providerMessageId) msg.providerMessageId = input.providerMessageId
    return { success: true }
  }

  async markNotificationDeadLetter(input: {
    id: string
    dispatchOwner: string
    errorCode?: string
    errorMessage?: string
  }): Promise<{ success: boolean }> {
    const msg = this.notificationOutbox.find((n) => n.id === input.id && n.dispatchOwner === input.dispatchOwner)
    if (!msg) return { success: false }
    msg.status = 'dead_letter'
    msg.encryptedPayload = ''
    msg.payloadDestroyedAt = new Date().toISOString()
    msg.lastErrorCode = input.errorCode
    msg.lastErrorMessage = input.errorMessage
    msg.deadLetteredAt = new Date().toISOString()
    return { success: true }
  }

  async releaseNotificationOutboxToPending(input: {
    id: string
    dispatchOwner: string
    nextAttemptAt: string
    errorCode?: string
  }): Promise<{ success: boolean }> {
    const msg = this.notificationOutbox.find(
      (n) => n.id === input.id && n.status === 'dispatching' && n.dispatchOwner === input.dispatchOwner,
    )
    if (!msg) return { success: false }
    msg.status = 'pending'
    msg.dispatchOwner = undefined
    msg.leaseExpiresAt = undefined
    msg.nextAttemptAt = input.nextAttemptAt
    msg.lastErrorCode = input.errorCode
    return { success: true }
  }

  async listPendingNotificationOutbox(workspaceId: string, orgId: string): Promise<SageNotificationOutbox[]> {
    return this.notificationOutbox.filter(
      (n) => n.workspaceId === workspaceId && n.orgId === orgId && n.status === 'pending',
    )
  }

  async listNotificationOutboxByGrant(grantId: string, orgId: string): Promise<SageNotificationOutbox[]> {
    return this.notificationOutbox.filter((n) => n.grantId === grantId && n.orgId === orgId)
  }
}
