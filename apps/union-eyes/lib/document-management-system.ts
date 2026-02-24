// ============================================================================
// DOCUMENT MANAGEMENT SYSTEM
// ============================================================================
// Description: Version control, e-signature integration, OCR, full-text search,
//              and retention policy management for grievance documents
// Created: 2025-12-06
// ============================================================================

import { db } from "@/db/db";
import { eq, and, desc, isNull, or, sql } from "drizzle-orm";
import {
  grievanceDocuments,
  type GrievanceDocument,
  type SignatureData,
} from "@/db/schema";
import { put } from "@vercel/blob";
import { DocuSignProvider } from "@/lib/services/signature-providers";
import { processImageOCR, processPDFOCR } from "@/lib/services/ocr-service";

// ============================================================================
// TYPES
// ============================================================================

export type DocumentUploadOptions = {
  category?: string;
  tags?: string[];
  isConfidential?: boolean;
  accessLevel?: "public" | "standard" | "confidential" | "restricted";
  requiresSignature?: boolean;
  retentionPeriodDays?: number;
  description?: string;
};

export type DocumentVersion = {
  version: number;
  documentId: string;
  uploadedBy: string;
  uploadedAt: Date;
  fileSize: number;
  changes?: string;
  status: string;
};

export type DocumentSearchResult = {
  document: GrievanceDocument;
  relevance: number;
  matchedFields: string[];
  excerpt?: string;
};

export type ESignatureRequest = {
  documentId: string;
  signerUserId: string;
  signerEmail: string;
  signerName: string;
  dueDate?: Date;
  message?: string;
  provider: "docusign" | "adobe_sign" | "internal";
  requestedBy?: string;
  id?: string;
};

export type ESignatureStatus = {
  documentId: string;
  status: "pending" | "sent" | "signed" | "declined" | "expired" | "voided";
  signedAt?: Date;
  signedBy?: string;
  provider?: string;
  envelopeId?: string;
  viewUrl?: string;
};

export type RetentionPolicy = {
  documentType: string;
  retentionDays: number;
  autoArchive: boolean;
  autoDelete: boolean;
};

// ============================================================================
// DOCUMENT UPLOAD & MANAGEMENT
// ============================================================================

/**
 * Upload new document to grievance
 */
