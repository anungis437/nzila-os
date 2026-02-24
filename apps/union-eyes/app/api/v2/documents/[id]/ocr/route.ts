/**
 * POST /api/documents/[id]/ocr
 * Migrated to withApi() framework
 */
import { logApiAuditEvent } from "@/lib/middleware/api-security";
import { processDocumentOCR } from "@/lib/services/document-service";
 
 
 
 
 
import { withApi } from '@/lib/api/framework';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Documents'],
      summary: 'POST ocr',
    },
    successStatus: 201,
  },
  async ({ request: _request, params, userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {

            const result = await processDocumentOCR(params.id) as unknown as Record<string, unknown>;
            logApiAuditEvent({
              timestamp: new Date().toISOString(), userId: userId ?? undefined,
              endpoint: `/api/documents/${params.id}/ocr`,
              method: 'POST',
              eventType: 'success',
              severity: 'medium',
              details: { documentId: params.id },
            });
            return result;
  },
);
