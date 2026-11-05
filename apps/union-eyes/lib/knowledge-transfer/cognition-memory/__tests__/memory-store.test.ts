import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
const { withRLSContext } = vi.hoisted(() => ({ withRLSContext: vi.fn() }));
const { audit } = vi.hoisted(() => ({ audit: vi.fn() }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: audit }));
vi.mock('drizzle-orm', () => ({
  sql: Object.assign((..._a: unknown[]) => ({}), { raw: (s: string) => s }),
}));

import {
  saveCognitionMemory,
  loadCognitionMemory,
  archiveCognitionMemory,
  getCognitionMemoryEntry,
} from '../memory-store';


const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const E1 = '33333333-3333-4333-8333-333333333333';
const E2 = '44444444-4444-4444-8444-444444444444';
const USER = 'user-1';

beforeEach(() => {
  execute.mockReset();
  execute.mockResolvedValue([]);
  withRLSContext.mockReset();
  audit.mockReset();
  audit.mockResolvedValue(undefined);
  withRLSContext.mockImplementation(async (_ctx: unknown, op: (tx: unknown) => unknown) => op({ execute }));
});

describe('lib/knowledge-transfer/cognition-memory/memory-store', () => {
  it('saveCognitionMemory inserts inside the tenant context, returning the entry', async () => {
    const entry = await saveCognitionMemory(ORG, {
      memoryType: 'governance_reasoning',
      title: 'Decision',
      contextSummary: 'ctx',
      payload: { a: 1 },
      resilienceScoreAtCapture: 55,
      tags: ['gov'],
      keyInsights: ['insight'],
      sessionId: 'sess-1',
    } as never, USER);
    expect(entry.organizationId).toBe(ORG);
    expect(entry.title).toBe('Decision');
    expect(entry.status).toBe('active');
    expect(entry.id).toBeDefined();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(withRLSContext).toHaveBeenCalledWith({ organizationId: ORG }, expect.any(Function));
  });

  it('saveCognitionMemory applies defaults for optional fields', async () => {
    const entry = await saveCognitionMemory(ORG, { memoryType: 'memory_captured', title: 'X' } as never, USER);
    expect(entry.contextSummary).toBe('');
    expect(entry.tags).toEqual([]);
    expect(entry.resilienceScoreAtCapture).toBeNull();
    expect(entry.sessionId).toBeNull();
  });

  it('loadCognitionMemory maps rows and builds a resilience timeline', async () => {
    const rows = [
      {
        id: 'r1', organization_id: ORG, memory_type: 'resilience_baseline', title: 'A',
        context_summary: 'c', payload: { x: 1 }, resilience_score_at_capture: 50,
        tags: ['t'], key_insights: ['k'], session_id: 's1', status: 'active',
        created_at: { toISOString: () => '2025-01-01T00:00:00.000Z' },
        updated_at: { toISOString: () => '2025-01-01T00:00:00.000Z' },
      },
      {
        id: 'r2', organization_id: ORG, memory_type: 'resilience_baseline', title: 'B',
        resilience_score_at_capture: 58, created_at: '2025-01-05T00:00:00.000Z',
        updated_at: '2025-01-05T00:00:00.000Z',
      },
      {
        id: 'r3', organization_id: ORG, memory_type: 'decision_brief', title: 'C',
        resilience_score_at_capture: null, created_at: '2025-01-03T00:00:00.000Z',
        updated_at: '2025-01-03T00:00:00.000Z',
      },
    ];
    execute.mockResolvedValue(rows);
    const store = await loadCognitionMemory(ORG, { limit: 10, memoryType: 'resilience_baseline', sessionId: 's1' });
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
    const store = await loadCognitionMemory(ORG);
    expect(store.entries).toEqual([]);
    expect(store.resilienceTimeline).toEqual([]);
  });

  it('archiveCognitionMemory audits an archived entry on the same transaction', async () => {
    execute.mockResolvedValue([{ id: E1 }]);
    expect(await archiveCognitionMemory(ORG, E1, USER)).toBe(true);
    expect(audit).toHaveBeenCalledWith({ execute }, expect.objectContaining({ organizationId: ORG, userId: USER, action: 'cognition_memory.archive', resourceId: E1 }));
  });

  it('archiveCognitionMemory matching nothing (missing, other organization, already archived) audits nothing', async () => {
    execute.mockResolvedValue([]);
    expect(await archiveCognitionMemory(ORG, E1, USER)).toBe(false);
    expect(audit).not.toHaveBeenCalled();
  });

  it('saveCognitionMemory audits on the same transaction and fails when the audit fails', async () => {
    await saveCognitionMemory(ORG, { memoryType: 'decision_brief', title: 'T' } as never, USER);
    expect(audit).toHaveBeenCalledWith({ execute }, expect.objectContaining({ organizationId: ORG, userId: USER, action: 'cognition_memory.save' }));
    audit.mockRejectedValueOnce(new Error('audit down'));
    await expect(saveCognitionMemory(ORG, { memoryType: 'decision_brief', title: 'T' } as never, USER)).rejects.toThrow('audit down');
  });

  it('getCognitionMemoryEntry returns entry when found', async () => {
    execute.mockResolvedValue([
      { id: E1, organization_id: ORG, memory_type: 'decision_brief', title: 'A', created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' },
    ]);
    const entry = await getCognitionMemoryEntry(ORG, E1);
    expect(entry?.id).toBe(E1);
  });

  it('getCognitionMemoryEntry returns null when not found', async () => {
    execute.mockResolvedValue([]);
    const entry = await getCognitionMemoryEntry(ORG, E2);
    expect(entry).toBeNull();
  });

  it('runs every operation inside the organization tenant context', async () => {
    await loadCognitionMemory(OTHER_ORG);
    await archiveCognitionMemory(OTHER_ORG, E1, USER);
    await getCognitionMemoryEntry(OTHER_ORG, E1);
    await saveCognitionMemory(OTHER_ORG, { memoryType: 'decision_brief', title: 'T' } as never, USER);
    expect(withRLSContext).toHaveBeenCalledTimes(4);
    for (const call of withRLSContext.mock.calls) {
      expect(call[0]).toEqual({ organizationId: OTHER_ORG });
    }
  });

  it('refuses a non-UUID organization before touching the database', async () => {
    await expect(loadCognitionMemory('org-1')).rejects.toThrow('organizationId must be a UUID');
    await expect(saveCognitionMemory('org-1', { memoryType: 'decision_brief', title: 'T' } as never, USER)).rejects.toThrow();
    expect(withRLSContext).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('treats a malformed entry id as matching nothing without querying', async () => {
    expect(await getCognitionMemoryEntry(ORG, 'not-a-uuid')).toBeNull();
    expect(await archiveCognitionMemory(ORG, 'not-a-uuid', USER)).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it('never issues schema DDL', () => {
    const source = readFileSync(fileURLToPath(new URL('../memory-store.ts', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/CREATE\s+(TABLE|INDEX)|ALTER\s+TABLE|ensureTable/i);
  });
});