export async function uploadDocument(
  claimId: string,
  organizationId: string,
  file: File,
  documentType: string,
  uploadedBy: string,
  options: DocumentUploadOptions = {}
): Promise<{ success: boolean; documentId?: string; error?: string }> {
  try {
    // Upload file to blob storage
    const blob = await put(`grievances/${claimId}/${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
    });

    // Create document record
    const [document] = await db
      .insert(grievanceDocuments)
      .values({
        organizationId,
        claimId,
        documentName: file.name,
        documentType,
        filePath: blob.url,
        fileSize: file.size,
        mimeType: file.type,
        version: 1,
        isLatestVersion: true,
        versionStatus: "draft",
        description: options.description,
        tags: options.tags || [],
        category: options.category,
        isConfidential: options.isConfidential || false,
        accessLevel: options.accessLevel || "standard",
        requiresSignature: options.requiresSignature || false,
        retentionPeriodDays: options.retentionPeriodDays,
        uploadedBy,
        uploadedAt: new Date(),
      })
      .returning();

    // If OCR is needed for PDFs/images, queue OCR processing
    if (
      file.type === "application/pdf" ||
      file.type.startsWith("image/")
    ) {
      await queueOCRProcessing(document.id, blob.url);
    }

    return { success: true, documentId: document.id };
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Upload new version of existing document
 */
export async function uploadDocumentVersion(
  parentDocumentId: string,
  organizationId: string,
  file: File,
  uploadedBy: string,
  changes?: string
): Promise<{ success: boolean; documentId?: string; error?: string }> {
  try {
    // Get parent document
    const parentDoc = await db.query.grievanceDocuments.findFirst({
      where: and(
        eq(grievanceDocuments.id, parentDocumentId),
        eq(grievanceDocuments.organizationId, organizationId)
      ),
    });

    if (!parentDoc) {
      return { success: false, error: "Parent document not found" };
    }

    // Upload new file
    const blob = await put(
      `grievances/${parentDoc.claimId}/${file.name}`,
      file,
      {
        access: "public",
        addRandomSuffix: true,
      }
    );

    // Get next version number
    const latestVersion = await db.query.grievanceDocuments.findFirst({
      where: eq(grievanceDocuments.parentDocumentId, parentDocumentId),
      orderBy: [desc(grievanceDocuments.version)],
    });

    const nextVersion = latestVersion?.version ? latestVersion.version + 1 : (parentDoc.version || 0) + 1;

    // Mark all previous versions as not latest
    await db
      .update(grievanceDocuments)
      .set({ isLatestVersion: false })
      .where(
        or(
          eq(grievanceDocuments.id, parentDocumentId),
          eq(grievanceDocuments.parentDocumentId, parentDocumentId)
        )
      );

    // Create new version
    const [newVersion] = await db
      .insert(grievanceDocuments)
      .values({
        organizationId,
        claimId: parentDoc.claimId,
        documentName: file.name,
        documentType: parentDoc.documentType,
        filePath: blob.url,
        fileSize: file.size,
        mimeType: file.type,
        version: nextVersion,
        parentDocumentId,
        isLatestVersion: true,
        versionStatus: "draft",
        description: changes || parentDoc.description,
        tags: parentDoc.tags,
        category: parentDoc.category,
        isConfidential: parentDoc.isConfidential,
        accessLevel: parentDoc.accessLevel,
        requiresSignature: parentDoc.requiresSignature,
        retentionPeriodDays: parentDoc.retentionPeriodDays,
        uploadedBy,
        uploadedAt: new Date(),
      })
      .returning();

    // Queue OCR if needed
    if (
      file.type === "application/pdf" ||
      file.type.startsWith("image/")
    ) {
      await queueOCRProcessing(newVersion.id, blob.url);
    }

    return { success: true, documentId: newVersion.id };
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Get document version history
 */
export async function getDocumentVersions(
  documentId: string,
  organizationId: string
): Promise<DocumentVersion[]> {
  try {
    // Get root document
    const rootDoc = await db.query.grievanceDocuments.findFirst({
      where: and(
        eq(grievanceDocuments.id, documentId),
        eq(grievanceDocuments.organizationId, organizationId)
      ),
    });

    if (!rootDoc) return [];

    // Determine if this is a parent or child document
    const parentId = rootDoc.parentDocumentId || rootDoc.id;

    // Get all versions
    const versions = await db.query.grievanceDocuments.findMany({
      where: or(
        eq(grievanceDocuments.id, parentId),
        eq(grievanceDocuments.parentDocumentId, parentId)
      ),
      orderBy: [desc(grievanceDocuments.version)],
    });

    return versions.map((v) => ({
      version: v.version || 1,
      documentId: v.id,
      uploadedBy: v.uploadedBy,
      uploadedAt: v.uploadedAt ? new Date(v.uploadedAt) : new Date(),
      fileSize: Number(v.fileSize) || 0,
      changes: v.description || undefined,
      status: v.versionStatus || "draft",
    }));
  } catch (_error) {
return [];
  }
}

/**
 * Restore previous version as latest
 */
export async function restoreDocumentVersion(
  versionId: string,
  organizationId: string,
  _restoredBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const versionDoc = await db.query.grievanceDocuments.findFirst({
      where: and(
        eq(grievanceDocuments.id, versionId),
        eq(grievanceDocuments.organizationId, organizationId)
      ),
    });

    if (!versionDoc) {
      return { success: false, error: "Version not found" };
    }

    const parentId = versionDoc.parentDocumentId || versionDoc.id;

    // Mark all versions as not latest
    await db
      .update(grievanceDocuments)
      .set({ isLatestVersion: false })
      .where(
        or(
          eq(grievanceDocuments.id, parentId),
          eq(grievanceDocuments.parentDocumentId, parentId)
        )
      );

    // Mark restored version as latest
    await db
      .update(grievanceDocuments)
      .set({
        isLatestVersion: true,
        versionStatus: "approved",
      })
      .where(eq(grievanceDocuments.id, versionId));

    return { success: true };
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "Restore failed",
    };
  }
}

// ============================================================================
// DOCUMENT SEARCH
// ============================================================================

/**
 * Search documents by name, content, or metadata
 */
export async function searchDocuments(
  organizationId: string,
  query: string,
  filters: {
    claimId?: string;
    documentType?: string;
    category?: string;
    tags?: string[];
    dateFrom?: Date;
    dateTo?: Date;
    uploadedBy?: string;
  } = {}
): Promise<DocumentSearchResult[]> {
  try {
    let whereConditions = and(
      eq(grievanceDocuments.organizationId, organizationId),
      eq(grievanceDocuments.isLatestVersion, true)
    );

    // Apply filters
    if (filters.claimId) {
      whereConditions = and(whereConditions, eq(grievanceDocuments.claimId, filters.claimId));
    }
    if (filters.documentType) {
      whereConditions = and(
        whereConditions,
        eq(grievanceDocuments.documentType, filters.documentType)
      );
    }
    if (filters.uploadedBy) {
      whereConditions = and(
        whereConditions,
        eq(grievanceDocuments.uploadedBy, filters.uploadedBy)
      );
    }

    // Search by query (name, description, OCR text)
    const documents = await db.query.grievanceDocuments.findMany({
      where: whereConditions,
    });

    // Filter and rank results
    const results: DocumentSearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const doc of documents) {
      let relevance = 0;
      const matchedFields: string[] = [];
      let excerpt = "";

      // Match in document name (high relevance)
      if (doc.documentName.toLowerCase().includes(lowerQuery)) {
        relevance += 50;
        matchedFields.push("name");
      }

      // Match in description
      if (doc.description && doc.description.toLowerCase().includes(lowerQuery)) {
        relevance += 30;
        matchedFields.push("description");
        excerpt = extractExcerpt(doc.description, lowerQuery);
      }

      // Match in OCR text (medium relevance)
      if (doc.ocrText && doc.ocrText.toLowerCase().includes(lowerQuery)) {
        relevance += 40;
        matchedFields.push("content");
        excerpt = excerpt || extractExcerpt(doc.ocrText, lowerQuery);
      }

      // Match in tags
      if (doc.tags && doc.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))) {
        relevance += 20;
        matchedFields.push("tags");
      }

      // Apply tag filters
      if (filters.tags && filters.tags.length > 0) {
        const tagMatch = filters.tags.some((tag) => doc.tags?.includes(tag));
        if (!tagMatch) continue;
      }

      // Apply date filters
      const docDate = doc.uploadedAt ? new Date(doc.uploadedAt) : null;
      if (filters.dateFrom && docDate && docDate < filters.dateFrom) continue;
      if (filters.dateTo && docDate && docDate > filters.dateTo) continue;

      if (relevance > 0) {
        results.push({
          document: doc,
          relevance,
          matchedFields,
          excerpt,
        });
      }
    }

    // Sort by relevance
    return results.sort((a, b) => b.relevance - a.relevance);
  } catch (_error) {
return [];
  }
}

/**
 * Extract excerpt around search term
 */
function extractExcerpt(text: string, query: string, contextLength: number = 100): string {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return "";

  const start = Math.max(0, index - contextLength);
  const end = Math.min(text.length, index + query.length + contextLength);
  let excerpt = text.substring(start, end);

  if (start > 0) excerpt = "..." + excerpt;
  if (end < text.length) excerpt = excerpt + "...";

  return excerpt;
}

// ============================================================================
// E-SIGNATURE INTEGRATION
// ============================================================================

/**
 * Request e-signature on document
 */
export async function requestESignature(
  request: ESignatureRequest
): Promise<{ success: boolean; signatureRequestId?: string; error?: string }> {
  try {
    // Get document
    const document = await db.query.grievanceDocuments.findFirst({
      where: eq(grievanceDocuments.id, request.documentId),
    });

    if (!document) {
      return { success: false, error: "Document not found" };
    }

    if (!document.requiresSignature) {
      return {
        success: false,
        error: "Document not configured for e-signature",
      };
    }

    let signatureData: SignatureData = {
      provider: request.provider,
      timestamp: new Date().toISOString(),
    };

    if (request.provider === "docusign") {
      const response = await fetch(document.filePath);
      if (!response.ok) {
        throw new Error(`Failed to download document for signing: ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const provider = new DocuSignProvider();
      const envelope = await provider.createEnvelope({
        documentId: document.id,
        documentName: document.documentName,
        documentBuffer: buffer,
        subject: `Signature Request: ${document.documentName}`,
        message: request.message || 'Please review and sign the attached document.',
        signers: [
          {
            name: request.signerName,
            email: request.signerEmail,
            role: 'signer',
            order: 1,
          },
        ],
        organizationId: document.organizationId as string,
        userId: request.signerUserId,
      });

      signatureData = {
        provider: request.provider,
        timestamp: new Date().toISOString(),
        envelopeId: envelope.id,
        status: envelope.status,
        documentUrl: envelope.documentUrl,
      } as SignatureData;
    }

    await db
      .update(grievanceDocuments)
      .set({
        signatureStatus: request.provider === 'docusign' ? 'sent' : 'pending',
        signatureData,
      })
      .where(eq(grievanceDocuments.id, request.documentId));

    // Send notification to signer
    await sendSignatureRequestNotification(request, document.organizationId as string);

    return {
      success: true,
      signatureRequestId: `sig_${document.id}_${Date.now()}`,
    };
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "Signature request failed",
    };
  }
}

