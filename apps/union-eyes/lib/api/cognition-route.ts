import { withApi } from '@/lib/api/framework';
import type { InstitutionalExplainabilityEnvelope } from '@nzila/organizational-cognition-core';

export type CognitionEngineFn<T> = (
  organizationId: string,
) => Promise<InstitutionalExplainabilityEnvelope<T>>;

/**
 * Standard route factory for cognition engines.
 *
 * Returns the canonical envelope's payload as `data` for backward
 * compatibility, and the full envelope (sans payload) under
 * `explainability` so callers can opt into evidence/reasoning/governance
 * implications without a second request.
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
      return {
        data: payload,
        explainability: envelopeWithoutPayload,
      };
    },
  );
}
