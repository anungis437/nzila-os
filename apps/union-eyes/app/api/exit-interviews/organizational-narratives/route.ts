import { withApi } from '@/lib/api/framework';
import {
  composeExecutiveBriefing,
  narrateEnvelopes,
} from '@/lib/organizational-narratives';
import { runFullInstitutionalCognition } from '@/lib/organizational-operating-intelligence';

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
    const result = await runFullInstitutionalCognition(organizationId!);
    const { narratives, failures: narrativeFailures } = narrateEnvelopes(result.envelopes);
    const briefing = composeExecutiveBriefing(Object.values(narratives));
    return {
      data: {
        organizationId: result.organizationId,
        generatedAt: briefing.generatedAt,
        briefing,
        narratives,
        engineFailures: result.failures,
        narrativeFailures,
      },
    };
  },
);
