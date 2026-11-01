import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn() },
  indexExitInterview: vi.fn(),
  isIndexingAllowed: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
    conflict: (msg: string) => Object.assign(new Error(msg), { status: 409 }),
    internal: (msg: string) => Object.assign(new Error(msg), { status: 500 }),
  },
}));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ exitInterviews: { id: 'id', organizationId: 'organizationId' }, exitInterviewEvents: {} }));
vi.mock('@/lib/knowledge-transfer/indexing/semantic-indexer', () => ({ indexExitInterview: m.indexExitInterview }));
vi.mock('@/lib/knowledge-transfer/governance/consent-controls', () => ({ isIndexingAllowed: m.isIndexingAllowed }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, and: vi.fn(() => 'and'), eq: vi.fn(() => 'eq'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../exit-interviews/[id]/index/route');
}

describe('exit-interviews/[id]/index route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.db.select.mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => []) })) })) } as any);
    m.db.insert.mockReturnValue({ values: vi.fn(async () => undefined) } as any);
    m.indexExitInterview.mockResolvedValue({ indexed: true, knowledgeBaseId: 'kb_1' });
    m.isIndexingAllowed.mockReturnValue(true);
  });

  it('returns not found when the interview does not exist', async () => {
    const { POST } = await loadRoute();
    await expect(POST({ params: { id: 'ei_1' }, organizationId: 'org_1', userId: 'u1' })).rejects.toMatchObject({ status: 404 });
  });

  it('indexes a published interview when allowed', async () => {
    m.db.select.mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'ei_1', status: 'published', sensitivityLevel: 'public_internal', consentGranted: true }]) })) })) } as any);
    const { POST } = await loadRoute();
    const result = await POST({ params: { id: 'ei_1' }, organizationId: 'org_1', userId: 'u1' });

    expect(result).toEqual({ data: { indexed: true, knowledgeBaseId: 'kb_1' } });
    expect(m.indexExitInterview).toHaveBeenCalledWith('ei_1', 'org_1', 'u1', {
      eventNotes: 'Manual semantic re-index triggered',
    });
    // Lookup is scoped to the caller organization, not just the interview id.
    expect(eq).toHaveBeenCalledWith('organizationId', 'org_1');
  });

  // DEF-0B7-EXC-INDEX-FAILURE-RETURNS-200-WITH-RAW-ERROR-TEXT
  it('answers a failed indexing as a 500 without the error text', async () => {
    m.db.select.mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'ei_1', status: 'published', sensitivityLevel: 'public_internal', consentGranted: true }]) })) })) } as any);
    m.indexExitInterview.mockResolvedValueOnce({ indexed: false, reason: 'Indexing failed', failed: true });
    const { POST } = await loadRoute();

    await expect(POST({ params: { id: 'ei_1' }, organizationId: 'org_1', userId: 'u1' })).rejects.toMatchObject({ status: 500, message: 'Indexing failed' });
  });

  it('refuses to index an interview that is not published', async () => {
    m.db.select.mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'ei_1', status: 'draft' }]) })) })) } as any);
    const { POST } = await loadRoute();

    await expect(POST({ params: { id: 'ei_1' }, organizationId: 'org_1', userId: 'u1' })).rejects.toMatchObject({ status: 409 });
    expect(m.indexExitInterview).not.toHaveBeenCalled();
  });

  it('does not index when the governance/consent gate denies it', async () => {
    m.isIndexingAllowed.mockReturnValue(false);
    m.db.select.mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'ei_1', status: 'published', sensitivityLevel: 'restricted', consentGranted: false }]) })) })) } as any);
    const { POST } = await loadRoute();
    const result = (await POST({ params: { id: 'ei_1' }, organizationId: 'org_1', userId: 'u1' })) as { data: { indexed: boolean } };

    expect(result.data.indexed).toBe(false);
    expect(m.indexExitInterview).not.toHaveBeenCalled();
  });
});