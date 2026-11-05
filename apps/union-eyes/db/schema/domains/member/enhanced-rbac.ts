/**
 * Enhanced RBAC (UE-CONV-H-010): multi-role assignments with scope and term, permission exceptions, and a hash-chained audit log of permission checks.
 *
 * The query module db/queries/enhanced-rbac-queries.ts and the wrappers in lib/api-auth-guard.ts and lib/enterprise-role-middleware.ts were written against
 * these four relations, but nothing declared or created them, so every call failed with "relation does not exist". They are declared here and created by
 * platform migration 0075; the system roles are seeded from the code catalog (lib/auth/roles.ts) by 0076, and a test holds the two equal.
 *
 *   role_definitions     the catalog of roles: level, permissions, term and election rules. Global reference data (no tenant column): a role means the same thing
 *                        in every organization.
 *   member_roles         one row per role a member holds in an organization, with scope (global, department, ...), term and approval. Tenant data.
 *   permission_exceptions a time- and use-limited grant of one permission to one member, approved by someone and revocable. Tenant data.
 *   rbac_audit_log       append-only evidence of every permission decision, chained by SHA-256 per organization. Evidence carries identifiers, not foreign keys.
 *
 * Identity strings (who approved, who suspended) are values, not keys (see IDENTITY_REFERENCE_PARENTS in scripts/runtime/schema-convergence.ts); the member a
 * role is held by is a row of organization_members, so that one is a key.
 */
import { bigint, boolean, check, date, foreignKey, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizationMembers, organizations } from '../../../schema-organizations';

// ============================================================================
// ROLE DEFINITIONS (global catalog)
// ============================================================================

export const roleDefinitions = pgTable(
  'role_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roleCode: varchar('role_code', { length: 100 }).notNull().unique(),
    roleName: varchar('role_name', { length: 255 }).notNull(),
    roleDescription: text('role_description'),
    roleLevel: integer('role_level').notNull(),
    isElected: boolean('is_elected').notNull().default(false),
    requiresBoardApproval: boolean('requires_board_approval').notNull().default(false),
    defaultTermYears: integer('default_term_years'),
    canDelegate: boolean('can_delegate').notNull().default(false),
    canHaveMultipleHolders: boolean('can_have_multiple_holders').notNull().default(true),
    parentRoleCode: varchar('parent_role_code', { length: 100 }),
    permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
    isSystemRole: boolean('is_system_role').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    parentRoleFk: foreignKey({ name: 'role_definitions_parent_role_code_fk', columns: [table.parentRoleCode], foreignColumns: [table.roleCode] }).onDelete('set null'),
    levelIdx: index('idx_role_definitions_level').on(table.roleLevel),
    levelCheck: check('role_definitions_level_nonnegative', sql`role_level >= 0`),
    termCheck: check('role_definitions_default_term_positive', sql`default_term_years IS NULL OR default_term_years > 0`),
    permissionsCheck: check('role_definitions_permissions_array', sql`jsonb_typeof(permissions) = 'array'`),
  }),
);

// ============================================================================
// MEMBER ROLES (tenant)
// ============================================================================

