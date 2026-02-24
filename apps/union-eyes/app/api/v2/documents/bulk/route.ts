/**
 * POST /api/documents/bulk
 * Migrated to withApi() framework
 */
 
 
 
 
 
import { withApi, z } from '@/lib/api/framework';

const bulkMoveSchema = z.object({
  operation: z.literal('move'),
  documentIds: z.array(z.string().uuid()).min(1, 'At least one document ID is required'),
  targetFolderId: z.string().uuid().nullable(),
});

const _bulkTagSchema = z.object({
  operation: z.literal('tag'),
  documentIds: z.array(z.string().uuid()).min(1, 'At least one document ID is required'),
  tags: z.array(z.string()).min(1, 'At least one tag is required'),
  tagOperation: z.enum(['add', 'remove', 'replace']),
});

const _bulkDeleteSchema = z.object({
  operation: z.literal('delete'),
  documentIds: z.array(z.string().uuid()).min(1, 'At least one document ID is required'),
});

const _bulkOCRSchema = z.object({
  operation: z.literal('ocr'),
  documentIds: z.array(z.string().uuid()).min(1, 'At least one document ID is required'),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    body: bulkMoveSchema,
    openapi: {
      tags: ['Documents'],
      summary: 'POST bulk',
    },
    successStatus: 201,
  },
  async ({ request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {

        const _rawBody = await request.json();
  },
);
