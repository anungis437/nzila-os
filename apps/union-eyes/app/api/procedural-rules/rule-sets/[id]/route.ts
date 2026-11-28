/**
 * GET /api/procedural-rules/rule-sets/{id} — one rule set version with its source, definition and lifecycle history.
 * Requires: steward+.
 */
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { getRuleSet, listLifecycleEvents } from '@/lib/procedural-rules/store';
import { PROCEDURAL_ENTITLEMENT, PROCEDURAL_RULES_READ_MIN_ROLE } from '@/lib/procedural-rules/route-support';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: PROCEDURAL_RULES_READ_MIN_ROLE },
    entitlement: PROCEDURAL_ENTITLEMENT,
    openapi: { tags: ['Procedural Rules'], summary: 'Read a procedural rule set version' },
  },
  async ({ organizationId, params }) => {
    if (!zUUID.safeParse(params.id).success) throw ApiError.notFound('Rule set');
    const ruleSet = await getRuleSet(organizationId!, params.id);
    if (!ruleSet) throw ApiError.notFound('Rule set');
    return { data: { ...ruleSet, lifecycle: await listLifecycleEvents(organizationId!, params.id) } };
  },
);
