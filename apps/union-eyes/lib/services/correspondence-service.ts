/**
 * Correspondence Pipeline Service
 *
 * State machine for the correspondence lifecycle:
 *   draft → pending_review → approved → signed → dispatched → delivered
 *
 * Integrates with:
 *  - PKI signature service (document / hash signing)
 *  - Notification service (dispatch alerts)
 *  - Document storage service (PDF persistence)
 *  - Audit service (platform-wide audit log)
 */

import crypto from "crypto";
import { db } from "@/db";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { withRLSContext, type RLSTx } from "@/lib/db/with-rls-context";
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
import { ApiError } from "@/lib/api/errors";
import {
  correspondence,
  correspondenceRecipients,
  correspondenceAuditTrail,
  userSignatures,
  type CorrespondenceInsert,
} from "@/db/schema/domains/documents/correspondence";

// ============================================================================
// TYPES
// ============================================================================

export type CorrespondenceStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "signed"
  | "dispatched"
  | "delivered"
  | "returned"
  | "cancelled";

/**
 * Valid state transitions in the correspondence pipeline.
 */
const STATE_TRANSITIONS: Record<CorrespondenceStatus, CorrespondenceStatus[]> = {
  draft: ["pending_review", "cancelled"],
  pending_review: ["approved", "draft", "cancelled"],  // can be sent back to draft for revision
  approved: ["signed", "draft", "cancelled"],
  signed: ["dispatched", "cancelled"],
  dispatched: ["delivered", "returned"],
  delivered: [],
  returned: ["draft"],   // can re-draft and re-send
  cancelled: ["draft"],  // can reopen as draft
};

// ============================================================================
// AUDIT TRAIL HELPERS
// ============================================================================

