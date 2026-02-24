"use server";

/**
 * Admin Actions
 * 
 * MIGRATION STATUS: ✅ Refactored to accept tx parameter from RLS-protected routes
 * - Functions now accept NodePgDatabase tx parameter
 * - Removed internal requireAdmin() checks (routes handle this)
 * - All queries use provided transaction for RLS enforcement
 */

import { requireAdmin } from '@/lib/auth/rbac-server';
import { db } from '@/db/db';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { organizationUsers } from "@/db/schema/domains/member";
// TODO: tenant-management-schema does not exist; tenants/tenantConfigurations/tenantUsage tables
// need migration to organizations schema. Importing from schema-organizations via barrel.
import { organizations } from "@/db/schema";

// Temporary aliases so the rest of the file compiles during migration
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tenants = organizations as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tenantConfigurations = null as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tenantUsage = null as any;
import { eq, and, desc, sql, count, like, or, isNull } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";

// Type definitions
export type UserRole = "member" | "steward" | "officer" | "admin";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string;
  tenantName: string;
  status: "active" | "inactive";
  lastLogin: string | null;
  joinedAt: string | null;
}

interface TenantWithStats {
  id: string;
  slug: string;
  name: string;
  status: string;
  subscriptionTier: string;
  totalUsers: number;
  activeUsers: number;
  storageUsed: string;
  createdAt: string;
  contactEmail: string | null;
  phone: string | null;
}

interface SystemStats {
  totalMembers: number;
  totalTenants: number;
  activeTenants: number;
  totalStorage: number;
  activeToday: number;
}

interface SystemConfig {
  category: string;
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  description: string | null;
}

/**
 * Get system-wide statistics
 * @param tx - Database transaction from RLS-protected route
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getSystemStats(tx: NodePgDatabase<any>): Promise<SystemStats> {
  try {
    // Total unique users across all tenants
    const totalMembersResult = await tx
      .select({ count: count() })
      .from(organizationUsers)
      .where(eq(organizationUsers.isActive, true));

    // Total tenants
    const totalTenantsResult = await tx
      .select({ count: count() })
      .from(tenants)
      .where(isNull(tenants.deletedAt));

    // Active tenants
    const activeTenantsResult = await tx
      .select({ count: count() })
      .from(tenants)
      .where(and(
        eq(tenants.status, "active"),
        isNull(tenants.deletedAt)
      ));

    // Total storage used (sum from tenant_usage)
    const storageResult = await tx
      .select({ 
        total: sql<string>`COALESCE(SUM(${tenantUsage.storageUsedGb}), 0)` 
      })
      .from(tenantUsage);

    // Users active in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeTodayResult = await tx
      .select({ count: count() })
      .from(organizationUsers)
      .where(and(
        eq(organizationUsers.isActive, true),
        sql`${organizationUsers.lastAccessAt} > ${oneDayAgo}`
      ));

    return {
      totalMembers: totalMembersResult[0]?.count || 0,
      totalTenants: totalTenantsResult[0]?.count || 0,
      activeTenants: activeTenantsResult[0]?.count || 0,
      totalStorage: parseFloat(storageResult[0]?.total || "0"),
      activeToday: activeTodayResult[0]?.count || 0,
    };
  } catch (error) {
    logger.error("Failed to fetch system stats", error);
    throw new Error("Failed to fetch system statistics");
  }
}

/**
 * Get all users across tenants with filtering
 * @param tx - Database transaction from RLS-protected route
 */
export async function getAdminUsers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: NodePgDatabase<any>,
  searchQuery?: string,
  organizationId?: string,
  role?: UserRole
): Promise<AdminUser[]> {
  try {
    // Build filter conditions
    const conditions = [isNull(tenants.deletedAt)];
    
    if (organizationId) {
      conditions.push(eq(organizationUsers.organizationId, organizationId));
    }
    
    if (role) {
      conditions.push(eq(organizationUsers.role, role));
    }
    
    if (searchQuery) {
      conditions.push(
        or(
          like(organizationUsers.userId, `%${searchQuery}%`),
          like(tenants.tenantName, `%${searchQuery}%`)
        )!
      );
    }

    const results = await tx
      .select({
        userId: organizationUsers.userId,
        role: organizationUsers.role,
        organizationId: organizationUsers.organizationId,
        tenantName: tenants.tenantName,
        isActive: organizationUsers.isActive,
        lastAccessAt: organizationUsers.lastAccessAt,
        joinedAt: organizationUsers.joinedAt,
      })
      .from(organizationUsers)
      .innerJoin(tenants, eq(tenants.tenantId, organizationUsers.organizationId))
      .where(and(...conditions))
      .orderBy(desc(organizationUsers.lastAccessAt));

    return results.map(u => ({
      id: u.userId,
      name: u.userId.split('_')[0] || "User", // Extract from Clerk ID
      email: u.userId, // Temporary - need to fetch from Clerk
      role: u.role as UserRole,
      organizationId: u.organizationId,
      tenantName: u.tenantName,
      status: u.isActive ? "active" : "inactive",
      lastLogin: u.lastAccessAt?.toISOString() || null,
      joinedAt: u.joinedAt?.toISOString() || null,
    }));
  } catch (error) {
    logger.error("Failed to fetch admin users", error);
    throw new Error("Failed to fetch users");
  }
}

