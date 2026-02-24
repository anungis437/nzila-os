/**
 * RAG (Retrieval-Augmented Generation) Pipeline
 * 
 * Complete RAG implementation with:
 * - Document chunking strategies
 * - Vector storage
 * - Hybrid search (keyword + semantic)
 * - Re-ranking
 */

import { logger } from '@/lib/logger';

// Document types
export interface Document {
  id: string;
  content: string;
  metadata: DocumentMetadata;
}

export interface DocumentMetadata {
  source: string;
  type: 'policy' | 'contract' | 'faq' | 'grievance' | 'legal' | 'procedure';
  jurisdiction?: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  title?: string;
}

// Chunking
export interface TextChunk {
  id: string;
  content: string;
  documentId: string;
  metadata: DocumentMetadata;
  embedding: number[];
  startIndex: number;
  endIndex: number;
}

// Search results
export interface SearchResult {
  chunk: TextChunk;
  score: number;
  rerankScore?: number;
}

// RAG Config
export interface RAGConfig {
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  rerank: boolean;
  hybridSearch: boolean;
  hybridAlpha: number;
}

// BM25 for keyword search
interface BM25Index {
  documentFrequency: Map<string, number>;
  termFrequency: Map<string, Map<string, number>>;
  documentLengths: Map<string, number>;
  avgDocumentLength: number;
  documents: Map<string, TextChunk>;
}

// Simple in-memory embedding placeholder
function generateEmbedding(text: string): number[] {
  // Simple hash-based embedding for demo
  const hash = text.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  
  // Generate deterministic pseudo-embedding
  const embedding: number[] = [];
  for (let i = 0; i < 384; i++) {
    const seed = hash + i * 31;
    embedding.push(Math.sin(seed) * Math.cos(seed % 100));
  }
  
  // Normalize
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map(v => v / norm);
}