async function appendAuditEntry(params: {
  /** The transaction that changes the correspondence; the trail entry must commit with it. */
  exec: RLSTx;
  correspondenceId: string;
  eventType: typeof correspondenceAuditTrail.$inferInsert["eventType"];
  actorUserId: string;
  actorName?: string;
  actorRole?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  // Build hash chain — SHA-256(prev_hash + event_data)
  const prev = await params.exec
    .select({ hashChain: correspondenceAuditTrail.hashChain })
    .from(correspondenceAuditTrail)
    .where(eq(correspondenceAuditTrail.correspondenceId, params.correspondenceId))
    .orderBy(desc(correspondenceAuditTrail.timestamp))
    .limit(1);

  const prevHash = prev[0]?.hashChain ?? "0".repeat(64);
  const eventPayload = JSON.stringify({
    correspondenceId: params.correspondenceId,
    eventType: params.eventType,
    actorUserId: params.actorUserId,
    ts: Date.now(),
  });
  const hashChain = crypto
    .createHash("sha256")
    .update(prevHash + eventPayload)
    .digest("hex");

  await params.exec.insert(correspondenceAuditTrail).values({
    correspondenceId: params.correspondenceId,
    eventType: params.eventType,
    eventDescription: params.description,
    actorUserId: params.actorUserId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: params.metadata as Record<string, unknown>,
    hashChain,
  });
}

// ============================================================================
// CREATE / DRAFT
// ============================================================================

export interface CreateCorrespondenceParams {
  organizationId: string;
  subject: string;
  body: string;
  type?: CorrespondenceInsert["type"];
  priority?: CorrespondenceInsert["priority"];
  draftedBy: string;
  assignedSignerId?: string;
  templateId?: string;
  templateVariables?: Record<string, string>;
  grievanceId?: string;
  recipients?: Array<{
    name: string;
    email?: string;
    mailingAddress?: string;
    organization?: string;
    title?: string;
    recipientType?: "to" | "cc" | "bcc";
  }>;
  actorName?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create a new correspondence in `draft` status.
 */
export async function createCorrespondence(params: CreateCorrespondenceParams) {
  const {
    organizationId,
    subject,
    body,
    type,
    priority,
    draftedBy,
    assignedSignerId,
    templateId,
    templateVariables,
    grievanceId,
    recipients,
    actorName,
    actorRole,
    ipAddress,
    userAgent,
  } = params;

  // The letter, its recipients, its trail entry and the platform audit commit together.
  const created = await withRLSContext({ organizationId }, async (tx) => {
    // Generate reference number: LTR-YYYY-NNNN
    const year = new Date().getFullYear();
    const countResult = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(correspondence)
      .where(eq(correspondence.organizationId, organizationId));
    const seq = (countResult[0]?.count ?? 0) + 1;
    const referenceNumber = `LTR-${year}-${String(seq).padStart(4, "0")}`;

    const [row] = await tx
      .insert(correspondence)
      .values({
        organizationId,
        referenceNumber,
        subject,
        body,
        type: type ?? "letter",
        priority: priority ?? "normal",
        status: "draft",
        draftedBy,
        assignedSignerId,
        templateId,
        templateVariables: templateVariables as Record<string, unknown>,
        grievanceId,
      })
      .returning();

    if (recipients?.length) {
      await tx.insert(correspondenceRecipients).values(
        recipients.map((r) => ({
          correspondenceId: row.id,
          recipientType: r.recipientType ?? "to",
          name: r.name,
          email: r.email,
          mailingAddress: r.mailingAddress,
          organization: r.organization,
          title: r.title,
        })),
      );
    }

    await appendAuditEntry({
      exec: tx,
      correspondenceId: row.id,
      eventType: "created",
      actorUserId: draftedBy,
      actorName,
      actorRole,
      description: `Correspondence "${subject}" created as draft`,
      ipAddress,
      userAgent,
    });

    await persistAtomicAudit(tx, {
      organizationId,
      userId: draftedBy,
      action: "CORRESPONDENCE_CREATED",
      resourceType: "correspondence",
      resourceId: row.id,
      details: { referenceNumber, subject },
    });
    return row;
  });

  logger.info("Correspondence created", {
    id: created.id,
    referenceNumber: created.referenceNumber,
    organizationId,
  });

  return created;
}

// ============================================================================
// READ / QUERY
// ============================================================================

export async function getCorrespondenceById(id: string) {
  const rows = await db
    .select()
    .from(correspondence)
    .where(eq(correspondence.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCorrespondenceWithDetails(id: string) {
  const row = await getCorrespondenceById(id);
  if (!row) return null;

  const [recipients, audit] = await Promise.all([
    db
      .select()
      .from(correspondenceRecipients)
      .where(eq(correspondenceRecipients.correspondenceId, id)),
    db
      .select()
      .from(correspondenceAuditTrail)
      .where(eq(correspondenceAuditTrail.correspondenceId, id))
      .orderBy(asc(correspondenceAuditTrail.timestamp)),
  ]);

  return { ...row, recipients, auditTrail: audit };
}

export interface ListCorrespondenceParams {
  organizationId: string;
  status?: CorrespondenceStatus;
  draftedBy?: string;
  assignedSignerId?: string;
  limit?: number;
  offset?: number;
}

export async function listCorrespondence(params: ListCorrespondenceParams) {
  const conditions = [eq(correspondence.organizationId, params.organizationId)];

  if (params.status) {
    conditions.push(eq(correspondence.status, params.status));
  }
  if (params.draftedBy) {
    conditions.push(eq(correspondence.draftedBy, params.draftedBy));
  }
  if (params.assignedSignerId) {
    conditions.push(eq(correspondence.assignedSignerId, params.assignedSignerId));
  }

  const rows = await db
    .select()
    .from(correspondence)
    .where(and(...conditions))
    .orderBy(desc(correspondence.updatedAt))
    .limit(params.limit ?? 50)
    .offset(params.offset ?? 0);

  return rows;
}

// ============================================================================
// UPDATE
// ============================================================================

export interface UpdateCorrespondenceParams {
  id: string;
  subject?: string;
  body?: string;
  type?: CorrespondenceInsert["type"];
  priority?: CorrespondenceInsert["priority"];
  assignedSignerId?: string;
  internalNotes?: string;
  actorUserId: string;
  actorName?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Edit a correspondence. Only allowed while in `draft` status.
 */
export async function updateCorrespondence(params: UpdateCorrespondenceParams) {
  const existing = await getCorrespondenceById(params.id);
  if (!existing) throw new Error("Correspondence not found");
  if (existing.status !== "draft") {
    throw new Error(`Cannot edit correspondence in "${existing.status}" status — must be in draft`);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (params.subject !== undefined) updates.subject = params.subject;
  if (params.body !== undefined) updates.body = params.body;
  if (params.type !== undefined) updates.type = params.type;
  if (params.priority !== undefined) updates.priority = params.priority;
  if (params.assignedSignerId !== undefined) updates.assignedSignerId = params.assignedSignerId;
  if (params.internalNotes !== undefined) updates.internalNotes = params.internalNotes;
  const fields = Object.keys(updates).filter((k) => k !== "updatedAt");

  return withRLSContext({ organizationId: existing.organizationId }, async (tx) => {
    // Only a draft is editable: the status in the predicate keeps an edit from landing on a letter that moved on.
    const [updated] = await tx
      .update(correspondence)
      .set(updates)
      .where(and(eq(correspondence.id, params.id), eq(correspondence.status, "draft"), eq(correspondence.organizationId, existing.organizationId)))
      .returning();
    if (!updated) throw ApiError.conflict("The correspondence is no longer a draft");

    await appendAuditEntry({
      exec: tx,
      correspondenceId: params.id,
      eventType: "edited",
      actorUserId: params.actorUserId,
      actorName: params.actorName,
      actorRole: params.actorRole,
      description: "Correspondence edited",
      metadata: { updatedFields: fields },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
    await persistAtomicAudit(tx, {
      organizationId: existing.organizationId,
      userId: params.actorUserId,
      action: "CORRESPONDENCE_EDITED",
      resourceType: "correspondence",
      resourceId: params.id,
      details: { fields },
    });
    return updated;
  });
}

// ============================================================================
// STATE TRANSITIONS
// ============================================================================

function validateTransition(
  current: CorrespondenceStatus,
  target: CorrespondenceStatus,
): void {
  const allowed = STATE_TRANSITIONS[current];
  if (!allowed?.includes(target)) {
    throw new Error(
      `Invalid transition: "${current}" → "${target}". Allowed: ${allowed?.join(", ") ?? "none"}`,
    );
  }
}

interface TransitionContext {
  actorUserId: string;
  actorName?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

type CorrespondenceRow = typeof correspondence.$inferSelect;

interface TransitionSpec {
  target: CorrespondenceStatus;
  event: typeof correspondenceAuditTrail.$inferInsert["eventType"];
  /** Platform audit action. */
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
  /** Extra columns the transition sets. */
  set?: Record<string, unknown>;
  /** Refuses the transition (throws) on the transaction that will perform it. */
  guard?: (existing: CorrespondenceRow, tx: RLSTx) => void | Promise<void>;
}

/**
 * One state transition: the status change, the hash-chained trail entry and the platform audit commit together, and
 * the change only lands if the letter is still in the status the decision was made against.
 */
async function transition(id: string, ctx: TransitionContext, spec: TransitionSpec) {
  const existing = await getCorrespondenceById(id);
  if (!existing) throw new Error("Correspondence not found");
  validateTransition(existing.status as CorrespondenceStatus, spec.target);

  return withRLSContext({ organizationId: existing.organizationId }, async (tx) => {
    await spec.guard?.(existing, tx);
    const [updated] = await tx
      .update(correspondence)
      .set({ ...spec.set, status: spec.target, updatedAt: new Date() })
      .where(and(eq(correspondence.id, id), eq(correspondence.status, existing.status), eq(correspondence.organizationId, existing.organizationId)))
      .returning();
    if (!updated) throw ApiError.conflict("The correspondence changed state while this action was in progress");

    await appendAuditEntry({
      exec: tx,
      correspondenceId: id,
      eventType: spec.event,
      actorUserId: ctx.actorUserId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      description: spec.description,
      metadata: spec.metadata,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    await persistAtomicAudit(tx, {
      organizationId: existing.organizationId,
      userId: ctx.actorUserId,
      action: spec.action,
      resourceType: "correspondence",
      resourceId: id,
      details: { from: existing.status, to: spec.target, referenceNumber: existing.referenceNumber, ...spec.metadata },
    });
    return updated;
  });
}

// ── Submit for Review ──────────────────────────────────────────────────────

export async function submitForReview(id: string, ctx: TransitionContext) {
  return transition(id, ctx, {
    target: "pending_review",
    event: "submitted_for_review",
    action: "CORRESPONDENCE_SUBMITTED_FOR_REVIEW",
    description: "Submitted for review",
    guard: (existing) => {
      if (!existing.assignedSignerId) throw new Error("Cannot submit for review without an assigned signer");
    },
  });
}

// ── Approve ────────────────────────────────────────────────────────────────

export async function approveCorrespondence(id: string, ctx: TransitionContext) {
  return transition(id, ctx, {
    target: "approved",
    event: "approved",
    action: "CORRESPONDENCE_APPROVED",
    description: "Correspondence approved for signing",
    set: { approvedBy: ctx.actorUserId, approvedAt: new Date() },
    // Approval is an independent review: whoever drafted the letter cannot approve it.
    guard: (existing) => {
      if (existing.draftedBy && existing.draftedBy === ctx.actorUserId) {
        throw ApiError.forbidden("The drafter of a correspondence cannot approve it");
      }
    },
  });
}

// ── Request Revision ───────────────────────────────────────────────────────

export async function requestRevision(id: string, reason: string, ctx: TransitionContext) {
  return transition(id, ctx, {
    target: "draft",
    event: "revision_requested",
    action: "CORRESPONDENCE_REVISION_REQUESTED",
    description: `Revision requested: ${reason}`,
    metadata: { reason },
  });
}

// ── Sign ───────────────────────────────────────────────────────────────────

export interface SignCorrespondenceParams extends TransitionContext {
  /** The user_signatures row ID to affix */
  signatureId: string;
}

/**
 * Affix a stored signature to the correspondence.
 * Only the assigned signer can sign. The correspondence must be approved.
 */
export async function signCorrespondence(id: string, params: SignCorrespondenceParams) {
  return transition(id, params, {
    target: "signed",
    event: "signed",
    action: "CORRESPONDENCE_SIGNED",
    description: "Correspondence signed",
    metadata: { signatureId: params.signatureId },
    set: { signatureId: params.signatureId, signedBy: params.actorUserId, signedAt: new Date() },
    guard: async (existing, tx) => {
      if (existing.assignedSignerId && existing.assignedSignerId !== params.actorUserId) {
        throw new Error("Only the assigned signer can sign this correspondence");
      }
      const sig = await tx
        .select()
        .from(userSignatures)
        .where(
          and(
            eq(userSignatures.id, params.signatureId),
            eq(userSignatures.userId, params.actorUserId),
            eq(userSignatures.isActive, true),
          ),
        )
        .limit(1);
      if (!sig[0]) throw new Error("Signature not found or does not belong to this user");
    },
  });
}

// ── Dispatch ───────────────────────────────────────────────────────────────

export interface DispatchCorrespondenceParams extends TransitionContext {
  dispatchMethod: string;
  signedPdfUrl?: string;
  signedPdfHash?: string;
}

/**
 * Mark correspondence as dispatched to recipients.
 */
export async function dispatchCorrespondence(id: string, params: DispatchCorrespondenceParams) {
  return transition(id, params, {
    target: "dispatched",
    event: "dispatched",
    action: "CORRESPONDENCE_DISPATCHED",
    description: `Dispatched via ${params.dispatchMethod}`,
    metadata: { dispatchMethod: params.dispatchMethod },
    set: {
      dispatchedAt: new Date(),
      dispatchedBy: params.actorUserId,
      dispatchMethod: params.dispatchMethod,
      signedPdfUrl: params.signedPdfUrl,
      signedPdfHash: params.signedPdfHash,
    },
  });
}

// ── Confirm Delivery ───────────────────────────────────────────────────────

export async function confirmDelivery(id: string, ctx: TransitionContext) {
  return transition(id, ctx, {
    target: "delivered",
    event: "delivered",
    action: "CORRESPONDENCE_DELIVERED",
    description: "Delivery confirmed",
  });
}

// ── Cancel ─────────────────────────────────────────────────────────────────

export async function cancelCorrespondence(id: string, reason: string, ctx: TransitionContext) {
  return transition(id, ctx, {
    target: "cancelled",
    event: "cancelled",
    action: "CORRESPONDENCE_CANCELLED",
    description: `Cancelled: ${reason}`,
    metadata: { reason },
  });
}

// ============================================================================
// USER SIGNATURE MANAGEMENT
// ============================================================================

export interface SaveUserSignatureParams {
  organizationId: string;
  userId: string;
  displayName: string;
  displayTitle?: string;
  source: "drawn" | "uploaded" | "typed";
  imageUrl: string;
  imageHash: string;
}

/**
 * Save or update a user's signature profile.
 * Deactivates any previous default signature.
 */
export async function saveUserSignature(params: SaveUserSignatureParams) {
  // A stored signature is what later signs official correspondence in this person's name, so replacing the default
  // and recording who did it commit together.
  const created = await withRLSContext({ organizationId: params.organizationId }, async (tx) => {
    await tx
      .update(userSignatures)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          eq(userSignatures.userId, params.userId),
          eq(userSignatures.organizationId, params.organizationId),
          eq(userSignatures.isDefault, true),
        ),
      );

    const [row] = await tx
      .insert(userSignatures)
      .values({
        organizationId: params.organizationId,
        userId: params.userId,
        displayName: params.displayName,
        displayTitle: params.displayTitle,
        source: params.source,
        imageUrl: params.imageUrl,
        imageHash: params.imageHash,
        isDefault: true,
        isActive: true,
      })
      .returning();

    await persistAtomicAudit(tx, {
      organizationId: params.organizationId,
      userId: params.userId,
      action: "USER_SIGNATURE_SAVED",
      resourceType: "user_signatures",
      resourceId: row.id,
      details: { source: params.source, imageHash: params.imageHash },
    });
    return row;
  });

  logger.info("User signature saved", {
    signatureId: created.id,
    userId: params.userId,
  });

  return created;
}

export async function getUserDefaultSignature(userId: string, organizationId: string) {
  const rows = await db
    .select()
    .from(userSignatures)
    .where(
      and(
        eq(userSignatures.userId, userId),
        eq(userSignatures.organizationId, organizationId),
        eq(userSignatures.isDefault, true),
        eq(userSignatures.isActive, true),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function getUserSignatures(userId: string, organizationId: string) {
  return db
    .select()
    .from(userSignatures)
    .where(
      and(
        eq(userSignatures.userId, userId),
        eq(userSignatures.organizationId, organizationId),
        eq(userSignatures.isActive, true),
      ),
    )
    .orderBy(desc(userSignatures.createdAt));
}

// ============================================================================
// CORRESPONDENCE AUDIT TRAIL QUERY
// ============================================================================

export async function getCorrespondenceAuditTrail(correspondenceId: string) {
  return db
    .select()
    .from(correspondenceAuditTrail)
    .where(eq(correspondenceAuditTrail.correspondenceId, correspondenceId))
    .orderBy(asc(correspondenceAuditTrail.timestamp));
}
