import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  badRequest: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { badRequest: m.badRequest },
}));
vi.mock('@/db', () => ({ db: { insert: m.insert } }));
vi.mock('@/db/schema/dues-finance-schema', () => ({
  memberDuesIssues: { id: 'id' },
}));
vi.mock('next/server', () => ({
  NextResponse: { json: (body: unknown) => body },
}));

async function loadRoute() {
  return import('../dues/issues/route');
}

describe('/api/dues/issues route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => handler);
    m.badRequest.mockImplementation((message: string) => Object.assign(new Error(message), { status: 400 }));
  });

  it('actually persists the reported issue via db.insert (no fabricated success ack)', async () => {
    const values = vi.fn();
    const returning = vi.fn(async () => [
      {
        id: 'issue_1',
        organizationId: 'org_1',
        userId: 'user_1',
        issueType: 'missing_deduction',
        subject: 'Dues missing from March pay stub',
        description: 'No dues line item appears on my March 15 pay stub.',
        status: 'open',
      },
    ]);
    m.insert.mockImplementation((table: unknown) => ({
      values: (v: unknown) => {
        values(table, v);
        return { returning };
      },
    }));

    const { POST } = await loadRoute();
    const result = await POST({
      organizationId: 'org_1',
      userId: 'user_1',
      body: {
        issueType: 'missing_deduction',
        subject: 'Dues missing from March pay stub',
        description: 'No dues line item appears on my March 15 pay stub.',
      },
    });

    expect(m.insert).toHaveBeenCalledTimes(1);
    expect(returning).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(
      { id: 'id' },
      expect.objectContaining({
        organizationId: 'org_1',
        userId: 'user_1',
        issueType: 'missing_deduction',
        status: 'open',
      }),
    );
    expect(result).toEqual({
      success: true,
      issue: expect.objectContaining({ id: 'issue_1', status: 'open' }),
    });
  });

  it('rejects an invalid issueType before touching the database', async () => {
    const { POST } = await loadRoute();

    await expect(
      POST({
        organizationId: 'org_1',
        userId: 'user_1',
        body: { issueType: 'not_a_real_type', subject: 'x', description: 'y' },
      }),
    ).rejects.toMatchObject({ status: 400 });

    expect(m.insert).not.toHaveBeenCalled();
  });

  it('rejects when organization/user context is missing', async () => {
    const { POST } = await loadRoute();

    await expect(
      POST({ organizationId: null, userId: null, body: {} }),
    ).rejects.toMatchObject({ status: 400 });

    expect(m.insert).not.toHaveBeenCalled();
  });
});
