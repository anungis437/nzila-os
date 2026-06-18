import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLookup = vi.hoisted(() => vi.fn());

vi.mock('geoip-lite', () => ({
  default: { lookup: mockLookup },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  getIPGeolocation,
  getEnhancedIPGeolocation,
  batchIPGeolocation,
  isIPFromCountry,
  getDistanceBetweenIPs,
  validateIPLocation,
} from '../ip-geolocation-service';

describe('ip-geolocation-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookup.mockReturnValue(null);
  });

  describe('getIPGeolocation', () => {
    it('returns null for 127.0.0.1', () => {
      expect(getIPGeolocation('127.0.0.1')).toBeNull();
    });

    it('returns null for localhost', () => {
      expect(getIPGeolocation('localhost')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(getIPGeolocation('')).toBeNull();
    });

    it('returns fallback result when geoip-lite has no data', () => {
      mockLookup.mockReturnValue(null);

      const result = getIPGeolocation('203.0.113.1');

      expect(result).not.toBeNull();
      expect(result!.ip).toBe('203.0.113.1');
      expect(result!.accuracy).toBe('low');
      expect(result!.source).toBe('fallback');
    });

    it('returns geolocation data when geoip-lite has data', () => {
      mockLookup.mockReturnValue({
        range: [0, 0],
        country: 'CA',
        region: 'ON',
        eu: '0',
        timezone: 'America/Toronto',
        city: '',
        ll: [43.65, -79.38],
        metro: 0,
        area: 0,
      });

      const result = getIPGeolocation('192.0.2.1');

      expect(result).not.toBeNull();
      expect(result!.country).toBe('CA');
      expect(result!.region).toBe('ON');
      expect(result!.latitude).toBe(43.65);
      expect(result!.longitude).toBe(-79.38);
      expect(result!.source).toBe('geoip-lite');
      expect(result!.accuracy).toBe('medium');
    });
  });

  describe('getEnhancedIPGeolocation', () => {
    it('returns null for localhost', async () => {
      const result = await getEnhancedIPGeolocation('127.0.0.1');
      expect(result).toBeNull();
    });

    it('falls back to local lookup when fetch fails', async () => {
      mockLookup.mockReturnValue(null);
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const result = await getEnhancedIPGeolocation('203.0.113.1');

      // Falls back to local getIPGeolocation
      expect(result).not.toBeNull();
      expect(result!.source).toBe('fallback');

      vi.unstubAllGlobals();
    });

    it('returns high-accuracy data from ipapi on success', async () => {
      mockLookup.mockReturnValue(null);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              city: 'Toronto',
              region: 'Ontario',
              country_name: 'Canada',
              country_code: 'CA',
              latitude: 43.65,
              longitude: -79.38,
              timezone: 'America/Toronto',
            }),
        })
      );

      const result = await getEnhancedIPGeolocation('192.0.2.1');

      expect(result).not.toBeNull();
      expect(result!.city).toBe('Toronto');
      expect(result!.accuracy).toBe('high');
      expect(result!.source).toBe('ipapi');

      vi.unstubAllGlobals();
    });
  });

  describe('utility helpers', () => {
    it('batchIPGeolocation returns a map with per-ip lookups', () => {
      mockLookup.mockReturnValue({
        country: 'CA',
        region: 'ON',
        ll: [43.65, -79.38],
        timezone: 'America/Toronto',
      });

      const result = batchIPGeolocation(['192.0.2.1', '198.51.100.10']);
      expect(result.size).toBe(2);
      expect(result.get('192.0.2.1')?.countryCode).toBe('CA');
    });

    it('isIPFromCountry checks countryCode match', () => {
      mockLookup.mockReturnValue({
        country: 'CA',
        region: 'ON',
        ll: [43.65, -79.38],
        timezone: 'America/Toronto',
      });

      expect(isIPFromCountry('192.0.2.1', 'CA')).toBe(true);
      expect(isIPFromCountry('192.0.2.1', 'US')).toBe(false);
    });

    it('getDistanceBetweenIPs returns km distance when both lookups have coordinates', () => {
      mockLookup
        .mockReturnValueOnce({ country: 'CA', region: 'ON', ll: [43.65, -79.38], timezone: 'America/Toronto' })
        .mockReturnValueOnce({ country: 'CA', region: 'QC', ll: [45.50, -73.56], timezone: 'America/Montreal' });

      const distance = getDistanceBetweenIPs('192.0.2.1', '198.51.100.10');
      expect(distance).not.toBeNull();
      expect(distance!).toBeGreaterThan(0);
    });

    it('getDistanceBetweenIPs returns null when any lookup is missing', () => {
      mockLookup.mockReturnValueOnce(null).mockReturnValueOnce({
        country: 'CA',
        region: 'QC',
        ll: [45.50, -73.56],
        timezone: 'America/Montreal',
      });

      expect(getDistanceBetweenIPs('192.0.2.1', '198.51.100.10')).toBeNull();
    });

    it('validateIPLocation returns invalid when geolocation is unavailable', () => {
      const result = validateIPLocation('localhost', 'CA');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Unable to geolocate IP');
    });

    it('validateIPLocation returns invalid when country mismatches', () => {
      mockLookup.mockReturnValue({
        country: 'US',
        region: 'CA',
        ll: [34.05, -118.24],
        timezone: 'America/Los_Angeles',
      });

      const result = validateIPLocation('192.0.2.1', 'CA');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('expected CA');
      expect(result.actual?.countryCode).toBe('US');
    });

    it('validateIPLocation returns valid when country matches', () => {
      mockLookup.mockReturnValue({
        country: 'CA',
        region: 'ON',
        ll: [43.65, -79.38],
        timezone: 'America/Toronto',
      });

      const result = validateIPLocation('192.0.2.1', 'CA');
      expect(result.valid).toBe(true);
      expect(result.actual?.countryCode).toBe('CA');
    });
  });
});
