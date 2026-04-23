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
    // ── Lifecycle & identity-source columns (2026-04-24) ──────────────────
    // accountSource: local | sso | invite | scim  (tracks provisioning origin)
    // lifecycleState: active | suspended | deprovisioned
    accountSource: varchar('account_source', { length: 20 })
      .notNull()
      .default('local'),
    lifecycleState: varchar('lifecycle_state', { length: 20 })
      .notNull()
      .default('active'),
    lifecycleReason: text('lifecycle_reason'),
    lifecycleChangedAt: timestamp('lifecycle_changed_at', { withTimezone: true }),
    lifecycleChangedBy: varchar('lifecycle_changed_by', { length: 255 }),
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

// ── Magic-link / OTP single-use tokens ──────────────────────────────────────
//
// Token is generated server-side (32 random bytes, base64url) and only the
// SHA-256 hash is stored. `usedAt` is set on first verify to prevent replay.
// `attempts` tracks failed verifies for OTP-style flows; rate-limited at the
// service layer. Purpose distinguishes a passwordless sign-in from an invite
// acceptance flow (both share token storage but invoke different handlers).

export const authMagicLinks = userManagementSchema.table(
  'magic_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    userId: varchar('user_id', { length: 255 }),
    organizationId: uuid('organization_id'),
    purpose: varchar('purpose', { length: 32 }).notNull().default('login'),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    consumedIp: varchar('consumed_ip', { length: 45 }),
    requestedIp: varchar('requested_ip', { length: 45 }),
    requestedUserAgent: text('requested_user_agent'),
    attempts: integer('attempts').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    checkExpiry: check(
      'magic_link_valid_expiry',
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    checkPurpose: check(
      'magic_link_valid_purpose',
      sql`${table.purpose} IN ('login','invite','verify_email')`,
    ),
  }),
)

// ── Org membership invites ──────────────────────────────────────────────────
//
// Separate from magic_links because invites carry an org+role assignment that
// must survive past the token's lifecycle for audit. Token storage is still
// hashed-at-rest and single-use.

export const authInvites = userManagementSchema.table(
  'invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    organizationId: uuid('organization_id').notNull(),
    role: varchar('role', { length: 50 }).notNull().default('member'),
    tokenHash: text('token_hash').notNull().unique(),
    invitedBy: varchar('invited_by', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedUserId: varchar('accepted_user_id', { length: 255 }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    checkExpiry: check(
      'invite_valid_expiry',
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  }),
)

// ── Per-org auth policy ─────────────────────────────────────────────────────
//
// Controls which auth methods are accepted for a given organization.
// Rows are upsert-only; if no row exists, the platform-wide defaults apply
// (all methods allowed, nothing required). Tightening policy is an admin
// action and is itself audit-logged (via auth_audit_log).

export const authOrgPolicies = userManagementSchema.table('org_auth_policies', {
  organizationId: uuid('organization_id').primaryKey(),
  allowLocalAuth: boolean('allow_local_auth').notNull().default(true),
  allowMagicLink: boolean('allow_magic_link').notNull().default(true),
  allowSso: boolean('allow_sso').notNull().default(true),
  requireSso: boolean('require_sso').notNull().default(false),
  requireInvite: boolean('require_invite').notNull().default(false),
  passwordResetAllowed: boolean('password_reset_allowed')
    .notNull()
    .default(true),
  allowedEmailDomains: jsonb('allowed_email_domains').default(sql`'[]'::jsonb`),
  /** Roles for which MFA is mandatory. Array of role strings. */
  mfaRequiredForRoles: jsonb('mfa_required_for_roles').default(sql`'[]'::jsonb`),
  ssoProviderId: uuid('sso_provider_id'),
  updatedBy: varchar('updated_by', { length: 255 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Type Exports (new) ──────────────────────────────────────────────────────

export type AuthMagicLink = typeof authMagicLinks.$inferSelect
export type NewAuthMagicLink = typeof authMagicLinks.$inferInsert
export type AuthInvite = typeof authInvites.$inferSelect
export type NewAuthInvite = typeof authInvites.$inferInsert
export type AuthOrgPolicy = typeof authOrgPolicies.$inferSelect
export type NewAuthOrgPolicy = typeof authOrgPolicies.$inferInsert

// ── MFA (TOTP) ──────────────────────────────────────────────────────────────
//
// One row per user who has enrolled. `secretEncrypted` is the base32 TOTP
// secret encrypted at rest (AES-256-GCM, key from env). Recovery codes are
// SHA-256-hashed individually. Enrollment is two-step: insert with
// `enabledAt=null`, then user verifies a code once and we set `enabledAt`.

export const authMfaTotp = userManagementSchema.table('mfa_totp', {
  userId: varchar('user_id', { length: 255 }).primaryKey(),
  secretEncrypted: text('secret_encrypted').notNull(),
  recoveryCodesHashed: jsonb('recovery_codes_hashed').default(sql`'[]'::jsonb`),
  enabledAt: timestamp('enabled_at', { withTimezone: true }),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ── MFA step-up challenges ──────────────────────────────────────────────────
//
// When a user passes password check but has MFA enrolled, we mint a short-
// lived (5 min) challenge row and return its raw token to the client. The
// client re-submits the TOTP code with the challenge token; we verify both
// and only then mint the session cookie. No session is ever issued without
// completing this step.

export const authMfaChallenges = userManagementSchema.table('mfa_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  method: varchar('method', { length: 20 }).notNull().default('totp'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  attempts: integer('attempts').default(0),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  // Pre-session data we need to carry across the challenge
  pendingIp: varchar('pending_ip', { length: 45 }),
  pendingUserAgent: text('pending_user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Policy: MFA enforcement ─────────────────────────────────────────────────
//
// Extends `org_auth_policies` semantics. Stored in the same policy table as
// a jsonb column addressed via SQL — but we model it as a dedicated column
// for type-safety. Empty array = MFA optional for everyone. Any role listed
// means members with that role MUST complete MFA (and enrollment is forced
// on next login if they have not yet enrolled).

export type MfaTotpRow = typeof authMfaTotp.$inferSelect
export type NewMfaTotp = typeof authMfaTotp.$inferInsert
export type MfaChallenge = typeof authMfaChallenges.$inferSelect
export type NewMfaChallenge = typeof authMfaChallenges.$inferInsert
