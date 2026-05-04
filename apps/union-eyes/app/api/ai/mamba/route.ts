/**
 * Mamba Model API Route
 * 
 * Provides endpoints for Mamba-based long-context processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { mambaModel } from '@/lib/ai/mamba-service';
import { logger } from '@/lib/logger';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { enforceAISafety } from '@nzila/policies';

// Request schemas
const mambaRequestSchema = z.object({
  input: z.string().min(1).max(100000),
  options: z.object({
    maxTokens: z.number().min(1).max(8192).optional(),
    temperature: z.number().min(0).max(2).optional(),
    systemPrompt: z.string().optional(),
    longDocument: z.boolean().default(false),
  }).optional(),
});

const _longDocumentSchema = z.object({
  document: z.string().min(1),
  chunkSize: z.number().min(512).max(8192).default(4096),
  overlap: z.number().min(0).max(1024).default(256),
});

/**
 * POST /api/ai/mamba
 * Process text with Mamba SSM
 */
export const POST = withRoleAuth('officer', async (request: NextRequest, context: BaseAuthContext) => {
  // 1. Rate limit
  const rl = await checkRateLimit(`ai-mamba:${context.userId}`, RATE_LIMITS.AI_COMPLETION);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  // 2. Feature flag
  const blocked = await guardAiFeature(AI_FEATURES.AI_MAMBA, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;
  // 3. Entitlement
  await requireEntitlement(context.organizationId!, 'ai_advanced_insights', context.userId);
  // 4. AI safety policy
  enforceAISafety({
    origin: 'mamba',
    action: 'POST',
    organizationId: context.organizationId,
    userId: context.userId,
    userRole: String(context.userRole ?? 'officer'),
    dataClass: 'internal',
  });
  try {
    const body = await request.json();
    const validation = mambaRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { input, options } = validation.data;

    // Check if this is a long document
    if (options?.longDocument || input.length > 10000) {
      const result = await mambaModel.processLongDocument(input);
      
      logger.info('Mamba long document processed', {
        userId: context.userId,
        inputLength: input.length,
        processingTime: result.processingTime,
      });

      return NextResponse.json({
        success: true,
        result,
      });
    }

    // Standard processing
    const result = await mambaModel.process(input, {
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
      systemPrompt: options?.systemPrompt,
    });

    logger.info('Mamba inference completed', {
      userId: context.userId,
      inputLength: input.length,
      processingTime: result.processingTime,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    logger.error('Mamba processing failed', { error });
    return NextResponse.json(
      { error: 'Mamba processing failed' },
      { status: 500 }
    );
  }
});

/**
 * GET /api/ai/mamba
 * Get Mamba model info
 */
export const GET = withRoleAuth('officer', async (_request: NextRequest, context: BaseAuthContext) => {
  // 1. Rate limit
  const rl2 = await checkRateLimit(`ai-mamba-get:${context.userId}`, RATE_LIMITS.AI_COMPLETION);
  if (!rl2.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  // 2. Feature flag
  const blocked2 = await guardAiFeature(AI_FEATURES.AI_MAMBA, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked2) return blocked2;
  try {
    const info = mambaModel.getInfo();

    return NextResponse.json({
      model: 'mamba-ssm',
      info,
      capabilities: {
        maxSequenceLength: info.maxSequenceLength,
        longContextProcessing: true,
        streaming: false,
        functionCalling: false,
      },
    });
  } catch (error) {
    logger.error('Failed to get Mamba info', { error });
    return NextResponse.json(
      { error: 'Failed to get model info' },
      { status: 500 }
    );
  }
});
