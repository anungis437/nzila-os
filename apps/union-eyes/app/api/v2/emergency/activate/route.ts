/**
 * POST /api/emergency/activate
 * Migrated to withApi() framework
 */
import { withApi, z } from '@/lib/api/framework';

const _emergencyActivationSchema = z.object({
  memberId: z.string().uuid(),
  emergencyType: z.string().min(1),
  affectedRegions: z.array(z.string().min(1)).min(1),
  description: z.string().optional(),
  expectedDurationDays: z.number().int().positive().max(365),
});

import { POST as v1POST } from '@/app/api/emergency/activate/route';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' as const },
    openapi: {
      tags: ['Emergency'],
      summary: 'POST activate',
    },
  },
  async ({ request, params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1POST(request, { params: params as Record<string, unknown> });
    return response;
  },
);
