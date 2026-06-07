/**
 * International Address Schema
 * 
 * Support for international address formats
 * Country-specific validation
 * Geocoding and address standardization
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  pgEnum,
  index,
  integer,
} from "drizzle-orm/pg-core";
import { organizations } from "../schema-organizations";
import { profiles } from "./profiles-schema";

// Address type enum
export const addressTypeEnum = pgEnum("address_type", [
  "mailing",
  "residential",
  "business",
  "billing",
  "shipping",
  "temporary",
]);

// Address status enum
export const addressStatusEnum = pgEnum("address_status", [
  "active",
  "inactive",
  "unverified",
  "invalid",
]);

/**
 * International Addresses
 * Flexible schema supporting global address formats
 */
export const internationalAddresses = pgTable(
  "international_addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => profiles.userId, {
      onDelete: "set null",
    }),
    
    // Address type and status
    addressType: addressTypeEnum("address_type").notNull().default("mailing"),
    status: addressStatusEnum("status").notNull().default("unverified"),
    
    // Country
    countryCode: text("country_code").notNull(), // ISO 3166-1 alpha-2 (US, CA, GB, etc.)
    countryName: text("country_name").notNull(),
    
    // Core address fields (flexible for international use)
    addressLine1: text("address_line_1").notNull(),
    addressLine2: text("address_line_2"),
    addressLine3: text("address_line_3"), // Some countries need 3+ lines
    
    // City/locality (different names in different countries)
    locality: text("locality").notNull(), // City, Town, Village
    localityType: text("locality_type"), // city, town, village, district
    
    // Region/state/province
    administrativeArea: text("administrative_area"), // State, Province, Region
    administrativeAreaType: text("administrative_area_type"), // state, province, region, prefecture
    
    // Postal code
    postalCode: text("postal_code"),
    postalCodeType: text("postal_code_type"), // ZIP, postcode, postal code, PIN code
    
    // Additional fields for specific countries
    subAdministrativeArea: text("sub_administrative_area"), // County, District
    dependentLocality: text("dependent_locality"), // Suburb, Neighborhood
    sortingCode: text("sorting_code"), // CEDEX (France), etc.
    
    // Formatted addresses
    formattedAddress: text("formatted_address"), // Full formatted address
    localFormat: text("local_format"), // Format according to local conventions
    
    // Geocoding
    latitude: text("latitude"),
    longitude: text("longitude"),
    geocodedAt: timestamp("geocoded_at"),
    geocodeProvider: text("geocode_provider"), // Google, HERE, OpenStreetMap
    geocodeAccuracy: text("geocode_accuracy"), // rooftop, range_interpolated, geometric_center
    
    // Validation
    isValidated: boolean("is_validated").notNull().default(false),
    validatedBy: text("validated_by"), // Provider used for validation
    validatedAt: timestamp("validated_at"),
    validationResult: jsonb("validation_result").$type<{
      isValid: boolean;
      confidence: number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      corrections?: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata?: any;
    }>(),
    
    // Standardization
    isStandardized: boolean("is_standardized").notNull().default(false),
    standardizedBy: text("standardized_by"), // USPS, Canada Post, Royal Mail, etc.
    standardizedAt: timestamp("standardized_at"),
    standardizedData: jsonb("standardized_data"),
    
    // Delivery information
    deliverability: text("deliverability"), // deliverable, undeliverable, unknown
    deliveryPoint: text("delivery_point"), // Delivery point barcode (USPS)
    carrierRoute: text("carrier_route"), // Carrier route code
    
    // Metadata
    metadata: jsonb("metadata").$type<{
      timezone?: string;
      plusCode?: string; // Google Plus Code
      what3words?: string; // What3Words address
      buildingName?: string;
      floor?: string;
      unit?: string;
      poBox?: string;
      additionalInfo?: string;
    }>(),
    
    // Primary address flag
    isPrimary: boolean("is_primary").notNull().default(false),
    
    // Notes
    notes: text("notes"),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index("international_addresses_organization_id_idx").on(
      table.organizationId
    ),
    userIdIdx: index("international_addresses_user_id_idx").on(table.userId),
    countryCodeIdx: index("international_addresses_country_code_idx").on(
      table.countryCode
    ),
    statusIdx: index("international_addresses_status_idx").on(table.status),
    isPrimaryIdx: index("international_addresses_is_primary_idx").on(
      table.isPrimary
    ),
    postalCodeIdx: index("international_addresses_postal_code_idx").on(
      table.postalCode
    ),
  })
);

/**
 * Country Address Formats
 * Configuration for country-specific address formats
 */
