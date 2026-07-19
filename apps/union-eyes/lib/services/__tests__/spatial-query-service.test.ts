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

import {
  isPointInGeofence,
  calculateDistance,
  findNearbyLocations,
  createCircularGeofence,
  checkPostGISAvailability,
} from '../spatial-query-service';

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

  it('findNearbyLocations maps DB rows to API shape', async () => {
    mockExecute.mockResolvedValue([
      {
        user_id: 'user-1',
        latitude: 45.5,
        longitude: -73.5,
        distance_meters: 123.4,
        timestamp: '2026-01-01T00:00:00Z',
      },
    ]);

    const result = await findNearbyLocations(
      { latitude: 45.5017, longitude: -73.5673 },
      500,
      5
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      userId: 'user-1',
      latitude: 45.5,
      longitude: -73.5,
      distance: 123.4,
    });
    expect(result[0]?.timestamp).toBeInstanceOf(Date);
  });

  it('findNearbyLocations returns empty array on query error', async () => {
    mockExecute.mockRejectedValue(new Error('query failed'));

    await expect(
      findNearbyLocations({ latitude: 45.5017, longitude: -73.5673 }, 500)
    ).resolves.toEqual([]);
  });

  it('createCircularGeofence returns geojson string when query succeeds', async () => {
    mockExecute.mockResolvedValue([{ geojson: '{"type":"Polygon"}' }]);

    await expect(
      createCircularGeofence({ latitude: 45.5017, longitude: -73.5673 }, 100)
    ).resolves.toBe('{"type":"Polygon"}');
  });

  it('createCircularGeofence returns null on query failure', async () => {
    mockExecute.mockRejectedValue(new Error('no postgis'));

    await expect(
      createCircularGeofence({ latitude: 45.5017, longitude: -73.5673 }, 100)
    ).resolves.toBeNull();
  });

  it('checkPostGISAvailability returns true when extension is installed', async () => {
    mockExecute.mockResolvedValue([{ available: true }]);
    await expect(checkPostGISAvailability()).resolves.toBe(true);
  });

  it('checkPostGISAvailability returns false on query error', async () => {
    mockExecute.mockRejectedValue(new Error('cannot query extensions'));
    await expect(checkPostGISAvailability()).resolves.toBe(false);
  });
});
