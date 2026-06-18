import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('@/db/db', () => ({ db: { execute } }));
vi.mock('drizzle-orm', () => ({
  sql: Object.assign((..._a: unknown[]) => ({}), { raw: (s: string) => s }),
}));

import {
  createReasoningSession,
  listReasoningSessions,
  getReasoningSession,
  updateReasoningSession,
  addSessionAnnotation,
  linkMemoryToSession,
  addSessionSimulation,
} from '../session-manager';

beforeEach(() => {
  execute.mockReset();
  execute.mockResolvedValue([]);
});

describe('lib/knowledge-transfer/reasoning-sessions/session-manager', () => {
  it('createReasoningSession inserts and returns a session', async () => {
    const session = await createReasoningSession('org-1', { title: 'Continuity', focus: 'retirement_wave', contextDescription: 'ctx' } as never);
    expect(session.organizationId).toBe('org-1');
    expect(session.title).toBe('Continuity');
    expect(session.status).toBe('active');
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it('createReasoningSession applies defaults', async () => {
    const session = await createReasoningSession('org-1', { title: 'X' } as never);
    expect(session.focus).toBe('general_continuity');
    expect(session.contextDescription).toBe('');
    expect(session.graphState).toBeNull();
  });

  it('listReasoningSessions maps rows', async () => {
    execute.mockResolvedValue([
      {
        id: 's1', org_id: 'org-1', title: 'A', focus: 'general_continuity', status: 'active',
        context_description: 'c', graph_state: null, active_simulations: [], annotations: [],
        linked_message_ids: [], linked_memory_ids: [], latest_resilience_score: 60,
        created_at: { toISOString: () => '2025-01-01T00:00:00.000Z' },
        updated_at: { toISOString: () => '2025-01-01T00:00:00.000Z' },
      },
      { id: 's2', org_id: 'org-1', title: 'B', focus: 'general_continuity', status: 'active', created_at: '2025-01-02T00:00:00.000Z', updated_at: '2025-01-02T00:00:00.000Z' },
    ]);
    const sessions = await listReasoningSessions('org-1', { status: 'active', limit: 5 });
    expect(sessions.length).toBe(2);
    expect(sessions[1].contextDescription).toBe('');
    expect(sessions[1].annotations).toEqual([]);
  });

  it('listReasoningSessions works with no options', async () => {
    execute.mockResolvedValue([]);
    expect(await listReasoningSessions('org-1')).toEqual([]);
  });

  it('getReasoningSession returns session or null', async () => {
    execute.mockResolvedValue([{ id: 's1', org_id: 'org-1', title: 'A', focus: 'general_continuity', status: 'active', created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' }]);
    expect((await getReasoningSession('org-1', 's1'))?.id).toBe('s1');
    execute.mockResolvedValue([]);
    expect(await getReasoningSession('org-1', 'missing')).toBeNull();
  });

  it('updateReasoningSession handles defined and undefined graphState', async () => {
    await updateReasoningSession('org-1', 's1', { title: 'New', graphState: { nodes: [] } } as never);
    await updateReasoningSession('org-1', 's1', { status: 'archived' } as never);
    expect(execute).toHaveBeenCalled();
  });

  it('addSessionAnnotation returns an annotation', async () => {
    const annotation = await addSessionAnnotation('org-1', 's1', 'note', 'ref-1');
    expect(annotation.text).toBe('note');
    expect(annotation.targetRef).toBe('ref-1');
    expect(annotation.id).toBeDefined();
  });

  it('addSessionAnnotation defaults targetRef to null', async () => {
    const annotation = await addSessionAnnotation('org-1', 's1', 'note');
    expect(annotation.targetRef).toBeNull();
  });

  it('linkMemoryToSession and addSessionSimulation execute updates', async () => {
    await linkMemoryToSession('org-1', 's1', 'mem-1');
    await addSessionSimulation('org-1', 's1', { id: 'sim-1' } as never);
    expect(execute).toHaveBeenCalled();
  });
});
