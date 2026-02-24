/**
 * Document Folders API Routes
 * GET /api/documents/folders - List folders
 * POST /api/documents/folders - Create folder
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { logApiAuditEvent } from "@/lib/middleware/api-security";
import { 
  listFolders, 
  createFolder,
  getFolderTree
} from "@/lib/services/document-service";
import { withRoleAuth } from '@/lib/api-auth-guard';

 
 
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
/**
 * Validation schema for creating folders
 */
const createFolderSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  name: z.string().min(1, 'Folder name is required'),
  description: z.string().optional().nullable(),
  parentFolderId: z.string().uuid().optional().nullable(),
});

/**
 * GET /api/documents/folders
 * List folders or get folder tree
 * 
 * Query params:
 * - organizationId: string (required)
 * - parentFolderId: string (optional, use "root" for root folders)
 * - tree: boolean - return full folder tree structure
 */
export const GET = withRoleAuth('member', async (request, context) => {
    const { userId, organizationId: _organizationId } = context as { userId: string; organizationId: string };

  try {
        const { searchParams } = new URL(request.url);
        
        const requestOrgId = searchParams.get("organizationId") ?? searchParams.get("orgId") ?? searchParams.get("organization_id") ?? searchParams.get("org_id") ?? searchParams.get("unionId") ?? searchParams.get("union_id") ?? searchParams.get("localId") ?? searchParams.get("local_id");
        
        const organizationIdParam = requestOrgId;
        if (!organizationIdParam) {
          logApiAuditEvent({
            timestamp: new Date().toISOString(), userId,
            endpoint: '/api/documents/folders',
            method: 'GET',
            eventType: 'validation_failed',
            severity: 'low',
            details: { reason: 'Missing organizationId parameter' },
          });
          return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'organizationId is required'
    );
        }

        const tree = searchParams.get("tree") === "true";

        if (tree) {
          const folderTree = await getFolderTree(organizationIdParam);
          logApiAuditEvent({
            timestamp: new Date().toISOString(), userId,
            endpoint: '/api/documents/folders',
            method: 'GET',
            eventType: 'success',
            severity: 'low',
            details: { organizationId: organizationIdParam, mode: 'tree', treeSize: JSON.stringify(folderTree || []).length },
          });
          return NextResponse.json({ folders: folderTree });
        }

        const parentFolderId = searchParams.get("parentFolderId");
        const folders = await listFolders(
          organizationIdParam, 
          parentFolderId === "root" ? null : parentFolderId || undefined
        );
        
        logApiAuditEvent({
          timestamp: new Date().toISOString(), userId,
          endpoint: '/api/documents/folders',
          method: 'GET',
          eventType: 'success',
          severity: 'low',
          details: { organizationId: organizationIdParam, mode: 'list', folderCount: folders?.length || 0, hasParentFilter: !!parentFolderId },
        });

        return NextResponse.json({ folders });
      } catch (error) {
        logApiAuditEvent({
          timestamp: new Date().toISOString(), userId,
          endpoint: '/api/documents/folders',
          method: 'GET',
          eventType: 'validation_failed',
          severity: 'high',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        });
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to list folders',
      error
    );
      }
});

/**
 * POST /api/documents/folders
 * Create a new folder
 * 
 * Body:
 * - organizationId: string (required)
 * - name: string (required)
 * - description: string
 * - parentFolderId: string
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

  const parsed = createFolderSchema.safeParse(rawBody);
  if (!parsed.success) {
    return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid request body',
      parsed.error
    );
  }

  const body = parsed.data;
  const { userId, organizationId: _organizationId } = context as { userId: string; organizationId: string };

  if (body.organizationId !== context.organizationId) {
    return standardErrorResponse(
      ErrorCode.FORBIDDEN,
      'Forbidden'
    );
  }

try {
      const folder = await createFolder({
        organizationId: body.organizationId,
        name: body.name,
        description: body.description || null,
        parentFolderId: body.parentFolderId || null,
        createdBy: userId,
      });

      logApiAuditEvent({
        timestamp: new Date().toISOString(), userId,
        endpoint: '/api/documents/folders',
        method: 'POST',
        eventType: 'success',
        severity: 'medium',
        details: { 
          folderName: body.name,
          organizationId: body.organizationId,
          hasParent: !!body.parentFolderId,
        },
      });

      return NextResponse.json(folder, { status: 201 });
    } catch (error) {
      logApiAuditEvent({
        timestamp: new Date().toISOString(), userId,
        endpoint: '/api/documents/folders',
        method: 'POST',
        eventType: 'validation_failed',
        severity: 'high',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to create folder',
      error
    );
    }
});

