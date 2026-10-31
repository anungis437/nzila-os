import { withApi } from '@/lib/api/framework';
import {
  composeExecutiveBriefing,
  narrateEnvelopes,
} from '@/lib/organizational-narratives';
import { runFullInstitutionalCognition } from '@/lib/organizational-operating-intelligence';
import { describeAggregateOutcome, limitAggregateRun, memoizeAggregateRun } from '@/lib/organizational-operating-intelligence/aggregate-guard';

export const dynamic = 'force-dynamic';

/**
 * Aggregated institutional narrative endpoint.
 *
 * Runs the full T1–T9 cognition orchestration, then projects each envelope
 * into a calm, governance-safe narrative and composes an executive briefing.
 * Pure projection — NO new cognition, NO new inference, NO LLM call.
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
    const { narratives, failures: narrativeFailures } = narrateEnvelopes(result.envelopes);
    const briefing = composeExecutiveBriefing(Object.values(narratives));
    return {
      data: {
        organizationId: result.organizationId,
        generatedAt: briefing.generatedAt,
        briefing,
        narratives,
        engineFailures: outcome.failures,
        complete: outcome.complete,
        // Only which narratives failed, never the exception text.
        narrativeFailures: narrativeFailures.map((failure) => ({ engineId: failure.engine, code: 'NARRATIVE_FAILED' as const })),
      },
    };
  },
);
