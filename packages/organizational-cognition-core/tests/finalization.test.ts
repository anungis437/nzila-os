import { describe, expect, it } from 'vitest';
import {
  ancestorsOf,
  COGNITION_EXECUTION_CONTEXTS,
  descendantsOf,
  diffDeepSemantics,
  INSTITUTIONAL_TAXONOMY,
  listDomainSemanticBindings,
  orchestrateCognitionContextAware,
  planForContext,
  resolveCurrentNodeId,
  snapshotDeepSemantics,
  taxonomyForDomain,
  validateDeepSemantics,
  buildExplainabilityEnvelope,
  type IntelligentOrchestrationStep,
} from '../src/index.js';

describe('deep-semantics', () => {
  it('canonical taxonomy is structurally valid', () => {
    const report = validateDeepSemantics();
    if (!report.ok) {
      // Surface the issues if validation fails so the assertion message is useful.
      // eslint-disable-next-line no-console
      console.error(report.issues);
    }
    expect(report.ok).toBe(true);
    expect(INSTITUTIONAL_TAXONOMY.length).toBeGreaterThan(0);
  });

  it('walks ancestors and descendants without cycles', () => {
    const node = INSTITUTIONAL_TAXONOMY.find((n) => n.parentId);
    expect(node).toBeDefined();
    const chain = ancestorsOf(node!.id);
    expect(chain[0]?.id).toBe(node!.id);
    expect(chain.length).toBeGreaterThanOrEqual(2);
    // Top of the chain has no parent.
    expect(chain[chain.length - 1]?.parentId).toBeUndefined();
    // Descendants of top should include `node`.
    const descendants = descendantsOf(chain[chain.length - 1]!.id);
    expect(descendants.map((d) => d.id)).toContain(node!.id);
  });

  it('lists per-domain bindings with anchor nodes', () => {
    const bindings = listDomainSemanticBindings();
    const governance = bindings.find((b) => b.domain === 'governance');
    expect(governance).toBeDefined();
    expect(governance!.empty).toBe(false);
    expect(governance!.anchorNodeIds.length).toBeGreaterThan(0);
  });

  it('resolves current node id (no-op for active nodes)', () => {
    const active = INSTITUTIONAL_TAXONOMY.find((n) => n.status === 'active')!;
    expect(resolveCurrentNodeId(active.id)).toBe(active.id);
  });

  it('detects breaking semantic drift when nodes are removed', () => {
    const prev = snapshotDeepSemantics();
    const next = { ...prev, nodes: prev.nodes.slice(1) };
    const drift = diffDeepSemantics(prev, next);
    expect(drift.breaking).toBe(true);
    expect(drift.removedNodeIds.length).toBe(1);
  });

  it('every taxonomy node belongs to a known cognition domain', () => {
    const domains = new Set(taxonomyForDomain('governance').map((n) => n.domain));
    expect(domains.size).toBe(1);
    expect([...domains][0]).toBe('governance');
  });
});

describe('context-aware orchestration', () => {
  it('exposes a closed set of execution contexts', () => {
    expect(COGNITION_EXECUTION_CONTEXTS).toContain('executive_briefing');
    expect(COGNITION_EXECUTION_CONTEXTS).toContain('incident_triage');
  });

  it('plans steps under cognition budget and promotes priorities', () => {
    const steps: IntelligentOrchestrationStep<unknown>[] = [
      { engineId: 'e-mem', domain: 'institutional_memory', invoke: async () => ({} as never) },
      { engineId: 'e-gov', domain: 'governance', invoke: async () => ({} as never) },
      { engineId: 'e-cont', domain: 'continuity', invoke: async () => ({} as never) },
      { engineId: 'e-coord', domain: 'adaptation', invoke: async () => ({} as never) },
    ];
    const plan = planForContext({ context: 'incident_triage', steps });
    // governance/continuity should be critical-promoted and present.
    const govStep = plan.executedSteps.find((s) => s.engineId === 'e-gov');
    expect(govStep?.priority).toBe('critical');
    // adaptation is allowed to skip-if-feeders-failed for incident_triage.
    const adaptStep = plan.executedSteps.find((s) => s.engineId === 'e-coord');
    expect(adaptStep?.skipIfFeedersFailed).toBe(true);
    // explainability depth tuned for incident_triage.
    expect(plan.explainabilityDepth).toBe('executive');
  });

  it('drops lowest-priority steps when budget is exhausted', () => {
    const steps: IntelligentOrchestrationStep<unknown>[] = Array.from({ length: 10 }).map(
      (_, i) =>
        ({
          engineId: `e-${i}`,
          domain: i < 2 ? 'governance' : 'adaptation',
          priority: i < 2 ? 'critical' : 'low',
          invoke: async () => ({} as never),
        }) as IntelligentOrchestrationStep<unknown>,
    );
    const plan = planForContext({ context: 'incident_triage', steps });
    expect(plan.executedSteps.length).toBeLessThanOrEqual(8);
    expect(plan.droppedSteps.every((d) => d.reason.startsWith('cognition_budget_exhausted'))).toBe(
      true,
    );
    // critical steps survive the prune.
    expect(plan.executedSteps.some((s) => s.engineId === 'e-0')).toBe(true);
  });

  it('executes a planned context-aware run end-to-end', async () => {
    const steps: IntelligentOrchestrationStep<unknown>[] = [
      {
        engineId: 'gov-stub',
        domain: 'governance',
        invoke: async (orgId) =>
          buildExplainabilityEnvelope({
            domain: 'governance',
            organizationId: orgId,
            payload: { ok: true },
            confidenceScore: 80,
            interpretationGuidance: 'stub',
            evidence: [],
            reasoning: [],
            assumptions: [],
            governanceImplications: [],
            provenance: { engineId: 'gov-stub', engineVersion: '1.0.0', generatedAt: new Date().toISOString() },
          }) as never,
      },
    ];
    const result = await orchestrateCognitionContextAware({
      organizationId: 'org-1',
      context: 'executive_briefing',
      steps,
    });
    expect(result.envelopes.length).toBe(1);
    expect(result.plan.context).toBe('executive_briefing');
    expect(result.plan.explainabilityDepth).toBe('executive');
    expect(result.trace[0]?.status).toBe('ok');
  });
});
