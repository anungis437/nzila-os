import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  crudRoutes: vi.fn(),
  pendingProfilesTable: { __table: 'pending_profiles' },
  collectionGet: vi.fn(async () => ({ ok: true, scope: 'collection-get' })),
  collectionPost: vi.fn(async () => ({ ok: true, scope: 'collection-post' })),
}));

vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: m.crudRoutes }));
vi.mock('@/db/schema', () => ({ pendingProfilesTable: m.pendingProfilesTable }));

describe('onboarding route (pendingProfilesTable)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.crudRoutes.mockReturnValue({
      GET: m.collectionGet,
      POST: m.collectionPost,
    });
  });

  it('registers CRUD with readRole=support_agent, never the ordinary per-org member role (round 52: pendingProfilesTable has no organizationId column — a pre-signup identity anchor keyed by email — so orgScoped is a no-op; any authenticated member of any org could otherwise list every pre-signup user\'s email/Whop-membership/billing data)', async () => {
    await import('../route');

    expect(m.crudRoutes).toHaveBeenCalledWith({
      table: m.pendingProfilesTable,
      pk: 'id',
      tags: ['Auth'],
      orgScoped: true,
      readRole: 'support_agent',
      writeRole: 'steward',
    });
    expect(m.crudRoutes).not.toHaveBeenCalledWith(expect.objectContaining({ readRole: 'member' }));
  });
});
