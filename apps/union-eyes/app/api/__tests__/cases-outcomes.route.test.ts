import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  crudRoutes: vi.fn(),
}));

vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: m.crudRoutes }));
vi.mock('@/db/schema', () => ({ grievances: {} }));

async function loadRoute() {
  return import('../cases/outcomes/route');
}

describe('cases/outcomes route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.crudRoutes.mockReturnValue({
      GET: vi.fn(async () => ({ data: [] })),
      POST: vi.fn(async () => ({ data: { id: 'o1' } })),
    });
  });

  it('exports GET and POST handlers', async () => {
    const route = await loadRoute();
    expect(typeof route.GET).toBe('function');
    expect(typeof route.POST).toBe('function');
  });
});
