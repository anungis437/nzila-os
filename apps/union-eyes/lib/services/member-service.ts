/**
 * Member Service - Organization Member Operations
 *
 * Every administration call resolves `auth()` through `authorizeMemberAccess`
 * and runs inside `withRLSContext({ organizationId })` for that organization.
 * Role assignment uses the narrower role-management grant. Soft deletion and
 * duplicate suppression use the removal grant (`Permission.DELETE_MEMBER`).
 * Deactivating an active administrator uses that same removal grant.
 * Hard deletion is refused. Generic updates cannot move organization
 * ownership, identity, role, or per-capita exemption fields.
 *
 * This module does not prove that a deployed database enforces row-level security.
 */

import { organizationMembers } from "@/db/schema";
import { eq, and, or, gte, lte, desc, asc, like, sql, inArray, count } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { withRLSContext } from "@/lib/db/with-rls-context";
import {
  assertTenantAssignableRole,
  authorizeMemberAccess,
  authorizeOwnMembership,
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
  type AdministratorProjection,
  type AdministratorRosterRow,
  MEMBER_RECORD_STATUSES,
  rejectClientFinancialExemption,
} from "@/lib/member-integrity/member-write-policy";

export type NewMember = typeof organizationMembers.$inferInsert;
export type Member = typeof organizationMembers.$inferSelect;

type MemberStatusValue = (typeof organizationMembers.status)['_']['data'];
type MemberRoleValue = (typeof organizationMembers.role)['_']['data'];

export interface MemberFilters {
  organizationId?: string;
  status?: string[];
  role?: string[];
  department?: string;
  searchQuery?: string;
  hireDateFrom?: Date;
  hireDateTo?: Date;
  unionJoinDateFrom?: Date;
  unionJoinDateTo?: Date;
}

export interface MemberWithEngagement extends Member {
  engagementScore?: number;
  lastActivityDate?: Date;
  activityCount?: number;
}

export interface BulkOperationResult {
  success: boolean;
  processed: number;
  failed: number;
  errors?: Array<{ row: number; error: string }>;
}

export { MemberBoundaryError };

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

/** Profile fields copied during duplicate suppression. Exemption, approval, role, and status stay put. */
const MERGE_FIELDS = [
  "name",
  "email",
  "phone",
  "department",
  "location",
  "position",
  "hireDate",
  "membershipNumber",
  "seniority",
  "unionJoinDate",
  "metadata",
  "memberCategory",
  "isPrimary",
] as const;

function rethrow(error: unknown, fallback: string): never {
  if (error instanceof MemberBoundaryError) throw error;
  logger.error(fallback, { errorName: error instanceof Error ? error.name : "error" });
  throw new Error(fallback);
}

function assertOrganization(organizationId: string): string {
  if (typeof organizationId !== "string" || organizationId.trim() === "") {
    throw new MemberBoundaryError("Forbidden");
  }
  return organizationId.trim();
}

function rejectProtectedUpdate(data: object): void {
  const record = data as Record<string, unknown>;
  for (const field of PROTECTED_UPDATE_FIELDS) {
    if (record[field] !== undefined) throw new MemberBoundaryError("Forbidden");
  }
}

function membershipInsert(data: NewMember, organizationId: string, role: string): NewMember {
  const source = { ...(data as Record<string, unknown>) };
  delete source.id;
  delete source.deletedAt;
  delete source.createdAt;
  delete source.organizationId;
  delete source.role;
  for (const field of FINANCIAL_EXEMPTION_FIELDS) delete source[field];
  return { ...source, organizationId, role } as NewMember;
}

async function requireGrant(organizationId: string, capability: MemberCapability): Promise<MemberAccessGrant> {
  const access = await authorizeMemberAccess(assertOrganization(organizationId), capability);
  if (!access.ok) throw new MemberBoundaryError(access.message);
  return access;
}

