/**
 * Organization member queries.
 *
 * These functions are not Server Actions. Reads used by role resolution
 * already carry an organization id. Mutations are bound to that same
 * organization and cannot rewrite identity, ownership, or role through a
 * generic payload. `withRLSContext` is always called with that organization.
 *
 * The administration service is the authorization boundary for member
 * workflows. The only production importer of this module is role-middleware,
 * and it calls `getMemberByUserId`.
 *
 * This module does not prove that a deployed database enforces row-level security.
 */

import 'server-only'

import { organizationMembers, type SelectOrganizationMember, type InsertOrganizationMember } from "../schema/organization-members-schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { withRLSContext, type RLSTx } from "@/lib/db/with-rls-context";
import {
  assertRegisteredMemberGrant,
  assertTenantAssignableRole,
  authorizeMemberAccess,
  MemberBoundaryError,
  type MemberAccessGrant,
  type MemberCapability,
} from "@/lib/member-integrity/authorize-member-access";
import { persistDurableMemberAudit } from "@/lib/member-integrity/durable-member-audit";
import {
  assertActiveAdministratorsRemain,
  assertMemberRemovalPolicy,
  assertMemberStatusTransition,
  deactivatesEffectiveAdministrator,
  FINANCIAL_EXEMPTION_FIELDS,
  lockAdministratorRoster,
  rejectClientFinancialExemption,
} from "@/lib/member-integrity/member-write-policy";

const PROTECTED_UPDATE_FIELDS = [
  "id",
  "userId",
  "organizationId",
  "role",
  "createdAt",
  "deletedAt",
  "joinedAt",
  ...FINANCIAL_EXEMPTION_FIELDS,
] as const;

function assertOrganization(organizationId: string): string {
  if (typeof organizationId !== "string" || organizationId.trim() === "") {
    throw new MemberBoundaryError("Forbidden");
  }
  return organizationId.trim();
}

function assertMutableUpdate(updates: object): void {
  const record = updates as Record<string, unknown>;
  for (const field of PROTECTED_UPDATE_FIELDS) {
    if (record[field] !== undefined) throw new MemberBoundaryError("Forbidden");
  }
}

function requireMutationGrant(
  grant: MemberAccessGrant,
  organizationId: string,
  capability: MemberCapability,
): MemberAccessGrant {
  assertRegisteredMemberGrant(grant);
  if (grant.organizationId !== organizationId || grant.capability !== capability) {
    throw new MemberBoundaryError("Forbidden");
  }
  return grant;
}

function membershipInsert(
  member: InsertOrganizationMember,
  organizationId: string,
  role: string,
): InsertOrganizationMember {
  const source = { ...(member as Record<string, unknown>) };
  delete source.id;
  delete source.deletedAt;
  delete source.createdAt;
  delete source.organizationId;
  delete source.role;
  for (const field of FINANCIAL_EXEMPTION_FIELDS) delete source[field];
  return { ...source, organizationId, role } as InsertOrganizationMember;
}

async function inOrganization<T>(
  organizationId: string,
  tx: RLSTx | undefined,
  operation: (db: RLSTx, organizationId: string) => Promise<T>,
): Promise<T> {
  const scoped = assertOrganization(organizationId);
  if (tx) return operation(tx, scoped);
  return withRLSContext({ organizationId: scoped }, (db) => operation(db, scoped));
}

export async function getOrganizationMembers(
  organizationId: string,
  tx?: RLSTx,
): Promise<SelectOrganizationMember[]> {
  return inOrganization(organizationId, tx, (db, organizationId) => db
    .select()
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.organizationId, organizationId),
      isNull(organizationMembers.deletedAt),
    ))
    .orderBy(desc(organizationMembers.createdAt)));
}

export async function getMemberById(
  organizationId: string,
  id: string,
  tx?: RLSTx,
): Promise<SelectOrganizationMember | undefined> {
  return inOrganization(organizationId, tx, async (db, organizationId) => {
    const result = await db
      .select()
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.id, id),
        isNull(organizationMembers.deletedAt),
      ))
      .limit(1);
    return result[0];
  });
}

