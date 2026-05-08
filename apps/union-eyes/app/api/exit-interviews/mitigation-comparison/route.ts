// cognition-governance-ci: allow-route-bypass — Multi-arg comparator engine; not single-orgId scope.
/**
 * POST /api/exit-interviews/mitigation-comparison
 *
 * Compare continuity mitigation scenarios side-by-side.
 *
 * Body: Array of MitigationScenario objects to compare.
 *
 * Requires: officer+
 * Entitlement: union_knowledge_suite
 */

import { withApi } from '@/lib/api/framework';
import { compareMitigations } from '@/lib/knowledge-transfer/mitigation-comparison';
import type { MitigationScenario } from '@/lib/knowledge-transfer/mitigation-comparison';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const MitigationScenarioSchema = z.object({
  mitigationType: z.enum([
    'documentation_campaign',
    'cross_training',
    'redundancy_improvement',
    'governance_decentralization',
    'vendor_diversification',
    'operational_restructuring',
    'continuity_mentorship',
    'institutional_transfer_program',
  ]),
  targetNodeIds: z.array(z.string()),
  investmentLevel: z.enum(['low', 'medium', 'high']),
  durationWeeks: z.number().int().positive(),
  label: z.string().optional(),
});

const RequestSchema = z.object({
  scenarios: z.array(MitigationScenarioSchema).min(1).max(6),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'union_knowledge_suite',
    body: RequestSchema,
  },
  async ({ organizationId, body }) => {
    const result = await compareMitigations(organizationId!, body.scenarios as MitigationScenario[]);
    return { data: result };
  },
);
