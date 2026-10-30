/**
 * Organizational Rights Cognition Service
 *
 * Governance-safe Q&A and organizational memory retrieval for union rights,
 * collective agreement interpretation, and stewardship continuity support.
 * Uses retrieval-augmented generation bounded to the organization knowledge base.
 *
 * Multi-provider substrate: OpenAI, Anthropic, Google — routed via @nzila/ai-sdk.
 * Vector search with pgvector for organizational memory proximity.
 *
 * All outputs are interpretive and advisory. Human stewardship is preserved at all times.
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
import { buildOrgAiTrace, getAiClient, UE_APP_KEY, UE_PROFILES, UE_SYSTEM_ORG_ID } from '@/lib/ai/ai-client';
import { checkRateLimit } from '@/lib/rate-limiter';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { performAuditedOperation } from '@/lib/audit/operation-audit';
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
  organizationId?: string,
  _options?: { temperature?: number; maxTokens?: number; model?: string },
): Promise<{ content: string; tokensUsed: number; model: string }> {
  const ai = getAiClient();
  const input = messages.map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content }));
  const response = await ai.generate({
    orgId: UE_SYSTEM_ORG_ID,
    trace: buildOrgAiTrace(organizationId),
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

async function aiEmbed(text: string, organizationId?: string): Promise<number[]> {
  // Check cache first
  const cachedEmbedding = await embeddingCache.getCachedEmbedding(text, 'ai-sdk');
  if (cachedEmbedding) {
    logger?.debug('Using cached embedding (chatbot)', { textLength: text.length });
    return cachedEmbedding;
  }

  const ai = getAiClient();
  const response = await ai.embed({
    orgId: UE_SYSTEM_ORG_ID,
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
    // The session and its audit record commit together
    return withRLSContext({ organizationId: data.organizationId }, async (tx) => {
      const session = await tx
        .insert(chatSessions)
        .values({
          userId: data.userId,
          organizationId: data.organizationId,
          title: data.title || "New conversation",
          aiProvider: (data.aiProvider as (typeof chatSessions.aiProvider)['_']['data']) || "openai",
          model: data.model || "gpt-4",
          contextTags: data.contextTags,
          relatedEntityType: data.relatedEntityType,
          relatedEntityId: data.relatedEntityId,
        })
        .returning();

      await persistAtomicAudit(tx, {
        organizationId: data.organizationId,
        userId: data.userId,
        action: 'chatbot.session.create',
        resourceType: 'chat_sessions',
        resourceId: session[0].id,
        details: { relatedEntityType: data.relatedEntityType ?? null },
      });

      return session[0];
    });
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
      organizationId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<ChatSession[]> {
    const conditions = [eq(chatSessions.userId, userId)];
    if (options.organizationId) {
      conditions.push(eq(chatSessions.organizationId, options.organizationId));
    }
    if (options.status) {
      conditions.push(eq(chatSessions.status, options.status as (typeof chatSessions.status)['_']['data']));
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
  async updateSessionTitle(sessionId: string, organizationId: string, title: string): Promise<void> {
    await db
      .update(chatSessions)
      .set({ title, updatedAt: new Date() })
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.organizationId, organizationId)));
  }
  
  /**
   * Archive session
   */
  async archiveSession(sessionId: string, organizationId: string): Promise<void> {
    await db
      .update(chatSessions)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.organizationId, organizationId)));
  }
  
  /**
   * Delete session
   */
  async deleteSession(sessionId: string, organizationId: string): Promise<void> {
    await db
      .update(chatSessions)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.organizationId, organizationId)));
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
      documentType: data.documentType as (typeof knowledgeBase.documentType)['_']['data'],
      embedding: JSON.stringify(embedding) as unknown as (typeof knowledgeBase.$inferInsert)['embedding'],
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
  async incrementCitationCount(documentId: string, organizationId: string, exec: typeof db = db): Promise<void> {
    await exec
      .update(knowledgeBase)
      .set({
        citationCount: sql`${knowledgeBase.citationCount} + 1`,
        lastUsedAt: new Date(),
      })
      .where(and(eq(knowledgeBase.id, documentId), eq(knowledgeBase.organizationId, organizationId)));
  }
}

/**
 * NZ-RISK-026: Rate limit and response cap for chatbot
 * Prevents CBA knowledge extraction via rapid, bulk querying.
 */
