/**
 * Signature Service
 * 
 * High-level service for managing e-signatures with full audit trail
 */

import { db } from "@/db";
import {
  signatureDocuments,
  documentSigners,
  signatureAuditTrail,
} from "@/db/schema";
import SignatureProviderFactory from "./providers";
import { decideProviderSync, mayAdvanceSigner } from "./provider-sync";
import { eq, and, or, desc, notInArray, isNull } from "drizzle-orm";
import { withRLSContext, type RLSTx } from "@/lib/db/with-rls-context";
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
import { createHash } from "crypto";
import { NotificationService } from "@/lib/services/notification-service";
import DocumentStorageService from "@/lib/services/document-storage-service";

type SignatureDocumentInsert = typeof signatureDocuments.$inferInsert;
type SignatureAuditTrailInsert = typeof signatureAuditTrail.$inferInsert;
type DocumentSignerInsert = typeof documentSigners.$inferInsert;

/** A refusal the route can report as a 403 (not permitted) or 409 (not in a state that allows it). */
export class SignatureAuthorityError extends Error {
  constructor(readonly code: "FORBIDDEN" | "CONFLICT", message: string) {
    super(message);
    this.name = "SignatureAuthorityError";
  }
}

/** Document states in which no signature or void can be applied any more. */
const FINAL_DOCUMENT_STATES = ["completed", "voided", "declined", "expired"] as const;
/** Signer states that are settled: a signature is not applied over them. */
const SETTLED_SIGNER_STATES = ["signed", "declined", "authentication_failed", "expired"] as const;

/**
 * Signature Document Service
 */
