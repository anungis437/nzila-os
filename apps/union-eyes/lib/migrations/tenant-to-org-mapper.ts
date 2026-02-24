/**
 * Tenant to Organization ID Mapper
 * 
 * Maps legacy tenant_id fields to new organization_id structure.
 * Provides bidirectional mapping, validation, and migration utilities.
 * 
 * Features:
 * - Bidirectional ID mapping (tenant â†” organization)
 * - Caching for performance
 * - Validation and existence checks
 * - Batch mapping operations
 * - Migration status tracking
 * 
 * @module lib/migrations/tenant-to-org-mapper
 */

import { db } from "@/db/db";
import { eq, inArray, sql } from "drizzle-orm";
import { organizations } from "@/db/schema-organizations";

// Migration mapping table (this would be in schema, but defining inline for clarity)
interface TenantOrgMapping {
  tenantId: string;
  organizationId: string;
  migrationStatus: "pending" | "in_progress" | "completed" | "failed" | "rolled_back";
  migratedAt: Date | null;
  migratedBy: string | null;
  recordCount: number;
  errorLog: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory cache for performance
class MappingCache {
  private tenantToOrg = new Map<string, string>();
  private orgToTenant = new Map<string, string>();
  private lastRefresh: Date | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  isStale(): boolean {
    if (!this.lastRefresh) return true;
    return Date.now() - this.lastRefresh.getTime() > this.CACHE_TTL_MS;
  }

  set(tenantId: string, orgId: string): void {
    this.tenantToOrg.set(tenantId, orgId);
    this.orgToTenant.set(orgId, tenantId);
  }

  getTenantToOrg(tenantId: string): string | undefined {
    return this.tenantToOrg.get(tenantId);
  }

  getOrgToTenant(orgId: string): string | undefined {
    return this.orgToTenant.get(orgId);
  }

  clear(): void {
    this.tenantToOrg.clear();
    this.orgToTenant.clear();
    this.lastRefresh = null;
  }

  setRefreshTime(): void {
    this.lastRefresh = new Date();
  }

  size(): number {
    return this.tenantToOrg.size;
  }
}

const cache = new MappingCache();

// =====================================================
// Core Mapping Functions
// =====================================================

/**
 * Get organization ID from tenant ID
 */
export async function getOrganizationIdFromTenant(
  tenantId: string
): Promise<string | null> {
  // Check cache first
  if (!cache.isStale()) {
    const cached = cache.getTenantToOrg(tenantId);
    if (cached) return cached;
  }

  try {
    // Query mapping table
    const result = await db.execute(sql`
      SELECT organization_id 
      FROM tenant_org_mappings 
      WHERE tenant_id = ${tenantId}
      AND migration_status = 'completed'
      LIMIT 1
    `);

    if (result.length > 0) {
      const orgId = result[0].organization_id as string;
      cache.set(tenantId, orgId);
      return orgId;
    }

    // Fallback: Try to find by slug match (legacy tenant slugs become org slugs)
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, tenantId))
      .limit(1);

    if (org) {
      cache.set(tenantId, org.id);
      return org.id;
    }

    return null;
  } catch (_error) {
return null;
  }
}

/**
 * Get tenant ID from organization ID (reverse mapping)
 */