const CHATBOT_RATE_LIMIT = { limit: 30, window: 60, identifier: 'chatbot' } as const;
const MAX_RESPONSE_LENGTH = 4_000; // characters — prevents full CBA clause dumps

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
    organizationId: string;
    content: string;
    useRAG?: boolean;
  }): Promise<ChatMessage> {
    const startTime = Date.now();

    // NZ-RISK-026: Per-user rate limiting to prevent bulk extraction
    const rl = await checkRateLimit(data.userId, CHATBOT_RATE_LIMIT);
    if (!rl.allowed) {
      throw new Error(
        `Rate limit exceeded — try again in ${rl.resetIn}s (${rl.remaining}/${rl.limit} remaining)`,
      );
    }
    
    // Get session
    const session = await this.sessionManager.getSession(data.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    // A chat session belongs to exactly one user within one organization —
    // never trust a client-supplied sessionId without verifying both.
    if (session.userId !== data.userId || session.organizationId !== data.organizationId) {
      throw new Error("Session not found");
    }
    
    // Everything that leaves the database — the moderation call, the retrieval and the AI provider call — cannot share
    // its transaction, so the intent is recorded first and none of it runs if that record cannot be written.
    const { response, retrievedDocs, responseTime } = await performAuditedOperation(
      {
        organizationId: data.organizationId,
        userId: data.userId,
        action: 'chatbot.message.respond',
        resourceType: 'chat_sessions',
        resourceId: data.sessionId,
        details: { useRAG: data.useRAG !== false },
      },
      async () => {
        // Safety filter on input
        const safetyCheck = await this.checkContentSafety(data.content, data.sessionId, {
          organizationId: data.organizationId,
          userId: data.userId,
        });
        if (safetyCheck.flagged) {
          // Never send unmoderated member text to retrieval or a model when the
          // safety dependency is absent, malformed or unavailable.
          if (safetyCheck.reason === 'Safety system unavailable') {
            throw new Error('Content safety system unavailable');
          }
          throw new Error('Message flagged by content safety filter');
        }

        // Conversation history: what was said before, then this message (stored with the reply below)
        const history = await db
          .select()
          .from(chatMessages)
          .where(eq(chatMessages.sessionId, data.sessionId))
          .orderBy(desc(chatMessages.createdAt))
          .limit(9);

        const conversationMessages = history.reverse().map((m) => ({
          role: m.role,
          content: m.content,
        }));
        conversationMessages.push({ role: "user", content: data.content });

        // Perform RAG if enabled
        let docs: Array<{ documentId: string; title: string; relevanceScore: number; excerpt: string }> = [];
        if (data.useRAG !== false) {
          try {
            docs = await this.ragService.searchDocuments(data.content, {
              organizationId: session.organizationId,
              limit: 3,
            });
          } catch (ragError) {
            logger?.warn('[ChatbotService] RAG search failed — proceeding without context', {
              error: ragError instanceof Error ? ragError.message : String(ragError),
              sessionId: data.sessionId,
            });
          }

          // Add context to conversation
          if (docs.length > 0) {
            const context = docs
              .map((doc) => `[${doc.title}]: ${doc.excerpt}`)
              .join("\n\n");

            conversationMessages.unshift({
              role: "system",
              content: `You are a helpful union rights assistant. Use the following context to answer questions:\n\n${context}`,
            });
          }
        }

        // Get AI response
        let generated: { content: string; tokensUsed: number; model: string };
        try {
          generated = await aiGenerate(conversationMessages, session.organizationId, {
            temperature: parseFloat(session.temperature || "0.7"),
            model: session.model,
          });
        } catch (aiError) {
          logger?.error('[ChatbotService] AI generation failed — returning fallback response', {
            error: aiError instanceof Error ? aiError.message : String(aiError),
            sessionId: data.sessionId,
          });
          generated = {
            content:
              "I'm sorry, the AI assistant is temporarily unavailable. " +
              "Please try again in a few moments. If the issue persists, " +
              "contact your union representative for assistance.",
            tokensUsed: 0,
            model: 'fallback',
          };
        }

        // NZ-RISK-026: Cap response length to prevent full CBA clause extraction
        if (generated.content.length > MAX_RESPONSE_LENGTH) {
          generated.content =
            generated.content.slice(0, MAX_RESPONSE_LENGTH) +
            '\n\n[Response truncated — ask a more specific question for detailed information.]';
        }

        return { response: generated, retrievedDocs: docs, responseTime: Date.now() - startTime };
      },
    );

    // The user message, the reply, the session counters, the citation counts and the audit record commit together
    const assistantMessage = await withRLSContext({ organizationId: data.organizationId }, async (tx) => {
      await tx.insert(chatMessages).values({
        sessionId: data.sessionId,
        role: "user",
        content: data.content,
      });

      const [reply] = await tx
        .insert(chatMessages)
        .values({
          sessionId: data.sessionId,
          role: "assistant",
          content: response.content,
          modelUsed: response.model,
          tokensUsed: response.tokensUsed,
          responseTimeMs: responseTime,
          retrievedDocuments: retrievedDocs.length > 0 ? (retrievedDocs as (typeof chatMessages.$inferInsert)['retrievedDocuments']) : undefined,
        })
        .returning();

      // Update session, only the session's own owner within its own organization
      await tx
        .update(chatSessions)
        .set({
          messageCount: sql`${chatSessions.messageCount} + 2`,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(chatSessions.id, data.sessionId),
            eq(chatSessions.userId, data.userId),
            eq(chatSessions.organizationId, data.organizationId),
          ),
        );

      // Update citation counts
      for (const doc of retrievedDocs) {
        await this.ragService.incrementCitationCount(doc.documentId, data.organizationId, tx);
      }

      await persistAtomicAudit(tx, {
        organizationId: data.organizationId,
        userId: data.userId,
        action: 'chatbot.message.exchange',
        resourceType: 'chat_sessions',
        resourceId: data.sessionId,
        details: { model: response.model, retrievedDocumentCount: retrievedDocs.length },
      });

      return reply;
    });

    return assistantMessage;
  }
  
  /**
   * Get conversation messages
   */
  async getMessages(
    sessionId: string,
    owner: { userId: string; organizationId: string },
    options: { limit?: number; offset?: number } = {}
  ): Promise<ChatMessage[]> {
    // A chat session belongs to exactly one user within one organization —
    // never trust a client-supplied sessionId without verifying both.
    const session = await this.sessionManager.getSession(sessionId);
    if (!session || session.userId !== owner.userId || session.organizationId !== owner.organizationId) {
      throw new Error("Session not found");
    }

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
  private async checkContentSafety(
    content: string,
    sessionId: string | undefined,
    actor: { organizationId: string; userId: string },
  ): Promise<{
    flagged: boolean;
    categories?: string[];
    reason?: string;
  }> {
    // Implement content moderation using OpenAI Moderation API
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { flagged: true, reason: 'Safety system unavailable' };
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
      
      if (!response.ok) throw new Error('Moderation provider unavailable');
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || !('results' in data) ||
          !Array.isArray(data.results) || !data.results[0] ||
          typeof data.results[0] !== 'object' ||
          typeof data.results[0].flagged !== 'boolean' ||
          !data.results[0].categories || typeof data.results[0].categories !== 'object' ||
          !data.results[0].category_scores || typeof data.results[0].category_scores !== 'object') {
        throw new Error('Invalid moderation provider response');
      }
      const result = data.results[0] as {
        flagged: boolean;
        categories: Record<string, boolean>;
        category_scores: Record<string, number>;
      };

      if (result.flagged) {
        const flaggedCategories = Object.entries(result.categories)
          .filter(([_, flagged]) => flagged)
          .map(([category]) => category);
        
        // The flagged record and its audit record commit together
        await withRLSContext({ organizationId: actor.organizationId }, async (tx) => {
          await tx.insert(aiSafetyFilters).values({
            input: content,
            flagged: true,
            flaggedCategories,
            confidenceScores: result.category_scores,
            action: "block",
            reason: "Content policy violation",
            // round 54: preserve session linkage so flagged rows are traceable to a tenant/session
            sessionId,
          });
          await persistAtomicAudit(tx, {
            organizationId: actor.organizationId,
            userId: actor.userId,
            action: 'chatbot.safety_filter.flag',
            resourceType: 'chat_sessions',
            resourceId: sessionId,
            details: { categories: flaggedCategories },
          });
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

