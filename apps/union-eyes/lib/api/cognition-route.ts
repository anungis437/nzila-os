import { withApi } from '@/lib/api/framework';
import { standardSuccessResponse } from '@/lib/api/standardized-responses';
import type { InstitutionalExplainabilityEnvelope } from '@nzila/organizational-cognition-core';

export type CognitionEngineFn<T> = (
  organizationId: string,
) => Promise<InstitutionalExplainabilityEnvelope<T>>;

/**
 * Standard route factory for cognition engines.
 *
 * The answer is `{ success, data, meta, timestamp }`: `data` is the engine's payload, where every caller reads it, and `meta.explainability` is the rest of the
 * canonical envelope (evidence, reasoning, governance implications) for callers that want it without a second request. The response is built here, not returned
 * as `{ data, explainability }`, because `withApi` wraps whatever a handler returns under `data`, which would bury the payload one level below where it is read.
 */
export function cognitionRoute<T>(engine: CognitionEngineFn<T>) {
  return withApi(
    {
      auth: { required: true, minRole: 'officer' },
      entitlement: 'union_knowledge_suite',
    },
    async ({ organizationId }) => {
      const envelope = await engine(organizationId!);
      const { payload, ...envelopeWithoutPayload } = envelope;
      return standardSuccessResponse(payload, { explainability: envelopeWithoutPayload });
    },
  );
}
