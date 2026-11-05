import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  listCorrespondence: vi.fn(),
  createCorrespondence: vi.fn(),
}));

vi.mock('@/lib/api/with-api', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => unknown) => (ctx: unknown) => handler(ctx),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/services/correspondence-service', () => ({
  listCorrespondence: m.listCorrespondence,
  createCorrespondence: m.createCorrespondence,
}));

const request = () => new NextRequest('http://localhost/api/correspondence');
const body = { subject: 'Subject', body: 'Body' };

describe('correspondence route fails closed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses to list without an organization instead of querying an unscoped tenant', async () => {
    const { GET } = await import('../correspondence/route');
    await expect(GET({ request: request(), userId: 'u1' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(m.listCorrespondence).not.toHaveBeenCalled();
  });

  it('surfaces a read failure rather than returning an empty queue', async () => {
    m.listCorrespondence.mockRejectedValue(new Error('relation missing'));
    const { GET } = await import('../correspondence/route');
    await expect(GET({ request: request(), organizationId: 'org-1', userId: 'u1' })).rejects.toMatchObject({ code: 'DATABASE_ERROR' });
  });

  it('refuses to create a draft without organization and actor context', async () => {
    const { POST } = await import('../correspondence/route');
    await expect(POST({ request: request(), userId: 'u1', body })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(POST({ request: request(), organizationId: 'org-1', body })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(m.createCorrespondence).not.toHaveBeenCalled();
  });

  it('lists with the authenticated organization', async () => {
    m.listCorrespondence.mockResolvedValue([{ id: 'c1' }]);
    const { GET } = await import('../correspondence/route');
    const result = await GET({ request: request(), organizationId: 'org-1', userId: 'u1' }) as { count: number };
    expect(m.listCorrespondence).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1' }));
    expect(result.count).toBe(1);
  });
});
