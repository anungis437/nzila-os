/**
 * Multi-Provider Geocoding Service
 * 
 * Abstract geocoding with automatic failover across multiple providers:
 * - Google Maps Geocoding API (primary)
 * - OpenStreetMap Nominatim (free tier)
 * - MapBox Geocoding (fallback)
 * 
 * Provides resilience against provider outages and rate limits
 */

import NodeGeocoder from 'node-geocoder';
import type { Options as GeocoderOptions, Entry as GeocodeResult } from 'node-geocoder';
import { logger } from '@/lib/logger';

export interface AddressInput {
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  locality: string;
  administrativeArea?: string;
  postalCode?: string;
  countryCode: string;
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  provider: 'google' | 'openstreetmap' | 'mapbox' | 'manual';
  confidence: 'high' | 'medium' | 'low';
  placeId?: string;
  plusCode?: string;
}

export interface ReverseGeocodingResult {
  address: {
    addressLine1: string;
    locality: string;
    administrativeArea: string;
    postalCode: string;
    countryCode: string;
  };
  formattedAddress: string;
  provider: string;
}

/**
 * Multi-provider geocoding service with automatic failover
 */
export class MultiProviderGeocodingService {
  private providers: Array<{
    name: 'google' | 'openstreetmap' | 'mapbox';
    geocoder: NodeGeocoder.Geocoder;
    priority: number;
  }>;

  constructor() {
    this.providers = this.initializeProviders();
  }

  /**
   * Initialize all available geocoding providers
   */
  private initializeProviders() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const providers: any[] = [];

    // Google Maps Geocoding (highest priority)
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (googleApiKey) {
      const googleOptions: GeocoderOptions = {
        provider: 'google',
        apiKey: googleApiKey,
        formatter: null,
      };
      providers.push({
        name: 'google',
        geocoder: NodeGeocoder(googleOptions),
        priority: 1,
      });
    }

    // OpenStreetMap Nominatim (free tier, medium priority)
    const nominatimOptions: GeocoderOptions = {
      provider: 'openstreetmap',
      formatter: null,
    };
    providers.push({
      name: 'openstreetmap',
      geocoder: NodeGeocoder(nominatimOptions),
      priority: 2,
    });

    // MapBox Geocoding (if API key available)
    const mapboxApiKey = process.env.MAPBOX_API_KEY;
    if (mapboxApiKey) {
      const mapboxOptions: GeocoderOptions = {
        provider: 'mapbox',
        apiKey: mapboxApiKey,
        formatter: null,
      };
      providers.push({
        name: 'mapbox',
        geocoder: NodeGeocoder(mapboxOptions),
        priority: 3,
      });
    }

    return providers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Geocode an address with automatic provider failover
   */
  async geocode(address: AddressInput): Promise<GeocodingResult | null> {
    const addressString = this.formatAddressString(address);

    // Try each provider in priority order
    for (const provider of this.providers) {
      try {
        const results = await provider.geocoder.geocode(addressString);

        if (results && results.length > 0) {
          const result = results[0];
          return this.mapToGeocodingResult(result, provider.name);
        }
      } catch (error) {
        logger.warn(`Geocoding failed for provider ${provider.name}:`, error);
        // Continue to next provider
      }
    }

    // All providers failed
    return null;
  }

  /**
   * Batch geocode multiple addresses with rate limiting
   */
  async batchGeocode(
    addresses: AddressInput[]
  ): Promise<Map<string, GeocodingResult | null>> {
    const results = new Map<string, GeocodingResult | null>();

    // Process in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (address) => {
          const key = this.formatAddressString(address);
          const result = await this.geocode(address);
          results.set(key, result);

          // Rate limiting delay
          await this.delay(100);
        })
      );
    }

    return results;
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(
    latitude: number,
    longitude: number
  ): Promise<ReverseGeocodingResult | null> {
    // Try each provider in priority order
    for (const provider of this.providers) {
      try {
        const results = await provider.geocoder.reverse({
          lat: latitude,
          lon: longitude,
        });

        if (results && results.length > 0) {
          const result = results[0];
          return {
            address: {
              addressLine1: result.streetName
                ? `${result.streetNumber || ''} ${result.streetName}`.trim()
                : '',
              locality: result.city || '',
              administrativeArea: result.state || result.administrativeLevels?.level1long || '',
              postalCode: result.zipcode || '',
              countryCode: result.countryCode || '',
            },
            formattedAddress: result.formattedAddress || '',
            provider: provider.name,
          };
        }
      } catch (error) {
        logger.warn(`Reverse geocoding failed for provider ${provider.name}:`, error);
        // Continue to next provider
      }
    }

    return null;
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): string[] {
    return this.providers.map((p) => p.name);
  }

  /**
   * Test provider connectivity
   */
  async testProvider(
    providerName: 'google' | 'openstreetmap' | 'mapbox'
  ): Promise<boolean> {
    const provider = this.providers.find((p) => p.name === providerName);
    if (!provider) return false;

    try {
      // Test with a known address
      const results = await provider.geocoder.geocode('1600 Amphitheatre Parkway, Mountain View, CA');
      return results && results.length > 0;
    } catch (_error) {
      return false;
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private formatAddressString(address: AddressInput): string {
    return [
      address.addressLine1,
      address.addressLine2,
      address.addressLine3,
      address.locality,
      address.administrativeArea,
      address.postalCode,
      address.countryCode,
    ]
      .filter(Boolean)
      .join(', ');
  }

  private mapToGeocodingResult(
    result: GeocodeResult,
    provider: 'google' | 'openstreetmap' | 'mapbox'
  ): GeocodingResult {
    const confidence = this.determineConfidence(result);

    return {
      latitude: result.latitude || 0,
      longitude: result.longitude || 0,
      formattedAddress: result.formattedAddress || '',
      provider,
      confidence,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      placeId: (result.extra as any)?.googlePlaceId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plusCode: (result.extra as any)?.plusCode,
    };
  }

  private determineConfidence(result: GeocodeResult): 'high' | 'medium' | 'low' {
    // Determine confidence based on address completeness
    if (result.streetNumber && result.streetName && result.zipcode) {
      return 'high'; // Full address match
    } else if (result.city && result.zipcode) {
      return 'medium'; // City-level match
    } else {
      return 'low'; // Regional match only
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let geocodingService: MultiProviderGeocodingService | null = null;

export function getGeocodingService(): MultiProviderGeocodingService {
  if (!geocodingService) {
    geocodingService = new MultiProviderGeocodingService();
  }
  return geocodingService;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export async function geocodeAddress(
  address: AddressInput
): Promise<GeocodingResult | null> {
  return getGeocodingService().geocode(address);
}

export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodingResult | null> {
  return getGeocodingService().reverseGeocode(latitude, longitude);
}

export async function batchGeocodeAddresses(
  addresses: AddressInput[]
): Promise<Map<string, GeocodingResult | null>> {
  return getGeocodingService().batchGeocode(addresses);
}
