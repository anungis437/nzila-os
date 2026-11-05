import { describe, expect, it, vi } from 'vitest';

// DEF-0B12-CRUD-TESTIMONIAL-APPROVAL-COMPONENT-SENDS-FIELDS-THE-TABLE-DOES-NOT-HAVE: the approval component now sends approvedAt and featured, which the
// table has. The route stamps the approval with the server's clock, once.
const captured = vi.hoisted(() => ({ options: null as null | Record<string, any> }));
vi.mock('@/lib/api/crud-factory', () => ({
  crudRoutes: (options: Record<string, unknown>) => {
    captured.options = options;
    return { GET: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() };
  },
}));

describe('testimonials/[id] approval', () => {
  const load = async () => {
    await import('../testimonials/[id]/route');
    return captured.options!.beforeUpdate as (u: Record<string, unknown>, c: { existing: Record<string, unknown> }) => Record<string, unknown>;
  };

  it('replaces the client timestamp with the server time when a testimonial is approved', async () => {
    const beforeUpdate = await load();
    const before = Date.now();
    const result = beforeUpdate({ approvedAt: '1999-01-01T00:00:00.000Z' }, { existing: { approvedAt: null } });
    expect(result.approvedAt).toBeInstanceOf(Date);
    expect((result.approvedAt as Date).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('does not move the approval time of a testimonial that is already approved', async () => {
    const beforeUpdate = await load();
    const original = new Date('2026-01-01T00:00:00.000Z');
    expect(beforeUpdate({ approvedAt: new Date().toISOString() }, { existing: { approvedAt: original } }).approvedAt).toBe(original);
  });

  it('leaves other changes, such as featuring, untouched', async () => {
    const beforeUpdate = await load();
    expect(beforeUpdate({ featured: true }, { existing: { approvedAt: null } })).toEqual({ featured: true });
  });

  it('keeps the content-management floor for reads and writes', async () => {
    await load();
    expect(captured.options).toMatchObject({ readRole: 'content_manager', writeRole: 'content_manager', itemRoute: true });
  });
});
