/**
 * Cognition memory, reasoning session and copilot conversation schema
 *
 * Both relations are created by platform migration 0012 and protected by
 * scoped migration 0018. Application code must not issue DDL for them.
 */

import { pgTable, uuid, text, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';

export const ueCognitionMemory = pgTable('ue_cognition_memory', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  memoryType: text('memory_type').notNull(),
  title: text('title').notNull(),
  contextSummary: text('context_summary').notNull().default(''),
  payload: jsonb('payload').notNull().default({}),
  resilienceScoreAtCapture: integer('resilience_score_at_capture'),
  tags: jsonb('tags').notNull().default([]),
  keyInsights: jsonb('key_insights').notNull().default([]),
  sessionId: text('session_id'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('ue_cognition_memory_org_idx').on(table.organizationId, table.createdAt),
}));

export const ueReasoningSessions = pgTable('ue_reasoning_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  title: text('title').notNull(),
  focus: text('focus').notNull().default('general_continuity'),
  status: text('status').notNull().default('active'),
  contextDescription: text('context_description').notNull().default(''),
  graphState: jsonb('graph_state'),
  activeSimulations: jsonb('active_simulations').notNull().default([]),
  annotations: jsonb('annotations').notNull().default([]),
  linkedMessageIds: jsonb('linked_message_ids').notNull().default([]),
  linkedMemoryIds: jsonb('linked_memory_ids').notNull().default([]),
  latestResilienceScore: integer('latest_resilience_score'),
  // The principal that opened the session; null for rows that predate the column (platform migration 0043).
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('ue_reasoning_sessions_org_idx').on(table.organizationId, table.createdAt),
}));

export const ueCopilotConversations = pgTable('ue_copilot_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  sessionId: text('session_id'),
  title: text('title').notNull().default('Continuity Conversation'),
  messages: jsonb('messages').notNull().default([]),
  contextSnapshot: jsonb('context_snapshot'),
  // The principal that opened the conversation; null for rows that predate the column (platform migration 0043).
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('ue_copilot_conversations_org_idx').on(table.organizationId, table.createdAt),
}));
