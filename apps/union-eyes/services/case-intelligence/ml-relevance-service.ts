import { isFeatureEnabled } from '@/lib/services/feature-flags-service';
import { logger } from '@/lib/logger';
import { clampScore } from '@/services/case-intelligence/similarity-provider';
import type { CaseIntelligenceConfig, ExtractedFeatures, IntelligenceContext } from '@/services/case-intelligence/types';

export const CASE_INTELLIGENCE_FEATURE_FLAG = 'case_intelligence_v1';

function readBooleanEnv(name: string, defaultValue: boolean) {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

export async function getCaseIntelligenceConfig(context: IntelligenceContext): Promise<CaseIntelligenceConfig> {
  const featureEnabled = await isFeatureEnabled(CASE_INTELLIGENCE_FEATURE_FLAG, {
    userId: context.actorId,
    organizationId: context.orgId,
  });

  return {
    featureFlag: 'case_intelligence_v1',
    deterministicEnabled: true,
    mlEnabled: featureEnabled && readBooleanEnv('FEATURE_CASE_INTELLIGENCE_V1_ML', false),
    patternsEnabled: featureEnabled && readBooleanEnv('FEATURE_CASE_INTELLIGENCE_V1_PATTERNS', true),
  };
}

export async function computeMlScore(params: {
  context: IntelligenceContext;
  features: ExtractedFeatures;
  candidateId: string;
  config: CaseIntelligenceConfig;
}) {
  if (!params.config.mlEnabled) {
    return {
      mlScore: 0,
      reasons: ['ML reranking disabled; deterministic ranking in effect'],
      available: false,
    };
  }

  try {
    const mlScore = clampScore(
      params.features.semanticSimilarity * 45 +
        params.features.patternSimilarity * 35 +
        (params.features.usedInSimilarCase ? 12 : 0) +
        (params.features.recentAccessByLRO ? 8 : 0),
      0,
      100,
    );

    return {
      mlScore,
      reasons: [
        params.features.semanticSimilarity > 0.2 ? 'Semantic similarity signal' : null,
        params.features.patternSimilarity > 0.2 ? 'Pattern cluster similarity' : null,
        params.features.usedInSimilarCase ? 'Behavioral precedent usage' : null,
      ].filter(Boolean) as string[],
      available: true,
    };
  } catch (error) {
    logger.warn('Case intelligence ML score unavailable; falling back to deterministic score', {
      caseId: params.context.caseId,
      candidateId: params.candidateId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      mlScore: 0,
      reasons: ['ML unavailable; deterministic fallback applied'],
      available: false,
    };
  }
}
