import { uuid, varchar, boolean, timestamp, text, jsonb, integer, pgSchema, check } from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";
import { organizations } from "../../../schema-organizations";

// Create user_management schema
export const userManagementSchema = pgSchema("user_management");

// Users table - core user authentication and profile
export const users = userManagementSchema.table("users", {
  userId: varchar("user_id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  passwordHash: text("password_hash"),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  displayName: varchar("display_name", { length: 200 }),
  avatarUrl: text("avatar_url"),
  phone: varchar("phone", { length: 20 }),
  phoneVerified: boolean("phone_verified").default(false),
  phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
  timezone: varchar("timezone", { length: 50 }).default("UTC"),
  locale: varchar("locale", { length: 10 }).default("en-US"),
  isActive: boolean("is_active").default(true),
  isSystemAdmin: boolean("is_system_admin").default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  lastLoginIp: varchar("last_login_ip", { length: 45 }), // IPv6 support
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  accountLockedUntil: timestamp("account_locked_until", { withTimezone: true }),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: text("two_factor_secret"),
  twoFactorBackupCodes: text("two_factor_backup_codes").array(),
  
  // Encrypted PII fields (added for tax compliance)
  // Store encrypted using lib/encryption.ts utilities
  encryptedSin: text("encrypted_sin"), // Social Insurance Number (Canada)
  encryptedSsn: text("encrypted_ssn"), // Social Security Number (USA)
  encryptedBankAccount: text("encrypted_bank_account"), // Bank account details
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  checkEmail: check("valid_email", 
    sql`${table.email} ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'`),
  checkPhone: check("valid_phone", 
    sql`${table.phone} IS NULL OR ${table.phone} ~ '^\\+?[1-9]\\d{1,14}$'`),
}));

// Organization users table - links users to organizations with roles
// NOTE: userId uses VARCHAR to support Clerk user IDs (format: "user_xxxxx")
export const organizationUsers = userManagementSchema.table("organization_users", {
  organizationUserId: uuid("organization_user_id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).notNull(), // Changed from uuid to support Clerk IDs
  role: varchar("role", { length: 50 }).notNull().default("member"),
  permissions: jsonb("permissions").default(sql`'[]'::jsonb`),
  isActive: boolean("is_active").default(true),
  isPrimary: boolean("is_primary").default(false), // Indicates if this is the user's primary organization
  invitedBy: varchar("invited_by", { length: 255 }).references(() => users.userId),
  invitedAt: timestamp("invited_at", { withTimezone: true }),
  joinedAt: timestamp("joined_at", { withTimezone: true }),
  lastAccessAt: timestamp("last_access_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// User sessions table - authentication session management
export const userSessions = userManagementSchema.table("user_sessions", {
  sessionId: uuid("session_id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.userId, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  sessionToken: text("session_token").notNull().unique(),
  refreshToken: text("refresh_token").unique(),
  deviceInfo: jsonb("device_info").default(sql`'{}'::jsonb`),
  ipAddress: varchar("ip_address", { length: 45 }), // IPv6 support
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  checkExpiry: check("valid_expiry", 
    sql`${table.expiresAt} > ${table.createdAt}`),
}));

// OAuth providers table - external authentication integration
export const oauthProviders = userManagementSchema.table("oauth_providers", {
  providerId: uuid("provider_id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.userId, { onDelete: "cascade" }),
  providerName: varchar("provider_name", { length: 50 }).notNull(),
  providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),
  providerData: jsonb("provider_data").default(sql`'{}'::jsonb`),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Define relations
export const organizationUsersRelations = relations(organizationUsers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationUsers.organizationId],
    references: [organizations.id],
  }),
}));

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type OrganizationUser = typeof organizationUsers.$inferSelect;
export type NewOrganizationUser = typeof organizationUsers.$inferInsert;
export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;
export type OAuthProvider = typeof oauthProviders.$inferSelect;
export type NewOAuthProvider = typeof oauthProviders.$inferInsert;

