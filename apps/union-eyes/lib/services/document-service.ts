/**
 * Document Service - Document Management System
 * 
 * Provides comprehensive document operations including:
 * - Document CRUD operations
 * - Folder management
 * - Version control
 * - Search and filtering
 * - OCR processing
 * - Template management
 * - Bulk operations
 * - Access control
 */

import { db } from "@/db/db";
import { documents, documentFolders, documentVersions } from "@/db/schema";
import { eq, and, or, desc, asc, sql, inArray, count, like } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { processImageOCR, processPDFOCR } from "@/lib/services/ocr-service";
import { downloadBuffer } from "@/lib/blob-client";
import { extractBlobPathFromUrl } from "@/lib/services/document-blob-integrity-service";
import { getDocumentMutabilityBlockReason } from "@/lib/services/document-retention-guard";

const DOCUMENT_BLOB_CONTAINER = process.env.AZURE_BLOB_CONTAINER ?? "union-eyes";

// ============================================================================
// Types
// ============================================================================

export type NewDocument = typeof documents.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocumentFolder = typeof documentFolders.$inferInsert;
export type DocumentFolder = typeof documentFolders.$inferSelect;

export interface DocumentWithFolder extends Document {
  folder?: DocumentFolder;
  versions?: DocumentVersion[];
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  fileUrl: string;
  uploadedBy: string;
  uploadedAt: Date;
  changeDescription?: string;
}

export interface FolderWithChildren extends DocumentFolder {
  children?: FolderWithChildren[];
  documentCount?: number;
}

export interface OCRResult {
  documentId: string;
  text: string;
  confidence: number;
  language: string;
  processedAt: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

export interface BulkOperationResult {
  success: boolean;
  processed: number;
  failed: number;
  errors?: Array<{ id: string; error: string }>;
}

// ============================================================================
// Document Operations
// ============================================================================

/**
 * Get document by ID
 */
export async function getDocumentById(
  id: string,
  includeFolder = false
): Promise<DocumentWithFolder | null> {
  try {
    const document = await db.query.documents.findFirst({
      where: eq(documents.id, id),
    });

    if (!document || document.deletedAt) return null;

    if (includeFolder && document.folderId) {
      const folder = await db.query.documentFolders.findFirst({
        where: eq(documentFolders.id, document.folderId),
      });

      return {
        ...document,
        folder: folder || undefined,
      };
    }

    return document;
  } catch (error) {
    logger.error("Error fetching document", { error, id });
    throw new Error("Failed to fetch document");
  }
}

/**
 * List documents
 */
export async function listDocuments(
  filters: {
    organizationId?: string;
    folderId?: string;
    category?: string;
    tags?: string[];
    fileType?: string;
    uploadedBy?: string;
    searchQuery?: string;
  } = {},
  pagination: { page?: number; limit?: number; sortBy?: string; sortOrder?: "asc" | "desc" } = {}
): Promise<{ documents: Document[]; total: number; page: number; limit: number }> {
  try {
    const { page = 1, limit = 50, sortBy = "uploadedAt", sortOrder = "desc" } = pagination;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [sql`${documents.deletedAt} IS NULL`];

    if (filters.organizationId) {
      conditions.push(eq(documents.organizationId, filters.organizationId));
    }

    if (filters.folderId) {
      conditions.push(eq(documents.folderId, filters.folderId));
    }

    if (filters.category) {
      conditions.push(eq(documents.category, filters.category));
    }

    if (filters.fileType) {
      conditions.push(eq(documents.fileType, filters.fileType));
    }

    if (filters.uploadedBy) {
      conditions.push(eq(documents.uploadedBy, filters.uploadedBy));
    }

    if (filters.tags && filters.tags.length > 0) {
      // Check if any of the tags match
      conditions.push(sql`${documents.tags} && ARRAY[${sql.join(filters.tags.map(t => sql`${t}`), sql`, `)}]`);
    }

    if (filters.searchQuery) {
      const searchTerm = `%${filters.searchQuery}%`;
      conditions.push(
        or(
          like(documents.name, searchTerm),
          like(documents.description, searchTerm),
          like(documents.contentText, searchTerm)
        )!
      );
    }

    const whereClause = and(...conditions);

    const sortColumn =
      sortBy === "name"
        ? documents.name
        : sortBy === "uploadedAt"
        ? documents.uploadedAt
        : documents.createdAt;

    const [totalResult, docs] = await Promise.all([
      db.select({ count: count() }).from(documents).where(whereClause),
      db
        .select()
        .from(documents)
        .where(whereClause)
        .orderBy(sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn))
        .limit(limit)
        .offset(offset),
    ]);

    return {
      documents: docs,
      total: totalResult[0]?.count || 0,
      page,
      limit,
    };
  } catch (error) {
    logger.error("Error listing documents", { error, filters });
    throw new Error("Failed to list documents");
  }
}

