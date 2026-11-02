/**
 * Enhanced RBAC database queries (UE-CONV-H-010)
 *
 * Multi-role assignments with scope and term, permission exceptions, and a hash-chained audit log of permission checks, over the relations declared in
 * db/schema/domains/member/enhanced-rbac.ts (role_definitions, member_roles, permission_exceptions, rbac_audit_log).
 *
 * How it is held together:
 *   - Reads of an organization's roles, exceptions and audit trail run as the tenant runtime role under organization row security (withRLSContext); the runtime role holds SELECT
 *     only on these relations. The role catalog (role_definitions) is global reference data, read and written under withSystemRLSContext.
 *   - Every write runs under withSystemRLSContext and names the organization it means: assigning a role, granting an exception, writing an audit entry are
 *     privileged acts, and authorization state must not change through a tenant-scoped connection.
 *   - A raw `SELECT *` returns column names (snake_case); every row is mapped to the camelCase interfaces below at this boundary, so a caller reading
 *     `role.scopeType` reads a value.
 *   - A member id that is not an organization_members row (the guard uses 'auth-org:<id>' and 'platform-admin' for platform contexts) holds no role rows: the
 *     reads answer "none" without touching the database.
 *   - The audit log is a SHA-256 chain per organization. The writer holds a per-organization advisory lock, so the order the hashes were linked in is the order of the
 *     identity column; verifyAuditLogIntegrity recomputes every hash from the stored columns, so an edited row, not only a broken link, is found.
 */
import { createHash, randomUUID } from 'node:crypto';
import { sql, type SQL } from 'drizzle-orm';
import { withRLSContext, withSystemRLSContext } from '@/lib/db/with-rls-context';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

/** Row shape returned by raw `tx.execute(sql`...`)` queries. */
type SqlRow = Record<string, unknown>;

