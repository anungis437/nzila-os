/**
 * Documents Schema
 * Database schema for general document management with folder support
 */
import { pgTable, text, integer, timestamp, uuid, boolean, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from '../schema-organizations';
import { claims } from './claims-schema';

// Document Folders Table
export const documentFolders = pgTable('document_folders', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  parentFolderId: uuid('parent_folder_id'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// Documents Table
export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  folderId: uuid('folder_id').references(() => documentFolders.id),
  
  // File information
  name: text('name').notNull(),
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size'),
  fileType: text('file_type').notNull(),
  mimeType: text('mime_type'),
  
  // Metadata
  description: text('description'),
  tags: text('tags').array(),
  category: text('category'),
  contentText: text('content_text'), // Extracted text content for search
  
  // Upload information
  uploadedBy: text('uploaded_by').notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
  
  // Status and access
  isConfidential: boolean('is_confidential').default(false),
  accessLevel: text('access_level').default('standard'),
  
  // Integrity verification
  checksum: text('checksum'), // SHA-256 hex digest of file content
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
  
  // Additional metadata
  metadata: jsonb('metadata').default({}),
}, (table) => [
  index('idx_documents_org').on(table.organizationId),
  index('idx_documents_folder').on(table.folderId),
  index('idx_documents_uploaded_by').on(table.uploadedBy),
  index('idx_documents_category').on(table.category),
  index('idx_documents_created').on(table.createdAt),
  index('idx_documents_deleted_at').on(table.deletedAt),
]);

// Case-Document Join Table — links documents to claims with FK enforcement
export const caseDocuments = pgTable('case_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  claimId: uuid('claim_id').notNull().references(() => claims.claimId, { onDelete: 'cascade' }),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  linkedBy: text('linked_by').notNull(),
  linkedAt: timestamp('linked_at', { withTimezone: true }).defaultNow().notNull(),
  linkType: text('link_type').default('attachment'), // 'attachment' | 'evidence' | 'correspondence' | 'settlement'
  notes: text('notes'),
  isImmutable: boolean('is_immutable').default(false), // Once true, prevents DELETE/UPDATE
}, (table) => [
  uniqueIndex('idx_case_documents_unique').on(table.claimId, table.documentId),
  index('idx_case_documents_claim').on(table.claimId),
  index('idx_case_documents_document').on(table.documentId),
  index('idx_case_documents_org').on(table.organizationId),
]);

export type CaseDocument = typeof caseDocuments.$inferSelect;
export type NewCaseDocument = typeof caseDocuments.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentFolder = typeof documentFolders.$inferSelect;
export type NewDocumentFolder = typeof documentFolders.$inferInsert;


