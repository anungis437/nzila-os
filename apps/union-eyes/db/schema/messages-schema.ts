/**
 * Messages Schema
 * Real-time messaging system for member-staff communication
 */
import { pgTable, uuid, text, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core';

export const messageStatusEnum = pgEnum('message_status', ['sent', 'delivered', 'read']);
export const messageTypeEnum = pgEnum('message_type', ['text', 'file', 'system']);

// Message threads table
export const messageThreads = pgTable('message_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  subject: text('subject').notNull(),
  memberId: text('member_id').notNull(), // Clerk user ID
  staffId: text('staff_id'), // Clerk user ID of assigned staff
  organizationId: uuid('organization_id').notNull(),
  status: text('status').notNull().default('open'), // open, resolved, closed
  priority: text('priority').default('normal'), // low, normal, high, urgent
  category: text('category'), // general, grievance, dues, benefits, etc.
  isArchived: boolean('is_archived').default(false),
  lastMessageAt: timestamp('last_message_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Individual messages table
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id').notNull().references(() => messageThreads.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull(), // Clerk user ID
  senderRole: text('sender_role').notNull(), // member, staff, admin, system
  messageType: messageTypeEnum('message_type').notNull().default('text'),
  content: text('content'), // Message text content
  fileUrl: text('file_url'), // For file attachments
  fileName: text('file_name'),
  fileSize: text('file_size'),
  status: messageStatusEnum('status').notNull().default('sent'),
  readAt: timestamp('read_at'),
  isEdited: boolean('is_edited').default(false),
  editedAt: timestamp('edited_at'),
  metadata: text('metadata'), // JSON string for additional data
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Message read receipts table
export const messageReadReceipts = pgTable('message_read_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(), // Clerk user ID
  readAt: timestamp('read_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Message participants table (for group conversations future support)
export const messageParticipants = pgTable('message_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id').notNull().references(() => messageThreads.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(), // Clerk user ID
  role: text('role').notNull(), // member, staff, admin
  isActive: boolean('is_active').default(true),
  lastReadAt: timestamp('last_read_at'),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  leftAt: timestamp('left_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Message notifications table
export const messageNotifications = pgTable('message_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(), // Clerk user ID
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  threadId: uuid('thread_id').notNull().references(() => messageThreads.id, { onDelete: 'cascade' }),
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at'),
  notifiedAt: timestamp('notified_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

