import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  isValidTransition,
  getAllowedTransitions,
  calculateDeadline,
  isClaimOverdue,
  getDaysUntilDeadline,
  STATUS_TRANSITIONS,
  STATUS_DEADLINES,
  PRIORITY_MULTIPLIERS,
} from '../workflow-engine';

// Mock heavy imports to avoid transitive dependency resolution issues
vi.mock('@/db/db', () => ({ db: {} }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: vi.fn() }));
vi.mock('@/db/schema/claims-schema', () => ({
  claims: {}, claimUpdates: {},
}));
vi.mock('@/db/schema/organization-members-schema', () => ({
  organizationMembers: {},
}));
vi.mock('@/db/schema/user-management-schema', () => ({
  users: {},
}));
vi.mock('@/lib/claim-notifications', () => ({
  sendClaimStatusNotification: vi.fn(),
}));
vi.mock('@/lib/services/claim-workflow-fsm', () => ({
  validateClaimTransition: vi.fn(),
  getAllowedClaimTransitions: vi.fn((status: string) => {
    const map: Record<string, string[]> = {
      submitted: ['under_review', 'assigned', 'rejected'],
      under_review: ['investigation', 'pending_documentation', 'resolved', 'rejected', 'assigned'],
    };
    return map[status] || [];
  }),
}));
vi.mock('@/lib/services/lro-signals', () => ({
  detectAllSignals: vi.fn(),
}));
vi.mock('@/lib/services/defensibility-pack', () => ({
  generateDefensibilityPack: vi.fn(),
}));
vi.mock('@/db/schema/defensibility-packs-schema', () => ({
  defensibilityPacks: {},
}));
vi.mock('@/lib/integrations/timeline-integration', () => ({
  addTimelineEntry: vi.fn(),
}));
vi.mock('@/lib/events/event-bus', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn() },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(), and: vi.fn(), relations: vi.fn(() => ({})),
}));

describe('workflow-engine', () => {
  describe('STATUS_TRANSITIONS', () => {
    it('defines transitions for all expected statuses', () => {
      expect(STATUS_TRANSITIONS).toHaveProperty('submitted');
      expect(STATUS_TRANSITIONS).toHaveProperty('closed');
      expect(STATUS_TRANSITIONS.closed).toEqual([]);
    });
  });

  describe('isValidTransition', () => {
    it('returns true for valid transition', () => {
      expect(isValidTransition('submitted', 'under_review')).toBe(true);
    });

    it('returns false for invalid transition', () => {
      expect(isValidTransition('submitted', 'closed')).toBe(false);
    });

    it('returns false for transitions from closed (terminal)', () => {
      expect(isValidTransition('closed', 'submitted')).toBe(false);
    });
  });

  describe('getAllowedTransitions', () => {
    it('returns transitions for a status', () => {
      const transitions = getAllowedTransitions('submitted');
      expect(transitions).toContain('under_review');
    });
  });

  describe('calculateDeadline', () => {
    it('calculates deadline based on status and priority', () => {
      const fromDate = new Date('2026-03-01T00:00:00Z');
      const deadline = calculateDeadline('submitted', 'medium', fromDate);
      // submitted = 2 days, medium multiplier = 1.0
      expect(deadline.getTime()).toBe(
        new Date('2026-03-03T00:00:00Z').getTime(),
      );
    });

    it('applies priority multiplier for critical', () => {
      const fromDate = new Date('2026-03-01T00:00:00Z');
      const deadline = calculateDeadline('investigation', 'critical', fromDate);
      // investigation = 10 days, critical multiplier = 0.5 → 5 days
      expect(deadline.getTime()).toBe(
        new Date('2026-03-06T00:00:00Z').getTime(),
      );
    });
  });

  describe('isClaimOverdue', () => {
    it('returns true when past deadline', () => {
      const pastDate = new Date('2025-01-01');
      expect(isClaimOverdue('submitted', 'medium', pastDate)).toBe(true);
    });

    it('returns false when before deadline', () => {
      const futureDate = new Date(Date.now() + 86400000 * 30);
      expect(isClaimOverdue('submitted', 'medium', futureDate)).toBe(false);
    });
  });

  describe('getDaysUntilDeadline', () => {
    it('returns positive days when before deadline', () => {
      const recentDate = new Date(Date.now() - 86400000); // 1 day ago
      const days = getDaysUntilDeadline('investigation', 'medium', recentDate);
      expect(days).toBeGreaterThan(0);
    });

    it('returns negative days when past deadline', () => {
      const pastDate = new Date('2025-01-01');
      const days = getDaysUntilDeadline('submitted', 'medium', pastDate);
      expect(days).toBeLessThan(0);
    });
  });
});
