// cognition-governance-ci: allow-route-bypass — Simulation CRUD/run; parameterized inputs.
/**
 * POST /api/exit-interviews/simulation
 *
 * Simulate continuity impact of scenarios (retirement, departure, vendor loss, etc.)
 *
 * Body:
 *   - simulationType: 'retirement' | 'sudden_departure' | 'vendor_loss' | etc.
 *   - affectedNodeIds: string[]
 *   - affectedRoles?: string[]
 *   - context?: string
 *
 * Requires: officer+
 * Entitlement: union_knowledge_suite
 */

import { withApi } from '@/lib/api/framework';
import { simulateContinuityImpact } from '@/lib/knowledge-transfer/simulation';
import type { SimulationScenario } from '@/lib/knowledge-transfer/simulation';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const SimulationRequestSchema = z.object({
  simulationType: z.enum([
    'retirement',
    'sudden_departure',
    'vendor_loss',
    'governance_knowledge_loss',
    'undocumented_process_loss',
    'procedural_fragmentation',
    'bottleneck_collapse',
  ]),
  affectedNodeIds: z.array(z.string()),
  affectedRoles: z.array(z.string()).optional(),
  context: z.string().optional(),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'union_knowledge_suite',
    body: SimulationRequestSchema,
  },
  async ({ organizationId, body }) => {
    const scenario: SimulationScenario = {
      simulationType: body.simulationType,
      affectedNodeIds: body.affectedNodeIds,
      affectedRoles: body.affectedRoles,
      context: body.context,
    };

    const result = await simulateContinuityImpact(organizationId!, scenario);
    return { data: result };
  },
);