async function requireAdministratorDeactivationAuthority(
  organizationId: string,
  roster: readonly AdministratorRosterRow[],
  changes: readonly AdministratorProjection[],
): Promise<void> {
  if (!deactivatesEffectiveAdministrator(roster, changes)) return;
  await requireGrant(organizationId, "remove_member");
}

function activeInOrganization(organizationId: string, memberId?: string): SQL {
  const conditions: SQL[] = [
    eq(organizationMembers.organizationId, organizationId),
    sql`${organizationMembers.deletedAt} IS NULL`,
  ];
  if (memberId) conditions.push(eq(organizationMembers.id, memberId));
  return and(...conditions)!;
}

export async function readOwnMemberStatus(userId: string, organizationId: string): Promise<boolean> {
  const access = await authorizeOwnMembership(userId, organizationId);
  if (!access.ok) return false;
  try {
    return await withRLSContext({ organizationId: access.organizationId }, async (tx) => {
      const member = await tx.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.userId, access.userId),
          eq(organizationMembers.organizationId, access.organizationId),
          sql`${organizationMembers.deletedAt} IS NULL`,
        ),
      });
      return member?.status === "active";
    });
  } catch (error) {
    logger.warn("own member status check failed closed", {
      errorName: error instanceof Error ? error.name : "error",
    });
    return false;
  }
}

export async function getMemberById(organizationId: string, id: string): Promise<Member | null> {
  try {
    const grant = await requireGrant(organizationId, "administer");
    return await withRLSContext({ organizationId: grant.organizationId }, async (tx) => {
      const member = await tx.query.organizationMembers.findFirst({
        where: activeInOrganization(grant.organizationId, id),
      });
      return member ?? null;
    });
  } catch (error) {
    rethrow(error, "Failed to fetch member");
  }
}

export async function getMemberByUserId(userId: string, organizationId: string): Promise<Member | null> {
  try {
    const grant = await requireGrant(organizationId, "administer");
    return await withRLSContext({ organizationId: grant.organizationId }, async (tx) => {
      const member = await tx.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.userId, userId),
          activeInOrganization(grant.organizationId),
        ),
      });
      return member ?? null;
    });
  } catch (error) {
    rethrow(error, "Failed to fetch member by user ID");
  }
}

export async function getMemberByMembershipNumber(
  membershipNumber: string,
  organizationId: string,
): Promise<Member | null> {
  try {
    const grant = await requireGrant(organizationId, "administer");
    return await withRLSContext({ organizationId: grant.organizationId }, async (tx) => {
      const member = await tx.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.membershipNumber, membershipNumber),
          activeInOrganization(grant.organizationId),
        ),
      });
      return member ?? null;
    });
  } catch (error) {
    rethrow(error, "Failed to fetch member by membership number");
  }
}

