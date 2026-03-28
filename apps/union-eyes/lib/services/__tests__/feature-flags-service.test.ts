/**
 * Feature Flags Service — Unit Tests
 *
 * Tests:
 *   - returns cached value
 *   - evaluates flag from DB
 *   - returns false for missing flag
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindFirst, mockCacheGet, mockCacheSet } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    query: {
      featureFlags: { findFirst: mockFindFirst },
    },
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

import { isFeatureEnabled } from '../feature-flags-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('feature-flags-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(undefined);
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(true);
  });

  it('returns cached value when available', async () => {
    mockCacheGet.mockResolvedValue(true);

    const result = await isFeatureEnabled('ai-chatbot', { userId: 'u1' });
    expect(result).toBe(true);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('evaluates flag from DB when not cached', async () => {
    mockCacheGet.mockResolvedValue(null);
    mockFindFirst.mockResolvedValue({
      name: 'ai-chatbot',
      enabled: true,
      type: 'boolean',
      rolloutPercentage: null,
      allowedUsers: null,
      allowedOrganizations: null,
    });

    const result = await isFeatureEnabled('ai-chatbot');
    expect(result).toBe(true);
    expect(mockCacheSet).toHaveBeenCalled();
  });

  it('returns false for missing flag', async () => {
    mockCacheGet.mockResolvedValue(null);
    mockFindFirst.mockResolvedValue(undefined);

    const result = await isFeatureEnabled('nonexistent');
    expect(result).toBe(false);
  });

  it('returns true when user is in allowedUsers list', async () => {
    mockCacheGet.mockResolvedValue(null);
    mockFindFirst.mockResolvedValue({
      name: 'beta-feature',
      enabled: true,
      type: 'boolean',
      allowedUsers: ['user-123', 'user-456'],
      allowedOrganizations: null,
      rolloutPercentage: null,
    });

    const result = await isFeatureEnabled('beta-feature', { userId: 'user-123' });
    expect(result).toBe(true);
  });
});
