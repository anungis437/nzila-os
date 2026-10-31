import { withApi } from '@/lib/api/framework';
import { runFullInstitutionalCognition } from '@/lib/organizational-operating-intelligence';
import { describeAggregateOutcome, limitAggregateRun, memoizeAggregateRun } from '@/lib/organizational-operating-intelligence/aggregate-guard';

export const dynamic = 'force-dynamic';

/**
 * Aggregated institutional cognition endpoint.
 *
 * Single, orchestrated, envelope-aware call covering T1–T9. Replaces the
 * previous pattern of 11+ parallel client fetches. Each engine result is
 * returned as a canonical InstitutionalExplainabilityEnvelope; failures are
 * isolated per engine and surfaced in `data.failures` rather than failing
 * the whole request. A failure carries the engine and a fixed code, never the exception text; `complete` is false when any engine is
 * missing, and a run in which every engine failed is a 503. Each run is limited per organization and a result without failures is
 * reused for 30 seconds.
 */
export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'union_knowledge_suite',
  },
  async ({ organizationId }) => {
    await limitAggregateRun(organizationId!);
    const result = await memoizeAggregateRun(organizationId!, () => runFullInstitutionalCognition(organizationId!));
    const outcome = describeAggregateOutcome(result);
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
        failures: outcome.failures,
        complete: outcome.complete,
      },
    };
  },
);
