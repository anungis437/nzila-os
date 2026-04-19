import type { AbrDataMode } from '@/lib/data-mode';

export type IntelligenceTrustLevel = 'low' | 'medium' | 'high';
export type IntelligenceReviewStatus = 'pending' | 'approved' | 'flagged' | 'needs_update';

export interface RiskSignal {
  id: string;
  orgId: string;
  signal: string;
  category: 'hiring' | 'promotion' | 'discipline' | 'service_delivery' | 'policy';
  confidenceBand: 'low' | 'medium' | 'high';
  trend: 'up' | 'flat' | 'down';
  observedAt: string;
}

export interface IntelligenceCaseRecord {
  id: string;
  sourceId: string;
  dataMode: AbrDataMode;
  jurisdiction: string;
  year: number;
  sector: string;
  decisionBody: string;
  issueType: string;
  protectedGrounds: string[];
  remedyType: string;
  awardRange: string;
  employerType: string;
  title: string;
  conciseSummary: string;
  keyHoldings: string[];
  facts: string;
  issues: string[];
  reasoningSummary: string;
  remedies: string[];
  lessonsForInstitutions: string[];
  relatedCaseIds: string[];
  timelines: string[];
  riskPatterns: string[];
  trendIndicators: string[];
  source: string;
  ingestionType: 'manual_json' | 'manual_csv' | 'source_sync';
  ingestionDate: string;
  confidenceLevel: IntelligenceTrustLevel;
  lastReviewStatus: IntelligenceReviewStatus;
  lastReviewedAt: string | null;
  awardAmount: string;
  parsedConfidence: number;
  sourceStatus: 'verified' | 'review_required' | 'stale';
  freshnessDate: string;
  provenanceNote: string;
}

export interface IntelligenceFilters {
  jurisdiction?: string;
  year?: string;
  sector?: string;
  decisionBody?: string;
  issueType?: string;
  protectedGround?: string;
  remedyType?: string;
  awardRange?: string;
  employerType?: string;
  reviewStatus?: IntelligenceReviewStatus;
  search?: string;
  page?: number;
  pageSize?: number;
  dataMode?: AbrDataMode;
}

export interface IntelligenceListResult {
  items: IntelligenceCaseRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ExecutiveInsightWidgets {
  risingIssueCategories: Array<{ label: string; deltaPct: number }>;
  repeatSectorTrends: Array<{ sector: string; pattern: string }>;
  averageAwardsOverTime: Array<{ year: number; averageRange: string }>;
  complaintLifecycleBenchmarks: Array<{ stage: string; avgDays: number }>;
}

export interface SourceRegistryItem {
  id: string;
  sourceName: string;
  jurisdiction: string;
  ingestionType: 'manual_json' | 'manual_csv' | 'source_sync';
  sourceType: 'tribunal' | 'court' | 'ombudsman' | 'manual_upload';
  lawfulBasis: string;
  freshnessDate: string;
  lastIngestedAt: string;
  trustLevel: IntelligenceTrustLevel;
  dataMode: AbrDataMode;
  stale: boolean;
}

export interface ImportJobRecord {
  id: string;
  sourceId: string;
  dataMode: AbrDataMode;
  format: 'json' | 'csv';
  parseStatus: 'queued' | 'parsed' | 'review_required' | 'error';
  dedupeStatus: 'clear' | 'possible_duplicate' | 'deduped' | 'error';
  confidenceLabel: IntelligenceTrustLevel;
  startedAt: string;
  completedAt: string | null;
  errorCount: number;
}

export interface ManualReviewQueueItem {
  id: string;
  caseId: string;
  status: IntelligenceReviewStatus;
  reason: string;
  priority: 'normal' | 'urgent';
  reviewerId?: string | null;
  lastReviewedAt?: string | null;
  dataMode: AbrDataMode;
}

export interface IntelligenceIngestInput {
  sourceId?: string;
  sourceName: string;
  jurisdiction: string;
  ingestionType: 'manual_json' | 'manual_csv';
  format: 'json' | 'csv';
  content: string;
  dataMode: AbrDataMode;
}

export interface IntelligenceIngestResult {
  job: ImportJobRecord;
  insertedCount: number;
  duplicateCount: number;
  reviewCount: number;
  errors: string[];
}
