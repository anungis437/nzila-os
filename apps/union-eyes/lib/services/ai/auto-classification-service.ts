/**
 * AI Auto-Classification Service
 * 
 * Automatically classifies clauses, precedents, and determines metadata using AI.
 * Uses fine-tuned models and GPT-4 for accurate classification of labour law content.
 * 
 * Features:
 * - Clause type classification
 * - Precedent value assessment
 * - Tag generation
 * - Cross-reference detection
 */

import { getAiClient, UE_APP_KEY, UE_PROFILES } from '@/lib/ai/ai-client';
import type { ClauseType } from '@/db/schema/domains/agreements';
import type { PrecedentValueEnum, OutcomeEnum } from '@/db/schema/domains/agreements';
import { logger } from '@/lib/logger';

// Clause type definitions with descriptions for classification
const CLAUSE_TYPE_DEFINITIONS: Record<ClauseType, string> = {
  wages_compensation: 'Wage rates, salary scales, pay equity, wage increases',
  hours_scheduling: 'Regular hours, work schedules, shift patterns',
  overtime: 'Overtime rates, callout provisions, standby pay',
  vacation_leave: 'Vacation entitlement, vacation scheduling, vacation pay',
  benefits_insurance: 'Health benefits, extended health, medical, dental, vision coverage',
  pension_retirement: 'Pension plans, retirement benefits, contributions',
  working_conditions: 'Working conditions, workplace environment',
  seniority_promotion: 'Seniority definition, calculation, and application',
  grievance_arbitration: 'Grievance procedures, arbitration process',
  health_safety: 'Health and safety provisions',
  union_rights: 'Union rights and privileges',
  management_rights: 'Management rights and prerogatives',
  duration_renewal: 'Contract duration and renewal terms',
  disciplinary_procedures: 'Discipline and discharge procedures',
  training_development: 'Training and professional development',
  job_security: 'Job security and layoff provisions',
  technological_change: 'Technological change and adaptation',
  workplace_rights: 'Employee and workplace rights',
  other: 'Other miscellaneous provisions',
};

export interface ClassificationResult {
  clauseType: ClauseType;
  confidence: number;
  alternativeTypes?: Array<{ type: ClauseType; confidence: number }>;
  reasoning: string;
}

export interface TagGenerationResult {
  tags: string[];
  confidence: number;
}

export interface CrossReferenceResult {
  references: string[];
  confidence: number;
}

export interface PrecedentClassification {
  precedentValue: PrecedentValueEnum;
  outcome: OutcomeEnum;
  issueType: string;
  confidence: number;
  reasoning: string;
}

/**
 * Classify a clause into its appropriate type using AI
 */
export async function classifyClause(
  clauseContent: string,
  context?: {
    title?: string;
    clauseNumber?: string;
    jurisdiction?: string;
    sector?: string;
  }
): Promise<ClassificationResult> {
  const systemPrompt = `You are an expert Canadian labour law classifier. 
Classify the following clause into ONE of these types:

${Object.entries(CLAUSE_TYPE_DEFINITIONS)
  .map(([type, desc]) => `- ${type}: ${desc}`)
  .join('\n')}

Consider:
1. Primary subject matter
2. Legal implications
3. Common labour relations patterns
4. Context provided (if any)

Return JSON with:
- clauseType: The most appropriate type
- confidence: 0.0-1.0 confidence score
- alternativeTypes: Up to 3 alternative classifications (if applicable)
- reasoning: Brief explanation of classification`;

  try {
    const userContent = context
      ? `Title: ${context.title || 'N/A'}
Clause Number: ${context.clauseNumber || 'N/A'}
Jurisdiction: ${context.jurisdiction || 'N/A'}
Sector: ${context.sector || 'N/A'}

Clause Content:
${clauseContent}`
      : clauseContent;

    const ai = getAiClient();
    const response = await ai.extract({
      entityId: context?.jurisdiction || 'system',
      appKey: UE_APP_KEY,
      profileKey: UE_PROFILES.CLAUSE_CLASSIFICATION,
      promptKey: UE_PROFILES.CLAUSE_CLASSIFICATION,
      input: `${systemPrompt}\n\n${userContent}`,
      dataClass: 'internal',
    });

    const result = response.data as Record<string, unknown>;
    
    return {
      clauseType: (result.clauseType as ClauseType) || 'other',
      confidence: (result.confidence as number) || 0.5,
      alternativeTypes: (result.alternativeTypes as { type: ClauseType; confidence: number }[]) || [],
      reasoning: (result.reasoning as string) || 'Classification based on content analysis',
    };
  } catch (error) {
    logger.error('Error classifying clause', { error });
    return {
      clauseType: 'other',
      confidence: 0.1,
      reasoning: 'Classification failed, defaulted to "other"',
    };
  }
}

