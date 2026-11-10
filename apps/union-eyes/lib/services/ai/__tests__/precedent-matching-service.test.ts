import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockExtract: vi.fn(),
  mockSemanticSearch: vi.fn().mockResolvedValue([]),
  // The rows `tx.select().from(arbitrationDecisions).where(...)` answers inside the organization's own context
  mockCandidates: vi.fn(),
  withRls: vi.fn(),
  sharedDbUse: vi.fn(),
}));

vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: () => ({ extract: mocks.mockExtract }),
  buildOrgAiTrace: vi.fn(() => ({
    component: 'test',
    action: 'mock',
  })),
  toGatewayDataClass: (c: string) => c,
  UE_APP_KEY: 'test-app-key',
  UE_PROFILES: {
    PRECEDENT_KEYWORDS: 'precedent-keywords',
    PRECEDENT_APPLICABILITY: 'precedent-applicability',
    CLAIM_ANALYSIS: 'claim-analysis',
  },
  UE_SYSTEM_ORG_ID: 'system-org-id',
}));

// The shared connection is not tenant-scoped: the service must never read decisions through it, and a test asserts that.
vi.mock('@/db', () => ({
  db: { select: mocks.sharedDbUse, query: { arbitrationDecisions: { findFirst: mocks.sharedDbUse } } },
}));

vi.mock('@/db/schema', () => ({
  arbitrationDecisions: {},
}));

vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: mocks.withRls }));

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
  inArray: vi.fn(),
  relations: vi.fn(() => ({})),
}));

import { matchClaimToPrecedents, analyzeClaimWithPrecedents } from '../precedent-matching-service';

const ORG = 'org-1';

