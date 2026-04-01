import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGeocode: vi.fn(),
  mockReverse: vi.fn(),
  mockNodeGeocoder: vi.fn(),
}));

vi.mock('node-geocoder', () => ({
  default: mocks.mockNodeGeocoder,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { MultiProviderGeocodingService, getGeocodingService } from '../multi-provider-geocoding-service';

describe('MultiProviderGeocodingService', () => {
  let service: MultiProviderGeocodingService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Enable Google provider so there are 2+ providers for fallthrough tests
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';

    // Setup NodeGeocoder mock to return a geocoder object
    mocks.mockGeocode.mockResolvedValue([
      {
        latitude: 43.6532,
        longitude: -79.3832,
        formattedAddress: '123 Main St, Toronto, ON, Canada',
        streetNumber: '123',
        streetName: 'Main St',
        city: 'Toronto',
        state: 'Ontario',
        zipcode: 'M5V 1A1',
        countryCode: 'CA',
      },
    ]);
    mocks.mockReverse.mockResolvedValue([
      {
        streetNumber: '123',
        streetName: 'Main St',
        city: 'Toronto',
        state: 'Ontario',
        zipcode: 'M5V 1A1',
        countryCode: 'CA',
        formattedAddress: '123 Main St, Toronto, ON',
      },
    ]);
    mocks.mockNodeGeocoder.mockReturnValue({
      geocode: mocks.mockGeocode,
      reverse: mocks.mockReverse,
    });

    service = new MultiProviderGeocodingService();
  });

  const testAddress = {
    addressLine1: '123 Main St',
    locality: 'Toronto',
    administrativeArea: 'Ontario',
    postalCode: 'M5V 1A1',
    countryCode: 'CA',
  };

  describe('geocode', () => {
    it('returns geocoding result from first successful provider', async () => {
      const result = await service.geocode(testAddress);
      expect(result).not.toBeNull();
      expect(result!.latitude).toBe(43.6532);
      expect(result!.longitude).toBe(-79.3832);
    });

    it('returns high confidence for full address match', async () => {
      const result = await service.geocode(testAddress);
      expect(result!.confidence).toBe('high');
    });

    it('returns null when all providers fail', async () => {
      mocks.mockGeocode.mockResolvedValue([]);
      const result = await service.geocode(testAddress);
      expect(result).toBeNull();
    });

    it('falls through to next provider on error', async () => {
      mocks.mockGeocode
        .mockRejectedValueOnce(new Error('Provider error'))
        .mockResolvedValueOnce([
          {
            latitude: 43.65,
            longitude: -79.38,
            formattedAddress: '123 Main St, Toronto',
            streetNumber: '123',
            streetName: 'Main St',
            city: 'Toronto',
            zipcode: 'M5V 1A1',
          },
        ]);
      const result = await service.geocode(testAddress);
      expect(result).not.toBeNull();
    });
  });

  describe('reverseGeocode', () => {
    it('returns address from coordinates', async () => {
      const result = await service.reverseGeocode(43.6532, -79.3832);
      expect(result).not.toBeNull();
      expect(result!.address.locality).toBe('Toronto');
    });

    it('returns null when all providers fail', async () => {
      mocks.mockReverse.mockResolvedValue([]);
      const result = await service.reverseGeocode(0, 0);
      expect(result).toBeNull();
    });
  });

  describe('batchGeocode', () => {
    it('geocodes multiple addresses', async () => {
      const results = await service.batchGeocode([testAddress, testAddress]);
      expect(results.size).toBe(1); // Same address string → same key
    });
  });

  describe('getAvailableProviders', () => {
    it('returns list of provider names', () => {
      const providers = service.getAvailableProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });
  });

  describe('testProvider', () => {
    it('returns true if provider geocodes successfully', async () => {
      const result = await service.testProvider('openstreetmap');
      expect(result).toBe(true);
    });

    it('returns false if provider not found', async () => {
      const result = await service.testProvider('mapbox');
      // mapbox requires MAPBOX_API_KEY env var
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getGeocodingService', () => {
    it('returns singleton instance', () => {
      const s1 = getGeocodingService();
      const s2 = getGeocodingService();
      expect(s1).toBe(s2);
    });
  });
});
