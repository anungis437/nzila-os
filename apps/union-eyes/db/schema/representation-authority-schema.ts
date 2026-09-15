import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from '../schema-organizations';
import { documents } from './documents-schema';

export const representationAuthorityStatusEnum = pgEnum('representation_authority_status', [
  'pending',
  'active',
  'revoked',
  'expired',
  'superseded',
]);

export const representationAuthorityScopeEnum = pgEnum('representation_authority_scope', [
  'grievance',
  'wcb_claim',
]);

export const externalMatterGrantStatusEnum = pgEnum('external_matter_grant_status', [
  'active',
  'revoked',
  'expired',
]);

export const externalDocumentGrantStatusEnum = pgEnum('external_document_grant_status', [
  'active',
  'revoked',
  'expired',
]);

export const representationAuthorities = pgTable('representation_authorities', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  matterType: representationAuthorityScopeEnum('matter_type').notNull(),
  matterId: uuid('matter_id').notNull(),
  representedPersonId: uuid('represented_person_id').notNull(),
  representativeUserId: uuid('representative_user_id').notNull(),
  representativeOrganizationId: uuid('representative_organization_id').notNull(),
  scope: text('scope').array().notNull().default([]),
  source: text('source').notNull().default('recorded_authority'),
  status: representationAuthorityStatusEnum('status').notNull().default('pending'),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: uuid('revoked_by'),
  supersededByAuthorityId: uuid('superseded_by_authority_id'),
  evidenceDocumentId: uuid('evidence_document_id').references(() => documents.id),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').default({}),
}, (table) => [
  index('idx_representation_authorities_org').on(table.organizationId),
  index('idx_representation_authorities_actor').on(table.representativeUserId),
  index('idx_representation_authorities_specialist_org').on(table.representativeOrganizationId),
  index('idx_representation_authorities_matter').on(table.organizationId, table.matterType, table.matterId),
  index('idx_representation_authorities_status').on(table.status),
  index('idx_representation_authorities_expires').on(table.expiresAt),
]);

export const externalMatterAccessGrants = pgTable('external_matter_access_grants', {
  id: uuid('id').defaultRandom().primaryKey(),
  authorityId: uuid('authority_id')
    .notNull()
    .references(() => representationAuthorities.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  matterType: representationAuthorityScopeEnum('matter_type').notNull(),
  matterId: uuid('matter_id').notNull(),
  userId: uuid('user_id').notNull(),
  representativeOrganizationId: uuid('representative_organization_id').notNull(),
  status: externalMatterGrantStatusEnum('status').notNull().default('active'),
  canView: boolean('can_view').notNull().default(true),
  canComment: boolean('can_comment').notNull().default(false),
  canUploadDocuments: boolean('can_upload_documents').notNull().default(false),
  canViewDocuments: boolean('can_view_documents').notNull().default(false),
  canDownloadDocuments: boolean('can_download_documents').notNull().default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: uuid('revoked_by'),
  grantedBy: uuid('granted_by').notNull(),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_external_matter_grants_authority').on(table.authorityId),
  index('idx_external_matter_grants_org_matter').on(table.organizationId, table.matterType, table.matterId),
  index('idx_external_matter_grants_user').on(table.userId),
  index('idx_external_matter_grants_status').on(table.status),
]);

export const externalDocumentAccessGrants = pgTable('external_document_access_grants', {
  id: uuid('id').defaultRandom().primaryKey(),
  authorityId: uuid('authority_id')
    .notNull()
    .references(() => representationAuthorities.id, { onDelete: 'cascade' }),
  matterGrantId: uuid('matter_grant_id')
    .notNull()
    .references(() => externalMatterAccessGrants.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  matterType: representationAuthorityScopeEnum('matter_type').notNull(),
  matterId: uuid('matter_id').notNull(),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  representativeOrganizationId: uuid('representative_organization_id').notNull(),
  status: externalDocumentGrantStatusEnum('status').notNull().default('active'),
  canView: boolean('can_view').notNull().default(true),
  canDownload: boolean('can_download').notNull().default(false),
  canShare: boolean('can_share').notNull().default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: uuid('revoked_by'),
  grantedBy: uuid('granted_by').notNull(),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_external_document_grants_authority').on(table.authorityId),
  index('idx_external_document_grants_matter_grant').on(table.matterGrantId),
  index('idx_external_document_grants_document').on(table.documentId),
  index('idx_external_document_grants_user').on(table.userId),
  index('idx_external_document_grants_org_matter').on(table.organizationId, table.matterType, table.matterId),
  index('idx_external_document_grants_status').on(table.status),
]);

export type RepresentationAuthority = typeof representationAuthorities.$inferSelect;
export type NewRepresentationAuthority = typeof representationAuthorities.$inferInsert;
export type ExternalMatterAccessGrant = typeof externalMatterAccessGrants.$inferSelect;
export type NewExternalMatterAccessGrant = typeof externalMatterAccessGrants.$inferInsert;
export type ExternalDocumentAccessGrant = typeof externalDocumentAccessGrants.$inferSelect;
export type NewExternalDocumentAccessGrant = typeof externalDocumentAccessGrants.$inferInsert;
