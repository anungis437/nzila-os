import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@/lib/api/errors';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  badRequest: vi.fn(),
  db: { execute: vi.fn() },
  withRLSContext: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { badRequest: m.badRequest },
}));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('drizzle-orm', () => ({ sql: m.sql }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));

async function loadRoute() {
  return import('../dues/arrears/route');
}

const REFUSAL = { status: 501, code: ErrorCode.NOT_IMPLEMENTED, message: 'Finance and dues persistence are not available in this release.' };

describe('dues/arrears route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
      (ctx: any) => handler(ctx));
    m.badRequest.mockImplementation((message: string) => Object.assign(new Error(message), { status: 400 }));
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.execute.mockResolvedValue([{ id: 'a1', memberId: 'm1', amountOwed: '250.00' }]);
    m.sql.mockImplementation((parts: TemplateStringsArray, ...values: unknown[]) => ({ parts, values }));
  });

  it('throws 400 when organizationId is missing', async () => {
    const { GET } = await loadRoute();

    await expect(GET({ organizationId: null })).rejects.toMatchObject({ status: 400 });
  });

  it('is refused with 501 and reads nothing, even for a valid organization', async () => {
    const { GET } = await loadRoute();

    await expect(GET({ organizationId: 'org_1' })).rejects.toMatchObject(REFUSAL);
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.db.execute).not.toHaveBeenCalled();
  });
});
