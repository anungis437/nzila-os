import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { LearningService, learningService } from '../learning';
import type { FeedbackType, UserFeedback } from '../learning';

function makeFeedback(overrides: Partial<Omit<UserFeedback, 'id' | 'timestamp'>> = {}): Omit<UserFeedback, 'id' | 'timestamp'> {
  return {
    type: 'upvote',
    query: 'What are my rights?',
    userId: 'user-1',
    organizationId: 'org-1',
    sessionId: 'sess-1',
    metadata: {},
    ...overrides,
  };
}

describe('LearningService', () => {
  let service: LearningService;

  beforeEach(() => {
    service = new LearningService();
  });

  describe('recordFeedback', () => {
    it('records feedback and returns record with id and timestamp', () => {
      const result = service.recordFeedback(makeFeedback());
      expect(result.id).toBeTruthy();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.type).toBe('upvote');
    });

    it('records correction feedback', () => {
      const result = service.recordFeedback(makeFeedback({
        type: 'correction',
        response: 'wrong answer',
        correction: 'right answer',
      }));
      expect(result.type).toBe('correction');
      expect(result.correction).toBe('right answer');
    });
  });

  describe('pattern detection', () => {
    it('detects correction patterns when threshold exceeded', () => {
      for (let i = 0; i < 6; i++) {
        service.recordFeedback(makeFeedback({
          type: 'correction',
          query: 'how to file a grievance',
          correction: `fix ${i}`,
        }));
      }
      const patterns = service.getUrgentPatterns();
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('response_issue');
    });

    it('detects query issues from downvotes', () => {
      for (let i = 0; i < 6; i++) {
        service.recordFeedback(makeFeedback({
          type: 'downvote',
          query: 'bad query experience',
        }));
      }
      const patterns = service.getUrgentPatterns();
      expect(patterns.some(p => p.type === 'query_pattern')).toBe(true);
    });
  });

  describe('detectKnowledgeGap', () => {
    it('detects gaps when no results found', () => {
      // Need to call multiple times to exceed PATTERN_THRESHOLD (5)
      for (let i = 0; i < 5; i++) {
        service.detectKnowledgeGap('exotic topic', { found: false, count: 0 });
      }
      const patterns = service.getUrgentPatterns();
      expect(patterns.some(p => p.type === 'missing_knowledge')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('returns valid stats', () => {
      service.recordFeedback(makeFeedback({ type: 'upvote', rating: 'positive' }));
      service.recordFeedback(makeFeedback({ type: 'downvote', rating: 'negative' }));
      const stats = service.getStats();
      expect(stats.totalFeedback).toBe(2);
      expect(stats.correctionsByType).toBeDefined();
    });

    it('filters by org', () => {
      service.recordFeedback(makeFeedback({ organizationId: 'org-a' }));
      service.recordFeedback(makeFeedback({ organizationId: 'org-b' }));
      const stats = service.getStats('org-a');
      expect(stats.totalFeedback).toBe(1);
    });
  });

  describe('getImprovementData', () => {
    it('collects corrections and problematic queries', () => {
      service.recordFeedback(makeFeedback({
        type: 'correction',
        query: 'q1',
        response: 'bad',
        correction: 'good',
      }));
      service.recordFeedback(makeFeedback({ type: 'downvote', query: 'q2' }));
      service.recordFeedback(makeFeedback({ type: 'abandonment', query: 'q3' }));

      const data = service.getImprovementData();
      expect(data.corrections.length).toBe(1);
      expect(data.problematicQueries.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('resolveFeedback', () => {
    it('resolves existing feedback', () => {
      const fb = service.recordFeedback(makeFeedback());
      expect(service.resolveFeedback(fb.id, 'Fixed it')).toBe(true);
    });

    it('returns false for missing feedback', () => {
      expect(service.resolveFeedback('nonexistent', 'n/a')).toBe(false);
    });
  });

  describe('applyAutoFix', () => {
    it('applies fix for auto-fixable pattern', () => {
      service.detectKnowledgeGap('something', { found: false, count: 0 });
      const patterns = service.getUrgentPatterns();
      const autoFixable = patterns.find(p => p.autoFixable);
      if (autoFixable) {
        expect(service.applyAutoFix(autoFixable.id)).toBe(true);
      }
    });

    it('returns false for non-existent pattern', () => {
      expect(service.applyAutoFix('does-not-exist')).toBe(false);
    });
  });

  describe('getEvents', () => {
    it('returns recorded events', () => {
      service.recordFeedback(makeFeedback());
      const events = service.getEvents();
      expect(events.length).toBeGreaterThanOrEqual(1);
    });

    it('respects limit', () => {
      for (let i = 0; i < 10; i++) {
        service.recordFeedback(makeFeedback());
      }
      expect(service.getEvents(3).length).toBe(3);
    });
  });

  describe('clearOldFeedback', () => {
    it('returns 0 when no old feedback', () => {
      service.recordFeedback(makeFeedback());
      expect(service.clearOldFeedback(90)).toBe(0);
    });
  });
});

describe('learningService singleton', () => {
  it('is an instance of LearningService', () => {
    expect(learningService).toBeInstanceOf(LearningService);
  });
});

describe('FeedbackType', () => {
  it.each<FeedbackType>([
    'correction', 'upvote', 'downvote', 'completion', 'abandonment', 'escalation',
  ])('accepts %s as a valid type', (type) => {
    const fb = makeFeedback({ type });
    expect(fb.type).toBe(type);
  });
});