function cosineSimilarity(a: number[], b: number[]): number {
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
 * RAG Pipeline Service
 */
class RAGPipeline {
  private chunks: Map<string, TextChunk> = new Map();
  private bm25Index: BM25Index = {
    documentFrequency: new Map(),
    termFrequency: new Map(),
    documentLengths: new Map(),
    avgDocumentLength: 0,
    documents: new Map(),
  };
  
  private config: RAGConfig = {
    chunkSize: 500,
    chunkOverlap: 50,
    topK: 5,
    rerank: false,
    hybridSearch: true,
    hybridAlpha: 0.5,
  };

  constructor(config: Partial<RAGConfig> = {}) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Add documents to the knowledge base
   */
  async addDocuments(documents: Document[]): Promise<number> {
    let addedCount = 0;

    for (const doc of documents) {
      const chunks = this.chunkDocument(doc);
      
      for (const chunk of chunks) {
        chunk.embedding = generateEmbedding(chunk.content);
        this.chunks.set(chunk.id, chunk);
        this.addToBM25Index(chunk);
        addedCount++;
      }
    }

    logger.info(`Added ${addedCount} chunks to RAG pipeline`);
    return addedCount;
  }

  /**
   * Chunk a document into smaller pieces
   */
  private chunkDocument(doc: Document): TextChunk[] {
    const chunks: TextChunk[] = [];
    const content = doc.content;
    const chunkSize = this.config.chunkSize;
    const overlap = this.config.chunkOverlap;
    
    let startIndex = 0;
    let chunkId = 0;

    while (startIndex < content.length) {
      const endIndex = Math.min(startIndex + chunkSize, content.length);
      let adjustedEnd = endIndex;
      
      // Try to break at sentence boundary
      if (endIndex < content.length) {
        const lastPeriod = content.lastIndexOf('.', endIndex);
        const lastNewline = content.lastIndexOf('\n', endIndex);
        const breakPoint = Math.max(lastPeriod, lastNewline);
        
        if (breakPoint > startIndex + chunkSize / 2) {
          adjustedEnd = breakPoint + 1;
        }
      }

      const chunkContent = content.slice(startIndex, adjustedEnd).trim();
      
      if (chunkContent.length > 50) {
        chunks.push({
          id: `${doc.id}-chunk-${chunkId++}`,
          content: chunkContent,
          documentId: doc.id,
          metadata: doc.metadata,
          startIndex,
          endIndex: adjustedEnd,
          embedding: [],
        });
      }

      // Move to next chunk with overlap
      const nextStart = adjustedEnd - overlap;
      if (nextStart <= startIndex) {
        startIndex = startIndex + chunkSize - overlap;
      } else {
        startIndex = nextStart;
      }
    }

    return chunks;
  }

  /**
   * Add chunk to BM25 index
   */
  private addToBM25Index(chunk: TextChunk): void {
    const words = this.tokenize(chunk.content);
    const docLength = words.length;
    
    this.bm25Index.documents.set(chunk.id, chunk);
    this.bm25Index.documentLengths.set(chunk.id, docLength);
    
    const termFreq = new Map<string, number>();
    const uniqueWords = new Set(words);
    
    for (const word of uniqueWords) {
      termFreq.set(word, words.filter(w => w === word).length);
      const df = this.bm25Index.documentFrequency.get(word) || 0;
      this.bm25Index.documentFrequency.set(word, df + 1);
    }
    
    this.bm25Index.termFrequency.set(chunk.id, termFreq);
    
    // Recalculate average
    const totalLength = Array.from(this.bm25Index.documentLengths.values())
      .reduce((sum, len) => sum + len, 0);
    this.bm25Index.avgDocumentLength = 
      this.bm25Index.documentLengths.size > 0 
        ? totalLength / this.bm25Index.documentLengths.size 
        : 0;
  }

  /**
   * Tokenize text for BM25
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  /**
   * Search the knowledge base
   */
  async search(query: string, options?: { 
    topK?: number; 
    jurisdiction?: string;
    type?: string;
  }): Promise<SearchResult[]> {
    const topK = options?.topK || this.config.topK;
    
    let results: SearchResult[];

    if (this.config.hybridSearch) {
      results = await this.hybridSearch(query, topK);
    } else {
      results = this.semanticSearch(query, topK);
    }

    // Filter by metadata if specified
    if (options?.jurisdiction || options?.type) {
      results = results.filter(r => {
        if (options.jurisdiction && r.chunk.metadata.jurisdiction !== options.jurisdiction) {
          return false;
        }
        if (options.type && r.chunk.metadata.type !== options.type) {
          return false;
        }
        return true;
      });
    }

    // Re-rank if enabled
    if (this.config.rerank) {
      results = this.rerank(query, results);
    }

    return results.slice(0, topK);
  }

  /**
   * Semantic search using embeddings
   */
  private semanticSearch(query: string, topK: number): SearchResult[] {
    const queryEmbedding = generateEmbedding(query);
    
    const results: SearchResult[] = [];
    
    for (const [_id, chunk] of this.chunks) {
      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      results.push({ chunk, score });
    }

    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, topK);
  }

  /**
   * BM25 keyword search
   */
  private bm25Search(query: string, topK: number): SearchResult[] {
    const queryTerms = this.tokenize(query);
    const results: SearchResult[] = [];
    
    const k1 = 1.5;
    const b = 0.75;
    const N = this.bm25Index.documents.size;
    
    for (const [docId, chunk] of this.bm25Index.documents) {
      let score = 0;
      const termFreq = this.bm25Index.termFrequency.get(docId);
      const docLength = this.bm25Index.documentLengths.get(docId) || 0;
      
      for (const term of queryTerms) {
        const tf = termFreq?.get(term) || 0;
        const df = this.bm25Index.documentFrequency.get(term) || 0;
        
        if (df > 0) {
          const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
          const numerator = tf * (k1 + 1);
          const denominator = tf + k1 * (1 - b + (b * docLength / (this.bm25Index.avgDocumentLength || 1)));
          score += idf * (numerator / denominator);
        }
      }
      
      if (score > 0) {
        results.push({ chunk, score });
      }
    }
    
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Hybrid search combining semantic and keyword
   */
  private async hybridSearch(query: string, topK: number): Promise<SearchResult[]> {
    const semanticResults = this.semanticSearch(query, topK * 2);
    const keywordResults = this.bm25Search(query, topK * 2);

    // Normalize scores
    const maxSemantic = Math.max(...semanticResults.map(r => r.score), 0.001);
    const maxKeyword = Math.max(...keywordResults.map(r => r.score), 0.001);

    const normalizedSemantic = new Map(
      semanticResults.map(r => [r.chunk.id, r.score / maxSemantic])
    );
    const normalizedKeyword = new Map(
      keywordResults.map(r => [r.chunk.id, r.score / maxKeyword])
    );

    // Combine scores
    const combined = new Map<string, SearchResult>();
    
    for (const [id, chunk] of this.chunks) {
      const semScore = normalizedSemantic.get(id) || 0;
      const keyScore = normalizedKeyword.get(id) || 0;
      
      const alpha = this.config.hybridAlpha;
      const combinedScore = alpha * semScore + (1 - alpha) * keyScore;
      
      if (combinedScore > 0) {
        combined.set(id, { chunk, score: combinedScore });
      }
    }

    return Array.from(combined.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Simple re-ranking
   */
  private rerank(query: string, results: SearchResult[]): SearchResult[] {
    const queryTerms = new Set(this.tokenize(query));
    
    for (const result of results) {
      const contentTerms = this.tokenize(result.chunk.content);
      let termMatches = 0;
      for (const term of contentTerms) {
        if (queryTerms.has(term)) {
          termMatches++;
        }
      }
      
      const density = termMatches / Math.max(contentTerms.length, 1);
      result.rerankScore = result.score * (1 + density);
    }

    return results.sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0));
  }

  /**
   * Delete documents by ID
   */
  deleteDocuments(documentIds: string[]): number {
    let deleted = 0;
    
    for (const docId of documentIds) {
      const toDelete: string[] = [];
      for (const [chunkId, chunk] of this.chunks) {
        if (chunk.documentId === docId) {
          toDelete.push(chunkId);
        }
      }
      
      for (const chunkId of toDelete) {
        this.chunks.delete(chunkId);
        this.bm25Index.documents.delete(chunkId);
        this.bm25Index.termFrequency.delete(chunkId);
        this.bm25Index.documentLengths.delete(chunkId);
        deleted++;
      }
    }
    
    return deleted;
  }

  /**
   * Get stats
   */
  getStats(): {
    totalDocuments: number;
    totalChunks: number;
    jurisdictions: string[];
    types: string[];
  } {
    const docs = new Set<string>();
    const jurisdictions = new Set<string>();
    const types = new Set<string>();
    
    for (const chunk of this.chunks.values()) {
      docs.add(chunk.documentId);
      if (chunk.metadata.jurisdiction) {
        jurisdictions.add(chunk.metadata.jurisdiction);
      }
      types.add(chunk.metadata.type);
    }
    
    return {
      totalDocuments: docs.size,
      totalChunks: this.chunks.size,
      jurisdictions: Array.from(jurisdictions),
      types: Array.from(types),
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RAGConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export singleton
export const ragPipeline = new RAGPipeline();

// Export class
export { RAGPipeline };
