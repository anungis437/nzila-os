export type IntelligenceContext = {
  caseId: string;
  orgId: string;
  actorId: string;
};

export type RelatedDocumentRankResult = {
  documentId: string;
  title: string;
  privacyLabel: string;
  finalScore: number;
  baseScore: number;
  mlScore: number;
  reasons: string[];
  scoreBreakdown: Record<string, number>;
  documentType?: string | null;
  fileUrl?: string;
  linkedEntities?: string[];
  updatedAt?: string;
};

export type SimilarCaseResult = {
  caseId: string;
  score: number;
  matchReasons: string[];
  matchedDimensions: Record<string, boolean>;
  title?: string;
  grievanceNumber?: string;
  status?: string;
};

export type IntelligenceResponse = {
  graph: {
    nodes: Array<{ id: string; type: string; [key: string]: any }>;
    edges: Array<{ id: string; type: string; [key: string]: any }>;
  };
  relatedDocuments: RelatedDocumentRankResult[];
  similarCases: SimilarCaseResult[];
  precedentDocuments: RelatedDocumentRankResult[];
};

export type CaseIntelligenceConfig = {
  featureFlag: 'case_intelligence_v1';
  deterministicEnabled: true;
  mlEnabled: boolean;
  patternsEnabled: boolean;
};

export type DocumentCandidate = {
  id: string;
  title: string | null;
  filename: string | null;
  name: string;
  privacyLabel: string;
  documentType: string | null;
  fileUrl: string;
  updatedAt: Date;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  tags: string[] | null;
  uploadedBy: string | null;
};

export type CaseSnapshot = {
  id: string;
  grievanceNumber?: string | null;
  title: string;
  description: string;
  type?: string | null;
  status?: string | null;
  grievantId?: string | null;
  employerId?: string | null;
  employerName?: string | null;
  workplaceId?: string | null;
  workplaceName?: string | null;
  cbaId?: string | null;
  cbaArticle?: string | null;
  unionRepId?: string | null;
  createdBy?: string | null;
  awardSummary?: string | null;
  organizationId: string;
  createdAt?: Date | null;
};

export type ExtractedFeatures = {
  sameCase: boolean;
  sameMember: boolean;
  sameAgreement: boolean;
  sameEmployer: boolean;
  sameWorksite: boolean;
  sharedTags: number;
  sameDocumentType: boolean;
  recentAccessByLRO: boolean;
  semanticSimilarity: number;
  patternSimilarity: number;
  usedInSimilarCase: boolean;
  isTemplateCandidate: boolean;
};
