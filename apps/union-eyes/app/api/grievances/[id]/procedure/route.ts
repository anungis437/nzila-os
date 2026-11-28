/**
 * GET /api/grievances/{id}/procedure — the grievance's procedural binding, facts (voided ones kept as history), reviewable
 *     exceptions and procedurally calculated deadlines
 * PUT /api/grievances/{id}/procedure — record the facts rule selection reads (regime, procedural route, employer, bargaining
 *     group, classification, matter category, reference day, human determinations); supersedes the prior binding
 *
 * No role floor: the authority kernel decides per grievance (case:read_internal to read, case:transition to record).
 * A grievance the caller cannot read answers 404.
 */
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { ProcedureBindingInputSchema } from '@/lib/procedural-rules/definition-schema';
import { readGrievanceProcedure, recordProcedureBinding } from '@/lib/procedural-rules/grievance-procedure';
import { PROCEDURAL_ENTITLEMENT } from '@/lib/procedural-rules/route-support';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true },
    entitlement: PROCEDURAL_ENTITLEMENT,
    openapi: { tags: ['Grievances'], summary: 'Read the procedural record of a grievance' },
  },
  async ({ organizationId, userId, params }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
    if (!zUUID.safeParse(params.id).success) throw ApiError.notFound('Grievance');
    return { data: await readGrievanceProcedure({ organizationId, userId }, params.id) };
  },
);

export const PUT = withApi(
  {
    auth: { required: true },
    entitlement: PROCEDURAL_ENTITLEMENT,
    body: ProcedureBindingInputSchema,
    openapi: { tags: ['Grievances'], summary: 'Record the procedural binding of a grievance' },
  },
  async ({ organizationId, userId, params, body }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
    if (!zUUID.safeParse(params.id).success) throw ApiError.notFound('Grievance');
    return { data: await recordProcedureBinding({ organizationId, userId }, params.id, body) };
  },
);