/**
 * Create document
 */
export async function createDocument(data: NewDocument): Promise<Document> {
  try {
    const [document] = await db.insert(documents).values(data).returning();

    return document;
  } catch (error) {
    logger.error("Error creating document", { error });
    throw new Error("Failed to create document");
  }
}

/**
 * Update document
 */
export async function updateDocument(
  id: string,
  data: Partial<NewDocument>
): Promise<Document | null> {
  try {
    const [updated] = await db
      .update(documents)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning();

    return updated || null;
  } catch (error) {
    logger.error("Error updating document", { error, id });
    throw new Error("Failed to update document");
  }
}

/**
 * Soft delete document
 */
export async function deleteDocument(id: string): Promise<boolean> {
  try {
    const [deleted] = await db
      .update(documents)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning();

    return !!deleted;
  } catch (error) {
    logger.error("Error deleting document", { error, id });
    throw new Error("Failed to delete document");
  }
}

/**
 * Permanently delete document
 */
export async function permanentlyDeleteDocument(id: string): Promise<boolean> {
  try {
    await db.delete(documents).where(eq(documents.id, id));

    return true;
  } catch (error) {
    logger.error("Error permanently deleting document", { error, id });
    throw new Error("Failed to permanently delete document");
  }
}

// ============================================================================
// Folder Operations
// ============================================================================

/**
 * Get folder by ID
 */
export async function getFolderById(id: string): Promise<FolderWithChildren | null> {
  try {
    const folder = await db.query.documentFolders.findFirst({
      where: eq(documentFolders.id, id),
    });

    if (!folder || folder.deletedAt) return null;

    // Get document count
    const docCount = await db
      .select({ count: count() })
      .from(documents)
      .where(and(eq(documents.folderId, id), sql`${documents.deletedAt} IS NULL`));

    return {
      ...folder,
      documentCount: docCount[0]?.count || 0,
    };
  } catch (error) {
    logger.error("Error fetching folder", { error, id });
    throw new Error("Failed to fetch folder");
  }
}

/**
 * List folders
 */
export async function listFolders(
  organizationId: string,
  parentFolderId?: string | null
): Promise<FolderWithChildren[]> {
  try {
    const conditions: SQL[] = [
      eq(documentFolders.organizationId, organizationId),
      sql`${documentFolders.deletedAt} IS NULL`,
    ];

    if (parentFolderId === null) {
      conditions.push(sql`${documentFolders.parentFolderId} IS NULL`);
    } else if (parentFolderId) {
      conditions.push(eq(documentFolders.parentFolderId, parentFolderId));
    }

    const folders = await db
      .select()
      .from(documentFolders)
      .where(and(...conditions))
      .orderBy(asc(documentFolders.name));

    // Get document counts
    const foldersWithCounts = await Promise.all(
      folders.map(async (folder) => {
        const docCount = await db
          .select({ count: count() })
          .from(documents)
          .where(and(eq(documents.folderId, folder.id), sql`${documents.deletedAt} IS NULL`));

        return {
          ...folder,
          documentCount: docCount[0]?.count || 0,
        };
      })
    );

    return foldersWithCounts;
  } catch (error) {
    logger.error("Error listing folders", { error, organizationId });
    throw new Error("Failed to list folders");
  }
}

