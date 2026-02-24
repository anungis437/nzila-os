/**
 * AI Chatbot Schema
 * 
 * Union rights Q&A bot with document analysis
 * RAG (Retrieval-Augmented Generation) support
 * Multi-provider AI (OpenAI, Anthropic, Google)
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  pgEnum,
  index,
  integer,
  vector,
  decimal,
  date,
  interval,
} from "drizzle-orm/pg-core";
import { organizations } from "../../../schema-organizations";
import { profiles } from "../../profiles-schema";
import { users } from "../member/user-management";

// Chat session status enum
export const chatSessionStatusEnum = pgEnum("chat_session_status", [
  "active",
  "archived",
  "deleted",
]);

// Message role enum
export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
  "function",
]);

// AI provider enum
export const aiProviderEnum = pgEnum("ai_provider", [
  "openai",
  "anthropic",
  "google",
  "internal",
]);

// Document type for RAG
export const knowledgeDocumentTypeEnum = pgEnum("knowledge_document_type", [
  "collective_agreement",
  "union_policy",
  "labor_law",
  "precedent",
  "faq",
  "guide",
  "other",
]);

/**
 * Chat Sessions
 * Conversation threads between users and AI chatbot
 */
export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Session details
    title: text("title").notNull(), // Auto-generated from first message
    status: chatSessionStatusEnum("status").notNull().default("active"),
    
    // Settings
    aiProvider: aiProviderEnum("ai_provider").notNull().default("openai"),
    model: text("model").notNull().default("gpt-4"), // gpt-4, claude-3-opus, gemini-pro
    temperature: text("temperature").default("0.7"),
    
    // Context
    contextTags: jsonb("context_tags").$type<string[]>(), // ["labor_rights", "grievance", etc.]
    relatedEntityType: text("related_entity_type"), // claim, member, cba, etc.
    relatedEntityId: text("related_entity_id"),
    
    // Statistics
    messageCount: integer("message_count").notNull().default(0),
    lastMessageAt: timestamp("last_message_at"),
    
    // Feedback
    helpful: boolean("helpful"),
    feedbackComment: text("feedback_comment"),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("chat_sessions_user_id_idx").on(table.userId),
    organizationIdIdx: index("chat_sessions_organization_id_idx").on(
      table.organizationId
    ),
    statusIdx: index("chat_sessions_status_idx").on(table.status),
    createdAtIdx: index("chat_sessions_created_at_idx").on(table.createdAt),
  })
);

/**
 * Chat Messages
 * Individual messages within chat sessions
 */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    
    // Message content
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    
    // AI response metadata
    modelUsed: text("model_used"),
    tokensUsed: integer("tokens_used"),
    responseTimeMs: integer("response_time_ms"),
    
    // RAG context
    retrievedDocuments: jsonb("retrieved_documents").$type<
      Array<{
        documentId: string;
        title: string;
        relevanceScore: number;
        excerpt: string;
      }>
    >(),
    
    // Citations
    citations: jsonb("citations").$type<
      Array<{
        text: string;
        source: string;
        url?: string;
      }>
    >(),
    
    // Function calling
    functionCalls: jsonb("function_calls").$type<
      Array<{
        name: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        arguments: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result: any;
      }>
    >(),
    
    // Feedback
    helpful: boolean("helpful"),
    feedbackReason: text("feedback_reason"),
    
    // Metadata
    metadata: jsonb("metadata").$type<{
      confidence?: number;
      alternativeResponses?: string[];
      flags?: string[];
    }>(),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    sessionIdIdx: index("chat_messages_session_id_idx").on(table.sessionId),
    roleIdx: index("chat_messages_role_idx").on(table.role),
    createdAtIdx: index("chat_messages_created_at_idx").on(table.createdAt),
  })
);

/**
 * Knowledge Base
 * Documents and content for RAG (Retrieval-Augmented Generation)
 */
