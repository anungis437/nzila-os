/**
 * Cognition Orchestration
 *
 * Lightweight, runtime-agnostic orchestration primitives for composing
 * cross-domain cognition. Engines remain in their own packages/apps; the
 * orchestrator only coordinates their invocation and aggregates envelopes.
 */

import type { CognitionDomain } from '../ontology/index';
import type { InstitutionalExplainabilityEnvelope } from '../explainability/index';
import { assertLaborSafe, type CognitionGovernanceContext } from '../governance/index';

export type CognitionEngineFn<TPayload> = (
  organizationId: string,
) => Promise<InstitutionalExplainabilityEnvelope<TPayload>>;

export interface OrchestrationStep<TPayload = unknown> {
  engineId: string;
  domain: CognitionDomain;
  invoke: CognitionEngineFn<TPayload>;
}

export interface OrchestrationResult {
  organizationId: string;
  startedAt: string;
  completedAt: string;
  envelopes: Array<InstitutionalExplainabilityEnvelope<unknown>>;
  failures: Array<{ engineId: string; domain: CognitionDomain; error: string }>;
}

/**
 * Run a set of cognition engines in parallel against the same organization.
 * Each engine result is captured as an envelope; failures are isolated and
 * recorded rather than cascading.
 */
export async function orchestrateCognition(input: {
  organizationId: string;
  steps: Array<OrchestrationStep<unknown>>;
}): Promise<OrchestrationResult> {
  const startedAt = new Date().toISOString();
  const envelopes: Array<InstitutionalExplainabilityEnvelope<unknown>> = [];
  const failures: OrchestrationResult['failures'] = [];

  await Promise.all(
    input.steps.map(async (step) => {
      const ctx: CognitionGovernanceContext = {
        organizationId: input.organizationId,
        domain: step.domain,
        scopeOfObservation: 'organizational',
      };
      try {
        assertLaborSafe(ctx);
        const env = await step.invoke(input.organizationId);
        envelopes.push(env);
      } catch (err) {
        failures.push({
          engineId: step.engineId,
          domain: step.domain,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );

  return {
    organizationId: input.organizationId,
    startedAt,
    completedAt: new Date().toISOString(),
    envelopes,
    failures,
  };
}
