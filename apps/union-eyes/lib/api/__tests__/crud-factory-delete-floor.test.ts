import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';

// The historical testimonial defect: writes to shared content were gated at an elevated role, but the factory's DELETE
// handler hard-coded an administrator floor, so an organization administrator could still delete any row by id. Unit tests
// of the routes mocked the factory away and could not see it; this one inspects the floors the factory really declares.
const captured = vi.hoisted(() => ({ configs: [] as Array<{ auth: { minRole: string }; openapi: { summary: string } }> }));

vi.mock('../with-api', () => ({
  withApi: (config: { auth: { minRole: string }; openapi: { summary: string } }) => {
    captured.configs.push(config);
    return vi.fn();
  },
}));
vi.mock('@/db/db', () => ({ db: {} }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: vi.fn() }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn() }));

const shared = pgTable('shared_things', { id: uuid('id').primaryKey(), title: text('title') });

async function floors(writeRole?: string) {
  captured.configs.length = 0;
  const { crudRoutes } = await import('../crud-factory');
  crudRoutes({ table: shared, pk: 'id', orgScoped: false, itemRoute: true, readRole: 'member', ...(writeRole ? { writeRole: writeRole as never } : {}) });
  const byVerb = (verb: string) => captured.configs.find((c) => c.openapi.summary.startsWith(verb))?.auth.minRole;
  return { patch: byVerb('Update'), delete: byVerb('Delete') };
}

describe('crud-factory item route floors', () => {
  beforeEach(() => vi.resetModules());

  it('deleting is never allowed to a lower role than writing: an elevated write role also gates DELETE', async () => {
    for (const role of ['content_manager', 'compliance_manager', 'security_manager', 'system_admin']) {
      const result = await floors(role);
      expect(result.patch, `${role} patch`).toBe(role);
      expect(result.delete, `${role} delete`).toBe(role);
    }
  });

  it('keeps the administrator floor when the write role is lower than administrator', async () => {
    for (const role of ['steward', 'officer', 'member', 'admin']) {
      expect((await floors(role)).delete, role).toBe('admin');
    }
    expect((await floors()).delete, 'default write role').toBe('admin');
  });
});
