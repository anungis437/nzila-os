import { NextRequest, NextResponse } from 'next/server';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { logApiAuditEvent } from '@/lib/middleware/api-security';
import { z } from 'zod';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
const QuerySchema = z.object({
  question: z.string().min(1).max(500),
  context: z.any().optional(),
});

/**
 * POST /api/ml/query
 * Natural language query interface
 * 
 * Request body:
 * {
 *   question: string,    // Natural language question
 *   context?: any        // Optional context
 * }
 * 
 * Response:
 * {
 *   answer: string,
 *   data?: any,          // Query results if data query
 *   sql?: string,        // Generated SQL if applicable
 *   confidence: number,
 *   sources: string[],
 *   suggestions?: string[] // Follow-up questions
 * }
 * 
 * Examples:
 * - "Show me top 5 stewards by resolution rate this month"
 * - "How many claims are overdue?"
 * - "What&apos;s our win rate this quarter?"
 * - "Which employer has the most claims?"
 */
export const POST = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {
  const { userId, organizationId } = context;

  // CRITICAL: Rate limit ML query calls (expensive AI operations)
  const rateLimitResult = await checkRateLimit(
    `ml-predictions:${userId}`,
    RATE_LIMITS.ML_PREDICTIONS
  );

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded for ML operations. Please try again later.' },
      { 
        status: 429,
        headers: createRateLimitHeaders(rateLimitResult)
      }
    );
  }

  try {
    const body = await request.json();
    const { question, context: queryContext } = QuerySchema.parse(body);

    const organizationScopeId = organizationId || userId || '';

    // Call AI service for natural language query
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3005';
    
    const response = await fetch(`${aiServiceUrl}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AI_SERVICE_TOKEN}`,
        'X-Organization-ID': organizationScopeId
      },
      body: JSON.stringify({
        question,
        organizationId: organizationScopeId,
        context: queryContext
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error || 'AI service query failed');
    }

    const result = await response.json();

    // Generate follow-up suggestions based on the query type
    const suggestions = generateFollowUpSuggestions(question, result);

    // Log audit event
    logApiAuditEvent({
      timestamp: new Date().toISOString(),
      endpoint: '/api/ml/query',
      method: 'POST',
      eventType: 'success',
      severity: 'low',
      userId,
      details: {
        question: question.substring(0, 100),
        confidence: result.confidence,
      },
    });

    return NextResponse.json({
      ...result,
      suggestions
    });
    
  } catch (error) {
if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to process natural language query',
      error
    );
  }
});

/**
 * Generate intelligent follow-up question suggestions
 */
function generateFollowUpSuggestions(
  question: string, 
  _result: Record<string, unknown>
): string[] {
  const suggestions: string[] = [];
  const lowerQuestion = question.toLowerCase();

  // Claims-related follow-ups
  if (lowerQuestion.includes('claim')) {
    suggestions.push(
      'Show me claims by category',
      'What is the average resolution time?',
      'Which stewards handle the most claims?'
    );
  }

  // Steward-related follow-ups
  if (lowerQuestion.includes('steward')) {
    suggestions.push(
      'Show steward workload distribution',
      'Who has the highest win rate?',
      'Compare steward performance this quarter'
    );
  }

  // Deadline-related follow-ups
  if (lowerQuestion.includes('deadline') || lowerQuestion.includes('overdue')) {
    suggestions.push(
      'Show upcoming deadlines this week',
      'Which claims are at risk?',
      'What is our SLA compliance rate?'
    );
  }

  // Financial follow-ups
  if (lowerQuestion.includes('settlement') || lowerQuestion.includes('cost')) {
    suggestions.push(
      'What is our total recovery this month?',
      'Show costs by claim type',
      'Calculate our ROI for this quarter'
    );
  }

  // Time-based follow-ups
  if (lowerQuestion.includes('month') || lowerQuestion.includes('quarter')) {
    suggestions.push(
      'Compare with previous period',
      'Show year-over-year trends',
      'Forecast next month'
    );
  }

  // Return up to 3 suggestions
  return suggestions.slice(0, 3);
}

