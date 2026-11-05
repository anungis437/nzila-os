import { describe, expect, it, vi } from 'vitest';

// The admin PKI sign, verify and workflow routes signed into and read a process-local workflow map that nothing populates (census CTX-3): no
// signature or workflow could ever exist, so they answer 501 and touch no database, rather than answer "Workflow not found" forever.

const mocks = vi.hoisted(() => ({ statement: vi.fn(), withSystemContext: vi.fn(), withRLSContext: vi.fn() }));

vi.mock('@/lib/api/framework', async () => {
  const { ApiError } = await vi.importActual<typeof import('@/lib/api/errors')>('@/lib/api/errors');
  return {
    ApiError,
    withApi: (_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => async () => {
      try {
        return await handler({});
      } catch (error) {
        const status = (error as { code?: string }).code === 'NOT_IMPLEMENTED' ? 501 : 500;
        return { status, body: { error: (error as Error).message, code: (error as { code?: string }).code } };
      }
    },
  };
});
vi.mock('@/db/db', () => ({
  db: { select: mocks.statement, insert: mocks.statement, update: mocks.statement, delete: mocks.statement, execute: mocks.statement },
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: mocks.withSystemContext, withRLSContext: mocks.withRLSContext }));

const ROUTES: Array<[string, readonly string[], () => Promise<Record<string, unknown>>]> = [
  ['admin/pki/signatures/[id]/sign', ['POST'], () => import('../admin/pki/signatures/[id]/sign/route')],
  ['admin/pki/signatures/[id]/verify', ['POST'], () => import('../admin/pki/signatures/[id]/verify/route')],
  ['admin/pki/workflows/[id]', ['GET', 'PUT', 'DELETE'], () => import('../admin/pki/workflows/[id]/route')],
];

describe.each(ROUTES)('%s (retired)', (_name, methods, load) => {
  it('exports only the methods it always had', async () => {
    const mod = await load();
    expect(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].filter((method) => typeof mod[method] === 'function')).toEqual(methods);
  });

  it.each(methods)('%s answers 501 NOT_IMPLEMENTED and reads and writes nothing', async (method) => {
    const mod = await load();
    const result = await (mod[method] as () => Promise<{ status: number; body: { code: string; error: string } }>)();
    expect(result.status).toBe(501);
    expect(result.body.code).toBe('NOT_IMPLEMENTED');
    expect(result.body.error).toContain('is not implemented');
    expect(mocks.statement).not.toHaveBeenCalled();
    expect(mocks.withSystemContext).not.toHaveBeenCalled();
    expect(mocks.withRLSContext).not.toHaveBeenCalled();
  });
});
