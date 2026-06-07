/**
 * Negotiations Service — Bargaining rounds, proposals, tentative agreements
 */
import { db } from "@/db/db";
import {
  negotiations,
  bargainingProposals,
  tentativeAgreements,
  negotiationSessions,
  bargainingTeamMembers,
} from "@/db/schema";
import { eq, and, desc, asc, sql, like } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

// ============================================================================
// Negotiations
// ============================================================================

export async function listNegotiations(
  filters: { organizationId?: string; status?: string; search?: string } = {},
  pagination: { page?: number; limit?: number } = {}
) {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;
  const conditions: SQL[] = [];

  if (filters.organizationId) {
    conditions.push(eq(negotiations.organizationId, filters.organizationId));
  }
  if (filters.status) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conditions.push(eq(negotiations.status, filters.status as any));
  }
  if (filters.search) {
    conditions.push(like(negotiations.title, `%${filters.search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(negotiations)
    .where(whereClause);

  const rows = await db
    .select()
    .from(negotiations)
    .where(whereClause)
    .orderBy(desc(negotiations.createdAt))
    .limit(limit)
    .offset(offset);

  return { negotiations: rows, total: count, page, limit };
}

export async function getNegotiationById(id: string) {
  return db.query.negotiations.findFirst({
    where: eq(negotiations.id, id),
  });
}

// ============================================================================
// Proposals
// ============================================================================

export async function listProposals(
  filters: { negotiationId?: string; status?: string; type?: string } = {},
  pagination: { page?: number; limit?: number } = {}
) {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;
  const conditions: SQL[] = [];

  if (filters.negotiationId) {
    conditions.push(eq(bargainingProposals.negotiationId, filters.negotiationId));
  }
  if (filters.status) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conditions.push(eq(bargainingProposals.status, filters.status as any));
  }
  if (filters.type) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conditions.push(eq(bargainingProposals.proposalType, filters.type as any));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bargainingProposals)
    .where(whereClause);

  const rows = await db
    .select()
    .from(bargainingProposals)
    .where(whereClause)
    .orderBy(asc(bargainingProposals.proposalNumber))
    .limit(limit)
    .offset(offset);

  return { proposals: rows, total: count, page, limit };
}

export async function getProposalById(id: string) {
  return db.query.bargainingProposals.findFirst({
    where: eq(bargainingProposals.id, id),
  });
}

// ============================================================================
// Tentative Agreements
// ============================================================================

export async function listTentativeAgreements(negotiationId?: string) {
  const conditions: SQL[] = [];
  if (negotiationId) {
    conditions.push(eq(tentativeAgreements.negotiationId, negotiationId));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return db
    .select()
    .from(tentativeAgreements)
    .where(whereClause)
    .orderBy(asc(tentativeAgreements.agreementNumber));
}

// ============================================================================
// Sessions
// ============================================================================

export async function listSessions(negotiationId: string) {
  return db
    .select()
    .from(negotiationSessions)
    .where(eq(negotiationSessions.negotiationId, negotiationId))
    .orderBy(asc(negotiationSessions.sessionNumber));
}

// ============================================================================
// Team
// ============================================================================

export async function listTeamMembers(negotiationId: string) {
  return db
    .select()
    .from(bargainingTeamMembers)
    .where(eq(bargainingTeamMembers.negotiationId, negotiationId))
    .orderBy(desc(bargainingTeamMembers.isChief));
}
