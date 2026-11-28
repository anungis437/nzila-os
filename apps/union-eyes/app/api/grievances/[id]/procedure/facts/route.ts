/**
 * POST /api/grievances/{id}/procedure/facts — record a procedural fact: a trigger event (with the occurrence, postmark,
 *      delivery and receipt instants it has), a pause, a mutual extension, a level hearing (the employer decision-maker at a
 *      level) or a level waiver. Body: { kind, payload }.
 *
 * A level hearing is refused (409) when the governing adopted rule set requires distinct decision-makers and this one already
 * heard the grievance at another level. A level waiver is refused (409) unless the governing rule set permits waiving the
 * skipped level(s). The authority kernel decides (case:transition); a grievance the caller cannot read answers 404.
 */
import { withApi, ApiError, zUUID, z } from '@/lib/api/framework';
import { FACT_KINDS, type FactKind } from '@/lib/procedural-rules/definition-schema';
import { recordProceduralFact } from '@/lib/procedural-rules/grievance-procedure';
import { PROCEDURAL_ENTITLEMENT } from '@/lib/procedural-rules/route-support';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({ kind: z.enum(FACT_KINDS as [FactKind, ...FactKind[]]), payload: z.record(z.string(), z.unknown()) }).strict();

export const POST = withApi(
  {
    auth: { required: true },
    entitlement: PROCEDURAL_ENTITLEMENT,
    body: BodySchema,
    openapi: { tags: ['Grievances'], summary: 'Record a procedural fact on a grievance' },
  },
  async ({ organizationId, userId, params, body }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
    if (!zUUID.safeParse(params.id).success) throw ApiError.notFound('Grievance');
    return { data: await recordProceduralFact({ organizationId, userId }, params.id, body.kind, body.payload) };
  },
);
