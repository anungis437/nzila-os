/**
 * Steward Assignment Service
 *
 * Recommends and assigns stewards to grievances based on
 * recorded expertise and actual open workload. Recommendation order follows the
 * same deterministic policy as automatic assignment; the kernel decides each grant.
 */

import type { RLSTx } from "@/lib/db/with-rls-context";
import { ApiError } from "@/lib/api/errors";
import { stewards } from "@/db/schema/domains/member/stewards";
import { stewardAssignments } from "@/db/schema/union-structure-schema";
import { grievances } from "@/db/schema/domains/claims/grievances";
import { matchingRepresentativeEligible } from '@/lib/cases/assignment-eligibility';
import { drizzleExecutor } from '@/lib/authority/store/route-adapter';
import { ACTIVE_RECUSAL_SQL } from '@/lib/authority/common';
import { representativeWorkloads } from '@/lib/cases/assignment-capacity';
import { matchingExpertise, rankMatchingProfiles } from '@/lib/cases/assignment-ranking';
import { eq, and, asc, sql } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StewardCandidate {
  stewardId: string;
  userId: string;
  region: string | null;
  specialization: string | null;
  currentCaseload: number;
  maxCaseload: number;
  score: number;
  exactExpertise?: boolean;
}

export interface ScoringInput {
  stewardRegion: string | null;
  stewardSpecialization: string | null;
  currentCaseload: number;
  maxCaseload: number;
  grievanceCategory: string | null;
  grievancePriority: string | null;
  grievanceRegion?: string | null;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 1.5,
  high: 1.3,
  medium: 1.0,
  low: 0.8,
};

/**
 * ML-ready scoring function.
 *
 * Produces a 0–100 score for a steward/grievance pair.
 * Higher = better fit.
 */
export function calculateStewardScore(input: ScoringInput): number {
  let score = 50; // baseline

  // ------ Region match (0 | +25) ------
  if (
    input.stewardRegion &&
    input.grievanceRegion &&
    input.stewardRegion.toLowerCase() === input.grievanceRegion.toLowerCase()
  ) {
    score += 25;
  }

  // ------ Specialization match (0 | +25) ------
  if (
    input.stewardSpecialization &&
    input.grievanceCategory &&
    input.stewardSpecialization.toLowerCase() ===
      input.grievanceCategory.toLowerCase()
  ) {
    score += 25;
  }

  // ------ Workload capacity (0–20 points) ------
  const headroom = input.maxCaseload - input.currentCaseload;
  const capacityRatio = input.maxCaseload > 0 ? headroom / input.maxCaseload : 0;
  score += Math.round(capacityRatio * 20);

  // ------ Priority weighting ------
  const weight = PRIORITY_WEIGHT[input.grievancePriority ?? "medium"] ?? 1.0;
  score = Math.round(score * weight);

  return Math.max(0, Math.min(100, score));
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * List active stewards for an organization.
 */
export async function listStewards(orgId: string, tx: RLSTx) {
  return tx
    .select()
    .from(stewards)
    .where(and(eq(stewards.orgId, orgId), eq(stewards.active, true)))
    .orderBy(asc(stewards.region));
}

/**
 * Create a new steward profile.
 */
export async function createSteward(
  data: {
    orgId: string;
    userId: string;
    region?: string;
    specialization?: string;
  },
  tx: RLSTx,
) {
  const [row] = await tx
    .insert(stewards)
    .values({
      orgId: data.orgId,
      userId: data.userId,
      region: data.region ?? null,
      specialization: data.specialization ?? null,
    })
    .returning();
  return row;
}

/**
 * Recommend the best steward for a given grievance.
 * Runs on the caller's tenant transaction, so both reads are the caller's organization's.
 */
export async function recommendSteward(
  orgId: string,
  grievanceId: string,
  tx: RLSTx,
  issuerUserId: string,
): Promise<StewardCandidate[]> {
  const [grievance] = await tx
    .select({ id: grievances.id, type: grievances.type })
    .from(grievances)
    .where(
      and(eq(grievances.id, grievanceId), eq(grievances.organizationId, orgId)),
    );

  if (!grievance) {
    throw ApiError.notFound("Grievance");
  }

  // Fetch active stewards
  const activeStewards = await tx
    .select()
    .from(stewards)
    .where(and(eq(stewards.orgId, orgId), eq(stewards.active, true)));

  const workloads = await representativeWorkloads(tx, orgId, activeStewards.map(profile => profile.userId));
  const recused = new Set((await drizzleExecutor(tx).query<{ principal_user_id: string }>(
    `SELECT principal_user_id FROM ue_authority_recusals WHERE organization_id=$1::uuid
      AND resource_type='case' AND resource_id=$2::uuid AND ${ACTIVE_RECUSAL_SQL}`, [orgId, grievanceId],
  )).rows.map(row => row.principal_user_id));
  const ranked = rankMatchingProfiles(activeStewards.map(profile => ({
    id: profile.id, userId: profile.userId, specialization: profile.specialization,
    maxCaseload: profile.maxCaseload, openCases: workloads.get(profile.userId) ?? 0,
  })), grievance.type);
  const candidates: StewardCandidate[] = [];
  for (const profile of ranked) {
    if (profile.userId === issuerUserId || recused.has(profile.userId) ||
      !(await matchingRepresentativeEligible(tx, { userId: issuerUserId, organizationId: orgId }, profile.userId))) continue;
    const stored = activeStewards.find(row => row.id === profile.id)!;
    const exactExpertise = matchingExpertise(profile.specialization, grievance.type);
    candidates.push({ stewardId: profile.id, userId: profile.userId, region: stored.region,
      specialization: profile.specialization, currentCaseload: profile.openCases, maxCaseload: profile.maxCaseload,
      exactExpertise, score: Math.round((1 - profile.openCases / profile.maxCaseload) * 100),
    });
  }
  return candidates;
}

/**
 * Assign a steward to a grievance — inserts assignment row
 * and bumps the steward's currentCaseload.
 * Runs on the caller's tenant transaction, so the assignment and the caseload change commit with the rest of the assignment.
 */
export async function assignSteward(
  organizationId: string,
  grievanceId: string,
  stewardId: string,
  tx: RLSTx,
) {
  // Recommendations and the UI identify a steward PROFILE. Authority, mirrors and
  // reminder recipients identify the canonical PERSON; these UUIDs are distinct.
  const [profile] = await tx
    .select({ userId: stewards.userId })
    .from(stewards)
    .where(and(eq(stewards.id, stewardId), eq(stewards.orgId, organizationId), eq(stewards.active, true)))
    .limit(1)
    .for('update');
  if (!profile) throw ApiError.notFound('Steward');

  // Insert assignment
  const [assignment] = await tx
    .insert(stewardAssignments)
    .values({
      organizationId,
      grievanceId,
      stewardId: profile.userId,
      stewardType: 'steward',
      startDate: new Date().toISOString().slice(0, 10),
    })
    .returning();

  // Increment caseload in the statement itself: a read-then-write would lose a concurrent assignment.
  await tx
    .update(stewards)
    .set({ currentCaseload: sql`${stewards.currentCaseload} + 1` })
    .where(and(eq(stewards.id, stewardId), eq(stewards.orgId, organizationId)));

  return assignment;
}
