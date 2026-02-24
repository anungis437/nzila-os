/**
 * AI Chatbot Service
 * 
 * Union rights Q&A bot with RAG (Retrieval-Augmented Generation)
 * Multi-provider support: OpenAI, Anthropic, Google
 * Vector search with pgvector
 */

import { db } from "@/db";
import {
  chatSessions,
  chatMessages,
  knowledgeBase,
  aiSafetyFilters,
  type ChatSession,
  type ChatMessage,
} from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { embeddingCache } from "@/lib/services/ai/embedding-cache";
import { logger } from "@/lib/logger";
import { getAiClient, UE_APP_KEY, UE_PROFILES } from '@/lib/ai/ai-client';
import type { ChatMessage as _AiChatMessage } from '@nzila/ai-sdk/types';

/**
 * AI SDK Provider Adapter
 *
 * INV-01: All AI calls routed through @nzila/ai-sdk — no direct provider
 * imports. The AI control plane handles provider selection, budget,
 * guardrails, and audit logging centrally.
 */
async function aiGenerate(
  messages: Array<{ role: string; content: string }>,
  _options?: { temperature?: number; maxTokens?: number; model?: string },
): Promise<{ content: string; tokensUsed: number; model: string }> {
  const ai = getAiClient();
  const input = messages.map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content }));
  const response = await ai.generate({
    entityId: 'system',
    appKey: UE_APP_KEY,
    profileKey: UE_PROFILES.CHATBOT,
    input,
    dataClass: 'internal',
  });
  return {
    content: response.content,
    tokensUsed: response.tokensIn + response.tokensOut,
    model: response.model,
  };
}

async function aiEmbed(text: string): Promise<number[]> {
  // Check cache first
  const cachedEmbedding = await embeddingCache.getCachedEmbedding(text, 'ai-sdk');
  if (cachedEmbedding) {
    logger?.debug('Using cached embedding (chatbot)', { textLength: text.length });
    return cachedEmbedding;
  }

  const ai = getAiClient();
  const response = await ai.embed({
    entityId: 'system',
    appKey: UE_APP_KEY,
    profileKey: UE_PROFILES.EMBEDDINGS,
    input: text,
    dataClass: 'internal',
  });
  const embedding = response.embeddings[0];

  // Cache non-blocking
  embeddingCache.setCachedEmbedding(text, 'ai-sdk', embedding).catch(err => {
    logger?.warn('Failed to cache embedding (chatbot)', { error: err.message });
  });
  return embedding;
}

/**
 * Chat Session Manager
 */
export class ChatSessionManager {
  /**
   * Create a new chat session
   */
  async createSession(data: {
    userId: string;
    organizationId: string;
    title?: string;
    aiProvider?: string;
    model?: string;
    contextTags?: string[];
    relatedEntityType?: string;
    relatedEntityId?: string;
  }): Promise<ChatSession> {
    const session = await db
      .insert(chatSessions)
      .values({
        userId: data.userId,
        organizationId: data.organizationId,
        title: data.title || "New conversation",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        aiProvider: (data.aiProvider as any) || "openai",
        model: data.model || "gpt-4",
        contextTags: data.contextTags,
        relatedEntityType: data.relatedEntityType,
        relatedEntityId: data.relatedEntityId,
      })
      .returning();
    
    return session[0];
  }
  
  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    const sessions = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId))
      .limit(1);
    
    return sessions[0] || null;
  }
  
  /**
   * Get user's sessions
   */
  async getUserSessions(
    userId: string,
    options: {
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<ChatSession[]> {
    const conditions = [eq(chatSessions.userId, userId)];
    if (options.status) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(eq(chatSessions.status, options.status as any));
    }

    const results = await db
      .select()
      .from(chatSessions)
      .where(and(...conditions))
      .orderBy(desc(chatSessions.lastMessageAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0);

    return results;
  }
  
  /**
   * Update session title (auto-generated from first message)
   */
  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    await db
      .update(chatSessions)
      .set({ title, updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));
  }
  
  /**
   * Archive session
   */
  async archiveSession(sessionId: string): Promise<void> {
    await db
      .update(chatSessions)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));
  }
  
  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await db
      .update(chatSessions)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));
  }
}

/**
 * RAG Service (Retrieval-Augmented Generation)
 */
export class RAGService {
  /**
   * Add document to knowledge base
   */
  async addDocument(data: {
    organizationId: string;
    title: string;
    documentType: string;
    content: string;
    summary?: string;
    sourceType: string;
    sourceId?: string;
    sourceUrl?: string;
    tags?: string[];
    keywords?: string[];
    language?: string;
    isPublic?: boolean;
    createdBy: string;
  }): Promise<void> {
    // Generate embedding for the document
    const embedding = await aiEmbed(data.content);
    
    await db.insert(knowledgeBase).values({
      ...data,
      organizationId: data.organizationId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      documentType: data.documentType as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      embedding: JSON.stringify(embedding) as any,
      embeddingModel: "text-embedding-ada-002",
    });
  }
  
