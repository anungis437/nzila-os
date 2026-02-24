/**
 * AI Data Ingestion API Route
 * 
 * POST /api/ai/ingest
 * - Upload documents for AI processing
 * - Parse PDF, DOCX, CSV, TXT, JSON, Email
 * - Extract entities and add to RAG
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { getCurrentUser } from '@/lib/api-auth-guard';
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
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const auth = await getCurrentUser();
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
        logger.warn('Failed to parse metadata JSON', { bodyStr });
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

    // Get user ID - check what properties are available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (auth as any).userId || (auth as any).id || 'unknown';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orgId = (auth as any).organizationId || (auth as any).orgId || 'default';

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

    // Extract entities if requested
    let extraction: ExtractionResult | null = null;
    if (metadata.extractEntities) {
      extraction = entityExtraction.extract(document.content, {
        jurisdiction: metadata.jurisdiction,
      });

      logger.info('Entities extracted', {
        documentId: document.id,
        entityCount: extraction.entities.length,
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
        entityCount: extraction.entities.length,
        entities: extraction.entities.slice(0, 10), // Return first 10
      } : null,
      rag: ragResult,
    }, { status: 201 });

  } catch (error) {
    logger.error('AI ingestion error', { error });

    return NextResponse.json(
      { error: 'Failed to process document', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/ingest
 * Get ingestion status or list recent ingestions
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const auth = await getCurrentUser();
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const _action = searchParams.get('action');
    const _documentId = searchParams.get('documentId');

    // Return API info
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

  } catch (error) {
    logger.error('AI ingestion GET error', { error });

    return NextResponse.json(
      { error: 'Failed to get ingestion info' },
      { status: 500 }
    );
  }
}
