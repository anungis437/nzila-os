/**
 * Pilot Readiness Assessment Service
 * 
 * Purpose: Evaluate organization readiness for Union Eyes pilot program
 * Helps determine success likelihood and resource requirements
 */

import { PilotApplicationInput } from '@/types/marketing';

export interface ReadinessAssessmentResult {
  score: number; // 0-100
  level: 'ready' | 'mostly-ready' | 'needs-preparation' | 'not-ready';
  strengths: string[];
  concerns: string[];
  recommendations: string[];
  estimatedSetupTime: string; // e.g., "2-3 weeks"
  supportLevel: 'minimal' | 'standard' | 'intensive';
}

/**
 * Calculate readiness score based on application responses
 */
export function calculateReadinessScore(
  application: PilotApplicationInput
): ReadinessAssessmentResult {
  let score = 0;
  const strengths: string[] = [];
  const concerns: string[] = [];
  const recommendations: string[] = [];

  // Size & Scale (20 points)
  const sizeScore = evaluateSize(application.memberCount);
  score += sizeScore.points;
  if (sizeScore.strength) strengths.push(sizeScore.strength);
  if (sizeScore.concern) concerns.push(sizeScore.concern);

  // Current System State (25 points)
  const systemScore = evaluateCurrentSystem(application.currentSystem, application.challenges);
  score += systemScore.points;
  if (systemScore.strength) strengths.push(systemScore.strength);
  if (systemScore.concern) concerns.push(systemScore.concern);

  // Leadership Buy-in (20 points)
  const leadershipScore = evaluateLeadership(application.responses);
  score += leadershipScore.points;
  if (leadershipScore.strength) strengths.push(leadershipScore.strength);
  if (leadershipScore.concern) concerns.push(leadershipScore.concern);

  // Technical Capacity (15 points)
  const techScore = evaluateTechnicalCapacity(application.responses);
  score += techScore.points;
  if (techScore.strength) strengths.push(techScore.strength);
  if (techScore.concern) concerns.push(techScore.concern);

  // Organizational Complexity (10 points)
  const complexityScore = evaluateComplexity(
    application.jurisdictions,
    application.sectors
  );
  score += complexityScore.points;
  if (complexityScore.strength) strengths.push(complexityScore.strength);
  if (complexityScore.concern) concerns.push(complexityScore.concern);

  // Clear Goals (10 points)
  const goalsScore = evaluateGoals(application.goals);
  score += goalsScore.points;
  if (goalsScore.strength) strengths.push(goalsScore.strength);
  if (goalsScore.concern) concerns.push(goalsScore.concern);

  // Generate recommendations
  recommendations.push(...generateRecommendations(score, concerns, application));

  // Determine level
  const level = determineReadinessLevel(score);
  const estimatedSetupTime = estimateSetupTime(score, application);
  const supportLevel = determineSupportLevel(score, concerns.length);

  return {
    score,
    level,
    strengths,
    concerns,
    recommendations,
    estimatedSetupTime,
    supportLevel,
  };
}

/**
 * Evaluate organization size and scale
 */
function evaluateSize(memberCount: number): {
  points: number;
  strength?: string;
  concern?: string;
} {
  if (memberCount >= 500 && memberCount <= 5000) {
    return {
      points: 20,
      strength: 'Ideal pilot size: Large enough for meaningful data, small enough for manageable rollout',
    };
  }

  if (memberCount >= 200 && memberCount < 500) {
    return {
      points: 15,
      strength: 'Good pilot size: Manageable scope with representative use cases',
    };
  }

  if (memberCount > 5000) {
    return {
      points: 12,
      concern: 'Large membership may require phased rollout and additional support',
    };
  }

  return {
    points: 10,
    concern: 'Small membership may limit feedback diversity. Consider partnering with another local.',
  };
}

/**
 * Evaluate current system state and pain points
 */
