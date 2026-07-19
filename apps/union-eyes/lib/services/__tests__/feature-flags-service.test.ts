/**
 * Feature Flags Service — Unit Tests
 *
 * Tests:
 *   isFeatureEnabled:
 *     - cached value, DB boolean, missing flag (env fallback), user allowlist,
 *       org allowlist, percentage rollout (below/above), env var true/1,
 *       error fallback
 *   enableFeatureFlag / disableFeatureFlag: insert-or-update
 *   addOrganizationToFeatureFlag: success, not found, already present
 *   addUserToFeatureFlag: success, not found, already present
 *   setFeatureFlagPercentage: valid, invalid
 *   getAllFeatureFlags: success, error
 *   FEATURE_FLAGS: constants
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindFirst, mockFindMany, mockCacheGet, mockCacheSet, mockInsertChain, mockUpdateChain } = vi.hoisted(() => {
  const insertHandler: ProxyHandler<object> = {
    get: (_t, p) => {
      if (p === 'then') return undefined; // not thenable mid-chain
      return vi.fn(() => new Proxy({}, insertHandler));
    },
  };
  const updateHandler: ProxyHandler<object> = {
    get: (_t, p) => {
      if (p === 'then') return (r: (v: any) => void) => r(undefined);
      return vi.fn(() => new Proxy({}, updateHandler));
    },
  };
  return {
    mockFindFirst: vi.fn(),
    mockFindMany: vi.fn(),
    mockCacheGet: vi.fn(),
    mockCacheSet: vi.fn(),
    mockInsertChain: () => new Proxy({}, insertHandler),
    mockUpdateChain: () => new Proxy({}, updateHandler),
  };
});

vi.mock('@/db/db', () => ({
  db: {
    query: {
      featureFlags: { findFirst: mockFindFirst, findMany: mockFindMany },
    },
    insert: vi.fn(() => mockInsertChain()),
    update: vi.fn(() => mockUpdateChain()),
  },
}));

vi.mock('@/db/schema', () => ({
  featureFlags: { name: 'name' },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/services/cache-service', () => ({
  cacheGet: mockCacheGet,
  cacheSet: mockCacheSet,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  isFeatureEnabled,
  enableFeatureFlag,
  disableFeatureFlag,
  addOrganizationToFeatureFlag,
  addUserToFeatureFlag,
  setFeatureFlagPercentage,
  getAllFeatureFlags,
  FEATURE_FLAGS,
} from '../feature-flags-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('isFeatureEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(undefined);
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(true);
  });

  afterEach(() => {
    delete process.env.FEATURE_AI_CHATBOT;
    delete process.env.FEATURE_SOME_FLAG;
  });

  it('returns cached value without querying DB', async () => {
    mockCacheGet.mockResolvedValue(true);
    const result = await isFeatureEnabled('ai-chatbot', { userId: 'u1' });
    expect(result).toBe(true);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('evaluates boolean flag from DB when enabled', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'ai-chatbot', enabled: true, type: 'boolean',
      rolloutPercentage: null, allowedUsers: null, allowedOrganizations: null,
      percentage: null,
    });
    const result = await isFeatureEnabled('ai-chatbot');
    expect(result).toBe(true);
    expect(mockCacheSet).toHaveBeenCalled();
  });

  it('returns false for missing flag with no env var', async () => {
    const result = await isFeatureEnabled('nonexistent');
    expect(result).toBe(false);
  });

  it('returns true when user is in allowedUsers', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'beta', enabled: false, type: 'boolean',
      allowedUsers: ['user-123'], allowedOrganizations: null,
      percentage: null,
    });
    const result = await isFeatureEnabled('beta', { userId: 'user-123' });
    expect(result).toBe(true);
  });

  it('returns true when org is in allowedOrganizations', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'beta', enabled: false, type: 'boolean',
      allowedUsers: null, allowedOrganizations: ['org-1'],
      percentage: null,
    });
    const result = await isFeatureEnabled('beta', { organizationId: 'org-1' });
    expect(result).toBe(true);
  });

  it('evaluates percentage rollout (below threshold → enabled)', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'gradual', enabled: true, type: 'percentage',
      allowedUsers: null, allowedOrganizations: null,
      percentage: 100, // 100% → always enabled
    });
    const result = await isFeatureEnabled('gradual', { userId: 'u1' });
    expect(result).toBe(true);
  });

  it('evaluates percentage rollout (0% → disabled)', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'gradual', enabled: true, type: 'percentage',
      allowedUsers: null, allowedOrganizations: null,
      percentage: 0, // 0% → never enabled
    });
    const result = await isFeatureEnabled('gradual', { userId: 'u1' });
    expect(result).toBe(false);
  });

  it('falls back to env var when flag disabled and not in lists', async () => {
    process.env.FEATURE_SOME_FLAG = 'true';
    mockFindFirst.mockResolvedValue({
      name: 'some-flag', enabled: false, type: 'boolean',
      allowedUsers: null, allowedOrganizations: null,
      percentage: null,
    });
    const result = await isFeatureEnabled('some-flag');
    expect(result).toBe(true);
  });

  it('falls back to env var "1"', async () => {
    process.env.FEATURE_AI_CHATBOT = '1';
    const result = await isFeatureEnabled('ai-chatbot');
    expect(result).toBe(true);
  });

  it('returns env var default on error', async () => {
    mockCacheGet.mockRejectedValue(new Error('redis down'));
    process.env.FEATURE_AI_CHATBOT = 'true';
    const result = await isFeatureEnabled('ai-chatbot');
    expect(result).toBe(true);
  });

  it('returns false on error with no env var', async () => {
    mockCacheGet.mockRejectedValue(new Error('redis down'));
    const result = await isFeatureEnabled('no-env');
    expect(result).toBe(false);
  });
});

describe('enableFeatureFlag', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('resolves without error', async () => {
    await expect(enableFeatureFlag('ai-chatbot', 'Enable AI', 'admin')).resolves.toBeUndefined();
  });
});

describe('disableFeatureFlag', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('resolves without error', async () => {
    await expect(disableFeatureFlag('ai-chatbot', 'admin')).resolves.toBeUndefined();
  });
});

describe('addOrganizationToFeatureFlag', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('adds org when flag exists and org not present', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'beta', allowedOrganizations: ['org-1'],
    });
    await expect(addOrganizationToFeatureFlag('beta', 'org-2', 'admin')).resolves.toBeUndefined();
  });

  it('throws when flag not found', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    await expect(addOrganizationToFeatureFlag('missing', 'org-1')).rejects.toThrow("not found");
  });

  it('does not duplicate when org already present', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'beta', allowedOrganizations: ['org-1'],
    });
    // Should not throw — silently skips the push
    await expect(addOrganizationToFeatureFlag('beta', 'org-1')).resolves.toBeUndefined();
  });
});

describe('addUserToFeatureFlag', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('adds user when flag exists', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'beta', allowedUsers: [],
    });
    await expect(addUserToFeatureFlag('beta', 'user-1', 'admin')).resolves.toBeUndefined();
  });

  it('throws when flag not found', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    await expect(addUserToFeatureFlag('missing', 'user-1')).rejects.toThrow("not found");
  });

  it('does not duplicate when user already present', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'beta', allowedUsers: ['user-1'],
    });
    await expect(addUserToFeatureFlag('beta', 'user-1')).resolves.toBeUndefined();
  });
});

describe('setFeatureFlagPercentage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('sets percentage for valid value', async () => {
    await expect(setFeatureFlagPercentage('gradual', 50, 'admin')).resolves.toBeUndefined();
  });

  it('rejects percentage below 0', async () => {
    await expect(setFeatureFlagPercentage('flag', -1)).rejects.toThrow('between 0 and 100');
  });

  it('rejects percentage above 100', async () => {
    await expect(setFeatureFlagPercentage('flag', 101)).rejects.toThrow('between 0 and 100');
  });
});

describe('getAllFeatureFlags', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('maps DB flags to response shape', async () => {
    mockFindMany.mockResolvedValue([
      {
        name: 'ai-chatbot', type: 'boolean', enabled: true,
        percentage: null, description: 'AI bot', allowedOrganizations: ['org-1'],
        allowedUsers: ['u-1'],
      },
    ]);
    const result = await getAllFeatureFlags();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'ai-chatbot',
      type: 'boolean',
      enabled: true,
      allowedOrgs: ['org-1'],
      allowedUsers: ['u-1'],
    });
    expect(result[0]).toHaveProperty('environmentDefault');
  });

  it('returns empty array on error', async () => {
    mockFindMany.mockRejectedValue(new Error('db down'));
    const result = await getAllFeatureFlags();
    expect(result).toEqual([]);
  });
});

describe('FEATURE_FLAGS', () => {
  it('contains expected flag keys', () => {
    expect(FEATURE_FLAGS.AI_CHATBOT).toBe('ai-chatbot');
    expect(FEATURE_FLAGS.DOCUSIGN_INTEGRATION).toBe('docusign-integration');
    expect(FEATURE_FLAGS.STRIPE_PAYMENTS).toBe('stripe-payments');
    expect(Object.keys(FEATURE_FLAGS).length).toBe(10);
  });
});
