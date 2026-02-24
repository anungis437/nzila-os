/**
 * Hierarchy Validation Utilities
 * 
 * Prevents data corruption in organizational hierarchies:
 * - Circular references
 * - Orphaned organizations
 * - Excessive depth
 * - Path consistency
 */

import { db } from '@/db/db';
import { organizations } from '@/db/schema-organizations';
import { eq, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// =============================================================================
// CONSTANTS
// =============================================================================

export const MAX_HIERARCHY_DEPTH = 10;
export const HIERARCHY_TYPES = {
  platform: -1, // SaaS platform provider (above congress)
  congress: 0,
  federation: 1,
  union: 2,
  charter: 2,
  local: 3,
  branch: 4,
} as const;

// =============================================================================
// VALIDATION RESULTS
// =============================================================================

export interface HierarchyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// CIRCULAR REFERENCE DETECTION
// =============================================================================

/**
 * Check if setting parentId would create a circular reference
 * 
 * @param organizationId - Organization being updated
 * @param proposedParentId - New parent ID
 * @returns Validation result
 */
export async function detectCircularReference(
  organizationId: string,
  proposedParentId: string | null
): Promise<HierarchyValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!proposedParentId) {
    return { valid: true, errors, warnings };
  }

  // Cannot be your own parent
  if (organizationId === proposedParentId) {
    errors.push('Organization cannot be its own parent');
    return { valid: false, errors, warnings };
  }

  // Check if proposed parent is actually a descendant
  const proposedParent = await db.query.organizations.findFirst({
    where: eq(organizations.id, proposedParentId),
    columns: { hierarchyPath: true, name: true },
  });

  if (!proposedParent) {
    errors.push(`Proposed parent organization not found: ${proposedParentId}`);
    return { valid: false, errors, warnings };
  }

  // If organization is in parent's hierarchy path, it&apos;s circular
  if (proposedParent.hierarchyPath?.includes(organizationId)) {
    errors.push(
      `Circular reference detected: ${proposedParent.name} is already a descendant of this organization`
    );
    return { valid: false, errors, warnings };
  }

  return { valid: true, errors, warnings };
}

// =============================================================================
// ORPHAN DETECTION
// =============================================================================

/**
 * Find organizations with invalid parent references
 * 
 * @returns List of orphaned organization IDs
 */
export async function findOrphanedOrganizations(): Promise<string[]> {
  const result = await db.execute(sql`
    SELECT o.id
    FROM organizations o
    WHERE o.parent_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM organizations p WHERE p.id = o.parent_id
      )
  `);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result as unknown as { rows: unknown[] }).rows.map((row: any) => row.id);
}

/**
 * Fix orphaned organizations by setting parent to null
 * 
 * @param orphanIds - Organization IDs to fix
 * @returns Number of organizations fixed
 */
export async function fixOrphanedOrganizations(orphanIds: string[]): Promise<number> {
  if (orphanIds.length === 0) return 0;

  await db
    .update(organizations)
    .set({
      parentId: null,
      hierarchyPath: sql`ARRAY[id]`,
      hierarchyLevel: 0,
    })
    .where(sql`id = ANY(${orphanIds})`);

  logger.warn('Fixed orphaned organizations', { count: orphanIds.length, orphanIds });
  return orphanIds.length;
}

// =============================================================================
// DEPTH VALIDATION
// =============================================================================

/**
 * Validate hierarchy depth doesn&apos;t exceed maximum
 * 
 * @param hierarchyPath - Path to validate
 * @returns Validation result
 */
export function validateHierarchyDepth(hierarchyPath: string[]): HierarchyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (hierarchyPath.length > MAX_HIERARCHY_DEPTH) {
    errors.push(
      `Hierarchy depth ${hierarchyPath.length} exceeds maximum ${MAX_HIERARCHY_DEPTH}`
    );
    return { valid: false, errors, warnings };
  }

  if (hierarchyPath.length > MAX_HIERARCHY_DEPTH - 2) {
    warnings.push(
      `Hierarchy depth ${hierarchyPath.length} is close to maximum ${MAX_HIERARCHY_DEPTH}`
    );
  }

  return { valid: true, errors, warnings };
}

// =============================================================================
// PATH CONSISTENCY VALIDATION
// =============================================================================

/**
 * Validate hierarchy path consistency with parent
 * 
 * @param organizationId - Organization ID
 * @param parentId - Parent organization ID
 * @param hierarchyPath - Current hierarchy path
 * @returns Validation result
 */
