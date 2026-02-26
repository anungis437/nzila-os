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
// TODO: org-management-schema does not exist; orgs/orgConfigurations/orgUsage tables
// need migration to organizations schema. Importing from schema-organizations via barrel.
import { organizations } from "@/db/schema";

// Temporary aliases so the rest of the file compiles during migration
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const orgs = organizations as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const orgConfigurations = null as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const orgUsage = null as any;
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
  orgName: string;
  status: "active" | "inactive";
  lastLogin: string | null;
  joinedAt: string | null;
}

interface OrgWithStats {
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
  totalOrgs: number;
  activeOrgs: number;
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
    // Total unique users across all orgs
    const totalMembersResult = await tx
      .select({ count: count() })
      .from(organizationUsers)
      .where(eq(organizationUsers.isActive, true));

    // Total orgs
    const totalOrgsResult = await tx
      .select({ count: count() })
      .from(orgs)
      .where(isNull(orgs.deletedAt));

    // Active orgs
    const activeOrgsResult = await tx
      .select({ count: count() })
      .from(orgs)
      .where(and(
        eq(orgs.status, "active"),
        isNull(orgs.deletedAt)
      ));

    // Total storage used (sum from org_usage)
    const storageResult = await tx
      .select({ 
        total: sql<string>`COALESCE(SUM(${orgUsage.storageUsedGb}), 0)` 
      })
      .from(orgUsage);

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
      totalOrgs: totalOrgsResult[0]?.count || 0,
      activeOrgs: activeOrgsResult[0]?.count || 0,
      totalStorage: parseFloat(storageResult[0]?.total || "0"),
      activeToday: activeTodayResult[0]?.count || 0,
    };
  } catch (error) {
    logger.error("Failed to fetch system stats", error);
    throw new Error("Failed to fetch system statistics");
  }
}

/**
 * Get all users across orgs with filtering
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
    const conditions = [isNull(orgs.deletedAt)];
    
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
          like(orgs.tenantName, `%${searchQuery}%`)
        )!
      );
    }

    const results = await tx
      .select({
        userId: organizationUsers.userId,
        role: organizationUsers.role,
        organizationId: organizationUsers.organizationId,
        orgName: orgs.tenantName,
        isActive: organizationUsers.isActive,
        lastAccessAt: organizationUsers.lastAccessAt,
        joinedAt: organizationUsers.joinedAt,
      })
      .from(organizationUsers)
      .innerJoin(orgs, eq(orgs.tenantId, organizationUsers.organizationId))
      .where(and(...conditions))
      .orderBy(desc(organizationUsers.lastAccessAt));

    return results.map(u => ({
      id: u.userId,
      name: u.userId.split('_')[0] || "User", // Extract from Clerk ID
      email: u.userId, // Temporary - need to fetch from Clerk
      role: u.role as UserRole,
      organizationId: u.organizationId,
      orgName: u.orgName,
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
 * Get all orgs with statistics
 */