/**
 * Generate relevant tags for a clause
 */
export async function generateClauseTags(
  clauseContent: string,
  clauseType: ClauseType
): Promise<TagGenerationResult> {
  const systemPrompt = `Generate 5-10 relevant, specific tags for this collective bargaining agreement clause.

Tags should be:
- Specific and actionable
- Search-friendly (lowercase, underscore_separated)
- Cover key concepts, amounts, conditions
- Include both general and specific terms

Examples: "wage_increase", "four_percent", "annual_increment", "cost_of_living", "retroactive_pay"

Return JSON with:
- tags: Array of tag strings
- confidence: Overall confidence in tag quality (0.0-1.0)`;

  try {
    const ai = getAiClient();
    const response = await ai.extract({
      entityId: 'system',
      appKey: UE_APP_KEY,
      profileKey: UE_PROFILES.TAG_GENERATION,
      promptKey: UE_PROFILES.TAG_GENERATION,
      input: `${systemPrompt}\n\nClause Type: ${clauseType}\n\nContent: ${clauseContent}`,
      dataClass: 'internal',
    });

    const result = response.data as Record<string, unknown>;
    
    return {
      tags: (result.tags as string[]) || [],
      confidence: (result.confidence as number) || 0.5,
    };
  } catch (error) {
    logger.error('Error generating tags', { error });
    return {
      tags: [],
      confidence: 0.1,
    };
  }
}

/**
 * Detect cross-references to other clauses
 */
export async function detectCrossReferences(
  clauseContent: string
): Promise<CrossReferenceResult> {
  const systemPrompt = `Identify all cross-references to other clauses in this CBA clause.

Look for:
- Direct references: "Article 15.01", "Section 12.03", "Clause 8.02"
- Indirect references: "as defined in Article 10", "pursuant to Section 14"
- Related provisions mentioned by topic

Return JSON with:
- references: Array of clause numbers (e.g., ["15.01", "12.03"])
- confidence: Confidence in completeness (0.0-1.0)`;

  try {
    const ai = getAiClient();
    const response = await ai.extract({
      entityId: 'system',
      appKey: UE_APP_KEY,
      profileKey: UE_PROFILES.CROSS_REFERENCE,
      promptKey: UE_PROFILES.CROSS_REFERENCE,
      input: `${systemPrompt}\n\n${clauseContent}`,
      dataClass: 'internal',
    });

    const result = response.data as Record<string, unknown>;
    
    return {
      references: (result.references as string[]) || [],
      confidence: (result.confidence as number) || 0.5,
    };
  } catch (error) {
    logger.error('Error detecting cross-references', { error });
    return {
      references: [],
      confidence: 0.1,
    };
  }
}

/**
 * Classify arbitration precedent value and outcome
 */
