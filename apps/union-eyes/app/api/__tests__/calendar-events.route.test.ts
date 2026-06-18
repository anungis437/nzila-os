// calendar/events is a simple crudRoutes wrapper.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/crud-factory', () => ({
  crudRoutes: vi.fn(() => ({
    GET: vi.fn(async () => ({ data: [] })),
    POST: vi.fn(async () => ({ data: { id: 'ev1' } })),
  })),
}));
vi.mock('@/db/schema', () => ({ calendarEvents: {} }));

describe('calendar/events route', () => {
  it('exports GET and POST handlers', async () => {
    const route = await import('../calendar/events/route');
    expect(typeof route.GET).toBe('function');
    expect(typeof route.POST).toBe('function');
  });
});