export const memberRoles = pgTable(
  'member_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => organizationMembers.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    roleCode: varchar('role_code', { length: 100 })
      .notNull()
      .references(() => roleDefinitions.roleCode, { onDelete: 'restrict' }),
    scopeType: varchar('scope_type', { length: 50 }).notNull().default('global'),
    scopeValue: varchar('scope_value', { length: 255 }),
    startDate: date('start_date', { mode: 'date' }).notNull().default(sql`CURRENT_DATE`),
    endDate: date('end_date', { mode: 'date' }),
    termYears: integer('term_years'),
    nextElectionDate: date('next_election_date', { mode: 'date' }),
    assignmentType: varchar('assignment_type', { length: 20 }).notNull().default('appointed'),
    electionDate: date('election_date', { mode: 'date' }),
    electedBy: text('elected_by'),
    voteCount: integer('vote_count'),
    totalVotes: integer('total_votes'),
    votePercentage: numeric('vote_percentage', { precision: 5, scale: 2 }),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    suspensionReason: text('suspension_reason'),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    suspendedBy: text('suspended_by'),
    isActingRole: boolean('is_acting_role').notNull().default(false),
    actingForMemberId: uuid('acting_for_member_id').references(() => organizationMembers.id, { onDelete: 'set null' }),
    actingReason: text('acting_reason'),
    actingStartDate: date('acting_start_date', { mode: 'date' }),
    actingEndDate: date('acting_end_date', { mode: 'date' }),
    requiresApproval: boolean('requires_approval').notNull().default(false),
    approvedBy: text('approved_by'),
    approvalDate: timestamp('approval_date', { withTimezone: true }),
    approvalNotes: text('approval_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    // A member holds a role in a scope once at a time: a live row (active, awaiting approval or suspended) is unique.
    liveAssignmentUq: uniqueIndex('uq_member_roles_live_assignment')
      .on(table.memberId, table.roleCode, table.scopeType, sql`(coalesce(scope_value, ''))`)
      .where(sql`status IN ('active', 'pending_approval', 'suspended')`),
    memberOrganizationIdx: index('idx_member_roles_member_organization').on(table.memberId, table.organizationId),
    organizationStatusIdx: index('idx_member_roles_organization_status').on(table.organizationId, table.status),
    roleCodeIdx: index('idx_member_roles_role_code').on(table.roleCode),
    endDateIdx: index('idx_member_roles_end_date').on(table.endDate).where(sql`end_date IS NOT NULL`),
    nextElectionIdx: index('idx_member_roles_next_election').on(table.nextElectionDate).where(sql`next_election_date IS NOT NULL`),
    assignmentTypeCheck: check('member_roles_assignment_type_valid', sql`assignment_type IN ('elected', 'appointed', 'acting', 'emergency')`),
    statusCheck: check('member_roles_status_valid', sql`status IN ('active', 'expired', 'suspended', 'pending_approval')`),
    termOrderCheck: check('member_roles_end_after_start', sql`end_date IS NULL OR end_date >= start_date`),
    actingOrderCheck: check('member_roles_acting_end_after_start', sql`acting_end_date IS NULL OR acting_start_date IS NULL OR acting_end_date >= acting_start_date`),
    termYearsCheck: check('member_roles_term_years_positive', sql`term_years IS NULL OR term_years > 0`),
    votesCheck: check('member_roles_votes_consistent', sql`(vote_count IS NULL OR vote_count >= 0) AND (total_votes IS NULL OR total_votes >= COALESCE(vote_count, 0))`),
    votePercentageCheck: check('member_roles_vote_percentage_range', sql`vote_percentage IS NULL OR (vote_percentage >= 0 AND vote_percentage <= 100)`),
    // A role that needs approval is not active until someone has approved it.
    approvalRecordedCheck: check('member_roles_approval_recorded', sql`NOT (status = 'active' AND requires_approval AND approved_by IS NULL)`),
  }),
);

// ============================================================================
// PERMISSION EXCEPTIONS (tenant)
// ============================================================================

export const permissionExceptions = pgTable(
  'permission_exceptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => organizationMembers.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    permission: varchar('permission', { length: 150 }).notNull(),
    resourceType: varchar('resource_type', { length: 100 }).notNull(),
    resourceId: varchar('resource_id', { length: 255 }),
    reason: text('reason').notNull(),
    approvedBy: text('approved_by').notNull(),
    approvalDate: timestamp('approval_date', { withTimezone: true }).notNull().defaultNow(),
    approvalNotes: text('approval_notes'),
    effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: text('revoked_by'),
    revocationReason: text('revocation_reason'),
    usageCount: integer('usage_count').notNull().default(0),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    usageLimit: integer('usage_limit'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    memberOrganizationIdx: index('idx_permission_exceptions_member_organization').on(table.memberId, table.organizationId).where(sql`is_active`),
    organizationPermissionIdx: index('idx_permission_exceptions_organization_permission').on(table.organizationId, table.permission),
    usageCountCheck: check('permission_exceptions_usage_count_nonnegative', sql`usage_count >= 0`),
    usageLimitCheck: check('permission_exceptions_usage_limit_positive', sql`usage_limit IS NULL OR usage_limit > 0`),
    expiryCheck: check('permission_exceptions_expires_after_effective', sql`expires_at IS NULL OR expires_at > effective_date`),
    revocationCheck: check('permission_exceptions_revocation_consistent', sql`revoked_at IS NULL OR NOT is_active`),
  }),
);

