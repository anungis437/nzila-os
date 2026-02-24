/**
 * Support Ticketing Schema
 * 
 * Database schemas for internal support ticket management
 * Used by Nzila Ventures operations team for customer support
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  integer,
  boolean,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// ENUMS
// ============================================================================

export const ticketStatusEnum = pgEnum('ticket_status', [
  'open',
  'in_progress',
  'waiting_customer',
  'waiting_internal',
  'resolved',
  'closed',
  'cancelled',
]);

export const ticketPriorityEnum = pgEnum('ticket_priority', [
  'low',
  'medium',
  'high',
  'urgent',
  'critical',
]);

export const ticketCategoryEnum = pgEnum('ticket_category', [
  'bug_report',
  'feature_request',
  'technical_support',
  'account_issue',
  'billing_question',
  'data_issue',
  'performance',
  'security_concern',
  'training_request',
  'other',
]);

export const ticketSourceEnum = pgEnum('ticket_source', [
  'email',
  'web_form',
  'phone',
  'chat',
  'internal',
  'api',
]);

// ============================================================================
// SUPPORT TICKETS TABLE
// ============================================================================

export const supportTickets = pgTable(
  'support_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketNumber: varchar('ticket_number', { length: 50 }).notNull().unique(),
    
    // Organization / Customer
    organizationId: uuid('organization_id').notNull(),
    organizationName: varchar('organization_name', { length: 255 }),
    
    // Requestor
    requestorUserId: text('requestor_user_id'),
    requestorEmail: varchar('requestor_email', { length: 255 }).notNull(),
    requestorName: varchar('requestor_name', { length: 255 }),
    
    // Ticket Details
    subject: varchar('subject', { length: 500 }).notNull(),
    description: text('description').notNull(),
    category: ticketCategoryEnum('category').notNull(),
    priority: ticketPriorityEnum('priority').notNull().default('medium'),
    status: ticketStatusEnum('status').notNull().default('open'),
    
    // Source & Channel
    source: ticketSourceEnum('source').notNull(),
    
    // Assignment
    assignedToUserId: text('assigned_to_user_id'),
    assignedToName: varchar('assigned_to_name', { length: 255 }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    
    // SLA Tracking
    slaResponseBy: timestamp('sla_response_by', { withTimezone: true }),
    slaResolveBy: timestamp('sla_resolve_by', { withTimezone: true }),
    firstResponseAt: timestamp('first_response_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    
    // SLA Breach Flags
    responseSlaBreach: boolean('response_sla_breach').default(false),
    resolutionSlaBreach: boolean('resolution_sla_breach').default(false),
    
    // Time Tracking
    responseTimeMinutes: integer('response_time_minutes'),
    resolutionTimeMinutes: integer('resolution_time_minutes'),
    
    // Tags & Labels
    tags: jsonb('tags').$type<string[]>().default(sql`'[]'::jsonb`),
    
    // Attachments
    attachments: jsonb('attachments').$type<Array<{
      url: string;
      filename: string;
      size: number;
      mimeType: string;
      uploadedAt: string;
    }>>().default(sql`'[]'::jsonb`),
    
    // Customer Satisfaction
    satisfactionRating: integer('satisfaction_rating'), // 1-5
    satisfactionComment: text('satisfaction_comment'),
    satisfactionRespondedAt: timestamp('satisfaction_responded_at', { withTimezone: true }),
    
    // Metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: jsonb('metadata').$type<Record<string, any>>().default(sql`'{}'::jsonb`),
    
    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    ticketNumberIdx: index('idx_support_tickets_number').on(table.ticketNumber),
    organizationIdx: index('idx_support_tickets_org').on(table.organizationId),
    statusIdx: index('idx_support_tickets_status').on(table.status),
    priorityIdx: index('idx_support_tickets_priority').on(table.priority),
    assignedToIdx: index('idx_support_tickets_assigned').on(table.assignedToUserId),
    categoryIdx: index('idx_support_tickets_category').on(table.category),
    createdAtIdx: index('idx_support_tickets_created').on(table.createdAt),
    slaResponseIdx: index('idx_support_tickets_sla_response').on(table.slaResponseBy),
    slaResolveIdx: index('idx_support_tickets_sla_resolve').on(table.slaResolveBy),
  })
);

// ============================================================================
// TICKET COMMENTS TABLE
// ============================================================================

export const ticketComments = pgTable(
  'ticket_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id').notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
    
    // Comment Details
    comment: text('comment').notNull(),
    isInternal: boolean('is_internal').default(false),
    isAutomated: boolean('is_automated').default(false),
    
    // Author
    authorUserId: text('author_user_id'),
    authorEmail: varchar('author_email', { length: 255 }),
    authorName: varchar('author_name', { length: 255 }),
    
    // Attachments
    attachments: jsonb('attachments').$type<Array<{
      url: string;
      filename: string;
      size: number;
      mimeType: string;
    }>>().default(sql`'[]'::jsonb`),
    
    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    ticketIdx: index('idx_ticket_comments_ticket').on(table.ticketId),
    createdAtIdx: index('idx_ticket_comments_created').on(table.createdAt),
  })
);

// ============================================================================
// TICKET HISTORY TABLE (Audit Trail)
// ============================================================================

export const ticketHistory = pgTable(
  'ticket_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id').notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
    
    // Change Details
    action: varchar('action', { length: 100 }).notNull(), // 'created', 'status_changed', 'assigned', 'priority_changed', etc.
    field: varchar('field', { length: 100 }),
    oldValue: text('old_value'),
    newValue: text('new_value'),
    
    // Actor
    changedByUserId: text('changed_by_user_id'),
    changedByName: varchar('changed_by_name', { length: 255 }),
    
    // Metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: jsonb('metadata').$type<Record<string, any>>().default(sql`'{}'::jsonb`),
    
    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    ticketIdx: index('idx_ticket_history_ticket').on(table.ticketId),
    createdAtIdx: index('idx_ticket_history_created').on(table.createdAt),
    actionIdx: index('idx_ticket_history_action').on(table.action),
  })
);

// ============================================================================
// SLA POLICIES TABLE
// ============================================================================

export const slaPolices = pgTable(
  'sla_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    
    // Policy Details
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').default(true),
    isDefault: boolean('is_default').default(false),
    
    // Conditions (when to apply this SLA)
    priority: ticketPriorityEnum('priority'),
    category: ticketCategoryEnum('category'),
    organizationTier: varchar('organization_tier', { length: 50 }), // 'free', 'starter', 'professional', 'enterprise'
    
    // SLA Targets (in minutes)
    responseTimeMinutes: integer('response_time_minutes').notNull(),
    resolutionTimeMinutes: integer('resolution_time_minutes').notNull(),
    
    // Business Hours
    businessHoursOnly: boolean('business_hours_only').default(true),
    timezone: varchar('timezone', { length: 100 }).default('UTC'),
    
    // Escalation
    escalationEnabled: boolean('escalation_enabled').default(false),
    escalationThresholdMinutes: integer('escalation_threshold_minutes'),
    escalationToUserId: text('escalation_to_user_id'),
    
    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: text('created_by'),
  },
  (table) => ({
    nameIdx: index('idx_sla_policies_name').on(table.name),
    priorityIdx: index('idx_sla_policies_priority').on(table.priority),
    activeIdx: index('idx_sla_policies_active').on(table.isActive),
  })
);

// ============================================================================
// KNOWLEDGE BASE ARTICLES TABLE
// ============================================================================

export const knowledgeBaseArticles = pgTable(
  'knowledge_base_articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    
    // Article Details
    title: varchar('title', { length: 500 }).notNull(),
    slug: varchar('slug', { length: 500 }).notNull().unique(),
    summary: text('summary'),
    content: text('content').notNull(),
    
    // Organization
    category: varchar('category', { length: 100 }).notNull(),
    subcategory: varchar('subcategory', { length: 100 }),
    tags: jsonb('tags').$type<string[]>().default(sql`'[]'::jsonb`),
    
    // Status
    status: varchar('status', { length: 50 }).notNull().default('draft'), // 'draft', 'published', 'archived'
    visibility: varchar('visibility', { length: 50 }).notNull().default('public'), // 'public', 'internal', 'private'
    
    // Metrics
    viewCount: integer('view_count').default(0),
    helpfulCount: integer('helpful_count').default(0),
    notHelpfulCount: integer('not_helpful_count').default(0),
    
    // SEO
    metaDescription: text('meta_description'),
    metaKeywords: jsonb('meta_keywords').$type<string[]>().default(sql`'[]'::jsonb`),
    
    // Version Control
    version: integer('version').default(1),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    
    // Author
    authorUserId: text('author_user_id'),
    authorName: varchar('author_name', { length: 255 }),
    
    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    slugIdx: index('idx_kb_articles_slug').on(table.slug),
    categoryIdx: index('idx_kb_articles_category').on(table.category),
    statusIdx: index('idx_kb_articles_status').on(table.status),
    publishedAtIdx: index('idx_kb_articles_published').on(table.publishedAt),
  })
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type SupportTicket = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$inferInsert;
export type TicketComment = typeof ticketComments.$inferSelect;
export type NewTicketComment = typeof ticketComments.$inferInsert;
export type TicketHistory = typeof ticketHistory.$inferSelect;
export type NewTicketHistory = typeof ticketHistory.$inferInsert;
export type SLAPolicy = typeof slaPolices.$inferSelect;
export type NewSLAPolicy = typeof slaPolices.$inferInsert;
export type KnowledgeBaseArticle = typeof knowledgeBaseArticles.$inferSelect;
export type NewKnowledgeBaseArticle = typeof knowledgeBaseArticles.$inferInsert;
