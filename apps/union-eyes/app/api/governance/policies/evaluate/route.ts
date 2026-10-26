/**
 * Policy Evaluation API
 * 
 * Evaluates subjects against policy rules
 */

import { NextResponse } from 'next/server';
import { withApi, z } from '@/lib/api/framework';
import { policyEngine } from '@/lib/services/policy-engine';

const evaluateSchema = z.object({
  ruleType: z.string(),
  category: z.string(),
  subjectType: z.enum(['member', 'user', 'organization', 'action']),
  subjectId: z.guid(),
  inputData: z.record(z.string(), z.any()),
  context: z.record(z.string(), z.any()).optional(),
});

/**
 * POST /api/governance/policies/evaluate
 * Evaluate subject against policy rules
 */
export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
    body: evaluateSchema,
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }
    const validatedData = body;

    const result = await policyEngine.evaluate(
      organizationId,
      validatedData.ruleType,
      validatedData.category,
      {
        subjectType: validatedData.subjectType,
        subjectId: validatedData.subjectId,
        inputData: validatedData.inputData,
        context: validatedData.context,
      },
      userId ?? undefined
    );

    return NextResponse.json({
      result,
    });
  },
);
