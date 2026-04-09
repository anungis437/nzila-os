/**
 * Nzila OS — Platform Auth schema (`user_management` PostgreSQL schema)
 *
 * Shared Drizzle table definitions for password-based authentication.
 * These map to the same tables created by union-eyes migrations and live
 * in the `user_management` PostgreSQL schema.
 *
 * All apps share the same database, so these tables are accessible from
 * every app that imports `@nzila/db/schema`.
 */
import {
  uuid,
  varchar,
  boolean,
  timestamp,
  text,
  jsonb,
  integer,
  pgSchema,
  check,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql, relations } from 'drizzle-orm'

// ── Schema ──────────────────────────────────────────────────────────────────

export const userManagementSchema = pgSchema('user_management')

// ── Users ───────────────────────────────────────────────────────────────────

export const authUsers = userManagementSchema.table(
  'users',
  {
    userId: varchar('user_id', { length: 255 }).primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    emailVerified: boolean('email_verified').default(false),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    passwordHash: text('password_hash'),
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    displayName: varchar('display_name', { length: 200 }),
    avatarUrl: text('avatar_url'),
    phone: varchar('phone', { length: 20 }),
    phoneVerified: boolean('phone_verified').default(false),
    timezone: varchar('timezone', { length: 50 }).default('UTC'),
    locale: varchar('locale', { length: 10 }).default('en-US'),
    isActive: boolean('is_active').default(true),
    isSystemAdmin: boolean('is_system_admin').default(false),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    lastLoginIp: varchar('last_login_ip', { length: 45 }),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
    failedLoginAttempts: integer('failed_login_attempts').default(0),
    accountLockedUntil: timestamp('account_locked_until', { withTimezone: true }),
    twoFactorEnabled: boolean('two_factor_enabled').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    checkEmail: check(
      'valid_email',
      sql`${table.email} ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'`,
    ),
  }),
)

// ── Organization Users ──────────────────────────────────────────────────────

export const authOrganizationUsers = userManagementSchema.table(
  'organization_users',
  {
    organizationUserId: uuid('organization_user_id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).notNull().default('member'),
    permissions: jsonb('permissions').default(sql`'[]'::jsonb`),
    isActive: boolean('is_active').default(true),
    isPrimary: boolean('is_primary').default(false),
    invitedBy: varchar('invited_by', { length: 255 }),
    invitedAt: timestamp('invited_at', { withTimezone: true }),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    lastAccessAt: timestamp('last_access_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userOrgUnique: uniqueIndex('organization_users_user_id_organization_id_idx').on(
      table.userId,
      table.organizationId,
    ),
  }),
)

// ── User Sessions ───────────────────────────────────────────────────────────

export const authUserSessions = userManagementSchema.table(
  'user_sessions',
  {
    sessionId: uuid('session_id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    organizationId: uuid('organization_id'),
    sessionToken: text('session_token').notNull().unique(),
    refreshToken: text('refresh_token').unique(),
    deviceInfo: jsonb('device_info').default(sql`'{}'::jsonb`),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    isActive: boolean('is_active').default(true),
    sessionTokenHash: text('session_token_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    checkExpiry: check(
      'valid_expiry',
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  }),
)

// ── Password Reset Tokens ───────────────────────────────────────────────────

export const authPasswordResetTokens = userManagementSchema.table(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    checkTokenExpiry: check(
      'valid_token_expiry',
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  }),
)

// ── Auth Audit Log ──────────────────────────────────────────────────────────

export const authAuditLog = userManagementSchema.table('auth_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── OAuth Providers ─────────────────────────────────────────────────────────

export const authOauthProviders = userManagementSchema.table('oauth_providers', {
  providerId: uuid('provider_id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  providerName: varchar('provider_name', { length: 50 }).notNull(),
  providerUserId: varchar('provider_user_id', { length: 255 }).notNull(),
  providerData: jsonb('provider_data').default(sql`'{}'::jsonb`),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ── Relations ───────────────────────────────────────────────────────────────

export const authOrganizationUsersRelations = relations(
  authOrganizationUsers,
  ({ one }) => ({
    user: one(authUsers, {
      fields: [authOrganizationUsers.userId],
      references: [authUsers.userId],
    }),
  }),
)

export const authUserSessionsRelations = relations(
  authUserSessions,
  ({ one }) => ({
    user: one(authUsers, {
      fields: [authUserSessions.userId],
      references: [authUsers.userId],
    }),
  }),
)

// ── Type Exports ────────────────────────────────────────────────────────────

export type AuthUser = typeof authUsers.$inferSelect
export type NewAuthUser = typeof authUsers.$inferInsert
export type AuthOrganizationUser = typeof authOrganizationUsers.$inferSelect
export type NewAuthOrganizationUser = typeof authOrganizationUsers.$inferInsert
export type AuthUserSession = typeof authUserSessions.$inferSelect
export type NewAuthUserSession = typeof authUserSessions.$inferInsert
export type AuthPasswordResetToken = typeof authPasswordResetTokens.$inferSelect
export type NewAuthPasswordResetToken = typeof authPasswordResetTokens.$inferInsert
export type AuthAuditLogEntry = typeof authAuditLog.$inferSelect
export type NewAuthAuditLogEntry = typeof authAuditLog.$inferInsert
