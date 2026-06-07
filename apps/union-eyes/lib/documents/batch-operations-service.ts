/**
 * Batch Operations Service - Phase 11
 * 
 * Backend service for performing bulk operations on documents.
 * Database-agnostic: Compatible with PostgreSQL (Supabase) and Azure SQL Server
 */

import { getDatabase, eq, and, inArray, isNull, getDatabaseConfig } from '@/lib/database/multi-db-client';
import { documents, documentFolders, auditLogs } from '@/db/schema';
import archiver from 'archiver';
import { Readable } from 'stream';

export interface BatchOperationProgress {
  total: number;
  completed: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export interface BatchOperationResult {
  success: boolean;
  progress: BatchOperationProgress;
  message: string;
}

/**
 * Download multiple documents as a ZIP file
 */
export async function downloadMultiple(
  documentIds: string[],
  organizationId: string,
  userId: string
): Promise<{ stream: Readable; filename: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = await getDatabase() as any;

  // Fetch all documents using Drizzle ORM
  const docs = await db
    .select({
      id: documents.id,
      name: documents.name,
      fileUrl: documents.fileUrl,
      fileType: documents.fileType,
    })
    .from(documents)
    .where(
      and(
        inArray(documents.id, documentIds),
        eq(documents.organizationId, organizationId),
        isNull(documents.deletedAt)
      )
    );

  if (!docs || docs.length === 0) {
    throw new Error('No documents found');
  }

  // Create archive
  const archive = archiver('zip', {
    zlib: { level: 9 },
  });

  // Track files added
  let filesAdded = 0;
  const fileNames = new Set<string>();

  // Add documents to archive
  for (const doc of docs) {
    try {
      if (!doc.fileUrl) {
continue;
      }

      // Fetch file content
      const response = await fetch(doc.fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Handle duplicate filenames
      let fileName = doc.name;
      let counter = 1;
      while (fileNames.has(fileName)) {
        const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
        const name = ext ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
        fileName = `${name} (${counter})${ext}`;
        counter++;
      }
      fileNames.add(fileName);

      // Add to archive
      archive.append(buffer, { name: fileName });
      filesAdded++;
    } catch (_error) {
}
  }

  if (filesAdded === 0) {
    throw new Error('No files could be added to archive');
  }

  // Finalize archive
  archive.finalize();

  // Create audit log using Drizzle ORM
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    tenantId: organizationId,
    userId,
    action: 'documents.bulk_download',
    resourceType: 'document',
    resourceIds: documentIds,
    metadata: {
      count: filesAdded,
      documentIds,
    },
    createdAt: new Date(),
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `documents_${timestamp}.zip`;

  return {
    stream: archive as Readable,
    filename,
  };
}

/**
 * Add tags to multiple documents
 */
export async function bulkTag(
  documentIds: string[],
  tagsToAdd: string[],
  organizationId: string,
  userId: string
): Promise<BatchOperationResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = await getDatabase() as any;
  const _dbConfig = getDatabaseConfig();

  const progress: BatchOperationProgress = {
    total: documentIds.length,
    completed: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Fetch existing documents with current tags
    const docs = await db
      .select({
        id: documents.id,
        tags: documents.tags,
      })
      .from(documents)
      .where(
        and(
          inArray(documents.id, documentIds),
          eq(documents.organizationId, organizationId),
          isNull(documents.deletedAt)
        )
      );

    // Update each document
    for (const doc of docs) {
      try {
        // Merge existing tags with new tags (remove duplicates)
        const existingTags = doc.tags || [];
        const mergedTags = Array.from(new Set([...existingTags, ...tagsToAdd]));

        // Update document using Drizzle ORM
        await db
          .update(documents)
          .set({
            tags: mergedTags,
            updatedAt: new Date(),
          })
          .where(eq(documents.id, doc.id));

        progress.completed++;
      } catch (error) {
        progress.failed++;
        progress.errors.push({
          id: doc.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Create audit log
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      tenantId: organizationId,
      userId,
      action: 'documents.bulk_tag',
      resourceType: 'document',
      resourceIds: documentIds,
      metadata: {
        tags: tagsToAdd,
        completed: progress.completed,
        failed: progress.failed,
      },
      createdAt: new Date(),
    });

    return {
      success: progress.failed === 0,
      progress,
      message: `Tagged ${progress.completed} of ${progress.total} documents`,
    };
  } catch (error) {
    throw new Error(`Bulk tag operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Soft delete multiple documents
 */
export async function bulkDelete(
  documentIds: string[],
  organizationId: string,
  userId: string,
  userRole: string
): Promise<BatchOperationResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = await getDatabase() as any;

  const progress: BatchOperationProgress = {
    total: documentIds.length,
    completed: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Fetch documents to check permissions
    const docs = await db
      .select({
        id: documents.id,
        uploadedBy: documents.uploadedBy,
      })
      .from(documents)
      .where(
        and(
          inArray(documents.id, documentIds),
          eq(documents.organizationId, organizationId),
          isNull(documents.deletedAt)
        )
      );

    // Check permissions and delete
    for (const doc of docs) {
      try {
        // Only admins and union leaders can delete any document
        // Regular users can only delete their own documents
        const canDelete = 
          userRole === 'admin' ||
          userRole === 'union_leader' ||
          doc.uploadedBy === userId;

        if (!canDelete) {
          progress.failed++;
          progress.errors.push({
            id: doc.id,
            error: 'Insufficient permissions to delete this document',
          });
          continue;
        }

        // Soft delete
        await db
          .update(documents)
          .set({
            deletedAt: new Date(),
            deletedBy: userId,
            updatedAt: new Date(),
          })
          .where(eq(documents.id, doc.id));

        progress.completed++;
      } catch (error) {
        progress.failed++;
        progress.errors.push({
          id: doc.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Create audit log
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      tenantId: organizationId,
      userId,
      action: 'documents.bulk_delete',
      resourceType: 'document',
      resourceIds: documentIds,
      metadata: {
        completed: progress.completed,
        failed: progress.failed,
      },
      createdAt: new Date(),
    });

    return {
      success: progress.failed === 0,
      progress,
      message: `Deleted ${progress.completed} of ${progress.total} documents`,
    };
  } catch (error) {
    throw new Error(`Bulk delete operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Move multiple documents to a folder
 */
export async function moveToFolder(
  documentIds: string[],
  folderId: string | null,
  organizationId: string,
  userId: string
): Promise<BatchOperationResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = await getDatabase() as any;

  const progress: BatchOperationProgress = {
    total: documentIds.length,
    completed: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Validate folder exists if folderId is provided
    if (folderId) {
      const folder = await db
        .select({ id: documentFolders.id })
        .from(documentFolders)
        .where(
          and(
            eq(documentFolders.id, folderId),
            eq(documentFolders.organizationId, organizationId),
            isNull(documentFolders.deletedAt)
          )
        )
        .limit(1);

      if (!folder || folder.length === 0) {
        throw new Error('Target folder not found');
      }
    }

    // Fetch documents
    const docs = await db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          inArray(documents.id, documentIds),
          eq(documents.organizationId, organizationId),
          isNull(documents.deletedAt)
        )
      );

    // Move each document
    for (const doc of docs) {
      try {
        await db
          .update(documents)
          .set({
            folderId,
            updatedAt: new Date(),
          })
          .where(eq(documents.id, doc.id));

        progress.completed++;
      } catch (error) {
        progress.failed++;
        progress.errors.push({
          id: doc.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Create audit log
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      tenantId: organizationId,
      userId,
      action: 'documents.bulk_move',
      resourceType: 'document',
      resourceIds: documentIds,
      metadata: {
        folderId,
        completed: progress.completed,
        failed: progress.failed,
      },
      createdAt: new Date(),
    });

    return {
      success: progress.failed === 0,
      progress,
      message: `Moved ${progress.completed} of ${progress.total} documents`,
    };
  } catch (error) {
    throw new Error(`Bulk move operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Copy multiple documents
 */
export async function bulkCopy(
  documentIds: string[],
  destinationFolderId: string | null,
  organizationId: string,
  userId: string
): Promise<BatchOperationResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = await getDatabase() as any;

  const progress: BatchOperationProgress = {
    total: documentIds.length,
    completed: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Validate destination folder if provided
    if (destinationFolderId) {
      const folder = await db
        .select({ id: documentFolders.id })
        .from(documentFolders)
        .where(
          and(
            eq(documentFolders.id, destinationFolderId),
            eq(documentFolders.organizationId, organizationId),
            isNull(documentFolders.deletedAt)
          )
        )
        .limit(1);

      if (!folder || folder.length === 0) {
        throw new Error('Destination folder not found');
      }
    }

    // Fetch source documents
    const docs = await db
      .select({
        id: documents.id,
        name: documents.name,
        fileUrl: documents.fileUrl,
        fileType: documents.fileType,
        fileSize: documents.fileSize,
        mimeType: documents.mimeType,
        tags: documents.tags,
        metadata: documents.metadata,
        contentText: documents.contentText,
      })
      .from(documents)
      .where(
        and(
          inArray(documents.id, documentIds),
          eq(documents.organizationId, organizationId),
          isNull(documents.deletedAt)
        )
      );

    // Copy each document
    for (const doc of docs) {
      try {
        const copyName = `${doc.name} (Copy)`;
        
        await db.insert(documents).values({
          id: crypto.randomUUID(),
          organizationId,
          folderId: destinationFolderId,
          name: copyName,
          fileUrl: doc.fileUrl,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType,
          tags: doc.tags || [],
          metadata: doc.metadata || {},
          contentText: doc.contentText,
          version: 1,
          uploadedBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        progress.completed++;
      } catch (error) {
        progress.failed++;
        progress.errors.push({
          id: doc.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Create audit log
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      tenantId: organizationId,
      userId,
      action: 'documents.bulk_copy',
      resourceType: 'document',
      resourceIds: documentIds,
      metadata: {
        destinationFolderId,
        completed: progress.completed,
        failed: progress.failed,
      },
      createdAt: new Date(),
    });

    return {
      success: progress.failed === 0,
      progress,
      message: `Copied ${progress.completed} of ${progress.total} documents`,
    };
  } catch (error) {
    throw new Error(`Bulk copy operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update metadata for multiple documents
 */
export async function bulkUpdateMetadata(
  documentIds: string[],
  metadataUpdates: Record<string, unknown>,
  organizationId: string,
  userId: string
): Promise<BatchOperationResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = await getDatabase() as any;

  const progress: BatchOperationProgress = {
    total: documentIds.length,
    completed: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Fetch documents with existing metadata
    const docs = await db
      .select({
        id: documents.id,
        metadata: documents.metadata,
      })
      .from(documents)
      .where(
        and(
          inArray(documents.id, documentIds),
          eq(documents.organizationId, organizationId),
          isNull(documents.deletedAt)
        )
      );

    // Update each document
    for (const doc of docs) {
      try {
        // Merge existing metadata with updates
        const existingMetadata = doc.metadata || {};
        const mergedMetadata = {
          ...existingMetadata,
          ...metadataUpdates,
        };

        await db
          .update(documents)
          .set({
            metadata: mergedMetadata,
            updatedAt: new Date(),
          })
          .where(eq(documents.id, doc.id));

        progress.completed++;
      } catch (error) {
        progress.failed++;
        progress.errors.push({
          id: doc.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Create audit log
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      tenantId: organizationId,
      userId,
      action: 'documents.bulk_update_metadata',
      resourceType: 'document',
      resourceIds: documentIds,
      metadata: {
        updates: metadataUpdates,
        completed: progress.completed,
        failed: progress.failed,
      },
      createdAt: new Date(),
    });

    return {
      success: progress.failed === 0,
      progress,
      message: `Updated metadata for ${progress.completed} of ${progress.total} documents`,
    };
  } catch (error) {
    throw new Error(`Bulk metadata update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate document permissions
 */
export async function validateDocumentPermissions(
  documentIds: string[],
  organizationId: string,
  userId: string,
  userRole: string
): Promise<{
  hasPermission: boolean;
  deniedDocuments: string[];
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = await getDatabase() as any;

  // Admins and union leaders have access to all documents
  if (userRole === 'admin' || userRole === 'union_leader') {
    return {
      hasPermission: true,
      deniedDocuments: [],
    };
  }

  // Check ownership for regular users
  const docs = await db
    .select({
      id: documents.id,
      uploadedBy: documents.uploadedBy,
    })
    .from(documents)
    .where(
      and(
        inArray(documents.id, documentIds),
        eq(documents.organizationId, organizationId),
        isNull(documents.deletedAt)
      )
    );

  const deniedDocuments = docs
    .filter((doc: { id: string; uploadedBy: string }) => doc.uploadedBy !== userId)
    .map((doc: { id: string; uploadedBy: string }) => doc.id);

  return {
    hasPermission: deniedDocuments.length === 0,
    deniedDocuments,
  };
}

