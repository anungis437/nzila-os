/**
 * Documents Schema
 * Database schema for general document management with folder support
 */
import { pgTable, text, integer, timestamp, uuid, boolean, jsonb, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { organizations } from '../schema-organizations';
import { claims } from './claims-schema';

export const documentPrivacyLabelEnum = pgEnum('document_privacy_label', [
  'public_internal',
  'team_confidential',
  'lro_confidential',
  'privileged',
  'case_restricted',
  'highly_sensitive',
]);

export const documentRecordStatusEnum = pgEnum('document_record_status', [
  'active',
  'archived',
  'deleted',
]);

export const documentLinkedEntityTypeEnum = pgEnum('document_linked_entity_type', [
  'case',
  'grievance',
  'member',
  'policy_library',
  'template_library',
  'collective_agreement',
  'other',
]);

export const documentGrantStatusEnum = pgEnum('document_grant_status', [
  'active',
  'revoked',
  'expired',
]);

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
  title: text('title'),
  filename: text('filename'),
  name: text('name').notNull(),
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size'),
  fileType: text('file_type').notNull(),
  documentType: text('document_type'),
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
  privacyLabel: documentPrivacyLabelEnum('privacy_label').notNull().default('team_confidential'),
  containsPii: boolean('contains_pii').default(false).notNull(),
  containsMedicalSensitive: boolean('contains_medical_sensitive').default(false).notNull(),
  containsLegalPrivilege: boolean('contains_legal_privilege').default(false).notNull(),
  status: documentRecordStatusEnum('status').notNull().default('active'),
  memberPii: boolean('member_pii').default(false),
  medicalSensitive: boolean('medical_sensitive').default(false),
  disciplinarySensitive: boolean('disciplinary_sensitive').default(false),
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
  index('idx_documents_privacy_label').on(table.privacyLabel),
  index('idx_documents_status').on(table.status),
  index('idx_documents_document_type').on(table.documentType),
  index('idx_documents_created').on(table.createdAt),
  index('idx_documents_deleted_at').on(table.deletedAt),
]);

export const documentVersions = pgTable('document_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  versionNo: integer('version_no').notNull(),
  storageKey: text('storage_key').notNull(),
  contentHash: text('content_hash').notNull(),
  uploadedBy: text('uploaded_by').notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb('metadata').default({}),
}, (table) => [
  uniqueIndex('idx_document_versions_unique').on(table.documentId, table.versionNo),
  index('idx_document_versions_document').on(table.documentId),
  index('idx_document_versions_org').on(table.organizationId),
]);

export const documentLinks = pgTable('document_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  linkedEntityType: documentLinkedEntityTypeEnum('linked_entity_type').notNull(),
  linkedEntityId: uuid('linked_entity_id').notNull(),
  linkedBy: text('linked_by').notNull(),
  linkedAt: timestamp('linked_at', { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb('metadata').default({}),
}, (table) => [
  uniqueIndex('idx_document_links_unique').on(table.documentId, table.linkedEntityType, table.linkedEntityId),
  index('idx_document_links_document').on(table.documentId),
  index('idx_document_links_entity').on(table.linkedEntityType, table.linkedEntityId),
]);

export const documentAccessGrants = pgTable('document_access_grants', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  grantedBy: uuid('granted_by').notNull(),
  status: documentGrantStatusEnum('status').notNull().default('active'),
  canView: boolean('can_view').notNull().default(true),
  canDownload: boolean('can_download').notNull().default(false),
  canShare: boolean('can_share').notNull().default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_document_access_grants_document').on(table.documentId),
  index('idx_document_access_grants_user').on(table.userId),
  index('idx_document_access_grants_org').on(table.organizationId),
  index('idx_document_access_grants_status').on(table.status),
]);

export const documentSearchIndex = pgTable('document_search_index', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  title: text('title'),
  filename: text('filename'),
  fullText: text('full_text'),
  tags: text('tags').array(),
  indexedAt: timestamp('indexed_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_document_search_index_document').on(table.documentId),
  index('idx_document_search_index_org').on(table.organizationId),
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
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type NewDocumentVersion = typeof documentVersions.$inferInsert;
export type DocumentLink = typeof documentLinks.$inferSelect;
export type NewDocumentLink = typeof documentLinks.$inferInsert;
export type DocumentAccessGrant = typeof documentAccessGrants.$inferSelect;
export type NewDocumentAccessGrant = typeof documentAccessGrants.$inferInsert;


