/**
 * GET  /api/exit-interviews/verified-dependencies — List verified dependency evidence for the organization
 * POST /api/exit-interviews/verified-dependencies — Submit new dependency evidence for review
 *
 * This is the authenticated application surface for lib/knowledge-transfer/propagation/verified-dependency-store.ts
 * (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE): a submission always
 * starts pending_review - nothing here is self-certifying. Reviewing (verify/reject) or revoking an already-verified
 * record is a separate action, requiring a more senior, distinct reviewer identity - see the [id] route.
 *
 * Requires: officer+ to submit or list.
 * Entitlement: union_knowledge_suite
 */

import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import {
  submitVerifiedDependency,
  listVerifiedDependencies,
} from '@/lib/knowledge-transfer/propagation/verified-dependency-store';

export const dynamic = 'force-dynamic';

const STATUS_VALUES = ['pending_review', 'verified', 'rejected', 'revoked'] as const;

const ListQuerySchema = z.object({
  status: z.enum(STATUS_VALUES).optional(),
});

const SubmitSchema = z.object({
  dependentNodeId: z.string().min(1).max(200),
  dependsOnNodeId: z.string().min(1).max(200),
  processOrSystem: z.string().min(1).max(300),
  responsibleAuthority: z.string().min(1).max(300),
  evidenceReference: z.string().min(1).max(500),
}).strict();

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'union_knowledge_suite',
    query: ListQuerySchema,
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'List verified dependency evidence',
      description: 'Lists the organization\'s verified-dependency-evidence records, optionally filtered by status.',
    },
  },
  async ({ organizationId, query }) => {
    const records = await listVerifiedDependencies(organizationId!, query.status);
    return { data: records };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'union_knowledge_suite',
    body: SubmitSchema,
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Submit dependency evidence',
      description: 'Submits a directional dependency for review, attributed to a named process/system and responsible authority. Starts pending_review.',
    },
  },
  async ({ organizationId, userId, body }) => {
    const record = await submitVerifiedDependency(organizationId!, body, userId!);
    return { data: record };
  },
);
