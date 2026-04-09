/**
 * Claims Service — CRUD operations for claims (grievance filings)
 */
import { db } from "@/db/db";
import { claims, claimUpdates } from "@/db/schema";
import { eq, and, desc, sql, like } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

export async function listClaims(
  filters: {
    organizationId?: string;
    status?: string;
    priority?: string;
    claimType?: string;
    search?: string;
  } = {},
  pagination: { page?: number; limit?: number } = {}
) {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;
  const conditions: SQL[] = [];

  if (filters.organizationId) {
    conditions.push(eq(claims.organizationId, filters.organizationId));
  }
  if (filters.status) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conditions.push(eq(claims.status, filters.status as any));
  }
  if (filters.priority) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conditions.push(eq(claims.priority, filters.priority as any));
  }
  if (filters.claimType) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conditions.push(eq(claims.claimType, filters.claimType as any));
  }
  if (filters.search) {
    conditions.push(like(claims.description, `%${filters.search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(claims)
    .where(whereClause);

  const rows = await db
    .select()
    .from(claims)
    .where(whereClause)
    .orderBy(desc(claims.createdAt))
    .limit(limit)
    .offset(offset);

  return { claims: rows, total: count, page, limit };
}

export async function getClaimById(id: string, organizationId?: string) {
  if (organizationId) {
    return db.query.claims.findFirst({
      where: and(eq(claims.claimId, id), eq(claims.organizationId, organizationId)),
    });
  }
  return db.query.claims.findFirst({
    where: eq(claims.claimId, id),
  });
}

export async function listClaimUpdates(claimId: string) {
  return db
    .select()
    .from(claimUpdates)
    .where(eq(claimUpdates.claimId, claimId))
    .orderBy(desc(claimUpdates.createdAt));
}
