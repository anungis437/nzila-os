// cognition-governance-ci: allow-route-bypass — Succession-planning surface; mixed-source aggregator.
/**
 * GET /api/exit-interviews/succession
 *
 * Returns the organizational succession fragility report.
 * Analyzes published exit interviews to identify role coverage gaps,
 * undocumented transition areas, and documentation priorities.
 *
 * This evaluates ORGANIZATIONAL DOCUMENTATION READINESS — not individuals.
 *
 * Access: officer+
 */

import { withApi } from '@/lib/api/framework';
import { analyzeSuccessionFragility } from '@/lib/knowledge-transfer/succession/succession-analyzer';
import { limitModelRun } from '@/lib/organizational-operating-intelligence/aggregate-guard';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'union_knowledge_suite',
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Get succession fragility report',
      description:
        'Organizational succession readiness analysis based on published exit interviews.',
    },
  },
  async ({ organizationId, userId }) => {
    await limitModelRun(organizationId!);
    const report = await analyzeSuccessionFragility(organizationId!, userId ?? undefined);
    return { data: report };
  },
);
