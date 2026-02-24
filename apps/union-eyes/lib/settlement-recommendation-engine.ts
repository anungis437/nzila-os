// ============================================================================
// SETTLEMENT RECOMMENDATION ENGINE
// ============================================================================
// Description: ML-powered settlement prediction, precedent matching, clause
//              references, risk assessment, and confidence scoring
// Created: 2025-12-06
// ============================================================================

import { db } from "@/db/db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { claims, sharedClauseLibrary, type _Claim } from "@/db/schema";

// ============================================================================
// TYPES
// ============================================================================

export type SettlementRecommendation = {
  claimId: string;
  recommendedOutcome: "favorable" | "partially_favorable" | "unfavorable";
  settlementType: "full_remedy" | "partial_remedy" | "mediation" | "withdraw" | "arbitration";
  confidence: number; // 0-100
  estimatedSuccessRate: number; // 0-100
  riskLevel: "low" | "medium" | "high" | "critical";
  reasoningFactors: ReasoningFactor[];
  similarPrecedents: PrecedentCase[];
  relevantClauses: ClauseReference[];
  suggestedActions: string[];
  estimatedResolutionDays?: number;
  potentialSettlementValue?: number;
};

export type ReasoningFactor = {
  factor: string;
  weight: number; // 0-1
  impact: "positive" | "negative" | "neutral";
  description: string;
  confidence: number;
};

export type PrecedentCase = {
  claimId: string;
  claimType: string;
  outcome: string;
  resolutionDays: number;
  similarityScore: number; // 0-100
  keyFactors: string[];
  settledAmount?: number;
  arbitrationDecision?: string;
};

export type ClauseReference = {
  clauseId: string;
  articleNumber: string;
  sectionNumber?: string;
  title: string;
  content: string;
  relevanceScore: number; // 0-100
  applicationContext: string;
};

export type RiskAssessment = {
  overallRisk: "low" | "medium" | "high" | "critical";
  riskScore: number; // 0-100
  riskFactors: Array<{
    category: string;
    severity: string;
    description: string;
    mitigation?: string;
  }>;
  arbitrationLikelihood: number; // 0-100
  estimatedCost: number;
  estimatedDuration: number;
};

export type PredictionFeatures = {
  claimType: string;
  priority: string;
  department?: string;
  pastBehavior?: string; // Repeat grievant/issue
  complexity?: number;
  evidenceStrength?: number;
  timeToFile?: number; // Days between incident and filing
  violatedClauses?: string[];
  hasWitnesses?: boolean;
  hasPastGrievances?: boolean;
  managementPosition?: string;
};

// ============================================================================
// SETTLEMENT PREDICTION
// ============================================================================

/**
 * Generate comprehensive settlement recommendation for a grievance
 */
export async function generateSettlementRecommendation(
  claimId: string,
  organizationId: string
): Promise<SettlementRecommendation | null> {
  try {
    // Get claim details
    const claim = await db.query.claims.findFirst({
      where: and(eq(claims.claimId, claimId), eq(claims.organizationId, organizationId)),
    });

    if (!claim) return null;

    // Extract features for prediction
    const _features = extractPredictionFeatures(claim);

    // Find similar precedent cases
    const precedents = await findSimilarPrecedents(claim, organizationId);

    // Get relevant contract clauses
    const relevantClauses = await findRelevantClauses(claim, organizationId);

    // Calculate reasoning factors
    const reasoningFactors = calculateReasoningFactors(claim, precedents, relevantClauses);

    // Perform risk assessment
    const riskAssessment = assessRisk(claim, precedents, reasoningFactors);

    // Predict outcome using weighted scoring
    const prediction = predictOutcome(claim, precedents, reasoningFactors);

    // Generate recommended actions
    const suggestedActions = generateSuggestedActions(
      claim,
      prediction,
      riskAssessment,
      relevantClauses
    );

    return {
      claimId,
      recommendedOutcome: prediction.outcome,
      settlementType: prediction.settlementType,
      confidence: prediction.confidence,
      estimatedSuccessRate: prediction.successRate,
      riskLevel: riskAssessment.overallRisk,
      reasoningFactors,
      similarPrecedents: precedents.slice(0, 5), // Top 5 most similar
      relevantClauses: relevantClauses.slice(0, 10), // Top 10 relevant clauses
      suggestedActions,
      estimatedResolutionDays: calculateEstimatedResolutionDays(precedents),
      potentialSettlementValue: calculatePotentialSettlement(claim, precedents),
    };
  } catch (_error) {
return null;
  }
}

