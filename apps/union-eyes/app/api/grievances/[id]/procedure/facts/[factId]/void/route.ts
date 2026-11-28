/**
 * POST /api/grievances/{id}/procedure/facts/{factId}/void — void a recorded procedural fact, with a reason. The fact stays as
 * history and no longer counts. The authority kernel decides (case:transition).
 */
import { withApi, ApiError, zUUID, z } from '@/lib/api/framework';
import { voidProceduralFact } from '@/lib/procedural-rules/grievance-procedure';
import { PROCEDURAL_ENTITLEMENT } from '@/lib/procedural-rules/route-support';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true },
    entitlement: PROCEDURAL_ENTITLEMENT,
    body: z.object({ reason: z.string().trim().min(5).max(1000) }).strict(),
    openapi: { tags: ['Grievances'], summary: 'Void a procedural fact' },
  },
  async ({ organizationId, userId, params, body }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
    if (!zUUID.safeParse(params.id).success || !zUUID.safeParse(params.factId).success) throw ApiError.notFound('Procedural fact');
    return { data: await voidProceduralFact({ organizationId, userId }, params.id, params.factId, body.reason) };
  },
);
