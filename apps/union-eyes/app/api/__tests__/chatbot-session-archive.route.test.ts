import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const m = vi.hoisted(() => ({
  config: undefined as Record<string, unknown> | undefined,
  selectRows: [] as unknown[],
  selectQueue: [] as unknown[][],
  updateRows: [] as unknown[],
  ops: [] as string[],
  sets: [] as Array<Record<string, unknown>>,
  wheres: [] as unknown[],
  contexts: [] as Array<Record<string, unknown>>,
  persistAtomicAudit: vi.fn(),
  eq: vi.fn((column: unknown, value: unknown) => ({ eq: [column, value] })),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: (config: Record<string, unknown>, handler: (ctx: unknown) => Promise<unknown>) => {
    m.config = config;
    return (ctx: unknown) => handler(ctx);
  },
  zUUID: z.string().uuid(),
  ApiError: {
    forbidden: (msg: string) => Object.assign(new Error(msg), { status: 403 }),
    notFound: (msg: string) => Object.assign(new Error(`${msg} not found`), { status: 404 }),
    conflict: (msg: string) => Object.assign(new Error(msg), { status: 409 }),
  },
}));
vi.mock('@/db/schema', () => ({
  chatSessions: { id: 'chat_sessions.id', organizationId: 'chat_sessions.organization_id', userId: 'chat_sessions.user_id', status: 'chat_sessions.status', updatedAt: 'chat_sessions.updated_at' },
}));
vi.mock('drizzle-orm', () => ({
  and: (...conditions: unknown[]) => ({ and: conditions }),
  eq: m.eq,
}));

const chain = (rows: () => unknown[], op: string) => {
  const c: Record<string, unknown> = {};
  for (const name of ['from', 'limit']) c[name] = () => c;
  c.where = (condition: unknown) => {
    m.wheres.push(condition);
    return c;
  };
  c.set = (values: Record<string, unknown>) => {
    m.sets.push(values);
    return c;
  };
  c.returning = async () => {
    m.ops.push(op);
    return rows();
  };
  c.then = (resolve: (value: unknown) => unknown) => {
    m.ops.push(op);
    return Promise.resolve(rows()).then(resolve);
  };
  return c;
};
const tx = {
  select: () => chain(() => (m.selectQueue.length ? m.selectQueue.shift()! : m.selectRows), 'select'),
  update: () => chain(() => m.updateRows, 'update'),
};
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (context: Record<string, unknown>, run: (handle: unknown) => Promise<unknown>) => {
    m.contexts.push(context);
    return run(tx);
  }),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));

const SESSION = '11111111-1111-4111-8111-111111111111';
const caller = { organizationId: 'org-1', userId: 'user-1', params: { sessionId: SESSION } };
const post = async (ctx: unknown) => {
  const { POST } = await import('../chatbot/sessions/[sessionId]/archive/route');
  // withApi is replaced above by a function that runs the handler on a context object.
  return (POST as unknown as (context: unknown) => Promise<unknown>)(ctx);
};

describe('POST /api/chatbot/sessions/[sessionId]/archive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.ops.length = 0;
    m.sets.length = 0;
    m.wheres.length = 0;
    m.contexts.length = 0;
    m.selectQueue.length = 0;
    m.selectRows = [{ id: SESSION, status: 'active' }];
    m.updateRows = [{ id: SESSION, status: 'archived' }];
    m.persistAtomicAudit.mockResolvedValue(undefined);
  });

  it('is open to a member of an organization holding the chatbot module (ai_advanced_insights), and to nobody else', async () => {
    await post(caller);
    // Authentication and a member role floor, an active organization, and the module the assistant routes all require (the chatbot has no module of its own)
    expect(m.config).toMatchObject({
      auth: { required: true, minRole: 'member' },
      requireOrg: true,
      entitlement: 'ai_advanced_insights',
    });
  });

  it('archives the caller’s active session and audits it in the same transaction', async () => {
    const result = await post(caller);

    expect(result).toEqual({ data: { id: SESSION, status: 'archived' } });
    expect(m.sets).toEqual([{ status: 'archived', updatedAt: expect.any(Date) }]);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(tx, {
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'chatbot.session.archive',
      resourceType: 'chat_sessions',
      resourceId: SESSION,
      details: { from: 'active', to: 'archived' },
    });
    expect(m.contexts).toEqual([{ organizationId: 'org-1', userId: 'user-1' }]);
  });

  it('finds the session by its owner and organization taken from the resolved caller, in the read and in the write', async () => {
    await post({ ...caller, params: { sessionId: SESSION, userId: 'someone-else', organizationId: 'org-2' } });

    const scopeOf = (conditions: unknown[]) => (conditions as Array<{ eq: [string, string] }>).map(({ eq }) => `${eq[0]}=${eq[1]}`);
    const [read, write] = m.wheres as Array<{ and: unknown[] }>;
    // Both statements carry the scope themselves (a write may not rely on the read before it), and the write also needs the session to be active.
    expect(scopeOf(read.and)).toEqual([`chat_sessions.id=${SESSION}`, 'chat_sessions.organization_id=org-1', 'chat_sessions.user_id=user-1']);
    expect(scopeOf(write.and)).toEqual([...scopeOf(read.and), 'chat_sessions.status=active']);
  });

  it('answers not found, writing and auditing nothing, for a session that is not the caller’s or does not exist', async () => {
    m.selectRows = [];
    await expect(post(caller)).rejects.toMatchObject({ status: 404 });
    expect(m.ops).toEqual(['select']);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('treats a deleted session as gone', async () => {
    m.selectRows = [{ id: SESSION, status: 'deleted' }];
    await expect(post(caller)).rejects.toMatchObject({ status: 404 });
    expect(m.ops).not.toContain('update');
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('archiving an archived session succeeds without writing or auditing again', async () => {
    m.selectRows = [{ id: SESSION, status: 'archived' }];
    await expect(post(caller)).resolves.toEqual({ data: { id: SESSION, status: 'archived' } });
    expect(m.ops).toEqual(['select']);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('answers conflict, with no audit record, when the session changed between the read and the write', async () => {
    m.updateRows = [];
    await expect(post(caller)).rejects.toMatchObject({ status: 409 });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('succeeds without a second audit record when a concurrent request archived the session between the read and the write', async () => {
    m.updateRows = [];
    m.selectQueue = [[{ id: SESSION, status: 'active' }], [{ id: SESSION, status: 'archived' }]];
    await expect(post(caller)).resolves.toEqual({ data: { id: SESSION, status: 'archived' } });
    expect(m.ops).toEqual(['select', 'update', 'select']);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('fails the archive when its audit record cannot be written, so the status change is not kept', async () => {
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(post(caller)).rejects.toThrow('audit unavailable');
  });

  it('answers not found for an identifier that is not a uuid, before touching the database', async () => {
    await expect(post({ ...caller, params: { sessionId: 'not-a-uuid' } })).rejects.toMatchObject({ status: 404 });
    expect(m.contexts).toHaveLength(0);
  });

  it('refuses a request without a resolved organization and user', async () => {
    await expect(post({ ...caller, organizationId: null })).rejects.toMatchObject({ status: 403 });
    await expect(post({ ...caller, userId: null })).rejects.toMatchObject({ status: 403 });
    expect(m.contexts).toHaveLength(0);
  });
});
