import { describe, expect, it, beforeEach } from 'vitest';
import {
  // Ontology governance
  detectForbiddenVocabulary,
  diffOntology,
  feedersOf,
  snapshotOntology,
  validateOntology,
  INSTITUTIONAL_ONTOLOGY_VERSION,
  // Observability
  createRuntimeMetricsAggregator,
  emitCognitionTelemetry,
  // Cache
  envelopeCacheKey,
  getEnvelopeCacheStore,
  memoizeCognitionEngine,
  // Intelligent orchestration
  orchestrateCognitionIntelligent,
  // SDK / explainability
  buildExplainabilityEnvelope,
  COGNITION_CONTRACT_VERSION,
} from '../src/index.js';

describe('ontology-governance', () => {
  it('detects forbidden labor vocabulary', () => {
    const issues = detectForbiddenVocabulary('We compute employee score for retention risk');
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(issues.every((i) => i.code === 'forbidden_term')).toBe(true);
  });

  it('passes ontology validation for clean text', () => {
    const report = validateOntology({
      texts: [{ text: 'Governance coherence improved across continuity windows.' }],
      domains: [{ domain: 'governance' }],
      concepts: [{ concept: 'governance_action' }],
    });
    expect(report.ok).toBe(true);
    expect(report.ontologyVersion).toBe(INSTITUTIONAL_ONTOLOGY_VERSION);
  });

  it('flags unknown domains and concepts', () => {
    const report = validateOntology({
      domains: [{ domain: 'employee_intel' }],
      concepts: [{ concept: 'nope' }],
    });
    expect(report.ok).toBe(false);
    expect(report.issues.map((i) => i.code).sort()).toEqual(['unknown_concept', 'unknown_domain']);
  });

  it('resolves transitive feeders of a domain', () => {
    const feeders = feedersOf('systems_coherence');
    // resilience feeds systems_coherence; continuity feeds resilience
    expect(feeders).toContain('resilience');
    expect(feeders).toContain('continuity');
  });

  it('detects ontology drift as breaking when domains are removed', () => {
    const prev = snapshotOntology();
    const next = { ...snapshotOntology(), domains: prev.domains.filter((d) => d !== 'governance') };
    const drift = diffOntology(prev, next);
    expect(drift.breaking).toBe(true);
    expect(drift.removedDomains).toContain('governance');
  });
});

describe('observability', () => {
  it('aggregates runtime metrics from telemetry events', () => {
    const { metrics, unsubscribe } = createRuntimeMetricsAggregator();
    emitCognitionTelemetry({
      kind: 'engine_completed',
      engineId: 'e1',
      domain: 'governance',
      organizationId: 'org-1',
      durationMs: 100,
      confidence: 'high',
      evidenceCount: 3,
      reasoningSteps: 2,
    });
    emitCognitionTelemetry({
      kind: 'engine_failed',
      engineId: 'e1',
      domain: 'governance',
      organizationId: 'org-1',
      durationMs: 50,
      error: 'boom',
    });
    expect(metrics.totalEngineRuns).toBe(1);
    expect(metrics.totalEngineFailures).toBe(1);
    expect(metrics.byEngine.e1?.runs).toBe(1);
    expect(metrics.byEngine.e1?.failures).toBe(1);
    unsubscribe();
  });
});

describe('cache', () => {
  beforeEach(async () => {
    await getEnvelopeCacheStore().clear();
  });

  it('builds deterministic cache keys', () => {
    expect(
      envelopeCacheKey({ engineId: 'e', engineVersion: '1', organizationId: 'o' }),
    ).toBe('e@1:o');
  });

  it('memoizes cognition engine within TTL', async () => {
    let calls = 0;
    const invoke = async (organizationId: string) => {
      calls += 1;
      return buildExplainabilityEnvelope({
        organizationId,
        domain: 'governance' as const,
        payload: { calls },
        confidence: 'high' as const,
        engine: 'e',
        engineVersion: '1.0.0',
        contractVersion: COGNITION_CONTRACT_VERSION,
        interpretationGuidance: 'test',
      });
    };
    const memo = memoizeCognitionEngine('e', '1.0.0', invoke, 1_000);
    const first = await memo('org-x');
    const second = await memo('org-x');
    expect(calls).toBe(1);
    expect(first.payload).toEqual(second.payload);
  });
});

describe('intelligent orchestration', () => {
  it('runs steps in dependency tier order with telemetry + trace', async () => {
    const order: string[] = [];
    const make = (id: string, domain: 'governance' | 'continuity' | 'resilience') => async (organizationId: string) => {
      order.push(id);
      return buildExplainabilityEnvelope({
        organizationId,
        domain,
        payload: { id },
        confidence: 'high' as const,
        engine: id,
        engineVersion: '1',
        contractVersion: COGNITION_CONTRACT_VERSION,
        interpretationGuidance: 'x',
      });
    };
    const result = await orchestrateCognitionIntelligent({
      organizationId: 'org-y',
      steps: [
        { engineId: 'res', domain: 'resilience', invoke: make('res', 'resilience') },
        { engineId: 'gov', domain: 'governance', invoke: make('gov', 'governance') },
        { engineId: 'cont', domain: 'continuity', invoke: make('cont', 'continuity') },
      ],
    });
    expect(result.envelopes).toHaveLength(3);
    expect(result.failures).toHaveLength(0);
    expect(result.trace.every((t) => t.status === 'ok')).toBe(true);
    // governance has no feeders present, runs in tier 0
    // continuity is fed by governance → tier 1
    // resilience is fed by continuity → tier 2
    const idxGov = order.indexOf('gov');
    const idxCont = order.indexOf('cont');
    const idxRes = order.indexOf('res');
    expect(idxGov).toBeLessThan(idxCont);
    expect(idxCont).toBeLessThan(idxRes);
  });

  it('records timeout as failure with proper trace status', async () => {
    const slow = async () =>
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('never')), 1_000));
    const result = await orchestrateCognitionIntelligent({
      organizationId: 'org-z',
      steps: [
        {
          engineId: 'slow',
          domain: 'governance',
          invoke: slow as never,
          timeoutMs: 20,
        },
      ],
    });
    expect(result.envelopes).toHaveLength(0);
    expect(result.failures).toHaveLength(1);
    expect(result.trace[0]?.status).toBe('timeout');
  });

  it('skips steps when feeders failed and skipIfFeedersFailed is set', async () => {
    const failing = async () => {
      throw new Error('upstream broke');
    };
    const ok = async (organizationId: string) =>
      buildExplainabilityEnvelope({
        organizationId,
        domain: 'resilience' as const,
        payload: {},
        confidence: 'high' as const,
        engine: 'res',
        engineVersion: '1',
        contractVersion: COGNITION_CONTRACT_VERSION,
        interpretationGuidance: 'x',
      });
    const result = await orchestrateCognitionIntelligent({
      organizationId: 'org-skip',
      steps: [
        { engineId: 'cont', domain: 'continuity', invoke: failing as never },
        { engineId: 'res', domain: 'resilience', invoke: ok, skipIfFeedersFailed: true },
      ],
    });
    expect(result.failures.map((f) => f.engineId)).toContain('cont');
    expect(result.trace.find((t) => t.engineId === 'res')?.status).toBe('skipped');
  });
});
