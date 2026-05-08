// cognition-governance-ci: allow-route-bypass — calculateResilienceIndex is a separate engine not yet wrapped in kernel-bridge-foundational; tracked for future migration.
/**
 * GET /api/exit-interviews/resilience-index
 *
 * Calculate organizational resilience across key dimensions:
 * redundancy, documentation, governance, preparedness, diversification.
 *
 * Requires: officer+
 * Entitlement: union_knowledge_suite
 */

import { withApi } from '@/lib/api/framework';
import { calculateResilienceIndex } from '@/lib/knowledge-transfer/resilience-index';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'union_knowledge_suite',
  },
  async ({ organizationId }) => {
    const resilience = await calculateResilienceIndex(organizationId!);
    return { data: resilience };
  },
);