export const knowledgeBase = pgTable(
  "knowledge_base",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Document details
    title: text("title").notNull(),
    documentType: knowledgeDocumentTypeEnum("document_type").notNull(),
    content: text("content").notNull(),
    summary: text("summary"),
    
    // Source
    sourceType: text("source_type").notNull(), // manual, cba, policy, law, etc.
    sourceId: text("source_id"), // Reference to original document
    sourceUrl: text("source_url"),
    
    // Embeddings for semantic search
    embedding: vector("embedding", { dimensions: 1536 }), // OpenAI ada-002
    embeddingModel: text("embedding_model").default("text-embedding-ada-002"),
    
    // Metadata
    tags: jsonb("tags").$type<string[]>(),
    keywords: jsonb("keywords").$type<string[]>(),
    language: text("language").notNull().default("en"),
    
    // Version control
    version: integer("version").notNull().default(1),
    previousVersionId: uuid("previous_version_id"),
    
    // Access control
    isPublic: boolean("is_public").notNull().default(false),
    allowedOrganizations: jsonb("allowed_organizations").$type<string[]>(),
    
    // Usage statistics
    viewCount: integer("view_count").notNull().default(0),
    citationCount: integer("citation_count").notNull().default(0),
    lastUsedAt: timestamp("last_used_at"),
    
    // Status
    isActive: boolean("is_active").notNull().default(true),
    
    createdBy: text("created_by")
      .notNull()
      .references(() => profiles.userId),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index("knowledge_base_organization_id_idx").on(
      table.organizationId
    ),
    documentTypeIdx: index("knowledge_base_document_type_idx").on(
      table.documentType
    ),
    embeddingIdx: index("knowledge_base_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
    isActiveIdx: index("knowledge_base_is_active_idx").on(table.isActive),
  })
);

/**
 * Chatbot Suggestions
 * Pre-defined suggestions and quick replies
 */
export const chatbotSuggestions = pgTable(
  "chatbot_suggestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Suggestion details
    category: text("category").notNull(), // grievance, rights, contract, etc.
    title: text("title").notNull(),
    prompt: text("prompt").notNull(), // What gets sent to AI
    description: text("description"),
    
    // Display
    icon: text("icon"),
    displayOrder: integer("display_order").notNull().default(0),
    
    // Context
    showInContexts: jsonb("show_in_contexts").$type<string[]>(), // When to show
    requiredTags: jsonb("required_tags").$type<string[]>(),
    
    // Statistics
    useCount: integer("use_count").notNull().default(0),
    
    // Status
    isActive: boolean("is_active").notNull().default(true),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index("chatbot_suggestions_organization_id_idx").on(
      table.organizationId
    ),
    categoryIdx: index("chatbot_suggestions_category_idx").on(table.category),
    isActiveIdx: index("chatbot_suggestions_is_active_idx").on(
      table.isActive
    ),
  })
);

/**
 * Chatbot Analytics
 * Track usage, performance, and user satisfaction
 */
export const chatbotAnalytics = pgTable(
  "chatbot_analytics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Time period
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    
    // Usage metrics
    totalSessions: integer("total_sessions").notNull().default(0),
    totalMessages: integer("total_messages").notNull().default(0),
    uniqueUsers: integer("unique_users").notNull().default(0),
    
    // Performance metrics
    avgResponseTimeMs: integer("avg_response_time_ms"),
    avgTokensPerMessage: integer("avg_tokens_per_message"),
    avgMessagesPerSession: integer("avg_messages_per_session"),
    
    // Satisfaction metrics
    helpfulResponses: integer("helpful_responses").notNull().default(0),
    unhelpfulResponses: integer("unhelpful_responses").notNull().default(0),
    satisfactionRate: text("satisfaction_rate"), // Percentage
    
    // Cost tracking
    totalTokensUsed: integer("total_tokens_used").notNull().default(0),
    estimatedCostUsd: text("estimated_cost_usd"),
    
    // Top topics
    topCategories: jsonb("top_categories").$type<
      Array<{ category: string; count: number }>
    >(),
    topQuestions: jsonb("top_questions").$type<
      Array<{ question: string; count: number }>
    >(),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index("chatbot_analytics_organization_id_idx").on(
      table.organizationId
    ),
    periodIdx: index("chatbot_analytics_period_idx").on(
      table.periodStart,
      table.periodEnd
    ),
  })
);

/**
 * AI Safety Filters
 * Content moderation and safety checks
 */