export async function listMembers(
  organizationId: string,
  filters: MemberFilters = {},
  pagination: { page?: number; limit?: number; sortBy?: string; sortOrder?: "asc" | "desc" } = {},
): Promise<{ members: Member[]; total: number; page: number; limit: number }> {
  try {
    const grant = await requireGrant(organizationId, "administer");
    if (filters.organizationId && filters.organizationId !== grant.organizationId) {
      throw new MemberBoundaryError("Forbidden");
    }
    const { page = 1, limit = 50, sortBy = "name", sortOrder = "asc" } = pagination;
    const offset = (page - 1) * limit;
    const conditions: SQL[] = [activeInOrganization(grant.organizationId)];
    if (filters.status && filters.status.length > 0) {
      conditions.push(inArray(organizationMembers.status, filters.status as MemberStatusValue[]));
    }
    if (filters.role && filters.role.length > 0) {
      conditions.push(inArray(organizationMembers.role, filters.role as MemberRoleValue[]));
    }
    if (filters.department) conditions.push(like(organizationMembers.department, `%${filters.department}%`));
    if (filters.searchQuery) {
      const searchTerm = `%${filters.searchQuery}%`;
      conditions.push(or(
        like(organizationMembers.name, searchTerm),
        like(organizationMembers.email, searchTerm),
        like(organizationMembers.membershipNumber, searchTerm),
      )!);
    }
    if (filters.hireDateFrom) conditions.push(gte(organizationMembers.hireDate, filters.hireDateFrom));
    if (filters.hireDateTo) conditions.push(lte(organizationMembers.hireDate, filters.hireDateTo));
    if (filters.unionJoinDateFrom) conditions.push(gte(organizationMembers.unionJoinDate, filters.unionJoinDateFrom));
    if (filters.unionJoinDateTo) conditions.push(lte(organizationMembers.unionJoinDate, filters.unionJoinDateTo));
    const whereClause = and(...conditions);
    const sortColumn = sortBy === "name"
      ? organizationMembers.name
      : sortBy === "email"
        ? organizationMembers.email
        : sortBy === "hireDate"
          ? organizationMembers.hireDate
          : organizationMembers.createdAt;
    return await withRLSContext({ organizationId: grant.organizationId }, async (tx) => {
      const totalResult = await tx.select({ count: count() }).from(organizationMembers).where(whereClause);
      const members = await tx
        .select()
        .from(organizationMembers)
        .where(whereClause)
        .orderBy(sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn))
        .limit(limit)
        .offset(offset);
      return { members, total: totalResult[0]?.count || 0, page, limit };
    });
  } catch (error) {
    rethrow(error, "Failed to list members");
  }
}

export async function createMember(data: NewMember): Promise<Member> {
  try {
    rejectClientFinancialExemption(data, "create");
    const organizationId = assertOrganization(data?.organizationId ?? "");
    const role = data.role ?? "member";
    assertTenantAssignableRole(role);
    const capability: MemberCapability = role === "member" ? "administer" : "assign_role";
    const grant = await requireGrant(organizationId, capability);
    return await withRLSContext({ organizationId: grant.organizationId }, async (tx) => {
      if (data.userId) {
        const existingUser = await tx.query.organizationMembers.findFirst({
          where: and(
            eq(organizationMembers.userId, data.userId),
            activeInOrganization(grant.organizationId),
          ),
        });
        if (existingUser) throw new MemberBoundaryError("Member already exists");
      }
      if (data.membershipNumber) {
        const existingNumber = await tx.query.organizationMembers.findFirst({
          where: and(
            eq(organizationMembers.membershipNumber, data.membershipNumber),
            activeInOrganization(grant.organizationId),
          ),
        });
        if (existingNumber) throw new MemberBoundaryError("Member already exists");
      }
      const [member] = await tx.insert(organizationMembers).values(
        membershipInsert(data, grant.organizationId, role),
      ).returning();
      if (!member) throw new MemberBoundaryError("Failed to create member");
      await persistDurableMemberAudit(tx, {
        actorUserId: grant.userId,
        organizationId: grant.organizationId,
        operation: role === "member" ? "create" : "role_change",
        targetId: member.id,
      });
      return member;
    });
  } catch (error) {
    rethrow(error, "Failed to create member");
  }
}

export async function updateMember(
  organizationId: string,
  id: string,
  data: Partial<NewMember>,
): Promise<Member | null> {
  try {
    rejectProtectedUpdate(data);
    const grant = await requireGrant(organizationId, "administer");
    return await withRLSContext({ organizationId: grant.organizationId }, async (tx) => {
      if (data.status !== undefined) {
        const roster = await lockAdministratorRoster(tx, grant.organizationId);
        const current = await tx.query.organizationMembers.findFirst({
          where: activeInOrganization(grant.organizationId, id),
        });
        if (!current) return null;
        assertMemberStatusTransition(String(current.status), String(data.status));
        const projection = [{ id: current.id, status: String(data.status) }];
        await requireAdministratorDeactivationAuthority(grant.organizationId, roster, projection);
        assertActiveAdministratorsRemain(roster, projection);
      }
      const [updated] = await tx
        .update(organizationMembers)
        .set({ ...data, updatedAt: new Date() })
        .where(activeInOrganization(grant.organizationId, id))
        .returning();
      if (!updated) return null;
      await persistDurableMemberAudit(tx, {
        actorUserId: grant.userId,
        organizationId: grant.organizationId,
        operation: data.status !== undefined ? "status_change" : "update",
        targetId: updated.id,
      });
      return updated;
    });
  } catch (error) {
    rethrow(error, "Failed to update member");
  }
}

