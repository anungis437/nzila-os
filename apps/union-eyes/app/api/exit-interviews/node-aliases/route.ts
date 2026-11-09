/**
 * GET  /api/exit-interviews/node-aliases — List the organization's graph node identity aliases (active and superseded)
 * POST /api/exit-interviews/node-aliases — Record a new alias (durable identity/alias mapping)
 *
 * graph-identity.ts's canonicalNodeIdentityKey only tolerates COSMETIC drift (case, spacing, punctuation) in a
 * label-derived propagation-map node id; it deliberately never guesses across a SEMANTIC rename or a label
 * collision, to avoid silently attributing verified evidence to the wrong concept. This route is how that kind of
 * identity change is migrated instead: an authorized reviewer explicitly records that a label now refers to the
 * same real-world concept as an existing one, with a reason. Never inferred; always this explicit, audited action.
 * A new alias supersedes (never deletes) any prior active alias for the same label, so the full history of
 * identity decisions is preserved (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-
 * OCCURRENCE, Family 1 exit).
 *
 * Requires: national_officer+ to create (the same reviewer floor as verified-dependency review and governance
 * reclassification approval); officer+ to list.
 * Entitlement: union_knowledge_suite
 */

import { z } from 'zod';
import { withApi, ApiError } from '@/lib/api/framework';
import { hasMinRole } from '@/lib/api-auth-guard';
import { createNodeAlias, listAllNodeAliases } from '@/lib/knowledge-transfer/propagation/node-alias-store';

export const dynamic = 'force-dynamic';

/** Senior enough to record a durable identity alias - the same floor as verified-dependency review. */
const NODE_ALIAS_AUTHOR_MIN_ROLE = 'national_officer';

const CreateSchema = z.object({
  aliasLabel: z.string().min(1).max(200),
  canonicalConceptLabel: z.string().min(1).max(200),
  reason: z.string().min(1).max(500),
}).strict();

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'union_knowledge_suite',
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'List graph node identity aliases',
      description: 'Lists the organization\'s full alias history (active and superseded), newest first.',
    },
  },
  async ({ organizationId }) => {
    const aliases = await listAllNodeAliases(organizationId!);
    return { data: aliases };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'union_knowledge_suite',
    body: CreateSchema,
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Record a graph node identity alias',
      description: 'Records that aliasLabel refers to the same organizational concept as canonicalConceptLabel. Requires national_officer+. Supersedes, never deletes, any prior active alias for the same label.',
    },
  },
  async ({ organizationId, userId, body }) => {
    if (!(await hasMinRole(NODE_ALIAS_AUTHOR_MIN_ROLE))) {
      throw ApiError.forbidden(`Recording a node identity alias requires at least ${NODE_ALIAS_AUTHOR_MIN_ROLE}`);
    }
    try {
      const alias = await createNodeAlias(organizationId!, body, userId!);
      return { data: alias };
    } catch (error) {
      throw ApiError.badRequest(error instanceof Error ? error.message : 'Failed to record alias');
    }
  },
);
