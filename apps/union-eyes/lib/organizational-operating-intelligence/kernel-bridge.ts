/**
 * Institutional Operating Intelligence — Kernel Convergence Layer
 *
 * Bridges the T8/T9 domain engines to the canonical
 * @nzila/institutional-cognition-core kernel. This is the **single
 * cross-domain entrypoint** the application surface uses going forward.
 *
 * Rules:
 *  - All cognition results are wrapped in InstitutionalExplainabilityEnvelope.
 *  - Engines are registered in the cognition registry on module load.
 *  - Orchestration is handled by the kernel's orchestrator.
 *  - No domain-engine internals leak past this layer.
 */

import {
  COGNITION_CONTRACT_VERSION,
  buildExplainabilityEnvelope,
  cognitionRegistry,
  confidenceBandFromScore,
  defineCognitionEngine,
  orchestrateCognition,
  type CognitionDomain,
  type InstitutionalExplainabilityEnvelope,
  type OrchestrationResult,
} from '@nzila/institutional-cognition-core';

import {
  analyzeSystemsDynamics,
  evaluateGovernanceCoherence,
  modelCoordinationBehavior,
  analyzeInstitutionalRhythms,
  measureOrganizationalElasticity,
  modelGovernanceMomentum,
  type SystemsDynamicsProfile,
  type GovernanceCoherenceProfile,
  type OperationalCoordinationProfile,
  type OperatingRhythmProfile,
  type OrganizationalResponseElasticityProfile,
  type GovernanceMomentumProfile,
} from '../organizational-dynamics';

import {
  orchestrateMultiDomainCognition,
  analyzeProcedualContinuity,
  analyzeInstitutionalPrecedent,
  analyzeOperationalTrust,
  identifyInstitutionalCorrelations,
  type MultiDomainCognitionProfile,
  type ProceduralContinuityProfile,
  type InstitutionalPrecedentProfile,
  type OperationalTrustProfile,
  type CrossDomainCorrelationProfile,
} from '../multi-domain-cognition';

const ENGINE_VERSION = '1.0.0';

/**
 * Helper that adapts a legacy `(orgId) => Profile` engine into a canonical
 * envelope-emitting kernel engine.
 */
function adaptLegacyEngine<TPayload>(input: {
  engineId: string;
  domain: CognitionDomain;
  compute: (orgId: string) => Promise<TPayload>;
  confidenceFromPayload?: (payload: TPayload) => number;
  interpretationGuidance: string;
}) {
  return defineCognitionEngine<TPayload>({
    engineId: input.engineId,
    engineVersion: ENGINE_VERSION,
    domain: input.domain,
    compute: async (orgId: string) => {
      const payload = await input.compute(orgId);
      const confidenceScore = input.confidenceFromPayload?.(payload) ?? 60;
      return {
        payload,
        confidenceScore,
        interpretationGuidance: input.interpretationGuidance,
      };
    },
  });
}

export const systemsDynamicsEngine = adaptLegacyEngine<SystemsDynamicsProfile>({
  engineId: 'systems-dynamics',
  domain: 'systems_coherence',
  compute: analyzeSystemsDynamics,
  interpretationGuidance:
    'Systemic dynamics across coupled institutional subsystems. Use to detect coupling fragility before it cascades.',
});

export const governanceCoherenceEngine = adaptLegacyEngine<GovernanceCoherenceProfile>({
  engineId: 'governance-coherence',
  domain: 'governance',
  compute: evaluateGovernanceCoherence,
  interpretationGuidance:
    'Governance coherence across decision streams. Low coherence indicates institutional drift.',
});

export const operationalCoordinationEngine = adaptLegacyEngine<OperationalCoordinationProfile>({
  engineId: 'operational-coordination',
  domain: 'coordination',
  compute: modelCoordinationBehavior,
  interpretationGuidance:
    'Cross-team coordination behavior at organizational scope. Never used for individual evaluation.',
});

export const operatingRhythmsEngine = adaptLegacyEngine<OperatingRhythmProfile>({
  engineId: 'operating-rhythms',
  domain: 'systems_coherence',
  compute: analyzeInstitutionalRhythms,
  interpretationGuidance:
    'Institutional cadence and rhythm health. Use to spot rhythm breakdowns that erode continuity.',
});

export const responseElasticityEngine = adaptLegacyEngine<OrganizationalResponseElasticityProfile>({
  engineId: 'response-elasticity',
  domain: 'resilience',
  compute: measureOrganizationalElasticity,
  interpretationGuidance:
    'Organizational ability to absorb stress and recover. Inputs into resilience modeling.',
});

export const governanceMomentumEngine = adaptLegacyEngine<GovernanceMomentumProfile>({
  engineId: 'governance-momentum',
  domain: 'governance',
  compute: modelGovernanceMomentum,
  interpretationGuidance:
    'Direction and speed of governance trajectory. Negative momentum requires human review.',
});

export const multiDomainCognitionEngine = adaptLegacyEngine<MultiDomainCognitionProfile>({
  engineId: 'multi-domain-cognition',
  domain: 'institutional_memory',
  compute: orchestrateMultiDomainCognition,
  interpretationGuidance:
    'Cross-domain cognition synthesis. Surfaces intersectional institutional dynamics.',
});

export const proceduralContinuityEngine = adaptLegacyEngine<ProceduralContinuityProfile>({
  engineId: 'procedural-continuity',
  domain: 'procedural_intelligence',
  compute: analyzeProcedualContinuity,
  interpretationGuidance:
    'Procedural knowledge continuity. Identifies where institutional memory is at risk.',
});

