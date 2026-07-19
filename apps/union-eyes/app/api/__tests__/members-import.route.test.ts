import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  ApiError: {
    badRequest: vi.fn((msg: string) => Object.assign(new Error(msg), { status: 400 })),
  },
  withRLSContext: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn() },
  getUserList: vi.fn(),
  insertShouldFail: false,
}));

const mockDb = {
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      onConflictDoNothing: vi.fn(async () => {
        if (m.insertShouldFail) {
          throw new Error('insert failed');
        }
        return undefined;
      }),
    })),
  })),
};

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: m.ApiError,
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@nzila/platform-auth/entra/server', () => ({
  adminClient: { users: { getUserList: m.getUserList } },
}));

async function loadRoute() {
  return import('../members/import/route');
}

describe('members/import route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.insertShouldFail = false;
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.getUserList.mockResolvedValue({ data: [] });
    m.withApi.mockImplementation(
      (_config: unknown, handler: (ctx: any) => Promise<unknown>) =>
        async (request: NextRequest, ctx: any = { organizationId: 'org_1' }) => {
          try {
            const data = await handler({ request, ...ctx });
            return new Response(JSON.stringify(data), { status: 200 });
          } catch (err) {
            return new Response(JSON.stringify({ error: (err as Error).message }), { status: (err as any).status ?? 500 });
          }
        },
    );
  });

  it('POST returns 400 when organization context is missing', async () => {
    const { POST } = await loadRoute();
    const form = new FormData();
    form.append('file', new File(['email,name\na@example.com,A'], 'members.csv', { type: 'text/csv' }));

    const response = await POST(new NextRequest('http://localhost/api/members/import', { method: 'POST', body: form }), {});
    expect(response.status).toBe(400);
  });

  it('POST returns 400 when file is not provided', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/members/import', {
      method: 'POST',
      body: new FormData(),
    }), { organizationId: 'org_1' });

    expect(response.status).toBe(400);
  });

  it('POST returns zero processed for header-only CSV', async () => {
    const { POST } = await loadRoute();
    const form = new FormData();
    form.append('file', new File(['email,name'], 'members.csv', { type: 'text/csv' }));

    const response = await POST(new NextRequest('http://localhost/api/members/import', {
      method: 'POST',
      body: form,
    }), { organizationId: 'org_1' });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.processed).toBe(0);
  });

  it('POST imports rows and uses Entra lookup when user exists', async () => {
    const { POST } = await loadRoute();
    m.getUserList.mockResolvedValueOnce({ data: [{ id: 'entra_u1' }] });
    const form = new FormData();
    form.append('file', new File(['email,name,role\na@example.com,Alpha,admin'], 'members.csv', { type: 'text/csv' }));

    const response = await POST(new NextRequest('http://localhost/api/members/import', {
      method: 'POST',
      body: form,
    }), { organizationId: 'org_1' });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.processed).toBe(1);
    expect(m.getUserList).toHaveBeenCalled();
  });

  it('POST skips rows when insert fails and logs warnings', async () => {
    const { POST } = await loadRoute();
    m.insertShouldFail = true;
    const form = new FormData();
    form.append('file', new File(['email,name\na@example.com,Alpha'], 'members.csv', { type: 'text/csv' }));

    const response = await POST(new NextRequest('http://localhost/api/members/import', {
      method: 'POST',
      body: form,
    }), { organizationId: 'org_1' });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.skipped).toBeGreaterThan(0);
    expect(m.logger.warn).toHaveBeenCalled();
  });
});
