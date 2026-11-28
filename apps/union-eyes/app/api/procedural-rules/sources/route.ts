/**
 * GET  /api/procedural-rules/sources — the organization's procedural rule sources (instruments rules are read from)
 * POST /api/procedural-rules/sources — record a rule source: kind, edition, language, effective/supersession dates, reference
 *
 * Requires: steward+ to read, officer+ to record. Sources are append-only; a correction is a new source that supersedes.
 */
import { withApi } from '@/lib/api/framework';
import { RuleSourceInputSchema } from '@/lib/procedural-rules/definition-schema';
import { createRuleSource, listRuleSources } from '@/lib/procedural-rules/store';
import { PROCEDURAL_ENTITLEMENT, PROCEDURAL_RULES_DRAFT_MIN_ROLE, PROCEDURAL_RULES_READ_MIN_ROLE } from '@/lib/procedural-rules/route-support';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: PROCEDURAL_RULES_READ_MIN_ROLE },
    entitlement: PROCEDURAL_ENTITLEMENT,
    openapi: { tags: ['Procedural Rules'], summary: 'List procedural rule sources' },
  },
  async ({ organizationId }) => ({ data: await listRuleSources(organizationId!) }),
);

export const POST = withApi(
  {
    auth: { required: true, minRole: PROCEDURAL_RULES_DRAFT_MIN_ROLE },
    entitlement: PROCEDURAL_ENTITLEMENT,
    body: RuleSourceInputSchema,
    openapi: { tags: ['Procedural Rules'], summary: 'Record a procedural rule source' },
  },
  async ({ organizationId, userId, body }) => ({ data: await createRuleSource(organizationId!, userId!, body) }),
);