/**
 * Mark document as signed
 */
export async function markDocumentSigned(
  documentId: string,
  organizationId: string,
  signedBy: string,
  signatureData?: Partial<SignatureData>
): Promise<{ success: boolean; error?: string }> {
  try {
    const document = await db.query.grievanceDocuments.findFirst({
      where: and(
        eq(grievanceDocuments.id, documentId),
        eq(grievanceDocuments.organizationId, organizationId)
      ),
    });

    if (!document) {
      return { success: false, error: "Document not found" };
    }

    await db
      .update(grievanceDocuments)
      .set({
        signatureStatus: "signed",
        signedBy,
        signedAt: new Date(),
        signatureData: {
          ...document.signatureData,
          ...signatureData,
        } as SignatureData,
        versionStatus: "approved", // Auto-approve signed documents
      })
      .where(eq(grievanceDocuments.id, documentId));

    return { success: true };
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to mark as signed",
    };
  }
}

/**
 * Get signature status for document
 */
export async function getSignatureStatus(
  documentId: string,
  organizationId: string
): Promise<ESignatureStatus | null> {
  try {
    const document = await db.query.grievanceDocuments.findFirst({
      where: and(
        eq(grievanceDocuments.id, documentId),
        eq(grievanceDocuments.organizationId, organizationId)
      ),
    });

    if (!document || !document.requiresSignature) return null;

    const signatureData = document.signatureData as SignatureData | null;

    return {
      documentId: document.id,
      status: (document.signatureStatus as ESignatureStatus['status']) || "pending",
      signedAt: document.signedAt ? new Date(document.signedAt) : undefined,
      signedBy: document.signedBy || undefined,
      provider: signatureData?.provider,
      envelopeId: signatureData?.envelope_id,
    };
  } catch (_error) {
return null;
  }
}

