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
import type {
  SageDestructionDecision,
  SageExportDestructionApproval,
  SageExportDestructionAttempt,
  SageExportDestructionEvidence,
  SageExportDestructionRequest,
  SageExportLegalHold,
  SageExportRetentionAssignment,
  SageRetentionPolicy,
} from './records-types'
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

  // ── Phase 8B: records lifecycle (retention, legal holds, destruction) ───────
  createRetentionPolicy(input: Omit<SageRetentionPolicy, 'id'>): Promise<SageRetentionPolicy>
  getRetentionPolicy(id: string, orgId: string): Promise<SageRetentionPolicy | undefined>
  /** Highest active version for a policy code, or undefined if none is active. */
  getActiveRetentionPolicyByCode(
    orgId: string,
    policyCode: string,
  ): Promise<SageRetentionPolicy | undefined>
  listRetentionPolicies(orgId: string): Promise<SageRetentionPolicy[]>

  /** Assign the one authoritative retention policy for a package (idempotent per package). */
  assignRetentionPolicy(input: {
    assignment: Omit<SageExportRetentionAssignment, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<{ assignment: SageExportRetentionAssignment; created: boolean }>
  getRetentionAssignment(
    exportPackageId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportRetentionAssignment | undefined>

  placeLegalHold(input: {
    hold: Omit<SageExportLegalHold, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<SageExportLegalHold>
  /** CAS active → released, fenced by an unreleased hold. Frozen origin facts. */
  releaseLegalHold(input: {
    holdId: string
    workspaceId: string
    orgId: string
    releasedBy: string
    releasedAt: string
    releaseReason: string
    auditEvent: SageAuditOutboxIntent
  }): Promise<SageExportLegalHold | undefined>
  getLegalHold(
    holdId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportLegalHold | undefined>
  listLegalHolds(
    exportPackageId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportLegalHold[]>
  countActiveLegalHolds(
    exportPackageId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<number>

  /** Create a destruction request (at most one open request per package). */
  createDestructionRequest(input: {
    request: Omit<SageExportDestructionRequest, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<SageExportDestructionRequest | undefined>
  getDestructionRequest(
    requestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionRequest | undefined>
  listDestructionRequests(
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionRequest[]>
  /** CAS 'requested' → approved|denied + append the frozen approval + audit. */
  decideDestructionRequest(input: {
    destructionRequestId: string
    workspaceId: string
    orgId: string
    decision: SageDestructionDecision
    updatedAt: string
    approval: Omit<SageExportDestructionApproval, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<
    | { request: SageExportDestructionRequest; approval: SageExportDestructionApproval }
    | undefined
  >
  getDestructionApproval(
    destructionRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionApproval | undefined>

  /** CAS approved → executing_preflight (or reclaim a stale lease), fenced by owner. */
  claimDestructionForExecution(input: {
    destructionRequestId: string
    workspaceId: string
    orgId: string
    executionOwner: string
    leaseMs: number
    now: string
  }): Promise<SageExportDestructionRequest | undefined>
  /** Atomically: request → destroyed, tombstone the package, append evidence — fenced by owner + attempt. */
  completeDestruction(input: {
    destructionRequestId: string
    workspaceId: string
    orgId: string
    executionOwner: string
    attemptId: string
    exportPackageId: string
    destroyedBy: string
    updatedAt: string
    evidence: Omit<SageExportDestructionEvidence, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<
    | {
        request: SageExportDestructionRequest
        evidence: SageExportDestructionEvidence
        package: SageExportPackage
      }
    | undefined
  >
  /** Fenced: request → failed and append safe failure evidence. Package stays available. */
  failDestruction(input: {
    destructionRequestId: string
    workspaceId: string
    orgId: string
    executionOwner: string
    attemptId?: string
    attemptStatus?: 'failed' | 'indeterminate'
    updatedAt: string
    evidence: Omit<SageExportDestructionEvidence, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<
    { request: SageExportDestructionRequest; evidence: SageExportDestructionEvidence } | undefined
  >
  getDestructionEvidenceByRequest(
    destructionRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionEvidence | undefined>

  // ── Phase 8B closure hardening: crash-safe destruction execution ────────────
  /** The open (in-flight) destruction request for a package, if any. */
  getOpenDestructionRequestForPackage(
    exportPackageId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionRequest | undefined>
  /** Persist the durable destruction attempt (prepared) BEFORE any external delete, binding it to the request. */
  createDestructionAttempt(input: {
    attempt: Omit<SageExportDestructionAttempt, 'id'>
    executionOwner: string
    updatedAt: string
  }): Promise<SageExportDestructionAttempt | undefined>
  getDestructionAttemptById(
    attemptId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionAttempt | undefined>
  getLatestDestructionAttemptByRequest(
    destructionRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionAttempt | undefined>
  /** Record the pre-delete presence probe result on the attempt. */
  markAttemptPresenceVerified(input: {
    attemptId: string
    executionOwner: string
    present: boolean
    at: string
  }): Promise<{ success: boolean }>
  /**
   * ATOMIC point of no return: verify the request is in preflight for this owner
   * AND that NO active legal hold exists, then move request → deletion_started
   * and attempt → deletion_started. Returns undefined if an active hold appeared
   * or the lease was lost.
   */
  beginDeletion(input: {
    destructionRequestId: string
    attemptId: string
    workspaceId: string
    orgId: string
    exportPackageId: string
    executionOwner: string
    at: string
  }): Promise<
    { request: SageExportDestructionRequest; attempt: SageExportDestructionAttempt } | undefined
  >
  /** Record the safe provider result on the attempt. */
  recordAttemptProviderResult(input: {
    attemptId: string
    executionOwner: string
    providerResult: string
    providerRequestId?: string | null
    safeErrorCode?: string | null
    status: 'provider_accepted' | 'failed'
    at: string
  }): Promise<{ success: boolean }>
  /** Record the post-delete absence verification on the attempt. */
  recordAttemptAbsenceVerified(input: {
    attemptId: string
    executionOwner: string
    absent: boolean
    at: string
  }): Promise<{ success: boolean }>
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
  // Phase 8B — records lifecycle
  private retentionPolicies = new Map<string, SageRetentionPolicy>()
  private retentionAssignments = new Map<string, SageExportRetentionAssignment>()
  private legalHolds = new Map<string, SageExportLegalHold>()
  private destructionRequests = new Map<string, SageExportDestructionRequest>()
  private destructionApprovals: SageExportDestructionApproval[] = []
  private destructionEvidence: SageExportDestructionEvidence[] = []
  private destructionAttempts: SageExportDestructionAttempt[] = []

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

  // ── Phase 8B: records lifecycle ────────────────────────────────────────────
  async createRetentionPolicy(input: Omit<SageRetentionPolicy, 'id'>): Promise<SageRetentionPolicy> {
    const existing = [...this.retentionPolicies.values()].find(
      (p) => p.orgId === input.orgId && p.policyCode === input.policyCode && p.version === input.version,
    )
    if (existing) conflict('a retention policy with this code and version already exists')
    const policy: SageRetentionPolicy = { ...input, id: nextId('retpol') }
    this.retentionPolicies.set(policy.id, policy)
    return policy
  }

  async getRetentionPolicy(id: string, orgId: string): Promise<SageRetentionPolicy | undefined> {
    const p = this.retentionPolicies.get(id)
    return p && p.orgId === orgId ? p : undefined
  }

  async getActiveRetentionPolicyByCode(
    orgId: string,
    policyCode: string,
  ): Promise<SageRetentionPolicy | undefined> {
    return [...this.retentionPolicies.values()]
      .filter((p) => p.orgId === orgId && p.policyCode === policyCode && p.isActive)
      .sort((a, b) => b.version - a.version)[0]
  }

  async listRetentionPolicies(orgId: string): Promise<SageRetentionPolicy[]> {
    return [...this.retentionPolicies.values()]
      .filter((p) => p.orgId === orgId)
      .sort((a, b) => a.policyCode.localeCompare(b.policyCode) || b.version - a.version)
  }

  async assignRetentionPolicy(input: {
    assignment: Omit<SageExportRetentionAssignment, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<{ assignment: SageExportRetentionAssignment; created: boolean }> {
    const existing = [...this.retentionAssignments.values()].find(
      (a) => a.exportPackageId === input.assignment.exportPackageId,
    )
    if (existing) return { assignment: existing, created: false }
    const assignment: SageExportRetentionAssignment = { ...input.assignment, id: nextId('retassign') }
    this.retentionAssignments.set(assignment.id, assignment)
    this.enqueueAuditOutboxInternal(input.auditEvent, {
      orgId: assignment.orgId,
      workspaceId: assignment.workspaceId,
      resourceId: assignment.exportPackageId,
      createdAt: assignment.assignedAt,
    })
    return { assignment, created: true }
  }

  async getRetentionAssignment(
    exportPackageId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportRetentionAssignment | undefined> {
    return [...this.retentionAssignments.values()].find(
      (a) => a.exportPackageId === exportPackageId && a.workspaceId === workspaceId && a.orgId === orgId,
    )
  }

  async placeLegalHold(input: {
    hold: Omit<SageExportLegalHold, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<SageExportLegalHold> {
    const hold: SageExportLegalHold = { ...input.hold, id: nextId('hold') }
    this.legalHolds.set(hold.id, hold)
    this.enqueueAuditOutboxInternal(input.auditEvent, {
      orgId: hold.orgId,
      workspaceId: hold.workspaceId,
      resourceId: hold.exportPackageId,
      createdAt: hold.placedAt,
    })
    return hold
  }

  async getOpenDestructionRequestForPackage(
    exportPackageId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionRequest | undefined> {
    return [...this.destructionRequests.values()].find(
      (r) =>
        r.exportPackageId === exportPackageId &&
        r.workspaceId === workspaceId &&
        r.orgId === orgId &&
        (r.status === 'requested' ||
          r.status === 'approved' ||
          r.status === 'executing' ||
          r.status === 'executing_preflight' ||
          r.status === 'deletion_started'),
    )
  }

  async releaseLegalHold(input: {
    holdId: string
    workspaceId: string
    orgId: string
    releasedBy: string
    releasedAt: string
    releaseReason: string
    auditEvent: SageAuditOutboxIntent
  }): Promise<SageExportLegalHold | undefined> {
    const hold = this.legalHolds.get(input.holdId)
    // CAS: only an active hold in this tenant can be released.
    if (!hold || hold.workspaceId !== input.workspaceId || hold.orgId !== input.orgId) return undefined
    if (hold.status !== 'active') return undefined
    hold.status = 'released'
    hold.releasedBy = input.releasedBy
    hold.releasedAt = input.releasedAt
    hold.releaseReason = input.releaseReason
    this.enqueueAuditOutboxInternal(input.auditEvent, {
      orgId: hold.orgId,
      workspaceId: hold.workspaceId,
      resourceId: hold.exportPackageId,
      createdAt: input.releasedAt,
    })
    return hold
  }

  async getLegalHold(
    holdId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportLegalHold | undefined> {
    const h = this.legalHolds.get(holdId)
    return h && h.workspaceId === workspaceId && h.orgId === orgId ? h : undefined
  }

  async listLegalHolds(
    exportPackageId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportLegalHold[]> {
    return [...this.legalHolds.values()]
      .filter((h) => h.exportPackageId === exportPackageId && h.workspaceId === workspaceId && h.orgId === orgId)
      .sort((a, b) => a.placedAt.localeCompare(b.placedAt))
  }

  async countActiveLegalHolds(
    exportPackageId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<number> {
    return [...this.legalHolds.values()].filter(
      (h) =>
        h.exportPackageId === exportPackageId &&
        h.workspaceId === workspaceId &&
        h.orgId === orgId &&
        h.status === 'active',
    ).length
  }

  async createDestructionRequest(input: {
    request: Omit<SageExportDestructionRequest, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<SageExportDestructionRequest | undefined> {
    const open = [...this.destructionRequests.values()].find(
      (r) =>
        r.exportPackageId === input.request.exportPackageId &&
        (r.status === 'requested' || r.status === 'approved' || r.status === 'executing'),
    )
    if (open) return undefined
    const request: SageExportDestructionRequest = { ...input.request, id: nextId('destroyreq') }
    this.destructionRequests.set(request.id, request)
    this.enqueueAuditOutboxInternal(input.auditEvent, {
      orgId: request.orgId,
      workspaceId: request.workspaceId,
      resourceId: request.id,
      createdAt: request.requestedAt,
    })
    return request
  }

  async getDestructionRequest(
    requestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionRequest | undefined> {
    const r = this.destructionRequests.get(requestId)
    return r && r.workspaceId === workspaceId && r.orgId === orgId ? r : undefined
  }

  async listDestructionRequests(
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionRequest[]> {
    return [...this.destructionRequests.values()]
      .filter((r) => r.workspaceId === workspaceId && r.orgId === orgId)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
  }

  async decideDestructionRequest(input: {
    destructionRequestId: string
    workspaceId: string
    orgId: string
    decision: SageDestructionDecision
    updatedAt: string
    approval: Omit<SageExportDestructionApproval, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<
    { request: SageExportDestructionRequest; approval: SageExportDestructionApproval } | undefined
  > {
    const req = this.destructionRequests.get(input.destructionRequestId)
    // CAS: only a 'requested' request in this tenant may be decided.
    if (!req || req.workspaceId !== input.workspaceId || req.orgId !== input.orgId) return undefined
    if (req.status !== 'requested') return undefined
    if (this.destructionApprovals.some((a) => a.destructionRequestId === req.id)) return undefined
    req.status = input.decision === 'approved' ? 'approved' : 'denied'
    req.updatedAt = input.updatedAt
    const approval: SageExportDestructionApproval = { ...input.approval, id: nextId('destroyappr') }
    this.destructionApprovals.push(approval)
    this.enqueueAuditOutboxInternal(input.auditEvent, {
      orgId: req.orgId,
      workspaceId: req.workspaceId,
      resourceId: req.id,
      createdAt: input.updatedAt,
    })
    return { request: req, approval }
  }

  async getDestructionApproval(
    destructionRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionApproval | undefined> {
    return this.destructionApprovals.find(
      (a) => a.destructionRequestId === destructionRequestId && a.workspaceId === workspaceId && a.orgId === orgId,
    )
  }

  async claimDestructionForExecution(input: {
    destructionRequestId: string
    workspaceId: string
    orgId: string
    executionOwner: string
    leaseMs: number
    now: string
  }): Promise<SageExportDestructionRequest | undefined> {
    const req = this.destructionRequests.get(input.destructionRequestId)
    if (!req || req.workspaceId !== input.workspaceId || req.orgId !== input.orgId) return undefined
    const nowMs = Date.parse(input.now)
    const leaseExpired = req.leaseExpiresAt ? Date.parse(req.leaseExpiresAt) < nowMs : true
    // Claim an approved request, or reclaim a stale preflight lease (never a
    // request that has already passed the point of no return).
    const claimable =
      req.status === 'approved' || (req.status === 'executing_preflight' && leaseExpired)
    if (!claimable) return undefined
    req.status = 'executing_preflight'
    req.executionOwner = input.executionOwner
    req.leaseExpiresAt = new Date(nowMs + input.leaseMs).toISOString()
    req.updatedAt = input.now
    return req
  }

  async createDestructionAttempt(input: {
    attempt: Omit<SageExportDestructionAttempt, 'id'>
    executionOwner: string
    updatedAt: string
  }): Promise<SageExportDestructionAttempt | undefined> {
    const req = this.destructionRequests.get(input.attempt.destructionRequestId)
    // Fenced: only the preflight lease owner may open an attempt.
    if (!req || req.status !== 'executing_preflight' || req.executionOwner !== input.executionOwner) {
      return undefined
    }
    if (this.destructionAttempts.some((a) => a.attemptId === input.attempt.attemptId)) return undefined
    const attempt: SageExportDestructionAttempt = { ...input.attempt, id: nextId('attempt') }
    this.destructionAttempts.push(attempt)
    req.currentAttemptId = attempt.attemptId
    req.updatedAt = input.updatedAt
    return attempt
  }

  async getDestructionAttemptById(
    attemptId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionAttempt | undefined> {
    return this.destructionAttempts.find(
      (a) => a.attemptId === attemptId && a.workspaceId === workspaceId && a.orgId === orgId,
    )
  }

  async getLatestDestructionAttemptByRequest(
    destructionRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionAttempt | undefined> {
    return [...this.destructionAttempts]
      .filter(
        (a) =>
          a.destructionRequestId === destructionRequestId &&
          a.workspaceId === workspaceId &&
          a.orgId === orgId,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  }

  async markAttemptPresenceVerified(input: {
    attemptId: string
    executionOwner: string
    present: boolean
    at: string
  }): Promise<{ success: boolean }> {
    const a = this.destructionAttempts.find(
      (x) => x.attemptId === input.attemptId && x.executionOwner === input.executionOwner,
    )
    if (!a || a.status !== 'prepared') return { success: false }
    a.preDeletePresenceVerified = input.present
    a.preDeleteVerifiedAt = input.at
    a.updatedAt = input.at
    return { success: true }
  }

  async beginDeletion(input: {
    destructionRequestId: string
    attemptId: string
    workspaceId: string
    orgId: string
    exportPackageId: string
    executionOwner: string
    at: string
  }): Promise<
    { request: SageExportDestructionRequest; attempt: SageExportDestructionAttempt } | undefined
  > {
    const req = this.destructionRequests.get(input.destructionRequestId)
    if (!req || req.workspaceId !== input.workspaceId || req.orgId !== input.orgId) return undefined
    if (req.status !== 'executing_preflight' || req.executionOwner !== input.executionOwner) return undefined
    const attempt = this.destructionAttempts.find(
      (a) => a.attemptId === input.attemptId && a.executionOwner === input.executionOwner,
    )
    if (!attempt || attempt.status !== 'prepared') return undefined
    // ATOMIC no-hold check at the point of no return: any active hold aborts.
    const activeHold = [...this.legalHolds.values()].some(
      (h) => h.exportPackageId === input.exportPackageId && h.orgId === input.orgId && h.status === 'active',
    )
    if (activeHold) return undefined
    req.status = 'deletion_started'
    req.deletionStartedAt = input.at
    req.updatedAt = input.at
    attempt.status = 'deletion_started'
    attempt.deleteStartedAt = input.at
    attempt.updatedAt = input.at
    return { request: req, attempt }
  }

  async recordAttemptProviderResult(input: {
    attemptId: string
    executionOwner: string
    providerResult: string
    providerRequestId?: string | null
    safeErrorCode?: string | null
    status: 'provider_accepted' | 'failed'
    at: string
  }): Promise<{ success: boolean }> {
    const a = this.destructionAttempts.find(
      (x) => x.attemptId === input.attemptId && x.executionOwner === input.executionOwner,
    )
    if (!a) return { success: false }
    a.providerResult = input.providerResult
    a.providerRequestId = input.providerRequestId ?? null
    a.safeErrorCode = input.safeErrorCode ?? null
    a.status = input.status
    a.updatedAt = input.at
    return { success: true }
  }

  async recordAttemptAbsenceVerified(input: {
    attemptId: string
    executionOwner: string
    absent: boolean
    at: string
  }): Promise<{ success: boolean }> {
    const a = this.destructionAttempts.find(
      (x) => x.attemptId === input.attemptId && x.executionOwner === input.executionOwner,
    )
    if (!a) return { success: false }
    a.postDeleteAbsenceVerified = input.absent
    a.postDeleteVerifiedAt = input.at
    if (input.absent) a.status = 'absence_verified'
    a.updatedAt = input.at
    return { success: true }
  }

  async completeDestruction(input: {
    destructionRequestId: string
    workspaceId: string
    orgId: string
    executionOwner: string
    attemptId: string
    exportPackageId: string
    destroyedBy: string
    updatedAt: string
    evidence: Omit<SageExportDestructionEvidence, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<
    | {
        request: SageExportDestructionRequest
        evidence: SageExportDestructionEvidence
        package: SageExportPackage
      }
    | undefined
  > {
    const req = this.destructionRequests.get(input.destructionRequestId)
    // Fenced: only the lease owner of a deletion_started request may complete it.
    if (!req || req.workspaceId !== input.workspaceId || req.orgId !== input.orgId) return undefined
    if (req.status !== 'deletion_started' || req.executionOwner !== input.executionOwner) return undefined
    const attempt = this.destructionAttempts.find(
      (a) => a.attemptId === input.attemptId && a.executionOwner === input.executionOwner,
    )
    if (!attempt) return undefined
    const pkg = this.exportPackages.get(input.exportPackageId)
    if (!pkg || pkg.workspaceId !== input.workspaceId || pkg.orgId !== input.orgId) return undefined
    if (pkg.availabilityStatus === 'destroyed') return undefined
    const evidence: SageExportDestructionEvidence = { ...input.evidence, id: nextId('destroyevid') }
    this.destructionEvidence.push(evidence)
    req.status = 'destroyed'
    req.destructionEvidenceId = evidence.id
    req.executionOwner = undefined
    req.leaseExpiresAt = undefined
    req.updatedAt = input.updatedAt
    attempt.status = 'completed'
    attempt.updatedAt = input.updatedAt
    pkg.availabilityStatus = 'destroyed'
    pkg.destroyedAt = input.updatedAt
    pkg.destroyedBy = input.destroyedBy
    pkg.destructionRequestId = req.id
    pkg.destructionEvidenceId = evidence.id
    this.enqueueAuditOutboxInternal(input.auditEvent, {
      orgId: req.orgId,
      workspaceId: req.workspaceId,
      resourceId: req.id,
      createdAt: input.updatedAt,
    })
    return { request: req, evidence, package: pkg }
  }

  async failDestruction(input: {
    destructionRequestId: string
    workspaceId: string
    orgId: string
    executionOwner: string
    attemptId?: string
    attemptStatus?: 'failed' | 'indeterminate'
    updatedAt: string
    evidence: Omit<SageExportDestructionEvidence, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<
    { request: SageExportDestructionRequest; evidence: SageExportDestructionEvidence } | undefined
  > {
    const req = this.destructionRequests.get(input.destructionRequestId)
    if (!req || req.workspaceId !== input.workspaceId || req.orgId !== input.orgId) return undefined
    if (
      (req.status !== 'executing_preflight' && req.status !== 'deletion_started') ||
      req.executionOwner !== input.executionOwner
    ) {
      return undefined
    }
    const evidence: SageExportDestructionEvidence = { ...input.evidence, id: nextId('destroyevid') }
    this.destructionEvidence.push(evidence)
    req.status = 'failed'
    req.destructionEvidenceId = evidence.id
    req.executionOwner = undefined
    req.leaseExpiresAt = undefined
    req.updatedAt = input.updatedAt
    if (input.attemptId) {
      const attempt = this.destructionAttempts.find((a) => a.attemptId === input.attemptId)
      if (attempt) {
        attempt.status = input.attemptStatus ?? 'failed'
        attempt.updatedAt = input.updatedAt
      }
    }
    this.enqueueAuditOutboxInternal(input.auditEvent, {
      orgId: req.orgId,
      workspaceId: req.workspaceId,
      resourceId: req.id,
      createdAt: input.updatedAt,
    })
    return { request: req, evidence }
  }

  async getDestructionEvidenceByRequest(
    destructionRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionEvidence | undefined> {
    return this.destructionEvidence.find(
      (e) => e.destructionRequestId === destructionRequestId && e.workspaceId === workspaceId && e.orgId === orgId,
    )
  }
}
