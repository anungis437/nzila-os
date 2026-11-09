/**
 * GET  /api/exit-interviews/node-aliases — List the organization's graph node identity aliases (active and superseded)
 * POST /api/exit-interviews/node-aliases — Record a new alias (durable identity/alias mapping)
 *
 * graph-identity.ts's resolveNodeReference only tolerates differences that cannot change what a label names
 * (underscores for spaces, case, Unicode composition, whitespace runs); it never guesses across a SEMANTIC rename,
 * and reports a COLLISION (two current nodes, or two aliases, matching one reference) as ambiguous rather than
 * picking one. This route is how that kind of
 * identity change is migrated instead: an authorized reviewer explicitly records that a label now refers to the
 * same real-world concept as an existing one, with a reason. Never inferred; always this explicit, audited action.
 * A new alias supersedes (never deletes) any prior active alias with the same identity key, so the full history of
 * identity decisions is preserved. Any change to which node a verified dependency resolves to makes that record
 * require re-verification. GET reports, for each active alias, what its target resolves to right now (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-
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
import { loadGraphEvidenceContext } from '@/lib/knowledge-transfer/propagation/graph-evidence-evaluator';
import { resolveNodeReference } from '@/lib/knowledge-transfer/propagation/graph-identity';

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
      description: 'Lists the organization\'s full alias history (active and superseded), newest first. Each active alias carries what its target resolves to in the current graph (resolved, not_found or ambiguous).',
    },
  },
  async ({ organizationId }) => {
    const [aliases, { context }] = await Promise.all([listAllNodeAliases(organizationId!), loadGraphEvidenceContext(organizationId!, [])]);
    const data = aliases.map((alias) => {
      if (alias.supersededAt !== null) return { ...alias, targetResolution: null };
      const resolution = resolveNodeReference(context.aliases, context.currentNodeIds, alias.canonicalConceptLabel);
      return { ...alias, targetResolution: resolution };
    });
    return { data };
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
