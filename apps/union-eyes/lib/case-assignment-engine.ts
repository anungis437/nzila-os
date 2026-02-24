// ============================================================================
// INTELLIGENT CASE ASSIGNMENT ENGINE
// ============================================================================
// Description: Automated assignment system with workload balancing, expertise
//              matching, and multi-officer collaboration support
// Created: 2025-12-06
// ============================================================================

import { db } from "@/db/db";
import { eq, and, desc, or } from "drizzle-orm";
import {
  claims,
  grievanceAssignments,
  organizationMembers,
  type GrievanceAssignment,
} from "@/db/schema";
import { withRLSContext } from "@/lib/db/with-rls-context";

// ============================================================================
// TYPES
// ============================================================================

export type AssignmentCriteria = {
  claimType?: string;
  priority?: string;
  department?: string;
  location?: string;
  complexity?: number;
  estimatedHours?: number;
  requiresLegal?: boolean;
  requiresArbitration?: boolean;
};

export type OfficerProfile = {
  userId: string;
  name: string;
  role: string;
  expertise: string[]; // Claim types they specialize in
  maxCaseload: number;
  currentCaseload: number;
  availableHours: number;
  locations: string[]; // Geographic areas they cover
  successRate: number; // Win rate percentage
  avgResolutionDays: number;
  languages: string[];
  certifications: string[];
};

export type AssignmentRecommendation = {
  userId: string;
  name: string;
  score: number;
  reasons: string[];
  currentCaseload: number;
  availability: "available" | "busy" | "overloaded";
  estimatedCapacity: number; // Hours available
};

export type AssignmentResult = {
  success: boolean;
  assignmentId?: string;
  assignedTo?: string;
  role?: string;
  error?: string;
  recommendations?: AssignmentRecommendation[];
};

export type WorkloadStats = {
  userId: string;
  name: string;
  totalCases: number;
  activeCases: number;
  completedCases: number;
  avgResolutionDays: number;
  successRate: number;
  estimatedHoursRemaining: number;
  utilizationRate: number; // Percentage of capacity used
};

// ============================================================================
// INTELLIGENT ASSIGNMENT
// ============================================================================

/**
 * Automatically assign grievance to best-fit officer based on multiple factors
 */
