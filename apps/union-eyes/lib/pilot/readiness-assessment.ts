/**
 * Pilot Readiness Assessment Service
 * 
 * Purpose: Evaluate organization readiness for UnionEyes pilot program
 * Helps determine success likelihood and resource requirements
 */

import { PilotApplicationInput } from '@/types/marketing';
import {
  buildContinuityReadinessProfile,
  buildExecutiveReadinessOutputs,
} from '@/lib/operational-legitimacy';

export interface ReadinessAssessmentResult {
  score: number; // 0-100
  level: 'ready' | 'mostly-ready' | 'needs-preparation' | 'not-ready';
  strengths: string[];
  concerns: string[];
  recommendations: string[];
  estimatedSetupTime: string; // e.g., "2-3 weeks"
  supportLevel: 'minimal' | 'standard' | 'intensive';
  continuityProfile: string;
  continuityOverview: {
    continuityPosture: string;
    governanceCoherence: string;
    operationalStability: string;
    institutionalMemoryHealth: string;
  };
  continuityRiskNarratives: string[];
  governanceAlignmentSummary: string;
  fragmentationObservations: string[];
  institutionalResilienceDirection: string;
  rolloutRecommendation: string;
}

/**
 * Calculate directional readiness profile based on application responses.
 * The score represents institutional deployment readiness, not worker performance.
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
  const continuityProfile = buildContinuityReadinessProfile(application);
  const executiveOutputs = buildExecutiveReadinessOutputs(continuityProfile, application);

  return {
    score,
    level,
    strengths,
    concerns,
    recommendations,
    estimatedSetupTime,
    supportLevel,
    continuityProfile: executiveOutputs.continuityProfile,
    continuityOverview: executiveOutputs.continuityOverview,
    continuityRiskNarratives: executiveOutputs.continuityRiskNarratives,
    governanceAlignmentSummary: executiveOutputs.governanceAlignmentSummary,
    fragmentationObservations: executiveOutputs.fragmentationObservations,
    institutionalResilienceDirection: executiveOutputs.institutionalResilienceDirection,
    rolloutRecommendation: executiveOutputs.rolloutRecommendation,
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
      strength: 'Pilot scope supports meaningful evidence while remaining operationally manageable',
    };
  }

  if (memberCount >= 200 && memberCount < 500) {
    return {
      points: 15,
      strength: 'Pilot scope is manageable and representative for early continuity validation',
    };
  }

  if (memberCount > 5000) {
    return {
      points: 12,
      concern: 'Large membership suggests phased rollout sequencing and stronger governance checkpoints',
    };
  }

  return {
    points: 10,
    concern: 'Small membership. Consider shared learning pathways with partner institutions.',
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
      strength: 'Clear pain points motivate continuity investment and governance prioritization',
    };
  }

  if (hasCriticalPainPoints) {
    return {
      points: 20,
      strength: 'Documented challenges provide clear modernization and governance targets',
    };
  }

  if (currentSystem && !/UnionEyes|digital/i.test(currentSystem)) {
    return {
      points: 15,
      concern: 'Data migration and change management required from existing system.',
    };
  }

  return {
    points: 10,
    concern: 'Current challenges are not yet fully articulated. Discovery may be needed before pilot alignment.',
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
      strength: 'Leadership sponsorship and resources support governable deployment pacing',
    };
  }

  if (hasExecutiveSponsor || hasStaffCommitment) {
    return {
      points: 15,
      strength: 'Leadership support is present with room to strengthen cross-team governance alignment.',
    };
  }

  return {
    points: 8,
    concern: 'Leadership sponsorship appears limited. Pilot stability improves with explicit governance sponsorship.',
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
      strength: 'Technical support and data access indicate strong conditions for implementation reliability',
    };
  }

  if (hasDataAccess && staffComfort !== 'low') {
    return {
      points: 12,
      strength: 'Technical foundation is adequate for pilot with targeted onboarding support.',
    };
  }

  if (staffComfort === 'low') {
    return {
      points: 7,
      concern: 'Staff unfamiliar with digital tools. Plan intensive training and enablement.',
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
      strength: 'Focused jurisdiction and sector profile supports controlled rollout governance.',
    };
  }

  if (isModerate) {
    return {
      points: 8,
      strength: 'Moderate complexity provides meaningful governance coordination signals during pilot.',
    };
  }

  return {
    points: 5,
    concern: 'Multi-jurisdiction complexity is high. Begin with constrained deployment boundaries.',
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
        strength: 'Clear and measurable goals support pilot success interpretation.',
      };
    }

    return {
      points: 8,
      strength: 'Goals are present; refine governance and continuity success measures for stronger clarity.',
    };
  }

  if (goals.length < 3) {
    return {
      points: 5,
      concern: 'Limited goals defined. Define pilot success indicators before deployment activation.',
    };
  }

  return {
    points: 7,
    concern: 'Too many goals. Prioritize near-term outcomes to keep pilot scope governable.',
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
    recommendations.push('Readiness profile supports pilot launch with standard governance checkpoints');
    recommendations.push('Schedule institutional kickoff and continuity review within 1 week');
  } else if (score >= 65) {
    recommendations.push('Address highlighted readiness gaps before full pilot activation');
    recommendations.push('Complete continuity and governance preparation phase (2-3 weeks)');
  } else {
    recommendations.push('Run a bounded discovery phase before pilot commitment');
    recommendations.push('Build executive governance sponsorship and cross-team continuity alignment');
  }

  if (concerns.some((c) => /leadership|commitment|buy-in/i.test(c))) {
    recommendations.push('Schedule governance alignment meeting with executive sponsors');
    recommendations.push('Document deployment confidence case with continuity and oversight criteria');
  }

  if (concerns.some((c) => /technical|training|unfamiliar/i.test(c))) {
    recommendations.push('Plan phased onboarding enablement for pilot teams');
    recommendations.push('Identify internal implementation champions for continuity support');
  }

  if (application.memberCount > 3000) {
    recommendations.push('Use phased rollout by department or region with stabilization checkpoints');
  }

  if (application.jurisdictions.length > 2) {
    recommendations.push('Begin with a single jurisdiction and expand through governance-reviewed milestones');
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
