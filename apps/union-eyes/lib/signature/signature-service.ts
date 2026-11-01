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
import { eq, and, or, desc, asc, gt, inArray, notInArray, isNull, lt } from "drizzle-orm";
import { organizationMembers } from "@/db/schema-organizations";
import { signerListSchema, verifySignerList, SignerVerificationError } from "./signer-verification";
import { withRLSContext, withSystemContext, type RLSTx } from "@/lib/db/with-rls-context";
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
import { createHash } from "crypto";
import { NotificationService } from "@/lib/services/notification-service";
import DocumentStorageService from "@/lib/services/document-storage-service";
import { chainHash, checkAgainstWitness, verifyChain, type ChainVerification, type ChainWitness, type StoredChainRow } from "./audit-chain";
import { readSealWitnesses } from "./seal-witness";
import { loadChainRows, nextChainLink } from "./audit-chain-store";
import { verifySignatureDocumentFile } from "./file-integrity";

type SignatureDocumentInsert = typeof signatureDocuments.$inferInsert;
type SignatureAuditTrailInsert = typeof signatureAuditTrail.$inferInsert;
type DocumentSignerInsert = typeof documentSigners.$inferInsert;

/** A refusal the route can report as a 403 (not permitted) or 409 (not in a state that allows it). */
export class SignatureAuthorityError extends Error {
  constructor(readonly code: "FORBIDDEN" | "CONFLICT", message: string, readonly reason?: "expired") {
    super(message);
    this.name = "SignatureAuthorityError";
  }
}

/** Document states in which no signature or void can be applied any more. */
const FINAL_DOCUMENT_STATES = ["completed", "voided", "declined", "expired"] as const;
/** A caller's own document list is a page, not the whole history. */
const USER_DOCUMENT_LIMIT = 200;
/** Signer states that are settled: a signature is not applied over them. */
const SETTLED_SIGNER_STATES = ["signed", "declined", "authentication_failed", "expired"] as const;

/**
 * A short reason for a job report. A database error is wrapped with the statement and its parameters, which a job's response must not
 * carry, so the underlying cause is reported instead, bounded.
 */
function failureReason(error: unknown): string {
  const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined;
  const message = cause instanceof Error ? cause.message : error instanceof Error && !/^Failed query/.test(error.message) ? error.message : "database error";
  return message.slice(0, 200);
}

