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
  organizationMembers,
} from "@/db/schema";
import SignatureProviderFactory from "./providers";
import { eq, and, or, desc } from "drizzle-orm";
import { createHash } from "crypto";
import { NotificationService } from "@/lib/services/notification-service";
import DocumentStorageService from "@/lib/services/document-storage-service";

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
    metadata?: unknown;
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
    const [document] = await db
      .insert(signatureDocuments)
      .values({
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: data.metadata as any,
      })
      .returning();

    // Create signer records
    const _signerRecords = await Promise.all(
      data.signers.map(async (signer, index) => {
        const providerSigner = envelope.signers[index];

        const [signerRecord] = await db
          .insert(documentSigners)
          .values({
            documentId: document.id,
            userId: signer.userId,
            email: signer.email,
            name: signer.name,
            role: signer.role,
            signingOrder: signer.signingOrder || index + 1,
            status: "sent",
            sentAt: new Date(),
            providerSignerId: providerSigner.signerId,
          })
          .returning();

        return signerRecord;
      })
    );

    // Create audit trail entry
    await AuditTrailService.log({
      documentId: document.id,
      eventType: "document_created",
      eventDescription: `Document "${data.title}" created and sent for signature`,
      actorUserId: data.sentBy,
      metadata: {
        provider: provider.name,
        signerCount: data.signers.length,
      },
    });

    await AuditTrailService.log({
      documentId: document.id,
      eventType: "document_sent",
      eventDescription: `Document sent to ${data.signers.length} signer(s)`,
      actorUserId: data.sentBy,
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

    // SECURITY: User has access if they:
    // 1. Sent the document
    // 2. Are a signer on the document
    // 3. Share the same organizationId (organization member)
    
    const isSender = document.sentBy === userId;
    const isSigner = document.signers.some((s) => s.userId === userId);
    
    // Verify organization-based access (prevents IDOR attacks)
    const isOrgMember = await this.checkOrgMembership(userId, document.organizationId);
    
    return isSender || isSigner || isOrgMember;
  }

  /**
   * Check if user is a member of the organization
   * 
   * SECURITY: Prevents unauthorized access to documents by verifying
   * that the user belongs to the same organization as the document.
   */
  private static async checkOrgMembership(
    userId: string,
    organizationId: string
  ): Promise<boolean> {
    try {
      const membership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.status, 'active')
        ),
      });
      
      return !!membership;
    } catch (_error) {
return false;
    }
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
   * Sync document status with provider
   */
  static async syncDocumentStatus(documentId: string) {
    const document = await db.query.signatureDocuments.findFirst({
      where: eq(signatureDocuments.id, documentId),
    });

    if (!document || !document.providerEnvelopeId) {
      return;
    }

    try {
      const provider = SignatureProviderFactory.getProvider(
        document.provider as "docusign" | "hellosign" | "internal"
      );
      const status = await provider.getEnvelopeStatus(
        document.providerEnvelopeId
      );

      // Update document status
      if (status.status !== document.status) {
        await db
          .update(signatureDocuments)
          .set({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            status: status.status as any,
            updatedAt: new Date(),
            completedAt:
              status.status === "completed" ? new Date() : undefined,
          })
          .where(eq(signatureDocuments.id, documentId));

        await AuditTrailService.log({
          documentId,
          eventType: "status_changed",
          eventDescription: `Document status changed to ${status.status}`,
          metadata: { previousStatus: document.status, newStatus: status.status },
        });
      }

      // Update signer statuses
      if (status.signers?.length) {
        for (const signer of status.signers) {
          const signerStatus = this.mapProviderSignerStatus(signer.status);
          const updateData: Partial<typeof documentSigners.$inferInsert> = {
            status: signerStatus,
            signedAt: signer.signedAt,
            viewedAt: signer.viewedAt,
            declinedAt: signer.status === "declined" ? new Date() : undefined,
            updatedAt: new Date(),
          };

          const updated = await db
            .update(documentSigners)
            .set(updateData)
            .where(
              and(
                eq(documentSigners.documentId, documentId),
                or(
                  eq(documentSigners.providerSignerId, signer.signerId),
                  eq(documentSigners.email, signer.email)
                )
              )
            )
            .returning();

          if (updated.length > 0) {
            await AuditTrailService.log({
              documentId,
              signerId: updated[0].id,
              eventType: "signer_status_updated",
              eventDescription: `Signer ${signer.email} status updated to ${signerStatus}`,
              metadata: { signerStatus },
            });
          }
        }
      }
    } catch (_error) {
}
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
   */
  static async recordSignature(data: {
    signerId: string;
    signatureImageUrl: string;
    signatureType: "electronic" | "digital" | "wet";
    ipAddress?: string;
    userAgent?: string;
    geolocation?: unknown;
  }) {
    const [updated] = await db
      .update(documentSigners)
      .set({
        status: "signed",
        signedAt: new Date(),
        signatureType: data.signatureType,
        signatureImageUrl: data.signatureImageUrl,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        geolocation: data.geolocation as any,
        updatedAt: new Date(),
      })
      .where(eq(documentSigners.id, data.signerId))
      .returning();

    if (!updated) {
      throw new Error("Signer not found");
    }

    await AuditTrailService.log({
      documentId: updated.documentId,
      signerId: updated.id,
      eventType: "document_signed",
      eventDescription: `${updated.name} signed the document`,
      actorEmail: updated.email,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      geolocation: data.geolocation,
      metadata: {
        signatureType: data.signatureType,
      },
    });

    // Check if all signers have signed
    await this.checkCompletion(updated.documentId);

    return updated;
  }

  /**
   * Check if document is complete
   */
  private static async checkCompletion(documentId: string) {
    const signers = await db.query.documentSigners.findMany({
      where: eq(documentSigners.documentId, documentId),
    });

    const allSigned = signers.every((s) => s.status === "signed");

    if (allSigned) {
      await db
        .update(signatureDocuments)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(signatureDocuments.id, documentId));

      await AuditTrailService.log({
        documentId,
        eventType: "document_completed",
        eventDescription: "All signers have completed signing",
      });
    }
  }

  /**
   * Void document
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

    // Update document
    await db
      .update(signatureDocuments)
      .set({
        status: "voided",
        voidedAt: new Date(),
        voidedBy,
        voidReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(signatureDocuments.id, documentId));

    await AuditTrailService.log({
      documentId,
      eventType: "document_voided",
      eventDescription: `Document voided: ${reason}`,
      actorUserId: voidedBy,
      metadata: { reason },
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
    geolocation?: unknown;
    metadata?: unknown;
  }) {
    await db.insert(signatureAuditTrail).values({
      ...data,
      timestamp: new Date(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
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

