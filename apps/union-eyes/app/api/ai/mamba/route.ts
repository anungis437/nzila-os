/**
 * Mamba Model API Route
 * 
 * Provides endpoints for Mamba-based long-context processing
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mambaModel } from '@/lib/ai/mamba-service';
import { logger } from '@/lib/logger';
import { withApi } from '@/lib/api/framework';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { enforceAISafety } from '@nzila/policies';

// Request schemas
const mambaRequestSchema = z.object({
  input: z.string().min(1).max(100000),
  options: z.object({
    maxTokens: z.number().min(1).max(8192).optional(),
    temperature: z.number().min(0).max(2).optional(),
    systemPrompt: z.string().max(5000).optional(),
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
 *
 * The model reads nothing from the database, so the route has no tenant statement and sets no `rlsOrgContext`. The entitlement is checked by the wrapper.
 * The body is validated here, not by the wrapper, to keep the answer for an invalid body (a 400 with `details`) as it was.
 */
export const POST = withApi(
  {
    auth: { minRole: 'officer' },
    entitlement: 'ai_advanced_insights',
    registry: { audience: 'officer', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'Process text with the Mamba model' },
  },
  async ({ user, userId, organizationId, body }) => {
    // 1. Rate limit
    const rl = await checkRateLimit(`ai-mamba:${userId}`, RATE_LIMITS.AI_COMPLETION);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
    // 2. Feature flag
    const blocked = await guardAiFeature(AI_FEATURES.AI_MAMBA, {
      userId: userId!,
      organizationId: organizationId!,
    });
    if (blocked) return blocked;
    // 3. AI safety policy
    enforceAISafety({
      origin: 'mamba',
      action: 'POST',
      organizationId,
      userId,
      userRole: String(user?.role ?? 'officer'),
      dataClass: 'internal',
    });
    try {
      const validation = mambaRequestSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.issues },
          { status: 400 }
        );
      }

      const { input, options } = validation.data;

      // Check if this is a long document
      if (options?.longDocument || input.length > 10000) {
        const result = await mambaModel.processLongDocument(input);
        
        logger.info('Mamba long document processed', {
          userId,
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
        userId,
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
  },
);

/**
 * GET /api/ai/mamba
 * Get Mamba model info
 */
export const GET = withApi(
  {
    auth: { minRole: 'officer' },
    registry: { audience: 'officer', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'Mamba model information' },
  },
  async ({ userId, organizationId }) => {
    // 1. Rate limit
    const rl2 = await checkRateLimit(`ai-mamba-get:${userId}`, RATE_LIMITS.AI_COMPLETION);
    if (!rl2.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
    // 2. Feature flag
    const blocked2 = await guardAiFeature(AI_FEATURES.AI_MAMBA, {
      userId: userId!,
      organizationId: organizationId!,
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
  },
);
