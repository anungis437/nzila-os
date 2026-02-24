/**
 * Enhanced RBAC Database Queries
 * 
 * Query functions for enterprise-grade RBAC system with:
 * - Multi-role assignments
 * - Scope-based permissions
 * - Term tracking and expiration
 * - Permission exceptions
 * - Audit logging
 */

import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oldValues?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  newValues?: any;
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

// ============================================================================
// ROLE DEFINITIONS QUERIES
// ============================================================================

/**
 * Get all active role definitions
 */
export async function getAllRoleDefinitions(): Promise<RoleDefinition[]> {
  const result = await db.execute(sql`
    SELECT * FROM role_definitions 
    WHERE is_active = TRUE 
    ORDER BY role_level DESC
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

/**
 * Get role definition by code
 */
export async function getRoleDefinitionByCode(roleCode: string): Promise<RoleDefinition | null> {
  const result = await db.execute(sql`
    SELECT * FROM role_definitions 
    WHERE role_code = ${roleCode} AND is_active = TRUE
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result[0] as any || null;
}

/**
 * Get role definitions by level (at or above specified level)
 */
export async function getRoleDefinitionsByLevel(minLevel: number): Promise<RoleDefinition[]> {
  const result = await db.execute(sql`
    SELECT * FROM role_definitions 
    WHERE role_level >= ${minLevel} AND is_active = TRUE
    ORDER BY role_level DESC
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

/**
 * Create custom role definition for tenant
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
    parentRoleCode?: string;
    createdBy?: string;
  } = {}
): Promise<RoleDefinition> {
  const result = await db.execute(sql`
    INSERT INTO role_definitions (
      role_code, role_name, role_description, role_level,
      is_elected, requires_board_approval, default_term_years, 
      can_delegate, parent_role_code, permissions, created_by, is_system_role
    ) VALUES (
      ${roleCode}, ${roleName}, ${options.description || null}, ${roleLevel},
      ${options.isElected || false}, ${options.requiresBoardApproval || false}, 
      ${options.defaultTermYears || null}, ${options.canDelegate || false},
      ${options.parentRoleCode || null}, ${JSON.stringify(permissions)}::jsonb,
      ${options.createdBy || null}, FALSE
    )
    RETURNING *
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result[0] as any;
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
  const result = await db.execute(sql`
    SELECT * FROM v_active_member_roles
    WHERE member_id = ${memberId} 
      AND organization_id = ${organizationId}
    ORDER BY role_level DESC
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

/**
 * Get member's highest role level
 */
export async function getMemberHighestRoleLevel(
  memberId: string,
  organizationId: string
): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(MAX(rd.role_level), 0) as max_level
    FROM member_roles mr
    JOIN role_definitions rd ON mr.role_code = rd.role_code
    WHERE mr.member_id = ${memberId} 
      AND mr.organization_id = ${organizationId}
      AND mr.status = 'active'
      AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
  `);
  return (result[0]?.max_level as number) || 0;
}

/**
 * Get member's effective permissions (merged from all roles)
 */
export async function getMemberEffectivePermissions(
  memberId: string,
  organizationId: string
): Promise<string[]> {
  const result = await db.execute(sql`
    SELECT DISTINCT jsonb_array_elements_text(rd.permissions) as permission
    FROM member_roles mr
    JOIN role_definitions rd ON mr.role_code = rd.role_code
    WHERE mr.member_id = ${memberId} 
      AND mr.organization_id = ${organizationId}
      AND mr.status = 'active'
      AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.map((row: any) => row.permission);
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
  let query = sql`
    SELECT EXISTS(
      SELECT 1 FROM member_roles
      WHERE member_id = ${memberId}
        AND organization_id = ${organizationId}
        AND role_code = ${roleCode}
        AND status = 'active'
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  `;
  
  if (scopeType) {
    query = sql`${query} AND scope_type = ${scopeType}`;
  }
  if (scopeValue) {
    query = sql`${query} AND scope_value = ${scopeValue}`;
  }
  
  query = sql`${query}) as has_role`;
  
  const result = await db.execute(query);
  return (result[0]?.has_role as boolean) || false;
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
  let query = sql`
    SELECT EXISTS(
      SELECT 1 FROM member_roles mr
      JOIN role_definitions rd ON mr.role_code = rd.role_code
      WHERE mr.member_id = ${memberId}
        AND mr.organization_id = ${organizationId}
        AND rd.role_level >= ${minLevel}
        AND mr.status = 'active'
        AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
  `;
  
  if (scopeType) {
    query = sql`${query} AND (mr.scope_type = 'global' OR mr.scope_type = ${scopeType})`;
  }
  if (scopeValue) {
    query = sql`${query} AND (mr.scope_type = 'global' OR mr.scope_value = ${scopeValue})`;
  }
  
  query = sql`${query}) as has_level`;
  
  const result = await db.execute(query);
  return (result[0]?.has_level as boolean) || false;
}

/**
 * Assign role to member
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
    assignmentType?: 'elected' | 'appointed' | 'acting' | 'emergency';
    electionDate?: Date;
    electedBy?: string;
    voteCount?: number;
    totalVotes?: number;
    isActingRole?: boolean;
    actingForMemberId?: string;
    actingReason?: string;
    requiresApproval?: boolean;
  } = {}
): Promise<MemberRole> {
  const startDate = options.startDate || new Date();
  const assignmentType = options.assignmentType || 'appointed';
  const scopeType = options.scopeType || 'global';
  
  const result = await db.execute(sql`
    INSERT INTO member_roles (
      member_id, organization_id, role_code, scope_type, scope_value,
      start_date, end_date, term_years, assignment_type,
      election_date, elected_by, vote_count, total_votes,
      is_acting_role, acting_for_member_id, acting_reason,
      requires_approval, status, created_by
    ) VALUES (
      ${memberId}, ${organizationId}, ${roleCode}, ${scopeType}, ${options.scopeValue || null},
      ${startDate}, ${options.endDate || null}, ${options.termYears || null}, ${assignmentType},
      ${options.electionDate || null}, ${options.electedBy || null}, 
      ${options.voteCount || null}, ${options.totalVotes || null},
      ${options.isActingRole || false}, ${options.actingForMemberId || null}, 
      ${options.actingReason || null}, ${options.requiresApproval || false},
      ${options.requiresApproval ? 'pending_approval' : 'active'}, ${createdBy}
    )
    RETURNING *
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result[0] as any;
}

/**
 * Update member role
 */
export async function updateMemberRole(
  roleId: string,
  updatedBy: string,
  updates: {
    endDate?: Date;
    status?: 'active' | 'expired' | 'suspended' | 'pending_approval';
    suspensionReason?: string;
    suspendedBy?: string;
  }
): Promise<MemberRole> {
  // Build UPDATE query dynamically using sql template
  let query = sql`UPDATE member_roles SET `;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setClauses: any[] = [];
  
  if (updates.endDate !== undefined) {
    setClauses.push(sql`end_date = ${updates.endDate}`);
  }
  if (updates.status) {
    setClauses.push(sql`status = ${updates.status}`);
  }
  if (updates.suspensionReason) {
    setClauses.push(sql`suspension_reason = ${updates.suspensionReason}`);
    setClauses.push(sql`suspended_at = NOW()`);
  }
  if (updates.suspendedBy) {
    setClauses.push(sql`suspended_by = ${updates.suspendedBy}`);
  }
  
  setClauses.push(sql`updated_by = ${updatedBy}`);
  setClauses.push(sql`updated_at = NOW()`);
  
  // Join clauses with commas
  for (let i = 0; i < setClauses.length; i++) {
    query = sql`${query}${setClauses[i]}`;
    if (i < setClauses.length - 1) {
      query = sql`${query}, `;
    }
  }
  
  query = sql`${query} WHERE id = ${roleId} RETURNING *`;
  
  const result = await db.execute(query);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result[0] as any;
}

/**
 * Revoke member role (set end date to today)
 */
export async function revokeMemberRole(
  roleId: string,
  revokedBy: string,
  reason?: string
): Promise<void> {
  await db.execute(sql`
    UPDATE member_roles 
    SET end_date = CURRENT_DATE,
        status = 'expired',
        suspension_reason = ${reason || 'Role revoked'},
        suspended_by = ${revokedBy},
        suspended_at = NOW(),
        updated_by = ${revokedBy},
        updated_at = NOW()
    WHERE id = ${roleId}
  `);
}

/**
 * Get roles expiring within specified days
 */
export async function getExpiringRoles(
  organizationId: string,
  daysAhead: number = 90
): Promise<MemberRoleWithDetails[]> {
  const result = await db.execute(sql`
    SELECT * FROM v_active_member_roles
    WHERE organization_id = ${organizationId}
      AND end_date IS NOT NULL
      AND end_date <= CURRENT_DATE + ${daysAhead}
      AND end_date >= CURRENT_DATE
    ORDER BY end_date
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

/**
 * Get upcoming elections
 */
export async function getUpcomingElections(
  organizationId: string,
  daysAhead: number = 180
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const result = await db.execute(sql`
    SELECT * FROM v_upcoming_elections
    WHERE organization_id = ${organizationId}
      AND next_election_date <= CURRENT_DATE + ${daysAhead}
    ORDER BY next_election_date
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

/**
 * Check and expire old terms (run periodically)
 */
export async function expireOldTerms(): Promise<number> {
  const result = await db.execute(sql`
    UPDATE member_roles
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active'
      AND end_date IS NOT NULL
      AND end_date < CURRENT_DATE
    RETURNING id
  `);
  return result.length;
}

// ============================================================================
// PERMISSION EXCEPTIONS QUERIES
// ============================================================================

/**
 * Get active permission exceptions for member
 */
export async function getMemberPermissionExceptions(
  memberId: string,
  organizationId: string
): Promise<PermissionException[]> {
  const result = await db.execute(sql`
    SELECT * FROM permission_exceptions
    WHERE member_id = ${memberId}
      AND organization_id = ${organizationId}
      AND is_active = TRUE
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (usage_limit IS NULL OR usage_count < usage_limit)
    ORDER BY effective_date DESC
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
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
  let query = sql`
    SELECT EXISTS(
      SELECT 1 FROM permission_exceptions
      WHERE member_id = ${memberId}
        AND organization_id = ${organizationId}
        AND permission = ${permission}
        AND is_active = TRUE
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (usage_limit IS NULL OR usage_count < usage_limit)
  `;
  
  if (resourceType) {
    query = sql`${query} AND resource_type = ${resourceType}`;
  }
  if (resourceId) {
    query = sql`${query} AND (resource_id IS NULL OR resource_id = ${resourceId})`;
  }
  
  query = sql`${query}) as has_exception`;
  
  const result = await db.execute(query);
  return (result[0]?.has_exception as boolean) || false;
}

/**
 * Grant permission exception
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
  const result = await db.execute(sql`
    INSERT INTO permission_exceptions (
      member_id, organization_id, permission, resource_type, resource_id,
      reason, approved_by, approval_notes, effective_date, expires_at, usage_limit
    ) VALUES (
      ${memberId}, ${organizationId}, ${permission}, ${resourceType}, ${options.resourceId || null},
      ${reason}, ${approvedBy}, ${options.approvalNotes || null},
      ${options.effectiveDate || new Date()}, ${options.expiresAt || null}, ${options.usageLimit || null}
    )
    RETURNING *
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result[0] as any;
}

/**
 * Revoke permission exception
 */
export async function revokePermissionException(
  exceptionId: string,
  revokedBy: string,
  reason?: string
): Promise<void> {
  await db.execute(sql`
    UPDATE permission_exceptions
    SET revoked_at = NOW(),
        revoked_by = ${revokedBy},
        revocation_reason = ${reason || 'Exception revoked'},
        is_active = FALSE,
        updated_at = NOW()
    WHERE id = ${exceptionId}
  `);
}

/**
 * Increment usage count for permission exception
 */
export async function incrementExceptionUsage(exceptionId: string): Promise<void> {
  await db.execute(sql`
    UPDATE permission_exceptions
    SET usage_count = usage_count + 1,
        last_used_at = NOW(),
        updated_at = NOW()
    WHERE id = ${exceptionId}
  `);
}

// ============================================================================
// AUDIT LOG QUERIES
// ============================================================================

/**
 * Log permission check
 */
export async function logPermissionCheck(entry: {
  actorId: string;
  actorName?: string;
  actorRole?: string;
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
}): Promise<void> {
  // Calculate hash for this record
  const recordData = JSON.stringify({
    timestamp: new Date(),
    actorId: entry.actorId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    granted: entry.granted,
  });
  const recordHash = Buffer.from(recordData).toString('base64').substring(0, 64);
  
  // Get previous hash for blockchain linking
  const prevResult = await db.execute(sql`
    SELECT record_hash FROM rbac_audit_log 
    WHERE organization_id = ${entry.organizationId}
    ORDER BY timestamp DESC LIMIT 1
  `);
  const previousHash = prevResult[0]?.record_hash || null;
  
  // Insert audit log (fire and forget - don't block request)
  db.execute(sql`
    INSERT INTO rbac_audit_log (
      actor_id, actor_name, actor_role, action, action_category,
      resource_type, resource_id, organization_id, organization_name,
      required_permission, granted, grant_method, denial_reason,
      ip_address, user_agent, session_id, request_id,
      record_hash, previous_hash, execution_time_ms, is_sensitive
    ) VALUES (
      ${entry.actorId}, ${entry.actorName || null}, ${entry.actorRole || null},
      ${entry.action}, ${entry.action.split('_')[0] || null},
      ${entry.resourceType}, ${entry.resourceId || null},
      ${entry.organizationId}, ${entry.organizationName || null},
      ${entry.requiredPermission || null}, ${entry.granted}, 
      ${entry.grantMethod || null}, ${entry.denialReason || null},
      ${entry.ipAddress || null}, ${entry.userAgent || null},
      ${entry.sessionId || null}, ${entry.requestId || null},
      ${recordHash}, ${previousHash}, ${entry.executionTimeMs || null},
      ${entry.isSensitive || false}
    )
  `).catch(err => {
    logger.error('Failed to write audit log', {
      error: err,
      organizationId: entry.organizationId,
    });
    // Don't throw - audit logging should not break the application
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
  const limit = options.limit || 100;
  const offset = options.offset || 0;
  
  let query = sql`
    SELECT * FROM rbac_audit_log
    WHERE actor_id = ${actorId} AND organization_id = ${organizationId}
  `;
  
  if (options.startDate) {
    query = sql`${query} AND timestamp >= ${options.startDate}`;
  }
  if (options.endDate) {
    query = sql`${query} AND timestamp <= ${options.endDate}`;
  }
  if (options.grantedOnly) {
    query = sql`${query} AND granted = TRUE`;
  }
  if (options.deniedOnly) {
    query = sql`${query} AND granted = FALSE`;
  }
  
  query = sql`${query} ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}`;
  
  const result = await db.execute(query);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
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
  const result = await db.execute(sql`
    SELECT * FROM rbac_audit_log
    WHERE resource_type = ${resourceType}
      AND resource_id = ${resourceId}
      AND organization_id = ${organizationId}
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

/**
 * Get denied access attempts (security monitoring)
 */
export async function getDeniedAccessAttempts(
  organizationId: string,
  hours: number = 24
): Promise<AuditLogEntry[]> {
  const result = await db.execute(sql`
    SELECT * FROM rbac_audit_log
    WHERE organization_id = ${organizationId}
      AND granted = FALSE
      AND timestamp >= NOW() - INTERVAL '${hours} hours'
    ORDER BY timestamp DESC
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

/**
 * Get sensitive actions requiring review
 */
export async function getSensitiveActionsForReview(
  organizationId: string
): Promise<AuditLogEntry[]> {
  const result = await db.execute(sql`
    SELECT * FROM rbac_audit_log
    WHERE organization_id = ${organizationId}
      AND requires_review = TRUE
      AND reviewed_at IS NULL
    ORDER BY timestamp DESC
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

/**
 * Verify audit log integrity (blockchain-style)
 */
export async function verifyAuditLogIntegrity(
  organizationId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{ valid: boolean; totalRecords: number; invalidRecords: number }> {
  let query = sql`
    WITH log_chain AS (
      SELECT 
        id, timestamp, record_hash, previous_hash,
        LAG(record_hash) OVER (ORDER BY timestamp) as expected_previous_hash
      FROM rbac_audit_log
      WHERE organization_id = ${organizationId}
  `;
  
  if (startDate) {
    query = sql`${query} AND timestamp >= ${startDate}`;
  }
  if (endDate) {
    query = sql`${query} AND timestamp <= ${endDate}`;
  }
  
  query = sql`${query}
    )
    SELECT 
      COUNT(*) as total_records,
      COUNT(*) FILTER (WHERE previous_hash != expected_previous_hash AND expected_previous_hash IS NOT NULL) as invalid_records
    FROM log_chain
  `;
  
  const result = await db.execute(query);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = result[0] as any;
  
  return {
    valid: row.invalid_records === 0,
    totalRecords: parseInt(row.total_records),
    invalidRecords: parseInt(row.invalid_records),
  };
}

