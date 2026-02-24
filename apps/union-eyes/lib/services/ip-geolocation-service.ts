/**
 * IP Geolocation Service
 * 
 * Production-ready IP geolocation using geoip-lite (offline, fast)
 * with fallback to online services for enhanced accuracy
 */

import geoip from 'geoip-lite';
import { logger } from '@/lib/logger';

export interface IPGeolocationResult {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  accuracy: 'high' | 'medium' | 'low';
  source: 'geoip-lite' | 'ipapi' | 'fallback';
}

/**
 * Get geolocation data from IP address using local geoip-lite database
 * Fast, offline, and privacy-friendly (no external API calls)
 */
export function getIPGeolocation(ipAddress: string): IPGeolocationResult | null {
  if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === 'localhost') {
    return null;
  }

  // Use geoip-lite for fast, local lookup
  const geo = geoip.lookup(ipAddress);
  
  if (!geo) {
    return {
      ip: ipAddress,
      accuracy: 'low',
      source: 'fallback',
    };
  }

  return {
    ip: ipAddress,
    city: undefined, // geoip-lite doesn&apos;t provide city-level data
    region: geo.region,
    country: geo.country,
    countryCode: geo.country,
    latitude: geo.ll[0],
    longitude: geo.ll[1],
    timezone: geo.timezone,
    accuracy: 'medium', // Country/region level accuracy
    source: 'geoip-lite',
  };
}

/**
 * Get enhanced geolocation with city-level accuracy (uses external API)
 * Use sparingly due to rate limits and external dependency
 */
export async function getEnhancedIPGeolocation(
  ipAddress: string
): Promise<IPGeolocationResult | null> {
  if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === 'localhost') {
    return null;
  }

  try {
    // Try local lookup first
    const localResult = getIPGeolocation(ipAddress);
    
    // For production, use ipapi.co free tier (1,000 requests/day)
    // or integrate MaxMind GeoIP2 API with paid plan
    const response = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
      headers: { 'User-Agent': 'UnionEyes/1.0' },
    });

    if (!response.ok) {
      // Fallback to local result
      return localResult;
    }

    const data = await response.json();

    return {
      ip: ipAddress,
      city: data.city,
      region: data.region,
      country: data.country_name,
      countryCode: data.country_code,
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezone,
      accuracy: 'high', // City-level accuracy
      source: 'ipapi',
    };
  } catch (error) {
    logger.error('Enhanced IP geolocation error:', error);
    // Fallback to local lookup
    return getIPGeolocation(ipAddress);
  }
}

/**
 * Batch IP geolocation lookup (local only for performance)
 */
export function batchIPGeolocation(
  ipAddresses: string[]
): Map<string, IPGeolocationResult | null> {
  const results = new Map<string, IPGeolocationResult | null>();

  for (const ip of ipAddresses) {
    results.set(ip, getIPGeolocation(ip));
  }

  return results;
}

/**
 * Check if IP is from a specific country
 */
export function isIPFromCountry(ipAddress: string, countryCode: string): boolean {
  const geo = getIPGeolocation(ipAddress);
  return geo?.countryCode === countryCode;
}

/**
 * Get distance between two IPs (approximate)
 */
export function getDistanceBetweenIPs(
  ip1: string,
  ip2: string
): number | null {
  const geo1 = getIPGeolocation(ip1);
  const geo2 = getIPGeolocation(ip2);

  if (!geo1 || !geo2 || !geo1.latitude || !geo2.latitude) {
    return null;
  }

  // Haversine formula
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km

  const dLat = toRad(geo2.latitude - geo1.latitude);
  const dLon = toRad(geo2.longitude! - geo1.longitude!);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(geo1.latitude)) *
      Math.cos(toRad(geo2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

/**
 * Validate if IP geolocation matches expected location (security check)
 */
export function validateIPLocation(
  ipAddress: string,
  expectedCountryCode: string,
  _maxDistanceKm?: number
): {
  valid: boolean;
  reason?: string;
  actual?: IPGeolocationResult | null;
} {
  const geo = getIPGeolocation(ipAddress);

  if (!geo) {
    return {
      valid: false,
      reason: 'Unable to geolocate IP',
    };
  }

  if (geo.countryCode !== expectedCountryCode) {
    return {
      valid: false,
      reason: `IP from ${geo.country} (${geo.countryCode}), expected ${expectedCountryCode}`,
      actual: geo,
    };
  }

  return {
    valid: true,
    actual: geo,
  };
}
