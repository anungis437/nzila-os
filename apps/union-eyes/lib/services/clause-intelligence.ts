/**
 * Contract Clause Intelligence Service
 *
 * Provides semantic search over collective-agreement clauses
 * and allows linking relevant clauses to grievances.
 *
 * When clause embeddings are available (clauseEmbeddings table),
 * `findRelevantClauses` performs cosine-similarity search.
 * Otherwise it falls back to keyword matching on clause title/content.
 */

import { db } from "@/db/db";
import {
  cbaClause,
} from "@/db/schema/domains/agreements/clauses";
import { clauseEmbeddings } from "@/db/schema/domains/agreements/clause-embeddings";
import {
  collectiveAgreements,
} from "@/db/schema/domains/agreements/collective-agreements";
import { eq, and, ilike, or, sql as _sql } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ClauseMatch {
  clauseId: string;
  clauseNumber: string;
  title: string;
  content: string;
  similarity: number; // 0–1
  contractName: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Naive cosine similarity for two float arrays.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * List contracts for an organization.
 */
export async function listContracts(orgId: string) {
  return db
    .select()
    .from(collectiveAgreements)
    .where(eq(collectiveAgreements.organizationId, orgId));
}

/**
 * List clauses for a specific contract.
 */
export async function listClauses(contractId: string) {
  return db
    .select()
    .from(cbaClause)
    .where(eq(cbaClause.cbaId, contractId));
}

/**
 * Find clauses relevant to a grievance description.
 *
 * Strategy:
 *  1. If an `embeddingForQuery` is supplied and clause embeddings exist,
 *     do vector similarity search.
 *  2. Otherwise, fall back to keyword ilike search.
 */
export async function findRelevantClauses(
  orgId: string,
  grievanceDescription: string,
  embeddingForQuery?: number[],
  limit = 5,
): Promise<ClauseMatch[]> {
  // ── Vector path ────────────────────────────────────────────────────────
  if (embeddingForQuery && embeddingForQuery.length > 0) {
    // Round 44: scope the embedding scan to the caller's own clauses via an
    // inner join, rather than pulling every organization's embeddings into
    // memory before filtering at the hydration step.
    const allEmbeddings = await db
      .select({
        clauseId: clauseEmbeddings.clauseId,
        embeddingVector: clauseEmbeddings.embeddingVector,
      })
      .from(clauseEmbeddings)
      .innerJoin(cbaClause, eq(cbaClause.id, clauseEmbeddings.clauseId))
      .where(eq(cbaClause.organizationId, orgId));

    // Score each embedding
    const scored = allEmbeddings.map((row) => {
      const vec = JSON.parse(row.embeddingVector) as number[];
      return {
        clauseId: row.clauseId,
        similarity: cosineSimilarity(embeddingForQuery, vec),
      };
    });
    scored.sort((a, b) => b.similarity - a.similarity);
    const topIds = scored.slice(0, limit);

    if (topIds.length === 0) return [];

    // Hydrate clause details
    const results: ClauseMatch[] = [];
    for (const hit of topIds) {
      const [clause] = await db
        .select({
          id: cbaClause.id,
          clauseNumber: cbaClause.clauseNumber,
          title: cbaClause.title,
          content: cbaClause.content,
          cbaId: cbaClause.cbaId,
        })
        .from(cbaClause)
        .where(
          and(
            eq(cbaClause.id, hit.clauseId),
            eq(cbaClause.organizationId, orgId),
          ),
        );

      if (!clause) continue;

      const [contract] = await db
        .select({ title: collectiveAgreements.title })
        .from(collectiveAgreements)
        .where(eq(collectiveAgreements.id, clause.cbaId));

      results.push({
        clauseId: clause.id,
        clauseNumber: clause.clauseNumber,
        title: clause.title,
        content: clause.content,
        similarity: hit.similarity,
        contractName: contract?.title ?? "Unknown",
      });
    }
    return results;
  }

  // ── Keyword fallback ───────────────────────────────────────────────────
  const keywords = grievanceDescription
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 6);

  if (keywords.length === 0) return [];

  const conditions = keywords.map((kw) =>
    or(
      ilike(cbaClause.title, `%${kw}%`),
      ilike(cbaClause.content, `%${kw}%`),
    ),
  );

  const rows = await db
    .select({
      id: cbaClause.id,
      clauseNumber: cbaClause.clauseNumber,
      title: cbaClause.title,
      content: cbaClause.content,
      cbaId: cbaClause.cbaId,
    })
    .from(cbaClause)
    .where(and(eq(cbaClause.organizationId, orgId), or(...conditions)))
    .limit(limit);

  const results: ClauseMatch[] = [];
  for (const row of rows) {
    const [contract] = await db
      .select({ title: collectiveAgreements.title })
      .from(collectiveAgreements)
      .where(eq(collectiveAgreements.id, row.cbaId));

    results.push({
      clauseId: row.id,
      clauseNumber: row.clauseNumber,
      title: row.title,
      content: row.content,
      similarity: 0.5, // keyword match — flat score
      contractName: contract?.title ?? "Unknown",
    });
  }

  return results;
}

/**
 * Link a clause to a grievance by updating the grievance's CBA reference.
 */
export async function linkClauseToGrievance(
  grievanceId: string,
  clauseId: string,
) {
  const [clause] = await db
    .select({
      cbaId: cbaClause.cbaId,
      clauseNumber: cbaClause.clauseNumber,
      articleNumber: cbaClause.articleNumber,
    })
    .from(cbaClause)
    .where(eq(cbaClause.id, clauseId));

  if (!clause) throw new Error("Clause not found.");

  // Import grievances table to update
  const { grievances } = await import(
    "@/db/schema/domains/claims/grievances"
  );

  await db
    .update(grievances)
    .set({
      cbaId: clause.cbaId,
      cbaArticle: clause.articleNumber ?? clause.clauseNumber,
      cbaSection: clause.clauseNumber,
    })
    .where(eq(grievances.id, grievanceId));

  return { grievanceId, clauseId, linked: true };
}