function evaluateCurrentSystem(
  currentSystem: string | undefined,
  challenges: string[]
): {
  points: number;
  strength?: string;
  concern?: string;
} {
  const hasCriticalPainPoints = challenges.some((c) =>
    /lost|missing|spreadsheet|paper|manual|disorganized/i.test(c)
  );

  const hasNoSystem = !currentSystem || /none|manual|spreadsheet|excel/i.test(currentSystem);

  if (hasCriticalPainPoints && hasNoSystem) {
    return {
      points: 25,
      strength: 'Clear pain points with current process. High motivation for improvement.',
    };
  }

  if (hasCriticalPainPoints) {
    return {
      points: 20,
      strength: 'Documented challenges provide clear improvement targets',
    };
  }

  if (currentSystem && !/union eyes|digital/i.test(currentSystem)) {
    return {
      points: 15,
      concern: 'Existing system in place. May require change management and data migration.',
    };
  }

  return {
    points: 10,
    concern: 'Unclear on current challenges. May need discovery phase to identify pain points.',
  };
}

/**
 * Evaluate leadership buy-in and commitment
 */
function evaluateLeadership(responses: Record<string, unknown>): {
  points: number;
  strength?: string;
  concern?: string;
} {
  const hasExecutiveSponsor = responses.executiveSponsor === true;
  const hasStaffCommitment = responses.staffCommitment === 'high' || responses.staffCommitment === 'medium';
  const hasBudget = responses.budgetApproved === true;

  if (hasExecutiveSponsor && hasStaffCommitment && hasBudget) {
    return {
      points: 20,
      strength: 'Strong leadership commitment with executive sponsor and approved resources',
    };
  }

  if (hasExecutiveSponsor || hasStaffCommitment) {
    return {
      points: 15,
      strength: 'Leadership support present. May need to secure additional buy-in.',
    };
  }

  return {
    points: 8,
    concern: 'Limited leadership commitment. Pilot success requires executive support and resources.',
  };
}

/**
 * Evaluate technical capacity
 */
function evaluateTechnicalCapacity(responses: Record<string, unknown>): {
  points: number;
  strength?: string;
  concern?: string;
} {
  const hasITSupport = responses.hasITSupport === true;
  const hasDataAccess = responses.hasDataAccess !== false;
  const staffComfort = responses.staffTechComfort || 'medium';

  if (hasITSupport && hasDataAccess && staffComfort === 'high') {
    return {
      points: 15,
      strength: 'Strong technical capacity with IT support and comfortable staff',
    };
  }

  if (hasDataAccess && staffComfort !== 'low') {
    return {
      points: 12,
      strength: 'Adequate technical capacity. May need training but foundation is solid.',
    };
  }

  if (staffComfort === 'low') {
    return {
      points: 7,
      concern: 'Staff unfamiliar with digital tools. Will require extensive training and support.',
    };
  }

  return {
    points: 10,
  };
}

/**
 * Evaluate organizational complexity
 */
function evaluateComplexity(
  jurisdictions: string[],
  sectors: string[]
): {
  points: number;
  strength?: string;
  concern?: string;
} {
  const isSimple = jurisdictions.length === 1 && sectors.length <= 2;
  const isModerate = jurisdictions.length <= 2 && sectors.length <= 3;

  if (isSimple) {
    return {
      points: 10,
      strength: 'Single jurisdiction and focused sector. Clean, manageable pilot scope.',
    };
  }

  if (isModerate) {
    return {
      points: 8,
      strength: 'Moderate complexity. Provides good test of multi-jurisdictional features.',
    };
  }

  return {
    points: 5,
    concern: 'High complexity across jurisdictions/sectors. May need phased rollout.',
  };
}

/**
 * Evaluate goal clarity
 */
function evaluateGoals(goals: string[]): {
  points: number;
  strength?: string;
  concern?: string;
} {
  if (goals.length >= 3 && goals.length <= 5) {
    const hasMeasurable = goals.some((g) =>
      /reduce|improve|increase|decrease|faster|better/i.test(g)
    );

    if (hasMeasurable) {
      return {
        points: 10,
        strength: 'Clear, measurable goals. Easy to track pilot success.',
      };
    }

    return {
      points: 8,
      strength: 'Goals identified. May need to refine success metrics.',
    };
  }

  if (goals.length < 3) {
    return {
      points: 5,
      concern: 'Limited goals defined. Recommend establishing clear success criteria.',
    };
  }

  return {
    points: 7,
    concern: 'Many goals listed. May need to prioritize for focused pilot.',
  };
}

