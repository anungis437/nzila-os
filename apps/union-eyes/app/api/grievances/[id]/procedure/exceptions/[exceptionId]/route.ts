/**
 * POST /api/grievances/{id}/procedure/exceptions/{exceptionId} — record a reviewer's resolution of an open procedural
 * exception (body: { resolution }). Resolving never produces a date: a deadline decided by the reviewer is entered through the
 * case deadline route as a human-confirmed deadline. The authority kernel decides (case:transition).
 */
import { withApi, ApiError, zUUID, z } from '@/lib/api/framework';
import { resolveProceduralException } from '@/lib/procedural-rules/grievance-procedure';
import { PROCEDURAL_ENTITLEMENT } from '@/lib/procedural-rules/route-support';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true },
    entitlement: PROCEDURAL_ENTITLEMENT,
    body: z.object({ resolution: z.string().trim().min(10).max(2000) }).strict(),
    openapi: { tags: ['Grievances'], summary: 'Resolve a procedural exception' },
  },
  async ({ organizationId, userId, params, body }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
    if (!zUUID.safeParse(params.id).success || !zUUID.safeParse(params.exceptionId).success) throw ApiError.notFound('Procedural exception');
    return { data: await resolveProceduralException({ organizationId, userId }, params.id, params.exceptionId, body.resolution) };
  },
);
