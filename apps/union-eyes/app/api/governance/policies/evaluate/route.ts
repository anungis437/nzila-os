/**
 * Policy Evaluation API
 * 
 * Evaluates subjects against policy rules
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { policyEngine } from '@/lib/services/policy-engine';
import { logger } from '@/lib/logger';
import { auth } from '@clerk/nextjs/server';

// Validation schema for evaluation request
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
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    // Validate input
    const validatedData = evaluateSchema.parse(body);
    
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
  } catch (error: unknown) {
    logger.error('Error evaluating policy:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to evaluate policy', details: (error as Error).message },
      { status: 500 }
    );
  }
}
