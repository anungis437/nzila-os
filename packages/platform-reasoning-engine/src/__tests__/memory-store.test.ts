/**
 * Comprehensive tests for @nzila/platform-reasoning-engine memory-store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryReasoningStore } from '../memory-store';
import type { ReasoningChain, ReasoningStore } from '../types';
import { ReasoningStatuses, ReasoningTypes } from '../types';

function makeChain(overrides: Partial<ReasoningChain> = {}): ReasoningChain {
  return {
    id: 'chain-1',
    orgId: 'org-1',
    reasoningType: ReasoningTypes.RISK_BASED,
    status: ReasoningStatuses.COMPLETED,
    entityType: 'case' as ReasoningChain['entityType'],
    resourceId: 'entity-1',
    question: 'test question',
    steps: [],
    conclusion: null,
    allCitations: [],
    totalConfidence: 0.9,
    crossVerticalInsights: [],
    createdAt: '2025-01-01T00:00:00Z',
    completedAt: '2025-01-01T00:00:01Z',
    requestedBy: 'user-1',
    ...overrides,
  };
}

describe('createInMemoryReasoningStore', () => {
  let store: ReasoningStore;

  beforeEach(() => {
    store = createInMemoryReasoningStore();
  });

  describe('persistChain + getChain', () => {
    it('persists and retrieves a chain by id', async () => {
      const chain = makeChain({ id: 'abc' });
      await store.persistChain(chain);

      const found = await store.getChain('abc');
      expect(found).toBeDefined();
      expect(found!.id).toBe('abc');
      expect(found!.question).toBe('test question');
    });

    it('returns undefined for non-existent chain', async () => {
      const found = await store.getChain('does-not-exist');
      expect(found).toBeUndefined();
    });

    it('overwrites chain with same id', async () => {
      await store.persistChain(makeChain({ id: 'x', question: 'q1' }));
      await store.persistChain(makeChain({ id: 'x', question: 'q2' }));

      const found = await store.getChain('x');
      expect(found!.question).toBe('q2');
    });
  });

  describe('getChainsByEntity', () => {
    it('returns chains matching entity type and id', async () => {
      await store.persistChain(makeChain({ id: 'a', entityType: 'case' as any, resourceId: 'e1' }));
      await store.persistChain(makeChain({ id: 'b', entityType: 'case' as any, resourceId: 'e1' }));
      await store.persistChain(makeChain({ id: 'c', entityType: 'case' as any, resourceId: 'e2' }));

      const results = await store.getChainsByEntity('case' as any, 'e1');
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.id).sort()).toEqual(['a', 'b']);
    });

    it('returns empty array when no chains match', async () => {
      await store.persistChain(makeChain({ id: 'a', entityType: 'case' as any, resourceId: 'e1' }));

      const results = await store.getChainsByEntity('person' as any, 'e1');
      expect(results).toHaveLength(0);
    });
  });

  describe('getChainsByOrg', () => {
    it('returns chains for the specified org', async () => {
      await store.persistChain(makeChain({ id: 'a', orgId: 'org-1' }));
      await store.persistChain(makeChain({ id: 'b', orgId: 'org-1' }));
      await store.persistChain(makeChain({ id: 'c', orgId: 'org-2' }));

      const results = await store.getChainsByOrg('org-1');
      expect(results).toHaveLength(2);
    });

    it('respects the limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await store.persistChain(makeChain({ id: `chain-${i}`, orgId: 'org-1' }));
      }

      const results = await store.getChainsByOrg('org-1', 3);
      expect(results).toHaveLength(3);
    });

    it('uses default limit of 50', async () => {
      for (let i = 0; i < 60; i++) {
        await store.persistChain(makeChain({ id: `chain-${i}`, orgId: 'org-1' }));
      }

      const results = await store.getChainsByOrg('org-1');
      expect(results).toHaveLength(50);
    });

    it('returns empty when no chains match org', async () => {
      await store.persistChain(makeChain({ id: 'a', orgId: 'org-1' }));

      const results = await store.getChainsByOrg('org-999');
      expect(results).toHaveLength(0);
    });
  });
});
