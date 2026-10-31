/**
 * SSO and SCIM Schema
 * 
 * Enterprise identity management with SAML/OIDC SSO and SCIM 2.0 provisioning
 */

import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "../schema-organizations";

/**
 * SSO Providers Table
 * SAML and OIDC identity provider configurations
 */
export const ssoProviders = pgTable("sso_providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Organization
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // Provider info
  name: varchar("name", { length: 255 }).notNull(),
  providerType: varchar("provider_type", { length: 50 }).notNull(), // 'saml' | 'oidc'
  
  // SAML configuration
  samlEntityId: varchar("saml_entity_id", { length: 500 }),
  samlSsoUrl: varchar("saml_sso_url", { length: 500 }),
  samlSloUrl: varchar("saml_slo_url", { length: 500 }), // Single Logout URL
  samlCertificate: text("saml_certificate"), // X.509 certificate
  samlSigningAlgorithm: varchar("saml_signing_algorithm", { length: 50 }).default('sha256'),
  samlNameIdFormat: varchar("saml_name_id_format", { length: 200 }).default('urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'),
  
  // OIDC configuration
  oidcIssuer: varchar("oidc_issuer", { length: 500 }),
  oidcClientId: varchar("oidc_client_id", { length: 255 }),
  oidcClientSecret: text("oidc_client_secret"), // Encrypted
  oidcAuthorizationEndpoint: varchar("oidc_authorization_endpoint", { length: 500 }),
  oidcTokenEndpoint: varchar("oidc_token_endpoint", { length: 500 }),
  oidcUserinfoEndpoint: varchar("oidc_userinfo_endpoint", { length: 500 }),
  oidcJwksUri: varchar("oidc_jwks_uri", { length: 500 }),
  oidcScopes: text("oidc_scopes").array().default(sql`ARRAY['openid', 'profile', 'email']`),
  
  // Attribute mapping
  attributeMapping: jsonb("attribute_mapping").notNull(), 
  // { email: 'email', firstName: 'given_name', lastName: 'family_name', role: 'role' }
  
  // Role mapping from IdP
  roleMapping: jsonb("role_mapping"), 
  // { 'IdP-Admin': 'admin', 'IdP-Member': 'member' }
  
  // Settings
  autoProvision: boolean("auto_provision").default(true), // Auto-create users on first login
  justInTimeProvisioning: boolean("just_in_time_provisioning").default(true),
  requireGroups: text("require_groups").array(), // Required IdP groups
  
  // Status
  enabled: boolean("enabled").default(true),
  
  // Metadata
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  
  // Audit trail
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  updatedBy: varchar("updated_by", { length: 255 }),
}, (table) => [
  uniqueIndex("sso_providers_org_saml_entity_idx").on(table.organizationId, table.samlEntityId).where(sql`${table.samlEntityId} IS NOT NULL`),
  uniqueIndex("sso_providers_org_oidc_issuer_client_idx").on(table.organizationId, table.oidcIssuer, table.oidcClientId).where(sql`${table.oidcIssuer} IS NOT NULL`),
]);

/**
 * SCIM Configuration Table
 * SCIM 2.0 provisioning settings per organization
 */
export const scimConfigurations = pgTable("scim_configurations", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Organization
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // SCIM endpoint
  baseUrl: varchar("base_url", { length: 500 }).notNull(), // https://union-eyes.com/scim/v2/{orgId}
  
  // Authentication
  bearerToken: text("bearer_token").notNull(), // Long-lived token for IdP
  tokenHash: varchar("token_hash", { length: 255 }), // SHA-256 hash for lookup
  tokenCreatedAt: timestamp("token_created_at", { withTimezone: true }).defaultNow(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  
  // Settings
  enabled: boolean("enabled").default(true),
  syncUsers: boolean("sync_users").default(true),
  syncGroups: boolean("sync_groups").default(true),
  deprovisionAction: varchar("deprovision_action", { length: 50 }).default('suspend'), 
  // 'suspend' | 'delete' | 'archive'
  
  // Filtering
  userFilter: jsonb("user_filter"), // SCIM filter for users to sync
  groupFilter: jsonb("group_filter"), // SCIM filter for groups to sync
  
  // Mappings
  userAttributeMapping: jsonb("user_attribute_mapping").notNull(),
  groupAttributeMapping: jsonb("group_attribute_mapping"),
  
  // Stats
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  usersSynced: integer("users_synced").default(0),
  groupsSynced: integer("groups_synced").default(0),
  
  // Audit trail
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  
  // Metadata
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
});

