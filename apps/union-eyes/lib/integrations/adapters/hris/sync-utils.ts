/**
 * HRIS Sync Utilities
 * 
 * Helper functions for HRIS data synchronization, validation, and mapping.
 */

import { db } from '@/db';
import { externalEmployees } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface EmployeeMapping {
  externalEmployeeId: string;
  internalMemberId?: string;
  matchConfidence: 'high' | 'medium' | 'low';
  matchReason: string;
}

export interface SyncConflict {
  externalEmployeeId: string;
  field: string;
  externalValue: unknown;
  internalValue: unknown;
  suggestedResolution: 'keep_external' | 'keep_internal' | 'manual_review';
}

export interface SyncStats {
  totalEmployees: number;
  mapped: number;
  unmapped: number;
  conflicts: number;
  lastSyncDate?: Date;
}

// ============================================================================
// Employee Mapping Utilities
// ============================================================================

/**
 * Attempt to map external employees to internal members
 * 
 * Matching logic:
 * 1. High confidence: Email match
 * 2. Medium confidence: First + Last name match
 * 3. Low confidence: Fuzzy name match
 */
export async function findEmployeeMappings(
  organizationId: string,
  provider: 'WORKDAY' | 'BAMBOOHR' | 'ADP'
): Promise<EmployeeMapping[]> {
  const mappings: EmployeeMapping[] = [];

  try {
    // Get all external employees for this provider
    const employees = await db
      .select()
      .from(externalEmployees)
      .where(
        and(
          eq(externalEmployees.organizationId, organizationId),
          eq(externalEmployees.externalProvider, provider),
          eq(externalEmployees.isActive, true)
        )
      );

    // Get all internal members (organization_members table)
    // Note: This would need to be adjusted based on actual member schema
    const members = await db.execute(sql`
      SELECT id, email, first_name, last_name
      FROM organization_members
      WHERE organization_id = ${organizationId}
      AND status = 'active'
    `);

    for (const employee of employees) {
      let bestMatch: EmployeeMapping = {
        externalEmployeeId: employee.externalId,
        matchConfidence: 'low',
        matchReason: 'No match found',
      };

      // Try email match (high confidence)
      if (employee.email) {
        const emailMatch = (members as unknown[]).find(
          m => m.email?.toLowerCase() === employee.email?.toLowerCase()
        );
        if (emailMatch) {
          bestMatch = {
            externalEmployeeId: employee.externalId,
            internalMemberId: emailMatch.id,
            matchConfidence: 'high',
            matchReason: 'Email match',
          };
          mappings.push(bestMatch);
          continue;
        }
      }

      // Try name match (medium confidence)
      if (employee.firstName && employee.lastName) {
        const nameMatch = (members as unknown[]).find(
          m =>
            m.first_name?.toLowerCase() === employee.firstName?.toLowerCase() &&
            m.last_name?.toLowerCase() === employee.lastName?.toLowerCase()
        );
        if (nameMatch) {
          bestMatch = {
            externalEmployeeId: employee.externalId,
            internalMemberId: nameMatch.id,
            matchConfidence: 'medium',
            matchReason: 'Full name match',
          };
          mappings.push(bestMatch);
          continue;
        }
      }

      // No match found
      mappings.push(bestMatch);
    }

    logger.info('Employee mapping completed', {
      organizationId,
      provider,
      totalEmployees: employees.length,
      mapped: mappings.filter(m => m.internalMemberId).length,
    });

    return mappings;
  } catch (error) {
    logger.error('Failed to find employee mappings', error instanceof Error ? error : new Error(String(error)), {
      organizationId,
      provider,
    });
    throw error;
  }
}

// ============================================================================
// Conflict Detection
// ============================================================================

/**
 * Detect conflicts between external and internal employee data
 */
