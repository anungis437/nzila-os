/**
 * NzilaOS-owned identity, membership, and application permission authority.
 *
 * Product-specific user and membership records remain compatibility or domain
 * projections; they are not queried by the canonical authorization resolver.
 */
import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { authUsers } from './auth'
import { orgs } from './orgs'

export const platformIdentityBindings = pgTable(
  'platform_identity_bindings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: varchar('provider', { length: 80 }).notNull(),
    providerSubject: varchar('provider_subject', { length: 512 }).notNull(),
    platformUserId: varchar('platform_user_id', { length: 255 })
      .notNull()
      .references(() => authUsers.userId, { onDelete: 'restrict' }),
    state: varchar('state', { length: 16 }).notNull().default('active'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull(),
    provisionedBy: varchar('provisioned_by', { length: 255 }).notNull(),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    disabledBy: varchar('disabled_by', { length: 255 }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: varchar('revoked_by', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    providerSubjectUnique: uniqueIndex('platform_identity_provider_subject_uidx').on(
      table.provider,
      table.providerSubject,
    ),
    userIndex: index('platform_identity_user_idx').on(table.platformUserId),
    providerCheck: check(
      'platform_identity_provider_ck',
      sql`${table.provider} = lower(btrim(${table.provider})) AND length(btrim(${table.provider})) > 0`,
    ),
    subjectCheck: check(
      'platform_identity_subject_ck',
      sql`length(btrim(${table.providerSubject})) > 0`,
    ),
    stateCheck: check(
      'platform_identity_state_ck',
      sql`${table.state} IN ('active', 'disabled', 'revoked')`,
    ),
  }),
)

export const platformOrganizationMemberships = pgTable(
  'platform_organization_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platformUserId: varchar('platform_user_id', { length: 255 })
      .notNull()
      .references(() => authUsers.userId, { onDelete: 'restrict' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'restrict' }),
    role: varchar('role', { length: 80 }).notNull(),
    state: varchar('state', { length: 16 }).notNull(),
    provisioningSource: varchar('provisioning_source', { length: 120 }).notNull(),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    updatedBy: varchar('updated_by', { length: 255 }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: varchar('revoked_by', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userOrganizationUnique: uniqueIndex('platform_org_membership_user_org_uidx').on(
      table.platformUserId,
      table.organizationId,
    ),
    idOrganizationUnique: uniqueIndex('platform_org_membership_id_org_uidx').on(
      table.id,
      table.organizationId,
    ),
    userStateIndex: index('platform_org_membership_user_state_idx').on(
      table.platformUserId,
      table.state,
    ),
    stateCheck: check(
      'platform_org_membership_state_ck',
      sql`${table.state} IN ('active', 'invited', 'suspended', 'revoked')`,
    ),
    effectivePeriodCheck: check(
      'platform_org_membership_effective_period_ck',
      sql`${table.effectiveTo} IS NULL OR ${table.effectiveTo} > ${table.effectiveFrom}`,
    ),
    roleCheck: check('platform_org_membership_role_ck', sql`length(btrim(${table.role})) > 0`),
    sourceCheck: check(
      'platform_org_membership_source_ck',
      sql`length(btrim(${table.provisioningSource})) > 0`,
    ),
  }),
)

export const platformApplicationPermissionGrants = pgTable(
  'platform_application_permission_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    membershipId: uuid('membership_id').notNull(),
    organizationId: uuid('organization_id').notNull(),
    applicationId: varchar('application_id', { length: 80 }).notNull(),
    permission: varchar('permission', { length: 180 }).notNull(),
    state: varchar('state', { length: 16 }).notNull().default('active'),
    grantSource: varchar('grant_source', { length: 120 }).notNull(),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    grantedBy: varchar('granted_by', { length: 255 }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: varchar('revoked_by', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    membershipForeignKey: foreignKey({
      columns: [table.membershipId, table.organizationId],
      foreignColumns: [
        platformOrganizationMemberships.id,
        platformOrganizationMemberships.organizationId,
      ],
      name: 'platform_permission_membership_fk',
    }).onDelete('restrict'),
    membershipAppPermissionUnique: uniqueIndex('platform_permission_membership_app_permission_uidx')
      .on(table.membershipId, table.applicationId, table.permission)
      .where(sql`${table.state} = 'active'`),
    organizationAppStateIndex: index('platform_permission_org_app_state_idx').on(
      table.organizationId,
      table.applicationId,
      table.state,
    ),
    stateCheck: check('platform_permission_state_ck', sql`${table.state} IN ('active', 'revoked')`),
    appIdCheck: check(
      'platform_permission_app_id_ck',
      sql`${table.applicationId} = lower(btrim(${table.applicationId})) AND length(btrim(${table.applicationId})) > 0`,
    ),
    appScopeCheck: check(
      'platform_permission_app_scope_ck',
      sql`${table.permission} LIKE ${table.applicationId} || ':%' AND ${table.permission} NOT LIKE '%*%'`,
    ),
    effectivePeriodCheck: check(
      'platform_permission_effective_period_ck',
      sql`${table.expiresAt} IS NULL OR ${table.expiresAt} > ${table.effectiveFrom}`,
    ),
    sourceCheck: check(
      'platform_permission_source_ck',
      sql`length(btrim(${table.grantSource})) > 0`,
    ),
  }),
)

export type PlatformIdentityBinding = typeof platformIdentityBindings.$inferSelect
export type PlatformOrganizationMembership = typeof platformOrganizationMemberships.$inferSelect
export type PlatformApplicationPermissionGrant =
  typeof platformApplicationPermissionGrants.$inferSelect
