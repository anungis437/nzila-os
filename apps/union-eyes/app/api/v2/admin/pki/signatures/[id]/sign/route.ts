/**
 * POST /api/admin/pki/signatures/[id]/sign
 * Migrated to withApi() framework
 */

import { withApi, z } from '@/lib/api/framework';

const _adminPkiSignaturesSignSchema = z.object({
  documentType: z.unknown().optional(),
  documentUrl: z.string().url('Invalid URL'),
  userName: z.string().min(1, 'userName is required'),
  userTitle: z.string().min(1, 'userTitle is required'),
  userEmail: z.string().email('Invalid email address'),
  workflowId: z.string().uuid('Invalid workflowId'),
});

import { POST as v1POST } from '@/app/api/admin/pki/signatures/[id]/sign/route';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'president' as const },
    openapi: {
      tags: ['Admin'],
      summary: 'POST sign',
    },
  },
  async ({ request, params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1POST(request, { params: params as { id: string } });
    return response;
  },
);
