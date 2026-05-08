// cognition-governance-ci: allow-route-bypass — Scenario CRUD; parameterized.
/**
 * POST /api/exit-interviews/scenarios
 *
 * Model resilience scenarios: retirement wave, rapid turnover, vendor disruption, etc.
 *
 * Body:
 *   - scenarioType: 'retirement_wave' | 'rapid_turnover' | 'governance_transition' | 'vendor_disruption'
 *
 * Requires: officer+
 * Entitlement: union_knowledge_suite
 */

import { withApi } from '@/lib/api/framework';
import { modelResilienceScenario, PRESET_SCENARIOS } from '@/lib/knowledge-transfer/scenarios';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ScenarioSchema = z.object({
  scenarioType: z.enum(['retirement_wave', 'rapid_turnover', 'governance_transition', 'vendor_disruption']),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'union_knowledge_suite',
    body: ScenarioSchema,
  },
  async ({ organizationId, body }) => {
    if (!(body.scenarioType in PRESET_SCENARIOS)) {
      throw new Error('Unknown scenario type');
    }

    const model = await modelResilienceScenario(organizationId!, body.scenarioType);
    return { data: model };
  },
);
