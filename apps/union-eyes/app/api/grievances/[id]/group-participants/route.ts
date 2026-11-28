/**
 * GET  /api/grievances/{id}/group-participants — a group grievance's participants (withdrawn ones kept), and whether it is ready
 *      to file: at least two consenting participants, all in one portion of the employer administration
 * POST /api/grievances/{id}/group-participants — record one member's own consent (form and evidence) to join the group matter;
 *      a member from another portion of the employer administration is refused (409)
 *
 * The authority kernel decides per grievance (case:read_internal / case:transition). A grievance the caller cannot read answers 404.
 */
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { addGroupParticipant, ParticipantInputSchema, readGroupParticipants } from '@/lib/representation-workflows/service';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true }, entitlement: 'grievance_case_suite', openapi: { tags: ['Grievances'], summary: 'List group grievance participants and filing readiness' } },
  async ({ organizationId, userId, params }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
    if (!zUUID.safeParse(params.id).success) throw ApiError.notFound('Grievance');
    return { data: await readGroupParticipants({ organizationId, userId }, params.id) };
  },
);

export const POST = withApi(
  { auth: { required: true }, entitlement: 'grievance_case_suite', body: ParticipantInputSchema, openapi: { tags: ['Grievances'], summary: 'Record a group grievance participant consent' } },
  async ({ organizationId, userId, params, body }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
    if (!zUUID.safeParse(params.id).success) throw ApiError.notFound('Grievance');
    return { data: await addGroupParticipant({ organizationId, userId }, params.id, body) };
  },
);
