/**
 * Document Bulk Operations API Route
 * POST /api/documents/bulk - Perform bulk operations on documents
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { logApiAuditEvent } from "@/lib/middleware/api-security";
import { 
  bulkMoveDocuments,
  bulkUpdateTags,
  bulkDeleteDocuments,
  bulkProcessOCR
} from "@/lib/services/document-service";
import { withRoleAuth } from '@/lib/api-auth-guard';

 
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
/**
 * Validation schemas for bulk operations
 */
const bulkMoveSchema = z.object({
  operation: z.literal('move'),
  documentIds: z.array(z.string().uuid()).min(1, 'At least one document ID is required'),
  targetFolderId: z.string().uuid().nullable(),
});

const bulkTagSchema = z.object({
  operation: z.literal('tag'),
  documentIds: z.array(z.string().uuid()).min(1, 'At least one document ID is required'),
  tags: z.array(z.string()).min(1, 'At least one tag is required'),
  tagOperation: z.enum(['add', 'remove', 'replace']),
});

const bulkDeleteSchema = z.object({
  operation: z.literal('delete'),
  documentIds: z.array(z.string().uuid()).min(1, 'At least one document ID is required'),
});

const bulkOCRSchema = z.object({
  operation: z.literal('ocr'),
  documentIds: z.array(z.string().uuid()).min(1, 'At least one document ID is required'),
});

const bulkOperationSchema = z.discriminatedUnion('operation', [
  bulkMoveSchema,
  bulkTagSchema,
  bulkDeleteSchema,
  bulkOCRSchema,
]);

/**
 * POST /api/documents/bulk
 * Perform bulk operations on documents
 * 
 * Body:
 * - operation: "move" | "tag" | "delete" | "ocr" (required)
 * - documentIds: string[] (required)
 * - targetFolderId: string (for move operation)
 * - tags: string[] (for tag operation)
 * - tagOperation: "add" | "remove" | "replace" (for tag operation)
 */
export const POST = withRoleAuth('steward', async (request, context) => {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (error) {
    return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid JSON in request body',
      error
    );
  }

  const parsed = bulkOperationSchema.safeParse(rawBody);
  if (!parsed.success) {
    return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid request body',
      parsed.error
    );
  }

  const body = parsed.data;
  const { userId, organizationId: _organizationId } = context as { userId: string; organizationId: string };

  const orgId = (body as Record<string, unknown>)["organizationId"] ?? (body as Record<string, unknown>)["orgId"] ?? (body as Record<string, unknown>)["organization_id"] ?? (body as Record<string, unknown>)["org_id"] ?? (body as Record<string, unknown>)["unionId"] ?? (body as Record<string, unknown>)["union_id"] ?? (body as Record<string, unknown>)["localId"] ?? (body as Record<string, unknown>)["local_id"];
  if (typeof orgId === 'string' && orgId.length > 0 && orgId !== context.organizationId) {
    return standardErrorResponse(
      ErrorCode.FORBIDDEN,
      'Forbidden'
    );
  }

try {
      let result;

      switch (body.operation) {
        case "move":
          result = await bulkMoveDocuments(body.documentIds, body.targetFolderId);
          logApiAuditEvent({
            timestamp: new Date().toISOString(), userId,
            endpoint: '/api/documents/bulk',
            method: 'POST',
            eventType: 'success',
            severity: 'medium',
            details: { operation: 'move', documentCount: body.documentIds.length, targetFolderId: body.targetFolderId },
          });
          break;

        case "tag":
          result = await bulkUpdateTags(body.documentIds, body.tags, body.tagOperation);
          logApiAuditEvent({
            timestamp: new Date().toISOString(), userId,
            endpoint: '/api/documents/bulk',
            method: 'POST',
            eventType: 'success',
            severity: 'medium',
            details: { operation: 'tag', documentCount: body.documentIds.length, tagCount: body.tags.length, tagOperation: body.tagOperation },
          });
          break;

        case "delete":
          result = await bulkDeleteDocuments(body.documentIds);
          logApiAuditEvent({
            timestamp: new Date().toISOString(), userId,
            endpoint: '/api/documents/bulk',
            method: 'POST',
            eventType: 'success',
            severity: 'high',
            details: { operation: 'delete', documentCount: body.documentIds.length },
          });
          break;

        case "ocr":
          result = await bulkProcessOCR(body.documentIds);
          logApiAuditEvent({
            timestamp: new Date().toISOString(), userId,
            endpoint: '/api/documents/bulk',
            method: 'POST',
            eventType: 'success',
            severity: 'medium',
            details: { operation: 'ocr', documentCount: body.documentIds.length },
          });
          break;
      }

      return NextResponse.json(result);
    } catch (error) {
      logApiAuditEvent({
        timestamp: new Date().toISOString(), userId,
        endpoint: '/api/documents/bulk',
        method: 'POST',
        eventType: 'validation_failed',
        severity: 'high',
        details: { operation: body.operation, error: error instanceof Error ? error.message : 'Unknown error' },
      });
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to perform bulk operation',
      error
    );
    }
});

