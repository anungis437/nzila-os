/**
 * Document Management Integration Schema
 * 
 * Database schema for external document management system data.
 * Supports SharePoint, Google Drive, Dropbox, and other document platforms.
 * 
 * Tables:
 * - external_document_sites: Sites or workspaces
 * - external_document_libraries: Document libraries or folders
 * - external_document_files: Files and folders
 * - external_document_permissions: File/folder permissions
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
// External Document Sites
// ============================================================================
/**
 * Sites or workspaces from document management platforms
 */
export const externalDocumentSites = pgTable(
  'external_document_sites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    externalProvider: varchar('external_provider', { length: 50 }).notNull(),
    externalId: varchar('external_id', { length: 255 }).notNull(),
    siteName: varchar('site_name', { length: 255 }).notNull(),
    siteUrl: text('site_url'),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }),
    lastModifiedAt: timestamp('last_modified_at'),
    lastSyncedAt: timestamp('last_synced_at').notNull().defaultNow(),
  },
  (table) => ({
    uniqueSite: unique('unique_doc_site').on(
      table.orgId,
      table.externalProvider,
      table.externalId
    ),
    orgIdIdx: index('doc_sites_org_id_idx').on(table.orgId),
    providerIdx: index('doc_sites_provider_idx').on(table.externalProvider),
    externalIdIdx: index('doc_sites_external_id_idx').on(table.externalId),
    lastSyncIdx: index('doc_sites_last_sync_idx').on(table.lastSyncedAt),
  })
);

// ============================================================================
// External Document Libraries
// ============================================================================
/**
 * Document libraries or top-level folders
 */
export const externalDocumentLibraries = pgTable(
  'external_document_libraries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    externalProvider: varchar('external_provider', { length: 50 }).notNull(),
    externalId: varchar('external_id', { length: 255 }).notNull(),
    siteId: varchar('site_id', { length: 255 }), // Parent site external ID
    libraryName: varchar('library_name', { length: 255 }).notNull(),
    libraryUrl: text('library_url'),
    description: text('description'),
    driveType: varchar('drive_type', { length: 50 }), // documentLibrary, business, personal, etc.
    createdAt: timestamp('created_at', { withTimezone: true }),
    createdBy: varchar('created_by', { length: 255 }),
    lastSyncedAt: timestamp('last_synced_at').notNull().defaultNow(),
  },
  (table) => ({
    uniqueLibrary: unique('unique_doc_library').on(
      table.orgId,
      table.externalProvider,
      table.externalId
    ),
    orgIdIdx: index('doc_libraries_org_id_idx').on(table.orgId),
    providerIdx: index('doc_libraries_provider_idx').on(table.externalProvider),
    externalIdIdx: index('doc_libraries_external_id_idx').on(table.externalId),
    siteIdIdx: index('doc_libraries_site_id_idx').on(table.siteId),
    lastSyncIdx: index('doc_libraries_last_sync_idx').on(table.lastSyncedAt),
  })
);

// ============================================================================
// External Document Files
// ============================================================================
/**
 * Files and folders from document management platforms
 */