// ============================================================================
// RBAC AUDIT LOG (tenant evidence, append-only)
// ============================================================================

export const rbacAuditLog = pgTable(
  'rbac_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // The order of the chain: assigned by the database as the entry is written (the writer holds a per-organization lock), so it is the order the hashes were linked in.
    sequenceNumber: bigint('sequence_number', { mode: 'number' }).generatedAlwaysAsIdentity(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
    actorId: text('actor_id').notNull(),
    actorName: text('actor_name'),
    actorRole: text('actor_role'),
    onBehalfOfId: text('on_behalf_of_id'),
    onBehalfOfName: text('on_behalf_of_name'),
    action: text('action').notNull(),
    actionCategory: text('action_category'),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    resourceDescription: text('resource_description'),
    organizationId: uuid('organization_id').notNull(),
    organizationName: text('organization_name'),
    requiredPermission: text('required_permission'),
    granted: boolean('granted').notNull(),
    grantMethod: text('grant_method'),
    denialReason: text('denial_reason'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    sessionId: text('session_id'),
    requestId: text('request_id'),
    oldValues: jsonb('old_values'),
    newValues: jsonb('new_values'),
    changedFields: text('changed_fields').array(),
    recordHash: varchar('record_hash', { length: 128 }).notNull(),
    previousHash: varchar('previous_hash', { length: 128 }),
    executionTimeMs: integer('execution_time_ms'),
    isSensitive: boolean('is_sensitive').notNull().default(false),
    requiresReview: boolean('requires_review').notNull().default(false),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: text('reviewed_by'),
    reviewNotes: text('review_notes'),
  },
  (table) => ({
    organizationSequenceIdx: index('idx_rbac_audit_log_organization_sequence').on(table.organizationId, table.sequenceNumber),
    organizationTimestampIdx: index('idx_rbac_audit_log_organization_timestamp').on(table.organizationId, table.timestamp),
    actorIdx: index('idx_rbac_audit_log_actor').on(table.organizationId, table.actorId, table.timestamp),
    resourceIdx: index('idx_rbac_audit_log_resource').on(table.organizationId, table.resourceType, table.resourceId),
    deniedIdx: index('idx_rbac_audit_log_denied').on(table.organizationId, table.timestamp).where(sql`NOT granted`),
    reviewIdx: index('idx_rbac_audit_log_pending_review').on(table.organizationId, table.timestamp).where(sql`requires_review AND reviewed_at IS NULL`),
    recordHashUq: uniqueIndex('uq_rbac_audit_log_record_hash').on(table.organizationId, table.recordHash),
    reviewedCheck: check('rbac_audit_log_review_consistent', sql`(reviewed_at IS NULL) = (reviewed_by IS NULL)`),
  }),
);

export type RoleDefinitionRow = typeof roleDefinitions.$inferSelect;
export type NewRoleDefinitionRow = typeof roleDefinitions.$inferInsert;
export type MemberRoleRow = typeof memberRoles.$inferSelect;
export type NewMemberRoleRow = typeof memberRoles.$inferInsert;
export type PermissionExceptionRow = typeof permissionExceptions.$inferSelect;
export type NewPermissionExceptionRow = typeof permissionExceptions.$inferInsert;
export type RbacAuditLogRow = typeof rbacAuditLog.$inferSelect;
export type NewRbacAuditLogRow = typeof rbacAuditLog.$inferInsert;