describe('PrecedentMatchingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withRls.mockImplementation(async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) =>
      fn({ select: () => ({ from: () => ({ where: mocks.mockCandidates }) }) }));
    mocks.mockCandidates.mockResolvedValue([]);
  });

  // ────────────────────────────────────────────────────────────────
  // matchClaimToPrecedents
  // ────────────────────────────────────────────────────────────────
  describe('matchClaimToPrecedents', () => {
    it('returns empty when no semantic matches', async () => {
      mocks.mockSemanticSearch.mockResolvedValue([]);

      const results = await matchClaimToPrecedents({
        organizationId: ORG,
        facts: 'Employee was terminated without notice.',
        issueType: 'wrongful_dismissal',
      });

      expect(results).toEqual([]);
      // Nothing to read: no decision is fetched for an empty search
      expect(mocks.withRls).not.toHaveBeenCalled();
    });

    it('refuses a match that does not say which organization it is for, before any search or provider call', async () => {
      await expect(
        matchClaimToPrecedents({ facts: 'Employee was terminated without notice.', issueType: 'wrongful_dismissal' }),
      ).rejects.toThrow('organizationId is required to match precedents');
      await expect(
        matchClaimToPrecedents({ organizationId: '', facts: 'Employee was terminated without notice.', issueType: 'wrongful_dismissal' }),
      ).rejects.toThrow('organizationId is required to match precedents');

      expect(mocks.mockSemanticSearch).not.toHaveBeenCalled();
      expect(mocks.mockExtract).not.toHaveBeenCalled();
      expect(mocks.withRls).not.toHaveBeenCalled();
    });

    it('validates that weights sum to 1.0', async () => {
      await expect(
        matchClaimToPrecedents(
          { organizationId: ORG, facts: 'test', issueType: 'discipline' },
          { weightSemanticSimilarity: 0.5, weightKeywordMatch: 0.3, weightMetadata: 0.3 }
        )
      ).rejects.toThrow('Weights must sum to 1.0');
    });

    it('enriches semantic results with the decisions read in the organization\'s own context', async () => {
      mocks.mockSemanticSearch.mockResolvedValue([
        { id: 'p1', content: 'Case about dismissal', similarity: 0.85, metadata: {} },
      ]);

      // Mock keyword extraction
      mocks.mockExtract.mockResolvedValue({
        data: { keywords: ['dismissal', 'just cause', 'progressive discipline'] },
      });

      // The decision the organization's context lets the caller see
      mocks.mockCandidates.mockResolvedValue([{
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
      }]);

      const results = await matchClaimToPrecedents(
        { organizationId: ORG, facts: 'Employee was dismissed for misconduct.', issueType: 'wrongful_dismissal' },
        { includeDistinctions: false, minRelevance: 0 }
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].caseTitle).toBe('Smith v. ABC Corp');
      expect(results[0].relevanceScore).toBeGreaterThan(0);
      expect(mocks.mockSemanticSearch).toHaveBeenCalledWith('Employee was dismissed for misconduct.', expect.objectContaining({ organizationId: ORG }));
      expect(mocks.withRls).toHaveBeenCalledTimes(1);
      expect(mocks.withRls).toHaveBeenCalledWith({ organizationId: ORG }, expect.any(Function));
      expect(mocks.sharedDbUse).not.toHaveBeenCalled();
    });

    it('returns, and asks the provider about, only the decisions the organization\'s context lets the caller see', async () => {
      mocks.mockSemanticSearch.mockResolvedValue([
        { id: 'p1', content: 'Case about dismissal', similarity: 0.9, metadata: {} },
        { id: 'other-org-decision', content: 'Another organization\'s case', similarity: 0.95, metadata: {} },
      ]);
      mocks.mockExtract.mockResolvedValue({ data: { keywords: ['dismissal'] } });
      mocks.mockCandidates.mockResolvedValue([{
        id: 'p1',
        caseTitle: 'Visible Case',
        caseNumber: '2025-002',
        outcome: 'grievance_upheld',
        precedentValue: 'high',
        keyFacts: 'dismissal',
        reasoning: 'dismissal',
        citationCount: 1,
        issueType: 'wrongful_dismissal',
      }]);

      const results = await matchClaimToPrecedents(
        { organizationId: ORG, facts: 'Dismissal case.', issueType: 'wrongful_dismissal' },
        { minRelevance: 0 },
      );

      expect(results.map((match) => match.precedentId)).toEqual(['p1']);
      // One call for the keywords and one for the applicability of the single visible decision
      expect(mocks.mockExtract).toHaveBeenCalledTimes(2);
    });

    it('filters out results below minimum relevance', async () => {
      mocks.mockSemanticSearch.mockResolvedValue([
        { id: 'p1', content: 'Barely related', similarity: 0.2, metadata: {} },
      ]);

      mocks.mockExtract.mockResolvedValue({ data: { keywords: [] } });
      mocks.mockCandidates.mockResolvedValue([{
        id: 'p1',
        caseTitle: 'Low Relevance Case',
        caseNumber: '2025-099',
        outcome: 'dismissed',
        precedentValue: 'low',
        keyFacts: 'Unrelated wage dispute',
        reasoning: 'N/A',
        citationCount: 0,
        issueType: 'wages',
      }]);

      const results = await matchClaimToPrecedents(
        { organizationId: ORG, facts: 'Employee harassment complaint.', issueType: 'harassment' },
        { minRelevance: 0.6 }
      );

      expect(results).toEqual([]);
    });

    it('reports a failed search instead of answering it as "no precedents"', async () => {
      mocks.mockSemanticSearch.mockRejectedValue(new Error('Vector DB down'));

      await expect(matchClaimToPrecedents({
        organizationId: ORG,
        facts: 'test',
        issueType: 'discipline',
      })).rejects.toThrow('Vector DB down');
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
        organizationId: ORG,
        facts: 'Unique case with no precedent.',
        issueType: 'other',
      });

      expect(analysis).toHaveProperty('matches');
      expect(analysis).toHaveProperty('predictedOutcome');
      expect(analysis).toHaveProperty('strengthAnalysis');
      expect(analysis).toHaveProperty('suggestedArguments');
      expect(analysis.matches).toEqual([]);
    });

    it('refuses an analysis that does not say which organization it is for, before the provider is asked anything', async () => {
      await expect(analyzeClaimWithPrecedents({
        facts: 'Unique case with no precedent.',
        issueType: 'other',
      })).rejects.toThrow('organizationId is required to match precedents');

      expect(mocks.mockSemanticSearch).not.toHaveBeenCalled();
      expect(mocks.mockExtract).not.toHaveBeenCalled();
    });
  });
});