/**
 * Create folder
 */
export async function createFolder(data: NewDocumentFolder): Promise<DocumentFolder> {
  try {
    const [folder] = await db.insert(documentFolders).values(data).returning();

    return folder;
  } catch (error) {
    logger.error("Error creating folder", { error });
    throw new Error("Failed to create folder");
  }
}

/**
 * Update folder
 */
export async function updateFolder(
  id: string,
  data: Partial<NewDocumentFolder>
): Promise<DocumentFolder | null> {
  try {
    const [updated] = await db
      .update(documentFolders)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(documentFolders.id, id))
      .returning();

    return updated || null;
  } catch (error) {
    logger.error("Error updating folder", { error, id });
    throw new Error("Failed to update folder");
  }
}

/**
 * Delete folder
 */
export async function deleteFolder(id: string, deleteContents = false): Promise<boolean> {
  try {
    if (deleteContents) {
      // Delete all documents in folder
      await db
        .update(documents)
        .set({ deletedAt: new Date() })
        .where(eq(documents.folderId, id));

      // Recursively delete subfolders
      const subfolders = await db
        .select()
        .from(documentFolders)
        .where(eq(documentFolders.parentFolderId, id));

      for (const subfolder of subfolders) {
        await deleteFolder(subfolder.id, true);
      }
    }

    // Delete folder
    const [deleted] = await db
      .update(documentFolders)
      .set({ deletedAt: new Date() })
      .where(eq(documentFolders.id, id))
      .returning();

    return !!deleted;
  } catch (error) {
    logger.error("Error deleting folder", { error, id });
    throw new Error("Failed to delete folder");
  }
}

/**
 * Get folder tree
 */
export async function getFolderTree(organizationId: string): Promise<FolderWithChildren[]> {
  try {
    const allFolders = await db
      .select()
      .from(documentFolders)
      .where(and(eq(documentFolders.organizationId, organizationId), sql`${documentFolders.deletedAt} IS NULL`));

    // Build tree structure
    const folderMap = new Map<string, FolderWithChildren>();
    const rootFolders: FolderWithChildren[] = [];

    // First pass: create map
    allFolders.forEach((folder) => {
      folderMap.set(folder.id, { ...folder, children: [] });
    });

    // Second pass: build tree
    allFolders.forEach((folder) => {
      const folderWithChildren = folderMap.get(folder.id)!;
      if (folder.parentFolderId) {
        const parent = folderMap.get(folder.parentFolderId);
        if (parent) {
          parent.children!.push(folderWithChildren);
        }
      } else {
        rootFolders.push(folderWithChildren);
      }
    });

    return rootFolders;
  } catch (error) {
    logger.error("Error getting folder tree", { error, organizationId });
    throw new Error("Failed to get folder tree");
  }
}

// ============================================================================
// Version Control
// ============================================================================

/**
 * Create document version
 */
export async function createDocumentVersion(
  documentId: string,
  fileUrl: string,
  uploadedBy: string,
  changeDescription?: string,
  organizationId?: string,
): Promise<DocumentVersion> {
  try {
    const document = await db.query.documents.findFirst({
      where:
        organizationId
          ? and(eq(documents.id, documentId), eq(documents.organizationId, organizationId))
          : eq(documents.id, documentId),
    });

    if (!document || document.deletedAt) {
      throw new Error("Document not found");
    }

    const latest = (
      await db
        .select({ versionNo: documentVersions.versionNo })
        .from(documentVersions)
        .where(eq(documentVersions.documentId, documentId))
        .orderBy(desc(documentVersions.versionNo))
        .limit(1)
    )[0];

    const nextVersionNo = (latest?.versionNo ?? 0) + 1;

    const [created] = await db
      .insert(documentVersions)
      .values({
        organizationId: document.organizationId,
        documentId,
        versionNo: nextVersionNo,
        storageKey: fileUrl,
        contentHash: document.checksum ?? `version-${nextVersionNo}`,
        uploadedBy,
        metadata: {
          changeDescription,
        },
      })
      .returning();

    return {
      id: created.id,
      documentId: created.documentId,
      versionNumber: created.versionNo,
      fileUrl: created.storageKey,
      uploadedBy: created.uploadedBy,
      uploadedAt: created.uploadedAt,
      changeDescription,
    };
  } catch (error) {
    logger.error("Error creating document version", { error, documentId });
    throw new Error("Failed to create document version");
  }
}

