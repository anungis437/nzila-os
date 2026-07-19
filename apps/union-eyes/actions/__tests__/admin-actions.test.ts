import { beforeEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const queue: unknown[] = [];
  const chain: Record<string, unknown> = {};
  const methods = [
    'select', 'from', 'where', 'innerJoin', 'leftJoin', 'orderBy', 'limit',
    'update', 'set', 'delete', 'insert', 'values', 'returning', 'groupBy',
  ];
  for (const m of methods) chain[m] = (..._a: unknown[]) => chain;
  chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
    const r = queue.length ? queue.shift() : [];
    if (r instanceof Error) return Promise.reject(r).then(resolve, reject);
    return Promise.resolve(r).then(resolve, reject);
  };
  return {
    queue,
    chain,
    requireAdmin: vi.fn(),
    loggerInfo: vi.fn(),
    loggerError: vi.fn(),
    revalidatePath: vi.fn(),
  };
});

function setResults(...results: unknown[]) {
  mocks.queue.length = 0;
  mocks.queue.push(...results);
}

vi.mock('@/db/db', () => ({ db: mocks.chain }));
vi.mock('@/db/schema/domains/member', () => ({ organizationUsers: {} }));
vi.mock('@/db/schema', () => ({ organizations: {}, orgConfigurations: {}, orgUsage: {} }));
vi.mock('drizzle-orm/node-postgres', () => ({}));
vi.mock('drizzle-orm', () => ({
  eq: () => ({}),
  and: () => ({}),
  or: () => ({}),
  ne: () => ({}),
  like: () => ({}),
  desc: () => ({}),
  count: () => ({}),
  sum: () => ({}),
  sql: (..._a: unknown[]) => ({}),
}));
vi.mock('@/lib/auth/rbac-server', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/lib/logger', () => ({ logger: { info: mocks.loggerInfo, error: mocks.loggerError } }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import {
  getSystemStats,
  getAdminUsers,
  getAdminOrgs,
  updateUserRole,
  toggleUserStatus,
  deleteUserFromOrg,
  updateOrg,
  createOrg,
  getSystemConfigs,
  updateSystemConfig,
  getRecentActivity,
} from '../admin-actions';

const tx = mocks.chain as never;