export async function validatePathConsistency(
  organizationId: string,
  parentId: string | null,
  hierarchyPath: string[]
): Promise<HierarchyValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Root organization check
  if (!parentId) {
    if (hierarchyPath.length !== 1 || hierarchyPath[0] !== organizationId) {
      errors.push(`Root organization must have hierarchyPath = [${organizationId}]`);
      return { valid: false, errors, warnings };
    }
    return { valid: true, errors, warnings };
  }

  // Get parent's hierarchy path
  const parent = await db.query.organizations.findFirst({
    where: eq(organizations.id, parentId),
    columns: { hierarchyPath: true, name: true },
  });

  if (!parent) {
    errors.push(`Parent organization not found: ${parentId}`);
    return { valid: false, errors, warnings };
  }

  const expectedPath = [...(parent.hierarchyPath || []), organizationId];

  // Check if path matches expected
  if (JSON.stringify(hierarchyPath) !== JSON.stringify(expectedPath)) {
    errors.push(
      `Hierarchy path mismatch. Expected: [${expectedPath.join(', ')}], Got: [${hierarchyPath.join(', ')}]`
    );
    return { valid: false, errors, warnings };
  }

  return { valid: true, errors, warnings };
}

// =============================================================================
// TYPE HIERARCHY VALIDATION
// =============================================================================

/**
 * Validate organizational type hierarchy makes sense
 * 
 * @param orgType - Organization type
 * @param parentType - Parent organization type
 * @returns Validation result
 */
export function validateTypeHierarchy(
  orgType: string,
  parentType: string | null
): HierarchyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!parentType) {
    // Root organizations should be congress or federation
    if (orgType !== 'platform' && orgType !== 'congress' && orgType !== 'federation') {
      warnings.push(
        `Root organization with type '${orgType}' is unusual. Typically platform, congress, or federation.`
      );
    }
    return { valid: true, errors, warnings };
  }

  const orgLevel = HIERARCHY_TYPES[orgType as keyof typeof HIERARCHY_TYPES] ?? 99;
  const parentLevel = HIERARCHY_TYPES[parentType as keyof typeof HIERARCHY_TYPES] ?? 99;

  // Parent should be higher in hierarchy (lower level number)
  if (orgLevel <= parentLevel) {
    warnings.push(
      `Unusual hierarchy: ${orgType} (level ${orgLevel}) under ${parentType} (level ${parentLevel})`
    );
  }

  return { valid: true, errors, warnings };
}

// =============================================================================
// COMPREHENSIVE VALIDATION
// =============================================================================

/**
 * Run all validation checks on an organization
 * 
 * @param organizationId - Organization to validate
 * @returns Comprehensive validation result
 */
export async function validateOrganizationHierarchy(
  organizationId: string
): Promise<HierarchyValidationResult> {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!org) {
    return {
      valid: false,
      errors: [`Organization not found: ${organizationId}`],
      warnings: [],
    };
  }

  // Check circular references
  if (org.parentId) {
    const circularResult = await detectCircularReference(organizationId, org.parentId);
    allErrors.push(...circularResult.errors);
    allWarnings.push(...circularResult.warnings);
  }

  // Check depth
  const depthResult = validateHierarchyDepth(org.hierarchyPath || []);
  allErrors.push(...depthResult.errors);
  allWarnings.push(...depthResult.warnings);

  // Check path consistency
  const pathResult = await validatePathConsistency(
    organizationId,
    org.parentId,
    org.hierarchyPath || []
  );
  allErrors.push(...pathResult.errors);
  allWarnings.push(...pathResult.warnings);

  // Check type hierarchy
  if (org.parentId) {
    const parent = await db.query.organizations.findFirst({
      where: eq(organizations.id, org.parentId),
      columns: { organizationType: true },
    });

    if (parent) {
      const typeResult = validateTypeHierarchy(org.organizationType, parent.organizationType);
      allErrors.push(...typeResult.errors);
      allWarnings.push(...typeResult.warnings);
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

// =============================================================================
// BULK VALIDATION
// =============================================================================

/**
 * Validate all organizations in the system
 * 
 * @returns Summary of validation issues
 */
export async function validateAllOrganizations(): Promise<{
  total: number;
  valid: number;
  invalid: number;
  orphans: number;
  issues: Array<{ orgId: string; orgName: string; errors: string[]; warnings: string[] }>;
}> {
  const allOrgs = await db.query.organizations.findMany({
    columns: { id: true, name: true },
  });

  const issues: Array<{ orgId: string; orgName: string; errors: string[]; warnings: string[] }> =
    [];
  let validCount = 0;

  for (const org of allOrgs) {
    const result = await validateOrganizationHierarchy(org.id);
    if (result.valid) {
      validCount++;
    } else {
      issues.push({
        orgId: org.id,
        orgName: org.name,
        errors: result.errors,
        warnings: result.warnings,
      });
    }
  }

  const orphans = await findOrphanedOrganizations();

  logger.info('Completed organization hierarchy validation', {
    total: allOrgs.length,
    valid: validCount,
    invalid: issues.length,
    orphans: orphans.length,
  });

  return {
    total: allOrgs.length,
    valid: validCount,
    invalid: issues.length,
    orphans: orphans.length,
    issues,
  };
}

