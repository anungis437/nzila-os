/**
 * Cognition memory, reasoning session and copilot conversation schema
 *
 * Both relations are created by platform migration 0012 and protected by
 * scoped migration 0018. Application code must not issue DDL for them.
 */

import { pgTable, uuid, text, integer, jsonb, timestamp, index, varchar } from 'drizzle-orm/pg-core';

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

/**
 * Verified dependency evidence, separate from the exploratory propagation map. Created by platform migration 0085
 * (base columns) and 0086 (source_fingerprint, evidence_reference_type, evidence_document_id), protected by scoped
 * 0059. Application code (lib/knowledge-transfer/propagation/verified-dependency-store.ts) reaches this table
 * through raw SQL, like its ue_cognition_memory sibling above - this declaration exists so the table is
 * canonically declared for storage-authority/governance tooling, not as the runtime query path.
 */
export const ueVerifiedDependencyEvidence = pgTable('ue_verified_dependency_evidence', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  dependentNodeId: text('dependent_node_id').notNull(),
  dependsOnNodeId: text('depends_on_node_id').notNull(),
  processOrSystem: varchar('process_or_system', { length: 300 }).notNull(),
  responsibleAuthority: varchar('responsible_authority', { length: 300 }).notNull(),
  evidenceReference: varchar('evidence_reference', { length: 500 }).notNull(),
  evidenceReferenceType: varchar('evidence_reference_type', { length: 20 }).notNull().default('external_citation'),
  evidenceDocumentId: uuid('evidence_document_id'),
  sourceFingerprint: varchar('source_fingerprint', { length: 128 }),
  status: varchar('status', { length: 20 }).notNull().default('pending_review'),
  submittedBy: text('submitted_by').notNull(),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNotes: varchar('review_notes', { length: 1000 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('ue_verified_dependency_evidence_org_idx').on(table.organizationId, table.status),
  lookupIdx: index('ue_verified_dependency_evidence_lookup_idx').on(table.organizationId, table.dependentNodeId, table.dependsOnNodeId, table.status),
}));

/**
 * Durable, explicitly-authorized node identity/alias mapping (graph-identity.ts's resolveConceptLabel). Created by
 * platform migration 0086 and protected by scoped 0060, same helper as ue_verified_dependency_evidence above.
 * Application code (lib/knowledge-transfer/propagation/node-alias-store.ts) reaches this table through raw SQL -
 * this declaration exists so the table is canonically declared for storage-authority/governance tooling.
 */
export const ueGraphNodeAlias = pgTable('ue_graph_node_alias', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  aliasLabel: text('alias_label').notNull(),
  canonicalConceptLabel: text('canonical_concept_label').notNull(),
  reason: varchar('reason', { length: 500 }).notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  supersededBy: text('superseded_by'),
  supersededAt: timestamp('superseded_at', { withTimezone: true }),
}, (table) => ({
  orgIdx: index('ue_graph_node_alias_org_idx').on(table.organizationId),
}));
