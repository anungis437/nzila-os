import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockWithCache: vi.fn(),
  mockInvalidate: vi.fn(),
  mockGetStats: vi.fn(),
  mockClear: vi.fn(),
  mockComputeOrgMetrics: vi.fn(),
}));

vi.mock('../analytics-cache', () => ({
  withCache: mocks.mockWithCache,
  analyticsCache: {
    invalidate: mocks.mockInvalidate,
    getStats: mocks.mockGetStats,
    clear: mocks.mockClear,
  },
}));

vi.mock('../analytics-aggregation', () => ({
  aggregationService: {
    computeOrganizationMetrics: mocks.mockComputeOrgMetrics,
  },
}));

import {
  handleDataChange,
  getAnalyticsDashboard,
  getAnalyticsCacheStats,
  clearAnalyticsCache,
} from '../analytics-middleware';

describe('analytics-middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleDataChange', () => {
    it('invalidates claims/financial/operational on claim_created', async () => {
      await handleDataChange('org-1', 'claim_created');
      expect(mocks.mockInvalidate).toHaveBeenCalledTimes(3);
      expect(mocks.mockInvalidate).toHaveBeenCalledWith('org-1', 'claims');
      expect(mocks.mockInvalidate).toHaveBeenCalledWith('org-1', 'financial');
      expect(mocks.mockInvalidate).toHaveBeenCalledWith('org-1', 'operational');
    });

    it('invalidates members on member_updated', async () => {
      await handleDataChange('org-1', 'member_updated');
      expect(mocks.mockInvalidate).toHaveBeenCalledWith('org-1', 'members');
    });
  });

  describe('getAnalyticsDashboard', () => {
    it('calls withCache with dashboard endpoint', async () => {
      mocks.mockWithCache.mockResolvedValue({ claims: 10 });

      const result = await getAnalyticsDashboard('org-1');
      expect(result).toEqual({ claims: 10 });
      expect(mocks.mockWithCache).toHaveBeenCalledWith(
        'org-1',
        'dashboard',
        {},
        expect.any(Function),
        expect.any(Number)
      );
    });
  });

  describe('getAnalyticsCacheStats', () => {
    it('delegates to analyticsCache.getStats', () => {
      mocks.mockGetStats.mockReturnValue({ hits: 5, misses: 2 });
      const stats = getAnalyticsCacheStats();
      expect(stats).toEqual({ hits: 5, misses: 2 });
    });
  });

  describe('clearAnalyticsCache', () => {
    it('invalidates specific org when provided', () => {
      clearAnalyticsCache('org-1');
      expect(mocks.mockInvalidate).toHaveBeenCalledWith('org-1');
    });

    it('clears all when no org provided', () => {
      clearAnalyticsCache();
      expect(mocks.mockClear).toHaveBeenCalled();
    });
  });
});
