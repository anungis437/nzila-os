import { beforeEach, describe, expect, it, vi } from 'vitest';

const isFeatureEnabled = vi.fn();
vi.mock('@/lib/services/feature-flags-service', () => ({ isFeatureEnabled }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

describe('case-intelligence ml-relevance-service', () => {
  beforeEach(() => {
    vi.resetModules();
    isFeatureEnabled.mockReset();
    delete process.env.FEATURE_CASE_INTELLIGENCE_V1_ML;
    delete process.env.FEATURE_CASE_INTELLIGENCE_V1_PATTERNS;
  });

  it('falls back to deterministic mode when ML flag is disabled', async () => {
    isFeatureEnabled.mockResolvedValue(false);
    const { getCaseIntelligenceConfig, computeMlScore } = await import('./ml-relevance-service');

    const config = await getCaseIntelligenceConfig({ caseId: 'case-1', orgId: 'org-1', actorId: 'user-1' });
    const result = await computeMlScore({
      context: { caseId: 'case-1', orgId: 'org-1', actorId: 'user-1' },
      candidateId: 'doc-1',
      config,
      features: {
        sameCase: true,
        sameMember: false,
        sameAgreement: false,
        sameEmployer: false,
        sameWorksite: false,
        sharedTags: 1,
        sameDocumentType: true,
        recentAccessByLRO: false,
        semanticSimilarity: 0.8,
        patternSimilarity: 0.7,
        usedInSimilarCase: true,
        isTemplateCandidate: false,
      },
    });

    expect(config.mlEnabled).toBe(false);
    expect(result.mlScore).toBe(0);
    expect(result.reasons[0]).toContain('deterministic');
  });
});
