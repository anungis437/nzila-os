// bargaining/proposals is a simple crudRoutes wrapper.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/crud-factory', () => ({
  crudRoutes: vi.fn(() => ({
    GET: vi.fn(async () => ({ data: [] })),
    POST: vi.fn(async () => ({ data: { id: 'p1' } })),
  })),
}));
vi.mock('@/db/schema', () => ({ bargainingProposals: {} }));

describe('bargaining/proposals route', () => {
  it('exports GET and POST handlers', async () => {
    const route = await import('../bargaining/proposals/route');
    expect(typeof route.GET).toBe('function');
    expect(typeof route.POST).toBe('function');
  });
});
