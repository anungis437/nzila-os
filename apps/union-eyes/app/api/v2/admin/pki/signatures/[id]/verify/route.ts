/**
 * POST /api/admin/pki/signatures/[id]/verify
 * Migrated to withApi() framework
 */
import { verifySignature, verifyDocumentIntegrity } from '@/services/pki/verification-service';
 
 
 
 
 
import { withApi, z } from '@/lib/api/framework';

const adminPkiSignaturesVerifySchema = z.object({
  verifyType: z.unknown().optional(),
  documentContent: z.unknown().optional(),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'president' as const },
    body: adminPkiSignaturesVerifySchema,
    openapi: {
      tags: ['Admin'],
      summary: 'POST verify',
    },
    successStatus: 201,
  },
  async ({ request: _request, params, userId: _userId, organizationId: _organizationId, user: _user, body, query: _query }) => {

          const { verifyType, documentContent } = body;
          const signatureOrDocumentId = params.id;
          // Determine verification type
          if (verifyType === 'document') {
            // Verify entire document integrity
            const result = await verifyDocumentIntegrity(
              signatureOrDocumentId,
              documentContent ? Buffer.from(String(documentContent), 'base64') : undefined
            );
            return { verification: result, };
          } else {
            // Verify single signature (default)
            const result = await verifySignature(
              signatureOrDocumentId,
              documentContent ? Buffer.from(String(documentContent), 'base64') : undefined
            );
            return { verification: result, };
          }
  },
);