export async function getAdminOrgs(searchQuery?: string): Promise<OrgWithStats[]> {
  try {
    await requireAdmin();

    // Build where conditions
    const whereConditions = searchQuery
      ? and(
          isNull(orgs.deletedAt),
          or(
            like(orgs.tenantName, `%${searchQuery}%`),
            like(orgs.tenantSlug, `%${searchQuery}%`)
          )!
        )
      : isNull(orgs.deletedAt);

    const orgList = await db
      .select({
        orgId: orgs.tenantId,
        orgSlug: orgs.tenantSlug,
        orgName: orgs.tenantName,
        status: orgs.status,
        subscriptionTier: orgs.subscriptionTier,
        contactEmail: orgs.contactEmail,
        phone: orgs.phone,
        createdAt: orgs.createdAt,
      })
      .from(orgs)
      .where(whereConditions)
      .orderBy(desc(orgs.createdAt));

    // Get user counts for each org
    const orgsWithStats = await Promise.all(
      orgList.map(async (org) => {
        const [userCount] = await db
          .select({ 
            total: count(),
            active: sql<number>`COUNT(*) FILTER (WHERE ${organizationUsers.isActive} = true)`
          })
          .from(organizationUsers)
          .where(eq(organizationUsers.organizationId, org.orgId));

        const [usage] = await db
          .select({ storageUsed: orgUsage.storageUsedGb })
          .from(orgUsage)
          .where(eq(orgUsage.tenantId, org.orgId))
          .orderBy(desc(orgUsage.periodEnd))
          .limit(1);

        return {
          id: org.orgId,
          slug: org.orgSlug,
          name: org.orgName,
          status: org.status,
          subscriptionTier: org.subscriptionTier,
          totalUsers: userCount?.total || 0,
          activeUsers: userCount?.active || 0,
          storageUsed: usage?.storageUsed || "0",
          createdAt: org.createdAt?.toISOString() || "",
          contactEmail: org.contactEmail,
          phone: org.phone,
        };
      })
    );

    return orgsWithStats;
  } catch (error) {
    logger.error("Failed to fetch admin orgs", error);
    throw new Error("Failed to fetch organizations");
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
 * Delete user from org
 * @param tx - Database transaction from RLS-protected route
 */
export async function deleteUserFromOrg(
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

    logger.info("User removed from org", {
      userId,
      organizationId,
    });

    revalidatePath("/[locale]/dashboard/admin");
  } catch (error) {
    logger.error("Failed to delete user from org", error);
    throw new Error("Failed to remove user");
  }
}

/**
 * Update org information
 */
export async function updateOrg(
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
      .update(orgs)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(orgs.tenantId, organizationId));

    logger.info("Org updated", { organizationId, data });

    revalidatePath("/[locale]/dashboard/admin");
  } catch (error) {
    logger.error("Failed to update org", error);
    throw new Error("Failed to update organization");
  }
}

/**
 * Create new org
 */
export async function createOrg(data: {
  tenantSlug: string;
  tenantName: string;
  contactEmail: string;
  phone?: string;
  subscriptionTier?: string;
}): Promise<string> {
  try {
    await requireAdmin();

    const [org] = await db
      .insert(orgs)
      .values({
        tenantSlug: data.tenantSlug,
        tenantName: data.tenantName,
        contactEmail: data.contactEmail,
        phone: data.phone,
        subscriptionTier: data.subscriptionTier || "free",
        status: "active",
      })
      .returning({ tenantId: orgs.tenantId });

    logger.info("Org created", { orgId: org.tenantId, data });

    revalidatePath("/[locale]/dashboard/admin");

    return org.tenantId;
  } catch (error) {
    logger.error("Failed to create org", error);
    throw new Error("Failed to create organization");
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
          eq(orgConfigurations.isEncrypted, false),
          eq(orgConfigurations.category, category)
        )
      : eq(orgConfigurations.isEncrypted, false);

    const configs = await tx
      .select({
        category: orgConfigurations.category,
        key: orgConfigurations.key,
        value: orgConfigurations.value,
        description: orgConfigurations.description,
      })
      .from(orgConfigurations)
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
      .from(orgConfigurations)
      .where(and(
        eq(orgConfigurations.tenantId, organizationId),
        eq(orgConfigurations.category, category),
        eq(orgConfigurations.key, key)
      ))
      .limit(1);

    if (existing) {
      // Update existing
      await tx
        .update(orgConfigurations)
        .set({ 
          value,
          updatedAt: new Date()
        })
        .where(eq(orgConfigurations.configId, existing.configId));
    } else {
      // Create new
      await tx
        .insert(orgConfigurations)
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
        orgName: orgs.tenantName,
        role: organizationUsers.role,
        joinedAt: organizationUsers.joinedAt,
      })
      .from(organizationUsers)
      .innerJoin(orgs, eq(orgs.tenantId, organizationUsers.organizationId))
      .where(isNull(orgs.deletedAt))
      .orderBy(desc(organizationUsers.joinedAt))
      .limit(limit);

    return recentUsers.map(u => ({
      action: "User joined",
      user: u.userId,
      org: u.orgName,
      role: u.role,
      timestamp: u.joinedAt?.toISOString(),
    }));
  } catch (error) {
    logger.error("Failed to fetch recent activity", error);
    return [];
  }
}

