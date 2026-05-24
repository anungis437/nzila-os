/**
 * Spatial Query Service — Unit Tests
 *
 * Tests:
 *   - isPointInGeofence returns result with inside boolean
 *   - calculateDistance returns meters
 *   - handles PostGIS error gracefully (fallback)
 *
 * NOTE: imports from `@/db` (not `@/db/db`)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    execute: mockExecute,
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { isPointInGeofence, calculateDistance } from '../spatial-query-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('spatial-query-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue([]);
  });

  it('isPointInGeofence returns result with inside boolean (PostGIS)', async () => {
    mockExecute.mockResolvedValue([{ inside: true }]);

    const result = await isPointInGeofence(
      { latitude: 45.5017, longitude: -73.5673 },
      '550e8400-e29b-41d4-a716-446655440000'
    );
    expect(result.inside).toBe(true);
    expect(result.method).toBe('postgis');
  });

  it('calculateDistance returns meters (PostGIS)', async () => {
    mockExecute.mockResolvedValue([{ distance: 1500.5 }]);

    const result = await calculateDistance(
      { latitude: 45.5017, longitude: -73.5673 },
      { latitude: 45.5088, longitude: -73.5538 }
    );
    expect(result.distance).toBe(1500.5);
    expect(result.method).toBe('postgis');
  });

  it('isPointInGeofence throws when PostGIS unavailable (honesty-pass: no silent haversine fallback)', async () => {
    mockExecute.mockRejectedValue(new Error('PostGIS not available'));

    await expect(
      isPointInGeofence(
        { latitude: 45.5017, longitude: -73.5673 },
        '550e8400-e29b-41d4-a716-446655440000'
      )
    ).rejects.toThrow(/PostGIS is required/i);
  });

  it('calculateDistance falls back to haversine on PostGIS error', async () => {
    mockExecute.mockRejectedValue(new Error('PostGIS not available'));

    const result = await calculateDistance(
      { latitude: 45.5017, longitude: -73.5673 },
      { latitude: 45.5088, longitude: -73.5538 }
    );
    expect(result.method).toBe('haversine');
    expect(typeof result.distance).toBe('number');
    expect(result.distance).toBeGreaterThan(0);
  });
});
