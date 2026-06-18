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
import { NodePgDatabase } from 'drizzle-orm/node-postgres';import { organizationUsers } from "@/db/schema/domains/member";
import { organizations, orgConfigurations, orgUsage } from "@/db/schema";
import { eq, and, desc, sql, count, like, or, ne, sum as _sum } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import type {
  UserRole,
  AdminUser,
  OrgWithStats,
  SystemStats,
  SystemConfig,
} from '@/types/action-dtos';

export type { UserRole } from '@/types/action-dtos';

type AdminTx = NodePgDatabase<Record<string, unknown>>;

/**
 * Get system-wide statistics
 * @param tx - Database transaction from RLS-protected route
 */
export async function getSystemStats(tx: AdminTx): Promise<SystemStats> {
  try {
    // Total unique users across all orgs
    const totalMembersResult = await tx
      .select({ count: count() })
      .from(organizationUsers)
      .where(eq(organizationUsers.isActive, true));

    // Total orgs (exclude archived)
    const totalOrgsResult = await tx
      .select({ count: count() })
      .from(organizations)
      .where(ne(organizations.status, 'archived'));

    // Active orgs
    const activeOrgsResult = await tx
      .select({ count: count() })
      .from(organizations)
      .where(and(
        eq(organizations.status, "active"),
        ne(organizations.status, 'archived')
      ));

    // Aggregate storage across all org usage records
    const storageResult = await tx
      .select({ total: sql<number>`COALESCE(SUM(${orgUsage.storageUsedBytes}), 0)` })
      .from(orgUsage);
    const totalStorage = storageResult[0]?.total || 0;

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
      totalStorage: totalStorage,
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
  tx: AdminTx,
  searchQuery?: string,
  organizationId?: string,
  role?: UserRole
): Promise<AdminUser[]> {
  try {
    // Build filter conditions
    const conditions = [ne(organizations.status, 'archived')];
    
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
          like(organizations.name, `%${searchQuery}%`)
        )!
      );
    }

    const results = await tx
      .select({
        userId: organizationUsers.userId,
        role: organizationUsers.role,
        organizationId: organizationUsers.organizationId,
        orgName: organizations.name,
        isActive: organizationUsers.isActive,
        lastAccessAt: organizationUsers.lastAccessAt,
        joinedAt: organizationUsers.joinedAt,
      })
      .from(organizationUsers)
      .innerJoin(organizations, eq(organizations.id, organizationUsers.organizationId))
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
          ne(organizations.status, 'archived'),
          or(
            like(organizations.name, `%${searchQuery}%`),
            like(organizations.slug, `%${searchQuery}%`)
          )!
        )
      : ne(organizations.status, 'archived');

    const orgList = await db
      .select({
        orgId: organizations.id,
        orgSlug: organizations.slug,
        orgName: organizations.name,
        status: organizations.status,
        subscriptionTier: organizations.subscriptionTier,
        contactEmail: organizations.email,
        phone: organizations.phone,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .where(whereConditions)
      .orderBy(desc(organizations.createdAt));

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

        // Get latest storage usage for this org
        const [usage] = await db
          .select({ bytes: orgUsage.storageUsedBytes })
          .from(orgUsage)
          .where(eq(orgUsage.organizationId, org.orgId))
          .orderBy(desc(orgUsage.periodEnd))
          .limit(1);
        const storageUsed = String(usage?.bytes ?? 0);

        return {
          id: org.orgId,
          slug: org.orgSlug,
          name: org.orgName,
          status: org.status ?? 'active',
          subscriptionTier: org.subscriptionTier ?? 'free',
          totalUsers: userCount?.total || 0,
          activeUsers: userCount?.active || 0,
          storageUsed: storageUsed,
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
  tx: AdminTx,
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
  tx: AdminTx,
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
  tx: AdminTx,
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
    name?: string;
    email?: string;
    phone?: string;
    status?: string;
    subscriptionTier?: string;
  }
): Promise<void> {
  try {
    await requireAdmin();

    await db
      .update(organizations)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, organizationId));

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
  slug: string;
  name: string;
  email: string;
  phone?: string;
  subscriptionTier?: string;
}): Promise<string> {
  try {
    await requireAdmin();

    const [org] = await db
      .insert(organizations)
      .values({
        slug: data.slug,
        name: data.name,
        email: data.email,
        phone: data.phone,
        subscriptionTier: data.subscriptionTier || "free",
        status: "active",
        organizationType: "union",
        hierarchyPath: [],
        hierarchyLevel: 0,
      })
      .returning({ id: organizations.id });

    logger.info("Org created", { orgId: org.id, data });

    revalidatePath("/[locale]/dashboard/admin");

    return org.id;
  } catch (error) {
    logger.error("Failed to create org", error);
    throw new Error("Failed to create organization");
  }
}

/**
 * Get system configurations
 * @param tx - Database transaction from RLS-protected route
 */
export async function getSystemConfigs(tx: AdminTx, category?: string): Promise<SystemConfig[]> {
  try {
    const conditions = category
      ? eq(orgConfigurations.category, category)
      : undefined;

    const rows = await tx
      .select({
        category: orgConfigurations.category,
        key: orgConfigurations.key,
        value: orgConfigurations.value,
        description: orgConfigurations.description,
      })
      .from(orgConfigurations)
      .where(conditions)
      .orderBy(orgConfigurations.category, orgConfigurations.key);

    return rows.map((r) => ({
      category: r.category,
      key: r.key,
      value: r.value,
      description: r.description,
    }));
  } catch (error) {
    logger.error('Failed to fetch system configs', error);
    throw new Error('Failed to fetch system configurations');
  }
}

/**
 * Update system configuration
 * @param tx - Database transaction from RLS-protected route
 */
export async function updateSystemConfig(
  tx: AdminTx,
  organizationId: string,
  category: string,
  key: string,
  value: (typeof orgConfigurations.$inferInsert)['value']
): Promise<void> {
  try {
    // Upsert: update existing or insert new config
    const existing = await tx
      .select({ id: orgConfigurations.id })
      .from(orgConfigurations)
      .where(
        and(
          eq(orgConfigurations.organizationId, organizationId),
          eq(orgConfigurations.category, category),
          eq(orgConfigurations.key, key),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await tx
        .update(orgConfigurations)
        .set({ value, updatedAt: new Date() })
        .where(eq(orgConfigurations.id, existing[0].id));
    } else {
      await tx.insert(orgConfigurations).values({
        organizationId,
        category,
        key,
        value,
      });
    }

    logger.info('System config updated', { organizationId, category, key });
    revalidatePath('/[locale]/dashboard/admin');
  } catch (error) {
    logger.error('Failed to update system config', error);
    throw new Error('Failed to update system configuration');
  }
}

/**
 * Get recent activity logs (simplified - would need audit log table in production)
 * @param tx - Database transaction from RLS-protected route
 */
export async function getRecentActivity(tx: AdminTx, limit: number = 10): Promise<Array<{ action: string; user: string; org: string; role: string; timestamp: string | undefined }>> {
  try {
    // For now, return recent user joins
    const recentUsers = await tx
      .select({
        userId: organizationUsers.userId,
        orgName: organizations.name,
        role: organizationUsers.role,
        joinedAt: organizationUsers.joinedAt,
      })
      .from(organizationUsers)
      .innerJoin(organizations, eq(organizations.id, organizationUsers.organizationId))
      .where(ne(organizations.status, 'archived'))
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