// ============================================================================
// DOCUMENT RETENTION & ARCHIVAL
// ============================================================================

/**
 * Apply retention policy to documents
 */
export async function applyRetentionPolicy(
  organizationId: string,
  policy: RetentionPolicy
): Promise<{ archivedCount: number; deletedCount: number }> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

    // Find documents matching policy
    const documents = await db.query.grievanceDocuments.findMany({
      where: and(
        eq(grievanceDocuments.organizationId, organizationId),
        eq(grievanceDocuments.documentType, policy.documentType),
        sql`${grievanceDocuments.uploadedAt} < ${cutoffDate.toISOString()}`
      ),
    });

    let archivedCount = 0;
    let deletedCount = 0;

    for (const doc of documents) {
      if (policy.autoArchive && !doc.archivedAt) {
        await db
          .update(grievanceDocuments)
          .set({ archivedAt: new Date() })
          .where(eq(grievanceDocuments.id, doc.id));
        archivedCount++;
      }

      if (policy.autoDelete && doc.archivedAt) {
        // Only delete if already archived
        await db
          .delete(grievanceDocuments)
          .where(eq(grievanceDocuments.id, doc.id));
        deletedCount++;
      }
    }

    return { archivedCount, deletedCount };
  } catch (_error) {
return { archivedCount: 0, deletedCount: 0 };
  }
}