export async function getMemberByUserId(
  organizationId: string,
  userId: string,
  tx?: RLSTx,
): Promise<SelectOrganizationMember | undefined> {
  return inOrganization(organizationId, tx, async (db, organizationId) => {
    const result = await db
      .select()
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
        isNull(organizationMembers.deletedAt),
      ))
      .limit(1);
    return result[0];
  });
}

export async function createMember(
  member: InsertOrganizationMember,
  grant: MemberAccessGrant,
  tx?: RLSTx,
): Promise<SelectOrganizationMember> {
  rejectClientFinancialExemption(member, "create");
  const organizationId = assertOrganization(member.organizationId ?? "");
  const role = member.role ?? "member";
  assertTenantAssignableRole(role);
  const capability: MemberCapability = role === "member" ? "administer" : "assign_role";
  const scopedGrant = requireMutationGrant(grant, organizationId, capability);
  return inOrganization(organizationId, tx, async (db, organizationId) => {
    const result = await db.insert(organizationMembers).values(
      membershipInsert(member, organizationId, role),
    ).returning();
    if (!result[0]) throw new Error("Failed to create member");
    await persistDurableMemberAudit(db, {
      actorUserId: scopedGrant.userId,
      organizationId,
      operation: role === "member" ? "create" : "role_change",
      targetId: result[0].id,
    });
    return result[0];
  });
}

export async function addOrganizationMember(params: {
  organizationId: string;
  userId: string;
  role: "member" | "steward" | "officer" | "admin";
  isPrimary?: boolean;
  name: string;
  email: string;
  phone?: string | null;
  grant: MemberAccessGrant;
}): Promise<SelectOrganizationMember> {
  assertTenantAssignableRole(params.role);
  const capability: MemberCapability = params.role === "member" ? "administer" : "assign_role";
  requireMutationGrant(params.grant, assertOrganization(params.organizationId), capability);
  const existing = await getMemberByUserId(params.organizationId, params.userId);
  if (existing) return existing;
  return createMember({
    organizationId: params.organizationId,
    userId: params.userId,
    role: params.role,
    status: "active",
    isPrimary: params.isPrimary ?? false,
    name: params.name,
    email: params.email,
    phone: params.phone ?? undefined,
  }, params.grant);
}

export async function updateMember(
  organizationId: string,
  id: string,
  updates: Partial<InsertOrganizationMember>,
  grant: MemberAccessGrant,
  tx?: RLSTx,
): Promise<SelectOrganizationMember | undefined> {
  assertMutableUpdate(updates);
  const scoped = assertOrganization(organizationId);
  const scopedGrant = requireMutationGrant(grant, scoped, "administer");
  return inOrganization(scoped, tx, async (db, organizationId) => {
    if (updates.status !== undefined) {
      const roster = await lockAdministratorRoster(db, organizationId);
      const current = await db
        .select()
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.id, id),
          eq(organizationMembers.organizationId, organizationId),
          isNull(organizationMembers.deletedAt),
        ))
        .limit(1);
      if (!current[0]) return undefined;
      assertMemberStatusTransition(String(current[0].status), String(updates.status));
      const projection = [{ id: current[0].id, status: String(updates.status) }];
      if (deactivatesEffectiveAdministrator(roster, projection)) {
        const removal = await authorizeMemberAccess(organizationId, "remove_member");
        if (!removal.ok) throw new MemberBoundaryError(removal.message);
      }
      assertActiveAdministratorsRemain(roster, projection);
    }
    const result = await db
      .update(organizationMembers)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(organizationMembers.id, id),
        eq(organizationMembers.organizationId, organizationId),
        isNull(organizationMembers.deletedAt),
      ))
      .returning();
    if (!result[0]) return undefined;
    await persistDurableMemberAudit(db, {
      actorUserId: scopedGrant.userId,
      organizationId,
      operation: updates.status !== undefined ? "status_change" : "update",
      targetId: result[0].id,
    });
    return result[0];
  });
}

