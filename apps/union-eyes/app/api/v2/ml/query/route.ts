import { NextResponse } from 'next/server';
/**
 * POST /api/ml/query
 * Migrated to withApi() framework
 */
import { logApiAuditEvent } from '@/lib/middleware/api-security';
 
 
 
import { withApi, z, RATE_LIMITS } from '@/lib/api/framework';

const QuerySchema = z.object({
  question: z.string().min(1).max(500),
  context: z.any().optional(),
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

  if (lowerQuestion.includes('claim')) {
    suggestions.push(
      'Show me claims by category',
      'What is the average resolution time?',
      'Which stewards handle the most claims?'
    );
  }

  if (lowerQuestion.includes('steward')) {
    suggestions.push(
      'Show steward workload distribution',
      'Who has the highest win rate?',
      'Compare steward performance this quarter'
    );
  }

  if (lowerQuestion.includes('deadline') || lowerQuestion.includes('overdue')) {
    suggestions.push(
      'Show upcoming deadlines this week',
      'Which claims are at risk?',
      'What is our SLA compliance rate?'
    );
  }

  if (lowerQuestion.includes('settlement') || lowerQuestion.includes('cost')) {
    suggestions.push(
      'What is our total recovery this month?',
      'Show costs by claim type',
      'Calculate our ROI for this quarter'
    );
  }

  if (lowerQuestion.includes('month') || lowerQuestion.includes('quarter')) {
    suggestions.push(
      'Compare with previous period',
      'Show year-over-year trends',
      'Forecast next month'
    );
  }

  return suggestions.slice(0, 3);
}

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    body: QuerySchema,
    rateLimit: RATE_LIMITS.ML_PREDICTIONS,
    openapi: {
      tags: ['Ml'],
      summary: 'POST query',
    },
    successStatus: 201,
  },
  async ({ request: _request, userId, organizationId, user: _user, body, query: _query }) => {

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
          const _errorData = await response.json().catch(() => ({}));
    throw new Error('AI service query failed');
        }
        const result = await response.json();
        // Generate follow-up suggestions based on the query type
        const suggestions = generateFollowUpSuggestions(question, result);
        // Log audit event
        await logApiAuditEvent({
          timestamp: new Date().toISOString(),
          userId: userId ?? undefined,
          endpoint: '/api/v2/ml/query',
          method: 'POST',
          eventType: 'success',
          severity: 'low',
          details: {
            action: 'ml_query',
            resourceType: 'AI_ML',
            organizationId,
            question: question.substring(0, 100),
            confidence: result.confidence,
          },
        });
        return NextResponse.json({
          ...result,
          suggestions
        });
  },
);