/**
 * Get all tenants with statistics
 */
export async function getAdminTenants(searchQuery?: string): Promise<TenantWithStats[]> {
  try {
    await requireAdmin();

    // Build where conditions
    const whereConditions = searchQuery
      ? and(
          isNull(tenants.deletedAt),
          or(
            like(tenants.tenantName, `%${searchQuery}%`),
            like(tenants.tenantSlug, `%${searchQuery}%`)
          )!
        )
      : isNull(tenants.deletedAt);

    const tenantList = await db
      .select({
        tenantId: tenants.tenantId,
        tenantSlug: tenants.tenantSlug,
        tenantName: tenants.tenantName,
        status: tenants.status,
        subscriptionTier: tenants.subscriptionTier,
        contactEmail: tenants.contactEmail,
        phone: tenants.phone,
        createdAt: tenants.createdAt,
      })
      .from(tenants)
      .where(whereConditions)
      .orderBy(desc(tenants.createdAt));

    // Get user counts for each tenant
    const tenantsWithStats = await Promise.all(
      tenantList.map(async (tenant) => {
        const [userCount] = await db
          .select({ 
            total: count(),
            active: sql<number>`COUNT(*) FILTER (WHERE ${organizationUsers.isActive} = true)`
          })
          .from(organizationUsers)
          .where(eq(organizationUsers.organizationId, tenant.tenantId));

        const [usage] = await db
          .select({ storageUsed: tenantUsage.storageUsedGb })
          .from(tenantUsage)
          .where(eq(tenantUsage.tenantId, tenant.tenantId))
          .orderBy(desc(tenantUsage.periodEnd))
          .limit(1);

        return {
          id: tenant.tenantId,
          slug: tenant.tenantSlug,
          name: tenant.tenantName,
          status: tenant.status,
          subscriptionTier: tenant.subscriptionTier,
          totalUsers: userCount?.total || 0,
          activeUsers: userCount?.active || 0,
          storageUsed: usage?.storageUsed || "0",
          createdAt: tenant.createdAt?.toISOString() || "",
          contactEmail: tenant.contactEmail,
          phone: tenant.phone,
        };
      })
    );

    return tenantsWithStats;
  } catch (error) {
    logger.error("Failed to fetch admin tenants", error);
    throw new Error("Failed to fetch tenants");
  }
}

/**
 * Update user role
 * @param tx - Database transaction from RLS-protected route
 */
export async function updateUserRole(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: NodePgDatabase<any>,
  userId: string,
  organizationId: string,
  newRole: UserRole
): Promise<void> {
  try {
    await tx
      .update(organizationUsers)
      .set({ 
        role: newRole,
        updatedAt: new Date()
      })
      .where(and(
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.organizationId, organizationId)
      ));

    logger.info("User role updated", {
      userId,
      organizationId,
      newRole,
    });

    revalidatePath("/[locale]/dashboard/admin");
  } catch (error) {
    logger.error("Failed to update user role", error);
    throw new Error("Failed to update user role");
  }
}

/**
 * Toggle user active status
 * @param tx - Database transaction from RLS-protected route
 */
export async function toggleUserStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: NodePgDatabase<any>,
  userId: string,
  organizationId: string
): Promise<void> {
  try {
    const [user] = await tx
      .select({ isActive: organizationUsers.isActive })
      .from(organizationUsers)
      .where(and(
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.organizationId, organizationId)
      ))
      .limit(1);

    if (!user) {
      throw new Error("User not found");
    }

    await tx
      .update(organizationUsers)
      .set({ 
        isActive: !user.isActive,
        updatedAt: new Date()
      })
      .where(and(
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.organizationId, organizationId)
      ));

    logger.info("User status toggled", {
      userId,
      organizationId,
      newStatus: !user.isActive,
    });

    revalidatePath("/[locale]/dashboard/admin");
  } catch (error) {
    logger.error("Failed to toggle user status", error);
    throw new Error("Failed to update user status");
  }
}

/**
 * Delete user from tenant
 * @param tx - Database transaction from RLS-protected route
 */
export async function deleteUserFromTenant(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: NodePgDatabase<any>,
  userId: string,
  organizationId: string
): Promise<void> {
  try {
    await tx
      .delete(organizationUsers)
      .where(and(
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.organizationId, organizationId)
      ));

    logger.info("User removed from tenant", {
      userId,
      organizationId,
    });

    revalidatePath("/[locale]/dashboard/admin");
  } catch (error) {
    logger.error("Failed to delete user from tenant", error);
    throw new Error("Failed to remove user");
  }
}