export async function deleteMember(organizationId: string, id: string): Promise<boolean> {
  try {
    const grant = await requireGrant(organizationId, "remove_member");
    return await withRLSContext({ organizationId: grant.organizationId }, async (tx) => {
      const roster = await lockAdministratorRoster(tx, grant.organizationId);
      const target = await tx.query.organizationMembers.findFirst({
        where: activeInOrganization(grant.organizationId, id),
      });
      if (!target) return false;
      assertMemberRemovalPolicy({
        actorUserId: grant.userId,
        targetUserId: target.userId,
      });
      assertActiveAdministratorsRemain(roster, [{ id: target.id, deletedAt: new Date() }]);
      const [deleted] = await tx
        .update(organizationMembers)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(activeInOrganization(grant.organizationId, id))
        .returning();
      if (!deleted) return false;
      await persistDurableMemberAudit(tx, {
        actorUserId: grant.userId,
        organizationId: grant.organizationId,
        operation: "soft_delete",
        targetId: deleted.id,
      });
      return true;
    });
  } catch (error) {
    rethrow(error, "Failed to delete member");
  }
}

export async function permanentlyDeleteMember(organizationId: string, _id: string): Promise<boolean> {
  await requireGrant(organizationId, "remove_member");
  throw new MemberBoundaryError("Membership records are retained. Soft-delete the member instead.");
}