/**
 * Archive document manually
 */
export async function archiveDocument(
  documentId: string,
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .update(grievanceDocuments)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(grievanceDocuments.id, documentId),
          eq(grievanceDocuments.organizationId, organizationId)
        )
      );

    return { success: true };
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "Archive failed",
    };
  }
}

/**
 * Get all documents for a grievance
 */
export async function getGrievanceDocuments(
  claimId: string,
  organizationId: string,
  options: {
    includeArchived?: boolean;
    latestOnly?: boolean;
    documentType?: string;
  } = {}
): Promise<GrievanceDocument[]> {
  try {
    let whereConditions = and(
      eq(grievanceDocuments.claimId, claimId),
      eq(grievanceDocuments.organizationId, organizationId)
    );

    if (!options.includeArchived) {
      whereConditions = and(whereConditions, isNull(grievanceDocuments.archivedAt));
    }

    if (options.latestOnly) {
      whereConditions = and(whereConditions, eq(grievanceDocuments.isLatestVersion, true));
    }

    if (options.documentType) {
      whereConditions = and(
        whereConditions,
        eq(grievanceDocuments.documentType, options.documentType)
      );
    }

    const documents = await db.query.grievanceDocuments.findMany({
      where: whereConditions,
      orderBy: [desc(grievanceDocuments.uploadedAt)],
    });

    return documents;
  } catch (_error) {
return [];
  }
}

// ============================================================================
// OCR PROCESSING (Stub - requires OCR service integration)
// ============================================================================

async function queueOCRProcessing(documentId: string, fileUrl: string): Promise<void> {
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download OCR document: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || '';

    let ocrText = '';

    if (contentType.includes('pdf') || fileUrl.toLowerCase().endsWith('.pdf')) {
      const result = await processPDFOCR(buffer, { provider: 'azure' });
      ocrText = result.fullText;
    } else {
      const result = await processImageOCR(buffer, { provider: 'azure' });
      ocrText = result.text;
    }

    if (ocrText.trim().length > 0) {
      await updateDocumentOCR(documentId, ocrText);
    }
  } catch (_error) {
}
}

/**
 * Update document with OCR text
 */
export async function updateDocumentOCR(
  documentId: string,
  ocrText: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .update(grievanceDocuments)
      .set({
        ocrText,
        indexed: true,
      })
      .where(eq(grievanceDocuments.id, documentId));

    return { success: true };
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "OCR update failed",
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

import { NotificationService } from "@/lib/services/notification-service";

async function sendSignatureRequestNotification(
  request: ESignatureRequest,
  organizationId: string
): Promise<void> {
  try {
    const notificationService = new NotificationService();
    await notificationService.send({
      organizationId,
      recipientEmail: request.signerEmail,
      type: 'email',
      priority: 'normal',
      subject: 'Document Ready for Signature',
      body: `You have a document that requires your signature.\n\nDocument ID: ${request.documentId}\nRequested by: ${request.requestedBy}\n\nPlease sign the document at your earliest convenience.`,
      htmlBody: `
        <h2>Document Ready for Signature</h2>
        <p>You have a document that requires your signature.</p>
        <ul>
          <li><strong>Document ID:</strong> ${request.documentId}</li>
          <li><strong>Requested by:</strong> ${request.requestedBy}</li>
          <li><strong>Due Date:</strong> ${request.dueDate ? new Date(request.dueDate).toLocaleDateString() : 'No due date'}</li>
        </ul>
        <p>Please sign the document at your earliest convenience.</p>
      `,
      actionUrl: `/documents/${request.documentId}/sign`,
      actionLabel: 'Sign Document',
      metadata: {
        documentId: request.documentId,
        requestId: request.id,
      },
    });
} catch (_error) {
// Don&apos;t throw - notification failure shouldn't block the request
  }
}

