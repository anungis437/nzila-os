import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockExtract: vi.fn(),
  mockSemanticSearch: vi.fn().mockResolvedValue([]),
  mockDbQuery: {
    arbitrationDecisions: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: () => ({ extract: mocks.mockExtract }),
  buildOrgAiTrace: vi.fn(() => ({
    component: 'test',
    action: 'mock',
  })),
  UE_APP_KEY: 'test-app-key',
  UE_PROFILES: {
    PRECEDENT_KEYWORDS: 'precedent-keywords',
    PRECEDENT_APPLICABILITY: 'precedent-applicability',
    CLAIM_ANALYSIS: 'claim-analysis',
  },
  UE_SYSTEM_ORG_ID: 'system-org-id',
}));

vi.mock('@/db', () => ({
  db: { query: mocks.mockDbQuery },
}));

vi.mock('@/db/schema', () => ({
  arbitrationDecisions: {},
}));

vi.mock('../vector-search-service', () => ({
  semanticPrecedentSearch: mocks.mockSemanticSearch,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  sql: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  relations: vi.fn(() => ({})),
}));

import { matchClaimToPrecedents, analyzeClaimWithPrecedents } from '../precedent-matching-service';

describe('PrecedentMatchingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────────────
  // matchClaimToPrecedents
  // ────────────────────────────────────────────────────────────────
  describe('matchClaimToPrecedents', () => {
    it('returns empty when no semantic matches', async () => {
      mocks.mockSemanticSearch.mockResolvedValue([]);

      const results = await matchClaimToPrecedents({
        facts: 'Employee was terminated without notice.',
        issueType: 'wrongful_dismissal',
      });

      expect(results).toEqual([]);
    });

    it('validates that weights sum to 1.0', async () => {
      await expect(
        matchClaimToPrecedents(
          { facts: 'test', issueType: 'discipline' },
          { weightSemanticSimilarity: 0.5, weightKeywordMatch: 0.3, weightMetadata: 0.3 }
        )
      ).rejects.toThrow('Weights must sum to 1.0');
    });

    it('enriches semantic results with DB precedent data', async () => {
      mocks.mockSemanticSearch.mockResolvedValue([
        { id: 'p1', content: 'Case about dismissal', similarity: 0.85, metadata: {} },
      ]);

      // Mock keyword extraction
      mocks.mockExtract.mockResolvedValue({
        data: { keywords: ['dismissal', 'just cause', 'progressive discipline'] },
      });

      // Mock DB precedent lookup
      mocks.mockDbQuery.arbitrationDecisions.findFirst.mockResolvedValue({
        id: 'p1',
        caseTitle: 'Smith v. ABC Corp',
        caseNumber: '2025-001',
        outcome: 'grievance_upheld',
        precedentValue: 'high',
        keyFacts: 'Employee dismissed without progressive discipline',
        reasoning: 'Just cause standard requires progressive discipline',
        citationCount: 15,
        issueType: 'wrongful_dismissal',
        jurisdictionType: 'ontario',
      });

      const results = await matchClaimToPrecedents(
        { facts: 'Employee was dismissed for misconduct.', issueType: 'wrongful_dismissal' },
        { includeDistinctions: false, minRelevance: 0 }
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].caseTitle).toBe('Smith v. ABC Corp');
      expect(results[0].relevanceScore).toBeGreaterThan(0);
    });

    it('filters out results below minimum relevance', async () => {
      mocks.mockSemanticSearch.mockResolvedValue([
        { id: 'p1', content: 'Barely related', similarity: 0.2, metadata: {} },
      ]);

      mocks.mockExtract.mockResolvedValue({ data: { keywords: [] } });
      mocks.mockDbQuery.arbitrationDecisions.findFirst.mockResolvedValue({
        id: 'p1',
        caseTitle: 'Low Relevance Case',
        caseNumber: '2025-099',
        outcome: 'dismissed',
        precedentValue: 'low',
        keyFacts: 'Unrelated wage dispute',
        reasoning: 'N/A',
        citationCount: 0,
        issueType: 'wages',
      });

      const results = await matchClaimToPrecedents(
        { facts: 'Employee harassment complaint.', issueType: 'harassment' },
        { minRelevance: 0.6 }
      );

      expect(results).toEqual([]);
    });

    it('returns empty on error (fail gracefully)', async () => {
      mocks.mockSemanticSearch.mockRejectedValue(new Error('Vector DB down'));

      const results = await matchClaimToPrecedents({
        facts: 'test',
        issueType: 'discipline',
      });

      expect(results).toEqual([]);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // analyzeClaimWithPrecedents
  // ────────────────────────────────────────────────────────────────
  describe('analyzeClaimWithPrecedents', () => {
    it('returns analysis structure with no matches', async () => {
      mocks.mockSemanticSearch.mockResolvedValue([]);
      mocks.mockExtract.mockResolvedValue({
        data: {
          outcomeReasoning: 'No precedents available.',
          strengths: [],
          weaknesses: [],
          criticalFactors: [],
          suggestedArguments: [],
        },
      });

      const analysis = await analyzeClaimWithPrecedents({
        facts: 'Unique case with no precedent.',
        issueType: 'other',
      });

      expect(analysis).toHaveProperty('matches');
      expect(analysis).toHaveProperty('predictedOutcome');
      expect(analysis).toHaveProperty('strengthAnalysis');
      expect(analysis).toHaveProperty('suggestedArguments');
      expect(analysis.matches).toEqual([]);
    });
  });
});