export async function autoAssignGrievance(
  claimId: string,
  organizationId: string,
  criteria: AssignmentCriteria,
  assignedBy: string,
  options: {
    role?: "primary_officer" | "secondary_officer" | "legal_counsel";
    forceAssignment?: boolean;
    minScore?: number;
  } = {}
): Promise<AssignmentResult> {
  try {
    // Get claim details (wrapped with RLS for tenant isolation)
    const claim = await withRLSContext({ organizationId }, async (db) =>
      db.query.claims.findFirst({
        where: and(eq(claims.claimId, claimId), eq(claims.organizationId, organizationId)),
      })
    );

    if (!claim) {
      return { success: false, error: "Claim not found" };
    }

    // Get all eligible officers
    const officers = await getEligibleOfficers(organizationId, criteria);

    if (officers.length === 0) {
      return { success: false, error: "No eligible officers found" };
    }

    // Score and rank officers
    const recommendations = await scoreOfficers(
      officers,
      claim,
      criteria,
      organizationId
    );

    // Filter by minimum score threshold
    const minScore = options.minScore || 60;
    const qualifiedRecommendations = recommendations.filter(
      (r) => r.score >= minScore
    );

    if (qualifiedRecommendations.length === 0) {
      return {
        success: false,
        error: "No officers meet minimum qualification threshold",
        recommendations: recommendations.slice(0, 5),
      };
    }

    // Get best match
    const bestMatch = qualifiedRecommendations[0];

    // Check if forced assignment or officer is available
    if (!options.forceAssignment && bestMatch.availability === "overloaded") {
      return {
        success: false,
        error: "Best match is overloaded. Manual assignment required.",
        recommendations: qualifiedRecommendations.slice(0, 5),
      };
    }

    // Create assignment
    const role = options.role || "primary_officer";
    const [assignment] = await db
      .insert(grievanceAssignments)
      .values({
        organizationId,
        claimId,
        assignedTo: bestMatch.userId,
        role,
        status: "assigned",
        assignedBy,
        assignedAt: new Date(),
        estimatedHours: criteria.estimatedHours?.toString() || null,
        assignmentReason: `Auto-assigned based on: ${bestMatch.reasons.join(", ")}`,
      })
      .returning();

    // Update claim assignment
    await db
      .update(claims)
      .set({
        assignedTo: bestMatch.userId,
        assignedAt: new Date(),
      })
      .where(eq(claims.claimId, claimId));

    return {
      success: true,
      assignmentId: assignment.id,
      assignedTo: bestMatch.userId,
      role,
      recommendations: qualifiedRecommendations.slice(0, 5),
    };
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Manually assign grievance with validation
 */
export async function manuallyAssignGrievance(
  claimId: string,
  organizationId: string,
  assignedTo: string,
  assignedBy: string,
  options: {
    role?: "primary_officer" | "secondary_officer" | "legal_counsel" | "external_arbitrator";
    reason?: string;
    estimatedHours?: number;
    bypassWorkloadCheck?: boolean;
  } = {}
): Promise<AssignmentResult> {
  try {
    // Validate officer exists and has capacity (unless bypassed)
    if (!options.bypassWorkloadCheck) {
      const workload = await getOfficerWorkload(assignedTo, organizationId);
      
      if (workload && workload.utilizationRate > 100) {
        return {
          success: false,
          error: `Officer is at ${workload.utilizationRate}% capacity. Use bypassWorkloadCheck to force assignment.`,
        };
      }
    }

    // Check if already assigned (wrapped with RLS for tenant isolation)
    const existing = await withRLSContext({ organizationId }, async (db) =>
      db.query.grievanceAssignments.findFirst({
        where: and(
          eq(grievanceAssignments.claimId, claimId),
          eq(grievanceAssignments.assignedTo, assignedTo),
          eq(grievanceAssignments.status, "assigned")
        ),
      })
    );

    if (existing) {
      return {
        success: false,
        error: "Officer already assigned to this grievance",
      };
    }

    // Create assignment (wrapped with RLS for tenant isolation)
    const role = options.role || "primary_officer";
    const [assignment] = await withRLSContext({ organizationId }, async (db) =>
      db
        .insert(grievanceAssignments)
        .values({
          organizationId,
          claimId,
          assignedTo,
          role,
          status: "assigned",
          assignedBy,
          assignedAt: new Date(),
          estimatedHours: options.estimatedHours?.toString() || null,
          assignmentReason: options.reason || "Manual assignment",
        })
        .returning()
    );

    // Update claim if primary officer (wrapped with RLS for tenant isolation)
    if (role === "primary_officer") {
      await withRLSContext({ organizationId }, async (db) =>
        db
          .update(claims)
          .set({
            assignedTo,
            assignedAt: new Date(),
          })
          .where(eq(claims.claimId, claimId))
      );
    }

    return {
      success: true,
      assignmentId: assignment.id,
      assignedTo,
      role,
    };
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Reassign grievance to different officer
 */
export async function reassignGrievance(
  claimId: string,
  organizationId: string,
  currentAssignmentId: string,
  newAssignedTo: string,
  reassignedBy: string,
  reason: string
): Promise<AssignmentResult> {
  try {
    // Get current assignment (wrapped with RLS for tenant isolation)
    const currentAssignment = await withRLSContext({ organizationId }, async (db) =>
      db.query.grievanceAssignments.findFirst({
        where: and(
          eq(grievanceAssignments.id, currentAssignmentId),
          eq(grievanceAssignments.organizationId, organizationId)
        ),
      })
    );

    if (!currentAssignment) {
      return { success: false, error: "Assignment not found" };
    }

    // Mark current assignment as reassigned
    await db
      .update(grievanceAssignments)
      .set({
        status: "reassigned",
        notes: `Reassigned to new officer: ${reason}`,
      })
      .where(eq(grievanceAssignments.id, currentAssignmentId));

    // Create new assignment
    const result = await manuallyAssignGrievance(
      claimId,
      organizationId,
      newAssignedTo,
      reassignedBy,
      {
        role: currentAssignment.role as "primary_officer" | "secondary_officer" | "legal_counsel" | "external_arbitrator" | undefined,
        reason: `Reassignment: ${reason}`,
        estimatedHours: currentAssignment.estimatedHours
          ? Number(currentAssignment.estimatedHours)
          : undefined,
      }
    );

    return result;
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get assignment recommendations without creating assignment
 */
export async function getAssignmentRecommendations(
  claimId: string,
  organizationId: string,
  criteria: AssignmentCriteria
): Promise<AssignmentRecommendation[]> {
  try {
    // Get claim details (wrapped with RLS for tenant isolation)
    const claim = await withRLSContext({ organizationId }, async (db) =>
      db.query.claims.findFirst({
        where: and(eq(claims.claimId, claimId), eq(claims.organizationId, organizationId)),
      })
    );

    if (!claim) return [];

    const officers = await getEligibleOfficers(organizationId, criteria);
    const recommendations = await scoreOfficers(officers, claim, criteria, organizationId);

    return recommendations.slice(0, 10); // Top 10 recommendations
  } catch (_error) {
return [];
  }
}

// ============================================================================
// OFFICER SCORING & MATCHING
// ============================================================================

/**
 * Get eligible officers based on basic criteria
 */
async function getEligibleOfficers(
  organizationId: string,
  _criteria: AssignmentCriteria
): Promise<OfficerProfile[]> {
  try {
    // Get active officers (wrapped with RLS for tenant isolation)
    const officers = await withRLSContext({ organizationId }, async (db) =>
      db.query.organizationMembers.findMany({
        where: and(
          eq(organizationMembers.organizationId, organizationId),
          or(
            eq(organizationMembers.role, "union_officer"),
            eq(organizationMembers.role, "union_steward"),
            eq(organizationMembers.role, "admin")
          ),
          eq(organizationMembers.status, "active")
        ),
      })
    );

    // Build officer profiles
    const profiles: OfficerProfile[] = [];
    
    for (const officer of officers) {
      const workload = await getOfficerWorkload(officer.userId, organizationId);
      
      // Extract metadata (this would come from officer profile/settings)
      // Note: organizationMembers doesn&apos;t have metadata - using defaults
      const metadata: Record<string, unknown> = {};
      
      profiles.push({
        userId: officer.userId,
        name: officer.membershipNumber || officer.userId, // Use membershipNumber or userId as fallback
        role: officer.role,
        expertise: (metadata.expertise as string[]) || [],
        maxCaseload: (metadata.maxCaseload as number) || 20,
        currentCaseload: workload?.activeCases || 0,
        availableHours: (metadata.weeklyHours as number) || 40,
        locations: (metadata.locations as string[]) || [],
        successRate: workload?.successRate || 0,
        avgResolutionDays: workload?.avgResolutionDays || 0,
        languages: (metadata.languages as string[]) || ["English"],
        certifications: (metadata.certifications as string[]) || [],
      });
    }

    return profiles;
  } catch (_error) {
return [];
  }
}

/**
 * Score officers based on multiple weighted factors
 */
async function scoreOfficers(
  officers: OfficerProfile[],
  claim: unknown,
  criteria: AssignmentCriteria,
  _organizationId: string
): Promise<AssignmentRecommendation[]> {
  const recommendations: AssignmentRecommendation[] = [];

  for (const officer of officers) {
    let score = 0;
    const reasons: string[] = [];

    // Factor 1: Expertise match (30 points max)
    if (criteria.claimType && officer.expertise.includes(criteria.claimType)) {
      score += 30;
      reasons.push("Expertise in claim type");
    } else if (officer.expertise.length > 0) {
      score += 10;
      reasons.push("General expertise");
    }

    // Factor 2: Workload balance (25 points max)
    const utilizationRate = (officer.currentCaseload / officer.maxCaseload) * 100;
    if (utilizationRate < 50) {
      score += 25;
      reasons.push("Low caseload");
    } else if (utilizationRate < 75) {
      score += 15;
      reasons.push("Moderate caseload");
    } else if (utilizationRate < 100) {
      score += 5;
      reasons.push("Near capacity");
    } else {
      score -= 10;
      reasons.push("At/over capacity");
    }

    // Factor 3: Success rate (20 points max)
    if (officer.successRate >= 80) {
      score += 20;
      reasons.push("High success rate");
    } else if (officer.successRate >= 60) {
      score += 12;
      reasons.push("Good success rate");
    } else if (officer.successRate > 0) {
      score += 5;
    }

    // Factor 4: Location match (15 points max)
    if (criteria.location && officer.locations.includes(criteria.location)) {
      score += 15;
      reasons.push("Location match");
    } else if (officer.locations.length > 0) {
      score += 5;
    }

    // Factor 5: Availability (10 points max)
    const hoursAvailable = officer.availableHours - (officer.currentCaseload * 2); // Rough estimate
    if (criteria.estimatedHours) {
      if (hoursAvailable >= criteria.estimatedHours) {
        score += 10;
        reasons.push("Has time capacity");
      } else {
        score += 3;
      }
    } else {
      score += 5;
    }

    // Determine availability status
    let availability: "available" | "busy" | "overloaded";
    if (utilizationRate < 75) {
      availability = "available";
    } else if (utilizationRate < 100) {
      availability = "busy";
    } else {
      availability = "overloaded";
    }

    recommendations.push({
      userId: officer.userId,
      name: officer.name,
      score: Math.max(0, Math.min(100, score)), // Clamp to 0-100
      reasons,
      currentCaseload: officer.currentCaseload,
      availability,
      estimatedCapacity: Math.max(0, hoursAvailable),
    });
  }

  // Sort by score (descending)
  return recommendations.sort((a, b) => b.score - a.score);
}

// ============================================================================
// WORKLOAD MANAGEMENT
// ============================================================================

/**
 * Get officer's current workload and statistics
 */
export async function getOfficerWorkload(
  userId: string,
  organizationId: string
): Promise<WorkloadStats | null> {
  try {
    // Get all assignments for this officer (wrapped with RLS for tenant isolation)
    const assignments = await withRLSContext({ organizationId }, async (db) =>
      db.query.grievanceAssignments.findMany({
        where: and(
          eq(grievanceAssignments.assignedTo, userId),
          eq(grievanceAssignments.organizationId, organizationId)
        ),
        with: {
          claim: true,
        },
      })
    );

    // Calculate statistics
    const totalCases = assignments.length;
    const activeCases = assignments.filter(
      (a) => a.status === "assigned" || a.status === "accepted" || a.status === "in_progress"
    ).length;
    const completedCases = assignments.filter((a) => a.status === "completed").length;

    // Calculate average resolution time for completed cases
    let avgResolutionDays = 0;
    if (completedCases > 0) {
      const completedAssignments = assignments.filter((a) => a.status === "completed");
      const totalDays = completedAssignments.reduce((sum, a) => {
        if (a.assignedAt && a.completedAt) {
          const days = Math.ceil(
            (new Date(a.completedAt).getTime() - new Date(a.assignedAt).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          return sum + days;
        }
        return sum;
      }, 0);
      avgResolutionDays = Math.round(totalDays / completedCases);
    }

    // Calculate success rate (resolved vs total completed)
    let successRate = 0;
    if (completedCases > 0) {
      const successfulCases = assignments.filter(
        (a) =>
          a.status === "completed" &&
          a.claim &&
          (a.claim.status === "resolved" || a.claim.resolutionOutcome === "favorable")
      ).length;
      successRate = Math.round((successfulCases / completedCases) * 100);
    }

    // Estimate hours remaining
    const estimatedHoursRemaining = assignments
      .filter((a) => a.status !== "completed" && a.estimatedHours)
      .reduce((sum, a) => sum + (Number(a.estimatedHours) || 0), 0);

    // Get officer profile for max caseload (wrapped with RLS for tenant isolation)
    const officer = await withRLSContext({ organizationId }, async (db) =>
      db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId)
        ),
      })
    );

    const metadata: Record<string, unknown> = {};
    const maxCaseload = Number(metadata.maxCaseload) || 20;
    const utilizationRate = Math.round((activeCases / maxCaseload) * 100);

    return {
      userId,
      name: officer?.membershipNumber || officer?.userId || "Unknown",
      totalCases,
      activeCases,
      completedCases,
      avgResolutionDays,
      successRate,
      estimatedHoursRemaining,
      utilizationRate,
    };
  } catch (_error) {
    return null;
  }
}

/**
 * Get workload statistics for all officers in tenant
 */
export async function getTenantWorkloadReport(
  organizationId: string
): Promise<WorkloadStats[]> {
  try {
    // Get all active officers (wrapped with RLS for tenant isolation)
    const officers = await withRLSContext({ organizationId }, async (db) =>
      db.query.organizationMembers.findMany({
        where: and(
          eq(organizationMembers.organizationId, organizationId),
          or(
            eq(organizationMembers.role, "union_officer"),
            eq(organizationMembers.role, "union_steward"),
            eq(organizationMembers.role, "admin")
          ),
          eq(organizationMembers.status, "active")
        ),
      })
    );

    const workloadStats: WorkloadStats[] = [];

    for (const officer of officers) {
      const stats = await getOfficerWorkload(officer.userId, organizationId);
      if (stats) {
        workloadStats.push(stats);
      }
    }

    // Sort by utilization rate (descending)
    return workloadStats.sort((a, b) => b.utilizationRate - a.utilizationRate);
  } catch (_error) {
    return [];
  }
}

/**
 * Balance workload by suggesting reassignments
 */
export async function suggestWorkloadBalancing(
  organizationId: string
): Promise<Array<{
  claimId: string;
  currentOfficer: string;
  suggestedOfficer: string;
  reason: string;
}>> {
  try {
    const workloadReport = await getTenantWorkloadReport(organizationId);
    
    // Find overloaded officers (>90% utilization)
    const overloaded = workloadReport.filter((w) => w.utilizationRate > 90);
    
    // Find available officers (<60% utilization)
    const available = workloadReport.filter((w) => w.utilizationRate < 60);

    if (overloaded.length === 0 || available.length === 0) {
      return []; // No balancing needed
    }

    const suggestions: Array<{
      claimId: string;
      currentOfficer: string;
      suggestedOfficer: string;
      reason: string;
    }> = [];

    // For each overloaded officer, suggest moving their newest cases
    for (const overloadedOfficer of overloaded) {
      // Get their recent assignments (wrapped with RLS for tenant isolation)
      const recentAssignments = await withRLSContext({ organizationId }, async (db) =>
        db.query.grievanceAssignments.findMany({
          where: and(
            eq(grievanceAssignments.assignedTo, overloadedOfficer.userId),
            eq(grievanceAssignments.organizationId, organizationId),
            eq(grievanceAssignments.status, "assigned")
          ),
          orderBy: [desc(grievanceAssignments.assignedAt)],
          limit: 3,
        })
      );

      // Suggest moving to least utilized officer
      const leastUtilized = available[available.length - 1];

      for (const assignment of recentAssignments) {
        suggestions.push({
          claimId: assignment.claimId,
          currentOfficer: overloadedOfficer.name,
          suggestedOfficer: leastUtilized.name,
          reason: `Balance workload: ${overloadedOfficer.name} at ${overloadedOfficer.utilizationRate}%, ${leastUtilized.name} at ${leastUtilized.utilizationRate}%`,
        });
      }
    }

    return suggestions;
  } catch (_error) {
return [];
  }
}

// ============================================================================
// COLLABORATION SUPPORT
// ============================================================================

/**
 * Add collaborator to grievance (secondary officer, legal counsel, etc.)
 */
export async function addCollaborator(
  claimId: string,
  organizationId: string,
  userId: string,
  role: "secondary_officer" | "legal_counsel" | "external_arbitrator" | "witness" | "observer",
  addedBy: string,
  reason?: string
): Promise<AssignmentResult> {
  return await manuallyAssignGrievance(claimId, organizationId, userId, addedBy, {
    role: role as "primary_officer" | "secondary_officer" | "legal_counsel" | "external_arbitrator" | undefined,
    reason: reason || `Added as ${role}`,
    bypassWorkloadCheck: role !== "secondary_officer", // Only check workload for officers
  });
}

/**
 * Remove collaborator from grievance
 */
export async function removeCollaborator(
  assignmentId: string,
  organizationId: string,
  removedBy: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const assignment = await withRLSContext({ organizationId }, async (db) =>
      db.query.grievanceAssignments.findFirst({
        where: and(
          eq(grievanceAssignments.id, assignmentId),
          eq(grievanceAssignments.organizationId, organizationId)
        ),
      })
    );

    if (!assignment) {
      return { success: false, error: "Assignment not found" };
    }

    // Don&apos;t allow removing primary officer this way
    if (assignment.role === "primary_officer") {
      return {
        success: false,
        error: "Cannot remove primary officer. Use reassignment instead.",
      };
    }

    // Mark assignment as completed
    await db
      .update(grievanceAssignments)
      .set({
        status: "completed",
        completedAt: new Date(),
        notes: `Removed by ${removedBy}: ${reason}`,
      })
      .where(eq(grievanceAssignments.id, assignmentId));

    return { success: true };
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get all assignments/collaborators for a grievance
 */
export async function getGrievanceTeam(
  claimId: string,
  organizationId: string
): Promise<Array<GrievanceAssignment & { officerName: string; officerRole: string }>> {
  try {
    const assignments = await withRLSContext({ organizationId }, async (db) =>
      db.query.grievanceAssignments.findMany({
        where: and(
          eq(grievanceAssignments.claimId, claimId),
          eq(grievanceAssignments.organizationId, organizationId)
        ),
        orderBy: [desc(grievanceAssignments.assignedAt)],
      })
    );

    // Enrich with officer details
    const enriched = await Promise.all(
      assignments.map(async (assignment) => {
        const officer = await withRLSContext({ organizationId }, async (db) =>
          db.query.organizationMembers.findFirst({
            where: eq(organizationMembers.userId, assignment.assignedTo),
          })
        );

        return {
          ...assignment,
          officerName: officer?.membershipNumber || officer?.userId || "Unknown",
          officerRole: officer?.role || "unknown",
        };
      })
    );

    return enriched;
  } catch (_error) {
return [];
  }
}

