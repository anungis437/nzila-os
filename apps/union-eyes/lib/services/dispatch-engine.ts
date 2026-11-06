/**
 * Dispatch Engine Service
 *
 * Implements the dispatch-hall model: employers request workers and an officer offers the request to named members. The rule
 * ranking (rankCandidates) applies a configured rule only where the member data it needs is recorded, and otherwise says the
 * candidates are unranked; it is not called by the assignment, which remains the officer's explicit selection.
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

/**
 * A member a request could be offered to, with only what is recorded about them. Null means nothing records it: there is no source
 * of member skills or availability in Union Eyes, and seniority is organization_members.seniority, which may be unset.
 */
export interface MemberCandidate {
  memberId: string;
  name?: string;
  seniority: number | null;
  skills: string[] | null;
  available: boolean | null;
}

type RuleInput = { ruleType: DispatchRuleType; ruleDefinition: Record<string, unknown>; priority: number };

/** Whether a configured rule could be applied to these candidates, and if not, why. */
export interface DispatchRuleOutcome {
  ruleType: DispatchRuleType;
  priority: number;
  applied: boolean;
  reason: string | null;
}

export interface DispatchRanking {
  /** 'unranked' when no configured rule has the data it needs: the candidates are then listed in their stored order, not ranked. */
  status: "ranked" | "unranked";
  reason: string | null;
  rules: DispatchRuleOutcome[];
  /** In rank order when ranked; rank is null when unranked. */
  candidates: Array<MemberCandidate & { rank: number | null }>;
}

// ─── Rule application ────────────────────────────────────────────────────────

const NO_SOURCE: Partial<Record<DispatchRuleType, string>> = {
  rotation: "Not applied: no rotation order is recorded for the organization's members.",
  geographic_proximity: "Not applied: no member location or distance to the job site is recorded.",
};

/**
 * Decide which configured rules can be applied. A rule is applied only when every candidate has the recorded value it orders by;
 * otherwise it is reported as not applied with the reason, rather than scored from a placeholder (the previous engine added flat
 * bonuses for rotation and proximity, treated "no required skills" as a full match, and weighted seniority by an arbitrary factor).
 */
export function evaluateDispatchRules(
  candidates: MemberCandidate[],
  requiredSkills: string[],
  rules: RuleInput[],
): DispatchRuleOutcome[] {
  return rules.map((rule) => {
    const base = { ruleType: rule.ruleType, priority: rule.priority };
    if (NO_SOURCE[rule.ruleType]) return { ...base, applied: false, reason: NO_SOURCE[rule.ruleType]! };
    if (candidates.length === 0) return { ...base, applied: false, reason: "Not applied: there are no candidates." };
    if (rule.ruleType === "seniority") {
      const missing = candidates.filter((c) => c.seniority === null || !Number.isFinite(c.seniority)).length;
      return missing === 0
        ? { ...base, applied: true, reason: null }
        : { ...base, applied: false, reason: `Not applied: ${missing} of ${candidates.length} candidates have no recorded seniority.` };
    }
    if (rule.ruleType === "availability") {
      const missing = candidates.filter((c) => c.available === null).length;
      return missing === 0
        ? { ...base, applied: true, reason: null }
        : { ...base, applied: false, reason: "Not applied: no record of member availability exists." };
    }
    // skills_match
    if (requiredSkills.length === 0) return { ...base, applied: false, reason: "Not applied: the request names no required skills." };
    const missing = candidates.filter((c) => c.skills === null).length;
    return missing === 0
      ? { ...base, applied: true, reason: null }
      : { ...base, applied: false, reason: "Not applied: no record of member skills exists." };
  });
}

function matchedSkills(candidate: MemberCandidate, requiredSkills: string[]): number {
  const held = new Set((candidate.skills ?? []).map((skill) => skill.toLowerCase()));
  return requiredSkills.filter((skill) => held.has(skill.toLowerCase())).length;
}