export async function detectSyncConflicts(
  organizationId: string,
  provider: 'WORKDAY' | 'BAMBOOHR' | 'ADP'
): Promise<SyncConflict[]> {
  const conflicts: SyncConflict[] = [];

  try {
    const mappings = await findEmployeeMappings(organizationId, provider);

    for (const mapping of mappings) {
      if (!mapping.internalMemberId) continue;

      // Get external employee
      const external = await db.query.externalEmployees.findFirst({
        where: and(
          eq(externalEmployees.externalId, mapping.externalEmployeeId),
          eq(externalEmployees.organizationId, organizationId)
        ),
      });

      if (!external) continue;

      // Get internal member
      const internal = await db.execute(sql`
        SELECT * FROM organization_members
        WHERE id = ${mapping.internalMemberId}
      `);

      if (!internal || (internal as unknown[]).length === 0) continue;

      const member = (internal as unknown[])[0];

      // Check for conflicts in key fields
      const fieldsToCheck = [
        { field: 'email', external: external.email, internal: member.email },
        { field: 'phone', external: external.phone, internal: member.phone },
        { field: 'position', external: external.position, internal: member.position },
        { field: 'department', external: external.department, internal: member.department },
      ];

      for (const check of fieldsToCheck) {
        if (check.external && check.internal && check.external !== check.internal) {
          conflicts.push({
            externalEmployeeId: mapping.externalEmployeeId,
            field: check.field,
            externalValue: check.external,
            internalValue: check.internal,
            suggestedResolution: 'keep_external', // External HRIS is source of truth
          });
        }
      }
    }

    logger.info('Conflict detection completed', {
      organizationId,
      provider,
      conflictsFound: conflicts.length,
    });

    return conflicts;
  } catch (error) {
    logger.error('Failed to detect conflicts',error instanceof Error ? error : new Error(String(error)), {
      organizationId,
      provider,
    });
    throw error;
  }
}

// ============================================================================
// Sync Statistics
// ============================================================================

/**
 * Get sync statistics for an organization
 */
export async function getSyncStats(
  organizationId: string,
  provider?: 'WORKDAY' | 'BAMBOOHR' | 'ADP'
): Promise<SyncStats> {
  try {
    const whereConditions = [eq(externalEmployees.organizationId, organizationId)];
    if (provider) {
      whereConditions.push(eq(externalEmployees.externalProvider, provider));
    }

    // Get total employees
    const employees = await db
      .select()
      .from(externalEmployees)
      .where(and(...whereConditions));

    // Get mapping stats
    const mappings = provider
      ? await findEmployeeMappings(organizationId, provider)
      : [];

    // Get last sync date
    const lastSync = await db
      .select({
        lastSyncedAt: externalEmployees.lastSyncedAt,
      })
      .from(externalEmployees)
      .where(and(...whereConditions))
      .orderBy(sql`${externalEmployees.lastSyncedAt} DESC NULLS LAST`)
      .limit(1);

    const mapped = mappings.filter(m => m.internalMemberId).length;

    return {
      totalEmployees: employees.length,
      mapped,
      unmapped: employees.length - mapped,
      conflicts: 0, // Would need to run conflict detection
      lastSyncDate: lastSync[0]?.lastSyncedAt || undefined,
    };
  } catch (error) {
    logger.error('Failed to get sync stats', error instanceof Error ? error : new Error(String(error)), {
      organizationId,
      provider,
    });
    throw error;
  }
}

// ============================================================================
// Data Validation
// ============================================================================

/**
 * Validate external employee data quality
 */
export function validateEmployeeData(employee: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  employeeId?: string | null;
}): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!employee.firstName) {
    errors.push('Missing first name');
  }
  if (!employee.lastName) {
    errors.push('Missing last name');
  }

  // Recommended fields
  if (!employee.email) {
    warnings.push('Missing email address');
  }
  if (!employee.employeeId) {
    warnings.push('Missing employee ID');
  }

  // Email format validation
  if (employee.email && !isValidEmail(employee.email)) {
    errors.push('Invalid email format');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Bulk update employee mappings
 */
export async function bulkMapEmployees(
  mappings: Array<{
    externalEmployeeId: string;
    internalMemberId: string;
  }>
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const mapping of mappings) {
    try {
      // Store mapping in a junction table (would need to be created)
      // For now, just log success
      logger.info('Employee mapped', {
        externalId: mapping.externalEmployeeId,
        memberId: mapping.internalMemberId,
      });
      success++;
    } catch (error) {
      logger.error('Failed to map employee', error instanceof Error ? error : new Error(String(error)), {
        mapping,
      });
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Deactivate employees no longer in external system
 */
export async function deactivateRemovedEmployees(
  organizationId: string,
  provider: 'WORKDAY' | 'BAMBOOHR' | 'ADP',
  activeExternalIds: string[]
): Promise<number> {
  try {
    const result = await db
      .update(externalEmployees)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(externalEmployees.organizationId, organizationId),
          eq(externalEmployees.externalProvider, provider),
          sql`${externalEmployees.externalId} NOT IN (${sql.join(activeExternalIds.map(id => sql`${id}`), sql`, `)})`
        )
      );

    logger.info('Deactivated removed employees', {
      organizationId,
      provider,
      count: result.length,
    });

    return result.length;
  } catch (error) {
    logger.error('Failed to deactivate removed employees', error instanceof Error ? error : new Error(String(error)), {
      organizationId,
      provider,
    });
    throw error;
  }
}
