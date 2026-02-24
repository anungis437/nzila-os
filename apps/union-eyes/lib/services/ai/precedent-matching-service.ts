/**
 * AI Precedent Matching Service
 * 
 * Matches grievances/claims to relevant arbitration precedents using hybrid AI approach:
 * - Semantic similarity (vector embeddings)
 * - Keyword matching 
 * - Metadata filtering (jurisdiction, issue type, outcome)
 * - Citation analysis
 * 
 * Features:
 * - Match claim to precedents
 * - Precedent relevance scoring
 * - Outcome prediction
 * - Legal argument generation
 */

import { getAiClient, UE_APP_KEY, UE_PROFILES } from '@/lib/ai/ai-client';
import { db } from '@/db';
import { arbitrationDecisions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { semanticPrecedentSearch } from './vector-search-service';
import type { OutcomeEnum, PrecedentValueEnum } from '@/db/schema/domains/agreements';
import { logger } from '@/lib/logger';

export interface PrecedentMatch {
  precedentId: string;
  caseTitle: string;
  caseNumber: string;
  relevanceScore: number;
  semanticSimilarity: number;
  keywordMatch: number;
  metadataMatch: number;
  outcome: OutcomeEnum;
  precedentValue: PrecedentValueEnum;
  reasoning: string;
  applicableReasons: string[];
  distinctions: string[];
  citationCount: number;
}

export interface ClaimAnalysis {
  matches: PrecedentMatch[];
  predictedOutcome: {
    outcome: OutcomeEnum;
    confidence: number;
    reasoning: string;
  };
  strengthAnalysis: {
    strengths: string[];
    weaknesses: string[];
    criticalFactors: string[];
  };
  suggestedArguments: string[];
}

export interface PrecedentMatchOptions {
  jurisdiction?: string;
  issueType?: string;
  limit?: number;
  minRelevance?: number;
  includeDistinctions?: boolean;
  weightSemanticSimilarity?: number; // 0-1
  weightKeywordMatch?: number; // 0-1
  weightMetadata?: number; // 0-1
}

/**
 * Match a claim/grievance to relevant precedents using hybrid approach
 */
export async function matchClaimToPrecedents(
  claim: {
    facts: string;
    issueType: string;
    jurisdiction?: string;
    unionArguments?: string;
    employerArguments?: string;
  },
  options: PrecedentMatchOptions = {}
): Promise<PrecedentMatch[]> {
  const {
    jurisdiction = claim.jurisdiction,
    issueType = claim.issueType,
    limit = 10,
    minRelevance = 0.6,
    includeDistinctions = true,
    weightSemanticSimilarity = 0.5,
    weightKeywordMatch = 0.3,
    weightMetadata = 0.2,
  } = options;

  // Validate weights sum to 1
  const totalWeight = weightSemanticSimilarity + weightKeywordMatch + weightMetadata;
  if (Math.abs(totalWeight - 1.0) > 0.01) {
    throw new Error('Weights must sum to 1.0');
  }

  try {
    // Step 1: Semantic search for similar cases
    const semanticResults = await semanticPrecedentSearch(claim.facts, {
      limit: limit * 2, // Get more candidates for filtering
      threshold: 0.5,
      issueType,
      jurisdiction,
    });

    // Step 2: Extract keywords from claim
    const keywords = await extractClaimKeywords(claim.facts);

    // Step 3: Score each precedent using hybrid approach
    const scoredMatches = await Promise.all(
      semanticResults.map(async result => {
        const precedent = await db.query.arbitrationDecisions.findFirst({
          where: eq(arbitrationDecisions.id, result.id),
        });

        if (!precedent) return null;

        // Calculate keyword match score
        const keywordScore = calculateKeywordMatch(
          keywords,
          precedent.keyFacts + ' ' + precedent.reasoning
        );

        // Calculate metadata match score
        const metadataScore = calculateMetadataMatch(claim, precedent);

        // Calculate composite relevance score
        const relevanceScore =
          result.similarity * weightSemanticSimilarity +
          keywordScore * weightKeywordMatch +
          metadataScore * weightMetadata;

        // Generate reasons for applicability and distinctions
        let applicableReasons: string[] = [];
        let distinctions: string[] = [];

        if (includeDistinctions) {
          const analysis = await analyzePrecedentApplicability(claim, precedent);
          applicableReasons = analysis.applicableReasons;
          distinctions = analysis.distinctions;
        }

        return {
          precedentId: precedent.id,
          caseTitle: precedent.caseTitle,
          caseNumber: precedent.caseNumber,
          relevanceScore,
          semanticSimilarity: result.similarity,
          keywordMatch: keywordScore,
          metadataMatch: metadataScore,
          outcome: precedent.outcome,
          precedentValue: precedent.precedentValue,
          reasoning: precedent.reasoning || '',
          applicableReasons,
          distinctions,
          citationCount: precedent.citationCount || 0,
        };
      })
    );

    // Filter out nulls and low relevance matches
    return scoredMatches
      .filter((match): match is PrecedentMatch => match !== null && match.relevanceScore >= minRelevance)
      .sort((a, b) => {
        // Primary sort: relevance score
        if (Math.abs(a.relevanceScore - b.relevanceScore) > 0.05) {
          return b.relevanceScore - a.relevanceScore;
        }
        // Secondary sort: precedent value
        const valueOrder: Record<PrecedentValueEnum, number> = {
          high: 3,
          medium: 2,
          low: 1,
        };
        if (valueOrder[b.precedentValue] !== valueOrder[a.precedentValue]) {
          return valueOrder[b.precedentValue] - valueOrder[a.precedentValue];
        }
        // Tertiary sort: citation count
        return b.citationCount - a.citationCount;
      })
      .slice(0, limit);
  } catch (error) {
    logger.error('Error matching claim to precedents', { error, issueType });
    return [];
  }
}

/**
 * Extract key terms from claim using AI
 */
async function extractClaimKeywords(claimText: string): Promise<string[]> {
  try {
    const ai = getAiClient();
    const response = await ai.extract({
      entityId: 'system',
      appKey: UE_APP_KEY,
      profileKey: UE_PROFILES.PRECEDENT_KEYWORDS,
      promptKey: UE_PROFILES.PRECEDENT_KEYWORDS,
      input: `Extract 10-15 key legal terms and concepts from this grievance/claim:\n\n${claimText}`,
      dataClass: 'internal',
    });

    const result = response.data as Record<string, unknown>;
    return (result.keywords as string[]) || [];
  } catch (error) {
    logger.error('Error extracting keywords', { error });
    return [];
  }
}

/**
 * Calculate keyword match score between claim and precedent
 */
function calculateKeywordMatch(keywords: string[], precedentText: string): number {
  if (keywords.length === 0) return 0;

  const lowerText = precedentText.toLowerCase();
  const matches = keywords.filter(keyword =>
    lowerText.includes(keyword.toLowerCase())
  );

  return matches.length / keywords.length;
}

/**
 * Calculate metadata match score
 */
function calculateMetadataMatch(
  claim: { issueType: string; jurisdiction?: string },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  precedent: any
): number {
  let score = 0;
  let factors = 0;

  // Issue type match (most important)
  factors++;
  if (claim.issueType === precedent.issueType) {
    score += 1.0;
  } else if (areRelatedIssues(claim.issueType, precedent.issueType)) {
    score += 0.5;
  }

  // Jurisdiction match (if provided)
  if (claim.jurisdiction) {
    factors++;
    if (claim.jurisdiction === precedent.jurisdictionType) {
      score += 0.8;
    }
  }

  return factors > 0 ? score / factors : 0;
}

/**
 * Determine if two issue types are related
 */
function areRelatedIssues(type1: string, type2: string): boolean {
  const relatedGroups = [
    ['wrongful_dismissal', 'discipline', 'just_cause'],
    ['wages', 'benefits', 'overtime'],
    ['harassment', 'human_rights', 'safety'],
    ['layoff', 'seniority', 'bumping'],
  ];

  return relatedGroups.some(
    group => group.includes(type1) && group.includes(type2)
  );
}

/**
 * Analyze why precedent is applicable and how it differs
 */
async function analyzePrecedentApplicability(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  claim: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  precedent: any
): Promise<{
  applicableReasons: string[];
  distinctions: string[];
}> {
  try {
    const ai = getAiClient();
    const response = await ai.extract({
      entityId: 'system',
      appKey: UE_APP_KEY,
      profileKey: UE_PROFILES.PRECEDENT_APPLICABILITY,
      promptKey: UE_PROFILES.PRECEDENT_APPLICABILITY,
      input: `Compare a grievance claim to an arbitration precedent. Identify:
1. Why the precedent is applicable (similar facts, legal principles)
2. How the cases differ (distinguishing features)

CLAIM FACTS: ${claim.facts}

PRECEDENT: ${precedent.caseTitle}
Facts: ${precedent.keyFacts}
Reasoning: ${precedent.reasoning}
Outcome: ${precedent.outcome}`,
      dataClass: 'internal',
    });

    const result = response.data as Record<string, unknown>;
    
    return {
      applicableReasons: (result.applicableReasons as string[]) || [],
      distinctions: (result.distinctions as string[]) || [],
    };
  } catch (error) {
    logger.error('Error analyzing applicability', { error });
    return {
      applicableReasons: ['Analysis unavailable'],
      distinctions: [],
    };
  }
}

/**
 * Analyze claim and predict outcome based on precedents
 */
export async function analyzeClaimWithPrecedents(
  claim: {
    facts: string;
    issueType: string;
    jurisdiction?: string;
    unionArguments?: string;
    employerArguments?: string;
  },
  options?: PrecedentMatchOptions
): Promise<ClaimAnalysis> {
  // Get matching precedents
  const matches = await matchClaimToPrecedents(claim, options);

  // Analyze outcome patterns - map outcomes to win categories
  const outcomes = matches.map(m => m.outcome);
  const unionWins = outcomes.filter(o => o === 'grievance_upheld').length;
  const employerWins = outcomes.filter(o => o === 'grievance_denied' || o === 'dismissed').length;
  const splits = outcomes.filter(o => o === 'partial_success' || o === 'settled').length;

  const total = matches.length;
  const predictedOutcome: OutcomeEnum =
    unionWins > employerWins && unionWins > splits
      ? 'grievance_upheld'
      : employerWins > unionWins && employerWins > splits
      ? 'grievance_denied'
      : 'partial_success';

  const confidence =
    total > 0
      ? Math.max(unionWins, employerWins, splits) / total
      : 0.5;

  // Generate comprehensive analysis
  const analysis = await generateClaimAnalysis(claim, matches);

  return {
    matches,
    predictedOutcome: {
      outcome: predictedOutcome,
      confidence,
      reasoning: `Based on ${total} similar precedents: ${unionWins} union wins, ${employerWins} employer wins, ${splits} split decisions. ${analysis.outcomeReasoning}`,
    },
    strengthAnalysis: {
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      criticalFactors: analysis.criticalFactors,
    },
    suggestedArguments: analysis.suggestedArguments,
  };
}

/**
 * Generate comprehensive claim analysis using AI
 */
async function generateClaimAnalysis(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  claim: any,
  precedents: PrecedentMatch[]
): Promise<{
  outcomeReasoning: string;
  strengths: string[];
  weaknesses: string[];
  criticalFactors: string[];
  suggestedArguments: string[];
}> {
  const precedentSummaries = precedents
    .slice(0, 5) // Top 5 most relevant
    .map(
      p =>
        `${p.caseTitle}: ${p.outcome} - ${p.applicableReasons.join('; ')}`
    )
    .join('\n');

  try {
    const ai = getAiClient();
    const response = await ai.extract({
      entityId: 'system',
      appKey: UE_APP_KEY,
      profileKey: UE_PROFILES.CLAIM_ANALYSIS,
      promptKey: UE_PROFILES.CLAIM_ANALYSIS,
      input: `You are a labour arbitration expert. Analyze the claim and precedents to provide:
1. Detailed reasoning for predicted outcome
2. Strengths in the union's case
3. Weaknesses/vulnerabilities
4. Critical factors that will determine outcome
5. Suggested arguments based on precedent

CLAIM:
Facts: ${claim.facts}
Issue: ${claim.issueType}

RELEVANT PRECEDENTS:
${precedentSummaries}

Provide analysis.`,
      dataClass: 'internal',
    });

    const result = response.data as Record<string, unknown>;

    return {
      outcomeReasoning: (result.outcomeReasoning as string) || 'Analysis unavailable',
      strengths: (result.strengths as string[]) || [],
      weaknesses: (result.weaknesses as string[]) || [],
      criticalFactors: (result.criticalFactors as string[]) || [],
      suggestedArguments: (result.suggestedArguments as string[]) || [],
    };
  } catch (error) {
    logger.error('Error generating analysis', { error });
    return {
      outcomeReasoning: 'Analysis generation failed',
      strengths: [],
      weaknesses: [],
      criticalFactors: [],
      suggestedArguments: [],
    };
  }
}

/**
 * Generate legal memorandum based on claim and precedents
 */
export async function generateLegalMemorandum(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  claim: any,
  analysis: ClaimAnalysis
): Promise<string> {
  try {
    const ai = getAiClient();
    const response = await ai.generate({
      entityId: 'system',
      appKey: UE_APP_KEY,
      profileKey: UE_PROFILES.LEGAL_MEMORANDUM,
      input: `Generate a professional legal memorandum for a labour arbitration case.

Structure:
1. SUMMARY OF ISSUE
2. RELEVANT FACTS
3. APPLICABLE PRECEDENTS (cite cases)
4. LEGAL ANALYSIS
   - Strengths of Union Position
   - Potential Weaknesses
   - Critical Factors
5. PREDICTED OUTCOME
6. RECOMMENDED ARGUMENTS

Use formal legal writing style suitable for union representatives and legal counsel.

Claim Facts: ${claim.facts}
Issue Type: ${claim.issueType}

Top Precedents:
${analysis.matches
  .slice(0, 3)
  .map(m => `- ${m.caseTitle} (${m.caseNumber}): ${m.outcome}`)
  .join('\n')}

Predicted Outcome: ${analysis.predictedOutcome.outcome} (${(
            analysis.predictedOutcome.confidence * 100
          ).toFixed(0)}% confidence)

Strengths: ${analysis.strengthAnalysis.strengths.join('; ')}
Weaknesses: ${analysis.strengthAnalysis.weaknesses.join('; ')}

Generate memorandum.`,
      dataClass: 'regulated',
    });

    return response.content || 'Memorandum generation failed';
  } catch (error) {
    logger.error('Error generating memorandum', { error });
    return 'Failed to generate legal memorandum';
  }
}

