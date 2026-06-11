// claims/route is a crudRoutes wrapper with a custom POST.
// These tests verify handlers are exported and callable.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/crud-factory', () => ({
  crudRoutes: vi.fn(() => ({
    GET: vi.fn(async () => ({ data: [] })),
    POST: vi.fn(async () => ({ data: { claimId: 'c1' } })),
  })),
}));
vi.mock('@/lib/api/with-api', () => ({ withApi: vi.fn((_cfg: unknown, handler: any) => (ctx: any = {}) => handler(ctx)) }));
vi.mock('@/lib/api/errors', () => ({ ApiError: { badRequest: vi.fn((msg: string) => { throw new Error(msg); }) } }));
vi.mock('@/db/schema', () => ({ claims: {} }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemRLSContext: vi.fn(async (fn: any) => fn({ execute: vi.fn(async () => []) })) }));

describe('claims route', () => {
  it('exports GET and POST handlers', async () => {
    const route = await import('../claims/route');
    expect(typeof route.GET).toBe('function');
    expect(typeof route.POST).toBe('function');
  });
});