export interface RoleDefinition {
  id: string;
  roleCode: string;
  roleName: string;
  roleDescription?: string;
  roleLevel: number;
  isElected: boolean;
  requiresBoardApproval: boolean;
  defaultTermYears?: number;
  canDelegate: boolean;
  canHaveMultipleHolders: boolean;
  parentRoleCode?: string;
  permissions: string[];
  isSystemRole: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberRole {
  id: string;
  memberId: string;
  organizationId: string;
  roleCode: string;
  scopeType: string;
  scopeValue?: string;
  startDate: Date;
  endDate?: Date;
  termYears?: number;
  nextElectionDate?: Date;
  assignmentType: 'elected' | 'appointed' | 'acting' | 'emergency';
  electionDate?: Date;
  electedBy?: string;
  voteCount?: number;
  totalVotes?: number;
  votePercentage?: number;
  status: 'active' | 'expired' | 'suspended' | 'pending_approval';
  suspensionReason?: string;
  suspendedAt?: Date;
  suspendedBy?: string;
  isActingRole: boolean;
  actingForMemberId?: string;
  actingReason?: string;
  actingStartDate?: Date;
  actingEndDate?: Date;
  requiresApproval: boolean;
  approvedBy?: string;
  approvalDate?: Date;
  approvalNotes?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}

export interface MemberRoleWithDetails extends MemberRole {
  memberName: string;
  memberEmail: string;
  roleName: string;
  roleLevel: number;
  permissions: string[];
  isElected: boolean;
  termStatus: 'indefinite' | 'expired' | 'expiring_soon' | 'active';
}

export interface PermissionException {
  id: string;
  memberId: string;
  organizationId: string;
  permission: string;
  resourceType: string;
  resourceId?: string;
  reason: string;
  approvedBy: string;
  approvalDate: Date;
  approvalNotes?: string;
  effectiveDate: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  revokedBy?: string;
  revocationReason?: string;
  usageCount: number;
  lastUsedAt?: Date;
  usageLimit?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogEntry {
  id: string;
  sequenceNumber: number;
  timestamp: Date;
  actorId: string;
  actorName?: string;
  actorRole?: string;
  onBehalfOfId?: string;
  onBehalfOfName?: string;
  action: string;
  actionCategory?: string;
  resourceType: string;
  resourceId?: string;
  resourceDescription?: string;
  organizationId: string;
  organizationName?: string;
  requiredPermission?: string;
  granted: boolean;
  grantMethod?: string;
  denialReason?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  oldValues?: unknown;
  newValues?: unknown;
  changedFields?: string[];
  recordHash: string;
  previousHash?: string;
  executionTimeMs?: number;
  isSensitive: boolean;
  requiresReview: boolean;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
}

export interface PermissionCheckEntry {
  actorId: string;
  actorName?: string;
  actorRole?: string;
  onBehalfOfId?: string;
  onBehalfOfName?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  organizationId: string;
  organizationName?: string;
  requiredPermission?: string;
  granted: boolean;
  grantMethod?: string;
  denialReason?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  executionTimeMs?: number;
  isSensitive?: boolean;
}

// ============================================================================
// ROW MAPPING AND GUARDS
// ============================================================================

const MEMBER_ROW_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for an organization_members id. The guard's platform contexts ('auth-org:<id>', 'platform-admin') are not members and hold no role rows. */
export function isMemberRowId(value: string): boolean {
  return MEMBER_ROW_ID.test(value);
}

const toCamel = (key: string): string => key.replace(/_([a-z0-9])/g, (_match, ch: string) => ch.toUpperCase());

// The application's client is drizzle over postgres.js. It sends a raw template parameter as it is given (drizzle relies on column encoders, so a Date reaches the
// wire unserialized and the driver throws), and it returns timestamps and dates as the server's text. So a Date is sent as ISO text (the statement casts it), and a
// temporal column is turned back into a Date at the row boundary, where the interfaces below say Date.
const isoTime = (value: Date | null | undefined): string | null => (value ? value.toISOString() : null);
/** The UTC calendar day of the instant, for a date column. */
const isoDate = (value: Date | null | undefined): string | null => (value ? value.toISOString().slice(0, 10) : null);

/** numeric and bigint columns arrive from the driver as strings; the interfaces type them as numbers (a sequence number stays far below 2^53). */
const NUMBER_COLUMNS: ReadonlySet<string> = new Set(['vote_percentage', 'sequence_number']);

const TEMPORAL_COLUMNS: ReadonlySet<string> = new Set([
  'created_at', 'updated_at', 'start_date', 'end_date', 'next_election_date', 'election_date', 'suspended_at', 'acting_start_date', 'acting_end_date', 'approval_date',
  'effective_date', 'expires_at', 'revoked_at', 'last_used_at', 'timestamp', 'reviewed_at',
]);

/** "2026-11-02 18:44:12.531112+00" or "2026-11-02" (the server's text) to a Date; a value that is already a Date, or is not a date, is returned as it is. */
function toDate(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'));
  return Number.isNaN(date.getTime()) ? value : date;
}

/** A raw row has the table's column names; the interfaces above are camelCase. */
export function camelRow<T>(row: SqlRow): T {
  const mapped: SqlRow = {};
  for (const [key, value] of Object.entries(row)) {
    mapped[toCamel(key)] = NUMBER_COLUMNS.has(key) && typeof value === 'string' ? Number(value) : TEMPORAL_COLUMNS.has(key) ? toDate(value) : value;
  }
  return mapped as T;
}

const camelRows = <T>(rows: Iterable<SqlRow>): T[] => Array.from(rows, (row) => camelRow<T>(row));

function firstRow<T>(rows: Iterable<SqlRow>): T | null {
  for (const row of rows) return camelRow<T>(row);
  return null;
}

/** A role row counts while it is active, has begun, has not ended, and (when acting) is inside its acting window. */
const ACTIVE_ROLE = sql`mr.status = 'active'
  AND mr.start_date <= CURRENT_DATE
  AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
  AND (NOT mr.is_acting_role OR (
        (mr.acting_start_date IS NULL OR mr.acting_start_date <= CURRENT_DATE)
    AND (mr.acting_end_date IS NULL OR mr.acting_end_date >= CURRENT_DATE)))`;

/** A role row with what a caller needs about the member and the role (the roles an organization holds, with names, level and permissions). */
const ROLE_DETAILS = sql`SELECT mr.*, om.name AS member_name, om.email AS member_email,
       rd.role_name, rd.role_level, rd.permissions, rd.is_elected,
       CASE WHEN mr.end_date IS NULL THEN 'indefinite'
            WHEN mr.end_date < CURRENT_DATE THEN 'expired'
            WHEN mr.end_date <= CURRENT_DATE + 90 THEN 'expiring_soon'
            ELSE 'active' END AS term_status
  FROM member_roles mr
  JOIN role_definitions rd ON rd.role_code = mr.role_code AND rd.is_active
  JOIN organization_members om ON om.id = mr.member_id`;

const ROLE_CODE = /^[a-z][a-z0-9_]{1,99}$/;

// ============================================================================
// ROLE DEFINITIONS QUERIES
// ============================================================================

/**
 * Get all active role definitions
 */
export async function getAllRoleDefinitions(): Promise<RoleDefinition[]> {
  const result = await withSystemRLSContext('system-query: role-definitions', async (tx) => tx.execute(sql`
    SELECT * FROM role_definitions
    WHERE is_active = TRUE
    ORDER BY role_level DESC, role_code
  `));
  return camelRows<RoleDefinition>(result);
}

/**
 * Get role definition by code
 */
export async function getRoleDefinitionByCode(roleCode: string): Promise<RoleDefinition | null> {
  const result = await withSystemRLSContext('system-query: role-definitions', async (tx) => tx.execute(sql`
    SELECT * FROM role_definitions
    WHERE role_code = ${roleCode} AND is_active = TRUE
  `));
  return firstRow<RoleDefinition>(result);
}

/**
 * Get role definitions by level (at or above specified level)
 */
export async function getRoleDefinitionsByLevel(minLevel: number): Promise<RoleDefinition[]> {
  const result = await withSystemRLSContext('system-query: role-definitions', async (tx) => tx.execute(sql`
    SELECT * FROM role_definitions
    WHERE role_level >= ${minLevel} AND is_active = TRUE
    ORDER BY role_level DESC, role_code
  `));
  return camelRows<RoleDefinition>(result);
}

/**
 * Create a custom role definition. The system roles come from the code catalog (platform 0076) and are not created here.
 */
export async function createRoleDefinition(
  roleCode: string,
  roleName: string,
  roleLevel: number,
  permissions: string[],
  options: {
    description?: string;
    isElected?: boolean;
    requiresBoardApproval?: boolean;
    defaultTermYears?: number;
    canDelegate?: boolean;
    canHaveMultipleHolders?: boolean;
    parentRoleCode?: string;
    createdBy?: string;
  } = {}
): Promise<RoleDefinition> {
  if (!ROLE_CODE.test(roleCode)) throw new Error(`role code must be lowercase snake_case (2 to 100 characters): ${roleCode}`);
  if (!Number.isInteger(roleLevel) || roleLevel < 0) throw new Error('role level must be a non-negative integer');
  if (!Array.isArray(permissions) || permissions.some((p) => typeof p !== 'string' || p.length === 0)) throw new Error('permissions must be a list of non-empty strings');
  const result = await withSystemRLSContext('system-query: role-definitions', async (tx) => tx.execute(sql`
    INSERT INTO role_definitions (
      role_code, role_name, role_description, role_level,
      is_elected, requires_board_approval, default_term_years,
      can_delegate, can_have_multiple_holders, parent_role_code, permissions, created_by, is_system_role
    ) VALUES (
      ${roleCode}, ${roleName}, ${options.description ?? null}, ${roleLevel},
      ${options.isElected ?? false}, ${options.requiresBoardApproval ?? false},
      ${options.defaultTermYears ?? null}, ${options.canDelegate ?? false}, ${options.canHaveMultipleHolders ?? true},
      ${options.parentRoleCode ?? null}, ${JSON.stringify([...new Set(permissions)].sort())}::jsonb,
      ${options.createdBy ?? null}, FALSE
    )
    RETURNING *
  `));
  return firstRow<RoleDefinition>(result) as RoleDefinition;
}

// ============================================================================
// MEMBER ROLES QUERIES
// ============================================================================

/**
 * Get all active roles for a member in an organization
 */
export async function getMemberRoles(
  memberId: string,
  organizationId: string
): Promise<MemberRoleWithDetails[]> {
  if (!isMemberRowId(memberId)) return [];
  const result = await withRLSContext(async (tx) => tx.execute(sql`
    ${ROLE_DETAILS}
    WHERE mr.member_id = ${memberId}
      AND mr.organization_id = ${organizationId}
      AND ${ACTIVE_ROLE}
    ORDER BY rd.role_level DESC, mr.start_date, mr.id
  `));
  return camelRows<MemberRoleWithDetails>(result);
}

/**
 * Get member's highest role level
 */
export async function getMemberHighestRoleLevel(
  memberId: string,
  organizationId: string
): Promise<number> {
  if (!isMemberRowId(memberId)) return 0;
  const result = await withRLSContext(async (tx) => tx.execute(sql`
    SELECT COALESCE(MAX(rd.role_level), 0) AS max_level
    FROM member_roles mr
    JOIN role_definitions rd ON rd.role_code = mr.role_code AND rd.is_active
    WHERE mr.member_id = ${memberId}
      AND mr.organization_id = ${organizationId}
      AND ${ACTIVE_ROLE}
  `));
  return Number(Array.from(result)[0]?.max_level ?? 0);
}

/**
 * Get member's effective permissions (merged from all roles)
 */
export async function getMemberEffectivePermissions(
  memberId: string,
  organizationId: string
): Promise<string[]> {
  if (!isMemberRowId(memberId)) return [];
  const result = await withRLSContext(async (tx) => tx.execute(sql`
    SELECT DISTINCT jsonb_array_elements_text(rd.permissions) AS permission
    FROM member_roles mr
    JOIN role_definitions rd ON rd.role_code = mr.role_code AND rd.is_active
    WHERE mr.member_id = ${memberId}
      AND mr.organization_id = ${organizationId}
      AND ${ACTIVE_ROLE}
    ORDER BY permission
  `));
  return Array.from(result, (row: SqlRow) => String(row.permission));
}

/**
 * Check if member has specific role with optional scope
 */
export async function memberHasRole(
  memberId: string,
  organizationId: string,
  roleCode: string,
  scopeType?: string,
  scopeValue?: string
): Promise<boolean> {
  if (!isMemberRowId(memberId)) return false;
  const conditions: SQL[] = [
    sql`mr.member_id = ${memberId}`,
    sql`mr.organization_id = ${organizationId}`,
    sql`mr.role_code = ${roleCode}`,
    ACTIVE_ROLE,
  ];
  if (scopeType) conditions.push(sql`mr.scope_type = ${scopeType}`);
  if (scopeValue) conditions.push(sql`mr.scope_value = ${scopeValue}`);
  const result = await withRLSContext(async (tx) => tx.execute(sql`
    SELECT EXISTS(SELECT 1 FROM member_roles mr WHERE ${sql.join(conditions, sql` AND `)}) AS has_role
  `));
  return Boolean(Array.from(result)[0]?.has_role);
}

/**
 * Check if member has role at or above specified level
 */
export async function memberHasRoleLevel(
  memberId: string,
  organizationId: string,
  minLevel: number,
  scopeType?: string,
  scopeValue?: string
): Promise<boolean> {
  if (!isMemberRowId(memberId)) return false;
  const conditions: SQL[] = [
    sql`mr.member_id = ${memberId}`,
    sql`mr.organization_id = ${organizationId}`,
    sql`rd.role_level >= ${minLevel}`,
    ACTIVE_ROLE,
  ];
  if (scopeType) conditions.push(sql`(mr.scope_type = 'global' OR mr.scope_type = ${scopeType})`);
  if (scopeValue) conditions.push(sql`(mr.scope_type = 'global' OR mr.scope_value = ${scopeValue})`);
  const result = await withRLSContext(async (tx) => tx.execute(sql`
    SELECT EXISTS(
      SELECT 1 FROM member_roles mr JOIN role_definitions rd ON rd.role_code = mr.role_code AND rd.is_active
      WHERE ${sql.join(conditions, sql` AND `)}
    ) AS has_level
  `));
  return Boolean(Array.from(result)[0]?.has_level);
}

/**
 * Assign role to member. A role that requires approval starts as pending_approval and is not active until approveMemberRole.
 * The database refuses a member of another organization and a role that is not an active role of the catalog.
 */
export async function assignMemberRole(
  memberId: string,
  organizationId: string,
  roleCode: string,
  createdBy: string,
  options: {
    scopeType?: string;
    scopeValue?: string;
    startDate?: Date;
    endDate?: Date;
    termYears?: number;
    nextElectionDate?: Date;
    assignmentType?: 'elected' | 'appointed' | 'acting' | 'emergency';
    electionDate?: Date;
    electedBy?: string;
    voteCount?: number;
    totalVotes?: number;
    isActingRole?: boolean;
    actingForMemberId?: string;
    actingReason?: string;
    actingStartDate?: Date;
    actingEndDate?: Date;
    requiresApproval?: boolean;
  } = {}
): Promise<MemberRole> {
  if (!isMemberRowId(memberId)) throw new Error('a role can only be assigned to an organization member');
  const assignmentType = options.assignmentType ?? 'appointed';
  const scopeType = options.scopeType ?? 'global';
  const status = options.requiresApproval ? 'pending_approval' : 'active';

  // A start the caller does not name is the database's today: the term is read against CURRENT_DATE, so the same clock must start it.
  const result = await withSystemRLSContext('rbac: assign-member-role', async (tx) => tx.execute(sql`
    INSERT INTO member_roles (
      member_id, organization_id, role_code, scope_type, scope_value,
      start_date, end_date, term_years, next_election_date, assignment_type,
      election_date, elected_by, vote_count, total_votes, vote_percentage,
      is_acting_role, acting_for_member_id, acting_reason, acting_start_date, acting_end_date,
      requires_approval, status, created_by
    ) VALUES (
      ${memberId}, ${organizationId}, ${roleCode}, ${scopeType}, ${options.scopeValue ?? null},
      COALESCE(${isoDate(options.startDate)}::date, CURRENT_DATE), ${isoDate(options.endDate)}::date, ${options.termYears ?? null}, ${isoDate(options.nextElectionDate)}::date, ${assignmentType},
      ${isoDate(options.electionDate)}::date, ${options.electedBy ?? null},
      ${options.voteCount ?? null}, ${options.totalVotes ?? null},
      ${options.voteCount !== undefined && options.totalVotes ? Math.round((options.voteCount / options.totalVotes) * 10000) / 100 : null},
      ${options.isActingRole ?? false}, ${options.actingForMemberId ?? null},
      ${options.actingReason ?? null}, ${isoDate(options.actingStartDate)}::date, ${isoDate(options.actingEndDate)}::date,
      ${options.requiresApproval ?? false}, ${status}, ${createdBy}
    )
    RETURNING *
  `));
  return firstRow<MemberRole>(result) as MemberRole;
}

/**
 * Update member role
 */
export async function updateMemberRole(
  roleId: string,
  organizationId: string,
  updatedBy: string,
  updates: {
    endDate?: Date;
    status?: 'active' | 'expired' | 'suspended' | 'pending_approval';
    suspensionReason?: string;
    suspendedBy?: string;
  }
): Promise<MemberRole | null> {
  const setClauses: SQL[] = [];

  if (updates.endDate !== undefined) setClauses.push(sql`end_date = ${isoDate(updates.endDate)}::date`);
  if (updates.status) setClauses.push(sql`status = ${updates.status}`);
  if (updates.suspensionReason) {
    setClauses.push(sql`suspension_reason = ${updates.suspensionReason}`);
    setClauses.push(sql`suspended_at = NOW()`);
  }
  if (updates.suspendedBy) setClauses.push(sql`suspended_by = ${updates.suspendedBy}`);
  setClauses.push(sql`updated_by = ${updatedBy}`);
  setClauses.push(sql`updated_at = NOW()`);

  const result = await withSystemRLSContext('rbac: update-member-role', async (tx) => tx.execute(sql`
    UPDATE member_roles SET ${sql.join(setClauses, sql`, `)}
    WHERE id = ${roleId} AND organization_id = ${organizationId}
    RETURNING *
  `));
  return firstRow<MemberRole>(result);
}

/**
 * Approve a role that requires approval: it becomes active and the approval is on record.
 */
export async function approveMemberRole(
  roleId: string,
  organizationId: string,
  approvedBy: string,
  approvalNotes?: string
): Promise<MemberRole | null> {
  const result = await withSystemRLSContext('rbac: approve-member-role', async (tx) => tx.execute(sql`
    UPDATE member_roles
    SET status = 'active', approved_by = ${approvedBy}, approval_date = NOW(), approval_notes = ${approvalNotes ?? null},
        updated_by = ${approvedBy}, updated_at = NOW()
    WHERE id = ${roleId} AND organization_id = ${organizationId} AND status = 'pending_approval'
    RETURNING *
  `));
  return firstRow<MemberRole>(result);
}

/**
 * Revoke member role (set end date to today, or to its start date when it has not begun: a term never ends before it starts). The row stays as history.
 * Returns false when no such role is live in that organization.
 */
export async function revokeMemberRole(
  roleId: string,
  organizationId: string,
  revokedBy: string,
  reason?: string
): Promise<boolean> {
  const result = await withSystemRLSContext('rbac: revoke-member-role', async (tx) => tx.execute(sql`
    UPDATE member_roles
    SET end_date = GREATEST(CURRENT_DATE, start_date),
        status = 'expired',
        suspension_reason = ${reason ?? 'Role revoked'},
        suspended_by = ${revokedBy},
        suspended_at = NOW(),
        updated_by = ${revokedBy},
        updated_at = NOW()
    WHERE id = ${roleId} AND organization_id = ${organizationId} AND status IN ('active', 'pending_approval', 'suspended')
    RETURNING id
  `));
  return Array.from(result).length > 0;
}

/**
 * Get roles expiring within specified days
 */
export async function getExpiringRoles(
  organizationId: string,
  daysAhead: number = 90
): Promise<MemberRoleWithDetails[]> {
  const result = await withRLSContext(async (tx) => tx.execute(sql`
    ${ROLE_DETAILS}
    WHERE mr.organization_id = ${organizationId}
      AND ${ACTIVE_ROLE}
      AND mr.end_date IS NOT NULL
      AND mr.end_date <= CURRENT_DATE + ${daysAhead}::int
    ORDER BY mr.end_date, mr.id
  `));
  return camelRows<MemberRoleWithDetails>(result);
}

/**
 * Get upcoming elections: active roles whose next election falls inside the window
 */
export async function getUpcomingElections(
  organizationId: string,
  daysAhead: number = 180
): Promise<SqlRow[]> {
  const result = await withRLSContext(async (tx) => tx.execute(sql`
    SELECT mr.id, mr.member_id, mr.organization_id, mr.role_code, rd.role_name, mr.scope_type, mr.scope_value,
           mr.next_election_date, mr.end_date, om.name AS member_name
    FROM member_roles mr
    JOIN role_definitions rd ON rd.role_code = mr.role_code AND rd.is_active
    JOIN organization_members om ON om.id = mr.member_id
    WHERE mr.organization_id = ${organizationId}
      AND ${ACTIVE_ROLE}
      AND mr.next_election_date IS NOT NULL
      AND mr.next_election_date >= CURRENT_DATE
      AND mr.next_election_date <= CURRENT_DATE + ${daysAhead}::int
    ORDER BY mr.next_election_date, mr.id
  `));
  return camelRows<SqlRow>(result);
}

/**
 * Check and expire old terms (run periodically, across organizations)
 */
export async function expireOldTerms(): Promise<number> {
  const result = await withSystemRLSContext('rbac: expire-old-terms', async (tx) => tx.execute(sql`
    UPDATE member_roles
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active'
      AND end_date IS NOT NULL
      AND end_date < CURRENT_DATE
    RETURNING id
  `));
  return Array.from(result).length;
}

// ============================================================================
// PERMISSION EXCEPTIONS QUERIES
// ============================================================================

/** An exception counts while it is active, has begun, has not expired or been revoked, and still has uses left. */
const LIVE_EXCEPTION = sql`is_active = TRUE
  AND revoked_at IS NULL
  AND effective_date <= NOW()
  AND (expires_at IS NULL OR expires_at > NOW())
  AND (usage_limit IS NULL OR usage_count < usage_limit)`;

/**
 * Get active permission exceptions for member
 */
export async function getMemberPermissionExceptions(
  memberId: string,
  organizationId: string
): Promise<PermissionException[]> {
  if (!isMemberRowId(memberId)) return [];
  const result = await withRLSContext(async (tx) => tx.execute(sql`
    SELECT * FROM permission_exceptions
    WHERE member_id = ${memberId}
      AND organization_id = ${organizationId}
      AND ${LIVE_EXCEPTION}
    ORDER BY effective_date DESC, id
  `));
  return camelRows<PermissionException>(result);
}

/**
 * Check if member has permission exception
 */
export async function memberHasPermissionException(
  memberId: string,
  organizationId: string,
  permission: string,
  resourceType?: string,
  resourceId?: string
): Promise<boolean> {
  if (!isMemberRowId(memberId)) return false;
  const conditions: SQL[] = [
    sql`member_id = ${memberId}`,
    sql`organization_id = ${organizationId}`,
    sql`permission = ${permission}`,
    LIVE_EXCEPTION,
  ];
  if (resourceType) conditions.push(sql`resource_type = ${resourceType}`);
  if (resourceId) conditions.push(sql`(resource_id IS NULL OR resource_id = ${resourceId})`);
  const result = await withRLSContext(async (tx) => tx.execute(sql`
    SELECT EXISTS(SELECT 1 FROM permission_exceptions WHERE ${sql.join(conditions, sql` AND `)}) AS has_exception
  `));
  return Boolean(Array.from(result)[0]?.has_exception);
}

/**
 * Find the live permission exception that covers a permission (and, when given, a resource), or null. The oldest live one is used first.
 */
export async function findLivePermissionException(
  memberId: string,
  organizationId: string,
  permission: string,
  resourceType?: string,
  resourceId?: string
): Promise<string | null> {
  if (!isMemberRowId(memberId)) return null;
  const conditions: SQL[] = [
    sql`member_id = ${memberId}`,
    sql`organization_id = ${organizationId}`,
    sql`permission = ${permission}`,
    LIVE_EXCEPTION,
  ];
  if (resourceType) conditions.push(sql`resource_type = ${resourceType}`);
  if (resourceId) conditions.push(sql`(resource_id IS NULL OR resource_id = ${resourceId})`);
  const result = await withRLSContext(async (tx) => tx.execute(sql`
    SELECT id FROM permission_exceptions WHERE ${sql.join(conditions, sql` AND `)} ORDER BY effective_date, id LIMIT 1
  `));
  return (Array.from(result)[0]?.id as string | undefined) ?? null;
}

/**
 * Grant permission exception. The database refuses a member of another organization.
 */
export async function grantPermissionException(
  memberId: string,
  organizationId: string,
  permission: string,
  resourceType: string,
  reason: string,
  approvedBy: string,
  options: {
    resourceId?: string;
    approvalNotes?: string;
    effectiveDate?: Date;
    expiresAt?: Date;
    usageLimit?: number;
  } = {}
): Promise<PermissionException> {
  if (!isMemberRowId(memberId)) throw new Error('an exception can only be granted to an organization member');
  // An effective date the caller does not name is the database's now: it is read against NOW(), so the same clock must start it.
  const result = await withSystemRLSContext('rbac: grant-permission-exception', async (tx) => tx.execute(sql`
    INSERT INTO permission_exceptions (
      member_id, organization_id, permission, resource_type, resource_id,
      reason, approved_by, approval_notes, effective_date, expires_at, usage_limit
    ) VALUES (
      ${memberId}, ${organizationId}, ${permission}, ${resourceType}, ${options.resourceId ?? null},
      ${reason}, ${approvedBy}, ${options.approvalNotes ?? null},
      COALESCE(${isoTime(options.effectiveDate)}::timestamptz, NOW()), ${isoTime(options.expiresAt)}::timestamptz, ${options.usageLimit ?? null}
    )
    RETURNING *
  `));
  return firstRow<PermissionException>(result) as PermissionException;
}

/**
 * Revoke permission exception. Returns false when no such live exception exists in that organization.
 */
export async function revokePermissionException(
  exceptionId: string,
  organizationId: string,
  revokedBy: string,
  reason?: string
): Promise<boolean> {
  const result = await withSystemRLSContext('rbac: revoke-permission-exception', async (tx) => tx.execute(sql`
    UPDATE permission_exceptions
    SET revoked_at = NOW(),
        revoked_by = ${revokedBy},
        revocation_reason = ${reason ?? 'Exception revoked'},
        is_active = FALSE,
        updated_at = NOW()
    WHERE id = ${exceptionId} AND organization_id = ${organizationId} AND revoked_at IS NULL
    RETURNING id
  `));
  return Array.from(result).length > 0;
}

/**
 * Count one use of a permission exception. Returns false when the exception cannot be used (revoked, expired, not yet effective or
 * out of uses): the count never passes the limit, even when two requests use the last one together.
 */
export async function incrementExceptionUsage(exceptionId: string, organizationId: string): Promise<boolean> {
  const result = await withSystemRLSContext('rbac: count-permission-exception-use', async (tx) => tx.execute(sql`
    UPDATE permission_exceptions
    SET usage_count = usage_count + 1,
        last_used_at = NOW(),
        updated_at = NOW()
    WHERE id = ${exceptionId} AND organization_id = ${organizationId} AND ${LIVE_EXCEPTION}
    RETURNING id
  `));
  return Array.from(result).length > 0;
}

// ============================================================================
// AUDIT LOG QUERIES
// ============================================================================

export interface AuditHashFields {
  organizationId: string;
  timestamp: Date | string;
  actorId: string;
  onBehalfOfId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  requiredPermission?: string | null;
  granted: boolean;
  grantMethod?: string | null;
  denialReason?: string | null;
  requestId?: string | null;
  sessionId?: string | null;
}

/**
 * SHA-256 of the previous hash and the decision's identifying fields in a fixed order, so the same entry always has the same hash and any edit changes it.
 * The time is the entry's millisecond instant (the writer supplies it, so the stored value has no finer part); a timestamp read back as the server's text is parsed first.
 */
export function computeAuditRecordHash(previousHash: string | null | undefined, fields: AuditHashFields): string {
  const at = fields.timestamp instanceof Date ? fields.timestamp : toDate(fields.timestamp);
  const timestamp = at instanceof Date ? at.toISOString() : String(fields.timestamp);
  const canonical = JSON.stringify([
    previousHash ?? '',
    fields.organizationId,
    timestamp,
    fields.actorId,
    fields.onBehalfOfId ?? '',
    fields.action,
    fields.resourceType,
    fields.resourceId ?? '',
    fields.requiredPermission ?? '',
    fields.granted,
    fields.grantMethod ?? '',
    fields.denialReason ?? '',
    fields.requestId ?? '',
    fields.sessionId ?? '',
  ]);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Write one permission decision to the chain and return its id. The per-organization advisory lock makes the writes of one organization a line: each entry
 * names the hash of the one before it, and the identity column is the order they were linked in.
 */
export async function recordPermissionCheck(entry: PermissionCheckEntry): Promise<string> {
  return withSystemRLSContext('rbac-audit-log-insert', async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`rbac_audit_log:${entry.organizationId}`}, 0))`);
    const latest = await tx.execute(sql`
      SELECT record_hash FROM rbac_audit_log WHERE organization_id = ${entry.organizationId} ORDER BY sequence_number DESC LIMIT 1
    `);
    const previousHash = (Array.from(latest)[0]?.record_hash as string | undefined) ?? null;
    const id = randomUUID();
    const timestamp = new Date();
    const recordHash = computeAuditRecordHash(previousHash, {
      organizationId: entry.organizationId,
      timestamp,
      actorId: entry.actorId,
      onBehalfOfId: entry.onBehalfOfId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      requiredPermission: entry.requiredPermission,
      granted: entry.granted,
      grantMethod: entry.grantMethod,
      denialReason: entry.denialReason,
      requestId: entry.requestId,
      sessionId: entry.sessionId,
    });
    await tx.execute(sql`
      INSERT INTO rbac_audit_log (
        id, timestamp, actor_id, actor_name, actor_role, on_behalf_of_id, on_behalf_of_name, action, action_category,
        resource_type, resource_id, organization_id, organization_name,
        required_permission, granted, grant_method, denial_reason,
        ip_address, user_agent, session_id, request_id,
        record_hash, previous_hash, execution_time_ms, is_sensitive, requires_review
      ) VALUES (
        ${id}::uuid, ${timestamp.toISOString()}::timestamptz, ${entry.actorId}, ${entry.actorName ?? null}, ${entry.actorRole ?? null},
        ${entry.onBehalfOfId ?? null}, ${entry.onBehalfOfName ?? null},
        ${entry.action}, ${entry.action.split('_')[0] || null},
        ${entry.resourceType}, ${entry.resourceId ?? null},
        ${entry.organizationId}, ${entry.organizationName ?? null},
        ${entry.requiredPermission ?? null}, ${entry.granted},
        ${entry.grantMethod ?? null}, ${entry.denialReason ?? null},
        ${entry.ipAddress ?? null}, ${entry.userAgent ?? null},
        ${entry.sessionId ?? null}, ${entry.requestId ?? null},
        ${recordHash}, ${previousHash}, ${entry.executionTimeMs ?? null},
        ${entry.isSensitive ?? false}, ${entry.isSensitive ?? false}
      )
    `);
    return id;
  });
}

/**
 * Log permission check. Fire and forget: audit logging must not block or break the request, so a failure is logged and not thrown.
 * A sensitive decision is queued for review.
 */
export async function logPermissionCheck(entry: PermissionCheckEntry): Promise<void> {
  void recordPermissionCheck(entry).catch((err) => {
    logger.error('Failed to write audit log', {
      error: err,
      organizationId: entry.organizationId,
    });
  });
}

/**
 * Get audit logs for member
 */
export async function getMemberAuditLogs(
  actorId: string,
  organizationId: string,
  options: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
    grantedOnly?: boolean;
    deniedOnly?: boolean;
  } = {}
): Promise<AuditLogEntry[]> {
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;
  const conditions: SQL[] = [sql`actor_id = ${actorId}`, sql`organization_id = ${organizationId}`];
  if (options.startDate) conditions.push(sql`timestamp >= ${isoTime(options.startDate)}::timestamptz`);
  if (options.endDate) conditions.push(sql`timestamp <= ${isoTime(options.endDate)}::timestamptz`);
  if (options.grantedOnly) conditions.push(sql`granted = TRUE`);
  if (options.deniedOnly) conditions.push(sql`granted = FALSE`);

  const result = await withRLSContext(async (tx) => tx.execute(sql`
    SELECT * FROM rbac_audit_log
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY sequence_number DESC
    LIMIT ${limit} OFFSET ${offset}
  `));
  return camelRows<AuditLogEntry>(result);
}

/**
 * Get audit logs for resource
 */
export async function getResourceAuditLogs(
  resourceType: string,
  resourceId: string,
  organizationId: string,
  limit: number = 50
): Promise<AuditLogEntry[]> {
  const result = await withRLSContext(async (tx) => tx.execute(sql`
    SELECT * FROM rbac_audit_log
    WHERE resource_type = ${resourceType}
      AND resource_id = ${resourceId}
      AND organization_id = ${organizationId}
    ORDER BY sequence_number DESC
    LIMIT ${limit}
  `));
  return camelRows<AuditLogEntry>(result);
}

/**
 * Get denied access attempts (security monitoring)
 */
export async function getDeniedAccessAttempts(
  organizationId: string,
  hours: number = 24
): Promise<AuditLogEntry[]> {
  const result = await withRLSContext(async (tx) => tx.execute(sql`
    SELECT * FROM rbac_audit_log
    WHERE organization_id = ${organizationId}
      AND granted = FALSE
      AND timestamp >= NOW() - make_interval(hours => ${hours}::int)
    ORDER BY sequence_number DESC
  `));
  return camelRows<AuditLogEntry>(result);
}

/**
 * Get sensitive actions requiring review
 */
export async function getSensitiveActionsForReview(
  organizationId: string
): Promise<AuditLogEntry[]> {
  const result = await withRLSContext(async (tx) => tx.execute(sql`
    SELECT * FROM rbac_audit_log
    WHERE organization_id = ${organizationId}
      AND requires_review = TRUE
      AND reviewed_at IS NULL
    ORDER BY sequence_number DESC
  `));
  return camelRows<AuditLogEntry>(result);
}

/**
 * Record a review of an audit entry, once. The database refuses to change anything else on the row, or a review already recorded.
 * Returns false when the entry is not awaiting review in that organization.
 */
export async function markAuditEntryReviewed(
  entryId: string,
  organizationId: string,
  reviewedBy: string,
  reviewNotes?: string
): Promise<boolean> {
  const result = await withSystemRLSContext('rbac: review-audit-entry', async (tx) => tx.execute(sql`
    UPDATE rbac_audit_log
    SET reviewed_at = NOW(), reviewed_by = ${reviewedBy}, review_notes = ${reviewNotes ?? null}
    WHERE id = ${entryId} AND organization_id = ${organizationId} AND requires_review AND reviewed_at IS NULL
    RETURNING id
  `));
  return Array.from(result).length > 0;
}

export interface AuditIntegrityResult {
  valid: boolean;
  totalRecords: number;
  invalidRecords: number;
  /** The first entry (in chain order) whose hash or link is wrong. */
  firstInvalidRecordId?: string;
}

/** Entries verified per query; the walk carries the previous hash across pages. */
export const AUDIT_VERIFY_PAGE = 2000;

/**
 * Verify audit log integrity: every entry names the hash of the one before it, and every hash is the one its own columns produce, so a deleted, reordered or
 * edited entry is found. With a range, the first entry's link to what came before the range is taken as stored.
 */
export async function verifyAuditLogIntegrity(
  organizationId: string,
  startDate?: Date,
  endDate?: Date
): Promise<AuditIntegrityResult> {
  return withSystemRLSContext('system: verify-audit-integrity', async (tx) => {
    let afterSequence = 0;
    let previousHash: string | null | undefined;
    let total = 0;
    let invalid = 0;
    let firstInvalid: string | undefined;
    for (;;) {
      const range: SQL[] = [sql`organization_id = ${organizationId}`, sql`sequence_number > ${afterSequence}`];
      if (startDate) range.push(sql`timestamp >= ${isoTime(startDate)}::timestamptz`);
      if (endDate) range.push(sql`timestamp <= ${isoTime(endDate)}::timestamptz`);
      const page = Array.from(
        await tx.execute(sql`
          SELECT id, sequence_number, timestamp, actor_id, on_behalf_of_id, action, resource_type, resource_id, organization_id,
                 required_permission, granted, grant_method, denial_reason, request_id, session_id, record_hash, previous_hash
          FROM rbac_audit_log WHERE ${sql.join(range, sql` AND `)} ORDER BY sequence_number LIMIT ${AUDIT_VERIFY_PAGE}
        `),
      ) as SqlRow[];
      for (const row of page) {
        total += 1;
        const link = previousHash === undefined ? (startDate ? true : row.previous_hash == null) : row.previous_hash === previousHash;
        const expected = computeAuditRecordHash(row.previous_hash as string | null, {
          organizationId: row.organization_id as string,
          timestamp: row.timestamp as Date | string,
          actorId: row.actor_id as string,
          onBehalfOfId: row.on_behalf_of_id as string | null,
          action: row.action as string,
          resourceType: row.resource_type as string,
          resourceId: row.resource_id as string | null,
          requiredPermission: row.required_permission as string | null,
          granted: row.granted as boolean,
          grantMethod: row.grant_method as string | null,
          denialReason: row.denial_reason as string | null,
          requestId: row.request_id as string | null,
          sessionId: row.session_id as string | null,
        });
        if (!link || expected !== row.record_hash) {
          invalid += 1;
          firstInvalid ??= row.id as string;
        }
        previousHash = row.record_hash as string;
        afterSequence = Number(row.sequence_number);
      }
      if (page.length < AUDIT_VERIFY_PAGE) break;
    }
    return { valid: invalid === 0, totalRecords: total, invalidRecords: invalid, ...(firstInvalid ? { firstInvalidRecordId: firstInvalid } : {}) };
  });
}
