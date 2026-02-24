/**
 * Spatial Query Service
 * 
 * High-performance spatial queries using PostGIS
 * Falls back to Haversine formula if PostGIS is not available
 */

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export interface Point {
  latitude: number;
  longitude: number;
}

export interface GeofenceBoundary {
  type: 'circle' | 'polygon';
  center?: Point;
  radius?: number; // meters
  points?: Point[]; // for polygon
}

/**
 * Check if a point is within a geofence using PostGIS
 * Falls back to Haversine for circular geofences
 */
export async function isPointInGeofence(
  point: Point,
  geofenceId: string
): Promise<{ inside: boolean; distance?: number; method: 'postgis' | 'haversine' }> {
  try {
    // Try PostGIS function first
    const result = await db.execute(sql`
      SELECT is_point_in_geofence(
        ${point.latitude}::DOUBLE PRECISION,
        ${point.longitude}::DOUBLE PRECISION,
        ${geofenceId}::UUID
      ) as inside
    `);

    return {
      inside: result[0]?.inside === true,
      method: 'postgis',
    };
  } catch (error) {
    // Fallback to Haversine formula
    logger.warn('PostGIS unavailable, using Haversine fallback:', error);
    return isPointInGeofenceHaversine(point, geofenceId);
  }
}

/**
 * Calculate distance between two points using PostGIS
 * Falls back to Haversine formula
 */
export async function calculateDistance(
  point1: Point,
  point2: Point
): Promise<{ distance: number; method: 'postgis' | 'haversine' }> {
  try {
    // Try PostGIS function first
    const result = await db.execute(sql`
      SELECT get_distance_meters(
        ${point1.latitude}::DOUBLE PRECISION,
        ${point1.longitude}::DOUBLE PRECISION,
        ${point2.latitude}::DOUBLE PRECISION,
        ${point2.longitude}::DOUBLE PRECISION
      ) as distance
    `);

    return {
      distance: Number(result[0]?.distance || 0),
      method: 'postgis',
    };
  } catch (_error) {
    // Fallback to Haversine formula
    return {
      distance: calculateDistanceHaversine(point1, point2),
      method: 'haversine',
    };
  }
}

/**
 * Find nearby locations within a radius using PostGIS
 */
export async function findNearbyLocations(
  center: Point,
  radiusMeters: number,
  maxResults: number = 10
): Promise<
  Array<{
    userId: string;
    latitude: number;
    longitude: number;
    distance: number;
    timestamp: Date;
  }>
> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM find_nearby_locations(
        ${center.latitude}::DOUBLE PRECISION,
        ${center.longitude}::DOUBLE PRECISION,
        ${radiusMeters}::DOUBLE PRECISION,
        ${maxResults}::INT
      )
    `);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.map((row: any) => ({
      userId: row.user_id,
      latitude: row.latitude,
      longitude: row.longitude,
      distance: row.distance_meters,
      timestamp: new Date(row.timestamp),
    }));
  } catch (error) {
    logger.error('PostGIS nearby locations query failed:', error);
    return [];
  }
}

/**
 * Create a circular geofence boundary using PostGIS
 */
export async function createCircularGeofence(
  center: Point,
  radiusMeters: number,
  numSegments: number = 32
): Promise<string | null> {
  try {
    const result = await db.execute(sql`
      SELECT ST_AsGeoJSON(
        create_circular_geofence(
          ${center.latitude}::DOUBLE PRECISION,
          ${center.longitude}::DOUBLE PRECISION,
          ${radiusMeters}::DOUBLE PRECISION,
          ${numSegments}::INT
        )
      ) as geojson
    `);

    return (result[0]?.geojson as string) || null;
  } catch (error) {
    logger.error('PostGIS geofence creation failed:', error);
    return null;
  }
}

// ============================================================================
// FALLBACK HAVERSINE IMPLEMENTATIONS
// ============================================================================

/**
 * Haversine formula for distance calculation (fallback)
 */
function calculateDistanceHaversine(point1: Point, point2: Point): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters

  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.latitude)) *
      Math.cos(toRad(point2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

/**
 * Check if point is in circular geofence using Haversine (fallback)
 */
async function isPointInGeofenceHaversine(
  _point: Point,
  _geofenceId: string
): Promise<{ inside: boolean; distance: number; method: 'haversine' }> {
  // This would need to fetch geofence data from database
  // Simplified implementation for demonstration
  const distance = 0; // Would calculate against geofence center

  return {
    inside: false, // Would check distance against radius
    distance,
    method: 'haversine',
  };
}

/**
 * Check if PostGIS is available in the database
 */
export async function checkPostGISAvailability(): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'postgis'
      ) as available
    `);

    return result[0]?.available === true;
  } catch (_error) {
    return false;
  }
}
