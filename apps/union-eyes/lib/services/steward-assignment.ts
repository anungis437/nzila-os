/**
 * Steward Assignment Service
 *
 * Recommends and assigns stewards to grievances based on
 * region match, specialization, workload, and priority.
 *
 * Exposes `calculateStewardScore()` as an ML-ready scoring
 * function that can later be swapped for a trained model.
 */

import { db } from "@/db/db";
import { stewards } from "@/db/schema/domains/member/stewards";
import { stewardAssignments } from "@/db/schema/union-structure-schema";
import { grievances } from "@/db/schema/domains/claims/grievances";
import { eq, and, asc } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StewardCandidate {
  stewardId: string;
  userId: string;
  region: string | null;
  specialization: string | null;
  currentCaseload: number;
  maxCaseload: number;
  score: number;
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
export async function listStewards(orgId: string) {
  return db
    .select()
    .from(stewards)
    .where(and(eq(stewards.orgId, orgId), eq(stewards.active, true)))
    .orderBy(asc(stewards.region));
}

/**
 * Create a new steward profile.
 */
export async function createSteward(data: {
  orgId: string;
  userId: string;
  region?: string;
  specialization?: string;
}) {
  const [row] = await db
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
 */
export async function recommendSteward(
  orgId: string,
  grievanceId: string,
): Promise<StewardCandidate[]> {
  // Fetch the grievance
  const [grievance] = await db
    .select()
    .from(grievances)
    .where(
      and(eq(grievances.id, grievanceId), eq(grievances.organizationId, orgId)),
    );

  if (!grievance) {
    throw new Error("Grievance not found or not in this organization.");
  }

  // Fetch active stewards
  const activeStewards = await db
    .select()
    .from(stewards)
    .where(and(eq(stewards.orgId, orgId), eq(stewards.active, true)));

  // Score each
  const candidates: StewardCandidate[] = activeStewards.map((s) => ({
    stewardId: s.id,
    userId: s.userId,
    region: s.region,
    specialization: s.specialization,
    currentCaseload: s.currentCaseload,
    maxCaseload: s.maxCaseload,
    score: calculateStewardScore({
      stewardRegion: s.region,
      stewardSpecialization: s.specialization,
      currentCaseload: s.currentCaseload,
      maxCaseload: s.maxCaseload,
      grievanceCategory: grievance.type,
      grievancePriority: grievance.priority,
      grievanceRegion: grievance.workplaceName, // best-effort region proxy
    }),
  }));

  // Sort descending by score
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

/**
 * Assign a steward to a grievance — inserts assignment row
 * and bumps the steward's currentCaseload.
 */
export async function assignSteward(
  organizationId: string,
  grievanceId: string,
  stewardId: string,
) {
  // Insert assignment
  const [assignment] = await db
    .insert(stewardAssignments)
    .values({
      organizationId,
      grievanceId,
      stewardId,
      stewardType: 'steward',
      startDate: new Date().toISOString().slice(0, 10),
    })
    .returning();

  // Increment caseload
  const [steward] = await db
    .select()
    .from(stewards)
    .where(eq(stewards.id, stewardId));

  if (steward) {
    await db
      .update(stewards)
      .set({ currentCaseload: steward.currentCaseload + 1 })
      .where(eq(stewards.id, stewardId));
  }

  return assignment;
}
