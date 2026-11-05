/**
 * Communication Integration Schema
 * 
 * Database schema for external communication platform data.
 * Supports Slack, Microsoft Teams, and other communication systems.
 * 
 * Tables:
 * - external_communication_channels: Channels, teams, or conversation groups
 * - external_communication_messages: Messages, conversations, and threads  
 * - external_communication_users: User profiles from communication platforms
 * - external_communication_files: Files shared in communication platforms
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from '../../../schema-organizations';

// ============================================================================
// External Communication Channels
// ============================================================================
/**
 * Communication Channels/Teams
 * Stores channels, teams, or conversation groups from communication platforms
 */
export const externalCommunicationChannels = pgTable(
  'external_communication_channels',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    externalProvider: varchar('external_provider', { length: 50 }).notNull(),
    externalId: varchar('external_id', { length: 255 }).notNull(),
    channelName: varchar('channel_name', { length: 255 }).notNull(),
    channelType: varchar('channel_type', { length: 50 }), // public, private, team, standard, shared
    isArchived: boolean('is_archived').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    creatorId: varchar('creator_id', { length: 255 }), // External user ID
    memberCount: integer('member_count').default(0),
    topic: text('topic'),
    description: text('description'),
    parentChannelId: varchar('parent_channel_id', { length: 255 }), // For Teams channels under a team
    lastSyncedAt: timestamp('last_synced_at').notNull().defaultNow(),
  },
  (table) => ({
    uniqueChannel: unique('unique_comm_channel').on(
      table.orgId,
      table.externalProvider,
      table.externalId
    ),
    orgIdIdx: index('comm_channels_org_id_idx').on(table.orgId),
    providerIdx: index('comm_channels_provider_idx').on(table.externalProvider),
    externalIdIdx: index('comm_channels_external_id_idx').on(table.externalId),
    channelTypeIdx: index('comm_channels_type_idx').on(table.channelType),
    archivedIdx: index('comm_channels_archived_idx').on(table.isArchived),
    lastSyncIdx: index('comm_channels_last_sync_idx').on(table.lastSyncedAt),
  })
);

// ============================================================================
// External Communication Messages
// ============================================================================
/**
 * Communication Messages
 * Stores messages, conversations, and threads from communication platforms
 */
export const externalCommunicationMessages = pgTable(
  'external_communication_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    externalProvider: varchar('external_provider', { length: 50 }).notNull(),
    externalId: varchar('external_id', { length: 255 }).notNull(),
    channelId: uuid('channel_id').references(() => externalCommunicationChannels.id, {
      onDelete: 'cascade',
    }),
    userId: varchar('user_id', { length: 255 }), // External user ID
    messageText: text('message_text'),
    messageType: varchar('message_type', { length: 50 }), // message, systemEventMessage, etc.
    timestamp: timestamp('timestamp').notNull(),
    threadId: varchar('thread_id', { length: 255 }), // For threaded conversations
    replyCount: integer('reply_count').default(0),
    reactionCount: integer('reaction_count').default(0),
    editedAt: timestamp('edited_at'),
    deletedAt: timestamp('deleted_at'),
    lastSyncedAt: timestamp('last_synced_at').notNull().defaultNow(),
  },
  (table) => ({
    uniqueMessage: unique('unique_comm_message').on(
      table.orgId,
      table.externalProvider,
      table.externalId
    ),
    orgIdIdx: index('comm_messages_org_id_idx').on(table.orgId),
    providerIdx: index('comm_messages_provider_idx').on(table.externalProvider),
    channelIdIdx: index('comm_messages_channel_id_idx').on(table.channelId),
    userIdIdx: index('comm_messages_user_id_idx').on(table.userId),
    timestampIdx: index('comm_messages_timestamp_idx').on(table.timestamp),
    threadIdIdx: index('comm_messages_thread_id_idx').on(table.threadId),
    lastSyncIdx: index('comm_messages_last_sync_idx').on(table.lastSyncedAt),
  })
);

// ============================================================================
// External Communication Users
// ============================================================================
/**
 * Communication Users
 * Stores user profiles from communication platforms
 */
