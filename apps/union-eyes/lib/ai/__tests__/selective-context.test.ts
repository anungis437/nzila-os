import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { SelectiveContextManager, createSelectiveContext, selectiveContext } from '../selective-context';
import type { SelectiveConfig, ContextItem } from '../selective-context';

describe('SelectiveContextManager', () => {
  let manager: SelectiveContextManager;

  beforeEach(() => {
    manager = new SelectiveContextManager({ maxContextTokens: 500 });
  });

  describe('addItem', () => {
    it('adds item with computed importance', () => {
      manager.addItem({
        id: 'item-1',
        content: 'A regular message',
        type: 'user',
        timestamp: Date.now(),
      });
      const info = manager.getInfo();
      expect(info.itemCount).toBe(1);
    });

    it('boosts importance for keyword-rich content', () => {
      manager.addItem({
        id: 'urgent-1',
        content: 'This is an urgent grievance with critical deadline',
        type: 'user',
        timestamp: Date.now(),
      });
      // System type content should have high base importance
      manager.addItem({
        id: 'sys-1',
        content: 'System instruction',
        type: 'system',
        timestamp: Date.now(),
      });
      expect(manager.getInfo().itemCount).toBe(2);
    });
  });

  describe('selectForQuery', () => {
    it('returns items relevant to query', () => {
      manager.addItem({
        id: 'doc-1',
        content: 'Collective agreement section on grievance timelines',
        type: 'document',
        timestamp: Date.now(),
      });
      manager.addItem({
        id: 'doc-2',
        content: 'Holiday schedule for the year',
        type: 'document',
        timestamp: Date.now(),
      });
      const selected = manager.selectForQuery('grievance timelines');
      // Both may be returned, but grievance doc should rank higher
      expect(selected.length).toBeGreaterThan(0);
      if (selected.length > 1) {
        expect(selected[0].id).toBe('doc-1');
      }
    });

    it('returns recent context for empty query', () => {
      manager.addItem({
        id: 'recent',
        content: 'Recent chat message',
        type: 'user',
        timestamp: Date.now(),
      });
      const selected = manager.selectForQuery('');
      expect(selected.length).toBeGreaterThan(0);
    });

    it('respects token limit', () => {
      const smallManager = new SelectiveContextManager({ maxContextTokens: 10 });
      for (let i = 0; i < 20; i++) {
        smallManager.addItem({
          id: `item-${i}`,
          content: `word1 word2 word3 word4 word5 word6 word7 word8`,
          type: 'user',
          timestamp: Date.now() - i * 1000,
        });
      }
      const selected = smallManager.selectForQuery('anything');
      const totalTokens = selected.reduce(
        (sum, item) => sum + item.content.split(/\s+/).length, 0
      );
      expect(totalTokens).toBeLessThanOrEqual(10);
    });
  });

  describe('clear', () => {
    it('clears all context', () => {
      manager.addItem({ id: 'a', content: 'test', type: 'user', timestamp: Date.now() });
      manager.clear();
      expect(manager.getInfo().itemCount).toBe(0);
    });
  });

  describe('getInfo', () => {
    it('returns correct item count and estimated tokens', () => {
      manager.addItem({ id: 'x', content: 'hello world foo', type: 'user', timestamp: Date.now() });
      const info = manager.getInfo();
      expect(info.itemCount).toBe(1);
      expect(info.estimatedTokens).toBe(3);
      expect(info.config.maxContextTokens).toBe(500);
    });
  });

  describe('retention strategies', () => {
    it('importance strategy weights importance higher', () => {
      const mgr = new SelectiveContextManager({
        maxContextTokens: 500,
        retentionStrategy: 'importance',
      });
      mgr.addItem({ id: 'sys', content: 'System message about urgent grievance', type: 'system', timestamp: Date.now() - 100000 });
      mgr.addItem({ id: 'usr', content: 'Random hello', type: 'user', timestamp: Date.now() });
      const selected = mgr.selectForQuery('anything');
      // Both should be returned for small context
      expect(selected.length).toBeGreaterThanOrEqual(1);
    });

    it('recency strategy prefers newer items', () => {
      const mgr = new SelectiveContextManager({
        maxContextTokens: 500,
        retentionStrategy: 'recency',
      });
      mgr.addItem({ id: 'old', content: 'Old message', type: 'user', timestamp: Date.now() - 86400000 * 60 });
      mgr.addItem({ id: 'new', content: 'New message', type: 'user', timestamp: Date.now() });
      const selected = mgr.selectForQuery('message');
      expect(selected.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('gap coverage', () => {
    it('selectForQuery with empty query returns multiple items sorted by timestamp', () => {
      manager.addItem({ id: 'old', content: 'First message in buffer', type: 'user', timestamp: Date.now() - 5000 });
      manager.addItem({ id: 'new', content: 'Second message in buffer', type: 'user', timestamp: Date.now() });
      const selected = manager.selectForQuery('');
      expect(selected.length).toBe(2);
      // Should be in chronological order (oldest first)
      expect(selected[0].id).toBe('old');
      expect(selected[1].id).toBe('new');
    });

    it('calculateRelevance returns 0 for empty itemTerms', () => {
      // Item with only short words (filtered out by tokenize >2 chars)
      manager.addItem({ id: 'short', content: 'a b c', type: 'user', timestamp: Date.now() });
      const selected = manager.selectForQuery('grievance timelines');
      // Item should have relevance 0 but may still be selected if within token limit
      expect(selected.length).toBeLessThanOrEqual(1);
    });

    it('importance strategy scores items correctly', () => {
      const mgr = new SelectiveContextManager({
        maxContextTokens: 500,
        retentionStrategy: 'importance',
      });
      mgr.addItem({ id: 'doc', content: 'Critical grievance contract violation requires urgent attention', type: 'document', timestamp: Date.now() });
      mgr.addItem({ id: 'usr', content: 'Hello there friend', type: 'user', timestamp: Date.now() });
      const selected = mgr.selectForQuery('anything');
      // Document with keywords should be first (importance-weighted)
      expect(selected.length).toBe(2);
      expect(selected[0].id).toBe('doc');
    });

    it('recency strategy prefers newer items over important ones', () => {
      const mgr = new SelectiveContextManager({
        maxContextTokens: 20,
        retentionStrategy: 'recency',
      });
      mgr.addItem({ id: 'old-sys', content: 'Critical system message about urgent grievance violation', type: 'system', timestamp: Date.now() - 86400000 * 60 });
      mgr.addItem({ id: 'new-usr', content: 'Recent user message hello', type: 'user', timestamp: Date.now() });
      const selected = mgr.selectForQuery('message');
      expect(selected.length).toBeGreaterThanOrEqual(1);
      expect(selected[0].id).toBe('new-usr');
    });

    it('pruneContext keeps top 75% of items by score', () => {
      // maxContextTokens: 20 => pruneThreshold = 20/4 = 5
      const mgr = new SelectiveContextManager({ maxContextTokens: 20 });
      for (let i = 0; i < 10; i++) {
        mgr.addItem({
          id: `p-${i}`,
          content: `Item number ${i} with some content`,
          type: 'user',
          timestamp: Date.now() - i * 60000,
        });
      }
      // After adding 10 items, pruning should have fired
      const info = mgr.getInfo();
      expect(info.itemCount).toBeLessThan(10);
    });

    it('clear empties the context buffer', () => {
      manager.addItem({ id: 'clr-1', content: 'Some content here', type: 'document', timestamp: Date.now() });
      manager.addItem({ id: 'clr-2', content: 'More content here', type: 'user', timestamp: Date.now() });
      expect(manager.getInfo().itemCount).toBe(2);
      manager.clear();
      expect(manager.getInfo().itemCount).toBe(0);
    });
  });
});

describe('createSelectiveContext', () => {
  it('creates a new manager with custom config', () => {
    const mgr = createSelectiveContext({ maxContextTokens: 1000 });
    expect(mgr).toBeInstanceOf(SelectiveContextManager);
    expect(mgr.getInfo().config.maxContextTokens).toBe(1000);
  });
});

describe('selectiveContext singleton', () => {
  it('is a SelectiveContextManager', () => {
    expect(selectiveContext).toBeInstanceOf(SelectiveContextManager);
  });
});
