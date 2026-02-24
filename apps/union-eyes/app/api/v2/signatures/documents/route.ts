/**
 * GET POST /api/signatures/documents
 * Migrated to withApi() framework
 */
import { SignatureService } from "@/lib/signature/signature-service";

 
 
 
 
 
 
 
 
import { withApi, ApiError } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Signatures'],
      summary: 'GET documents',
    },
  },
  async ({ request, userId: _userId, organizationId: _organizationId, user, body: _body, query: _query }) => {

        if (!user || !user.id) {
          throw ApiError.unauthorized('Unauthorized'
        );
        }
        const { searchParams } = new URL(request.url);
        const queryOrgId = searchParams.get("organizationId");
        if (!queryOrgId) {
          throw ApiError.internal('Organization ID required'
        );
        }
        const documents = await SignatureService.getUserDocuments( user.id,
          queryOrgId
        );
        return documents;
  },
);

export const POST = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Signatures'],
      summary: 'POST documents',
    },
    successStatus: 201,
  },
  async ({ request, userId: _userId, organizationId: _organizationId, user, body: _body, query: _query }) => {

        if (!user || !user.id) {
          throw ApiError.unauthorized('Unauthorized'
        );
        }
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const title = formData.get("title") as string;
        const description = formData.get("description") as string;
        const documentType = formData.get("documentType") as string;
        const formOrgId = formData.get("organizationId") as string;
        const signersJson = formData.get("signers") as string;
        const provider = formData.get("provider") as string | null;
        const expirationDays = formData.get("expirationDays") as string;
        const requireAuthentication = formData.get("requireAuthentication") as string;
        const sequentialSigning = formData.get("sequentialSigning") as string;
        if (!file || !title || !formOrgId || !signersJson) {
          throw ApiError.badRequest('Missing required fields'
        );
        }
        const signers = JSON.parse(signersJson);
        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        // Create signature request
        const document = await SignatureService.createSignatureRequest({
          organizationId: formOrgId,
          title,
          description,
          documentType: documentType || "contract",
          file: buffer,
          fileName: file.name,
          sentBy: user.id,
          signers,
          provider: (provider as "docusign" | "hellosign" | "internal") || undefined,
          expirationDays: expirationDays ? parseInt(expirationDays) : undefined,
          requireAuthentication: requireAuthentication === "true",
          sequentialSigning: sequentialSigning === "true",
        });
        return { document: {
            id: document.id,
            title: document.title,
            status: document.status,
            createdAt: document.createdAt,
          }, };
  },
);