/**
 * Rank candidates by the applicable rules in precedence order (highest rule priority first), comparing on each rule's recorded value
 * and falling through to the next rule on a tie. No weights are invented: a rule orders candidates, it does not add points.
 */
export function rankByDispatchRules(
  candidates: MemberCandidate[],
  requiredSkills: string[],
  rules: RuleInput[],
): DispatchRanking {
  const outcomes = evaluateDispatchRules(candidates, requiredSkills, rules);
  const applied = outcomes.filter((o) => o.applied).sort((a, b) => b.priority - a.priority);
  if (applied.length === 0) {
    return {
      status: "unranked",
      reason: rules.length === 0
        ? "Unranked: the organization has no dispatch rules configured."
        : "Unranked: no configured dispatch rule has the member data it needs.",
      rules: outcomes,
      candidates: candidates.map((c) => ({ ...c, rank: null })),
    };
  }
  const compare = (a: MemberCandidate, b: MemberCandidate): number => {
    for (const rule of applied) {
      let diff = 0;
      if (rule.ruleType === "seniority") diff = (b.seniority as number) - (a.seniority as number);
      else if (rule.ruleType === "availability") diff = Number(b.available) - Number(a.available);
      else if (rule.ruleType === "skills_match") diff = matchedSkills(b, requiredSkills) - matchedSkills(a, requiredSkills);
      if (diff !== 0) return diff;
    }
    return 0;
  };
  const ordered = [...candidates].sort(compare);
  return {
    status: "ranked",
    reason: null,
    rules: outcomes,
    candidates: ordered.map((c, index) => ({ ...c, rank: index + 1 })),
  };
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
 * List the dispatch requests that still need workers: open ones and partially filled ones (a partly filled request leaves the queue only when it is filled).
 */
export async function listDispatchQueue(orgId: string) {
  return db
    .select()
    .from(dispatchRequests)
    .where(
      and(
        eq(dispatchRequests.orgId, orgId),
        inArray(dispatchRequests.status, ["open", "partially_filled"]),
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

/** Active members ranked at most: the ranking reads them in memory and refuses rather than ranking a partial list. */
export const DISPATCH_CANDIDATE_BOUND = 5_000;

/**
 * Rank the organization's active members for a dispatch request using its configured rules and only recorded member data
 * (organization_members.seniority; nothing records skills or availability, so those rules report themselves not applied).
 * No route calls this yet: an assignment is the officer's explicit selection (assignWorkersToDispatch), not an engine ranking.
 */
export async function rankCandidates(
  orgId: string,
  requestId: string,
  exec: RLSTx = db,
): Promise<DispatchRanking> {
  const [request] = await exec
    .select()
    .from(dispatchRequests)
    .where(
      and(
        eq(dispatchRequests.id, requestId),
        eq(dispatchRequests.orgId, orgId),
      ),
    );

  if (!request) throw new Error("Dispatch request not found.");

  const rules = await exec
    .select()
    .from(dispatchRules)
    .where(eq(dispatchRules.orgId, orgId))
    .orderBy(desc(dispatchRules.priority));
  const requiredSkills = (request.requiredSkills as string[] | null) ?? [];

  const members = await exec
    .select({ id: organizationMembers.id, name: organizationMembers.name, seniority: organizationMembers.seniority })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.status, "active")))
    .limit(DISPATCH_CANDIDATE_BOUND + 1);
  if (members.length > DISPATCH_CANDIDATE_BOUND) {
    throw new Error(`Ranking more than ${DISPATCH_CANDIDATE_BOUND} active members is not implemented.`);
  }

  const candidates: MemberCandidate[] = members.map((m) => ({
    memberId: m.id,
    name: m.name,
    seniority: m.seniority ?? null,
    skills: null,
    available: null,
  }));
  return rankByDispatchRules(candidates, requiredSkills, rules);
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
 * The officer chooses the members; the dispatch rules are not applied here (rankCandidates can order active members by a rule only
 * where the data is recorded, which today is seniority alone: nothing records member skills or availability). What this guarantees is that the choice is a valid one: the request is the caller's and
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
