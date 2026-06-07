import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExtract = vi.hoisted(() => vi.fn());

vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: () => ({ extract: mockExtract }),
  UE_APP_KEY: 'test-app-key',
  UE_PROFILES: {
    CLAUSE_CLASSIFICATION: 'clause-classification',
    TAG_GENERATION: 'tag-generation',
    CROSS_REFERENCE: 'cross-reference',
    PRECEDENT_CLASSIFICATION: 'precedent-classification',
  },
  UE_SYSTEM_ORG_ID: 'system-org-id',
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  classifyClause,
  generateClauseTags,
  detectCrossReferences,
  classifyPrecedent,
  batchClassifyClauses,
  enrichClauseMetadata,
  validateClassification,
  evaluateClassificationQuality,
} from '../auto-classification-service';

describe('AutoClassificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────────────
  // classifyClause
  // ────────────────────────────────────────────────────────────────
  describe('classifyClause', () => {
    it('returns AI classification result', async () => {
      mockExtract.mockResolvedValue({
        data: {
          clauseType: 'wages_compensation',
          confidence: 0.92,
          alternativeTypes: [{ type: 'overtime', confidence: 0.3 }],
          reasoning: 'Clause discusses wage scales and pay increases',
        },
      });

      const result = await classifyClause(
        'Employees shall receive a 3% wage increase effective January 1.',
        { jurisdiction: 'ontario', sector: 'public' }
      );

      expect(result.clauseType).toBe('wages_compensation');
      expect(result.confidence).toBe(0.92);
      expect(result.alternativeTypes).toHaveLength(1);
      expect(result.reasoning).toContain('wage');
      expect(mockExtract).toHaveBeenCalledOnce();
    });

    it('includes context in prompt when provided', async () => {
      mockExtract.mockResolvedValue({
        data: { clauseType: 'health_safety', confidence: 0.85, reasoning: 'Safety clause' },
      });

      await classifyClause('Workers must wear PPE', {
        title: 'Safety Equipment',
        clauseNumber: '15.01',
        jurisdiction: 'alberta',
        sector: 'construction',
      });

      const call = mockExtract.mock.calls[0][0];
      expect(call.input).toContain('Title: Safety Equipment');
      expect(call.input).toContain('Clause Number: 15.01');
    });

    it('falls back to "other" on AI error', async () => {
      mockExtract.mockRejectedValue(new Error('API rate limit'));

      const result = await classifyClause('Some clause text');
      expect(result.clauseType).toBe('other');
      expect(result.confidence).toBe(0.1);
    });

    it('handles missing fields in AI response', async () => {
      mockExtract.mockResolvedValue({ data: {} });

      const result = await classifyClause('text');
      expect(result.clauseType).toBe('other');
      expect(result.confidence).toBe(0.5);
      expect(result.alternativeTypes).toEqual([]);
    });

    it('invokes low-confidence callback when below threshold', async () => {
      mockExtract.mockResolvedValue({
        data: {
          clauseType: 'other',
          confidence: 0.4,
          reasoning: 'insufficient context',
        },
      });

      const onLowConfidence = vi.fn();
      await classifyClause('ambiguous text', undefined, {
        policy: { autoAcceptThreshold: 0.9, reviewThreshold: 0.65 },
        onLowConfidence,
      });

      expect(onLowConfidence).toHaveBeenCalledOnce();
      expect(onLowConfidence.mock.calls[0][0]).toMatchObject({
        threshold: 0.65,
        confidence: 0.4,
      });
    });
  });

  describe('evaluateClassificationQuality', () => {
    it('returns auto_accept for high confidence', () => {
      const q = evaluateClassificationQuality(
        { confidence: 0.93 },
        { autoAcceptThreshold: 0.9, reviewThreshold: 0.65 },
      );
      expect(q.decision).toBe('auto_accept');
    });

    it('returns needs_review for lower confidence', () => {
      const q = evaluateClassificationQuality(
        { confidence: 0.72 },
        { autoAcceptThreshold: 0.9, reviewThreshold: 0.65 },
      );
      expect(q.decision).toBe('needs_review');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // generateClauseTags
  // ────────────────────────────────────────────────────────────────
  describe('generateClauseTags', () => {
    it('returns AI-generated tags', async () => {
      mockExtract.mockResolvedValue({
        data: {
          tags: ['wage_increase', 'annual_increment', 'retroactive_pay'],
          confidence: 0.88,
        },
      });

      const result = await generateClauseTags(
        'Annual wage increase of 3%',
        'wages_compensation'
      );

      expect(result.tags).toHaveLength(3);
      expect(result.tags).toContain('wage_increase');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('returns empty tags on error', async () => {
      mockExtract.mockRejectedValue(new Error('timeout'));

      const result = await generateClauseTags('text', 'other');
      expect(result.tags).toEqual([]);
      expect(result.confidence).toBe(0.1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // detectCrossReferences
  // ────────────────────────────────────────────────────────────────
  describe('detectCrossReferences', () => {
    it('detects referenced clauses', async () => {
      mockExtract.mockResolvedValue({
        data: {
          references: ['15.01', '12.03', '8.02'],
          confidence: 0.9,
        },
      });

      const result = await detectCrossReferences(
        'As defined in Article 15.01, subject to Section 12.03'
      );

      expect(result.references).toEqual(['15.01', '12.03', '8.02']);
      expect(result.confidence).toBe(0.9);
    });

    it('returns empty on error', async () => {
      mockExtract.mockRejectedValue(new Error('fail'));
      const result = await detectCrossReferences('text');
      expect(result.references).toEqual([]);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // classifyPrecedent
  // ────────────────────────────────────────────────────────────────
  describe('classifyPrecedent', () => {
    it('classifies arbitration decision', async () => {
      mockExtract.mockResolvedValue({
        data: {
          precedentValue: 'high',
          outcome: 'union',
          issueType: 'wrongful_dismissal',
          confidence: 0.95,
          reasoning: 'Clear precedent for just cause standard',
        },
      });

      const result = await classifyPrecedent(
        'Smith v. ABC Corp',
        'Employee was dismissed without just cause.',
        'Arbitrator found no just cause for dismissal.',
        'Grievance upheld, employee reinstated.'
      );

      expect(result.precedentValue).toBe('high');
      expect(result.outcome).toBe('union');
      expect(result.issueType).toBe('wrongful_dismissal');
    });

    it('defaults to medium/split on error', async () => {
      mockExtract.mockRejectedValue(new Error('fail'));

      const result = await classifyPrecedent('t', 'f', 'r', 'd');
      expect(result.precedentValue).toBe('medium');
      expect(result.outcome).toBe('split');
      expect(result.issueType).toBe('other');
      expect(result.confidence).toBe(0.1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // batchClassifyClauses
  // ────────────────────────────────────────────────────────────────
  describe('batchClassifyClauses', () => {
    it('classifies multiple clauses', async () => {
      mockExtract
        .mockResolvedValueOnce({ data: { clauseType: 'wages_compensation', confidence: 0.9, reasoning: 'ok' } })
        .mockResolvedValueOnce({ data: { clauseType: 'health_safety', confidence: 0.85, reasoning: 'ok' } });

      const results = await batchClassifyClauses([
        { id: '1', content: 'Wage clause text' },
        { id: '2', content: 'Safety clause text' },
      ]);

      expect(results.size).toBe(2);
      expect(results.get('1')!.clauseType).toBe('wages_compensation');
      expect(results.get('2')!.clauseType).toBe('health_safety');
    });

    it('calls onProgress callback', async () => {
      mockExtract.mockResolvedValue({ data: { clauseType: 'other', confidence: 0.5, reasoning: 'ok' } });
      const onProgress = vi.fn();

      await batchClassifyClauses(
        [
          { id: '1', content: 'a' },
          { id: '2', content: 'b' },
        ],
        { onProgress }
      );

      expect(onProgress).toHaveBeenCalledWith(1, 2);
      expect(onProgress).toHaveBeenCalledWith(2, 2);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // enrichClauseMetadata
  // ────────────────────────────────────────────────────────────────
  describe('enrichClauseMetadata', () => {
    it('returns classification + tags + cross-references', async () => {
      // First 3 parallel calls: classifyClause, generateClauseTags, detectCrossReferences
      // Then 1 more: generateClauseTags with actual type
      mockExtract
        .mockResolvedValueOnce({ data: { clauseType: 'overtime', confidence: 0.9, reasoning: 'ok' } })
        .mockResolvedValueOnce({ data: { tags: ['generic'], confidence: 0.5 } })
        .mockResolvedValueOnce({ data: { references: ['10.01'], confidence: 0.8 } })
        .mockResolvedValueOnce({ data: { tags: ['overtime_rate', 'premium_pay'], confidence: 0.9 } });

      const result = await enrichClauseMetadata('Time and a half for overtime');

      expect(result.classification.clauseType).toBe('overtime');
      expect(result.tags.tags).toContain('overtime_rate');
      expect(result.crossReferences.references).toContain('10.01');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // validateClassification
  // ────────────────────────────────────────────────────────────────
  describe('validateClassification', () => {
    it('returns correct for high confidence', async () => {
      const result = await validateClassification('text', 'wages_compensation', 0.95);
      expect(result.isCorrect).toBe(true);
      expect(mockExtract).not.toHaveBeenCalled(); // short-circuits
    });

    it('re-classifies when confidence is low', async () => {
      mockExtract.mockResolvedValue({
        data: { clauseType: 'health_safety', confidence: 0.8, reasoning: 'Actually safety' },
      });

      const result = await validateClassification('PPE required', 'wages_compensation', 0.4);
      expect(result.isCorrect).toBe(false);
      expect(result.suggestedType).toBe('health_safety');
    });

    it('confirms when re-classification matches', async () => {
      mockExtract.mockResolvedValue({
        data: { clauseType: 'overtime', confidence: 0.7, reasoning: 'Confirmed overtime' },
      });

      const result = await validateClassification('text', 'overtime', 0.5);
      expect(result.isCorrect).toBe(true);
      expect(result.suggestedType).toBeUndefined();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Error paths for catch branches
  // ────────────────────────────────────────────────────────────────
  describe('error handling', () => {
    it('generateClauseTags returns fallback on AI error', async () => {
      mockExtract.mockRejectedValue(new Error('AI service down'));

      const result = await generateClauseTags('content', 'wages_compensation');
      expect(result.tags).toEqual([]);
      expect(result.confidence).toBe(0.1);
    });

    it('detectCrossReferences returns fallback on AI error', async () => {
      mockExtract.mockRejectedValue(new Error('timeout'));

      const result = await detectCrossReferences('Some clause content');
      expect(result.references).toEqual([]);
      expect(result.confidence).toBe(0.1);
    });

    it('classifyPrecedent returns fallback on AI error', async () => {
      mockExtract.mockRejectedValue(new Error('model unavailable'));

      const result = await classifyPrecedent('Title', 'Facts', 'Reasoning', 'Decision');
      expect(result.precedentValue).toBe('medium');
      expect(result.outcome).toBe('split');
      expect(result.issueType).toBe('other');
      expect(result.confidence).toBe(0.1);
      expect(result.reasoning).toBe('Classification failed');
    });
  });

  describe('fallback defaults when AI returns incomplete data', () => {
    it('generateClauseTags uses defaults for missing fields', async () => {
      mockExtract.mockResolvedValue({ data: {} });

      const result = await generateClauseTags('content', 'wages_compensation');
      expect(result.tags).toEqual([]);
      expect(result.confidence).toBe(0.5);
    });

    it('detectCrossReferences uses defaults for missing fields', async () => {
      mockExtract.mockResolvedValue({ data: {} });

      const result = await detectCrossReferences('clause text');
      expect(result.references).toEqual([]);
      expect(result.confidence).toBe(0.5);
    });

    it('classifyPrecedent uses defaults for missing fields', async () => {
      mockExtract.mockResolvedValue({ data: {} });

      const result = await classifyPrecedent('Title', 'Facts', 'Reasoning', 'Decision');
      expect(result.precedentValue).toBe('medium');
      expect(result.outcome).toBe('split');
      expect(result.issueType).toBe('other');
      expect(result.confidence).toBe(0.5);
      expect(result.reasoning).toBe('Classification based on case analysis');
    });
  });
});
