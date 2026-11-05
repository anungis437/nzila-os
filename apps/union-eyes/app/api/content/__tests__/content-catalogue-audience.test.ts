import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  getUserRole: vi.fn(),
  hasMinRole: vi.fn(),
  execute: vi.fn(),
  sqlTexts: [] as string[],
}));
vi.mock('@/lib/api/framework', () => ({
  withApi: (_options: unknown, handler: unknown) => handler,
  ApiError: { forbidden: (message: string) => Object.assign(new Error(message), { status: 403 }) },
}));
vi.mock('@/lib/auth/rbac-server', () => ({ getUserRole: m.getUserRole }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/db/db', () => ({ db: { execute: m.execute } }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (handler: () => Promise<unknown>) => handler(),
}));
vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((result, part, i) => result + part + (i < values.length ? String(values[i]) : ''), ''),
}));

const context = (path: string) => ({
  organizationId: 'org-a',
  userId: 'member-a',
  request: { url: `https://example.test/api/content/${path}` },
});

describe('content catalogue tenant audience boundaries', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    m.getUserRole.mockResolvedValue('member');
    m.hasMinRole.mockResolvedValue(false);
    m.execute.mockResolvedValue([{
      id: 'page-a', title: 'Template', slug: 'template', status: 'published',
      created_by: 'author-a', content_type: 'template',
    }]);
  });

  it('restricts ordinary member templates to published records and their exact allowed role', async () => {
    const { GET } = await import('../templates/route');
    const result = await (GET as any)(context('templates?limit=50'));
    const query = String(m.execute.mock.calls[0][0]);
    expect(query).toContain("status = 'published'");
    expect(query).toContain('ANY(allowed_roles)');
    expect(query).toContain('member');
    expect(query).toContain('organization_id = org-a::uuid');
    expect(result.templates[0]).not.toHaveProperty('created_by');
    expect(m.getUserRole).toHaveBeenCalledWith('member-a', 'org-a');
  });

  it('keeps authorized editorial draft review and author visibility', async () => {
    m.getUserRole.mockResolvedValue('content_manager');
    m.hasMinRole.mockImplementation(async (role: string) => role === 'content_manager');
    const { GET } = await import('../templates/route');
    const result = await (GET as any)(context('templates'));
    const query = String(m.execute.mock.calls[0][0]);
    expect(query).not.toContain("status = 'published'");
    expect(result.templates[0].created_by).toBe('author-a');
  });

  it('fails closed when the tenant reader role cannot be resolved', async () => {
    m.getUserRole.mockResolvedValue(null);
    const { GET } = await import('../templates/route');
    await expect((GET as any)(context('templates'))).rejects.toMatchObject({ status: 403 });
    expect(m.execute).not.toHaveBeenCalled();
  });

  it('does not permit a member to enumerate inactive courses via active=false', async () => {
    m.execute.mockResolvedValue([]);
    const { GET } = await import('../training/route');
    await (GET as any)(context('training?active=false'));
    expect(String(m.execute.mock.calls[0][0])).toContain('tc.is_active = true');
  });

  it('preserves authorized content-manager access to inactive course administration', async () => {
    m.execute.mockResolvedValue([]);
    m.hasMinRole.mockImplementation(async (role: string) => role === 'content_manager');
    const { GET } = await import('../training/route');
    await (GET as any)(context('training?active=false'));
    expect(String(m.execute.mock.calls[0][0])).not.toContain('tc.is_active = true');
  });
});
