import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockUpdate: vi.fn(),
  mockSet: vi.fn(),
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
  mockLimit: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: mocks.mockSelect.mockReturnValue({
      from: mocks.mockFrom.mockReturnValue({
        where: mocks.mockWhere.mockReturnValue({
          limit: mocks.mockLimit,
        }),
      }),
    }),
    update: mocks.mockUpdate.mockReturnValue({
      set: mocks.mockSet.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    insert: mocks.mockInsert.mockReturnValue({
      values: mocks.mockValues.mockResolvedValue(undefined),
    }),
  },
}));

vi.mock('@/db/schema', () => ({
  featureFlags: { name: 'name' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  relations: vi.fn(() => ({})),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('react', () => ({
  cache: vi.fn((fn: Function) => fn),
}));

import {
  BooleanFlag,
  PercentageFlag,
  OrgFlag,
  checkFlags,
  features,
} from '../feature-flags';

describe('feature-flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('BooleanFlag', () => {
    it('returns default value when no config found', () => {
      const flag = new BooleanFlag('test-flag', true);
      // No config is loaded so it falls back to default
      expect(flag.enabled).toBe(true);
    });

    it('returns false by default', () => {
      const flag = new BooleanFlag('unset-flag');
      expect(flag.enabled).toBe(false);
    });
  });

  describe('PercentageFlag', () => {
    it('returns false when config not loaded', () => {
      const flag = new PercentageFlag('pct-flag', 50);
      // No config loaded → not enabled
      expect(flag.isEnabled('user-123')).toBe(false);
    });
  });

  describe('OrgFlag', () => {
    it('returns false when config not loaded', () => {
      const flag = new OrgFlag('org-flag');
      expect(flag.isEnabledForOrg('org-1')).toBe(false);
    });
  });

  describe('checkFlags', () => {
    it('returns false for unknown flags', () => {
      const result = checkFlags(['unknown-flag']);
      expect(result['unknown-flag']).toBe(false);
    });
  });

  describe('features registry', () => {
    it('contains expected feature flags', () => {
      expect(features).toHaveProperty('newClaimFlow');
      expect(features).toHaveProperty('mlPredictions');
      expect(features).toHaveProperty('smsNotifications');
      expect(features).toHaveProperty('onlineVoting');
    });
  });
});
