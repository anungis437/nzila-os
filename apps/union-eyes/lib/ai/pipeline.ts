/**
 * Complete AI Pipeline
 * 
 * Ties together all AI components:
 * 1. Data Ingestion
 * 2. Entity Extraction
 * 3. RAG Storage
 * 4. Response Generation
 * 5. Learning
 */

import { logger } from '@/lib/logger';
import { dataIngestion, IngestedDocument } from './data-ingestion';
import { entityExtraction, ExtractionResult } from './entity-extraction';
import { ragPipeline, SearchResult } from './rag-pipeline';
import { templateEngine, TemplateContext } from './template-engine';
import { aiSafety, SafetyCheckResult } from './safety';
import { learningService } from './learning';

// Pipeline configuration
export interface PipelineConfig {
  enableIngestion: boolean;
  enableExtraction: boolean;
  enableRAG: boolean;
  enableLearning: boolean;
  maxContextChunks: number;
  fallbackResponse: string;
}

// Pipeline result
export interface PipelineResult {
  response: string;
  sources: { id: string; content: string; score: number }[];
  entities: ExtractionResult['entities'];
  safety: SafetyCheckResult;
  metadata: {
    latency: number;
    tokensUsed?: number;
    chunksRetrieved: number;
    documentType?: string;
  };
}

/**
 * Main AI Pipeline
 */
class AIPipeline {
  private config: PipelineConfig = {
    enableIngestion: true,
    enableExtraction: true,
    enableRAG: true,
    enableLearning: true,
    maxContextChunks: 5,
    fallbackResponse: 'I apologize, but I need more information to help you with that.',
  };

  constructor(config?: Partial<PipelineConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Process a user query through the full pipeline
   */
  async process(
    query: string,
    context: {
      userId: string;
      organizationId: string;
      sessionId: string;
      jurisdiction?: string;
    }
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    
    try {
      // 1. Safety check
      const safety = aiSafety.checkInput(query);
      
      if (!safety.safe) {
        logger.warn('Query blocked by safety filter', { 
          flags: safety.flags,
          userId: context.userId,
        });
        
        return {
          response: 'I\'m sorry, but I can\'t help with that request.',
          sources: [],
          entities: [],
          safety,
          metadata: {
            latency: Date.now() - startTime,
            chunksRetrieved: 0,
          },
        };
      }

      // 2. Get relevant context from RAG
      let sources: SearchResult[] = [];
      
      if (this.config.enableRAG) {
        sources = await ragPipeline.search(query, {
          topK: this.config.maxContextChunks,
          jurisdiction: context.jurisdiction,
        });

        // Track knowledge gaps
        if (sources.length === 0 && this.config.enableLearning) {
          learningService.detectKnowledgeGap(query, { found: false, count: 0 });
        }
      }

      // 3. Build template context
      const templateContext: TemplateContext = {
        query,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jurisdiction: (context.jurisdiction || 'federal') as any,
        userRole: 'member',
        intent: this.classifyIntent(query),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        entities: [] as any[],
        retrievedContext: sources.map(s => s.chunk.content),
        sla: 'standard',
        organizationId: context.organizationId,
      };

      // 4. Extract entities if enabled
      let extraction: ExtractionResult | null = null;
      
      if (this.config.enableExtraction && sources.length > 0) {
        const contextText = sources.map(s => s.chunk.content).join('\n');
        extraction = entityExtraction.extract(contextText, {
          jurisdiction: context.jurisdiction,
        });
        templateContext.entities = extraction.entities;
      }

      // 5. Generate response using template engine
      const response = await this.generateResponse(templateContext);

      // 6. Check output safety
      const outputSafety = aiSafety.checkOutput(response);

      if (!outputSafety.safe) {
        logger.warn('Response filtered by safety', {
          flags: outputSafety.flags,
        });
        
        return {
          response: 'I\'m sorry, but I can\'t provide that information.',
          sources: sources.map(s => ({
            id: s.chunk.id,
            content: s.chunk.content.substring(0, 200),
            score: s.score,
          })),
          entities: extraction?.entities || [],
          safety: outputSafety,
          metadata: {
            latency: Date.now() - startTime,
            chunksRetrieved: sources.length,
          },
        };
      }

      // 7. Record feedback opportunity
      if (this.config.enableLearning) {
        // Feedback will be collected separately via UI
      }

      return {
        response,
        sources: sources.map(s => ({
          id: s.chunk.id,
          content: s.chunk.content.substring(0, 200),
          score: s.score,
        })),
        entities: extraction?.entities || [],
        safety,
        metadata: {
          latency: Date.now() - startTime,
          chunksRetrieved: sources.length,
          documentType: extraction?.documentType,
        },
      };

    } catch (error) {
      logger.error('Pipeline error', { error, userId: context.userId });
      
      return {
        response: this.config.fallbackResponse,
        sources: [],
        entities: [],
        safety: { safe: true, flags: [] },
        metadata: {
          latency: Date.now() - startTime,
          chunksRetrieved: 0,
        },
      };
    }
  }

  /**
   * Ingest a document through the pipeline
   */
  async ingestDocument(
    buffer: Buffer,
    contentType: string,
    filename: string,
    metadata: {
      source: string;
      uploadedBy: string;
      organizationId: string;
      jurisdiction?: string;
      tags?: string[];
    }
  ): Promise<{ document: IngestedDocument; extraction: ExtractionResult }> {
    // 1. Ingest and validate
    const document = await dataIngestion.ingest(buffer, contentType, filename, metadata);

    // 2. Extract entities
    const extraction = entityExtraction.extract(document.content, {
      jurisdiction: metadata.jurisdiction,
    });

    // 3. Add to RAG
    await ragPipeline.addDocuments([{
      id: document.id,
      content: document.content,
      metadata: {
        source: metadata.source,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: extraction.documentType as any,
        jurisdiction: metadata.jurisdiction,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: metadata.tags,
      },
    }]);

    logger.info('Document processed through pipeline', {
      documentId: document.id,
      entityCount: extraction.entities.length,
      documentType: extraction.documentType,
    });

    return { document, extraction };
  }

  /**
   * Generate response using template engine
   */
  private async generateResponse(context: TemplateContext): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prompt = (templateEngine as any).buildPrompt('general_query', context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (templateEngine as any).execute(prompt, context);
    return response;
  }

  /**
   * Classify query intent
   */
  private classifyIntent(query: string): string {
    const lower = query.toLowerCase();

    if (lower.includes('how do i') || lower.includes('how to')) {
      return 'how_to';
    }
    if (lower.includes('what is') || lower.includes('what are')) {
      return 'information';
    }
    if (lower.includes('file') || lower.includes('submit') || lower.includes('claim')) {
      return 'action';
    }
    if (lower.includes('status') || lower.includes('where') || lower.includes('when')) {
      return 'status';
    }
    if (lower.includes('?') || lower.includes('help')) {
      return 'help';
    }

    return 'general';
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PipelineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get pipeline stats
   */
  getStats(): {
    rag: ReturnType<typeof ragPipeline.getStats>;
    learning: ReturnType<typeof learningService.getStats>;
  } {
    return {
      rag: ragPipeline.getStats(),
      learning: learningService.getStats(),
    };
  }
}

// Export singleton
export const aiPipeline = new AIPipeline();

// Export class
export { AIPipeline };
