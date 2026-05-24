import { describe, expect, it } from 'vitest';
import {
  assertLaborSafe,
  CognitionGovernanceViolation,
  buildExplainabilityEnvelope,
  confidenceBandFromScore,
  defineCognitionEngine,
  maturityFromScore,
  orchestrateCognition,
  cognitionRegistry,
  COGNITION_CONTRACT_VERSION,
} from '../src/index.js';

describe('institutional-cognition-core', () => {
  it('confidenceBandFromScore maps correctly', () => {
    expect(confidenceBandFromScore(0)).toBe('insufficient_data');
    expect(confidenceBandFromScore(20)).toBe('low');
    expect(confidenceBandFromScore(50)).toBe('moderate');
    expect(confidenceBandFromScore(70)).toBe('high');
    expect(confidenceBandFromScore(95)).toBe('very_high');
  });

  it('maturityFromScore maps correctly', () => {
    expect(maturityFromScore(10)).toBe('emergent');
    expect(maturityFromScore(45)).toBe('developing');
    expect(maturityFromScore(70)).toBe('mature');
    expect(maturityFromScore(90)).toBe('advanced');
  });

  it('assertLaborSafe rejects individual-scope cognition', () => {
    expect(() =>
      assertLaborSafe({
        organizationId: 'org-1',
        domain: 'governance',
        scopeOfObservation: 'individual',
      }),
    ).toThrow(CognitionGovernanceViolation);
  });

  it('assertLaborSafe rejects ranking individuals', () => {
    expect(() =>
      assertLaborSafe({
        organizationId: 'org-1',
        domain: 'governance',
        scopeOfObservation: 'organizational',
        ranksIndividuals: true,
      }),
    ).toThrow(CognitionGovernanceViolation);
  });

  it('defineCognitionEngine wraps payload in canonical envelope', async () => {
    const engine = defineCognitionEngine<{ score: number }>({
      engineId: 'test-engine',
      engineVersion: '1.0.0',
      domain: 'governance',
      compute: async () => ({
        payload: { score: 42 },
        confidenceScore: 75,
        interpretationGuidance: 'For testing only.',
      }),
    });
    const env = await engine('org-1');
    expect(env.organizationId).toBe('org-1');
    expect(env.domain).toBe('governance');
    expect(env.payload).toEqual({ score: 42 });
    expect(env.confidence).toBe('high');
    expect(env.provenance.engine).toBe('test-engine');
    expect(env.provenance.contractVersion).toBe(COGNITION_CONTRACT_VERSION);
  });

  it('orchestrateCognition aggregates envelopes and isolates failures', async () => {
    const ok = defineCognitionEngine<{ ok: true }>({
      engineId: 'ok-engine',
      engineVersion: '1.0.0',
      domain: 'continuity',
      compute: async () => ({
        payload: { ok: true },
        confidenceScore: 80,
        interpretationGuidance: 'OK',
      }),
    });
    const result = await orchestrateCognition({
      organizationId: 'org-1',
      steps: [
        { engineId: 'ok-engine', domain: 'continuity', invoke: ok },
        {
          engineId: 'broken-engine',
          domain: 'resilience',
          invoke: async () => {
            throw new Error('boom');
          },
        },
      ],
    });
    expect(result.envelopes).toHaveLength(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.engineId).toBe('broken-engine');
  });

  it('cognition registry rejects engines without explainability', () => {
    expect(() =>
      cognitionRegistry.register({
        id: 'bad',
        version: '1.0.0',
        domains: ['governance'],
        description: 'no explainability',
        readonly: true,
        emitsExplainability: false as unknown as true,
        contractVersion: COGNITION_CONTRACT_VERSION,
      }),
    ).toThrow();
  });

  it('buildExplainabilityEnvelope fills sane defaults', () => {
    const env = buildExplainabilityEnvelope({
      organizationId: 'org-1',
      domain: 'systems_coherence',
      payload: { hello: 'world' },
      confidence: 'moderate',
      engine: 'x',
      engineVersion: '1.0.0',
      contractVersion: COGNITION_CONTRACT_VERSION,
      interpretationGuidance: 'guidance',
    });
    expect(env.evidence).toEqual([]);
    expect(env.reasoning).toEqual([]);
    expect(env.assumptions).toEqual([]);
    expect(env.governanceImplications).toEqual([]);
  });
});
