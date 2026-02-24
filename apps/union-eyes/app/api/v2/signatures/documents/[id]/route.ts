/**
 * GET PATCH /api/signatures/documents/[id]
 * Migrated to withApi() framework
 */
import { SignatureService } from "@/lib/signature/signature-service";

 
 
 
 
 
 
 
 
 
import { withApi, ApiError, z } from '@/lib/api/framework';

const signaturesDocumentsSchema = z.object({
  action: z.unknown().optional(),
  reason: z.string().min(1, 'reason is required'),
});

export const GET = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Signatures'],
      summary: 'GET [id]',
    },
  },
  async ({ request: _request, params, userId: _userId, organizationId: _organizationId, user, body: _body, query: _query }) => {

        if (!user || !user.id) {
          throw ApiError.unauthorized('Unauthorized'
        );
        }
        const documentId = params.id;
        // SECURITY FIX: Verify user has access to this document (prevent IDOR)
        const hasAccess = await SignatureService.verifyDocumentAccess(documentId, user.id);
        if (!hasAccess) {
          throw ApiError.forbidden('Access denied'
        );
        }
        const document = await SignatureService.getDocumentStatus(documentId);
        return document;
  },
);

export const PATCH = withApi(
  {
    auth: { required: true },
    body: signaturesDocumentsSchema,
    openapi: {
      tags: ['Signatures'],
      summary: 'PATCH [id]',
    },
  },
  async ({ request: _request, params, userId, organizationId: _organizationId, user: _user, body, query: _query }) => {

        if (!userId) {
          throw ApiError.unauthorized('Unauthorized'
        );
        }
        const documentId = params.id;
        // SECURITY FIX: Verify user has access to this document (prevent IDOR)
        const hasAccess = await SignatureService.verifyDocumentAccess(documentId, userId);
        if (!hasAccess) {
          throw ApiError.forbidden('Access denied'
        );
        }
        const { action, reason } = body;
        if (action === "void") {
          if (!reason) {
            throw ApiError.internal('Void reason required'
        );
          }
          await SignatureService.voidDocument(documentId, userId, reason);
          return { message: "Document voided successfully", };
        }
        throw ApiError.badRequest('Invalid action'
        );
  },
);
