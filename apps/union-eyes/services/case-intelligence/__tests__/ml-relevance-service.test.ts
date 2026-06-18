import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { isFeatureEnabledMock, loggerWarnMock } = vi.hoisted(() => ({
  isFeatureEnabledMock: vi.fn(),
  loggerWarnMock: vi.fn(),
}));

vi.mock('@/lib/services/feature-flags-service', () => ({
  isFeatureEnabled: isFeatureEnabledMock,
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: loggerWarnMock, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  CASE_INTELLIGENCE_FEATURE_FLAG,
  computeMlScore,
  getCaseIntelligenceConfig,
} from '../ml-relevance-service';
import type { CaseIntelligenceConfig, ExtractedFeatures, IntelligenceContext } from '../types';

const context: IntelligenceContext = { caseId: 'case-1', orgId: 'org-1', actorId: 'actor-1' };

function makeFeatures(overrides: Partial<ExtractedFeatures> = {}): ExtractedFeatures {
  return {
    sameCase: false,
    sameMember: false,
    sameAgreement: false,
    sameEmployer: false,
    sameWorksite: false,
    sharedTags: 0,
    sameDocumentType: false,
    recentAccessByLRO: false,
    semanticSimilarity: 0,
    patternSimilarity: 0,
    usedInSimilarCase: false,
    isTemplateCandidate: false,
    ...overrides,
  };
}

describe('case-intelligence/ml-relevance-service', () => {
  beforeEach(() => {
    isFeatureEnabledMock.mockReset();
    loggerWarnMock.mockReset();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exposes the feature flag constant', () => {
    expect(CASE_INTELLIGENCE_FEATURE_FLAG).toBe('case_intelligence_v1');
  });

  describe('getCaseIntelligenceConfig', () => {
    it('enables ML and patterns based on env when the feature is on', async () => {
      isFeatureEnabledMock.mockResolvedValue(true);
      vi.stubEnv('FEATURE_CASE_INTELLIGENCE_V1_ML', 'true');
      vi.stubEnv('FEATURE_CASE_INTELLIGENCE_V1_PATTERNS', '1');

      const config = await getCaseIntelligenceConfig(context);

      expect(config.mlEnabled).toBe(true);
      expect(config.patternsEnabled).toBe(true);
      expect(config.deterministicEnabled).toBe(true);
      expect(isFeatureEnabledMock).toHaveBeenCalledWith('case_intelligence_v1', {
        userId: 'actor-1',
        organizationId: 'org-1',
      });
    });

    it('defaults patterns to true and ML to false when env unset', async () => {
      isFeatureEnabledMock.mockResolvedValue(true);

      const config = await getCaseIntelligenceConfig(context);

      expect(config.mlEnabled).toBe(false);
      expect(config.patternsEnabled).toBe(true);
    });

    it('disables ML and patterns when the feature flag is off', async () => {
      isFeatureEnabledMock.mockResolvedValue(false);
      vi.stubEnv('FEATURE_CASE_INTELLIGENCE_V1_ML', 'true');

      const config = await getCaseIntelligenceConfig(context);

      expect(config.mlEnabled).toBe(false);
      expect(config.patternsEnabled).toBe(false);
    });
  });

  describe('computeMlScore', () => {
    const enabledConfig: CaseIntelligenceConfig = {
      featureFlag: 'case_intelligence_v1',
      deterministicEnabled: true,
      mlEnabled: true,
      patternsEnabled: true,
    };

    it('returns a disabled response when ML is off', async () => {
      const result = await computeMlScore({
        context,
        features: makeFeatures(),
        candidateId: 'doc-1',
        config: { ...enabledConfig, mlEnabled: false },
      });

      expect(result.available).toBe(false);
      expect(result.mlScore).toBe(0);
      expect(result.reasons[0]).toMatch(/deterministic ranking/i);
    });

    it('computes a clamped score with similarity reasons', async () => {
      const result = await computeMlScore({
        context,
        features: makeFeatures({
          semanticSimilarity: 0.5,
          patternSimilarity: 0.5,
          usedInSimilarCase: true,
          recentAccessByLRO: true,
        }),
        candidateId: 'doc-1',
        config: enabledConfig,
      });

      // 0.5*45 + 0.5*35 + 12 + 8 = 60
      expect(result.available).toBe(true);
      expect(result.mlScore).toBe(60);
      expect(result.reasons).toContain('Semantic similarity signal');
      expect(result.reasons).toContain('Pattern cluster similarity');
      expect(result.reasons).toContain('Behavioral precedent usage');
    });

    it('omits weak similarity reasons below threshold', async () => {
      const result = await computeMlScore({
        context,
        features: makeFeatures({ semanticSimilarity: 0.1, patternSimilarity: 0.1 }),
        candidateId: 'doc-1',
        config: enabledConfig,
      });

      expect(result.reasons).not.toContain('Semantic similarity signal');
      expect(result.reasons).not.toContain('Pattern cluster similarity');
    });
  });
});