export const countryAddressFormats = pgTable(
  "country_address_formats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Country identification
    countryCode: text("country_code").notNull().unique(), // ISO 3166-1 alpha-2
    countryName: text("country_name").notNull(),
    iso3Code: text("iso3_code"), // ISO 3166-1 alpha-3
    
    // Naming conventions
    localityLabel: text("locality_label").notNull().default("City"),
    administrativeAreaLabel: text("administrative_area_label").default("State"),
    postalCodeLabel: text("postal_code_label").default("Postal Code"),
    subAdministrativeAreaLabel: text("sub_administrative_area_label"),
    
    // Field requirements
    requiredFields: jsonb("required_fields").$type<string[]>(),
    optionalFields: jsonb("optional_fields").$type<string[]>(),
    
    // Format configuration
    addressFormat: text("address_format").notNull(), // Template with placeholders
    displayOrder: jsonb("display_order").$type<string[]>(), // Order to display fields
    
    // Postal code configuration
    postalCodeRequired: boolean("postal_code_required").notNull().default(true),
    postalCodePattern: text("postal_code_pattern"), // Regex pattern
    postalCodeExample: text("postal_code_example"),
    postalCodeLength: integer("postal_code_length"),
    
    // Administrative areas
    administrativeAreas: jsonb("administrative_areas").$type<
      Array<{
        code: string;
        name: string;
        type: string;
      }>
    >(),
    hasSubdivisions: boolean("has_subdivisions").notNull().default(false),
    
    // Validation rules
    validationRules: jsonb("validation_rules").$type<{
      addressLine1?: { minLength?: number; maxLength?: number };
      locality?: { minLength?: number; maxLength?: number };
      postalCode?: { format?: string; checkDigit?: boolean };
    }>(),
    
    // Geocoding support
    geocodingSupported: boolean("geocoding_supported").notNull().default(true),
    preferredGeocoder: text("preferred_geocoder"),
    
    // Standardization
    standardizationProvider: text("standardization_provider"), // USPS, Canada Post, etc.
    standardizationAvailable: boolean("standardization_available")
      .notNull()
      .default(false),
    
    // Examples
    exampleAddresses: jsonb("example_addresses").$type<
      Array<{
        addressLine1: string;
        locality: string;
        administrativeArea?: string;
        postalCode?: string;
        formatted: string;
      }>
    >(),
    
    // Metadata
    metadata: jsonb("metadata").$type<{
      timezone?: string;
      currency?: string;
      phonePrefix?: string;
      measurementSystem?: "metric" | "imperial";
      drivingSide?: "left" | "right";
    }>(),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    countryCodeIdx: index("country_address_formats_country_code_idx").on(
      table.countryCode
    ),
  })
);

/**
 * Address Validation Cache
 * Cache validated addresses to reduce API calls
 */
export const addressValidationCache = pgTable(
  "address_validation_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Input address (normalized for lookup)
    inputHash: text("input_hash").notNull().unique(), // Hash of normalized input
    countryCode: text("country_code").notNull(),
    addressLine1: text("address_line_1").notNull(),
    locality: text("locality").notNull(),
    administrativeArea: text("administrative_area"),
    postalCode: text("postal_code"),
    
    // Validation result
    isValid: boolean("is_valid").notNull(),
    validatedBy: text("validated_by").notNull(), // Provider name
    confidence: text("confidence"), // high, medium, low
    
    // Corrected/standardized address
    correctedAddress: jsonb("corrected_address").$type<{
      addressLine1?: string;
      addressLine2?: string;
      locality?: string;
      administrativeArea?: string;
      postalCode?: string;
      countryCode?: string;
    }>(),
    
    // Geocoding
    latitude: text("latitude"),
    longitude: text("longitude"),
    
    // Metadata
    metadata: jsonb("metadata"),
    
    // Cache control
    expiresAt: timestamp("expires_at").notNull(),
    hitCount: integer("hit_count").notNull().default(1),
    lastHitAt: timestamp("last_hit_at").notNull().defaultNow(),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    inputHashIdx: index("address_validation_cache_input_hash_idx").on(
      table.inputHash
    ),
    expiresAtIdx: index("address_validation_cache_expires_at_idx").on(
      table.expiresAt
    ),
  })
);

/**
 * Address Change History
 * Track address changes for audit purposes
 */
export const addressChangeHistory = pgTable(
  "address_change_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    addressId: uuid("address_id")
      .notNull()
      .references(() => internationalAddresses.id, { onDelete: "cascade" }),
    
    // Change details
    changeType: text("change_type").notNull(), // created, updated, deleted, validated
    changedBy: text("changed_by").references(() => profiles.userId),
    
    // Previous values
    previousValue: jsonb("previous_value"),
    newValue: jsonb("new_value"),
    
    // Change context
    changeReason: text("change_reason"),
    changeSource: text("change_source"), // user, system, validation, import
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    addressIdIdx: index("address_change_history_address_id_idx").on(
      table.addressId
    ),
    createdAtIdx: index("address_change_history_created_at_idx").on(
      table.createdAt
    ),
  })
);

// Type exports
export type InternationalAddress = typeof internationalAddresses.$inferSelect;
export type NewInternationalAddress = typeof internationalAddresses.$inferInsert;
export type CountryAddressFormat = typeof countryAddressFormats.$inferSelect;
export type NewCountryAddressFormat = typeof countryAddressFormats.$inferInsert;
export type AddressValidationCache = typeof addressValidationCache.$inferSelect;
export type AddressChangeHistory = typeof addressChangeHistory.$inferSelect;

