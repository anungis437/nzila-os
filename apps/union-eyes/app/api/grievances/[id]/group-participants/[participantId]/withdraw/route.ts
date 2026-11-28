/**
 * POST /api/grievances/{id}/group-participants/{participantId}/withdraw — record one participant's withdrawal. The group matter,
 * the other participants and this participant's consent history stay intact. The authority kernel decides (case:transition).
 */
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { withdrawGroupParticipant, WithdrawalInputSchema } from '@/lib/representation-workflows/service';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  { auth: { required: true }, entitlement: 'grievance_case_suite', body: WithdrawalInputSchema, openapi: { tags: ['Grievances'], summary: 'Record a group grievance participant withdrawal' } },
  async ({ organizationId, userId, params, body }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
    if (!zUUID.safeParse(params.id).success || !zUUID.safeParse(params.participantId).success) throw ApiError.notFound('Active participant');
    return { data: await withdrawGroupParticipant({ organizationId, userId }, params.id, params.participantId, body) };
  },
);
