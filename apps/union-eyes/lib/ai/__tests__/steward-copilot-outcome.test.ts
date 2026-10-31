import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  queue: [] as unknown[],
  audit: vi.fn(),
  where: vi.fn(),
  operation: vi.fn(),
  insertValues: vi.fn(),
}));

function chain(): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  for (const m of ['update', 'set', 'select', 'from', 'limit', 'returning', 'insert']) c[m] = () => c;
  c.where = (...args: unknown[]) => {
    h.where(...args);
    return c;
  };
  c.values = (...args: unknown[]) => {
    h.insertValues(...args);
    return c;
  };
  c.then = (resolve: (v: unknown) => void) => resolve(h.queue.shift());
  return c;
}

const tx = chain();
vi.mock('@/db/db', () => ({ db: {} }));
vi.mock('drizzle-orm', () => ({ eq: (...a: unknown[]) => ['eq', ...a], and: (...a: unknown[]) => ['and', ...a], desc: (x: unknown) => x }));
vi.mock('@/db/schema/domains/ml/ai-copilot-sessions', () => ({
  aiCopilotSessions: new Proxy({}, { get: (_t, p) => String(p) }),
}));
vi.mock('@/db/schema/domains/claims/grievances', () => ({ grievances: {} }));
vi.mock('@/lib/ai/ai-client', () => ({
  toGatewayDataClass: vi.fn((dataClass: string) => dataClass),
  getAiClient: () => ({ generate: vi.fn().mockResolvedValue({ content: '{}' }) }),
  buildOrgAiTrace: vi.fn(),
  UE_APP_KEY: 'ue',
  UE_PROFILES: { STEWARD_COPILOT: 'p' },
  UE_SYSTEM_ORG_ID: 'sys',
}));
vi.mock('@/lib/ai/ai-feature-guard', () => ({
  auditAiInteraction: vi.fn().mockResolvedValue('ref'),
  buildAiEnvelope: vi.fn((data: unknown) => ({ data })),
}));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_scope: unknown, fn: (t: unknown) => Promise<unknown>) => fn(tx),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: h.audit }));
vi.mock('@/lib/audit/operation-audit', () => ({ performAuditedOperation: h.operation }));

import { executeCopilotAction, recordCopilotOutcome } from '../steward-copilot';

beforeEach(() => {
  h.queue.length = 0;
  h.audit.mockReset().mockResolvedValue(undefined);
  h.where.mockReset();
  h.insertValues.mockReset();
  h.operation.mockReset().mockImplementation(async (_op: unknown, fn: () => Promise<unknown>) => fn());
});

describe('recordCopilotOutcome', () => {
  it('records the outcome of the caller\'s own pending session and audits on the same transaction', async () => {
    h.queue.push([{ id: 's1' }]);
    const result = await recordCopilotOutcome('s1', 'org-1', 'user-1', 'accepted');
    expect(result).toBe('recorded');
    expect(h.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'ai.copilot.session.outcome',
        resourceId: 's1',
        details: { outcome: 'accepted', humanApproved: true },
      }),
    );
  });

  it('constrains the update to the session\'s own user, organization and pending state', async () => {
    h.queue.push([{ id: 's1' }]);
    await recordCopilotOutcome('s1', 'org-1', 'user-1', 'rejected');
    const predicate = JSON.stringify(h.where.mock.calls[0]);
    expect(predicate).toContain('"organizationId","org-1"');
    expect(predicate).toContain('"userId","user-1"');
    expect(predicate).toContain('"outcome","pending"');
  });

  it('is not found, with no audit, when the session belongs to another user or organization', async () => {
    h.queue.push([], []);
    expect(await recordCopilotOutcome('s1', 'org-1', 'user-2', 'accepted')).toBe('not_found');
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('never overwrites an outcome that was already decided', async () => {
    h.queue.push([], [{ id: 's1' }]);
    expect(await recordCopilotOutcome('s1', 'org-1', 'user-1', 'rejected')).toBe('already_decided');
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('fails when the audit record cannot be written', async () => {
    h.queue.push([{ id: 's1' }]);
    h.audit.mockRejectedValueOnce(new Error('audit down'));
    await expect(recordCopilotOutcome('s1', 'org-1', 'user-1', 'accepted')).rejects.toThrow('audit down');
  });
});

describe('executeCopilotAction persistence', () => {
  const input = { organizationId: 'org-1', userId: 'user-1', userRole: 'steward', actionType: 'custom_query', query: 'q' } as const;

  it('stores the session and audits it on the same transaction', async () => {
    await executeCopilotAction({ ...input });
    expect(h.insertValues).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1', userId: 'user-1', outcome: 'pending' }));
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'ai.copilot.session.create', userId: 'user-1' }));
  });

  it('does not call the provider when its intent cannot be recorded', async () => {
    h.operation.mockRejectedValueOnce(new Error('intent not recorded'));
    await expect(executeCopilotAction({ ...input })).rejects.toThrow('intent not recorded');
    expect(h.insertValues).not.toHaveBeenCalled();
  });

  it('does not keep a session whose audit record cannot be written', async () => {
    h.audit.mockRejectedValueOnce(new Error('audit down'));
    await expect(executeCopilotAction({ ...input })).rejects.toThrow('audit down');
  });
});
