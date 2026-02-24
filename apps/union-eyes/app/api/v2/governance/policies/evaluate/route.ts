import { NextResponse } from 'next/server';
/**
 * POST /api/governance/policies/evaluate
 * Migrated to withApi() framework
 */
import { policyEngine } from '@/lib/services/policy-engine';

 
 
 
 
 
 
import { withApi, z } from '@/lib/api/framework';

const evaluateSchema = z.object({
  ruleType: z.string(),
  category: z.string(),
  subjectType: z.enum(['member', 'user', 'organization', 'action']),
  subjectId: z.string().uuid(),
  inputData: z.record(z.any()),
  context: z.record(z.any()).optional(),
});

export const POST = withApi(
  {
    auth: { required: false },
    body: evaluateSchema,
    openapi: {
      tags: ['Governance'],
      summary: 'POST evaluate',
    },
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body, query: _query, params: _params }) => {

        const validatedData = body;
        // Evaluate policy
        const result = await policyEngine.evaluate(
          validatedData.ruleType,
          validatedData.category,
          {
            subjectType: validatedData.subjectType,
            subjectId: validatedData.subjectId,
            inputData: validatedData.inputData,
            context: validatedData.context,
          }
        );
        return NextResponse.json({
          result,
        });
  },
);
