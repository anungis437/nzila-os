/**
 * AI Data Ingestion API Route
 * 
 * POST /api/ai/ingest
 * - Upload documents for AI processing
 * - Parse PDF, DOCX, CSV, TXT, JSON, Email
 * - Extract orgs and add to RAG
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { enforceAISafety } from '@nzila/policies';
import { dataIngestion } from '@/lib/ai/data-ingestion';
import { entityExtraction, ExtractionResult } from '@/lib/ai/entity-extraction';
import { ragPipeline } from '@/lib/ai/rag-pipeline';

// Validation schema
const ingestSchema = z.object({
  source: z.string().min(1, 'Source is required'),
  jurisdiction: z.string().optional(),
  tags: z.array(z.string()).optional(),
  extractEntities: z.boolean().default(true),
  addToRAG: z.boolean().default(true),
});

/**
 * POST /api/ai/ingest
 * Upload and process document for AI ingestion
 */
export const POST = withRoleAuth('officer', async (request: NextRequest, context: BaseAuthContext) => {
  // 1. Rate limit
  const rl = await checkRateLimit(`ai-ingest:${context.userId}`, RATE_LIMITS.AI_COMPLETION);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  // 2. Feature flag
  const blocked = await guardAiFeature(AI_FEATURES.AI_INGEST, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;
  // 3. Entitlement
  await requireEntitlement(context.organizationId!, 'ai_advanced_insights', context.userId);
  // 4. AI safety policy
  enforceAISafety({
    origin: 'ingest',
    action: 'POST',
    organizationId: context.organizationId,
    userId: context.userId,
    userRole: String(context.userRole ?? 'officer'),
    dataClass: 'internal',
  });
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const bodyStr = formData.get('data') as string | null;

    // Validate file
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Parse metadata
    let metadata: {
      source: string;
      jurisdiction?: string;
      tags?: string[];
      extractEntities?: boolean;
      addToRAG?: boolean;
    } = {
      source: 'manual-upload',
    };

    if (bodyStr) {
      try {
        const parsed = JSON.parse(bodyStr);
        metadata = { ...metadata, ...parsed };
      } catch {
        logger.warn('Failed to parse metadata JSON');
      }
    }

    // Validate metadata
    const validation = ingestSchema.safeParse(metadata);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid metadata', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine content type
    const contentType = file.type || 'application/octet-stream';
    const filename = file.name || 'unknown';

    // AuthUser has typed `id` and `organizationId` properties
    const userId = context.userId;
    const orgId = context.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization context required for document ingestion' },
        { status: 403 }
      );
    }

    logger.info('Processing document for AI ingestion', {
      filename,
      contentType,
      size: buffer.length,
      userId,
      source: metadata.source,
    });

    // Parse document
    const document = await dataIngestion.ingest(buffer, contentType, filename, {
      source: metadata.source,
      uploadedBy: userId,
      organizationId: orgId,
      jurisdiction: metadata.jurisdiction,
      tags: metadata.tags,
    });

    // Extract orgs if requested
    let extraction: ExtractionResult | null = null;
    if (metadata.extractEntities) {
      extraction = entityExtraction.extract(document.content, {
        jurisdiction: metadata.jurisdiction,
      });

      logger.info('Entities extracted', {
        documentId: document.id,
        entityCount: extraction.orgs.length,
        documentType: extraction.documentType,
      });
    }

    // Add to RAG if requested
    let ragResult: { status: string; documentId: string; chunkCount: number } | null = null;
    if (metadata.addToRAG) {
      await ragPipeline.addDocuments([{
        id: document.id,
        content: document.content,
        metadata: {
          source: metadata.source,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type: extraction?.documentType as any || 'document',
          jurisdiction: metadata.jurisdiction,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: metadata.tags,
        },
      }]);

      ragResult = {
        status: 'indexed',
        documentId: document.id,
        chunkCount: 1, // Simplified - actual implementation would count chunks
      };

      logger.info('Document added to RAG', {
        documentId: document.id,
        userId,
      });
    }

    // Return success
    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        filename: filename,
        contentLength: document.content.length,
        quality: document.quality,
      },
      extraction: extraction ? {
        documentType: extraction.documentType,
        entityCount: extraction.orgs.length,
        orgs: extraction.orgs.slice(0, 10), // Return first 10
      } : null,
      rag: ragResult,
    }, { status: 201 });

  } catch (error) {
    logger.error('AI ingestion error', { error });

    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  }
});

/**
 * GET /api/ai/ingest
 * Get ingestion status or list recent ingestions
 */
export const GET = withRoleAuth('officer', async (_request: NextRequest, context: BaseAuthContext) => {
  // 1. Rate limit
  const rl2 = await checkRateLimit(`ai-ingest-get:${context.userId}`, RATE_LIMITS.AI_COMPLETION);
  if (!rl2.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  // 2. Feature flag
  const blocked2 = await guardAiFeature(AI_FEATURES.AI_INGEST, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked2) return blocked2;
  return NextResponse.json({
      name: 'AI Data Ingestion API',
      version: '1.0.0',
      supportedFormats: ['pdf', 'docx', 'xlsx', 'csv', 'txt', 'json', 'html', 'eml'],
      maxFileSize: '50MB',
      endpoints: {
        POST: {
          description: 'Upload and process document',
          body: {
            file: 'File (required)',
            data: 'JSON string with metadata (optional)',
          },
        },
        GET: {
          description: 'Get API info or document status',
          params: {
            action: 'stats | status',
            documentId: 'Specific document ID',
          },
        },
      },
    });
});
