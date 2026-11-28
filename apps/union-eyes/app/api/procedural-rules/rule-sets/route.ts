/**
 * GET  /api/procedural-rules/rule-sets — every version of the organization's procedural rule sets (?regime=&procedureRoute=)
 * POST /api/procedural-rules/rule-sets — create the next version of a rule set as a DRAFT
 *
 * Every new version is a draft, whatever its origin: an AI-assisted extraction is recorded with origin
 * `ai_assisted_extraction` and can only be moved past draft by a human reviewer other than its drafter. Only adopted
 * versions execute. Requires: steward+ to read, officer+ to draft.
 */
import { withApi, z } from '@/lib/api/framework';
import { RuleSetDraftInputSchema } from '@/lib/procedural-rules/definition-schema';
import { createRuleSetDraft, listRuleSets } from '@/lib/procedural-rules/store';
import { PROCEDURAL_ENTITLEMENT, PROCEDURAL_RULES_DRAFT_MIN_ROLE, PROCEDURAL_RULES_READ_MIN_ROLE } from '@/lib/procedural-rules/route-support';

export const dynamic = 'force-dynamic';

const QuerySchema = z.object({ regime: z.string().min(1).max(120).optional(), procedureRoute: z.string().min(1).max(120).optional() });

export const GET = withApi(
  {
    auth: { required: true, minRole: PROCEDURAL_RULES_READ_MIN_ROLE },
    entitlement: PROCEDURAL_ENTITLEMENT,
    query: QuerySchema,
    openapi: { tags: ['Procedural Rules'], summary: 'List procedural rule set versions' },
  },
  async ({ organizationId, query }) => ({ data: await listRuleSets(organizationId!, query) }),
);

export const POST = withApi(
  {
    auth: { required: true, minRole: PROCEDURAL_RULES_DRAFT_MIN_ROLE },
    entitlement: PROCEDURAL_ENTITLEMENT,
    body: RuleSetDraftInputSchema,
    openapi: { tags: ['Procedural Rules'], summary: 'Draft the next version of a procedural rule set' },
  },
  async ({ organizationId, userId, body }) => ({ data: await createRuleSetDraft(organizationId!, userId!, body) }),
);