export class SignatureService {
  private static getContentType(fileName: string): string {
    const extension = fileName.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "pdf":
        return "application/pdf";
      case "doc":
        return "application/msword";
      case "docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      case "png":
        return "image/png";
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      default:
        return "application/octet-stream";
    }
  }
  /**
   * Create and send a document for signature
   */
  static async createSignatureRequest(data: {
    organizationId: string;
    title: string;
    description?: string;
    documentType: string;
    file: Buffer;
    fileName: string;
    sentBy: string;
    signers: Array<{
      userId?: string;
      email: string;
      name: string;
      role?: string;
      signingOrder?: number;
    }>;
    provider?: "docusign" | "hellosign" | "internal";
    expirationDays?: number;
    requireAuthentication?: boolean;
    sequentialSigning?: boolean;
    metadata?: any;
  }): Promise<typeof signatureDocuments.$inferSelect> {
    // Calculate file hash for integrity
    const fileHash = createHash("sha256").update(data.file).digest("hex");

    // Get provider
    const provider = data.provider
      ? SignatureProviderFactory.getProvider(data.provider)
      : SignatureProviderFactory.getDefaultProvider();

    // Create envelope with provider
    const envelope = await provider.createEnvelope({
      document: {
        name: data.fileName,
        content: data.file,
        fileType: data.fileName.split(".").pop() || "pdf",
      },
      signers: data.signers.map((s) => ({
        email: s.email,
        name: s.name,
        role: s.role,
        order: s.signingOrder,
      })),
      subject: data.title,
      message: data.description,
      expirationDays: data.expirationDays || 30,
    });

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (data.expirationDays || 30));

    const storageService = new DocumentStorageService();
    const uploadResult = await storageService.uploadDocument({
      organizationId: data.organizationId,
      documentName: data.fileName,
      documentBuffer: data.file,
      documentType: data.documentType,
      contentType: this.getContentType(data.fileName),
      metadata: {
        envelopeId: envelope.envelopeId,
        provider: provider.name,
      },
    });

    // Create document record
    const documentInsert: SignatureDocumentInsert = {
        organizationId: data.organizationId,
        title: data.title,
        description: data.description,
        documentType: data.documentType,
        fileUrl: uploadResult.url,
        fileName: data.fileName,
        fileSizeBytes: data.file.length,
        fileHash,
        provider: provider.name as "docusign" | "hellosign" | "internal",
        providerDocumentId: envelope.envelopeId,
        providerEnvelopeId: envelope.envelopeId,
        status: "sent",
        sentBy: data.sentBy,
        sentAt: new Date(),
        expiresAt,
        requireAuthentication: data.requireAuthentication || false,
        sequentialSigning: data.sequentialSigning || false,
        metadata: (data.metadata ?? null) as SignatureDocumentInsert['metadata'],
      };

    // The document, its signers, its trail and the platform audit commit together. The envelope and the stored file
    // above are external effects and happen first.
    const document = await withRLSContext({ organizationId: data.organizationId }, async (tx) => {
      const [created] = await tx
        .insert(signatureDocuments)
        .values(documentInsert)
        .returning();

      for (const [index, signer] of data.signers.entries()) {
        await tx.insert(documentSigners).values({
          documentId: created.id,
          userId: signer.userId,
          email: signer.email,
          name: signer.name,
          role: signer.role,
          signingOrder: signer.signingOrder || index + 1,
          status: "sent",
          sentAt: new Date(),
          providerSignerId: envelope.signers[index].signerId,
        });
      }

      await AuditTrailService.log({
        documentId: created.id,
        eventType: "document_created",
        eventDescription: `Document "${data.title}" created and sent for signature`,
        actorUserId: data.sentBy,
        metadata: { provider: provider.name, signerCount: data.signers.length },
      }, tx);

      await AuditTrailService.log({
        documentId: created.id,
        eventType: "document_sent",
        eventDescription: `Document sent to ${data.signers.length} signer(s)`,
        actorUserId: data.sentBy,
      }, tx);

      await persistAtomicAudit(tx, {
        organizationId: data.organizationId,
        userId: data.sentBy,
        action: "signature.document.send",
        resourceType: "signature_documents",
        resourceId: created.id,
        details: { provider: provider.name, signerCount: data.signers.length, fileHash },
      });
      return created;
    });

    return document;
  }

  /**
   * Verify user has access to document (SECURITY FIX: Prevent IDOR)
   */
  static async verifyDocumentAccess(
    documentId: string,
    userId: string
  ): Promise<boolean> {
    const document = await db.query.signatureDocuments.findFirst({
      where: eq(signatureDocuments.id, documentId),
      with: {
        signers: true,
      },
    });

    if (!document) {
      return false;
    }

    // A signature document is visible to the person who sent it and to its signers, which is also what the user's
    // own document list shows. Membership of the organization is not a relationship to the document.
    const isSender = document.sentBy === userId;
    const isSigner = document.signers.some((s) => s.userId === userId);

    return isSender || isSigner;
  }

  /**
   * Get document status
   */
  static async getDocumentStatus(documentId: string) {
    const document = await db.query.signatureDocuments.findFirst({
      where: eq(signatureDocuments.id, documentId),
      with: {
        signers: true,
      },
    });

    if (!document) {
      throw new Error("Document not found");
    }

    // Optionally sync with provider for latest status
    if (document.providerEnvelopeId && document.status !== "completed") {
      await this.syncDocumentStatus(documentId);
    }

    return document;
  }

  /**
   * Sync document status with provider.
   *
   * A provider's report is an observation, judged by decideProviderSync: only an external provider reports, a terminal
   * state is final, a stale or repeated observation changes nothing, and the completion time is the provider's own
   * event time when it supplied one. The local clock is never stamped as a completion or signing time; when it was
   * received is kept separately (providerStatusObserved). The change, the signer updates and the audit records commit
   * together, and the update is conditional on the status that was judged, so two concurrent syncs or a replay cannot
   * apply twice.
   */
  static async syncDocumentStatus(documentId: string): Promise<{ synced: boolean; reason?: string }> {
    const document = await db.query.signatureDocuments.findFirst({
      where: eq(signatureDocuments.id, documentId),
    });

    if (!document || !document.providerEnvelopeId) {
      return { synced: false, reason: "no_envelope" };
    }

    let status;
    try {
      const provider = SignatureProviderFactory.getProvider(
        document.provider as "docusign" | "hellosign" | "internal"
      );
      status = await provider.getEnvelopeStatus(document.providerEnvelopeId);
    } catch (_error) {
      // A provider outage leaves the stored state exactly as it was.
      return { synced: false, reason: "provider_unavailable" };
    }

    const observedAt = new Date();
    const decision = decideProviderSync(
      {
        status: document.status,
        provider: document.provider,
        providerEnvelopeId: document.providerEnvelopeId,
        providerAcknowledgedAt: document.providerAcknowledgedAt ?? null,
      },
      { status: status.status, completedAt: status.completedAt },
      observedAt,
    );
    if (decision.action === "ignore") return { synced: false, reason: decision.reason };

    return withRLSContext({ organizationId: document.organizationId }, async (tx) => {
      const conditions = [eq(signatureDocuments.id, documentId), eq(signatureDocuments.status, document.status)];
      if (!decision.statusChanged) conditions.push(isNull(signatureDocuments.providerAcknowledgedAt));
      const [updated] = await tx
        .update(signatureDocuments)
        .set({
          status: decision.status as SignatureDocumentInsert["status"],
          providerStatusObservedAt: observedAt,
          ...(decision.providerAcknowledgedAt
            ? { providerAcknowledgedAt: decision.providerAcknowledgedAt, completedAt: decision.providerAcknowledgedAt }
            : {}),
          updatedAt: observedAt,
        })
        .where(and(...conditions))
        .returning({ id: signatureDocuments.id });
      // Another sync already applied this observation.
      if (!updated) return { synced: false, reason: "already_applied" };

      await AuditTrailService.log({
        documentId,
        eventType: "status_changed",
        eventDescription: decision.statusChanged
          ? `Provider reported status ${decision.status}`
          : "Provider acknowledged completion",
        metadata: {
          previousStatus: document.status,
          newStatus: decision.status,
          providerAcknowledgedAt: decision.providerAcknowledgedAt?.toISOString() ?? null,
          observedAt: observedAt.toISOString(),
        },
      }, tx);
      await persistAtomicAudit(tx, {
        organizationId: document.organizationId,
        userId: "system:signature-provider-sync",
        action: "signature.provider_status_sync",
        resourceType: "signature_documents",
        resourceId: documentId,
        details: {
          provider: document.provider,
          from: document.status,
          to: decision.status,
          providerAcknowledgedAt: decision.providerAcknowledgedAt?.toISOString() ?? null,
          observedAt: observedAt.toISOString(),
        },
      });

      // Signer updates move forward only, use the provider's own event times, and never overwrite a settled signer.
      for (const signer of status.signers ?? []) {
        const next = this.mapProviderSignerStatus(signer.status);
        const [row] = await tx
          .select({ id: documentSigners.id, status: documentSigners.status, email: documentSigners.email })
          .from(documentSigners)
          .where(
            and(
              eq(documentSigners.documentId, documentId),
              or(eq(documentSigners.providerSignerId, signer.signerId), eq(documentSigners.email, signer.email))
            )
          )
          .limit(1);
        if (!row || !mayAdvanceSigner(row.status, next)) continue;
        const [advanced] = await tx
          .update(documentSigners)
          .set({
            status: next,
            ...(next === "signed" && signer.signedAt ? { signedAt: signer.signedAt } : {}),
            ...(signer.viewedAt ? { viewedAt: signer.viewedAt } : {}),
            updatedAt: observedAt,
          })
          .where(and(eq(documentSigners.id, row.id), eq(documentSigners.status, row.status)))
          .returning({ id: documentSigners.id });
        if (!advanced) continue;
        await AuditTrailService.log({
          documentId,
          signerId: row.id,
          eventType: "signer_status_updated",
          eventDescription: `Signer ${row.email} status updated to ${next}`,
          metadata: { signerStatus: next, providerSignedAt: signer.signedAt?.toISOString() ?? null },
        }, tx);
      }
      return { synced: true };
    });
  }

  private static mapProviderSignerStatus(status: string):
    | "pending"
    | "sent"
    | "delivered"
    | "viewed"
    | "signed"
    | "declined"
    | "authentication_failed"
    | "expired" {
    switch (status) {
      case "sent":
        return "sent";
      case "delivered":
        return "delivered";
      case "viewed":
        return "viewed";
      case "signed":
      case "completed":
        return "signed";
      case "declined":
        return "declined";
      case "voided":
        return "expired";
      default:
        return "pending";
    }
  }

  /**
   * Record signature
   *
   * SECURITY FIX: previously updated documentSigners by id alone, with no
   * verification that the authenticated caller was the actual signer —
   * any authenticated platform user could "sign" on behalf of any other
   * signer by supplying their signerId. Now requires the signer row's own
   * userId to match the authenticated caller. External (non-platform)
   * signers — identified by a null userId — are rejected here pending a
   * dedicated token/link-based authentication flow; this endpoint only
   * ever authenticated via platform session, so it could never have
   * legitimately verified an external signer's identity anyway.
   */
  static async recordSignature(data: {
    signerId: string;
    actorUserId: string;
    signatureImageUrl: string;
    signatureType: "electronic" | "digital" | "wet";
    ipAddress?: string;
    userAgent?: string;
    geolocation?: any;
  }) {
    const existingSigner = await db.query.documentSigners.findFirst({
      where: eq(documentSigners.id, data.signerId),
    });
    if (!existingSigner) {
      throw new Error("Signer not found");
    }
    if (existingSigner.userId === null || existingSigner.userId !== data.actorUserId) {
      throw new Error("You are not authorized to sign as this signer");
    }

    const document = await db.query.signatureDocuments.findFirst({
      where: eq(signatureDocuments.id, existingSigner.documentId),
    });
    if (!document) throw new Error("Document not found");

    return withRLSContext({ organizationId: document.organizationId }, async (tx) => {
      // A signature lands only on a document that is still open and a signer who has not already settled: a voided
      // or completed document is not signed, and a signature already given is not overwritten.
      const [open] = await tx
        .select({ id: signatureDocuments.id })
        .from(signatureDocuments)
        .where(and(eq(signatureDocuments.id, document.id), notInArray(signatureDocuments.status, [...FINAL_DOCUMENT_STATES])));
      if (!open) throw new SignatureAuthorityError("CONFLICT", "This document is no longer open for signing");

      const [updated] = await tx
        .update(documentSigners)
        .set({
          status: "signed",
          signedAt: new Date(),
          signatureType: data.signatureType,
          signatureImageUrl: data.signatureImageUrl,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          geolocation: (data.geolocation ?? null) as DocumentSignerInsert['geolocation'],
          updatedAt: new Date(),
        })
        .where(and(eq(documentSigners.id, data.signerId), notInArray(documentSigners.status, [...SETTLED_SIGNER_STATES])))
        .returning();
      if (!updated) throw new SignatureAuthorityError("CONFLICT", "This signer has already completed signing");

      await AuditTrailService.log({
        documentId: updated.documentId,
        signerId: updated.id,
        eventType: "document_signed",
        eventDescription: `${updated.name} signed the document`,
        actorEmail: updated.email,
        actorUserId: data.actorUserId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        geolocation: data.geolocation,
        metadata: { signatureType: data.signatureType },
      }, tx);
      await persistAtomicAudit(tx, {
        organizationId: document.organizationId,
        userId: data.actorUserId,
        action: "signature.document.sign",
        resourceType: "signature_documents",
        resourceId: updated.documentId,
        details: { signerId: updated.id, signatureType: data.signatureType },
      });

      await this.checkCompletion(updated.documentId, document.organizationId, tx);
      return updated;
    });
  }

  /**
   * Check if document is complete
   */
  private static async checkCompletion(documentId: string, organizationId: string, tx: RLSTx) {
    const signers = await tx.query.documentSigners.findMany({
      where: eq(documentSigners.documentId, documentId),
    });

    const allSigned = signers.every((s) => s.status === "signed");

    if (allSigned) {
      await tx
        .update(signatureDocuments)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(signatureDocuments.id, documentId), notInArray(signatureDocuments.status, [...FINAL_DOCUMENT_STATES])));

      await AuditTrailService.log({
        documentId,
        eventType: "document_completed",
        eventDescription: "All signers have completed signing",
      }, tx);
      await persistAtomicAudit(tx, {
        organizationId,
        userId: "system:signature-completion",
        action: "signature.document.complete",
        resourceType: "signature_documents",
        resourceId: documentId,
        details: { signers: signers.length },
      });
    }
  }

  /**
   * Void document. Only the person who sent it may void it: a signer or another member of the organization has no
   * such relationship to the document. A completed or already voided document cannot be voided.
   */
  static async voidDocument(
    documentId: string,
    voidedBy: string,
    reason: string
  ) {
    const document = await db.query.signatureDocuments.findFirst({
      where: eq(signatureDocuments.id, documentId),
    });

    if (!document) {
      throw new Error("Document not found");
    }
    if (document.sentBy !== voidedBy) {
      throw new SignatureAuthorityError("FORBIDDEN", "Only the sender of a document can void it");
    }
    if ((FINAL_DOCUMENT_STATES as readonly string[]).includes(document.status)) {
      throw new SignatureAuthorityError("CONFLICT", `A ${document.status} document cannot be voided`);
    }

    // Void with provider
    if (document.providerEnvelopeId) {
      try {
        const provider = SignatureProviderFactory.getProvider(
          document.provider as "docusign" | "hellosign" | "internal"
        );
        await provider.voidEnvelope(document.providerEnvelopeId, reason);
      } catch (_error) {
      }
    }

    await withRLSContext({ organizationId: document.organizationId }, async (tx) => {
      const [voided] = await tx
        .update(signatureDocuments)
        .set({
          status: "voided",
          voidedAt: new Date(),
          voidedBy,
          voidReason: reason,
          updatedAt: new Date(),
        })
        .where(and(eq(signatureDocuments.id, documentId), notInArray(signatureDocuments.status, [...FINAL_DOCUMENT_STATES])))
        .returning({ id: signatureDocuments.id });
      if (!voided) throw new SignatureAuthorityError("CONFLICT", "The document can no longer be voided");

      await AuditTrailService.log({
        documentId,
        eventType: "document_voided",
        eventDescription: `Document voided: ${reason}`,
        actorUserId: voidedBy,
        metadata: { reason },
      }, tx);
      await persistAtomicAudit(tx, {
        organizationId: document.organizationId,
        userId: voidedBy,
        action: "signature.document.void",
        resourceType: "signature_documents",
        resourceId: documentId,
        details: { reason, from: document.status },
      });
    });
  }

  /**
   * Send reminder to signer
   */
  static async sendReminder(signerId: string) {
    const signer = await db.query.documentSigners.findFirst({
      where: eq(documentSigners.id, signerId),
    });

    if (!signer) {
      throw new Error("Signer not found");
    }

    const document = await db.query.signatureDocuments.findFirst({
      where: eq(signatureDocuments.id, signer.documentId),
    });

    if (!document) {
      throw new Error("Document not found");
    }

    // Send email reminder
    try {
      const notificationService = new NotificationService();
      await notificationService.send({
        organizationId: document.organizationId,
        recipientEmail: signer.email,
        type: 'email',
        priority: 'normal',
        subject: 'Reminder: Document Awaiting Your Signature',
        body: `This is a reminder that you have a document awaiting your signature.\n\nDocument ID: ${signer.documentId}\nSigner: ${signer.name}\n\nPlease sign the document at your earliest convenience.`,
        htmlBody: `
          <h2>Reminder: Document Awaiting Your Signature</h2>
          <p>This is a friendly reminder that you have a document awaiting your signature.</p>
          <ul>
            <li><strong>Document ID:</strong> ${signer.documentId}</li>
            <li><strong>Signer:</strong> ${signer.name}</li>
          </ul>
          <p>Please sign the document at your earliest convenience.</p>
        `,
        actionUrl: `/documents/${signer.documentId}/sign`,
        actionLabel: 'Sign Now',
        metadata: {
          documentId: signer.documentId,
          signerId,
        },
      });
    } catch (_error) {
// Continue with audit log even if notification fails
    }

    await AuditTrailService.log({
      documentId: signer.documentId,
      signerId,
      eventType: "reminder_sent",
      eventDescription: `Reminder sent to ${signer.name}`,
      actorEmail: signer.email,
    });
  }

  /**
   * Get documents for user
   */
  static async getUserDocuments(userId: string, organizationId: string) {
    // Documents sent by user
    const sent = await db
      .select()
      .from(signatureDocuments)
      .where(
        and(
          eq(signatureDocuments.sentBy, userId),
          eq(signatureDocuments.organizationId, organizationId)
        )
      )
      .orderBy(desc(signatureDocuments.createdAt));

    // Documents to be signed by user
    const toSign = await db
      .select({
        document: signatureDocuments,
        signer: documentSigners,
      })
      .from(documentSigners)
      .innerJoin(
        signatureDocuments,
        eq(documentSigners.documentId, signatureDocuments.id)
      )
      .where(
        and(
          eq(documentSigners.userId, userId),
          eq(signatureDocuments.organizationId, organizationId)
        )
      )
      .orderBy(desc(signatureDocuments.createdAt));

    return { sent, toSign };
  }
}

