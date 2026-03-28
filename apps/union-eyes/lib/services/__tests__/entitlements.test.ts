/**
 * Entitlements Service — Unit Tests
 *
 * Tests:
 *   - isPaidTier: pure function
 *   - getCreditCost: pure function
 *   - getFeaturesForTier: pure function
 *   - featureRequiresCredits: pure function
 *   - checkEntitlement: org tier check
 *   - TIER_FEATURES / CREDIT_COSTS: constants
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindFirst } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    query: {
      organizations: { findFirst: mockFindFirst },
    },
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn() })) })) })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => []),
      })),
    })),
  },
}));

vi.mock('@/db/schema-organizations', () => ({
  organizations: { id: 'id', subscriptionTier: 'subscriptionTier', settings: 'settings', featuresEnabled: 'featuresEnabled' },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  isPaidTier,
  getCreditCost,
  getFeaturesForTier,
  featureRequiresCredits,
  checkEntitlement,
  TIER_FEATURES,
  CREDIT_COSTS,
} from '../entitlements';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('isPaidTier (pure)', () => {
  it('returns false for free tier', () => {
    expect(isPaidTier('free')).toBe(false);
  });

  it('returns true for basic, professional, enterprise', () => {
    expect(isPaidTier('basic')).toBe(true);
    expect(isPaidTier('professional')).toBe(true);
    expect(isPaidTier('enterprise')).toBe(true);
  });
});

describe('getCreditCost (pure)', () => {
  it('returns cost for ai_summarize', () => {
    expect(getCreditCost('ai_summarize')).toBe(2);
  });

  it('returns 0 for free features', () => {
    expect(getCreditCost('api_access')).toBe(0);
  });
});

describe('getFeaturesForTier (pure)', () => {
  it('returns limited features for free tier', () => {
    const features = getFeaturesForTier('free');
    expect(features).toContain('ai_search');
    expect(features.length).toBeLessThan(getFeaturesForTier('enterprise').length);
  });

  it('enterprise has all features', () => {
    expect(getFeaturesForTier('enterprise').length).toBeGreaterThan(10);
  });
});

describe('featureRequiresCredits (pure)', () => {
  it('returns true for ai_summarize', () => {
    expect(featureRequiresCredits('ai_summarize')).toBe(true);
  });

  it('returns false for api_access', () => {
    expect(featureRequiresCredits('api_access')).toBe(false);
  });
});

describe('checkEntitlement', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('denies access for unknown organization', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const result = await checkEntitlement('unknown-org', 'ai_search');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not found');
  });

  it('allows access for feature in org tier', async () => {
    mockFindFirst.mockResolvedValue({ subscriptionTier: 'professional', featuresEnabled: null });
    const result = await checkEntitlement('org-1', 'ai_search');
    expect(result.allowed).toBe(true);
  });

  it('denies access for feature above org tier', async () => {
    mockFindFirst.mockResolvedValue({ subscriptionTier: 'free', featuresEnabled: null });
    const result = await checkEntitlement('org-1', 'ai_mamba');
    expect(result.allowed).toBe(false);
  });
});

describe('TIER_FEATURES constant', () => {
  it('has all four tiers', () => {
    expect(Object.keys(TIER_FEATURES)).toEqual(['free', 'basic', 'professional', 'enterprise']);
  });
});

describe('CREDIT_COSTS constant', () => {
  it('ai_mamba is the most expensive AI feature', () => {
    expect(CREDIT_COSTS.ai_mamba).toBe(5);
  });
});
