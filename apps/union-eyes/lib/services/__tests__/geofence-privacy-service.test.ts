/**
 * Geofence Privacy Service — Unit Tests
 *
 * Tests:
 *   - requestLocationPermission creates consent record
 *   - trackLocation requires active consent
 *   - trackLocation rejects without consent
 *
 * NOTE: imports from `@/db` (not `@/db/db`)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindFirst, mockInsertValues } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockInsertValues: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      memberLocationConsent: { findFirst: mockFindFirst },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
  },
}));

vi.mock('@/db/schema/geofence-privacy-schema', () => ({
  memberLocationConsent: { userId: 'userId', consentStatus: 'consentStatus' },
  locationTracking: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

// ── Imports ──────────────────────────────────────────────────────────────────

import { requestLocationPermission, trackLocation } from '../geofence-privacy-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('geofence-privacy-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(null);
    mockInsertValues.mockResolvedValue(undefined);
  });

  it('requestLocationPermission returns pending when no existing consent', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await requestLocationPermission('user-1', 'strike-line-tracking');
    expect(result.requiresUserAction).toBe(true);
    expect(result.consentId).toContain('pending');
  });

  it('requestLocationPermission returns existing when already opted in', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'consent-1',
      consentStatus: 'opted_in',
    });

    const result = await requestLocationPermission('user-1', 'safety-check-ins');
    expect(result.requiresUserAction).toBe(false);
    expect(result.consentId).toBe('consent-1');
  });

  it('trackLocation requires active consent', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'consent-1',
      consentStatus: 'opted_in',
      expiresAt: new Date(Date.now() + 86400000), // tomorrow
    });
    mockInsertValues.mockResolvedValue(undefined);

    const result = await trackLocation(
      'user-1',
      { latitude: 45.50, longitude: -73.56 },
      'strike-line-tracking'
    );
    expect(result.success).toBe(true);
  });

  it('trackLocation rejects without consent', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await trackLocation(
      'user-1',
      { latitude: 45.50, longitude: -73.56 },
      'strike-line-tracking'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('explicit opt-in consent');
  });
});
