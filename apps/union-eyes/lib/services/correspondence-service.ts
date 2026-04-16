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
import { createAuditLog } from "@/lib/services/audit-service";
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
  const prev = await db
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

  await db.insert(correspondenceAuditTrail).values({
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

  // Generate reference number: LTR-YYYY-NNNN
  const year = new Date().getFullYear();
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(correspondence)
    .where(eq(correspondence.organizationId, organizationId));
  const seq = (countResult[0]?.count ?? 0) + 1;
  const referenceNumber = `LTR-${year}-${String(seq).padStart(4, "0")}`;

  const [created] = await db
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

  // Insert recipients
  if (recipients?.length) {
    await db.insert(correspondenceRecipients).values(
      recipients.map((r) => ({
        correspondenceId: created.id,
        recipientType: r.recipientType ?? "to",
        name: r.name,
        email: r.email,
        mailingAddress: r.mailingAddress,
        organization: r.organization,
        title: r.title,
      })),
    );
  }

  // Audit trail
  await appendAuditEntry({
    correspondenceId: created.id,
    eventType: "created",
    actorUserId: draftedBy,
    actorName,
    actorRole,
    description: `Correspondence "${subject}" created as draft`,
    ipAddress,
    userAgent,
  });

  // Platform audit
  await createAuditLog({
    organizationId,
    userId: draftedBy,
    action: "CORRESPONDENCE_CREATED",
    resourceType: "correspondence",
    resourceId: created.id,
    description: `Created correspondence ${referenceNumber}: ${subject}`,
    ipAddress,
    userAgent,
  });

  logger.info("Correspondence created", {
    id: created.id,
    referenceNumber,
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

  const [updated] = await db
    .update(correspondence)
    .set(updates)
    .where(eq(correspondence.id, params.id))
    .returning();

  await appendAuditEntry({
    correspondenceId: params.id,
    eventType: "edited",
    actorUserId: params.actorUserId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    description: "Correspondence edited",
    metadata: { updatedFields: Object.keys(updates).filter((k) => k !== "updatedAt") },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  return updated;
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

// ── Submit for Review ──────────────────────────────────────────────────────

export async function submitForReview(
  id: string,
  ctx: TransitionContext,
) {
  const existing = await getCorrespondenceById(id);
  if (!existing) throw new Error("Correspondence not found");
  validateTransition(existing.status as CorrespondenceStatus, "pending_review");

  if (!existing.assignedSignerId) {
    throw new Error("Cannot submit for review without an assigned signer");
  }

  const [updated] = await db
    .update(correspondence)
    .set({ status: "pending_review", updatedAt: new Date() })
    .where(eq(correspondence.id, id))
    .returning();

  await appendAuditEntry({
    correspondenceId: id,
    eventType: "submitted_for_review",
    actorUserId: ctx.actorUserId,
    actorName: ctx.actorName,
    actorRole: ctx.actorRole,
    description: `Submitted for review by ${existing.assignedSignerId}`,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  await createAuditLog({
    organizationId: existing.organizationId,
    userId: ctx.actorUserId,
    action: "CORRESPONDENCE_SUBMITTED_FOR_REVIEW",
    resourceType: "correspondence",
    resourceId: id,
    description: `Submitted ${existing.referenceNumber} for review`,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return updated;
}

// ── Approve ────────────────────────────────────────────────────────────────

export async function approveCorrespondence(
  id: string,
  ctx: TransitionContext,
) {
  const existing = await getCorrespondenceById(id);
  if (!existing) throw new Error("Correspondence not found");
  validateTransition(existing.status as CorrespondenceStatus, "approved");

  const [updated] = await db
    .update(correspondence)
    .set({
      status: "approved",
      approvedBy: ctx.actorUserId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(correspondence.id, id))
    .returning();

  await appendAuditEntry({
    correspondenceId: id,
    eventType: "approved",
    actorUserId: ctx.actorUserId,
    actorName: ctx.actorName,
    actorRole: ctx.actorRole,
    description: "Correspondence approved for signing",
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  await createAuditLog({
    organizationId: existing.organizationId,
    userId: ctx.actorUserId,
    action: "CORRESPONDENCE_APPROVED",
    resourceType: "correspondence",
    resourceId: id,
    description: `Approved ${existing.referenceNumber}`,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return updated;
}

// ── Request Revision ───────────────────────────────────────────────────────

export async function requestRevision(
  id: string,
  reason: string,
  ctx: TransitionContext,
) {
  const existing = await getCorrespondenceById(id);
  if (!existing) throw new Error("Correspondence not found");
  // Reviewer can send it back to draft from pending_review or approved
  validateTransition(existing.status as CorrespondenceStatus, "draft");

  const [updated] = await db
    .update(correspondence)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(correspondence.id, id))
    .returning();

  await appendAuditEntry({
    correspondenceId: id,
    eventType: "revision_requested",
    actorUserId: ctx.actorUserId,
    actorName: ctx.actorName,
    actorRole: ctx.actorRole,
    description: `Revision requested: ${reason}`,
    metadata: { reason },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return updated;
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
export async function signCorrespondence(
  id: string,
  params: SignCorrespondenceParams,
) {
  const existing = await getCorrespondenceById(id);
  if (!existing) throw new Error("Correspondence not found");
  validateTransition(existing.status as CorrespondenceStatus, "signed");

  // Verify the signer is the assigned signer
  if (existing.assignedSignerId && existing.assignedSignerId !== params.actorUserId) {
    throw new Error("Only the assigned signer can sign this correspondence");
  }

  // Verify the signature belongs to the actor
  const sig = await db
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

  if (!sig[0]) {
    throw new Error("Signature not found or does not belong to this user");
  }

  const [updated] = await db
    .update(correspondence)
    .set({
      status: "signed",
      signatureId: params.signatureId,
      signedBy: params.actorUserId,
      signedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(correspondence.id, id))
    .returning();

  await appendAuditEntry({
    correspondenceId: id,
    eventType: "signed",
    actorUserId: params.actorUserId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    description: "Correspondence signed",
    metadata: { signatureId: params.signatureId },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  await createAuditLog({
    organizationId: existing.organizationId,
    userId: params.actorUserId,
    action: "CORRESPONDENCE_SIGNED",
    resourceType: "correspondence",
    resourceId: id,
    description: `Signed ${existing.referenceNumber}`,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  return updated;
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
export async function dispatchCorrespondence(
  id: string,
  params: DispatchCorrespondenceParams,
) {
  const existing = await getCorrespondenceById(id);
  if (!existing) throw new Error("Correspondence not found");
  validateTransition(existing.status as CorrespondenceStatus, "dispatched");

  const [updated] = await db
    .update(correspondence)
    .set({
      status: "dispatched",
      dispatchedAt: new Date(),
      dispatchedBy: params.actorUserId,
      dispatchMethod: params.dispatchMethod,
      signedPdfUrl: params.signedPdfUrl,
      signedPdfHash: params.signedPdfHash,
      updatedAt: new Date(),
    })
    .where(eq(correspondence.id, id))
    .returning();

  await appendAuditEntry({
    correspondenceId: id,
    eventType: "dispatched",
    actorUserId: params.actorUserId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    description: `Dispatched via ${params.dispatchMethod}`,
    metadata: { dispatchMethod: params.dispatchMethod },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  await createAuditLog({
    organizationId: existing.organizationId,
    userId: params.actorUserId,
    action: "CORRESPONDENCE_DISPATCHED",
    resourceType: "correspondence",
    resourceId: id,
    description: `Dispatched ${existing.referenceNumber} via ${params.dispatchMethod}`,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  return updated;
}

// ── Confirm Delivery ───────────────────────────────────────────────────────

export async function confirmDelivery(
  id: string,
  ctx: TransitionContext,
) {
  const existing = await getCorrespondenceById(id);
  if (!existing) throw new Error("Correspondence not found");
  validateTransition(existing.status as CorrespondenceStatus, "delivered");

  const [updated] = await db
    .update(correspondence)
    .set({ status: "delivered", updatedAt: new Date() })
    .where(eq(correspondence.id, id))
    .returning();

  await appendAuditEntry({
    correspondenceId: id,
    eventType: "delivered",
    actorUserId: ctx.actorUserId,
    actorName: ctx.actorName,
    actorRole: ctx.actorRole,
    description: "Delivery confirmed",
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return updated;
}

// ── Cancel ─────────────────────────────────────────────────────────────────

export async function cancelCorrespondence(
  id: string,
  reason: string,
  ctx: TransitionContext,
) {
  const existing = await getCorrespondenceById(id);
  if (!existing) throw new Error("Correspondence not found");
  validateTransition(existing.status as CorrespondenceStatus, "cancelled");

  const [updated] = await db
    .update(correspondence)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(correspondence.id, id))
    .returning();

  await appendAuditEntry({
    correspondenceId: id,
    eventType: "cancelled",
    actorUserId: ctx.actorUserId,
    actorName: ctx.actorName,
    actorRole: ctx.actorRole,
    description: `Cancelled: ${reason}`,
    metadata: { reason },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return updated;
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
  // Deactivate existing default signatures for this user in this org
  await db
    .update(userSignatures)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(
      and(
        eq(userSignatures.userId, params.userId),
        eq(userSignatures.organizationId, params.organizationId),
        eq(userSignatures.isDefault, true),
      ),
    );

  const [created] = await db
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