export const institutionalPrecedentEngine = adaptLegacyEngine<InstitutionalPrecedentProfile>({
  engineId: 'institutional-precedent',
  domain: 'precedent',
  compute: analyzeInstitutionalPrecedent,
  interpretationGuidance:
    'Pattern alignment with institutional precedent. Use for governance reasoning, never individual judgement.',
});

export const operationalTrustEngine = adaptLegacyEngine<OperationalTrustProfile>({
  engineId: 'operational-trust',
  domain: 'operational_trust',
  compute: analyzeOperationalTrust,
  interpretationGuidance:
    'Organizational-level trust signals. Aggregated only — no individual trust scoring.',
});

export const crossDomainCorrelationEngine = adaptLegacyEngine<CrossDomainCorrelationProfile>({
  engineId: 'cross-domain-correlation',
  domain: 'systems_coherence',
  compute: identifyInstitutionalCorrelations,
  interpretationGuidance:
    'Cross-domain correlations among institutional signals. Highlights leverage points.',
});

/**
 * Register all engines with the kernel registry.
 * Called eagerly on module load — registration is idempotent for
 * test/dev hot-reload scenarios.
 */
function registerAllEngines(): void {
  const engines: Array<{ id: string; domains: CognitionDomain[]; description: string }> = [
    { id: 'systems-dynamics', domains: ['systems_coherence'], description: 'Systems dynamics analysis.' },
    { id: 'governance-coherence', domains: ['governance'], description: 'Governance coherence evaluation.' },
    { id: 'operational-coordination', domains: ['coordination'], description: 'Coordination behavior modeling.' },
    { id: 'operating-rhythms', domains: ['systems_coherence'], description: 'Institutional rhythm analysis.' },
    { id: 'response-elasticity', domains: ['resilience'], description: 'Organizational elasticity measurement.' },
    { id: 'governance-momentum', domains: ['governance'], description: 'Governance momentum trajectory.' },
    { id: 'multi-domain-cognition', domains: ['institutional_memory'], description: 'Multi-domain cognition synthesis.' },
    { id: 'procedural-continuity', domains: ['procedural_intelligence'], description: 'Procedural continuity analysis.' },
    { id: 'institutional-precedent', domains: ['precedent'], description: 'Precedent pattern reasoning.' },
    { id: 'operational-trust', domains: ['operational_trust'], description: 'Operational trust evaluation.' },
    { id: 'cross-domain-correlation', domains: ['systems_coherence'], description: 'Cross-domain correlation detection.' },
  ];

  for (const e of engines) {
    if (cognitionRegistry.get(e.id)) continue;
    cognitionRegistry.register({
      id: e.id,
      version: ENGINE_VERSION,
      domains: e.domains,
      description: e.description,
      readonly: true,
      emitsExplainability: true,
      contractVersion: COGNITION_CONTRACT_VERSION,
    });
  }
}

registerAllEngines();

/**
 * Run the T8/T9 institutional operating intelligence orchestration for an org.
 * Returns aggregated envelopes plus per-engine failures.
 *
 * For the unified T1–T9 orchestration, prefer
 * `runFullInstitutionalCognition` from this folder's `index.ts`.
 */
export async function runInstitutionalOperatingIntelligence(
  organizationId: string,
): Promise<OrchestrationResult> {
  return orchestrateCognition({
    organizationId,
    steps: ADVANCED_ORCHESTRATION_STEPS as unknown as Parameters<typeof orchestrateCognition>[0]['steps'],
  });
}

/** T8/T9 orchestration steps, exported so the unified runner can compose them. */
export const ADVANCED_ORCHESTRATION_STEPS = [
  { engineId: 'systems-dynamics', domain: 'systems_coherence' as CognitionDomain, invoke: systemsDynamicsEngine },
  { engineId: 'governance-coherence', domain: 'governance' as CognitionDomain, invoke: governanceCoherenceEngine },
  { engineId: 'operational-coordination', domain: 'coordination' as CognitionDomain, invoke: operationalCoordinationEngine },
  { engineId: 'operating-rhythms', domain: 'systems_coherence' as CognitionDomain, invoke: operatingRhythmsEngine },
  { engineId: 'response-elasticity', domain: 'resilience' as CognitionDomain, invoke: responseElasticityEngine },
  { engineId: 'governance-momentum', domain: 'governance' as CognitionDomain, invoke: governanceMomentumEngine },
  { engineId: 'multi-domain-cognition', domain: 'institutional_memory' as CognitionDomain, invoke: multiDomainCognitionEngine },
  { engineId: 'procedural-continuity', domain: 'procedural_intelligence' as CognitionDomain, invoke: proceduralContinuityEngine },
  { engineId: 'institutional-precedent', domain: 'precedent' as CognitionDomain, invoke: institutionalPrecedentEngine },
  { engineId: 'operational-trust', domain: 'operational_trust' as CognitionDomain, invoke: operationalTrustEngine },
  { engineId: 'cross-domain-correlation', domain: 'systems_coherence' as CognitionDomain, invoke: crossDomainCorrelationEngine },
] as const;

export type {
  InstitutionalExplainabilityEnvelope,
  OrchestrationResult,
};

// Re-export buildExplainabilityEnvelope for ad-hoc envelope creation in routes
export { buildExplainabilityEnvelope, confidenceBandFromScore };