  /**
   * Search knowledge base using semantic search
   */
  async searchDocuments(
    query: string,
    options: {
      organizationId?: string;
      documentTypes?: string[];
      limit?: number;
      similarityThreshold?: number;
    } = {}
  ): Promise<
    Array<{
      documentId: string;
      title: string;
      relevanceScore: number;
      excerpt: string;
    }>
  > {
    // Generate embedding for query
    const queryEmbedding = await aiEmbed(query);
    
    // Perform vector similarity search
    // Note: This is a simplified version. In production, use pgvector's <-> operator
    const results = await db
      .select({
        id: knowledgeBase.id,
        title: knowledgeBase.title,
        content: knowledgeBase.content,
        embedding: knowledgeBase.embedding,
      })
      .from(knowledgeBase)
      .where(
        and(
          eq(knowledgeBase.isActive, true),
          options.organizationId ? eq(knowledgeBase.organizationId, options.organizationId) : undefined
        )
      )
      .limit(options.limit || 5);
    
    // Calculate cosine similarity (simplified)
    const scored = results.map((doc) => {
      const docEmbedding = JSON.parse(doc.embedding as unknown as string);
      const similarity = cosineSimilarity(queryEmbedding, docEmbedding);
      
      return {
        documentId: doc.id,
        title: doc.title,
        relevanceScore: similarity,
        excerpt: doc.content.substring(0, 200) + "...",
      };
    });
    
    // Filter by threshold and sort
    return scored
      .filter((r) => r.relevanceScore >= (options.similarityThreshold || 0.7))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
  
  /**
   * Update document citation count
   */
  async incrementCitationCount(documentId: string): Promise<void> {
    await db
      .update(knowledgeBase)
      .set({
        citationCount: sql`${knowledgeBase.citationCount} + 1`,
        lastUsedAt: new Date(),
      })
      .where(eq(knowledgeBase.id, documentId));
  }
}

/**
 * Chatbot Service
 */
export class ChatbotService {
  private sessionManager = new ChatSessionManager();
  private ragService = new RAGService();
  
  /**
   * Send message and get AI response
   */
  async sendMessage(data: {
    sessionId: string;
    userId: string;
    content: string;
    useRAG?: boolean;
  }): Promise<ChatMessage> {
    const startTime = Date.now();
    
    // Get session
    const session = await this.sessionManager.getSession(data.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    
    // Safety filter on input
    const safetyCheck = await this.checkContentSafety(data.content);
    if (safetyCheck.flagged) {
      throw new Error("Message flagged by content safety filter");
    }
    
    // Save user message
    await db.insert(chatMessages).values({
      sessionId: data.sessionId,
      role: "user",
      content: data.content,
    });
    
    // Get conversation history
    const history = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, data.sessionId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(10);
    
    const conversationMessages = history.reverse().map((m) => ({
      role: m.role,
      content: m.content,
    }));
    
    // Perform RAG if enabled
    let retrievedDocs: Array<{ documentId: string; title: string; relevanceScore: number; excerpt: string }> = [];
    if (data.useRAG !== false) {
      retrievedDocs = await this.ragService.searchDocuments(data.content, {
        organizationId: session.organizationId,
        limit: 3,
      });
      
      // Add context to conversation
      if (retrievedDocs.length > 0) {
        const context = retrievedDocs
          .map((doc) => `[${doc.title}]: ${doc.excerpt}`)
          .join("\n\n");
        
        conversationMessages.unshift({
          role: "system",
          content: `You are a helpful union rights assistant. Use the following context to answer questions:\n\n${context}`,
        });
      }
    }
    
    // Get AI response
    const response = await aiGenerate(conversationMessages, {
      temperature: parseFloat(session.temperature || "0.7"),
      model: session.model,
    });
    
    const responseTime = Date.now() - startTime;
    
    // Save assistant message
    const [assistantMessage] = await db
      .insert(chatMessages)
      .values({
        sessionId: data.sessionId,
        role: "assistant",
        content: response.content,
        modelUsed: response.model,
        tokensUsed: response.tokensUsed,
        responseTimeMs: responseTime,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        retrievedDocuments: retrievedDocs.length > 0 ? retrievedDocs as any : undefined,
      })
      .returning();
    
    // Update session
    await db
      .update(chatSessions)
      .set({
        messageCount: sql`${chatSessions.messageCount} + 2`,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, data.sessionId));
    
    // Update citation counts
    for (const doc of retrievedDocs) {
      await this.ragService.incrementCitationCount(doc.documentId);
    }
    
    return assistantMessage;
  }
  
  /**
   * Get conversation messages
   */
  async getMessages(
    sessionId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<ChatMessage[]> {
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(options.limit || 100)
      .offset(options.offset || 0);

    return messages.reverse(); // Return in chronological order
  }
  
  /**
   * Content safety check
   */
  private async checkContentSafety(content: string): Promise<{
    flagged: boolean;
    categories?: string[];
    reason?: string;
  }> {
    // Implement content moderation using OpenAI Moderation API
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { flagged: false }; // Skip if not configured
    }
    
    try {
      const response = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ input: content }),
      });
      
      const data = await response.json();
      const result = data.results[0];
      
      if (result.flagged) {
        const flaggedCategories = Object.entries(result.categories)
          .filter(([_, flagged]) => flagged)
          .map(([category]) => category);
        
        await db.insert(aiSafetyFilters).values({
          input: content,
          flagged: true,
          flaggedCategories,
          confidenceScores: result.category_scores,
          action: "block",
          reason: "Content policy violation",
        });
        
        return { flagged: true, categories: flaggedCategories };
      }
      
      return { flagged: false };
    } catch (_error) {
      // SECURITY FIX: Fail closed - content safety system errors should reject content
      // Log the error for monitoring but treat as unsafe content
return { flagged: true, reason: 'Safety system unavailable' }; // Fail closed
    }
  }
}

/**
 * Helper: Cosine similarity
 */
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  
  return dotProduct / (magnitudeA * magnitudeB);
}

