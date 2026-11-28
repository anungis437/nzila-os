/**
 * POST /api/grievances/{id}/procedure/calculate — calculate one clock (body: { clockKey }) from the grievance's recorded facts
 * and the organization's ADOPTED rules.
 *
 * When exactly one adopted rule set governs and every input is recorded, the result is written as a SYSTEM_CALCULATED
 * grievance deadline with `calculated_due_date` and its evidence (rule set version and source, clock, holiday calendar
 * version, inputs, day-by-day trace, digest) — subject to the existing human confirmation flow. Otherwise a reviewable
 * exception is raised and no date is written: the response is 200 with `status: "exception"` because recording the exception
 * is the successful outcome of this operation, not a deadline. The authority kernel decides (case:transition).
 */
import { withApi, ApiError, zUUID, z } from '@/lib/api/framework';
import { computeGrievanceDeadline } from '@/lib/procedural-rules/grievance-procedure';
import { PROCEDURAL_ENTITLEMENT } from '@/lib/procedural-rules/route-support';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true },
    entitlement: PROCEDURAL_ENTITLEMENT,
    body: z.object({ clockKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_./-]{0,119}$/) }).strict(),
    openapi: { tags: ['Grievances'], summary: 'Calculate a procedural deadline for a grievance, or raise a reviewable exception' },
  },
  async ({ organizationId, userId, params, body }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
    if (!zUUID.safeParse(params.id).success) throw ApiError.notFound('Grievance');
    return { data: await computeGrievanceDeadline({ organizationId, userId }, params.id, body.clockKey) };
  },
);
