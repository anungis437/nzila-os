/**
 * Dispatch Engine Service
 *
 * Implements the dispatch-hall model: employers request workers,
 * the engine ranks eligible members by org-scoped rules
 * (seniority, availability, skills match) and produces assignments.
 */

import { db } from "@/db/db";
import type { RLSTx } from "@/lib/db/with-rls-context";
import {
  dispatchRequests,
  dispatchAssignments,
  dispatchRules,
  type DispatchRequestInsert,
  type DispatchRuleType,
} from "@/db/schema/domains/dispatch/dispatch";
import { organizationMembers } from "@/db/schema-organizations";
import { eq, and, asc, desc, inArray } from "drizzle-orm";

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
  exec: RLSTx = db,
) {
  const [row] = await exec
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

/** The refusals of an assignment, so a route can answer each with its own status. */
export class DispatchAssignmentError extends Error {
  constructor(readonly reason: 'not_found' | 'not_open' | 'not_members' | 'already_assigned' | 'over_capacity', message: string) {
    super(message);
  }
}

const LIVE_ASSIGNMENT_STATUSES = ["offered", "accepted", "confirmed", "completed"] as const;

/**
 * Offer a dispatch request to named members.
 *
 * The officer chooses the members; the dispatch rules are not applied here (rankCandidates scores a candidate list, and no source of
 * candidate skills or availability feeds it). What this guarantees is that the choice is a valid one: the request is the caller's and
 * still open, every member is an active member of the organization, none is already offered or placed on it, and the offers do not
 * exceed the workers requested. The request row is locked so two officers cannot both fill the last place.
 *
 * ROUND 50 SECURITY FIX: previously took no orgId and performed no check
 * that requestId belonged to the caller's organization, letting one
 * organization inject assignment rows into another organization's
 * dispatch request (cross-tenant IDOR).
 */
export async function assignWorkersToDispatch(
  orgId: string,
  requestId: string,
  memberIds: string[],
  exec: RLSTx = db,
) {
  const members = [...new Set(memberIds)];

  const [request] = await exec
    .select()
    .from(dispatchRequests)
    .where(and(eq(dispatchRequests.id, requestId), eq(dispatchRequests.orgId, orgId)))
    .for("update");

  if (!request) throw new DispatchAssignmentError("not_found", "Dispatch request not found.");
  if (request.status !== "open" && request.status !== "partially_filled") {
    throw new DispatchAssignmentError("not_open", "Dispatch request is not open.");
  }

  const active = await exec
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, orgId),
        inArray(organizationMembers.id, members),
        eq(organizationMembers.status, "active"),
      ),
    );
  if (active.length !== members.length) {
    throw new DispatchAssignmentError("not_members", "Every worker must be an active member of this organization.");
  }

  const live = await exec
    .select({ memberId: dispatchAssignments.memberId })
    .from(dispatchAssignments)
    .where(and(eq(dispatchAssignments.requestId, requestId), inArray(dispatchAssignments.status, [...LIVE_ASSIGNMENT_STATUSES])));
  const already = new Set(live.map((row) => row.memberId));
  if (members.some((memberId) => already.has(memberId))) {
    throw new DispatchAssignmentError("already_assigned", "A worker is already offered or placed on this request.");
  }
  if (live.length + members.length > request.requestedWorkers) {
    throw new DispatchAssignmentError("over_capacity", "More workers were named than the request still needs.");
  }

  const assignments = await exec
    .insert(dispatchAssignments)
    .values(members.map((memberId) => ({ requestId, memberId, status: "offered" as const })))
    .returning();

  const filled = live.length + members.length >= request.requestedWorkers;
  await exec
    .update(dispatchRequests)
    .set({
      status: filled ? "filled" : "partially_filled",
      updatedAt: new Date(),
    })
    .where(and(eq(dispatchRequests.id, requestId), eq(dispatchRequests.orgId, request.orgId)));

  return assignments;
}
