import type { CaseSnapshot, DocumentCandidate, ExtractedFeatures } from '@/services/case-intelligence/types';

export function extractFeatures(params: {
  currentCase: CaseSnapshot;
  candidate: DocumentCandidate;
  sameCase: boolean;
  sameDocumentType: boolean;
  directTags: Set<string>;
  assignedLroIds: Set<string>;
  semanticSimilarity?: number;
  patternSimilarity?: number;
  usedInSimilarCase?: boolean;
  isTemplateCandidate?: boolean;
}) {
  const linkedId = params.candidate.linkedEntityId;
  const linkedType = params.candidate.linkedEntityType;
  const candidateTags = (params.candidate.tags ?? []).map((tag) => tag.toLowerCase());
  const sharedTags = candidateTags.filter((tag) => params.directTags.has(tag)).length;

  return {
    sameCase: params.sameCase,
    sameMember: Boolean(
      params.currentCase.grievantId && linkedType === 'member' && linkedId === params.currentCase.grievantId,
    ),
    sameAgreement: Boolean(
      params.currentCase.cbaId && linkedType === 'collective_agreement' && linkedId === params.currentCase.cbaId,
    ),
    sameEmployer: Boolean(
      params.currentCase.employerId && linkedType === 'employer' && linkedId === params.currentCase.employerId,
    ),
    sameWorksite: Boolean(
      params.currentCase.workplaceId && linkedType === 'worksite' && linkedId === params.currentCase.workplaceId,
    ),
    sharedTags,
    sameDocumentType: params.sameDocumentType,
    recentAccessByLRO: Boolean(params.candidate.uploadedBy && params.assignedLroIds.has(params.candidate.uploadedBy)),
    semanticSimilarity: params.semanticSimilarity ?? 0,
    patternSimilarity: params.patternSimilarity ?? 0,
    usedInSimilarCase: params.usedInSimilarCase ?? false,
    isTemplateCandidate: params.isTemplateCandidate ?? false,
  } satisfies ExtractedFeatures;
}
