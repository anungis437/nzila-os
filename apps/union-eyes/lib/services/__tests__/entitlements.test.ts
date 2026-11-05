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

const { mockFindFirst, mockWithRLSContext } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockWithRLSContext: vi.fn(),
}));

// The organization's own row is read in that organization's context: the wrapper hands its callback the transaction.
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: mockWithRLSContext,
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
  checkEntitlements,
  getOrganizationCredits,
  TIER_FEATURES,
  TIER_CREDITS,
  CREDIT_COSTS,
} from '../entitlements';

beforeEach(() => {
  mockWithRLSContext.mockImplementation(async (_context: unknown, work: (tx: unknown) => Promise<unknown>) =>
    work({ query: { organizations: { findFirst: mockFindFirst } } }),
  );
});

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

describe('checkEntitlements (batch)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns allAllowed=true when all features pass', async () => {
    mockFindFirst.mockResolvedValue({ subscriptionTier: 'professional', featuresEnabled: null });
    const result = await checkEntitlements('org-1', ['ai_search', 'ai_summarize']);
    expect(result.allAllowed).toBe(true);
    expect(result.results).toHaveLength(2);
  });

  it('returns allAllowed=false when any feature is denied', async () => {
    mockFindFirst.mockResolvedValue({ subscriptionTier: 'free', featuresEnabled: null });
    const result = await checkEntitlements('org-1', ['ai_search', 'ai_mamba']);
    expect(result.allAllowed).toBe(false);
  });
});

describe('getOrganizationCredits', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('reads the balance from the organization\'s settings, in that organization\'s own context', async () => {
    mockFindFirst.mockResolvedValue({ subscriptionTier: 'basic', settings: { credits: 50 } });
    const balance = await getOrganizationCredits('org-1');
    expect(balance).toMatchObject({ organizationId: 'org-1', tier: 'basic', credits: 50 });
    expect(mockWithRLSContext).toHaveBeenCalledWith({ organizationId: 'org-1' }, expect.any(Function));
  });

  it('gives an organization with no recorded balance its tier default', async () => {
    mockFindFirst.mockResolvedValue({ subscriptionTier: 'professional', settings: {} });
    expect((await getOrganizationCredits('org-1')).credits).toBe(TIER_CREDITS.professional);
  });

  it('reports unlimited (0) for the enterprise tier', async () => {
    mockFindFirst.mockResolvedValue({ subscriptionTier: 'enterprise', settings: { credits: 7 } });
    expect(await getOrganizationCredits('org-1')).toMatchObject({ tier: 'enterprise', credits: 0 });
  });

  it('fails when the organization cannot be read, rather than inventing a free-tier balance', async () => {
    mockFindFirst.mockRejectedValue(new Error('database unavailable'));
    await expect(getOrganizationCredits('org-1')).rejects.toThrow('database unavailable');
  });
});

describe('the credit check inside checkEntitlement', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('allows a credit-requiring feature while the balance is positive and reports it', async () => {
    mockFindFirst.mockResolvedValue({ subscriptionTier: 'professional', settings: { credits: 12 } });
    expect(await checkEntitlement('org-1', 'ai_summarize')).toMatchObject({ allowed: true, currentCredits: 12 });
  });

  it('denies it, with a way to buy more, when the balance is spent', async () => {
    mockFindFirst.mockResolvedValue({ subscriptionTier: 'professional', settings: { credits: 0 } });
    expect(await checkEntitlement('org-1', 'ai_summarize')).toMatchObject({ allowed: false, currentCredits: 0, upgradeUrl: '/pricing?tab=credits' });
  });

  it('denies, and says so, when the organization cannot be read: a failed check is never an allowance', async () => {
    mockFindFirst.mockRejectedValue(new Error('database unavailable'));
    expect(await checkEntitlement('org-1', 'ai_summarize')).toMatchObject({ allowed: false, reason: expect.stringContaining('Error checking entitlements') });
  });
});