export const externalDocumentFiles = pgTable(
  'external_document_files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    externalProvider: varchar('external_provider', { length: 50 }).notNull(),
    externalId: varchar('external_id', { length: 255 }).notNull(),
    libraryId: uuid('library_id').references(() => externalDocumentLibraries.id, {
      onDelete: 'set null',
    }),
    fileName: varchar('file_name', { length: 500 }).notNull(),
    fileUrl: text('file_url'),
    fileSize: integer('file_size'), // Size in bytes
    mimeType: varchar('mime_type', { length: 100 }),
    isFolder: boolean('is_folder').default(false),
    folderChildCount: integer('folder_child_count'),
    createdAt: timestamp('created_at', { withTimezone: true }),
    createdBy: varchar('created_by', { length: 255 }),
    createdByEmail: varchar('created_by_email', { length: 255 }),
    lastModifiedAt: timestamp('last_modified_at'),
    lastModifiedBy: varchar('last_modified_by', { length: 255 }),
    parentPath: text('parent_path'),
    lastSyncedAt: timestamp('last_synced_at').notNull().defaultNow(),
  },
  (table) => ({
    uniqueFile: unique('unique_doc_file').on(
      table.orgId,
      table.externalProvider,
      table.externalId
    ),
    orgIdIdx: index('doc_files_org_id_idx').on(table.orgId),
    providerIdx: index('doc_files_provider_idx').on(table.externalProvider),
    libraryIdIdx: index('doc_files_library_id_idx').on(table.libraryId),
    isFolderIdx: index('doc_files_is_folder_idx').on(table.isFolder),
    createdByEmailIdx: index('doc_files_created_by_email_idx').on(table.createdByEmail),
    lastModifiedAtIdx: index('doc_files_last_modified_at_idx').on(table.lastModifiedAt),
    lastSyncIdx: index('doc_files_last_sync_idx').on(table.lastSyncedAt),
  })
);

// ============================================================================
// External Document Permissions
// ============================================================================
/**
 * File and folder permissions
 */
export const externalDocumentPermissions = pgTable(
  'external_document_permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    externalProvider: varchar('external_provider', { length: 50 }).notNull(),
    externalId: varchar('external_id', { length: 255 }).notNull(),
    fileId: uuid('file_id').references(() => externalDocumentFiles.id, {
      onDelete: 'cascade',
    }),
    userId: varchar('user_id', { length: 255 }), // External user ID
    groupId: varchar('group_id', { length: 255 }), // External group ID
    roles: varchar('roles', { length: 255 }), // read, write, owner (comma-separated)
    permissionType: varchar('permission_type', { length: 50 }), // direct, inherited, link
    scope: varchar('scope', { length: 50 }), // anonymous, organization, users
    grantedTo: varchar('granted_to', { length: 255 }), // User/group display name
    lastSyncedAt: timestamp('last_synced_at').notNull().defaultNow(),
  },
  (table) => ({
    uniquePermission: unique('unique_doc_permission').on(
      table.orgId,
      table.externalProvider,
      table.externalId
    ),
    orgIdIdx: index('doc_permissions_org_id_idx').on(table.orgId),
    providerIdx: index('doc_permissions_provider_idx').on(table.externalProvider),
    fileIdIdx: index('doc_permissions_file_id_idx').on(table.fileId),
    userIdIdx: index('doc_permissions_user_id_idx').on(table.userId),
    groupIdIdx: index('doc_permissions_group_id_idx').on(table.groupId),
    lastSyncIdx: index('doc_permissions_last_sync_idx').on(table.lastSyncedAt),
  })
);

// ============================================================================
// Relations
// ============================================================================
export const externalDocumentSitesRelations = relations(
  externalDocumentSites,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [externalDocumentSites.orgId],
      references: [organizations.id],
    }),
    libraries: many(externalDocumentLibraries),
  })
);

export const externalDocumentLibrariesRelations = relations(
  externalDocumentLibraries,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [externalDocumentLibraries.orgId],
      references: [organizations.id],
    }),
    files: many(externalDocumentFiles),
  })
);

export const externalDocumentFilesRelations = relations(
  externalDocumentFiles,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [externalDocumentFiles.orgId],
      references: [organizations.id],
    }),
    library: one(externalDocumentLibraries, {
      fields: [externalDocumentFiles.libraryId],
      references: [externalDocumentLibraries.id],
    }),
    permissions: many(externalDocumentPermissions),
  })
);

export const externalDocumentPermissionsRelations = relations(
  externalDocumentPermissions,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [externalDocumentPermissions.orgId],
      references: [organizations.id],
    }),
    file: one(externalDocumentFiles, {
      fields: [externalDocumentPermissions.fileId],
      references: [externalDocumentFiles.id],
    }),
  })
);
