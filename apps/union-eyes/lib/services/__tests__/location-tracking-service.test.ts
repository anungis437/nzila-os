/**
 * Location Tracking Service — Unit Tests
 *
 * Tests:
 *   - creates consent with valid request
 *   - returns error when consent already exists
 *   - request includes correct purpose type
 *
 * NOTE: imports from `@/db` (not `@/db/db`)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindFirst, mockInsertValues, mockReturning } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockInsertValues: vi.fn(() => ({ returning: mockReturning })),
  mockReturning: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      memberLocationConsent: { findFirst: mockFindFirst },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}));

vi.mock('@/db/schema', () => ({
  memberLocationConsent: { userId: 'userId', consentStatus: 'consentStatus' },
  locationTracking: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { LocationTrackingService } from '../location-tracking-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('LocationTrackingService', () => {
  let service: LocationTrackingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LocationTrackingService();
    mockFindFirst.mockResolvedValue(undefined);
    mockReturning.mockResolvedValue([{ id: 'consent-new', consentStatus: 'never_asked' }]);
  });

  it('creates consent with valid request', async () => {
    mockFindFirst.mockResolvedValue(undefined); // no existing consent

    const result = await service.requestLocationPermission({
      memberId: 'member-1',
      purpose: 'strike_line_tracking',
      purposeDescription: 'Track strike line participation',
      requestedAt: new Date(),
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('opt-in');
    expect(result.consentId).toBe('consent-new');
  });

  it('returns error when consent already exists', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'consent-existing',
      consentStatus: 'opted_in',
    });

    const result = await service.requestLocationPermission({
      memberId: 'member-1',
      purpose: 'safety_checkin',
      purposeDescription: 'Safety check-in',
      requestedAt: new Date(),
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('already has consent status');
  });

  it('consent request includes correct purpose type', async () => {
    mockFindFirst.mockResolvedValue(undefined);

    await service.requestLocationPermission({
      memberId: 'member-2',
      purpose: 'event_attendance',
      purposeDescription: 'Event attendance verification',
      requestedAt: new Date(),
    });

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        consentPurpose: 'event_attendance',
        purposeDescription: 'Event attendance verification',
      })
    );
  });
});
