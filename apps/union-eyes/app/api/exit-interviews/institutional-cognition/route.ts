import { withApi } from '@/lib/api/framework';
import { runFullInstitutionalCognition } from '@/lib/organizational-operating-intelligence';

export const dynamic = 'force-dynamic';

/**
 * Aggregated institutional cognition endpoint.
 *
 * Single, orchestrated, envelope-aware call covering T1–T9. Replaces the
 * previous pattern of 11+ parallel client fetches. Each engine result is
 * returned as a canonical InstitutionalExplainabilityEnvelope; failures are
 * isolated per engine and surfaced in `data.failures` rather than failing
 * the whole request.
 */
export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'union_knowledge_suite',
  },
  async ({ organizationId }) => {
    const result = await runFullInstitutionalCognition(organizationId!);
    // Index envelopes by engineId for client-side lookup.
    const byEngine: Record<string, unknown> = {};
    for (const env of result.envelopes) {
      byEngine[env.provenance.engine] = env;
    }
    return {
      data: {
        organizationId: result.organizationId,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        envelopes: result.envelopes,
        byEngine,
        failures: result.failures,
      },
    };
  },
);