export async function bulkImportMembers(members: NewMember[]): Promise<BulkOperationResult> {
  const errors: Array<{ row: number; error: string }> = [];
  let processed = 0;
  for (let i = 0; i < members.length; i++) {
    try {
      await createMember(members[i]);
      processed++;
    } catch (error) {
      if (error instanceof MemberBoundaryError && members.length === 1) throw error;
      errors.push({
        row: i + 1,
        error: error instanceof MemberBoundaryError ? error.message : "Failed to create member",
      });
    }
  }
  return {
    success: errors.length === 0,
    processed,
    failed: errors.length,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export async function bulkUpdateMemberStatus(
  organizationId: string,
  memberIds: string[],
  status: string,
): Promise<BulkOperationResult> {
  try {
    const grant = await requireGrant(organizationId, "administer");
    if (!(MEMBER_RECORD_STATUSES as readonly string[]).includes(status)) {
      throw new MemberBoundaryError("Forbidden");
    }
    if (memberIds.length === 0) return { success: true, processed: 0, failed: 0 };
    return await withRLSContext({ organizationId: grant.organizationId }, async (tx) => {
      if (new Set(memberIds).size !== memberIds.length) throw new MemberBoundaryError("Forbidden");
      const roster = await lockAdministratorRoster(tx, grant.organizationId);
      const projection = memberIds.map((id) => ({ id, status }));
      await requireAdministratorDeactivationAuthority(grant.organizationId, roster, projection);
      assertActiveAdministratorsRemain(roster, projection);
      const current = await tx
        .select()
        .from(organizationMembers)
        .where(and(
          activeInOrganization(grant.organizationId),
          inArray(organizationMembers.id, memberIds),
        ));
      if (current.length !== memberIds.length) throw new MemberBoundaryError("Forbidden");
      for (const row of current) assertMemberStatusTransition(String(row.status), status);
      const updated = await tx
        .update(organizationMembers)
        .set({ status: status as MemberStatusValue, updatedAt: new Date() })
        .where(and(
          activeInOrganization(grant.organizationId),
          inArray(organizationMembers.id, memberIds),
        ))
        .returning();
      if (updated.length !== memberIds.length) throw new MemberBoundaryError("Forbidden");
      await persistDurableMemberAudit(tx, {
        actorUserId: grant.userId,
        organizationId: grant.organizationId,
        operation: "status_change",
        targetId: null,
        count: updated.length,
      });
      return { success: true, processed: updated.length, failed: 0 };
    });
  } catch (error) {
    if (error instanceof MemberBoundaryError) throw error;
    logger.error("Error in bulk status update", { errorName: error instanceof Error ? error.name : "error" });
    return {
      success: false,
      processed: 0,
      failed: memberIds.length,
      errors: [{ row: 0, error: "Bulk update failed" }],
    };
  }
}

export async function bulkUpdateMemberRole(
  organizationId: string,
  memberIds: string[],
  role: string,
): Promise<BulkOperationResult> {
  try {
    assertTenantAssignableRole(role);
    const grant = await requireGrant(organizationId, "assign_role");
    if (memberIds.length === 0) return { success: true, processed: 0, failed: 0 };
    return await withRLSContext({ organizationId: grant.organizationId }, async (tx) => {
      const roster = await lockAdministratorRoster(tx, grant.organizationId);
      assertActiveAdministratorsRemain(roster, memberIds.map((id) => ({ id, role })));
      const updated = await tx
        .update(organizationMembers)
        .set({ role: role as MemberRoleValue, updatedAt: new Date() })
        .where(and(
          activeInOrganization(grant.organizationId),
          inArray(organizationMembers.id, memberIds),
        ))
        .returning();
      if (updated.length !== memberIds.length) throw new MemberBoundaryError("Forbidden");
      await persistDurableMemberAudit(tx, {
        actorUserId: grant.userId,
        organizationId: grant.organizationId,
        operation: "role_change",
        targetId: null,
        count: updated.length,
      });
      return { success: true, processed: updated.length, failed: 0 };
    });
  } catch (error) {
    if (error instanceof MemberBoundaryError) throw error;
    logger.error("Error in bulk role update", { errorName: error instanceof Error ? error.name : "error" });
    return {
      success: false,
      processed: 0,
      failed: memberIds.length,
      errors: [{ row: 0, error: "Bulk update failed" }],
    };
  }
}

export async function searchMembers(
  organizationId: string,
  searchQuery = "",
  filters?: { status?: string[]; role?: string[]; department?: string },
  pagination?: { page?: number; limit?: number },
): Promise<{ members: Member[]; total: number }> {
  try {
    const grant = await requireGrant(organizationId, "administer");
    const { page = 1, limit = 50 } = pagination || {};
    const offset = (page - 1) * limit;
    const conditions: SQL[] = [activeInOrganization(grant.organizationId)];
    if (searchQuery) {
      const searchTerm = `%${searchQuery}%`;
      conditions.push(or(
        like(organizationMembers.name, searchTerm),
        like(organizationMembers.email, searchTerm),
        like(organizationMembers.membershipNumber, searchTerm),
        like(organizationMembers.department, searchTerm),
        like(organizationMembers.position, searchTerm),
      )!);
    }
    if (filters?.status && filters.status.length > 0) {
      conditions.push(inArray(organizationMembers.status, filters.status as MemberStatusValue[]));
    }
    if (filters?.role && filters.role.length > 0) {
      conditions.push(inArray(organizationMembers.role, filters.role as MemberRoleValue[]));
    }
    if (filters?.department) conditions.push(like(organizationMembers.department, `%${filters.department}%`));
    const whereClause = and(...conditions);
    return await withRLSContext({ organizationId: grant.organizationId }, async (tx) => {
      const [totalResult, members] = await Promise.all([
        tx.select({ count: count() }).from(organizationMembers).where(whereClause),
        tx.select().from(organizationMembers).where(whereClause).limit(limit).offset(offset),
      ]);
      return { members, total: totalResult[0]?.count || 0 };
    });
  } catch (error) {
    rethrow(error, "Failed to search members");
  }
}

export async function getMemberStatistics(organizationId: string): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byRole: Record<string, number>;
  byDepartment: Record<string, number>;
}> {
  try {
    const grant = await requireGrant(organizationId, "administer");
    return await withRLSContext({ organizationId: grant.organizationId }, async (tx) => {
      const members = await tx.select().from(organizationMembers).where(activeInOrganization(grant.organizationId));
      const byStatus: Record<string, number> = {};
      const byRole: Record<string, number> = {};
      const byDepartment: Record<string, number> = {};
      members.forEach((member) => {
        byStatus[member.status] = (byStatus[member.status] || 0) + 1;
        byRole[member.role] = (byRole[member.role] || 0) + 1;
        if (member.department) byDepartment[member.department] = (byDepartment[member.department] || 0) + 1;
      });
      return { total: members.length, byStatus, byRole, byDepartment };
    });
  } catch (error) {
    rethrow(error, "Failed to get member statistics");
  }
}

function pickMergeFields(source: Member, base: Partial<NewMember>): Partial<NewMember> {
  const next = { ...base };
  for (const field of MERGE_FIELDS) {
    const value = source[field];
    if (value != null) next[field] = value as never;
  }
  return next;
}

/**
 * Suppresses one duplicate membership row inside the authorized organization.
 * This copies profile fields onto the canonical row and soft-deletes the
 * duplicate. It does not reassign claims, dues, history, or other linked
 * records, and it is not referential consolidation.
 */
export async function mergeMembers(
  organizationId: string,
  primaryMemberId: string,
  duplicateMemberId: string,
  keepData: "primary" | "duplicate" | "merge",
): Promise<Member> {
  try {
    if (primaryMemberId === duplicateMemberId) throw new MemberBoundaryError("Forbidden");
    const grant = await requireGrant(organizationId, "remove_member");
    return await withRLSContext({ organizationId: grant.organizationId }, async (tx) => {
      const roster = await lockAdministratorRoster(tx, grant.organizationId);
      const primary = await tx.query.organizationMembers.findFirst({
        where: activeInOrganization(grant.organizationId, primaryMemberId),
      });
      const duplicate = await tx.query.organizationMembers.findFirst({
        where: activeInOrganization(grant.organizationId, duplicateMemberId),
      });
      if (!primary || !duplicate) throw new MemberBoundaryError("One or both members not found");
      if (primary.organizationId !== grant.organizationId || duplicate.organizationId !== grant.organizationId) {
        throw new MemberBoundaryError("Forbidden");
      }
      assertMemberRemovalPolicy({
        actorUserId: grant.userId,
        targetUserId: duplicate.userId,
      });
      assertActiveAdministratorsRemain(roster, [{ id: duplicate.id, deletedAt: new Date() }]);

      let patch: Partial<NewMember> = {};
      if (keepData === "duplicate") patch = pickMergeFields(duplicate, {});
      if (keepData === "merge") patch = pickMergeFields(duplicate, pickMergeFields(primary, {}));
      rejectProtectedUpdate(patch);

      const [updated] = await tx
        .update(organizationMembers)
        .set({ ...patch, updatedAt: new Date() })
        .where(activeInOrganization(grant.organizationId, primary.id))
        .returning();
      if (!updated) throw new MemberBoundaryError("One or both members not found");

      const [removed] = await tx
        .update(organizationMembers)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(activeInOrganization(grant.organizationId, duplicate.id))
        .returning();
      if (!removed) throw new MemberBoundaryError("One or both members not found");

      await persistDurableMemberAudit(tx, {
        actorUserId: grant.userId,
        organizationId: grant.organizationId,
        operation: "merge",
        targetId: updated.id,
        count: 2,
      });
      return updated;
    });
  } catch (error) {
    rethrow(error, "Failed to merge members");
  }
}

export async function calculateSeniority(organizationId: string, memberId: string): Promise<string> {
  try {
    const member = await getMemberById(organizationId, memberId);
    if (!member || !member.unionJoinDate) return "N/A";
    const joinDate = new Date(member.unionJoinDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - joinDate.getTime());
    const diffYears = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365.25));
    const diffMonths = Math.floor((diffTime % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44));
    return `${diffYears} years, ${diffMonths} months`;
  } catch (error) {
    if (error instanceof MemberBoundaryError) throw error;
    logger.error("Error calculating seniority", { errorName: error instanceof Error ? error.name : "error" });
    return "N/A";
  }
}

