/**
 * Dispatch Engine Service
 *
 * Implements the dispatch-hall model: employers request workers,
 * the engine ranks eligible members by org-scoped rules
 * (seniority, availability, skills match) and produces assignments.
 */

import { db } from "@/db/db";
import {
  dispatchRequests,
  dispatchAssignments,
  dispatchRules,
  type DispatchRequestInsert,
  type DispatchRuleType,
} from "@/db/schema/domains/dispatch/dispatch";
import { eq, and, asc, desc } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MemberCandidate {
  memberId: string;
  name?: string;
  skills: string[];
  seniorityYears: number;
  available: boolean;
}

export interface ScoredCandidate extends MemberCandidate {
  score: number;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Calculate dispatch priority score for a single candidate.
 *
 * The score is a weighted sum driven by dispatch rules.
 * Higher = more suitable.
 */
export function calculateDispatchPriority(
  candidate: MemberCandidate,
  requiredSkills: string[],
  rules: { ruleType: DispatchRuleType; ruleDefinition: Record<string, unknown>; priority: number }[],
): number {
  let score = 0;

  for (const rule of rules) {
    const weight = rule.priority || 1;

    switch (rule.ruleType) {
      case "seniority": {
        // More seniority → higher score
        score += candidate.seniorityYears * 5 * weight;
        break;
      }
      case "availability": {
        score += candidate.available ? 30 * weight : 0;
        break;
      }
      case "skills_match": {
        const matched = requiredSkills.filter((sk) =>
          candidate.skills.some(
            (cs) => cs.toLowerCase() === sk.toLowerCase(),
          ),
        );
        const ratio =
          requiredSkills.length > 0
            ? matched.length / requiredSkills.length
            : 1;
        score += Math.round(ratio * 40 * weight);
        break;
      }
      case "rotation": {
        // Rotation ordering handled externally; flat bonus
        score += 10 * weight;
        break;
      }
      case "geographic_proximity": {
        // Placeholder — requires geo data
        score += 5 * weight;
        break;
      }
    }
  }

  return Math.max(0, score);
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Create a new dispatch request.
 */
export async function createDispatchRequest(
  data: DispatchRequestInsert,
) {
  const [row] = await db
    .insert(dispatchRequests)
    .values(data)
    .returning();
  return row;
}

/**
 * List open dispatch requests for an org.
 */
export async function listDispatchQueue(orgId: string) {
  return db
    .select()
    .from(dispatchRequests)
    .where(
      and(
        eq(dispatchRequests.orgId, orgId),
        eq(dispatchRequests.status, "open"),
      ),
    )
    .orderBy(asc(dispatchRequests.requestedDate));
}

/**
 * Load the org's dispatch rules sorted by priority.
 */
export async function loadDispatchRules(orgId: string) {
  return db
    .select()
    .from(dispatchRules)
    .where(eq(dispatchRules.orgId, orgId))
    .orderBy(desc(dispatchRules.priority));
}

/**
 * Rank a set of member candidates against a dispatch request
 * using the org's configured dispatch rules.
 */
export async function rankCandidates(
  orgId: string,
  requestId: string,
  candidates: MemberCandidate[],
): Promise<ScoredCandidate[]> {
  // Fetch request
  const [request] = await db
    .select()
    .from(dispatchRequests)
    .where(
      and(
        eq(dispatchRequests.id, requestId),
        eq(dispatchRequests.orgId, orgId),
      ),
    );

  if (!request) throw new Error("Dispatch request not found.");

  const rules = await loadDispatchRules(orgId);
  const requiredSkills = (request.requiredSkills as string[]) ?? [];

  const scored: ScoredCandidate[] = candidates.map((c) => ({
    ...c,
    score: calculateDispatchPriority(c, requiredSkills, rules),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * Assign top-ranked workers to a dispatch request.
 *
 * Inserts assignment rows and updates request status.
 *
 * ROUND 50 SECURITY FIX: previously took no orgId and performed no check
 * that requestId belonged to the caller's organization, letting one
 * organization inject assignment rows into another organization's
 * dispatch request (cross-tenant IDOR). Mirrors the ownership check
 * already used in rankCandidates() above.
 */
export async function assignWorkersToDispatch(
  orgId: string,
  requestId: string,
  memberIds: string[],
) {
  const [request] = await db
    .select()
    .from(dispatchRequests)
    .where(and(eq(dispatchRequests.id, requestId), eq(dispatchRequests.orgId, orgId)));

  if (!request) throw new Error("Dispatch request not found.");

  const assignments = await db
    .insert(dispatchAssignments)
    .values(
      memberIds.map((memberId) => ({
        requestId,
        memberId,
        status: "offered" as const,
      })),
    )
    .returning();

  const filled = memberIds.length >= request.requestedWorkers;
  await db
    .update(dispatchRequests)
    .set({
      status: filled ? "filled" : "partially_filled",
      updatedAt: new Date(),
    })
    .where(eq(dispatchRequests.id, requestId));

  return assignments;
}