/**
 * Get document versions
 */
export async function getDocumentVersions(documentId: string, organizationId?: string): Promise<DocumentVersion[]> {
  try {
    const rows = await db
      .select()
      .from(documentVersions)
      .where(
        organizationId
          ? and(
              eq(documentVersions.documentId, documentId),
              eq(documentVersions.organizationId, organizationId),
            )
          : eq(documentVersions.documentId, documentId),
      )
      .orderBy(desc(documentVersions.versionNo));

    return rows.map((row) => ({
      id: row.id,
      documentId: row.documentId,
      versionNumber: row.versionNo,
      fileUrl: row.storageKey,
      uploadedBy: row.uploadedBy,
      uploadedAt: row.uploadedAt,
      changeDescription:
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as { changeDescription?: string }).changeDescription
          : undefined,
    }));
  } catch (error) {
    logger.error("Error fetching document versions", { error, documentId });
    throw new Error("Failed to fetch document versions");
  }
}

// ============================================================================
// OCR Processing
// ============================================================================

/**
 * Process document with OCR
 */
export async function processDocumentOCR(documentId: string, organizationId?: string): Promise<OCRResult> {
  try {
    const document = await db.query.documents.findFirst({
      where:
        organizationId
          ? and(eq(documents.id, documentId), eq(documents.organizationId, organizationId))
          : eq(documents.id, documentId),
    });

    if (!document || document.deletedAt) {
      throw new Error("Document not found");
    }

    const fileUrl = document.fileUrl;
    const blobPath =
      (document.metadata && typeof document.metadata === "object"
        ? (document.metadata as { blobKey?: string }).blobKey
        : undefined) ??
      extractBlobPathFromUrl(fileUrl);

    if (!blobPath) {
      throw new Error("Document blob path missing");
    }

    const buffer = await downloadBuffer(DOCUMENT_BLOB_CONTAINER, blobPath);
    const lowerMimeType = (document.mimeType ?? "").toLowerCase();
    const lowerFileType = (document.fileType ?? "").toLowerCase();
    const processedAt = new Date();

    let extractedText = "";
    let confidence = 0;
    const language = "en";
    let metadata: Record<string, unknown> = {
      provider: "native",
      blobPath,
    };

    if (lowerMimeType.startsWith("image/")) {
      const imageResult = await processImageOCR(buffer);
      extractedText = imageResult.text;
      confidence = imageResult.confidence;
      metadata = {
        provider: "image-ocr",
        blobPath,
      };
    } else if (lowerMimeType.includes("pdf") || lowerFileType === "pdf") {
      const pdfResult = await processPDFOCR(buffer);
      extractedText = pdfResult.fullText;
      confidence = pdfResult.pages.length > 0
        ? Math.round(pdfResult.pages.reduce((sum, page) => sum + page.confidence, 0) / pdfResult.pages.length)
        : 0;
      metadata = {
        provider: "pdf-ocr",
        blobPath,
        pages: pdfResult.pages.length,
      };
    } else if (
      lowerMimeType.startsWith("text/")
      || lowerMimeType.includes("json")
      || lowerFileType === "txt"
      || lowerFileType === "csv"
      || lowerFileType === "json"
    ) {
      extractedText = buffer.toString("utf8");
      confidence = 100;
      metadata = {
        provider: "text-decode",
        blobPath,
      };
    }

    const result: OCRResult = {
      documentId,
      text: extractedText,
      confidence,
      language,
      processedAt,
      metadata,
    };

    await updateDocument(documentId, {
      contentText: extractedText,
      metadata: {
        ...(document.metadata && typeof document.metadata === "object" ? document.metadata : {}),
        ocr: {
          ...metadata,
          confidence,
          language,
          processedAt: processedAt.toISOString(),
        },
      },
    });

    return result;
  } catch (error) {
    logger.error("Error processing document OCR", { error, documentId });
    throw new Error("Failed to process document OCR");
  }
}