export const externalCommunicationUsers = pgTable(
  'external_communication_users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    externalProvider: varchar('external_provider', { length: 50 }).notNull(),
    externalId: varchar('external_id', { length: 255 }).notNull(),
    username: varchar('username', { length: 255 }),
    displayName: varchar('display_name', { length: 255 }),
    email: varchar('email', { length: 255 }),
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    title: varchar('title', { length: 255 }),
    avatarUrl: text('avatar_url'),
    isBot: boolean('is_bot').default(false),
    isAdmin: boolean('is_admin').default(false),
    isDeleted: boolean('is_deleted').default(false),
    statusText: varchar('status_text', { length: 255 }),
    statusEmoji: varchar('status_emoji', { length: 50 }),
    lastSyncedAt: timestamp('last_synced_at').notNull().defaultNow(),
  },
  (table) => ({
    uniqueUser: unique('unique_comm_user').on(
      table.orgId,
      table.externalProvider,
      table.externalId
    ),
    orgIdIdx: index('comm_users_org_id_idx').on(table.orgId),
    providerIdx: index('comm_users_provider_idx').on(table.externalProvider),
    externalIdIdx: index('comm_users_external_id_idx').on(table.externalId),
    emailIdx: index('comm_users_email_idx').on(table.email),
    usernameIdx: index('comm_users_username_idx').on(table.username),
    isBotIdx: index('comm_users_is_bot_idx').on(table.isBot),
    lastSyncIdx: index('comm_users_last_sync_idx').on(table.lastSyncedAt),
  })
);

// ============================================================================
// External Communication Files
// ============================================================================
/**
 * Communication Files
 * Stores files shared in communication platforms
 */
export const externalCommunicationFiles = pgTable(
  'external_communication_files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    externalProvider: varchar('external_provider', { length: 50 }).notNull(),
    externalId: varchar('external_id', { length: 255 }).notNull(),
    channelId: uuid('channel_id').references(() => externalCommunicationChannels.id, {
      onDelete: 'set null',
    }),
    userId: varchar('user_id', { length: 255 }), // External user ID who uploaded
    fileName: varchar('file_name', { length: 500 }).notNull(),
    fileType: varchar('file_type', { length: 50 }),
    mimeType: varchar('mime_type', { length: 100 }),
    fileSize: integer('file_size'), // Size in bytes
    fileUrl: text('file_url'),
    downloadUrl: text('download_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    commentCount: integer('comment_count').default(0),
    lastSyncedAt: timestamp('last_synced_at').notNull().defaultNow(),
  },
  (table) => ({
    uniqueFile: unique('unique_comm_file').on(
      table.orgId,
      table.externalProvider,
      table.externalId
    ),
    orgIdIdx: index('comm_files_org_id_idx').on(table.orgId),
    providerIdx: index('comm_files_provider_idx').on(table.externalProvider),
    channelIdIdx: index('comm_files_channel_id_idx').on(table.channelId),
    userIdIdx: index('comm_files_user_id_idx').on(table.userId),
    fileTypeIdx: index('comm_files_file_type_idx').on(table.fileType),
    createdAtIdx: index('comm_files_created_at_idx').on(table.createdAt),
    lastSyncIdx: index('comm_files_last_sync_idx').on(table.lastSyncedAt),
  })
);

// ============================================================================
// Relations
// ============================================================================
export const externalCommunicationChannelsRelations = relations(
  externalCommunicationChannels,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [externalCommunicationChannels.orgId],
      references: [organizations.id],
    }),
    messages: many(externalCommunicationMessages),
    files: many(externalCommunicationFiles),
  })
);

export const externalCommunicationMessagesRelations = relations(
  externalCommunicationMessages,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [externalCommunicationMessages.orgId],
      references: [organizations.id],
    }),
    channel: one(externalCommunicationChannels, {
      fields: [externalCommunicationMessages.channelId],
      references: [externalCommunicationChannels.id],
    }),
  })
);

export const externalCommunicationUsersRelations = relations(
  externalCommunicationUsers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [externalCommunicationUsers.orgId],
      references: [organizations.id],
    }),
  })
);

export const externalCommunicationFilesRelations = relations(
  externalCommunicationFiles,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [externalCommunicationFiles.orgId],
      references: [organizations.id],
    }),
    channel: one(externalCommunicationChannels, {
      fields: [externalCommunicationFiles.channelId],
      references: [externalCommunicationChannels.id],
    }),
  })
);
