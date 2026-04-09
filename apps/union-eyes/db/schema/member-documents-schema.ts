/**
 * Member Documents Schema
 * Database schema for member-uploaded documents
 */
import { pgTable, text, integer, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { organizations } from '../schema-organizations';

export const memberDocuments = pgTable('member_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size').notNull(),
  fileType: text('file_type').notNull(),
  category: text('category').default('General'),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_member_documents_org').on(table.organizationId),
  index('idx_member_documents_user').on(table.userId),
]);

export type MemberDocument = typeof memberDocuments.$inferSelect;
export type NewMemberDocument = typeof memberDocuments.$inferInsert;

