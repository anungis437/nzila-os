/**
 * GET  /api/grievances/{id}/representation-records — the grievance's representation records with approval and handoff state
 * POST /api/grievances/{id}/representation-records — append a record: an employer-initiated filing (with the employer's own case
 *      identifier and the form it arrived in), a policy filing routed to the final level, a filing approval (distinct people,
 *      distinct executive offices, not the requester), a final-level handoff signed by an executive office holder, its receipt
 *      (by someone else), a written abandonment or missed-escalation finding, or a beyond-control exception.
 *
 * No record closes or changes the grievance. The authority kernel decides per grievance (case:read_internal / case:transition).
 */
import { withApi, ApiError, zUUID, z } from '@/lib/api/framework';
import { readRepresentationRecords, recordRepresentation, RECORD_KINDS, type RecordKind } from '@/lib/representation-workflows/service';

export const dynamic = 'force-dynamic';

const BodySchema = z
  .object({ kind: z.enum(RECORD_KINDS as [RecordKind, ...RecordKind[]]), payload: z.record(z.string(), z.unknown()), parentRecordId: z.string().uuid().nullable().default(null) })
  .strict();

export const GET = withApi(
  { auth: { required: true }, entitlement: 'grievance_case_suite', openapi: { tags: ['Grievances'], summary: 'List grievance representation records' } },
  async ({ organizationId, userId, params }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
    if (!zUUID.safeParse(params.id).success) throw ApiError.notFound('Grievance');
    return { data: await readRepresentationRecords({ organizationId, userId }, params.id) };
  },
);

export const POST = withApi(
  { auth: { required: true }, entitlement: 'grievance_case_suite', body: BodySchema, openapi: { tags: ['Grievances'], summary: 'Append a grievance representation record' } },
  async ({ organizationId, userId, params, body }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
    if (!zUUID.safeParse(params.id).success) throw ApiError.notFound('Grievance');
    return { data: await recordRepresentation({ organizationId, userId }, params.id, body.kind, body.payload, body.parentRecordId) };
  },
);
