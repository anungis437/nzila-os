/**
 * Mamba Model API Route
 * 
 * Provides endpoints for Mamba-based long-context processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { mambaModel } from '@/lib/ai/mamba-service';
import { logger } from '@/lib/logger';
import { getAuth } from '@clerk/nextjs/server';

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
export async function POST(request: NextRequest) {
  try {
    const auth = getAuth(request);
    
    if (!auth?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
        userId: auth.userId,
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
      userId: auth.userId,
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
}

/**
 * GET /api/ai/mamba
 * Get Mamba model info
 */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuth(request);
    
    if (!auth?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
}
