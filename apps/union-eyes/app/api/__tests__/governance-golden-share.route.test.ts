import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { execute: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, z: require('zod') }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../governance/golden-share/route');
}

describe('governance/golden-share route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.execute.mockResolvedValueOnce([{ id: 'share_1' }]).mockResolvedValueOnce(undefined as never);
  });

  it('returns the latest share record', async () => {
    const { GET } = await loadRoute();
    const result = await GET();

    expect(result).toEqual({ share: { id: 'share_1' } });
  });

  it('creates a golden share certificate', async () => {
    const randomUuid = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('uuid-2');
    const { POST } = await loadRoute();
    const result = await POST({ body: { certificateNumber: 'CERT-1', issueDate: '2026-01-01', councilMembers: [] } });

    expect(result).toEqual({ id: 'uuid-2' });
    randomUuid.mockRestore();
  });
});