/** Signer rows carry no organization of their own: their ownership is proven through the organization of their document. */
const documentsOfOrganization = (tx: RLSTx, organizationId: string) =>
  tx.select({ id: signatureDocuments.id }).from(signatureDocuments).where(eq(signatureDocuments.organizationId, organizationId));

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
    provider?: "docusign" | "hellosign";
    expirationDays?: number;
    requireAuthentication?: boolean;
    sequentialSigning?: boolean;
    metadata?: any;
  }): Promise<typeof signatureDocuments.$inferSelect> {
    // A stored option that nothing can enforce is not accepted and then ignored.
    if (data.requireAuthentication) {
      throw new SignatureAuthorityError("CONFLICT", "A second-factor requirement cannot be honoured: this release has no second factor, so a request that states one is not created");
    }

    // Who may sign is decided before anything leaves the platform: no envelope is created and no file is stored for a
    // signer list that names someone the organization cannot vouch for.
    const parsedSigners = signerListSchema.safeParse(data.signers);
    if (!parsedSigners.success) throw new SignatureAuthorityError("CONFLICT", "The signer list is invalid");
    const listedUserIds = parsedSigners.data.flatMap((s) => (s.userId ? [s.userId] : []));
    const activeMembers = listedUserIds.length
      ? await withRLSContext({ organizationId: data.organizationId }, (tx) =>
          tx
            .select({ userId: organizationMembers.userId, name: organizationMembers.name, email: organizationMembers.email })
            .from(organizationMembers)
            .where(
              and(
                eq(organizationMembers.organizationId, data.organizationId),
                inArray(organizationMembers.userId, listedUserIds),
                eq(organizationMembers.status, "active"),
              ),
            ),
        )
      : [];
    try {
      data = { ...data, signers: verifySignerList(parsedSigners.data, activeMembers) };
    } catch (error) {
      if (error instanceof SignerVerificationError) throw new SignatureAuthorityError("FORBIDDEN", error.message);
      throw error;
    }

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
    let document: typeof signatureDocuments.$inferSelect;
    try {
      document = await withRLSContext({ organizationId: data.organizationId }, async (tx) => {
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
    } catch (error) {
      // The envelope can e-mail signers who could still complete it, and the file has no record: undo both, best effort, and report the original failure.
      await Promise.allSettled([
        provider.voidEnvelope(envelope.envelopeId, "The request could not be recorded"),
        storageService.deleteDocument(uploadResult.key),
      ]);
      throw error;
    }

    return document;
  }

  /** Read the sender only inside the authenticated organization's tenant context. */
  static async getDocumentSender(documentId: string, organizationId: string): Promise<string | null> {
    if (!organizationId) return null;
    const document = await withRLSContext({ organizationId }, (tx) =>
      tx.query.signatureDocuments.findFirst({
        where: and(eq(signatureDocuments.id, documentId), eq(signatureDocuments.organizationId, organizationId)),
        columns: { sentBy: true },
      }),
    );
    return document?.sentBy ?? null;
  }

  /** A sender or assigned signer may read a document only within their current organization. */
  static async verifyDocumentAccess(documentId: string, userId: string, organizationId: string): Promise<boolean> {
    if (!organizationId || !userId) return false;
    return withRLSContext({ organizationId }, async (tx) => {
      const document = await tx.query.signatureDocuments.findFirst({
        where: and(eq(signatureDocuments.id, documentId), eq(signatureDocuments.organizationId, organizationId)),
        with: { signers: true },
      });
      if (!document) return false;
      return document.sentBy === userId || document.signers.some((signer) => signer.userId === userId);
    });
  }

  /** The status read is tenant-bound and does not call the provider or mutate state. */
  static async getDocumentStatus(documentId: string, organizationId: string) {
    if (!organizationId) throw new Error("Organization context required");
    const document = await withRLSContext({ organizationId }, (tx) =>
      tx.query.signatureDocuments.findFirst({
        where: and(eq(signatureDocuments.id, documentId), eq(signatureDocuments.organizationId, organizationId)),
        with: { signers: true },
      }),
    );
    if (!document) throw new Error("Document not found");
    const runOut = Boolean(document.expiresAt && document.expiresAt.getTime() < Date.now() && !FINAL_DOCUMENT_STATES.includes(document.status as (typeof FINAL_DOCUMENT_STATES)[number]));
    return { ...document, effectiveStatus: runOut ? "expired" : document.status };
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
  static async syncDocumentStatus(documentId: string, organizationId: string): Promise<{ synced: boolean; reason?: string }> {
    if (!organizationId) return { synced: false, reason: "missing_organization" };
    const document = await withRLSContext({ organizationId }, (tx) =>
      tx.query.signatureDocuments.findFirst({
        where: and(eq(signatureDocuments.id, documentId), eq(signatureDocuments.organizationId, organizationId)),
      }),
    );

    if (!document || !document.providerEnvelopeId) {
      return { synced: false, reason: "no_envelope" };
    }

    let status;
    try {
      const provider = SignatureProviderFactory.getProvider(
        document.provider as "docusign" | "hellosign"
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
        .where(and(...conditions, eq(signatureDocuments.organizationId, document.organizationId)))
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
          .where(and(eq(documentSigners.id, row.id), eq(documentSigners.status, row.status), inArray(documentSigners.documentId, documentsOfOrganization(tx, document.organizationId))))
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
    /** How the address was obtained (see signer-network-address.ts); recorded with the signature. */
    ipProvenance?: Record<string, unknown>;
    userAgent?: string;
    geolocation?: any;
  }) {
    // What this release can evidence is a signature drawn by an authenticated platform user. A certificate-based ("digital") signature
    // asserts cryptographic evidence and a "wet" one a physical signature; neither exists here, so a record labelled with either would
    // claim evidence it does not hold. They are refused rather than stored under a stronger name.
    if (data.signatureType !== "electronic") {
      throw new SignatureAuthorityError("CONFLICT", `A ${data.signatureType} signature cannot be recorded: this release can evidence only an electronic signature by an authenticated user`);
    }
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
    // A document held by a signature provider is signed with that provider. Recording a signature here would mark
    // signers signed, and the document completed, without the provider ever having been asked.
    if (document.provider !== "internal") {
      throw new SignatureAuthorityError("CONFLICT", "This document is signed through its signature provider and cannot be signed here");
    }

    // A signature is given on what was sent: the stored file is hashed again and must match the hash recorded when the request was
    // created. A file that cannot be located as this organization's own storage cannot be checked, and the signature record says so.
    const fileCheck = await verifySignatureDocumentFile({
      organizationId: document.organizationId,
      fileUrl: document.fileUrl,
      fileHash: document.fileHash,
    });
    if (fileCheck.status === "mismatch") {
      throw new SignatureAuthorityError("CONFLICT", "The document no longer matches the content hash recorded when it was sent for signature");
    }

    // The sender asked for a second factor before a signature is accepted. This release has no second factor to give, and a stored option
    // that does not operate is not honoured by ignoring it: the signature is refused until the request is sent without it.
    if (document.requireAuthentication) {
      throw new SignatureAuthorityError("CONFLICT", "This request requires the signer to authenticate with a second factor, which is not available; ask the sender to send it again without that requirement");
    }

    try {
    return await withRLSContext({ organizationId: document.organizationId }, async (tx) => {
      // A signature lands only on a document that is still open and a signer who has not already settled: a voided
      // or completed document is not signed, and a signature already given is not overwritten.
      const [open] = await tx
        .select({ id: signatureDocuments.id })
        .from(signatureDocuments)
        .where(and(eq(signatureDocuments.id, document.id), notInArray(signatureDocuments.status, [...FINAL_DOCUMENT_STATES])));
      if (!open) throw new SignatureAuthorityError("CONFLICT", "This document is no longer open for signing");

      // The stored terms of the request bind the signature: an expired request is not signed, and with sequential signing a signer waits for
      // every signer before them.
      const [terms] = await tx
        .select({ expiresAt: signatureDocuments.expiresAt, sequentialSigning: signatureDocuments.sequentialSigning })
        .from(signatureDocuments)
        .where(eq(signatureDocuments.id, document.id));
      if (terms?.expiresAt && terms.expiresAt.getTime() < Date.now()) {
        throw new SignatureAuthorityError("CONFLICT", "This signature request has expired", "expired");
      }
      if (terms?.sequentialSigning && existingSigner.signingOrder != null) {
        const earlier = await tx
          .select({ id: documentSigners.id, status: documentSigners.status })
          .from(documentSigners)
          .where(and(eq(documentSigners.documentId, document.id), lt(documentSigners.signingOrder, existingSigner.signingOrder)));
        if (earlier.some((signer) => signer.status !== "signed")) {
          throw new SignatureAuthorityError("CONFLICT", "An earlier signer has not signed yet");
        }
      }

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
        .where(and(eq(documentSigners.id, data.signerId), inArray(documentSigners.documentId, documentsOfOrganization(tx, document.organizationId)), notInArray(documentSigners.status, [...SETTLED_SIGNER_STATES])))
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
        metadata: {
          signatureType: data.signatureType,
          fileHashCheck: fileCheck.status === "unverified" ? `unverified:${fileCheck.reason}` : fileCheck.status,
          ...(data.ipProvenance ? { ipProvenance: data.ipProvenance } : {}),
        },
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
    } catch (error) {
      // The refusal rolled the signing transaction back, so the expiry is recorded on its own: nothing else ever sets an internal
      // document to expired.
      if (error instanceof SignatureAuthorityError && error.reason === "expired") await this.markExpired(document);
      throw error;
    }
  }

  /**
   * Marks an open document whose request has run out as expired, with its signers, its trail event and a platform audit record in one
   * transaction. Returns whether this call made the change (a concurrent signature, expiry or void leaves nothing to do).
   */
  private static async markExpired(document: { id: string; organizationId: string; expiresAt: Date | null }): Promise<boolean> {
    return withRLSContext({ organizationId: document.organizationId }, async (tx) => {
      const [expired] = await tx
        .update(signatureDocuments)
        .set({ status: "expired", updatedAt: new Date() })
        .where(and(eq(signatureDocuments.id, document.id), eq(signatureDocuments.organizationId, document.organizationId), notInArray(signatureDocuments.status, [...FINAL_DOCUMENT_STATES])))
        .returning({ id: signatureDocuments.id });
      if (!expired) return false;
      // A signer who had not settled can no longer sign: their state says so, rather than staying "pending" on a closed request.
      const lapsed = await tx
        .update(documentSigners)
        .set({ status: "expired", updatedAt: new Date() })
        .where(and(eq(documentSigners.documentId, document.id), notInArray(documentSigners.status, [...SETTLED_SIGNER_STATES])))
        .returning({ id: documentSigners.id });
      await AuditTrailService.log({
        documentId: document.id,
        eventType: "document_expired",
        eventDescription: "The signature request expired before every signer had signed",
        metadata: { expiresAt: document.expiresAt?.toISOString() ?? null, signersLapsed: lapsed.length },
      }, tx);
      await persistAtomicAudit(tx, {
        organizationId: document.organizationId,
        userId: "system:signature-expiry",
        action: "signature.document.expire",
        resourceType: "signature_documents",
        resourceId: document.id,
        details: { expiresAt: document.expiresAt?.toISOString() ?? null, signersLapsed: lapsed.length },
      });
      return true;
    });
  }

  /**
   * Expires every internal document whose request has run out, whether or not anyone tries to sign it. Overdue documents are found across
   * organizations by system authority (a cross-organization SELECT on signature_documents only, keyset-paged and bounded), and each is
   * expired inside its own organization's context by the same transaction a refused signature uses, so one document's failure does not
   * stop the rest and is reported instead of swallowed. A document held by a signature provider is left to the provider sync.
   */
  static async expireOverdue(options: { now?: Date; pageSize?: number; maxPages?: number } = {}): Promise<{
    scanned: number;
    expired: number;
    failures: Array<{ documentId: string; reason: string }>;
    truncated: boolean;
  }> {
    const now = options.now ?? new Date();
    const pageSize = Math.min(Math.max(options.pageSize ?? 100, 1), 500);
    const maxPages = Math.max(options.maxPages ?? 20, 1);
    const failures: Array<{ documentId: string; reason: string }> = [];
    let scanned = 0;
    let expired = 0;
    let after: string | null = null;
    let pages = 0;

    for (;;) {
      if (pages >= maxPages) return { scanned, expired, failures, truncated: true };
      const cursor: string | null = after;
      const page: Array<{ id: string; organizationId: string; expiresAt: Date | null }> = await withSystemContext((tx) =>
        tx
          .select({ id: signatureDocuments.id, organizationId: signatureDocuments.organizationId, expiresAt: signatureDocuments.expiresAt })
          .from(signatureDocuments)
          .where(and(
            eq(signatureDocuments.provider, "internal"),
            notInArray(signatureDocuments.status, [...FINAL_DOCUMENT_STATES]),
            lt(signatureDocuments.expiresAt, now),
            cursor ? gt(signatureDocuments.id, cursor) : undefined,
          ))
          .orderBy(asc(signatureDocuments.id))
          .limit(pageSize),
      );
      pages += 1;
      for (const document of page) {
        scanned += 1;
        try {
          if (await this.markExpired(document)) expired += 1;
        } catch (error) {
          failures.push({ documentId: document.id, reason: failureReason(error) });
        }
      }
      if (page.length < pageSize) return { scanned, expired, failures, truncated: false };
      after = page[page.length - 1].id;
    }
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
        .where(and(eq(signatureDocuments.id, documentId), notInArray(signatureDocuments.status, [...FINAL_DOCUMENT_STATES]), eq(signatureDocuments.organizationId, organizationId)));

      await AuditTrailService.log({
        documentId,
        eventType: "document_completed",
        eventDescription: "All signers have completed signing",
      }, tx);
      await AuditTrailService.seal(documentId, organizationId, tx);
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
    reason: string,
    organizationId: string,
  ) {
    // The document is resolved under the caller's tenant before any provider
    // side effect. A sender's identity alone is not a tenant authorization.
    if (!organizationId) throw new SignatureAuthorityError("FORBIDDEN", "Organization context required");
    const document = await withRLSContext({ organizationId }, (tx) =>
      tx.query.signatureDocuments.findFirst({
        where: and(eq(signatureDocuments.id, documentId), eq(signatureDocuments.organizationId, organizationId)),
      }),
    );

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
          document.provider as "docusign" | "hellosign"
        );
        await provider.voidEnvelope(document.providerEnvelopeId, reason);
      } catch (_error) {
        // The envelope is still live at the provider and can still be signed there. Recording the document as voided here would say otherwise,
        // so nothing is changed and the sender is told the void did not happen.
        throw new SignatureAuthorityError("CONFLICT", "The signature provider could not void the envelope, so the document was not voided");
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
        .where(and(eq(signatureDocuments.id, documentId), notInArray(signatureDocuments.status, [...FINAL_DOCUMENT_STATES]), eq(signatureDocuments.organizationId, document.organizationId)))
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
      .orderBy(desc(signatureDocuments.createdAt))
      .limit(USER_DOCUMENT_LIMIT);

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
      .orderBy(desc(signatureDocuments.createdAt))
      .limit(USER_DOCUMENT_LIMIT);

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
    // Each event is chained to the one before it, in one transaction with the lock that serializes the document's events.
    await exec.transaction(async (chainTx) => {
      const recordedAt = new Date();
      const { seq, previousHash } = await nextChainLink(chainTx, data.documentId);
      const metadata = { ...(data.metadata ?? {}), chainSeq: seq, recordedAt: recordedAt.toISOString() };
      const hashChain = chainHash(previousHash, { ...data, metadata }, seq);
      const auditData: SignatureAuditTrailInsert = { ...data, metadata, hashChain, timestamp: recordedAt };
      await chainTx.insert(signatureAuditTrail).values(auditData);
    });
  }

  /** Recomputes a document's chain. Rows from before chaining are counted as unchained, not verified. */
  static async verifyChain(documentId: string, exec: RLSTx = db): Promise<ChainVerification> {
    return verifyChain(await loadChainRows(exec, documentId));
  }

  /**
   * Seals the trail at completion: the verified chain head and the number of events are recorded as the last chained event and
   * repeated in the platform's own hash-chained audit log, so the end of the trail can be checked against a record kept elsewhere.
   * A trail whose chain does not verify is not sealed.
   */
  static async seal(documentId: string, organizationId: string, tx: RLSTx) {
    const verification = await this.verifyChain(documentId, tx);
    if (!verification.ok || verification.head === null) return { sealed: false as const };
    await this.log({
      documentId,
      eventType: "document_sealed",
      eventDescription: "The audit trail was sealed at completion",
      metadata: { sealedHead: verification.head, sealedEvents: verification.chained, unchainedEventsBeforeSeal: verification.legacyUnchained },
    }, tx);
    await persistAtomicAudit(tx, {
      organizationId,
      userId: "system:signature-completion",
      action: "signature.document.sealed",
      resourceType: "signature_documents",
      resourceId: documentId,
      details: { chainHead: verification.head, chainedEvents: verification.chained },
    });
    return { sealed: true as const, head: verification.head };
  }

  static async getDocumentAudit(documentId: string, organizationId: string) {
    if (!organizationId) throw new Error("Organization context required");
    return withRLSContext({ organizationId }, (tx) =>
      tx.select().from(signatureAuditTrail)
        .where(and(
          eq(signatureAuditTrail.documentId, documentId),
          inArray(signatureAuditTrail.documentId, documentsOfOrganization(tx, organizationId)),
        ))
        .orderBy(signatureAuditTrail.timestamp),
    );
  }

  static async getSignerAudit(signerId: string, organizationId: string) {
    if (!organizationId) throw new Error("Organization context required");
    return withRLSContext({ organizationId }, (tx) =>
      tx.select().from(signatureAuditTrail)
        .where(and(
          eq(signatureAuditTrail.signerId, signerId),
          inArray(signatureAuditTrail.documentId, documentsOfOrganization(tx, organizationId)),
        ))
        .orderBy(signatureAuditTrail.timestamp),
    );
  }

  /** Produce a tenant-bound audit report; verify the chain from the same RLS transaction. */
  static async generateAuditReport(documentId: string, organizationId: string) {
    if (!organizationId) throw new Error("Organization context required");
    return withRLSContext({ organizationId }, async (tx) => {
      const document = await tx.query.signatureDocuments.findFirst({
        where: and(eq(signatureDocuments.id, documentId), eq(signatureDocuments.organizationId, organizationId)),
        with: { signers: true },
      });
      if (!document) throw new Error("Document not found");
      const auditLog = await tx.select().from(signatureAuditTrail)
        .where(and(
          eq(signatureAuditTrail.documentId, documentId),
          inArray(signatureAuditTrail.documentId, documentsOfOrganization(tx, organizationId)),
        ))
        .orderBy(signatureAuditTrail.timestamp);
      return {
        document: {
          id: document.id,
          title: document.title,
          fileHash: document.fileHash,
          createdAt: document.createdAt,
          completedAt: document.completedAt,
          status: document.status,
        },
        signers: document.signers.map((signer) => ({
          userId: signer.userId,
          name: signer.name,
          email: signer.email,
          signedAt: signer.signedAt,
          ipAddress: signer.ipAddress,
          signatureType: signer.signatureType,
        })),
        auditTrail: auditLog.map((entry) => ({
          timestamp: entry.timestamp,
          event: entry.eventType,
          eventDescription: entry.eventDescription,
          actorUserId: entry.actorUserId,
          actorEmail: entry.actorEmail,
          ipAddress: entry.ipAddress,
        })),
        integrity: await this.integrityStatement(documentId, auditLog, tx, { organizationId, documentStatus: String(document.status) }),
        generatedAt: new Date(),
      };
    });
  }

  private static async integrityStatement(
    documentId: string,
    auditLog: Array<{ eventType: string; metadata: unknown }>,
    tx: RLSTx,
    context?: { organizationId: string; documentStatus: string },
  ) {
    const verification = await this.verifyChain(documentId, tx);
    const seal = auditLog.find((entry) => entry.eventType === "document_sealed")?.metadata as { sealedHead?: string; sealedEvents?: number } | undefined;
    const rows = await loadChainRows(tx, documentId);
    const sealedRow = seal?.sealedEvents ? rows.find((row) => (row.metadata as { chainSeq?: number } | null)?.chainSeq === seal.sealedEvents) : undefined;
    const sealedInTrail = Boolean(verification.ok && seal?.sealedHead && sealedRow?.hashChain === seal.sealedHead);
    const witness = context ? await this.sealWitness(rows, context.organizationId, documentId, Boolean(seal), tx) : { status: "not_checked" as const };
    const tampered = witness.status === "history_missing" || witness.status === "head_mismatch" || witness.status === "seal_event_missing";
    const sealed = sealedInTrail && !tampered;
    const base = {
      hashChained: verification.chained > 0,
      chainVerified: verification.ok && verification.chained > 0,
      chainedEvents: verification.chained,
      unchainedEvents: verification.legacyUnchained,
      sealed,
      sealRecord: witness.status,
      ...(verification.ok ? {} : { brokenAtSequence: verification.brokenAtSeq, brokenReason: verification.reason }),
    };
    if (!verification.ok) return { ...base, notice: `The audit trail was altered: its hash chain does not verify from event ${verification.brokenAtSeq} (${verification.reason}). Do not rely on it as evidence.` };
    if (tampered) return { ...base, notice: `The audit trail does not match the seal recorded in the platform audit log (${witness.status}). Events at the end of the trail may have been removed or the trail rewritten. Do not rely on it as evidence.` };
    if (verification.chained === 0) return { ...base, notice: "Unchained record from before hash chaining. It is not tamper-evident and is not a certified e-signature audit." };
    const completed = context?.documentStatus === "completed";
    const sealState = sealed
      ? witness.status === "corroborated"
        ? "Hash chain verified and sealed at completion, and the seal matches the platform audit log"
        : "Hash chain verified and sealed at completion; the seal could not be checked against the platform audit log, so removal of the newest events cannot be ruled out"
      : completed
        ? "Hash chain verified, but this completed document has no seal: the end of the trail cannot be checked against a record kept elsewhere"
        : "Hash chain verified; the trail has not been sealed (the document is not complete), so removal of its newest events would not be detectable";
    return {
      ...base,
      notice: `${sealState}. ${verification.legacyUnchained > 0 ? `${verification.legacyUnchained} earlier event(s) predate chaining and are not covered. ` : ""}Tamper-evident against changes to the stored rows; not a qualified or certified e-signature audit, and the signer address and any signer-supplied field are as recorded, not independently verified.`,
    };
  }

  /** Checks the stored trail against the seal records in the platform audit log. A failed read is reported as unavailable, never as intact. */
  private static async sealWitness(rows: StoredChainRow[], organizationId: string, documentId: string, sealInTrail: boolean, tx: RLSTx) {
    let witnesses: ChainWitness[];
    try {
      // A savepoint, so a failed read cannot poison the caller's transaction.
      witnesses = await tx.transaction((savepoint) => readSealWitnesses(savepoint as RLSTx, organizationId, documentId));
    } catch {
      return { status: "unavailable" as const };
    }
    if (witnesses.length === 0) return { status: "none" as const };
    for (const witness of witnesses) {
      const check = checkAgainstWitness(rows, witness);
      if (check.status !== "matches") return { status: check.status };
    }
    return sealInTrail ? { status: "corroborated" as const } : { status: "seal_event_missing" as const };
  }
}

export default SignatureService;