/**
 * Audit Trail Service
 */
export class AuditTrailService {
  static async log(data: {
    documentId: string;
    signerId?: string;
    eventType: string;
    eventDescription: string;
    actorUserId?: string;
    actorEmail?: string;
    actorRole?: string;
    ipAddress?: string;
    userAgent?: string;
    geolocation?: any;
    metadata?: any;
  }, exec: RLSTx = db) {
    const auditData: SignatureAuditTrailInsert = {
      ...data,
      timestamp: new Date(),
    };
    await exec.insert(signatureAuditTrail).values(auditData);
  }

  static async getDocumentAudit(documentId: string) {
    return await db
      .select()
      .from(signatureAuditTrail)
      .where(eq(signatureAuditTrail.documentId, documentId))
      .orderBy(signatureAuditTrail.timestamp);
  }

  static async getSignerAudit(signerId: string) {
    return await db
      .select()
      .from(signatureAuditTrail)
      .where(eq(signatureAuditTrail.signerId, signerId))
      .orderBy(signatureAuditTrail.timestamp);
  }

  /**
   * Generate audit report for legal compliance
   */
  static async generateAuditReport(documentId: string) {
    const document = await db.query.signatureDocuments.findFirst({
      where: eq(signatureDocuments.id, documentId),
      with: {
        signers: true,
      },
    });

    const auditLog = await this.getDocumentAudit(documentId);

    return {
      document: {
        id: document?.id,
        title: document?.title,
        fileHash: document?.fileHash,
        createdAt: document?.createdAt,
        completedAt: document?.completedAt,
        status: document?.status,
      },
      signers: document?.signers.map((s) => ({
        name: s.name,
        email: s.email,
        signedAt: s.signedAt,
        ipAddress: s.ipAddress,
        signatureType: s.signatureType,
      })),
      auditTrail: auditLog.map((entry) => ({
        timestamp: entry.timestamp,
        event: entry.eventType,
        description: entry.eventDescription,
        actor: entry.actorEmail || entry.actorUserId,
        ipAddress: entry.ipAddress,
      })),
      generatedAt: new Date(),
    };
  }
}

export default SignatureService;