export async function getTenantIdFromOrganization(
  organizationId: string
): Promise<string | null> {
  // Check cache first
  if (!cache.isStale()) {
    const cached = cache.getOrgToTenant(organizationId);
    if (cached) return cached;
  }

  try {
    const result = await db.execute(sql`
      SELECT tenant_id 
      FROM tenant_org_mappings 
      WHERE organization_id = ${organizationId}
      AND migration_status = 'completed'
      LIMIT 1
    `);

    if (result.length > 0) {
      const tenantId = result[0].tenant_id as string;
      cache.set(tenantId, organizationId);
      return tenantId;
    }

    // Fallback: Get org slug as tenant ID
    const [org] = await db
      .select({ slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (org?.slug) {
      cache.set(org.slug, organizationId);
      return org.slug;
    }

    return null;
  } catch (_error) {
return null;
  }
}

/**
 * Batch get organization IDs from tenant IDs
 */
export async function batchGetOrganizationIds(
  tenantIds: string[]
): Promise<Map<string, string>> {
  const mappings = new Map<string, string>();

  if (tenantIds.length === 0) return mappings;

  try {
    // Get from cache first
    const uncachedTenants: string[] = [];
    
    if (!cache.isStale()) {
      for (const tenantId of tenantIds) {
        const cached = cache.getTenantToOrg(tenantId);
        if (cached) {
          mappings.set(tenantId, cached);
        } else {
          uncachedTenants.push(tenantId);
        }
      }
    } else {
      uncachedTenants.push(...tenantIds);
    }

    // Fetch remaining from database
    if (uncachedTenants.length > 0) {
      const result = await db.execute(sql`
        SELECT tenant_id, organization_id 
        FROM tenant_org_mappings 
        WHERE tenant_id = ANY(${uncachedTenants}::text[])
        AND migration_status = 'completed'
      `);

      for (const row of result) {
        const tenantId = row.tenant_id as string;
        const orgId = row.organization_id as string;
        mappings.set(tenantId, orgId);
        cache.set(tenantId, orgId);
      }

      // Try slug fallback for unmapped tenants
      const stillUnmapped = uncachedTenants.filter(id => !mappings.has(id));
      if (stillUnmapped.length > 0) {
        const orgs = await db
          .select({ id: organizations.id, slug: organizations.slug })
          .from(organizations)
          .where(inArray(organizations.slug, stillUnmapped));

        for (const org of orgs) {
          mappings.set(org.slug, org.id);
          cache.set(org.slug, org.id);
        }
      }
    }

    return mappings;
  } catch (_error) {
return mappings;
  }
}

/**
 * Validate that a mapping exists and is complete
 */
export async function validateMapping(tenantId: string): Promise<{
  exists: boolean;
  status: string | null;
  organizationId: string | null;
  recordCount: number;
  errorLog: string | null;
}> {
  try {
    const result = await db.execute(sql`
      SELECT 
        organization_id,
        migration_status,
        record_count,
        error_log
      FROM tenant_org_mappings 
      WHERE tenant_id = ${tenantId}
      LIMIT 1
    `);

    if (result.length === 0) {
      return {
        exists: false,
        status: null,
        organizationId: null,
        recordCount: 0,
        errorLog: null,
      };
    }

    const row = result[0];
    return {
      exists: true,
      status: row.migration_status as string,
      organizationId: row.organization_id as string,
      recordCount: Number(row.record_count || 0),
      errorLog: row.error_log as string | null,
    };
  } catch (_error) {
return {
      exists: false,
      status: null,
      organizationId: null,
      recordCount: 0,
      errorLog: null,
    };
  }
}

/**
 * Create a new tenant-to-org mapping
 */
export async function createMapping(
  tenantId: string,
  organizationId: string,
  migratedBy: string
): Promise<boolean> {
  try {
    await db.execute(sql`
      INSERT INTO tenant_org_mappings (
        tenant_id,
        organization_id,
        migration_status,
        migrated_by,
        created_at,
        updated_at
      ) VALUES (
        ${tenantId},
        ${organizationId},
        'pending',
        ${migratedBy},
        NOW(),
        NOW()
      )
      ON CONFLICT (tenant_id) 
      DO UPDATE SET
        organization_id = ${organizationId},
        migrated_by = ${migratedBy},
        updated_at = NOW()
    `);

    cache.clear(); // Invalidate cache
    return true;
  } catch (_error) {
return false;
  }
}

/**
 * Update mapping status
 */
export async function updateMappingStatus(
  tenantId: string,
  status: "pending" | "in_progress" | "completed" | "failed" | "rolled_back",
  recordCount?: number,
  errorLog?: string
): Promise<boolean> {
  try {
    const updates: string[] = [
      `migration_status = '${status}'`,
      `updated_at = NOW()`,
    ];

    if (status === "completed") {
      updates.push(`migrated_at = NOW()`);
    }

    if (recordCount !== undefined) {
      updates.push(`record_count = ${recordCount}`);
    }

    if (errorLog !== undefined) {
      updates.push(`error_log = '${errorLog.replace(/'/g, "''")}'`);
    }

    await db.execute(sql.raw(`
      UPDATE tenant_org_mappings 
      SET ${updates.join(", ")}
      WHERE tenant_id = '${tenantId}'
    `));

    cache.clear(); // Invalidate cache
    return true;
  } catch (_error) {
return false;
  }
}

/**
 * Get all mappings with optional status filter
 */
export async function getAllMappings(
  status?: string
): Promise<TenantOrgMapping[]> {
  try {
    const query = status
      ? sql`SELECT * FROM tenant_org_mappings WHERE migration_status = ${status} ORDER BY created_at DESC`
      : sql`SELECT * FROM tenant_org_mappings ORDER BY created_at DESC`;

    const result = await db.execute(query);

    return result.map((_row: unknown) => {
      const row = _row as Record<string, unknown>;
      return {
        tenantId: row.tenant_id as string,
        organizationId: row.organization_id as string,
        migrationStatus: row.migration_status as TenantOrgMapping['migrationStatus'],
        migratedAt: row.migrated_at as Date | null,
        migratedBy: row.migrated_by as string | null,
        recordCount: Number(row.record_count || 0),
        errorLog: row.error_log as string | null,
        createdAt: row.created_at as Date,
        updatedAt: row.updated_at as Date,
      };
    });
  } catch (_error) {
return [];
  }
}

/**
 * Get migration statistics
 */
export async function getMigrationStats(): Promise<{
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  rolledBack: number;
  totalRecords: number;
}> {
  try {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN migration_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN migration_status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN migration_status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN migration_status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN migration_status = 'rolled_back' THEN 1 ELSE 0 END) as rolled_back,
        SUM(record_count) as total_records
      FROM tenant_org_mappings
    `);

    const row = result[0];
    return {
      total: Number(row.total || 0),
      pending: Number(row.pending || 0),
      inProgress: Number(row.in_progress || 0),
      completed: Number(row.completed || 0),
      failed: Number(row.failed || 0),
      rolledBack: Number(row.rolled_back || 0),
      totalRecords: Number(row.total_records || 0),
    };
  } catch (_error) {
return {
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
      rolledBack: 0,
      totalRecords: 0,
    };
  }
}

/**
 * Refresh the mapping cache
 */
export async function refreshCache(): Promise<void> {
  try {
    cache.clear();
    
    const result = await db.execute(sql`
      SELECT tenant_id, organization_id 
      FROM tenant_org_mappings 
      WHERE migration_status = 'completed'
    `);

    for (const row of result) {
      cache.set(row.tenant_id as string, row.organization_id as string);
    }

    cache.setRefreshTime();
} catch (_error) {
}
}

/**
 * Clear the mapping cache
 */
export function clearCache(): void {
  cache.clear();
}

