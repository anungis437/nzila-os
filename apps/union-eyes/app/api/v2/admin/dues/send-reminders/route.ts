/**
 * POST /api/admin/dues/send-reminders
 * Migrated to withApi() framework
 */

import { withApi } from '@/lib/api/framework';

import { POST as v1POST } from '@/app/api/admin/dues/send-reminders/route';

export const POST = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Admin'],
      summary: 'POST send-reminders',
    },
  },
  async ({ request, params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1POST(request, { params: params as Record<string, unknown> });
    return response;
  },
);