export async function classifyPrecedent(
  caseTitle: string,
  facts: string,
  reasoning: string,
  decision: string
): Promise<PrecedentClassification> {
  const systemPrompt = `You are a labour arbitration expert. Analyze this arbitration decision and classify it.

Precedent Value Levels:
- high: Establishes important principle, frequently cited, clear reasoning
- medium: Useful guidance but limited applicability or unclear reasoning
- low: Fact-specific, limited precedential value

Outcome Options:
- union: Union won/grievance upheld
- employer: Employer won/grievance denied
- split: Split decision or partial remedy

Common Issue Types:
- wrongful_dismissal
- discipline
- seniority
- wages
- benefits
- hours_of_work
- overtime
- safety
- harassment
- human_rights
- layoff
- other

Return JSON with:
- precedentValue: high/medium/low
- outcome: union/employer/split
- issueType: Primary issue category
- confidence: Overall confidence (0.0-1.0)
- reasoning: Brief explanation`;

  try {
    const ai = getAiClient();
    const response = await ai.extract({
      entityId: 'system',
      appKey: UE_APP_KEY,
      profileKey: UE_PROFILES.PRECEDENT_CLASSIFICATION,
      promptKey: UE_PROFILES.PRECEDENT_CLASSIFICATION,
      input: `${systemPrompt}\n\nCase: ${caseTitle}\n\nFacts: ${facts}\n\nReasoning: ${reasoning}\n\nDecision: ${decision}`,
      dataClass: 'internal',
    });

    const result = response.data as Record<string, unknown>;
    
    return {
      precedentValue: (result.precedentValue as PrecedentValueEnum) || ('medium' as PrecedentValueEnum),
      outcome: (result.outcome as OutcomeEnum) || ('split' as OutcomeEnum),
      issueType: (result.issueType as string) || 'other',
      confidence: (result.confidence as number) || 0.5,
      reasoning: (result.reasoning as string) || 'Classification based on case analysis',
    };
  } catch (error) {
    logger.error('Error classifying precedent', { error });
    return {
      precedentValue: 'medium' as PrecedentValueEnum,
      outcome: 'split' as OutcomeEnum,
      issueType: 'other',
      confidence: 0.1,
      reasoning: 'Classification failed',
    };
  }
}

/**
 * Batch classify multiple clauses
 */
export async function batchClassifyClauses(
  clauses: Array<{
    id: string;
    content: string;
    title?: string;
    clauseNumber?: string;
  }>,
  options?: {
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<Map<string, ClassificationResult>> {
  const results = new Map<string, ClassificationResult>();
  const concurrency = options?.concurrency || 5;
  const total = clauses.length;
  let completed = 0;

  for (let i = 0; i < clauses.length; i += concurrency) {
    const batch = clauses.slice(i, i + concurrency);
    
    const batchPromises = batch.map(async clause => {
      const result = await classifyClause(clause.content, {
        title: clause.title,
        clauseNumber: clause.clauseNumber,
      });
      
      completed++;
      if (options?.onProgress) {
        options.onProgress(completed, total);
      }
      
      return { id: clause.id, result };
    });

    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(({ id, result }) => {
      results.set(id, result);
    });
  }

  return results;
}

/**
 * Enrich clause with all AI-generated metadata
 */
export async function enrichClauseMetadata(
  clauseContent: string,
  context?: {
    title?: string;
    clauseNumber?: string;
    jurisdiction?: string;
    sector?: string;
  }
): Promise<{
  classification: ClassificationResult;
  tags: TagGenerationResult;
  crossReferences: CrossReferenceResult;
}> {
  // Run all enrichment functions in parallel
  const [classification, _tags, crossReferences] = await Promise.all([
    classifyClause(clauseContent, context),
    generateClauseTags(clauseContent, 'other'), // Will be updated with actual type
    detectCrossReferences(clauseContent),
  ]);

  // Re-generate tags with correct clause type
  const improvedTags = await generateClauseTags(clauseContent, classification.clauseType);

  return {
    classification,
    tags: improvedTags,
    crossReferences,
  };
}

/**
 * Validate and suggest improvements for clause classification
 */
export async function validateClassification(
  clauseContent: string,
  currentType: ClauseType,
  confidence: number
): Promise<{
  isCorrect: boolean;
  suggestedType?: ClauseType;
  reasoning: string;
}> {
  if (confidence >= 0.9) {
    return {
      isCorrect: true,
      reasoning: 'High confidence classification',
    };
  }

  const reclassification = await classifyClause(clauseContent);
  
  const isCorrect = reclassification.clauseType === currentType;
  
  return {
    isCorrect,
    suggestedType: isCorrect ? undefined : reclassification.clauseType,
    reasoning: reclassification.reasoning,
  };
}