/**
 * Extract features from claim for prediction model
 */
function extractPredictionFeatures(claim: unknown): PredictionFeatures {
  const metadata = claim.metadata || {};
  
  return {
    claimType: claim.claimType,
    priority: claim.priority,
    department: claim.department,
    complexity: metadata.complexity || 5,
    evidenceStrength: metadata.evidenceStrength || 5,
    timeToFile: claim.filedAt && claim.incidentDate
      ? Math.floor(
          (new Date(claim.filedAt).getTime() - new Date(claim.incidentDate).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0,
    violatedClauses: metadata.violatedClauses || [],
    hasWitnesses: metadata.witnesses?.length > 0 || false,
    hasPastGrievances: false, // Would query database for this
    managementPosition: metadata.managementPosition,
  };
}

/**
 * Find precedent cases similar to current claim
 */
async function findSimilarPrecedents(
  claim: unknown,
  organizationId: string
): Promise<PrecedentCase[]> {
  try {
    // Find resolved/closed claims of same type
    const pastClaims = await db.query.claims.findMany({
      where: and(
        eq(claims.organizationId, organizationId),
        eq(claims.claimType, claim.claimType),
        inArray(claims.status, ["resolved", "closed"]),
        sql`${claims.claimId} != ${claim.claimId}` // Exclude current claim
      ),
      orderBy: [desc(claims.resolvedAt)],
      limit: 50, // Get recent cases for analysis
    });

    const precedents: PrecedentCase[] = [];

    for (const pastClaim of pastClaims) {
      // Calculate similarity score based on multiple factors
      const similarityScore = calculateSimilarityScore(claim, pastClaim);

      if (similarityScore > 30) {
        // Only include reasonably similar cases
        const resolutionDays = pastClaim.resolvedAt && pastClaim.filedDate
          ? Math.floor(
              (new Date(pastClaim.resolvedAt).getTime() -
                new Date(pastClaim.filedDate).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 0;

        const metadata = (pastClaim.metadata || {}) as Record<string, unknown>;
        precedents.push({
          claimId: pastClaim.claimId,
          claimType: pastClaim.claimType,
          outcome: pastClaim.resolutionOutcome || "unknown",
          resolutionDays,
          similarityScore,
          keyFactors: extractKeyFactors(pastClaim),
          settledAmount: metadata.settledAmount,
          arbitrationDecision: metadata.arbitrationDecision,
        });
      }
    }

    // Sort by similarity (descending)
    return precedents.sort((a, b) => b.similarityScore - a.similarityScore);
  } catch (_error) {
return [];
  }
}

/**
 * Calculate similarity score between two claims (0-100)
 */
function calculateSimilarityScore(claim1: unknown, claim2: unknown): number {
  let score = 0;

  // Claim type match (30 points)
  if (claim1.claimType === claim2.claimType) {
    score += 30;
  }

  // Priority match (10 points)
  if (claim1.priority === claim2.priority) {
    score += 10;
  }

  // Department match (15 points)
  if (claim1.department && claim2.department && claim1.department === claim2.department) {
    score += 15;
  }

  // Description similarity (simple keyword matching - 25 points)
  const desc1Words = new Set(
    (claim1.description || "").toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
  );
  const desc2Words = (claim2.description || "").toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
  
  let matchingWords = 0;
  desc2Words.forEach((word: string) => {
    if (desc1Words.has(word)) matchingWords++;
  });
  
  if (desc2Words.length > 0) {
    score += Math.min(25, (matchingWords / desc2Words.length) * 25);
  }

  // Violated clauses overlap (20 points)
  const clauses1 = claim1.metadata?.violatedClauses || [];
  const clauses2 = claim2.metadata?.violatedClauses || [];
  
  if (clauses1.length > 0 && clauses2.length > 0) {
    const overlap = clauses1.filter((c: string) => clauses2.includes(c)).length;
    score += Math.min(20, (overlap / Math.max(clauses1.length, clauses2.length)) * 20);
  }

  return Math.round(Math.min(100, score));
}

/**
 * Extract key factors that influenced case outcome
 */
function extractKeyFactors(claim: unknown): string[] {
  const factors: string[] = [];
  
  factors.push(`${claim.claimType} grievance`);
  
  if (claim.priority === "urgent") {
    factors.push("High priority issue");
  }
  
  if (claim.metadata?.evidenceStrength > 7) {
    factors.push("Strong evidence");
  }
  
  if (claim.metadata?.witnesses?.length > 2) {
    factors.push("Multiple witnesses");
  }
  
  if (claim.resolutionOutcome === "favorable") {
    factors.push("Management accepted grievance");
  }
  
  return factors;
}

/**
 * Find relevant contract clauses for claim
 */
async function findRelevantClauses(
  claim: unknown,
  organizationId: string
): Promise<ClauseReference[]> {
  try {
    // Search clause library for relevant clauses
    const allClauses = await db.query.sharedClauseLibrary.findMany({
      where: eq(sharedClauseLibrary.sourceOrganizationId, organizationId),
    });

    const clauseReferences: ClauseReference[] = [];

    // Keywords from claim description and type
    const searchTerms = [
      ...claim.claimType.toLowerCase().split("_"),
      ...(claim.description || "").toLowerCase().split(/\s+/).filter((w: string) => w.length > 4),
    ];

    for (const clause of allClauses) {
      const relevanceScore = calculateClauseRelevance(clause, searchTerms);
      
      if (relevanceScore > 20) {
        clauseReferences.push({
          clauseId: clause.id,
          articleNumber: clause.clauseNumber || '',
          sectionNumber: undefined,
          title: clause.clauseTitle,
          content: clause.clauseText,
          relevanceScore,
          applicationContext: generateApplicationContext(claim, clause),
        });
      }
    }

    // Sort by relevance
    return clauseReferences.sort((a, b) => b.relevanceScore - a.relevanceScore);
  } catch (_error) {
return [];
  }
}

/**
 * Calculate clause relevance to claim (0-100)
 */
function calculateClauseRelevance(clause: unknown, searchTerms: string[]): number {
  let score = 0;
  
  const clauseText = `${clause.clauseTitle} ${clause.clauseText} ${clause.clauseType || ""}`.toLowerCase();

  // Count matching terms
  let matches = 0;
  searchTerms.forEach((term) => {
    if (clauseText.includes(term)) {
      matches++;
    }
  });

  if (searchTerms.length > 0) {
    score = (matches / searchTerms.length) * 100;
  }

  // Boost score for exact clause type matches
  if (clause.clauseType) {
    searchTerms.forEach((term) => {
      if (clause.clauseType.toLowerCase().includes(term)) {
        score += 20;
      }
    });
  }

  return Math.min(100, Math.round(score));
}

/**
 * Generate application context for clause
 */
function generateApplicationContext(claim: unknown, clause: unknown): string {
  return `${clause.clauseNumber || 'Clause'} applies to ${claim.claimType} issues. ${clause.clauseTitle} is relevant to this grievance.`;
}

/**
 * Calculate reasoning factors that influence prediction
 */
function calculateReasoningFactors(
  claim: unknown,
  precedents: PrecedentCase[],
  clauses: ClauseReference[]
): ReasoningFactor[] {
  const factors: ReasoningFactor[] = [];

  // Factor 1: Historical precedent
  const favorableCount = precedents.filter((p) => p.outcome === "favorable").length;
  const precedentRate = precedents.length > 0 ? favorableCount / precedents.length : 0.5;
  
  factors.push({
    factor: "Historical Precedent",
    weight: 0.3,
    impact: precedentRate > 0.6 ? "positive" : precedentRate < 0.4 ? "negative" : "neutral",
    description: `${precedents.length} similar cases found with ${Math.round(precedentRate * 100)}% favorable outcome rate`,
    confidence: Math.min(95, precedents.length * 10), // More cases = higher confidence
  });

  // Factor 2: Contract clause support
  const strongClauseSupport = clauses.filter((c) => c.relevanceScore > 70).length;
  
  factors.push({
    factor: "Contract Support",
    weight: 0.25,
    impact: strongClauseSupport >= 2 ? "positive" : strongClauseSupport === 1 ? "neutral" : "negative",
    description: `${strongClauseSupport} strongly relevant contract clauses identified`,
    confidence: clauses.length > 0 ? 85 : 50,
  });

  // Factor 3: Evidence quality
  const evidenceStrength = claim.metadata?.evidenceStrength || 5;
  
  factors.push({
    factor: "Evidence Quality",
    weight: 0.2,
    impact: evidenceStrength >= 7 ? "positive" : evidenceStrength <= 3 ? "negative" : "neutral",
    description: `Evidence strength rated ${evidenceStrength}/10`,
    confidence: 75,
  });

  // Factor 4: Timeliness of filing
  const features = extractPredictionFeatures(claim);
  const timeToFile = features.timeToFile || 0;
  
  factors.push({
    factor: "Filing Timeliness",
    weight: 0.15,
    impact: timeToFile <= 10 ? "positive" : timeToFile > 25 ? "negative" : "neutral",
    description: `Filed ${timeToFile} days after incident`,
    confidence: 90,
  });

  // Factor 5: Witness support
  const hasWitnesses = claim.metadata?.witnesses?.length > 0;
  
  factors.push({
    factor: "Witness Support",
    weight: 0.1,
    impact: hasWitnesses ? "positive" : "negative",
    description: hasWitnesses
      ? `${claim.metadata.witnesses.length} witnesses identified`
      : "No witnesses identified",
    confidence: 70,
  });

  return factors;
}

/**
 * Assess risk factors for the grievance
 */
function assessRisk(
  claim: unknown,
  precedents: PrecedentCase[],
  factors: ReasoningFactor[]
): RiskAssessment {
  let riskScore = 50; // Start neutral
  const riskFactors: Array<{
    category: string;
    severity: string;
    description: string;
    mitigation?: string;
  }> = [];

  // Analyze negative factors
  const negativeFactors = factors.filter((f) => f.impact === "negative");
  riskScore += negativeFactors.length * 15;

  negativeFactors.forEach((f) => {
    riskFactors.push({
      category: f.factor,
      severity: "medium",
      description: f.description,
      mitigation: `Address ${f.factor.toLowerCase()} concerns before proceeding`,
    });
  });

  // Arbitration likelihood based on precedents
  const arbitrationCases = precedents.filter(
    (p) => p.arbitrationDecision !== undefined
  ).length;
  const arbitrationLikelihood = precedents.length > 0
    ? (arbitrationCases / precedents.length) * 100
    : 30;

  if (arbitrationLikelihood > 50) {
    riskScore += 10;
    riskFactors.push({
      category: "Arbitration Risk",
      severity: "high",
      description: `${Math.round(arbitrationLikelihood)}% of similar cases went to arbitration`,
      mitigation: "Consider settlement negotiations before arbitration",
    });
  }

  // Determine overall risk level
  let overallRisk: "low" | "medium" | "high" | "critical";
  if (riskScore < 30) overallRisk = "low";
  else if (riskScore < 50) overallRisk = "medium";
  else if (riskScore < 70) overallRisk = "high";
  else overallRisk = "critical";

  // Estimate costs and duration
  const avgResolutionDays = precedents.length > 0
    ? precedents.reduce((sum, p) => sum + p.resolutionDays, 0) / precedents.length
    : 45;

  return {
    overallRisk,
    riskScore: Math.min(100, riskScore),
    riskFactors,
    arbitrationLikelihood: Math.round(arbitrationLikelihood),
    estimatedCost: arbitrationLikelihood > 50 ? 15000 : 5000, // Rough estimates
    estimatedDuration: Math.round(avgResolutionDays),
  };
}

/**
 * Predict outcome based on all factors
 */
function predictOutcome(
  claim: unknown,
  precedents: PrecedentCase[],
  factors: ReasoningFactor[]
): {
  outcome: "favorable" | "partially_favorable" | "unfavorable";
  settlementType: "full_remedy" | "partial_remedy" | "mediation" | "withdraw" | "arbitration";
  confidence: number;
  successRate: number;
} {
  // Calculate weighted score
  let weightedScore = 0;
  let totalWeight = 0;

  factors.forEach((factor) => {
    const impactValue = factor.impact === "positive" ? 1 : factor.impact === "negative" ? -1 : 0;
    weightedScore += impactValue * factor.weight * (factor.confidence / 100);
    totalWeight += factor.weight;
  });

  const normalizedScore = (weightedScore / totalWeight + 1) / 2; // Normalize to 0-1

  // Calculate success rate from precedents
  const favorableCount = precedents.filter((p) => p.outcome === "favorable").length;
  const successRate = precedents.length > 0 ? (favorableCount / precedents.length) * 100 : 50;

  // Combine for final prediction
  const finalScore = (normalizedScore * 0.6 + successRate / 100 * 0.4) * 100;

  // Determine outcome
  let outcome: "favorable" | "partially_favorable" | "unfavorable";
  let settlementType: "full_remedy" | "partial_remedy" | "mediation" | "withdraw" | "arbitration";
  
  if (finalScore >= 70) {
    outcome = "favorable";
    settlementType = "full_remedy";
  } else if (finalScore >= 50) {
    outcome = "partially_favorable";
    settlementType = finalScore >= 60 ? "partial_remedy" : "mediation";
  } else {
    outcome = "unfavorable";
    settlementType = finalScore >= 30 ? "arbitration" : "withdraw";
  }

  // Calculate confidence (higher when factors align)
  const positiveCount = factors.filter((f) => f.impact === "positive").length;
  const negativeCount = factors.filter((f) => f.impact === "negative").length;
  const factorAlignment = Math.abs(positiveCount - negativeCount) / factors.length;
  const confidence = Math.round(
    (factorAlignment * 0.5 + (precedents.length / 50) * 0.3 + normalizedScore * 0.2) * 100
  );

  return {
    outcome,
    settlementType,
    confidence: Math.min(95, confidence),
    successRate: Math.round(successRate),
  };
}

/**
 * Generate suggested actions based on prediction
 */
function generateSuggestedActions(
  claim: unknown,
  prediction: unknown,
  risk: RiskAssessment,
  clauses: ClauseReference[]
): string[] {
  const actions: string[] = [];

  if (prediction.outcome === "favorable") {
    actions.push("Proceed with confidence - strong case for favorable outcome");
    actions.push("Prepare comprehensive documentation of all evidence");
    
    if (clauses.length > 0) {
      actions.push(`Reference Articles ${clauses.slice(0, 3).map((c) => c.articleNumber).join(", ")} in grievance`);
    }
  } else if (prediction.outcome === "partially_favorable") {
    actions.push("Consider settlement negotiations to maximize outcome");
    actions.push("Strengthen weak points before proceeding to next step");
    actions.push("Document all evidence thoroughly");
  } else {
    actions.push("Review case carefully - consider alternative approaches");
    actions.push("Consult with union leadership before proceeding");
    
    if (risk.overallRisk === "high" || risk.overallRisk === "critical") {
      actions.push("Evaluate cost-benefit of continuing vs. withdrawing");
    }
  }

  // Add risk-specific actions
  if (risk.arbitrationLikelihood > 50) {
    actions.push("Prepare for potential arbitration - build strongest case possible");
  }

  // Add clause-specific actions
  if (clauses.length === 0) {
    actions.push("Identify relevant contract clauses to strengthen case");
  }

  return actions;
}

/**
 * Calculate estimated resolution days from precedents
 */
function calculateEstimatedResolutionDays(precedents: PrecedentCase[]): number {
  if (precedents.length === 0) return 45; // Default estimate
  
  const avg = precedents.reduce((sum, p) => sum + p.resolutionDays, 0) / precedents.length;
  return Math.round(avg);
}

/**
 * Calculate potential settlement value from precedents
 */
function calculatePotentialSettlement(claim: unknown, precedents: PrecedentCase[]): number | undefined {
  const settledCases = precedents.filter((p) => p.settledAmount !== undefined);
  
  if (settledCases.length === 0) return undefined;
  
  const avg = settledCases.reduce((sum, p) => sum + (p.settledAmount || 0), 0) / settledCases.length;
  return Math.round(avg);
}

