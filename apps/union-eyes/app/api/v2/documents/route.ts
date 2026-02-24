/**
 * GET POST /api/documents
 * Migrated to withApi() framework
 */
import { logApiAuditEvent } from "@/lib/middleware/api-security";
import { withApi, ApiError, z } from '@/lib/api/framework';
 
 
 
 
 
 
 
 
import {
  listDocuments,
  searchDocuments,
  getDocumentStatistics,
} from '@/lib/services/document-service';

const createDocumentSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  folderId: z.string().uuid().optional().nullable(),
  name: z.string().min(1, 'Name is required'),
  fileUrl: z.string().url('Invalid file URL'),
  fileSize: z.number().optional().nullable(),
  fileType: z.string().min(1, 'File type is required'),
  mimeType: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  category: z.string().optional().nullable(),
  contentText: z.string().optional().nullable(),
  isConfidential: z.boolean().optional().default(false),
  accessLevel: z.enum(['standard', 'restricted', 'confidential']).optional().default('standard'),
  metadata: z.record(z.any()).optional().default({}),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Documents'],
      summary: 'GET documents',
    },
  },
  async ({ request, userId, organizationId, user: _user, body: _body, query: _query }) => {

        const { searchParams } = new URL(request.url);
        const requestOrgId = searchParams.get("organizationId") ?? searchParams.get("orgId") ?? searchParams.get("organization_id") ?? searchParams.get("org_id") ?? searchParams.get("unionId") ?? searchParams.get("union_id") ?? searchParams.get("localId") ?? searchParams.get("local_id");
        const organizationIdParam = requestOrgId;
        if (!organizationIdParam) {
          logApiAuditEvent({
            timestamp: new Date().toISOString(), 
            userId: userId ?? undefined,
            endpoint: '/api/documents',
            method: 'GET',
            eventType: 'validation_failed',
            severity: 'low',
            details: { reason: 'organizationId is required' },
          });
          throw ApiError.internal('organizationId is required'
          );
        }
        // Verify organization ID matches context
        if (organizationIdParam !== organizationId) {
          logApiAuditEvent({
            timestamp: new Date().toISOString(),
            userId: userId ?? undefined,
            endpoint: '/api/documents',
            method: 'GET',
            eventType: 'auth_failed',
            severity: 'high',
            details: { reason: 'Organization ID mismatch' },
          });
          throw ApiError.forbidden('You do not have access to this organization\'s documents'
          );
        }
        // Check for special modes
        const statistics = searchParams.get("statistics") === "true";
        const search = searchParams.get("search") === "true";
        // Return statistics
        if (statistics) {
          const stats = await getDocumentStatistics(organizationIdParam);
          logApiAuditEvent({
            timestamp: new Date().toISOString(), 
            userId: userId ?? undefined,
            endpoint: '/api/documents',
            method: 'GET',
            eventType: 'success',
            severity: 'low',
            details: { organizationId: organizationIdParam, mode: 'statistics' },
          });
          return stats;
        }
        // Advanced search mode
        if (search) {
          const searchQuery = searchParams.get("searchQuery") || "";
          const filters: Record<string, unknown> = {};
          const category = searchParams.get("category");
          if (category) filters.category = category;
          const fileType = searchParams.get("fileType");
          if (fileType) filters.fileType = fileType;
          const uploadedBy = searchParams.get("uploadedBy");
          if (uploadedBy) filters.uploadedBy = uploadedBy;
          const tags = searchParams.get("tags");
          if (tags) filters.tags = tags.split(",");
          const page = parseInt(searchParams.get("page") || "1");
          const limit = parseInt(searchParams.get("limit") || "50");
          const results = await searchDocuments(organizationIdParam, searchQuery, filters, { page, limit });
          logApiAuditEvent({
            timestamp: new Date().toISOString(), 
            userId: userId ?? undefined,
            endpoint: '/api/documents',
            method: 'GET',
            eventType: 'success',
            severity: 'low',
            details: { organizationId: organizationIdParam, mode: 'search', searchQuery, resultCount: results.documents?.length || 0 },
          });
          return results;
        }
        // Build filters
        const filters: Record<string, unknown> = { organizationId: organizationIdParam };
        const folderId = searchParams.get("folderId");
        if (folderId) filters.folderId = folderId;
        const category = searchParams.get("category");
        if (category) filters.category = category;
        const tags = searchParams.get("tags");
        if (tags) filters.tags = tags.split(",");
        const fileType = searchParams.get("fileType");
        if (fileType) filters.fileType = fileType;
        const uploadedBy = searchParams.get("uploadedBy");
        if (uploadedBy) filters.uploadedBy = uploadedBy;
        const searchQuery = searchParams.get("searchQuery");
        if (searchQuery) filters.searchQuery = searchQuery;
        // Pagination
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const sortBy = searchParams.get("sortBy") || "uploadedAt";
        const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";
        const result = await listDocuments(filters, { page, limit, sortBy, sortOrder });
        logApiAuditEvent({
          timestamp: new Date().toISOString(), 
          userId: userId ?? undefined,
          endpoint: '/api/documents',
          method: 'GET',
          eventType: 'success',
          severity: 'low',
          details: { organizationId: organizationIdParam, filters, resultCount: result.documents?.length || 0 },
        });
        return result;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    body: createDocumentSchema,
    openapi: {
      tags: ['Documents'],
      summary: 'POST documents',
    },
    successStatus: 201,
  },
  async ({ request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {

        const rawBody = await request.json();
        return rawBody;
  },
);
