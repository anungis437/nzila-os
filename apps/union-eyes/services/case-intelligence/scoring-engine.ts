import type { ExtractedFeatures } from '@/services/case-intelligence/types';

const WEIGHTS = {
  sameCase: 50,
  sameMember: 30,
  sameAgreement: 25,
  sameEmployer: 20,
  sameWorksite: 20,
  sharedTags: 15,
  sameDocumentType: 10,
  recentAccessByLRO: 10,
  usedInSimilarCase: 18,
  isTemplateCandidate: 12,
} as const;

export function computeBaseScore(features: ExtractedFeatures) {
  const scoreBreakdown: Record<string, number> = {
    sameCase: features.sameCase ? WEIGHTS.sameCase : 0,
    sameMember: features.sameMember ? WEIGHTS.sameMember : 0,
    sameAgreement: features.sameAgreement ? WEIGHTS.sameAgreement : 0,
    sameEmployer: features.sameEmployer ? WEIGHTS.sameEmployer : 0,
    sameWorksite: features.sameWorksite ? WEIGHTS.sameWorksite : 0,
    sharedTags: features.sharedTags > 0 ? WEIGHTS.sharedTags : 0,
    sameDocumentType: features.sameDocumentType ? WEIGHTS.sameDocumentType : 0,
    recentAccessByLRO: features.recentAccessByLRO ? WEIGHTS.recentAccessByLRO : 0,
    usedInSimilarCase: features.usedInSimilarCase ? WEIGHTS.usedInSimilarCase : 0,
    isTemplateCandidate: features.isTemplateCandidate ? WEIGHTS.isTemplateCandidate : 0,
  };

  const baseScore = Object.values(scoreBreakdown).reduce((total, value) => total + value, 0);
  const reasons = [
    features.sameCase ? 'Directly linked to this case' : null,
    features.sameMember ? 'Same member' : null,
    features.sameAgreement ? 'Same agreement' : null,
    features.sameEmployer || features.sameWorksite ? 'Same employer/worksite' : null,
    features.sharedTags > 0 ? 'Shared tags/topic' : null,
    features.sameDocumentType ? 'Same document type' : null,
    features.recentAccessByLRO ? 'Used by assigned LRO' : null,
    features.usedInSimilarCase ? 'Used in similar case' : null,
    features.isTemplateCandidate ? 'Template or precedent candidate' : null,
  ].filter(Boolean) as string[];

  return {
    baseScore,
    reasons,
    scoreBreakdown,
  };
}

export function mergeScores(params: {
  baseScore: number;
  mlScore: number;
  mlEnabled: boolean;
}) {
  if (!params.mlEnabled) {
    return params.baseScore;
  }

  return Number((params.baseScore * 0.7 + params.mlScore * 0.3).toFixed(2));
}
