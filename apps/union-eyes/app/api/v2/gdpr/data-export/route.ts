/**
 * GET POST /api/gdpr/data-export
 * Migrated to withApi() framework
 */

import { withApi, z } from '@/lib/api/framework';

const _gdprDataExportSchema = z.object({
  organizationId: z.string().uuid('Invalid organizationId'),
  preferredFormat: z.unknown().optional(),
  requestDetails: z.unknown().optional(),
});

import { GET as v1GET, POST as v1POST } from '@/app/api/gdpr/data-export/route';

export const GET = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Gdpr'],
      summary: 'GET data-export',
    },
  },
  async ({ request, params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1GET(request, { params: params as Record<string, unknown> });
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Gdpr'],
      summary: 'POST data-export',
    },
  },
  async ({ request, params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1POST(request, { params: params as Record<string, unknown> });
    return response;
  },
);
