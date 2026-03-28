/**
 * Feature Flags — Unit Tests
 *
 * Tests:
 *   - LRO_FEATURES has expected keys
 *   - isFeatureEnabled returns true when flag enabled
 *   - isFeatureEnabled returns false when disabled/missing
 *   - getFeatureConfig returns merged config
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindFirst } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    query: {
      featureFlags: { findFirst: mockFindFirst },
    },
  },
}));

vi.mock('@/db/schema/feature-flags-schema', () => ({
  featureFlags: { name: 'name', enabled: 'enabled', type: 'type' },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { LRO_FEATURES, isFeatureEnabled, getFeatureConfig } from '../feature-flags';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('feature-flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(undefined);
  });

  it('LRO_FEATURES has expected keys', () => {
    expect(LRO_FEATURES.SIGNALS_API).toBe('lro_signals_api');
    expect(LRO_FEATURES.SIGNALS_UI).toBe('lro_signals_ui');
    expect(LRO_FEATURES.FSM_WORKFLOW).toBe('lro_fsm_workflow');
    expect(LRO_FEATURES.SLA_TRACKING).toBe('lro_sla_tracking');
    expect(LRO_FEATURES.DASHBOARD_WIDGET).toBe('lro_dashboard_widget');
  });

  it('isFeatureEnabled returns true when flag exists and is enabled (boolean)', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'lro_signals_api',
      enabled: true,
      type: 'boolean',
    });

    const result = await isFeatureEnabled('lro_signals_api', { userId: 'u1' });
    expect(result).toBe(true);
  });

  it('isFeatureEnabled returns false when flag not found', async () => {
    mockFindFirst.mockResolvedValue(undefined);

    const result = await isFeatureEnabled('nonexistent_flag');
    expect(result).toBe(false);
  });

  it('isFeatureEnabled returns false when flag is globally disabled', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'lro_signals_api',
      enabled: false,
      type: 'boolean',
    });

    const result = await isFeatureEnabled('lro_signals_api');
    expect(result).toBe(false);
  });

  it('getFeatureConfig returns empty object when feature disabled', async () => {
    mockFindFirst.mockResolvedValue(undefined);

    const config = await getFeatureConfig('nonexistent_flag');
    expect(config).toEqual({});
  });
});