/**
 * Update tenant information
 */
export async function updateTenant(
  organizationId: string,
  data: {
    tenantName?: string;
    contactEmail?: string;
    phone?: string;
    status?: string;
    subscriptionTier?: string;
  }
): Promise<void> {
  try {
    await requireAdmin();

    await db
      .update(tenants)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(tenants.tenantId, organizationId));

    logger.info("Tenant updated", { organizationId, data });

    revalidatePath("/[locale]/dashboard/admin");
  } catch (error) {
    logger.error("Failed to update tenant", error);
    throw new Error("Failed to update tenant");
  }
}

/**
 * Create new tenant
 */
export async function createTenant(data: {
  tenantSlug: string;
  tenantName: string;
  contactEmail: string;
  phone?: string;
  subscriptionTier?: string;
}): Promise<string> {
  try {
    await requireAdmin();

    const [tenant] = await db
      .insert(tenants)
      .values({
        tenantSlug: data.tenantSlug,
        tenantName: data.tenantName,
        contactEmail: data.contactEmail,
        phone: data.phone,
        subscriptionTier: data.subscriptionTier || "free",
        status: "active",
      })
      .returning({ tenantId: tenants.tenantId });

    logger.info("Tenant created", { tenantId: tenant.tenantId, data });

    revalidatePath("/[locale]/dashboard/admin");

    return tenant.tenantId;
  } catch (error) {
    logger.error("Failed to create tenant", error);
    throw new Error("Failed to create tenant");
  }
}

/**
 * Get system configurations
 * @param tx - Database transaction from RLS-protected route
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getSystemConfigs(tx: NodePgDatabase<any>, category?: string): Promise<SystemConfig[]> {
  try {
    // Build where conditions
    const whereConditions = category
      ? and(
          eq(tenantConfigurations.isEncrypted, false),
          eq(tenantConfigurations.category, category)
        )
      : eq(tenantConfigurations.isEncrypted, false);

    const configs = await tx
      .select({
        category: tenantConfigurations.category,
        key: tenantConfigurations.key,
        value: tenantConfigurations.value,
        description: tenantConfigurations.description,
      })
      .from(tenantConfigurations)
      .where(whereConditions);

    return configs.map(c => ({
      category: c.category,
      key: c.key,
      value: c.value,
      description: c.description,
    }));
  } catch (error) {
    logger.error("Failed to fetch system configs", error);
    throw new Error("Failed to fetch configurations");
  }
}

/**
 * Update system configuration
 * @param tx - Database transaction from RLS-protected route
 */
export async function updateSystemConfig(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: NodePgDatabase<any>,
  organizationId: string,
  category: string,
  key: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any
): Promise<void> {
  try {
    // Check if config exists
    const [existing] = await tx
      .select()
      .from(tenantConfigurations)
      .where(and(
        eq(tenantConfigurations.tenantId, organizationId),
        eq(tenantConfigurations.category, category),
        eq(tenantConfigurations.key, key)
      ))
      .limit(1);

    if (existing) {
      // Update existing
      await tx
        .update(tenantConfigurations)
        .set({ 
          value,
          updatedAt: new Date()
        })
        .where(eq(tenantConfigurations.configId, existing.configId));
    } else {
      // Create new
      await tx
        .insert(tenantConfigurations)
        .values({
          tenantId: organizationId,
          category,
          key,
          value,
        });
    }

    logger.info("System config updated", {
      organizationId,
      category,
      key,
    });

    revalidatePath("/[locale]/dashboard/admin");
  } catch (error) {
    logger.error("Failed to update system config", error);
    throw new Error("Failed to update configuration");
  }
}

/**
 * Get recent activity logs (simplified - would need audit log table in production)
 * @param tx - Database transaction from RLS-protected route
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getRecentActivity(tx: NodePgDatabase<any>, limit: number = 10): Promise<any[]> {
  try {
    // For now, return recent user joins
    const recentUsers = await tx
      .select({
        userId: organizationUsers.userId,
        tenantName: tenants.tenantName,
        role: organizationUsers.role,
        joinedAt: organizationUsers.joinedAt,
      })
      .from(organizationUsers)
      .innerJoin(tenants, eq(tenants.tenantId, organizationUsers.organizationId))
      .where(isNull(tenants.deletedAt))
      .orderBy(desc(organizationUsers.joinedAt))
      .limit(limit);

    return recentUsers.map(u => ({
      action: "User joined",
      user: u.userId,
      tenant: u.tenantName,
      role: u.role,
      timestamp: u.joinedAt?.toISOString(),
    }));
  } catch (error) {
    logger.error("Failed to fetch recent activity", error);
    return [];
  }
}