/**
 * Bulk process documents with OCR
 */
export async function bulkProcessOCR(documentIds: string[], organizationId?: string): Promise<BulkOperationResult> {
  const errors: Array<{ id: string; error: string }> = [];
  let processed = 0;

  try {
    for (const id of documentIds) {
      try {
        if (organizationId) {
          await processDocumentOCR(id, organizationId);
        } else {
          await processDocumentOCR(id);
        }
        processed++;
      } catch (error) {
        errors.push({
          id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      success: errors.length === 0,
      processed,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    logger.error("Error in bulk OCR processing", { error, documentIds });
    throw new Error("Failed to complete bulk OCR processing");
  }
}

// ============================================================================
// Search Operations
// ============================================================================

/**
 * Advanced document search
 */
export async function searchDocuments(
  organizationId: string,
  searchQuery: string,
  filters?: {
    category?: string;
    fileType?: string;
    tags?: string[];
    uploadedBy?: string;
  },
  pagination?: { page?: number; limit?: number }
): Promise<{ documents: Document[]; total: number }> {
  try {
    const { page = 1, limit = 50 } = pagination || {};
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [
      eq(documents.organizationId, organizationId),
      sql`${documents.deletedAt} IS NULL`,
    ];

    // Full-text search
    if (searchQuery) {
      const searchTerm = `%${searchQuery}%`;
      conditions.push(
        or(
          like(documents.name, searchTerm),
          like(documents.description, searchTerm),
          like(documents.contentText, searchTerm)
        )!
      );
    }

    if (filters?.category) {
      conditions.push(eq(documents.category, filters.category));
    }

    if (filters?.fileType) {
      conditions.push(eq(documents.fileType, filters.fileType));
    }

    if (filters?.uploadedBy) {
      conditions.push(eq(documents.uploadedBy, filters.uploadedBy));
    }

    if (filters?.tags && filters.tags.length > 0) {
      conditions.push(sql`${documents.tags} && ARRAY[${sql.join(filters.tags.map(t => sql`${t}`), sql`, `)}]`);
    }

    const whereClause = and(...conditions);

    const [totalResult, docs] = await Promise.all([
      db.select({ count: count() }).from(documents).where(whereClause),
      db.select().from(documents).where(whereClause).limit(limit).offset(offset),
    ]);

    return {
      documents: docs,
      total: totalResult[0]?.count || 0,
    };
  } catch (error) {
    logger.error("Error searching documents", { error, organizationId, searchQuery });
    throw new Error("Failed to search documents");
  }
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Bulk move documents
 */
export async function bulkMoveDocuments(
  documentIds: string[],
  targetFolderId: string | null,
  organizationId: string,
): Promise<BulkOperationResult> {
  try {
    await db
      .update(documents)
      .set({ folderId: targetFolderId, updatedAt: new Date() })
      .where(and(eq(documents.organizationId, organizationId), inArray(documents.id, documentIds)));

    return {
      success: true,
      processed: documentIds.length,
      failed: 0,
    };
  } catch (error) {
    logger.error("Error in bulk move", { error, documentIds });
    return {
      success: false,
      processed: 0,
      failed: documentIds.length,
      errors: [{ id: "bulk", error: "Bulk move failed" }],
    };
  }
}

/**
 * Bulk update document tags
 */
export async function bulkUpdateTags(
  documentIds: string[],
  tags: string[],
  operation: "add" | "remove" | "replace",
  organizationId: string,
): Promise<BulkOperationResult> {
  try {
    if (operation === "replace") {
      await db
        .update(documents)
        .set({ tags, updatedAt: new Date() })
        .where(and(eq(documents.organizationId, organizationId), inArray(documents.id, documentIds)));
    } else {
      // For add/remove, would need more complex SQL
      // This is a simplified version
      const docs = await db
        .select()
        .from(documents)
        .where(and(eq(documents.organizationId, organizationId), inArray(documents.id, documentIds)));

      for (const doc of docs) {
        const currentTags = doc.tags || [];
        let newTags: string[];

        if (operation === "add") {
          newTags = Array.from(new Set([...currentTags, ...tags]));
        } else {
          newTags = currentTags.filter((t) => !tags.includes(t));
        }

        await updateDocument(doc.id, { tags: newTags });
      }
    }

    return {
      success: true,
      processed: documentIds.length,
      failed: 0,
    };
  } catch (error) {
    logger.error("Error in bulk tag update", { error, documentIds, operation });
    return {
      success: false,
      processed: 0,
      failed: documentIds.length,
      errors: [{ id: "bulk", error: "Bulk tag update failed" }],
    };
  }
}

/**
 * Bulk delete documents
 */
export async function bulkDeleteDocuments(documentIds: string[], organizationId: string): Promise<BulkOperationResult> {
  try {
    const docs = await db
      .select({ id: documents.id, metadata: documents.metadata })
      .from(documents)
      .where(and(eq(documents.organizationId, organizationId), inArray(documents.id, documentIds)));

    const blocked = docs
      .map((doc) => ({ id: doc.id, reason: getDocumentMutabilityBlockReason({ metadata: doc.metadata }) }))
      .filter((item): item is { id: string; reason: string } => Boolean(item.reason));

    const allowedDocumentIds = docs
      .filter((doc) => !blocked.some((item) => item.id === doc.id))
      .map((doc) => doc.id);

    if (allowedDocumentIds.length > 0) {
      await db
        .update(documents)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(documents.organizationId, organizationId), inArray(documents.id, allowedDocumentIds)));
    }

    if (blocked.length > 0) {
      return {
        success: false,
        processed: allowedDocumentIds.length,
        failed: blocked.length,
        errors: blocked.map((item) => ({
          id: item.id,
          error: `Delete blocked: ${item.reason}`,
        })),
      };
    }

    return {
      success: true,
      processed: allowedDocumentIds.length,
      failed: 0,
    };
  } catch (error) {
    logger.error("Error in bulk delete", { error, documentIds });
    return {
      success: false,
      processed: 0,
      failed: documentIds.length,
      errors: [{ id: "bulk", error: "Bulk delete failed" }],
    };
  }
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get document statistics
 */
export async function getDocumentStatistics(organizationId: string): Promise<{
  total: number;
  byCategory: Record<string, number>;
  byFileType: Record<string, number>;
  totalSize: number;
  confidential: number;
}> {
  try {
    const docs = await db
      .select()
      .from(documents)
      .where(and(eq(documents.organizationId, organizationId), sql`${documents.deletedAt} IS NULL`));

    const byCategory: Record<string, number> = {};
    const byFileType: Record<string, number> = {};
    let totalSize = 0;
    let confidential = 0;

    docs.forEach((doc) => {
      if (doc.category) {
        byCategory[doc.category] = (byCategory[doc.category] || 0) + 1;
      }
      byFileType[doc.fileType] = (byFileType[doc.fileType] || 0) + 1;
      totalSize += doc.fileSize || 0;
      if (doc.isConfidential) confidential++;
    });

    return {
      total: docs.length,
      byCategory,
      byFileType,
      totalSize,
      confidential,
    };
  } catch (error) {
    logger.error("Error getting document statistics", { error, organizationId });
    throw new Error("Failed to get document statistics");
  }
}

