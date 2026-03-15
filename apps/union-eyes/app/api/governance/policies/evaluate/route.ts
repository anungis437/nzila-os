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
  subjectId: z.string().uuid(),
  inputData: z.record(z.any()),
  context: z.record(z.any()).optional(),
});

/**
 * POST /api/governance/policies/evaluate
 * Evaluate subject against policy rules
 */
export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    body: evaluateSchema,
  },
  async ({ body }) => {
    const validatedData = body;

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
