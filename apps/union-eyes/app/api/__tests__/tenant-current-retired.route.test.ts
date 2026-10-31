import { describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ withApi: vi.fn(), goneResponse: vi.fn() }));
vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/api/deprecation', () => ({ goneResponse: m.goneResponse }));

describe('retired /api/tenant/current alias', () => {
  it('requires a signed-in member and a resolved organization before responding', async () => {
    m.withApi.mockImplementation((policy: unknown, handler: unknown) => handler);
    m.goneResponse.mockReturnValue(new Response(JSON.stringify({ status: 'gone' }), { status: 410 }));
    vi.resetModules();
    const { GET } = await import('../tenant/current/route');
    expect(m.withApi).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { required: true, minRole: 'member' },
        requireOrg: true,
      }),
      expect.any(Function),
    );
    const response = await (GET as () => Promise<Response>)();
    expect(response.status).toBe(410);
    expect(m.goneResponse).toHaveBeenCalledWith('/api/tenant/current', expect.stringContaining('/api/org/current'));
  });
});
