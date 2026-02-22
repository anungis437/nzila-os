/**
 * Vector Embeddings Service
 * 
 * Provides semantic embeddings for RAG (Retrieval-Augmented Generation)
 * Supports multiple embedding models and vector storage
 */

import { logger } from '@/lib/logger';
import { getAiClient, UE_APP_KEY, UE_PROFILES } from '@/lib/ai/ai-client';

// Embedding configuration
export interface EmbeddingsConfig {
  /** @deprecated Provider selection is now managed by @nzila/ai-sdk control plane */
  provider?: string;
  model?: string;
  dimensions: number;
  batchSize: number;
}

const DEFAULT_CONFIG: EmbeddingsConfig = {
  dimensions: 1536,
  batchSize: 100,
};

/**
 * Text embedding
 */
export interface Embedding {
  id: string;
  text: string;
  vector: number[];
  metadata?: Record<string, unknown>;
}

/**
 * Search result
 */
export interface SearchResult {
  id: string;
  text: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * Vector Embeddings Service
 */
export class EmbeddingsService {
  private config: EmbeddingsConfig;
  private isInitialized: boolean = false;

  constructor(config: Partial<EmbeddingsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the embeddings service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.info('Embeddings service initializing', {
      provider: this.config.provider,
      model: this.config.model,
      dimensions: this.config.dimensions,
    });

    this.isInitialized = true;
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<Embedding> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const vector = await this.generateEmbedding(text);

    return {
      id: this.generateId(),
      text,
      vector,
      metadata: {
        model: this.config.model,
        provider: this.config.provider,
        createdAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<Embedding[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const embeddings: Embedding[] = [];
    
    // Process in batches
    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);
      const vectors = await this.generateBatchEmbeddings(batch);
      
      for (let j = 0; j < batch.length; j++) {
        embeddings.push({
          id: this.generateId(),
          text: batch[j],
          vector: vectors[j],
          metadata: {
            model: this.config.model,
            provider: this.config.provider,
            createdAt: new Date().toISOString(),
          },
        });
      }
    }

    return embeddings;
  }

  /**
   * Search for similar texts
   */
  async search(
    query: string,
    candidates: Embedding[],
    topK: number = 5
  ): Promise<SearchResult[]> {
    const queryEmbedding = await this.embed(query);
    
    // Calculate cosine similarity
    const results = candidates.map(candidate => ({
      id: candidate.id,
      text: candidate.text,
      score: this.cosineSimilarity(queryEmbedding.vector, candidate.vector),
      metadata: candidate.metadata,
    }));

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  /**
   * Generate embedding using @nzila/ai-sdk (INV-01 compliant)
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    const ai = getAiClient();
    const response = await ai.embed({
      entityId: 'system',
      appKey: UE_APP_KEY,
      profileKey: UE_PROFILES.EMBEDDINGS,
      input: text,
      dataClass: 'internal',
    });
    return response.embeddings[0];
  }

  /**
   * Generate batch embeddings via @nzila/ai-sdk
   */
  private async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const ai = getAiClient();
    const response = await ai.embed({
      entityId: 'system',
      appKey: UE_APP_KEY,
      profileKey: UE_PROFILES.EMBEDDINGS,
      input: texts,
      dataClass: 'internal',
    });
    return response.embeddings;
  }

  /**
   * @deprecated No longer needed — embeddings come from @nzila/ai-sdk
   */
  private async huggingfaceEmbed(_text: string): Promise<number[]> {
    return this.generateEmbedding(_text);
  }

  /**
   * @deprecated No longer needed — embeddings come from @nzila/ai-sdk
   */
  private async localEmbed(_text: string): Promise<number[]> {
    return this.generateEmbedding(_text);
  }

  /**
   * Generate random vector (for simulation)
   */
  private generateRandomVector(): number[] {
    const vector: number[] = [];
    let magnitude = 0;
    
    for (let i = 0; i < this.config.dimensions; i++) {
      const value = Math.random() * 2 - 1;
      vector.push(value);
      magnitude += value * value;
    }
    
    // Normalize
    magnitude = Math.sqrt(magnitude);
    return vector.map(v => v / magnitude);
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `emb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get service info
   */
  getInfo(): EmbeddingsConfig & { isInitialized: boolean } {
    return {
      ...this.config,
      isInitialized: this.isInitialized,
    };
  }
}

/**
 * Factory function
 */
export function createEmbeddingsService(
  config?: Partial<EmbeddingsConfig>
): EmbeddingsService {
  return new EmbeddingsService(config);
}

// Export singleton
export const embeddingsService = new EmbeddingsService();