/**
 * Determine readiness level from score
 */
function determineReadinessLevel(
  score: number
): 'ready' | 'mostly-ready' | 'needs-preparation' | 'not-ready' {
  if (score >= 80) return 'ready';
  if (score >= 65) return 'mostly-ready';
  if (score >= 50) return 'needs-preparation';
  return 'not-ready';
}

/**
 * Estimate setup time based on readiness
 */
function estimateSetupTime(score: number, application: PilotApplicationInput): string {
  const baseWeeks = 2;
  const complexityWeeks = Math.max(application.jurisdictions.length - 1, 0);
  const sizeWeeks = application.memberCount > 2000 ? 1 : 0;
  const readinessWeeks = score < 70 ? 2 : 0;

  const totalWeeks = baseWeeks + complexityWeeks + sizeWeeks + readinessWeeks;

  if (totalWeeks <= 2) return '2-3 weeks';
  if (totalWeeks <= 4) return '3-4 weeks';
  if (totalWeeks <= 6) return '4-6 weeks';
  return '6-8 weeks';
}

/**
 * Determine support level needed
 */
function determineSupportLevel(
  score: number,
  concernCount: number
): 'minimal' | 'standard' | 'intensive' {
  if (score >= 80 && concernCount <= 1) return 'minimal';
  if (score >= 65 && concernCount <= 3) return 'standard';
  return 'intensive';
}

/**
 * Generate specific recommendations
 */
function generateRecommendations(
  score: number,
  concerns: string[],
  application: PilotApplicationInput
): string[] {
  const recommendations: string[] = [];

  if (score >= 80) {
    recommendations.push('Organization is ready to proceed with pilot immediately');
    recommendations.push('Schedule kickoff meeting within 1 week');
  } else if (score >= 65) {
    recommendations.push('Address identified concerns before pilot launch');
    recommendations.push('Complete pre-pilot preparation phase (2-3 weeks)');
  } else {
    recommendations.push('Conduct discovery phase before committing to pilot');
    recommendations.push('Build internal alignment and secure executive sponsorship');
  }

  if (concerns.some((c) => /leadership|commitment|buy-in/i.test(c))) {
    recommendations.push('Schedule alignment meeting with union executives');
    recommendations.push('Present business case with projected ROI');
  }

  if (concerns.some((c) => /technical|training|unfamiliar/i.test(c))) {
    recommendations.push('Plan comprehensive training program for staff');
    recommendations.push('Identify internal tech champions for peer support');
  }

  if (application.memberCount > 3000) {
    recommendations.push('Consider phased rollout by department or region');
  }

  if (application.jurisdictions.length > 2) {
    recommendations.push('Start with single jurisdiction, expand based on results');
  }

  return recommendations;
}

/**
 * Example usage:
 * 
 * const assessment = calculateReadinessScore({
 *   organizationName: "Healthcare Workers Union Local 123",
 *   memberCount: 1200,
 *   jurisdictions: ["ON"],
 *   sectors: ["healthcare"],
 *   currentSystem: "Excel spreadsheets",
 *   challenges: ["Lost documents", "Manual tracking", "No audit trail"],
 *   goals: ["Reduce resolution time", "Improve documentation", "Better member experience"],
 *   responses: {
 *     executiveSponsor: true,
 *     staffCommitment: "high",
 *     budgetApproved: true,
 *     hasITSupport: true,
 *     staffTechComfort: "medium"
 *   }
 * });
 * 
 * logger.info(`Readiness: ${assessment.level} (${assessment.score}/100)`);
 * logger.info(`Estimated setup: ${assessment.estimatedSetupTime}`);
 */