export const MEMBER_IMPORT_KEYS = new Set([
  "id",
  "userId",
  "organizationId",
  "email",
  "name",
  "phone",
  "department",
  "location",
  "position",
  "status",
  "role",
  "exemptFromPerCapita",
  "exemptionReason",
  "exemptionApprovedBy",
]);

export type OrganizationMemberImportRecord = Record<string, unknown>;

/**
 * Applies a member import inside one organization transaction.
 * The session grant is the tenant. Record organization ids, roles,
 * exemptions, and foreign membership ids cannot widen that grant.
 * Validation covers the whole batch before any write. `validateOnly`
 * returns after that check. An audit failure rejects the transaction,
 * so none of the batch remains.
 */
export async function importOrganizationMembers(
  organizationId: string,
  records: readonly OrganizationMemberImportRecord[],
  options: { updateExisting: boolean; validateOnly?: boolean },
): Promise<{ imported: number; errors: string[] }> {
  const grant = await requireGrant(organizationId, "administer");
  if (records.length === 0) return { imported: 0, errors: [] };
  try {
    return await withRLSContext({ organizationId: grant.organizationId }, async (tx) => {
      const errors: string[] = [];
      const roster = await lockAdministratorRoster(tx, grant.organizationId);
      const projections: AdministratorProjection[] = [];
      let needsRoleGrant = false;
      let operation: "create" | "update" | "status_change" | "role_change" = "update";
      const plans: Array<
        | { kind: "insert"; values: NewMember; role: string }
        | { kind: "update"; id: string; patch: Partial<NewMember> }
      > = [];

      for (let index = 0; index < records.length; index += 1) {
        const record = records[index] ?? {};
        const rowLabel = `Row ${index + 1}`;
        try {
          for (const key of Object.keys(record)) {
            if (!MEMBER_IMPORT_KEYS.has(key)) throw new MemberBoundaryError("Forbidden");
          }
          rejectClientFinancialExemption(record, record.id ? "update" : "create");
          if (
            record.organizationId !== undefined &&
            record.organizationId !== grant.organizationId
          ) {
            throw new MemberBoundaryError("Forbidden");
          }
          if (typeof record.email !== "string" || record.email.trim() === "") {
            throw new MemberBoundaryError("Forbidden");
          }
          const role = record.role === undefined ? "member" : String(record.role);
          assertTenantAssignableRole(role);

          if (record.id === undefined) {
            if (typeof record.userId !== "string" || record.userId.trim() === "") {
              throw new MemberBoundaryError("Forbidden");
            }
            if (record.status !== undefined && record.status !== "active") {
              throw new MemberBoundaryError("Forbidden");
            }
            if (role !== "member") needsRoleGrant = true;
            const existingUser = await tx.query.organizationMembers.findFirst({
              where: and(
                eq(organizationMembers.userId, record.userId),
                activeInOrganization(grant.organizationId),
              ),
            });
            if (existingUser) throw new MemberBoundaryError("Member already exists");
            plans.push({
              kind: "insert",
              role,
              values: membershipInsert({
                userId: record.userId,
                name: typeof record.name === "string" ? record.name : "",
                email: record.email,
                phone: typeof record.phone === "string" ? record.phone : undefined,
                department: typeof record.department === "string" ? record.department : undefined,
                location: typeof record.location === "string" ? record.location : undefined,
                position: typeof record.position === "string" ? record.position : undefined,
                organizationId: grant.organizationId,
                role,
                status: "active",
              }, grant.organizationId, role),
            });
            if (role === "admin") {
              projections.push({ id: `import-${index}`, role: "admin", status: "active" });
            }
            continue;
          }

          if (!options.updateExisting) throw new MemberBoundaryError("Forbidden");
          if (typeof record.id !== "string" || record.id.trim() === "") {
            throw new MemberBoundaryError("Forbidden");
          }
          if (record.userId !== undefined) throw new MemberBoundaryError("Forbidden");
          const current = await tx.query.organizationMembers.findFirst({
            where: activeInOrganization(grant.organizationId, record.id),
          });
          if (!current) throw new MemberBoundaryError("Forbidden");
          const patch: Partial<NewMember> = {};
          for (const field of ["name", "email", "phone", "department", "location", "position"] as const) {
            if (record[field] !== undefined) patch[field] = String(record[field]);
          }
          if (record.role !== undefined && role !== current.role) {
            needsRoleGrant = true;
            patch.role = role as MemberRoleValue;
            projections.push({ id: current.id, role });
            operation = "role_change";
          }
          if (record.status !== undefined && String(record.status) !== String(current.status)) {
            assertMemberStatusTransition(String(current.status), String(record.status));
            patch.status = String(record.status) as Member["status"];
            projections.push({ id: current.id, status: String(record.status) });
            if (operation !== "role_change") operation = "status_change";
          }
          plans.push({ kind: "update", id: current.id, patch });
        } catch (error) {
          errors.push(`${rowLabel}: ${error instanceof MemberBoundaryError ? error.message : "Forbidden"}`);
        }
      }

      if (errors.length > 0) return { imported: 0, errors };
      try {
        if (needsRoleGrant) await requireGrant(grant.organizationId, "assign_role");
        await requireAdministratorDeactivationAuthority(grant.organizationId, roster, projections);
        assertActiveAdministratorsRemain(roster, projections);
      } catch (error) {
        if (error instanceof MemberBoundaryError) return { imported: 0, errors: [error.message] };
        throw error;
      }
      if (options.validateOnly) return { imported: 0, errors: [] };
      if (plans.every((plan) => plan.kind === "insert") && operation === "update") operation = "create";

      for (const plan of plans) {
        if (plan.kind === "insert") {
          const [created] = await tx.insert(organizationMembers).values(plan.values).returning();
          if (!created) throw new MemberBoundaryError("Failed to create member");
          continue;
        }
        const [updated] = await tx
          .update(organizationMembers)
          .set({ ...plan.patch, updatedAt: new Date() })
          .where(activeInOrganization(grant.organizationId, plan.id))
          .returning();
        if (!updated) throw new MemberBoundaryError("Forbidden");
      }

      await persistDurableMemberAudit(tx, {
        actorUserId: grant.userId,
        organizationId: grant.organizationId,
        operation,
        targetId: null,
        count: plans.length,
      });
      return { imported: plans.length, errors: [] };
    });
  } catch (error) {
    rethrow(error, "Failed to import members");
  }
}

export async function getMembersByDepartment(organizationId: string, department: string): Promise<Member[]> {
  try {
    const grant = await requireGrant(organizationId, "administer");
    return await withRLSContext({ organizationId: grant.organizationId }, async (tx) => {
      return tx.select().from(organizationMembers).where(and(
        activeInOrganization(grant.organizationId),
        eq(organizationMembers.department, department),
      ));
    });
  } catch (error) {
    rethrow(error, "Failed to fetch members by department");
  }
}

export async function getMembersByRole(organizationId: string, role: string): Promise<Member[]> {
  try {
    const grant = await requireGrant(organizationId, "administer");
    return await withRLSContext({ organizationId: grant.organizationId }, async (tx) => {
      return tx.select().from(organizationMembers).where(and(
        activeInOrganization(grant.organizationId),
        eq(organizationMembers.role, role as MemberRoleValue),
      ));
    });
  } catch (error) {
    rethrow(error, "Failed to fetch members by role");
  }
}
