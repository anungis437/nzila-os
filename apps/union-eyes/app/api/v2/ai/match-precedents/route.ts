import { NextResponse } from 'next/server';
/**
 * POST /api/ai/match-precedents
 * Migrated to withApi() framework
 */
import { matchClaimToPrecedents, analyzeClaimWithPrecedents, generateLegalMemorandum } from '@/lib/services/ai/precedent-matching-service';

 
 
 
 
 
import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';

const matchPrecedentsSchema = z.object({
  action: z.enum(['match', 'analyze', 'memorandum']).default('match'),
  claim: z.object({
    facts: z.string().min(10, 'Facts must be at least 10 characters'),
    issueType: z.string().min(1, 'Issue type is required'),
    jurisdiction: z.string().optional(),
    memberId: z.string().uuid().optional(),
  }),
  options: z.record(z.string(), z.unknown()).default({}),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    body: matchPrecedentsSchema,
    rateLimit: RATE_LIMITS.AI_COMPLETION,
    openapi: {
      tags: ['Ai'],
      summary: 'POST match-precedents',
    },
    successStatus: 201,
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body, query: _query }) => {

          // Validate request body
          const { action, claim, options } = body;
          switch (action) {
            case 'match':
              // Simple precedent matching without full analysis
              const matches = await matchClaimToPrecedents(claim, options);
              return NextResponse.json({
                action: 'match',
                claim: {
                  issueType: claim.issueType,
                  jurisdiction: claim.jurisdiction,
                },
                matches,
                count: matches.length,
              });
            case 'analyze':
              // Full analysis with outcome prediction and strength assessment
              const analysis = await analyzeClaimWithPrecedents(claim, options);
              return NextResponse.json({
                action: 'analyze',
                claim: {
                  issueType: claim.issueType,
                  jurisdiction: claim.jurisdiction,
                },
                analysis: {
                  predictedOutcome: analysis.predictedOutcome,
                  strengthAnalysis: analysis.strengthAnalysis,
                  suggestedArguments: analysis.suggestedArguments,
                  topMatches: analysis.matches.slice(0, 5),
                  totalMatchesFound: analysis.matches.length,
                },
              });
            case 'memorandum':
              // Generate full legal memorandum
              const fullAnalysis = await analyzeClaimWithPrecedents(claim, options);
              const memorandum = await generateLegalMemorandum(claim, fullAnalysis);
              return NextResponse.json({
                action: 'memorandum',
                claim: {
                  issueType: claim.issueType,
                  jurisdiction: claim.jurisdiction,
                },
                memorandum,
                analysis: {
                  predictedOutcome: fullAnalysis.predictedOutcome,
                  matchCount: fullAnalysis.matches.length,
                },
              });
            default:
              throw ApiError.badRequest('Invalid action. Use: match, analyze, or memorandum'
        );
          }
  },
);
