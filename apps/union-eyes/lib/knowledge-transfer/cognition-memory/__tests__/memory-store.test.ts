import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('@/db/db', () => ({ db: { execute } }));
vi.mock('drizzle-orm', () => ({
  sql: Object.assign((..._a: unknown[]) => ({}), { raw: (s: string) => s }),
}));

import {
  saveCognitionMemory,
  loadCognitionMemory,
  archiveCognitionMemory,
  getCognitionMemoryEntry,
} from '../memory-store';

beforeEach(() => {
  execute.mockReset();
  execute.mockResolvedValue([]);
});

describe('lib/knowledge-transfer/cognition-memory/memory-store', () => {
  it('saveCognitionMemory ensures table and inserts, returning the entry', async () => {
    const entry = await saveCognitionMemory('org-1', {
      memoryType: 'governance_reasoning',
      title: 'Decision',
      contextSummary: 'ctx',
      payload: { a: 1 },
      resilienceScoreAtCapture: 55,
      tags: ['gov'],
      keyInsights: ['insight'],
      sessionId: 'sess-1',
    } as never);
    expect(entry.organizationId).toBe('org-1');
    expect(entry.title).toBe('Decision');
    expect(entry.status).toBe('active');
    expect(entry.id).toBeDefined();
    // 2 ensureTable statements + 1 insert
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it('saveCognitionMemory applies defaults for optional fields', async () => {
    const entry = await saveCognitionMemory('org-1', { memoryType: 'memory_captured', title: 'X' } as never);
    expect(entry.contextSummary).toBe('');
    expect(entry.tags).toEqual([]);
    expect(entry.resilienceScoreAtCapture).toBeNull();
    expect(entry.sessionId).toBeNull();
  });

  it('loadCognitionMemory maps rows and builds a resilience timeline', async () => {
    const rows = [
      {
        id: 'r1', org_id: 'org-1', memory_type: 'resilience_baseline', title: 'A',
        context_summary: 'c', payload: { x: 1 }, resilience_score_at_capture: 50,
        tags: ['t'], key_insights: ['k'], session_id: 's1', status: 'active',
        created_at: { toISOString: () => '2025-01-01T00:00:00.000Z' },
        updated_at: { toISOString: () => '2025-01-01T00:00:00.000Z' },
      },
      {
        id: 'r2', org_id: 'org-1', memory_type: 'resilience_baseline', title: 'B',
        resilience_score_at_capture: 58, created_at: '2025-01-05T00:00:00.000Z',
        updated_at: '2025-01-05T00:00:00.000Z',
      },
      {
        id: 'r3', org_id: 'org-1', memory_type: 'decision_brief', title: 'C',
        resilience_score_at_capture: null, created_at: '2025-01-03T00:00:00.000Z',
        updated_at: '2025-01-03T00:00:00.000Z',
      },
    ];
    execute.mockResolvedValue(rows);
    const store = await loadCognitionMemory('org-1', { limit: 10, memoryType: 'resilience_baseline', sessionId: 's1' });
    expect(store.totalEntries).toBe(3);
    expect(store.resilienceTimeline.length).toBe(2);
    expect(store.resilienceTimeline[0].changeFromPrevious).toBeNull();
    expect(store.resilienceTimeline[1].changeFromPrevious).toBe(8);
    // defaulted fields on sparse row
    const r2 = store.entries.find((e) => e.id === 'r2');
    expect(r2?.contextSummary).toBe('');
    expect(r2?.tags).toEqual([]);
  });

  it('loadCognitionMemory works with no filter options', async () => {
    execute.mockResolvedValue([]);
    const store = await loadCognitionMemory('org-1');
    expect(store.entries).toEqual([]);
    expect(store.resilienceTimeline).toEqual([]);
  });

  it('archiveCognitionMemory executes update', async () => {
    await archiveCognitionMemory('org-1', 'entry-1');
    expect(execute).toHaveBeenCalled();
  });

  it('getCognitionMemoryEntry returns entry when found', async () => {
    execute.mockResolvedValue([
      { id: 'r1', org_id: 'org-1', memory_type: 'decision_brief', title: 'A', created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' },
    ]);
    const entry = await getCognitionMemoryEntry('org-1', 'r1');
    expect(entry?.id).toBe('r1');
  });

  it('getCognitionMemoryEntry returns null when not found', async () => {
    execute.mockResolvedValue([]);
    const entry = await getCognitionMemoryEntry('org-1', 'missing');
    expect(entry).toBeNull();
  });
});
