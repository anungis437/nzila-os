import { NextResponse } from 'next/server';
/**
 * GET POST /api/documents/folders
 * Migrated to withApi() framework
 */
import { logApiAuditEvent } from "@/lib/middleware/api-security";
import { getFolderTree, listFolders } from "@/lib/services/document-service";
 
 
 
 
 
 
 
 
 
import { withApi, ApiError, z } from '@/lib/api/framework';

const createFolderSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  name: z.string().min(1, 'Folder name is required'),
  description: z.string().optional().nullable(),
  parentFolderId: z.string().uuid().optional().nullable(),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Documents'],
      summary: 'GET folders',
    },
  },
  async ({ request, userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {

            const { searchParams } = new URL(request.url);
            const requestOrgId = searchParams.get("organizationId") ?? searchParams.get("orgId") ?? searchParams.get("organization_id") ?? searchParams.get("org_id") ?? searchParams.get("unionId") ?? searchParams.get("union_id") ?? searchParams.get("localId") ?? searchParams.get("local_id");
            const organizationIdParam = requestOrgId;
            if (!organizationIdParam) {
              logApiAuditEvent({
                timestamp: new Date().toISOString(), userId: userId ?? undefined,
                endpoint: '/api/documents/folders',
                method: 'GET',
                eventType: 'validation_failed',
                severity: 'low',
                details: { reason: 'Missing organizationId parameter' },
              });
              throw ApiError.internal('organizationId is required'
        );
            }
            const tree = searchParams.get("tree") === "true";
            if (tree) {
              const folderTree = await getFolderTree(organizationIdParam);
              logApiAuditEvent({
                timestamp: new Date().toISOString(), userId: userId ?? undefined,
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
              timestamp: new Date().toISOString(), userId: userId ?? undefined,
              endpoint: '/api/documents/folders',
              method: 'GET',
              eventType: 'success',
              severity: 'low',
              details: { organizationId: organizationIdParam, mode: 'list', folderCount: folders?.length || 0, hasParentFilter: !!parentFolderId },
            });
            return NextResponse.json({ folders });
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    body: createFolderSchema,
    openapi: {
      tags: ['Documents'],
      summary: 'POST folders',
    },
    successStatus: 201,
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body, query: _query }) => {

        // body is already parsed and validated by withApi
        return body;
  },
);
