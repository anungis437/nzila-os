import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadCognitionMemory } = vi.hoisted(() => ({
  loadCognitionMemory: vi.fn(),
}));

vi.mock('@/lib/knowledge-transfer/cognition-memory', () => ({ loadCognitionMemory }));

import { analyzeInstitutionalPrecedent } from '../precedent-intelligence';
import { analyzeOperationalTrust } from '../trust-dynamics';
import { analyzeProcedualContinuity } from '../procedural-intelligence';
import { identifyInstitutionalCorrelations } from '../correlation';

describe('lib/multi-domain-cognition engines', () => {
  beforeEach(() => {
    loadCognitionMemory.mockReset();
  });

  it('analyzeInstitutionalPrecedent returns a profile bound to the org and memory size', async () => {
    loadCognitionMemory.mockResolvedValue({ totalEntries: 42 });
    const result = await analyzeInstitutionalPrecedent('org-1');

    expect(loadCognitionMemory).toHaveBeenCalledWith('org-1', { limit: 100 });
    expect(result.organizationId).toBe('org-1');
    expect(result.entriesAnalyzed).toBe(42);
    expect(result.precedent_chains.length).toBeGreaterThan(0);
  });

  it('analyzeOperationalTrust caps the trust score at 100 for large memories', async () => {
    loadCognitionMemory.mockResolvedValue({ totalEntries: 1000 });
    const result = await analyzeOperationalTrust('org-2');

    expect(result.organizationId).toBe('org-2');
    expect(result.governance_trust_consistency).toBe(100);
    expect(result.trust_dynamics_narrative).toContain('strong');
    expect(result.entriesAnalyzed).toBe(1000);
  });

  it('analyzeOperationalTrust reports moderate trust for small memories', async () => {
    loadCognitionMemory.mockResolvedValue({ totalEntries: 4 });
    const result = await analyzeOperationalTrust('org-3');

    expect(result.governance_trust_consistency).toBe(20);
    expect(result.trust_dynamics_narrative).toContain('moderate');
  });

  it('analyzeProcedualContinuity scales undocumented processes with memory size', async () => {
    loadCognitionMemory.mockResolvedValue({ totalEntries: 25 });
    const result = await analyzeProcedualContinuity('org-4');

    expect(result.organizationId).toBe('org-4');
    expect(result.fragility_indicator.undocumented_processes).toBe(3);
    expect(result.fragility_indicator.continuity_risk).toBe('moderate');
  });

  it('identifyInstitutionalCorrelations returns the correlation matrix', async () => {
    loadCognitionMemory.mockResolvedValue({ totalEntries: 7 });
    const result = await identifyInstitutionalCorrelations('org-5');

    expect(result.organizationId).toBe('org-5');
    expect(result.correlations.length).toBe(5);
    expect(result.entriesAnalyzed).toBe(7);
  });
});