/**
 * SSO Sessions Table
 * Active SSO sessions for audit and management
 */
export const ssoSessions = pgTable("sso_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Provider and user
  providerId: uuid("provider_id").notNull().references(() => ssoProviders.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // Session details
  sessionId: varchar("session_id", { length: 255 }).notNull().unique(),
  nameId: varchar("name_id", { length: 255 }), // SAML NameID
  sessionIndex: varchar("session_index", { length: 255 }), // SAML SessionIndex
  
  // Authentication context
  idpSessionId: varchar("idp_session_id", { length: 255 }),
  authMethod: varchar("auth_method", { length: 50 }), // 'saml' | 'oidc'
  authLevel: varchar("auth_level", { length: 50 }), // 'mfa' | 'password' | 'certificate'
  
  // IP and device
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  deviceFingerprint: varchar("device_fingerprint", { length: 255 }),
  
  // Timing
  authenticatedAt: timestamp("authenticated_at", { withTimezone: true }).defaultNow(),
  lastAccessAt: timestamp("last_access_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  terminatedAt: timestamp("terminated_at", { withTimezone: true }),
  
  // Status
  status: varchar("status", { length: 50 }).default('active'), // 'active' | 'expired' | 'terminated'
  
  // Audit trail
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  
  // Metadata
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
});

/**
 * SCIM Events Log
 * Audit log for SCIM provisioning operations
 */
export const scimEventsLog = pgTable("scim_events_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Configuration
  configId: uuid("config_id").notNull().references(() => scimConfigurations.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // Event details
  eventType: varchar("event_type", { length: 50 }).notNull(), 
  // 'user.created' | 'user.updated' | 'user.deleted' | 'group.created' | 'group.updated' | 'group.deleted'
  
  resourceType: varchar("resource_type", { length: 50 }).notNull(), // 'User' | 'Group'
  resourceId: varchar("resource_id", { length: 255 }),
  
  // Operation
  operation: varchar("operation", { length: 50 }).notNull(), // 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'GET'
  requestPath: varchar("request_path", { length: 500 }),
  
  // Data
  requestBody: jsonb("request_body"),
  responseBody: jsonb("response_body"),
  
  // Status
  status: varchar("status", { length: 50 }).notNull(), // 'success' | 'error' | 'warning'
  statusCode: integer("status_code"),
  errorMessage: text("error_message"),
  
  // Timing
  processingTimeMs: integer("processing_time_ms"),
  
  // IP and auth
  ipAddress: varchar("ip_address", { length: 50 }),
  authenticatedAs: varchar("authenticated_as", { length: 255 }),
  
  // Audit trail
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  
  // Metadata
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
});

/**
 * MFA Configuration Table
 * Multi-factor authentication settings
 */
export const mfaConfigurations = pgTable("mfa_configurations", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // User
  userId: uuid("user_id").notNull(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // MFA method
  methodType: varchar("method_type", { length: 50 }).notNull(), // 'totp' | 'sms' | 'email' | 'webauthn'
  
  // TOTP settings
  totpSecret: text("totp_secret"), // Encrypted
  totpBackupCodes: text("totp_backup_codes").array(),
  
  // WebAuthn settings
  webauthnCredentialId: text("webauthn_credential_id"),
  webauthnPublicKey: text("webauthn_public_key"),
  webauthnCounter: integer("webauthn_counter").default(0),
  
  // SMS/Email settings
  phoneNumber: varchar("phone_number", { length: 50 }),
  emailAddress: varchar("email_address", { length: 255 }),
  
  // Status
  enabled: boolean("enabled").default(true),
  verified: boolean("verified").default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  
  // Device info (for WebAuthn)
  deviceName: varchar("device_name", { length: 255 }),
  deviceType: varchar("device_type", { length: 50 }),
  
  // Audit trail
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  
  // Metadata
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
});

// Export types
export type SSOProvider = typeof ssoProviders.$inferSelect;
export type NewSSOProvider = typeof ssoProviders.$inferInsert;
export type SCIMConfiguration = typeof scimConfigurations.$inferSelect;
export type NewSCIMConfiguration = typeof scimConfigurations.$inferInsert;
export type SSOSession = typeof ssoSessions.$inferSelect;
export type NewSSOSession = typeof ssoSessions.$inferInsert;
export type SCIMEventLog = typeof scimEventsLog.$inferSelect;
export type NewSCIMEventLog = typeof scimEventsLog.$inferInsert;
export type MFAConfiguration = typeof mfaConfigurations.$inferSelect;
export type NewMFAConfiguration = typeof mfaConfigurations.$inferInsert;
