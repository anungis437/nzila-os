/**
 * Timeline Integration Service — Unit Tests
 *
 * Connects FSM status changes to the grievance timeline. Uses the drizzle
 * builder API (select/update) and delegates message text to
 * generateStatusUpdateMessage (mocked). A shared ordered queue feeds the
 * builder terminals.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const q: unknown[] = [];
  const shift = () => (q.length ? q.shift() : []);
  const makeChain = () => {
    const c: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'orderBy', 'limit', 'set', 'values', 'update', 'insert', 'delete']) {
      c[m] = () => c;
    }
    (c as { then: unknown }).then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = shift();
      if (v instanceof Error) return Promise.reject(v).then(res, rej);
      return Promise.resolve(v).then(res, rej);
    };
    return c;
  };
  const db = { select: makeChain, update: makeChain, insert: makeChain, delete: makeChain };
  return { q, db, msg: vi.fn(() => 'MSG') };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/db', () => ({ db: h.db }));
vi.mock('@/db/schema/grievance-schema', () => ({ grievances: { id: 'id', status: { enumValues: [] }, priority: 'priority' } }));
vi.mock('@/lib/member-experience/timeline-builder', () => ({ generateStatusUpdateMessage: h.msg }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as t from '../timeline-integration';

const push = (...rows: unknown[]) => h.q.push(...rows);
beforeEach(() => {
  h.q.length = 0;
  vi.clearAllMocks();
  h.msg.mockReturnValue('MSG');
});

describe('timeline-integration — addTimelineEntry', () => {
  it('appends to existing timeline and updates grievance', async () => {
    push([{ id: 'c1', timeline: [{ status: 'old', timestamp: new Date(), metadata: {} }] }]); // select
    push({}); // update
    const r = await t.addTimelineEntry('c1', 'open' as never, 'investigating' as never, 'u1', 'steward', 'notes', {
      slaCompliant: true,
      daysInState: 2,
    });
    expect(r).toEqual({ success: true });
  });
  it('handles null timeline (defaults to empty history)', async () => {
    push([{ id: 'c1', timeline: null }]);
    push({});
    expect(await t.addTimelineEntry('c1', 'open' as never, 'closed' as never, 'u1', 'admin')).toEqual({
      success: true,
    });
  });
  it('returns failure when grievance not found', async () => {
    push([]);
    const r = await t.addTimelineEntry('cX', 'open' as never, 'closed' as never, 'u1', 'admin');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });
  it('returns failure on db error', async () => {
    push(new Error('write failed'));
    const r = await t.addTimelineEntry('c1', 'open' as never, 'closed' as never, 'u1', 'admin');
    expect(r.success).toBe(false);
    expect(r.error).toBe('write failed');
  });
});

describe('timeline-integration — generateTimelineMessage', () => {
  it('delegates to generateStatusUpdateMessage (with + without optional args)', () => {
    expect(t.generateTimelineMessage('open' as never, 3, 'high', 'Jane')).toBe('MSG');
    expect(t.generateTimelineMessage('open' as never, 3)).toBe('MSG');
    expect(h.msg).toHaveBeenCalledTimes(2);
  });
});

describe('timeline-integration — getEnrichedTimeline', () => {
  it('enriches each entry with a human-readable message', async () => {
    const t1 = new Date('2024-01-01T00:00:00Z');
    const t2 = new Date('2024-01-03T00:00:00Z');
    push([
      {
        id: 'c1',
        priority: 'high',
        timeline: [
          { status: 'open', timestamp: t1, metadata: { previousStatus: '' } },
          { status: 'investigating', timestamp: t2, metadata: { previousStatus: 'open' } },
        ],
      },
    ]);
    const r = await t.getEnrichedTimeline('c1');
    expect(r.success).toBe(true);
    expect(r.timeline).toHaveLength(2);
    expect(r.timeline?.[0].message).toBe('MSG');
  });
  it('handles null timeline', async () => {
    push([{ id: 'c1', priority: 'low', timeline: null }]);
    const r = await t.getEnrichedTimeline('c1');
    expect(r.success).toBe(true);
    expect(r.timeline).toEqual([]);
  });
  it('returns failure when case not found', async () => {
    push([]);
    expect((await t.getEnrichedTimeline('cX')).success).toBe(false);
  });
  it('returns failure on db error', async () => {
    push(new Error('read failed'));
    const r = await t.getEnrichedTimeline('c1');
    expect(r.success).toBe(false);
    expect(r.error).toBe('read failed');
  });
});