describe('admin-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queue.length = 0;
    mocks.requireAdmin.mockResolvedValue(undefined);
  });

  describe('getSystemStats', () => {
    it('aggregates system-wide statistics', async () => {
      setResults([{ count: 5 }], [{ count: 3 }], [{ count: 2 }], [{ total: 1000 }], [{ count: 1 }]);
      const stats = await getSystemStats(tx);
      expect(stats).toEqual({
        totalMembers: 5,
        totalOrgs: 3,
        activeOrgs: 2,
        totalStorage: 1000,
        activeToday: 1,
      });
    });

    it('falls back to zero when rows are empty', async () => {
      setResults([], [], [], [], []);
      const stats = await getSystemStats(tx);
      expect(stats).toEqual({
        totalMembers: 0,
        totalOrgs: 0,
        activeOrgs: 0,
        totalStorage: 0,
        activeToday: 0,
      });
    });

    it('throws on query failure', async () => {
      setResults(new Error('db boom'));
      await expect(getSystemStats(tx)).rejects.toThrow('Failed to fetch system statistics');
      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });

  describe('getAdminUsers', () => {
    it('returns mapped users applying all filters', async () => {
      setResults([
        {
          userId: 'clerk_abc',
          role: 'admin',
          organizationId: 'o1',
          orgName: 'Org One',
          isActive: true,
          lastAccessAt: new Date('2024-01-01T00:00:00Z'),
          joinedAt: new Date('2023-01-01T00:00:00Z'),
        },
      ]);
      const users = await getAdminUsers(tx, 'search', 'o1', 'admin');
      expect(users).toHaveLength(1);
      expect(users[0]).toMatchObject({ id: 'clerk_abc', status: 'active', orgName: 'Org One' });
    });

    it('handles inactive users with null timestamps', async () => {
      setResults([
        {
          userId: 'x',
          role: 'member',
          organizationId: 'o1',
          orgName: 'Org',
          isActive: false,
          lastAccessAt: null,
          joinedAt: null,
        },
      ]);
      const users = await getAdminUsers(tx);
      expect(users[0]).toMatchObject({ status: 'inactive', lastLogin: null, joinedAt: null });
    });

    it('throws on failure', async () => {
      setResults(new Error('fail'));
      await expect(getAdminUsers(tx)).rejects.toThrow('Failed to fetch users');
    });
  });

  describe('getAdminOrgs', () => {
    it('returns orgs with computed statistics (with search)', async () => {
      setResults([
        {
          orgId: 'o1',
          orgSlug: 'slug',
          orgName: 'Org',
          status: 'active',
          subscriptionTier: 'pro',
          contactEmail: 'a@x.com',
          phone: '123',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ]);
      const orgs = await getAdminOrgs('search');
      expect(orgs).toHaveLength(1);
      expect(orgs[0]).toMatchObject({ id: 'o1', totalUsers: 0, activeUsers: 0, storageUsed: '0' });
    });

    it('applies defaults for nullable org fields (no search)', async () => {
      setResults([
        {
          orgId: 'o2',
          orgSlug: 's2',
          orgName: 'Org2',
          status: null,
          subscriptionTier: null,
          contactEmail: null,
          phone: null,
          createdAt: null,
        },
      ]);
      const orgs = await getAdminOrgs();
      expect(orgs[0]).toMatchObject({ status: 'active', subscriptionTier: 'free', createdAt: '' });
    });

    it('throws when not authorized', async () => {
      mocks.requireAdmin.mockRejectedValue(new Error('forbidden'));
      await expect(getAdminOrgs()).rejects.toThrow('Failed to fetch organizations');
    });
  });

  describe('updateUserRole', () => {
    it('updates the role and revalidates', async () => {
      await updateUserRole(tx, 'u1', 'o1', 'admin');
      expect(mocks.loggerInfo).toHaveBeenCalled();
      expect(mocks.revalidatePath).toHaveBeenCalled();
    });

    it('throws on failure', async () => {
      setResults(new Error('boom'));
      await expect(updateUserRole(tx, 'u1', 'o1', 'admin')).rejects.toThrow('Failed to update user role');
    });
  });

  describe('toggleUserStatus', () => {
    it('toggles an existing user status', async () => {
      setResults([{ isActive: true }]);
      await toggleUserStatus(tx, 'u1', 'o1');
      expect(mocks.loggerInfo).toHaveBeenCalled();
    });

    it('throws when the user is not found', async () => {
      setResults([]);
      await expect(toggleUserStatus(tx, 'u1', 'o1')).rejects.toThrow('Failed to update user status');
    });
  });

  describe('deleteUserFromOrg', () => {
    it('removes the user', async () => {
      await deleteUserFromOrg(tx, 'u1', 'o1');
      expect(mocks.revalidatePath).toHaveBeenCalled();
    });

    it('throws on failure', async () => {
      setResults(new Error('boom'));
      await expect(deleteUserFromOrg(tx, 'u1', 'o1')).rejects.toThrow('Failed to remove user');
    });
  });

  describe('updateOrg', () => {
    it('updates org information', async () => {
      await updateOrg('o1', { name: 'New Name' });
      expect(mocks.loggerInfo).toHaveBeenCalled();
    });

    it('throws when not authorized', async () => {
      mocks.requireAdmin.mockRejectedValue(new Error('forbidden'));
      await expect(updateOrg('o1', {})).rejects.toThrow('Failed to update organization');
    });
  });

  describe('createOrg', () => {
    it('creates an org and returns its id', async () => {
      setResults([{ id: 'new-org' }]);
      const id = await createOrg({ slug: 's', name: 'n', email: 'e@x.com', subscriptionTier: 'pro' });
      expect(id).toBe('new-org');
    });

    it('applies the default subscription tier', async () => {
      setResults([{ id: 'new-org-2' }]);
      const id = await createOrg({ slug: 's', name: 'n', email: 'e@x.com' });
      expect(id).toBe('new-org-2');
    });

    it('throws on failure', async () => {
      mocks.requireAdmin.mockRejectedValue(new Error('forbidden'));
      await expect(createOrg({ slug: 's', name: 'n', email: 'e@x.com' })).rejects.toThrow('Failed to create organization');
    });
  });

  describe('getSystemConfigs', () => {
    it('returns configs filtered by category', async () => {
      setResults([{ category: 'general', key: 'k', value: 'v', description: 'd' }]);
      const configs = await getSystemConfigs(tx, 'general');
      expect(configs).toHaveLength(1);
      expect(configs[0]).toMatchObject({ category: 'general', key: 'k' });
    });

    it('returns all configs when no category given', async () => {
      setResults([]);
      const configs = await getSystemConfigs(tx);
      expect(configs).toEqual([]);
    });

    it('throws on failure', async () => {
      setResults(new Error('boom'));
      await expect(getSystemConfigs(tx)).rejects.toThrow('Failed to fetch system configurations');
    });
  });

  describe('updateSystemConfig', () => {
    it('updates an existing config', async () => {
      setResults([{ id: 'c1' }]);
      await updateSystemConfig(tx, 'o1', 'general', 'k', 'v' as never);
      expect(mocks.loggerInfo).toHaveBeenCalled();
    });

    it('inserts a new config when none exists', async () => {
      setResults([]);
      await updateSystemConfig(tx, 'o1', 'general', 'k', 'v' as never);
      expect(mocks.loggerInfo).toHaveBeenCalled();
    });

    it('throws on failure', async () => {
      setResults(new Error('boom'));
      await expect(updateSystemConfig(tx, 'o1', 'c', 'k', 'v' as never)).rejects.toThrow('Failed to update system configuration');
    });
  });

  describe('getRecentActivity', () => {
    it('returns recent user joins', async () => {
      setResults([
        { userId: 'u1', orgName: 'Org', role: 'admin', joinedAt: new Date('2024-01-01T00:00:00Z') },
      ]);
      const activity = await getRecentActivity(tx, 5);
      expect(activity).toHaveLength(1);
      expect(activity[0]).toMatchObject({ action: 'User joined', user: 'u1', org: 'Org' });
    });

    it('returns an empty array on failure', async () => {
      setResults(new Error('boom'));
      const activity = await getRecentActivity(tx);
      expect(activity).toEqual([]);
      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });
});
