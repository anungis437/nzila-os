/**
 * AI Clause Extraction Service
 * 
 * Uses OpenAI GPT-4 with Vision to extract structured clause information from CBA PDFs.
 * Supports both document upload and URL-based processing.
 */

import { getAiClient, UE_APP_KEY, UE_PROFILES } from '@/lib/ai/ai-client';
import { db } from '@/db';
import { cbaClause, collectiveAgreements } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { ClauseType } from '@/db/schema/domains/agreements';
import { logger } from '@/lib/logger';

export interface ExtractedClause {
  clauseType: ClauseType;
  clauseNumber: string;
  title: string;
  content: string;
  articleNumber?: string;
  sectionNumber?: string;
  tags: string[];
  crossReferences: string[];
  confidence: number;
}

export interface ExtractionResult {
  success: boolean;
  clauses: ExtractedClause[];
  totalClauses: number;
  processingTime: number;
  errors?: string[];
}

/**
 * Extract clauses from a PDF document using GPT-4 Vision
 */
export async function extractClausesFromPDF(
  pdfUrl: string,
  cbaId: string,
  options: {
    organizationId: string;
    autoSave?: boolean;
    batchSize?: number;
  }
): Promise<ExtractionResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    // Verify CBA exists
    const cba = await db.query.collectiveAgreements.findFirst({
      where: eq(collectiveAgreements.id, cbaId),
    });

    if (!cba) {
      throw new Error(`CBA with ID ${cbaId} not found`);
    }

    // Extract text content using GPT-4 Vision
    const extractedText = await extractTextFromPDF(pdfUrl);

    // Process text in chunks to identify clauses
    const clauses = await identifyClausesInText(extractedText, {
      jurisdiction: cba.jurisdiction,
      sector: cba.sector || 'Unknown',
    });

    // Save clauses if auto-save is enabled
    if (options.autoSave && clauses.length > 0) {
      await saveExtractedClauses(clauses, cbaId, options.organizationId);
    }

    // Update CBA with processing metadata
    await db.update(collectiveAgreements)
      .set({
        aiProcessed: true,
        rawText: extractedText,
      })
      .where(eq(collectiveAgreements.id, cbaId));

    return {
      success: true,
      clauses,
      totalClauses: clauses.length,
      processingTime: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    logger.error('Error extracting clauses', { error, cbaId });
    return {
      success: false,
      clauses: [],
      totalClauses: 0,
      processingTime: Date.now() - startTime,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Extract text content from PDF using GPT-4 Vision
 */
async function extractTextFromPDF(pdfUrl: string): Promise<string> {
  try {
    const ai = getAiClient();
    const response = await ai.generate({
      entityId: 'system',
      appKey: UE_APP_KEY,
      profileKey: UE_PROFILES.CLAUSE_EXTRACTION,
      input: `Extract all text from this collective bargaining agreement document at URL: ${pdfUrl}. Maintain the structure including article numbers, section numbers, and clause text. Format as plain text with clear section breaks.`,
      dataClass: 'internal',
    });

    return response.content || '';
  } catch (error) {
    logger.error('Error extracting text from PDF', { error, pdfUrl });
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Identify and structure clauses from extracted text
 */
async function identifyClausesInText(
  text: string,
  context: {
    jurisdiction: string;
    sector: string;
  }
): Promise<ExtractedClause[]> {
  const systemPrompt = `You are an expert labour law analyst specializing in Canadian collective bargaining agreements.
Your task is to identify and extract individual clauses from CBA text, classifying them by type and extracting relevant metadata.

CLAUSE TYPES (use these exact values):
- wages: Wage rates, salary scales, pay equity
- hours_of_work: Regular hours, schedules, shifts
- overtime: Overtime rates, callout, standby
- vacation: Vacation entitlement, scheduling
- benefits_health: Health benefits, medical coverage
- benefits_dental: Dental coverage
- benefits_vision: Vision care benefits
- benefits_life: Life insurance, AD&D
- benefits_disability: Short/long-term disability
- benefits_pension: Pension plans, contributions
- leaves_sick: Sick leave provisions
- leaves_personal: Personal leave days
- leaves_parental: Maternity, paternity, adoption
- leaves_bereavement: Bereavement leave
- leaves_other: Other leaves (jury duty, etc.)
- seniority: Seniority definition, calculation
- layoff_recall: Layoff procedures, recall rights
- job_posting: Job competitions, promotions
- grievance_procedure: Grievance steps, timelines
- arbitration: Arbitration procedures, selection
- discipline: Discipline procedures, just cause
- harassment: Harassment policies, investigations
- safety: Occupational health & safety
- union_business: Union leave, stewards
- management_rights: Management rights clause
- other: Any other provisions

Extract each clause with:
1. clauseType: One of the types listed above
2. clauseNumber: Full clause number (e.g., "15.01")
3. title: Descriptive title of the clause
4. content: Full clause text
5. articleNumber: Article number (e.g., "15")
6. sectionNumber: Section number (e.g., "01")
7. tags: Array of relevant keywords for search
8. crossReferences: Array of related clause numbers mentioned
9. confidence: Your confidence score (0.0-1.0) in the classification

Return a JSON array of extracted clauses.`;

  try {
    const ai = getAiClient();
    const response = await ai.extract({
      entityId: 'system',
      appKey: UE_APP_KEY,
      profileKey: UE_PROFILES.CLAUSE_EXTRACTION,
      input: `${systemPrompt}\n\nExtract and classify all clauses from this ${context.jurisdiction} ${context.sector} collective bargaining agreement:\n\n${text}`,
      dataClass: 'internal',
    });

    const result = response.data as Record<string, unknown>;
    return (result.clauses as ExtractedClause[]) || [];
  } catch (error) {
    logger.error('Error identifying clauses', { error });
    throw new Error('Failed to identify clauses in text');
  }
}

/**
 * Save extracted clauses to database
 */
async function saveExtractedClauses(
  clauses: ExtractedClause[],
  cbaId: string,
  organizationId: string
): Promise<void> {
  const clausesToInsert = clauses.map(clause => ({
    organizationId,
    cbaId,
    clauseType: clause.clauseType,
    clauseNumber: clause.clauseNumber,
    title: clause.title,
    content: clause.content,
    articleNumber: clause.articleNumber || null,
    sectionNumber: clause.sectionNumber || null,
    effectiveDate: new Date(),
    tags: clause.tags,
    crossReferences: clause.crossReferences,
    aiExtracted: true,
    confidence: clause.confidence,
  }));

  // Insert in batches to avoid overwhelming the database
  const batchSize = 50;
  for (let i = 0; i < clausesToInsert.length; i += batchSize) {
    const batch = clausesToInsert.slice(i, i + batchSize);
    await db.insert(cbaClause).values(batch);
  }
}

/**
 * Extract clauses from multiple CBAs in batch
 */
export async function batchExtractClauses(
  cbas: Array<{ id: string; documentUrl: string; organizationId: string }>,
  options?: {
    concurrency?: number;
    autoSave?: boolean;
  }
): Promise<Map<string, ExtractionResult>> {
  const results = new Map<string, ExtractionResult>();
  const concurrency = options?.concurrency || 3;

  // Process in batches
  for (let i = 0; i < cbas.length; i += concurrency) {
    const batch = cbas.slice(i, i + concurrency);
    const batchPromises = batch.map(cba =>
      extractClausesFromPDF(cba.documentUrl, cba.id, {
        organizationId: cba.organizationId,
        autoSave: options?.autoSave,
      }).then(result => ({ cbaId: cba.id, result }))
    );

    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(({ cbaId, result }) => {
      results.set(cbaId, result);
    });
  }

  return results;
}

/**
 * Re-extract and update a single clause with improved AI
 */
export async function reExtractClause(
  clauseId: string,
  context: {
    fullAgreementText: string;
    surroundingClauses: string[];
  }
): Promise<ExtractedClause | null> {
  try {
    const ai = getAiClient();
    const response = await ai.extract({
      entityId: 'system',
      appKey: UE_APP_KEY,
      profileKey: UE_PROFILES.CLAUSE_EXTRACTION,
      input: `Re-analyze this clause with additional context and provide an improved classification and extraction.\n\nContext: ${context.surroundingClauses.join('\n\n')}\n\nFull Agreement Available: ${context.fullAgreementText.substring(0, 2000)}...\n\nProvide the best possible extraction for this clause.`,
      dataClass: 'internal',
    });

    const result = response.data as Record<string, unknown>;
    return (result.clause as ExtractedClause) || null;
  } catch (error) {
    logger.error('Error re-extracting clause', { error, clauseId });
    return null;
  }
}

/**
 * Generate clause summary using AI
 */
export async function generateClauseSummary(clauseContent: string): Promise<string> {
  try {
    const ai = getAiClient();
    const response = await ai.generate({
      entityId: 'system',
      appKey: UE_APP_KEY,
      profileKey: UE_PROFILES.CLAUSE_SUMMARY,
      input: `Provide a concise 1-2 sentence summary of this collective bargaining agreement clause:\n\n${clauseContent}`,
      dataClass: 'internal',
    });

    return response.content || '';
  } catch (error) {
    logger.error('Error generating summary', { error });
    return '';
  }
}

/**
 * Suggest clause improvements or issues
 */
export async function analyzeClauseQuality(
  clause: string,
  context: {
    clauseType: ClauseType;
    jurisdiction: string;
  }
): Promise<{
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  issues: string[];
  suggestions: string[];
}> {
  try {
    const ai = getAiClient();
    const response = await ai.extract({
      entityId: 'system',
      appKey: UE_APP_KEY,
      profileKey: UE_PROFILES.CLAUSE_QUALITY,
      input: `You are a labour law expert analyzing collective bargaining agreement clauses for clarity, enforceability, and best practices in ${context.jurisdiction}.\n\nAnalyze this ${context.clauseType} clause and provide:\n1. Overall quality rating (excellent/good/fair/poor)\n2. List of potential issues or ambiguities\n3. Suggestions for improvement\n\nClause: ${clause}`,
      dataClass: 'internal',
    });

    const result = response.data as Record<string, unknown>;
    return {
      quality: (result.quality as 'excellent' | 'good' | 'fair' | 'poor') || 'fair',
      issues: (result.issues as string[]) || [],
      suggestions: (result.suggestions as string[]) || [],
    };
  } catch (error) {
    logger.error('Error analyzing clause quality', { error });
    return {
      quality: 'fair',
      issues: ['Unable to analyze'],
      suggestions: [],
    };
  }
}