export const aiSafetyFilters = pgTable(
  "ai_safety_filters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Input/output
    input: text("input").notNull(),
    output: text("output"),
    
    // Detection
    flagged: boolean("flagged").notNull().default(false),
    flaggedCategories: jsonb("flagged_categories").$type<string[]>(),
    confidenceScores: jsonb("confidence_scores").$type<
      Record<string, number>
    >(),
    
    // Action taken
    action: text("action").notNull(), // allow, warn, block
    reason: text("reason"),
    
    // Context
    sessionId: uuid("session_id").references(() => chatSessions.id),
    messageId: uuid("message_id").references(() => chatMessages.id),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    flaggedIdx: index("ai_safety_filters_flagged_idx").on(table.flagged),
    actionIdx: index("ai_safety_filters_action_idx").on(table.action),
  })
);

/**
 * Phase 1: AI Cost Tracking & Rate Limiting
 * LLM Excellence Implementation
 */

// AI usage metrics - tracks all LLM API calls
export const aiUsageMetrics = pgTable(
  "ai_usage_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // 'openai' | 'anthropic' | 'google' | 'azure'
    model: text("model").notNull(),
    operation: text("operation").notNull(), // 'completion' | 'embedding' | 'moderation'
    tokensInput: integer("tokens_input").notNull().default(0),
    tokensOutput: integer("tokens_output").notNull().default(0),
    tokensTotal: integer("tokens_total").notNull().default(0),
    estimatedCost: decimal("estimated_cost", { precision: 10, scale: 6 }).notNull().default("0"),
    requestId: text("request_id"),
    userId: text("user_id").references(() => users.userId, { onDelete: "set null" }),
    sessionId: uuid("session_id"),
    latencyMs: integer("latency_ms"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    orgTimeIdx: index("idx_usage_org_time").on(table.organizationId, table.createdAt),
    providerTimeIdx: index("idx_usage_provider_time").on(table.provider, table.createdAt),
    modelIdx: index("idx_usage_model").on(table.model),
    userIdx: index("idx_usage_user").on(table.userId),
  })
);

// AI rate limits - per-organization rate limiting configuration
export const aiRateLimits = pgTable(
  "ai_rate_limits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    limitType: text("limit_type").notNull(), // 'requests_per_minute' | 'tokens_per_hour' | 'cost_per_day'
    limitValue: integer("limit_value").notNull(),
    currentValue: integer("current_value").default(0),
    windowStart: timestamp("window_start").defaultNow(),
    windowDuration: interval("window_duration").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    orgLimitIdx: index("idx_rate_limits_org").on(table.organizationId, table.limitType),
  })
);

// AI budgets - monthly budget allocations and spend tracking
export const aiBudgets = pgTable(
  "ai_budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    monthlyLimitUsd: decimal("monthly_limit_usd", { precision: 10, scale: 2 }).notNull(),
    currentSpendUsd: decimal("current_spend_usd", { precision: 10, scale: 2 }).default("0"),
    alertThreshold: decimal("alert_threshold", { precision: 3, scale: 2 }).default("0.80"),
    hardLimit: boolean("hard_limit").default(true),
    billingPeriodStart: date("billing_period_start").notNull(),
    billingPeriodEnd: date("billing_period_end").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    orgPeriodIdx: index("idx_budgets_org_period").on(table.organizationId, table.billingPeriodEnd),
  })
);

// Type exports
export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type KnowledgeBase = typeof knowledgeBase.$inferSelect;
export type NewKnowledgeBase = typeof knowledgeBase.$inferInsert;
export type ChatbotSuggestion = typeof chatbotSuggestions.$inferSelect;
export type NewChatbotSuggestion = typeof chatbotSuggestions.$inferInsert;
export type ChatbotAnalytics = typeof chatbotAnalytics.$inferSelect;
export type AISafetyFilter = typeof aiSafetyFilters.$inferSelect;
export type AIUsageMetric = typeof aiUsageMetrics.$inferSelect;
export type NewAIUsageMetric = typeof aiUsageMetrics.$inferInsert;
export type AIRateLimit = typeof aiRateLimits.$inferSelect;
export type NewAIRateLimit = typeof aiRateLimits.$inferInsert;
export type AIBudget = typeof aiBudgets.$inferSelect;
export type NewAIBudget = typeof aiBudgets.$inferInsert;