export async function deleteMember(
  organizationId: string,
  id: string,
  grant: MemberAccessGrant,
  tx?: RLSTx,
): Promise<boolean> {
  const scoped = assertOrganization(organizationId);
  const scopedGrant = requireMutationGrant(grant, scoped, "remove_member");
  return inOrganization(scoped, tx, async (db, organizationId) => {
    const roster = await lockAdministratorRoster(db, organizationId);
    const existing = await db
      .select()
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.id, id),
        eq(organizationMembers.organizationId, organizationId),
        isNull(organizationMembers.deletedAt),
      ))
      .limit(1);
    const target = existing[0];
    if (!target) return false;
    assertMemberRemovalPolicy({
      actorUserId: scopedGrant.userId,
      targetUserId: target.userId,
    });
    assertActiveAdministratorsRemain(roster, [{ id: target.id, deletedAt: new Date() }]);
    const result = await db
      .update(organizationMembers)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(organizationMembers.id, id),
        eq(organizationMembers.organizationId, organizationId),
        isNull(organizationMembers.deletedAt),
      ))
      .returning();
    if (result.length === 0) return false;
    await persistDurableMemberAudit(db, {
      actorUserId: scopedGrant.userId,
      organizationId,
      operation: "soft_delete",
      targetId: result[0].id,
    });
    return true;
  });
}

export async function getMemberCount(organizationId: string, tx?: RLSTx): Promise<number> {
  return inOrganization(organizationId, tx, async (db, organizationId) => {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, organizationId),
        isNull(organizationMembers.deletedAt),
      ));
    return result[0]?.count || 0;
  });
}

export async function getActiveMemberCount(organizationId: string, tx?: RLSTx): Promise<number> {
  return inOrganization(organizationId, tx, async (db, organizationId) => {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.status, "active"),
        isNull(organizationMembers.deletedAt),
      ));
    return result[0]?.count || 0;
  });
}

export async function getMembersByRole(
  organizationId: string,
  role: "member" | "steward" | "officer" | "admin",
  tx?: RLSTx,
): Promise<SelectOrganizationMember[]> {
  return inOrganization(organizationId, tx, (db, organizationId) => db
    .select()
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.role, role),
      isNull(organizationMembers.deletedAt),
    ))
    .orderBy(desc(organizationMembers.createdAt)));
}

export async function getMembersByStatus(
  organizationId: string,
  status: "active" | "inactive" | "on-leave",
  tx?: RLSTx,
): Promise<SelectOrganizationMember[]> {
  return inOrganization(organizationId, tx, (db, organizationId) => db
    .select()
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.status, status),
      isNull(organizationMembers.deletedAt),
    ))
    .orderBy(desc(organizationMembers.createdAt)));
}

export async function searchMembers(
  organizationId: string,
  searchQuery: string,
  filters?: {
    role?: "member" | "steward" | "officer" | "admin";
    status?: "active" | "inactive" | "on-leave";
    department?: string;
  },
  tx?: RLSTx,
): Promise<SelectOrganizationMember[]> {
  return inOrganization(organizationId, tx, async (db, organizationId) => {
    const conditions = [
      eq(organizationMembers.organizationId, organizationId),
      isNull(organizationMembers.deletedAt),
    ];
    const memberVector = sql`to_tsvector('english', coalesce(${organizationMembers.name}, '') || ' ' || coalesce(${organizationMembers.email}, '') || ' ' || coalesce(${organizationMembers.membershipNumber}, ''))`;
    if (searchQuery && searchQuery.trim()) {
      const tsQuery = searchQuery.trim().split(/\s+/).join(" & ");
      conditions.push(sql`${memberVector} @@ to_tsquery('english', ${tsQuery})`);
    }
    if (filters?.role) conditions.push(eq(organizationMembers.role, filters.role));
    if (filters?.status) conditions.push(eq(organizationMembers.status, filters.status));
    if (filters?.department) conditions.push(eq(organizationMembers.department, filters.department));
    const query = db.select().from(organizationMembers).where(and(...conditions));
    if (searchQuery && searchQuery.trim()) {
      const tsQuery = searchQuery.trim().split(/\s+/).join(" & ");
      return query.orderBy(sql`ts_rank(${memberVector}, to_tsquery('english', ${tsQuery})) DESC`);
    }
    return query.orderBy(desc(organizationMembers.createdAt));
  });
}
