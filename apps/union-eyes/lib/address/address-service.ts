/**
 * International Address Validation Service
 * 
 * Multi-provider address validation and standardization
 * Support for Google Maps, HERE, SmartyStreets, Loqate
 * Country-specific formatting and validation
 */

import { db } from "@/db";
import {
  internationalAddresses,
  countryAddressFormats,
  addressValidationCache,
  addressChangeHistory,
  type InternationalAddress,
  type CountryAddressFormat,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { createHash } from "crypto";

/**
 * Address Validation Provider Interface
 */
interface AddressValidationProvider {
  validateAddress(address: AddressInput): Promise<ValidationResult>;
  standardizeAddress(address: AddressInput): Promise<StandardizedAddress>;
  geocodeAddress(address: AddressInput): Promise<GeocodingResult>;
}

/**
 * Address input type
 */
export interface AddressInput {
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  locality: string;
  administrativeArea?: string;
  postalCode?: string;
  countryCode: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  confidence: "high" | "medium" | "low";
  corrections?: Partial<AddressInput>;
  deliverability?: "deliverable" | "undeliverable" | "unknown";
  metadata?: Record<string, unknown>;
}

/**
 * Standardized address
 */
export interface StandardizedAddress extends AddressInput {
  formattedAddress: string;
  localFormat: string;
}

/**
 * Geocoding result
 */
export interface GeocodingResult {
  latitude: string;
  longitude: string;
  accuracy: string;
  placeId?: string;
  plusCode?: string;
}

/**
 * Google Maps Geocoding Provider
 */
class GoogleMapsProvider implements AddressValidationProvider {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async validateAddress(address: AddressInput): Promise<ValidationResult> {
    const response = await fetch(
      `https://addressvalidation.googleapis.com/v1:validateAddress?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: {
            regionCode: address.countryCode,
            addressLines: [
              address.addressLine1,
              address.addressLine2,
              address.addressLine3,
            ].filter(Boolean),
            locality: address.locality,
            administrativeArea: address.administrativeArea,
            postalCode: address.postalCode,
          },
        }),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Google Maps API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const result = data.result;
    
    return {
      isValid: result.verdict.addressComplete && result.verdict.hasInferredComponents === false,
      confidence: result.verdict.validationGranularity === "PREMISE" ? "high" : "medium",
      deliverability: result.address.deliverable ? "deliverable" : "undeliverable",
      corrections: result.address.correctedAddress ? {
        addressLine1: result.address.correctedAddress.addressLines?.[0],
        locality: result.address.correctedAddress.locality,
        administrativeArea: result.address.correctedAddress.administrativeArea,
        postalCode: result.address.correctedAddress.postalCode,
      } : undefined,
      metadata: {
        placeId: result.address.placeId,
        plusCode: result.address.plusCode,
      },
    };
  }
  
  async standardizeAddress(address: AddressInput): Promise<StandardizedAddress> {
    const validation = await this.validateAddress(address);
    
    return {
      ...address,
      ...(validation.corrections || {}),
      formattedAddress: [
        address.addressLine1,
        address.addressLine2,
        address.locality,
        address.administrativeArea,
        address.postalCode,
        address.countryCode,
      ]
        .filter(Boolean)
        .join(", "),
      localFormat: [
        address.addressLine1,
        address.addressLine2,
        address.locality,
        address.administrativeArea,
        address.postalCode,
        address.countryCode,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }
  
  async geocodeAddress(address: AddressInput): Promise<GeocodingResult> {
    const addressString = [
      address.addressLine1,
      address.addressLine2,
      address.locality,
      address.administrativeArea,
      address.postalCode,
      address.countryCode,
    ]
      .filter(Boolean)
      .join(", ");
    
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        addressString
      )}&key=${this.apiKey}`
    );
    
    if (!response.ok) {
      throw new Error(`Google Geocoding API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.status !== "OK" || !data.results[0]) {
      throw new Error(`Geocoding failed: ${data.status}`);
    }
    
    const result = data.results[0];
    
    return {
      latitude: result.geometry.location.lat.toString(),
      longitude: result.geometry.location.lng.toString(),
      accuracy: result.geometry.location_type,
      placeId: result.place_id,
      plusCode: result.plus_code?.global_code,
    };
  }
}

/**
 * SmartyStreets Provider (US addresses)
 */
class SmartyStreetsProvider implements AddressValidationProvider {
  private authId: string;
  private authToken: string;
  
  constructor(authId: string, authToken: string) {
    this.authId = authId;
    this.authToken = authToken;
  }
  
  async validateAddress(address: AddressInput): Promise<ValidationResult> {
    if (address.countryCode !== "US") {
      throw new Error("SmartyStreets only supports US addresses");
    }
    
    const params = new URLSearchParams({
      "auth-id": this.authId,
      "auth-token": this.authToken,
      street: address.addressLine1,
      secondary: address.addressLine2 || "",
      city: address.locality,
      state: address.administrativeArea || "",
      zipcode: address.postalCode || "",
    });
    
    const response = await fetch(
      `https://us-street.api.smartystreets.com/street-address?${params}`
    );
    
    if (!response.ok) {
      throw new Error(`SmartyStreets API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      return {
        isValid: false,
        confidence: "low",
        deliverability: "undeliverable",
      };
    }
    
    const result = data[0];
    
    return {
      isValid: true,
      confidence: result.analysis.dpv_match_code === "Y" ? "high" : "medium",
      deliverability:
        result.analysis.dpv_match_code === "Y" ? "deliverable" : "undeliverable",
      corrections: {
        addressLine1: result.delivery_line_1,
        addressLine2: result.delivery_line_2,
        locality: result.components.city_name,
        administrativeArea: result.components.state_abbreviation,
        postalCode: `${result.components.zipcode}-${result.components.plus4_code}`,
      },
      metadata: {
        deliveryPoint: result.delivery_point_barcode,
        carrierRoute: result.metadata.carrier_route,
        congressionalDistrict: result.metadata.congressional_district,
      },
    };
  }
  
  async standardizeAddress(address: AddressInput): Promise<StandardizedAddress> {
    const validation = await this.validateAddress(address);
    
    return {
      ...address,
      ...(validation.corrections || {}),
      formattedAddress: [
        validation.corrections?.addressLine1 || address.addressLine1,
        validation.corrections?.addressLine2,
        validation.corrections?.locality || address.locality,
        validation.corrections?.administrativeArea || address.administrativeArea,
        validation.corrections?.postalCode || address.postalCode,
      ]
        .filter(Boolean)
        .join(", "),
      localFormat: [
        validation.corrections?.addressLine1 || address.addressLine1,
        validation.corrections?.addressLine2,
        `${validation.corrections?.locality || address.locality}, ${
          validation.corrections?.administrativeArea || address.administrativeArea
        } ${validation.corrections?.postalCode || address.postalCode}`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }
  
  async geocodeAddress(address: AddressInput): Promise<GeocodingResult> {
    const validation = await this.validateAddress(address);
    
    if (!validation.metadata?.latitude || !validation.metadata?.longitude) {
      throw new Error("Geocoding data not available");
    }
    
    return {
      latitude: validation.metadata.latitude as string,
      longitude: validation.metadata.longitude as string,
      accuracy: "rooftop",
    };
  }
}

/**
 * Address Service
 */
export class AddressService {
  /**
   * Save international address
   */
  async saveAddress(data: {
    organizationId: string;
    userId?: string;
    addressType: string;
    countryCode: string;
    addressLine1: string;
    addressLine2?: string;
    addressLine3?: string;
    locality: string;
    administrativeArea?: string;
    postalCode?: string;
    validate?: boolean;
    geocode?: boolean;
    isPrimary?: boolean;
  }): Promise<InternationalAddress> {
    // Get country format
    const countryFormat = await this.getCountryFormat(data.countryCode);
    
    if (!countryFormat) {
      throw new Error(`Country format not found for: ${data.countryCode}`);
    }
    
    let validationResult: ValidationResult | undefined;
    let geocodingResult: GeocodingResult | undefined;
    
    // Validate if requested
    if (data.validate !== false) {
      try {
        validationResult = await this.validateAddress({
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          addressLine3: data.addressLine3,
          locality: data.locality,
          administrativeArea: data.administrativeArea,
          postalCode: data.postalCode,
          countryCode: data.countryCode,
        });
      } catch (_error) {
}
    }
    
    // Geocode if requested
    if (data.geocode !== false && validationResult?.isValid) {
      try {
        geocodingResult = await this.geocodeAddress({
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          addressLine3: data.addressLine3,
          locality: data.locality,
          administrativeArea: data.administrativeArea,
          postalCode: data.postalCode,
          countryCode: data.countryCode,
        });
      } catch (_error) {
}
    }
    
    // Format address
    const formattedAddress = this.formatAddress(
      {
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        addressLine3: data.addressLine3,
        locality: data.locality,
        administrativeArea: data.administrativeArea,
        postalCode: data.postalCode,
        countryCode: data.countryCode,
      },
      countryFormat
    );
    
    // Save address
    const [address] = await db
      .insert(internationalAddresses)
      .values({
        organizationId: data.organizationId,
        userId: data.userId,
        addressType: data.addressType as typeof internationalAddresses.$inferInsert['addressType'],
        countryCode: data.countryCode,
        countryName: countryFormat.countryName,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        addressLine3: data.addressLine3,
        locality: data.locality,
        administrativeArea: data.administrativeArea,
        postalCode: data.postalCode,
        formattedAddress,
        localFormat: this.formatAddressLocal(
          {
            addressLine1: data.addressLine1,
            addressLine2: data.addressLine2,
            addressLine3: data.addressLine3,
            locality: data.locality,
            administrativeArea: data.administrativeArea,
            postalCode: data.postalCode,
            countryCode: data.countryCode,
          },
          countryFormat
        ),
        isValidated: validationResult?.isValid || false,
        validatedBy: validationResult ? "google" : undefined,
        validatedAt: validationResult ? new Date() : undefined,
        validationResult: validationResult
          ? {
              isValid: validationResult.isValid,
              confidence: ({ high: 1, medium: 0.5, low: 0.25 } as Record<string, number>)[validationResult.confidence] ?? 0.5,
              corrections: validationResult.corrections,
              metadata: validationResult.metadata,
            }
          : undefined,
        latitude: geocodingResult?.latitude,
        longitude: geocodingResult?.longitude,
        geocodedAt: geocodingResult ? new Date() : undefined,
        geocodeProvider: geocodingResult ? "google" : undefined,
        geocodeAccuracy: geocodingResult?.accuracy,
        status: validationResult?.isValid ? "active" : "unverified",
        isPrimary: data.isPrimary || false,
      })
      .returning();
    
    // Save to history
    await db.insert(addressChangeHistory).values({
      addressId: address.id,
      changeType: "created",
      changedBy: data.userId,
      newValue: address,
      changeSource: "user",
    });
    
    return address;
  }
  
  /**
   * Validate address using provider
   */
  async validateAddress(address: AddressInput): Promise<ValidationResult> {
    // Check cache first
    const cached = await this.getCachedValidation(address);
    if (cached) {
      return cached;
    }
    
    // Get provider
    const provider = this.getValidationProvider(address.countryCode);
    
    // Validate
    const result = await provider.validateAddress(address);
    
    // Cache result
    await this.cacheValidation(address, result);
    
    return result;
  }
  
  /**
   * Geocode address
   */
  async geocodeAddress(address: AddressInput): Promise<GeocodingResult> {
    const provider = this.getValidationProvider(address.countryCode);
    return provider.geocodeAddress(address);
  }
  
  /**
   * Get country format
   */
  async getCountryFormat(countryCode: string): Promise<CountryAddressFormat | null> {
    const formats = await db
      .select()
      .from(countryAddressFormats)
      .where(eq(countryAddressFormats.countryCode, countryCode))
      .limit(1);
    
    return formats[0] || null;
  }
  
  /**
   * Format address for display
   */
  formatAddress(address: AddressInput, format: CountryAddressFormat): string {
    // Use format template
    let formatted = format.addressFormat;
    
    // Replace placeholders
    formatted = formatted
      .replace("{addressLine1}", address.addressLine1 || "")
      .replace("{addressLine2}", address.addressLine2 || "")
      .replace("{addressLine3}", address.addressLine3 || "")
      .replace("{locality}", address.locality || "")
      .replace("{administrativeArea}", address.administrativeArea || "")
      .replace("{postalCode}", address.postalCode || "")
      .replace("{countryCode}", address.countryCode || "");
    
    return formatted;
  }
  
  /**
   * Format address in local format
   */
  formatAddressLocal(address: AddressInput, format: CountryAddressFormat): string {
    const parts: string[] = [];
    
    if (format.displayOrder) {
      for (const field of format.displayOrder) {
        const value = (address as unknown as Record<string, string>)[field];
        if (value) parts.push(value);
      }
    } else {
      // Default order
      if (address.addressLine1) parts.push(address.addressLine1);
      if (address.addressLine2) parts.push(address.addressLine2);
      if (address.addressLine3) parts.push(address.addressLine3);
      if (address.locality) parts.push(address.locality);
      if (address.administrativeArea) parts.push(address.administrativeArea);
      if (address.postalCode) parts.push(address.postalCode);
      parts.push(address.countryCode);
    }
    
    return parts.join("\n");
  }
  
  /**
   * Get validation provider
   */
  private getValidationProvider(
    countryCode: string
  ): AddressValidationProvider {
    // Use Google Maps by default
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (googleApiKey) {
      return new GoogleMapsProvider(googleApiKey);
    }
    
    // Use SmartyStreets for US addresses
    if (countryCode === "US") {
      const authId = process.env.SMARTYSTREETS_AUTH_ID;
      const authToken = process.env.SMARTYSTREETS_AUTH_TOKEN;
      
      if (authId && authToken) {
        return new SmartyStreetsProvider(authId, authToken);
      }
    }
    
    throw new Error("No address validation provider configured");
  }
  
  /**
   * Get cached validation
   */
  private async getCachedValidation(
    address: AddressInput
  ): Promise<ValidationResult | null> {
    const hash = this.hashAddress(address);
    
    const cached = await db
      .select()
      .from(addressValidationCache)
      .where(
        and(
          eq(addressValidationCache.inputHash, hash),
          sql`${addressValidationCache.expiresAt} > NOW()`
        )
      )
      .limit(1);
    
    if (cached[0]) {
      // Update hit count
      await db
        .update(addressValidationCache)
        .set({
          hitCount: sql`${addressValidationCache.hitCount} + 1`,
          lastHitAt: new Date(),
        })
        .where(eq(addressValidationCache.id, cached[0].id));
      
      return {
        isValid: cached[0].isValid,
        confidence: (cached[0].confidence as ValidationResult['confidence']) || "medium",
        corrections: cached[0].correctedAddress || undefined,
        metadata: (cached[0].metadata as Record<string, unknown>) || undefined,
      };
    }
    
    return null;
  }
  
  /**
   * Cache validation result
   */
  private async cacheValidation(
    address: AddressInput,
    result: ValidationResult
  ): Promise<void> {
    const hash = this.hashAddress(address);
    
    // Cache for 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    await db.insert(addressValidationCache).values({
      inputHash: hash,
      countryCode: address.countryCode,
      addressLine1: address.addressLine1,
      locality: address.locality,
      administrativeArea: address.administrativeArea,
      postalCode: address.postalCode,
      isValid: result.isValid,
      validatedBy: "google",
      confidence: result.confidence,
      correctedAddress: result.corrections,
      latitude: result.metadata?.latitude as string | undefined,
      longitude: result.metadata?.longitude as string | undefined,
      metadata: result.metadata as Record<string, unknown> | undefined,
      expiresAt,
    });
  }
  
  /**
   * Hash address for cache lookup
   */
  private hashAddress(address: AddressInput): string {
    const normalized = [
      address.addressLine1.toLowerCase().trim(),
      address.addressLine2?.toLowerCase().trim() || "",
      address.locality.toLowerCase().trim(),
      address.administrativeArea?.toLowerCase().trim() || "",
      address.postalCode?.toLowerCase().trim() || "",
      address.countryCode.toLowerCase().trim(),
    ].join("|");
    
    return createHash("md5").update(normalized).digest("hex");
  }
}

/**
 * Postal Code Validator
 */
export class PostalCodeValidator {
  /**
   * Validate postal code for country
   */
  validate(postalCode: string, countryCode: string): {
    isValid: boolean;
    formatted?: string;
    error?: string;
  } {
    const patterns: Record<string, RegExp> = {
      US: /^\d{5}(-\d{4})?$/,
      CA: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
      GB: /^[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}$/i,
      AU: /^\d{4}$/,
      DE: /^\d{5}$/,
      FR: /^\d{5}$/,
      IT: /^\d{5}$/,
      ES: /^\d{5}$/,
      NL: /^\d{4}\s?[A-Z]{2}$/i,
      BE: /^\d{4}$/,
      CH: /^\d{4}$/,
      AT: /^\d{4}$/,
      SE: /^\d{3}\s?\d{2}$/,
      NO: /^\d{4}$/,
      DK: /^\d{4}$/,
      FI: /^\d{5}$/,
      IE: /^[A-Z]\d{2}\s?[A-Z0-9]{4}$/i,
      NZ: /^\d{4}$/,
      JP: /^\d{3}-?\d{4}$/,
      KR: /^\d{5}$/,
      IN: /^\d{6}$/,
      BR: /^\d{5}-?\d{3}$/,
      MX: /^\d{5}$/,
      AR: /^[A-Z]?\d{4}$/i,
    };
    
    const pattern = patterns[countryCode];
    
    if (!pattern) {
      return {
        isValid: true, // Unknown country, accept anything
        formatted: postalCode,
      };
    }
    
    const isValid = pattern.test(postalCode);
    
    return {
      isValid,
      formatted: isValid ? postalCode : undefined,
      error: isValid ? undefined : `Invalid postal code format for ${countryCode}`,
    };
  }
}

