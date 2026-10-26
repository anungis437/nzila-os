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
  createReasoningSession,
  listReasoningSessions,
  getReasoningSession,
  updateReasoningSession,
  addSessionAnnotation,
  linkMemoryToSession,
  addSessionSimulation,
} from '../session-manager';


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

describe('lib/knowledge-transfer/reasoning-sessions/session-manager', () => {
  it('createReasoningSession inserts and returns a session', async () => {
    const session = await createReasoningSession(ORG, { title: 'Continuity', focus: 'retirement_wave', contextDescription: 'ctx' } as never, USER);
    expect(audit).toHaveBeenCalledWith({ execute }, expect.objectContaining({ organizationId: ORG, userId: USER, action: 'reasoning_session.create', resourceId: session.id }));
    expect(session.organizationId).toBe(ORG);
    expect(session.title).toBe('Continuity');
    expect(session.status).toBe('active');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(withRLSContext).toHaveBeenCalledWith({ organizationId: ORG }, expect.any(Function));
  });

  it('createReasoningSession applies defaults', async () => {
    const session = await createReasoningSession(ORG, { title: 'X' } as never, USER);
    expect(session.focus).toBe('general_continuity');
    expect(session.contextDescription).toBe('');
    expect(session.graphState).toBeNull();
  });

  it('listReasoningSessions maps rows', async () => {
    execute.mockResolvedValue([
      {
        id: E1, organization_id: ORG, title: 'A', focus: 'general_continuity', status: 'active',
        context_description: 'c', graph_state: null, active_simulations: [], annotations: [],
        linked_message_ids: [], linked_memory_ids: [], latest_resilience_score: 60,
        created_at: { toISOString: () => '2025-01-01T00:00:00.000Z' },
        updated_at: { toISOString: () => '2025-01-01T00:00:00.000Z' },
      },
      { id: 's2', organization_id: ORG, title: 'B', focus: 'general_continuity', status: 'active', created_at: '2025-01-02T00:00:00.000Z', updated_at: '2025-01-02T00:00:00.000Z' },
    ]);
    const sessions = await listReasoningSessions(ORG, { status: 'active', limit: 5 });
    expect(sessions.length).toBe(2);
    expect(sessions[1].contextDescription).toBe('');
    expect(sessions[1].annotations).toEqual([]);
  });

  it('listReasoningSessions works with no options', async () => {
    execute.mockResolvedValue([]);
    expect(await listReasoningSessions(ORG)).toEqual([]);
  });

  it('getReasoningSession returns session or null', async () => {
    execute.mockResolvedValue([{ id: E1, organization_id: ORG, title: 'A', focus: 'general_continuity', status: 'active', created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' }]);
    expect((await getReasoningSession(ORG, E1))?.id).toBe(E1);
    execute.mockResolvedValue([]);
    expect(await getReasoningSession(ORG, E2)).toBeNull();
  });

  it('updateReasoningSession audits an updated session on the same transaction', async () => {
    execute.mockResolvedValue([{ id: E1 }]);
    expect(await updateReasoningSession(ORG, E1, { title: 'New', graphState: { nodes: [] } } as never, USER)).toBe(true);
    expect(await updateReasoningSession(ORG, E1, { status: 'archived' } as never, USER)).toBe(true);
    expect(audit).toHaveBeenCalledWith({ execute }, expect.objectContaining({ action: 'reasoning_session.update', resourceId: E1, details: { fields: ['title', 'graphState'] } }));
  });

  it('writes that match no session of the organization audit nothing', async () => {
    execute.mockResolvedValue([]);
    expect(await updateReasoningSession(ORG, E1, { title: 'x' } as never, USER)).toBe(false);
    expect(await addSessionAnnotation(ORG, E1, 'note', null, USER)).toBeNull();
    expect(await linkMemoryToSession(ORG, E1, E2, USER)).toBe(false);
    expect(await addSessionSimulation(ORG, E1, { id: 'sim' } as never, USER)).toBe(false);
    expect(audit).not.toHaveBeenCalled();
  });

  it('a failing audit fails the write', async () => {
    execute.mockResolvedValue([{ id: E1 }]);
    audit.mockRejectedValueOnce(new Error('audit down'));
    await expect(updateReasoningSession(ORG, E1, { title: 'x' } as never, USER)).rejects.toThrow('audit down');
  });

  it('addSessionAnnotation returns an annotation', async () => {
    execute.mockResolvedValue([{ id: E1 }]);
    const annotation = await addSessionAnnotation(ORG, E1, 'note', 'ref-1', USER);
    expect(annotation?.text).toBe('note');
    expect(annotation?.targetRef).toBe('ref-1');
    expect(annotation?.id).toBeDefined();
    expect(audit).toHaveBeenCalledWith({ execute }, expect.objectContaining({ action: 'reasoning_session.annotate' }));
  });

  it('linkMemoryToSession and addSessionSimulation execute audited updates', async () => {
    execute.mockResolvedValue([{ id: E1 }]);
    expect(await linkMemoryToSession(ORG, E1, 'mem-1', USER)).toBe(true);
    expect(await addSessionSimulation(ORG, E1, { id: 'sim-1' } as never, USER)).toBe(true);
    expect(audit).toHaveBeenCalledTimes(2);
  });

  it('runs every operation inside the organization tenant context', async () => {
    await listReasoningSessions(OTHER_ORG);
    await getReasoningSession(OTHER_ORG, E1);
    await updateReasoningSession(OTHER_ORG, E1, { title: 'x' } as never, USER);
    await addSessionAnnotation(OTHER_ORG, E1, 'note', null, USER);
    await linkMemoryToSession(OTHER_ORG, E1, E2, USER);
    await addSessionSimulation(OTHER_ORG, E1, { id: 'sim' } as never, USER);
    await createReasoningSession(OTHER_ORG, { title: 'T' } as never, USER);
    expect(withRLSContext).toHaveBeenCalledTimes(7);
    for (const call of withRLSContext.mock.calls) {
      expect(call[0]).toEqual({ organizationId: OTHER_ORG });
    }
  });

  it('refuses a non-UUID organization before touching the database', async () => {
    await expect(listReasoningSessions('org-1')).rejects.toThrow('organizationId must be a UUID');
    expect(withRLSContext).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('treats a malformed session id as matching nothing without querying', async () => {
    expect(await getReasoningSession(ORG, 'not-a-uuid')).toBeNull();
    expect(await updateReasoningSession(ORG, 'not-a-uuid', { title: 'x' } as never, USER)).toBe(false);
    expect(await linkMemoryToSession(ORG, 'not-a-uuid', E2, USER)).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it('never issues schema DDL', () => {
    const source = readFileSync(fileURLToPath(new URL('../session-manager.ts', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/CREATE\s+(TABLE|INDEX)|ALTER\s+TABLE|ensureTable/i);
  });
});